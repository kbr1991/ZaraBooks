const pg = require('pg');

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();

  try {
    // Check existing types
    const existingTypes = await client.query(`
      SELECT typname FROM pg_type
      WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    `);
    const typeNames = existingTypes.rows.map(r => r.typname);

    // Create missing enum types
    const enumTypes = [
      { name: 'product_type', values: ['goods', 'service'] },
      { name: 'quote_status', values: ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'] },
      { name: 'sales_order_status', values: ['draft', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'] },
      { name: 'credit_note_status', values: ['draft', 'issued', 'applied', 'cancelled'] },
      { name: 'bill_status', values: ['draft', 'pending', 'paid', 'partially_paid', 'overdue', 'cancelled'] },
      { name: 'purchase_order_status', values: ['draft', 'issued', 'acknowledged', 'received', 'cancelled'] },
      { name: 'debit_note_status', values: ['draft', 'issued', 'applied', 'cancelled'] },
      { name: 'bank_reconciliation_status', values: ['in_progress', 'completed'] },
      { name: 'invoice_status', values: ['draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled', 'void'] },
      { name: 'expense_status', values: ['pending', 'approved', 'rejected', 'paid'] },
    ];

    for (const enumType of enumTypes) {
      if (!typeNames.includes(enumType.name)) {
        const values = enumType.values.map(v => `'${v}'`).join(', ');
        await client.query(`CREATE TYPE "${enumType.name}" AS ENUM (${values})`);
        console.log(`Created enum type: ${enumType.name}`);
      }
    }

    // Check existing tables
    const existingTables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    const tableNames = existingTables.rows.map(r => r.table_name);

    // Create products table
    if (!tableNames.includes('products')) {
      await client.query(`
        CREATE TABLE "products" (
          "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "company_id" varchar(36) NOT NULL REFERENCES companies(id),
          "code" varchar(50),
          "name" varchar(255) NOT NULL,
          "description" text,
          "type" product_type DEFAULT 'goods' NOT NULL,
          "unit" varchar(20) DEFAULT 'Nos',
          "hsn_sac_code" varchar(20),
          "gst_rate" numeric(5, 2) DEFAULT '18',
          "purchase_price" numeric(18, 2) DEFAULT '0',
          "sales_price" numeric(18, 2) DEFAULT '0',
          "opening_stock" numeric(18, 4) DEFAULT '0',
          "current_stock" numeric(18, 4) DEFAULT '0',
          "reorder_level" numeric(18, 4),
          "purchase_account_id" varchar(36) REFERENCES chart_of_accounts(id),
          "sales_account_id" varchar(36) REFERENCES chart_of_accounts(id),
          "is_active" boolean DEFAULT true,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        )
      `);
      console.log('Created table: products');
    }

    // Create invoices table
    if (!tableNames.includes('invoices')) {
      await client.query(`
        CREATE TABLE "invoices" (
          "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "company_id" varchar(36) NOT NULL REFERENCES companies(id),
          "fiscal_year_id" varchar(36) NOT NULL REFERENCES fiscal_years(id),
          "invoice_number" varchar(50) NOT NULL,
          "invoice_date" date NOT NULL,
          "due_date" date NOT NULL,
          "customer_id" varchar(36) NOT NULL REFERENCES parties(id),
          "billing_address" text,
          "shipping_address" text,
          "subtotal" numeric(18, 2) DEFAULT '0' NOT NULL,
          "discount_amount" numeric(18, 2) DEFAULT '0',
          "tax_amount" numeric(18, 2) DEFAULT '0',
          "total_amount" numeric(18, 2) NOT NULL,
          "paid_amount" numeric(18, 2) DEFAULT '0',
          "balance_due" numeric(18, 2) NOT NULL,
          "cgst" numeric(18, 2) DEFAULT '0',
          "sgst" numeric(18, 2) DEFAULT '0',
          "igst" numeric(18, 2) DEFAULT '0',
          "status" invoice_status DEFAULT 'draft' NOT NULL,
          "notes" text,
          "terms" text,
          "journal_entry_id" varchar(36) REFERENCES journal_entries(id),
          "quote_id" varchar(36),
          "sales_order_id" varchar(36),
          "created_by_user_id" varchar(36) REFERENCES users(id),
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        )
      `);
      console.log('Created table: invoices');
    }

    // Create invoice_lines table
    if (!tableNames.includes('invoice_lines')) {
      await client.query(`
        CREATE TABLE "invoice_lines" (
          "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "invoice_id" varchar(36) NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
          "product_id" varchar(36) REFERENCES products(id),
          "description" text NOT NULL,
          "hsn_sac_code" varchar(20),
          "quantity" numeric(18, 4) DEFAULT '1' NOT NULL,
          "unit" varchar(20),
          "unit_price" numeric(18, 2) NOT NULL,
          "discount_percent" numeric(5, 2) DEFAULT '0',
          "discount_amount" numeric(18, 2) DEFAULT '0',
          "tax_rate" numeric(5, 2) DEFAULT '0',
          "tax_amount" numeric(18, 2) DEFAULT '0',
          "amount" numeric(18, 2) NOT NULL,
          "sort_order" integer DEFAULT 0
        )
      `);
      console.log('Created table: invoice_lines');
    }

    // Create expenses table
    if (!tableNames.includes('expenses')) {
      await client.query(`
        CREATE TABLE "expenses" (
          "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "company_id" varchar(36) NOT NULL REFERENCES companies(id),
          "fiscal_year_id" varchar(36) NOT NULL REFERENCES fiscal_years(id),
          "expense_number" varchar(50),
          "expense_date" date NOT NULL,
          "vendor_id" varchar(36) REFERENCES parties(id),
          "account_id" varchar(36) REFERENCES chart_of_accounts(id),
          "amount" numeric(18, 2) NOT NULL,
          "tax_amount" numeric(18, 2) DEFAULT '0',
          "total_amount" numeric(18, 2) NOT NULL,
          "cgst" numeric(18, 2) DEFAULT '0',
          "sgst" numeric(18, 2) DEFAULT '0',
          "igst" numeric(18, 2) DEFAULT '0',
          "description" text,
          "reference" varchar(100),
          "status" expense_status DEFAULT 'pending' NOT NULL,
          "approved_by_user_id" varchar(36) REFERENCES users(id),
          "approved_at" timestamp,
          "journal_entry_id" varchar(36) REFERENCES journal_entries(id),
          "bank_account_id" varchar(36) REFERENCES bank_accounts(id),
          "payment_method" varchar(50),
          "created_by_user_id" varchar(36) REFERENCES users(id),
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        )
      `);
      console.log('Created table: expenses');
    }

    // Create quotes table
    if (!tableNames.includes('quotes')) {
      await client.query(`
        CREATE TABLE "quotes" (
          "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "company_id" varchar(36) NOT NULL REFERENCES companies(id),
          "fiscal_year_id" varchar(36) NOT NULL REFERENCES fiscal_years(id),
          "quote_number" varchar(50) NOT NULL,
          "quote_date" date NOT NULL,
          "valid_until" date,
          "customer_id" varchar(36) NOT NULL REFERENCES parties(id),
          "billing_address" text,
          "shipping_address" text,
          "subtotal" numeric(18, 2) DEFAULT '0' NOT NULL,
          "discount_amount" numeric(18, 2) DEFAULT '0',
          "tax_amount" numeric(18, 2) DEFAULT '0',
          "total_amount" numeric(18, 2) NOT NULL,
          "cgst" numeric(18, 2) DEFAULT '0',
          "sgst" numeric(18, 2) DEFAULT '0',
          "igst" numeric(18, 2) DEFAULT '0',
          "status" quote_status DEFAULT 'draft' NOT NULL,
          "notes" text,
          "terms" text,
          "converted_to_invoice_id" varchar(36),
          "converted_to_order_id" varchar(36),
          "created_by_user_id" varchar(36) REFERENCES users(id),
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        )
      `);
      console.log('Created table: quotes');
    }

    // Create quote_lines table
    if (!tableNames.includes('quote_lines')) {
      await client.query(`
        CREATE TABLE "quote_lines" (
          "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "quote_id" varchar(36) NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
          "product_id" varchar(36) REFERENCES products(id),
          "description" text NOT NULL,
          "hsn_sac_code" varchar(20),
          "quantity" numeric(18, 4) DEFAULT '1' NOT NULL,
          "unit" varchar(20),
          "unit_price" numeric(18, 2) NOT NULL,
          "discount_percent" numeric(5, 2) DEFAULT '0',
          "discount_amount" numeric(18, 2) DEFAULT '0',
          "tax_rate" numeric(5, 2) DEFAULT '0',
          "tax_amount" numeric(18, 2) DEFAULT '0',
          "amount" numeric(18, 2) NOT NULL,
          "sort_order" integer DEFAULT 0
        )
      `);
      console.log('Created table: quote_lines');
    }

    // Create sales_orders table
    if (!tableNames.includes('sales_orders')) {
      await client.query(`
        CREATE TABLE "sales_orders" (
          "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "company_id" varchar(36) NOT NULL REFERENCES companies(id),
          "fiscal_year_id" varchar(36) NOT NULL REFERENCES fiscal_years(id),
          "order_number" varchar(50) NOT NULL,
          "order_date" date NOT NULL,
          "expected_delivery_date" date,
          "customer_id" varchar(36) NOT NULL REFERENCES parties(id),
          "quote_id" varchar(36) REFERENCES quotes(id),
          "billing_address" text,
          "shipping_address" text,
          "subtotal" numeric(18, 2) DEFAULT '0' NOT NULL,
          "discount_amount" numeric(18, 2) DEFAULT '0',
          "tax_amount" numeric(18, 2) DEFAULT '0',
          "total_amount" numeric(18, 2) NOT NULL,
          "cgst" numeric(18, 2) DEFAULT '0',
          "sgst" numeric(18, 2) DEFAULT '0',
          "igst" numeric(18, 2) DEFAULT '0',
          "status" sales_order_status DEFAULT 'draft' NOT NULL,
          "notes" text,
          "converted_to_invoice_id" varchar(36),
          "created_by_user_id" varchar(36) REFERENCES users(id),
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        )
      `);
      console.log('Created table: sales_orders');
    }

    // Create sales_order_lines table
    if (!tableNames.includes('sales_order_lines')) {
      await client.query(`
        CREATE TABLE "sales_order_lines" (
          "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "sales_order_id" varchar(36) NOT NULL REFERENCES sales_orders(id) ON DELETE CASCADE,
          "product_id" varchar(36) REFERENCES products(id),
          "description" text NOT NULL,
          "hsn_sac_code" varchar(20),
          "quantity" numeric(18, 4) DEFAULT '1' NOT NULL,
          "unit" varchar(20),
          "unit_price" numeric(18, 2) NOT NULL,
          "discount_percent" numeric(5, 2) DEFAULT '0',
          "discount_amount" numeric(18, 2) DEFAULT '0',
          "tax_rate" numeric(5, 2) DEFAULT '0',
          "tax_amount" numeric(18, 2) DEFAULT '0',
          "amount" numeric(18, 2) NOT NULL,
          "sort_order" integer DEFAULT 0
        )
      `);
      console.log('Created table: sales_order_lines');
    }

    // Create credit_notes table
    if (!tableNames.includes('credit_notes')) {
      await client.query(`
        CREATE TABLE "credit_notes" (
          "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "company_id" varchar(36) NOT NULL REFERENCES companies(id),
          "fiscal_year_id" varchar(36) NOT NULL REFERENCES fiscal_years(id),
          "credit_note_number" varchar(50) NOT NULL,
          "credit_note_date" date NOT NULL,
          "customer_id" varchar(36) NOT NULL REFERENCES parties(id),
          "original_invoice_id" varchar(36) REFERENCES invoices(id),
          "reason" text,
          "subtotal" numeric(18, 2) DEFAULT '0' NOT NULL,
          "tax_amount" numeric(18, 2) DEFAULT '0',
          "total_amount" numeric(18, 2) NOT NULL,
          "cgst" numeric(18, 2) DEFAULT '0',
          "sgst" numeric(18, 2) DEFAULT '0',
          "igst" numeric(18, 2) DEFAULT '0',
          "status" credit_note_status DEFAULT 'draft' NOT NULL,
          "applied_to_invoice_id" varchar(36) REFERENCES invoices(id),
          "journal_entry_id" varchar(36) REFERENCES journal_entries(id),
          "notes" text,
          "created_by_user_id" varchar(36) REFERENCES users(id),
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        )
      `);
      console.log('Created table: credit_notes');
    }

    // Create credit_note_lines table
    if (!tableNames.includes('credit_note_lines')) {
      await client.query(`
        CREATE TABLE "credit_note_lines" (
          "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "credit_note_id" varchar(36) NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
          "product_id" varchar(36) REFERENCES products(id),
          "description" text NOT NULL,
          "hsn_sac_code" varchar(20),
          "quantity" numeric(18, 4) DEFAULT '1' NOT NULL,
          "unit" varchar(20),
          "unit_price" numeric(18, 2) NOT NULL,
          "tax_rate" numeric(5, 2) DEFAULT '0',
          "tax_amount" numeric(18, 2) DEFAULT '0',
          "amount" numeric(18, 2) NOT NULL,
          "sort_order" integer DEFAULT 0
        )
      `);
      console.log('Created table: credit_note_lines');
    }

    // Create bills table
    if (!tableNames.includes('bills')) {
      await client.query(`
        CREATE TABLE "bills" (
          "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "company_id" varchar(36) NOT NULL REFERENCES companies(id),
          "fiscal_year_id" varchar(36) NOT NULL REFERENCES fiscal_years(id),
          "bill_number" varchar(50) NOT NULL,
          "vendor_bill_number" varchar(100),
          "bill_date" date NOT NULL,
          "due_date" date NOT NULL,
          "vendor_id" varchar(36) NOT NULL REFERENCES parties(id),
          "subtotal" numeric(18, 2) DEFAULT '0' NOT NULL,
          "tax_amount" numeric(18, 2) DEFAULT '0',
          "total_amount" numeric(18, 2) NOT NULL,
          "paid_amount" numeric(18, 2) DEFAULT '0',
          "balance_due" numeric(18, 2) NOT NULL,
          "cgst" numeric(18, 2) DEFAULT '0',
          "sgst" numeric(18, 2) DEFAULT '0',
          "igst" numeric(18, 2) DEFAULT '0',
          "status" bill_status DEFAULT 'draft' NOT NULL,
          "journal_entry_id" varchar(36) REFERENCES journal_entries(id),
          "notes" text,
          "created_by_user_id" varchar(36) REFERENCES users(id),
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        )
      `);
      console.log('Created table: bills');
    }

    // Create bill_lines table
    if (!tableNames.includes('bill_lines')) {
      await client.query(`
        CREATE TABLE "bill_lines" (
          "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "bill_id" varchar(36) NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
          "product_id" varchar(36) REFERENCES products(id),
          "account_id" varchar(36) REFERENCES chart_of_accounts(id),
          "description" text NOT NULL,
          "hsn_sac_code" varchar(20),
          "quantity" numeric(18, 4) DEFAULT '1' NOT NULL,
          "unit_price" numeric(18, 2) NOT NULL,
          "tax_rate" numeric(5, 2) DEFAULT '0',
          "tax_amount" numeric(18, 2) DEFAULT '0',
          "amount" numeric(18, 2) NOT NULL,
          "sort_order" integer DEFAULT 0
        )
      `);
      console.log('Created table: bill_lines');
    }

    // Create purchase_orders table
    if (!tableNames.includes('purchase_orders')) {
      await client.query(`
        CREATE TABLE "purchase_orders" (
          "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "company_id" varchar(36) NOT NULL REFERENCES companies(id),
          "fiscal_year_id" varchar(36) NOT NULL REFERENCES fiscal_years(id),
          "order_number" varchar(50) NOT NULL,
          "order_date" date NOT NULL,
          "expected_date" date,
          "vendor_id" varchar(36) NOT NULL REFERENCES parties(id),
          "subtotal" numeric(18, 2) DEFAULT '0' NOT NULL,
          "tax_amount" numeric(18, 2) DEFAULT '0',
          "total_amount" numeric(18, 2) NOT NULL,
          "cgst" numeric(18, 2) DEFAULT '0',
          "sgst" numeric(18, 2) DEFAULT '0',
          "igst" numeric(18, 2) DEFAULT '0',
          "status" purchase_order_status DEFAULT 'draft' NOT NULL,
          "converted_to_bill_id" varchar(36),
          "notes" text,
          "created_by_user_id" varchar(36) REFERENCES users(id),
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        )
      `);
      console.log('Created table: purchase_orders');
    }

    // Create purchase_order_lines table
    if (!tableNames.includes('purchase_order_lines')) {
      await client.query(`
        CREATE TABLE "purchase_order_lines" (
          "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "purchase_order_id" varchar(36) NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
          "product_id" varchar(36) REFERENCES products(id),
          "description" text NOT NULL,
          "hsn_sac_code" varchar(20),
          "quantity" numeric(18, 4) DEFAULT '1' NOT NULL,
          "unit" varchar(20),
          "unit_price" numeric(18, 2) NOT NULL,
          "tax_rate" numeric(5, 2) DEFAULT '0',
          "tax_amount" numeric(18, 2) DEFAULT '0',
          "amount" numeric(18, 2) NOT NULL,
          "sort_order" integer DEFAULT 0
        )
      `);
      console.log('Created table: purchase_order_lines');
    }

    // Create debit_notes table
    if (!tableNames.includes('debit_notes')) {
      await client.query(`
        CREATE TABLE "debit_notes" (
          "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "company_id" varchar(36) NOT NULL REFERENCES companies(id),
          "fiscal_year_id" varchar(36) NOT NULL REFERENCES fiscal_years(id),
          "debit_note_number" varchar(50) NOT NULL,
          "debit_note_date" date NOT NULL,
          "vendor_id" varchar(36) NOT NULL REFERENCES parties(id),
          "original_bill_id" varchar(36) REFERENCES bills(id),
          "reason" text,
          "subtotal" numeric(18, 2) DEFAULT '0' NOT NULL,
          "tax_amount" numeric(18, 2) DEFAULT '0',
          "total_amount" numeric(18, 2) NOT NULL,
          "cgst" numeric(18, 2) DEFAULT '0',
          "sgst" numeric(18, 2) DEFAULT '0',
          "igst" numeric(18, 2) DEFAULT '0',
          "status" debit_note_status DEFAULT 'draft' NOT NULL,
          "applied_to_bill_id" varchar(36) REFERENCES bills(id),
          "journal_entry_id" varchar(36) REFERENCES journal_entries(id),
          "notes" text,
          "created_by_user_id" varchar(36) REFERENCES users(id),
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        )
      `);
      console.log('Created table: debit_notes');
    }

    // Create debit_note_lines table
    if (!tableNames.includes('debit_note_lines')) {
      await client.query(`
        CREATE TABLE "debit_note_lines" (
          "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "debit_note_id" varchar(36) NOT NULL REFERENCES debit_notes(id) ON DELETE CASCADE,
          "product_id" varchar(36) REFERENCES products(id),
          "description" text NOT NULL,
          "hsn_sac_code" varchar(20),
          "quantity" numeric(18, 4) DEFAULT '1' NOT NULL,
          "unit" varchar(20),
          "unit_price" numeric(18, 2) NOT NULL,
          "tax_rate" numeric(5, 2) DEFAULT '0',
          "tax_amount" numeric(18, 2) DEFAULT '0',
          "amount" numeric(18, 2) NOT NULL,
          "sort_order" integer DEFAULT 0
        )
      `);
      console.log('Created table: debit_note_lines');
    }

    // Create payments_received table
    if (!tableNames.includes('payments_received')) {
      await client.query(`
        CREATE TABLE "payments_received" (
          "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "company_id" varchar(36) NOT NULL REFERENCES companies(id),
          "fiscal_year_id" varchar(36) NOT NULL REFERENCES fiscal_years(id),
          "payment_number" varchar(50) NOT NULL,
          "payment_date" date NOT NULL,
          "customer_id" varchar(36) NOT NULL REFERENCES parties(id),
          "amount" numeric(18, 2) NOT NULL,
          "payment_method" varchar(50),
          "reference_number" varchar(100),
          "bank_account_id" varchar(36) REFERENCES bank_accounts(id),
          "notes" text,
          "journal_entry_id" varchar(36) REFERENCES journal_entries(id),
          "created_by_user_id" varchar(36) REFERENCES users(id),
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        )
      `);
      console.log('Created table: payments_received');
    }

    // Create payment_allocations table
    if (!tableNames.includes('payment_allocations')) {
      await client.query(`
        CREATE TABLE "payment_allocations" (
          "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "payment_received_id" varchar(36) NOT NULL REFERENCES payments_received(id) ON DELETE CASCADE,
          "invoice_id" varchar(36) NOT NULL REFERENCES invoices(id),
          "amount" numeric(18, 2) NOT NULL,
          "created_at" timestamp DEFAULT now() NOT NULL
        )
      `);
      console.log('Created table: payment_allocations');
    }

    // Create payments_made table
    if (!tableNames.includes('payments_made')) {
      await client.query(`
        CREATE TABLE "payments_made" (
          "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "company_id" varchar(36) NOT NULL REFERENCES companies(id),
          "fiscal_year_id" varchar(36) NOT NULL REFERENCES fiscal_years(id),
          "payment_number" varchar(50) NOT NULL,
          "payment_date" date NOT NULL,
          "vendor_id" varchar(36) NOT NULL REFERENCES parties(id),
          "amount" numeric(18, 2) NOT NULL,
          "payment_method" varchar(50),
          "reference_number" varchar(100),
          "bank_account_id" varchar(36) REFERENCES bank_accounts(id),
          "notes" text,
          "journal_entry_id" varchar(36) REFERENCES journal_entries(id),
          "created_by_user_id" varchar(36) REFERENCES users(id),
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        )
      `);
      console.log('Created table: payments_made');
    }

    // Create payment_made_allocations table
    if (!tableNames.includes('payment_made_allocations')) {
      await client.query(`
        CREATE TABLE "payment_made_allocations" (
          "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "payment_made_id" varchar(36) NOT NULL REFERENCES payments_made(id) ON DELETE CASCADE,
          "bill_id" varchar(36) NOT NULL REFERENCES bills(id),
          "amount" numeric(18, 2) NOT NULL,
          "created_at" timestamp DEFAULT now() NOT NULL
        )
      `);
      console.log('Created table: payment_made_allocations');
    }

    // Create bank_reconciliations table
    if (!tableNames.includes('bank_reconciliations')) {
      await client.query(`
        CREATE TABLE "bank_reconciliations" (
          "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "company_id" varchar(36) NOT NULL REFERENCES companies(id),
          "bank_account_id" varchar(36) NOT NULL REFERENCES bank_accounts(id),
          "statement_date" date NOT NULL,
          "opening_balance" numeric(18, 2) DEFAULT '0',
          "closing_balance" numeric(18, 2) DEFAULT '0',
          "status" bank_reconciliation_status DEFAULT 'in_progress' NOT NULL,
          "reconciled_by_user_id" varchar(36) REFERENCES users(id),
          "reconciled_at" timestamp,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        )
      `);
      console.log('Created table: bank_reconciliations');
    }

    // Create bank_reconciliation_lines table
    if (!tableNames.includes('bank_reconciliation_lines')) {
      await client.query(`
        CREATE TABLE "bank_reconciliation_lines" (
          "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "reconciliation_id" varchar(36) NOT NULL REFERENCES bank_reconciliations(id) ON DELETE CASCADE,
          "transaction_date" date NOT NULL,
          "description" text,
          "reference" varchar(100),
          "debit" numeric(18, 2) DEFAULT '0',
          "credit" numeric(18, 2) DEFAULT '0',
          "journal_entry_id" varchar(36) REFERENCES journal_entries(id),
          "is_reconciled" boolean DEFAULT false,
          "reconciled_at" timestamp
        )
      `);
      console.log('Created table: bank_reconciliation_lines');
    }

    // Create user_invitations table
    if (!tableNames.includes('user_invitations')) {
      await client.query(`
        CREATE TABLE "user_invitations" (
          "id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "company_id" varchar(36) NOT NULL REFERENCES companies(id),
          "email" varchar(255) NOT NULL,
          "role" varchar(50) DEFAULT 'user' NOT NULL,
          "token" varchar(255) NOT NULL,
          "expires_at" timestamp NOT NULL,
          "invited_by_user_id" varchar(36) REFERENCES users(id),
          "accepted_at" timestamp,
          "created_at" timestamp DEFAULT now() NOT NULL,
          "updated_at" timestamp DEFAULT now() NOT NULL
        )
      `);
      console.log('Created table: user_invitations');
    }

    // Create indexes
    console.log('Creating indexes...');

    // Products index
    await client.query(`CREATE INDEX IF NOT EXISTS "products_company_id_idx" ON "products" ("company_id")`).catch(() => {});

    // Quotes indexes
    await client.query(`CREATE INDEX IF NOT EXISTS "quotes_company_id_idx" ON "quotes" ("company_id")`).catch(() => {});
    await client.query(`CREATE INDEX IF NOT EXISTS "quotes_customer_id_idx" ON "quotes" ("customer_id")`).catch(() => {});

    // Sales orders indexes
    await client.query(`CREATE INDEX IF NOT EXISTS "sales_orders_company_id_idx" ON "sales_orders" ("company_id")`).catch(() => {});
    await client.query(`CREATE INDEX IF NOT EXISTS "sales_orders_customer_id_idx" ON "sales_orders" ("customer_id")`).catch(() => {});

    // Invoices indexes
    await client.query(`CREATE INDEX IF NOT EXISTS "invoices_company_id_idx" ON "invoices" ("company_id")`).catch(() => {});
    await client.query(`CREATE INDEX IF NOT EXISTS "invoices_customer_id_idx" ON "invoices" ("customer_id")`).catch(() => {});
    await client.query(`CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices" ("status")`).catch(() => {});

    // Bills indexes
    await client.query(`CREATE INDEX IF NOT EXISTS "bills_company_id_idx" ON "bills" ("company_id")`).catch(() => {});
    await client.query(`CREATE INDEX IF NOT EXISTS "bills_vendor_id_idx" ON "bills" ("vendor_id")`).catch(() => {});

    // Purchase orders indexes
    await client.query(`CREATE INDEX IF NOT EXISTS "purchase_orders_company_id_idx" ON "purchase_orders" ("company_id")`).catch(() => {});
    await client.query(`CREATE INDEX IF NOT EXISTS "purchase_orders_vendor_id_idx" ON "purchase_orders" ("vendor_id")`).catch(() => {});

    // Payments indexes
    await client.query(`CREATE INDEX IF NOT EXISTS "payments_received_company_id_idx" ON "payments_received" ("company_id")`).catch(() => {});
    await client.query(`CREATE INDEX IF NOT EXISTS "payments_received_customer_id_idx" ON "payments_received" ("customer_id")`).catch(() => {});
    await client.query(`CREATE INDEX IF NOT EXISTS "payments_made_company_id_idx" ON "payments_made" ("company_id")`).catch(() => {});
    await client.query(`CREATE INDEX IF NOT EXISTS "payments_made_vendor_id_idx" ON "payments_made" ("vendor_id")`).catch(() => {});

    console.log('All missing tables and indexes created successfully!');

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(console.error);
