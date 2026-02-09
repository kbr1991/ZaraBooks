CREATE TYPE "public"."account_type" AS ENUM('asset', 'liability', 'equity', 'income', 'expense');--> statement-breakpoint
CREATE TYPE "public"."balance_type" AS ENUM('debit', 'credit');--> statement-breakpoint
CREATE TYPE "public"."bank_reconciliation_status" AS ENUM('in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."bill_status" AS ENUM('draft', 'pending', 'paid', 'partially_paid', 'overdue', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."challan_status" AS ENUM('pending', 'paid', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."company_role" AS ENUM('owner', 'accountant', 'auditor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."credit_note_status" AS ENUM('draft', 'issued', 'applied', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."debit_note_status" AS ENUM('draft', 'issued', 'applied', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."expense_status" AS ENUM('pending', 'approved', 'rejected', 'paid');--> statement-breakpoint
CREATE TYPE "public"."frequency" AS ENUM('daily', 'weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly');--> statement-breakpoint
CREATE TYPE "public"."gaap_standard" AS ENUM('INDIA_GAAP', 'US_GAAP', 'IFRS');--> statement-breakpoint
CREATE TYPE "public"."gst_filing_status" AS ENUM('pending', 'filed', 'filed_with_late_fee');--> statement-breakpoint
CREATE TYPE "public"."gst_registration_type" AS ENUM('regular', 'composition', 'unregistered', 'consumer', 'overseas', 'sez');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled', 'void');--> statement-breakpoint
CREATE TYPE "public"."invoice_type_gst" AS ENUM('B2B', 'B2C', 'B2CL', 'B2CS', 'CDNR', 'CDNUR', 'EXP', 'EXPWP', 'EXPWOP', 'NIL', 'AT', 'TXP');--> statement-breakpoint
CREATE TYPE "public"."journal_entry_status" AS ENUM('draft', 'posted', 'reversed', 'pending_approval');--> statement-breakpoint
CREATE TYPE "public"."journal_entry_type" AS ENUM('manual', 'auto_invoice', 'auto_payment', 'auto_expense', 'recurring', 'reversal', 'bank_import', 'opening');--> statement-breakpoint
CREATE TYPE "public"."party_type" AS ENUM('customer', 'vendor', 'employee');--> statement-breakpoint
CREATE TYPE "public"."product_type" AS ENUM('goods', 'service');--> statement-breakpoint
CREATE TYPE "public"."purchase_order_status" AS ENUM('draft', 'issued', 'acknowledged', 'received', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted');--> statement-breakpoint
CREATE TYPE "public"."reconciliation_status" AS ENUM('matched', 'mismatch', 'not_in_2a', 'excess_in_2a', 'pending');--> statement-breakpoint
CREATE TYPE "public"."sales_order_status" AS ENUM('draft', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."statement_type" AS ENUM('balance_sheet', 'profit_loss', 'cash_flow', 'changes_in_equity');--> statement-breakpoint
CREATE TYPE "public"."tds_section_code" AS ENUM('192', '193', '194', '194A', '194B', '194BB', '194C', '194D', '194DA', '194E', '194EE', '194F', '194G', '194H', '194I', '194IA', '194IB', '194IC', '194J', '194K', '194LA', '194LB', '194LC', '194LD', '194M', '194N', '194O', '194P', '194Q', '194R', '194S', '195', '196A', '196B', '196C', '196D');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('super_admin', 'admin', 'user');--> statement-breakpoint
CREATE TABLE "ai_conversations" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"session_id" varchar(36) NOT NULL,
	"message_type" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"context_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(36) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_url" varchar(500) NOT NULL,
	"file_size" integer,
	"mime_type" varchar(100),
	"uploaded_by_user_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"user_id" varchar(36),
	"action" varchar(50) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" varchar(36),
	"old_data" jsonb,
	"new_data" jsonb,
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"account_id" varchar(36),
	"bank_name" varchar(255) NOT NULL,
	"account_number" varchar(50) NOT NULL,
	"account_type" varchar(50),
	"ifsc_code" varchar(11),
	"branch_name" varchar(255),
	"branch_address" text,
	"opening_balance" numeric(18, 2) DEFAULT '0',
	"current_balance" numeric(18, 2) DEFAULT '0',
	"is_active" boolean DEFAULT true,
	"is_primary" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_reconciliation_lines" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reconciliation_id" varchar(36) NOT NULL,
	"transaction_date" date NOT NULL,
	"description" text,
	"reference" varchar(100),
	"debit" numeric(18, 2) DEFAULT '0',
	"credit" numeric(18, 2) DEFAULT '0',
	"journal_entry_id" varchar(36),
	"is_reconciled" boolean DEFAULT false,
	"reconciled_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "bank_reconciliations" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"bank_account_id" varchar(36) NOT NULL,
	"statement_date" date NOT NULL,
	"opening_balance" numeric(18, 2) DEFAULT '0',
	"closing_balance" numeric(18, 2) DEFAULT '0',
	"status" "bank_reconciliation_status" DEFAULT 'in_progress' NOT NULL,
	"reconciled_by_user_id" varchar(36),
	"reconciled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bill_lines" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bill_id" varchar(36) NOT NULL,
	"product_id" varchar(36),
	"account_id" varchar(36),
	"description" text NOT NULL,
	"hsn_sac_code" varchar(20),
	"quantity" numeric(18, 4) DEFAULT '1' NOT NULL,
	"unit_price" numeric(18, 2) NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0',
	"tax_amount" numeric(18, 2) DEFAULT '0',
	"amount" numeric(18, 2) NOT NULL,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"fiscal_year_id" varchar(36) NOT NULL,
	"bill_number" varchar(50) NOT NULL,
	"vendor_bill_number" varchar(100),
	"bill_date" date NOT NULL,
	"due_date" date NOT NULL,
	"vendor_id" varchar(36) NOT NULL,
	"subtotal" numeric(18, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(18, 2) DEFAULT '0',
	"total_amount" numeric(18, 2) NOT NULL,
	"paid_amount" numeric(18, 2) DEFAULT '0',
	"balance_due" numeric(18, 2) NOT NULL,
	"cgst" numeric(18, 2) DEFAULT '0',
	"sgst" numeric(18, 2) DEFAULT '0',
	"igst" numeric(18, 2) DEFAULT '0',
	"status" "bill_status" DEFAULT 'draft' NOT NULL,
	"journal_entry_id" varchar(36),
	"notes" text,
	"created_by_user_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chart_of_accounts" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"account_type" "account_type" NOT NULL,
	"parent_account_id" varchar(36),
	"level" integer DEFAULT 1 NOT NULL,
	"is_group" boolean DEFAULT false,
	"schedule_iii_mapping" varchar(100),
	"opening_balance" numeric(18, 2) DEFAULT '0',
	"opening_balance_type" "balance_type",
	"gst_applicable" boolean DEFAULT false,
	"default_gst_rate" numeric(5, 2),
	"hsn_sac_code" varchar(20),
	"is_active" boolean DEFAULT true NOT NULL,
	"is_system" boolean DEFAULT false,
	"custom_fields" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coa_templates" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"gaap_standard" "gaap_standard" NOT NULL,
	"description" text,
	"template_data" jsonb NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"legal_name" varchar(255),
	"company_type" varchar(50),
	"pan" varchar(10),
	"gstin" varchar(15),
	"tan" varchar(10),
	"cin" varchar(25),
	"address" text,
	"city" varchar(100),
	"state" varchar(100),
	"state_code" varchar(2),
	"pincode" varchar(10),
	"country" varchar(100) DEFAULT 'India',
	"fiscal_year_start" integer DEFAULT 4,
	"gaap_standard" "gaap_standard" DEFAULT 'INDIA_GAAP',
	"base_currency" varchar(3) DEFAULT 'INR',
	"logo_url" varchar(500),
	"pm_client_id" varchar(36),
	"created_by_user_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "companies_pan_unique" UNIQUE("pan")
);
--> statement-breakpoint
CREATE TABLE "company_users" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"role" "company_role" DEFAULT 'viewer' NOT NULL,
	"permissions" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_centers" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"parent_cost_center_id" varchar(36),
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_note_lines" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credit_note_id" varchar(36) NOT NULL,
	"product_id" varchar(36),
	"account_id" varchar(36),
	"description" text NOT NULL,
	"hsn_sac_code" varchar(20),
	"quantity" numeric(18, 4) DEFAULT '1' NOT NULL,
	"unit_price" numeric(18, 2) NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0',
	"tax_amount" numeric(18, 2) DEFAULT '0',
	"amount" numeric(18, 2) NOT NULL,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "credit_notes" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"fiscal_year_id" varchar(36) NOT NULL,
	"credit_note_number" varchar(50) NOT NULL,
	"credit_note_date" date NOT NULL,
	"customer_id" varchar(36) NOT NULL,
	"original_invoice_id" varchar(36),
	"reason" text,
	"subtotal" numeric(18, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(18, 2) DEFAULT '0',
	"total_amount" numeric(18, 2) NOT NULL,
	"cgst" numeric(18, 2) DEFAULT '0',
	"sgst" numeric(18, 2) DEFAULT '0',
	"igst" numeric(18, 2) DEFAULT '0',
	"status" "credit_note_status" DEFAULT 'draft' NOT NULL,
	"applied_to_invoice_id" varchar(36),
	"journal_entry_id" varchar(36),
	"notes" text,
	"created_by_user_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "currencies" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(3) NOT NULL,
	"name" varchar(100) NOT NULL,
	"symbol" varchar(10) NOT NULL,
	"decimal_places" integer DEFAULT 2,
	"is_active" boolean DEFAULT true,
	CONSTRAINT "currencies_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "debit_note_lines" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debit_note_id" varchar(36) NOT NULL,
	"product_id" varchar(36),
	"account_id" varchar(36),
	"description" text NOT NULL,
	"hsn_sac_code" varchar(20),
	"quantity" numeric(18, 4) DEFAULT '1' NOT NULL,
	"unit_price" numeric(18, 2) NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0',
	"tax_amount" numeric(18, 2) DEFAULT '0',
	"amount" numeric(18, 2) NOT NULL,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "debit_notes" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"fiscal_year_id" varchar(36) NOT NULL,
	"debit_note_number" varchar(50) NOT NULL,
	"debit_note_date" date NOT NULL,
	"vendor_id" varchar(36) NOT NULL,
	"original_bill_id" varchar(36),
	"reason" text,
	"subtotal" numeric(18, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(18, 2) DEFAULT '0',
	"total_amount" numeric(18, 2) NOT NULL,
	"cgst" numeric(18, 2) DEFAULT '0',
	"sgst" numeric(18, 2) DEFAULT '0',
	"igst" numeric(18, 2) DEFAULT '0',
	"status" "debit_note_status" DEFAULT 'draft' NOT NULL,
	"applied_to_bill_id" varchar(36),
	"journal_entry_id" varchar(36),
	"notes" text,
	"created_by_user_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"from_currency" varchar(3) NOT NULL,
	"to_currency" varchar(3) NOT NULL,
	"rate" numeric(18, 6) NOT NULL,
	"effective_date" date NOT NULL,
	"source" varchar(50) DEFAULT 'manual',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"fiscal_year_id" varchar(36) NOT NULL,
	"expense_number" varchar(50) NOT NULL,
	"expense_date" date NOT NULL,
	"vendor_id" varchar(36),
	"account_id" varchar(36) NOT NULL,
	"payment_account_id" varchar(36),
	"category" varchar(100),
	"amount" numeric(18, 2) NOT NULL,
	"tax_amount" numeric(18, 2) DEFAULT '0',
	"total_amount" numeric(18, 2) NOT NULL,
	"payment_method" varchar(50),
	"reference_number" varchar(100),
	"status" "expense_status" DEFAULT 'pending' NOT NULL,
	"approved_by_user_id" varchar(36),
	"approved_at" timestamp,
	"journal_entry_id" varchar(36),
	"description" text,
	"notes" text,
	"receipt_url" varchar(500),
	"created_by_user_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_statement_runs" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"fiscal_year_id" varchar(36) NOT NULL,
	"statement_type" "statement_type" NOT NULL,
	"as_of_date" date NOT NULL,
	"generated_data" jsonb NOT NULL,
	"excel_file_url" varchar(500),
	"pdf_file_url" varchar(500),
	"generated_by_user_id" varchar(36),
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fiscal_years" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"name" varchar(50) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"is_locked" boolean DEFAULT false,
	"locked_by_user_id" varchar(36),
	"locked_at" timestamp,
	"is_current" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "form_26as_entries" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"pan" varchar(10) NOT NULL,
	"assessment_year" varchar(10) NOT NULL,
	"quarter" varchar(5),
	"deductor_tan" varchar(10) NOT NULL,
	"deductor_name" varchar(255),
	"section_code" varchar(10),
	"transaction_date" date,
	"amount_paid" numeric(18, 2),
	"tds_deposited" numeric(18, 2),
	"tds_credit" numeric(18, 2),
	"matched_tds_receipt_id" varchar(36),
	"downloaded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gst_config" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"gstin" varchar(15) NOT NULL,
	"legal_name" varchar(255),
	"trade_name" varchar(255),
	"state_code" varchar(2),
	"registration_type" "gst_registration_type" DEFAULT 'regular',
	"filing_frequency" varchar(20) DEFAULT 'monthly',
	"einvoice_enabled" boolean DEFAULT false,
	"einvoice_threshold" numeric(18, 2),
	"ewaybill_enabled" boolean DEFAULT false,
	"api_credentials" text,
	"is_primary" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gst_payments" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"gst_config_id" varchar(36),
	"return_period" varchar(10) NOT NULL,
	"payment_type" varchar(50) NOT NULL,
	"liability_amount" numeric(18, 2) DEFAULT '0',
	"itc_utilized" numeric(18, 2) DEFAULT '0',
	"cash_paid" numeric(18, 2) DEFAULT '0',
	"challan_number" varchar(50),
	"cpin" varchar(50),
	"cin" varchar(50),
	"payment_date" date,
	"journal_entry_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gstr1_entries" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"gst_config_id" varchar(36),
	"return_period" varchar(10) NOT NULL,
	"invoice_id" varchar(36),
	"invoice_number" varchar(100) NOT NULL,
	"invoice_date" date NOT NULL,
	"invoice_type" "invoice_type_gst" NOT NULL,
	"party_gstin" varchar(15),
	"party_name" varchar(255),
	"place_of_supply" varchar(100),
	"hsn_sac_code" varchar(20),
	"taxable_value" numeric(18, 2) NOT NULL,
	"igst" numeric(18, 2) DEFAULT '0',
	"cgst" numeric(18, 2) DEFAULT '0',
	"sgst" numeric(18, 2) DEFAULT '0',
	"cess" numeric(18, 2) DEFAULT '0',
	"invoice_value" numeric(18, 2) NOT NULL,
	"irn" varchar(100),
	"irn_date" date,
	"ack_number" varchar(50),
	"ack_date" timestamp,
	"signed_invoice" text,
	"signed_qr_code" text,
	"ewaybill_number" varchar(20),
	"ewaybill_date" date,
	"filing_status" "gst_filing_status" DEFAULT 'pending',
	"source" varchar(50) DEFAULT 'manual',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gstr3b_summary" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"gst_config_id" varchar(36),
	"return_period" varchar(10) NOT NULL,
	"outward_taxable" numeric(18, 2) DEFAULT '0',
	"outward_igst" numeric(18, 2) DEFAULT '0',
	"outward_cgst" numeric(18, 2) DEFAULT '0',
	"outward_sgst" numeric(18, 2) DEFAULT '0',
	"outward_cess" numeric(18, 2) DEFAULT '0',
	"inter_state_taxable" numeric(18, 2) DEFAULT '0',
	"inter_state_igst" numeric(18, 2) DEFAULT '0',
	"itc_igst" numeric(18, 2) DEFAULT '0',
	"itc_cgst" numeric(18, 2) DEFAULT '0',
	"itc_sgst" numeric(18, 2) DEFAULT '0',
	"itc_cess" numeric(18, 2) DEFAULT '0',
	"exempt_inter_state" numeric(18, 2) DEFAULT '0',
	"exempt_intra_state" numeric(18, 2) DEFAULT '0',
	"payable_igst" numeric(18, 2) DEFAULT '0',
	"payable_cgst" numeric(18, 2) DEFAULT '0',
	"payable_sgst" numeric(18, 2) DEFAULT '0',
	"payable_cess" numeric(18, 2) DEFAULT '0',
	"interest" numeric(18, 2) DEFAULT '0',
	"late_fee" numeric(18, 2) DEFAULT '0',
	"filing_status" "gst_filing_status" DEFAULT 'pending',
	"arn_number" varchar(50),
	"filing_date" date,
	"computed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hsn_sac_master" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(20) NOT NULL,
	"description" text NOT NULL,
	"type" varchar(10) NOT NULL,
	"gst_rate" numeric(5, 2),
	"is_active" boolean DEFAULT true,
	CONSTRAINT "hsn_sac_master_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar(36) NOT NULL,
	"account_id" varchar(36),
	"description" text NOT NULL,
	"hsn_sac_code" varchar(20),
	"quantity" numeric(18, 4) DEFAULT '1' NOT NULL,
	"unit_price" numeric(18, 2) NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0',
	"discount_amount" numeric(18, 2) DEFAULT '0',
	"tax_rate" numeric(5, 2) DEFAULT '0',
	"tax_amount" numeric(18, 2) DEFAULT '0',
	"amount" numeric(18, 2) NOT NULL,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"fiscal_year_id" varchar(36) NOT NULL,
	"invoice_number" varchar(50) NOT NULL,
	"invoice_date" date NOT NULL,
	"due_date" date NOT NULL,
	"customer_id" varchar(36) NOT NULL,
	"billing_address" text,
	"shipping_address" text,
	"subtotal" numeric(18, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(18, 2) DEFAULT '0',
	"discount_percent" numeric(5, 2),
	"tax_amount" numeric(18, 2) DEFAULT '0',
	"total_amount" numeric(18, 2) NOT NULL,
	"paid_amount" numeric(18, 2) DEFAULT '0',
	"balance_due" numeric(18, 2) NOT NULL,
	"cgst" numeric(18, 2) DEFAULT '0',
	"sgst" numeric(18, 2) DEFAULT '0',
	"igst" numeric(18, 2) DEFAULT '0',
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"journal_entry_id" varchar(36),
	"notes" text,
	"terms" text,
	"created_by_user_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "itc_register" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"gst_config_id" varchar(36),
	"return_period" varchar(10) NOT NULL,
	"vendor_gstin" varchar(15) NOT NULL,
	"vendor_name" varchar(255),
	"invoice_number" varchar(100) NOT NULL,
	"invoice_date" date NOT NULL,
	"invoice_value" numeric(18, 2),
	"taxable_value" numeric(18, 2),
	"igst" numeric(18, 2) DEFAULT '0',
	"cgst" numeric(18, 2) DEFAULT '0',
	"sgst" numeric(18, 2) DEFAULT '0',
	"cess" numeric(18, 2) DEFAULT '0',
	"eligible_itc" numeric(18, 2) DEFAULT '0',
	"ineligible_itc" numeric(18, 2) DEFAULT '0',
	"reversal_amount" numeric(18, 2) DEFAULT '0',
	"reversal_reason" text,
	"reconciliation_status" "reconciliation_status" DEFAULT 'pending',
	"gstr2a_data" jsonb,
	"matched_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"fiscal_year_id" varchar(36) NOT NULL,
	"entry_number" varchar(50) NOT NULL,
	"entry_date" date NOT NULL,
	"posting_date" date,
	"entry_type" "journal_entry_type" DEFAULT 'manual' NOT NULL,
	"narration" text,
	"total_debit" numeric(18, 2) DEFAULT '0' NOT NULL,
	"total_credit" numeric(18, 2) DEFAULT '0' NOT NULL,
	"source_type" varchar(50),
	"source_id" varchar(36),
	"status" "journal_entry_status" DEFAULT 'draft' NOT NULL,
	"approved_by_user_id" varchar(36),
	"approved_at" timestamp,
	"reversed_entry_id" varchar(36),
	"is_reversed" boolean DEFAULT false,
	"attachments" jsonb,
	"created_by_user_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entry_lines" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journal_entry_id" varchar(36) NOT NULL,
	"account_id" varchar(36) NOT NULL,
	"debit_amount" numeric(18, 2) DEFAULT '0',
	"credit_amount" numeric(18, 2) DEFAULT '0',
	"currency_code" varchar(3),
	"exchange_rate" numeric(18, 6),
	"debit_amount_fcy" numeric(18, 2),
	"credit_amount_fcy" numeric(18, 2),
	"party_type" "party_type",
	"party_id" varchar(36),
	"cost_center_id" varchar(36),
	"description" text,
	"gst_details" jsonb,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "parties" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"party_type" "party_type" NOT NULL,
	"name" varchar(255) NOT NULL,
	"legal_name" varchar(255),
	"code" varchar(50),
	"pan" varchar(10),
	"gstin" varchar(15),
	"gst_registration_type" "gst_registration_type" DEFAULT 'regular',
	"email" varchar(255),
	"phone" varchar(20),
	"address" text,
	"city" varchar(100),
	"state" varchar(100),
	"state_code" varchar(2),
	"pincode" varchar(10),
	"country" varchar(100) DEFAULT 'India',
	"default_account_id" varchar(36),
	"credit_days" integer DEFAULT 30,
	"credit_limit" numeric(18, 2),
	"tds_applicable" boolean DEFAULT false,
	"default_tds_section" "tds_section_code",
	"opening_balance" numeric(18, 2) DEFAULT '0',
	"opening_balance_type" "balance_type",
	"current_balance" numeric(18, 2) DEFAULT '0',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_received_id" varchar(36) NOT NULL,
	"invoice_id" varchar(36) NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_made_allocations" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_made_id" varchar(36) NOT NULL,
	"bill_id" varchar(36) NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments_made" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"fiscal_year_id" varchar(36) NOT NULL,
	"payment_number" varchar(50) NOT NULL,
	"payment_date" date NOT NULL,
	"vendor_id" varchar(36) NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"payment_method" varchar(50),
	"reference_number" varchar(100),
	"bank_account_id" varchar(36),
	"notes" text,
	"journal_entry_id" varchar(36),
	"created_by_user_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments_received" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"fiscal_year_id" varchar(36) NOT NULL,
	"payment_number" varchar(50) NOT NULL,
	"payment_date" date NOT NULL,
	"customer_id" varchar(36) NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"payment_method" varchar(50),
	"reference_number" varchar(100),
	"bank_account_id" varchar(36),
	"notes" text,
	"journal_entry_id" varchar(36),
	"created_by_user_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pm_integration_config" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"pm_base_url" varchar(255),
	"api_key" text,
	"sync_enabled" boolean DEFAULT false,
	"auto_sync_invoices" boolean DEFAULT true,
	"auto_sync_payments" boolean DEFAULT true,
	"auto_sync_expenses" boolean DEFAULT true,
	"default_revenue_account_id" varchar(36),
	"default_bank_account_id" varchar(36),
	"default_expense_account_id" varchar(36),
	"default_receivable_account_id" varchar(36),
	"last_sync_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pm_integration_config_company_id_unique" UNIQUE("company_id")
);
--> statement-breakpoint
CREATE TABLE "pm_sync_log" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"pm_entity_id" varchar(36) NOT NULL,
	"zarabooks_entry_id" varchar(36),
	"sync_direction" varchar(10) NOT NULL,
	"sync_status" varchar(20) NOT NULL,
	"error_message" text,
	"request_payload" jsonb,
	"response_payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"code" varchar(50),
	"name" varchar(255) NOT NULL,
	"description" text,
	"type" "product_type" DEFAULT 'goods' NOT NULL,
	"unit" varchar(20) DEFAULT 'nos',
	"hsn_sac_code" varchar(20),
	"gst_rate" numeric(5, 2) DEFAULT '18',
	"purchase_price" numeric(18, 2),
	"sales_price" numeric(18, 2),
	"opening_stock" numeric(18, 4) DEFAULT '0',
	"current_stock" numeric(18, 4) DEFAULT '0',
	"reorder_level" numeric(18, 4),
	"purchase_account_id" varchar(36),
	"sales_account_id" varchar(36),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_order_lines" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" varchar(36) NOT NULL,
	"product_id" varchar(36),
	"description" text NOT NULL,
	"hsn_sac_code" varchar(20),
	"quantity" numeric(18, 4) DEFAULT '1' NOT NULL,
	"unit_price" numeric(18, 2) NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0',
	"tax_amount" numeric(18, 2) DEFAULT '0',
	"amount" numeric(18, 2) NOT NULL,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"fiscal_year_id" varchar(36) NOT NULL,
	"order_number" varchar(50) NOT NULL,
	"order_date" date NOT NULL,
	"expected_date" date,
	"vendor_id" varchar(36) NOT NULL,
	"subtotal" numeric(18, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(18, 2) DEFAULT '0',
	"total_amount" numeric(18, 2) NOT NULL,
	"cgst" numeric(18, 2) DEFAULT '0',
	"sgst" numeric(18, 2) DEFAULT '0',
	"igst" numeric(18, 2) DEFAULT '0',
	"status" "purchase_order_status" DEFAULT 'draft' NOT NULL,
	"converted_to_bill_id" varchar(36),
	"notes" text,
	"created_by_user_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_lines" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" varchar(36) NOT NULL,
	"product_id" varchar(36),
	"description" text NOT NULL,
	"hsn_sac_code" varchar(20),
	"quantity" numeric(18, 4) DEFAULT '1' NOT NULL,
	"unit_price" numeric(18, 2) NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0',
	"discount_amount" numeric(18, 2) DEFAULT '0',
	"tax_rate" numeric(5, 2) DEFAULT '0',
	"tax_amount" numeric(18, 2) DEFAULT '0',
	"amount" numeric(18, 2) NOT NULL,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"fiscal_year_id" varchar(36) NOT NULL,
	"quote_number" varchar(50) NOT NULL,
	"quote_date" date NOT NULL,
	"valid_until" date NOT NULL,
	"customer_id" varchar(36) NOT NULL,
	"billing_address" text,
	"shipping_address" text,
	"subtotal" numeric(18, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(18, 2) DEFAULT '0',
	"tax_amount" numeric(18, 2) DEFAULT '0',
	"total_amount" numeric(18, 2) NOT NULL,
	"cgst" numeric(18, 2) DEFAULT '0',
	"sgst" numeric(18, 2) DEFAULT '0',
	"igst" numeric(18, 2) DEFAULT '0',
	"status" "quote_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"terms" text,
	"converted_to_invoice_id" varchar(36),
	"converted_to_order_id" varchar(36),
	"created_by_user_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_entry_templates" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"name" varchar(255) NOT NULL,
	"narration" text,
	"frequency" "frequency" NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"next_run_date" date,
	"template_lines" jsonb NOT NULL,
	"is_active" boolean DEFAULT true,
	"last_run_at" timestamp,
	"created_by_user_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_order_lines" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sales_order_id" varchar(36) NOT NULL,
	"product_id" varchar(36),
	"description" text NOT NULL,
	"hsn_sac_code" varchar(20),
	"quantity" numeric(18, 4) DEFAULT '1' NOT NULL,
	"unit_price" numeric(18, 2) NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0',
	"discount_amount" numeric(18, 2) DEFAULT '0',
	"tax_rate" numeric(5, 2) DEFAULT '0',
	"tax_amount" numeric(18, 2) DEFAULT '0',
	"amount" numeric(18, 2) NOT NULL,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "sales_orders" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"fiscal_year_id" varchar(36) NOT NULL,
	"order_number" varchar(50) NOT NULL,
	"order_date" date NOT NULL,
	"expected_delivery_date" date,
	"customer_id" varchar(36) NOT NULL,
	"quote_id" varchar(36),
	"billing_address" text,
	"shipping_address" text,
	"subtotal" numeric(18, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(18, 2) DEFAULT '0',
	"tax_amount" numeric(18, 2) DEFAULT '0',
	"total_amount" numeric(18, 2) NOT NULL,
	"cgst" numeric(18, 2) DEFAULT '0',
	"sgst" numeric(18, 2) DEFAULT '0',
	"igst" numeric(18, 2) DEFAULT '0',
	"status" "sales_order_status" DEFAULT 'draft' NOT NULL,
	"converted_to_invoice_id" varchar(36),
	"notes" text,
	"created_by_user_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_iii_mappings" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gaap_standard" "gaap_standard" NOT NULL,
	"line_item_code" varchar(100) NOT NULL,
	"line_item_name" varchar(500) NOT NULL,
	"parent_line_item_id" varchar(36),
	"display_order" integer DEFAULT 0,
	"calculation_formula" jsonb,
	"has_sub_schedule" boolean DEFAULT false,
	"statement_type" "statement_type" NOT NULL,
	"indent_level" integer DEFAULT 0,
	"is_bold" boolean DEFAULT false,
	"is_total" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar(255) PRIMARY KEY NOT NULL,
	"sess" text NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tds_challans" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"challan_type" varchar(10) NOT NULL,
	"assessment_year" varchar(10) NOT NULL,
	"period_from" date NOT NULL,
	"period_to" date NOT NULL,
	"section_code" varchar(10),
	"bsr_code" varchar(10),
	"challan_serial" varchar(10),
	"amount" numeric(18, 2) NOT NULL,
	"surcharge" numeric(18, 2) DEFAULT '0',
	"education_cess" numeric(18, 2) DEFAULT '0',
	"interest" numeric(18, 2) DEFAULT '0',
	"penalty" numeric(18, 2) DEFAULT '0',
	"total_amount" numeric(18, 2) NOT NULL,
	"payment_date" date,
	"cin" varchar(50),
	"status" "challan_status" DEFAULT 'pending',
	"verified_on_traces" boolean DEFAULT false,
	"verified_at" timestamp,
	"journal_entry_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tds_deductions" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"deductee_pan" varchar(10) NOT NULL,
	"deductee_name" varchar(255) NOT NULL,
	"section_code" varchar(10) NOT NULL,
	"transaction_date" date NOT NULL,
	"payment_date" date,
	"base_amount" numeric(18, 2) NOT NULL,
	"tds_rate" numeric(5, 2) NOT NULL,
	"tds_amount" numeric(18, 2) NOT NULL,
	"surcharge" numeric(18, 2) DEFAULT '0',
	"education_cess" numeric(18, 2) DEFAULT '0',
	"total_tds" numeric(18, 2) NOT NULL,
	"invoice_reference" varchar(100),
	"journal_entry_id" varchar(36),
	"challan_id" varchar(36),
	"certificate_number" varchar(50),
	"certificate_date" date,
	"assessment_year" varchar(10),
	"quarter" varchar(5),
	"party_id" varchar(36),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tds_sections" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"section_code" varchar(10) NOT NULL,
	"description" text NOT NULL,
	"default_rate_individual" numeric(5, 2),
	"default_rate_company" numeric(5, 2),
	"threshold_limit" numeric(18, 2),
	"no_tds_reason" text,
	"is_active" boolean DEFAULT true,
	CONSTRAINT "tds_sections_section_code_unique" UNIQUE("section_code")
);
--> statement-breakpoint
CREATE TABLE "trial_balance_cache" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"fiscal_year_id" varchar(36) NOT NULL,
	"as_of_date" date NOT NULL,
	"account_id" varchar(36) NOT NULL,
	"opening_debit" numeric(18, 2) DEFAULT '0',
	"opening_credit" numeric(18, 2) DEFAULT '0',
	"period_debit" numeric(18, 2) DEFAULT '0',
	"period_credit" numeric(18, 2) DEFAULT '0',
	"closing_debit" numeric(18, 2) DEFAULT '0',
	"closing_credit" numeric(18, 2) DEFAULT '0',
	"computed_at" timestamp DEFAULT now() NOT NULL,
	"is_stale" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "user_invitations" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" varchar(36) NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" "company_role" DEFAULT 'viewer' NOT NULL,
	"token" varchar(100) NOT NULL,
	"invited_by_user_id" varchar(36) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100),
	"phone" varchar(20),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"profile_image_url" varchar(500),
	"is_active" boolean DEFAULT true NOT NULL,
	"email_verified" boolean DEFAULT false,
	"last_login" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_reconciliation_lines" ADD CONSTRAINT "bank_reconciliation_lines_reconciliation_id_bank_reconciliations_id_fk" FOREIGN KEY ("reconciliation_id") REFERENCES "public"."bank_reconciliations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_reconciliation_lines" ADD CONSTRAINT "bank_reconciliation_lines_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_reconciled_by_user_id_users_id_fk" FOREIGN KEY ("reconciled_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_vendor_id_parties_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_users" ADD CONSTRAINT "company_users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_users" ADD CONSTRAINT "company_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_centers" ADD CONSTRAINT "cost_centers_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_credit_note_id_credit_notes_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "public"."credit_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_customer_id_parties_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_original_invoice_id_invoices_id_fk" FOREIGN KEY ("original_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_note_lines" ADD CONSTRAINT "debit_note_lines_debit_note_id_debit_notes_id_fk" FOREIGN KEY ("debit_note_id") REFERENCES "public"."debit_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_note_lines" ADD CONSTRAINT "debit_note_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_note_lines" ADD CONSTRAINT "debit_note_lines_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_vendor_id_parties_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_original_bill_id_bills_id_fk" FOREIGN KEY ("original_bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_vendor_id_parties_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_payment_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("payment_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_statement_runs" ADD CONSTRAINT "financial_statement_runs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_statement_runs" ADD CONSTRAINT "financial_statement_runs_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_statement_runs" ADD CONSTRAINT "financial_statement_runs_generated_by_user_id_users_id_fk" FOREIGN KEY ("generated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_years" ADD CONSTRAINT "fiscal_years_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fiscal_years" ADD CONSTRAINT "fiscal_years_locked_by_user_id_users_id_fk" FOREIGN KEY ("locked_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "form_26as_entries" ADD CONSTRAINT "form_26as_entries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gst_config" ADD CONSTRAINT "gst_config_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gst_payments" ADD CONSTRAINT "gst_payments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gst_payments" ADD CONSTRAINT "gst_payments_gst_config_id_gst_config_id_fk" FOREIGN KEY ("gst_config_id") REFERENCES "public"."gst_config"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gst_payments" ADD CONSTRAINT "gst_payments_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gstr1_entries" ADD CONSTRAINT "gstr1_entries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gstr1_entries" ADD CONSTRAINT "gstr1_entries_gst_config_id_gst_config_id_fk" FOREIGN KEY ("gst_config_id") REFERENCES "public"."gst_config"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gstr3b_summary" ADD CONSTRAINT "gstr3b_summary_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gstr3b_summary" ADD CONSTRAINT "gstr3b_summary_gst_config_id_gst_config_id_fk" FOREIGN KEY ("gst_config_id") REFERENCES "public"."gst_config"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_parties_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itc_register" ADD CONSTRAINT "itc_register_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "itc_register" ADD CONSTRAINT "itc_register_gst_config_id_gst_config_id_fk" FOREIGN KEY ("gst_config_id") REFERENCES "public"."gst_config"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_cost_center_id_cost_centers_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "public"."cost_centers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parties" ADD CONSTRAINT "parties_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parties" ADD CONSTRAINT "parties_default_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("default_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_received_id_payments_received_id_fk" FOREIGN KEY ("payment_received_id") REFERENCES "public"."payments_received"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_made_allocations" ADD CONSTRAINT "payment_made_allocations_payment_made_id_payments_made_id_fk" FOREIGN KEY ("payment_made_id") REFERENCES "public"."payments_made"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_made_allocations" ADD CONSTRAINT "payment_made_allocations_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments_made" ADD CONSTRAINT "payments_made_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments_made" ADD CONSTRAINT "payments_made_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments_made" ADD CONSTRAINT "payments_made_vendor_id_parties_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments_made" ADD CONSTRAINT "payments_made_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments_made" ADD CONSTRAINT "payments_made_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments_made" ADD CONSTRAINT "payments_made_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments_received" ADD CONSTRAINT "payments_received_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments_received" ADD CONSTRAINT "payments_received_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments_received" ADD CONSTRAINT "payments_received_customer_id_parties_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments_received" ADD CONSTRAINT "payments_received_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments_received" ADD CONSTRAINT "payments_received_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments_received" ADD CONSTRAINT "payments_received_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm_integration_config" ADD CONSTRAINT "pm_integration_config_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm_integration_config" ADD CONSTRAINT "pm_integration_config_default_revenue_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("default_revenue_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm_integration_config" ADD CONSTRAINT "pm_integration_config_default_bank_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("default_bank_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm_integration_config" ADD CONSTRAINT "pm_integration_config_default_expense_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("default_expense_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm_integration_config" ADD CONSTRAINT "pm_integration_config_default_receivable_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("default_receivable_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pm_sync_log" ADD CONSTRAINT "pm_sync_log_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_purchase_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("purchase_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_sales_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("sales_account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_parties_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_customer_id_parties_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_entry_templates" ADD CONSTRAINT "recurring_entry_templates_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_entry_templates" ADD CONSTRAINT "recurring_entry_templates_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_sales_order_id_sales_orders_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "public"."sales_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_customer_id_parties_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tds_challans" ADD CONSTRAINT "tds_challans_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tds_challans" ADD CONSTRAINT "tds_challans_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tds_deductions" ADD CONSTRAINT "tds_deductions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tds_deductions" ADD CONSTRAINT "tds_deductions_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tds_deductions" ADD CONSTRAINT "tds_deductions_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "public"."parties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial_balance_cache" ADD CONSTRAINT "trial_balance_cache_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial_balance_cache" ADD CONSTRAINT "trial_balance_cache_fiscal_year_id_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."fiscal_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trial_balance_cache" ADD CONSTRAINT "trial_balance_cache_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitations" ADD CONSTRAINT "user_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ai_session" ON "ai_conversations" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_audit_company_date" ON "audit_log" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_bank_reconciliation_company" ON "bank_reconciliations" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_bank_reconciliation_account" ON "bank_reconciliations" USING btree ("bank_account_id");--> statement-breakpoint
CREATE INDEX "idx_bills_company" ON "bills" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_bills_vendor" ON "bills" USING btree ("vendor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_coa_company_code" ON "chart_of_accounts" USING btree ("company_id","code");--> statement-breakpoint
CREATE INDEX "idx_coa_parent" ON "chart_of_accounts" USING btree ("parent_account_id");--> statement-breakpoint
CREATE INDEX "idx_credit_notes_company" ON "credit_notes" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_credit_notes_customer" ON "credit_notes" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_debit_notes_company" ON "debit_notes" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_debit_notes_vendor" ON "debit_notes" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "idx_exchange_rate_date" ON "exchange_rates" USING btree ("company_id","from_currency","to_currency","effective_date");--> statement-breakpoint
CREATE INDEX "idx_expense_company" ON "expenses" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_expense_vendor" ON "expenses" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "idx_expense_date" ON "expenses" USING btree ("company_id","expense_date");--> statement-breakpoint
CREATE INDEX "idx_gstr1_company_period" ON "gstr1_entries" USING btree ("company_id","return_period");--> statement-breakpoint
CREATE INDEX "idx_invoice_company" ON "invoices" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_customer" ON "invoices" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_invoice_number" ON "invoices" USING btree ("company_id","invoice_number");--> statement-breakpoint
CREATE INDEX "idx_je_company_date" ON "journal_entries" USING btree ("company_id","entry_date");--> statement-breakpoint
CREATE INDEX "idx_je_fiscal_year" ON "journal_entries" USING btree ("fiscal_year_id");--> statement-breakpoint
CREATE INDEX "idx_je_entry_number" ON "journal_entries" USING btree ("company_id","entry_number");--> statement-breakpoint
CREATE INDEX "idx_jel_entry" ON "journal_entry_lines" USING btree ("journal_entry_id");--> statement-breakpoint
CREATE INDEX "idx_jel_account" ON "journal_entry_lines" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_payments_made_company" ON "payments_made" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_payments_made_vendor" ON "payments_made" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "idx_payments_received_company" ON "payments_received" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_payments_received_customer" ON "payments_received" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_products_company" ON "products" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_orders_company" ON "purchase_orders" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_purchase_orders_vendor" ON "purchase_orders" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "idx_quotes_company" ON "quotes" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_quotes_customer" ON "quotes" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_sales_orders_company" ON "sales_orders" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "idx_sales_orders_customer" ON "sales_orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "idx_tb_cache_company_date" ON "trial_balance_cache" USING btree ("company_id","as_of_date");--> statement-breakpoint
CREATE INDEX "idx_invitation_email" ON "user_invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_invitation_token" ON "user_invitations" USING btree ("token");