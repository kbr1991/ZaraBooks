import { db } from './index';
import { sql } from 'drizzle-orm';

async function createMissingTables() {
  console.log('Creating missing tables...');

  // Create partners table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS partners (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(100) UNIQUE NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(20),
      address TEXT,
      city VARCHAR(100),
      state VARCHAR(100),
      country VARCHAR(100) DEFAULT 'India',
      pincode VARCHAR(10),
      website VARCHAR(255),
      logo_url TEXT,
      tier VARCHAR(20) DEFAULT 'bronze',
      commission_rate DECIMAL(5,2) DEFAULT 10.00,
      referral_code VARCHAR(20) UNIQUE,
      is_active BOOLEAN DEFAULT true,
      verified_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  console.log('Created partners table');

  // Create tenants table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tenants (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      partner_id VARCHAR(36) REFERENCES partners(id),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(100) UNIQUE NOT NULL,
      billing_email VARCHAR(255),
      billing_address TEXT,
      subscription_plan VARCHAR(50) DEFAULT 'free',
      referral_code VARCHAR(20),
      is_active BOOLEAN DEFAULT true,
      trial_ends_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  console.log('Created tenants table');

  // Create partner_users table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS partner_users (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      partner_id VARCHAR(36) REFERENCES partners(id) ON DELETE CASCADE NOT NULL,
      user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      role VARCHAR(20) DEFAULT 'member',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      UNIQUE(partner_id, user_id)
    )
  `);
  console.log('Created partner_users table');

  // Create tenant_users table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS tenant_users (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id VARCHAR(36) REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
      user_id VARCHAR(36) REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      role VARCHAR(20) DEFAULT 'member',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      UNIQUE(tenant_id, user_id)
    )
  `);
  console.log('Created tenant_users table');

  // Create subscription_plans table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS subscription_plans (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      code VARCHAR(50) UNIQUE NOT NULL,
      description TEXT,
      monthly_price DECIMAL(10,2) DEFAULT 0,
      yearly_price DECIMAL(10,2) DEFAULT 0,
      max_companies INTEGER DEFAULT 1,
      max_users INTEGER DEFAULT 1,
      max_invoices_per_month INTEGER,
      features JSONB,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  console.log('Created subscription_plans table');

  // Create subscriptions table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id VARCHAR(36) REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
      plan_id VARCHAR(36) REFERENCES subscription_plans(id) NOT NULL,
      status VARCHAR(20) DEFAULT 'active',
      billing_cycle VARCHAR(20) DEFAULT 'monthly',
      current_period_start TIMESTAMP,
      current_period_end TIMESTAMP,
      cancelled_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  console.log('Created subscriptions table');

  // Create commissions table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS commissions (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      partner_id VARCHAR(36) REFERENCES partners(id) ON DELETE CASCADE NOT NULL,
      tenant_id VARCHAR(36) REFERENCES tenants(id),
      subscription_id VARCHAR(36) REFERENCES subscriptions(id),
      amount DECIMAL(10,2) NOT NULL,
      currency VARCHAR(3) DEFAULT 'INR',
      status VARCHAR(20) DEFAULT 'pending',
      paid_at TIMESTAMP,
      payout_id VARCHAR(36),
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  console.log('Created commissions table');

  // Create partner_payouts table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS partner_payouts (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      partner_id VARCHAR(36) REFERENCES partners(id) ON DELETE CASCADE NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      currency VARCHAR(3) DEFAULT 'INR',
      status VARCHAR(20) DEFAULT 'pending',
      payment_method VARCHAR(50),
      payment_reference VARCHAR(100),
      processed_at TIMESTAMP,
      notes TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  console.log('Created partner_payouts table');

  // Add tenant_id to companies table if not exists
  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'companies' AND column_name = 'tenant_id'
      ) THEN
        ALTER TABLE companies ADD COLUMN tenant_id VARCHAR(36) REFERENCES tenants(id);
      END IF;
    END $$;
  `);
  console.log('Added tenant_id to companies table');

  console.log('All missing tables created successfully!');
  process.exit(0);
}

createMissingTables().catch((err) => {
  console.error('Error creating tables:', err);
  process.exit(1);
});
