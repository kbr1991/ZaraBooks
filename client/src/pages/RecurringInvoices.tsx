import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import {
  RefreshCw,
  Plus,
  Search,
  Play,
  Pause,
  Trash2,
  Eye,
  Calendar,
  FileText,
  Repeat,
  CheckCircle,
  XCircle,
  Mail,
} from 'lucide-react';

interface RecurringInvoice {
  id: string;
  name: string;
  customerId: string;
  customer?: {
    id: string;
    name: string;
    email?: string;
  };
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  startDate: string;
  endDate?: string;
  nextGenerateDate?: string;
  templateData: {
    lines: Array<{
      description: string;
      quantity: number;
      rate: number;
      amount: number;
    }>;
    notes?: string;
    terms?: string;
    subtotal: number;
    taxAmount: number;
    total: number;
  };
  autoSend: boolean;
  sendMethod: string;
  sendDaysBefore: number;
  isActive: boolean;
  isPaused: boolean;
  lastGeneratedAt?: string;
  totalGenerated: number;
  createdAt: string;
}

const frequencies = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

export default function RecurringInvoices() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedRecurring, setSelectedRecurring] = useState<RecurringInvoice | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    customerId: '',
    frequency: 'monthly',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    autoSend: false,
    sendDaysBefore: 0,
    lines: [{ description: '', quantity: 1, rate: 0, amount: 0 }],
    notes: '',
    terms: '',
  });

  // Fetch recurring invoices
  const { data: recurringInvoices, isLoading } = useQuery<RecurringInvoice[]>({
    queryKey: ['/api/recurring-invoices'],
  });

  // Fetch customers
  const { data: customers } = useQuery<Array<{ id: string; name: string; email?: string }>>({
    queryKey: ['/api/parties', { partyType: 'customer' }],
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/recurring-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recurring-invoices'] });
      toast({ title: 'Recurring invoice created' });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create', description: error.message, variant: 'destructive' });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/recurring-invoices/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recurring-invoices'] });
      toast({ title: 'Recurring invoice deleted' });
    },
  });

  // Pause mutation
  const pauseMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/recurring-invoices/${id}/pause`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recurring-invoices'] });
      toast({ title: 'Recurring invoice paused' });
    },
  });

  // Resume mutation
  const resumeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/recurring-invoices/${id}/resume`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recurring-invoices'] });
      toast({ title: 'Recurring invoice resumed' });
    },
  });

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/recurring-invoices/${id}/generate`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/recurring-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      toast({ title: 'Invoice generated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to generate', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      customerId: '',
      frequency: 'monthly',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '',
      autoSend: false,
      sendDaysBefore: 0,
      lines: [{ description: '', quantity: 1, rate: 0, amount: 0 }],
      notes: '',
      terms: '',
    });
  };

  const filteredInvoices = recurringInvoices?.filter((inv) => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!inv.name.toLowerCase().includes(search) &&
          !inv.customer?.name?.toLowerCase().includes(search)) {
        return false;
      }
    }
    if (statusFilter === 'active' && (!inv.isActive || inv.isPaused)) return false;
    if (statusFilter === 'paused' && !inv.isPaused) return false;
    if (statusFilter === 'inactive' && inv.isActive) return false;
    return true;
  });

  const getStatusBadge = (inv: RecurringInvoice) => {
    if (!inv.isActive) {
      return <Badge variant="outline" className="text-gray-600"><XCircle className="w-3 h-3 mr-1" />Inactive</Badge>;
    }
    if (inv.isPaused) {
      return <Badge variant="outline" className="text-orange-600"><Pause className="w-3 h-3 mr-1" />Paused</Badge>;
    }
    return <Badge variant="outline" className="text-green-600"><CheckCircle className="w-3 h-3 mr-1" />Active</Badge>;
  };

  const getFrequencyBadge = (frequency: string) => {
    const colors: Record<string, string> = {
      weekly: 'bg-purple-100 text-purple-800',
      monthly: 'bg-blue-100 text-blue-800',
      quarterly: 'bg-green-100 text-green-800',
      yearly: 'bg-orange-100 text-orange-800',
    };
    return <Badge className={colors[frequency] || 'bg-gray-100'}>{frequency}</Badge>;
  };

  const handleLineChange = (index: number, field: string, value: any) => {
    const newLines = [...formData.lines];
    newLines[index] = { ...newLines[index], [field]: value };
    if (field === 'quantity' || field === 'rate') {
      newLines[index].amount = newLines[index].quantity * newLines[index].rate;
    }
    setFormData({ ...formData, lines: newLines });
  };

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [...formData.lines, { description: '', quantity: 1, rate: 0, amount: 0 }],
    });
  };

  const removeLine = (index: number) => {
    if (formData.lines.length > 1) {
      const newLines = formData.lines.filter((_, i) => i !== index);
      setFormData({ ...formData, lines: newLines });
    }
  };

  const calculateTotal = () => {
    return formData.lines.reduce((sum, line) => sum + line.amount, 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Recurring Invoices</h1>
          <p className="text-gray-500">Automate your billing with recurring invoice templates</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Recurring Invoice
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Repeat className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {recurringInvoices?.filter(i => i.isActive && !i.isPaused).length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Running schedules</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Paused</CardTitle>
            <Pause className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {recurringInvoices?.filter(i => i.isPaused).length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Temporarily stopped</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Generated</CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {recurringInvoices?.reduce((sum, i) => sum + i.totalGenerated, 0) || 0}
            </div>
            <p className="text-xs text-muted-foreground">Total invoices created</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Value</CardTitle>
            <Calendar className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                recurringInvoices?.filter(i => i.isActive && !i.isPaused && i.frequency === 'monthly')
                  .reduce((sum, i) => sum + (i.templateData?.total || 0), 0) || 0
              )}
            </div>
            <p className="text-xs text-muted-foreground">Expected billing</p>
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
                  placeholder="Search recurring invoices..."
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
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
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
                  <TableHead>Name</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Next Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Auto-Send</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No recurring invoices found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices?.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.name}</TableCell>
                      <TableCell>{inv.customer?.name || '-'}</TableCell>
                      <TableCell>{getFrequencyBadge(inv.frequency)}</TableCell>
                      <TableCell>
                        {inv.nextGenerateDate
                          ? new Date(inv.nextGenerateDate).toLocaleDateString()
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(inv.templateData?.total || 0)}
                      </TableCell>
                      <TableCell>{getStatusBadge(inv)}</TableCell>
                      <TableCell>
                        {inv.autoSend ? (
                          <Badge variant="outline" className="text-green-600">
                            <Mail className="w-3 h-3 mr-1" />Yes
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-500">No</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedRecurring(inv);
                              setShowViewDialog(true);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {inv.isActive && !inv.isPaused ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => pauseMutation.mutate(inv.id)}
                            >
                              <Pause className="w-4 h-4" />
                            </Button>
                          ) : inv.isPaused ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => resumeMutation.mutate(inv.id)}
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => generateMutation.mutate(inv.id)}
                            disabled={generateMutation.isPending}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm('Delete this recurring invoice?')) {
                                deleteMutation.mutate(inv.id);
                              }
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
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

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Recurring Invoice</DialogTitle>
            <DialogDescription>
              Set up automatic invoice generation on a schedule
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Template Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Monthly Retainer - Client X"
                />
              </div>
              <div>
                <Label>Customer</Label>
                <Select
                  value={formData.customerId}
                  onValueChange={(value) => setFormData({ ...formData, customerId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Frequency</Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(value) => setFormData({ ...formData, frequency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {frequencies.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div>
                <Label>End Date (Optional)</Label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <Label className="mb-2 block">Line Items</Label>
              <div className="space-y-2">
                {formData.lines.map((line, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-center">
                    <Input
                      className="col-span-5"
                      placeholder="Description"
                      value={line.description}
                      onChange={(e) => handleLineChange(index, 'description', e.target.value)}
                    />
                    <Input
                      className="col-span-2"
                      type="number"
                      placeholder="Qty"
                      value={line.quantity}
                      onChange={(e) => handleLineChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                    />
                    <Input
                      className="col-span-2"
                      type="number"
                      placeholder="Rate"
                      value={line.rate}
                      onChange={(e) => handleLineChange(index, 'rate', parseFloat(e.target.value) || 0)}
                    />
                    <div className="col-span-2 text-right font-medium">
                      {formatCurrency(line.amount)}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="col-span-1"
                      onClick={() => removeLine(index)}
                      disabled={formData.lines.length === 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="mt-2" onClick={addLine}>
                <Plus className="w-4 h-4 mr-1" /> Add Line
              </Button>
              <div className="mt-4 text-right">
                <span className="font-semibold">Total: {formatCurrency(calculateTotal())}</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.autoSend}
                  onCheckedChange={(checked) => setFormData({ ...formData, autoSend: checked })}
                />
                <Label>Auto-send to customer</Label>
              </div>
              {formData.autoSend && (
                <div className="flex items-center gap-2">
                  <Label>Send</Label>
                  <Input
                    type="number"
                    className="w-20"
                    value={formData.sendDaysBefore}
                    onChange={(e) => setFormData({ ...formData, sendDaysBefore: parseInt(e.target.value) || 0 })}
                  />
                  <Label>days before due date</Label>
                </div>
              )}
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notes to appear on invoice..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const total = calculateTotal();
                createMutation.mutate({
                  ...formData,
                  templateData: {
                    lines: formData.lines,
                    notes: formData.notes,
                    terms: formData.terms,
                    subtotal: total,
                    taxAmount: 0,
                    total: total,
                  },
                });
              }}
              disabled={!formData.name || !formData.customerId || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedRecurring?.name}</DialogTitle>
            <DialogDescription>Recurring invoice details</DialogDescription>
          </DialogHeader>
          {selectedRecurring && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Customer</Label>
                  <p className="font-medium">{selectedRecurring.customer?.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Frequency</Label>
                  <p>{getFrequencyBadge(selectedRecurring.frequency)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Next Generation</Label>
                  <p>{selectedRecurring.nextGenerateDate
                    ? new Date(selectedRecurring.nextGenerateDate).toLocaleDateString()
                    : 'N/A'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Total Generated</Label>
                  <p>{selectedRecurring.totalGenerated} invoices</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <div className="mt-1">{getStatusBadge(selectedRecurring)}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">Amount per Invoice</Label>
                <p className="text-2xl font-bold">
                  {formatCurrency(selectedRecurring.templateData?.total || 0)}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewDialog(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                if (selectedRecurring) {
                  generateMutation.mutate(selectedRecurring.id);
                  setShowViewDialog(false);
                }
              }}
              disabled={generateMutation.isPending}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Generate Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
