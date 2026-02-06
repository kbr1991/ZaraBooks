# Changelog

All notable changes to Zara Books will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- E-Invoice integration with NIC API
- GSTR-2A/2B reconciliation
- WhatsApp notifications
- Practice Manager integration

---

## [1.1.0] - 2025-02-07

### Added - Sales & Purchase Modules (Zoho Books Parity)

#### Sales
- **Quotes/Estimates** - Create quotes with items, convert to invoice
- **Sales Orders** - Track orders before invoicing
- **Payments Received** - Customer payment tracking with multiple modes
- **Credit Notes** - Customer refunds and adjustments

#### Purchases
- **Bills** - Vendor invoice management with payment tracking
- **Purchase Orders** - PO creation and management
- **Payments Made** - Vendor payment tracking
- **Debit Notes** - Vendor adjustments

#### Banking
- **Bank Accounts** - Multi-account management with balances
- **Bank Reconciliation** - Match transactions with statements

#### Inventory
- **Products & Services** - Item catalog with HSN/SAC codes, rates, inventory tracking

### Changed
- Reorganized sidebar menu structure to match Zoho Books:
  - Items, Sales, Purchases, Banking, Accountant, Reports, Compliance
- Updated navigation icons for better visual hierarchy

---

## [1.0.1] - 2025-02-07

### Fixed
- Integration tests now pass (123/123)
- Fixed `passwordHash` → `password` column name in test files
- Fixed decimal format assertions (`'18.00'` vs `'18'`)
- Added unique constraint on `companies.pan`
- Added unique index on `(companyId, code)` for chart of accounts
- Updated default test database URL to use localhost

---

## [1.0.0] - 2025-02-06

### Added - Initial Release

#### Core Accounting
- **Multi-Company Support** - Manage multiple companies with user roles
- **Chart of Accounts** - 5-level hierarchy with India GAAP template
- **Journal Entries** - Manual entries with double-entry validation
- **Trial Balance** - Real-time calculation with period filtering
- **Financial Statements** - Balance Sheet, P&L, Cash Flow (Schedule III format)
- **Ledger View** - Account-wise transaction history

#### Sales & Customers
- **Customer Management** - GSTIN, PAN, contact details
- **Invoices** - GST-compliant invoicing with line items

#### Purchases & Vendors
- **Vendor Management** - Supplier database with compliance fields
- **Expenses** - Expense tracking with approval workflow

#### Compliance (India)
- **GST Module** - GSTR-1, GSTR-3B data preparation
- **TDS Register** - TDS deduction and challan tracking
- **HSN/SAC Master** - Tax code management

#### Banking
- **Bank Import** - CSV/OFX statement import

#### Administration
- **User Management** - Invite users with role-based access
- **Audit Log** - Activity tracking
- **Settings** - Company configuration, fiscal years

#### Integrations
- **Practice Manager** - Sync configuration
- **TRACES** - TDS verification integration

### Technical
- React 18 with TypeScript
- Express.js backend
- PostgreSQL with Drizzle ORM
- Vitest for testing (74 unit + 49 integration tests)
- Railway deployment

---

## Version History Summary

| Version | Date | Highlights |
|---------|------|------------|
| 1.1.0 | 2025-02-07 | Sales/Purchase modules, Banking, Products |
| 1.0.1 | 2025-02-07 | Test fixes, unique constraints |
| 1.0.0 | 2025-02-06 | Initial release with core accounting |

---

[Unreleased]: https://github.com/kbr1991/ZaraBooks/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/kbr1991/ZaraBooks/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/kbr1991/ZaraBooks/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/kbr1991/ZaraBooks/releases/tag/v1.0.0
