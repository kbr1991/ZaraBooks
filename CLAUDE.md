# Zara Books - Development Guide

## Project Overview

Zara Books is a full-featured accounting application for the services industry, targeting CA firms and startups. It can be used standalone or integrated with the CA Practice Manager.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Styling**: Tailwind CSS + shadcn/ui patterns
- **State Management**: React Query (TanStack Query)
- **Forms**: React Hook Form + Zod validation

## Project Structure

```
ZaraBooks/
├── client/                 # React frontend
│   └── src/
│       ├── components/     # UI components
│       │   └── ui/         # Reusable UI primitives
│       ├── pages/          # Page components
│       ├── hooks/          # Custom hooks
│       └── lib/            # Utilities
├── server/                 # Express backend
│   └── src/
│       ├── routes/         # API route handlers
│       ├── services/       # Business logic services
│       ├── middleware/     # Express middleware
│       └── db/             # Database config
├── shared/                 # Shared types and schema
│   └── schema.ts           # Drizzle schema
└── docs/                   # Documentation
```

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### Installation

```bash
cd ZaraBooks

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your database credentials

# Run database migrations
npm run db:push

# Seed initial data
npm run db:seed

# Start development server
npm run dev
```

The app runs on:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

## Database Schema

The schema is defined in `shared/schema.ts` using Drizzle ORM. Key tables:

### Core Tables
- `users` - User accounts
- `companies` - Company records
- `companyUsers` - User-company relationships with roles
- `fiscalYears` - Accounting periods
- `chartOfAccounts` - Account hierarchy
- `journalEntries` - Transaction headers
- `journalEntryLines` - Transaction lines
- `parties` - Customers, vendors, employees

### GST Tables
- `gstConfig` - GST registration settings
- `gstr1Entries` - Outward supplies
- `gstr3bSummary` - Monthly summaries
- `itcRegister` - Input tax credit
- `gstPayments` - GST payment challans

### TDS Tables
- `tdsSections` - TDS section master
- `tdsDeductions` - TDS deducted
- `tdsChallans` - TDS payments
- `form26asEntries` - Tax credit statement

## Key Concepts

### Double-Entry Accounting
Every journal entry must balance (debits = credits). The system validates this before saving.

### Chart of Accounts
5-level hierarchy following India GAAP (Schedule III):
1. Category (Asset, Liability, Equity, Income, Expense)
2. Group
3. Sub-Group
4. Account
5. Sub-Account

### Fiscal Years
Configurable fiscal year (default: April-March for India). Years can be locked to prevent modifications.

### Journal Entry Status
- `draft` - Editable, not affecting reports
- `posted` - Finalized, affects reports
- `reversed` - Cancelled via reversal entry

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Current user
- `POST /api/auth/logout` - Logout

### Companies
- `GET /api/companies` - List user's companies
- `POST /api/companies` - Create company
- `POST /api/companies/:id/select` - Switch company

### Chart of Accounts
- `GET /api/chart-of-accounts` - Get accounts (hierarchical)
- `POST /api/chart-of-accounts` - Create account
- `GET /api/chart-of-accounts/ledgers/list` - Flat list of ledger accounts

### Journal Entries
- `GET /api/journal-entries` - List entries
- `POST /api/journal-entries` - Create entry
- `PATCH /api/journal-entries/:id` - Update entry
- `POST /api/journal-entries/:id/post` - Post entry
- `POST /api/journal-entries/:id/reverse` - Reverse entry

### Reports
- `GET /api/trial-balance` - Trial balance
- `GET /api/financial-statements/balance-sheet` - Balance sheet
- `GET /api/financial-statements/profit-loss` - P&L statement
- `GET /api/trial-balance/export` - Excel export

### GST
- `GET /api/gst/config` - GST settings
- `GET /api/gst/gstr1?period=MMYYYY` - GSTR-1 data
- `GET /api/gst/gstr3b?period=MMYYYY` - GSTR-3B summary
- `GET /api/gst/itc?period=MMYYYY` - ITC register

### TDS
- `GET /api/tds/sections` - TDS section master
- `GET /api/tds/deductions` - TDS deductions
- `POST /api/tds/deductions` - Record TDS
- `GET /api/tds/challans` - TDS challans

## Development Commands

```bash
# Start dev server (frontend + backend)
npm run dev

# Generate database migrations
npm run db:generate

# Push schema changes
npm run db:push

# Open Drizzle Studio
npm run db:studio

# Seed database
npm run db:seed

# Build for production
npm run build

# Start production server
npm run start
```

## India GAAP Compliance

The system follows Schedule III of the Companies Act for financial statement presentation:

### Balance Sheet Format
- **Assets**
  - Non-current Assets (PPE, Intangible, Investments, etc.)
  - Current Assets (Inventories, Receivables, Cash, etc.)
- **Equity & Liabilities**
  - Shareholders' Equity
  - Non-current Liabilities
  - Current Liabilities

### P&L Format
- Revenue from Operations
- Other Income
- Total Income
- Expenses (Cost of materials, Employee benefit, Finance costs, Depreciation, Other)
- Profit Before Tax
- Tax Expense
- Profit After Tax

## GST Compliance

### Supported Returns
- GSTR-1 (Outward Supplies)
- GSTR-3B (Summary Return)
- ITC Register with 2A/2B reconciliation

### Features
- HSN/SAC code mapping
- E-Invoice generation (via NIC API)
- E-Way Bill generation (via NIC API)

## TDS Compliance

### Supported Sections
- 192 (Salary)
- 194A (Interest)
- 194C (Contractor)
- 194H (Commission)
- 194I (Rent)
- 194J (Professional Services)

### Features
- TDS deduction tracking
- Challan generation
- Form 26AS matching
- TRACES integration

## Integration

### Practice Manager Integration
When integrated with CA Practice Manager:
- Automatic journal entries from invoices
- Payment sync to bank entries
- Expense sync to expense entries
- Client import

Configure in Settings > Integration.

## Environment Variables

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/zarabooks
SESSION_SECRET=your-secret-key
ANTHROPIC_API_KEY=your-api-key  # For AI assistant
NIC_API_URL=https://einvoice1.gst.gov.in
NIC_API_KEY=your-nic-key  # For e-invoice
TRACES_API_URL=https://www.tdscpc.gov.in
```

## Common Tasks

### Adding a New Account Type
1. Update enum in `shared/schema.ts`
2. Add to CoA template in `db/seed.ts`
3. Update Schedule III mappings

### Adding a New GST Return Section
1. Add table in `shared/schema.ts`
2. Create route in `server/src/routes/gst.ts`
3. Add UI in `client/src/pages/GSTReturns.tsx`

### Adding a New Report
1. Create route in `server/src/routes/financialStatements.ts`
2. Add export function in `server/src/services/excelExport.ts`
3. Create page in `client/src/pages/`
4. Add route in `client/src/App.tsx`

## Testing

```bash
# Run tests (when implemented)
npm test

# Run specific test file
npm test -- --grep "journal entries"
```

## Deployment

### Railway

1. Create new service in Railway
2. Connect to GitHub repository
3. Set environment variables
4. Deploy

### Docker

```bash
docker build -t zarabooks .
docker run -p 3001:3001 -e DATABASE_URL=... zarabooks
```

## Contributing

1. Create feature branch
2. Make changes
3. Test locally
4. Submit PR

## Support

For issues, create a GitHub issue or contact support.
