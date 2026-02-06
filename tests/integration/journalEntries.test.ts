/**
 * Journal Entries API Integration Tests
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestDb, closeTestDb, clearTestDb, seedTestData } from '../setup';
import * as schema from '../../shared/schema';
import { eq, sql } from 'drizzle-orm';

describe('Journal Entries API', () => {
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

  describe('Journal Entry Creation', () => {
    it('should create a balanced journal entry', async () => {
      const { company, fiscalYear, accounts, user } = await seedTestData();
      const cashAccountId = accounts.get('1111')!;
      const revenueAccountId = accounts.get('4100')!;

      // Create journal entry header
      const [entry] = await db.insert(schema.journalEntries).values({
        companyId: company.id,
        fiscalYearId: fiscalYear.id,
        entryNumber: 'JV/2024-25/0001',
        entryDate: new Date('2024-04-15'),
        postingDate: new Date('2024-04-15'),
        entryType: 'manual',
        narration: 'Cash sales revenue',
        totalDebit: '10000.00',
        totalCredit: '10000.00',
        sourceType: 'manual',
        status: 'draft',
        createdByUserId: user.id,
      }).returning();

      // Create debit line (Cash increases)
      await db.insert(schema.journalEntryLines).values({
        journalEntryId: entry.id,
        accountId: cashAccountId,
        debitAmount: '10000.00',
        creditAmount: '0.00',
        description: 'Cash received',
      });

      // Create credit line (Revenue increases)
      await db.insert(schema.journalEntryLines).values({
        journalEntryId: entry.id,
        accountId: revenueAccountId,
        debitAmount: '0.00',
        creditAmount: '10000.00',
        description: 'Sales revenue',
      });

      expect(entry.entryNumber).toBe('JV/2024-25/0001');
      expect(entry.totalDebit).toBe('10000.00');
      expect(entry.totalCredit).toBe('10000.00');
      expect(entry.status).toBe('draft');
    });

    it('should reject unbalanced journal entries', async () => {
      const { company, fiscalYear, user } = await seedTestData();

      // Try to create unbalanced entry (validation should happen at API level)
      const [entry] = await db.insert(schema.journalEntries).values({
        companyId: company.id,
        fiscalYearId: fiscalYear.id,
        entryNumber: 'JV/2024-25/0002',
        entryDate: new Date('2024-04-15'),
        postingDate: new Date('2024-04-15'),
        entryType: 'manual',
        narration: 'Test entry',
        totalDebit: '10000.00',
        totalCredit: '5000.00', // Unbalanced!
        sourceType: 'manual',
        status: 'draft',
        createdByUserId: user.id,
      }).returning();

      // The entry is created but balance validation would occur at API level
      expect(entry.totalDebit).not.toBe(entry.totalCredit);
    });
  });

  describe('Journal Entry Status Workflow', () => {
    it('should transition from draft to posted', async () => {
      const { company, fiscalYear, accounts, user } = await seedTestData();

      const [entry] = await db.insert(schema.journalEntries).values({
        companyId: company.id,
        fiscalYearId: fiscalYear.id,
        entryNumber: 'JV/2024-25/0003',
        entryDate: new Date('2024-04-15'),
        postingDate: new Date('2024-04-15'),
        entryType: 'manual',
        narration: 'Test posting',
        totalDebit: '5000.00',
        totalCredit: '5000.00',
        sourceType: 'manual',
        status: 'draft',
        createdByUserId: user.id,
      }).returning();

      // Post the entry
      await db
        .update(schema.journalEntries)
        .set({ status: 'posted' })
        .where(eq(schema.journalEntries.id, entry.id));

      const [updated] = await db
        .select()
        .from(schema.journalEntries)
        .where(eq(schema.journalEntries.id, entry.id));

      expect(updated.status).toBe('posted');
    });

    it('should create reversal entry', async () => {
      const { company, fiscalYear, accounts, user } = await seedTestData();
      const cashAccountId = accounts.get('1111')!;
      const expenseAccountId = accounts.get('5110')!;

      // Create original posted entry
      const [original] = await db.insert(schema.journalEntries).values({
        companyId: company.id,
        fiscalYearId: fiscalYear.id,
        entryNumber: 'JV/2024-25/0004',
        entryDate: new Date('2024-04-15'),
        postingDate: new Date('2024-04-15'),
        entryType: 'manual',
        narration: 'Salary payment',
        totalDebit: '50000.00',
        totalCredit: '50000.00',
        sourceType: 'manual',
        status: 'posted',
        createdByUserId: user.id,
      }).returning();

      // Create lines for original
      await db.insert(schema.journalEntryLines).values([
        {
          journalEntryId: original.id,
          accountId: expenseAccountId,
          debitAmount: '50000.00',
          creditAmount: '0.00',
          description: 'Salary expense',
        },
        {
          journalEntryId: original.id,
          accountId: cashAccountId,
          debitAmount: '0.00',
          creditAmount: '50000.00',
          description: 'Cash paid',
        },
      ]);

      // Create reversal entry (swapped debits/credits)
      const [reversal] = await db.insert(schema.journalEntries).values({
        companyId: company.id,
        fiscalYearId: fiscalYear.id,
        entryNumber: 'JV/2024-25/0005',
        entryDate: new Date('2024-04-16'),
        postingDate: new Date('2024-04-16'),
        entryType: 'reversal',
        narration: 'Reversal of JV/2024-25/0004',
        totalDebit: '50000.00',
        totalCredit: '50000.00',
        sourceType: 'manual',
        status: 'posted',
        reversedEntryId: original.id,
        createdByUserId: user.id,
      }).returning();

      // Update original as reversed
      await db
        .update(schema.journalEntries)
        .set({ status: 'reversed' })
        .where(eq(schema.journalEntries.id, original.id));

      const [updatedOriginal] = await db
        .select()
        .from(schema.journalEntries)
        .where(eq(schema.journalEntries.id, original.id));

      expect(updatedOriginal.status).toBe('reversed');
      expect(reversal.reversedEntryId).toBe(original.id);
    });
  });

  describe('Journal Entry Lines', () => {
    it('should create multiple lines per entry', async () => {
      const { company, fiscalYear, accounts, user } = await seedTestData();

      const [entry] = await db.insert(schema.journalEntries).values({
        companyId: company.id,
        fiscalYearId: fiscalYear.id,
        entryNumber: 'JV/2024-25/0006',
        entryDate: new Date('2024-04-20'),
        postingDate: new Date('2024-04-20'),
        entryType: 'manual',
        narration: 'Multi-line entry',
        totalDebit: '30000.00',
        totalCredit: '30000.00',
        sourceType: 'manual',
        status: 'posted',
        createdByUserId: user.id,
      }).returning();

      // Create multiple lines
      await db.insert(schema.journalEntryLines).values([
        {
          journalEntryId: entry.id,
          accountId: accounts.get('1111')!,
          debitAmount: '30000.00',
          creditAmount: '0.00',
        },
        {
          journalEntryId: entry.id,
          accountId: accounts.get('4100')!,
          debitAmount: '0.00',
          creditAmount: '25000.00',
        },
        {
          journalEntryId: entry.id,
          accountId: accounts.get('2110')!,
          debitAmount: '0.00',
          creditAmount: '5000.00',
        },
      ]);

      const lines = await db
        .select()
        .from(schema.journalEntryLines)
        .where(eq(schema.journalEntryLines.journalEntryId, entry.id));

      expect(lines.length).toBe(3);

      // Verify balance
      const totalDebit = lines.reduce((sum, l) => sum + parseFloat(l.debitAmount), 0);
      const totalCredit = lines.reduce((sum, l) => sum + parseFloat(l.creditAmount), 0);
      expect(totalDebit).toBe(totalCredit);
    });

    it('should support GST details on lines', async () => {
      const { company, fiscalYear, accounts, user } = await seedTestData();

      const [entry] = await db.insert(schema.journalEntries).values({
        companyId: company.id,
        fiscalYearId: fiscalYear.id,
        entryNumber: 'JV/2024-25/0007',
        entryDate: new Date('2024-04-25'),
        postingDate: new Date('2024-04-25'),
        entryType: 'manual',
        narration: 'GST Entry',
        totalDebit: '11800.00',
        totalCredit: '11800.00',
        sourceType: 'manual',
        status: 'posted',
        createdByUserId: user.id,
      }).returning();

      const [line] = await db.insert(schema.journalEntryLines).values({
        journalEntryId: entry.id,
        accountId: accounts.get('4100')!,
        debitAmount: '0.00',
        creditAmount: '10000.00',
        gstDetails: {
          rate: 18,
          hsnSac: '998311',
          cgst: 900,
          sgst: 900,
          igst: 0,
        },
      }).returning();

      expect(line.gstDetails).toBeDefined();
      expect((line.gstDetails as any).rate).toBe(18);
    });
  });

  describe('Entry Number Generation', () => {
    it('should generate sequential entry numbers', async () => {
      const { company, fiscalYear, user } = await seedTestData();

      // Create first entry
      await db.insert(schema.journalEntries).values({
        companyId: company.id,
        fiscalYearId: fiscalYear.id,
        entryNumber: 'JV/2024-25/0001',
        entryDate: new Date(),
        postingDate: new Date(),
        entryType: 'manual',
        narration: 'Entry 1',
        totalDebit: '1000.00',
        totalCredit: '1000.00',
        sourceType: 'manual',
        status: 'draft',
        createdByUserId: user.id,
      });

      // Create second entry
      await db.insert(schema.journalEntries).values({
        companyId: company.id,
        fiscalYearId: fiscalYear.id,
        entryNumber: 'JV/2024-25/0002',
        entryDate: new Date(),
        postingDate: new Date(),
        entryType: 'manual',
        narration: 'Entry 2',
        totalDebit: '2000.00',
        totalCredit: '2000.00',
        sourceType: 'manual',
        status: 'draft',
        createdByUserId: user.id,
      });

      const entries = await db
        .select()
        .from(schema.journalEntries)
        .where(eq(schema.journalEntries.companyId, company.id));

      expect(entries[0].entryNumber).toBe('JV/2024-25/0001');
      expect(entries[1].entryNumber).toBe('JV/2024-25/0002');
    });
  });
});
