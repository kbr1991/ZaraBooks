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
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import {
  FileText,
  Plus,
  Search,
  Eye,
  CheckCircle,
  Clock,
  XCircle,
  Receipt,
  Trash2,
} from 'lucide-react';

interface CreditNote {
  id: string;
  creditNoteNumber: string;
  creditNoteDate: string;
  customerId: string;
  customerName: string;
  invoiceId?: string;
  invoiceNumber?: string;
  reason: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  status: 'draft' | 'issued' | 'applied' | 'cancelled';
  appliedAmount: string;
  balanceAmount: string;
  items: CreditNoteItem[];
}

interface CreditNoteItem {
  id: string;
  description: string;
  quantity: number;
  rate: string;
  amount: string;
  hsnSac?: string;
  gstRate?: string;
}

interface Customer {
  id: string;
  name: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  totalAmount: string;
  status: string;
}

const reasons = [
  { value: 'return', label: 'Sales Return' },
  { value: 'discount', label: 'Post-Sale Discount' },
  { value: 'defect', label: 'Defective Goods' },
  { value: 'price_adjustment', label: 'Price Adjustment' },
  { value: 'other', label: 'Other' },
];

export default function CreditNotes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [selectedCreditNote, setSelectedCreditNote] = useState<CreditNote | null>(null);
  const [formData, setFormData] = useState({
    customerId: '',
    creditNoteDate: new Date().toISOString().split('T')[0],
    invoiceId: '',
    reason: '',
    items: [{ description: '', quantity: 1, rate: '', hsnSac: '', gstRate: '18' }],
  });
  const [applyData, setApplyData] = useState({
    invoiceId: '',
    amount: '',
  });

  // Fetch credit notes
  const { data: creditNotes, isLoading } = useQuery<CreditNote[]>({
    queryKey: ['credit-notes', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const response = await fetch(`/api/credit-notes?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Fetch customers
  const { data: customers } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: async () => {
      const response = await fetch('/api/parties?type=customer', {
        credentials: 'include',
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Fetch invoices for selected customer
  const { data: invoices } = useQuery<Invoice[]>({
    queryKey: ['invoices', formData.customerId],
    queryFn: async () => {
      if (!formData.customerId) return [];
      const response = await fetch(`/api/invoices?customerId=${formData.customerId}`, {
        credentials: 'include',
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!formData.customerId,
  });

  // Fetch outstanding invoices for apply
  const { data: outstandingInvoices } = useQuery<Invoice[]>({
    queryKey: ['invoices-outstanding', selectedCreditNote?.customerId],
    queryFn: async () => {
      if (!selectedCreditNote?.customerId) return [];
      const response = await fetch(`/api/invoices?customerId=${selectedCreditNote.customerId}&status=sent`, {
        credentials: 'include',
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!selectedCreditNote?.customerId && showApplyDialog,
  });

  // Create credit note mutation
  const createCreditNoteMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch('/api/credit-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create credit note');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
      setShowCreateDialog(false);
      resetForm();
      toast({ title: 'Credit note created successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to create credit note', variant: 'destructive' });
    },
  });

  // Apply credit note mutation
  const applyCreditNoteMutation = useMutation({
    mutationFn: async (data: { creditNoteId: string; invoiceId: string; amount: string }) => {
      const response = await fetch(`/api/credit-notes/${data.creditNoteId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ invoiceId: data.invoiceId, amount: data.amount }),
      });
      if (!response.ok) throw new Error('Failed to apply credit note');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setShowApplyDialog(false);
      setSelectedCreditNote(null);
      toast({ title: 'Credit note applied successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to apply credit note', variant: 'destructive' });
    },
  });

  // Delete credit note mutation
  const deleteCreditNoteMutation = useMutation({
    mutationFn: async (creditNoteId: string) => {
      const response = await fetch(`/api/credit-notes/${creditNoteId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete credit note');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-notes'] });
      toast({ title: 'Credit note deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      customerId: '',
      creditNoteDate: new Date().toISOString().split('T')[0],
      invoiceId: '',
      reason: '',
      items: [{ description: '', quantity: 1, rate: '', hsnSac: '', gstRate: '18' }],
    });
  };

  const addLineItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { description: '', quantity: 1, rate: '', hsnSac: '', gstRate: '18' }],
    });
  };

  const updateLineItem = (index: number, field: string, value: string | number) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const filteredCreditNotes = creditNotes?.filter((cn) =>
    cn.creditNoteNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cn.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cn.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      issued: 'bg-blue-100 text-blue-700',
      applied: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    const icons: Record<string, React.ReactNode> = {
      draft: <Clock className="h-3 w-3" />,
      issued: <FileText className="h-3 w-3" />,
      applied: <CheckCircle className="h-3 w-3" />,
      cancelled: <XCircle className="h-3 w-3" />,
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {icons[status]}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // Calculate stats
  const stats = {
    total: creditNotes?.reduce((sum, cn) => sum + parseFloat(cn.totalAmount || '0'), 0) || 0,
    issued: creditNotes?.filter((cn) => cn.status === 'issued').length || 0,
    applied: creditNotes?.filter((cn) => cn.status === 'applied').length || 0,
    unappliedAmount: creditNotes?.filter((cn) => cn.status === 'issued')
      .reduce((sum, cn) => sum + parseFloat(cn.balanceAmount || '0'), 0) || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Credit Notes</h1>
          <p className="text-muted-foreground">
            Issue credit notes to customers
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Credit Note
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Credit Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.total)}</div>
            <p className="text-xs text-muted-foreground">{creditNotes?.length || 0} credit notes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Unapplied</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(stats.unappliedAmount)}</div>
            <p className="text-xs text-muted-foreground">{stats.issued} credit notes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Applied</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.applied}</div>
            <p className="text-xs text-muted-foreground">Applied to invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {creditNotes?.filter((cn) => {
                const cnDate = new Date(cn.creditNoteDate);
                const now = new Date();
                return cnDate.getMonth() === now.getMonth() && cnDate.getFullYear() === now.getFullYear();
              }).length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Credit notes issued</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search credit notes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="issued">Issued</SelectItem>
                <SelectItem value="applied">Applied</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Credit Note List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Credit Note List
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !filteredCreditNotes?.length ? (
            <div className="text-center py-12">
              <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No credit notes found</p>
              <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Credit Note
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Credit Note #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Against Invoice</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCreditNotes.map((creditNote) => (
                  <TableRow key={creditNote.id}>
                    <TableCell className="font-mono font-medium">
                      {creditNote.creditNoteNumber}
                    </TableCell>
                    <TableCell>
                      {new Date(creditNote.creditNoteDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{creditNote.customerName}</TableCell>
                    <TableCell className="font-mono">
                      {creditNote.invoiceNumber || '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(parseFloat(creditNote.totalAmount))}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(parseFloat(creditNote.balanceAmount))}
                    </TableCell>
                    <TableCell>{getStatusBadge(creditNote.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedCreditNote(creditNote)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {creditNote.status === 'issued' && parseFloat(creditNote.balanceAmount) > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedCreditNote(creditNote);
                              setShowApplyDialog(true);
                              setApplyData({ invoiceId: '', amount: creditNote.balanceAmount });
                            }}
                            title="Apply to Invoice"
                          >
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          </Button>
                        )}
                        {creditNote.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this credit note?')) {
                                deleteCreditNoteMutation.mutate(creditNote.id);
                              }
                            }}
                            disabled={deleteCreditNoteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Credit Note Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create Credit Note</DialogTitle>
            <DialogDescription>
              Issue a credit note to a customer
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer</Label>
                <Select
                  value={formData.customerId}
                  onValueChange={(value) => setFormData({ ...formData, customerId: value, invoiceId: '' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers?.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Credit Note Date</Label>
                <Input
                  type="date"
                  value={formData.creditNoteDate}
                  onChange={(e) => setFormData({ ...formData, creditNoteDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Against Invoice (Optional)</Label>
                <Select
                  value={formData.invoiceId}
                  onValueChange={(value) => setFormData({ ...formData, invoiceId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select invoice" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No Invoice</SelectItem>
                    {invoices?.map((invoice) => (
                      <SelectItem key={invoice.id} value={invoice.id}>
                        {invoice.invoiceNumber} - {formatCurrency(parseFloat(invoice.totalAmount))}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Select
                  value={formData.reason}
                  onValueChange={(value) => setFormData({ ...formData, reason: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {reasons.map((reason) => (
                      <SelectItem key={reason.value} value={reason.value}>
                        {reason.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <Label>Items</Label>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>HSN/SAC</TableHead>
                    <TableHead className="w-[80px]">Qty</TableHead>
                    <TableHead className="w-[120px]">Rate</TableHead>
                    <TableHead className="w-[80px]">GST %</TableHead>
                    <TableHead className="w-[120px] text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formData.items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Input
                          placeholder="Item description"
                          value={item.description}
                          onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="998311"
                          value={item.hsnSac}
                          onChange={(e) => updateLineItem(index, 'hsnSac', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(index, 'quantity', parseInt(e.target.value) || 1)}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={item.rate}
                          onChange={(e) => updateLineItem(index, 'rate', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.gstRate}
                          onValueChange={(value) => updateLineItem(index, 'gstRate', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0%</SelectItem>
                            <SelectItem value="5">5%</SelectItem>
                            <SelectItem value="12">12%</SelectItem>
                            <SelectItem value="18">18%</SelectItem>
                            <SelectItem value="28">28%</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(item.quantity * parseFloat(item.rate || '0'))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="h-4 w-4 mr-2" />
                Add Line
              </Button>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(formData.items.reduce((sum, item) => sum + (item.quantity * parseFloat(item.rate || '0')), 0))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatCurrency(formData.items.reduce((sum, item) => {
                    const amount = item.quantity * parseFloat(item.rate || '0');
                    return sum + (amount * parseFloat(item.gstRate || '0') / 100);
                  }, 0))}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total</span>
                  <span>{formatCurrency(formData.items.reduce((sum, item) => {
                    const amount = item.quantity * parseFloat(item.rate || '0');
                    return sum + amount + (amount * parseFloat(item.gstRate || '0') / 100);
                  }, 0))}</span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createCreditNoteMutation.mutate(formData)}
              disabled={!formData.customerId || !formData.reason || createCreditNoteMutation.isPending}
            >
              {createCreditNoteMutation.isPending ? 'Creating...' : 'Create Credit Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Credit Note Dialog */}
      <Dialog open={!!selectedCreditNote && !showApplyDialog} onOpenChange={() => setSelectedCreditNote(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Credit Note {selectedCreditNote?.creditNoteNumber}</DialogTitle>
          </DialogHeader>
          {selectedCreditNote && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Customer</Label>
                  <p className="font-medium">{selectedCreditNote.customerName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <p>{getStatusBadge(selectedCreditNote.status)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Date</Label>
                  <p>{new Date(selectedCreditNote.creditNoteDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Against Invoice</Label>
                  <p className="font-mono">{selectedCreditNote.invoiceNumber || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Reason</Label>
                  <p className="capitalize">{selectedCreditNote.reason.replace('_', ' ')}</p>
                </div>
              </div>
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Amount</span>
                  <span>{formatCurrency(parseFloat(selectedCreditNote.totalAmount))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Applied</span>
                  <span>{formatCurrency(parseFloat(selectedCreditNote.appliedAmount))}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Balance</span>
                  <span className="text-blue-600">{formatCurrency(parseFloat(selectedCreditNote.balanceAmount))}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedCreditNote(null)}>
              Close
            </Button>
            {selectedCreditNote?.status === 'issued' && parseFloat(selectedCreditNote.balanceAmount) > 0 && (
              <Button onClick={() => {
                setApplyData({ invoiceId: '', amount: selectedCreditNote.balanceAmount });
                setShowApplyDialog(true);
              }}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Apply to Invoice
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply Credit Note Dialog */}
      <Dialog open={showApplyDialog} onOpenChange={(open) => {
        setShowApplyDialog(open);
        if (!open) setSelectedCreditNote(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Credit Note</DialogTitle>
            <DialogDescription>
              Apply credit note {selectedCreditNote?.creditNoteNumber} to an outstanding invoice
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Invoice</Label>
              <Select
                value={applyData.invoiceId}
                onValueChange={(value) => setApplyData({ ...applyData, invoiceId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select invoice" />
                </SelectTrigger>
                <SelectContent>
                  {outstandingInvoices?.map((invoice) => (
                    <SelectItem key={invoice.id} value={invoice.id}>
                      {invoice.invoiceNumber} - {formatCurrency(parseFloat(invoice.totalAmount))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount to Apply</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={applyData.amount}
                onChange={(e) => setApplyData({ ...applyData, amount: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Available balance: {formatCurrency(parseFloat(selectedCreditNote?.balanceAmount || '0'))}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowApplyDialog(false);
              setSelectedCreditNote(null);
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedCreditNote) {
                  applyCreditNoteMutation.mutate({
                    creditNoteId: selectedCreditNote.id,
                    invoiceId: applyData.invoiceId,
                    amount: applyData.amount,
                  });
                }
              }}
              disabled={!applyData.invoiceId || !applyData.amount || applyCreditNoteMutation.isPending}
            >
              {applyCreditNoteMutation.isPending ? 'Applying...' : 'Apply Credit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
