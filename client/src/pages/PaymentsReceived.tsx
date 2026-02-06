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
  Wallet,
  Plus,
  Search,
  Eye,
  TrendingUp,
  CreditCard,
  Banknote,
  Building2,
  FileText,
} from 'lucide-react';

interface PaymentReceived {
  id: string;
  paymentNumber: string;
  paymentDate: string;
  customerId: string;
  customerName: string;
  invoiceId?: string;
  invoiceNumber?: string;
  amount: string;
  paymentMode: 'cash' | 'bank' | 'cheque' | 'upi' | 'card';
  referenceNumber?: string;
  depositAccountId?: string;
  depositAccountName?: string;
  notes?: string;
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

interface BankAccount {
  id: string;
  accountName: string;
  bankName: string;
}

const paymentModes = [
  { value: 'cash', label: 'Cash', icon: Banknote },
  { value: 'bank', label: 'Bank Transfer', icon: Building2 },
  { value: 'cheque', label: 'Cheque', icon: FileText },
  { value: 'upi', label: 'UPI', icon: CreditCard },
  { value: 'card', label: 'Credit/Debit Card', icon: CreditCard },
];

export default function PaymentsReceived() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [modeFilter, setModeFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentReceived | null>(null);
  const [formData, setFormData] = useState({
    customerId: '',
    paymentDate: new Date().toISOString().split('T')[0],
    invoiceId: '',
    amount: '',
    paymentMode: 'bank',
    referenceNumber: '',
    depositAccountId: '',
    notes: '',
  });

  // Fetch payments
  const { data: payments, isLoading } = useQuery<PaymentReceived[]>({
    queryKey: ['payments-received', modeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (modeFilter !== 'all') params.append('paymentMode', modeFilter);
      const response = await fetch(`/api/payments-received?${params}`, {
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

  // Fetch unpaid invoices
  const { data: invoices } = useQuery<Invoice[]>({
    queryKey: ['invoices-unpaid', formData.customerId],
    queryFn: async () => {
      if (!formData.customerId) return [];
      const response = await fetch(`/api/invoices?customerId=${formData.customerId}&status=sent`, {
        credentials: 'include',
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!formData.customerId,
  });

  // Fetch bank accounts
  const { data: bankAccounts } = useQuery<BankAccount[]>({
    queryKey: ['bank-accounts'],
    queryFn: async () => {
      const response = await fetch('/api/bank-accounts', {
        credentials: 'include',
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Create payment mutation
  const createPaymentMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch('/api/payments-received', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to record payment');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments-received'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setShowCreateDialog(false);
      resetForm();
      toast({ title: 'Payment recorded successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to record payment', variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      customerId: '',
      paymentDate: new Date().toISOString().split('T')[0],
      invoiceId: '',
      amount: '',
      paymentMode: 'bank',
      referenceNumber: '',
      depositAccountId: '',
      notes: '',
    });
  };

  const filteredPayments = payments?.filter((payment) =>
    payment.paymentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPaymentModeLabel = (mode: string) => {
    const modeConfig = paymentModes.find(m => m.value === mode);
    return modeConfig?.label || mode;
  };

  const getPaymentModeBadge = (mode: string) => {
    const styles: Record<string, string> = {
      cash: 'bg-green-100 text-green-700',
      bank: 'bg-blue-100 text-blue-700',
      cheque: 'bg-purple-100 text-purple-700',
      upi: 'bg-orange-100 text-orange-700',
      card: 'bg-pink-100 text-pink-700',
    };
    const ModeIcon = paymentModes.find(m => m.value === mode)?.icon || Wallet;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[mode]}`}>
        <ModeIcon className="h-3 w-3" />
        {getPaymentModeLabel(mode)}
      </span>
    );
  };

  // Calculate stats
  const stats = {
    totalReceived: payments?.reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0) || 0,
    thisMonth: payments?.filter((p) => {
      const payDate = new Date(p.paymentDate);
      const now = new Date();
      return payDate.getMonth() === now.getMonth() && payDate.getFullYear() === now.getFullYear();
    }).reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0) || 0,
    cashReceived: payments?.filter((p) => p.paymentMode === 'cash')
      .reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0) || 0,
    bankReceived: payments?.filter((p) => ['bank', 'upi', 'card'].includes(p.paymentMode))
      .reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0) || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payments Received</h1>
          <p className="text-muted-foreground">
            Track payments received from customers
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Record Payment
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4 text-blue-500" />
              Total Received
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalReceived)}</div>
            <p className="text-xs text-muted-foreground">{payments?.length || 0} payments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500" />
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.thisMonth)}</div>
            <p className="text-xs text-muted-foreground">Current month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Banknote className="h-4 w-4 text-green-500" />
              Cash Received
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.cashReceived)}</div>
            <p className="text-xs text-muted-foreground">Cash payments</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-500" />
              Bank/Digital
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.bankReceived)}</div>
            <p className="text-xs text-muted-foreground">Bank, UPI & Cards</p>
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
                  placeholder="Search payments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={modeFilter} onValueChange={setModeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Payment mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modes</SelectItem>
                {paymentModes.map((mode) => (
                  <SelectItem key={mode.value} value={mode.value}>
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payment List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Payment Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !filteredPayments?.length ? (
            <div className="text-center py-12">
              <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No payments recorded</p>
              <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Record First Payment
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Deposit To</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-mono font-medium">
                      {payment.paymentNumber}
                    </TableCell>
                    <TableCell>
                      {new Date(payment.paymentDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{payment.customerName}</TableCell>
                    <TableCell className="font-mono">
                      {payment.invoiceNumber || '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(parseFloat(payment.amount))}
                    </TableCell>
                    <TableCell>{getPaymentModeBadge(payment.paymentMode)}</TableCell>
                    <TableCell>{payment.depositAccountName || '-'}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedPayment(payment)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Record Payment Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Payment Received</DialogTitle>
            <DialogDescription>
              Record a payment received from a customer
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment Date</Label>
                <Input
                  type="date"
                  value={formData.paymentDate}
                  onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Apply to Invoice (Optional)</Label>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment Mode</Label>
                <Select
                  value={formData.paymentMode}
                  onValueChange={(value) => setFormData({ ...formData, paymentMode: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentModes.map((mode) => (
                      <SelectItem key={mode.value} value={mode.value}>
                        {mode.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reference Number</Label>
                <Input
                  placeholder="Txn/Cheque no."
                  value={formData.referenceNumber}
                  onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Deposit To Account</Label>
              <Select
                value={formData.depositAccountId}
                onValueChange={(value) => setFormData({ ...formData, depositAccountId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select bank account" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts?.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.accountName} - {account.bankName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Input
                placeholder="Additional notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createPaymentMutation.mutate(formData)}
              disabled={!formData.customerId || !formData.amount || createPaymentMutation.isPending}
            >
              {createPaymentMutation.isPending ? 'Saving...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Payment Dialog */}
      <Dialog open={!!selectedPayment} onOpenChange={() => setSelectedPayment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Payment Details</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Payment Number</Label>
                  <p className="font-mono font-medium">{selectedPayment.paymentNumber}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Date</Label>
                  <p className="font-medium">
                    {new Date(selectedPayment.paymentDate).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Customer</Label>
                  <p className="font-medium">{selectedPayment.customerName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Payment Mode</Label>
                  <p>{getPaymentModeBadge(selectedPayment.paymentMode)}</p>
                </div>
                {selectedPayment.invoiceNumber && (
                  <div>
                    <Label className="text-muted-foreground">Invoice</Label>
                    <p className="font-mono">{selectedPayment.invoiceNumber}</p>
                  </div>
                )}
                {selectedPayment.referenceNumber && (
                  <div>
                    <Label className="text-muted-foreground">Reference</Label>
                    <p className="font-medium">{selectedPayment.referenceNumber}</p>
                  </div>
                )}
                {selectedPayment.depositAccountName && (
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">Deposited To</Label>
                    <p className="font-medium">{selectedPayment.depositAccountName}</p>
                  </div>
                )}
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>Amount Received</span>
                  <span className="text-green-600">{formatCurrency(parseFloat(selectedPayment.amount))}</span>
                </div>
              </div>
              {selectedPayment.notes && (
                <div>
                  <Label className="text-muted-foreground">Notes</Label>
                  <p>{selectedPayment.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedPayment(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
