import { Router } from 'express';
import { db } from '../db';
import { journalEntries, journalEntryLines, chartOfAccounts, trialBalanceCache, fiscalYears } from '@shared/schema';
import { eq, and, gte, lte, sql, asc } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

interface TrialBalanceItem {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  parentAccountId: string | null;
  level: number;
  isGroup: boolean;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
}

// Calculate trial balance
router.get('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { fiscalYearId, asOfDate, fromDate, compareWithPreviousYear } = req.query;

    // Get fiscal year
    let fy;
    if (fiscalYearId) {
      fy = await db.query.fiscalYears.findFirst({
        where: and(
          eq(fiscalYears.id, fiscalYearId as string),
          eq(fiscalYears.companyId, req.companyId!)
        ),
      });
    } else {
      fy = await db.query.fiscalYears.findFirst({
        where: and(
          eq(fiscalYears.companyId, req.companyId!),
          eq(fiscalYears.isCurrent, true)
        ),
      });
    }

    if (!fy) {
      return res.status(400).json({ error: 'No fiscal year found' });
    }

    const endDate = asOfDate as string || fy.endDate;
    const startDate = fromDate as string || fy.startDate;

    // Get all accounts
    const accounts = await db.query.chartOfAccounts.findMany({
      where: and(
        eq(chartOfAccounts.companyId, req.companyId!),
        eq(chartOfAccounts.isActive, true)
      ),
      orderBy: asc(chartOfAccounts.code),
    });

    // Get opening balances (entries before startDate in the fiscal year)
    const openingBalancesQuery = db
      .select({
        accountId: journalEntryLines.accountId,
        debit: sql<string>`COALESCE(SUM(${journalEntryLines.debitAmount}), 0)`,
        credit: sql<string>`COALESCE(SUM(${journalEntryLines.creditAmount}), 0)`,
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .where(and(
        eq(journalEntries.companyId, req.companyId!),
        eq(journalEntries.fiscalYearId, fy.id),
        eq(journalEntries.status, 'posted'),
        sql`${journalEntries.entryDate} < ${startDate}`
      ))
      .groupBy(journalEntryLines.accountId);

    const openingBalances = await openingBalancesQuery;
    const openingMap = new Map(openingBalances.map(ob => [ob.accountId, ob]));

    // Get period transactions
    const periodTransactionsQuery = db
      .select({
        accountId: journalEntryLines.accountId,
        debit: sql<string>`COALESCE(SUM(${journalEntryLines.debitAmount}), 0)`,
        credit: sql<string>`COALESCE(SUM(${journalEntryLines.creditAmount}), 0)`,
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .where(and(
        eq(journalEntries.companyId, req.companyId!),
        eq(journalEntries.fiscalYearId, fy.id),
        eq(journalEntries.status, 'posted'),
        gte(journalEntries.entryDate, startDate),
        lte(journalEntries.entryDate, endDate)
      ))
      .groupBy(journalEntryLines.accountId);

    const periodTransactions = await periodTransactionsQuery;
    const periodMap = new Map(periodTransactions.map(pt => [pt.accountId, pt]));

    // Build trial balance items
    const trialBalanceItems: TrialBalanceItem[] = accounts.map(account => {
      const opening = openingMap.get(account.id) || { debit: '0', credit: '0' };
      const period = periodMap.get(account.id) || { debit: '0', credit: '0' };

      // Add account opening balance
      let openingDebit = parseFloat(opening.debit);
      let openingCredit = parseFloat(opening.credit);

      // Add configured opening balance for the account
      if (account.openingBalance) {
        const balance = parseFloat(account.openingBalance);
        if (account.openingBalanceType === 'debit') {
          openingDebit += balance;
        } else if (account.openingBalanceType === 'credit') {
          openingCredit += balance;
        }
      }

      const periodDebit = parseFloat(period.debit);
      const periodCredit = parseFloat(period.credit);

      // Calculate closing balance
      const netOpening = openingDebit - openingCredit;
      const netPeriod = periodDebit - periodCredit;
      const netClosing = netOpening + netPeriod;

      return {
        accountId: account.id,
        accountCode: account.code,
        accountName: account.name,
        accountType: account.accountType,
        parentAccountId: account.parentAccountId,
        level: account.level,
        isGroup: account.isGroup,
        openingDebit: netOpening > 0 ? netOpening : 0,
        openingCredit: netOpening < 0 ? Math.abs(netOpening) : 0,
        periodDebit,
        periodCredit,
        closingDebit: netClosing > 0 ? netClosing : 0,
        closingCredit: netClosing < 0 ? Math.abs(netClosing) : 0,
      };
    });

    // Filter out zero-balance accounts (optional)
    const nonZeroItems = trialBalanceItems.filter(item =>
      item.openingDebit !== 0 || item.openingCredit !== 0 ||
      item.periodDebit !== 0 || item.periodCredit !== 0
    );

    // Calculate totals
    const totals = {
      openingDebit: nonZeroItems.filter(i => !i.isGroup).reduce((sum, i) => sum + i.openingDebit, 0),
      openingCredit: nonZeroItems.filter(i => !i.isGroup).reduce((sum, i) => sum + i.openingCredit, 0),
      periodDebit: nonZeroItems.filter(i => !i.isGroup).reduce((sum, i) => sum + i.periodDebit, 0),
      periodCredit: nonZeroItems.filter(i => !i.isGroup).reduce((sum, i) => sum + i.periodCredit, 0),
      closingDebit: nonZeroItems.filter(i => !i.isGroup).reduce((sum, i) => sum + i.closingDebit, 0),
      closingCredit: nonZeroItems.filter(i => !i.isGroup).reduce((sum, i) => sum + i.closingCredit, 0),
    };

    res.json({
      fiscalYear: fy,
      asOfDate: endDate,
      fromDate: startDate,
      items: nonZeroItems,
      allItems: trialBalanceItems,
      totals,
      isBalanced: Math.abs(totals.closingDebit - totals.closingCredit) < 0.01,
    });
  } catch (error) {
    console.error('Trial balance error:', error);
    res.status(500).json({ error: 'Failed to calculate trial balance' });
  }
});

// Get account ledger (all transactions for an account)
router.get('/ledger/:accountId', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { accountId } = req.params;
    const { fiscalYearId, startDate, endDate } = req.query;

    // Verify account belongs to company
    const account = await db.query.chartOfAccounts.findFirst({
      where: and(
        eq(chartOfAccounts.id, accountId),
        eq(chartOfAccounts.companyId, req.companyId!)
      ),
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    let whereConditions = [
      eq(journalEntryLines.accountId, accountId),
      eq(journalEntries.companyId, req.companyId!),
      eq(journalEntries.status, 'posted'),
    ];

    if (fiscalYearId) {
      whereConditions.push(eq(journalEntries.fiscalYearId, fiscalYearId as string));
    }
    if (startDate) {
      whereConditions.push(gte(journalEntries.entryDate, startDate as string));
    }
    if (endDate) {
      whereConditions.push(lte(journalEntries.entryDate, endDate as string));
    }

    const entries = await db
      .select({
        lineId: journalEntryLines.id,
        entryId: journalEntries.id,
        entryNumber: journalEntries.entryNumber,
        entryDate: journalEntries.entryDate,
        entryType: journalEntries.entryType,
        narration: journalEntries.narration,
        lineDescription: journalEntryLines.description,
        debitAmount: journalEntryLines.debitAmount,
        creditAmount: journalEntryLines.creditAmount,
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .where(and(...whereConditions))
      .orderBy(asc(journalEntries.entryDate), asc(journalEntries.createdAt));

    // Calculate running balance
    let runningBalance = 0;
    if (account.openingBalance) {
      const balance = parseFloat(account.openingBalance);
      runningBalance = account.openingBalanceType === 'debit' ? balance : -balance;
    }

    const ledgerEntries = entries.map(entry => {
      const debit = parseFloat(entry.debitAmount || '0');
      const credit = parseFloat(entry.creditAmount || '0');
      runningBalance += debit - credit;

      return {
        ...entry,
        debit,
        credit,
        balance: runningBalance,
        balanceType: runningBalance >= 0 ? 'Dr' : 'Cr',
      };
    });

    res.json({
      account,
      openingBalance: account.openingBalance ? parseFloat(account.openingBalance) : 0,
      openingBalanceType: account.openingBalanceType,
      entries: ledgerEntries,
      closingBalance: runningBalance,
      closingBalanceType: runningBalance >= 0 ? 'Dr' : 'Cr',
    });
  } catch (error) {
    console.error('Ledger error:', error);
    res.status(500).json({ error: 'Failed to get ledger' });
  }
});

// Get summary by account type
router.get('/summary', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { fiscalYearId, asOfDate } = req.query;

    // Get fiscal year
    let fy;
    if (fiscalYearId) {
      fy = await db.query.fiscalYears.findFirst({
        where: and(
          eq(fiscalYears.id, fiscalYearId as string),
          eq(fiscalYears.companyId, req.companyId!)
        ),
      });
    } else {
      fy = await db.query.fiscalYears.findFirst({
        where: and(
          eq(fiscalYears.companyId, req.companyId!),
          eq(fiscalYears.isCurrent, true)
        ),
      });
    }

    if (!fy) {
      return res.status(400).json({ error: 'No fiscal year found' });
    }

    const endDate = asOfDate as string || fy.endDate;

    const summary = await db
      .select({
        accountType: chartOfAccounts.accountType,
        totalDebit: sql<string>`COALESCE(SUM(${journalEntryLines.debitAmount}), 0)`,
        totalCredit: sql<string>`COALESCE(SUM(${journalEntryLines.creditAmount}), 0)`,
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .innerJoin(chartOfAccounts, eq(journalEntryLines.accountId, chartOfAccounts.id))
      .where(and(
        eq(journalEntries.companyId, req.companyId!),
        eq(journalEntries.fiscalYearId, fy.id),
        eq(journalEntries.status, 'posted'),
        lte(journalEntries.entryDate, endDate)
      ))
      .groupBy(chartOfAccounts.accountType);

    const result = {
      asset: { debit: 0, credit: 0, balance: 0 },
      liability: { debit: 0, credit: 0, balance: 0 },
      equity: { debit: 0, credit: 0, balance: 0 },
      income: { debit: 0, credit: 0, balance: 0 },
      expense: { debit: 0, credit: 0, balance: 0 },
    };

    summary.forEach(item => {
      const type = item.accountType as keyof typeof result;
      result[type] = {
        debit: parseFloat(item.totalDebit),
        credit: parseFloat(item.totalCredit),
        balance: parseFloat(item.totalDebit) - parseFloat(item.totalCredit),
      };
    });

    // Calculate derived values
    const totalAssets = result.asset.balance;
    const totalLiabilities = -result.liability.balance; // Liabilities are typically credit balance
    const totalEquity = -result.equity.balance;
    const totalIncome = -result.income.balance; // Income is credit balance
    const totalExpenses = result.expense.balance;
    const netProfit = totalIncome - totalExpenses;

    res.json({
      fiscalYear: fy,
      asOfDate: endDate,
      byType: result,
      summary: {
        totalAssets,
        totalLiabilities,
        totalEquity,
        totalIncome,
        totalExpenses,
        netProfit,
        equityCheck: Math.abs(totalAssets - totalLiabilities - totalEquity - netProfit) < 0.01,
      },
    });
  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).json({ error: 'Failed to get summary' });
  }
});

export default router;
