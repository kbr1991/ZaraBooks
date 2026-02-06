import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Download, Calendar, ChevronRight, ChevronDown, TrendingUp, TrendingDown } from 'lucide-react';

interface LineItem {
  code: string;
  name: string;
  amount: number;
  previousAmount?: number;
  level: number;
  children?: LineItem[];
}

function LineItemRow({
  item,
  expanded,
  onToggle,
  showComparative,
}: {
  item: LineItem;
  expanded: Set<string>;
  onToggle: (code: string) => void;
  showComparative: boolean;
}) {
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expanded.has(item.code);
  const isHeader = item.level <= 2;

  return (
    <>
      <tr className={cn(
        "hover:bg-muted/50",
        isHeader && "bg-muted/30 font-semibold"
      )}>
        <td className="py-2 pl-4">
          <div className="flex items-center" style={{ paddingLeft: `${(item.level - 1) * 20}px` }}>
            {hasChildren ? (
              <button
                onClick={() => onToggle(item.code)}
                className="p-1 hover:bg-muted rounded mr-2"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : (
              <span className="w-7" />
            )}
            <span className={cn(isHeader && "font-semibold")}>{item.name}</span>
          </div>
        </td>
        <td className="py-2 text-right font-medium">
          {item.amount !== 0 ? formatCurrency(Math.abs(item.amount)) : '-'}
        </td>
        {showComparative && (
          <>
            <td className="py-2 text-right text-muted-foreground">
              {item.previousAmount !== undefined && item.previousAmount !== 0
                ? formatCurrency(Math.abs(item.previousAmount))
                : '-'}
            </td>
            <td className="py-2 pr-4 text-right">
              {item.previousAmount !== undefined && item.previousAmount !== 0 && (
                <span className={cn(
                  "text-sm",
                  item.amount > item.previousAmount ? "text-green-600" : "text-red-600"
                )}>
                  {((item.amount - item.previousAmount) / Math.abs(item.previousAmount) * 100).toFixed(1)}%
                </span>
              )}
            </td>
          </>
        )}
      </tr>
      {hasChildren && isExpanded && item.children?.map((child) => (
        <LineItemRow
          key={child.code}
          item={child}
          expanded={expanded}
          onToggle={onToggle}
          showComparative={showComparative}
        />
      ))}
    </>
  );
}

export default function ProfitLoss() {
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() >= 3 ? 3 : -9, 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [fiscalYearId, setFiscalYearId] = useState<string>('');
  const [showComparative, setShowComparative] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: fiscalYears } = useQuery({
    queryKey: ['fiscal-years'],
    queryFn: async () => {
      const response = await fetch('/api/companies/current/fiscal-years', {
        credentials: 'include',
      });
      if (!response.ok) {
        const authResponse = await fetch('/api/auth/me', { credentials: 'include' });
        const auth = await authResponse.json();
        const companyId = auth.currentCompany?.id;
        if (companyId) {
          const fyResponse = await fetch(`/api/companies/${companyId}/fiscal-years`, {
            credentials: 'include',
          });
          if (fyResponse.ok) return fyResponse.json();
        }
      }
      return response.json();
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['profit-loss', fiscalYearId, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (fiscalYearId) params.append('fiscalYearId', fiscalYearId);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/financial-statements/profit-loss?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch P&L statement');
      return response.json();
    },
    enabled: Boolean(fiscalYearId),
  });

  const toggleExpand = (code: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allCodes: string[] = [];
    const collectCodes = (items: LineItem[]) => {
      items.forEach((item) => {
        if (item.children?.length) {
          allCodes.push(item.code);
          collectCodes(item.children);
        }
      });
    };
    if (data?.income) collectCodes(data.income);
    if (data?.expenses) collectCodes(data.expenses);
    setExpanded(new Set(allCodes));
  };

  const collapseAll = () => {
    setExpanded(new Set());
  };

  const handleExport = async () => {
    const params = new URLSearchParams();
    if (fiscalYearId) params.append('fiscalYearId', fiscalYearId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);

    const response = await fetch(`/api/financial-statements/profit-loss/export?${params}`, {
      credentials: 'include',
    });
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `profit-loss-${startDate}-to-${endDate}.xlsx`;
      a.click();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const income = data?.income || [];
  const expenses = data?.expenses || [];
  const totals = data?.totals || { income: 0, expenses: 0, netProfit: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Profit & Loss Statement</h1>
          <p className="text-muted-foreground">Statement of income and expenditure</p>
        </div>
        <Button onClick={handleExport}>
          <Download className="h-4 w-4 mr-2" />
          Export Excel
        </Button>
      </div>

      {/* KPI Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Income</p>
                <p className="text-xl font-bold">{formatCurrency(totals.income)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600">
                <TrendingDown className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Expenses</p>
                <p className="text-xl font-bold">{formatCurrency(totals.expenses)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Net Profit/Loss</p>
              <p className={cn(
                "text-xl font-bold",
                totals.netProfit >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {formatCurrency(totals.netProfit)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Profit Margin</p>
              <p className={cn(
                "text-xl font-bold",
                totals.netProfit >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {totals.income > 0
                  ? ((totals.netProfit / totals.income) * 100).toFixed(1) + '%'
                  : '0%'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Fiscal Year</label>
              <Select value={fiscalYearId} onValueChange={setFiscalYearId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  {fiscalYears?.map((fy: any) => (
                    <SelectItem key={fy.id} value={fy.id}>
                      {fy.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">From</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-10 w-[180px]"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">To</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="pl-10 w-[180px]"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={expandAll}>
                Expand All
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll}>
                Collapse All
              </Button>
              <Button
                variant={showComparative ? "default" : "outline"}
                size="sm"
                onClick={() => setShowComparative(!showComparative)}
              >
                Comparative
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* P&L Statement */}
      <Card>
        <CardHeader>
          <CardTitle>Statement of Profit and Loss</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="py-3 pl-4 text-left text-sm font-medium">Particulars</th>
                <th className="py-3 text-right text-sm font-medium">Current Period</th>
                {showComparative && (
                  <>
                    <th className="py-3 text-right text-sm font-medium">Previous Period</th>
                    <th className="py-3 pr-4 text-right text-sm font-medium">Change</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {/* Income Section */}
              <tr className="bg-green-50/50">
                <td colSpan={showComparative ? 4 : 2} className="py-2 pl-4 font-bold text-green-700">
                  I. Revenue from Operations
                </td>
              </tr>
              {income.map((item: LineItem) => (
                <LineItemRow
                  key={item.code}
                  item={item}
                  expanded={expanded}
                  onToggle={toggleExpand}
                  showComparative={showComparative}
                />
              ))}
              <tr className="border-t bg-muted/30">
                <td className="py-2 pl-4 font-bold">Total Income (I)</td>
                <td className="py-2 text-right font-bold text-green-600">
                  {formatCurrency(totals.income)}
                </td>
                {showComparative && (
                  <>
                    <td className="py-2 text-right text-muted-foreground">
                      {formatCurrency(totals.previousIncome || 0)}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {totals.previousIncome > 0 && (
                        <span className={cn(
                          "text-sm",
                          totals.income > totals.previousIncome ? "text-green-600" : "text-red-600"
                        )}>
                          {((totals.income - totals.previousIncome) / totals.previousIncome * 100).toFixed(1)}%
                        </span>
                      )}
                    </td>
                  </>
                )}
              </tr>

              {/* Expenses Section */}
              <tr className="bg-red-50/50">
                <td colSpan={showComparative ? 4 : 2} className="py-2 pl-4 font-bold text-red-700">
                  II. Expenses
                </td>
              </tr>
              {expenses.map((item: LineItem) => (
                <LineItemRow
                  key={item.code}
                  item={item}
                  expanded={expanded}
                  onToggle={toggleExpand}
                  showComparative={showComparative}
                />
              ))}
              <tr className="border-t bg-muted/30">
                <td className="py-2 pl-4 font-bold">Total Expenses (II)</td>
                <td className="py-2 text-right font-bold text-red-600">
                  {formatCurrency(totals.expenses)}
                </td>
                {showComparative && (
                  <>
                    <td className="py-2 text-right text-muted-foreground">
                      {formatCurrency(totals.previousExpenses || 0)}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {totals.previousExpenses > 0 && (
                        <span className={cn(
                          "text-sm",
                          totals.expenses < totals.previousExpenses ? "text-green-600" : "text-red-600"
                        )}>
                          {((totals.expenses - totals.previousExpenses) / totals.previousExpenses * 100).toFixed(1)}%
                        </span>
                      )}
                    </td>
                  </>
                )}
              </tr>
            </tbody>
            <tfoot className="border-t-2 bg-muted/50">
              <tr>
                <td className="py-3 pl-4 font-bold text-lg">
                  Profit / (Loss) for the period (I - II)
                </td>
                <td className={cn(
                  "py-3 text-right font-bold text-lg",
                  totals.netProfit >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {formatCurrency(totals.netProfit)}
                </td>
                {showComparative && (
                  <>
                    <td className="py-3 text-right text-muted-foreground">
                      {formatCurrency(totals.previousNetProfit || 0)}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {totals.previousNetProfit !== 0 && (
                        <span className={cn(
                          "text-sm font-medium",
                          totals.netProfit > totals.previousNetProfit ? "text-green-600" : "text-red-600"
                        )}>
                          {((totals.netProfit - totals.previousNetProfit) / Math.abs(totals.previousNetProfit) * 100).toFixed(1)}%
                        </span>
                      )}
                    </td>
                  </>
                )}
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
