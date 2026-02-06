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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/useToast';
import {
  Plus,
  Trash2,
  Play,
  Pause,
  Calendar,
  RefreshCw,
  Edit2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

interface TemplateLine {
  accountId: string;
  accountName?: string;
  debitAmount: number;
  creditAmount: number;
  description?: string;
}

interface RecurringTemplate {
  id: string;
  name: string;
  narration: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  nextRunDate: string;
  endDate?: string;
  templateLines: TemplateLine[];
  isActive: boolean;
  lastRunAt?: string;
  createdAt: string;
}

interface Account {
  id: string;
  code: string;
  name: string;
  accountType: string;
}

export default function RecurringEntries() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RecurringTemplate | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    narration: string;
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
    nextRunDate: string;
    endDate: string;
    lines: TemplateLine[];
  }>({
    name: '',
    narration: '',
    frequency: 'monthly',
    nextRunDate: '',
    endDate: '',
    lines: [
      { accountId: '', debitAmount: 0, creditAmount: 0, description: '' },
      { accountId: '', debitAmount: 0, creditAmount: 0, description: '' },
    ],
  });

  // Fetch templates
  const { data: templates, isLoading } = useQuery<RecurringTemplate[]>({
    queryKey: ['recurring-templates'],
    queryFn: async () => {
      const response = await fetch('/api/recurring-entries', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch templates');
      return response.json();
    },
  });

  // Fetch accounts
  const { data: accounts } = useQuery<Account[]>({
    queryKey: ['chart-of-accounts-list'],
    queryFn: async () => {
      const response = await fetch('/api/chart-of-accounts/ledgers/list', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch accounts');
      return response.json();
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch('/api/recurring-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: data.name,
          narration: data.narration,
          frequency: data.frequency,
          nextRunDate: data.nextRunDate,
          endDate: data.endDate || null,
          templateLines: data.lines.filter(l => l.accountId && (l.debitAmount || l.creditAmount)),
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create template');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-templates'] });
      toast({ title: 'Template Created', description: 'Recurring entry template has been created' });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<RecurringTemplate> }) => {
      const response = await fetch(`/api/recurring-entries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update template');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-templates'] });
      toast({ title: 'Template Updated' });
      setEditingTemplate(null);
      resetForm();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update template', variant: 'destructive' });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/recurring-entries/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete template');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-templates'] });
      toast({ title: 'Template Deleted' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete template', variant: 'destructive' });
    },
  });

  // Generate entry mutation
  const generateMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/recurring-entries/${id}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error('Failed to generate entry');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['recurring-templates'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      toast({
        title: 'Entry Generated',
        description: `Journal entry ${data.entryNumber} created`,
      });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to generate entry', variant: 'destructive' });
    },
  });

  // Process all due mutation
  const processAllMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/recurring-entries/process-due', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to process templates');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['recurring-templates'] });
      queryClient.invalidateQueries({ queryKey: ['journal-entries'] });
      toast({
        title: 'Processing Complete',
        description: `Created ${data.processed} entries, ${data.failed} failed`,
      });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to process templates', variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      narration: '',
      frequency: 'monthly',
      nextRunDate: '',
      endDate: '',
      lines: [
        { accountId: '', debitAmount: 0, creditAmount: 0, description: '' },
        { accountId: '', debitAmount: 0, creditAmount: 0, description: '' },
      ],
    });
  };

  const addLine = () => {
    setFormData(prev => ({
      ...prev,
      lines: [...prev.lines, { accountId: '', debitAmount: 0, creditAmount: 0, description: '' }],
    }));
  };

  const removeLine = (index: number) => {
    if (formData.lines.length <= 2) return;
    setFormData(prev => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index),
    }));
  };

  const updateLine = (index: number, field: keyof TemplateLine, value: any) => {
    setFormData(prev => ({
      ...prev,
      lines: prev.lines.map((line, i) =>
        i === index ? { ...line, [field]: value } : line
      ),
    }));
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.nextRunDate) {
      toast({ title: 'Validation Error', description: 'Name and next run date are required', variant: 'destructive' });
      return;
    }

    const totalDebit = formData.lines.reduce((sum, l) => sum + (l.debitAmount || 0), 0);
    const totalCredit = formData.lines.reduce((sum, l) => sum + (l.creditAmount || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      toast({ title: 'Validation Error', description: 'Debits must equal credits', variant: 'destructive' });
      return;
    }

    if (editingTemplate) {
      updateMutation.mutate({
        id: editingTemplate.id,
        data: {
          name: formData.name,
          narration: formData.narration,
          frequency: formData.frequency,
          nextRunDate: formData.nextRunDate,
          endDate: formData.endDate || undefined,
          templateLines: formData.lines.filter(l => l.accountId && (l.debitAmount || l.creditAmount)),
        },
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openEditDialog = (template: RecurringTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      narration: template.narration,
      frequency: template.frequency,
      nextRunDate: template.nextRunDate,
      endDate: template.endDate || '',
      lines: template.templateLines.length > 0
        ? template.templateLines
        : [
            { accountId: '', debitAmount: 0, creditAmount: 0, description: '' },
            { accountId: '', debitAmount: 0, creditAmount: 0, description: '' },
          ],
    });
  };

  const toggleActive = (template: RecurringTemplate) => {
    updateMutation.mutate({
      id: template.id,
      data: { isActive: !template.isActive },
    });
  };

  const totalDebit = formData.lines.reduce((sum, l) => sum + (l.debitAmount || 0), 0);
  const totalCredit = formData.lines.reduce((sum, l) => sum + (l.creditAmount || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const dueTemplates = templates?.filter(t => t.isActive && new Date(t.nextRunDate) <= new Date()) || [];

  const frequencyLabels: Record<string, string> = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    yearly: 'Yearly',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Recurring Entries</h1>
          <p className="text-muted-foreground">
            Manage recurring journal entry templates for automated posting
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dueTemplates.length > 0 && (
            <Button
              variant="outline"
              onClick={() => processAllMutation.mutate()}
              disabled={processAllMutation.isPending}
            >
              {processAllMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Process Due ({dueTemplates.length})
            </Button>
          )}
          <Dialog open={isCreateOpen || !!editingTemplate} onOpenChange={(open: boolean) => {
            if (!open) {
              setIsCreateOpen(false);
              setEditingTemplate(null);
              resetForm();
            } else {
              setIsCreateOpen(true);
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingTemplate ? 'Edit Template' : 'Create Recurring Entry Template'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Template Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Monthly Rent"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select
                      value={formData.frequency}
                      onValueChange={(v: any) => setFormData(prev => ({ ...prev, frequency: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Next Run Date</Label>
                    <Input
                      type="date"
                      value={formData.nextRunDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, nextRunDate: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Date (Optional)</Label>
                    <Input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Narration</Label>
                  <Input
                    value={formData.narration}
                    onChange={(e) => setFormData(prev => ({ ...prev, narration: e.target.value }))}
                    placeholder="Entry narration"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Entry Lines</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addLine}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Line
                    </Button>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account</TableHead>
                          <TableHead className="w-32">Debit</TableHead>
                          <TableHead className="w-32">Credit</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {formData.lines.map((line, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Select
                                value={line.accountId}
                                onValueChange={(v) => updateLine(index, 'accountId', v)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select account" />
                                </SelectTrigger>
                                <SelectContent>
                                  {accounts?.map((a) => (
                                    <SelectItem key={a.id} value={a.id}>
                                      {a.code} - {a.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={line.debitAmount || ''}
                                onChange={(e) => updateLine(index, 'debitAmount', parseFloat(e.target.value) || 0)}
                                className="text-right"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                value={line.creditAmount || ''}
                                onChange={(e) => updateLine(index, 'creditAmount', parseFloat(e.target.value) || 0)}
                                className="text-right"
                              />
                            </TableCell>
                            <TableCell>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeLine(index)}
                                disabled={formData.lines.length <= 2}
                              >
                                <Trash2 className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/50">
                          <TableCell className="font-semibold">Total</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(totalDebit)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(totalCredit)}
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  {!isBalanced && totalDebit > 0 && (
                    <div className="flex items-center gap-2 p-2 bg-red-50 text-red-700 rounded-md text-sm">
                      <AlertCircle className="h-4 w-4" />
                      Difference: {formatCurrency(Math.abs(totalDebit - totalCredit))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsCreateOpen(false);
                      setEditingTemplate(null);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={!isBalanced || createMutation.isPending || updateMutation.isPending}
                  >
                    {(createMutation.isPending || updateMutation.isPending) ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    {editingTemplate ? 'Update' : 'Create'} Template
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Due Templates Alert */}
      {dueTemplates.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">
                {dueTemplates.length} template{dueTemplates.length > 1 ? 's' : ''} due for processing
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Templates List */}
      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
          <CardDescription>
            Recurring entry templates for automated journal entries
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : templates?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No recurring templates yet. Create one to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Next Run</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates?.map((template) => {
                  const amount = (template.templateLines as TemplateLine[])
                    .reduce((sum, l) => sum + (l.debitAmount || 0), 0);
                  const isDue = template.isActive && new Date(template.nextRunDate) <= new Date();

                  return (
                    <TableRow key={template.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{template.name}</p>
                          {template.narration && (
                            <p className="text-sm text-muted-foreground">{template.narration}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{frequencyLabels[template.frequency]}</TableCell>
                      <TableCell className="font-mono">{formatCurrency(amount)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className={cn(isDue && 'text-yellow-600 font-medium')}>
                            {formatDate(template.nextRunDate)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {template.lastRunAt
                          ? formatDate(template.lastRunAt)
                          : <span className="text-muted-foreground">Never</span>}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                            template.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          )}
                        >
                          {template.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => generateMutation.mutate(template.id)}
                            disabled={generateMutation.isPending}
                            title="Generate entry now"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleActive(template)}
                            title={template.isActive ? 'Pause' : 'Activate'}
                          >
                            {template.isActive ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(template)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this template?')) {
                                deleteMutation.mutate(template.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
