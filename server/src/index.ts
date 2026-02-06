import express, { type Request, Response, NextFunction } from 'express';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes
import authRoutes from './routes/auth';
import companiesRoutes from './routes/companies';
import chartOfAccountsRoutes from './routes/chartOfAccounts';
import journalEntriesRoutes from './routes/journalEntries';
import trialBalanceRoutes from './routes/trialBalance';
import financialStatementsRoutes from './routes/financialStatements';
import partiesRoutes from './routes/parties';
import gstRoutes from './routes/gst';
import tdsRoutes from './routes/tds';
import dashboardRoutes from './routes/dashboard';
import assistantRoutes from './routes/assistant';
import pmIntegrationRoutes from './routes/pmIntegration';
import bankImportRoutes from './routes/bankImport';
import recurringEntriesRoutes from './routes/recurringEntries';
import agingReportsRoutes from './routes/agingReports';
import currenciesRoutes from './routes/currencies';
import auditLogRoutes from './routes/auditLog';
import coaImportRoutes from './routes/coaImport';
import userManagementRoutes from './routes/userManagement';
import invoicesRoutes from './routes/invoices';
import expensesRoutes from './routes/expenses';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Trust proxy for Railway/production
app.set('trust proxy', 1);

// Session configuration
const PgSession = pgSession(session);
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: 'sessions',
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || 'zara-books-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    },
  })
);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/chart-of-accounts', chartOfAccountsRoutes);
app.use('/api/journal-entries', journalEntriesRoutes);
app.use('/api/trial-balance', trialBalanceRoutes);
app.use('/api/financial-statements', financialStatementsRoutes);
app.use('/api/parties', partiesRoutes);
app.use('/api/gst', gstRoutes);
app.use('/api/tds', tdsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/assistant', assistantRoutes);
app.use('/api/pm-integration', pmIntegrationRoutes);
app.use('/api/bank-import', bankImportRoutes);
app.use('/api/recurring-entries', recurringEntriesRoutes);
app.use('/api/aging', agingReportsRoutes);
app.use('/api/currencies', currenciesRoutes);
app.use('/api/audit-log', auditLogRoutes);
app.use('/api/coa-import', coaImportRoutes);
app.use('/api/users', userManagementRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/expenses', expensesRoutes);

// Health check (basic - always returns ok for Railway health checks)
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'zara-books' });
});

// Detailed health check with database
app.get('/api/health/detailed', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      status: 'ok',
      service: 'zara-books',
      database: 'connected',
      timestamp: result.rows[0].now,
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      service: 'zara-books',
      database: 'disconnected',
      error: 'Database connection failed',
    });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../dist/client');
  app.use(express.static(clientDist));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Error handling
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Zara Books server running on port ${PORT}`);
});
