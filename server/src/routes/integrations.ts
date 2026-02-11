/**
 * Integrations Routes
 *
 * Handles e-commerce integrations, webhooks, and third-party connections
 */

import { Router } from 'express';
import { db } from '../db';
import { integrationConnections, webhooks, webhookLogs } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';
import {
  syncShopifyOrders,
  testConnection,
  getConnectionStats,
  createWebhook,
  getWebhookLogs
} from '../services/integrations';
import {
  testWebhook,
  retryWebhook,
  enableWebhook
} from '../services/integrations/webhookDispatcher';

const router = Router();

// ==================== INTEGRATION CONNECTIONS ====================

// Get all integration connections
router.get('/connections', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const connections = await db.select()
      .from(integrationConnections)
      .where(eq(integrationConnections.companyId, req.companyId!))
      .orderBy(desc(integrationConnections.createdAt));

    // Mask sensitive credentials
    const maskedConnections = connections.map(conn => ({
      ...conn,
      credentials: conn.credentials ? '********' : null,
      accessToken: conn.accessToken ? '********' : null
    }));

    res.json(maskedConnections);
  } catch (error) {
    console.error('Error fetching connections:', error);
    res.status(500).json({ error: 'Failed to fetch connections' });
  }
});

// Get single connection
router.get('/connections/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const [connection] = await db.select()
      .from(integrationConnections)
      .where(and(
        eq(integrationConnections.id, req.params.id),
        eq(integrationConnections.companyId, req.companyId!)
      ));

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    res.json({
      ...connection,
      credentials: connection.credentials ? '********' : null,
      accessToken: connection.accessToken ? '********' : null
    });
  } catch (error) {
    console.error('Error fetching connection:', error);
    res.status(500).json({ error: 'Failed to fetch connection' });
  }
});

// Create integration connection
router.post('/connections', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      platform,
      connectionName,
      storeUrl,
      accessToken,
      credentials,
      syncSettings
    } = req.body;

    if (!platform) {
      return res.status(400).json({ error: 'Platform required' });
    }

    const [connection] = await db.insert(integrationConnections)
      .values({
        companyId: req.companyId!,
        platform,
        connectionName: connectionName || `${platform} Connection`,
        storeUrl,
        accessToken,
        credentials: credentials ? JSON.stringify(credentials) : null,
        syncSettings: syncSettings || {},
        isActive: true
      })
      .returning();

    res.status(201).json({
      ...connection,
      credentials: connection.credentials ? '********' : null,
      accessToken: connection.accessToken ? '********' : null
    });
  } catch (error) {
    console.error('Error creating connection:', error);
    res.status(500).json({ error: 'Failed to create connection' });
  }
});

// Update connection
router.patch('/connections/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const updates: any = { updatedAt: new Date() };
    const { connectionName, storeUrl, accessToken, credentials, syncSettings, isActive } = req.body;

    if (connectionName !== undefined) updates.connectionName = connectionName;
    if (storeUrl !== undefined) updates.storeUrl = storeUrl;
    if (accessToken !== undefined) updates.accessToken = accessToken;
    if (credentials !== undefined) updates.credentials = JSON.stringify(credentials);
    if (syncSettings !== undefined) updates.syncSettings = syncSettings;
    if (isActive !== undefined) updates.isActive = isActive;

    const [connection] = await db.update(integrationConnections)
      .set(updates)
      .where(and(
        eq(integrationConnections.id, req.params.id),
        eq(integrationConnections.companyId, req.companyId!)
      ))
      .returning();

    res.json({
      ...connection,
      credentials: connection.credentials ? '********' : null,
      accessToken: connection.accessToken ? '********' : null
    });
  } catch (error) {
    console.error('Error updating connection:', error);
    res.status(500).json({ error: 'Failed to update connection' });
  }
});

// Delete connection
router.delete('/connections/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    await db.delete(integrationConnections)
      .where(and(
        eq(integrationConnections.id, req.params.id),
        eq(integrationConnections.companyId, req.companyId!)
      ));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting connection:', error);
    res.status(500).json({ error: 'Failed to delete connection' });
  }
});

// Test connection
router.post('/connections/:id/test', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await testConnection(req.params.id, req.companyId!);
    res.json(result);
  } catch (error) {
    console.error('Error testing connection:', error);
    res.status(500).json({ error: 'Failed to test connection' });
  }
});

// Sync connection
router.post('/connections/:id/sync', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const [connection] = await db.select()
      .from(integrationConnections)
      .where(and(
        eq(integrationConnections.id, req.params.id),
        eq(integrationConnections.companyId, req.companyId!)
      ));

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    let result;
    switch (connection.platform) {
      case 'shopify':
        result = await syncShopifyOrders(req.params.id, req.companyId!);
        break;
      default:
        return res.status(400).json({ error: 'Sync not supported for this platform' });
    }

    res.json({
      message: `Synced ${result.synced} items`,
      ...result
    });
  } catch (error) {
    console.error('Error syncing connection:', error);
    res.status(500).json({ error: 'Failed to sync connection' });
  }
});

// Get connection stats
router.get('/connections/:id/stats', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const stats = await getConnectionStats(req.params.id, req.companyId!);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching connection stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ==================== WEBHOOKS ====================

// Get all webhooks
router.get('/webhooks', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const webhookList = await db.select()
      .from(webhooks)
      .where(eq(webhooks.companyId, req.companyId!))
      .orderBy(desc(webhooks.createdAt));

    // Mask secrets
    const maskedWebhooks = webhookList.map(w => ({
      ...w,
      secret: w.secret ? '********' : null
    }));

    res.json(maskedWebhooks);
  } catch (error) {
    console.error('Error fetching webhooks:', error);
    res.status(500).json({ error: 'Failed to fetch webhooks' });
  }
});

// Get single webhook
router.get('/webhooks/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const [webhook] = await db.select()
      .from(webhooks)
      .where(and(
        eq(webhooks.id, req.params.id),
        eq(webhooks.companyId, req.companyId!)
      ));

    if (!webhook) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    res.json({
      ...webhook,
      secret: webhook.secret ? '********' : null
    });
  } catch (error) {
    console.error('Error fetching webhook:', error);
    res.status(500).json({ error: 'Failed to fetch webhook' });
  }
});

// Create webhook
router.post('/webhooks', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { name, eventType, targetUrl, headers } = req.body;

    if (!name || !eventType || !targetUrl) {
      return res.status(400).json({ error: 'Name, event type, and target URL required' });
    }

    const webhook = await createWebhook(req.companyId!, req.userId!, {
      name,
      eventType,
      targetUrl,
      headers
    });

    res.status(201).json({
      ...webhook,
      secret: webhook.secret // Return secret on creation only
    });
  } catch (error) {
    console.error('Error creating webhook:', error);
    res.status(500).json({ error: 'Failed to create webhook' });
  }
});

// Update webhook
router.patch('/webhooks/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const updates: any = { updatedAt: new Date() };
    const { name, targetUrl, headers, isActive } = req.body;

    if (name !== undefined) updates.name = name;
    if (targetUrl !== undefined) updates.targetUrl = targetUrl;
    if (headers !== undefined) updates.headers = headers;
    if (isActive !== undefined) updates.isActive = isActive;

    const [webhook] = await db.update(webhooks)
      .set(updates)
      .where(and(
        eq(webhooks.id, req.params.id),
        eq(webhooks.companyId, req.companyId!)
      ))
      .returning();

    res.json({
      ...webhook,
      secret: webhook.secret ? '********' : null
    });
  } catch (error) {
    console.error('Error updating webhook:', error);
    res.status(500).json({ error: 'Failed to update webhook' });
  }
});

// Delete webhook
router.delete('/webhooks/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    await db.delete(webhooks)
      .where(and(
        eq(webhooks.id, req.params.id),
        eq(webhooks.companyId, req.companyId!)
      ));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

// Test webhook
router.post('/webhooks/:id/test', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await testWebhook(req.params.id, req.companyId!);
    res.json(result);
  } catch (error) {
    console.error('Error testing webhook:', error);
    res.status(500).json({ error: 'Failed to test webhook' });
  }
});

// Re-enable webhook (after auto-disable)
router.post('/webhooks/:id/enable', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    await enableWebhook(req.params.id, req.companyId!);
    res.json({ success: true });
  } catch (error) {
    console.error('Error enabling webhook:', error);
    res.status(500).json({ error: 'Failed to enable webhook' });
  }
});

// Get webhook logs
router.get('/webhooks/:id/logs', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const logs = await getWebhookLogs(req.params.id, req.companyId!, limit);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching webhook logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// Retry failed webhook
router.post('/webhooks/logs/:logId/retry', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const success = await retryWebhook(req.params.logId, req.companyId!);
    res.json({ success });
  } catch (error) {
    console.error('Error retrying webhook:', error);
    res.status(500).json({ error: 'Failed to retry webhook' });
  }
});

// ==================== SUPPORTED PLATFORMS ====================

// Get supported platforms
router.get('/platforms', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    res.json([
      {
        id: 'shopify',
        name: 'Shopify',
        description: 'Sync orders and products from your Shopify store',
        features: ['Order sync', 'Product sync', 'Auto-create invoices'],
        requiredFields: ['storeUrl', 'accessToken'],
        logo: '/integrations/shopify.svg'
      },
      {
        id: 'woocommerce',
        name: 'WooCommerce',
        description: 'Connect your WooCommerce store for order management',
        features: ['Order sync', 'Product sync', 'Auto-create invoices'],
        requiredFields: ['storeUrl', 'consumerKey', 'consumerSecret'],
        logo: '/integrations/woocommerce.svg'
      },
      {
        id: 'amazon',
        name: 'Amazon Seller',
        description: 'Import orders from Amazon Seller Central',
        features: ['Order import', 'Settlement reconciliation'],
        requiredFields: ['sellerId', 'mwsAuthToken'],
        logo: '/integrations/amazon.svg',
        comingSoon: true
      },
      {
        id: 'flipkart',
        name: 'Flipkart Seller',
        description: 'Sync with Flipkart Seller Hub',
        features: ['Order sync', 'Settlement reports'],
        requiredFields: ['sellerId', 'apiToken'],
        logo: '/integrations/flipkart.svg',
        comingSoon: true
      },
      {
        id: 'meesho',
        name: 'Meesho',
        description: 'Connect your Meesho supplier account',
        features: ['Order sync', 'Payment reconciliation'],
        requiredFields: ['supplierId', 'apiKey'],
        logo: '/integrations/meesho.svg',
        comingSoon: true
      }
    ]);
  } catch (error) {
    console.error('Error fetching platforms:', error);
    res.status(500).json({ error: 'Failed to fetch platforms' });
  }
});

// Get supported webhook events
router.get('/webhook-events', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    res.json([
      {
        event: 'invoice.created',
        description: 'When a new invoice is created'
      },
      {
        event: 'invoice.sent',
        description: 'When an invoice is sent to customer'
      },
      {
        event: 'invoice.paid',
        description: 'When an invoice is fully paid'
      },
      {
        event: 'payment.received',
        description: 'When a customer payment is recorded'
      },
      {
        event: 'payment.made',
        description: 'When a vendor payment is made'
      },
      {
        event: 'expense.created',
        description: 'When a new expense is recorded'
      },
      {
        event: 'bill.created',
        description: 'When a new vendor bill is created'
      },
      {
        event: 'bill.paid',
        description: 'When a bill is fully paid'
      },
      {
        event: 'gst.filed',
        description: 'When a GST return is filed'
      }
    ]);
  } catch (error) {
    console.error('Error fetching webhook events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

export default router;
