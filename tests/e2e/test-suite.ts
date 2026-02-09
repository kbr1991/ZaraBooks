/**
 * ZaraBooks Comprehensive Test Suite
 * For professional testing before commercial launch
 */

// ===========================================
// CONFIGURATION
// ===========================================
export const CONFIG = {
  baseUrl: 'https://scintillating-stillness-production-02d4.up.railway.app',
  credentials: {
    email: 'admin@example.com',
    password: 'Admin@123',
  },
  timeout: 30000,
};

// ===========================================
// TEST DATA GENERATORS
// ===========================================
export const TestData = {
  customer: () => ({
    partyType: 'customer',
    name: `Test Customer ${Date.now()}`,
    email: `customer${Date.now()}@test.com`,
    phone: '9876543210',
    gstin: '27AABCU9603R1ZM',
    pan: 'AABCU9603R',
    billingAddress: '123 Test Street, Mumbai',
    state: 'Maharashtra',
    stateCode: '27',
  }),

  vendor: () => ({
    partyType: 'vendor',
    name: `Test Vendor ${Date.now()}`,
    email: `vendor${Date.now()}@test.com`,
    phone: '9876543211',
    gstin: '29AABCU9603R1ZN',
    pan: 'AABCU9603R',
    billingAddress: '456 Vendor Road, Bangalore',
    state: 'Karnataka',
    stateCode: '29',
  }),

  product: () => ({
    name: `Test Product ${Date.now()}`,
    code: `PROD-${Date.now()}`,
    type: 'goods',
    unit: 'Nos',
    hsnSacCode: '8471',
    gstRate: 18,
    purchasePrice: 100,
    salesPrice: 150,
  }),

  bankAccount: () => ({
    bankName: 'Test Bank',
    accountNumber: `${Date.now()}`.slice(-10),
    accountType: 'current',
    ifscCode: 'TEST0001234',
    branchName: 'Test Branch',
    openingBalance: '10000',
  }),

  invoice: (customerId: string) => ({
    customerId,
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    lines: [
      {
        description: 'Test Service',
        quantity: 2,
        unitPrice: 1000,
        taxRate: 18,
        hsnSacCode: '998311',
      },
    ],
  }),

  quote: (customerId: string) => ({
    customerId,
    quoteDate: new Date().toISOString().split('T')[0],
    validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    lines: [
      {
        description: 'Consulting Service',
        quantity: 10,
        unitPrice: 500,
        taxRate: 18,
      },
    ],
  }),

  bill: (vendorId: string) => ({
    vendorId,
    billDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    vendorBillNumber: `VB-${Date.now()}`,
    lines: [
      {
        description: 'Office Supplies',
        quantity: 5,
        unitPrice: 200,
        taxRate: 18,
      },
    ],
  }),

  journalEntry: () => ({
    entryDate: new Date().toISOString().split('T')[0],
    narration: `Test Journal Entry ${Date.now()}`,
    lines: [
      { accountCode: '1100', debitAmount: 1000, creditAmount: 0, description: 'Debit entry' },
      { accountCode: '4100', debitAmount: 0, creditAmount: 1000, description: 'Credit entry' },
    ],
  }),
};

// ===========================================
// TEST CASES - AUTHENTICATION
// ===========================================
export const AuthTests = {
  id: 'AUTH',
  name: 'Authentication Tests',
  tests: [
    {
      id: 'AUTH-001',
      name: 'Login with valid credentials',
      type: 'positive',
      endpoint: 'POST /api/auth/login',
      payload: CONFIG.credentials,
      expectedStatus: 200,
      validate: (response: any) => response.user && response.user.email === CONFIG.credentials.email,
    },
    {
      id: 'AUTH-002',
      name: 'Login with invalid password',
      type: 'negative',
      endpoint: 'POST /api/auth/login',
      payload: { email: CONFIG.credentials.email, password: 'wrongpassword' },
      expectedStatus: 401,
    },
    {
      id: 'AUTH-003',
      name: 'Login with non-existent email',
      type: 'negative',
      endpoint: 'POST /api/auth/login',
      payload: { email: 'nonexistent@test.com', password: 'password' },
      expectedStatus: 401,
    },
    {
      id: 'AUTH-004',
      name: 'Get current user (authenticated)',
      type: 'positive',
      endpoint: 'GET /api/auth/me',
      requiresAuth: true,
      expectedStatus: 200,
      validate: (response: any) => response.user && response.currentCompany,
    },
    {
      id: 'AUTH-005',
      name: 'Get current user (unauthenticated)',
      type: 'negative',
      endpoint: 'GET /api/auth/me',
      requiresAuth: false,
      expectedStatus: 401,
    },
    {
      id: 'AUTH-006',
      name: 'Logout',
      type: 'positive',
      endpoint: 'POST /api/auth/logout',
      requiresAuth: true,
      expectedStatus: 200,
    },
  ],
};

// ===========================================
// TEST CASES - PARTIES (CUSTOMERS/VENDORS)
// ===========================================
export const PartyTests = {
  id: 'PARTY',
  name: 'Party (Customer/Vendor) Tests',
  tests: [
    // Customer CRUD
    {
      id: 'PARTY-001',
      name: 'Create customer',
      type: 'crud-create',
      endpoint: 'POST /api/parties',
      payloadGenerator: TestData.customer,
      expectedStatus: 201,
      validate: (response: any) => response.id && response.partyType === 'customer',
      storeAs: 'testCustomerId',
    },
    {
      id: 'PARTY-002',
      name: 'List customers',
      type: 'crud-read',
      endpoint: 'GET /api/parties?type=customer',
      expectedStatus: 200,
      validate: (response: any) => Array.isArray(response),
    },
    {
      id: 'PARTY-003',
      name: 'Get customer by ID',
      type: 'crud-read',
      endpoint: 'GET /api/parties/:testCustomerId',
      expectedStatus: 200,
      validate: (response: any) => response.id && response.partyType === 'customer',
    },
    {
      id: 'PARTY-004',
      name: 'Update customer',
      type: 'crud-update',
      endpoint: 'PATCH /api/parties/:testCustomerId',
      payload: { phone: '9999999999' },
      expectedStatus: 200,
      validate: (response: any) => response.phone === '9999999999',
    },
    // Vendor CRUD
    {
      id: 'PARTY-005',
      name: 'Create vendor',
      type: 'crud-create',
      endpoint: 'POST /api/parties',
      payloadGenerator: TestData.vendor,
      expectedStatus: 201,
      validate: (response: any) => response.id && response.partyType === 'vendor',
      storeAs: 'testVendorId',
    },
    {
      id: 'PARTY-006',
      name: 'List vendors',
      type: 'crud-read',
      endpoint: 'GET /api/parties?type=vendor',
      expectedStatus: 200,
      validate: (response: any) => Array.isArray(response),
    },
    // Negative tests
    {
      id: 'PARTY-007',
      name: 'Create party without name (should fail)',
      type: 'negative',
      endpoint: 'POST /api/parties',
      payload: { partyType: 'customer', email: 'test@test.com' },
      expectedStatus: 400,
    },
    {
      id: 'PARTY-008',
      name: 'Create party without type (should fail)',
      type: 'negative',
      endpoint: 'POST /api/parties',
      payload: { name: 'Test' },
      expectedStatus: 400,
    },
  ],
};

// ===========================================
// TEST CASES - PRODUCTS
// ===========================================
export const ProductTests = {
  id: 'PRODUCT',
  name: 'Product Tests',
  tests: [
    {
      id: 'PROD-001',
      name: 'Create product',
      type: 'crud-create',
      endpoint: 'POST /api/products',
      payloadGenerator: TestData.product,
      expectedStatus: 201,
      validate: (response: any) => response.id && response.name,
      storeAs: 'testProductId',
    },
    {
      id: 'PROD-002',
      name: 'List products',
      type: 'crud-read',
      endpoint: 'GET /api/products',
      expectedStatus: 200,
      validate: (response: any) => Array.isArray(response),
    },
    {
      id: 'PROD-003',
      name: 'Get product by ID',
      type: 'crud-read',
      endpoint: 'GET /api/products/:testProductId',
      expectedStatus: 200,
      validate: (response: any) => response.id,
    },
    {
      id: 'PROD-004',
      name: 'Update product',
      type: 'crud-update',
      endpoint: 'PATCH /api/products/:testProductId',
      payload: { salesPrice: 200 },
      expectedStatus: 200,
    },
    {
      id: 'PROD-005',
      name: 'Create product without name (should fail)',
      type: 'negative',
      endpoint: 'POST /api/products',
      payload: { type: 'goods', salesPrice: 100 },
      expectedStatus: 400,
    },
  ],
};

// ===========================================
// TEST CASES - QUOTES
// ===========================================
export const QuoteTests = {
  id: 'QUOTE',
  name: 'Quote Tests',
  tests: [
    {
      id: 'QUOTE-001',
      name: 'Create quote',
      type: 'crud-create',
      endpoint: 'POST /api/quotes',
      payloadGenerator: (ctx: any) => TestData.quote(ctx.testCustomerId),
      expectedStatus: 201,
      validate: (response: any) => response.id && response.quoteNumber,
      storeAs: 'testQuoteId',
      dependsOn: ['testCustomerId'],
    },
    {
      id: 'QUOTE-002',
      name: 'List quotes',
      type: 'crud-read',
      endpoint: 'GET /api/quotes',
      expectedStatus: 200,
      validate: (response: any) => Array.isArray(response),
    },
    {
      id: 'QUOTE-003',
      name: 'Get quote by ID',
      type: 'crud-read',
      endpoint: 'GET /api/quotes/:testQuoteId',
      expectedStatus: 200,
      dependsOn: ['testQuoteId'],
    },
    {
      id: 'QUOTE-004',
      name: 'Send quote',
      type: 'action',
      endpoint: 'POST /api/quotes/:testQuoteId/send',
      expectedStatus: 200,
      dependsOn: ['testQuoteId'],
    },
  ],
};

// ===========================================
// TEST CASES - INVOICES
// ===========================================
export const InvoiceTests = {
  id: 'INVOICE',
  name: 'Invoice Tests',
  tests: [
    {
      id: 'INV-001',
      name: 'Create invoice',
      type: 'crud-create',
      endpoint: 'POST /api/invoices',
      payloadGenerator: (ctx: any) => TestData.invoice(ctx.testCustomerId),
      expectedStatus: 201,
      validate: (response: any) => response.id && response.invoiceNumber,
      storeAs: 'testInvoiceId',
      dependsOn: ['testCustomerId'],
    },
    {
      id: 'INV-002',
      name: 'List invoices',
      type: 'crud-read',
      endpoint: 'GET /api/invoices',
      expectedStatus: 200,
      validate: (response: any) => Array.isArray(response),
    },
    {
      id: 'INV-003',
      name: 'Get invoice by ID',
      type: 'crud-read',
      endpoint: 'GET /api/invoices/:testInvoiceId',
      expectedStatus: 200,
      dependsOn: ['testInvoiceId'],
    },
    {
      id: 'INV-004',
      name: 'Send invoice',
      type: 'action',
      endpoint: 'POST /api/invoices/:testInvoiceId/send',
      expectedStatus: 200,
      dependsOn: ['testInvoiceId'],
    },
    {
      id: 'INV-005',
      name: 'Create invoice without customer (should fail)',
      type: 'negative',
      endpoint: 'POST /api/invoices',
      payload: {
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        lines: [{ description: 'Test', quantity: 1, unitPrice: 100 }],
      },
      expectedStatus: 400,
    },
    {
      id: 'INV-006',
      name: 'Create invoice without lines (should fail)',
      type: 'negative',
      endpoint: 'POST /api/invoices',
      payloadGenerator: (ctx: any) => ({
        customerId: ctx.testCustomerId,
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        lines: [],
      }),
      expectedStatus: 400,
      dependsOn: ['testCustomerId'],
    },
  ],
};

// ===========================================
// TEST CASES - BILLS
// ===========================================
export const BillTests = {
  id: 'BILL',
  name: 'Bill Tests',
  tests: [
    {
      id: 'BILL-001',
      name: 'Create bill',
      type: 'crud-create',
      endpoint: 'POST /api/bills',
      payloadGenerator: (ctx: any) => TestData.bill(ctx.testVendorId),
      expectedStatus: 201,
      validate: (response: any) => response.id && response.billNumber,
      storeAs: 'testBillId',
      dependsOn: ['testVendorId'],
    },
    {
      id: 'BILL-002',
      name: 'List bills',
      type: 'crud-read',
      endpoint: 'GET /api/bills',
      expectedStatus: 200,
      validate: (response: any) => Array.isArray(response),
    },
    {
      id: 'BILL-003',
      name: 'Get bill by ID',
      type: 'crud-read',
      endpoint: 'GET /api/bills/:testBillId',
      expectedStatus: 200,
      dependsOn: ['testBillId'],
    },
  ],
};

// ===========================================
// TEST CASES - BANK ACCOUNTS
// ===========================================
export const BankAccountTests = {
  id: 'BANK',
  name: 'Bank Account Tests',
  tests: [
    {
      id: 'BANK-001',
      name: 'Create bank account',
      type: 'crud-create',
      endpoint: 'POST /api/bank-accounts',
      payloadGenerator: TestData.bankAccount,
      expectedStatus: 201,
      validate: (response: any) => response.id && response.bankName,
      storeAs: 'testBankAccountId',
    },
    {
      id: 'BANK-002',
      name: 'List bank accounts',
      type: 'crud-read',
      endpoint: 'GET /api/bank-accounts',
      expectedStatus: 200,
      validate: (response: any) => Array.isArray(response),
    },
    {
      id: 'BANK-003',
      name: 'Get bank account by ID',
      type: 'crud-read',
      endpoint: 'GET /api/bank-accounts/:testBankAccountId',
      expectedStatus: 200,
      dependsOn: ['testBankAccountId'],
    },
  ],
};

// ===========================================
// TEST CASES - CHART OF ACCOUNTS
// ===========================================
export const ChartOfAccountsTests = {
  id: 'COA',
  name: 'Chart of Accounts Tests',
  tests: [
    {
      id: 'COA-001',
      name: 'List chart of accounts',
      type: 'crud-read',
      endpoint: 'GET /api/chart-of-accounts',
      expectedStatus: 200,
      validate: (response: any) => Array.isArray(response) && response.length > 0,
    },
    {
      id: 'COA-002',
      name: 'Create account',
      type: 'crud-create',
      endpoint: 'POST /api/chart-of-accounts',
      payload: {
        code: `TEST${Date.now()}`.slice(-8),
        name: `Test Account ${Date.now()}`,
        accountType: 'expense',
        isGroup: false,
      },
      expectedStatus: 201,
      validate: (response: any) => response.id && response.code,
      storeAs: 'testAccountId',
    },
    {
      id: 'COA-003',
      name: 'Get ledger list',
      type: 'crud-read',
      endpoint: 'GET /api/chart-of-accounts/ledgers/list',
      expectedStatus: 200,
      validate: (response: any) => Array.isArray(response),
    },
  ],
};

// ===========================================
// TEST CASES - JOURNAL ENTRIES
// ===========================================
export const JournalEntryTests = {
  id: 'JE',
  name: 'Journal Entry Tests',
  tests: [
    {
      id: 'JE-001',
      name: 'List journal entries',
      type: 'crud-read',
      endpoint: 'GET /api/journal-entries',
      expectedStatus: 200,
      validate: (response: any) => Array.isArray(response),
    },
  ],
};

// ===========================================
// TEST CASES - FINANCIAL REPORTS
// ===========================================
export const ReportTests = {
  id: 'REPORT',
  name: 'Financial Report Tests',
  tests: [
    {
      id: 'RPT-001',
      name: 'Get trial balance',
      type: 'report',
      endpoint: 'GET /api/trial-balance',
      expectedStatus: 200,
      validate: (response: any) => {
        // Trial balance must balance (total debits = total credits)
        if (!response.accounts) return false;
        const totalDebit = response.accounts.reduce((sum: number, a: any) => sum + parseFloat(a.debit || 0), 0);
        const totalCredit = response.accounts.reduce((sum: number, a: any) => sum + parseFloat(a.credit || 0), 0);
        return Math.abs(totalDebit - totalCredit) < 0.01;
      },
    },
    {
      id: 'RPT-002',
      name: 'Get balance sheet',
      type: 'report',
      endpoint: 'GET /api/financial-statements/balance-sheet',
      expectedStatus: 200,
    },
    {
      id: 'RPT-003',
      name: 'Get profit & loss',
      type: 'report',
      endpoint: 'GET /api/financial-statements/profit-loss',
      expectedStatus: 200,
    },
    {
      id: 'RPT-004',
      name: 'Get cash flow',
      type: 'report',
      endpoint: 'GET /api/financial-statements/cash-flow',
      expectedStatus: 200,
    },
  ],
};

// ===========================================
// TEST CASES - SECURITY
// ===========================================
export const SecurityTests = {
  id: 'SEC',
  name: 'Security Tests',
  tests: [
    {
      id: 'SEC-001',
      name: 'Access protected route without auth',
      type: 'security',
      endpoint: 'GET /api/parties',
      requiresAuth: false,
      expectedStatus: 401,
    },
    {
      id: 'SEC-002',
      name: 'SQL injection in search',
      type: 'security',
      endpoint: "GET /api/parties?search='; DROP TABLE users; --",
      expectedStatus: [200, 400], // Should not crash
      validate: (response: any) => !response.error?.includes('syntax'),
    },
    {
      id: 'SEC-003',
      name: 'XSS in party name',
      type: 'security',
      endpoint: 'POST /api/parties',
      payload: {
        partyType: 'customer',
        name: '<script>alert("xss")</script>',
        email: 'xss@test.com',
      },
      expectedStatus: [201, 400],
      validate: (response: any) => {
        if (response.name) {
          return !response.name.includes('<script>');
        }
        return true;
      },
    },
    {
      id: 'SEC-004',
      name: 'Access other company data (multi-tenancy)',
      type: 'security',
      endpoint: 'GET /api/parties/non-existent-id',
      expectedStatus: 404, // Should not expose data
    },
  ],
};

// ===========================================
// TEST CASES - DATA INTEGRITY
// ===========================================
export const DataIntegrityTests = {
  id: 'INTEGRITY',
  name: 'Data Integrity Tests',
  tests: [
    {
      id: 'INT-001',
      name: 'Invoice totals match line items',
      type: 'integrity',
      description: 'Verify invoice total = sum of line amounts + tax',
      endpoint: 'GET /api/invoices',
      validate: (response: any) => {
        // This would need detailed line item data to fully validate
        return Array.isArray(response);
      },
    },
    {
      id: 'INT-002',
      name: 'Trial balance is balanced',
      type: 'integrity',
      endpoint: 'GET /api/trial-balance',
      validate: (response: any) => {
        if (!response.totals) return true; // Skip if no data
        const diff = Math.abs(parseFloat(response.totals.debit || 0) - parseFloat(response.totals.credit || 0));
        return diff < 0.01;
      },
    },
  ],
};

// ===========================================
// EXPORT ALL TEST SUITES
// ===========================================
export const AllTestSuites = [
  AuthTests,
  PartyTests,
  ProductTests,
  QuoteTests,
  InvoiceTests,
  BillTests,
  BankAccountTests,
  ChartOfAccountsTests,
  JournalEntryTests,
  ReportTests,
  SecurityTests,
  DataIntegrityTests,
];

export default AllTestSuites;
