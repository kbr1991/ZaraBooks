import { Router } from 'express';
import { db } from '../db';
import { chartOfAccounts, coaTemplates, journalEntryLines, journalEntries } from '@shared/schema';
import { eq, and, asc, isNull, sql, desc } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all accounts for current company
router.get('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const accounts = await db.query.chartOfAccounts.findMany({
      where: eq(chartOfAccounts.companyId, req.companyId!),
      orderBy: [asc(chartOfAccounts.code)],
    });

    // Build hierarchical structure
    const accountMap = new Map<string, any>();
    const rootAccounts: any[] = [];

    accounts.forEach(account => {
      accountMap.set(account.id, { ...account, children: [] });
    });

    accounts.forEach(account => {
      const node = accountMap.get(account.id);
      if (account.parentAccountId) {
        const parent = accountMap.get(account.parentAccountId);
        if (parent) {
          parent.children.push(node);
        }
      } else {
        rootAccounts.push(node);
      }
    });

    res.json({
      accounts,
      hierarchy: rootAccounts,
    });
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ error: 'Failed to get accounts' });
  }
});

// Get account by ID
router.get('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const account = await db.query.chartOfAccounts.findFirst({
      where: and(
        eq(chartOfAccounts.id, id),
        eq(chartOfAccounts.companyId, req.companyId!)
      ),
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Get children
    const children = await db.query.chartOfAccounts.findMany({
      where: and(
        eq(chartOfAccounts.parentAccountId, id),
        eq(chartOfAccounts.companyId, req.companyId!)
      ),
      orderBy: asc(chartOfAccounts.code),
    });

    res.json({ ...account, children });
  } catch (error) {
    console.error('Get account error:', error);
    res.status(500).json({ error: 'Failed to get account' });
  }
});

// Create account
router.post('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      code,
      name,
      description,
      accountType,
      parentAccountId,
      isGroup,
      scheduleIIIMapping,
      openingBalance,
      openingBalanceType,
      gstApplicable,
      defaultGstRate,
      hsnSacCode,
      customFields,
    } = req.body;

    // Validate code uniqueness within company
    const existing = await db.query.chartOfAccounts.findFirst({
      where: and(
        eq(chartOfAccounts.companyId, req.companyId!),
        eq(chartOfAccounts.code, code)
      ),
    });

    if (existing) {
      return res.status(400).json({ error: 'Account code already exists' });
    }

    // Calculate level based on parent
    let level = 1;
    if (parentAccountId) {
      const parent = await db.query.chartOfAccounts.findFirst({
        where: eq(chartOfAccounts.id, parentAccountId),
      });
      if (parent) {
        level = parent.level + 1;
      }
    }

    const [account] = await db.insert(chartOfAccounts).values({
      companyId: req.companyId!,
      code,
      name,
      description,
      accountType,
      parentAccountId,
      level,
      isGroup: isGroup || false,
      scheduleIIIMapping,
      openingBalance,
      openingBalanceType,
      gstApplicable,
      defaultGstRate,
      hsnSacCode,
      customFields,
      isActive: true,
      isSystem: false,
    }).returning();

    res.status(201).json(account);
  } catch (error) {
    console.error('Create account error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// Update account
router.patch('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // Check if account exists and belongs to company
    const account = await db.query.chartOfAccounts.findFirst({
      where: and(
        eq(chartOfAccounts.id, id),
        eq(chartOfAccounts.companyId, req.companyId!)
      ),
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Prevent editing system accounts' critical fields
    if (account.isSystem && (req.body.code || req.body.accountType || req.body.scheduleIIIMapping)) {
      return res.status(400).json({ error: 'Cannot modify system account structure' });
    }

    // Check code uniqueness if changing
    if (req.body.code && req.body.code !== account.code) {
      const existing = await db.query.chartOfAccounts.findFirst({
        where: and(
          eq(chartOfAccounts.companyId, req.companyId!),
          eq(chartOfAccounts.code, req.body.code)
        ),
      });
      if (existing) {
        return res.status(400).json({ error: 'Account code already exists' });
      }
    }

    // Calculate new level if parent changed
    let level = account.level;
    if (req.body.parentAccountId !== undefined && req.body.parentAccountId !== account.parentAccountId) {
      if (req.body.parentAccountId) {
        const parent = await db.query.chartOfAccounts.findFirst({
          where: eq(chartOfAccounts.id, req.body.parentAccountId),
        });
        if (parent) {
          level = parent.level + 1;
        }
      } else {
        level = 1;
      }
    }

    const [updated] = await db.update(chartOfAccounts)
      .set({
        ...req.body,
        level,
        updatedAt: new Date(),
      })
      .where(eq(chartOfAccounts.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Update account error:', error);
    res.status(500).json({ error: 'Failed to update account' });
  }
});

// Delete account
router.delete('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const account = await db.query.chartOfAccounts.findFirst({
      where: and(
        eq(chartOfAccounts.id, id),
        eq(chartOfAccounts.companyId, req.companyId!)
      ),
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (account.isSystem) {
      return res.status(400).json({ error: 'Cannot delete system account' });
    }

    // Check for children
    const children = await db.query.chartOfAccounts.findFirst({
      where: eq(chartOfAccounts.parentAccountId, id),
    });

    if (children) {
      return res.status(400).json({ error: 'Cannot delete account with child accounts' });
    }

    // TODO: Check for journal entries using this account

    await db.delete(chartOfAccounts).where(eq(chartOfAccounts.id, id));
    res.json({ message: 'Account deleted' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// Get available templates
router.get('/templates/list', async (_req, res) => {
  try {
    const templates = await db.query.coaTemplates.findMany({
      where: eq(coaTemplates.isActive, true),
    });

    res.json(templates.map(t => ({
      id: t.id,
      name: t.name,
      gaapStandard: t.gaapStandard,
      description: t.description,
    })));
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to get templates' });
  }
});

// Get leaf accounts (non-group accounts for transactions) with balances
router.get('/ledgers/list', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { type } = req.query;

    let whereConditions = [
      eq(chartOfAccounts.companyId, req.companyId!),
      eq(chartOfAccounts.isGroup, false),
      eq(chartOfAccounts.isActive, true),
    ];

    if (type) {
      whereConditions.push(eq(chartOfAccounts.accountType, type as any));
    }

    const accounts = await db.query.chartOfAccounts.findMany({
      where: and(...whereConditions),
      with: {
        parentAccount: true,
      },
      orderBy: [asc(chartOfAccounts.code)],
    });

    // Get transaction balances for each account
    const balances = await db
      .select({
        accountId: journalEntryLines.accountId,
        debit: sql<string>`COALESCE(SUM(${journalEntryLines.debitAmount}), 0)`,
        credit: sql<string>`COALESCE(SUM(${journalEntryLines.creditAmount}), 0)`,
        transactionCount: sql<number>`COUNT(DISTINCT ${journalEntryLines.journalEntryId})`,
        lastTxnDate: sql<string>`MAX(${journalEntries.entryDate})`,
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, and(
        eq(journalEntryLines.journalEntryId, journalEntries.id),
        eq(journalEntries.status, 'posted'),
        eq(journalEntries.companyId, req.companyId!)
      ))
      .groupBy(journalEntryLines.accountId);

    const balanceMap = new Map(balances.map(b => [b.accountId, b]));

    const ledgersWithBalances = accounts.map(account => {
      const openingBalance = parseFloat(account.openingBalance || '0');
      const openingType = account.openingBalanceType || 'debit';

      const txnBalance = balanceMap.get(account.id);
      const txnDebit = parseFloat(txnBalance?.debit || '0');
      const txnCredit = parseFloat(txnBalance?.credit || '0');

      // Calculate current balance
      let currentBalance = openingType === 'debit' ? openingBalance : -openingBalance;
      currentBalance += txnDebit - txnCredit;

      return {
        id: account.id,
        code: account.code,
        name: account.name,
        accountType: account.accountType,
        parentName: account.parentAccount?.name || null,
        openingBalance: Math.abs(openingBalance).toString(),
        openingBalanceType: openingType,
        currentBalance: Math.abs(currentBalance).toFixed(2),
        currentBalanceType: currentBalance >= 0 ? 'debit' : 'credit',
        transactionCount: txnBalance?.transactionCount || 0,
        lastTransactionDate: txnBalance?.lastTxnDate || null,
      };
    });

    res.json(ledgersWithBalances);
  } catch (error) {
    console.error('Get ledgers error:', error);
    res.status(500).json({ error: 'Failed to get ledgers' });
  }
});

// Get transactions for a specific account
router.get('/:id/transactions', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, fiscalYearId } = req.query;

    const account = await db.query.chartOfAccounts.findFirst({
      where: and(
        eq(chartOfAccounts.id, id),
        eq(chartOfAccounts.companyId, req.companyId!)
      ),
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    let whereConditions = [
      eq(journalEntryLines.accountId, id),
      eq(journalEntries.companyId, req.companyId!),
      eq(journalEntries.status, 'posted'),
    ];

    if (fiscalYearId) {
      whereConditions.push(eq(journalEntries.fiscalYearId, fiscalYearId as string));
    }
    if (startDate) {
      whereConditions.push(sql`${journalEntries.entryDate} >= ${startDate}`);
    }
    if (endDate) {
      whereConditions.push(sql`${journalEntries.entryDate} <= ${endDate}`);
    }

    const transactions = await db
      .select({
        id: journalEntryLines.id,
        entryId: journalEntries.id,
        entryNumber: journalEntries.entryNumber,
        date: journalEntries.entryDate,
        narration: journalEntries.narration,
        debit: journalEntryLines.debitAmount,
        credit: journalEntryLines.creditAmount,
        description: journalEntryLines.description,
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .where(and(...whereConditions))
      .orderBy(asc(journalEntries.entryDate), asc(journalEntries.createdAt));

    // Calculate running balance
    let runningBalance = account.openingBalance ? parseFloat(account.openingBalance) : 0;
    if (account.openingBalanceType === 'credit') {
      runningBalance = -runningBalance;
    }

    const transactionsWithBalance = transactions.map(txn => {
      const debit = parseFloat(txn.debit || '0');
      const credit = parseFloat(txn.credit || '0');
      runningBalance += debit - credit;

      return {
        id: txn.id,
        date: txn.date,
        entryNumber: txn.entryNumber,
        narration: txn.narration || txn.description,
        debit: txn.debit,
        credit: txn.credit,
        runningBalance: Math.abs(runningBalance).toFixed(2),
        balanceType: runningBalance >= 0 ? 'debit' : 'credit',
      };
    });

    res.json(transactionsWithBalance);
  } catch (error) {
    console.error('Get account transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

export default router;
