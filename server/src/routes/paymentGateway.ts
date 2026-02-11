/**
 * Payment Gateway Routes
 *
 * Handles payment gateway configuration, payment links, and webhooks
 */

import { Router } from 'express';
import { db } from '../db';
import { paymentGatewayConfig, paymentLinks, invoices, paymentsReceived, parties } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';
import {
  createPaymentLinkForInvoice,
  handleWebhook,
  getGatewayConfig
} from '../services/billing/paymentGateway';

const router = Router();

// ==================== GATEWAY CONFIGURATION ====================

// Get payment gateway configuration
router.get('/config', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const configs = await db.select()
      .from(paymentGatewayConfig)
      .where(eq(paymentGatewayConfig.companyId, req.companyId!))
      .orderBy(desc(paymentGatewayConfig.createdAt));

    // Mask sensitive credentials
    const maskedConfigs = configs.map(config => ({
      ...config,
      credentials: config.credentials ? '********' : null,
      webhookSecret: config.webhookSecret ? '********' : null
    }));

    res.json(maskedConfigs);
  } catch (error) {
    console.error('Error fetching gateway config:', error);
    res.status(500).json({ error: 'Failed to fetch gateway configuration' });
  }
});

// Get active gateway
router.get('/config/active', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const config = await getGatewayConfig(req.companyId!);
    if (!config) {
      return res.json(null);
    }

    res.json({
      id: config.id,
      gateway: config.gateway,
      isActive: config.isActive,
      settings: config.settings
    });
  } catch (error) {
    console.error('Error fetching active gateway:', error);
    res.status(500).json({ error: 'Failed to fetch active gateway' });
  }
});

// Create/Update payment gateway configuration
router.post('/config', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { gateway, credentials, webhookSecret, settings } = req.body;

    if (!gateway || !credentials) {
      return res.status(400).json({ error: 'Gateway and credentials required' });
    }

    // Deactivate other configs for same gateway
    await db.update(paymentGatewayConfig)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(paymentGatewayConfig.companyId, req.companyId!),
        eq(paymentGatewayConfig.gateway, gateway)
      ));

    // Create new config
    const [config] = await db.insert(paymentGatewayConfig)
      .values({
        companyId: req.companyId!,
        gateway,
        credentials: JSON.stringify(credentials),
        webhookSecret,
        settings,
        isActive: true
      })
      .returning();

    res.status(201).json({
      ...config,
      credentials: '********',
      webhookSecret: webhookSecret ? '********' : null
    });
  } catch (error) {
    console.error('Error creating gateway config:', error);
    res.status(500).json({ error: 'Failed to create gateway configuration' });
  }
});

// Update gateway configuration
router.patch('/config/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { credentials, webhookSecret, settings, isActive } = req.body;

    const updates: any = { updatedAt: new Date() };
    if (credentials) updates.credentials = JSON.stringify(credentials);
    if (webhookSecret !== undefined) updates.webhookSecret = webhookSecret;
    if (settings !== undefined) updates.settings = settings;
    if (isActive !== undefined) updates.isActive = isActive;

    const [config] = await db.update(paymentGatewayConfig)
      .set(updates)
      .where(and(
        eq(paymentGatewayConfig.id, req.params.id),
        eq(paymentGatewayConfig.companyId, req.companyId!)
      ))
      .returning();

    res.json({
      ...config,
      credentials: '********',
      webhookSecret: config.webhookSecret ? '********' : null
    });
  } catch (error) {
    console.error('Error updating gateway config:', error);
    res.status(500).json({ error: 'Failed to update gateway configuration' });
  }
});

// Delete gateway configuration
router.delete('/config/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    await db.delete(paymentGatewayConfig)
      .where(and(
        eq(paymentGatewayConfig.id, req.params.id),
        eq(paymentGatewayConfig.companyId, req.companyId!)
      ));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting gateway config:', error);
    res.status(500).json({ error: 'Failed to delete gateway configuration' });
  }
});

// ==================== PAYMENT LINKS ====================

// Get all payment links
router.get('/links', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, invoiceId } = req.query;

    let links = await db.select({
      link: paymentLinks,
      invoice: invoices
    })
      .from(paymentLinks)
      .leftJoin(invoices, eq(paymentLinks.invoiceId, invoices.id))
      .where(eq(paymentLinks.companyId, req.companyId!))
      .orderBy(desc(paymentLinks.createdAt));

    // Apply filters
    if (status && status !== 'all') {
      links = links.filter(l => l.link.status === status);
    }

    if (invoiceId) {
      links = links.filter(l => l.link.invoiceId === invoiceId);
    }

    res.json(links.map(row => ({
      ...row.link,
      invoice: row.invoice
    })));
  } catch (error) {
    console.error('Error fetching payment links:', error);
    res.status(500).json({ error: 'Failed to fetch payment links' });
  }
});

// Create payment link for invoice
router.post('/links/invoice/:invoiceId', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await createPaymentLinkForInvoice(
      req.params.invoiceId,
      req.companyId!
    );

    res.status(201).json(result);
  } catch (error) {
    console.error('Error creating payment link:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create payment link' });
  }
});

// Create standalone payment link
router.post('/links', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { amount, description, customerId, expiryDays } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'Amount required' });
    }

    const config = await getGatewayConfig(req.companyId!);
    if (!config) {
      return res.status(400).json({ error: 'No payment gateway configured' });
    }

    // Get customer details if provided
    let customerEmail: string | undefined;
    let customerPhone: string | undefined;

    if (customerId) {
      const [customer] = await db.select()
        .from(parties)
        .where(and(
          eq(parties.id, customerId),
          eq(parties.companyId, req.companyId!)
        ));

      if (customer) {
        customerEmail = customer.email || undefined;
        customerPhone = customer.phone || undefined;
      }
    }

    // Create link via gateway (simplified - would integrate with actual gateway API)
    const [link] = await db.insert(paymentLinks)
      .values({
        companyId: req.companyId!,
        gateway: config.gateway,
        amount: amount.toString(),
        status: 'active',
        expiresAt: expiryDays ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000) : undefined
      })
      .returning();

    res.status(201).json(link);
  } catch (error) {
    console.error('Error creating payment link:', error);
    res.status(500).json({ error: 'Failed to create payment link' });
  }
});

// Get payment link status
router.get('/links/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const [link] = await db.select()
      .from(paymentLinks)
      .where(and(
        eq(paymentLinks.id, req.params.id),
        eq(paymentLinks.companyId, req.companyId!)
      ));

    if (!link) {
      return res.status(404).json({ error: 'Payment link not found' });
    }

    res.json(link);
  } catch (error) {
    console.error('Error fetching payment link:', error);
    res.status(500).json({ error: 'Failed to fetch payment link' });
  }
});

// Cancel payment link
router.post('/links/:id/cancel', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const [link] = await db.update(paymentLinks)
      .set({
        status: 'cancelled',
        updatedAt: new Date()
      })
      .where(and(
        eq(paymentLinks.id, req.params.id),
        eq(paymentLinks.companyId, req.companyId!)
      ))
      .returning();

    res.json(link);
  } catch (error) {
    console.error('Error cancelling payment link:', error);
    res.status(500).json({ error: 'Failed to cancel payment link' });
  }
});

// ==================== WEBHOOKS ====================

// Razorpay webhook handler
router.post('/webhook/razorpay', async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;

    if (!signature) {
      return res.status(400).json({ error: 'Missing signature' });
    }

    const result = await handleWebhook('razorpay', req.body, signature);

    if (result.success) {
      res.json({ status: 'ok' });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('Razorpay webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// PayU webhook handler
router.post('/webhook/payu', async (req, res) => {
  try {
    const result = await handleWebhook('payu', req.body);

    if (result.success) {
      res.json({ status: 'ok' });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('PayU webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Cashfree webhook handler
router.post('/webhook/cashfree', async (req, res) => {
  try {
    const signature = req.headers['x-cashfree-signature'] as string;

    const result = await handleWebhook('cashfree', req.body, signature);

    if (result.success) {
      res.json({ status: 'ok' });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    console.error('Cashfree webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// ==================== UPI ====================

// Generate UPI payment QR/Deep link
router.post('/upi/generate', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { amount, invoiceId, description } = req.body;

    if (!amount) {
      return res.status(400).json({ error: 'Amount required' });
    }

    // Get company UPI ID from settings
    // This would come from company settings in production
    const upiId = 'company@upi';
    const payeeName = 'Company Name';

    // Generate UPI payment URL
    const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(description || 'Payment')}`;

    res.json({
      upiUrl,
      upiId,
      amount,
      qrData: upiUrl // Can be used to generate QR code on frontend
    });
  } catch (error) {
    console.error('Error generating UPI link:', error);
    res.status(500).json({ error: 'Failed to generate UPI link' });
  }
});

export default router;
