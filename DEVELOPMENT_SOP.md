# Zara Books - Development SOP

> Standard Operating Procedures for software development, maintained for consistency and quality.

---

## 1. Development Workflow

### 1.1 Feature Development Lifecycle

```
Request → Analysis → Design → Development → Testing → Review → Deploy → Document
```

| Phase | Description | Output |
|-------|-------------|--------|
| **Request** | Feature request or bug report | Documented requirement |
| **Analysis** | Scope, dependencies, impact assessment | Technical specification |
| **Design** | UI mockup, database schema, API design | Design document |
| **Development** | Write code following standards | Working code |
| **Testing** | Unit + integration tests | Test results (all pass) |
| **Review** | Code review, QA check | Approval |
| **Deploy** | Push to Railway | Live feature |
| **Document** | Update CLAUDE.md and changelog | Documentation |

### 1.2 Priority Levels

| Priority | Description | Response Time |
|----------|-------------|---------------|
| P0 - Critical | Production down, data loss, security breach | Immediate |
| P1 - High | Major feature broken, financial calculation error | Same day |
| P2 - Medium | Feature request, minor bug | This week |
| P3 - Low | Enhancement, UI polish | Backlog |

---

## 2. Code Standards

### 2.1 Project Structure

```
ZaraBooks/
├── client/                 # React frontend
│   └── src/
│       ├── components/     # Reusable UI components
│       │   └── ui/         # Base UI primitives (shadcn)
│       ├── pages/          # Page components (one per route)
│       ├── hooks/          # Custom React hooks
│       └── lib/            # Utilities, API client
├── server/                 # Express backend
│   └── src/
│       ├── routes/         # API route handlers
│       ├── services/       # Business logic (GST calc, Excel export)
│       ├── middleware/     # Auth, validation middleware
│       └── db/             # Database connection, seeds, migrations
├── shared/                 # Shared between client/server
│   └── schema.ts           # Drizzle schema (single source of truth)
├── tests/                  # Test files
│   ├── unit/               # Unit tests
│   └── integration/        # Integration tests with DB
└── CLAUDE.md               # Project memory
```

### 2.2 Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files (Components) | PascalCase | `InvoiceForm.tsx` |
| Files (Utilities) | camelCase | `gstCalculator.ts` |
| Files (Routes) | camelCase | `journalEntries.ts` |
| React Components | PascalCase | `function TrialBalance()` |
| Functions | camelCase | `calculateGST()` |
| Constants | SCREAMING_SNAKE | `GST_RATES` |
| Database Tables | snake_case | `journal_entries` |
| API Endpoints | kebab-case | `/api/journal-entries` |
| CSS Classes | Tailwind utilities | `className="flex items-center"` |

### 2.3 TypeScript Standards

```typescript
// Always define types for props
interface InvoiceFormProps {
  invoice?: Invoice;
  onSubmit: (data: InsertInvoice) => void;
  isEditing?: boolean;
}

// Use Zod schemas for validation (shared between client/server)
export const insertInvoiceSchema = createInsertSchema(invoices);
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

// Prefer const assertions for enums
export const ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'income', 'expense'] as const;
export type AccountType = typeof ACCOUNT_TYPES[number];

// Use decimal strings for money (not floats)
amount: decimal('amount', { precision: 18, scale: 2 })
```

### 2.4 Accounting-Specific Standards

```typescript
// Always validate double-entry balance
function validateJournalEntry(lines: JournalEntryLine[]): boolean {
  const totalDebit = lines.reduce((sum, l) => sum + parseFloat(l.debitAmount || '0'), 0);
  const totalCredit = lines.reduce((sum, l) => sum + parseFloat(l.creditAmount || '0'), 0);
  return Math.abs(totalDebit - totalCredit) < 0.01; // Allow for rounding
}

// GST calculations must match government rules
function calculateGST(amount: number, rate: number, isInterstate: boolean) {
  const gstAmount = amount * rate / 100;
  if (isInterstate) {
    return { igst: gstAmount, cgst: 0, sgst: 0 };
  }
  return { igst: 0, cgst: gstAmount / 2, sgst: gstAmount / 2 };
}
```

### 2.5 API Design Standards

```typescript
// RESTful endpoints
GET    /api/invoices           // List all (with pagination)
GET    /api/invoices/:id       // Get one
POST   /api/invoices           // Create
PATCH  /api/invoices/:id       // Update
DELETE /api/invoices/:id       // Delete
POST   /api/invoices/:id/send  // Action endpoint

// Response format - Success
{
  "success": true,
  "data": { ... },
  "message": "Invoice created successfully"
}

// Response format - Error
{
  "success": false,
  "error": "Validation failed",
  "details": { "amount": "Amount must be positive" }
}

// Pagination format
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

### 2.6 Database Schema Standards

```typescript
// Every table should have these base fields
id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
createdAt: timestamp('created_at').defaultNow().notNull(),
updatedAt: timestamp('updated_at').defaultNow().notNull(),

// Company isolation - EVERY business table needs this
companyId: varchar('company_id', { length: 36 })
  .references(() => companies.id, { onDelete: 'cascade' })
  .notNull(),

// Use decimal for money, never float
amount: decimal('amount', { precision: 18, scale: 2 }).notNull(),

// Add indexes for frequently queried fields
// Add unique constraints where needed
// Add soft delete where data preservation is important
```

---

## 3. Git Workflow

### 3.1 Branch Strategy

```
main (production)
  └── develop (staging)
       ├── feature/gstr-3b-report
       ├── feature/bank-reconciliation
       └── bugfix/trial-balance-calculation
```

| Branch | Purpose | Merges To |
|--------|---------|-----------|
| `main` | Production code | - |
| `develop` | Integration branch | `main` |
| `feature/*` | New features | `develop` |
| `bugfix/*` | Bug fixes | `develop` |
| `hotfix/*` | Critical production fixes | `main` |

### 3.2 Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting (no code change)
- `refactor`: Code restructure
- `test`: Adding tests
- `chore`: Maintenance

**Examples:**
```
feat(gst): Add GSTR-3B summary calculation

- Calculate outward supplies by type
- Calculate ITC by category
- Add tax liability computation
- Generate period-wise summary

Closes #25
```

```
fix(journal): Prevent unbalanced entries from being posted

- Add validation before status change to 'posted'
- Show user-friendly error message
- Log validation failures for debugging

Fixes #42
```

### 3.3 Pull Request Checklist

- [ ] Code follows project standards
- [ ] No TypeScript errors (`npm run build` passes)
- [ ] All tests pass (`npm run test:run`)
- [ ] API endpoints tested manually
- [ ] UI tested on desktop and mobile
- [ ] Financial calculations verified with sample data
- [ ] CLAUDE.md updated with changes
- [ ] No sensitive data in code

---

## 4. Testing Standards

### 4.1 Test Structure

```
tests/
├── unit/                    # Fast, isolated tests
│   ├── accounting.test.ts   # Double-entry validation
│   ├── gst.test.ts          # GST calculations
│   └── scheduleIII.test.ts  # Financial statement mapping
└── integration/             # Database tests
    ├── auth.test.ts
    ├── journalEntries.test.ts
    ├── trialBalance.test.ts
    └── financialStatements.test.ts
```

### 4.2 Test Commands

```bash
# Run all tests
npm run test:run

# Run unit tests only
npm run test:unit

# Run integration tests (requires test DB)
npm run test:integration

# Run with coverage
npm run test:coverage

# Run in watch mode
npm test
```

### 4.3 Writing Tests

```typescript
// Unit test example
describe('GST Calculations', () => {
  it('should calculate IGST for interstate supply', () => {
    const result = calculateGST(10000, 18, true);
    expect(result.igst).toBe(1800);
    expect(result.cgst).toBe(0);
    expect(result.sgst).toBe(0);
  });
});

// Integration test example
describe('Journal Entries API', () => {
  beforeEach(async () => {
    await clearTestDb();
    await seedTestData();
  });

  it('should create a balanced journal entry', async () => {
    const entry = await createJournalEntry({
      lines: [
        { accountId: cashAccount, debitAmount: '1000' },
        { accountId: revenueAccount, creditAmount: '1000' },
      ]
    });
    expect(entry.status).toBe('draft');
  });
});
```

### 4.4 Manual Testing Checklist

Before deploying any feature:

- [ ] **Happy Path** - Feature works as expected
- [ ] **Edge Cases** - Empty states, max limits, special characters
- [ ] **Error Handling** - Invalid input, network errors
- [ ] **Authentication** - Works for logged-in users only
- [ ] **Authorization** - Role-based access respected
- [ ] **Financial Accuracy** - Calculations match manual computation
- [ ] **Double-Entry** - All entries balance
- [ ] **Responsive** - Works on mobile/tablet/desktop

---

## 5. Deployment Process

### 5.1 Railway Deployment

```bash
# 1. Run tests locally
npm run test:run

# 2. Build to catch any errors
npm run build

# 3. Commit changes
git add .
git commit -m "feat(module): description"

# 4. Push to main (auto-deploys)
git push origin main

# 5. Deploy manually if needed
npx @railway/cli up

# 6. Monitor logs
npx @railway/cli logs

# 7. Verify deployment
curl https://scintillating-stillness-production-02d4.up.railway.app/api/health
```

### 5.2 Database Migrations

```bash
# Schema changes via Drizzle push
npm run db:push

# For production
DATABASE_URL="..." npm run db:push

# Generate migration files (if needed)
npm run db:generate
```

### 5.3 Rollback Procedure

```bash
# Revert last commit
git revert HEAD
git push origin main

# Or reset to specific commit (destructive)
git reset --hard <commit-hash>
git push --force origin main

# Database: Drizzle doesn't auto-rollback
# Keep backup before major schema changes
```

---

## 6. Security Guidelines

### 6.1 Code Security

- Never commit secrets, API keys, or passwords
- Use environment variables for all sensitive config
- Validate all user input (client AND server)
- Use parameterized queries (Drizzle handles this)
- Implement rate limiting on auth endpoints
- Sanitize data before Excel/PDF export

### 6.2 Financial Data Security

- All financial data isolated by company
- Audit log for all changes
- Period locking to prevent backdated entries
- Role-based access (Owner > Accountant > Auditor > Viewer)
- Sensitive fields (bank details) encrypted at rest

### 6.3 Sensitive Files (Never Commit)

```
.env
.env.local
*.pem
*.key
credentials.json
```

---

## 7. Documentation Standards

### 7.1 Code Comments

```typescript
// Use comments for WHY, not WHAT

// Bad:
// Loop through journal entries
entries.forEach(e => ...);

// Good:
// Exclude reversed entries to prevent double-counting in trial balance
entries.filter(e => e.status !== 'reversed').forEach(e => ...);

/**
 * Calculate trial balance for a fiscal period
 *
 * Algorithm:
 * 1. Get opening balances from previous period close
 * 2. Sum all posted journal entry lines for the period
 * 3. Group by account and compute closing balance
 *
 * @param companyId - Company to calculate for
 * @param fiscalYearId - Fiscal year context
 * @param asOfDate - Calculate balances as of this date
 */
```

### 7.2 Update CLAUDE.md

After every significant change:
1. Add entry to Change Log with date
2. Update Completed/Pending features
3. Add session notes if relevant
4. Update version if releasing

---

## 8. Module Development Template

When building a new module, follow this sequence:

### Step 1: Database Schema
```typescript
// shared/schema.ts
export const quotes = pgTable('quotes', {
  id: varchar('id', { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar('company_id', { length: 36 }).references(() => companies.id).notNull(),
  // ... fields
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

### Step 2: API Routes
```typescript
// server/src/routes/quotes.ts
import { Router } from 'express';
const router = Router();

router.get('/', async (req, res) => { ... });
router.get('/:id', async (req, res) => { ... });
router.post('/', async (req, res) => { ... });
router.patch('/:id', async (req, res) => { ... });
router.delete('/:id', async (req, res) => { ... });

export default router;
```

### Step 3: Register Route
```typescript
// server/src/index.ts
import quotesRouter from './routes/quotes';
app.use('/api/quotes', requireAuth, quotesRouter);
```

### Step 4: Frontend Page
```typescript
// client/src/pages/Quotes.tsx
export default function Quotes() {
  // List view with create/edit dialog
}
```

### Step 5: Add Route
```typescript
// client/src/App.tsx
const Quotes = lazy(() => import('@/pages/Quotes'));
<Route path="quotes" element={<Suspense><Quotes /></Suspense>} />
```

### Step 6: Add to Sidebar
```typescript
// client/src/components/layout/Sidebar.tsx
{ label: 'Quotes', path: '/quotes', icon: <ClipboardList /> }
```

### Step 7: Write Tests
```typescript
// tests/integration/quotes.test.ts
describe('Quotes API', () => {
  it('should create a quote', async () => { ... });
  it('should convert quote to invoice', async () => { ... });
});
```

### Step 8: Update Documentation
- Add to CLAUDE.md change log
- Update README if significant feature
- Update CHANGELOG.md

---

## 9. Versioning

### Semantic Versioning

```
MAJOR.MINOR.PATCH (e.g., 1.2.3)

MAJOR: Breaking changes, major rewrites
MINOR: New features (backward compatible)
PATCH: Bug fixes, minor improvements
```

### Version History

| Version | Date | Description |
|---------|------|-------------|
| 1.0.0 | Feb 2025 | Initial release - Core accounting, GST, TDS |
| 1.1.0 | Feb 2025 | Added Sales & Purchase modules (Zoho Books parity) |

---

*Last Updated: 2025-02-07*
