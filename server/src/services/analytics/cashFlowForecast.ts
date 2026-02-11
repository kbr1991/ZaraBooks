/**
 * Cash Flow Forecast Service
 *
 * Provides cash flow predictions and analysis
 */

import { db } from '../../db';
import {
  cashFlowForecasts,
  invoices,
  bills,
  recurringInvoices,
  bankAccounts,
  paymentsReceived,
  paymentsMade,
  expenses,
  journalEntries,
  journalEntryLines,
  chartOfAccounts,
  type CashFlowForecast
} from '../../../../shared/schema';
import { eq, and, gte, lte, sql, or, desc, between } from 'drizzle-orm';

interface ForecastBreakdown {
  receivables: Array<{
    id: string;
    source: string;
    expectedDate: string;
    amount: number;
    probability: number;
  }>;
  payables: Array<{
    id: string;
    source: string;
    expectedDate: string;
    amount: number;
  }>;
  recurring: Array<{
    id: string;
    name: string;
    expectedDate: string;
    amount: number;
    type: 'inflow' | 'outflow';
  }>;
  historical: {
    averageDailyInflow: number;
    averageDailyOutflow: number;
    trend: 'up' | 'down' | 'stable';
  };
}

/**
 * Generates a cash flow forecast
 */
export async function generateForecast(
  companyId: string,
  days: number = 30
): Promise<CashFlowForecast> {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + days);

  const todayStr = today.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  // Get current bank balance
  const bankAccountsList = await db.select()
    .from(bankAccounts)
    .where(and(
      eq(bankAccounts.companyId, companyId),
      eq(bankAccounts.isActive, true)
    ));

  let currentBalance = 0;
  for (const account of bankAccountsList) {
    currentBalance += parseFloat(account.currentBalance || '0');
  }

  // Predict inflows
  const { inflows, receivables } = await predictInflows(companyId, todayStr, endDateStr);

  // Predict outflows
  const { outflows, payables } = await predictOutflows(companyId, todayStr, endDateStr);

  // Get recurring patterns
  const recurring = await getRecurringPatterns(companyId, todayStr, endDateStr);

  // Calculate historical patterns
  const historical = await analyzeHistoricalPatterns(companyId);

  // Add historical average for remaining days
  const daysWithData = new Set([
    ...receivables.map(r => r.expectedDate),
    ...payables.map(p => p.expectedDate)
  ]).size;

  const remainingDays = days - daysWithData;
  const historicalInflows = remainingDays * historical.averageDailyInflow;
  const historicalOutflows = remainingDays * historical.averageDailyOutflow;

  // Total predictions
  const totalInflows = inflows + recurring.filter(r => r.type === 'inflow').reduce((sum, r) => sum + r.amount, 0) + historicalInflows;
  const totalOutflows = outflows + recurring.filter(r => r.type === 'outflow').reduce((sum, r) => sum + r.amount, 0) + historicalOutflows;
  const predictedBalance = currentBalance + totalInflows - totalOutflows;

  // Calculate confidence based on data quality
  const confidence = calculateConfidence(receivables.length, payables.length, days);

  // Store forecast
  const [forecast] = await db.insert(cashFlowForecasts)
    .values({
      companyId,
      forecastDate: todayStr,
      forecastType: `${days}_day`,
      predictedInflows: totalInflows.toFixed(2),
      predictedOutflows: totalOutflows.toFixed(2),
      predictedBalance: predictedBalance.toFixed(2),
      currentBalance: currentBalance.toFixed(2),
      confidenceLevel: confidence.toFixed(2),
      breakdown: {
        receivables,
        payables,
        recurring,
        historical
      },
      modelVersion: '1.0',
      dataPointsUsed: receivables.length + payables.length
    })
    .returning();

  return forecast;
}

/**
 * Predicts cash inflows from outstanding invoices
 */
async function predictInflows(
  companyId: string,
  startDate: string,
  endDate: string
): Promise<{
  inflows: number;
  receivables: ForecastBreakdown['receivables'];
}> {
  // Get unpaid invoices
  const unpaidInvoices = await db.select()
    .from(invoices)
    .where(and(
      eq(invoices.companyId, companyId),
      or(
        eq(invoices.status, 'sent'),
        eq(invoices.status, 'overdue'),
        eq(invoices.status, 'partially_paid')
      ),
      lte(invoices.dueDate, endDate)
    ));

  let totalInflows = 0;
  const receivables: ForecastBreakdown['receivables'] = [];

  for (const invoice of unpaidInvoices) {
    const balanceDue = parseFloat(invoice.balanceDue);
    const dueDate = new Date(invoice.dueDate);
    const today = new Date();

    // Calculate probability based on age
    let probability = 95;
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysOverdue > 0) {
      // Decrease probability for overdue invoices
      probability = Math.max(30, 95 - (daysOverdue * 2));
    }

    const expectedAmount = balanceDue * (probability / 100);
    totalInflows += expectedAmount;

    receivables.push({
      id: invoice.id,
      source: `Invoice ${invoice.invoiceNumber}`,
      expectedDate: invoice.dueDate,
      amount: balanceDue,
      probability
    });
  }

  return { inflows: totalInflows, receivables };
}

/**
 * Predicts cash outflows from outstanding bills
 */
async function predictOutflows(
  companyId: string,
  startDate: string,
  endDate: string
): Promise<{
  outflows: number;
  payables: ForecastBreakdown['payables'];
}> {
  // Get unpaid bills
  const unpaidBills = await db.select()
    .from(bills)
    .where(and(
      eq(bills.companyId, companyId),
      or(
        eq(bills.status, 'pending'),
        eq(bills.status, 'overdue'),
        eq(bills.status, 'partially_paid')
      ),
      lte(bills.dueDate, endDate)
    ));

  let totalOutflows = 0;
  const payables: ForecastBreakdown['payables'] = [];

  for (const bill of unpaidBills) {
    const balanceDue = parseFloat(bill.balanceDue);
    totalOutflows += balanceDue;

    payables.push({
      id: bill.id,
      source: `Bill ${bill.billNumber}`,
      expectedDate: bill.dueDate,
      amount: balanceDue
    });
  }

  // Add pending expenses
  const pendingExpenses = await db.select()
    .from(expenses)
    .where(and(
      eq(expenses.companyId, companyId),
      eq(expenses.status, 'approved')
    ));

  for (const expense of pendingExpenses) {
    const amount = parseFloat(expense.totalAmount);
    totalOutflows += amount;

    payables.push({
      id: expense.id,
      source: `Expense ${expense.expenseNumber}`,
      expectedDate: expense.expenseDate,
      amount
    });
  }

  return { outflows: totalOutflows, payables };
}

/**
 * Gets recurring income/expense patterns
 */
async function getRecurringPatterns(
  companyId: string,
  startDate: string,
  endDate: string
): Promise<ForecastBreakdown['recurring']> {
  const patterns: ForecastBreakdown['recurring'] = [];

  // Get recurring invoices that will generate in the period
  const recurringInvoicesList = await db.select()
    .from(recurringInvoices)
    .where(and(
      eq(recurringInvoices.companyId, companyId),
      eq(recurringInvoices.isActive, true),
      lte(recurringInvoices.nextGenerateDate, endDate)
    ));

  for (const ri of recurringInvoicesList) {
    const templateData = ri.templateData as any;
    let amount = 0;
    if (templateData?.lines) {
      for (const line of templateData.lines) {
        amount += (line.quantity || 1) * (line.unitPrice || 0);
      }
    }

    patterns.push({
      id: ri.id,
      name: ri.name,
      expectedDate: ri.nextGenerateDate || startDate,
      amount,
      type: 'inflow'
    });
  }

  return patterns;
}

/**
 * Analyzes historical cash flow patterns
 */
async function analyzeHistoricalPatterns(companyId: string): Promise<ForecastBreakdown['historical']> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const startDate = thirtyDaysAgo.toISOString().split('T')[0];
  const endDate = new Date().toISOString().split('T')[0];

  // Get payments received in last 30 days
  const recentPayments = await db.select()
    .from(paymentsReceived)
    .where(and(
      eq(paymentsReceived.companyId, companyId),
      gte(paymentsReceived.paymentDate, startDate)
    ));

  let totalInflows = 0;
  for (const payment of recentPayments) {
    totalInflows += parseFloat(payment.amount);
  }

  // Get payments made in last 30 days
  const recentPaymentsMade = await db.select()
    .from(paymentsMade)
    .where(and(
      eq(paymentsMade.companyId, companyId),
      gte(paymentsMade.paymentDate, startDate)
    ));

  let totalOutflows = 0;
  for (const payment of recentPaymentsMade) {
    totalOutflows += parseFloat(payment.amount);
  }

  // Get expenses in last 30 days
  const recentExpenses = await db.select()
    .from(expenses)
    .where(and(
      eq(expenses.companyId, companyId),
      eq(expenses.status, 'paid'),
      gte(expenses.expenseDate, startDate)
    ));

  for (const expense of recentExpenses) {
    totalOutflows += parseFloat(expense.totalAmount);
  }

  const averageDailyInflow = totalInflows / 30;
  const averageDailyOutflow = totalOutflows / 30;

  // Determine trend (simplified)
  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (totalInflows > totalOutflows * 1.2) {
    trend = 'up';
  } else if (totalOutflows > totalInflows * 1.2) {
    trend = 'down';
  }

  return {
    averageDailyInflow,
    averageDailyOutflow,
    trend
  };
}

/**
 * Calculates forecast confidence score
 */
function calculateConfidence(receivablesCount: number, payablesCount: number, days: number): number {
  let confidence = 80; // Base confidence

  // More data points increase confidence
  if (receivablesCount > 5) confidence += 5;
  if (receivablesCount > 10) confidence += 5;
  if (payablesCount > 5) confidence += 5;
  if (payablesCount > 10) confidence += 5;

  // Longer forecasts have lower confidence
  if (days > 30) confidence -= 10;
  if (days > 60) confidence -= 10;
  if (days > 90) confidence -= 10;

  return Math.max(20, Math.min(98, confidence));
}

/**
 * Gets the latest forecast for a company
 */
export async function getLatestForecast(
  companyId: string,
  forecastType?: string
): Promise<CashFlowForecast | null> {
  let query = db.select()
    .from(cashFlowForecasts)
    .where(eq(cashFlowForecasts.companyId, companyId));

  if (forecastType) {
    query = query.where(and(
      eq(cashFlowForecasts.companyId, companyId),
      eq(cashFlowForecasts.forecastType, forecastType)
    ));
  }

  const forecasts = await query.orderBy(desc(cashFlowForecasts.generatedAt)).limit(1);
  return forecasts[0] || null;
}

/**
 * Gets forecast history
 */
export async function getForecastHistory(
  companyId: string,
  limit: number = 10
): Promise<CashFlowForecast[]> {
  return await db.select()
    .from(cashFlowForecasts)
    .where(eq(cashFlowForecasts.companyId, companyId))
    .orderBy(desc(cashFlowForecasts.generatedAt))
    .limit(limit);
}

/**
 * Gets daily cash flow breakdown for a date range
 */
export async function getDailyCashFlow(
  companyId: string,
  startDate: string,
  endDate: string
): Promise<Array<{
  date: string;
  inflows: number;
  outflows: number;
  balance: number;
}>> {
  const result: Array<{
    date: string;
    inflows: number;
    outflows: number;
    balance: number;
  }> = [];

  // Get all payments received
  const payments = await db.select()
    .from(paymentsReceived)
    .where(and(
      eq(paymentsReceived.companyId, companyId),
      between(paymentsReceived.paymentDate, startDate, endDate)
    ));

  // Get all payments made
  const paymentsMadeList = await db.select()
    .from(paymentsMade)
    .where(and(
      eq(paymentsMade.companyId, companyId),
      between(paymentsMade.paymentDate, startDate, endDate)
    ));

  // Group by date
  const dailyData: { [date: string]: { inflows: number; outflows: number } } = {};

  for (const payment of payments) {
    const date = payment.paymentDate;
    if (!dailyData[date]) {
      dailyData[date] = { inflows: 0, outflows: 0 };
    }
    dailyData[date].inflows += parseFloat(payment.amount);
  }

  for (const payment of paymentsMadeList) {
    const date = payment.paymentDate;
    if (!dailyData[date]) {
      dailyData[date] = { inflows: 0, outflows: 0 };
    }
    dailyData[date].outflows += parseFloat(payment.amount);
  }

  // Build result with running balance
  let runningBalance = 0;
  const dates = Object.keys(dailyData).sort();

  for (const date of dates) {
    const { inflows, outflows } = dailyData[date];
    runningBalance += inflows - outflows;

    result.push({
      date,
      inflows,
      outflows,
      balance: runningBalance
    });
  }

  return result;
}
