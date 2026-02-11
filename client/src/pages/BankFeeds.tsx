import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import {
  Search,
  Upload,
  CheckCircle,
  Clock,
  XCircle,
  Link2,
  Wand2,
  FileText,
} from 'lucide-react';

interface BankFeedTransaction {
  id: string;
  transactionDate: string;
  description: string;
  referenceNumber?: string;
  debitAmount?: string;
  creditAmount?: string;
  runningBalance?: string;
  reconciliationStatus: 'pending' | 'matched' | 'reconciled' | 'excluded';
  suggestedAccount?: {
    id: string;
    name: string;
  };
  suggestedParty?: {
    id: string;
    name: string;
  };
  confidenceScore?: string;
  bankAccount?: {
    id: string;
    accountName: string;
  };
}

interface BankFeedSummary {
  totalPending: number;
  totalMatched: number;
  totalReconciled: number;
  totalExcluded: number;
  lastSyncAt?: string;
}

export default function BankFeeds() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [bankAccountFilter, setBankAccountFilter] = useState<string>('all');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [csvContent, setCsvContent] = useState('');
  const [selectedBankAccount, setSelectedBankAccount] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<BankFeedTransaction | null>(null);
  const [showCategorizeDialog, setShowCategorizeDialog] = useState(false);

  // Fetch summary
  const { data: summary } = useQuery<BankFeedSummary>({
    queryKey: ['/api/bank-feeds/summary'],
  });

  // Fetch transactions
  const { data: transactions, isLoading } = useQuery<BankFeedTransaction[]>({
    queryKey: ['/api/bank-feeds/transactions', { status: statusFilter, bankAccountId: bankAccountFilter }],
  });

  // Fetch bank accounts
  const { data: bankAccounts } = useQuery<Array<{ id: string; accountName: string }>>({
    queryKey: ['/api/bank-accounts'],
  });

  // Fetch chart of accounts
  const { data: accounts } = useQuery<Array<{ id: string; name: string; code: string }>>({
    queryKey: ['/api/chart-of-accounts/ledgers/list'],
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (data: { csvContent: string; bankAccountId: string }) => {
      const res = await fetch('/api/bank-feeds/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/bank-feeds'] });
      toast({
        title: 'Import successful',
        description: `Imported ${data.imported} transactions`,
      });
      setShowImportDialog(false);
      setCsvContent('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Import failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Categorize mutation
  const categorizeMutation = useMutation({
    mutationFn: async (data: { transactionId: string; accountId: string; partyId?: string; createRule?: boolean }) => {
      const res = await fetch(`/api/bank-feeds/transactions/${data.transactionId}/categorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bank-feeds'] });
      toast({ title: 'Transaction categorized' });
      setShowCategorizeDialog(false);
      setSelectedTransaction(null);
    },
  });

  // Auto-categorize mutation
  const autoCategorizeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/bank-feeds/auto-categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/bank-feeds'] });
      toast({
        title: 'Auto-categorization complete',
        description: `Categorized ${data.categorized} of ${data.processed} transactions`,
      });
    },
  });

  // Auto-reconcile mutation
  const autoReconcileMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/bank-feeds/auto-reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/bank-feeds'] });
      toast({
        title: 'Auto-reconciliation complete',
        description: `Matched ${data.matched} of ${data.processed} transactions`,
      });
    },
  });

  const filteredTransactions = transactions?.filter(t => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!t.description.toLowerCase().includes(search) &&
          !t.referenceNumber?.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-orange-600"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'matched':
        return <Badge variant="outline" className="text-blue-600"><Link2 className="w-3 h-3 mr-1" />Matched</Badge>;
      case 'reconciled':
        return <Badge variant="outline" className="text-green-600"><CheckCircle className="w-3 h-3 mr-1" />Reconciled</Badge>;
      case 'excluded':
        return <Badge variant="outline" className="text-gray-600"><XCircle className="w-3 h-3 mr-1" />Excluded</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCsvContent(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Bank Feeds</h1>
          <p className="text-gray-500">Import and reconcile bank transactions automatically</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => autoCategorizeMutation.mutate()} disabled={autoCategorizeMutation.isPending}>
            <Wand2 className="w-4 h-4 mr-2" />
            Auto-Categorize
          </Button>
          <Button variant="outline" onClick={() => autoReconcileMutation.mutate()} disabled={autoReconcileMutation.isPending}>
            <Link2 className="w-4 h-4 mr-2" />
            Auto-Reconcile
          </Button>
          <Button onClick={() => setShowImportDialog(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import CSV
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalPending || 0}</div>
            <p className="text-xs text-muted-foreground">Transactions to review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Matched</CardTitle>
            <Link2 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalMatched || 0}</div>
            <p className="text-xs text-muted-foreground">Ready to reconcile</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reconciled</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalReconciled || 0}</div>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Excluded</CardTitle>
            <XCircle className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.totalExcluded || 0}</div>
            <p className="text-xs text-muted-foreground">Skipped</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search transactions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="matched">Matched</SelectItem>
                <SelectItem value="reconciled">Reconciled</SelectItem>
                <SelectItem value="excluded">Excluded</SelectItem>
              </SelectContent>
            </Select>
            <Select value={bankAccountFilter} onValueChange={setBankAccountFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Bank Account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {bankAccounts?.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.accountName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead>Suggested Category</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No transactions found. Import a CSV to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions?.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell>{new Date(txn.transactionDate).toLocaleDateString()}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{txn.description}</TableCell>
                      <TableCell>{txn.referenceNumber || '-'}</TableCell>
                      <TableCell className="text-right text-red-600">
                        {txn.debitAmount ? formatCurrency(parseFloat(txn.debitAmount)) : '-'}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {txn.creditAmount ? formatCurrency(parseFloat(txn.creditAmount)) : '-'}
                      </TableCell>
                      <TableCell>
                        {txn.suggestedAccount ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{txn.suggestedAccount.name}</span>
                            {txn.confidenceScore && (
                              <Badge variant="outline" className="text-xs">
                                {parseFloat(txn.confidenceScore).toFixed(0)}%
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(txn.reconciliationStatus)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedTransaction(txn);
                              setShowCategorizeDialog(true);
                            }}
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Bank Statement</DialogTitle>
            <DialogDescription>
              Upload a CSV file from your bank to import transactions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Bank Account</Label>
              <Select value={selectedBankAccount} onValueChange={setSelectedBankAccount}>
                <SelectTrigger>
                  <SelectValue placeholder="Select bank account" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts?.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.accountName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>CSV File</Label>
              <Input type="file" accept=".csv" onChange={handleFileUpload} />
              <p className="text-xs text-muted-foreground mt-1">
                Supports HDFC, ICICI, SBI, and standard bank statement formats
              </p>
            </div>
            {csvContent && (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground">
                  File loaded: {csvContent.split('\n').length - 1} rows detected
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => importMutation.mutate({ csvContent, bankAccountId: selectedBankAccount })}
              disabled={!csvContent || !selectedBankAccount || importMutation.isPending}
            >
              {importMutation.isPending ? 'Importing...' : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Categorize Dialog */}
      <Dialog open={showCategorizeDialog} onOpenChange={setShowCategorizeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Categorize Transaction</DialogTitle>
            <DialogDescription>
              Assign an account category to this transaction
            </DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-md">
                <p className="font-medium">{selectedTransaction.description}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(selectedTransaction.transactionDate).toLocaleDateString()} |{' '}
                  {selectedTransaction.debitAmount
                    ? `Debit: ${formatCurrency(parseFloat(selectedTransaction.debitAmount))}`
                    : `Credit: ${formatCurrency(parseFloat(selectedTransaction.creditAmount || '0'))}`}
                </p>
              </div>
              <div>
                <Label>Account Category</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts?.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.code} - {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategorizeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => {}} disabled={categorizeMutation.isPending}>
              Save Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
