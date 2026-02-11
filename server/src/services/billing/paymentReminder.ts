/**
 * Payment Reminder Service
 *
 * Handles automated payment reminders for overdue invoices
 */

import { db } from '../../db';
import {
  paymentReminders,
  invoices,
  parties,
  companies,
  type PaymentReminder,
  type Invoice
} from '../../../../shared/schema';
import { eq, and, lte, or, sql } from 'drizzle-orm';
import { sendEmail } from '../email';

interface ReminderConfig {
  // Days before/after due date for each level
  gentle: number;   // e.g., -3 (3 days before due)
  firm: number;     // e.g., 7 (7 days after due)
  urgent: number;   // e.g., 14 (14 days after due)
  final: number;    // e.g., 30 (30 days after due)
}

const DEFAULT_CONFIG: ReminderConfig = {
  gentle: -3,   // 3 days before due date
  firm: 7,      // 7 days overdue
  urgent: 14,   // 14 days overdue
  final: 30     // 30 days overdue
};

/**
 * Schedules payment reminders for an invoice
 */
export async function scheduleReminders(
  invoiceId: string,
  companyId: string,
  config: ReminderConfig = DEFAULT_CONFIG
): Promise<PaymentReminder[]> {
  const [invoice] = await db.select()
    .from(invoices)
    .where(and(
      eq(invoices.id, invoiceId),
      eq(invoices.companyId, companyId)
    ));

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  const dueDate = new Date(invoice.dueDate);
  const reminders: PaymentReminder[] = [];

  // Create reminders for each level
  const levels: Array<{ level: 'gentle' | 'firm' | 'urgent' | 'final'; days: number }> = [
    { level: 'gentle', days: config.gentle },
    { level: 'firm', days: config.firm },
    { level: 'urgent', days: config.urgent },
    { level: 'final', days: config.final }
  ];

  for (const { level, days } of levels) {
    const scheduledDate = new Date(dueDate);
    scheduledDate.setDate(scheduledDate.getDate() + days);

    // Only schedule if the date is in the future
    if (scheduledDate > new Date()) {
      const [reminder] = await db.insert(paymentReminders)
        .values({
          companyId,
          invoiceId,
          reminderLevel: level,
          scheduledDate: scheduledDate.toISOString().split('T')[0],
          sendMethod: 'email',
          status: 'pending'
        })
        .returning();

      reminders.push(reminder);
    }
  }

  return reminders;
}

/**
 * Processes all due reminders
 */
export async function processDueReminders(): Promise<{
  processed: number;
  sent: number;
  skipped: number;
  errors: string[];
}> {
  const today = new Date().toISOString().split('T')[0];

  // Get pending reminders due today or earlier
  const dueReminders = await db.select()
    .from(paymentReminders)
    .where(and(
      eq(paymentReminders.status, 'pending'),
      lte(paymentReminders.scheduledDate, today)
    ));

  const result = {
    processed: 0,
    sent: 0,
    skipped: 0,
    errors: [] as string[]
  };

  for (const reminder of dueReminders) {
    result.processed++;

    try {
      // Get invoice status
      const [invoice] = await db.select()
        .from(invoices)
        .where(eq(invoices.id, reminder.invoiceId));

      if (!invoice) {
        result.errors.push(`Invoice not found for reminder ${reminder.id}`);
        continue;
      }

      // Skip if invoice is already paid
      if (invoice.status === 'paid') {
        await db.update(paymentReminders)
          .set({ status: 'cancelled' })
          .where(eq(paymentReminders.id, reminder.id));
        result.skipped++;
        continue;
      }

      // Send reminder
      await sendReminder(reminder, invoice);
      result.sent++;

      // Update reminder status
      await db.update(paymentReminders)
        .set({
          status: 'sent',
          sentAt: new Date()
        })
        .where(eq(paymentReminders.id, reminder.id));

    } catch (error) {
      result.errors.push(`Failed to send reminder ${reminder.id}: ${error}`);

      // Update retry count
      await db.update(paymentReminders)
        .set({
          retryCount: sql`${paymentReminders.retryCount} + 1`,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        })
        .where(eq(paymentReminders.id, reminder.id));

      // Mark as failed after 3 retries
      if ((reminder.retryCount || 0) >= 2) {
        await db.update(paymentReminders)
          .set({ status: 'failed' })
          .where(eq(paymentReminders.id, reminder.id));
      }
    }
  }

  return result;
}

/**
 * Sends a payment reminder
 */
async function sendReminder(reminder: PaymentReminder, invoice: Invoice): Promise<void> {
  const [customer] = await db.select()
    .from(parties)
    .where(eq(parties.id, invoice.customerId));

  if (!customer?.email) {
    throw new Error('Customer email not found');
  }

  const [company] = await db.select()
    .from(companies)
    .where(eq(companies.id, invoice.companyId));

  const companyName = company?.name || 'Your Provider';
  const { subject, body } = getReminderContent(reminder.reminderLevel, invoice, customer.name, companyName);

  // Update reminder with message content
  await db.update(paymentReminders)
    .set({
      subject,
      message: body
    })
    .where(eq(paymentReminders.id, reminder.id));

  // Send email
  await sendEmail({
    to: customer.email,
    subject,
    html: body,
    text: body.replace(/<[^>]*>/g, '')
  });
}

/**
 * Gets reminder content based on level
 */
function getReminderContent(
  level: string,
  invoice: Invoice,
  customerName: string,
  companyName: string
): { subject: string; body: string } {
  const amount = parseFloat(invoice.balanceDue).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR'
  });
  const dueDate = new Date(invoice.dueDate).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  switch (level) {
    case 'gentle':
      return {
        subject: `Payment Reminder: Invoice ${invoice.invoiceNumber} - Due Soon`,
        body: `
          <p>Dear ${customerName},</p>
          <p>This is a friendly reminder that Invoice <strong>${invoice.invoiceNumber}</strong> for <strong>${amount}</strong> is due on <strong>${dueDate}</strong>.</p>
          <p>Please arrange for payment at your earliest convenience to avoid any late payment fees.</p>
          <p>If you have already made the payment, please ignore this reminder.</p>
          <p>Thank you for your business!</p>
          <p>Best regards,<br>${companyName}</p>
        `
      };

    case 'firm':
      return {
        subject: `Payment Overdue: Invoice ${invoice.invoiceNumber} - Immediate Attention Required`,
        body: `
          <p>Dear ${customerName},</p>
          <p>We notice that Invoice <strong>${invoice.invoiceNumber}</strong> for <strong>${amount}</strong> was due on <strong>${dueDate}</strong> and remains unpaid.</p>
          <p>Please process this payment as soon as possible to avoid any service interruptions.</p>
          <p>If there are any issues with the invoice or you need to discuss payment options, please contact us immediately.</p>
          <p>Best regards,<br>${companyName}</p>
        `
      };

    case 'urgent':
      return {
        subject: `URGENT: Invoice ${invoice.invoiceNumber} - Payment Significantly Overdue`,
        body: `
          <p>Dear ${customerName},</p>
          <p>Despite our previous reminders, Invoice <strong>${invoice.invoiceNumber}</strong> for <strong>${amount}</strong> remains unpaid. The invoice was due on <strong>${dueDate}</strong>.</p>
          <p>This is an urgent request for immediate payment. Please process this payment within the next 48 hours to avoid further action.</p>
          <p>If you are experiencing difficulties, please contact us to discuss payment arrangements.</p>
          <p>Best regards,<br>${companyName}</p>
        `
      };

    case 'final':
      return {
        subject: `FINAL NOTICE: Invoice ${invoice.invoiceNumber} - Action Required`,
        body: `
          <p>Dear ${customerName},</p>
          <p>This is our final notice regarding Invoice <strong>${invoice.invoiceNumber}</strong> for <strong>${amount}</strong>, which was due on <strong>${dueDate}</strong>.</p>
          <p>Despite multiple reminders, we have not received payment. We are required to take further action if payment is not received within 7 days.</p>
          <p>This may include:</p>
          <ul>
            <li>Suspension of services</li>
            <li>Late payment charges</li>
            <li>Collection proceedings</li>
          </ul>
          <p>Please contact us immediately to resolve this matter.</p>
          <p>Best regards,<br>${companyName}</p>
        `
      };

    default:
      return {
        subject: `Payment Reminder: Invoice ${invoice.invoiceNumber}`,
        body: `
          <p>Dear ${customerName},</p>
          <p>This is a reminder regarding Invoice ${invoice.invoiceNumber} for ${amount}.</p>
          <p>Please process payment at your earliest convenience.</p>
          <p>Best regards,<br>${companyName}</p>
        `
      };
  }
}

/**
 * Cancels all pending reminders for an invoice (e.g., when paid)
 */
export async function cancelReminders(invoiceId: string): Promise<number> {
  const result = await db.update(paymentReminders)
    .set({ status: 'cancelled' })
    .where(and(
      eq(paymentReminders.invoiceId, invoiceId),
      eq(paymentReminders.status, 'pending')
    ));

  return 0; // Would return count if drizzle supported it
}

/**
 * Gets reminder history for an invoice
 */
export async function getReminderHistory(invoiceId: string): Promise<PaymentReminder[]> {
  return await db.select()
    .from(paymentReminders)
    .where(eq(paymentReminders.invoiceId, invoiceId))
    .orderBy(paymentReminders.scheduledDate);
}

/**
 * Creates reminder schedules for all unpaid invoices
 */
export async function setupRemindersForOverdueInvoices(
  companyId: string
): Promise<{ invoicesProcessed: number; remindersCreated: number }> {
  const unpaidInvoices = await db.select()
    .from(invoices)
    .where(and(
      eq(invoices.companyId, companyId),
      or(
        eq(invoices.status, 'sent'),
        eq(invoices.status, 'overdue'),
        eq(invoices.status, 'partially_paid')
      )
    ));

  let remindersCreated = 0;

  for (const invoice of unpaidInvoices) {
    // Check if reminders already exist
    const existingReminders = await db.select()
      .from(paymentReminders)
      .where(eq(paymentReminders.invoiceId, invoice.id));

    if (existingReminders.length === 0) {
      const created = await scheduleReminders(invoice.id, companyId);
      remindersCreated += created.length;
    }
  }

  return {
    invoicesProcessed: unpaidInvoices.length,
    remindersCreated
  };
}
