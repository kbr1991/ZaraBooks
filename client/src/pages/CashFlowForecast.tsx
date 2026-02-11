import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Calendar,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  Wallet,
  LineChart,
  PiggyBank,
} from 'lucide-react';

interface CashFlowForecast {
  id: string;
  forecastDate: string;
  forecastType: '30_day' | '90_day';
  predictedInflows: string;
  predictedOutflows: string;
  predictedBalance: string;
  confidenceLevel: string;
  breakdown?: {
    receivables: number;
    recurringRevenue: number;
    historicalAverage: number;
    bills: number;
    recurringExpenses: number;
    salaries: number;
  };
  generatedAt: string;
}

interface FinancialInsight {
  type: string;
  title: string;
  description: string;
  value?: string;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
}

interface RevenueTrend {
  month: string;
  total: string;
  count: number;
}

interface ProfitLossTrend {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export default function CashFlowForecast() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [forecastDays, setForecastDays] = useState<'30' | '90'>('30');

  // Fetch forecast
  const { data: forecast, isLoading: forecastLoading } = useQuery<CashFlowForecast>({
    queryKey: ['/api/analytics/cash-flow-forecast', { days: forecastDays }],
  });

  // Fetch insights
  const { data: insights, isLoading: insightsLoading } = useQuery<FinancialInsight[]>({
    queryKey: ['/api/analytics/insights'],
  });

  // Fetch revenue trends
  const { data: revenueTrends } = useQuery<RevenueTrend[]>({
    queryKey: ['/api/analytics/trends/revenue', { months: 6 }],
  });

  // Fetch P&L trends
  const { data: plTrends } = useQuery<ProfitLossTrend[]>({
    queryKey: ['/api/analytics/trends/profit-loss', { months: 6 }],
  });

  // Fetch KPIs
  const { data: kpis } = useQuery<{
    monthly: { revenue: number; expenses: number; profit: number };
    ytd: { revenue: number; expenses: number; profit: number };
    invoices: { total: number; paid: number; pending: number; overdue: number };
  }>({
    queryKey: ['/api/analytics/kpis'],
  });

  // Generate forecast mutation
  const generateMutation = useMutation({
    mutationFn: async (forecastType: string) => {
      const res = await fetch('/api/analytics/cash-flow-forecast/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ forecastType }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/analytics/cash-flow-forecast'] });
      toast({ title: 'Forecast updated' });
    },
  });

  const getTrendIcon = (trend?: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'revenue':
        return <DollarSign className="w-5 h-5 text-green-600" />;
      case 'receivables':
        return <ArrowUpRight className="w-5 h-5 text-blue-600" />;
      case 'payables':
        return <ArrowDownRight className="w-5 h-5 text-orange-600" />;
      case 'overdue':
        return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'cash':
        return <Wallet className="w-5 h-5 text-purple-600" />;
      default:
        return <Target className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Cash Flow Forecast</h1>
          <p className="text-gray-500">Predict your future cash position with AI-powered analytics</p>
        </div>
        <Button
          onClick={() => generateMutation.mutate(forecastDays === '30' ? '30_day' : '90_day')}
          disabled={generateMutation.isPending}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${generateMutation.isPending ? 'animate-spin' : ''}`} />
          Refresh Forecast
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(kpis?.monthly.revenue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Expenses</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(kpis?.monthly.expenses || 0)}
            </div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            <PiggyBank className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(kpis?.monthly.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(kpis?.monthly.profit || 0)}
            </div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Invoices</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {kpis?.invoices.overdue || 0}
            </div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Forecast Section */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Cash Flow Projection</CardTitle>
              <CardDescription>Predicted cash position based on historical data and outstanding items</CardDescription>
            </div>
            <Tabs value={forecastDays} onValueChange={(v) => setForecastDays(v as '30' | '90')}>
              <TabsList>
                <TabsTrigger value="30">30 Days</TabsTrigger>
                <TabsTrigger value="90">90 Days</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {forecastLoading ? (
            <div className="grid gap-4 md:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : forecast ? (
            <>
              <div className="grid gap-4 md:grid-cols-3 mb-6">
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <ArrowUpRight className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-medium text-green-800">Expected Inflows</span>
                    </div>
                    <div className="text-3xl font-bold text-green-700">
                      {formatCurrency(parseFloat(forecast.predictedInflows || '0'))}
                    </div>
                    {forecast.breakdown && (
                      <div className="mt-2 text-xs text-green-600">
                        Receivables: {formatCurrency(forecast.breakdown.receivables)}
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card className="bg-red-50 border-red-200">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <ArrowDownRight className="w-5 h-5 text-red-600" />
                      <span className="text-sm font-medium text-red-800">Expected Outflows</span>
                    </div>
                    <div className="text-3xl font-bold text-red-700">
                      {formatCurrency(parseFloat(forecast.predictedOutflows || '0'))}
                    </div>
                    {forecast.breakdown && (
                      <div className="mt-2 text-xs text-red-600">
                        Bills: {formatCurrency(forecast.breakdown.bills)}
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card className={`${parseFloat(forecast.predictedBalance || '0') >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Wallet className={`w-5 h-5 ${parseFloat(forecast.predictedBalance || '0') >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
                      <span className={`text-sm font-medium ${parseFloat(forecast.predictedBalance || '0') >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>
                        Projected Balance
                      </span>
                    </div>
                    <div className={`text-3xl font-bold ${parseFloat(forecast.predictedBalance || '0') >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                      {formatCurrency(parseFloat(forecast.predictedBalance || '0'))}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="outline">
                        {parseFloat(forecast.confidenceLevel || '0').toFixed(0)}% confidence
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Last updated: {new Date(forecast.generatedAt).toLocaleString()}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <LineChart className="w-12 h-12 mx-auto mb-4" />
              <p>No forecast data available. Click refresh to generate.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Insights Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {insightsLoading ? (
          [...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-20" />
              </CardContent>
            </Card>
          ))
        ) : (
          insights?.map((insight, index) => (
            <Card key={index}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-muted rounded-lg">
                      {getInsightIcon(insight.type)}
                    </div>
                    <div>
                      <p className="font-medium">{insight.title}</p>
                      <p className="text-sm text-muted-foreground">{insight.description}</p>
                    </div>
                  </div>
                  {getTrendIcon(insight.trend)}
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div className="text-2xl font-bold">{insight.value}</div>
                  {insight.change && (
                    <Badge
                      variant="outline"
                      className={insight.trend === 'up' ? 'text-green-600' : insight.trend === 'down' ? 'text-red-600' : ''}
                    >
                      {insight.change}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Trends Section */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>Monthly revenue over the past 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            {revenueTrends?.length ? (
              <div className="space-y-4">
                {revenueTrends.map((trend, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{trend.month}</p>
                      <p className="text-sm text-muted-foreground">{trend.count} invoices</p>
                    </div>
                    <div className="text-lg font-semibold">
                      {formatCurrency(parseFloat(trend.total || '0'))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No revenue data available</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profit & Loss Trend</CardTitle>
            <CardDescription>Monthly P&L over the past 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            {plTrends?.length ? (
              <div className="space-y-4">
                {plTrends.map((trend, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{trend.month}</p>
                      <p className="text-sm text-muted-foreground">
                        Rev: {formatCurrency(trend.revenue)} | Exp: {formatCurrency(trend.expenses)}
                      </p>
                    </div>
                    <div className={`text-lg font-semibold ${trend.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(trend.profit)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">No P&L data available</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
