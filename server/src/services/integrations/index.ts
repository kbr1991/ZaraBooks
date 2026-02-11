/**
 * Integrations Service
 *
 * Handles e-commerce and third-party integrations
 */

import { db } from '../../db';
import {
  integrationConnections,
  webhooks,
  webhookLogs,
  invoices,
  parties,
  products,
  type IntegrationConnection,
  type Webhook,
  type WebhookLog
} from '../../../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import crypto from 'crypto';

// Re-export sub-modules
export * from './webhookDispatcher';

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

interface ShopifyOrder {
  id: number;
  order_number: number;
  total_price: string;
  currency: string;
  customer: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    phone?: string;
  };
  line_items: Array<{
    id: number;
    title: string;
    quantity: number;
    price: string;
    sku?: string;
  }>;
  created_at: string;
  financial_status: string;
  fulfillment_status?: string;
}

/**
 * Syncs orders from Shopify
 */
export async function syncShopifyOrders(
  connectionId: string,
  companyId: string
): Promise<{ synced: number; errors: string[] }> {
  const [connection] = await db.select()
    .from(integrationConnections)
    .where(and(
      eq(integrationConnections.id, connectionId),
      eq(integrationConnections.companyId, companyId),
      eq(integrationConnections.platform, 'shopify')
    ));

  if (!connection) {
    throw new Error('Connection not found');
  }

  // Mark sync as in progress
  await db.update(integrationConnections)
    .set({ syncInProgress: true })
    .where(eq(integrationConnections.id, connectionId));

  const result = { synced: 0, errors: [] as string[] };

  try {
    // In production, this would call Shopify API
    // const orders = await fetchShopifyOrders(connection);

    // For now, return empty result
    // Each order would be processed and converted to an invoice

    await db.update(integrationConnections)
      .set({
        syncInProgress: false,
        lastSyncAt: new Date(),
        lastSyncStatus: 'success',
        lastSyncError: null,
        updatedAt: new Date()
      })
      .where(eq(integrationConnections.id, connectionId));

  } catch (error) {
    await db.update(integrationConnections)
      .set({
        syncInProgress: false,
        lastSyncStatus: 'failed',
        lastSyncError: error instanceof Error ? error.message : 'Sync failed',
        updatedAt: new Date()
      })
      .where(eq(integrationConnections.id, connectionId));

    throw error;
  }

  return result;
}

/**
 * Creates a customer from a Shopify customer
 */
async function createCustomerFromShopify(
  companyId: string,
  shopifyCustomer: ShopifyOrder['customer']
): Promise<string> {
  // Check if customer already exists
  const existingCustomer = await db.select()
    .from(parties)
    .where(and(
      eq(parties.companyId, companyId),
      eq(parties.partyType, 'customer'),
      eq(parties.email, shopifyCustomer.email)
    ))
    .limit(1);

  if (existingCustomer.length > 0) {
    return existingCustomer[0].id;
  }

  // Create new customer
  const [customer] = await db.insert(parties)
    .values({
      companyId,
      partyType: 'customer',
      name: `${shopifyCustomer.first_name} ${shopifyCustomer.last_name}`.trim(),
      email: shopifyCustomer.email,
      phone: shopifyCustomer.phone
    })
    .returning();

  return customer.id;
}

/**
 * Tests integration connection
 */
export async function testConnection(
  connectionId: string,
  companyId: string
): Promise<{ success: boolean; message: string }> {
  const [connection] = await db.select()
    .from(integrationConnections)
    .where(and(
      eq(integrationConnections.id, connectionId),
      eq(integrationConnections.companyId, companyId)
    ));

  if (!connection) {
    return { success: false, message: 'Connection not found' };
  }

  try {
    switch (connection.platform) {
      case 'shopify':
        return await testShopifyConnection(connection);
      case 'woocommerce':
        return await testWooCommerceConnection(connection);
      default:
        return { success: false, message: 'Unsupported platform' };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection test failed'
    };
  }
}

/**
 * Tests Shopify connection
 */
async function testShopifyConnection(connection: IntegrationConnection): Promise<{ success: boolean; message: string }> {
  if (!connection.storeUrl || !connection.accessToken) {
    return { success: false, message: 'Store URL and access token required' };
  }

  try {
    const response = await fetch(`${connection.storeUrl}/admin/api/2024-01/shop.json`, {
      headers: {
        'X-Shopify-Access-Token': connection.accessToken
      }
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, message: `Connected to ${data.shop?.name || 'Shopify store'}` };
    } else {
      return { success: false, message: `API error: ${response.status}` };
    }
  } catch (error) {
    return { success: false, message: 'Failed to connect to Shopify' };
  }
}

/**
 * Tests WooCommerce connection
 */
async function testWooCommerceConnection(connection: IntegrationConnection): Promise<{ success: boolean; message: string }> {
  if (!connection.storeUrl || !connection.credentials) {
    return { success: false, message: 'Store URL and credentials required' };
  }

  try {
    const credentials = JSON.parse(connection.credentials);
    const auth = Buffer.from(`${credentials.consumerKey}:${credentials.consumerSecret}`).toString('base64');

    const response = await fetch(`${connection.storeUrl}/wp-json/wc/v3/system_status`, {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });

    if (response.ok) {
      return { success: true, message: 'Connected to WooCommerce store' };
    } else {
      return { success: false, message: `API error: ${response.status}` };
    }
  } catch (error) {
    return { success: false, message: 'Failed to connect to WooCommerce' };
  }
}

/**
 * Gets integration connection stats
 */
export async function getConnectionStats(
  connectionId: string,
  companyId: string
): Promise<{
  totalOrdersSynced: number;
  totalProductsSynced: number;
  lastSyncAt: Date | null;
  lastSyncStatus: string | null;
}> {
  const [connection] = await db.select()
    .from(integrationConnections)
    .where(and(
      eq(integrationConnections.id, connectionId),
      eq(integrationConnections.companyId, companyId)
    ));

  if (!connection) {
    throw new Error('Connection not found');
  }

  return {
    totalOrdersSynced: connection.totalOrdersSynced || 0,
    totalProductsSynced: connection.totalProductsSynced || 0,
    lastSyncAt: connection.lastSyncAt,
    lastSyncStatus: connection.lastSyncStatus
  };
}

/**
 * Registers a webhook
 */
export async function createWebhook(
  companyId: string,
  userId: string,
  data: {
    name: string;
    eventType: WebhookEventType;
    targetUrl: string;
    headers?: Record<string, string>;
  }
): Promise<Webhook> {
  // Generate secret for signature verification
  const secret = crypto.randomBytes(32).toString('hex');

  const [webhook] = await db.insert(webhooks)
    .values({
      companyId,
      name: data.name,
      eventType: data.eventType,
      targetUrl: data.targetUrl,
      secret,
      headers: data.headers,
      isActive: true,
      createdByUserId: userId
    })
    .returning();

  return webhook;
}

/**
 * Gets webhook logs
 */
export async function getWebhookLogs(
  webhookId: string,
  companyId: string,
  limit: number = 50
): Promise<WebhookLog[]> {
  // Verify webhook belongs to company
  const [webhook] = await db.select()
    .from(webhooks)
    .where(and(
      eq(webhooks.id, webhookId),
      eq(webhooks.companyId, companyId)
    ));

  if (!webhook) {
    throw new Error('Webhook not found');
  }

  return await db.select()
    .from(webhookLogs)
    .where(eq(webhookLogs.webhookId, webhookId))
    .orderBy(sql`${webhookLogs.createdAt} DESC`)
    .limit(limit);
}
