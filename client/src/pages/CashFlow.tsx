import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Download,
  FileSpreadsheet,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  Banknote,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

interface StatementLine {
  code: string;
  name: string;
  amount: number;
  previousAmount?: number;
  indentLevel: number;
  isBold: boolean;
  isTotal: boolean;
  hasSubSchedule: boolean;
}

interface CashFlowSummary {
  netCashFromOperating: number;
  netCashFromInvesting: number;
  netCashFromFinancing: number;
  netIncrease: number;
  openingCash: number;
  closingCash: number;
}

interface FiscalYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export default function CashFlow() {
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['CFO_HEADER', 'CFI_HEADER', 'CFF_HEADER'])
  );

  // Fetch fiscal years
  const { data: fiscalYears } = useQuery<FiscalYear[]>({
    queryKey: ['fiscal-years'],
    queryFn: async () => {
      const response = await fetch('/api/fiscal-years', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch fiscal years');
      return response.json();
    },
  });

  // Fetch cash flow statement
  const { data, isLoading, error } = useQuery({
    queryKey: ['cash-flow', selectedFiscalYear],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedFiscalYear) params.append('fiscalYearId', selectedFiscalYear);

      const response = await fetch(`/api/financial-statements/cash-flow?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch cash flow statement');
      return response.json();
    },
  });

  const toggleSection = (code: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(code)) {
      newExpanded.delete(code);
    } else {
      newExpanded.add(code);
    }
    setExpandedSections(newExpanded);
  };

  const handleExport = () => {
    if (data?.runId) {
      window.open(`/api/financial-statements/export/${data.runId}`, '_blank');
    }
  };

  const getAmountColor = (amount: number, isTotal: boolean = false) => {
    if (amount > 0) return isTotal ? 'text-green-700' : 'text-green-600';
    if (amount < 0) return isTotal ? 'text-red-700' : 'text-red-600';
    return '';
  };

  const getSectionIcon = (code: string) => {
    if (code.startsWith('CFO')) return <Wallet className="h-4 w-4" />;
    if (code.startsWith('CFI')) return <Building2 className="h-4 w-4" />;
    if (code.startsWith('CFF')) return <Banknote className="h-4 w-4" />;
    return null;
  };

  const renderStatementLine = (line: StatementLine, index: number) => {
    const isHeader = line.code.includes('_HEADER');
    const isExpandable = isHeader && !line.code.includes('ADJ') && !line.code.includes('WC');
    const isExpanded = expandedSections.has(line.code);

    // Skip items that belong to collapsed sections
    if (!isHeader) {
      if (line.code.startsWith('CFO') && !expandedSections.has('CFO_HEADER') && !line.isTotal) return null;
      if (line.code.startsWith('CFI') && !expandedSections.has('CFI_HEADER') && !line.isTotal) return null;
      if (line.code.startsWith('CFF') && !expandedSections.has('CFF_HEADER') && !line.isTotal) return null;
    }

    // Skip sub-headers if parent is collapsed
    if (isHeader && (line.code.includes('ADJ') || line.code.includes('WC'))) {
      if (!expandedSections.has('CFO_HEADER')) return null;
    }

    return (
      <tr
        key={`${line.code}-${index}`}
        className={cn(
          'border-b last:border-0',
          isHeader && 'bg-muted/30',
          line.isTotal && 'bg-muted/50 font-semibold',
          line.code.includes('CF_CLOSING') && 'bg-primary/10'
        )}
      >
        <td
          className={cn(
            'py-3 pr-4',
            line.isBold && 'font-semibold',
          )}
          style={{ paddingLeft: `${line.indentLevel * 1.5 + 0.75}rem` }}
        >
          <div className="flex items-center gap-2">
            {isExpandable && (
              <button
                onClick={() => toggleSection(line.code)}
                className="p-0.5 hover:bg-muted rounded"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            )}
            {isHeader && !line.code.includes('ADJ') && !line.code.includes('WC') && getSectionIcon(line.code)}
            <span>{line.name}</span>
          </div>
        </td>
        <td
          className={cn(
            'py-3 text-right tabular-nums',
            getAmountColor(line.amount, line.isTotal),
            line.isBold && 'font-semibold',
          )}
        >
          {!isHeader || line.isTotal ? formatCurrency(line.amount) : ''}
        </td>
      </tr>
    );
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Failed to load cash flow statement</p>
      </div>
    );
  }

  const summary = data?.summary as CashFlowSummary | undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cash Flow Statement</h1>
          <p className="text-muted-foreground">
            Statement of cash flows (Indirect method) per Schedule III
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select
            value={selectedFiscalYear}
            onValueChange={setSelectedFiscalYear}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Current Fiscal Year" />
            </SelectTrigger>
            <SelectContent>
              {fiscalYears?.map((fy) => (
                <SelectItem key={fy.id} value={fy.id}>
                  {fy.name} {fy.isCurrent && '(Current)'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport} disabled={!data?.runId}>
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Operating Activities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {summary.netCashFromOperating >= 0 ? (
                  <ArrowUpRight className="h-5 w-5 text-green-500" />
                ) : (
                  <ArrowDownRight className="h-5 w-5 text-red-500" />
                )}
                <span className={cn(
                  'text-2xl font-bold',
                  summary.netCashFromOperating >= 0 ? 'text-green-600' : 'text-red-600'
                )}>
                  {formatCurrency(summary.netCashFromOperating)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Investing Activities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {summary.netCashFromInvesting >= 0 ? (
                  <ArrowUpRight className="h-5 w-5 text-green-500" />
                ) : (
                  <ArrowDownRight className="h-5 w-5 text-red-500" />
                )}
                <span className={cn(
                  'text-2xl font-bold',
                  summary.netCashFromInvesting >= 0 ? 'text-green-600' : 'text-red-600'
                )}>
                  {formatCurrency(summary.netCashFromInvesting)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Banknote className="h-4 w-4" />
                Financing Activities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {summary.netCashFromFinancing >= 0 ? (
                  <ArrowUpRight className="h-5 w-5 text-green-500" />
                ) : (
                  <ArrowDownRight className="h-5 w-5 text-red-500" />
                )}
                <span className={cn(
                  'text-2xl font-bold',
                  summary.netCashFromFinancing >= 0 ? 'text-green-600' : 'text-red-600'
                )}>
                  {formatCurrency(summary.netCashFromFinancing)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cash Position Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Opening Cash</p>
              <p className="text-xl font-bold">{formatCurrency(summary.openingCash)}</p>
            </CardContent>
          </Card>
          <Card className={cn(
            'border-l-4',
            summary.netIncrease >= 0 ? 'border-l-green-500' : 'border-l-red-500'
          )}>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Net Change</p>
              <p className={cn(
                'text-xl font-bold flex items-center gap-1',
                summary.netIncrease >= 0 ? 'text-green-600' : 'text-red-600'
              )}>
                {summary.netIncrease >= 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {formatCurrency(summary.netIncrease)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-primary">
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Closing Cash</p>
              <p className="text-xl font-bold">{formatCurrency(summary.closingCash)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cash Flow Statement */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Cash Flow Statement
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {data?.company?.name} | {data?.fiscalYear?.name}
            </p>
            {data?.fromDate && data?.toDate && (
              <p className="text-xs text-muted-foreground">
                For the period {new Date(data.fromDate).toLocaleDateString()} to {new Date(data.toDate).toLocaleDateString()}
              </p>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            All amounts in INR
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(15)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="py-3 px-4 text-left font-semibold">Particulars</th>
                  <th className="py-3 px-4 text-right font-semibold w-48">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data?.statement?.map((line: StatementLine, index: number) =>
                  renderStatementLine(line, index)
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardContent className="pt-4">
          <p className="text-sm text-muted-foreground">
            <strong>Notes:</strong>
          </p>
          <ul className="text-sm text-muted-foreground list-disc list-inside mt-2 space-y-1">
            <li>Cash flow statement is prepared using the Indirect Method as per AS-3/Ind AS 7</li>
            <li>Cash and cash equivalents include cash in hand and bank balances</li>
            <li>Figures in brackets represent cash outflows</li>
            <li>Previous year figures have been regrouped/reclassified wherever necessary</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
