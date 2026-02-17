import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/theme-provider';

// Layout - not lazy loaded as it's used immediately
import MainLayout from '@/components/layout/MainLayout';
import AdminLayout from '@/components/layout/AdminLayout';
import PartnerLayout from '@/components/layout/PartnerLayout';

// Auth pages - loaded immediately as they're entry points
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Companies from '@/pages/Companies';
import Dashboard from '@/pages/Dashboard';

// Lazy loaded pages for code splitting
const ChartOfAccounts = lazy(() => import('@/pages/ChartOfAccounts'));
const JournalEntries = lazy(() => import('@/pages/JournalEntries'));
const JournalEntryForm = lazy(() => import('@/pages/JournalEntryForm'));
const TrialBalance = lazy(() => import('@/pages/TrialBalance'));
const BalanceSheet = lazy(() => import('@/pages/BalanceSheet'));
const ProfitLoss = lazy(() => import('@/pages/ProfitLoss'));
const CashFlow = lazy(() => import('@/pages/CashFlow'));
const AgingReports = lazy(() => import('@/pages/AgingReports'));
const BankImport = lazy(() => import('@/pages/BankImport'));
const RecurringEntries = lazy(() => import('@/pages/RecurringEntries'));
const Parties = lazy(() => import('@/pages/Parties'));
const GSTReturns = lazy(() => import('@/pages/GSTReturns'));
const TDSRegister = lazy(() => import('@/pages/TDSRegister'));
const Settings = lazy(() => import('@/pages/Settings'));
const AuditLog = lazy(() => import('@/pages/AuditLog'));
const PracticeManagerSync = lazy(() => import('@/pages/PracticeManagerSync'));
const TRACESIntegration = lazy(() => import('@/pages/TRACESIntegration'));

// New pages
const UserManagement = lazy(() => import('@/pages/UserManagement'));
const Invoices = lazy(() => import('@/pages/Invoices'));
const Expenses = lazy(() => import('@/pages/Expenses'));
const Ledger = lazy(() => import('@/pages/Ledger'));
const Vendors = lazy(() => import('@/pages/Vendors'));
const Customers = lazy(() => import('@/pages/Customers'));

// Sales pages
const Quotes = lazy(() => import('@/pages/Quotes'));
const SalesOrders = lazy(() => import('@/pages/SalesOrders'));
const PaymentsReceived = lazy(() => import('@/pages/PaymentsReceived'));
const CreditNotes = lazy(() => import('@/pages/CreditNotes'));

// Purchase pages
const Bills = lazy(() => import('@/pages/Bills'));
const PurchaseOrders = lazy(() => import('@/pages/PurchaseOrders'));
const PaymentsMade = lazy(() => import('@/pages/PaymentsMade'));
const DebitNotes = lazy(() => import('@/pages/DebitNotes'));

// Banking pages
const BankAccounts = lazy(() => import('@/pages/BankAccounts'));
const BankReconciliation = lazy(() => import('@/pages/BankReconciliation'));

// Inventory pages
const Products = lazy(() => import('@/pages/Products'));

// Accountant pages
const CostCenters = lazy(() => import('@/pages/CostCenters'));

// Settings pages
const DocumentTemplates = lazy(() => import('@/pages/DocumentTemplates'));

// Smart features pages
const BankFeeds = lazy(() => import('@/pages/BankFeeds'));
const DocumentScan = lazy(() => import('@/pages/DocumentScan'));
const RecurringInvoices = lazy(() => import('@/pages/RecurringInvoices'));
const CashFlowForecast = lazy(() => import('@/pages/CashFlowForecast'));
const SmartAlerts = lazy(() => import('@/pages/SmartAlerts'));
const VoiceEntry = lazy(() => import('@/pages/VoiceEntry'));
const Integrations = lazy(() => import('@/pages/Integrations'));

// Public pages
const AcceptInvite = lazy(() => import('@/pages/AcceptInvite'));

// Admin pages
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'));
const AdminTenants = lazy(() => import('@/pages/admin/Tenants'));
const AdminPartners = lazy(() => import('@/pages/admin/Partners'));
const AdminSubscriptions = lazy(() => import('@/pages/admin/Subscriptions'));
const AdminCommissions = lazy(() => import('@/pages/admin/Commissions'));
const AdminPayouts = lazy(() => import('@/pages/admin/Payouts'));

// Partner pages
const PartnerDashboard = lazy(() => import('@/pages/partner/Dashboard'));
const PartnerClients = lazy(() => import('@/pages/partner/Clients'));
const PartnerCommissions = lazy(() => import('@/pages/partner/Commissions'));
const PartnerPayouts = lazy(() => import('@/pages/partner/Payouts'));
const PartnerTeam = lazy(() => import('@/pages/partner/Team'));
const PartnerRegister = lazy(() => import('@/pages/partner/Register'));

// Loading fallback component
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}

// Auth hook
function useAuth() {
  return useQuery({
    queryKey: ['auth'],
    queryFn: async () => {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      if (!response.ok) {
        if (response.status === 401) {
          return null;
        }
        throw new Error('Failed to fetch user');
      }
      return response.json();
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: auth, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!auth?.user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function RequireCompany({ children }: { children: React.ReactNode }) {
  const { data: auth, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!auth?.user) {
    return <Navigate to="/login" replace />;
  }

  if (!auth?.currentCompany) {
    return <Navigate to="/companies" replace />;
  }

  return <>{children}</>;
}

function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const { data: auth, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!auth?.user) {
    return <Navigate to="/login" replace />;
  }

  if (auth?.userType !== 'super_admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function RequirePartner({ children }: { children: React.ReactNode }) {
  const { data: auth, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!auth?.user) {
    return <Navigate to="/login" replace />;
  }

  if (!auth?.partner) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="zara-books-theme">
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/accept-invite" element={
          <Suspense fallback={<PageLoader />}>
            <AcceptInvite />
          </Suspense>
        } />

        {/* Protected routes - require login */}
        <Route
          path="/companies"
          element={
            <ProtectedRoute>
              <Companies />
            </ProtectedRoute>
          }
        />

        {/* Protected routes - require login and company */}
        <Route
          path="/"
          element={
            <RequireCompany>
              <MainLayout />
            </RequireCompany>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="chart-of-accounts" element={
            <Suspense fallback={<PageLoader />}>
              <ChartOfAccounts />
            </Suspense>
          } />
          <Route path="journal-entries" element={
            <Suspense fallback={<PageLoader />}>
              <JournalEntries />
            </Suspense>
          } />
          <Route path="journal-entries/new" element={
            <Suspense fallback={<PageLoader />}>
              <JournalEntryForm />
            </Suspense>
          } />
          <Route path="journal-entries/:id" element={
            <Suspense fallback={<PageLoader />}>
              <JournalEntryForm />
            </Suspense>
          } />
          <Route path="trial-balance" element={
            <Suspense fallback={<PageLoader />}>
              <TrialBalance />
            </Suspense>
          } />
          <Route path="balance-sheet" element={
            <Suspense fallback={<PageLoader />}>
              <BalanceSheet />
            </Suspense>
          } />
          <Route path="profit-loss" element={
            <Suspense fallback={<PageLoader />}>
              <ProfitLoss />
            </Suspense>
          } />
          <Route path="cash-flow" element={
            <Suspense fallback={<PageLoader />}>
              <CashFlow />
            </Suspense>
          } />
          <Route path="aging-reports" element={
            <Suspense fallback={<PageLoader />}>
              <AgingReports />
            </Suspense>
          } />
          <Route path="parties" element={
            <Suspense fallback={<PageLoader />}>
              <Parties />
            </Suspense>
          } />
          <Route path="bank-import" element={
            <Suspense fallback={<PageLoader />}>
              <BankImport />
            </Suspense>
          } />
          <Route path="recurring-entries" element={
            <Suspense fallback={<PageLoader />}>
              <RecurringEntries />
            </Suspense>
          } />
          <Route path="gst-returns" element={
            <Suspense fallback={<PageLoader />}>
              <GSTReturns />
            </Suspense>
          } />
          <Route path="tds-register" element={
            <Suspense fallback={<PageLoader />}>
              <TDSRegister />
            </Suspense>
          } />
          <Route path="settings" element={
            <Suspense fallback={<PageLoader />}>
              <Settings />
            </Suspense>
          } />
          <Route path="audit-log" element={
            <Suspense fallback={<PageLoader />}>
              <AuditLog />
            </Suspense>
          } />
          <Route path="pm-sync" element={
            <Suspense fallback={<PageLoader />}>
              <PracticeManagerSync />
            </Suspense>
          } />
          <Route path="traces" element={
            <Suspense fallback={<PageLoader />}>
              <TRACESIntegration />
            </Suspense>
          } />
          <Route path="users" element={
            <Suspense fallback={<PageLoader />}>
              <UserManagement />
            </Suspense>
          } />
          <Route path="invoices" element={
            <Suspense fallback={<PageLoader />}>
              <Invoices />
            </Suspense>
          } />
          <Route path="expenses" element={
            <Suspense fallback={<PageLoader />}>
              <Expenses />
            </Suspense>
          } />
          <Route path="ledger" element={
            <Suspense fallback={<PageLoader />}>
              <Ledger />
            </Suspense>
          } />
          <Route path="vendors" element={
            <Suspense fallback={<PageLoader />}>
              <Vendors />
            </Suspense>
          } />
          <Route path="customers" element={
            <Suspense fallback={<PageLoader />}>
              <Customers />
            </Suspense>
          } />
          {/* Sales routes */}
          <Route path="quotes" element={
            <Suspense fallback={<PageLoader />}>
              <Quotes />
            </Suspense>
          } />
          <Route path="sales-orders" element={
            <Suspense fallback={<PageLoader />}>
              <SalesOrders />
            </Suspense>
          } />
          <Route path="payments-received" element={
            <Suspense fallback={<PageLoader />}>
              <PaymentsReceived />
            </Suspense>
          } />
          <Route path="credit-notes" element={
            <Suspense fallback={<PageLoader />}>
              <CreditNotes />
            </Suspense>
          } />
          {/* Purchase routes */}
          <Route path="bills" element={
            <Suspense fallback={<PageLoader />}>
              <Bills />
            </Suspense>
          } />
          <Route path="purchase-orders" element={
            <Suspense fallback={<PageLoader />}>
              <PurchaseOrders />
            </Suspense>
          } />
          <Route path="payments-made" element={
            <Suspense fallback={<PageLoader />}>
              <PaymentsMade />
            </Suspense>
          } />
          <Route path="debit-notes" element={
            <Suspense fallback={<PageLoader />}>
              <DebitNotes />
            </Suspense>
          } />
          {/* Banking routes */}
          <Route path="bank-accounts" element={
            <Suspense fallback={<PageLoader />}>
              <BankAccounts />
            </Suspense>
          } />
          <Route path="bank-reconciliation" element={
            <Suspense fallback={<PageLoader />}>
              <BankReconciliation />
            </Suspense>
          } />
          {/* Inventory routes */}
          <Route path="products" element={
            <Suspense fallback={<PageLoader />}>
              <Products />
            </Suspense>
          } />
          {/* Accountant routes */}
          <Route path="cost-centers" element={
            <Suspense fallback={<PageLoader />}>
              <CostCenters />
            </Suspense>
          } />
          {/* Settings routes */}
          <Route path="document-templates" element={
            <Suspense fallback={<PageLoader />}>
              <DocumentTemplates />
            </Suspense>
          } />
          {/* Smart features routes */}
          <Route path="bank-feeds" element={
            <Suspense fallback={<PageLoader />}>
              <BankFeeds />
            </Suspense>
          } />
          <Route path="document-scan" element={
            <Suspense fallback={<PageLoader />}>
              <DocumentScan />
            </Suspense>
          } />
          <Route path="recurring-invoices" element={
            <Suspense fallback={<PageLoader />}>
              <RecurringInvoices />
            </Suspense>
          } />
          <Route path="cash-flow-forecast" element={
            <Suspense fallback={<PageLoader />}>
              <CashFlowForecast />
            </Suspense>
          } />
          <Route path="smart-alerts" element={
            <Suspense fallback={<PageLoader />}>
              <SmartAlerts />
            </Suspense>
          } />
          <Route path="voice-entry" element={
            <Suspense fallback={<PageLoader />}>
              <VoiceEntry />
            </Suspense>
          } />
          <Route path="integrations" element={
            <Suspense fallback={<PageLoader />}>
              <Integrations />
            </Suspense>
          } />
        </Route>

        {/* Admin routes */}
        <Route
          path="/admin"
          element={
            <RequireSuperAdmin>
              <AdminLayout />
            </RequireSuperAdmin>
          }
        >
          <Route index element={
            <Suspense fallback={<PageLoader />}>
              <AdminDashboard />
            </Suspense>
          } />
          <Route path="tenants" element={
            <Suspense fallback={<PageLoader />}>
              <AdminTenants />
            </Suspense>
          } />
          <Route path="partners" element={
            <Suspense fallback={<PageLoader />}>
              <AdminPartners />
            </Suspense>
          } />
          <Route path="subscriptions" element={
            <Suspense fallback={<PageLoader />}>
              <AdminSubscriptions />
            </Suspense>
          } />
          <Route path="commissions" element={
            <Suspense fallback={<PageLoader />}>
              <AdminCommissions />
            </Suspense>
          } />
          <Route path="payouts" element={
            <Suspense fallback={<PageLoader />}>
              <AdminPayouts />
            </Suspense>
          } />
        </Route>

        {/* Partner routes */}
        <Route
          path="/partner"
          element={
            <RequirePartner>
              <PartnerLayout />
            </RequirePartner>
          }
        >
          <Route index element={
            <Suspense fallback={<PageLoader />}>
              <PartnerDashboard />
            </Suspense>
          } />
          <Route path="clients" element={
            <Suspense fallback={<PageLoader />}>
              <PartnerClients />
            </Suspense>
          } />
          <Route path="commissions" element={
            <Suspense fallback={<PageLoader />}>
              <PartnerCommissions />
            </Suspense>
          } />
          <Route path="payouts" element={
            <Suspense fallback={<PageLoader />}>
              <PartnerPayouts />
            </Suspense>
          } />
          <Route path="team" element={
            <Suspense fallback={<PageLoader />}>
              <PartnerTeam />
            </Suspense>
          } />
        </Route>

        {/* Partner registration (public) */}
        <Route path="/partner/register" element={
          <Suspense fallback={<PageLoader />}>
            <PartnerRegister />
          </Suspense>
        } />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </ThemeProvider>
  );
}
