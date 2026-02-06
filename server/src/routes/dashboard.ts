import { Router } from 'express';
import { db } from '../db';
import {
  journalEntries, journalEntryLines, chartOfAccounts, fiscalYears,
  gstr3bSummary, tdsDeductions, tdsChallans, parties
} from '@shared/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

const router = Router();

// Get dashboard data
router.get('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    // Get current fiscal year
    const fy = await db.query.fiscalYears.findFirst({
      where: and(
        eq(fiscalYears.companyId, req.companyId!),
        eq(fiscalYears.isCurrent, true)
      ),
    });

    if (!fy) {
      return res.status(400).json({ error: 'No current fiscal year' });
    }

    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

    // Financial KPIs
    const financialSummary = await db
      .select({
        accountType: chartOfAccounts.accountType,
        debit: sql<string>`COALESCE(SUM(${journalEntryLines.debitAmount}), 0)`,
        credit: sql<string>`COALESCE(SUM(${journalEntryLines.creditAmount}), 0)`,
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, and(
        eq(journalEntryLines.journalEntryId, journalEntries.id),
        eq(journalEntries.status, 'posted'),
        eq(journalEntries.fiscalYearId, fy.id)
      ))
      .innerJoin(chartOfAccounts, eq(journalEntryLines.accountId, chartOfAccounts.id))
      .where(eq(chartOfAccounts.isGroup, false))
      .groupBy(chartOfAccounts.accountType);

    let totalIncome = 0;
    let totalExpenses = 0;
    let totalAssets = 0;
    let totalLiabilities = 0;

    financialSummary.forEach(item => {
      const net = parseFloat(item.credit) - parseFloat(item.debit);
      if (item.accountType === 'income') totalIncome = net;
      else if (item.accountType === 'expense') totalExpenses = parseFloat(item.debit) - parseFloat(item.credit);
      else if (item.accountType === 'asset') totalAssets = parseFloat(item.debit) - parseFloat(item.credit);
      else if (item.accountType === 'liability') totalLiabilities = net;
    });

    const netProfit = totalIncome - totalExpenses;

    // Monthly revenue trend (last 6 months)
    const monthlyRevenue = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(today, i);
      const monthStart = format(startOfMonth(monthDate), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(monthDate), 'yyyy-MM-dd');

      const result = await db
        .select({
          credit: sql<string>`COALESCE(SUM(${journalEntryLines.creditAmount}), 0)`,
        })
        .from(journalEntryLines)
        .innerJoin(journalEntries, and(
          eq(journalEntryLines.journalEntryId, journalEntries.id),
          eq(journalEntries.status, 'posted'),
          gte(journalEntries.entryDate, monthStart),
          lte(journalEntries.entryDate, monthEnd)
        ))
        .innerJoin(chartOfAccounts, and(
          eq(journalEntryLines.accountId, chartOfAccounts.id),
          eq(chartOfAccounts.accountType, 'income')
        ));

      monthlyRevenue.push({
        month: format(monthDate, 'MMM yyyy'),
        revenue: parseFloat(result[0]?.credit || '0'),
      });
    }

    // Expense breakdown by category
    const expenseBreakdown = await db
      .select({
        accountName: chartOfAccounts.name,
        accountCode: chartOfAccounts.code,
        amount: sql<string>`COALESCE(SUM(${journalEntryLines.debitAmount}), 0)`,
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, and(
        eq(journalEntryLines.journalEntryId, journalEntries.id),
        eq(journalEntries.status, 'posted'),
        eq(journalEntries.fiscalYearId, fy.id)
      ))
      .innerJoin(chartOfAccounts, and(
        eq(journalEntryLines.accountId, chartOfAccounts.id),
        eq(chartOfAccounts.accountType, 'expense'),
        eq(chartOfAccounts.level, 3) // Get level 3 expenses for grouping
      ))
      .groupBy(chartOfAccounts.id, chartOfAccounts.name, chartOfAccounts.code)
      .orderBy(sql`SUM(${journalEntryLines.debitAmount}) DESC`)
      .limit(10);

    // Receivables aging
    const receivables = await db.query.parties.findMany({
      where: and(
        eq(parties.companyId, req.companyId!),
        eq(parties.partyType, 'customer'),
        eq(parties.isActive, true)
      ),
    });

    let totalReceivables = 0;
    receivables.forEach(p => {
      if (p.currentBalance) {
        totalReceivables += parseFloat(p.currentBalance);
      }
    });

    // Payables
    const payables = await db.query.parties.findMany({
      where: and(
        eq(parties.companyId, req.companyId!),
        eq(parties.partyType, 'vendor'),
        eq(parties.isActive, true)
      ),
    });

    let totalPayables = 0;
    payables.forEach(p => {
      if (p.currentBalance) {
        totalPayables += Math.abs(parseFloat(p.currentBalance));
      }
    });

    // Cash position (from bank accounts)
    const cashAccounts = await db
      .select({
        balance: sql<string>`COALESCE(SUM(${journalEntryLines.debitAmount} - ${journalEntryLines.creditAmount}), 0)`,
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, and(
        eq(journalEntryLines.journalEntryId, journalEntries.id),
        eq(journalEntries.status, 'posted')
      ))
      .innerJoin(chartOfAccounts, and(
        eq(journalEntryLines.accountId, chartOfAccounts.id),
        eq(chartOfAccounts.companyId, req.companyId!),
        sql`${chartOfAccounts.code} LIKE '124%'` // Cash and bank accounts
      ));

    const cashPosition = parseFloat(cashAccounts[0]?.balance || '0');

    // GST compliance status
    const currentPeriod = format(today, 'MMyyyy');
    const gstSummary = await db.query.gstr3bSummary.findFirst({
      where: and(
        eq(gstr3bSummary.companyId, req.companyId!),
        eq(gstr3bSummary.returnPeriod, currentPeriod)
      ),
    });

    // TDS compliance
    const currentQuarter = `Q${Math.ceil((today.getMonth() + 1) / 3)}`;
    const currentAY = today.getMonth() >= 3
      ? `${today.getFullYear()}-${(today.getFullYear() + 1) % 100}`
      : `${today.getFullYear() - 1}-${today.getFullYear() % 100}`;

    const pendingTdsChallans = await db.query.tdsChallans.findMany({
      where: and(
        eq(tdsChallans.companyId, req.companyId!),
        eq(tdsChallans.status, 'pending')
      ),
    });

    const pendingTdsAmount = pendingTdsChallans.reduce(
      (sum, c) => sum + parseFloat(c.totalAmount || '0'), 0
    );

    // Recent transactions
    const recentEntries = await db.query.journalEntries.findMany({
      where: and(
        eq(journalEntries.companyId, req.companyId!),
        eq(journalEntries.status, 'posted')
      ),
      with: {
        createdBy: true,
      },
      orderBy: desc(journalEntries.entryDate),
      limit: 5,
    });

    // Upcoming due dates
    const upcomingDueDates = [
      { type: 'GST', name: 'GSTR-1', dueDate: getNextGSTR1DueDate() },
      { type: 'GST', name: 'GSTR-3B', dueDate: getNextGSTR3BDueDate() },
      { type: 'TDS', name: 'TDS Payment', dueDate: getNextTDSPaymentDate() },
      { type: 'TDS', name: `TDS Return (${currentQuarter})`, dueDate: getNextTDSReturnDate() },
    ];

    res.json({
      fiscalYear: fy,
      financialKPIs: {
        totalIncome,
        totalExpenses,
        netProfit,
        profitMargin: totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0,
        totalAssets,
        totalLiabilities,
      },
      workingCapital: {
        receivables: totalReceivables,
        payables: totalPayables,
        cash: cashPosition,
        netWorkingCapital: totalReceivables + cashPosition - totalPayables,
      },
      monthlyRevenue,
      expenseBreakdown: expenseBreakdown.map(e => ({
        name: e.accountName,
        code: e.accountCode,
        amount: parseFloat(e.amount),
      })),
      taxCompliance: {
        gstStatus: gstSummary?.filingStatus || 'pending',
        pendingGstReturns: gstSummary?.filingStatus === 'pending' ? 1 : 0,
        pendingTdsPayment: pendingTdsAmount,
        pendingTdsChallans: pendingTdsChallans.length,
      },
      recentTransactions: recentEntries.map(e => ({
        id: e.id,
        entryNumber: e.entryNumber,
        entryDate: e.entryDate,
        narration: e.narration,
        amount: parseFloat(e.totalDebit),
        createdBy: e.createdBy?.firstName,
      })),
      upcomingDueDates,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// Helper functions for due dates
function getNextGSTR1DueDate(): string {
  const today = new Date();
  const dueDate = new Date(today.getFullYear(), today.getMonth() + 1, 11);
  if (today.getDate() > 11) {
    dueDate.setMonth(dueDate.getMonth() + 1);
  }
  return format(dueDate, 'yyyy-MM-dd');
}

function getNextGSTR3BDueDate(): string {
  const today = new Date();
  const dueDate = new Date(today.getFullYear(), today.getMonth() + 1, 20);
  if (today.getDate() > 20) {
    dueDate.setMonth(dueDate.getMonth() + 1);
  }
  return format(dueDate, 'yyyy-MM-dd');
}

function getNextTDSPaymentDate(): string {
  const today = new Date();
  const dueDate = new Date(today.getFullYear(), today.getMonth() + 1, 7);
  if (today.getDate() > 7) {
    dueDate.setMonth(dueDate.getMonth() + 1);
  }
  return format(dueDate, 'yyyy-MM-dd');
}

function getNextTDSReturnDate(): string {
  const today = new Date();
  const quarter = Math.ceil((today.getMonth() + 1) / 3);
  const quarterEndMonth = quarter * 3;
  // TDS returns are due on 31st of the month following the quarter
  const dueDate = new Date(today.getFullYear(), quarterEndMonth, 31);
  if (today > dueDate) {
    dueDate.setMonth(dueDate.getMonth() + 3);
  }
  return format(dueDate, 'yyyy-MM-dd');
}

export default router;
