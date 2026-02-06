import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/theme-provider';

// Layout - not lazy loaded as it's used immediately
import MainLayout from '@/components/layout/MainLayout';

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

export default function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="zara-books-theme">
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

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
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </ThemeProvider>
  );
}
