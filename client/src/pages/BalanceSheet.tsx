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
import { Download, Calendar, ChevronRight, ChevronDown, Printer } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

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
          {item.amount !== 0 ? formatCurrency(item.amount) : '-'}
        </td>
        {showComparative && (
          <td className="py-2 pr-4 text-right text-muted-foreground">
            {item.previousAmount !== undefined && item.previousAmount !== 0
              ? formatCurrency(item.previousAmount)
              : '-'}
          </td>
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

export default function BalanceSheet() {
  const { currentCompany } = useAuth();
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [fiscalYearId, setFiscalYearId] = useState<string>('');
  const [showComparative, setShowComparative] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const handlePrint = () => {
    window.print();
  };

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
    queryKey: ['balance-sheet', fiscalYearId, asOfDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (fiscalYearId) params.append('fiscalYearId', fiscalYearId);
      if (asOfDate) params.append('asOfDate', asOfDate);

      const response = await fetch(`/api/financial-statements/balance-sheet?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch balance sheet');
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
    if (data?.assets) collectCodes(data.assets);
    if (data?.liabilities) collectCodes(data.liabilities);
    if (data?.equity) collectCodes(data.equity);
    setExpanded(new Set(allCodes));
  };

  const collapseAll = () => {
    setExpanded(new Set());
  };

  const handleExport = async () => {
    const params = new URLSearchParams();
    if (fiscalYearId) params.append('fiscalYearId', fiscalYearId);
    if (asOfDate) params.append('asOfDate', asOfDate);

    const response = await fetch(`/api/financial-statements/balance-sheet/export?${params}`, {
      credentials: 'include',
    });
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `balance-sheet-${asOfDate}.xlsx`;
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

  const assets = data?.assets || [];
  const liabilities = data?.liabilities || [];
  const equity = data?.equity || [];
  const totals = data?.totals || { assets: 0, liabilities: 0, equity: 0 };

  return (
    <div className="space-y-6">
      {/* Print Header - visible only when printing */}
      <div className="hidden print:block print:text-center print:mb-6 print:border-b-2 print:border-black print:pb-4">
        <h1 className="text-xl font-bold">{currentCompany?.name || 'Company Name'}</h1>
        {currentCompany?.gstin && <p className="text-sm">GSTIN: {currentCompany.gstin}</p>}
        <h2 className="text-lg font-semibold mt-2">Balance Sheet</h2>
        <p className="text-sm text-gray-600">As at {new Date(asOfDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
      </div>

      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold">Balance Sheet</h1>
          <p className="text-muted-foreground">Schedule III compliant statement of financial position</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Filters - hide when printing */}
      <Card className="no-print">
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
              <label className="text-sm font-medium">As of Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                  className="pl-10 w-[200px]"
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Assets */}
        <Card>
          <CardHeader>
            <CardTitle>Assets</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="py-3 pl-4 text-left text-sm font-medium">Particulars</th>
                  <th className="py-3 text-right text-sm font-medium">Amount</th>
                  {showComparative && (
                    <th className="py-3 pr-4 text-right text-sm font-medium">Previous</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {assets.map((item: LineItem) => (
                  <LineItemRow
                    key={item.code}
                    item={item}
                    expanded={expanded}
                    onToggle={toggleExpand}
                    showComparative={showComparative}
                  />
                ))}
              </tbody>
              <tfoot className="border-t-2 bg-muted/50">
                <tr>
                  <td className="py-3 pl-4 font-bold">Total Assets</td>
                  <td className="py-3 text-right font-bold">
                    {formatCurrency(totals.assets)}
                  </td>
                  {showComparative && (
                    <td className="py-3 pr-4 text-right text-muted-foreground">
                      {formatCurrency(totals.previousAssets || 0)}
                    </td>
                  )}
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>

        {/* Liabilities & Equity */}
        <Card>
          <CardHeader>
            <CardTitle>Equity & Liabilities</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="py-3 pl-4 text-left text-sm font-medium">Particulars</th>
                  <th className="py-3 text-right text-sm font-medium">Amount</th>
                  {showComparative && (
                    <th className="py-3 pr-4 text-right text-sm font-medium">Previous</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {equity.map((item: LineItem) => (
                  <LineItemRow
                    key={item.code}
                    item={item}
                    expanded={expanded}
                    onToggle={toggleExpand}
                    showComparative={showComparative}
                  />
                ))}
                {liabilities.map((item: LineItem) => (
                  <LineItemRow
                    key={item.code}
                    item={item}
                    expanded={expanded}
                    onToggle={toggleExpand}
                    showComparative={showComparative}
                  />
                ))}
              </tbody>
              <tfoot className="border-t-2 bg-muted/50">
                <tr>
                  <td className="py-3 pl-4 font-bold">Total Equity & Liabilities</td>
                  <td className="py-3 text-right font-bold">
                    {formatCurrency(totals.liabilities + totals.equity)}
                  </td>
                  {showComparative && (
                    <td className="py-3 pr-4 text-right text-muted-foreground">
                      {formatCurrency((totals.previousLiabilities || 0) + (totals.previousEquity || 0))}
                    </td>
                  )}
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Balance Check */}
      <Card className="no-print">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">Balance Check</span>
            <span className={cn(
              "font-bold",
              Math.abs(totals.assets - (totals.liabilities + totals.equity)) < 0.01
                ? "text-green-600"
                : "text-red-600"
            )}>
              {Math.abs(totals.assets - (totals.liabilities + totals.equity)) < 0.01
                ? "Balanced"
                : `Difference: ${formatCurrency(Math.abs(totals.assets - (totals.liabilities + totals.equity)))}`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Print Footer - visible only when printing */}
      <div className="hidden print:block print:fixed print:bottom-0 print:left-0 print:right-0 print:text-center print:text-xs print:text-gray-500 print:py-2 print:border-t">
        Generated by Zara Books on {new Date().toLocaleDateString('en-IN')}
      </div>
    </div>
  );
}
