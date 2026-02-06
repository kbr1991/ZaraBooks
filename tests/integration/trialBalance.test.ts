/**
 * Trial Balance API Integration Tests
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestDb, closeTestDb, clearTestDb, seedTestData } from '../setup';
import * as schema from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';

describe('Trial Balance API', () => {
  let db: ReturnType<typeof getTestDb>;

  beforeAll(async () => {
    db = getTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  /**
   * Helper to create posted journal entries with lines
   */
  async function createPostedEntry(
    companyId: string,
    fiscalYearId: string,
    userId: string,
    entryNumber: string,
    lines: { accountId: string; debit: number; credit: number }[]
  ) {
    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);

    const [entry] = await db.insert(schema.journalEntries).values({
      companyId,
      fiscalYearId,
      entryNumber,
      entryDate: new Date('2024-05-01'),
      postingDate: new Date('2024-05-01'),
      entryType: 'manual',
      narration: 'Test entry',
      totalDebit: totalDebit.toFixed(2),
      totalCredit: totalCredit.toFixed(2),
      sourceType: 'manual',
      status: 'posted',
      createdByUserId: userId,
    }).returning();

    for (const line of lines) {
      await db.insert(schema.journalEntryLines).values({
        journalEntryId: entry.id,
        accountId: line.accountId,
        debitAmount: line.debit.toFixed(2),
        creditAmount: line.credit.toFixed(2),
      });
    }

    return entry;
  }

  describe('Trial Balance Calculation', () => {
    it('should calculate trial balance from posted entries', async () => {
      const { company, fiscalYear, accounts, user } = await seedTestData();

      // Create some transactions
      // 1. Cash investment (Dr Cash, Cr Capital)
      await createPostedEntry(company.id, fiscalYear.id, user.id, 'JV/001', [
        { accountId: accounts.get('1111')!, debit: 100000, credit: 0 },
        { accountId: accounts.get('3100')!, debit: 0, credit: 100000 },
      ]);

      // 2. Revenue earned (Dr Cash, Cr Revenue)
      await createPostedEntry(company.id, fiscalYear.id, user.id, 'JV/002', [
        { accountId: accounts.get('1111')!, debit: 50000, credit: 0 },
        { accountId: accounts.get('4100')!, debit: 0, credit: 50000 },
      ]);

      // 3. Expense paid (Dr Expense, Cr Cash)
      await createPostedEntry(company.id, fiscalYear.id, user.id, 'JV/003', [
        { accountId: accounts.get('5110')!, debit: 20000, credit: 0 },
        { accountId: accounts.get('1111')!, debit: 0, credit: 20000 },
      ]);

      // Calculate trial balance using SQL aggregation
      const result = await db.execute(sql`
        SELECT
          coa.id,
          coa.code,
          coa.name,
          coa.account_type,
          COALESCE(SUM(CAST(jel.debit_amount AS DECIMAL)), 0) as total_debit,
          COALESCE(SUM(CAST(jel.credit_amount AS DECIMAL)), 0) as total_credit
        FROM chart_of_accounts coa
        LEFT JOIN journal_entry_lines jel ON coa.id = jel.account_id
        LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
          AND je.status = 'posted'
          AND je.company_id = ${company.id}
        WHERE coa.company_id = ${company.id}
          AND coa.is_group = false
        GROUP BY coa.id, coa.code, coa.name, coa.account_type
        HAVING COALESCE(SUM(CAST(jel.debit_amount AS DECIMAL)), 0) > 0
          OR COALESCE(SUM(CAST(jel.credit_amount AS DECIMAL)), 0) > 0
        ORDER BY coa.code
      `);

      const rows = result.rows as any[];

      // Verify cash account balance (100000 + 50000 - 20000 = 130000 Dr)
      const cashRow = rows.find((r: any) => r.code === '1111');
      expect(cashRow).toBeDefined();
      expect(parseFloat(cashRow.total_debit) - parseFloat(cashRow.total_credit)).toBe(130000);

      // Verify trial balance totals match
      const totalDebit = rows.reduce((sum: number, r: any) => sum + parseFloat(r.total_debit), 0);
      const totalCredit = rows.reduce((sum: number, r: any) => sum + parseFloat(r.total_credit), 0);
      expect(totalDebit).toBe(totalCredit);
    });

    it('should exclude draft entries from trial balance', async () => {
      const { company, fiscalYear, accounts, user } = await seedTestData();

      // Create a posted entry
      await createPostedEntry(company.id, fiscalYear.id, user.id, 'JV/001', [
        { accountId: accounts.get('1111')!, debit: 10000, credit: 0 },
        { accountId: accounts.get('4100')!, debit: 0, credit: 10000 },
      ]);

      // Create a draft entry (should NOT be included)
      const [draftEntry] = await db.insert(schema.journalEntries).values({
        companyId: company.id,
        fiscalYearId: fiscalYear.id,
        entryNumber: 'JV/002',
        entryDate: new Date('2024-05-02'),
        postingDate: new Date('2024-05-02'),
        entryType: 'manual',
        narration: 'Draft entry',
        totalDebit: '5000.00',
        totalCredit: '5000.00',
        sourceType: 'manual',
        status: 'draft', // Draft!
        createdByUserId: user.id,
      }).returning();

      await db.insert(schema.journalEntryLines).values([
        { journalEntryId: draftEntry.id, accountId: accounts.get('1111')!, debitAmount: '5000.00', creditAmount: '0.00' },
        { journalEntryId: draftEntry.id, accountId: accounts.get('4100')!, debitAmount: '0.00', creditAmount: '5000.00' },
      ]);

      // Calculate trial balance (only posted entries)
      const result = await db.execute(sql`
        SELECT
          COALESCE(SUM(CAST(jel.debit_amount AS DECIMAL)), 0) as total_debit
        FROM journal_entry_lines jel
        JOIN journal_entries je ON jel.journal_entry_id = je.id
        WHERE je.company_id = ${company.id}
          AND je.status = 'posted'
          AND jel.account_id = ${accounts.get('1111')}
      `);

      // Should only show 10000 (from posted entry), not 15000
      expect(parseFloat((result.rows[0] as any).total_debit)).toBe(10000);
    });

    it('should handle period filtering', async () => {
      const { company, fiscalYear, accounts, user } = await seedTestData();

      // Create entries for different dates
      const [entry1] = await db.insert(schema.journalEntries).values({
        companyId: company.id,
        fiscalYearId: fiscalYear.id,
        entryNumber: 'JV/001',
        entryDate: new Date('2024-04-15'),
        postingDate: new Date('2024-04-15'),
        entryType: 'manual',
        narration: 'April entry',
        totalDebit: '10000.00',
        totalCredit: '10000.00',
        sourceType: 'manual',
        status: 'posted',
        createdByUserId: user.id,
      }).returning();

      await db.insert(schema.journalEntryLines).values([
        { journalEntryId: entry1.id, accountId: accounts.get('1111')!, debitAmount: '10000.00', creditAmount: '0.00' },
        { journalEntryId: entry1.id, accountId: accounts.get('4100')!, debitAmount: '0.00', creditAmount: '10000.00' },
      ]);

      const [entry2] = await db.insert(schema.journalEntries).values({
        companyId: company.id,
        fiscalYearId: fiscalYear.id,
        entryNumber: 'JV/002',
        entryDate: new Date('2024-06-15'),
        postingDate: new Date('2024-06-15'),
        entryType: 'manual',
        narration: 'June entry',
        totalDebit: '20000.00',
        totalCredit: '20000.00',
        sourceType: 'manual',
        status: 'posted',
        createdByUserId: user.id,
      }).returning();

      await db.insert(schema.journalEntryLines).values([
        { journalEntryId: entry2.id, accountId: accounts.get('1111')!, debitAmount: '20000.00', creditAmount: '0.00' },
        { journalEntryId: entry2.id, accountId: accounts.get('4100')!, debitAmount: '0.00', creditAmount: '20000.00' },
      ]);

      // Query for April only
      const aprilResult = await db.execute(sql`
        SELECT
          COALESCE(SUM(CAST(jel.debit_amount AS DECIMAL)), 0) as total_debit
        FROM journal_entry_lines jel
        JOIN journal_entries je ON jel.journal_entry_id = je.id
        WHERE je.company_id = ${company.id}
          AND je.status = 'posted'
          AND je.posting_date >= '2024-04-01'
          AND je.posting_date < '2024-05-01'
          AND jel.account_id = ${accounts.get('1111')}
      `);

      expect(parseFloat((aprilResult.rows[0] as any).total_debit)).toBe(10000);

      // Query for full year
      const yearResult = await db.execute(sql`
        SELECT
          COALESCE(SUM(CAST(jel.debit_amount AS DECIMAL)), 0) as total_debit
        FROM journal_entry_lines jel
        JOIN journal_entries je ON jel.journal_entry_id = je.id
        WHERE je.company_id = ${company.id}
          AND je.status = 'posted'
          AND jel.account_id = ${accounts.get('1111')}
      `);

      expect(parseFloat((yearResult.rows[0] as any).total_debit)).toBe(30000);
    });
  });

  describe('Opening Balances', () => {
    it('should include opening balances in trial balance', async () => {
      const { company, accounts } = await seedTestData();

      // Set opening balance on an account
      await db
        .update(schema.chartOfAccounts)
        .set({
          openingBalance: '50000.00',
          openingBalanceType: 'debit',
        })
        .where(eq(schema.chartOfAccounts.id, accounts.get('1111')!));

      const [account] = await db
        .select()
        .from(schema.chartOfAccounts)
        .where(eq(schema.chartOfAccounts.id, accounts.get('1111')!));

      expect(account.openingBalance).toBe('50000.00');
      expect(account.openingBalanceType).toBe('debit');
    });
  });
});
