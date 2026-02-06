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
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import {
  Building2,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
} from 'lucide-react';

interface BankAccount {
  id: string;
  accountName: string;
  bankName: string;
  currentBalance: string;
  lastReconciled?: string;
}

interface ReconciliationTransaction {
  id: string;
  date: string;
  type: 'credit' | 'debit';
  description: string;
  reference?: string;
  amount: string;
  isReconciled: boolean;
  isMatched: boolean;
}

interface ReconciliationSummary {
  bankBalance: string;
  bookBalance: string;
  unreconciledCredits: string;
  unreconciledDebits: string;
  difference: string;
}

export default function BankReconciliation() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [statementDate, setStatementDate] = useState(new Date().toISOString().split('T')[0]);
  const [statementBalance, setStatementBalance] = useState('');
  const [selectedTransactions, setSelectedTransactions] = useState<Set<string>>(new Set());

  // Fetch bank accounts
  const { data: accounts, isLoading: accountsLoading } = useQuery<BankAccount[]>({
    queryKey: ['bank-accounts'],
    queryFn: async () => {
      const response = await fetch('/api/bank-accounts', {
        credentials: 'include',
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Fetch unreconciled transactions
  const { data: transactions, isLoading: transactionsLoading } = useQuery<ReconciliationTransaction[]>({
    queryKey: ['bank-reconciliation-transactions', selectedAccountId, statementDate],
    queryFn: async () => {
      if (!selectedAccountId) return [];
      const params = new URLSearchParams({
        accountId: selectedAccountId,
        asOfDate: statementDate,
      });
      const response = await fetch(`/api/bank-reconciliation/transactions?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!selectedAccountId,
  });

  // Fetch reconciliation summary
  const { data: summary } = useQuery<ReconciliationSummary>({
    queryKey: ['bank-reconciliation-summary', selectedAccountId, statementDate, statementBalance],
    queryFn: async () => {
      if (!selectedAccountId || !statementBalance) return null;
      const params = new URLSearchParams({
        accountId: selectedAccountId,
        asOfDate: statementDate,
        statementBalance,
      });
      const response = await fetch(`/api/bank-reconciliation/summary?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!selectedAccountId && !!statementBalance,
  });

  // Reconcile mutation
  const reconcileMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/bank-reconciliation/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          accountId: selectedAccountId,
          statementDate,
          statementBalance,
          transactionIds: Array.from(selectedTransactions),
        }),
      });
      if (!response.ok) throw new Error('Failed to reconcile');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-reconciliation-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['bank-accounts'] });
      setSelectedTransactions(new Set());
      toast({ title: 'Reconciliation completed successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to complete reconciliation', variant: 'destructive' });
    },
  });

  const selectedAccount = accounts?.find(a => a.id === selectedAccountId);

  const toggleTransaction = (id: string) => {
    const newSelected = new Set(selectedTransactions);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedTransactions(newSelected);
  };

  const toggleAllUnreconciled = () => {
    const unreconciledIds = transactions?.filter(t => !t.isReconciled).map(t => t.id) || [];
    if (unreconciledIds.every(id => selectedTransactions.has(id))) {
      // Deselect all
      setSelectedTransactions(new Set());
    } else {
      // Select all unreconciled
      setSelectedTransactions(new Set(unreconciledIds));
    }
  };

  // Calculate selected totals
  const selectedCredits = transactions
    ?.filter(t => selectedTransactions.has(t.id) && t.type === 'credit')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;
  const selectedDebits = transactions
    ?.filter(t => selectedTransactions.has(t.id) && t.type === 'debit')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;

  // Calculate difference
  const bookBalance = parseFloat(selectedAccount?.currentBalance || '0');
  const statementBal = parseFloat(statementBalance || '0');
  const unreconciledCreditsTotal = transactions
    ?.filter(t => !t.isReconciled && !selectedTransactions.has(t.id) && t.type === 'credit')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;
  const unreconciledDebitsTotal = transactions
    ?.filter(t => !t.isReconciled && !selectedTransactions.has(t.id) && t.type === 'debit')
    .reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;
  const adjustedBookBalance = bookBalance - unreconciledCreditsTotal + unreconciledDebitsTotal;
  const difference = statementBal - adjustedBookBalance;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bank Reconciliation</h1>
          <p className="text-muted-foreground">
            Match your bank statement with book records
          </p>
        </div>
      </div>

      {/* Selection Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Reconciliation Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Bank Account</Label>
              <Select
                value={selectedAccountId}
                onValueChange={setSelectedAccountId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts?.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.accountName} - {account.bankName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Statement Date</Label>
              <Input
                type="date"
                value={statementDate}
                onChange={(e) => setStatementDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Statement Closing Balance</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={statementBalance}
                onChange={(e) => setStatementBalance(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                className="w-full"
                disabled={!selectedAccountId || !statementBalance || reconcileMutation.isPending}
                onClick={() => reconcileMutation.mutate()}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                {reconcileMutation.isPending ? 'Reconciling...' : 'Reconcile'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedAccountId && (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Book Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(bookBalance)}
                </div>
                <p className="text-xs text-muted-foreground">As per books</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Statement Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(statementBal)}
                </div>
                <p className="text-xs text-muted-foreground">Per bank statement</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Adjusted Book Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(adjustedBookBalance)}
                </div>
                <p className="text-xs text-muted-foreground">After pending items</p>
              </CardContent>
            </Card>
            <Card className={difference === 0 ? 'border-green-500' : 'border-yellow-500'}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  {difference === 0 ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                  )}
                  Difference
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${difference === 0 ? 'text-green-600' : 'text-yellow-600'}`}>
                  {formatCurrency(Math.abs(difference))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {difference === 0 ? 'Balanced' : 'To reconcile'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Selected Items Summary */}
          {selectedTransactions.size > 0 && (
            <Card className="bg-blue-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="font-medium">{selectedTransactions.size} items selected</span>
                    <span className="text-green-600">
                      Credits: {formatCurrency(selectedCredits)}
                    </span>
                    <span className="text-red-600">
                      Debits: {formatCurrency(selectedDebits)}
                    </span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSelectedTransactions(new Set())}>
                    Clear Selection
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transactions List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5" />
                  Unreconciled Transactions
                </span>
                <Button variant="outline" size="sm" onClick={toggleAllUnreconciled}>
                  {transactions?.filter(t => !t.isReconciled).every(t => selectedTransactions.has(t.id))
                    ? 'Deselect All'
                    : 'Select All'}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !transactions?.length ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <p className="text-muted-foreground">All transactions are reconciled</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Match</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Deposits</TableHead>
                      <TableHead className="text-right">Withdrawals</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((txn) => (
                      <TableRow
                        key={txn.id}
                        className={txn.isReconciled ? 'bg-green-50' : selectedTransactions.has(txn.id) ? 'bg-blue-50' : ''}
                      >
                        <TableCell>
                          <Checkbox
                            checked={txn.isReconciled || selectedTransactions.has(txn.id)}
                            disabled={txn.isReconciled}
                            onCheckedChange={() => toggleTransaction(txn.id)}
                          />
                        </TableCell>
                        <TableCell>
                          {new Date(txn.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{txn.description}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {txn.reference || '-'}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {txn.type === 'credit' && (
                            <span className="inline-flex items-center gap-1">
                              <ArrowDownLeft className="h-3 w-3" />
                              {formatCurrency(parseFloat(txn.amount))}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-red-600">
                          {txn.type === 'debit' && (
                            <span className="inline-flex items-center gap-1">
                              <ArrowUpRight className="h-3 w-3" />
                              {formatCurrency(parseFloat(txn.amount))}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {txn.isReconciled ? (
                            <span className="inline-flex items-center gap-1 text-green-600 text-xs">
                              <CheckCircle className="h-3 w-3" />
                              Reconciled
                            </span>
                          ) : txn.isMatched ? (
                            <span className="inline-flex items-center gap-1 text-blue-600 text-xs">
                              <Clock className="h-3 w-3" />
                              Matched
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-yellow-600 text-xs">
                              <AlertCircle className="h-3 w-3" />
                              Pending
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Reconciliation Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Reconciliation Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span>Bank Statement Balance (as of {new Date(statementDate).toLocaleDateString()})</span>
                  <span className="font-medium">{formatCurrency(statementBal)}</span>
                </div>
                <div className="flex justify-between py-2 text-green-600">
                  <span>Add: Deposits in Transit (not in statement)</span>
                  <span>+ {formatCurrency(unreconciledCreditsTotal)}</span>
                </div>
                <div className="flex justify-between py-2 text-red-600">
                  <span>Less: Outstanding Checks/Payments</span>
                  <span>- {formatCurrency(unreconciledDebitsTotal)}</span>
                </div>
                <div className="flex justify-between py-2 border-t font-bold">
                  <span>Adjusted Bank Balance</span>
                  <span>{formatCurrency(statementBal + unreconciledCreditsTotal - unreconciledDebitsTotal)}</span>
                </div>
                <div className="flex justify-between py-2 border-t">
                  <span>Book Balance (as per records)</span>
                  <span className="font-medium">{formatCurrency(bookBalance)}</span>
                </div>
                <div className={`flex justify-between py-2 border-t font-bold ${difference === 0 ? 'text-green-600' : 'text-yellow-600'}`}>
                  <span>Difference</span>
                  <span>{formatCurrency(difference)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
