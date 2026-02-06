/**
 * Test Setup Utilities
 *
 * Provides database setup/teardown and test helpers for integration tests.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '../shared/schema';
import { sql } from 'drizzle-orm';

const { Pool } = pg;

// Test database connection
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ||
  'postgresql://localhost/zarabooks_test';

let testPool: pg.Pool | null = null;
let testDb: ReturnType<typeof drizzle> | null = null;

/**
 * Get or create the test database connection
 */
export function getTestDb() {
  if (!testDb) {
    testPool = new Pool({
      connectionString: TEST_DATABASE_URL,
    });
    testDb = drizzle(testPool, { schema });
  }
  return testDb;
}

/**
 * Close the test database connection
 */
export async function closeTestDb() {
  if (testPool) {
    await testPool.end();
    testPool = null;
    testDb = null;
  }
}

/**
 * Clear all tables in the test database
 */
export async function clearTestDb() {
  const db = getTestDb();

  // Disable foreign key checks and truncate all tables
  await db.execute(sql`
    DO $$
    DECLARE
      r RECORD;
    BEGIN
      -- Disable triggers
      SET session_replication_role = 'replica';

      -- Truncate all tables
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;

      -- Re-enable triggers
      SET session_replication_role = 'origin';
    END $$;
  `);
}

/**
 * Seed test data for integration tests
 */
export async function seedTestData() {
  const db = getTestDb();

  // Create a test user
  const [testUser] = await db.insert(schema.users).values({
    email: 'test@example.com',
    password: '$2a$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0lSsvqNu/1W', // "password123"
    firstName: 'Test',
    lastName: 'User',
    isActive: true,
    emailVerified: true,
  }).returning();

  // Create a test company
  const [testCompany] = await db.insert(schema.companies).values({
    name: 'Test Company Pvt Ltd',
    legalName: 'Test Company Private Limited',
    pan: 'AABCT1234A',
    gstin: '27AABCT1234A1Z5',
    tan: 'MUMT12345A',
    address: '123 Test Street',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    fiscalYearStart: 4, // April
    gaapStandard: 'INDIA_GAAP',
    baseCurrency: 'INR',
    createdByUserId: testUser.id,
  }).returning();

  // Create company-user relationship
  await db.insert(schema.companyUsers).values({
    companyId: testCompany.id,
    userId: testUser.id,
    role: 'owner',
    permissions: {},
  });

  // Create a fiscal year
  const [fiscalYear] = await db.insert(schema.fiscalYears).values({
    companyId: testCompany.id,
    name: 'FY 2024-25',
    startDate: new Date('2024-04-01'),
    endDate: new Date('2025-03-31'),
    isLocked: false,
  }).returning();

  // Create chart of accounts
  const accountsData = [
    { code: '1000', name: 'Assets', accountType: 'asset' as const, isGroup: true, level: 1 },
    { code: '1100', name: 'Current Assets', accountType: 'asset' as const, isGroup: true, level: 2, parentCode: '1000' },
    { code: '1110', name: 'Cash and Cash Equivalents', accountType: 'asset' as const, isGroup: true, level: 3, parentCode: '1100' },
    { code: '1111', name: 'Cash in Hand', accountType: 'asset' as const, isGroup: false, level: 4, parentCode: '1110' },
    { code: '1112', name: 'Bank Account - HDFC', accountType: 'asset' as const, isGroup: false, level: 4, parentCode: '1110' },
    { code: '1200', name: 'Trade Receivables', accountType: 'asset' as const, isGroup: false, level: 3, parentCode: '1100' },
    { code: '2000', name: 'Liabilities', accountType: 'liability' as const, isGroup: true, level: 1 },
    { code: '2100', name: 'Current Liabilities', accountType: 'liability' as const, isGroup: true, level: 2, parentCode: '2000' },
    { code: '2110', name: 'Trade Payables', accountType: 'liability' as const, isGroup: false, level: 3, parentCode: '2100' },
    { code: '3000', name: 'Equity', accountType: 'equity' as const, isGroup: true, level: 1 },
    { code: '3100', name: 'Share Capital', accountType: 'equity' as const, isGroup: false, level: 2, parentCode: '3000' },
    { code: '4000', name: 'Income', accountType: 'income' as const, isGroup: true, level: 1 },
    { code: '4100', name: 'Revenue from Operations', accountType: 'income' as const, isGroup: false, level: 2, parentCode: '4000' },
    { code: '5000', name: 'Expenses', accountType: 'expense' as const, isGroup: true, level: 1 },
    { code: '5100', name: 'Operating Expenses', accountType: 'expense' as const, isGroup: true, level: 2, parentCode: '5000' },
    { code: '5110', name: 'Salaries and Wages', accountType: 'expense' as const, isGroup: false, level: 3, parentCode: '5100' },
    { code: '5120', name: 'Rent Expense', accountType: 'expense' as const, isGroup: false, level: 3, parentCode: '5100' },
  ];

  // Insert accounts and build parent ID map
  const accountIdMap = new Map<string, string>();

  for (const account of accountsData) {
    const parentId = account.parentCode ? accountIdMap.get(account.parentCode) : null;
    const [inserted] = await db.insert(schema.chartOfAccounts).values({
      companyId: testCompany.id,
      code: account.code,
      name: account.name,
      accountType: account.accountType,
      isGroup: account.isGroup,
      level: account.level,
      parentAccountId: parentId,
      isActive: true,
      isSystem: false,
    }).returning();
    accountIdMap.set(account.code, inserted.id);
  }

  return {
    user: testUser,
    company: testCompany,
    fiscalYear,
    accounts: accountIdMap,
  };
}

/**
 * Create a test session for authenticated requests
 */
export function createTestSession(userId: string, companyId: string) {
  return {
    userId,
    currentCompanyId: companyId,
    cookie: {
      originalMaxAge: 86400000,
      expires: new Date(Date.now() + 86400000),
      httpOnly: true,
      path: '/',
    },
  };
}
