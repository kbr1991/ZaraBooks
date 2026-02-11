import { db } from './index';
import { sql } from 'drizzle-orm';

async function fixTables() {
  console.log('Fixing missing columns...');

  // Drop and recreate partners table with correct columns
  await db.execute(sql`DROP TABLE IF EXISTS commissions CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS partner_payouts CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS subscriptions CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS subscription_plans CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS tenant_users CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS partner_users CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS tenants CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS partners CASCADE`);

  console.log('Dropped old tables...');

  // Create partner_tier enum
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE partner_tier AS ENUM ('bronze', 'silver', 'gold', 'platinum');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  // Create partner_verification_status enum
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE partner_verification_status AS ENUM ('pending', 'verified', 'rejected');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  // Create subscription_status enum
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE subscription_status AS ENUM ('active', 'trialing', 'past_due', 'cancelled', 'paused');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);

  // Create partners table with all required columns
  await db.execute(sql`
    CREATE TABLE partners (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(100) UNIQUE NOT NULL,
      primary_email VARCHAR(255) NOT NULL,
      primary_phone VARCHAR(20),
      address TEXT,
      city VARCHAR(100),
      state VARCHAR(100),
      pan VARCHAR(10),
      gstin VARCHAR(15),
      tier partner_tier DEFAULT 'bronze',
      commission_rate DECIMAL(5,2) DEFAULT 10.00,
      referral_code VARCHAR(50) UNIQUE NOT NULL,
      bank_account_name VARCHAR(255),
      bank_account_number VARCHAR(50),
      bank_ifsc VARCHAR(11),
      verification_status partner_verification_status DEFAULT 'pending',
      verified_at TIMESTAMP,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  console.log('Created partners table');

  // Create tenants table with all required columns
  await db.execute(sql`
    CREATE TABLE tenants (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(100) UNIQUE NOT NULL,
      billing_email VARCHAR(255),
      gst_number VARCHAR(15),
      subscription_plan VARCHAR(50) DEFAULT 'free',
      subscription_status subscription_status DEFAULT 'active',
      trial_ends_at TIMESTAMP,
      partner_id VARCHAR(36) REFERENCES partners(id),
      referral_code VARCHAR(50),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  console.log('Created tenants table');

  // Create partner_users table
  await db.execute(sql`
    CREATE TABLE partner_users (
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
    CREATE TABLE tenant_users (
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
    CREATE TABLE subscription_plans (
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
    CREATE TABLE subscriptions (
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
    CREATE TABLE commissions (
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
    CREATE TABLE partner_payouts (
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

  // Make sure tenant_id column exists in companies
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
  console.log('Ensured tenant_id in companies table');

  console.log('All tables fixed successfully!');
  process.exit(0);
}

fixTables().catch((err) => {
  console.error('Error fixing tables:', err);
  process.exit(1);
});
