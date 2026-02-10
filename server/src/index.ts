import express, { type Request, Response, NextFunction } from 'express';
import session from 'express-session';
import pgSession from 'connect-pg-simple';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { sanitizeInput } from './middleware/sanitize';

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
import productsRoutes from './routes/products';
import bankAccountsRoutes from './routes/bankAccounts';
import costCentersRoutes from './routes/costCenters';
import quotesRoutes from './routes/quotes';
import salesOrdersRoutes from './routes/salesOrders';
import creditNotesRoutes from './routes/creditNotes';
import billsRoutes from './routes/bills';
import purchaseOrdersRoutes from './routes/purchaseOrders';
import debitNotesRoutes from './routes/debitNotes';
import paymentsReceivedRoutes from './routes/paymentsReceived';
import paymentsMadeRoutes from './routes/paymentsMade';
import bankReconciliationRoutes from './routes/bankReconciliation';
import documentTemplatesRoutes from './routes/documentTemplates';

// Multi-tenancy routes
import adminRoutes from './routes/admin';
import partnerRoutes from './routes/partner';
import tenantRoutes from './routes/tenant';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Security headers with helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// General API rate limiting (100 requests per minute)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiting for auth endpoints (5 attempts per 15 minutes)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: { error: 'Too many login attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed attempts
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Apply input sanitization to prevent XSS attacks
app.use(sanitizeInput);

// Trust proxy for Railway/production
app.set('trust proxy', 1);

// Apply rate limiting to API routes
app.use('/api/', apiLimiter);

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
// Apply strict rate limiting to login endpoint
app.use('/api/auth/login', authLimiter);
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
app.use('/api/products', productsRoutes);
app.use('/api/bank-accounts', bankAccountsRoutes);
app.use('/api/cost-centers', costCentersRoutes);
app.use('/api/quotes', quotesRoutes);
app.use('/api/sales-orders', salesOrdersRoutes);
app.use('/api/credit-notes', creditNotesRoutes);
app.use('/api/bills', billsRoutes);
app.use('/api/purchase-orders', purchaseOrdersRoutes);
app.use('/api/debit-notes', debitNotesRoutes);
app.use('/api/payments-received', paymentsReceivedRoutes);
app.use('/api/payments-made', paymentsMadeRoutes);
app.use('/api/bank-reconciliation', bankReconciliationRoutes);
app.use('/api/document-templates', documentTemplatesRoutes);

// Multi-tenancy routes
app.use('/api/admin', adminRoutes);
app.use('/api/partner', partnerRoutes);
app.use('/api/tenant', tenantRoutes);

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
