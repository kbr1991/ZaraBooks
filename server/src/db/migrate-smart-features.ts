/**
 * Migration script for Smart Features tables
 */
import { db } from './index';
import { sql } from 'drizzle-orm';

async function migrateSmartFeatures() {
  console.log('Creating Smart Features tables...');

  // Bank Connections
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bank_connections (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id VARCHAR(36) REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
      bank_account_id VARCHAR(36) REFERENCES bank_accounts(id),
      bank_name VARCHAR(100) NOT NULL,
      connection_type VARCHAR(20) NOT NULL,
      provider VARCHAR(50),
      credentials TEXT,
      last_sync_at TIMESTAMP,
      sync_frequency VARCHAR(20) DEFAULT 'daily',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  console.log('✓ bank_connections');

  // Bank Feed Transactions
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bank_feed_transactions (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id VARCHAR(36) REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
      bank_connection_id VARCHAR(36) REFERENCES bank_connections(id),
      bank_account_id VARCHAR(36) REFERENCES bank_accounts(id),
      external_transaction_id VARCHAR(100),
      transaction_date DATE NOT NULL,
      value_date DATE,
      description TEXT NOT NULL,
      reference_number VARCHAR(100),
      debit_amount DECIMAL(18,2),
      credit_amount DECIMAL(18,2),
      running_balance DECIMAL(18,2),
      suggested_account_id VARCHAR(36) REFERENCES chart_of_accounts(id),
      suggested_party_id VARCHAR(36) REFERENCES parties(id),
      confidence_score DECIMAL(5,2),
      categorization_source VARCHAR(20),
      reconciliation_status VARCHAR(20) DEFAULT 'pending',
      matched_journal_entry_id VARCHAR(36) REFERENCES journal_entries(id),
      matched_invoice_id VARCHAR(36) REFERENCES invoices(id),
      matched_bill_id VARCHAR(36),
      matched_expense_id VARCHAR(36),
      matched_payment_received_id VARCHAR(36),
      matched_payment_made_id VARCHAR(36),
      is_duplicate BOOLEAN DEFAULT false,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  console.log('✓ bank_feed_transactions');

  // Categorization Rules
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS categorization_rules (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id VARCHAR(36) REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
      rule_name VARCHAR(100) NOT NULL,
      priority INTEGER DEFAULT 0,
      conditions JSONB NOT NULL,
      target_account_id VARCHAR(36) REFERENCES chart_of_accounts(id),
      target_party_id VARCHAR(36) REFERENCES parties(id),
      is_active BOOLEAN DEFAULT true,
      usage_count INTEGER DEFAULT 0,
      created_by_user_id VARCHAR(36) REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  console.log('✓ categorization_rules');

  // Document Scans
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS document_scans (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id VARCHAR(36) REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
      document_type VARCHAR(30) NOT NULL,
      file_url TEXT NOT NULL,
      file_name VARCHAR(255),
      mime_type VARCHAR(50),
      file_size INTEGER,
      source VARCHAR(20) DEFAULT 'upload',
      ocr_status VARCHAR(20) DEFAULT 'pending',
      ocr_provider VARCHAR(30),
      ocr_confidence DECIMAL(5,2),
      extracted_data JSONB,
      language_detected VARCHAR(10),
      processing_time INTEGER,
      created_expense_id VARCHAR(36) REFERENCES expenses(id),
      created_bill_id VARCHAR(36),
      created_invoice_id VARCHAR(36) REFERENCES invoices(id),
      needs_review BOOLEAN DEFAULT true,
      reviewed_by_user_id VARCHAR(36) REFERENCES users(id),
      reviewed_at TIMESTAMP,
      review_notes TEXT,
      uploaded_by_user_id VARCHAR(36) REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  console.log('✓ document_scans');

  // Recurring Invoices
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS recurring_invoices (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id VARCHAR(36) REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
      customer_id VARCHAR(36) REFERENCES parties(id) NOT NULL,
      name VARCHAR(255) NOT NULL,
      frequency VARCHAR(20) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE,
      next_generate_date DATE,
      template_data JSONB NOT NULL,
      auto_send BOOLEAN DEFAULT false,
      send_method VARCHAR(20) DEFAULT 'email',
      send_days_before INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      is_paused BOOLEAN DEFAULT false,
      pause_reason TEXT,
      last_generated_at TIMESTAMP,
      total_generated INTEGER DEFAULT 0,
      created_by_user_id VARCHAR(36) REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  console.log('✓ recurring_invoices');

  // Payment Reminders
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS payment_reminders (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id VARCHAR(36) REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
      invoice_id VARCHAR(36) REFERENCES invoices(id) NOT NULL,
      reminder_level INTEGER NOT NULL,
      scheduled_date DATE NOT NULL,
      sent_at TIMESTAMP,
      send_method VARCHAR(20),
      status VARCHAR(20) DEFAULT 'pending',
      response TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  console.log('✓ payment_reminders');

  // Payment Gateway Config
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS payment_gateway_config (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id VARCHAR(36) REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
      gateway VARCHAR(30) NOT NULL,
      is_active BOOLEAN DEFAULT true,
      is_primary BOOLEAN DEFAULT false,
      is_test_mode BOOLEAN DEFAULT false,
      credentials TEXT,
      webhook_secret TEXT,
      settings JSONB,
      total_transactions INTEGER DEFAULT 0,
      total_amount DECIMAL(18,2) DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  console.log('✓ payment_gateway_config');

  // Payment Links
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS payment_links (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id VARCHAR(36) REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
      invoice_id VARCHAR(36) REFERENCES invoices(id),
      customer_id VARCHAR(36) REFERENCES parties(id),
      gateway VARCHAR(30) NOT NULL,
      gateway_link_id VARCHAR(100),
      gateway_order_id VARCHAR(100),
      gateway_payment_id VARCHAR(100),
      short_url VARCHAR(255),
      amount DECIMAL(18,2) NOT NULL,
      currency VARCHAR(3) DEFAULT 'INR',
      description TEXT,
      status VARCHAR(20) DEFAULT 'active',
      expires_at TIMESTAMP,
      payment_received_at TIMESTAMP,
      payment_method VARCHAR(50),
      payment_received_id VARCHAR(36),
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  console.log('✓ payment_links');

  // Cash Flow Forecasts
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS cash_flow_forecasts (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id VARCHAR(36) REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
      forecast_date DATE NOT NULL,
      forecast_type VARCHAR(20) NOT NULL,
      predicted_inflows DECIMAL(18,2),
      predicted_outflows DECIMAL(18,2),
      predicted_balance DECIMAL(18,2),
      confidence_level DECIMAL(5,2),
      breakdown JSONB,
      generated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  console.log('✓ cash_flow_forecasts');

  // Smart Alerts
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS smart_alerts (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id VARCHAR(36) REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
      alert_type VARCHAR(50) NOT NULL,
      severity VARCHAR(20) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      data JSONB,
      is_read BOOLEAN DEFAULT false,
      is_dismissed BOOLEAN DEFAULT false,
      action_url VARCHAR(255),
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      expires_at TIMESTAMP
    )
  `);
  console.log('✓ smart_alerts');

  // Voice Transcriptions
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS voice_transcriptions (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id VARCHAR(36) REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
      user_id VARCHAR(36) REFERENCES users(id) NOT NULL,
      audio_url TEXT,
      transcription TEXT,
      transcription_confidence DECIMAL(5,2),
      language VARCHAR(10),
      parsed_intent VARCHAR(100),
      parsed_entities JSONB,
      intent_confidence DECIMAL(5,2),
      requires_confirmation BOOLEAN DEFAULT true,
      confirmed_at TIMESTAMP,
      action_taken VARCHAR(50),
      created_entry_type VARCHAR(50),
      created_entry_id VARCHAR(36),
      error_message TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  console.log('✓ voice_transcriptions');

  // Integration Connections
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS integration_connections (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id VARCHAR(36) REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
      platform VARCHAR(50) NOT NULL,
      connection_name VARCHAR(100),
      store_url VARCHAR(255),
      access_token TEXT,
      refresh_token TEXT,
      credentials TEXT,
      sync_settings JSONB,
      last_sync_at TIMESTAMP,
      last_sync_status VARCHAR(20),
      last_sync_error TEXT,
      sync_in_progress BOOLEAN DEFAULT false,
      total_orders_synced INTEGER DEFAULT 0,
      total_products_synced INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  console.log('✓ integration_connections');

  // Webhooks
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS webhooks (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id VARCHAR(36) REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
      name VARCHAR(100) NOT NULL,
      event_type VARCHAR(50) NOT NULL,
      target_url VARCHAR(500) NOT NULL,
      secret TEXT,
      headers JSONB,
      is_active BOOLEAN DEFAULT true,
      failure_count INTEGER DEFAULT 0,
      last_triggered_at TIMESTAMP,
      last_success_at TIMESTAMP,
      last_failure_at TIMESTAMP,
      created_by_user_id VARCHAR(36) REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  console.log('✓ webhooks');

  // Webhook Logs
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS webhook_logs (
      id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
      webhook_id VARCHAR(36) REFERENCES webhooks(id) ON DELETE CASCADE NOT NULL,
      event_type VARCHAR(50) NOT NULL,
      payload JSONB,
      response_status INTEGER,
      response_body TEXT,
      duration_ms INTEGER,
      success BOOLEAN DEFAULT false,
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL
    )
  `);
  console.log('✓ webhook_logs');

  console.log('\nAll Smart Features tables created successfully!');
  process.exit(0);
}

migrateSmartFeatures().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
