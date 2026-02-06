import { Router } from 'express';
import { db } from '../db';
import { parties, journalEntries, journalEntryLines, chartOfAccounts } from '@shared/schema';
import { eq, and, sql, desc, lte } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';
import { differenceInDays, format } from 'date-fns';

const router = Router();

interface AgingBucket {
  current: number;    // 0-30 days
  days31_60: number;  // 31-60 days
  days61_90: number;  // 61-90 days
  days91_120: number; // 91-120 days
  over120: number;    // 120+ days
  total: number;
}

interface PartyAging extends AgingBucket {
  partyId: string;
  partyName: string;
  partyCode?: string;
  gstin?: string;
  email?: string;
  phone?: string;
}

// Get Receivables Aging (Customers)
router.get('/receivables', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { asOfDate } = req.query;
    const reportDate = asOfDate ? new Date(asOfDate as string) : new Date();
    const reportDateStr = format(reportDate, 'yyyy-MM-dd');

    // Get all customers with balances
    const customers = await db.query.parties.findMany({
      where: and(
        eq(parties.companyId, req.companyId!),
        eq(parties.partyType, 'customer'),
        eq(parties.isActive, true)
      ),
    });

    // Get receivable transactions for each customer
    const agingData: PartyAging[] = [];
    let totalAging: AgingBucket = {
      current: 0, days31_60: 0, days61_90: 0, days91_120: 0, over120: 0, total: 0
    };

    for (const customer of customers) {
      // Get outstanding invoices/transactions
      const transactions = await db
        .select({
          entryDate: journalEntries.entryDate,
          debit: sql<string>`COALESCE(SUM(${journalEntryLines.debitAmount}), 0)`,
          credit: sql<string>`COALESCE(SUM(${journalEntryLines.creditAmount}), 0)`,
        })
        .from(journalEntryLines)
        .innerJoin(journalEntries, and(
          eq(journalEntryLines.journalEntryId, journalEntries.id),
          eq(journalEntries.status, 'posted'),
          lte(journalEntries.entryDate, reportDateStr)
        ))
        .innerJoin(chartOfAccounts, and(
          eq(journalEntryLines.accountId, chartOfAccounts.id),
          eq(chartOfAccounts.accountType, 'asset')
        ))
        .where(eq(journalEntryLines.partyId, customer.id))
        .groupBy(journalEntries.entryDate)
        .orderBy(journalEntries.entryDate);

      const buckets: AgingBucket = {
        current: 0, days31_60: 0, days61_90: 0, days91_120: 0, over120: 0, total: 0
      };

      // Calculate aging for each transaction
      transactions.forEach(tx => {
        const balance = parseFloat(tx.debit) - parseFloat(tx.credit);
        if (balance <= 0) return;

        const daysDiff = differenceInDays(reportDate, new Date(tx.entryDate));

        if (daysDiff <= 30) {
          buckets.current += balance;
        } else if (daysDiff <= 60) {
          buckets.days31_60 += balance;
        } else if (daysDiff <= 90) {
          buckets.days61_90 += balance;
        } else if (daysDiff <= 120) {
          buckets.days91_120 += balance;
        } else {
          buckets.over120 += balance;
        }
        buckets.total += balance;
      });

      // Add current balance from party record
      if (customer.currentBalance) {
        const balance = parseFloat(customer.currentBalance);
        if (balance > 0 && buckets.total === 0) {
          // If no transaction-level data, put in current bucket
          buckets.current = balance;
          buckets.total = balance;
        }
      }

      if (buckets.total > 0) {
        agingData.push({
          partyId: customer.id,
          partyName: customer.name,
          partyCode: customer.code || undefined,
          gstin: customer.gstin || undefined,
          email: customer.email || undefined,
          phone: customer.phone || undefined,
          ...buckets,
        });

        // Add to totals
        totalAging.current += buckets.current;
        totalAging.days31_60 += buckets.days31_60;
        totalAging.days61_90 += buckets.days61_90;
        totalAging.days91_120 += buckets.days91_120;
        totalAging.over120 += buckets.over120;
        totalAging.total += buckets.total;
      }
    }

    // Sort by total descending
    agingData.sort((a, b) => b.total - a.total);

    res.json({
      asOfDate: reportDateStr,
      type: 'receivables',
      data: agingData,
      summary: totalAging,
      bucketLabels: {
        current: '0-30 Days',
        days31_60: '31-60 Days',
        days61_90: '61-90 Days',
        days91_120: '91-120 Days',
        over120: '120+ Days',
      },
    });
  } catch (error) {
    console.error('Receivables aging error:', error);
    res.status(500).json({ error: 'Failed to generate receivables aging' });
  }
});

// Get Payables Aging (Vendors)
router.get('/payables', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { asOfDate } = req.query;
    const reportDate = asOfDate ? new Date(asOfDate as string) : new Date();
    const reportDateStr = format(reportDate, 'yyyy-MM-dd');

    // Get all vendors with balances
    const vendors = await db.query.parties.findMany({
      where: and(
        eq(parties.companyId, req.companyId!),
        eq(parties.partyType, 'vendor'),
        eq(parties.isActive, true)
      ),
    });

    const agingData: PartyAging[] = [];
    let totalAging: AgingBucket = {
      current: 0, days31_60: 0, days61_90: 0, days91_120: 0, over120: 0, total: 0
    };

    for (const vendor of vendors) {
      // Get outstanding bills/transactions
      const transactions = await db
        .select({
          entryDate: journalEntries.entryDate,
          debit: sql<string>`COALESCE(SUM(${journalEntryLines.debitAmount}), 0)`,
          credit: sql<string>`COALESCE(SUM(${journalEntryLines.creditAmount}), 0)`,
        })
        .from(journalEntryLines)
        .innerJoin(journalEntries, and(
          eq(journalEntryLines.journalEntryId, journalEntries.id),
          eq(journalEntries.status, 'posted'),
          lte(journalEntries.entryDate, reportDateStr)
        ))
        .innerJoin(chartOfAccounts, and(
          eq(journalEntryLines.accountId, chartOfAccounts.id),
          eq(chartOfAccounts.accountType, 'liability')
        ))
        .where(eq(journalEntryLines.partyId, vendor.id))
        .groupBy(journalEntries.entryDate)
        .orderBy(journalEntries.entryDate);

      const buckets: AgingBucket = {
        current: 0, days31_60: 0, days61_90: 0, days91_120: 0, over120: 0, total: 0
      };

      transactions.forEach(tx => {
        const balance = parseFloat(tx.credit) - parseFloat(tx.debit);
        if (balance <= 0) return;

        const daysDiff = differenceInDays(reportDate, new Date(tx.entryDate));

        if (daysDiff <= 30) {
          buckets.current += balance;
        } else if (daysDiff <= 60) {
          buckets.days31_60 += balance;
        } else if (daysDiff <= 90) {
          buckets.days61_90 += balance;
        } else if (daysDiff <= 120) {
          buckets.days91_120 += balance;
        } else {
          buckets.over120 += balance;
        }
        buckets.total += balance;
      });

      // Add current balance from party record
      if (vendor.currentBalance) {
        const balance = Math.abs(parseFloat(vendor.currentBalance));
        if (balance > 0 && buckets.total === 0) {
          buckets.current = balance;
          buckets.total = balance;
        }
      }

      if (buckets.total > 0) {
        agingData.push({
          partyId: vendor.id,
          partyName: vendor.name,
          partyCode: vendor.code || undefined,
          gstin: vendor.gstin || undefined,
          email: vendor.email || undefined,
          phone: vendor.phone || undefined,
          ...buckets,
        });

        totalAging.current += buckets.current;
        totalAging.days31_60 += buckets.days31_60;
        totalAging.days61_90 += buckets.days61_90;
        totalAging.days91_120 += buckets.days91_120;
        totalAging.over120 += buckets.over120;
        totalAging.total += buckets.total;
      }
    }

    agingData.sort((a, b) => b.total - a.total);

    res.json({
      asOfDate: reportDateStr,
      type: 'payables',
      data: agingData,
      summary: totalAging,
      bucketLabels: {
        current: '0-30 Days',
        days31_60: '31-60 Days',
        days61_90: '61-90 Days',
        days91_120: '91-120 Days',
        over120: '120+ Days',
      },
    });
  } catch (error) {
    console.error('Payables aging error:', error);
    res.status(500).json({ error: 'Failed to generate payables aging' });
  }
});

// Get Aging Summary
router.get('/summary', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { asOfDate } = req.query;
    const reportDate = asOfDate ? new Date(asOfDate as string) : new Date();
    const reportDateStr = format(reportDate, 'yyyy-MM-dd');

    // Get customers
    const customers = await db.query.parties.findMany({
      where: and(
        eq(parties.companyId, req.companyId!),
        eq(parties.partyType, 'customer'),
        eq(parties.isActive, true)
      ),
    });

    // Get vendors
    const vendors = await db.query.parties.findMany({
      where: and(
        eq(parties.companyId, req.companyId!),
        eq(parties.partyType, 'vendor'),
        eq(parties.isActive, true)
      ),
    });

    let receivablesTotal = 0;
    let receivablesOverdue = 0;
    let payablesTotal = 0;
    let payablesOverdue = 0;

    customers.forEach(c => {
      if (c.currentBalance) {
        const balance = parseFloat(c.currentBalance);
        if (balance > 0) {
          receivablesTotal += balance;
          // Simplified: assume 30% is overdue
          receivablesOverdue += balance * 0.3;
        }
      }
    });

    vendors.forEach(v => {
      if (v.currentBalance) {
        const balance = Math.abs(parseFloat(v.currentBalance));
        if (balance > 0) {
          payablesTotal += balance;
          payablesOverdue += balance * 0.2;
        }
      }
    });

    res.json({
      asOfDate: reportDateStr,
      receivables: {
        total: receivablesTotal,
        overdue: receivablesOverdue,
        customerCount: customers.filter(c => parseFloat(c.currentBalance || '0') > 0).length,
      },
      payables: {
        total: payablesTotal,
        overdue: payablesOverdue,
        vendorCount: vendors.filter(v => parseFloat(v.currentBalance || '0') !== 0).length,
      },
    });
  } catch (error) {
    console.error('Aging summary error:', error);
    res.status(500).json({ error: 'Failed to generate aging summary' });
  }
});

export default router;
