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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Download,
  BookOpen,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  Filter,
} from 'lucide-react';

interface LedgerAccount {
  id: number;
  code: string;
  name: string;
  accountType: string;
  parentName: string | null;
  openingBalance: string;
  openingBalanceType: 'debit' | 'credit';
  currentBalance: string;
  currentBalanceType: 'debit' | 'credit';
  transactionCount: number;
  lastTransactionDate: string | null;
}

interface LedgerTransaction {
  id: number;
  date: string;
  entryNumber: string;
  narration: string;
  debit: string;
  credit: string;
  runningBalance: string;
  balanceType: 'debit' | 'credit';
}

export default function Ledger() {
  const [searchTerm, setSearchTerm] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState<string>('all');
  const [selectedLedger, setSelectedLedger] = useState<LedgerAccount | null>(null);
  const [showTransactions, setShowTransactions] = useState(false);

  // Fetch all ledger accounts with balances
  const { data: ledgers = [], isLoading } = useQuery<LedgerAccount[]>({
    queryKey: ['ledgers', accountTypeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (accountTypeFilter !== 'all') {
        params.set('type', accountTypeFilter);
      }
      const response = await fetch(`/api/chart-of-accounts/ledgers/list?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch ledgers');
      return response.json();
    },
  });

  // Fetch transactions for selected ledger
  const { data: transactions = [], isLoading: loadingTransactions } = useQuery<LedgerTransaction[]>({
    queryKey: ['ledger-transactions', selectedLedger?.id],
    queryFn: async () => {
      if (!selectedLedger) return [];
      const response = await fetch(`/api/chart-of-accounts/${selectedLedger.id}/transactions`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch transactions');
      return response.json();
    },
    enabled: !!selectedLedger && showTransactions,
  });

  const filteredLedgers = ledgers.filter(ledger =>
    ledger.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ledger.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (amount: string) => {
    const num = parseFloat(amount);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(Math.abs(num));
  };

  const getAccountTypeColor = (type: string) => {
    switch (type) {
      case 'asset':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'liability':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'equity':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'income':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300';
      case 'expense':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  // Calculate summary stats
  const totalDebitBalance = ledgers
    .filter(l => l.currentBalanceType === 'debit')
    .reduce((sum, l) => sum + parseFloat(l.currentBalance || '0'), 0);

  const totalCreditBalance = ledgers
    .filter(l => l.currentBalanceType === 'credit')
    .reduce((sum, l) => sum + parseFloat(l.currentBalance || '0'), 0);

  const handleViewTransactions = (ledger: LedgerAccount) => {
    setSelectedLedger(ledger);
    setShowTransactions(true);
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/chart-of-accounts/ledgers/export', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ledger-list-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Ledger View</h1>
          <p className="text-muted-foreground">
            View all ledger accounts and their balances
          </p>
        </div>
        <Button onClick={handleExport} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Accounts</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ledgers.length}</div>
            <p className="text-xs text-muted-foreground">
              Active ledger accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Debit</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalDebitBalance.toString())}
            </div>
            <p className="text-xs text-muted-foreground">
              Debit balances
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Credit</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalCreditBalance.toString())}
            </div>
            <p className="text-xs text-muted-foreground">
              Credit balances
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Difference</CardTitle>
            <Filter className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(Math.abs(totalDebitBalance - totalCreditBalance).toString())}
            </div>
            <p className="text-xs text-muted-foreground">
              {totalDebitBalance === totalCreditBalance ? 'Balanced' : 'Imbalanced'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by account name or code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={accountTypeFilter} onValueChange={setAccountTypeFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Account Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="asset">Assets</SelectItem>
                <SelectItem value="liability">Liabilities</SelectItem>
                <SelectItem value="equity">Equity</SelectItem>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expenses</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Ledger List */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Account Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead className="text-right">Opening Balance</TableHead>
                <TableHead className="text-right">Current Balance</TableHead>
                <TableHead className="text-center">Transactions</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredLedgers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No ledger accounts found
                  </TableCell>
                </TableRow>
              ) : (
                filteredLedgers.map((ledger) => (
                  <TableRow key={ledger.id}>
                    <TableCell className="font-mono text-sm">{ledger.code}</TableCell>
                    <TableCell className="font-medium">{ledger.name}</TableCell>
                    <TableCell>
                      <Badge className={getAccountTypeColor(ledger.accountType)}>
                        {ledger.accountType.charAt(0).toUpperCase() + ledger.accountType.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {ledger.parentName || '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={ledger.openingBalanceType === 'debit' ? 'text-green-600' : 'text-blue-600'}>
                        {formatCurrency(ledger.openingBalance)}
                        <span className="text-xs ml-1">
                          {ledger.openingBalanceType === 'debit' ? 'Dr' : 'Cr'}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      <span className={ledger.currentBalanceType === 'debit' ? 'text-green-600' : 'text-blue-600'}>
                        {formatCurrency(ledger.currentBalance)}
                        <span className="text-xs ml-1">
                          {ledger.currentBalanceType === 'debit' ? 'Dr' : 'Cr'}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{ledger.transactionCount}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewTransactions(ledger)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Transactions Dialog */}
      <Dialog open={showTransactions} onOpenChange={setShowTransactions}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {selectedLedger?.name} - Transactions
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Entry #</TableHead>
                  <TableHead>Narration</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingTransactions ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No transactions found
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell>{new Date(txn.date).toLocaleDateString('en-IN')}</TableCell>
                      <TableCell className="font-mono text-sm">{txn.entryNumber}</TableCell>
                      <TableCell className="max-w-xs truncate">{txn.narration}</TableCell>
                      <TableCell className="text-right">
                        {parseFloat(txn.debit) > 0 ? formatCurrency(txn.debit) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {parseFloat(txn.credit) > 0 ? formatCurrency(txn.credit) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        <span className={txn.balanceType === 'debit' ? 'text-green-600' : 'text-blue-600'}>
                          {formatCurrency(txn.runningBalance)}
                          <span className="text-xs ml-1">
                            {txn.balanceType === 'debit' ? 'Dr' : 'Cr'}
                          </span>
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
