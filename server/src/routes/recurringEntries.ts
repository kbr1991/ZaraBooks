import { Router } from 'express';
import { db } from '../db';
import {
  recurringEntryTemplates, journalEntries, journalEntryLines,
  chartOfAccounts, fiscalYears
} from '@shared/schema';
import { eq, and, lte, sql, desc } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all recurring templates
router.get('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const templates = await db.query.recurringEntryTemplates.findMany({
      where: eq(recurringEntryTemplates.companyId, req.companyId!),
      orderBy: desc(recurringEntryTemplates.createdAt),
    });

    res.json(templates);
  } catch (error) {
    console.error('Get recurring templates error:', error);
    res.status(500).json({ error: 'Failed to get recurring templates' });
  }
});

// Get a single template
router.get('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const template = await db.query.recurringEntryTemplates.findFirst({
      where: and(
        eq(recurringEntryTemplates.id, id),
        eq(recurringEntryTemplates.companyId, req.companyId!)
      ),
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    console.error('Get template error:', error);
    res.status(500).json({ error: 'Failed to get template' });
  }
});

// Create a recurring template
router.post('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      name,
      narration,
      frequency,
      nextRunDate,
      endDate,
      templateLines,
    } = req.body;

    if (!name || !frequency || !nextRunDate || !templateLines) {
      return res.status(400).json({ error: 'Name, frequency, next run date, and template lines are required' });
    }

    // Validate template lines balance
    const totalDebit = templateLines.reduce((sum: number, l: any) => sum + (l.debitAmount || 0), 0);
    const totalCredit = templateLines.reduce((sum: number, l: any) => sum + (l.creditAmount || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({ error: 'Template lines must balance (total debit must equal total credit)' });
    }

    const [template] = await db.insert(recurringEntryTemplates).values({
      companyId: req.companyId!,
      name,
      narration: narration || '',
      frequency,
      nextRunDate,
      endDate: endDate || null,
      templateLines: templateLines,
      isActive: true,
      createdByUserId: req.userId!,
    }).returning();

    res.status(201).json(template);
  } catch (error) {
    console.error('Create template error:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Update a recurring template
router.patch('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Validate if template lines are being updated
    if (updates.templateLines) {
      const totalDebit = updates.templateLines.reduce((sum: number, l: any) => sum + (l.debitAmount || 0), 0);
      const totalCredit = updates.templateLines.reduce((sum: number, l: any) => sum + (l.creditAmount || 0), 0);

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        return res.status(400).json({ error: 'Template lines must balance' });
      }
    }

    const [updated] = await db
      .update(recurringEntryTemplates)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(and(
        eq(recurringEntryTemplates.id, id),
        eq(recurringEntryTemplates.companyId, req.companyId!)
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Update template error:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Delete a recurring template
router.delete('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const deleted = await db
      .delete(recurringEntryTemplates)
      .where(and(
        eq(recurringEntryTemplates.id, id),
        eq(recurringEntryTemplates.companyId, req.companyId!)
      ))
      .returning();

    if (deleted.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete template error:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// Generate entries from template (manual trigger)
router.post('/:id/generate', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { entryDate } = req.body;

    const template = await db.query.recurringEntryTemplates.findFirst({
      where: and(
        eq(recurringEntryTemplates.id, id),
        eq(recurringEntryTemplates.companyId, req.companyId!)
      ),
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Get current fiscal year
    const fiscalYear = await db.query.fiscalYears.findFirst({
      where: and(
        eq(fiscalYears.companyId, req.companyId!),
        eq(fiscalYears.isCurrent, true)
      ),
    });

    if (!fiscalYear) {
      return res.status(400).json({ error: 'No active fiscal year found' });
    }

    // Generate entry number
    const lastEntry = await db.query.journalEntries.findFirst({
      where: and(
        eq(journalEntries.companyId, req.companyId!),
        eq(journalEntries.fiscalYearId, fiscalYear.id)
      ),
      orderBy: desc(journalEntries.entryNumber),
    });

    const lastNum = lastEntry?.entryNumber
      ? parseInt(lastEntry.entryNumber.split('/').pop() || '0')
      : 0;
    const entryNumber = `REC/${fiscalYear.name}/${String(lastNum + 1).padStart(4, '0')}`;

    const templateLines = template.templateLines as any[];
    const totalDebit = templateLines.reduce((sum, l) => sum + (l.debitAmount || 0), 0);
    const totalCredit = templateLines.reduce((sum, l) => sum + (l.creditAmount || 0), 0);

    // Create journal entry
    const [entry] = await db.insert(journalEntries).values({
      companyId: req.companyId!,
      fiscalYearId: fiscalYear.id,
      entryNumber,
      entryDate: entryDate || template.nextRunDate,
      postingDate: entryDate || template.nextRunDate,
      entryType: 'recurring',
      narration: template.narration || template.name,
      totalDebit,
      totalCredit,
      sourceType: 'recurring',
      sourceId: template.id,
      status: 'draft',
      createdByUserId: req.userId!,
    }).returning();

    // Create journal entry lines
    for (const line of templateLines) {
      await db.insert(journalEntryLines).values({
        journalEntryId: entry.id,
        accountId: line.accountId,
        debitAmount: line.debitAmount || 0,
        creditAmount: line.creditAmount || 0,
        partyId: line.partyId || null,
        description: line.description || '',
      });
    }

    // Calculate next run date based on frequency
    const currentDate = new Date(template.nextRunDate);
    let nextDate = new Date(currentDate);

    switch (template.frequency) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'quarterly':
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
    }

    // Update template with next run date and last run date
    await db
      .update(recurringEntryTemplates)
      .set({
        nextRunDate: nextDate.toISOString().split('T')[0],
        lastRunAt: new Date(),
      })
      .where(eq(recurringEntryTemplates.id, template.id));

    res.json({
      success: true,
      entryId: entry.id,
      entryNumber: entry.entryNumber,
      nextRunDate: nextDate.toISOString().split('T')[0],
    });
  } catch (error) {
    console.error('Generate entry error:', error);
    res.status(500).json({ error: 'Failed to generate entry' });
  }
});

// Get due templates (for auto-generation)
router.get('/due/list', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const dueTemplates = await db.query.recurringEntryTemplates.findMany({
      where: and(
        eq(recurringEntryTemplates.companyId, req.companyId!),
        eq(recurringEntryTemplates.isActive, true),
        lte(recurringEntryTemplates.nextRunDate, today)
      ),
    });

    res.json(dueTemplates);
  } catch (error) {
    console.error('Get due templates error:', error);
    res.status(500).json({ error: 'Failed to get due templates' });
  }
});

// Process all due templates
router.post('/process-due', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const dueTemplates = await db.query.recurringEntryTemplates.findMany({
      where: and(
        eq(recurringEntryTemplates.companyId, req.companyId!),
        eq(recurringEntryTemplates.isActive, true),
        lte(recurringEntryTemplates.nextRunDate, today)
      ),
    });

    const results: Array<{ templateId: string; templateName: string; entryId?: string; error?: string }> = [];

    for (const template of dueTemplates) {
      try {
        // Get current fiscal year
        const fiscalYear = await db.query.fiscalYears.findFirst({
          where: and(
            eq(fiscalYears.companyId, req.companyId!),
            eq(fiscalYears.isCurrent, true)
          ),
        });

        if (!fiscalYear) continue;

        // Generate entry number
        const lastEntry = await db.query.journalEntries.findFirst({
          where: and(
            eq(journalEntries.companyId, req.companyId!),
            eq(journalEntries.fiscalYearId, fiscalYear.id)
          ),
          orderBy: desc(journalEntries.entryNumber),
        });

        const lastNum = lastEntry?.entryNumber
          ? parseInt(lastEntry.entryNumber.split('/').pop() || '0')
          : 0;
        const entryNumber = `REC/${fiscalYear.name}/${String(lastNum + 1).padStart(4, '0')}`;

        const templateLines = template.templateLines as any[];
        const totalDebit = templateLines.reduce((sum, l) => sum + (l.debitAmount || 0), 0);
        const totalCredit = templateLines.reduce((sum, l) => sum + (l.creditAmount || 0), 0);

        // Create journal entry
        const [entry] = await db.insert(journalEntries).values({
          companyId: req.companyId!,
          fiscalYearId: fiscalYear.id,
          entryNumber,
          entryDate: template.nextRunDate,
          postingDate: template.nextRunDate,
          entryType: 'recurring',
          narration: template.narration || template.name,
          totalDebit,
          totalCredit,
          sourceType: 'recurring',
          sourceId: template.id,
          status: 'draft',
          createdByUserId: req.userId!,
        }).returning();

        // Create journal entry lines
        for (const line of templateLines) {
          await db.insert(journalEntryLines).values({
            journalEntryId: entry.id,
            accountId: line.accountId,
            debitAmount: line.debitAmount || 0,
            creditAmount: line.creditAmount || 0,
            partyId: line.partyId || null,
            description: line.description || '',
          });
        }

        // Calculate next run date
        const currentDate = new Date(template.nextRunDate);
        let nextDate = new Date(currentDate);

        switch (template.frequency) {
          case 'daily':
            nextDate.setDate(nextDate.getDate() + 1);
            break;
          case 'weekly':
            nextDate.setDate(nextDate.getDate() + 7);
            break;
          case 'monthly':
            nextDate.setMonth(nextDate.getMonth() + 1);
            break;
          case 'quarterly':
            nextDate.setMonth(nextDate.getMonth() + 3);
            break;
          case 'yearly':
            nextDate.setFullYear(nextDate.getFullYear() + 1);
            break;
        }

        // Check if end date is reached
        const shouldDeactivate = template.endDate && nextDate > new Date(template.endDate);

        // Update template
        await db
          .update(recurringEntryTemplates)
          .set({
            nextRunDate: nextDate.toISOString().split('T')[0],
            lastRunAt: new Date(),
            isActive: !shouldDeactivate,
          })
          .where(eq(recurringEntryTemplates.id, template.id));

        results.push({
          templateId: template.id,
          templateName: template.name,
          entryId: entry.id,
        });
      } catch (err) {
        results.push({
          templateId: template.id,
          templateName: template.name,
          error: 'Failed to process',
        });
      }
    }

    res.json({
      processed: results.filter(r => r.entryId).length,
      failed: results.filter(r => r.error).length,
      results,
    });
  } catch (error) {
    console.error('Process due templates error:', error);
    res.status(500).json({ error: 'Failed to process due templates' });
  }
});

export default router;
