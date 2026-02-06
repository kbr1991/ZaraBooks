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
import { Download, RefreshCw, Calendar, Search } from 'lucide-react';

export default function TrialBalance() {
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [fiscalYearId, setFiscalYearId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

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

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['trial-balance', fiscalYearId, asOfDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (fiscalYearId) params.append('fiscalYearId', fiscalYearId);
      if (asOfDate) params.append('asOfDate', asOfDate);

      const response = await fetch(`/api/trial-balance?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch trial balance');
      return response.json();
    },
    enabled: Boolean(fiscalYearId),
  });

  // Set default fiscal year
  useState(() => {
    if (fiscalYears && fiscalYears.length > 0 && !fiscalYearId) {
      const currentFy = fiscalYears.find((fy: any) => fy.isCurrent);
      if (currentFy) {
        setFiscalYearId(currentFy.id);
      }
    }
  });

  const handleExport = async () => {
    const params = new URLSearchParams();
    if (fiscalYearId) params.append('fiscalYearId', fiscalYearId);
    if (asOfDate) params.append('asOfDate', asOfDate);

    const response = await fetch(`/api/trial-balance/export?${params}`, {
      credentials: 'include',
    });
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trial-balance-${asOfDate}.xlsx`;
      a.click();
    }
  };

  const accounts = data?.accounts || [];
  const filteredAccounts = accounts.filter((account: any) =>
    !searchTerm ||
    account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    account.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totals = data?.totals || { debit: 0, credit: 0 };
  const isBalanced = Math.abs(totals.debit - totals.credit) < 0.01;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trial Balance</h1>
          <p className="text-muted-foreground">View account balances as of a specific date</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")} />
            Refresh
          </Button>
          <Button onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
        </div>
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
            <div className="space-y-2 flex-1">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trial Balance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Account Balances</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="py-3 pl-4 text-left text-sm font-medium">Code</th>
                <th className="py-3 text-left text-sm font-medium">Account Name</th>
                <th className="py-3 text-left text-sm font-medium">Type</th>
                <th className="py-3 text-right text-sm font-medium">Debit</th>
                <th className="py-3 pr-4 text-right text-sm font-medium">Credit</th>
              </tr>
            </thead>
            <tbody>
              {filteredAccounts.map((account: any) => (
                <tr key={account.id} className="border-b hover:bg-muted/50">
                  <td className="py-3 pl-4">
                    <span className="font-mono text-sm">{account.code}</span>
                  </td>
                  <td className="py-3">
                    <span className={cn(account.isGroup && 'font-semibold')}>
                      {account.name}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className="text-sm text-muted-foreground capitalize">
                      {account.accountType}
                    </span>
                  </td>
                  <td className="py-3 text-right font-medium">
                    {account.debitBalance > 0 ? formatCurrency(account.debitBalance) : '-'}
                  </td>
                  <td className="py-3 pr-4 text-right font-medium">
                    {account.creditBalance > 0 ? formatCurrency(account.creditBalance) : '-'}
                  </td>
                </tr>
              ))}
              {filteredAccounts.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No accounts found
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot className="border-t-2 bg-muted/50">
              <tr>
                <td colSpan={3} className="py-3 pl-4 font-bold">
                  Total
                </td>
                <td className="py-3 text-right font-bold">
                  {formatCurrency(totals.debit)}
                </td>
                <td className="py-3 pr-4 text-right font-bold">
                  {formatCurrency(totals.credit)}
                </td>
              </tr>
              <tr>
                <td colSpan={3} className="py-2 pl-4 text-sm">
                  Difference
                </td>
                <td colSpan={2} className={cn(
                  "py-2 pr-4 text-right text-sm font-medium",
                  isBalanced ? "text-green-600" : "text-red-600"
                )}>
                  {isBalanced ? 'Balanced' : formatCurrency(Math.abs(totals.debit - totals.credit))}
                </td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
