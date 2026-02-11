/**
 * Recurring Invoice Service
 *
 * Handles automatic generation and sending of recurring invoices
 */

import { db } from '../../db';
import {
  recurringInvoices,
  invoices,
  invoiceLines,
  parties,
  fiscalYears,
  journalEntries,
  journalEntryLines,
  chartOfAccounts,
  type RecurringInvoice,
  type Invoice
} from '../../../../shared/schema';
import { eq, and, lte, sql } from 'drizzle-orm';
import { sendEmail } from '../email';

interface TemplateData {
  lines: TemplateLineItem[];
  notes?: string;
  terms?: string;
  discountAmount?: number;
  discountPercent?: number;
  billingAddress?: string;
  shippingAddress?: string;
}

interface TemplateLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  hsnSacCode?: string;
  accountId?: string;
}

/**
 * Generates an invoice from a recurring invoice template
 */
export async function generateInvoiceFromRecurring(
  recurringInvoiceId: string,
  companyId: string
): Promise<Invoice> {
  const [recurring] = await db.select()
    .from(recurringInvoices)
    .where(and(
      eq(recurringInvoices.id, recurringInvoiceId),
      eq(recurringInvoices.companyId, companyId)
    ));

  if (!recurring) {
    throw new Error('Recurring invoice not found');
  }

  if (!recurring.isActive || recurring.isPaused) {
    throw new Error('Recurring invoice is not active');
  }

  // Get customer info
  const [customer] = await db.select()
    .from(parties)
    .where(eq(parties.id, recurring.customerId));

  if (!customer) {
    throw new Error('Customer not found');
  }

  // Get current fiscal year
  const [fiscalYear] = await db.select()
    .from(fiscalYears)
    .where(and(
      eq(fiscalYears.companyId, companyId),
      eq(fiscalYears.isCurrent, true)
    ));

  if (!fiscalYear) {
    throw new Error('No active fiscal year found');
  }

  // Generate invoice number
  const invoiceCount = await db.select({ count: sql<number>`count(*)` })
    .from(invoices)
    .where(eq(invoices.fiscalYearId, fiscalYear.id));

  const count = invoiceCount[0]?.count || 0;
  const invoiceNumber = `INV/${fiscalYear.name.replace('FY ', '')}/${String(Number(count) + 1).padStart(4, '0')}`;

  const templateData = recurring.templateData as TemplateData;
  const today = new Date();
  const invoiceDate = today.toISOString().split('T')[0];

  // Calculate due date based on customer credit days
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + (customer.creditDays || 30));

  // Calculate totals
  let subtotal = 0;
  let totalTax = 0;
  const processedLines: any[] = [];

  for (const line of templateData.lines) {
    const lineAmount = line.quantity * line.unitPrice;
    const lineTax = lineAmount * (line.taxRate / 100);
    subtotal += lineAmount;
    totalTax += lineTax;

    processedLines.push({
      description: line.description,
      quantity: line.quantity.toString(),
      unitPrice: line.unitPrice.toFixed(2),
      taxRate: line.taxRate.toFixed(2),
      taxAmount: lineTax.toFixed(2),
      amount: (lineAmount + lineTax).toFixed(2),
      hsnSacCode: line.hsnSacCode,
      accountId: line.accountId
    });
  }

  // Apply discount
  const discountAmount = templateData.discountAmount || (subtotal * (templateData.discountPercent || 0) / 100);
  const totalAmount = subtotal - discountAmount + totalTax;

  // Determine GST split (simplified - assumes intra-state)
  const isInterState = customer.stateCode !== customer.stateCode; // Would need company state
  const cgst = isInterState ? 0 : totalTax / 2;
  const sgst = isInterState ? 0 : totalTax / 2;
  const igst = isInterState ? totalTax : 0;

  // Create invoice
  const [invoice] = await db.insert(invoices)
    .values({
      companyId,
      fiscalYearId: fiscalYear.id,
      invoiceNumber,
      invoiceDate,
      dueDate: dueDate.toISOString().split('T')[0],
      customerId: recurring.customerId,
      billingAddress: templateData.billingAddress || customer.address,
      shippingAddress: templateData.shippingAddress,
      subtotal: subtotal.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      taxAmount: totalTax.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      paidAmount: '0',
      balanceDue: totalAmount.toFixed(2),
      cgst: cgst.toFixed(2),
      sgst: sgst.toFixed(2),
      igst: igst.toFixed(2),
      status: 'draft',
      notes: templateData.notes,
      terms: templateData.terms,
      createdByUserId: recurring.createdByUserId
    })
    .returning();

  // Create invoice lines
  for (let i = 0; i < processedLines.length; i++) {
    await db.insert(invoiceLines).values({
      invoiceId: invoice.id,
      ...processedLines[i],
      sortOrder: i
    });
  }

  // Update recurring invoice
  const nextDate = calculateNextDate(new Date(recurring.nextGenerateDate || today), recurring.frequency);

  await db.update(recurringInvoices)
    .set({
      lastGeneratedAt: new Date(),
      totalGenerated: sql`${recurringInvoices.totalGenerated} + 1`,
      totalAmount: sql`${recurringInvoices.totalAmount} + ${totalAmount}`,
      nextGenerateDate: nextDate.toISOString().split('T')[0],
      updatedAt: new Date()
    })
    .where(eq(recurringInvoices.id, recurringInvoiceId));

  return invoice;
}

/**
 * Calculates the next generation date based on frequency
 */
function calculateNextDate(currentDate: Date, frequency: string): Date {
  const next = new Date(currentDate);

  switch (frequency) {
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      break;
    case 'half_yearly':
      next.setMonth(next.getMonth() + 6);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      break;
    default:
      next.setMonth(next.getMonth() + 1);
  }

  return next;
}

/**
 * Processes all due recurring invoices
 */
export async function processDueRecurringInvoices(): Promise<{
  processed: number;
  generated: number;
  sent: number;
  errors: string[];
}> {
  const today = new Date().toISOString().split('T')[0];

  // Get all active recurring invoices due today or earlier
  const dueInvoices = await db.select()
    .from(recurringInvoices)
    .where(and(
      eq(recurringInvoices.isActive, true),
      eq(recurringInvoices.isPaused, false),
      lte(recurringInvoices.nextGenerateDate, today)
    ));

  const result = {
    processed: 0,
    generated: 0,
    sent: 0,
    errors: [] as string[]
  };

  for (const recurring of dueInvoices) {
    result.processed++;

    try {
      // Check if end date has passed
      if (recurring.endDate && recurring.endDate < today) {
        // Deactivate the recurring invoice
        await db.update(recurringInvoices)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(recurringInvoices.id, recurring.id));
        continue;
      }

      // Generate invoice
      const invoice = await generateInvoiceFromRecurring(recurring.id, recurring.companyId);
      result.generated++;

      // Auto-send if configured
      if (recurring.autoSend) {
        try {
          await sendInvoice(invoice.id, recurring.companyId, recurring.sendMethod || 'email');
          result.sent++;
        } catch (sendError) {
          result.errors.push(`Failed to send invoice ${invoice.invoiceNumber}: ${sendError}`);
        }
      }
    } catch (error) {
      result.errors.push(`Failed to process recurring invoice ${recurring.name}: ${error}`);
    }
  }

  return result;
}

/**
 * Sends an invoice via email
 */
async function sendInvoice(
  invoiceId: string,
  companyId: string,
  method: string
): Promise<void> {
  const [invoice] = await db.select()
    .from(invoices)
    .where(and(
      eq(invoices.id, invoiceId),
      eq(invoices.companyId, companyId)
    ));

  if (!invoice) {
    throw new Error('Invoice not found');
  }

  const [customer] = await db.select()
    .from(parties)
    .where(eq(parties.id, invoice.customerId));

  if (!customer?.email) {
    throw new Error('Customer email not found');
  }

  // Update invoice status to sent
  await db.update(invoices)
    .set({ status: 'sent', updatedAt: new Date() })
    .where(eq(invoices.id, invoiceId));

  // Send email (implementation would use email service)
  if (method === 'email' || method === 'both') {
    await sendEmail({
      to: customer.email,
      subject: `Invoice ${invoice.invoiceNumber} from Your Company`,
      html: `
        <h2>Invoice ${invoice.invoiceNumber}</h2>
        <p>Dear ${customer.name},</p>
        <p>Please find attached your invoice for Rs. ${invoice.totalAmount}.</p>
        <p>Due Date: ${invoice.dueDate}</p>
        <p>Thank you for your business!</p>
      `,
      text: `Invoice ${invoice.invoiceNumber}\n\nAmount: Rs. ${invoice.totalAmount}\nDue Date: ${invoice.dueDate}`
    });
  }
}

/**
 * Gets upcoming recurring invoice generations
 */
export async function getUpcomingGenerations(
  companyId: string,
  days: number = 30
): Promise<RecurringInvoice[]> {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  const futureDateStr = futureDate.toISOString().split('T')[0];

  return await db.select()
    .from(recurringInvoices)
    .where(and(
      eq(recurringInvoices.companyId, companyId),
      eq(recurringInvoices.isActive, true),
      eq(recurringInvoices.isPaused, false),
      lte(recurringInvoices.nextGenerateDate, futureDateStr)
    ));
}

/**
 * Pauses a recurring invoice
 */
export async function pauseRecurringInvoice(
  recurringInvoiceId: string,
  companyId: string,
  reason?: string
): Promise<void> {
  await db.update(recurringInvoices)
    .set({
      isPaused: true,
      pauseReason: reason,
      updatedAt: new Date()
    })
    .where(and(
      eq(recurringInvoices.id, recurringInvoiceId),
      eq(recurringInvoices.companyId, companyId)
    ));
}

/**
 * Resumes a paused recurring invoice
 */
export async function resumeRecurringInvoice(
  recurringInvoiceId: string,
  companyId: string
): Promise<void> {
  await db.update(recurringInvoices)
    .set({
      isPaused: false,
      pauseReason: null,
      updatedAt: new Date()
    })
    .where(and(
      eq(recurringInvoices.id, recurringInvoiceId),
      eq(recurringInvoices.companyId, companyId)
    ));
}
