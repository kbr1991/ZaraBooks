import { Router } from 'express';
import { db } from '../db';
import { bankReconciliations, bankReconciliationLines, bankAccounts, journalEntries, journalEntryLines } from '@shared/schema';
import { eq, and, desc, asc, gte, lte } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all reconciliations
router.get('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { bankAccountId, status } = req.query;

    let whereConditions = [eq(bankReconciliations.companyId, req.companyId!)];

    if (bankAccountId) {
      whereConditions.push(eq(bankReconciliations.bankAccountId, bankAccountId as string));
    }
    if (status && status !== 'all') {
      whereConditions.push(eq(bankReconciliations.status, status as any));
    }

    const allReconciliations = await db.query.bankReconciliations.findMany({
      where: and(...whereConditions),
      with: {
        bankAccount: true,
        reconciledBy: true,
      },
      orderBy: [desc(bankReconciliations.statementDate), desc(bankReconciliations.createdAt)],
    });

    // Transform for frontend
    const transformed = allReconciliations.map(r => ({
      id: r.id,
      bankAccountId: r.bankAccountId,
      bankAccountName: r.bankAccount?.bankName,
      statementDate: r.statementDate,
      openingBalance: r.openingBalance,
      closingBalance: r.closingBalance,
      status: r.status,
      reconciledBy: r.reconciledBy?.firstName,
      reconciledAt: r.reconciledAt,
    }));

    res.json(transformed);
  } catch (error) {
    console.error('Get reconciliations error:', error);
    res.status(500).json({ error: 'Failed to get reconciliations' });
  }
});

// Get reconciliation by ID
router.get('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const reconciliation = await db.query.bankReconciliations.findFirst({
      where: and(
        eq(bankReconciliations.id, id),
        eq(bankReconciliations.companyId, req.companyId!)
      ),
      with: {
        bankAccount: true,
        lines: {
          with: {
            journalEntry: true,
          },
          orderBy: asc(bankReconciliationLines.transactionDate),
        },
        reconciledBy: true,
      },
    });

    if (!reconciliation) {
      return res.status(404).json({ error: 'Reconciliation not found' });
    }

    res.json(reconciliation);
  } catch (error) {
    console.error('Get reconciliation error:', error);
    res.status(500).json({ error: 'Failed to get reconciliation' });
  }
});

// Get unreconciled transactions for a bank account
router.get('/bank-account/:bankAccountId/unreconciled', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { bankAccountId } = req.params;
    const { startDate, endDate } = req.query;

    const account = await db.query.bankAccounts.findFirst({
      where: and(
        eq(bankAccounts.id, bankAccountId),
        eq(bankAccounts.companyId, req.companyId!)
      ),
    });

    if (!account || !account.accountId) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    // Get journal entry lines for this account
    let whereConditions = [
      eq(journalEntryLines.accountId, account.accountId),
      eq(journalEntries.companyId, req.companyId!),
      eq(journalEntries.status, 'posted'),
    ];

    if (startDate) {
      whereConditions.push(gte(journalEntries.entryDate, startDate as string));
    }
    if (endDate) {
      whereConditions.push(lte(journalEntries.entryDate, endDate as string));
    }

    const transactions = await db
      .select({
        id: journalEntryLines.id,
        date: journalEntries.entryDate,
        description: journalEntryLines.description,
        reference: journalEntries.entryNumber,
        debit: journalEntryLines.debitAmount,
        credit: journalEntryLines.creditAmount,
        narration: journalEntries.narration,
        journalEntryId: journalEntries.id,
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .where(and(...whereConditions))
      .orderBy(desc(journalEntries.entryDate));

    // Filter out already reconciled transactions
    // TODO: Check against reconciliation lines

    const result = transactions.map(t => ({
      id: t.id,
      date: t.date,
      description: t.description || t.narration || 'Transaction',
      reference: t.reference,
      debit: t.debit,
      credit: t.credit,
      journalEntryId: t.journalEntryId,
      isReconciled: false,
    }));

    res.json(result);
  } catch (error) {
    console.error('Get unreconciled transactions error:', error);
    res.status(500).json({ error: 'Failed to get unreconciled transactions' });
  }
});

// Create reconciliation
router.post('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      bankAccountId,
      statementDate,
      openingBalance,
      closingBalance,
    } = req.body;

    if (!bankAccountId || !statementDate) {
      return res.status(400).json({ error: 'Bank account and statement date are required' });
    }

    const account = await db.query.bankAccounts.findFirst({
      where: and(
        eq(bankAccounts.id, bankAccountId),
        eq(bankAccounts.companyId, req.companyId!)
      ),
    });

    if (!account) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    // Check for existing in-progress reconciliation
    const existing = await db.query.bankReconciliations.findFirst({
      where: and(
        eq(bankReconciliations.bankAccountId, bankAccountId),
        eq(bankReconciliations.status, 'in_progress')
      ),
    });

    if (existing) {
      return res.status(400).json({
        error: 'There is already an in-progress reconciliation for this account',
        existingId: existing.id,
      });
    }

    const [reconciliation] = await db.insert(bankReconciliations).values({
      companyId: req.companyId!,
      bankAccountId,
      statementDate,
      openingBalance: openingBalance || account.currentBalance || '0',
      closingBalance: closingBalance || '0',
      status: 'in_progress',
    }).returning();

    res.status(201).json(reconciliation);
  } catch (error) {
    console.error('Create reconciliation error:', error);
    res.status(500).json({ error: 'Failed to create reconciliation' });
  }
});

// Add reconciliation line
router.post('/:id/lines', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const {
      transactionDate,
      description,
      reference,
      debit,
      credit,
      journalEntryId,
    } = req.body;

    const reconciliation = await db.query.bankReconciliations.findFirst({
      where: and(
        eq(bankReconciliations.id, id),
        eq(bankReconciliations.companyId, req.companyId!)
      ),
    });

    if (!reconciliation) {
      return res.status(404).json({ error: 'Reconciliation not found' });
    }

    if (reconciliation.status === 'completed') {
      return res.status(400).json({ error: 'Reconciliation is already completed' });
    }

    const [line] = await db.insert(bankReconciliationLines).values({
      reconciliationId: id,
      transactionDate,
      description,
      reference,
      debit: debit || '0',
      credit: credit || '0',
      journalEntryId,
      isReconciled: false,
    }).returning();

    res.status(201).json(line);
  } catch (error) {
    console.error('Add reconciliation line error:', error);
    res.status(500).json({ error: 'Failed to add reconciliation line' });
  }
});

// Mark line as reconciled
router.post('/:id/lines/:lineId/reconcile', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id, lineId } = req.params;

    const reconciliation = await db.query.bankReconciliations.findFirst({
      where: and(
        eq(bankReconciliations.id, id),
        eq(bankReconciliations.companyId, req.companyId!)
      ),
    });

    if (!reconciliation) {
      return res.status(404).json({ error: 'Reconciliation not found' });
    }

    if (reconciliation.status === 'completed') {
      return res.status(400).json({ error: 'Reconciliation is already completed' });
    }

    const [updated] = await db.update(bankReconciliationLines)
      .set({
        isReconciled: true,
        reconciledAt: new Date(),
      })
      .where(and(
        eq(bankReconciliationLines.id, lineId),
        eq(bankReconciliationLines.reconciliationId, id)
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Reconciliation line not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Reconcile line error:', error);
    res.status(500).json({ error: 'Failed to reconcile line' });
  }
});

// Unreconcile line
router.post('/:id/lines/:lineId/unreconcile', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id, lineId } = req.params;

    const reconciliation = await db.query.bankReconciliations.findFirst({
      where: and(
        eq(bankReconciliations.id, id),
        eq(bankReconciliations.companyId, req.companyId!)
      ),
    });

    if (!reconciliation) {
      return res.status(404).json({ error: 'Reconciliation not found' });
    }

    if (reconciliation.status === 'completed') {
      return res.status(400).json({ error: 'Reconciliation is already completed' });
    }

    const [updated] = await db.update(bankReconciliationLines)
      .set({
        isReconciled: false,
        reconciledAt: null,
      })
      .where(and(
        eq(bankReconciliationLines.id, lineId),
        eq(bankReconciliationLines.reconciliationId, id)
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Reconciliation line not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Unreconcile line error:', error);
    res.status(500).json({ error: 'Failed to unreconcile line' });
  }
});

// Complete reconciliation
router.post('/:id/complete', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const reconciliation = await db.query.bankReconciliations.findFirst({
      where: and(
        eq(bankReconciliations.id, id),
        eq(bankReconciliations.companyId, req.companyId!)
      ),
      with: {
        lines: true,
        bankAccount: true,
      },
    });

    if (!reconciliation) {
      return res.status(404).json({ error: 'Reconciliation not found' });
    }

    if (reconciliation.status === 'completed') {
      return res.status(400).json({ error: 'Reconciliation is already completed' });
    }

    // Calculate reconciled balance
    let reconciledBalance = parseFloat(reconciliation.openingBalance || '0');
    for (const line of reconciliation.lines) {
      if (line.isReconciled) {
        reconciledBalance += parseFloat(line.debit || '0') - parseFloat(line.credit || '0');
      }
    }

    const closingBalance = parseFloat(reconciliation.closingBalance || '0');
    const difference = Math.abs(reconciledBalance - closingBalance);

    if (difference > 0.01) {
      return res.status(400).json({
        error: 'Reconciliation does not balance',
        reconciledBalance: reconciledBalance.toFixed(2),
        closingBalance: closingBalance.toFixed(2),
        difference: difference.toFixed(2),
      });
    }

    // Update reconciliation
    const [updated] = await db.update(bankReconciliations)
      .set({
        status: 'completed',
        reconciledByUserId: req.userId,
        reconciledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(bankReconciliations.id, id))
      .returning();

    // Update bank account current balance
    await db.update(bankAccounts)
      .set({
        currentBalance: closingBalance.toString(),
        updatedAt: new Date(),
      })
      .where(eq(bankAccounts.id, reconciliation.bankAccountId));

    res.json(updated);
  } catch (error) {
    console.error('Complete reconciliation error:', error);
    res.status(500).json({ error: 'Failed to complete reconciliation' });
  }
});

// Update reconciliation
router.patch('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { openingBalance, closingBalance } = req.body;

    const reconciliation = await db.query.bankReconciliations.findFirst({
      where: and(
        eq(bankReconciliations.id, id),
        eq(bankReconciliations.companyId, req.companyId!)
      ),
    });

    if (!reconciliation) {
      return res.status(404).json({ error: 'Reconciliation not found' });
    }

    if (reconciliation.status === 'completed') {
      return res.status(400).json({ error: 'Completed reconciliations cannot be edited' });
    }

    const updateData: any = { updatedAt: new Date() };
    if (openingBalance !== undefined) updateData.openingBalance = openingBalance;
    if (closingBalance !== undefined) updateData.closingBalance = closingBalance;

    const [updated] = await db.update(bankReconciliations)
      .set(updateData)
      .where(eq(bankReconciliations.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Update reconciliation error:', error);
    res.status(500).json({ error: 'Failed to update reconciliation' });
  }
});

// Delete reconciliation (only in-progress)
router.delete('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const reconciliation = await db.query.bankReconciliations.findFirst({
      where: and(
        eq(bankReconciliations.id, id),
        eq(bankReconciliations.companyId, req.companyId!)
      ),
    });

    if (!reconciliation) {
      return res.status(404).json({ error: 'Reconciliation not found' });
    }

    if (reconciliation.status === 'completed') {
      return res.status(400).json({ error: 'Completed reconciliations cannot be deleted' });
    }

    await db.delete(bankReconciliationLines).where(eq(bankReconciliationLines.reconciliationId, id));
    await db.delete(bankReconciliations).where(eq(bankReconciliations.id, id));

    res.json({ message: 'Reconciliation deleted' });
  } catch (error) {
    console.error('Delete reconciliation error:', error);
    res.status(500).json({ error: 'Failed to delete reconciliation' });
  }
});

export default router;
