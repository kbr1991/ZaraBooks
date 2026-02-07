import { Router } from 'express';
import { db } from '../db';
import { bankAccounts, chartOfAccounts, journalEntryLines, journalEntries } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all bank accounts
router.get('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const allAccounts = await db.query.bankAccounts.findMany({
      where: eq(bankAccounts.companyId, req.companyId!),
      with: {
        account: true,
      },
      orderBy: [desc(bankAccounts.isPrimary), desc(bankAccounts.createdAt)],
    });

    // Transform for frontend compatibility
    const transformed = allAccounts.map(a => ({
      id: a.id,
      accountName: a.branchName ? `${a.bankName} - ${a.branchName}` : a.bankName,
      bankName: a.bankName,
      accountNumber: a.accountNumber,
      ifscCode: a.ifscCode,
      accountType: a.accountType || 'current',
      openingBalance: a.openingBalance || '0',
      currentBalance: a.currentBalance || '0',
      isActive: a.isActive,
      isPrimary: a.isPrimary,
      branchName: a.branchName,
      branchAddress: a.branchAddress,
      linkedAccountId: a.accountId,
      linkedAccountName: a.account?.name,
    }));

    res.json(transformed);
  } catch (error) {
    console.error('Get bank accounts error:', error);
    res.status(500).json({ error: 'Failed to get bank accounts' });
  }
});

// Get bank account by ID
router.get('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const account = await db.query.bankAccounts.findFirst({
      where: and(
        eq(bankAccounts.id, id),
        eq(bankAccounts.companyId, req.companyId!)
      ),
      with: {
        account: true,
      },
    });

    if (!account) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    res.json(account);
  } catch (error) {
    console.error('Get bank account error:', error);
    res.status(500).json({ error: 'Failed to get bank account' });
  }
});

// Get transactions for a bank account
router.get('/:id/transactions', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, limit = '50' } = req.query;

    const account = await db.query.bankAccounts.findFirst({
      where: and(
        eq(bankAccounts.id, id),
        eq(bankAccounts.companyId, req.companyId!)
      ),
    });

    if (!account) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    if (!account.accountId) {
      return res.json([]);
    }

    // Get journal entry lines for this account
    const transactions = await db
      .select({
        id: journalEntryLines.id,
        date: journalEntries.entryDate,
        description: journalEntryLines.description,
        reference: journalEntries.entryNumber,
        debit: journalEntryLines.debitAmount,
        credit: journalEntryLines.creditAmount,
        narration: journalEntries.narration,
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .where(
        and(
          eq(journalEntryLines.accountId, account.accountId),
          eq(journalEntries.companyId, req.companyId!),
          eq(journalEntries.status, 'posted')
        )
      )
      .orderBy(desc(journalEntries.entryDate), desc(journalEntries.createdAt))
      .limit(parseInt(limit as string));

    // Calculate running balance
    let runningBalance = parseFloat(account.openingBalance || '0');
    const result = transactions.reverse().map(t => {
      const debit = parseFloat(t.debit || '0');
      const credit = parseFloat(t.credit || '0');
      runningBalance = runningBalance + debit - credit;

      return {
        id: t.id,
        date: t.date,
        type: debit > 0 ? 'debit' : 'credit',
        description: t.description || t.narration || 'Transaction',
        reference: t.reference,
        amount: debit > 0 ? t.debit : t.credit,
        runningBalance: runningBalance.toFixed(2),
      };
    }).reverse();

    res.json(result);
  } catch (error) {
    console.error('Get bank transactions error:', error);
    res.status(500).json({ error: 'Failed to get bank transactions' });
  }
});

// Create bank account
router.post('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      accountName,
      bankName,
      accountNumber,
      ifscCode,
      accountType,
      openingBalance,
      branchName,
      branchAddress,
      isPrimary,
    } = req.body;

    if (!accountName && !bankName) {
      return res.status(400).json({ error: 'Account name or bank name is required' });
    }

    // Create linked chart of accounts entry for bank account
    let linkedAccountId: string | undefined;

    // Find existing bank account in CoA or create one
    const existingCoaAccount = await db.query.chartOfAccounts.findFirst({
      where: and(
        eq(chartOfAccounts.companyId, req.companyId!),
        eq(chartOfAccounts.name, bankName || accountName)
      ),
    });

    if (existingCoaAccount) {
      linkedAccountId = existingCoaAccount.id;
    } else {
      // Find the bank parent account
      const bankParent = await db.query.chartOfAccounts.findFirst({
        where: and(
          eq(chartOfAccounts.companyId, req.companyId!),
          eq(chartOfAccounts.code, '1200') // Cash and Bank Balances
        ),
      });

      if (bankParent) {
        // Generate next code
        const lastChild = await db.query.chartOfAccounts.findFirst({
          where: and(
            eq(chartOfAccounts.companyId, req.companyId!),
            eq(chartOfAccounts.parentAccountId, bankParent.id)
          ),
          orderBy: desc(chartOfAccounts.code),
        });

        let nextCode = '1201';
        if (lastChild && lastChild.code) {
          nextCode = (parseInt(lastChild.code) + 1).toString();
        }

        const [newCoaAccount] = await db.insert(chartOfAccounts).values({
          companyId: req.companyId!,
          code: nextCode,
          name: bankName || accountName,
          accountType: 'asset',
          parentAccountId: bankParent.id,
          level: 2,
          isGroup: false,
          openingBalance: openingBalance || '0',
          openingBalanceType: 'debit',
          isActive: true,
          isSystem: false,
        }).returning();

        linkedAccountId = newCoaAccount.id;
      }
    }

    const [account] = await db.insert(bankAccounts).values({
      companyId: req.companyId!,
      bankName: bankName || accountName,
      accountNumber: accountNumber || '',
      accountType: accountType || 'current',
      ifscCode,
      branchName,
      branchAddress,
      openingBalance: openingBalance || '0',
      currentBalance: openingBalance || '0',
      isPrimary: isPrimary || false,
      isActive: true,
      accountId: linkedAccountId,
    }).returning();

    res.status(201).json(account);
  } catch (error) {
    console.error('Create bank account error:', error);
    res.status(500).json({ error: 'Failed to create bank account' });
  }
});

// Update bank account
router.patch('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const account = await db.query.bankAccounts.findFirst({
      where: and(
        eq(bankAccounts.id, id),
        eq(bankAccounts.companyId, req.companyId!)
      ),
    });

    if (!account) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    const [updated] = await db.update(bankAccounts)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(bankAccounts.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Update bank account error:', error);
    res.status(500).json({ error: 'Failed to update bank account' });
  }
});

// Delete bank account
router.delete('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const account = await db.query.bankAccounts.findFirst({
      where: and(
        eq(bankAccounts.id, id),
        eq(bankAccounts.companyId, req.companyId!)
      ),
    });

    if (!account) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    await db.delete(bankAccounts).where(eq(bankAccounts.id, id));

    res.json({ message: 'Bank account deleted' });
  } catch (error) {
    console.error('Delete bank account error:', error);
    res.status(500).json({ error: 'Failed to delete bank account' });
  }
});

// Set as primary
router.post('/:id/set-primary', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // Remove primary from all other accounts
    await db.update(bankAccounts)
      .set({ isPrimary: false })
      .where(eq(bankAccounts.companyId, req.companyId!));

    // Set this one as primary
    const [updated] = await db.update(bankAccounts)
      .set({ isPrimary: true, updatedAt: new Date() })
      .where(and(
        eq(bankAccounts.id, id),
        eq(bankAccounts.companyId, req.companyId!)
      ))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Set primary error:', error);
    res.status(500).json({ error: 'Failed to set primary account' });
  }
});

export default router;
