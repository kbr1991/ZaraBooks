# Zara Books - Project Memory

> This file maintains context for Claude Code sessions. Updated as features are added.

---

## Quick Reference

| Item | Value |
|------|-------|
| **Project** | Zara Books - Accounting Application |
| **Target Users** | CA firms, Startups (India) |
| **Deployed URL** | https://scintillating-stillness-production-02d4.up.railway.app |
| **Repository** | https://github.com/kbr1991/ZaraBooks |
| **Current Version** | 1.3.0 |

### Tech Stack
- **Frontend:** React 18, TypeScript, Tailwind CSS, React Query, React Router
- **Backend:** Express.js, TypeScript
- **Database:** PostgreSQL with Drizzle ORM (Railway)
- **UI:** Radix UI (shadcn/ui), Lucide icons
- **Testing:** Vitest (123 tests: 74 unit + 49 integration)

### Default Login
- Email: `admin@example.com`
- Password: `Admin@123`

---

## Project Structure

```
ZaraBooks/
├── client/src/
│   ├── components/
│   │   ├── ui/              # shadcn/ui components
│   │   ├── layout/          # Sidebar, MainLayout
│   │   └── accounting/      # Domain components
│   ├── pages/               # Route pages (40+ pages)
│   ├── hooks/               # Custom hooks
│   └── lib/                 # Utilities
├── server/src/
│   ├── routes/              # API endpoints
│   ├── services/            # Business logic
│   ├── middleware/          # Auth middleware
│   └── db/                  # Database config
├── shared/
│   └── schema.ts            # Drizzle schema (28+ tables)
├── tests/
│   ├── unit/                # Unit tests
│   └── integration/         # DB integration tests
├── CLAUDE.md                # This file
├── DEVELOPMENT_SOP.md       # Development standards
├── CHANGELOG.md             # Version history
└── README.md                # Project overview
```

---

## Completed Features

### Core Accounting
| Module | Description | Status |
|--------|-------------|--------|
| Multi-Company | Multiple companies per user | Done |
| Chart of Accounts | 5-level hierarchy, India GAAP template | Done |
| Journal Entries | Double-entry with validation | Done |
| Trial Balance | Real-time calculation, drill-down | Done |
| Balance Sheet | Schedule III format | Done |
| Profit & Loss | Schedule III format | Done |
| Cash Flow | Indirect method | Done |
| Ledger View | Account transaction history | Done |

### Sales Module
| Module | Description | Status |
|--------|-------------|--------|
| Customers | Customer management with receivables | Done |
| Quotes | Estimates with convert-to-invoice | Done |
| Sales Orders | Order tracking | Done |
| Invoices | GST-compliant invoicing | Done |
| Payments Received | Customer payment tracking | Done |
| Credit Notes | Customer refunds | Done |

### Purchases Module
| Module | Description | Status |
|--------|-------------|--------|
| Vendors | Vendor management with payables | Done |
| Purchase Orders | PO management | Done |
| Bills | Vendor invoice tracking | Done |
| Expenses | Expense with approval workflow | Done |
| Payments Made | Vendor payment tracking | Done |
| Debit Notes | Vendor adjustments | Done |

### Banking
| Module | Description | Status |
|--------|-------------|--------|
| Bank Accounts | Multi-account management | Done |
| Bank Reconciliation | Transaction matching | Done |
| Bank Import | CSV/OFX import | Done |

### Inventory
| Module | Description | Status |
|--------|-------------|--------|
| Products & Services | Item catalog with HSN/SAC | Done |

### Compliance (India)
| Module | Description | Status |
|--------|-------------|--------|
| GST Config | Multi-GSTIN support | Done |
| GSTR-1 | Outward supplies data | Done |
| GSTR-3B | Summary return | Done |
| ITC Register | Input tax credit tracking | Done |
| TDS Register | TDS deduction tracking | Done |
| TDS Challans | Payment tracking | Done |

### Administration
| Module | Description | Status |
|--------|-------------|--------|
| User Management | Invite users with roles | Done |
| Audit Log | Activity tracking | Done |
| Settings | Company, fiscal year config | Done |

---

## Pending Features

### Phase 2 - Compliance Enhancement
- [ ] E-Invoice generation (NIC API)
- [ ] E-Way Bill generation
- [ ] GSTR-2A/2B reconciliation
- [ ] Form 26AS download (TRACES)
- [ ] TDS return preparation

### Phase 3 - Integration
- [ ] Practice Manager sync
- [ ] Bank statement auto-import
- [ ] WhatsApp notifications
- [ ] Email reminders

### Phase 4 - AI & Analytics
- [ ] AI Assistant (Claude API)
- [ ] Custom dashboard builder
- [ ] Advanced analytics
- [ ] Predictive insights

---

## Database Schema Overview

### Core Tables (15)
- `users`, `companies`, `companyUsers`, `userInvitations`
- `fiscalYears`, `chartOfAccounts`, `costCenters`
- `journalEntries`, `journalEntryLines`
- `parties`, `bankAccounts`, `attachments`, `auditLog`
- `recurringEntryTemplates`, `trialBalanceCache`

### Transaction Tables (6)
- `invoices`, `invoiceLines`
- `expenses`
- `quotes`, `salesOrders`, `purchaseOrders`
- `bills`, `creditNotes`, `debitNotes`
- `paymentsReceived`, `paymentsMade`

### GST Tables (6)
- `gstConfig`, `gstr1Entries`, `gstr3bSummary`
- `itcRegister`, `gstPayments`, `hsnSacMaster`

### TDS Tables (4)
- `tdsSections`, `tdsDeductions`, `tdsChallans`, `form26asEntries`

### Integration Tables (4)
- `pmIntegrationConfig`, `pmSyncLog`
- `aiConversations`, `financialStatementRuns`

---

## API Routes

### Authentication
```
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/logout
```

### Companies
```
GET    /api/companies
POST   /api/companies
POST   /api/companies/:id/select
```

### Chart of Accounts
```
GET    /api/chart-of-accounts
POST   /api/chart-of-accounts
GET    /api/chart-of-accounts/ledgers/list
GET    /api/chart-of-accounts/:id/transactions
```

### Journal Entries
```
GET    /api/journal-entries
POST   /api/journal-entries
PATCH  /api/journal-entries/:id
POST   /api/journal-entries/:id/post
POST   /api/journal-entries/:id/reverse
```

### Sales
```
/api/customers, /api/quotes, /api/sales-orders
/api/invoices, /api/payments-received, /api/credit-notes
```

### Purchases
```
/api/vendors, /api/purchase-orders, /api/bills
/api/expenses, /api/payments-made, /api/debit-notes
```

### Banking
```
/api/bank-accounts, /api/bank-reconciliation, /api/bank-import
```

### Reports
```
GET /api/trial-balance
GET /api/financial-statements/balance-sheet
GET /api/financial-statements/profit-loss
GET /api/financial-statements/cash-flow
```

### Compliance
```
/api/gst/*, /api/tds/*
```

---

## Key Files Reference

| Purpose | File |
|---------|------|
| Database Schema | `shared/schema.ts` |
| API Routes | `server/src/routes/*.ts` |
| Pages | `client/src/pages/*.tsx` |
| Sidebar | `client/src/components/layout/Sidebar.tsx` |
| App Routes | `client/src/App.tsx` |
| Test Setup | `tests/setup.ts` |
| Seed Data | `server/src/db/seed.ts` |

---

## Change Log

### 2025-02-09 (Session 6 - Multi-Standard Templates & Entity-Type Awareness)

**New Features:**

1. **Entity-Type-Aware India GAAP Templates:**
   - Company (Pvt Ltd/Public/OPC): Share Capital, Reserves & Surplus
   - Partnership: Partners' Capital, Partners' Current Accounts
   - LLP: Partners' Contribution, Reserves
   - Proprietorship: Proprietor's Capital, Drawings Account

2. **Multiple Accounting Standards:**
   - India GAAP (auto-detect based on company type)
   - US GAAP (Common Stock, Retained Earnings, AOCI)
   - IFRS (Issued Capital, Revaluation Surplus, Non-controlling Interests)

3. **Template Selection Dialog:**
   - Visual selection of accounting standard
   - Auto-detect option reads company type and applies correct template
   - Info panel explains equity structure differences

4. **Backend Enhancements:**
   - `getTemplateForCompanyType()` helper function
   - `autoDetect` parameter in template application
   - Extended `gaap_standard` enum with Partnership/LLP/Proprietorship variants

**Files Modified:**
- `server/src/db/seed.ts` - Complete rewrite with 6 templates, modular account structures
- `server/src/routes/chartOfAccounts.ts` - Auto-detect logic, company type mapping
- `shared/schema.ts` - Extended gaapStandardEnum
- `client/src/pages/ChartOfAccounts.tsx` - Template selection dialog

---

### 2025-02-09 (Session 5 - Chart of Accounts CRUD Fix)

**Critical Fix: Add Account Button Was Non-Functional**
- The "Add Account" button existed but had no onClick handler
- No form dialog was implemented for creating accounts
- Backend endpoints existed but frontend was incomplete

**Changes Made:**

1. **Full CRUD Implementation for Chart of Accounts:**
   - Added `showAddDialog`, `showEditDialog`, `showDeleteDialog` state
   - Added `formData` state for form fields
   - Added `createAccountMutation` for POST /api/chart-of-accounts
   - Added `updateAccountMutation` for PATCH /api/chart-of-accounts/:id
   - Added `deleteAccountMutation` for DELETE /api/chart-of-accounts/:id
   - Added `initializeTemplateMutation` for POST /api/chart-of-accounts/templates/apply

2. **Add Account Dialog with Fields:**
   - Account Code, Account Name (required)
   - Account Type (asset/liability/equity/income/expense)
   - Parent Account (dropdown of group accounts)
   - Is Group Account checkbox
   - Description
   - Opening Balance with Debit/Credit type
   - GST Settings (applicable, rate, HSN/SAC code)

3. **Edit Account Dialog:**
   - Same fields as Add dialog
   - Fetches full account details on edit

4. **Delete Confirmation Dialog**

5. **Template Initialization:**
   - Template selection dialog with multiple accounting standards
   - New backend endpoint: POST /api/chart-of-accounts/templates/apply
   - Applies comprehensive templates (90+ accounts each)

6. **AccountRow Edit/Delete Buttons:**
   - Edit button for all accounts
   - Delete button for non-group accounts

**Files Modified:**
- `client/src/pages/ChartOfAccounts.tsx` - Complete CRUD implementation
- `server/src/routes/chartOfAccounts.ts` - Added /templates/apply endpoint

---

### 2025-02-09 (Session 4 - CRUD Delete & Template Fixes)

**Delete Functionality Added:**
- Added delete mutations and buttons to: Invoices, SalesOrders, Bills, PurchaseOrders, CreditNotes, DebitNotes, Expenses, PaymentsReceived, PaymentsMade
- Each page now has proper delete with confirmation dialogs
- Backend status checks enforced (e.g., only draft invoices can be deleted)

**Document Template Fixes:**
- Fixed invoice/quote line item amount calculation (qty × rate, not including tax)
- Fixed HSN/SAC field mapping (`hsnSacCode` → `hsnSac`)
- Removed status badge for non-overdue documents (no more "DRAFT" on final invoices)
- Removed "Generated by Zara Books" footer
- Fixed double commas in addresses with `cleanAddressPart()` helper
- Improved print CSS with proper `@page` rules

**Bug Fixes:**
- Purchase Orders: Fixed field name mismatch (`poNumber`/`poDate` → `orderNumber`/`orderDate`)
- Bills: Fixed delete to allow 'draft' and 'pending' (open) statuses
- Bills: Added journal entry cleanup on deletion

**Files Modified:**
- `client/src/pages/Invoices.tsx` - Added deleteInvoiceMutation
- `client/src/pages/SalesOrders.tsx` - Added deleteOrderMutation
- `client/src/pages/Bills.tsx` - Added deleteBillMutation, fixed status condition
- `client/src/pages/PurchaseOrders.tsx` - Fixed interface fields, added deletePOMutation
- `client/src/pages/CreditNotes.tsx` - Added deleteCreditNoteMutation
- `client/src/pages/DebitNotes.tsx` - Added deleteDebitNoteMutation
- `client/src/pages/Expenses.tsx` - Added deleteExpenseMutation
- `client/src/pages/PaymentsReceived.tsx` - Added deletePaymentMutation
- `client/src/pages/PaymentsMade.tsx` - Added deletePaymentMutation
- `client/src/pages/Quotes.tsx` - Already had delete (verified)
- `client/src/lib/document-templates/templates/*.ts` - All 4 templates updated
- `server/src/routes/bills.ts` - Fixed delete status check, added journal cleanup

### 2025-02-07 (Session 2 - Zoho Books Parity)

**New Pages Created (11):**
- `Quotes.tsx` - Quote management with convert-to-invoice
- `SalesOrders.tsx` - Sales order tracking
- `PaymentsReceived.tsx` - Customer payment tracking
- `CreditNotes.tsx` - Customer credit notes
- `Bills.tsx` - Vendor bill management
- `PurchaseOrders.tsx` - Purchase order management
- `PaymentsMade.tsx` - Vendor payment tracking
- `DebitNotes.tsx` - Vendor debit notes
- `BankAccounts.tsx` - Bank account management
- `BankReconciliation.tsx` - Transaction reconciliation
- `Products.tsx` - Products & services catalog

**Sidebar Reorganization:**
- Items: Products & Services
- Sales: Customers, Quotes, Sales Orders, Invoices, Payments Received, Credit Notes
- Purchases: Vendors, Purchase Orders, Bills, Payments Made, Expenses, Debit Notes
- Banking: Bank Accounts, Bank Reconciliation, Bank Import
- Accountant: Chart of Accounts, Journal Entries, Ledger View, Recurring Entries, Parties
- Reports: Trial Balance, Balance Sheet, P&L, Cash Flow, Aging Reports
- Compliance: GST Returns, TDS Register

**Files Modified:**
- `client/src/App.tsx` - Added routes for 11 new pages
- `client/src/components/layout/Sidebar.tsx` - Complete restructure

### 2025-02-07 (Session 1 - Test Fixes)

**Test Infrastructure:**
- Fixed all 123 tests (74 unit + 49 integration)
- Fixed column name `passwordHash` → `password` in test files
- Fixed decimal assertions (`'18.00'` format)
- Added unique constraint on `companies.pan`
- Added unique index on `(companyId, code)` for chart_of_accounts
- Updated test database URL

**Files Modified:**
- `shared/schema.ts` - Added uniqueIndex import, constraints
- `tests/setup.ts` - Fixed default DB URL
- `tests/integration/*.ts` - Fixed column names and assertions

### 2025-02-06 (Initial Development)

**Core Features Implemented:**
- Multi-company support with user roles
- Chart of Accounts with India GAAP template
- Journal Entry system with double-entry validation
- Trial Balance with real-time calculation
- Financial Statements (Schedule III)
- GST module (GSTR-1, GSTR-3B, ITC)
- TDS module
- User management with invitations
- Customer and Vendor management
- Invoice and Expense tracking

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://localhost/zarabooks

# Session
SESSION_SECRET=your-session-secret

# AI (optional)
ANTHROPIC_API_KEY=your-api-key

# E-Invoice (optional)
NIC_EINVOICE_CLIENT_ID=
NIC_EINVOICE_CLIENT_SECRET=

# TRACES (optional)
TRACES_API_TAN=
TRACES_API_USER=
TRACES_API_PASSWORD=
```

---

## Deployment

### Railway
```bash
# Deploy
npx @railway/cli up

# Check status
npx @railway/cli status

# View logs
npx @railway/cli logs

# Health check
curl https://scintillating-stillness-production-02d4.up.railway.app/api/health
```

### Database
```bash
# Push schema
npm run db:push

# Seed data
npm run db:seed

# Open Drizzle Studio
npm run db:studio
```

---

## Session Notes

_Add notes during development sessions_

### Current Session
- Added professional documentation (README, SOP, CHANGELOG)
- Updated CLAUDE.md with comprehensive project memory

---

*Last Updated: 2025-02-09*
