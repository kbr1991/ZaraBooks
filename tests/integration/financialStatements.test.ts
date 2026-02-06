/**
 * Financial Statements API Integration Tests
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestDb, closeTestDb, clearTestDb, seedTestData } from '../setup';
import * as schema from '../../shared/schema';
import { sql } from 'drizzle-orm';

describe('Financial Statements API', () => {
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
   * Helper to create posted journal entry
   */
  async function createEntry(
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
      entryDate: new Date('2024-06-15'),
      postingDate: new Date('2024-06-15'),
      entryType: 'manual',
      narration: 'Test',
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

  describe('Balance Sheet', () => {
    it('should calculate correct asset totals', async () => {
      const { company, fiscalYear, accounts, user } = await seedTestData();

      // Create capital investment
      await createEntry(company.id, fiscalYear.id, user.id, 'JV/001', [
        { accountId: accounts.get('1111')!, debit: 500000, credit: 0 },
        { accountId: accounts.get('3100')!, debit: 0, credit: 500000 },
      ]);

      // Deposit to bank
      await createEntry(company.id, fiscalYear.id, user.id, 'JV/002', [
        { accountId: accounts.get('1112')!, debit: 400000, credit: 0 },
        { accountId: accounts.get('1111')!, debit: 0, credit: 400000 },
      ]);

      // Calculate asset totals
      const result = await db.execute(sql`
        SELECT
          coa.account_type,
          COALESCE(SUM(CAST(jel.debit_amount AS DECIMAL) - CAST(jel.credit_amount AS DECIMAL)), 0) as balance
        FROM chart_of_accounts coa
        LEFT JOIN journal_entry_lines jel ON coa.id = jel.account_id
        LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
          AND je.status = 'posted'
        WHERE coa.company_id = ${company.id}
          AND coa.is_group = false
          AND coa.account_type = 'asset'
        GROUP BY coa.account_type
      `);

      const assetBalance = parseFloat((result.rows[0] as any)?.balance || '0');
      expect(assetBalance).toBe(500000); // Cash 100000 + Bank 400000
    });

    it('should balance: Assets = Liabilities + Equity', async () => {
      const { company, fiscalYear, accounts, user } = await seedTestData();

      // Capital investment
      await createEntry(company.id, fiscalYear.id, user.id, 'JV/001', [
        { accountId: accounts.get('1111')!, debit: 200000, credit: 0 },
        { accountId: accounts.get('3100')!, debit: 0, credit: 200000 },
      ]);

      // Loan received
      await createEntry(company.id, fiscalYear.id, user.id, 'JV/002', [
        { accountId: accounts.get('1111')!, debit: 100000, credit: 0 },
        { accountId: accounts.get('2110')!, debit: 0, credit: 100000 },
      ]);

      // Calculate all balances by type
      const result = await db.execute(sql`
        SELECT
          coa.account_type,
          COALESCE(SUM(CAST(jel.debit_amount AS DECIMAL) - CAST(jel.credit_amount AS DECIMAL)), 0) as balance
        FROM chart_of_accounts coa
        LEFT JOIN journal_entry_lines jel ON coa.id = jel.account_id
        LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
          AND je.status = 'posted'
        WHERE coa.company_id = ${company.id}
          AND coa.is_group = false
        GROUP BY coa.account_type
      `);

      const balances: Record<string, number> = {};
      for (const row of result.rows as any[]) {
        balances[row.account_type] = parseFloat(row.balance);
      }

      const assets = balances['asset'] || 0;
      const liabilities = -(balances['liability'] || 0); // Credit balance
      const equity = -(balances['equity'] || 0); // Credit balance

      expect(assets).toBe(liabilities + equity);
    });

    it('should include income and expenses in retained earnings', async () => {
      const { company, fiscalYear, accounts, user } = await seedTestData();

      // Capital
      await createEntry(company.id, fiscalYear.id, user.id, 'JV/001', [
        { accountId: accounts.get('1111')!, debit: 100000, credit: 0 },
        { accountId: accounts.get('3100')!, debit: 0, credit: 100000 },
      ]);

      // Revenue
      await createEntry(company.id, fiscalYear.id, user.id, 'JV/002', [
        { accountId: accounts.get('1111')!, debit: 50000, credit: 0 },
        { accountId: accounts.get('4100')!, debit: 0, credit: 50000 },
      ]);

      // Expense
      await createEntry(company.id, fiscalYear.id, user.id, 'JV/003', [
        { accountId: accounts.get('5110')!, debit: 20000, credit: 0 },
        { accountId: accounts.get('1111')!, debit: 0, credit: 20000 },
      ]);

      // Net profit = 50000 - 20000 = 30000
      // Total equity should be 100000 + 30000 = 130000

      const result = await db.execute(sql`
        SELECT
          coa.account_type,
          COALESCE(SUM(CAST(jel.debit_amount AS DECIMAL) - CAST(jel.credit_amount AS DECIMAL)), 0) as balance
        FROM chart_of_accounts coa
        LEFT JOIN journal_entry_lines jel ON coa.id = jel.account_id
        LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
          AND je.status = 'posted'
        WHERE coa.company_id = ${company.id}
          AND coa.is_group = false
        GROUP BY coa.account_type
      `);

      const balances: Record<string, number> = {};
      for (const row of result.rows as any[]) {
        balances[row.account_type] = parseFloat(row.balance);
      }

      const income = -(balances['income'] || 0);
      const expenses = balances['expense'] || 0;
      const netProfit = income - expenses;

      expect(netProfit).toBe(30000);
    });
  });

  describe('Profit & Loss Statement', () => {
    it('should calculate revenue correctly', async () => {
      const { company, fiscalYear, accounts, user } = await seedTestData();

      // Multiple revenue entries
      await createEntry(company.id, fiscalYear.id, user.id, 'JV/001', [
        { accountId: accounts.get('1111')!, debit: 75000, credit: 0 },
        { accountId: accounts.get('4100')!, debit: 0, credit: 75000 },
      ]);

      await createEntry(company.id, fiscalYear.id, user.id, 'JV/002', [
        { accountId: accounts.get('1200')!, debit: 25000, credit: 0 },
        { accountId: accounts.get('4100')!, debit: 0, credit: 25000 },
      ]);

      const result = await db.execute(sql`
        SELECT
          COALESCE(SUM(CAST(jel.credit_amount AS DECIMAL) - CAST(jel.debit_amount AS DECIMAL)), 0) as revenue
        FROM chart_of_accounts coa
        JOIN journal_entry_lines jel ON coa.id = jel.account_id
        JOIN journal_entries je ON jel.journal_entry_id = je.id
        WHERE coa.company_id = ${company.id}
          AND coa.account_type = 'income'
          AND je.status = 'posted'
      `);

      expect(parseFloat((result.rows[0] as any).revenue)).toBe(100000);
    });

    it('should calculate expenses by category', async () => {
      const { company, fiscalYear, accounts, user } = await seedTestData();

      // Setup: Add capital first
      await createEntry(company.id, fiscalYear.id, user.id, 'JV/001', [
        { accountId: accounts.get('1111')!, debit: 100000, credit: 0 },
        { accountId: accounts.get('3100')!, debit: 0, credit: 100000 },
      ]);

      // Salary expense
      await createEntry(company.id, fiscalYear.id, user.id, 'JV/002', [
        { accountId: accounts.get('5110')!, debit: 40000, credit: 0 },
        { accountId: accounts.get('1111')!, debit: 0, credit: 40000 },
      ]);

      // Rent expense
      await createEntry(company.id, fiscalYear.id, user.id, 'JV/003', [
        { accountId: accounts.get('5120')!, debit: 15000, credit: 0 },
        { accountId: accounts.get('1111')!, debit: 0, credit: 15000 },
      ]);

      const result = await db.execute(sql`
        SELECT
          coa.code,
          coa.name,
          COALESCE(SUM(CAST(jel.debit_amount AS DECIMAL) - CAST(jel.credit_amount AS DECIMAL)), 0) as expense
        FROM chart_of_accounts coa
        JOIN journal_entry_lines jel ON coa.id = jel.account_id
        JOIN journal_entries je ON jel.journal_entry_id = je.id
        WHERE coa.company_id = ${company.id}
          AND coa.account_type = 'expense'
          AND coa.is_group = false
          AND je.status = 'posted'
        GROUP BY coa.id, coa.code, coa.name
        ORDER BY coa.code
      `);

      const expenses = result.rows as any[];
      const salaryExpense = expenses.find((e: any) => e.code === '5110');
      const rentExpense = expenses.find((e: any) => e.code === '5120');

      expect(parseFloat(salaryExpense?.expense || 0)).toBe(40000);
      expect(parseFloat(rentExpense?.expense || 0)).toBe(15000);
    });

    it('should calculate net profit/loss', async () => {
      const { company, fiscalYear, accounts, user } = await seedTestData();

      // Revenue: 80000
      await createEntry(company.id, fiscalYear.id, user.id, 'JV/001', [
        { accountId: accounts.get('1111')!, debit: 80000, credit: 0 },
        { accountId: accounts.get('4100')!, debit: 0, credit: 80000 },
      ]);

      // Expenses: 45000
      await createEntry(company.id, fiscalYear.id, user.id, 'JV/002', [
        { accountId: accounts.get('5110')!, debit: 45000, credit: 0 },
        { accountId: accounts.get('1111')!, debit: 0, credit: 45000 },
      ]);

      // Calculate P&L
      const result = await db.execute(sql`
        SELECT
          COALESCE(SUM(
            CASE WHEN coa.account_type = 'income'
              THEN CAST(jel.credit_amount AS DECIMAL) - CAST(jel.debit_amount AS DECIMAL)
              ELSE 0 END
          ), 0) as total_income,
          COALESCE(SUM(
            CASE WHEN coa.account_type = 'expense'
              THEN CAST(jel.debit_amount AS DECIMAL) - CAST(jel.credit_amount AS DECIMAL)
              ELSE 0 END
          ), 0) as total_expenses
        FROM chart_of_accounts coa
        JOIN journal_entry_lines jel ON coa.id = jel.account_id
        JOIN journal_entries je ON jel.journal_entry_id = je.id
        WHERE coa.company_id = ${company.id}
          AND coa.account_type IN ('income', 'expense')
          AND je.status = 'posted'
      `);

      const row = result.rows[0] as any;
      const totalIncome = parseFloat(row.total_income);
      const totalExpenses = parseFloat(row.total_expenses);
      const netProfit = totalIncome - totalExpenses;

      expect(totalIncome).toBe(80000);
      expect(totalExpenses).toBe(45000);
      expect(netProfit).toBe(35000);
    });
  });

  describe('Cash Flow Statement', () => {
    it('should track cash movements', async () => {
      const { company, fiscalYear, accounts, user } = await seedTestData();

      // Opening cash from capital
      await createEntry(company.id, fiscalYear.id, user.id, 'JV/001', [
        { accountId: accounts.get('1111')!, debit: 100000, credit: 0 },
        { accountId: accounts.get('3100')!, debit: 0, credit: 100000 },
      ]);

      // Cash received from customers
      await createEntry(company.id, fiscalYear.id, user.id, 'JV/002', [
        { accountId: accounts.get('1111')!, debit: 50000, credit: 0 },
        { accountId: accounts.get('4100')!, debit: 0, credit: 50000 },
      ]);

      // Cash paid for expenses
      await createEntry(company.id, fiscalYear.id, user.id, 'JV/003', [
        { accountId: accounts.get('5110')!, debit: 30000, credit: 0 },
        { accountId: accounts.get('1111')!, debit: 0, credit: 30000 },
      ]);

      // Calculate cash balance
      const result = await db.execute(sql`
        SELECT
          COALESCE(SUM(CAST(jel.debit_amount AS DECIMAL) - CAST(jel.credit_amount AS DECIMAL)), 0) as cash_balance
        FROM journal_entry_lines jel
        JOIN journal_entries je ON jel.journal_entry_id = je.id
        JOIN chart_of_accounts coa ON jel.account_id = coa.id
        WHERE je.company_id = ${company.id}
          AND je.status = 'posted'
          AND coa.code IN ('1111', '1112')  -- Cash accounts
      `);

      // Cash: 100000 (capital) + 50000 (revenue) - 30000 (expense) = 120000
      expect(parseFloat((result.rows[0] as any).cash_balance)).toBe(120000);
    });
  });
});
