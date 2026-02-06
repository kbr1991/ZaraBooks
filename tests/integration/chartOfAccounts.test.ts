/**
 * Chart of Accounts API Integration Tests
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestDb, closeTestDb, clearTestDb, seedTestData } from '../setup';
import * as schema from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

describe('Chart of Accounts API', () => {
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

  describe('Account Creation', () => {
    it('should create a group account', async () => {
      const { company } = await seedTestData();

      const [account] = await db.insert(schema.chartOfAccounts).values({
        companyId: company.id,
        code: '6000',
        name: 'Other Income',
        accountType: 'income',
        isGroup: true,
        level: 1,
        isActive: true,
        isSystem: false,
      }).returning();

      expect(account.code).toBe('6000');
      expect(account.isGroup).toBe(true);
      expect(account.level).toBe(1);
    });

    it('should create a ledger account under group', async () => {
      const { company, accounts } = await seedTestData();
      const incomeGroupId = accounts.get('4000');

      const [account] = await db.insert(schema.chartOfAccounts).values({
        companyId: company.id,
        code: '4200',
        name: 'Interest Income',
        accountType: 'income',
        parentAccountId: incomeGroupId,
        isGroup: false,
        level: 2,
        isActive: true,
        isSystem: false,
      }).returning();

      expect(account.code).toBe('4200');
      expect(account.parentAccountId).toBe(incomeGroupId);
      expect(account.isGroup).toBe(false);
    });

    it('should enforce unique account code per company', async () => {
      const { company } = await seedTestData();

      // Try to create account with existing code
      await expect(
        db.insert(schema.chartOfAccounts).values({
          companyId: company.id,
          code: '1000', // Already exists from seed
          name: 'Duplicate Account',
          accountType: 'asset',
          isGroup: true,
          level: 1,
          isActive: true,
          isSystem: false,
        })
      ).rejects.toThrow();
    });
  });

  describe('Account Hierarchy', () => {
    it('should retrieve accounts with parent-child relationships', async () => {
      const { company } = await seedTestData();

      // Get all asset accounts
      const assetAccounts = await db
        .select()
        .from(schema.chartOfAccounts)
        .where(
          and(
            eq(schema.chartOfAccounts.companyId, company.id),
            eq(schema.chartOfAccounts.accountType, 'asset')
          )
        );

      // Find parent and children
      const parentAccount = assetAccounts.find(a => a.code === '1000');
      const childAccounts = assetAccounts.filter(a => a.parentAccountId === parentAccount?.id);

      expect(parentAccount).toBeDefined();
      expect(parentAccount?.isGroup).toBe(true);
      expect(childAccounts.length).toBeGreaterThan(0);
    });

    it('should calculate correct account levels', async () => {
      const { company } = await seedTestData();

      const accounts = await db
        .select()
        .from(schema.chartOfAccounts)
        .where(eq(schema.chartOfAccounts.companyId, company.id));

      // Verify level 1 accounts have no parent
      const level1Accounts = accounts.filter(a => a.level === 1);
      level1Accounts.forEach(a => {
        expect(a.parentAccountId).toBeNull();
      });

      // Verify level 2+ accounts have parent
      const childAccounts = accounts.filter(a => a.level > 1);
      childAccounts.forEach(a => {
        expect(a.parentAccountId).not.toBeNull();
      });
    });
  });

  describe('Account Types', () => {
    it('should support all account types', async () => {
      const { company } = await seedTestData();

      const accounts = await db
        .select()
        .from(schema.chartOfAccounts)
        .where(eq(schema.chartOfAccounts.companyId, company.id));

      const accountTypes = new Set(accounts.map(a => a.accountType));

      expect(accountTypes.has('asset')).toBe(true);
      expect(accountTypes.has('liability')).toBe(true);
      expect(accountTypes.has('equity')).toBe(true);
      expect(accountTypes.has('income')).toBe(true);
      expect(accountTypes.has('expense')).toBe(true);
    });
  });

  describe('GST Configuration', () => {
    it('should store GST settings on account', async () => {
      const { company, accounts } = await seedTestData();
      const revenueAccountId = accounts.get('4100');

      await db
        .update(schema.chartOfAccounts)
        .set({
          gstApplicable: true,
          defaultGstRate: '18',
          hsnSacCode: '998311',
        })
        .where(eq(schema.chartOfAccounts.id, revenueAccountId!));

      const [updated] = await db
        .select()
        .from(schema.chartOfAccounts)
        .where(eq(schema.chartOfAccounts.id, revenueAccountId!));

      expect(updated.gstApplicable).toBe(true);
      expect(updated.defaultGstRate).toBe('18');
      expect(updated.hsnSacCode).toBe('998311');
    });
  });

  describe('Ledger Accounts Filter', () => {
    it('should return only non-group accounts as ledgers', async () => {
      const { company } = await seedTestData();

      const ledgerAccounts = await db
        .select()
        .from(schema.chartOfAccounts)
        .where(
          and(
            eq(schema.chartOfAccounts.companyId, company.id),
            eq(schema.chartOfAccounts.isGroup, false)
          )
        );

      ledgerAccounts.forEach(account => {
        expect(account.isGroup).toBe(false);
      });

      expect(ledgerAccounts.length).toBeGreaterThan(0);
    });
  });
});
