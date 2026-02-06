/**
 * Companies API Integration Tests
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestDb, closeTestDb, clearTestDb, seedTestData } from '../setup';
import * as schema from '../../shared/schema';
import { eq } from 'drizzle-orm';

describe('Companies API', () => {
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

  describe('Company Creation', () => {
    it('should create a new company with required fields', async () => {
      const { user } = await seedTestData();

      const companyData = {
        name: 'New Test Company',
        legalName: 'New Test Company Private Limited',
        pan: 'AABCN1234B',
        address: '456 New Street',
        city: 'Delhi',
        state: 'Delhi',
        pincode: '110001',
        fiscalYearStart: 4,
        gaapStandard: 'INDIA_GAAP' as const,
        baseCurrency: 'INR',
        createdByUserId: user.id,
      };

      const [company] = await db.insert(schema.companies).values(companyData).returning();

      expect(company).toBeDefined();
      expect(company.name).toBe(companyData.name);
      expect(company.pan).toBe(companyData.pan);
      expect(company.fiscalYearStart).toBe(4);
    });

    it('should create company with GST details', async () => {
      const { user } = await seedTestData();

      const companyData = {
        name: 'GST Company',
        legalName: 'GST Company Private Limited',
        pan: 'AABCG1234C',
        gstin: '07AABCG1234C1Z5',
        address: '789 GST Street',
        city: 'Delhi',
        state: 'Delhi',
        pincode: '110001',
        fiscalYearStart: 4,
        gaapStandard: 'INDIA_GAAP' as const,
        baseCurrency: 'INR',
        createdByUserId: user.id,
      };

      const [company] = await db.insert(schema.companies).values(companyData).returning();

      expect(company.gstin).toBe('07AABCG1234C1Z5');
    });

    it('should enforce unique PAN constraint', async () => {
      const { user, company: existingCompany } = await seedTestData();

      // Try to create company with same PAN
      await expect(
        db.insert(schema.companies).values({
          name: 'Duplicate PAN Company',
          legalName: 'Duplicate PAN Company Ltd',
          pan: existingCompany.pan, // Same PAN
          address: '123 Street',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
          fiscalYearStart: 4,
          gaapStandard: 'INDIA_GAAP' as const,
          baseCurrency: 'INR',
          createdByUserId: user.id,
        })
      ).rejects.toThrow();
    });
  });

  describe('Company-User Relationship', () => {
    it('should assign user to company with role', async () => {
      const { user, company } = await seedTestData();

      // Verify company-user relationship exists
      const [companyUser] = await db
        .select()
        .from(schema.companyUsers)
        .where(eq(schema.companyUsers.companyId, company.id));

      expect(companyUser).toBeDefined();
      expect(companyUser.userId).toBe(user.id);
      expect(companyUser.role).toBe('owner');
    });

    it('should allow multiple users per company', async () => {
      const { company } = await seedTestData();

      // Create another user
      const [newUser] = await db.insert(schema.users).values({
        email: 'accountant@example.com',
        password: 'hashedpassword',
        firstName: 'Account',
        lastName: 'Ant',
        isActive: true,
      }).returning();

      // Add to company
      const [companyUser] = await db.insert(schema.companyUsers).values({
        companyId: company.id,
        userId: newUser.id,
        role: 'accountant',
        permissions: { canCreateEntries: true, canApproveEntries: false },
      }).returning();

      expect(companyUser.role).toBe('accountant');
      expect(companyUser.permissions).toEqual({ canCreateEntries: true, canApproveEntries: false });
    });

    it('should allow user to access multiple companies', async () => {
      const { user } = await seedTestData();

      // Create second company
      const [secondCompany] = await db.insert(schema.companies).values({
        name: 'Second Company',
        legalName: 'Second Company Ltd',
        pan: 'AABCS1234S',
        address: '123 Second Street',
        city: 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600001',
        fiscalYearStart: 4,
        gaapStandard: 'INDIA_GAAP' as const,
        baseCurrency: 'INR',
        createdByUserId: user.id,
      }).returning();

      // Add user to second company
      await db.insert(schema.companyUsers).values({
        companyId: secondCompany.id,
        userId: user.id,
        role: 'viewer',
        permissions: {},
      });

      // Verify user is in both companies
      const userCompanies = await db
        .select()
        .from(schema.companyUsers)
        .where(eq(schema.companyUsers.userId, user.id));

      expect(userCompanies.length).toBe(2);
    });
  });

  describe('Fiscal Year Management', () => {
    it('should create fiscal year for company', async () => {
      const { company, fiscalYear } = await seedTestData();

      expect(fiscalYear.companyId).toBe(company.id);
      expect(fiscalYear.name).toBe('FY 2024-25');
      expect(fiscalYear.isLocked).toBe(false);
    });

    it('should allow multiple fiscal years per company', async () => {
      const { company } = await seedTestData();

      // Create another fiscal year
      const [newFY] = await db.insert(schema.fiscalYears).values({
        companyId: company.id,
        name: 'FY 2023-24',
        startDate: new Date('2023-04-01'),
        endDate: new Date('2024-03-31'),
        isLocked: true,
      }).returning();

      expect(newFY.name).toBe('FY 2023-24');
      expect(newFY.isLocked).toBe(true);

      // Verify both exist
      const fiscalYears = await db
        .select()
        .from(schema.fiscalYears)
        .where(eq(schema.fiscalYears.companyId, company.id));

      expect(fiscalYears.length).toBe(2);
    });
  });
});
