/**
 * Database Setup Script
 *
 * This script sets up the database by:
 * 1. Creating necessary tables using Drizzle push
 * 2. Seeding initial data (HSN/SAC codes, TDS sections, etc.)
 *
 * Usage: npm run db:setup
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from '../shared/schema';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://postgres:password@localhost:5432/zarabooks';

async function main() {
  console.log('Setting up database...\n');

  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool, { schema });

  try {
    // Test connection
    console.log('Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('Database connection successful!\n');

    // Check if tables exist
    const tablesResult = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    if (tablesResult.rows.length === 0) {
      console.log('No tables found. Please run "npm run db:push" first to create tables.\n');
      console.log('Then run this script again to seed initial data.\n');
      process.exit(1);
    }

    console.log(`Found ${tablesResult.rows.length} tables in database.\n`);

    // Seed HSN/SAC codes
    console.log('Seeding HSN/SAC codes...');
    const hsnCodes = [
      { code: '9983', description: 'Other professional, technical and business services', type: 'SAC' as const, gstRate: '18' },
      { code: '998311', description: 'Management consulting and management services', type: 'SAC' as const, gstRate: '18' },
      { code: '998312', description: 'Business consulting services', type: 'SAC' as const, gstRate: '18' },
      { code: '998313', description: 'Marketing management consulting services', type: 'SAC' as const, gstRate: '18' },
      { code: '998314', description: 'Human resources consulting services', type: 'SAC' as const, gstRate: '18' },
      { code: '998315', description: 'Operations management consulting services', type: 'SAC' as const, gstRate: '18' },
      { code: '998321', description: 'Accounting, auditing and bookkeeping services', type: 'SAC' as const, gstRate: '18' },
      { code: '998322', description: 'Financial auditing services', type: 'SAC' as const, gstRate: '18' },
      { code: '998323', description: 'Accounting review services', type: 'SAC' as const, gstRate: '18' },
      { code: '998324', description: 'Compilation of financial statements', type: 'SAC' as const, gstRate: '18' },
      { code: '998331', description: 'Corporate tax consulting services', type: 'SAC' as const, gstRate: '18' },
      { code: '998332', description: 'Individual tax preparation services', type: 'SAC' as const, gstRate: '18' },
      { code: '998341', description: 'Legal advisory and representation services', type: 'SAC' as const, gstRate: '18' },
      { code: '9984', description: 'Telecommunications, broadcasting and information services', type: 'SAC' as const, gstRate: '18' },
      { code: '9985', description: 'Support services', type: 'SAC' as const, gstRate: '18' },
      { code: '9986', description: 'Support services to agriculture, fishing, forestry', type: 'SAC' as const, gstRate: '18' },
      { code: '9987', description: 'Maintenance, repair and installation services', type: 'SAC' as const, gstRate: '18' },
      { code: '9988', description: 'Manufacturing services on physical inputs', type: 'SAC' as const, gstRate: '18' },
      { code: '9989', description: 'Other manufacturing services', type: 'SAC' as const, gstRate: '18' },
      { code: '9991', description: 'Public administration and other services', type: 'SAC' as const, gstRate: '18' },
      { code: '9992', description: 'Education services', type: 'SAC' as const, gstRate: '0' },
      { code: '9993', description: 'Human health and social care services', type: 'SAC' as const, gstRate: '0' },
      { code: '9994', description: 'Sewage and waste collection services', type: 'SAC' as const, gstRate: '18' },
      { code: '9995', description: 'Services of membership organizations', type: 'SAC' as const, gstRate: '18' },
      { code: '9996', description: 'Recreational, cultural and sporting services', type: 'SAC' as const, gstRate: '18' },
      { code: '9997', description: 'Other services', type: 'SAC' as const, gstRate: '18' },
    ];

    for (const hsn of hsnCodes) {
      try {
        await db.insert(schema.hsnSacMaster).values({
          ...hsn,
          isActive: true,
        }).onConflictDoNothing();
      } catch {
        // Ignore duplicates
      }
    }
    console.log(`Seeded ${hsnCodes.length} HSN/SAC codes.\n`);

    // Seed TDS sections
    console.log('Seeding TDS sections...');
    const tdsSections = [
      { sectionCode: '192', description: 'Salary', defaultRateIndividual: '0', defaultRateCompany: '0', thresholdLimit: '0' },
      { sectionCode: '194A', description: 'Interest other than interest on securities', defaultRateIndividual: '10', defaultRateCompany: '10', thresholdLimit: '40000' },
      { sectionCode: '194C', description: 'Payment to contractors', defaultRateIndividual: '1', defaultRateCompany: '2', thresholdLimit: '30000' },
      { sectionCode: '194D', description: 'Insurance commission', defaultRateIndividual: '5', defaultRateCompany: '10', thresholdLimit: '15000' },
      { sectionCode: '194H', description: 'Commission or brokerage', defaultRateIndividual: '5', defaultRateCompany: '5', thresholdLimit: '15000' },
      { sectionCode: '194I(a)', description: 'Rent - Plant and machinery', defaultRateIndividual: '2', defaultRateCompany: '2', thresholdLimit: '240000' },
      { sectionCode: '194I(b)', description: 'Rent - Land, building, furniture', defaultRateIndividual: '10', defaultRateCompany: '10', thresholdLimit: '240000' },
      { sectionCode: '194J', description: 'Professional or technical services', defaultRateIndividual: '10', defaultRateCompany: '10', thresholdLimit: '30000' },
      { sectionCode: '194K', description: 'Income from units', defaultRateIndividual: '10', defaultRateCompany: '10', thresholdLimit: '5000' },
      { sectionCode: '194M', description: 'Contractual work, professional fees', defaultRateIndividual: '5', defaultRateCompany: '5', thresholdLimit: '5000000' },
      { sectionCode: '194N', description: 'Cash withdrawal', defaultRateIndividual: '2', defaultRateCompany: '2', thresholdLimit: '10000000' },
      { sectionCode: '194O', description: 'E-commerce participants', defaultRateIndividual: '1', defaultRateCompany: '1', thresholdLimit: '500000' },
      { sectionCode: '194Q', description: 'Purchase of goods', defaultRateIndividual: '0.1', defaultRateCompany: '0.1', thresholdLimit: '5000000' },
      { sectionCode: '194R', description: 'Benefits or perquisites', defaultRateIndividual: '10', defaultRateCompany: '10', thresholdLimit: '20000' },
      { sectionCode: '194S', description: 'Virtual digital assets', defaultRateIndividual: '1', defaultRateCompany: '1', thresholdLimit: '10000' },
    ];

    for (const section of tdsSections) {
      try {
        await db.insert(schema.tdsSections).values({
          ...section,
          isActive: true,
        }).onConflictDoNothing();
      } catch {
        // Ignore duplicates
      }
    }
    console.log(`Seeded ${tdsSections.length} TDS sections.\n`);

    // Seed common currencies
    console.log('Seeding currencies...');
    const currencies = [
      { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimalPlaces: 2 },
      { code: 'USD', name: 'US Dollar', symbol: '$', decimalPlaces: 2 },
      { code: 'EUR', name: 'Euro', symbol: '€', decimalPlaces: 2 },
      { code: 'GBP', name: 'British Pound', symbol: '£', decimalPlaces: 2 },
      { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimalPlaces: 0 },
      { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimalPlaces: 2 },
      { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimalPlaces: 2 },
      { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', decimalPlaces: 2 },
      { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimalPlaces: 2 },
      { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', decimalPlaces: 2 },
    ];

    for (const currency of currencies) {
      try {
        await db.insert(schema.currencies).values({
          ...currency,
          isActive: true,
        }).onConflictDoNothing();
      } catch {
        // Ignore duplicates
      }
    }
    console.log(`Seeded ${currencies.length} currencies.\n`);

    console.log('Database setup complete!\n');
    console.log('Next steps:');
    console.log('1. Start the application: npm run dev');
    console.log('2. Register a new user at http://localhost:5173/register');
    console.log('3. Create a company and start using the application\n');

  } catch (error) {
    console.error('Error setting up database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
