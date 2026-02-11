/**
 * Analytics Routes
 *
 * Handles cash flow forecasting, trends, and insights
 */

import { Router } from 'express';
import { db } from '../db';
import { cashFlowForecasts, invoices, bills, expenses, journalEntries, journalEntryLines, bankAccounts, chartOfAccounts } from '@shared/schema';
import { eq, and, desc, gte, lte, sql, sum } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';
import {
  generateForecast,
  getLatestForecast
} from '../services/analytics/cashFlowForecast';

const router = Router();

// ==================== CASH FLOW FORECASTING ====================

// Get cash flow forecast
router.get('/cash-flow-forecast', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const forecastType = days <= 30 ? '30_day' : '90_day';

    // Check for existing recent forecast
    const existing = await getLatestForecast(req.companyId!, forecastType);

    if (existing) {
      return res.json(existing);
    }

    // Generate new forecast
    const forecast = await generateForecast(req.companyId!, forecastType);
    res.json(forecast);
  } catch (error) {
    console.error('Error fetching cash flow forecast:', error);
    res.status(500).json({ error: 'Failed to fetch forecast' });
  }
});

// Generate new forecast
router.post('/cash-flow-forecast/generate', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { forecastType } = req.body;
    const type = forecastType === '90_day' ? '90_day' : '30_day';

    const forecast = await generateForecast(req.companyId!, type);
    res.json(forecast);
  } catch (error) {
    console.error('Error generating forecast:', error);
    res.status(500).json({ error: 'Failed to generate forecast' });
  }
});

// Get forecast history
router.get('/cash-flow-forecast/history', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const forecasts = await db.select()
      .from(cashFlowForecasts)
      .where(eq(cashFlowForecasts.companyId, req.companyId!))
      .orderBy(desc(cashFlowForecasts.generatedAt))
      .limit(10);

    res.json(forecasts);
  } catch (error) {
    console.error('Error fetching forecast history:', error);
    res.status(500).json({ error: 'Failed to fetch forecast history' });
  }
});

// ==================== TRENDS ====================

// Get revenue trends
router.get('/trends/revenue', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const months = parseInt(req.query.months as string) || 12;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    // Get monthly revenue from invoices
    const revenueData = await db.select({
      month: sql<string>`TO_CHAR(${invoices.invoiceDate}, 'YYYY-MM')`,
      total: sum(invoices.totalAmount),
      count: sql<number>`COUNT(*)`
    })
      .from(invoices)
      .where(and(
        eq(invoices.companyId, req.companyId!),
        gte(invoices.invoiceDate, startDate.toISOString().split('T')[0])
      ))
      .groupBy(sql`TO_CHAR(${invoices.invoiceDate}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${invoices.invoiceDate}, 'YYYY-MM')`);

    res.json(revenueData);
  } catch (error) {
    console.error('Error fetching revenue trends:', error);
    res.status(500).json({ error: 'Failed to fetch revenue trends' });
  }
});

// Get expense trends
router.get('/trends/expenses', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const months = parseInt(req.query.months as string) || 12;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    // Get monthly expenses
    const expenseData = await db.select({
      month: sql<string>`TO_CHAR(${expenses.expenseDate}, 'YYYY-MM')`,
      total: sum(expenses.totalAmount),
      count: sql<number>`COUNT(*)`
    })
      .from(expenses)
      .where(and(
        eq(expenses.companyId, req.companyId!),
        gte(expenses.expenseDate, startDate.toISOString().split('T')[0])
      ))
      .groupBy(sql`TO_CHAR(${expenses.expenseDate}, 'YYYY-MM')`)
      .orderBy(sql`TO_CHAR(${expenses.expenseDate}, 'YYYY-MM')`);

    res.json(expenseData);
  } catch (error) {
    console.error('Error fetching expense trends:', error);
    res.status(500).json({ error: 'Failed to fetch expense trends' });
  }
});

// Get expense by category
router.get('/trends/expenses-by-category', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const months = parseInt(req.query.months as string) || 3;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const categoryData = await db.select({
      accountId: expenses.accountId,
      accountName: chartOfAccounts.name,
      total: sum(expenses.totalAmount),
      count: sql<number>`COUNT(*)`
    })
      .from(expenses)
      .leftJoin(chartOfAccounts, eq(expenses.accountId, chartOfAccounts.id))
      .where(and(
        eq(expenses.companyId, req.companyId!),
        gte(expenses.expenseDate, startDate.toISOString().split('T')[0])
      ))
      .groupBy(expenses.accountId, chartOfAccounts.name)
      .orderBy(desc(sum(expenses.totalAmount)));

    res.json(categoryData);
  } catch (error) {
    console.error('Error fetching expense categories:', error);
    res.status(500).json({ error: 'Failed to fetch expense categories' });
  }
});

// Get profit & loss trends
router.get('/trends/profit-loss', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const months = parseInt(req.query.months as string) || 12;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    // Get monthly revenue
    const revenue = await db.select({
      month: sql<string>`TO_CHAR(${invoices.invoiceDate}, 'YYYY-MM')`,
      revenue: sum(invoices.totalAmount)
    })
      .from(invoices)
      .where(and(
        eq(invoices.companyId, req.companyId!),
        gte(invoices.invoiceDate, startDate.toISOString().split('T')[0])
      ))
      .groupBy(sql`TO_CHAR(${invoices.invoiceDate}, 'YYYY-MM')`);

    // Get monthly expenses
    const expensesList = await db.select({
      month: sql<string>`TO_CHAR(${expenses.expenseDate}, 'YYYY-MM')`,
      expenses: sum(expenses.totalAmount)
    })
      .from(expenses)
      .where(and(
        eq(expenses.companyId, req.companyId!),
        gte(expenses.expenseDate, startDate.toISOString().split('T')[0])
      ))
      .groupBy(sql`TO_CHAR(${expenses.expenseDate}, 'YYYY-MM')`);

    // Merge into P&L
    const revenueMap = new Map(revenue.map(r => [r.month, parseFloat(r.revenue || '0')]));
    const expenseMap = new Map(expensesList.map(e => [e.month, parseFloat(e.expenses || '0')]));

    const allMonths = [...new Set([...revenueMap.keys(), ...expenseMap.keys()])].sort();

    const plTrend = allMonths.map(month => ({
      month,
      revenue: revenueMap.get(month) || 0,
      expenses: expenseMap.get(month) || 0,
      profit: (revenueMap.get(month) || 0) - (expenseMap.get(month) || 0)
    }));

    res.json(plTrend);
  } catch (error) {
    console.error('Error fetching P&L trends:', error);
    res.status(500).json({ error: 'Failed to fetch P&L trends' });
  }
});

// ==================== INSIGHTS ====================

// Get financial insights
router.get('/insights', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const insights: Array<{
      type: string;
      title: string;
      description: string;
      value?: string;
      change?: string;
      trend?: 'up' | 'down' | 'neutral';
    }> = [];

    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date(today);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // Revenue insight
    const [currentRevenue] = await db.select({
      total: sum(invoices.totalAmount)
    })
      .from(invoices)
      .where(and(
        eq(invoices.companyId, req.companyId!),
        gte(invoices.invoiceDate, thirtyDaysAgo.toISOString().split('T')[0])
      ));

    const [previousRevenue] = await db.select({
      total: sum(invoices.totalAmount)
    })
      .from(invoices)
      .where(and(
        eq(invoices.companyId, req.companyId!),
        gte(invoices.invoiceDate, sixtyDaysAgo.toISOString().split('T')[0]),
        lte(invoices.invoiceDate, thirtyDaysAgo.toISOString().split('T')[0])
      ));

    const currentRev = parseFloat(currentRevenue?.total || '0');
    const prevRev = parseFloat(previousRevenue?.total || '0');
    const revenueChange = prevRev > 0 ? ((currentRev - prevRev) / prevRev) * 100 : 0;

    insights.push({
      type: 'revenue',
      title: 'Revenue (Last 30 days)',
      description: 'Total invoiced amount',
      value: `₹${currentRev.toLocaleString('en-IN')}`,
      change: `${revenueChange >= 0 ? '+' : ''}${revenueChange.toFixed(1)}%`,
      trend: revenueChange > 0 ? 'up' : revenueChange < 0 ? 'down' : 'neutral'
    });

    // Outstanding receivables
    const [receivables] = await db.select({
      total: sum(invoices.balanceDue)
    })
      .from(invoices)
      .where(and(
        eq(invoices.companyId, req.companyId!),
        eq(invoices.status, 'sent')
      ));

    insights.push({
      type: 'receivables',
      title: 'Outstanding Receivables',
      description: 'Pending customer payments',
      value: `₹${parseFloat(receivables?.total || '0').toLocaleString('en-IN')}`,
      trend: 'neutral'
    });

    // Overdue invoices
    const [overdue] = await db.select({
      count: sql<number>`COUNT(*)`,
      total: sum(invoices.balanceDue)
    })
      .from(invoices)
      .where(and(
        eq(invoices.companyId, req.companyId!),
        eq(invoices.status, 'overdue')
      ));

    if (parseInt(overdue?.count?.toString() || '0') > 0) {
      insights.push({
        type: 'overdue',
        title: 'Overdue Invoices',
        description: `${overdue.count} invoices past due date`,
        value: `₹${parseFloat(overdue?.total || '0').toLocaleString('en-IN')}`,
        trend: 'down'
      });
    }

    // Outstanding payables
    const [payables] = await db.select({
      total: sum(bills.balanceDue)
    })
      .from(bills)
      .where(and(
        eq(bills.companyId, req.companyId!),
        eq(bills.status, 'pending')
      ));

    insights.push({
      type: 'payables',
      title: 'Outstanding Payables',
      description: 'Bills to be paid',
      value: `₹${parseFloat(payables?.total || '0').toLocaleString('en-IN')}`,
      trend: 'neutral'
    });

    // Bank balance
    const [bankBalance] = await db.select({
      total: sum(bankAccounts.currentBalance)
    })
      .from(bankAccounts)
      .where(and(
        eq(bankAccounts.companyId, req.companyId!),
        eq(bankAccounts.isActive, true)
      ));

    insights.push({
      type: 'cash',
      title: 'Bank Balance',
      description: 'Total across all accounts',
      value: `₹${parseFloat(bankBalance?.total || '0').toLocaleString('en-IN')}`,
      trend: 'neutral'
    });

    res.json(insights);
  } catch (error) {
    console.error('Error fetching insights:', error);
    res.status(500).json({ error: 'Failed to fetch insights' });
  }
});

// Get dashboard KPIs
router.get('/kpis', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    // Monthly revenue
    const [monthlyRevenue] = await db.select({
      total: sum(invoices.totalAmount)
    })
      .from(invoices)
      .where(and(
        eq(invoices.companyId, req.companyId!),
        gte(invoices.invoiceDate, startOfMonth.toISOString().split('T')[0])
      ));

    // YTD revenue
    const [ytdRevenue] = await db.select({
      total: sum(invoices.totalAmount)
    })
      .from(invoices)
      .where(and(
        eq(invoices.companyId, req.companyId!),
        gte(invoices.invoiceDate, startOfYear.toISOString().split('T')[0])
      ));

    // Monthly expenses
    const [monthlyExpenses] = await db.select({
      total: sum(expenses.totalAmount)
    })
      .from(expenses)
      .where(and(
        eq(expenses.companyId, req.companyId!),
        gte(expenses.expenseDate, startOfMonth.toISOString().split('T')[0])
      ));

    // YTD expenses
    const [ytdExpenses] = await db.select({
      total: sum(expenses.totalAmount)
    })
      .from(expenses)
      .where(and(
        eq(expenses.companyId, req.companyId!),
        gte(expenses.expenseDate, startOfYear.toISOString().split('T')[0])
      ));

    // Invoice counts
    const [invoiceCounts] = await db.select({
      total: sql<number>`COUNT(*)`,
      paid: sql<number>`COUNT(*) FILTER (WHERE ${invoices.status} = 'paid')`,
      pending: sql<number>`COUNT(*) FILTER (WHERE ${invoices.status} IN ('sent', 'pending'))`,
      overdue: sql<number>`COUNT(*) FILTER (WHERE ${invoices.status} = 'overdue')`
    })
      .from(invoices)
      .where(eq(invoices.companyId, req.companyId!));

    res.json({
      monthly: {
        revenue: parseFloat(monthlyRevenue?.total || '0'),
        expenses: parseFloat(monthlyExpenses?.total || '0'),
        profit: parseFloat(monthlyRevenue?.total || '0') - parseFloat(monthlyExpenses?.total || '0')
      },
      ytd: {
        revenue: parseFloat(ytdRevenue?.total || '0'),
        expenses: parseFloat(ytdExpenses?.total || '0'),
        profit: parseFloat(ytdRevenue?.total || '0') - parseFloat(ytdExpenses?.total || '0')
      },
      invoices: {
        total: invoiceCounts?.total || 0,
        paid: invoiceCounts?.paid || 0,
        pending: invoiceCounts?.pending || 0,
        overdue: invoiceCounts?.overdue || 0
      }
    });
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    res.status(500).json({ error: 'Failed to fetch KPIs' });
  }
});

export default router;
