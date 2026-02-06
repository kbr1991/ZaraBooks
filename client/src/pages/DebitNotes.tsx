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
} from 'lucide-react';

interface DebitNote {
  id: string;
  debitNoteNumber: string;
  debitNoteDate: string;
  vendorId: string;
  vendorName: string;
  billId?: string;
  billNumber?: string;
  reason: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  status: 'draft' | 'issued' | 'applied' | 'cancelled';
  appliedAmount: string;
  balanceAmount: string;
  items: DebitNoteItem[];
}

interface DebitNoteItem {
  id: string;
  description: string;
  quantity: number;
  rate: string;
  amount: string;
  hsnSac?: string;
  gstRate?: string;
}

interface Vendor {
  id: string;
  name: string;
}

interface Bill {
  id: string;
  billNumber: string;
  totalAmount: string;
  status: string;
}

const reasons = [
  { value: 'return', label: 'Purchase Return' },
  { value: 'discount', label: 'Post-Purchase Discount' },
  { value: 'defect', label: 'Defective Goods' },
  { value: 'price_adjustment', label: 'Price Adjustment' },
  { value: 'short_supply', label: 'Short Supply' },
  { value: 'other', label: 'Other' },
];

export default function DebitNotes() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [selectedDebitNote, setSelectedDebitNote] = useState<DebitNote | null>(null);
  const [formData, setFormData] = useState({
    vendorId: '',
    debitNoteDate: new Date().toISOString().split('T')[0],
    billId: '',
    reason: '',
    items: [{ description: '', quantity: 1, rate: '', hsnSac: '', gstRate: '18' }],
  });
  const [applyData, setApplyData] = useState({
    billId: '',
    amount: '',
  });

  // Fetch debit notes
  const { data: debitNotes, isLoading } = useQuery<DebitNote[]>({
    queryKey: ['debit-notes', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const response = await fetch(`/api/debit-notes?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Fetch vendors
  const { data: vendors } = useQuery<Vendor[]>({
    queryKey: ['vendors'],
    queryFn: async () => {
      const response = await fetch('/api/parties?type=vendor', {
        credentials: 'include',
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Fetch bills for selected vendor
  const { data: bills } = useQuery<Bill[]>({
    queryKey: ['bills', formData.vendorId],
    queryFn: async () => {
      if (!formData.vendorId) return [];
      const response = await fetch(`/api/bills?vendorId=${formData.vendorId}`, {
        credentials: 'include',
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!formData.vendorId,
  });

  // Fetch outstanding bills for apply
  const { data: outstandingBills } = useQuery<Bill[]>({
    queryKey: ['bills-outstanding', selectedDebitNote?.vendorId],
    queryFn: async () => {
      if (!selectedDebitNote?.vendorId) return [];
      const response = await fetch(`/api/bills?vendorId=${selectedDebitNote.vendorId}&status=open`, {
        credentials: 'include',
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!selectedDebitNote?.vendorId && showApplyDialog,
  });

  // Create debit note mutation
  const createDebitNoteMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch('/api/debit-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create debit note');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debit-notes'] });
      setShowCreateDialog(false);
      resetForm();
      toast({ title: 'Debit note created successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to create debit note', variant: 'destructive' });
    },
  });

  // Apply debit note mutation
  const applyDebitNoteMutation = useMutation({
    mutationFn: async (data: { debitNoteId: string; billId: string; amount: string }) => {
      const response = await fetch(`/api/debit-notes/${data.debitNoteId}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ billId: data.billId, amount: data.amount }),
      });
      if (!response.ok) throw new Error('Failed to apply debit note');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debit-notes'] });
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      setShowApplyDialog(false);
      setSelectedDebitNote(null);
      toast({ title: 'Debit note applied successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to apply debit note', variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      vendorId: '',
      debitNoteDate: new Date().toISOString().split('T')[0],
      billId: '',
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

  const filteredDebitNotes = debitNotes?.filter((dn) =>
    dn.debitNoteNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dn.vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    dn.billNumber?.toLowerCase().includes(searchTerm.toLowerCase())
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
    total: debitNotes?.reduce((sum, dn) => sum + parseFloat(dn.totalAmount || '0'), 0) || 0,
    issued: debitNotes?.filter((dn) => dn.status === 'issued').length || 0,
    applied: debitNotes?.filter((dn) => dn.status === 'applied').length || 0,
    unappliedAmount: debitNotes?.filter((dn) => dn.status === 'issued')
      .reduce((sum, dn) => sum + parseFloat(dn.balanceAmount || '0'), 0) || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Debit Notes</h1>
          <p className="text-muted-foreground">
            Issue debit notes to vendors
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Debit Note
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Debit Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.total)}</div>
            <p className="text-xs text-muted-foreground">{debitNotes?.length || 0} debit notes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Unapplied</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(stats.unappliedAmount)}</div>
            <p className="text-xs text-muted-foreground">{stats.issued} debit notes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Applied</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.applied}</div>
            <p className="text-xs text-muted-foreground">Applied to bills</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {debitNotes?.filter((dn) => {
                const dnDate = new Date(dn.debitNoteDate);
                const now = new Date();
                return dnDate.getMonth() === now.getMonth() && dnDate.getFullYear() === now.getFullYear();
              }).length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Debit notes issued</p>
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
                  placeholder="Search debit notes..."
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

      {/* Debit Note List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Debit Note List
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !filteredDebitNotes?.length ? (
            <div className="text-center py-12">
              <Receipt className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No debit notes found</p>
              <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Debit Note
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Debit Note #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Against Bill</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDebitNotes.map((debitNote) => (
                  <TableRow key={debitNote.id}>
                    <TableCell className="font-mono font-medium">
                      {debitNote.debitNoteNumber}
                    </TableCell>
                    <TableCell>
                      {new Date(debitNote.debitNoteDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{debitNote.vendorName}</TableCell>
                    <TableCell className="font-mono">
                      {debitNote.billNumber || '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(parseFloat(debitNote.totalAmount))}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(parseFloat(debitNote.balanceAmount))}
                    </TableCell>
                    <TableCell>{getStatusBadge(debitNote.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedDebitNote(debitNote)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {debitNote.status === 'issued' && parseFloat(debitNote.balanceAmount) > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedDebitNote(debitNote);
                              setShowApplyDialog(true);
                              setApplyData({ billId: '', amount: debitNote.balanceAmount });
                            }}
                            title="Apply to Bill"
                          >
                            <CheckCircle className="h-4 w-4 text-green-500" />
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

      {/* Create Debit Note Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create Debit Note</DialogTitle>
            <DialogDescription>
              Issue a debit note to a vendor
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vendor</Label>
                <Select
                  value={formData.vendorId}
                  onValueChange={(value) => setFormData({ ...formData, vendorId: value, billId: '' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors?.map((vendor) => (
                      <SelectItem key={vendor.id} value={vendor.id}>
                        {vendor.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Debit Note Date</Label>
                <Input
                  type="date"
                  value={formData.debitNoteDate}
                  onChange={(e) => setFormData({ ...formData, debitNoteDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Against Bill (Optional)</Label>
                <Select
                  value={formData.billId}
                  onValueChange={(value) => setFormData({ ...formData, billId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select bill" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No Bill</SelectItem>
                    {bills?.map((bill) => (
                      <SelectItem key={bill.id} value={bill.id}>
                        {bill.billNumber} - {formatCurrency(parseFloat(bill.totalAmount))}
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
              onClick={() => createDebitNoteMutation.mutate(formData)}
              disabled={!formData.vendorId || !formData.reason || createDebitNoteMutation.isPending}
            >
              {createDebitNoteMutation.isPending ? 'Creating...' : 'Create Debit Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Debit Note Dialog */}
      <Dialog open={!!selectedDebitNote && !showApplyDialog} onOpenChange={() => setSelectedDebitNote(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Debit Note {selectedDebitNote?.debitNoteNumber}</DialogTitle>
          </DialogHeader>
          {selectedDebitNote && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Vendor</Label>
                  <p className="font-medium">{selectedDebitNote.vendorName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <p>{getStatusBadge(selectedDebitNote.status)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Date</Label>
                  <p>{new Date(selectedDebitNote.debitNoteDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Against Bill</Label>
                  <p className="font-mono">{selectedDebitNote.billNumber || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Reason</Label>
                  <p className="capitalize">{selectedDebitNote.reason.replace('_', ' ')}</p>
                </div>
              </div>
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Amount</span>
                  <span>{formatCurrency(parseFloat(selectedDebitNote.totalAmount))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Applied</span>
                  <span>{formatCurrency(parseFloat(selectedDebitNote.appliedAmount))}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Balance</span>
                  <span className="text-blue-600">{formatCurrency(parseFloat(selectedDebitNote.balanceAmount))}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedDebitNote(null)}>
              Close
            </Button>
            {selectedDebitNote?.status === 'issued' && parseFloat(selectedDebitNote.balanceAmount) > 0 && (
              <Button onClick={() => {
                setApplyData({ billId: '', amount: selectedDebitNote.balanceAmount });
                setShowApplyDialog(true);
              }}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Apply to Bill
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply Debit Note Dialog */}
      <Dialog open={showApplyDialog} onOpenChange={(open) => {
        setShowApplyDialog(open);
        if (!open) setSelectedDebitNote(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Debit Note</DialogTitle>
            <DialogDescription>
              Apply debit note {selectedDebitNote?.debitNoteNumber} to an outstanding bill
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Bill</Label>
              <Select
                value={applyData.billId}
                onValueChange={(value) => setApplyData({ ...applyData, billId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select bill" />
                </SelectTrigger>
                <SelectContent>
                  {outstandingBills?.map((bill) => (
                    <SelectItem key={bill.id} value={bill.id}>
                      {bill.billNumber} - {formatCurrency(parseFloat(bill.totalAmount))}
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
                Available balance: {formatCurrency(parseFloat(selectedDebitNote?.balanceAmount || '0'))}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowApplyDialog(false);
              setSelectedDebitNote(null);
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedDebitNote) {
                  applyDebitNoteMutation.mutate({
                    debitNoteId: selectedDebitNote.id,
                    billId: applyData.billId,
                    amount: applyData.amount,
                  });
                }
              }}
              disabled={!applyData.billId || !applyData.amount || applyDebitNoteMutation.isPending}
            >
              {applyDebitNoteMutation.isPending ? 'Applying...' : 'Apply Debit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
