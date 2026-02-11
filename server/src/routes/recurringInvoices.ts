/**
 * Recurring Invoices Routes
 *
 * Handles recurring invoice templates and generation
 */

import { Router } from 'express';
import { db } from '../db';
import { recurringInvoices, invoices, parties } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';
import {
  generateInvoiceFromRecurring,
  getUpcomingGenerations,
  pauseRecurringInvoice,
  resumeRecurringInvoice,
  processDueRecurringInvoices
} from '../services/billing/recurringInvoice';

const router = Router();

// Get all recurring invoices
router.get('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const results = await db.select({
      recurringInvoice: recurringInvoices,
      customer: parties
    })
      .from(recurringInvoices)
      .leftJoin(parties, eq(recurringInvoices.customerId, parties.id))
      .where(eq(recurringInvoices.companyId, req.companyId!))
      .orderBy(desc(recurringInvoices.createdAt));

    res.json(results.map(row => ({
      ...row.recurringInvoice,
      customer: row.customer
    })));
  } catch (error) {
    console.error('Error fetching recurring invoices:', error);
    res.status(500).json({ error: 'Failed to fetch recurring invoices' });
  }
});

// Get upcoming generations
router.get('/upcoming', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const upcoming = await getUpcomingGenerations(req.companyId!, days);
    res.json(upcoming);
  } catch (error) {
    console.error('Error fetching upcoming generations:', error);
    res.status(500).json({ error: 'Failed to fetch upcoming generations' });
  }
});

// Get single recurring invoice
router.get('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const [result] = await db.select({
      recurringInvoice: recurringInvoices,
      customer: parties
    })
      .from(recurringInvoices)
      .leftJoin(parties, eq(recurringInvoices.customerId, parties.id))
      .where(and(
        eq(recurringInvoices.id, req.params.id),
        eq(recurringInvoices.companyId, req.companyId!)
      ));

    if (!result) {
      return res.status(404).json({ error: 'Recurring invoice not found' });
    }

    res.json({
      ...result.recurringInvoice,
      customer: result.customer
    });
  } catch (error) {
    console.error('Error fetching recurring invoice:', error);
    res.status(500).json({ error: 'Failed to fetch recurring invoice' });
  }
});

// Get generated invoices history
router.get('/:id/history', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    // Get invoices that reference this recurring invoice
    // Note: This would require adding a recurringInvoiceId field to invoices
    // For now, return empty array
    res.json([]);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Create recurring invoice
router.post('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      customerId,
      name,
      frequency,
      startDate,
      endDate,
      templateData,
      autoSend,
      sendMethod,
      sendDaysBefore
    } = req.body;

    if (!customerId || !name || !frequency || !startDate || !templateData) {
      return res.status(400).json({ error: 'Customer, name, frequency, start date, and template data required' });
    }

    const [recurring] = await db.insert(recurringInvoices)
      .values({
        companyId: req.companyId!,
        customerId,
        name,
        frequency,
        startDate,
        endDate,
        nextGenerateDate: startDate,
        templateData,
        autoSend: autoSend || false,
        sendMethod: sendMethod || 'email',
        sendDaysBefore: sendDaysBefore || 0,
        isActive: true,
        isPaused: false,
        createdByUserId: req.userId!
      })
      .returning();

    res.status(201).json(recurring);
  } catch (error) {
    console.error('Error creating recurring invoice:', error);
    res.status(500).json({ error: 'Failed to create recurring invoice' });
  }
});

// Update recurring invoice
router.patch('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const updates = req.body;

    const [recurring] = await db.update(recurringInvoices)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(and(
        eq(recurringInvoices.id, req.params.id),
        eq(recurringInvoices.companyId, req.companyId!)
      ))
      .returning();

    res.json(recurring);
  } catch (error) {
    console.error('Error updating recurring invoice:', error);
    res.status(500).json({ error: 'Failed to update recurring invoice' });
  }
});

// Delete recurring invoice
router.delete('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    await db.delete(recurringInvoices)
      .where(and(
        eq(recurringInvoices.id, req.params.id),
        eq(recurringInvoices.companyId, req.companyId!)
      ));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting recurring invoice:', error);
    res.status(500).json({ error: 'Failed to delete recurring invoice' });
  }
});

// Generate invoice manually
router.post('/:id/generate', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const invoice = await generateInvoiceFromRecurring(req.params.id, req.companyId!);

    res.json({
      message: 'Invoice generated successfully',
      invoice
    });
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to generate invoice' });
  }
});

// Pause recurring invoice
router.post('/:id/pause', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { reason } = req.body;
    await pauseRecurringInvoice(req.params.id, req.companyId!, reason);
    res.json({ success: true });
  } catch (error) {
    console.error('Error pausing recurring invoice:', error);
    res.status(500).json({ error: 'Failed to pause recurring invoice' });
  }
});

// Resume recurring invoice
router.post('/:id/resume', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    await resumeRecurringInvoice(req.params.id, req.companyId!);
    res.json({ success: true });
  } catch (error) {
    console.error('Error resuming recurring invoice:', error);
    res.status(500).json({ error: 'Failed to resume recurring invoice' });
  }
});

// Process all due recurring invoices (admin/cron endpoint)
router.post('/process-due', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await processDueRecurringInvoices();
    res.json({
      message: `Processed ${result.processed} recurring invoices`,
      ...result
    });
  } catch (error) {
    console.error('Error processing due invoices:', error);
    res.status(500).json({ error: 'Failed to process due invoices' });
  }
});

export default router;
