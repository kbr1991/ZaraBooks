import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { toast } from '@/hooks/useToast';
import { formatCurrency } from '@/lib/utils';
import { Plus, Trash2, Save, Check, ArrowLeft } from 'lucide-react';

interface EntryLine {
  id?: string;
  accountId: string;
  accountName?: string;
  debitAmount: string;
  creditAmount: string;
  description: string;
  partyId?: string;
}

export default function JournalEntryForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = Boolean(id);

  const [formData, setFormData] = useState({
    entryDate: new Date().toISOString().split('T')[0],
    narration: '',
    fiscalYearId: '',
  });

  const [lines, setLines] = useState<EntryLine[]>([
    { accountId: '', debitAmount: '', creditAmount: '', description: '' },
    { accountId: '', debitAmount: '', creditAmount: '', description: '' },
  ]);

  // Fetch fiscal years
  const { data: fiscalYears } = useQuery({
    queryKey: ['fiscal-years'],
    queryFn: async () => {
      const response = await fetch('/api/companies/current/fiscal-years', {
        credentials: 'include',
      });
      if (!response.ok) {
        // Fallback - get from auth endpoint
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

  // Fetch accounts for dropdown
  const { data: accounts } = useQuery({
    queryKey: ['ledger-accounts'],
    queryFn: async () => {
      const response = await fetch('/api/chart-of-accounts/ledgers/list', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch accounts');
      return response.json();
    },
  });

  // Fetch existing entry if editing
  const { data: existingEntry } = useQuery({
    queryKey: ['journal-entry', id],
    queryFn: async () => {
      const response = await fetch(`/api/journal-entries/${id}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch entry');
      return response.json();
    },
    enabled: isEditing,
  });

  // Set default fiscal year
  useEffect(() => {
    if (fiscalYears && fiscalYears.length > 0 && !formData.fiscalYearId) {
      const currentFy = fiscalYears.find((fy: any) => fy.isCurrent);
      if (currentFy) {
        setFormData((prev) => ({ ...prev, fiscalYearId: currentFy.id }));
      }
    }
  }, [fiscalYears]);

  // Load existing entry data
  useEffect(() => {
    if (existingEntry) {
      setFormData({
        entryDate: existingEntry.entryDate,
        narration: existingEntry.narration || '',
        fiscalYearId: existingEntry.fiscalYearId,
      });
      setLines(
        existingEntry.lines.map((line: any) => ({
          id: line.id,
          accountId: line.accountId,
          accountName: line.account?.name,
          debitAmount: line.debitAmount !== '0' ? line.debitAmount : '',
          creditAmount: line.creditAmount !== '0' ? line.creditAmount : '',
          description: line.description || '',
          partyId: line.partyId,
        }))
      );
    }
  }, [existingEntry]);

  const saveMutation = useMutation({
    mutationFn: async (data: { formData: typeof formData; lines: EntryLine[]; status: string }) => {
      const url = isEditing ? `/api/journal-entries/${id}` : '/api/journal-entries';
      const method = isEditing ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...data.formData,
          status: data.status,
          lines: data.lines.map((line) => ({
            accountId: line.accountId,
            debitAmount: line.debitAmount || '0',
            creditAmount: line.creditAmount || '0',
            description: line.description,
            partyId: line.partyId,
          })),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save entry');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      toast({ title: 'Entry saved successfully!' });
      navigate('/journal-entries');
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to save entry',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const addLine = () => {
    setLines([...lines, { accountId: '', debitAmount: '', creditAmount: '', description: '' }]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 2) {
      toast({
        title: 'Minimum 2 lines required',
        variant: 'destructive',
      });
      return;
    }
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: keyof EntryLine, value: string) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };

    // If setting debit, clear credit and vice versa
    if (field === 'debitAmount' && value) {
      newLines[index].creditAmount = '';
    } else if (field === 'creditAmount' && value) {
      newLines[index].debitAmount = '';
    }

    setLines(newLines);
  };

  const totalDebit = lines.reduce((sum, line) => sum + (parseFloat(line.debitAmount) || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (parseFloat(line.creditAmount) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const handleSave = (status: 'draft' | 'posted') => {
    if (!formData.fiscalYearId) {
      toast({ title: 'Please select a fiscal year', variant: 'destructive' });
      return;
    }

    if (!isBalanced) {
      toast({ title: 'Entry must be balanced', variant: 'destructive' });
      return;
    }

    const validLines = lines.filter(
      (line) => line.accountId && (line.debitAmount || line.creditAmount)
    );

    if (validLines.length < 2) {
      toast({ title: 'At least 2 lines are required', variant: 'destructive' });
      return;
    }

    saveMutation.mutate({ formData, lines: validLines, status });
  };

  const canEdit = !isEditing || existingEntry?.status === 'draft';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/journal-entries')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {isEditing ? `Entry: ${existingEntry?.entryNumber || ''}` : 'New Journal Entry'}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? 'View or edit entry details' : 'Create a new journal entry'}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Entry Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={formData.entryDate}
                  onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-2">
                <Label>Fiscal Year *</Label>
                <Select
                  value={formData.fiscalYearId}
                  onValueChange={(value) => setFormData({ ...formData, fiscalYearId: value })}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
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
            </div>
            <div className="space-y-2">
              <Label>Narration</Label>
              <Input
                placeholder="Enter narration..."
                value={formData.narration}
                onChange={(e) => setFormData({ ...formData, narration: e.target.value })}
                disabled={!canEdit}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Totals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Debit</span>
              <span className="font-medium">{formatCurrency(totalDebit)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Credit</span>
              <span className="font-medium">{formatCurrency(totalCredit)}</span>
            </div>
            <hr />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Difference</span>
              <span className={isBalanced ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                {formatCurrency(Math.abs(totalDebit - totalCredit))}
              </span>
            </div>
            {isBalanced && (
              <div className="flex items-center gap-2 text-green-600 text-sm">
                <Check className="h-4 w-4" />
                Entry is balanced
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Entry Lines</CardTitle>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={addLine}>
              <Plus className="h-4 w-4 mr-2" />
              Add Line
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="py-2 pl-4 text-left text-sm font-medium w-[35%]">Account</th>
                <th className="py-2 text-left text-sm font-medium w-[25%]">Description</th>
                <th className="py-2 text-right text-sm font-medium w-[15%]">Debit</th>
                <th className="py-2 text-right text-sm font-medium w-[15%]">Credit</th>
                <th className="py-2 pr-4 text-center text-sm font-medium w-[10%]"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={index} className="border-b">
                  <td className="py-2 pl-4">
                    <Select
                      value={line.accountId}
                      onValueChange={(value) => updateLine(index, 'accountId', value)}
                      disabled={!canEdit}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts?.map((account: any) => (
                          <SelectItem key={account.id} value={account.id}>
                            <span className="font-mono text-xs mr-2">{account.code}</span>
                            {account.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-2">
                    <Input
                      placeholder="Description"
                      value={line.description}
                      onChange={(e) => updateLine(index, 'description', e.target.value)}
                      disabled={!canEdit}
                    />
                  </td>
                  <td className="py-2 text-right">
                    <Input
                      type="number"
                      placeholder="0.00"
                      className="text-right"
                      value={line.debitAmount}
                      onChange={(e) => updateLine(index, 'debitAmount', e.target.value)}
                      disabled={!canEdit}
                    />
                  </td>
                  <td className="py-2 text-right">
                    <Input
                      type="number"
                      placeholder="0.00"
                      className="text-right"
                      value={line.creditAmount}
                      onChange={(e) => updateLine(index, 'creditAmount', e.target.value)}
                      disabled={!canEdit}
                    />
                  </td>
                  <td className="py-2 pr-4 text-center">
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLine(index)}
                        disabled={lines.length <= 2}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {canEdit && (
        <div className="flex gap-4">
          <Button
            onClick={() => handleSave('draft')}
            variant="outline"
            disabled={saveMutation.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            Save as Draft
          </Button>
          <Button
            onClick={() => handleSave('posted')}
            disabled={!isBalanced || saveMutation.isPending}
          >
            <Check className="h-4 w-4 mr-2" />
            Save & Post
          </Button>
        </div>
      )}
    </div>
  );
}
