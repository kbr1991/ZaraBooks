# Contributing to Zara Books

Thank you for your interest in contributing to Zara Books! This document provides guidelines and instructions for contributing.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the issue, not the person
- Help others learn and grow

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Git

### Development Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/ZaraBooks.git
   cd ZaraBooks
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Set up environment:
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

5. Set up database:
   ```bash
   npm run db:push
   npm run db:seed
   ```

6. Run tests to verify setup:
   ```bash
   npm run test:run
   ```

7. Start development server:
   ```bash
   npm run dev
   ```

## Development Workflow

### Branch Naming

- `feature/description` - New features
- `bugfix/description` - Bug fixes
- `hotfix/description` - Critical production fixes
- `docs/description` - Documentation updates

### Commit Messages

Follow the conventional commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructure
- `test`: Adding tests
- `chore`: Maintenance

**Example:**
```
feat(invoices): Add bulk invoice generation

- Added batch invoice creation from sales orders
- Implemented progress tracking
- Added email notification on completion

Closes #123
```

### Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Run tests: `npm run test:run`
4. Build: `npm run build`
5. Update documentation if needed
6. Submit PR with clear description

### PR Checklist

- [ ] Code follows project standards (see `DEVELOPMENT_SOP.md`)
- [ ] No TypeScript errors
- [ ] All tests pass (123 tests)
- [ ] New features have tests
- [ ] Documentation updated
- [ ] CLAUDE.md changelog updated
- [ ] No console.logs or debug code
- [ ] No hardcoded secrets

## Code Standards

### TypeScript

```typescript
// Use interfaces for props
interface InvoiceProps {
  invoice: Invoice;
  onSave: (data: Invoice) => void;
}

// Use proper typing
const calculateTotal = (items: InvoiceLineItem[]): number => {
  return items.reduce((sum, item) => sum + item.amount, 0);
};
```

### React Components

```typescript
// Functional components with hooks
export default function InvoiceList() {
  const { data, isLoading } = useQuery({...});

  if (isLoading) return <Skeleton />;

  return (
    <div className="space-y-4">
      {/* Component content */}
    </div>
  );
}
```

### API Routes

```typescript
// RESTful design
router.get('/', async (req, res) => {
  try {
    const data = await db.query...
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### Database

```typescript
// Use Drizzle ORM patterns
const invoice = await db.insert(invoices)
  .values(invoiceData)
  .returning();
```

## Testing

### Running Tests

```bash
# All tests
npm run test:run

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# With coverage
npm run test:coverage
```

### Writing Tests

```typescript
describe('Invoice Creation', () => {
  it('should create invoice with valid data', async () => {
    const invoice = await createInvoice(validData);
    expect(invoice.status).toBe('draft');
  });

  it('should reject invalid GST', async () => {
    await expect(createInvoice(invalidGST))
      .rejects.toThrow('Invalid GSTIN');
  });
});
```

## Reporting Issues

### Bug Reports

Include:
- Description of the bug
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots (if applicable)
- Environment (OS, browser, Node version)

### Feature Requests

Include:
- Use case description
- Proposed solution
- Alternatives considered
- Impact on existing features

## Questions?

- Check existing issues and documentation
- Open a discussion for general questions
- Contact maintainers for sensitive issues

---

Thank you for contributing to Zara Books!
