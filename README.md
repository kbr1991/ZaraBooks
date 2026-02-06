# Zara Books

A modern, full-featured accounting application for the services industry, built with React, Express, and PostgreSQL. Designed for CA firms and startups with India GAAP (Schedule III) compliance.

## Features

### Core Accounting
- **Double-Entry Bookkeeping** - Automatic balance validation
- **Chart of Accounts** - 5-level hierarchy with India GAAP template
- **Journal Entries** - Manual and auto-generated entries
- **Trial Balance** - Real-time calculation with drill-down
- **Financial Statements** - Balance Sheet, P&L, Cash Flow (Schedule III format)

### Sales
- **Customers** - Customer management with receivables tracking
- **Quotes** - Estimates with convert-to-invoice workflow
- **Sales Orders** - Order management before invoicing
- **Invoices** - GST-compliant invoicing with e-invoice support
- **Payments Received** - Customer payment tracking
- **Credit Notes** - Customer refunds and adjustments

### Purchases
- **Vendors** - Vendor management with payables tracking
- **Purchase Orders** - PO management
- **Bills** - Vendor invoice tracking with payment workflow
- **Expenses** - Expense tracking with approval workflow
- **Payments Made** - Vendor payment tracking
- **Debit Notes** - Vendor adjustments

### Banking
- **Bank Accounts** - Multi-bank account management
- **Bank Reconciliation** - Transaction matching
- **Bank Import** - Statement import (CSV/OFX)

### Compliance (India)
- **GST Returns** - GSTR-1, GSTR-3B preparation
- **TDS Register** - TDS deduction and challan tracking
- **E-Invoice** - NIC API integration
- **TRACES** - Form 26AS integration

### Additional Features
- **Products & Services** - Item catalog with HSN/SAC codes
- **Multi-Company** - Manage multiple companies
- **User Roles** - Owner, Accountant, Auditor, Viewer
- **Audit Log** - Complete activity tracking
- **AI Assistant** - Natural language queries (Claude API)

## Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS, React Query, React Router
- **Backend**: Express.js, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **UI Components**: Radix UI primitives (shadcn/ui)
- **Charts**: Recharts, D3.js
- **Excel Export**: ExcelJS

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/kbr1991/ZaraBooks.git
   cd ZaraBooks
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment:
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. Push database schema:
   ```bash
   npm run db:push
   ```

5. Seed initial data:
   ```bash
   npm run db:seed
   ```

6. Start development server:
   ```bash
   npm run dev
   ```

7. Open http://localhost:5173

### Default Login

- Email: `admin@example.com`
- Password: `Admin@123`

## Project Structure

```
ZaraBooks/
├── client/                 # React frontend
│   └── src/
│       ├── components/     # UI components
│       │   └── ui/         # Base primitives (shadcn)
│       ├── pages/          # Page components
│       ├── hooks/          # Custom hooks
│       └── lib/            # Utilities
├── server/                 # Express backend
│   └── src/
│       ├── routes/         # API handlers
│       ├── services/       # Business logic
│       ├── middleware/     # Auth middleware
│       └── db/             # Database config
├── shared/                 # Shared types & schema
│   └── schema.ts           # Drizzle schema
├── tests/                  # Test files
│   ├── unit/               # Unit tests
│   └── integration/        # Integration tests
└── docs/                   # Documentation
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run db:push` | Push schema to database |
| `npm run db:seed` | Seed initial data |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run test` | Run tests in watch mode |
| `npm run test:run` | Run all tests once |
| `npm run test:coverage` | Run tests with coverage |

## Deployment (Railway)

1. Create a new project on Railway
2. Add PostgreSQL database
3. Connect your GitHub repository
4. Set environment variables:
   - `DATABASE_URL` (auto-configured)
   - `SESSION_SECRET`
   - `NODE_ENV=production`
5. Deploy!

**Production URL**: https://scintillating-stillness-production-02d4.up.railway.app

## Documentation

- **Development Guide**: `CLAUDE.md`
- **Development SOP**: `DEVELOPMENT_SOP.md`
- **API Reference**: `docs/API_REFERENCE.md`
- **Changelog**: `CHANGELOG.md`

## India GAAP Compliance

The system follows Schedule III of the Companies Act 2013:

### Balance Sheet Format
- Non-current Assets (PPE, Intangible, Investments)
- Current Assets (Inventories, Receivables, Cash)
- Equity (Share Capital, Reserves)
- Non-current Liabilities
- Current Liabilities

### P&L Format
- Revenue from Operations
- Other Income
- Expenses by nature
- Profit Before/After Tax

## License

MIT License - see LICENSE file for details.

---

Built with care for the Indian accounting community.
