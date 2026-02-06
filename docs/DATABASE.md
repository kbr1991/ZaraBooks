# Database Setup Guide

## Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ installed

## Quick Start with Docker

### 1. Start PostgreSQL

```bash
# Start both development and test databases
npm run docker:up

# View logs
npm run docker:logs

# Stop databases
npm run docker:down
```

This starts two PostgreSQL containers:
- **Development DB**: `localhost:5432/zarabooks`
- **Test DB**: `localhost:5433/zarabooks_test`

### 2. Push Schema to Database

```bash
# Create tables using Drizzle
npm run db:push
```

### 3. Seed Initial Data

```bash
# Seed HSN/SAC codes, TDS sections, currencies
npm run db:setup
```

### 4. (Optional) Seed Sample Data

```bash
# Create sample companies, accounts, entries
npm run db:seed
```

## Database URLs

**Development:**
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/zarabooks
```

**Testing:**
```
TEST_DATABASE_URL=postgresql://postgres:password@localhost:5433/zarabooks_test
```

## Running Tests

### Unit Tests (no database required)
```bash
npm run test:unit
```

### Integration Tests (requires test database)
```bash
# Start test database
npm run docker:up

# Run integration tests
npm run test:integration

# Or run all tests
npm test
```

### CI/CD Pipeline
```bash
# Starts Docker, runs tests, stops Docker
npm run test:ci
```

## Database Management

### View Database with Drizzle Studio
```bash
npm run db:studio
```

### Generate Migrations
```bash
npm run db:generate
```

### Apply Migrations
```bash
npm run db:migrate
```

## Schema Overview

### Core Tables
- `users` - User accounts
- `companies` - Company records
- `company_users` - User-company relationships
- `fiscal_years` - Accounting periods
- `chart_of_accounts` - Account hierarchy
- `journal_entries` - Transaction headers
- `journal_entry_lines` - Transaction lines
- `parties` - Customers/vendors

### GST Tables
- `gst_config` - GST registration settings
- `gstr1_entries` - Outward supplies
- `gstr3b_summary` - Monthly summaries
- `itc_register` - Input tax credit
- `gst_payments` - GST payment challans
- `hsn_sac_master` - HSN/SAC codes

### TDS Tables
- `tds_sections` - TDS section master
- `tds_deductions` - TDS deducted
- `tds_challans` - TDS payments
- `form_26as_entries` - Tax credit statement

### Other Tables
- `currencies` - Currency master
- `exchange_rates` - Exchange rate history
- `audit_log` - Change tracking
- `recurring_entry_templates` - Recurring entries

## Production Deployment

### Railway PostgreSQL

1. Create a PostgreSQL database in Railway
2. Copy the connection string to your environment
3. Run migrations: `npm run db:push`
4. Seed data: `npm run db:setup`

### Environment Variables

```env
DATABASE_URL=postgresql://user:pass@host:5432/database
SESSION_SECRET=your-secure-session-secret
```

## Backup & Restore

### Backup
```bash
docker exec zarabooks-db pg_dump -U postgres zarabooks > backup.sql
```

### Restore
```bash
docker exec -i zarabooks-db psql -U postgres zarabooks < backup.sql
```

## Troubleshooting

### Connection Refused
```bash
# Check if Docker is running
docker ps

# Restart containers
npm run docker:down
npm run docker:up
```

### Schema Conflicts
```bash
# Reset database (CAUTION: deletes all data)
docker-compose down -v
npm run docker:up
npm run db:push
npm run db:setup
```

### Permission Issues
```bash
# Fix Docker permissions
sudo chown -R $(whoami) ~/.docker
```
