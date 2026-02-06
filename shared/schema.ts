import { sql, relations } from 'drizzle-orm';
import {
  pgTable,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  date,
  decimal,
  pgEnum,
  index,
  uniqueIndex,
  jsonb,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// ==================== ENUMS ====================

// User & Company Enums
export const userRoleEnum = pgEnum('user_role', ['super_admin', 'admin', 'user']);
export const companyRoleEnum = pgEnum('company_role', ['owner', 'accountant', 'auditor', 'viewer']);
export const gaapStandardEnum = pgEnum('gaap_standard', ['INDIA_GAAP', 'US_GAAP', 'IFRS']);

// Account Enums
export const accountTypeEnum = pgEnum('account_type', ['asset', 'liability', 'equity', 'income', 'expense']);
export const balanceTypeEnum = pgEnum('balance_type', ['debit', 'credit']);

// Journal Entry Enums
export const journalEntryTypeEnum = pgEnum('journal_entry_type', [
  'manual', 'auto_invoice', 'auto_payment', 'auto_expense', 'recurring', 'reversal', 'bank_import', 'opening'
]);
export const journalEntryStatusEnum = pgEnum('journal_entry_status', ['draft', 'posted', 'reversed', 'pending_approval']);
export const partyTypeEnum = pgEnum('party_type', ['customer', 'vendor', 'employee']);
export const frequencyEnum = pgEnum('frequency', ['daily', 'weekly', 'monthly', 'quarterly', 'half_yearly', 'yearly']);

// GST Enums
export const gstRegistrationTypeEnum = pgEnum('gst_registration_type', [
  'regular', 'composition', 'unregistered', 'consumer', 'overseas', 'sez'
]);
export const invoiceTypeGstEnum = pgEnum('invoice_type_gst', ['B2B', 'B2C', 'B2CL', 'B2CS', 'CDNR', 'CDNUR', 'EXP', 'EXPWP', 'EXPWOP', 'NIL', 'AT', 'TXP']);
export const gstFilingStatusEnum = pgEnum('gst_filing_status', ['pending', 'filed', 'filed_with_late_fee']);
export const reconciliationStatusEnum = pgEnum('reconciliation_status', ['matched', 'mismatch', 'not_in_2a', 'excess_in_2a', 'pending']);

// TDS Enums
export const tdsSectionCodeEnum = pgEnum('tds_section_code', [
  '192', '193', '194', '194A', '194B', '194BB', '194C', '194D', '194DA', '194E', '194EE',
  '194F', '194G', '194H', '194I', '194IA', '194IB', '194IC', '194J', '194K', '194LA',
  '194LB', '194LC', '194LD', '194M', '194N', '194O', '194P', '194Q', '194R', '194S', '195', '196A', '196B', '196C', '196D'
]);
export const challanStatusEnum = pgEnum('challan_status', ['pending', 'paid', 'verified', 'rejected']);

// Financial Statement Enums
export const statementTypeEnum = pgEnum('statement_type', ['balance_sheet', 'profit_loss', 'cash_flow', 'changes_in_equity']);

// ==================== SESSIONS ====================
export const sessions = pgTable(
  'sessions',
  {
    sid: varchar('sid', { length: 255 }).primaryKey(),
    sess: text('sess').notNull(),
    expire: timestamp('expire').notNull(),
  },
  (table) => [index('IDX_session_expire').on(table.expire)]
);

// ==================== USERS (Auth Service) ====================
export const users = pgTable('users', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  email: varchar('email', { length: 255 }).unique().notNull(),
  password: varchar('password', { length: 255 }).notNull(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }),
  phone: varchar('phone', { length: 20 }),
  role: userRoleEnum('role').default('user').notNull(),
  profileImageUrl: varchar('profile_image_url', { length: 500 }),
  isActive: boolean('is_active').default(true).notNull(),
  emailVerified: boolean('email_verified').default(false),
  lastLogin: timestamp('last_login'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== COMPANIES ====================
export const companies = pgTable('companies', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 255 }).notNull(),
  legalName: varchar('legal_name', { length: 255 }),
  companyType: varchar('company_type', { length: 50 }), // private_limited, llp, partnership, proprietorship, etc.
  // Indian Compliance Fields
  pan: varchar('pan', { length: 10 }).unique(),
  gstin: varchar('gstin', { length: 15 }),
  tan: varchar('tan', { length: 10 }),
  cin: varchar('cin', { length: 25 }),
  // Address
  address: text('address'),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  stateCode: varchar('state_code', { length: 2 }), // GST state code
  pincode: varchar('pincode', { length: 10 }),
  country: varchar('country', { length: 100 }).default('India'),
  // Fiscal Year Settings
  fiscalYearStart: integer('fiscal_year_start').default(4), // 1=Jan, 4=Apr
  gaapStandard: gaapStandardEnum('gaap_standard').default('INDIA_GAAP'),
  baseCurrency: varchar('base_currency', { length: 3 }).default('INR'),
  // Logo and branding
  logoUrl: varchar('logo_url', { length: 500 }),
  // Practice Manager Integration
  pmClientId: varchar('pm_client_id', { length: 36 }),
  createdByUserId: varchar('created_by_user_id', { length: 36 }).references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== COMPANY USERS ====================
export const companyUsers = pgTable('company_users', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar('company_id', { length: 36 }).references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar('user_id', { length: 36 }).references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: companyRoleEnum('role').default('viewer').notNull(),
  permissions: jsonb('permissions'), // Granular access control
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== FISCAL YEARS ====================
export const fiscalYears = pgTable('fiscal_years', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar('company_id', { length: 36 }).references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 50 }).notNull(), // e.g., "FY 2024-25"
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  isLocked: boolean('is_locked').default(false),
  lockedByUserId: varchar('locked_by_user_id', { length: 36 }).references(() => users.id),
  lockedAt: timestamp('locked_at'),
  isCurrent: boolean('is_current').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== COA TEMPLATES ====================
export const coaTemplates = pgTable('coa_templates', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: varchar('name', { length: 100 }).notNull(),
  gaapStandard: gaapStandardEnum('gaap_standard').notNull(),
  description: text('description'),
  templateData: jsonb('template_data').notNull(), // Full chart structure
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==================== CHART OF ACCOUNTS ====================
export const chartOfAccounts = pgTable('chart_of_accounts', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar('company_id', { length: 36 }).references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  code: varchar('code', { length: 20 }).notNull(), // e.g., 1001, 2001
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  accountType: accountTypeEnum('account_type').notNull(),
  parentAccountId: varchar('parent_account_id', { length: 36 }), // Self-reference for hierarchy
  level: integer('level').default(1).notNull(), // 1-5 levels
  isGroup: boolean('is_group').default(false), // True for parent accounts
  scheduleIIIMapping: varchar('schedule_iii_mapping', { length: 100 }), // Line item code
  openingBalance: decimal('opening_balance', { precision: 18, scale: 2 }).default('0'),
  openingBalanceType: balanceTypeEnum('opening_balance_type'),
  gstApplicable: boolean('gst_applicable').default(false),
  defaultGstRate: decimal('default_gst_rate', { precision: 5, scale: 2 }),
  hsnSacCode: varchar('hsn_sac_code', { length: 20 }),
  isActive: boolean('is_active').default(true).notNull(),
  isSystem: boolean('is_system').default(false), // Prevent deletion
  customFields: jsonb('custom_fields'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  uniqueIndex('idx_coa_company_code').on(table.companyId, table.code),
  index('idx_coa_parent').on(table.parentAccountId),
]);

// ==================== COST CENTERS ====================
export const costCenters = pgTable('cost_centers', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar('company_id', { length: 36 }).references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  code: varchar('code', { length: 20 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  parentCostCenterId: varchar('parent_cost_center_id', { length: 36 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== PARTIES (Customers/Vendors) ====================
export const parties = pgTable('parties', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar('company_id', { length: 36 }).references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  partyType: partyTypeEnum('party_type').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  legalName: varchar('legal_name', { length: 255 }),
  code: varchar('code', { length: 50 }),
  // Compliance fields
  pan: varchar('pan', { length: 10 }),
  gstin: varchar('gstin', { length: 15 }),
  gstRegistrationType: gstRegistrationTypeEnum('gst_registration_type').default('regular'),
  // Contact
  email: varchar('email', { length: 255 }),
  phone: varchar('phone', { length: 20 }),
  // Address
  address: text('address'),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 100 }),
  stateCode: varchar('state_code', { length: 2 }),
  pincode: varchar('pincode', { length: 10 }),
  country: varchar('country', { length: 100 }).default('India'),
  // Linked account
  defaultAccountId: varchar('default_account_id', { length: 36 }).references(() => chartOfAccounts.id),
  // Credit terms
  creditDays: integer('credit_days').default(30),
  creditLimit: decimal('credit_limit', { precision: 18, scale: 2 }),
  // TDS settings
  tdsApplicable: boolean('tds_applicable').default(false),
  defaultTdsSection: tdsSectionCodeEnum('default_tds_section'),
  // Balances
  openingBalance: decimal('opening_balance', { precision: 18, scale: 2 }).default('0'),
  openingBalanceType: balanceTypeEnum('opening_balance_type'),
  currentBalance: decimal('current_balance', { precision: 18, scale: 2 }).default('0'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== CURRENCIES ====================
export const currencies = pgTable('currencies', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  code: varchar('code', { length: 3 }).notNull().unique(), // ISO 4217 code
  name: varchar('name', { length: 100 }).notNull(),
  symbol: varchar('symbol', { length: 10 }).notNull(),
  decimalPlaces: integer('decimal_places').default(2),
  isActive: boolean('is_active').default(true),
});

// ==================== EXCHANGE RATES ====================
export const exchangeRates = pgTable('exchange_rates', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar('company_id', { length: 36 }).references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  fromCurrency: varchar('from_currency', { length: 3 }).notNull(),
  toCurrency: varchar('to_currency', { length: 3 }).notNull(),
  rate: decimal('rate', { precision: 18, scale: 6 }).notNull(),
  effectiveDate: date('effective_date').notNull(),
  source: varchar('source', { length: 50 }).default('manual'), // manual, api, bank
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_exchange_rate_date').on(table.companyId, table.fromCurrency, table.toCurrency, table.effectiveDate),
]);

// ==================== BANK ACCOUNTS ====================
export const bankAccounts = pgTable('bank_accounts', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar('company_id', { length: 36 }).references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  accountId: varchar('account_id', { length: 36 }).references(() => chartOfAccounts.id), // Linked CoA entry
  bankName: varchar('bank_name', { length: 255 }).notNull(),
  accountNumber: varchar('account_number', { length: 50 }).notNull(),
  accountType: varchar('account_type', { length: 50 }), // savings, current, etc.
  ifscCode: varchar('ifsc_code', { length: 11 }),
  branchName: varchar('branch_name', { length: 255 }),
  branchAddress: text('branch_address'),
  openingBalance: decimal('opening_balance', { precision: 18, scale: 2 }).default('0'),
  currentBalance: decimal('current_balance', { precision: 18, scale: 2 }).default('0'),
  isActive: boolean('is_active').default(true),
  isPrimary: boolean('is_primary').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== JOURNAL ENTRIES ====================
export const journalEntries = pgTable('journal_entries', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar('company_id', { length: 36 }).references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  fiscalYearId: varchar('fiscal_year_id', { length: 36 }).references(() => fiscalYears.id).notNull(),
  entryNumber: varchar('entry_number', { length: 50 }).notNull(), // Auto-generated: JV/2024-25/0001
  entryDate: date('entry_date').notNull(),
  postingDate: date('posting_date'),
  entryType: journalEntryTypeEnum('entry_type').default('manual').notNull(),
  narration: text('narration'),
  totalDebit: decimal('total_debit', { precision: 18, scale: 2 }).default('0').notNull(),
  totalCredit: decimal('total_credit', { precision: 18, scale: 2 }).default('0').notNull(),
  // Source tracking
  sourceType: varchar('source_type', { length: 50 }), // manual, practice_manager, bank_import
  sourceId: varchar('source_id', { length: 36 }), // Reference to source record
  status: journalEntryStatusEnum('status').default('draft').notNull(),
  approvedByUserId: varchar('approved_by_user_id', { length: 36 }).references(() => users.id),
  approvedAt: timestamp('approved_at'),
  // Reversal tracking
  reversedEntryId: varchar('reversed_entry_id', { length: 36 }),
  isReversed: boolean('is_reversed').default(false),
  // Attachments
  attachments: jsonb('attachments'), // Array of file URLs
  // Audit
  createdByUserId: varchar('created_by_user_id', { length: 36 }).references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_je_company_date').on(table.companyId, table.entryDate),
  index('idx_je_fiscal_year').on(table.fiscalYearId),
  index('idx_je_entry_number').on(table.companyId, table.entryNumber),
]);

// ==================== JOURNAL ENTRY LINES ====================
export const journalEntryLines = pgTable('journal_entry_lines', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  journalEntryId: varchar('journal_entry_id', { length: 36 }).references(() => journalEntries.id, { onDelete: 'cascade' }).notNull(),
  accountId: varchar('account_id', { length: 36 }).references(() => chartOfAccounts.id).notNull(),
  debitAmount: decimal('debit_amount', { precision: 18, scale: 2 }).default('0'),
  creditAmount: decimal('credit_amount', { precision: 18, scale: 2 }).default('0'),
  // Multi-currency support
  currencyCode: varchar('currency_code', { length: 3 }),
  exchangeRate: decimal('exchange_rate', { precision: 18, scale: 6 }),
  debitAmountFcy: decimal('debit_amount_fcy', { precision: 18, scale: 2 }), // Foreign currency amount
  creditAmountFcy: decimal('credit_amount_fcy', { precision: 18, scale: 2 }),
  partyType: partyTypeEnum('party_type'),
  partyId: varchar('party_id', { length: 36 }).references(() => parties.id),
  costCenterId: varchar('cost_center_id', { length: 36 }).references(() => costCenters.id),
  description: text('description'),
  // GST details
  gstDetails: jsonb('gst_details'), // { rate, hsnSac, taxAmount, cgst, sgst, igst }
  sortOrder: integer('sort_order').default(0),
}, (table) => [
  index('idx_jel_entry').on(table.journalEntryId),
  index('idx_jel_account').on(table.accountId),
]);

// ==================== RECURRING ENTRY TEMPLATES ====================
export const recurringEntryTemplates = pgTable('recurring_entry_templates', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar('company_id', { length: 36 }).references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  narration: text('narration'),
  frequency: frequencyEnum('frequency').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date'),
  nextRunDate: date('next_run_date'),
  templateLines: jsonb('template_lines').notNull(), // Array of line templates
  isActive: boolean('is_active').default(true),
  lastRunAt: timestamp('last_run_at'),
  createdByUserId: varchar('created_by_user_id', { length: 36 }).references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== TRIAL BALANCE CACHE ====================
export const trialBalanceCache = pgTable('trial_balance_cache', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar('company_id', { length: 36 }).references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  fiscalYearId: varchar('fiscal_year_id', { length: 36 }).references(() => fiscalYears.id).notNull(),
  asOfDate: date('as_of_date').notNull(),
  accountId: varchar('account_id', { length: 36 }).references(() => chartOfAccounts.id).notNull(),
  openingDebit: decimal('opening_debit', { precision: 18, scale: 2 }).default('0'),
  openingCredit: decimal('opening_credit', { precision: 18, scale: 2 }).default('0'),
  periodDebit: decimal('period_debit', { precision: 18, scale: 2 }).default('0'),
  periodCredit: decimal('period_credit', { precision: 18, scale: 2 }).default('0'),
  closingDebit: decimal('closing_debit', { precision: 18, scale: 2 }).default('0'),
  closingCredit: decimal('closing_credit', { precision: 18, scale: 2 }).default('0'),
  computedAt: timestamp('computed_at').defaultNow().notNull(),
  isStale: boolean('is_stale').default(false),
}, (table) => [
  index('idx_tb_cache_company_date').on(table.companyId, table.asOfDate),
]);

// ==================== SCHEDULE III MAPPINGS ====================
export const scheduleIIIMappings = pgTable('schedule_iii_mappings', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  gaapStandard: gaapStandardEnum('gaap_standard').notNull(),
  lineItemCode: varchar('line_item_code', { length: 100 }).notNull(), // e.g., BS_ASSET_NCA_PPE
  lineItemName: varchar('line_item_name', { length: 500 }).notNull(),
  parentLineItemId: varchar('parent_line_item_id', { length: 36 }),
  displayOrder: integer('display_order').default(0),
  calculationFormula: jsonb('calculation_formula'), // For computed items
  hasSubSchedule: boolean('has_sub_schedule').default(false),
  statementType: statementTypeEnum('statement_type').notNull(),
  indentLevel: integer('indent_level').default(0),
  isBold: boolean('is_bold').default(false),
  isTotal: boolean('is_total').default(false),
});

// ==================== FINANCIAL STATEMENT RUNS ====================
export const financialStatementRuns = pgTable('financial_statement_runs', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar('company_id', { length: 36 }).references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  fiscalYearId: varchar('fiscal_year_id', { length: 36 }).references(() => fiscalYears.id).notNull(),
  statementType: statementTypeEnum('statement_type').notNull(),
  asOfDate: date('as_of_date').notNull(),
  generatedData: jsonb('generated_data').notNull(), // Full statement JSON
  excelFileUrl: varchar('excel_file_url', { length: 500 }),
  pdfFileUrl: varchar('pdf_file_url', { length: 500 }),
  generatedByUserId: varchar('generated_by_user_id', { length: 36 }).references(() => users.id),
  generatedAt: timestamp('generated_at').defaultNow().notNull(),
});

// ==================== ATTACHMENTS ====================
export const attachments = pgTable('attachments', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar('company_id', { length: 36 }).references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(), // journal_entry, invoice, expense, etc.
  entityId: varchar('entity_id', { length: 36 }).notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileUrl: varchar('file_url', { length: 500 }).notNull(),
  fileSize: integer('file_size'),
  mimeType: varchar('mime_type', { length: 100 }),
  uploadedByUserId: varchar('uploaded_by_user_id', { length: 36 }).references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==================== AUDIT LOG ====================
export const auditLog = pgTable('audit_log', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar('company_id', { length: 36 }).references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar('user_id', { length: 36 }).references(() => users.id),
  action: varchar('action', { length: 50 }).notNull(), // create, update, delete, login, etc.
  entityType: varchar('entity_type', { length: 50 }).notNull(),
  entityId: varchar('entity_id', { length: 36 }),
  oldData: jsonb('old_data'),
  newData: jsonb('new_data'),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_audit_company_date').on(table.companyId, table.createdAt),
]);

// ==================== GST CONFIG ====================
export const gstConfig = pgTable('gst_config', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar('company_id', { length: 36 }).references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  gstin: varchar('gstin', { length: 15 }).notNull(),
  legalName: varchar('legal_name', { length: 255 }),
  tradeName: varchar('trade_name', { length: 255 }),
  stateCode: varchar('state_code', { length: 2 }),
  registrationType: gstRegistrationTypeEnum('registration_type').default('regular'),
  filingFrequency: varchar('filing_frequency', { length: 20 }).default('monthly'), // monthly, quarterly
  einvoiceEnabled: boolean('einvoice_enabled').default(false),
  einvoiceThreshold: decimal('einvoice_threshold', { precision: 18, scale: 2 }),
  ewaybillEnabled: boolean('ewaybill_enabled').default(false),
  apiCredentials: text('api_credentials'), // Encrypted JSON
  isPrimary: boolean('is_primary').default(false),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== GSTR-1 ENTRIES ====================
export const gstr1Entries = pgTable('gstr1_entries', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar('company_id', { length: 36 }).references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  gstConfigId: varchar('gst_config_id', { length: 36 }).references(() => gstConfig.id),
  returnPeriod: varchar('return_period', { length: 10 }).notNull(), // MMYYYY format
  invoiceId: varchar('invoice_id', { length: 36 }), // Reference if from invoice
  invoiceNumber: varchar('invoice_number', { length: 100 }).notNull(),
  invoiceDate: date('invoice_date').notNull(),
  invoiceType: invoiceTypeGstEnum('invoice_type').notNull(),
  partyGstin: varchar('party_gstin', { length: 15 }),
  partyName: varchar('party_name', { length: 255 }),
  placeOfSupply: varchar('place_of_supply', { length: 100 }),
  hsnSacCode: varchar('hsn_sac_code', { length: 20 }),
  taxableValue: decimal('taxable_value', { precision: 18, scale: 2 }).notNull(),
  igst: decimal('igst', { precision: 18, scale: 2 }).default('0'),
  cgst: decimal('cgst', { precision: 18, scale: 2 }).default('0'),
  sgst: decimal('sgst', { precision: 18, scale: 2 }).default('0'),
  cess: decimal('cess', { precision: 18, scale: 2 }).default('0'),
  invoiceValue: decimal('invoice_value', { precision: 18, scale: 2 }).notNull(),
  // E-Invoice fields
  irn: varchar('irn', { length: 100 }),
  irnDate: date('irn_date'),
  ackNumber: varchar('ack_number', { length: 50 }),
  ackDate: timestamp('ack_date'),
  signedInvoice: text('signed_invoice'),
  signedQrCode: text('signed_qr_code'),
  // E-Way Bill
  ewaybillNumber: varchar('ewaybill_number', { length: 20 }),
  ewaybillDate: date('ewaybill_date'),
  // Filing status
  filingStatus: gstFilingStatusEnum('filing_status').default('pending'),
  source: varchar('source', { length: 50 }).default('manual'), // manual, auto_pm, import
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_gstr1_company_period').on(table.companyId, table.returnPeriod),
]);

// ==================== GSTR-3B SUMMARY ====================
export const gstr3bSummary = pgTable('gstr3b_summary', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar('company_id', { length: 36 }).references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  gstConfigId: varchar('gst_config_id', { length: 36 }).references(() => gstConfig.id),
  returnPeriod: varchar('return_period', { length: 10 }).notNull(),
  // 3.1 Outward supplies
  outwardTaxable: decimal('outward_taxable', { precision: 18, scale: 2 }).default('0'),
  outwardIgst: decimal('outward_igst', { precision: 18, scale: 2 }).default('0'),
  outwardCgst: decimal('outward_cgst', { precision: 18, scale: 2 }).default('0'),
  outwardSgst: decimal('outward_sgst', { precision: 18, scale: 2 }).default('0'),
  outwardCess: decimal('outward_cess', { precision: 18, scale: 2 }).default('0'),
  // 3.2 Inter-state supplies
  interStateTaxable: decimal('inter_state_taxable', { precision: 18, scale: 2 }).default('0'),
  interStateIgst: decimal('inter_state_igst', { precision: 18, scale: 2 }).default('0'),
  // 4. Eligible ITC
  itcIgst: decimal('itc_igst', { precision: 18, scale: 2 }).default('0'),
  itcCgst: decimal('itc_cgst', { precision: 18, scale: 2 }).default('0'),
  itcSgst: decimal('itc_sgst', { precision: 18, scale: 2 }).default('0'),
  itcCess: decimal('itc_cess', { precision: 18, scale: 2 }).default('0'),
  // 5. Exempt/NIL/Non-GST
  exemptInterState: decimal('exempt_inter_state', { precision: 18, scale: 2 }).default('0'),
  exemptIntraState: decimal('exempt_intra_state', { precision: 18, scale: 2 }).default('0'),
  // 6. Payment of tax
  payableIgst: decimal('payable_igst', { precision: 18, scale: 2 }).default('0'),
  payableCgst: decimal('payable_cgst', { precision: 18, scale: 2 }).default('0'),
  payableSgst: decimal('payable_sgst', { precision: 18, scale: 2 }).default('0'),
  payableCess: decimal('payable_cess', { precision: 18, scale: 2 }).default('0'),
  // Interest & Late Fee
  interest: decimal('interest', { precision: 18, scale: 2 }).default('0'),
  lateFee: decimal('late_fee', { precision: 18, scale: 2 }).default('0'),
  // Filing details
  filingStatus: gstFilingStatusEnum('filing_status').default('pending'),
  arnNumber: varchar('arn_number', { length: 50 }),
  filingDate: date('filing_date'),
  computedAt: timestamp('computed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== ITC REGISTER ====================
export const itcRegister = pgTable('itc_register', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar('company_id', { length: 36 }).references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  gstConfigId: varchar('gst_config_id', { length: 36 }).references(() => gstConfig.id),
  returnPeriod: varchar('return_period', { length: 10 }).notNull(),
  vendorGstin: varchar('vendor_gstin', { length: 15 }).notNull(),
  vendorName: varchar('vendor_name', { length: 255 }),
  invoiceNumber: varchar('invoice_number', { length: 100 }).notNull(),
  invoiceDate: date('invoice_date').notNull(),
  invoiceValue: decimal('invoice_value', { precision: 18, scale: 2 }),
  taxableValue: decimal('taxable_value', { precision: 18, scale: 2 }),
  igst: decimal('igst', { precision: 18, scale: 2 }).default('0'),
  cgst: decimal('cgst', { precision: 18, scale: 2 }).default('0'),
  sgst: decimal('sgst', { precision: 18, scale: 2 }).default('0'),
  cess: decimal('cess', { precision: 18, scale: 2 }).default('0'),
  eligibleItc: decimal('eligible_itc', { precision: 18, scale: 2 }).default('0'),
  ineligibleItc: decimal('ineligible_itc', { precision: 18, scale: 2 }).default('0'),
  reversalAmount: decimal('reversal_amount', { precision: 18, scale: 2 }).default('0'),
  reversalReason: text('reversal_reason'),
  reconciliationStatus: reconciliationStatusEnum('reconciliation_status').default('pending'),
  gstr2aData: jsonb('gstr2a_data'), // Data from GST portal
  matchedAt: timestamp('matched_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== GST PAYMENTS ====================
export const gstPayments = pgTable('gst_payments', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar('company_id', { length: 36 }).references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  gstConfigId: varchar('gst_config_id', { length: 36 }).references(() => gstConfig.id),
  returnPeriod: varchar('return_period', { length: 10 }).notNull(),
  paymentType: varchar('payment_type', { length: 50 }).notNull(), // IGST, CGST, SGST, CESS, Interest, Penalty
  liabilityAmount: decimal('liability_amount', { precision: 18, scale: 2 }).default('0'),
  itcUtilized: decimal('itc_utilized', { precision: 18, scale: 2 }).default('0'),
  cashPaid: decimal('cash_paid', { precision: 18, scale: 2 }).default('0'),
  challanNumber: varchar('challan_number', { length: 50 }),
  cpin: varchar('cpin', { length: 50 }), // Common Portal Identification Number
  cin: varchar('cin', { length: 50 }), // Challan Identification Number
  paymentDate: date('payment_date'),
  journalEntryId: varchar('journal_entry_id', { length: 36 }).references(() => journalEntries.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== HSN/SAC MASTER ====================
export const hsnSacMaster = pgTable('hsn_sac_master', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  code: varchar('code', { length: 20 }).notNull().unique(),
  description: text('description').notNull(),
  type: varchar('type', { length: 10 }).notNull(), // HSN or SAC
  gstRate: decimal('gst_rate', { precision: 5, scale: 2 }),
  isActive: boolean('is_active').default(true),
});

// ==================== TDS SECTIONS ====================
export const tdsSections = pgTable('tds_sections', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  sectionCode: varchar('section_code', { length: 10 }).notNull().unique(),
  description: text('description').notNull(),
  defaultRateIndividual: decimal('default_rate_individual', { precision: 5, scale: 2 }),
  defaultRateCompany: decimal('default_rate_company', { precision: 5, scale: 2 }),
  thresholdLimit: decimal('threshold_limit', { precision: 18, scale: 2 }),
  noTdsReason: text('no_tds_reason'),
  isActive: boolean('is_active').default(true),
});

// ==================== TDS DEDUCTIONS ====================
export const tdsDeductions = pgTable('tds_deductions', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar('company_id', { length: 36 }).references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  deducteePan: varchar('deductee_pan', { length: 10 }).notNull(),
  deducteeName: varchar('deductee_name', { length: 255 }).notNull(),
  sectionCode: varchar('section_code', { length: 10 }).notNull(),
  transactionDate: date('transaction_date').notNull(),
  paymentDate: date('payment_date'),
  baseAmount: decimal('base_amount', { precision: 18, scale: 2 }).notNull(),
  tdsRate: decimal('tds_rate', { precision: 5, scale: 2 }).notNull(),
  tdsAmount: decimal('tds_amount', { precision: 18, scale: 2 }).notNull(),
  surcharge: decimal('surcharge', { precision: 18, scale: 2 }).default('0'),
  educationCess: decimal('education_cess', { precision: 18, scale: 2 }).default('0'),
  totalTds: decimal('total_tds', { precision: 18, scale: 2 }).notNull(),
  invoiceReference: varchar('invoice_reference', { length: 100 }),
  journalEntryId: varchar('journal_entry_id', { length: 36 }).references(() => journalEntries.id),
  challanId: varchar('challan_id', { length: 36 }),
  certificateNumber: varchar('certificate_number', { length: 50 }),
  certificateDate: date('certificate_date'),
  assessmentYear: varchar('assessment_year', { length: 10 }),
  quarter: varchar('quarter', { length: 5 }), // Q1, Q2, Q3, Q4
  partyId: varchar('party_id', { length: 36 }).references(() => parties.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== TDS CHALLANS ====================
export const tdsChallans = pgTable('tds_challans', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar('company_id', { length: 36 }).references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  challanType: varchar('challan_type', { length: 10 }).notNull(), // TDS, TCS
  assessmentYear: varchar('assessment_year', { length: 10 }).notNull(),
  periodFrom: date('period_from').notNull(),
  periodTo: date('period_to').notNull(),
  sectionCode: varchar('section_code', { length: 10 }),
  bsrCode: varchar('bsr_code', { length: 10 }),
  challanSerial: varchar('challan_serial', { length: 10 }),
  amount: decimal('amount', { precision: 18, scale: 2 }).notNull(),
  surcharge: decimal('surcharge', { precision: 18, scale: 2 }).default('0'),
  educationCess: decimal('education_cess', { precision: 18, scale: 2 }).default('0'),
  interest: decimal('interest', { precision: 18, scale: 2 }).default('0'),
  penalty: decimal('penalty', { precision: 18, scale: 2 }).default('0'),
  totalAmount: decimal('total_amount', { precision: 18, scale: 2 }).notNull(),
  paymentDate: date('payment_date'),
  cin: varchar('cin', { length: 50 }), // Challan Identification Number
  status: challanStatusEnum('status').default('pending'),
  verifiedOnTraces: boolean('verified_on_traces').default(false),
  verifiedAt: timestamp('verified_at'),
  journalEntryId: varchar('journal_entry_id', { length: 36 }).references(() => journalEntries.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== FORM 26AS ENTRIES ====================
export const form26asEntries = pgTable('form_26as_entries', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar('company_id', { length: 36 }).references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  pan: varchar('pan', { length: 10 }).notNull(),
  assessmentYear: varchar('assessment_year', { length: 10 }).notNull(),
  quarter: varchar('quarter', { length: 5 }), // Q1, Q2, Q3, Q4
  deductorTan: varchar('deductor_tan', { length: 10 }).notNull(),
  deductorName: varchar('deductor_name', { length: 255 }),
  sectionCode: varchar('section_code', { length: 10 }),
  transactionDate: date('transaction_date'),
  amountPaid: decimal('amount_paid', { precision: 18, scale: 2 }),
  tdsDeposited: decimal('tds_deposited', { precision: 18, scale: 2 }),
  tdsCredit: decimal('tds_credit', { precision: 18, scale: 2 }),
  matchedTdsReceiptId: varchar('matched_tds_receipt_id', { length: 36 }),
  downloadedAt: timestamp('downloaded_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==================== PM INTEGRATION CONFIG ====================
export const pmIntegrationConfig = pgTable('pm_integration_config', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar('company_id', { length: 36 }).references(() => companies.id, { onDelete: 'cascade' }).notNull().unique(),
  pmBaseUrl: varchar('pm_base_url', { length: 255 }),
  apiKey: text('api_key'), // Encrypted
  syncEnabled: boolean('sync_enabled').default(false),
  autoSyncInvoices: boolean('auto_sync_invoices').default(true),
  autoSyncPayments: boolean('auto_sync_payments').default(true),
  autoSyncExpenses: boolean('auto_sync_expenses').default(true),
  defaultRevenueAccountId: varchar('default_revenue_account_id', { length: 36 }).references(() => chartOfAccounts.id),
  defaultBankAccountId: varchar('default_bank_account_id', { length: 36 }).references(() => chartOfAccounts.id),
  defaultExpenseAccountId: varchar('default_expense_account_id', { length: 36 }).references(() => chartOfAccounts.id),
  defaultReceivableAccountId: varchar('default_receivable_account_id', { length: 36 }).references(() => chartOfAccounts.id),
  lastSyncAt: timestamp('last_sync_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ==================== PM SYNC LOG ====================
export const pmSyncLog = pgTable('pm_sync_log', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar('company_id', { length: 36 }).references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  entityType: varchar('entity_type', { length: 50 }).notNull(), // invoice, payment, expense, client
  pmEntityId: varchar('pm_entity_id', { length: 36 }).notNull(),
  zarabooksEntryId: varchar('zarabooks_entry_id', { length: 36 }),
  syncDirection: varchar('sync_direction', { length: 10 }).notNull(), // pull, push
  syncStatus: varchar('sync_status', { length: 20 }).notNull(), // success, failed, pending
  errorMessage: text('error_message'),
  requestPayload: jsonb('request_payload'),
  responsePayload: jsonb('response_payload'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ==================== USER INVITATIONS ====================
export const userInvitations = pgTable('user_invitations', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar('company_id', { length: 36 }).references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  role: companyRoleEnum('role').default('viewer').notNull(),
  token: varchar('token', { length: 100 }).notNull(),
  invitedByUserId: varchar('invited_by_user_id', { length: 36 }).references(() => users.id).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  acceptedAt: timestamp('accepted_at'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_invitation_email').on(table.email),
  index('idx_invitation_token').on(table.token),
]);

// ==================== INVOICE STATUS ENUM ====================
export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled', 'void']);
export const expenseStatusEnum = pgEnum('expense_status', ['pending', 'approved', 'rejected', 'paid']);

// ==================== INVOICES ====================
export const invoices = pgTable('invoices', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar('company_id', { length: 36 }).references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  fiscalYearId: varchar('fiscal_year_id', { length: 36 }).references(() => fiscalYears.id).notNull(),
  invoiceNumber: varchar('invoice_number', { length: 50 }).notNull(),
  invoiceDate: date('invoice_date').notNull(),
  dueDate: date('due_date').notNull(),
  customerId: varchar('customer_id', { length: 36 }).references(() => parties.id).notNull(),
  // Address
  billingAddress: text('billing_address'),
  shippingAddress: text('shipping_address'),
  // Amounts
  subtotal: decimal('subtotal', { precision: 18, scale: 2 }).default('0').notNull(),
  discountAmount: decimal('discount_amount', { precision: 18, scale: 2 }).default('0'),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }),
  taxAmount: decimal('tax_amount', { precision: 18, scale: 2 }).default('0'),
  totalAmount: decimal('total_amount', { precision: 18, scale: 2 }).notNull(),
  paidAmount: decimal('paid_amount', { precision: 18, scale: 2 }).default('0'),
  balanceDue: decimal('balance_due', { precision: 18, scale: 2 }).notNull(),
  // GST
  cgst: decimal('cgst', { precision: 18, scale: 2 }).default('0'),
  sgst: decimal('sgst', { precision: 18, scale: 2 }).default('0'),
  igst: decimal('igst', { precision: 18, scale: 2 }).default('0'),
  // Status
  status: invoiceStatusEnum('status').default('draft').notNull(),
  // References
  journalEntryId: varchar('journal_entry_id', { length: 36 }).references(() => journalEntries.id),
  notes: text('notes'),
  terms: text('terms'),
  // Metadata
  createdByUserId: varchar('created_by_user_id', { length: 36 }).references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_invoice_company').on(table.companyId),
  index('idx_invoice_customer').on(table.customerId),
  index('idx_invoice_number').on(table.companyId, table.invoiceNumber),
]);

// ==================== INVOICE LINES ====================
export const invoiceLines = pgTable('invoice_lines', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar('invoice_id', { length: 36 }).references(() => invoices.id, { onDelete: 'cascade' }).notNull(),
  accountId: varchar('account_id', { length: 36 }).references(() => chartOfAccounts.id),
  description: text('description').notNull(),
  hsnSacCode: varchar('hsn_sac_code', { length: 20 }),
  quantity: decimal('quantity', { precision: 18, scale: 4 }).default('1').notNull(),
  unitPrice: decimal('unit_price', { precision: 18, scale: 2 }).notNull(),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }).default('0'),
  discountAmount: decimal('discount_amount', { precision: 18, scale: 2 }).default('0'),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }).default('0'),
  taxAmount: decimal('tax_amount', { precision: 18, scale: 2 }).default('0'),
  amount: decimal('amount', { precision: 18, scale: 2 }).notNull(),
  sortOrder: integer('sort_order').default(0),
});

// ==================== EXPENSES ====================
export const expenses = pgTable('expenses', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar('company_id', { length: 36 }).references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  fiscalYearId: varchar('fiscal_year_id', { length: 36 }).references(() => fiscalYears.id).notNull(),
  expenseNumber: varchar('expense_number', { length: 50 }).notNull(),
  expenseDate: date('expense_date').notNull(),
  vendorId: varchar('vendor_id', { length: 36 }).references(() => parties.id),
  accountId: varchar('account_id', { length: 36 }).references(() => chartOfAccounts.id).notNull(),
  paymentAccountId: varchar('payment_account_id', { length: 36 }).references(() => chartOfAccounts.id),
  // Category
  category: varchar('category', { length: 100 }),
  // Amounts
  amount: decimal('amount', { precision: 18, scale: 2 }).notNull(),
  taxAmount: decimal('tax_amount', { precision: 18, scale: 2 }).default('0'),
  totalAmount: decimal('total_amount', { precision: 18, scale: 2 }).notNull(),
  // Payment
  paymentMethod: varchar('payment_method', { length: 50 }), // cash, bank_transfer, credit_card, etc.
  referenceNumber: varchar('reference_number', { length: 100 }),
  // Status & Approval
  status: expenseStatusEnum('status').default('pending').notNull(),
  approvedByUserId: varchar('approved_by_user_id', { length: 36 }).references(() => users.id),
  approvedAt: timestamp('approved_at'),
  // References
  journalEntryId: varchar('journal_entry_id', { length: 36 }).references(() => journalEntries.id),
  description: text('description'),
  notes: text('notes'),
  // Receipt
  receiptUrl: varchar('receipt_url', { length: 500 }),
  // Metadata
  createdByUserId: varchar('created_by_user_id', { length: 36 }).references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_expense_company').on(table.companyId),
  index('idx_expense_vendor').on(table.vendorId),
  index('idx_expense_date').on(table.companyId, table.expenseDate),
]);

// ==================== AI CONVERSATIONS ====================
export const aiConversations = pgTable('ai_conversations', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar('company_id', { length: 36 }).references(() => companies.id, { onDelete: 'cascade' }).notNull(),
  userId: varchar('user_id', { length: 36 }).references(() => users.id).notNull(),
  sessionId: varchar('session_id', { length: 36 }).notNull(),
  messageType: varchar('message_type', { length: 20 }).notNull(), // user, assistant
  content: text('content').notNull(),
  contextData: jsonb('context_data'), // Relevant data for the response
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_ai_session').on(table.sessionId),
]);

// ==================== RELATIONS ====================

export const usersRelations = relations(users, ({ many }) => ({
  companyUsers: many(companyUsers),
  createdCompanies: many(companies),
}));

export const companiesRelations = relations(companies, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [companies.createdByUserId],
    references: [users.id],
  }),
  companyUsers: many(companyUsers),
  fiscalYears: many(fiscalYears),
  chartOfAccounts: many(chartOfAccounts),
  parties: many(parties),
  bankAccounts: many(bankAccounts),
  journalEntries: many(journalEntries),
  gstConfigs: many(gstConfig),
}));

export const companyUsersRelations = relations(companyUsers, ({ one }) => ({
  company: one(companies, {
    fields: [companyUsers.companyId],
    references: [companies.id],
  }),
  user: one(users, {
    fields: [companyUsers.userId],
    references: [users.id],
  }),
}));

export const fiscalYearsRelations = relations(fiscalYears, ({ one, many }) => ({
  company: one(companies, {
    fields: [fiscalYears.companyId],
    references: [companies.id],
  }),
  lockedBy: one(users, {
    fields: [fiscalYears.lockedByUserId],
    references: [users.id],
  }),
  journalEntries: many(journalEntries),
}));

export const chartOfAccountsRelations = relations(chartOfAccounts, ({ one, many }) => ({
  company: one(companies, {
    fields: [chartOfAccounts.companyId],
    references: [companies.id],
  }),
  parentAccount: one(chartOfAccounts, {
    fields: [chartOfAccounts.parentAccountId],
    references: [chartOfAccounts.id],
    relationName: 'parent',
  }),
  childAccounts: many(chartOfAccounts, { relationName: 'parent' }),
  journalEntryLines: many(journalEntryLines),
}));

export const costCentersRelations = relations(costCenters, ({ one, many }) => ({
  company: one(companies, {
    fields: [costCenters.companyId],
    references: [companies.id],
  }),
  parentCostCenter: one(costCenters, {
    fields: [costCenters.parentCostCenterId],
    references: [costCenters.id],
    relationName: 'parent',
  }),
  childCostCenters: many(costCenters, { relationName: 'parent' }),
}));

export const partiesRelations = relations(parties, ({ one, many }) => ({
  company: one(companies, {
    fields: [parties.companyId],
    references: [companies.id],
  }),
  defaultAccount: one(chartOfAccounts, {
    fields: [parties.defaultAccountId],
    references: [chartOfAccounts.id],
  }),
  journalEntryLines: many(journalEntryLines),
  tdsDeductions: many(tdsDeductions),
}));

export const bankAccountsRelations = relations(bankAccounts, ({ one }) => ({
  company: one(companies, {
    fields: [bankAccounts.companyId],
    references: [companies.id],
  }),
  account: one(chartOfAccounts, {
    fields: [bankAccounts.accountId],
    references: [chartOfAccounts.id],
  }),
}));

export const journalEntriesRelations = relations(journalEntries, ({ one, many }) => ({
  company: one(companies, {
    fields: [journalEntries.companyId],
    references: [companies.id],
  }),
  fiscalYear: one(fiscalYears, {
    fields: [journalEntries.fiscalYearId],
    references: [fiscalYears.id],
  }),
  createdBy: one(users, {
    fields: [journalEntries.createdByUserId],
    references: [users.id],
  }),
  approvedBy: one(users, {
    fields: [journalEntries.approvedByUserId],
    references: [users.id],
  }),
  lines: many(journalEntryLines),
}));

export const journalEntryLinesRelations = relations(journalEntryLines, ({ one }) => ({
  journalEntry: one(journalEntries, {
    fields: [journalEntryLines.journalEntryId],
    references: [journalEntries.id],
  }),
  account: one(chartOfAccounts, {
    fields: [journalEntryLines.accountId],
    references: [chartOfAccounts.id],
  }),
  party: one(parties, {
    fields: [journalEntryLines.partyId],
    references: [parties.id],
  }),
  costCenter: one(costCenters, {
    fields: [journalEntryLines.costCenterId],
    references: [costCenters.id],
  }),
}));

export const recurringEntryTemplatesRelations = relations(recurringEntryTemplates, ({ one }) => ({
  company: one(companies, {
    fields: [recurringEntryTemplates.companyId],
    references: [companies.id],
  }),
  createdBy: one(users, {
    fields: [recurringEntryTemplates.createdByUserId],
    references: [users.id],
  }),
}));

export const gstConfigRelations = relations(gstConfig, ({ one, many }) => ({
  company: one(companies, {
    fields: [gstConfig.companyId],
    references: [companies.id],
  }),
  gstr1Entries: many(gstr1Entries),
  gstr3bSummaries: many(gstr3bSummary),
}));

export const gstr1EntriesRelations = relations(gstr1Entries, ({ one }) => ({
  company: one(companies, {
    fields: [gstr1Entries.companyId],
    references: [companies.id],
  }),
  gstConfig: one(gstConfig, {
    fields: [gstr1Entries.gstConfigId],
    references: [gstConfig.id],
  }),
}));

export const gstr3bSummaryRelations = relations(gstr3bSummary, ({ one }) => ({
  company: one(companies, {
    fields: [gstr3bSummary.companyId],
    references: [companies.id],
  }),
  gstConfig: one(gstConfig, {
    fields: [gstr3bSummary.gstConfigId],
    references: [gstConfig.id],
  }),
}));

export const itcRegisterRelations = relations(itcRegister, ({ one }) => ({
  company: one(companies, {
    fields: [itcRegister.companyId],
    references: [companies.id],
  }),
  gstConfig: one(gstConfig, {
    fields: [itcRegister.gstConfigId],
    references: [gstConfig.id],
  }),
}));

export const tdsDeductionsRelations = relations(tdsDeductions, ({ one }) => ({
  company: one(companies, {
    fields: [tdsDeductions.companyId],
    references: [companies.id],
  }),
  journalEntry: one(journalEntries, {
    fields: [tdsDeductions.journalEntryId],
    references: [journalEntries.id],
  }),
  party: one(parties, {
    fields: [tdsDeductions.partyId],
    references: [parties.id],
  }),
}));

export const tdsChallansRelations = relations(tdsChallans, ({ one }) => ({
  company: one(companies, {
    fields: [tdsChallans.companyId],
    references: [companies.id],
  }),
  journalEntry: one(journalEntries, {
    fields: [tdsChallans.journalEntryId],
    references: [journalEntries.id],
  }),
}));

export const form26asEntriesRelations = relations(form26asEntries, ({ one }) => ({
  company: one(companies, {
    fields: [form26asEntries.companyId],
    references: [companies.id],
  }),
}));

export const pmIntegrationConfigRelations = relations(pmIntegrationConfig, ({ one }) => ({
  company: one(companies, {
    fields: [pmIntegrationConfig.companyId],
    references: [companies.id],
  }),
  defaultRevenueAccount: one(chartOfAccounts, {
    fields: [pmIntegrationConfig.defaultRevenueAccountId],
    references: [chartOfAccounts.id],
    relationName: 'revenueAccount',
  }),
  defaultBankAccount: one(chartOfAccounts, {
    fields: [pmIntegrationConfig.defaultBankAccountId],
    references: [chartOfAccounts.id],
    relationName: 'bankAccount',
  }),
}));

export const aiConversationsRelations = relations(aiConversations, ({ one }) => ({
  company: one(companies, {
    fields: [aiConversations.companyId],
    references: [companies.id],
  }),
  user: one(users, {
    fields: [aiConversations.userId],
    references: [users.id],
  }),
}));

export const userInvitationsRelations = relations(userInvitations, ({ one }) => ({
  company: one(companies, {
    fields: [userInvitations.companyId],
    references: [companies.id],
  }),
  invitedBy: one(users, {
    fields: [userInvitations.invitedByUserId],
    references: [users.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  company: one(companies, {
    fields: [invoices.companyId],
    references: [companies.id],
  }),
  fiscalYear: one(fiscalYears, {
    fields: [invoices.fiscalYearId],
    references: [fiscalYears.id],
  }),
  customer: one(parties, {
    fields: [invoices.customerId],
    references: [parties.id],
  }),
  journalEntry: one(journalEntries, {
    fields: [invoices.journalEntryId],
    references: [journalEntries.id],
  }),
  createdBy: one(users, {
    fields: [invoices.createdByUserId],
    references: [users.id],
  }),
  lines: many(invoiceLines),
}));

export const invoiceLinesRelations = relations(invoiceLines, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceLines.invoiceId],
    references: [invoices.id],
  }),
  account: one(chartOfAccounts, {
    fields: [invoiceLines.accountId],
    references: [chartOfAccounts.id],
  }),
}));

export const expensesRelations = relations(expenses, ({ one }) => ({
  company: one(companies, {
    fields: [expenses.companyId],
    references: [companies.id],
  }),
  fiscalYear: one(fiscalYears, {
    fields: [expenses.fiscalYearId],
    references: [fiscalYears.id],
  }),
  vendor: one(parties, {
    fields: [expenses.vendorId],
    references: [parties.id],
  }),
  account: one(chartOfAccounts, {
    fields: [expenses.accountId],
    references: [chartOfAccounts.id],
  }),
  paymentAccount: one(chartOfAccounts, {
    fields: [expenses.paymentAccountId],
    references: [chartOfAccounts.id],
    relationName: 'paymentAccount',
  }),
  journalEntry: one(journalEntries, {
    fields: [expenses.journalEntryId],
    references: [journalEntries.id],
  }),
  createdBy: one(users, {
    fields: [expenses.createdByUserId],
    references: [users.id],
  }),
  approvedBy: one(users, {
    fields: [expenses.approvedByUserId],
    references: [users.id],
    relationName: 'approver',
  }),
}));

export const exchangeRatesRelations = relations(exchangeRates, ({ one }) => ({
  company: one(companies, {
    fields: [exchangeRates.companyId],
    references: [companies.id],
  }),
}));

// ==================== ZOD SCHEMAS ====================

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastLogin: true,
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCompanyUserSchema = createInsertSchema(companyUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFiscalYearSchema = createInsertSchema(fiscalYears).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lockedAt: true,
});

export const insertChartOfAccountsSchema = createInsertSchema(chartOfAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCostCenterSchema = createInsertSchema(costCenters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPartySchema = createInsertSchema(parties).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBankAccountSchema = createInsertSchema(bankAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertJournalEntrySchema = createInsertSchema(journalEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  approvedAt: true,
});

export const insertJournalEntryLineSchema = createInsertSchema(journalEntryLines).omit({
  id: true,
});

export const insertRecurringEntryTemplateSchema = createInsertSchema(recurringEntryTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastRunAt: true,
});

export const insertGstConfigSchema = createInsertSchema(gstConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGstr1EntrySchema = createInsertSchema(gstr1Entries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGstr3bSummarySchema = createInsertSchema(gstr3bSummary).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertItcRegisterSchema = createInsertSchema(itcRegister).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGstPaymentSchema = createInsertSchema(gstPayments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTdsSectionSchema = createInsertSchema(tdsSections).omit({
  id: true,
});

export const insertTdsDeductionSchema = createInsertSchema(tdsDeductions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTdsChallanSchema = createInsertSchema(tdsChallans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPmIntegrationConfigSchema = createInsertSchema(pmIntegrationConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAiConversationSchema = createInsertSchema(aiConversations).omit({
  id: true,
  createdAt: true,
});

export const insertUserInvitationSchema = createInsertSchema(userInvitations).omit({
  id: true,
  createdAt: true,
  acceptedAt: true,
});

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertInvoiceLineSchema = createInsertSchema(invoiceLines).omit({
  id: true,
});

export const insertExpenseSchema = createInsertSchema(expenses).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  approvedAt: true,
});

export const insertCurrencySchema = createInsertSchema(currencies).omit({
  id: true,
});

export const insertExchangeRateSchema = createInsertSchema(exchangeRates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// ==================== TYPES ====================

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type CompanyUser = typeof companyUsers.$inferSelect;
export type InsertCompanyUser = z.infer<typeof insertCompanyUserSchema>;
export type FiscalYear = typeof fiscalYears.$inferSelect;
export type InsertFiscalYear = z.infer<typeof insertFiscalYearSchema>;
export type CoaTemplate = typeof coaTemplates.$inferSelect;
export type ChartOfAccount = typeof chartOfAccounts.$inferSelect;
export type InsertChartOfAccount = z.infer<typeof insertChartOfAccountsSchema>;
export type CostCenter = typeof costCenters.$inferSelect;
export type InsertCostCenter = z.infer<typeof insertCostCenterSchema>;
export type Party = typeof parties.$inferSelect;
export type InsertParty = z.infer<typeof insertPartySchema>;
export type BankAccount = typeof bankAccounts.$inferSelect;
export type InsertBankAccount = z.infer<typeof insertBankAccountSchema>;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type JournalEntryLine = typeof journalEntryLines.$inferSelect;
export type InsertJournalEntryLine = z.infer<typeof insertJournalEntryLineSchema>;
export type RecurringEntryTemplate = typeof recurringEntryTemplates.$inferSelect;
export type InsertRecurringEntryTemplate = z.infer<typeof insertRecurringEntryTemplateSchema>;
export type TrialBalanceCache = typeof trialBalanceCache.$inferSelect;
export type ScheduleIIIMapping = typeof scheduleIIIMappings.$inferSelect;
export type FinancialStatementRun = typeof financialStatementRuns.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type GstConfig = typeof gstConfig.$inferSelect;
export type InsertGstConfig = z.infer<typeof insertGstConfigSchema>;
export type Gstr1Entry = typeof gstr1Entries.$inferSelect;
export type InsertGstr1Entry = z.infer<typeof insertGstr1EntrySchema>;
export type Gstr3bSummary = typeof gstr3bSummary.$inferSelect;
export type InsertGstr3bSummary = z.infer<typeof insertGstr3bSummarySchema>;
export type ItcRegisterEntry = typeof itcRegister.$inferSelect;
export type InsertItcRegisterEntry = z.infer<typeof insertItcRegisterSchema>;
export type GstPayment = typeof gstPayments.$inferSelect;
export type InsertGstPayment = z.infer<typeof insertGstPaymentSchema>;
export type HsnSacMaster = typeof hsnSacMaster.$inferSelect;
export type TdsSection = typeof tdsSections.$inferSelect;
export type InsertTdsSection = z.infer<typeof insertTdsSectionSchema>;
export type TdsDeduction = typeof tdsDeductions.$inferSelect;
export type InsertTdsDeduction = z.infer<typeof insertTdsDeductionSchema>;
export type TdsChallan = typeof tdsChallans.$inferSelect;
export type InsertTdsChallan = z.infer<typeof insertTdsChallanSchema>;
export type Form26asEntry = typeof form26asEntries.$inferSelect;
export type PmIntegrationConfig = typeof pmIntegrationConfig.$inferSelect;
export type InsertPmIntegrationConfig = z.infer<typeof insertPmIntegrationConfigSchema>;
export type PmSyncLogEntry = typeof pmSyncLog.$inferSelect;
export type AiConversation = typeof aiConversations.$inferSelect;
export type InsertAiConversation = z.infer<typeof insertAiConversationSchema>;
export type Currency = typeof currencies.$inferSelect;
export type InsertCurrency = z.infer<typeof insertCurrencySchema>;
export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type InsertExchangeRate = z.infer<typeof insertExchangeRateSchema>;
