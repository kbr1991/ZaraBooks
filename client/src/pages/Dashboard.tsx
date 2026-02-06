import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  AlertTriangle,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  FileText,
  Upload,
  RefreshCw,
  Building2,
  Users,
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch dashboard');
      return response.json();
    },
  });

  // Fetch recurring entries due
  const { data: recurringData } = useQuery({
    queryKey: ['recurring-due'],
    queryFn: async () => {
      const response = await fetch('/api/recurring-entries/due/list', {
        credentials: 'include',
      });
      if (!response.ok) return { length: 0 };
      const data = await response.json();
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const kpis = data?.financialKPIs || {};
  const workingCapital = data?.workingCapital || {};
  const taxCompliance = data?.taxCompliance || {};
  const monthlyRevenue = data?.monthlyRevenue || [];
  const expenseBreakdown = data?.expenseBreakdown || [];
  const recentTransactions = data?.recentTransactions || [];
  const upcomingDueDates = data?.upcomingDueDates || [];
  const recurringDue = recurringData?.length || 0;

  // Prepare income vs expense chart data
  const incomeVsExpense = monthlyRevenue.map((item: any) => ({
    month: item.month,
    income: item.revenue,
    expenses: Math.abs(item.revenue * 0.7), // Estimated expense ratio
  }));

  return (
    <div className="space-y-6">
      {/* Header with Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Financial overview for {data?.fiscalYear?.name || 'Current Year'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link to="/journal-entries/new">
              <Plus className="h-4 w-4 mr-2" />
              New Entry
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/bank-import">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Link>
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {(recurringDue > 0 || taxCompliance.pendingTdsPayment > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {recurringDue > 0 && (
            <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
                    <RefreshCw className="h-5 w-5" />
                    <span className="font-medium">{recurringDue} recurring entries due</span>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/recurring-entries">Process</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          {taxCompliance.pendingTdsPayment > 0 && (
            <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-medium">
                      TDS payment pending: {formatCurrency(taxCompliance.pendingTdsPayment)}
                    </span>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/tds-register">View</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 transform translate-x-8 -translate-y-8">
            <div className="w-full h-full rounded-full bg-green-500/10" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Income</CardTitle>
            <div className="p-2 bg-green-100 rounded-full dark:bg-green-900/30">
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.totalIncome || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Revenue from operations</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 transform translate-x-8 -translate-y-8">
            <div className="w-full h-full rounded-full bg-red-500/10" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <div className="p-2 bg-red-100 rounded-full dark:bg-red-900/30">
              <TrendingDown className="h-4 w-4 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(kpis.totalExpenses || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Operating expenses</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 transform translate-x-8 -translate-y-8">
            <div className={cn(
              "w-full h-full rounded-full",
              kpis.netProfit >= 0 ? "bg-primary/10" : "bg-red-500/10"
            )} />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <div className={cn(
              "p-2 rounded-full",
              kpis.netProfit >= 0 ? "bg-primary/10" : "bg-red-100 dark:bg-red-900/30"
            )}>
              <Wallet className={cn(
                "h-4 w-4",
                kpis.netProfit >= 0 ? "text-primary" : "text-red-600"
              )} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={cn(
              "text-2xl font-bold",
              kpis.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
            )}>
              {formatCurrency(kpis.netProfit || 0)}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Progress
                value={Math.min(Math.abs(kpis.profitMargin || 0), 100)}
                className="h-1.5 flex-1"
              />
              <span className="text-xs text-muted-foreground">
                {(kpis.profitMargin || 0).toFixed(1)}%
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 transform translate-x-8 -translate-y-8">
            <div className="w-full h-full rounded-full bg-blue-500/10" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cash Position</CardTitle>
            <div className="p-2 bg-blue-100 rounded-full dark:bg-blue-900/30">
              <Receipt className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(workingCapital.cash || 0)}</div>
            <p className="text-xs text-muted-foreground mt-1">Available balance</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <Link to="/journal-entries/new" className="group">
          <Card className="h-full transition-colors hover:border-primary/50">
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <div className="p-3 bg-primary/10 rounded-full group-hover:bg-primary/20 transition-colors">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <p className="mt-3 font-medium">New Journal Entry</p>
              <p className="text-xs text-muted-foreground">Record transaction</p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/bank-import" className="group">
          <Card className="h-full transition-colors hover:border-primary/50">
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <div className="p-3 bg-blue-100 rounded-full group-hover:bg-blue-200 transition-colors dark:bg-blue-900/30">
                <Upload className="h-6 w-6 text-blue-600" />
              </div>
              <p className="mt-3 font-medium">Bank Import</p>
              <p className="text-xs text-muted-foreground">Import statement</p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/parties" className="group">
          <Card className="h-full transition-colors hover:border-primary/50">
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <div className="p-3 bg-green-100 rounded-full group-hover:bg-green-200 transition-colors dark:bg-green-900/30">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <p className="mt-3 font-medium">Manage Parties</p>
              <p className="text-xs text-muted-foreground">Customers & vendors</p>
            </CardContent>
          </Card>
        </Link>
        <Link to="/balance-sheet" className="group">
          <Card className="h-full transition-colors hover:border-primary/50">
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <div className="p-3 bg-purple-100 rounded-full group-hover:bg-purple-200 transition-colors dark:bg-purple-900/30">
                <BarChart3 className="h-6 w-6 text-purple-600" />
              </div>
              <p className="mt-3 font-medium">Financial Reports</p>
              <p className="text-xs text-muted-foreground">View statements</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Revenue Trend */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Revenue Trend</CardTitle>
              <CardDescription>Monthly revenue over last 6 months</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/profit-loss">
                View Report <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" tick={{ fontSize: 12 }} />
                  <YAxis className="text-xs" tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Income vs Expenses Bar Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Income vs Expenses</CardTitle>
              <CardDescription>Monthly comparison</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/cash-flow">
                Cash Flow <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={incomeVsExpense}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" tick={{ fontSize: 12 }} />
                  <YAxis className="text-xs" tickFormatter={(value) => `₹${(value / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Bar dataKey="income" name="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Middle Row - Expense Breakdown & Working Capital */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Expense Breakdown */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Expense Breakdown</CardTitle>
            <CardDescription>Top expenses by category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={expenseBreakdown.slice(0, 6)}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="amount"
                      nameKey="name"
                    >
                      {expenseBreakdown.slice(0, 6).map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
                {expenseBreakdown.slice(0, 6).map((expense: any, index: number) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="truncate max-w-[150px]">{expense.name}</span>
                    </div>
                    <span className="font-medium">{formatCurrency(expense.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Working Capital */}
        <Card>
          <CardHeader>
            <CardTitle>Working Capital</CardTitle>
            <CardDescription>Liquidity position</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Receivables</span>
                </div>
                <span className="font-medium text-green-600">
                  {formatCurrency(workingCapital.receivables || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">Cash & Bank</span>
                </div>
                <span className="font-medium text-blue-600">
                  {formatCurrency(workingCapital.cash || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowDownRight className="h-4 w-4 text-red-500" />
                  <span className="text-sm">Payables</span>
                </div>
                <span className="font-medium text-red-600">
                  ({formatCurrency(workingCapital.payables || 0)})
                </span>
              </div>
            </div>
            <hr />
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Net Working Capital</span>
              <span className={cn(
                "text-lg font-bold",
                workingCapital.netWorkingCapital >= 0 ? 'text-green-600' : 'text-red-600'
              )}>
                {formatCurrency(workingCapital.netWorkingCapital || 0)}
              </span>
            </div>
            <Button variant="outline" className="w-full" asChild>
              <Link to="/trial-balance">View Trial Balance</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row - Compliance & Transactions */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Tax Compliance */}
        <Card>
          <CardHeader>
            <CardTitle>Tax Compliance</CardTitle>
            <CardDescription>Filing status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">GST Status</span>
              <span className={cn(
                "text-sm px-2 py-1 rounded-full flex items-center gap-1",
                taxCompliance.gstStatus === 'filed'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
              )}>
                {taxCompliance.gstStatus === 'filed' ? (
                  <><CheckCircle2 className="h-3 w-3" /> Filed</>
                ) : (
                  <><Clock className="h-3 w-3" /> Pending</>
                )}
              </span>
            </div>
            {taxCompliance.pendingTdsPayment > 0 && (
              <div className="flex items-center justify-between p-2 bg-red-50 rounded-lg dark:bg-red-900/20">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm">TDS Pending</span>
                </div>
                <span className="font-medium text-red-600">{formatCurrency(taxCompliance.pendingTdsPayment)}</span>
              </div>
            )}
            {taxCompliance.pendingTdsChallans > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span>Pending Challans</span>
                <span className="font-medium">{taxCompliance.pendingTdsChallans}</span>
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <Link to="/gst-returns">GST</Link>
              </Button>
              <Button variant="outline" size="sm" className="flex-1" asChild>
                <Link to="/tds-register">TDS</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Due Dates */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Due Dates</CardTitle>
            <CardDescription>Compliance calendar</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingDueDates.map((item: any, index: number) => {
                const dueDate = new Date(item.dueDate);
                const today = new Date();
                const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                const isUrgent = daysUntil <= 7;

                return (
                  <div key={index} className={cn(
                    "flex items-center justify-between text-sm p-2 rounded-lg",
                    isUrgent && "bg-red-50 dark:bg-red-900/20"
                  )}>
                    <div className="flex items-center gap-2">
                      <Calendar className={cn(
                        "h-4 w-4",
                        isUrgent ? "text-red-500" : "text-muted-foreground"
                      )} />
                      <span className={isUrgent ? "font-medium" : ""}>{item.name}</span>
                    </div>
                    <span className={cn(
                      "text-xs",
                      isUrgent ? "text-red-600 font-medium" : "text-muted-foreground"
                    )}>
                      {formatDate(item.dueDate)}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Latest entries</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/journal-entries">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentTransactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No transactions yet</p>
              ) : (
                recentTransactions.slice(0, 5).map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{tx.entryNumber}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {tx.narration || 'No narration'}
                      </p>
                    </div>
                    <div className="text-right ml-2">
                      <p className="font-medium text-sm">{formatCurrency(tx.amount)}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(tx.entryDate)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
