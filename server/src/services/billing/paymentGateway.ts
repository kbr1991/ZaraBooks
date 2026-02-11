/**
 * Payment Gateway Service
 *
 * Handles integration with payment gateways (Razorpay, PayU, etc.)
 */

import { db } from '../../db';
import {
  paymentGatewayConfig,
  paymentLinks,
  invoices,
  paymentsReceived,
  parties,
  bankAccounts,
  fiscalYears,
  journalEntries,
  journalEntryLines,
  chartOfAccounts,
  type PaymentLink,
  type Invoice
} from '../../../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { decryptJSON } from '../../utils/crypto';

interface PaymentLinkOptions {
  amount: number;
  currency?: string;
  description?: string;
  customerId?: string;
  invoiceId?: string;
  expireInDays?: number;
  notifyCustomer?: boolean;
}

interface RazorpayCredentials {
  keyId: string;
  keySecret: string;
}

/**
 * Gets the active payment gateway configuration for a company
 */
export async function getGatewayConfig(companyId: string) {
  const [config] = await db.select()
    .from(paymentGatewayConfig)
    .where(and(
      eq(paymentGatewayConfig.companyId, companyId),
      eq(paymentGatewayConfig.isActive, true)
    ));

  return config || null;
}

/**
 * Creates a payment link using the configured gateway
 */
export async function createPaymentLink(
  companyId: string,
  options: PaymentLinkOptions
): Promise<PaymentLink> {
  // Get primary gateway config
  const [config] = await db.select()
    .from(paymentGatewayConfig)
    .where(and(
      eq(paymentGatewayConfig.companyId, companyId),
      eq(paymentGatewayConfig.isActive, true),
      eq(paymentGatewayConfig.isPrimary, true)
    ));

  if (!config) {
    throw new Error('No active payment gateway configured');
  }

  let gatewayLinkId: string | undefined;
  let shortUrl: string | undefined;
  let gatewayOrderId: string | undefined;

  // Decrypt credentials
  let decryptedCredentials: RazorpayCredentials;
  try {
    decryptedCredentials = decryptJSON<RazorpayCredentials>(config.credentials!);
  } catch {
    // Fallback: try parsing as plain JSON (for pre-encryption data)
    decryptedCredentials = JSON.parse(config.credentials!) as RazorpayCredentials;
  }

  // Create link based on gateway type
  switch (config.gateway) {
    case 'razorpay':
      const razorpayResult = await createRazorpayPaymentLink(
        decryptedCredentials,
        options,
        config.isTestMode || false
      );
      gatewayLinkId = razorpayResult.linkId;
      shortUrl = razorpayResult.shortUrl;
      gatewayOrderId = razorpayResult.orderId;
      break;

    default:
      throw new Error(`Unsupported gateway: ${config.gateway}`);
  }

  // Calculate expiry
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (options.expireInDays || 7));

  // Store payment link
  const [paymentLink] = await db.insert(paymentLinks)
    .values({
      companyId,
      invoiceId: options.invoiceId,
      customerId: options.customerId,
      gateway: config.gateway,
      gatewayLinkId,
      gatewayOrderId,
      shortUrl,
      amount: options.amount.toFixed(2),
      currency: options.currency || 'INR',
      description: options.description,
      status: 'active',
      expiresAt
    })
    .returning();

  return paymentLink;
}

/**
 * Creates a Razorpay payment link
 */
async function createRazorpayPaymentLink(
  credentials: RazorpayCredentials,
  options: PaymentLinkOptions,
  isTestMode: boolean
): Promise<{ linkId: string; shortUrl: string; orderId?: string }> {
  // For MVP without actual Razorpay integration, generate a placeholder
  // In production, use the Razorpay API:
  // const Razorpay = require('razorpay');
  // const instance = new Razorpay({ key_id: credentials.keyId, key_secret: credentials.keySecret });

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    // Development mode - return mock data
    const mockId = `pay_${crypto.randomBytes(12).toString('hex')}`;
    return {
      linkId: mockId,
      shortUrl: `https://rzp.io/i/${mockId.slice(0, 8)}`,
      orderId: `order_${crypto.randomBytes(12).toString('hex')}`
    };
  }

  // Production Razorpay API call
  const auth = Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString('base64');

  const response = await fetch('https://api.razorpay.com/v1/payment_links', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: Math.round(options.amount * 100), // Razorpay expects paisa
      currency: options.currency || 'INR',
      description: options.description || 'Payment',
      customer: options.customerId ? {
        // Would fetch customer details here
      } : undefined,
      notify: {
        email: options.notifyCustomer || false,
        sms: options.notifyCustomer || false
      },
      callback_url: `${process.env.APP_URL}/api/payment-gateway/callback`,
      callback_method: 'get'
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Razorpay API error: ${error}`);
  }

  const data = await response.json();
  return {
    linkId: data.id,
    shortUrl: data.short_url,
    orderId: data.order_id
  };
}

/**
 * Handles payment gateway webhook
 */
export async function handleWebhook(
  companyId: string,
  gateway: string,
  payload: any,
  signature: string
): Promise<{ success: boolean; paymentLinkId?: string; error?: string }> {
  // Verify webhook signature
  const [config] = await db.select()
    .from(paymentGatewayConfig)
    .where(and(
      eq(paymentGatewayConfig.companyId, companyId),
      eq(paymentGatewayConfig.gateway, gateway as any)
    ));

  if (!config) {
    return { success: false, error: 'Gateway config not found' };
  }

  // Verify signature based on gateway
  if (gateway === 'razorpay') {
    const isValid = verifyRazorpaySignature(payload, signature, config.webhookSecret || '');
    if (!isValid) {
      return { success: false, error: 'Invalid signature' };
    }
  }

  // Process payment event
  const event = payload.event;

  if (event === 'payment_link.paid' || event === 'payment.captured') {
    const paymentData = payload.payload.payment_link?.entity || payload.payload.payment?.entity;

    // Find payment link
    const [paymentLink] = await db.select()
      .from(paymentLinks)
      .where(eq(paymentLinks.gatewayLinkId, paymentData.id));

    if (!paymentLink) {
      return { success: false, error: 'Payment link not found' };
    }

    // Update payment link status
    await db.update(paymentLinks)
      .set({
        status: 'paid',
        paymentReceivedAt: new Date(),
        paymentMethod: paymentData.method,
        gatewayPaymentId: paymentData.razorpay_payment_id || paymentData.id,
        updatedAt: new Date()
      })
      .where(eq(paymentLinks.id, paymentLink.id));

    // Create payment received record
    if (paymentLink.invoiceId) {
      await createPaymentReceived(paymentLink);
    }

    return { success: true, paymentLinkId: paymentLink.id };
  }

  return { success: true };
}

/**
 * Verifies Razorpay webhook signature
 */
function verifyRazorpaySignature(payload: any, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * Creates a payment received record from a payment link
 */
async function createPaymentReceived(paymentLink: PaymentLink): Promise<void> {
  if (!paymentLink.invoiceId || !paymentLink.companyId) return;

  // Get invoice
  const [invoice] = await db.select()
    .from(invoices)
    .where(eq(invoices.id, paymentLink.invoiceId));

  if (!invoice) return;

  // Get fiscal year
  const [fiscalYear] = await db.select()
    .from(fiscalYears)
    .where(and(
      eq(fiscalYears.companyId, paymentLink.companyId),
      eq(fiscalYears.isCurrent, true)
    ));

  if (!fiscalYear) return;

  // Generate payment number
  const paymentCount = await db.select({ count: sql<number>`count(*)` })
    .from(paymentsReceived)
    .where(eq(paymentsReceived.fiscalYearId, fiscalYear.id));

  const count = paymentCount[0]?.count || 0;
  const paymentNumber = `REC/${fiscalYear.name.replace('FY ', '')}/${String(Number(count) + 1).padStart(4, '0')}`;

  const amount = parseFloat(paymentLink.amount);

  // Create payment received
  const [payment] = await db.insert(paymentsReceived)
    .values({
      companyId: paymentLink.companyId,
      fiscalYearId: fiscalYear.id,
      paymentNumber,
      paymentDate: new Date().toISOString().split('T')[0],
      customerId: invoice.customerId,
      amount: amount.toFixed(2),
      paymentMethod: paymentLink.paymentMethod || 'online',
      referenceNumber: paymentLink.gatewayPaymentId,
      notes: `Payment received via ${paymentLink.gateway}`
    })
    .returning();

  // Update payment link with payment received ID
  await db.update(paymentLinks)
    .set({ paymentReceivedId: payment.id })
    .where(eq(paymentLinks.id, paymentLink.id));

  // Update invoice
  const newPaidAmount = parseFloat(invoice.paidAmount || '0') + amount;
  const newBalanceDue = parseFloat(invoice.totalAmount) - newPaidAmount;
  const newStatus = newBalanceDue <= 0 ? 'paid' : 'partially_paid';

  await db.update(invoices)
    .set({
      paidAmount: newPaidAmount.toFixed(2),
      balanceDue: Math.max(0, newBalanceDue).toFixed(2),
      status: newStatus,
      updatedAt: new Date()
    })
    .where(eq(invoices.id, invoice.id));

  // Update gateway stats
  await db.update(paymentGatewayConfig)
    .set({
      totalTransactions: sql`${paymentGatewayConfig.totalTransactions} + 1`,
      totalAmount: sql`${paymentGatewayConfig.totalAmount} + ${amount}`,
      updatedAt: new Date()
    })
    .where(and(
      eq(paymentGatewayConfig.companyId, paymentLink.companyId),
      eq(paymentGatewayConfig.gateway, paymentLink.gateway)
    ));
}

/**
 * Gets payment link status
 */
export async function getPaymentLinkStatus(
  paymentLinkId: string,
  companyId: string
): Promise<PaymentLink | null> {
  const [link] = await db.select()
    .from(paymentLinks)
    .where(and(
      eq(paymentLinks.id, paymentLinkId),
      eq(paymentLinks.companyId, companyId)
    ));

  return link || null;
}

/**
 * Cancels a payment link
 */
export async function cancelPaymentLink(
  paymentLinkId: string,
  companyId: string
): Promise<void> {
  await db.update(paymentLinks)
    .set({
      status: 'cancelled',
      updatedAt: new Date()
    })
    .where(and(
      eq(paymentLinks.id, paymentLinkId),
      eq(paymentLinks.companyId, companyId)
    ));
}

/**
 * Creates a payment link for an invoice
 */
export async function createPaymentLinkForInvoice(
  invoiceId: string,
  companyId: string
): Promise<PaymentLink> {
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

  return createPaymentLink(companyId, {
    amount: parseFloat(invoice.balanceDue),
    invoiceId: invoice.id,
    customerId: invoice.customerId,
    description: `Payment for Invoice ${invoice.invoiceNumber}`,
    notifyCustomer: !!customer?.email
  });
}

/**
 * Gets all payment links for an invoice
 */
export async function getInvoicePaymentLinks(
  invoiceId: string,
  companyId: string
): Promise<PaymentLink[]> {
  return await db.select()
    .from(paymentLinks)
    .where(and(
      eq(paymentLinks.invoiceId, invoiceId),
      eq(paymentLinks.companyId, companyId)
    ));
}
