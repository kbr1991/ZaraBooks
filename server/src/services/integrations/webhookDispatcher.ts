/**
 * Webhook Dispatcher Service
 *
 * Handles sending webhooks to external services
 */

import { db } from '../../db';
import {
  webhooks,
  webhookLogs,
  type Webhook
} from '../../../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import crypto from 'crypto';

type WebhookEventType =
  | 'invoice.created'
  | 'invoice.sent'
  | 'invoice.paid'
  | 'payment.received'
  | 'payment.made'
  | 'expense.created'
  | 'bill.created'
  | 'bill.paid'
  | 'gst.filed';

interface WebhookPayload {
  event: WebhookEventType;
  timestamp: string;
  data: any;
}

const MAX_CONSECUTIVE_FAILURES = 5;
const WEBHOOK_TIMEOUT = 30000; // 30 seconds

/**
 * Dispatches a webhook event to all registered listeners
 */
export async function dispatchWebhook(
  companyId: string,
  event: WebhookEventType,
  data: any
): Promise<{ sent: number; failed: number }> {
  // Get all active webhooks for this event
  const activeWebhooks = await db.select()
    .from(webhooks)
    .where(and(
      eq(webhooks.companyId, companyId),
      eq(webhooks.eventType, event),
      eq(webhooks.isActive, true)
    ));

  const result = { sent: 0, failed: 0 };

  for (const webhook of activeWebhooks) {
    const success = await sendWebhook(webhook, event, data);
    if (success) {
      result.sent++;
    } else {
      result.failed++;
    }
  }

  return result;
}

/**
 * Sends a webhook to a single target
 */
async function sendWebhook(
  webhook: Webhook,
  event: WebhookEventType,
  data: any
): Promise<boolean> {
  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data
  };

  const payloadString = JSON.stringify(payload);

  // Generate signature
  const signature = webhook.secret
    ? crypto.createHmac('sha256', webhook.secret).update(payloadString).digest('hex')
    : undefined;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Webhook-Event': event,
    'X-Webhook-Timestamp': payload.timestamp,
    ...(signature && { 'X-Webhook-Signature': `sha256=${signature}` }),
    ...(webhook.headers as Record<string, string> || {})
  };

  const startTime = Date.now();
  let responseStatus: number | undefined;
  let responseBody: string | undefined;
  let error: string | undefined;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT);

    const response = await fetch(webhook.targetUrl, {
      method: 'POST',
      headers,
      body: payloadString,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    responseStatus = response.status;
    responseBody = await response.text();

    const success = response.ok;

    // Log the webhook call
    await db.insert(webhookLogs).values({
      webhookId: webhook.id,
      eventType: event,
      payload,
      responseStatus,
      responseBody: responseBody.substring(0, 10000), // Truncate long responses
      durationMs: Date.now() - startTime
    });

    // Update webhook stats
    if (success) {
      await db.update(webhooks)
        .set({
          lastTriggeredAt: new Date(),
          lastStatus: responseStatus,
          lastError: null,
          consecutiveFailures: 0,
          totalTriggered: sql`${webhooks.totalTriggered} + 1`,
          updatedAt: new Date()
        })
        .where(eq(webhooks.id, webhook.id));
    } else {
      await handleWebhookFailure(webhook, responseStatus, responseBody);
    }

    return success;

  } catch (err) {
    error = err instanceof Error ? err.message : 'Unknown error';

    // Log the failed call
    await db.insert(webhookLogs).values({
      webhookId: webhook.id,
      eventType: event,
      payload,
      responseStatus: 0,
      error,
      durationMs: Date.now() - startTime
    });

    await handleWebhookFailure(webhook, 0, error);
    return false;
  }
}

/**
 * Handles webhook failure
 */
async function handleWebhookFailure(
  webhook: Webhook,
  status: number,
  error: string
): Promise<void> {
  const newFailureCount = (webhook.consecutiveFailures || 0) + 1;

  const updateData: any = {
    lastTriggeredAt: new Date(),
    lastStatus: status,
    lastError: error,
    consecutiveFailures: newFailureCount,
    totalTriggered: sql`${webhooks.totalTriggered} + 1`,
    updatedAt: new Date()
  };

  // Auto-disable after too many failures
  if (newFailureCount >= MAX_CONSECUTIVE_FAILURES) {
    updateData.isActive = false;
    updateData.autoDisabledAt = new Date();
  }

  await db.update(webhooks)
    .set(updateData)
    .where(eq(webhooks.id, webhook.id));
}

/**
 * Retries a failed webhook delivery
 */
export async function retryWebhook(
  logId: string,
  companyId: string
): Promise<boolean> {
  const [log] = await db.select()
    .from(webhookLogs)
    .where(eq(webhookLogs.id, logId));

  if (!log) {
    throw new Error('Webhook log not found');
  }

  const [webhook] = await db.select()
    .from(webhooks)
    .where(and(
      eq(webhooks.id, log.webhookId),
      eq(webhooks.companyId, companyId)
    ));

  if (!webhook) {
    throw new Error('Webhook not found');
  }

  const payload = log.payload as WebhookPayload;
  return sendWebhook(webhook, log.eventType, payload.data);
}

/**
 * Tests a webhook by sending a test event
 */
export async function testWebhook(
  webhookId: string,
  companyId: string
): Promise<{ success: boolean; responseStatus?: number; error?: string }> {
  const [webhook] = await db.select()
    .from(webhooks)
    .where(and(
      eq(webhooks.id, webhookId),
      eq(webhooks.companyId, companyId)
    ));

  if (!webhook) {
    throw new Error('Webhook not found');
  }

  const testData = {
    test: true,
    message: 'This is a test webhook from ZaraBooks',
    timestamp: new Date().toISOString()
  };

  const success = await sendWebhook(webhook, webhook.eventType, testData);

  // Get the latest log for this webhook
  const [latestLog] = await db.select()
    .from(webhookLogs)
    .where(eq(webhookLogs.webhookId, webhookId))
    .orderBy(sql`${webhookLogs.createdAt} DESC`)
    .limit(1);

  return {
    success,
    responseStatus: latestLog?.responseStatus || undefined,
    error: latestLog?.error || undefined
  };
}

/**
 * Re-enables a webhook that was auto-disabled
 */
export async function enableWebhook(
  webhookId: string,
  companyId: string
): Promise<void> {
  await db.update(webhooks)
    .set({
      isActive: true,
      consecutiveFailures: 0,
      autoDisabledAt: null,
      updatedAt: new Date()
    })
    .where(and(
      eq(webhooks.id, webhookId),
      eq(webhooks.companyId, companyId)
    ));
}

/**
 * Dispatches webhooks for common events
 */
export const webhookEvents = {
  invoiceCreated: (companyId: string, invoice: any) =>
    dispatchWebhook(companyId, 'invoice.created', invoice),

  invoiceSent: (companyId: string, invoice: any) =>
    dispatchWebhook(companyId, 'invoice.sent', invoice),

  invoicePaid: (companyId: string, invoice: any) =>
    dispatchWebhook(companyId, 'invoice.paid', invoice),

  paymentReceived: (companyId: string, payment: any) =>
    dispatchWebhook(companyId, 'payment.received', payment),

  paymentMade: (companyId: string, payment: any) =>
    dispatchWebhook(companyId, 'payment.made', payment),

  expenseCreated: (companyId: string, expense: any) =>
    dispatchWebhook(companyId, 'expense.created', expense),

  billCreated: (companyId: string, bill: any) =>
    dispatchWebhook(companyId, 'bill.created', bill),

  billPaid: (companyId: string, bill: any) =>
    dispatchWebhook(companyId, 'bill.paid', bill),

  gstFiled: (companyId: string, data: any) =>
    dispatchWebhook(companyId, 'gst.filed', data)
};
