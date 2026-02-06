import { Router } from 'express';
import { db } from '../db';
import { journalEntries, journalEntryLines, fiscalYears, chartOfAccounts, trialBalanceCache } from '@shared/schema';
import { eq, and, desc, gte, lte, sql, asc } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Generate entry number
async function generateEntryNumber(companyId: string, fiscalYearId: string): Promise<string> {
  const fy = await db.query.fiscalYears.findFirst({
    where: eq(fiscalYears.id, fiscalYearId),
  });

  const fyName = fy?.name.replace('FY ', '') || '';

  const lastEntry = await db.query.journalEntries.findFirst({
    where: and(
      eq(journalEntries.companyId, companyId),
      eq(journalEntries.fiscalYearId, fiscalYearId)
    ),
    orderBy: desc(journalEntries.createdAt),
  });

  let nextNumber = 1;
  if (lastEntry?.entryNumber) {
    const parts = lastEntry.entryNumber.split('/');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextNumber = lastNum + 1;
    }
  }

  return `JV/${fyName}/${nextNumber.toString().padStart(4, '0')}`;
}

// Get all journal entries
router.get('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { fiscalYearId, status, startDate, endDate, limit = 50, offset = 0 } = req.query;

    let whereConditions = [eq(journalEntries.companyId, req.companyId!)];

    if (fiscalYearId) {
      whereConditions.push(eq(journalEntries.fiscalYearId, fiscalYearId as string));
    }
    if (status) {
      whereConditions.push(eq(journalEntries.status, status as any));
    }
    if (startDate) {
      whereConditions.push(gte(journalEntries.entryDate, startDate as string));
    }
    if (endDate) {
      whereConditions.push(lte(journalEntries.entryDate, endDate as string));
    }

    const entries = await db.query.journalEntries.findMany({
      where: and(...whereConditions),
      with: {
        lines: {
          with: {
            account: true,
            party: true,
          },
        },
        createdBy: true,
      },
      orderBy: [desc(journalEntries.entryDate), desc(journalEntries.createdAt)],
      limit: Number(limit),
      offset: Number(offset),
    });

    // Get total count
    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(journalEntries)
      .where(and(...whereConditions));

    res.json({
      entries,
      total: countResult[0].count,
      limit: Number(limit),
      offset: Number(offset),
    });
  } catch (error) {
    console.error('Get entries error:', error);
    res.status(500).json({ error: 'Failed to get entries' });
  }
});

// Get entry by ID
router.get('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const entry = await db.query.journalEntries.findFirst({
      where: and(
        eq(journalEntries.id, id),
        eq(journalEntries.companyId, req.companyId!)
      ),
      with: {
        lines: {
          with: {
            account: true,
            party: true,
            costCenter: true,
          },
          orderBy: asc(journalEntryLines.sortOrder),
        },
        createdBy: true,
        approvedBy: true,
        fiscalYear: true,
      },
    });

    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json(entry);
  } catch (error) {
    console.error('Get entry error:', error);
    res.status(500).json({ error: 'Failed to get entry' });
  }
});

// Create journal entry
router.post('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      fiscalYearId,
      entryDate,
      entryType = 'manual',
      narration,
      sourceType,
      sourceId,
      status = 'draft',
      attachments,
      lines,
    } = req.body;

    // Validate fiscal year
    const fy = await db.query.fiscalYears.findFirst({
      where: and(
        eq(fiscalYears.id, fiscalYearId),
        eq(fiscalYears.companyId, req.companyId!)
      ),
    });

    if (!fy) {
      return res.status(400).json({ error: 'Invalid fiscal year' });
    }

    if (fy.isLocked) {
      return res.status(400).json({ error: 'Fiscal year is locked' });
    }

    // Validate entry date is within fiscal year
    if (entryDate < fy.startDate || entryDate > fy.endDate) {
      return res.status(400).json({ error: 'Entry date is outside fiscal year' });
    }

    // Validate lines
    if (!lines || lines.length < 2) {
      return res.status(400).json({ error: 'At least 2 lines required' });
    }

    // Calculate totals
    let totalDebit = 0;
    let totalCredit = 0;
    for (const line of lines) {
      totalDebit += parseFloat(line.debitAmount || 0);
      totalCredit += parseFloat(line.creditAmount || 0);
    }

    // Validate balance
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({ error: 'Entry must balance (debits must equal credits)' });
    }

    // Generate entry number
    const entryNumber = await generateEntryNumber(req.companyId!, fiscalYearId);

    // Create entry
    const [entry] = await db.insert(journalEntries).values({
      companyId: req.companyId!,
      fiscalYearId,
      entryNumber,
      entryDate,
      postingDate: status === 'posted' ? entryDate : null,
      entryType,
      narration,
      totalDebit: totalDebit.toFixed(2),
      totalCredit: totalCredit.toFixed(2),
      sourceType,
      sourceId,
      status,
      attachments,
      createdByUserId: req.userId!,
    }).returning();

    // Create lines
    const lineValues = lines.map((line: any, index: number) => ({
      journalEntryId: entry.id,
      accountId: line.accountId,
      debitAmount: parseFloat(line.debitAmount || 0).toFixed(2),
      creditAmount: parseFloat(line.creditAmount || 0).toFixed(2),
      partyType: line.partyType,
      partyId: line.partyId,
      costCenterId: line.costCenterId,
      description: line.description,
      gstDetails: line.gstDetails,
      sortOrder: index,
    }));

    await db.insert(journalEntryLines).values(lineValues);

    // Mark trial balance cache as stale
    await db.update(trialBalanceCache)
      .set({ isStale: true })
      .where(eq(trialBalanceCache.companyId, req.companyId!));

    // Fetch complete entry with lines
    const completeEntry = await db.query.journalEntries.findFirst({
      where: eq(journalEntries.id, entry.id),
      with: {
        lines: {
          with: {
            account: true,
            party: true,
          },
        },
      },
    });

    res.status(201).json(completeEntry);
  } catch (error) {
    console.error('Create entry error:', error);
    res.status(500).json({ error: 'Failed to create entry' });
  }
});

// Update journal entry
router.patch('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { narration, attachments, lines, status } = req.body;

    const entry = await db.query.journalEntries.findFirst({
      where: and(
        eq(journalEntries.id, id),
        eq(journalEntries.companyId, req.companyId!)
      ),
      with: {
        fiscalYear: true,
      },
    });

    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    if (entry.status === 'posted') {
      return res.status(400).json({ error: 'Cannot edit posted entry. Create reversal instead.' });
    }

    if (entry.fiscalYear?.isLocked) {
      return res.status(400).json({ error: 'Fiscal year is locked' });
    }

    // If updating lines
    if (lines) {
      // Validate lines
      if (lines.length < 2) {
        return res.status(400).json({ error: 'At least 2 lines required' });
      }

      let totalDebit = 0;
      let totalCredit = 0;
      for (const line of lines) {
        totalDebit += parseFloat(line.debitAmount || 0);
        totalCredit += parseFloat(line.creditAmount || 0);
      }

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        return res.status(400).json({ error: 'Entry must balance' });
      }

      // Delete existing lines
      await db.delete(journalEntryLines)
        .where(eq(journalEntryLines.journalEntryId, id));

      // Create new lines
      const lineValues = lines.map((line: any, index: number) => ({
        journalEntryId: id,
        accountId: line.accountId,
        debitAmount: parseFloat(line.debitAmount || 0).toFixed(2),
        creditAmount: parseFloat(line.creditAmount || 0).toFixed(2),
        partyType: line.partyType,
        partyId: line.partyId,
        costCenterId: line.costCenterId,
        description: line.description,
        gstDetails: line.gstDetails,
        sortOrder: index,
      }));

      await db.insert(journalEntryLines).values(lineValues);

      // Update totals
      await db.update(journalEntries)
        .set({
          narration,
          attachments,
          status,
          totalDebit: totalDebit.toFixed(2),
          totalCredit: totalCredit.toFixed(2),
          postingDate: status === 'posted' ? entry.entryDate : null,
          updatedAt: new Date(),
        })
        .where(eq(journalEntries.id, id));
    } else {
      await db.update(journalEntries)
        .set({
          narration,
          attachments,
          status,
          postingDate: status === 'posted' ? entry.entryDate : null,
          updatedAt: new Date(),
        })
        .where(eq(journalEntries.id, id));
    }

    // Mark trial balance cache as stale
    await db.update(trialBalanceCache)
      .set({ isStale: true })
      .where(eq(trialBalanceCache.companyId, req.companyId!));

    const updated = await db.query.journalEntries.findFirst({
      where: eq(journalEntries.id, id),
      with: {
        lines: {
          with: { account: true, party: true },
        },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Update entry error:', error);
    res.status(500).json({ error: 'Failed to update entry' });
  }
});

// Post entry
router.post('/:id/post', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const entry = await db.query.journalEntries.findFirst({
      where: and(
        eq(journalEntries.id, id),
        eq(journalEntries.companyId, req.companyId!)
      ),
    });

    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    if (entry.status === 'posted') {
      return res.status(400).json({ error: 'Entry already posted' });
    }

    const [updated] = await db.update(journalEntries)
      .set({
        status: 'posted',
        postingDate: entry.entryDate,
        updatedAt: new Date(),
      })
      .where(eq(journalEntries.id, id))
      .returning();

    // Mark trial balance cache as stale
    await db.update(trialBalanceCache)
      .set({ isStale: true })
      .where(eq(trialBalanceCache.companyId, req.companyId!));

    res.json(updated);
  } catch (error) {
    console.error('Post entry error:', error);
    res.status(500).json({ error: 'Failed to post entry' });
  }
});

// Reverse entry
router.post('/:id/reverse', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { reversalDate, narration } = req.body;

    const originalEntry = await db.query.journalEntries.findFirst({
      where: and(
        eq(journalEntries.id, id),
        eq(journalEntries.companyId, req.companyId!)
      ),
      with: {
        lines: true,
        fiscalYear: true,
      },
    });

    if (!originalEntry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    if (originalEntry.status !== 'posted') {
      return res.status(400).json({ error: 'Only posted entries can be reversed' });
    }

    if (originalEntry.isReversed) {
      return res.status(400).json({ error: 'Entry already reversed' });
    }

    // Generate new entry number
    const entryNumber = await generateEntryNumber(req.companyId!, originalEntry.fiscalYearId);

    // Create reversal entry (swap debits and credits)
    const [reversalEntry] = await db.insert(journalEntries).values({
      companyId: req.companyId!,
      fiscalYearId: originalEntry.fiscalYearId,
      entryNumber,
      entryDate: reversalDate || originalEntry.entryDate,
      postingDate: reversalDate || originalEntry.entryDate,
      entryType: 'reversal',
      narration: narration || `Reversal of ${originalEntry.entryNumber}`,
      totalDebit: originalEntry.totalCredit, // Swapped
      totalCredit: originalEntry.totalDebit, // Swapped
      status: 'posted',
      reversedEntryId: originalEntry.id,
      createdByUserId: req.userId!,
    }).returning();

    // Create reversal lines (swap debits and credits)
    const reversalLines = originalEntry.lines.map((line, index) => ({
      journalEntryId: reversalEntry.id,
      accountId: line.accountId,
      debitAmount: line.creditAmount, // Swapped
      creditAmount: line.debitAmount, // Swapped
      partyType: line.partyType,
      partyId: line.partyId,
      costCenterId: line.costCenterId,
      description: `Reversal: ${line.description || ''}`,
      gstDetails: line.gstDetails,
      sortOrder: index,
    }));

    await db.insert(journalEntryLines).values(reversalLines);

    // Mark original as reversed
    await db.update(journalEntries)
      .set({ isReversed: true, reversedEntryId: reversalEntry.id, updatedAt: new Date() })
      .where(eq(journalEntries.id, id));

    // Mark trial balance cache as stale
    await db.update(trialBalanceCache)
      .set({ isStale: true })
      .where(eq(trialBalanceCache.companyId, req.companyId!));

    const completeReversal = await db.query.journalEntries.findFirst({
      where: eq(journalEntries.id, reversalEntry.id),
      with: {
        lines: {
          with: { account: true },
        },
      },
    });

    res.status(201).json(completeReversal);
  } catch (error) {
    console.error('Reverse entry error:', error);
    res.status(500).json({ error: 'Failed to reverse entry' });
  }
});

// Delete draft entry
router.delete('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const entry = await db.query.journalEntries.findFirst({
      where: and(
        eq(journalEntries.id, id),
        eq(journalEntries.companyId, req.companyId!)
      ),
    });

    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    if (entry.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft entries can be deleted' });
    }

    // Delete lines first (cascade should handle this, but being explicit)
    await db.delete(journalEntryLines)
      .where(eq(journalEntryLines.journalEntryId, id));

    await db.delete(journalEntries)
      .where(eq(journalEntries.id, id));

    res.json({ message: 'Entry deleted' });
  } catch (error) {
    console.error('Delete entry error:', error);
    res.status(500).json({ error: 'Failed to delete entry' });
  }
});

export default router;
