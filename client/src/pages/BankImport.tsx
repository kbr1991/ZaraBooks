import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { useToast } from '@/hooks/useToast';
import {
  Upload,
  FileText,
  Check,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Building2,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';

interface ParsedTransaction {
  date: string;
  description: string;
  debit?: number;
  credit?: number;
  balance?: number;
  reference?: string;
  suggestedAccountId?: string;
  suggestedAccountName?: string;
  suggestedPartyId?: string;
  suggestedPartyName?: string;
  isMatched: boolean;
  // User selections
  accountId?: string;
  partyId?: string;
  selected?: boolean;
}

interface Account {
  id: string;
  code: string;
  name: string;
  accountType: string;
}

export default function BankImport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'upload' | 'review' | 'complete'>('upload');
  const [bankAccountId, setBankAccountId] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    matched: number;
    unmatched: number;
    totalDebit: number;
    totalCredit: number;
  } | null>(null);

  // Fetch accounts for bank account selection and transaction matching
  const { data: accountsData } = useQuery({
    queryKey: ['chart-of-accounts-list'],
    queryFn: async () => {
      const response = await fetch('/api/chart-of-accounts/ledgers/list', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch accounts');
      return response.json();
    },
  });

  // Fetch parties
  const { data: partiesData } = useQuery({
    queryKey: ['parties'],
    queryFn: async () => {
      const response = await fetch('/api/parties', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch parties');
      return response.json();
    },
  });

  const accounts: Account[] = accountsData || [];
  const bankAccounts = accounts.filter(
    (a) =>
      a.name.toLowerCase().includes('bank') ||
      a.name.toLowerCase().includes('cash')
  );

  // Parse mutation
  const parseMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch('/api/bank-import/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content,
          bankAccountId,
          format: 'csv',
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to parse statement');
      }
      return response.json();
    },
    onSuccess: (data) => {
      const txns = data.transactions.map((t: ParsedTransaction) => ({
        ...t,
        accountId: t.suggestedAccountId,
        partyId: t.suggestedPartyId,
        selected: t.isMatched,
      }));
      setTransactions(txns);
      setSummary(data.summary);
      setStep('review');
    },
    onError: (error: Error) => {
      toast({
        title: 'Parse Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (txns: ParsedTransaction[]) => {
      const response = await fetch('/api/bank-import/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          bankAccountId,
          transactions: txns.map((t) => ({
            date: t.date,
            description: t.description,
            debit: t.debit,
            credit: t.credit,
            reference: t.reference,
            accountId: t.accountId,
            partyId: t.partyId,
          })),
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to import transactions');
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Import Successful',
        description: `Created ${data.created} journal entries`,
      });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      setStep('complete');
    },
    onError: (error: Error) => {
      toast({
        title: 'Import Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setFileContent(content);
    };
    reader.readAsText(file);
  };

  const handleParse = () => {
    if (!fileContent) {
      toast({
        title: 'No File Selected',
        description: 'Please select a CSV file to import',
        variant: 'destructive',
      });
      return;
    }
    if (!bankAccountId) {
      toast({
        title: 'Bank Account Required',
        description: 'Please select a bank account',
        variant: 'destructive',
      });
      return;
    }
    parseMutation.mutate(fileContent);
  };

  const handleToggleAll = (checked: boolean) => {
    setTransactions((prev) =>
      prev.map((t) => ({
        ...t,
        selected: t.accountId ? checked : false,
      }))
    );
  };

  const handleToggle = (index: number) => {
    setTransactions((prev) =>
      prev.map((t, i) =>
        i === index ? { ...t, selected: !t.selected } : t
      )
    );
  };

  const handleAccountChange = (index: number, accountId: string) => {
    setTransactions((prev) =>
      prev.map((t, i) =>
        i === index ? { ...t, accountId, selected: !!accountId } : t
      )
    );
  };

  const handlePartyChange = (index: number, partyId: string) => {
    setTransactions((prev) =>
      prev.map((t, i) =>
        i === index ? { ...t, partyId: partyId || undefined } : t
      )
    );
  };

  const handleImport = () => {
    const selected = transactions.filter((t) => t.selected && t.accountId);
    if (selected.length === 0) {
      toast({
        title: 'No Transactions Selected',
        description: 'Please select at least one transaction to import',
        variant: 'destructive',
      });
      return;
    }
    importMutation.mutate(selected);
  };

  const handleReset = () => {
    setStep('upload');
    setFileContent('');
    setTransactions([]);
    setSummary(null);
  };

  const validCount = transactions.filter((t) => t.selected && t.accountId).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Bank Statement Import</h1>
        <p className="text-muted-foreground">
          Import bank statements and create journal entries automatically
        </p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-4">
        <div
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium',
            step === 'upload' ? 'bg-primary text-primary-foreground' : 'bg-muted'
          )}
        >
          <Upload className="h-4 w-4" />
          1. Upload
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <div
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium',
            step === 'review' ? 'bg-primary text-primary-foreground' : 'bg-muted'
          )}
        >
          <FileText className="h-4 w-4" />
          2. Review & Match
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
        <div
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium',
            step === 'complete' ? 'bg-primary text-primary-foreground' : 'bg-muted'
          )}
        >
          <Check className="h-4 w-4" />
          3. Complete
        </div>
      </div>

      {/* Upload Step */}
      {step === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Bank Statement</CardTitle>
            <CardDescription>
              Upload a CSV file exported from your bank. Supported formats: CSV
              with Date, Description, Debit, Credit columns.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Bank Account</Label>
              <Select value={bankAccountId} onValueChange={setBankAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select bank account" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Statement File (CSV)</Label>
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {fileContent
                      ? 'File loaded. Click to change.'
                      : 'Click to select CSV file'}
                  </span>
                </label>
              </div>
            </div>

            {fileContent && (
              <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-sm text-green-700">
                  File loaded successfully
                </span>
              </div>
            )}

            <Button
              onClick={handleParse}
              disabled={!fileContent || !bankAccountId || parseMutation.isPending}
              className="w-full"
            >
              {parseMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Parsing...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Parse Statement
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Review Step */}
      {step === 'review' && (
        <>
          {/* Summary */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Total Transactions</p>
                  <p className="text-2xl font-bold">{summary.total}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Auto-Matched</p>
                  <p className="text-2xl font-bold text-green-600">{summary.matched}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Total Debits</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(summary.totalDebit)}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-sm text-muted-foreground">Total Credits</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(summary.totalCredit)}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Transactions Table */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Review Transactions</CardTitle>
                <CardDescription>
                  Verify account mappings and select transactions to import
                </CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  {validCount} of {transactions.length} selected
                </span>
                <Button
                  onClick={handleImport}
                  disabled={validCount === 0 || importMutation.isPending}
                >
                  {importMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Import Selected ({validCount})
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          transactions.length > 0 &&
                          transactions.filter((t) => t.accountId).every((t) => t.selected)
                        }
                        onCheckedChange={handleToggleAll}
                      />
                    </TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead className="w-12">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((txn, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Checkbox
                          checked={txn.selected}
                          onCheckedChange={() => handleToggle(index)}
                          disabled={!txn.accountId}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {txn.date}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {txn.description}
                      </TableCell>
                      <TableCell className="text-right text-red-600 font-mono">
                        {txn.debit ? formatCurrency(txn.debit) : '-'}
                      </TableCell>
                      <TableCell className="text-right text-green-600 font-mono">
                        {txn.credit ? formatCurrency(txn.credit) : '-'}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={txn.accountId || ''}
                          onValueChange={(v) => handleAccountChange(index, v)}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="Select account" />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.code} - {a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={txn.partyId || ''}
                          onValueChange={(v) => handlePartyChange(index, v)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Optional" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">None</SelectItem>
                            {(partiesData || []).map((p: any) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {txn.accountId ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button variant="outline" onClick={handleReset}>
              Start Over
            </Button>
          </div>
        </>
      )}

      {/* Complete Step */}
      {step === 'complete' && (
        <Card>
          <CardContent className="pt-8 text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Import Complete!</h2>
            <p className="text-muted-foreground mb-6">
              Journal entries have been created from your bank statement.
              They are saved as drafts for your review.
            </p>
            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={handleReset}>
                Import Another Statement
              </Button>
              <Button onClick={() => window.location.href = '/journal-entries'}>
                <Building2 className="h-4 w-4 mr-2" />
                View Journal Entries
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
