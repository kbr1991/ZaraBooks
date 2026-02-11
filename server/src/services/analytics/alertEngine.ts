/**
 * Smart Alert Engine Service
 *
 * Generates intelligent alerts for important business events
 */

import { db } from '../../db';
import {
  smartAlerts,
  invoices,
  bills,
  bankAccounts,
  gstConfig,
  gstr3bSummary,
  tdsDeductions,
  expenses,
  bankFeedTransactions,
  type SmartAlert,
  type InsertSmartAlert
} from '../../../../shared/schema';
import { eq, and, lte, gte, or, sql, lt, gt, isNull } from 'drizzle-orm';

type AlertType =
  | 'low_cash'
  | 'gst_due'
  | 'tds_threshold'
  | 'invoice_overdue'
  | 'bill_due'
  | 'expense_limit'
  | 'reconciliation_pending'
  | 'filing_deadline'
  | 'payment_received'
  | 'unusual_transaction';

type AlertSeverity = 'info' | 'warning' | 'critical';

interface AlertConfig {
  lowCashThreshold?: number;
  expenseMonthlyLimit?: number;
  reconciliationPendingDays?: number;
  overdueReminderDays?: number[];
}

const DEFAULT_CONFIG: AlertConfig = {
  lowCashThreshold: 50000, // Rs 50,000
  expenseMonthlyLimit: 100000, // Rs 1,00,000
  reconciliationPendingDays: 7,
  overdueReminderDays: [7, 15, 30]
};

/**
 * Runs all alert checks for a company
 */
export async function runAlertChecks(
  companyId: string,
  config: AlertConfig = DEFAULT_CONFIG
): Promise<SmartAlert[]> {
  const newAlerts: SmartAlert[] = [];

  // Check low cash balance
  const lowCashAlert = await checkLowCashBalance(companyId, config.lowCashThreshold);
  if (lowCashAlert) newAlerts.push(lowCashAlert);

  // Check overdue invoices
  const overdueAlerts = await checkOverdueInvoices(companyId, config.overdueReminderDays);
  newAlerts.push(...overdueAlerts);

  // Check bills due soon
  const billsDueAlerts = await checkBillsDueSoon(companyId);
  newAlerts.push(...billsDueAlerts);

  // Check GST filing deadlines
  const gstAlerts = await checkGSTDeadlines(companyId);
  newAlerts.push(...gstAlerts);

  // Check TDS thresholds
  const tdsAlerts = await checkTDSThresholds(companyId);
  newAlerts.push(...tdsAlerts);

  // Check expense limits
  const expenseAlert = await checkExpenseLimits(companyId, config.expenseMonthlyLimit);
  if (expenseAlert) newAlerts.push(expenseAlert);

  // Check pending reconciliation
  const reconciliationAlert = await checkPendingReconciliation(companyId, config.reconciliationPendingDays);
  if (reconciliationAlert) newAlerts.push(reconciliationAlert);

  return newAlerts;
}

/**
 * Checks for low cash balance
 */
async function checkLowCashBalance(
  companyId: string,
  threshold: number = 50000
): Promise<SmartAlert | null> {
  const accounts = await db.select()
    .from(bankAccounts)
    .where(and(
      eq(bankAccounts.companyId, companyId),
      eq(bankAccounts.isActive, true)
    ));

  let totalBalance = 0;
  for (const account of accounts) {
    totalBalance += parseFloat(account.currentBalance || '0');
  }

  if (totalBalance < threshold) {
    // Check if similar alert exists recently
    const existingAlert = await db.select()
      .from(smartAlerts)
      .where(and(
        eq(smartAlerts.companyId, companyId),
        eq(smartAlerts.alertType, 'low_cash'),
        eq(smartAlerts.isDismissed, false),
        gte(smartAlerts.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24 hours
      ))
      .limit(1);

    if (existingAlert.length > 0) {
      return null;
    }

    const [alert] = await db.insert(smartAlerts)
      .values({
        companyId,
        alertType: 'low_cash',
        severity: totalBalance < threshold / 2 ? 'critical' : 'warning',
        title: 'Low Cash Balance Alert',
        message: `Your total bank balance is Rs. ${totalBalance.toLocaleString('en-IN')}. This is below your threshold of Rs. ${threshold.toLocaleString('en-IN')}.`,
        data: { totalBalance, threshold, accounts: accounts.map(a => ({ name: a.bankName, balance: a.currentBalance })) },
        actionUrl: '/banking',
        actionLabel: 'View Accounts'
      })
      .returning();

    return alert;
  }

  return null;
}

/**
 * Checks for overdue invoices
 */
async function checkOverdueInvoices(
  companyId: string,
  reminderDays: number[] = [7, 15, 30]
): Promise<SmartAlert[]> {
  const today = new Date().toISOString().split('T')[0];
  const alerts: SmartAlert[] = [];

  // Get overdue invoices
  const overdueInvoices = await db.select()
    .from(invoices)
    .where(and(
      eq(invoices.companyId, companyId),
      or(
        eq(invoices.status, 'sent'),
        eq(invoices.status, 'overdue'),
        eq(invoices.status, 'partially_paid')
      ),
      lt(invoices.dueDate, today)
    ));

  for (const invoice of overdueInvoices) {
    const dueDate = new Date(invoice.dueDate);
    const daysOverdue = Math.floor((new Date().getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    // Check if we should alert based on reminder days
    if (!reminderDays.some(d => Math.abs(daysOverdue - d) <= 1)) {
      continue;
    }

    // Check for existing alert
    const existingAlert = await db.select()
      .from(smartAlerts)
      .where(and(
        eq(smartAlerts.companyId, companyId),
        eq(smartAlerts.alertType, 'invoice_overdue'),
        eq(smartAlerts.entityId, invoice.id),
        eq(smartAlerts.isDismissed, false),
        gte(smartAlerts.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      ))
      .limit(1);

    if (existingAlert.length > 0) {
      continue;
    }

    const severity: AlertSeverity = daysOverdue > 30 ? 'critical' : daysOverdue > 15 ? 'warning' : 'info';

    const [alert] = await db.insert(smartAlerts)
      .values({
        companyId,
        alertType: 'invoice_overdue',
        severity,
        title: `Invoice ${invoice.invoiceNumber} is ${daysOverdue} days overdue`,
        message: `Invoice ${invoice.invoiceNumber} for Rs. ${parseFloat(invoice.balanceDue).toLocaleString('en-IN')} was due on ${invoice.dueDate}.`,
        data: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, amount: invoice.balanceDue, daysOverdue },
        entityType: 'invoice',
        entityId: invoice.id,
        actionUrl: `/invoices/${invoice.id}`,
        actionLabel: 'View Invoice'
      })
      .returning();

    alerts.push(alert);
  }

  return alerts;
}

/**
 * Checks for bills due soon
 */
async function checkBillsDueSoon(companyId: string): Promise<SmartAlert[]> {
  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const alerts: SmartAlert[] = [];

  const billsDueSoon = await db.select()
    .from(bills)
    .where(and(
      eq(bills.companyId, companyId),
      or(eq(bills.status, 'pending'), eq(bills.status, 'partially_paid')),
      lte(bills.dueDate, nextWeek.toISOString().split('T')[0]),
      gte(bills.dueDate, today.toISOString().split('T')[0])
    ));

  for (const bill of billsDueSoon) {
    const dueDate = new Date(bill.dueDate);
    const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // Check for existing alert
    const existingAlert = await db.select()
      .from(smartAlerts)
      .where(and(
        eq(smartAlerts.companyId, companyId),
        eq(smartAlerts.alertType, 'bill_due'),
        eq(smartAlerts.entityId, bill.id),
        eq(smartAlerts.isDismissed, false),
        gte(smartAlerts.createdAt, new Date(Date.now() - 3 * 24 * 60 * 60 * 1000))
      ))
      .limit(1);

    if (existingAlert.length > 0) {
      continue;
    }

    const severity: AlertSeverity = daysUntilDue <= 2 ? 'warning' : 'info';

    const [alert] = await db.insert(smartAlerts)
      .values({
        companyId,
        alertType: 'bill_due',
        severity,
        title: `Bill ${bill.billNumber} due in ${daysUntilDue} days`,
        message: `Bill ${bill.billNumber} for Rs. ${parseFloat(bill.balanceDue).toLocaleString('en-IN')} is due on ${bill.dueDate}.`,
        data: { billId: bill.id, billNumber: bill.billNumber, amount: bill.balanceDue, daysUntilDue },
        entityType: 'bill',
        entityId: bill.id,
        actionUrl: `/bills/${bill.id}`,
        actionLabel: 'View Bill'
      })
      .returning();

    alerts.push(alert);
  }

  return alerts;
}

/**
 * Checks GST filing deadlines
 */
async function checkGSTDeadlines(companyId: string): Promise<SmartAlert[]> {
  const alerts: SmartAlert[] = [];
  const today = new Date();

  // Get GST config
  const gstConfigs = await db.select()
    .from(gstConfig)
    .where(and(
      eq(gstConfig.companyId, companyId),
      eq(gstConfig.isActive, true)
    ));

  if (gstConfigs.length === 0) {
    return alerts;
  }

  // GSTR-1 deadline: 11th of following month
  // GSTR-3B deadline: 20th of following month

  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const day = today.getDate();

  // Check GSTR-1 deadline (11th)
  if (day <= 11 && day >= 8) {
    const [existingAlert] = await db.select()
      .from(smartAlerts)
      .where(and(
        eq(smartAlerts.companyId, companyId),
        eq(smartAlerts.alertType, 'gst_due'),
        eq(smartAlerts.isDismissed, false),
        sql`${smartAlerts.data}->>'type' = 'GSTR1'`,
        gte(smartAlerts.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      ))
      .limit(1);

    if (!existingAlert) {
      const [alert] = await db.insert(smartAlerts)
        .values({
          companyId,
          alertType: 'gst_due',
          severity: day >= 10 ? 'critical' : 'warning',
          title: 'GSTR-1 Filing Deadline Approaching',
          message: `GSTR-1 for the previous month is due by the 11th. Please ensure timely filing.`,
          data: { type: 'GSTR1', deadline: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-11` },
          actionUrl: '/gst-returns',
          actionLabel: 'File GSTR-1'
        })
        .returning();

      alerts.push(alert);
    }
  }

  // Check GSTR-3B deadline (20th)
  if (day <= 20 && day >= 17) {
    const [existingAlert] = await db.select()
      .from(smartAlerts)
      .where(and(
        eq(smartAlerts.companyId, companyId),
        eq(smartAlerts.alertType, 'gst_due'),
        eq(smartAlerts.isDismissed, false),
        sql`${smartAlerts.data}->>'type' = 'GSTR3B'`,
        gte(smartAlerts.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      ))
      .limit(1);

    if (!existingAlert) {
      const [alert] = await db.insert(smartAlerts)
        .values({
          companyId,
          alertType: 'gst_due',
          severity: day >= 19 ? 'critical' : 'warning',
          title: 'GSTR-3B Filing Deadline Approaching',
          message: `GSTR-3B for the previous month is due by the 20th. Please ensure timely filing.`,
          data: { type: 'GSTR3B', deadline: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-20` },
          actionUrl: '/gst-returns',
          actionLabel: 'File GSTR-3B'
        })
        .returning();

      alerts.push(alert);
    }
  }

  return alerts;
}

/**
 * Checks TDS thresholds
 */
async function checkTDSThresholds(companyId: string): Promise<SmartAlert[]> {
  const alerts: SmartAlert[] = [];

  // TDS threshold check logic would go here
  // This is a simplified version

  return alerts;
}

/**
 * Checks monthly expense limits
 */
async function checkExpenseLimits(
  companyId: string,
  monthlyLimit: number = 100000
): Promise<SmartAlert | null> {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];

  const monthlyExpenses = await db.select()
    .from(expenses)
    .where(and(
      eq(expenses.companyId, companyId),
      gte(expenses.expenseDate, firstOfMonth)
    ));

  let totalExpenses = 0;
  for (const expense of monthlyExpenses) {
    totalExpenses += parseFloat(expense.totalAmount);
  }

  const percentUsed = (totalExpenses / monthlyLimit) * 100;

  if (percentUsed >= 80) {
    const [existingAlert] = await db.select()
      .from(smartAlerts)
      .where(and(
        eq(smartAlerts.companyId, companyId),
        eq(smartAlerts.alertType, 'expense_limit'),
        eq(smartAlerts.isDismissed, false),
        gte(smartAlerts.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      ))
      .limit(1);

    if (existingAlert) {
      return null;
    }

    const severity: AlertSeverity = percentUsed >= 100 ? 'critical' : 'warning';

    const [alert] = await db.insert(smartAlerts)
      .values({
        companyId,
        alertType: 'expense_limit',
        severity,
        title: 'Monthly Expense Limit Alert',
        message: `You have used ${percentUsed.toFixed(0)}% of your monthly expense budget (Rs. ${totalExpenses.toLocaleString('en-IN')} of Rs. ${monthlyLimit.toLocaleString('en-IN')}).`,
        data: { totalExpenses, monthlyLimit, percentUsed },
        actionUrl: '/expenses',
        actionLabel: 'View Expenses'
      })
      .returning();

    return alert;
  }

  return null;
}

/**
 * Checks for pending bank reconciliation
 */
async function checkPendingReconciliation(
  companyId: string,
  maxDays: number = 7
): Promise<SmartAlert | null> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxDays);

  const pendingTransactions = await db.select({ count: sql<number>`count(*)` })
    .from(bankFeedTransactions)
    .where(and(
      eq(bankFeedTransactions.companyId, companyId),
      eq(bankFeedTransactions.reconciliationStatus, 'pending'),
      lte(bankFeedTransactions.createdAt, cutoffDate)
    ));

  const count = pendingTransactions[0]?.count || 0;

  if (count > 0) {
    const [existingAlert] = await db.select()
      .from(smartAlerts)
      .where(and(
        eq(smartAlerts.companyId, companyId),
        eq(smartAlerts.alertType, 'reconciliation_pending'),
        eq(smartAlerts.isDismissed, false),
        gte(smartAlerts.createdAt, new Date(Date.now() - 3 * 24 * 60 * 60 * 1000))
      ))
      .limit(1);

    if (existingAlert) {
      return null;
    }

    const [alert] = await db.insert(smartAlerts)
      .values({
        companyId,
        alertType: 'reconciliation_pending',
        severity: count > 50 ? 'warning' : 'info',
        title: 'Bank Transactions Pending Reconciliation',
        message: `You have ${count} bank transactions pending reconciliation for more than ${maxDays} days.`,
        data: { count, maxDays },
        actionUrl: '/bank-feeds',
        actionLabel: 'Reconcile Now'
      })
      .returning();

    return alert;
  }

  return null;
}

/**
 * Creates a new alert manually
 */
export async function createAlert(
  companyId: string,
  data: {
    alertType: string;
    severity: 'info' | 'warning' | 'critical';
    title: string;
    message: string;
    data?: any;
    actionUrl?: string;
    expiresAt?: Date;
  }
): Promise<SmartAlert> {
  const [alert] = await db.insert(smartAlerts)
    .values({
      companyId,
      alertType: data.alertType,
      severity: data.severity,
      title: data.title,
      message: data.message,
      data: data.data,
      actionUrl: data.actionUrl,
      expiresAt: data.expiresAt,
      isRead: false,
      isDismissed: false
    })
    .returning();

  return alert;
}

/**
 * Gets unread alerts for a company
 */
export async function getUnreadAlerts(companyId: string): Promise<SmartAlert[]> {
  return await db.select()
    .from(smartAlerts)
    .where(and(
      eq(smartAlerts.companyId, companyId),
      eq(smartAlerts.isRead, false),
      eq(smartAlerts.isDismissed, false),
      or(
        isNull(smartAlerts.expiresAt),
        gte(smartAlerts.expiresAt, new Date())
      )
    ))
    .orderBy(smartAlerts.createdAt);
}

/**
 * Marks an alert as read
 */
export async function markAlertRead(alertId: string, companyId: string): Promise<void> {
  await db.update(smartAlerts)
    .set({
      isRead: true,
      readAt: new Date()
    })
    .where(and(
      eq(smartAlerts.id, alertId),
      eq(smartAlerts.companyId, companyId)
    ));
}

/**
 * Dismisses an alert
 */
export async function dismissAlert(
  alertId: string,
  companyId: string,
  userId: string
): Promise<void> {
  await db.update(smartAlerts)
    .set({
      isDismissed: true,
      dismissedAt: new Date(),
      dismissedByUserId: userId
    })
    .where(and(
      eq(smartAlerts.id, alertId),
      eq(smartAlerts.companyId, companyId)
    ));
}
