import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Download,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Users,
  Building2,
  Search,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const BUCKET_COLORS = {
  current: '#22c55e',
  days31_60: '#3b82f6',
  days61_90: '#f59e0b',
  days91_120: '#f97316',
  over120: '#ef4444',
};

interface AgingBucket {
  current: number;
  days31_60: number;
  days61_90: number;
  days91_120: number;
  over120: number;
  total: number;
}

interface PartyAging extends AgingBucket {
  partyId: string;
  partyName: string;
  partyCode?: string;
  gstin?: string;
  email?: string;
  phone?: string;
}

interface AgingResponse {
  asOfDate: string;
  type: string;
  data: PartyAging[];
  summary: AgingBucket;
  bucketLabels: Record<string, string>;
}

export default function AgingReports() {
  const [activeTab, setActiveTab] = useState<'receivables' | 'payables'>('receivables');
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch receivables aging
  const { data: receivablesData, isLoading: receivablesLoading } = useQuery<AgingResponse>({
    queryKey: ['aging-receivables', asOfDate],
    queryFn: async () => {
      const response = await fetch(`/api/aging/receivables?asOfDate=${asOfDate}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch receivables aging');
      return response.json();
    },
  });

  // Fetch payables aging
  const { data: payablesData, isLoading: payablesLoading } = useQuery<AgingResponse>({
    queryKey: ['aging-payables', asOfDate],
    queryFn: async () => {
      const response = await fetch(`/api/aging/payables?asOfDate=${asOfDate}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch payables aging');
      return response.json();
    },
  });

  const currentData = activeTab === 'receivables' ? receivablesData : payablesData;
  const isLoading = activeTab === 'receivables' ? receivablesLoading : payablesLoading;

  const filteredData = currentData?.data.filter(
    (item) =>
      item.partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.partyCode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Prepare chart data
  const chartData = currentData?.summary
    ? [
        { name: '0-30', value: currentData.summary.current, fill: BUCKET_COLORS.current },
        { name: '31-60', value: currentData.summary.days31_60, fill: BUCKET_COLORS.days31_60 },
        { name: '61-90', value: currentData.summary.days61_90, fill: BUCKET_COLORS.days61_90 },
        { name: '91-120', value: currentData.summary.days91_120, fill: BUCKET_COLORS.days91_120 },
        { name: '120+', value: currentData.summary.over120, fill: BUCKET_COLORS.over120 },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Aging Reports</h1>
          <p className="text-muted-foreground">
            Receivables and payables aging analysis
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label className="whitespace-nowrap">As of Date:</Label>
            <Input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="w-40"
            />
          </div>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-green-500" />
              Total Receivables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(receivablesData?.summary?.total || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {receivablesData?.data?.length || 0} customers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Overdue Receivables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(
                (receivablesData?.summary?.days31_60 || 0) +
                  (receivablesData?.summary?.days61_90 || 0) +
                  (receivablesData?.summary?.days91_120 || 0) +
                  (receivablesData?.summary?.over120 || 0)
              )}
            </div>
            <Progress
              value={receivablesData?.summary?.total ?
                ((receivablesData.summary.days31_60 + receivablesData.summary.days61_90 +
                  receivablesData.summary.days91_120 + receivablesData.summary.over120) /
                receivablesData.summary.total) * 100 : 0}
              className="h-1.5 mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ArrowDownRight className="h-4 w-4 text-red-500" />
              Total Payables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(payablesData?.summary?.total || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {payablesData?.data?.length || 0} vendors
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Overdue Payables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(
                (payablesData?.summary?.days31_60 || 0) +
                  (payablesData?.summary?.days61_90 || 0) +
                  (payablesData?.summary?.days91_120 || 0) +
                  (payablesData?.summary?.over120 || 0)
              )}
            </div>
            <Progress
              value={payablesData?.summary?.total ?
                ((payablesData.summary.days31_60 + payablesData.summary.days61_90 +
                  payablesData.summary.days91_120 + payablesData.summary.over120) /
                payablesData.summary.total) * 100 : 0}
              className="h-1.5 mt-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as 'receivables' | 'payables')}>
        <TabsList>
          <TabsTrigger value="receivables" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Receivables (Customers)
          </TabsTrigger>
          <TabsTrigger value="payables" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Payables (Vendors)
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {/* Charts */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Aging Distribution</CardTitle>
                <CardDescription>Amount by aging bucket</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  {isLoading ? (
                    <Skeleton className="h-full w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Composition</CardTitle>
                <CardDescription>Percentage breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  {isLoading ? (
                    <Skeleton className="h-full w-full" />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData.filter((d) => d.value > 0)}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          dataKey="value"
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          labelLine={false}
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-4">
            {[
              { label: '0-30 Days (Current)', color: BUCKET_COLORS.current },
              { label: '31-60 Days', color: BUCKET_COLORS.days31_60 },
              { label: '61-90 Days', color: BUCKET_COLORS.days61_90 },
              { label: '91-120 Days', color: BUCKET_COLORS.days91_120 },
              { label: '120+ Days', color: BUCKET_COLORS.over120 },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-sm">{item.label}</span>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={`Search ${activeTab === 'receivables' ? 'customers' : 'vendors'}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {/* Data Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : filteredData?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No {activeTab === 'receivables' ? 'receivables' : 'payables'} found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{activeTab === 'receivables' ? 'Customer' : 'Vendor'}</TableHead>
                      <TableHead className="text-right">Current</TableHead>
                      <TableHead className="text-right">31-60</TableHead>
                      <TableHead className="text-right">61-90</TableHead>
                      <TableHead className="text-right">91-120</TableHead>
                      <TableHead className="text-right">120+</TableHead>
                      <TableHead className="text-right font-semibold">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData?.map((party) => (
                      <TableRow key={party.partyId}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{party.partyName}</p>
                            {party.partyCode && (
                              <p className="text-xs text-muted-foreground">{party.partyCode}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-green-600">
                          {party.current > 0 ? formatCurrency(party.current) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-blue-600">
                          {party.days31_60 > 0 ? formatCurrency(party.days31_60) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-yellow-600">
                          {party.days61_90 > 0 ? formatCurrency(party.days61_90) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-orange-600">
                          {party.days91_120 > 0 ? formatCurrency(party.days91_120) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-red-600">
                          {party.over120 > 0 ? formatCurrency(party.over120) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {formatCurrency(party.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Totals Row */}
                    {currentData?.summary && (
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(currentData.summary.current)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(currentData.summary.days31_60)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(currentData.summary.days61_90)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(currentData.summary.days91_120)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(currentData.summary.over120)}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          {formatCurrency(currentData.summary.total)}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
