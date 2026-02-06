import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
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
import { formatCurrency, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Plus, Search, Filter, FileText, Check, RotateCcw } from 'lucide-react';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  posted: 'bg-green-100 text-green-700',
  reversed: 'bg-red-100 text-red-700',
  pending_approval: 'bg-yellow-100 text-yellow-700',
};

const entryTypeLabels: Record<string, string> = {
  manual: 'Manual',
  auto_invoice: 'Invoice',
  auto_payment: 'Payment',
  auto_expense: 'Expense',
  recurring: 'Recurring',
  reversal: 'Reversal',
  bank_import: 'Bank Import',
  opening: 'Opening',
};

export default function JournalEntries() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['journal-entries', statusFilter, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const response = await fetch(`/api/journal-entries?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch entries');
      return response.json();
    },
  });

  const entries = data?.entries || [];
  const filteredEntries = entries.filter((entry: any) => {
    const matchesSearch =
      !searchTerm ||
      entry.entryNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.narration?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || entry.entryType === typeFilter;
    return matchesSearch && matchesType;
  });

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
          <h1 className="text-2xl font-bold">Journal Entries</h1>
          <p className="text-muted-foreground">Record and manage financial transactions</p>
        </div>
        <Button asChild>
          <Link to="/journal-entries/new">
            <Plus className="h-4 w-4 mr-2" />
            New Entry
          </Link>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Entries</p>
                <p className="text-2xl font-bold">{data?.total || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100 text-yellow-600">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Drafts</p>
                <p className="text-2xl font-bold">
                  {entries.filter((e: any) => e.status === 'draft').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
                <Check className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Posted</p>
                <p className="text-2xl font-bold">
                  {entries.filter((e: any) => e.status === 'posted').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600">
                <RotateCcw className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Reversed</p>
                <p className="text-2xl font-bold">
                  {entries.filter((e: any) => e.status === 'reversed').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle>All Entries</CardTitle>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search entries..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full md:w-[250px]"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[150px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="posted">Posted</SelectItem>
                  <SelectItem value="reversed">Reversed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-[150px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="auto_invoice">Invoice</SelectItem>
                  <SelectItem value="auto_payment">Payment</SelectItem>
                  <SelectItem value="recurring">Recurring</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="py-3 pl-4 text-left text-sm font-medium">Entry #</th>
                <th className="py-3 text-left text-sm font-medium">Date</th>
                <th className="py-3 text-left text-sm font-medium">Type</th>
                <th className="py-3 text-left text-sm font-medium">Narration</th>
                <th className="py-3 text-right text-sm font-medium">Amount</th>
                <th className="py-3 text-center text-sm font-medium">Status</th>
                <th className="py-3 pr-4 text-right text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry: any) => (
                <tr key={entry.id} className="border-b hover:bg-muted/50">
                  <td className="py-3 pl-4">
                    <span className="font-mono text-sm font-medium">{entry.entryNumber}</span>
                  </td>
                  <td className="py-3 text-sm">{formatDate(entry.entryDate)}</td>
                  <td className="py-3">
                    <span className="text-sm">{entryTypeLabels[entry.entryType] || entry.entryType}</span>
                  </td>
                  <td className="py-3 text-sm text-muted-foreground max-w-[300px] truncate">
                    {entry.narration || '-'}
                  </td>
                  <td className="py-3 text-right font-medium">
                    {formatCurrency(entry.totalDebit)}
                  </td>
                  <td className="py-3 text-center">
                    <span className={cn('px-2 py-1 rounded-full text-xs font-medium', statusColors[entry.status])}>
                      {entry.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/journal-entries/${entry.id}`}>View</Link>
                    </Button>
                  </td>
                </tr>
              ))}
              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No entries found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
