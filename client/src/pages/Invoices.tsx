import { useState, useEffect } from 'react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import {
  FileText,
  Plus,
  Search,
  Send,
  Download,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  AlertCircle,
  X,
  Printer,
  FileDown,
  XCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { generateDocument, DocumentData, TemplateId } from '@/lib/document-templates';
import TemplateSelector from '@/components/document/TemplateSelector';

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  customerId: string;
  customerName: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  items: InvoiceItem[];
}

interface InvoiceItem {
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
  email?: string;
  gstin?: string;
}

interface LineItem {
  id: string;
  description: string;
  hsnSac: string;
  quantity: number;
  rate: number;
  gstRate: number;
  amount: number;
  taxAmount: number;
}

const emptyLineItem = (): LineItem => ({
  id: crypto.randomUUID(),
  description: '',
  hsnSac: '',
  quantity: 1,
  rate: 0,
  gstRate: 18,
  amount: 0,
  taxAmount: 0,
});

export default function Invoices() {
  const { toast } = useToast();
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [pendingDownloadInvoiceId, setPendingDownloadInvoiceId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    customerId: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    placeOfSupply: '',
    notes: '',
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([emptyLineItem()]);

  // Calculate line item amount when quantity or rate changes
  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    setLineItems(prev => {
      const updated = [...prev];
      const item = { ...updated[index] };

      if (field === 'quantity' || field === 'rate' || field === 'gstRate') {
        item[field] = typeof value === 'string' ? parseFloat(value) || 0 : value;
      } else {
        (item as any)[field] = value;
      }

      // Recalculate amount and tax
      item.amount = item.quantity * item.rate;
      item.taxAmount = (item.amount * item.gstRate) / 100;

      updated[index] = item;
      return updated;
    });
  };

  const addLineItem = () => {
    setLineItems(prev => [...prev, emptyLineItem()]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length > 1) {
      setLineItems(prev => prev.filter((_, i) => i !== index));
    }
  };

  // Calculate totals
  const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const totalTax = lineItems.reduce((sum, item) => sum + item.taxAmount, 0);
  const cgst = totalTax / 2;
  const sgst = totalTax / 2;
  const total = subtotal + totalTax;

  // Handle opening template selector for download
  const handleOpenTemplateSelector = (invoiceId: string) => {
    setPendingDownloadInvoiceId(invoiceId);
    setShowTemplateSelector(true);
  };

  // Handle download PDF with template
  const handleDownloadPDF = async (templateId: TemplateId, _action: 'print' | 'pdf') => {
    if (!pendingDownloadInvoiceId) return;

    try {
      // Fetch full invoice with lines
      const response = await fetch(`/api/invoices/${pendingDownloadInvoiceId}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        toast({ title: 'Failed to load invoice', variant: 'destructive' });
        return;
      }
      const invoice = await response.json();

      // Create a new window with print-friendly content
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast({ title: 'Please allow popups to download PDF', variant: 'destructive' });
        return;
      }

      // Build document data for template
      const invoiceLines = invoice.lines || [];
      const subtotal = parseFloat(invoice.subtotal || 0);
      const cgst = parseFloat(invoice.cgst || 0);
      const sgst = parseFloat(invoice.sgst || 0);
      const igst = parseFloat(invoice.igst || 0);
      const total = parseFloat(invoice.totalAmount || 0);

      const documentData: DocumentData = {
        type: 'invoice',
        documentNumber: invoice.invoiceNumber,
        documentDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        company: {
          name: currentCompany?.name || '',
          legalName: currentCompany?.legalName,
          logoUrl: currentCompany?.logoUrl,
          address: currentCompany?.address,
          city: currentCompany?.city,
          state: currentCompany?.state,
          pincode: currentCompany?.pincode,
          gstin: currentCompany?.gstin,
          pan: currentCompany?.pan,
        },
        customer: {
          name: invoice.customer?.name || 'Customer',
          address: invoice.customer?.address,
          city: invoice.customer?.city,
          state: invoice.customer?.state,
          pincode: invoice.customer?.pincode,
          gstin: invoice.customer?.gstin,
          email: invoice.customer?.email,
        },
        items: invoiceLines.map((line: any) => {
          const qty = parseFloat(line.quantity) || 1;
          const rate = parseFloat(line.unitPrice) || 0;
          const lineAmount = qty * rate; // Pre-tax amount
          return {
            description: line.description || '',
            hsnSac: line.hsnSacCode || '',
            quantity: qty,
            rate: rate,
            amount: lineAmount,
            taxRate: parseFloat(line.taxRate) || 0,
            taxAmount: parseFloat(line.taxAmount) || 0,
          };
        }),
        subtotal,
        taxBreakdown: { cgst, sgst, igst },
        totalAmount: total,
        notes: invoice.notes,
        status: invoice.status,
        billingAddress: invoice.billingAddress,
        shippingAddress: invoice.shippingAddress,
      };

      // Generate HTML using template
      const htmlContent = generateDocument(documentData, templateId);

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      // Auto-trigger print after document loads
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 250);
      };

      setPendingDownloadInvoiceId(null);
    } catch (error) {
      toast({ title: 'Failed to generate PDF', variant: 'destructive' });
    }
  };

  // Quick download with default template
  const handleQuickDownload = async (invoiceId: string, action: 'print' | 'pdf') => {
    setPendingDownloadInvoiceId(invoiceId);
    const defaultTemplate = (currentCompany?.defaultTemplate as TemplateId) || 'classic';
    await handleDownloadPDF(defaultTemplate, action);
  };

  // Handle edit invoice
  const handleEditInvoice = async (invoice: Invoice) => {
    // Fetch full invoice with lines
    const response = await fetch(`/api/invoices/${invoice.id}`, {
      credentials: 'include',
    });
    if (response.ok) {
      const fullInvoice = await response.json();
      setEditingInvoice(fullInvoice);
      setFormData({
        customerId: fullInvoice.customerId,
        invoiceDate: fullInvoice.invoiceDate,
        dueDate: fullInvoice.dueDate,
        placeOfSupply: fullInvoice.placeOfSupply || '',
        notes: fullInvoice.notes || '',
      });
      // Convert invoice lines to form line items
      if (fullInvoice.lines && fullInvoice.lines.length > 0) {
        setLineItems(fullInvoice.lines.map((line: any) => ({
          id: line.id,
          description: line.description || '',
          hsnSac: line.hsnSacCode || '',
          quantity: parseFloat(line.quantity) || 1,
          rate: parseFloat(line.unitPrice) || 0,
          gstRate: parseFloat(line.taxRate) || 18,
          amount: parseFloat(line.amount) || 0,
          taxAmount: parseFloat(line.taxAmount) || 0,
        })));
      }
      setShowCreateDialog(true);
    }
  };

  // Reset form when dialog closes
  useEffect(() => {
    if (!showCreateDialog) {
      setFormData({
        customerId: '',
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: '',
        placeOfSupply: '',
        notes: '',
      });
      setLineItems([emptyLineItem()]);
      setEditingInvoice(null);
    }
  }, [showCreateDialog]);

  // Fetch invoices
  const { data: invoices, isLoading } = useQuery<Invoice[]>({
    queryKey: ['invoices', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const response = await fetch(`/api/invoices?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Fetch customers for dropdown
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

  // Create invoice mutation
  const createInvoiceMutation = useMutation({
    mutationFn: async (data: Partial<Invoice>) => {
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create invoice');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setShowCreateDialog(false);
      toast({ title: 'Invoice created successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to create invoice', variant: 'destructive' });
    },
  });

  // Update invoice mutation
  const updateInvoiceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const response = await fetch(`/api/invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update invoice');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setShowCreateDialog(false);
      setEditingInvoice(null);
      toast({ title: 'Invoice updated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to update invoice', variant: 'destructive' });
    },
  });

  // Send invoice mutation
  const sendInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to send invoice');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Invoice sent to customer' });
    },
    onError: () => {
      toast({ title: 'Failed to send invoice', variant: 'destructive' });
    },
  });

  // Mark as paid mutation
  const markPaidMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await fetch(`/api/invoices/${invoiceId}/mark-paid`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to mark as paid');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Invoice marked as paid' });
    },
    onError: () => {
      toast({ title: 'Failed to update invoice', variant: 'destructive' });
    },
  });

  const cancelInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await fetch(`/api/invoices/${invoiceId}/cancel`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel invoice');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Invoice cancelled successfully' });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  // Delete invoice mutation
  const deleteInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete invoice');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Invoice deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  const filteredInvoices = invoices?.filter((inv) =>
    inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      sent: 'bg-blue-100 text-blue-700',
      paid: 'bg-green-100 text-green-700',
      overdue: 'bg-red-100 text-red-700',
      cancelled: 'bg-gray-100 text-gray-500',
    };
    const icons: Record<string, React.ReactNode> = {
      draft: <Edit className="h-3 w-3" />,
      sent: <Send className="h-3 w-3" />,
      paid: <CheckCircle className="h-3 w-3" />,
      overdue: <AlertCircle className="h-3 w-3" />,
      cancelled: <Trash2 className="h-3 w-3" />,
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
    total: invoices?.length || 0,
    draft: invoices?.filter((i) => i.status === 'draft').length || 0,
    sent: invoices?.filter((i) => i.status === 'sent').length || 0,
    paid: invoices?.filter((i) => i.status === 'paid').length || 0,
    overdue: invoices?.filter((i) => i.status === 'overdue').length || 0,
    totalAmount: invoices?.reduce((sum, i) => sum + parseFloat(i.totalAmount || '0'), 0) || 0,
    paidAmount: invoices?.filter((i) => i.status === 'paid')
      .reduce((sum, i) => sum + parseFloat(i.totalAmount || '0'), 0) || 0,
    outstandingAmount: invoices?.filter((i) => ['sent', 'overdue'].includes(i.status))
      .reduce((sum, i) => sum + parseFloat(i.totalAmount || '0'), 0) || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-muted-foreground">
            Create and manage customer invoices
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Invoice
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Invoiced</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</div>
            <p className="text-xs text-muted-foreground">{stats.total} invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Paid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.paidAmount)}</div>
            <p className="text-xs text-muted-foreground">{stats.paid} invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(stats.outstandingAmount)}</div>
            <p className="text-xs text-muted-foreground">{stats.sent} sent, {stats.overdue} overdue</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Drafts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.draft}</div>
            <p className="text-xs text-muted-foreground">Pending to send</p>
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
                  placeholder="Search invoices..."
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
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Invoice List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Invoice List
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !filteredInvoices?.length ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No invoices found</p>
              <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Invoice
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[150px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono font-medium">
                      {invoice.invoiceNumber}
                    </TableCell>
                    <TableCell>{invoice.customerName}</TableCell>
                    <TableCell>
                      {new Date(invoice.invoiceDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {new Date(invoice.dueDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(parseFloat(invoice.totalAmount))}
                    </TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedInvoice(invoice)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {invoice.status === 'draft' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => sendInvoiceMutation.mutate(invoice.id)}
                            >
                              <Send className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEditInvoice(invoice)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this invoice?')) {
                                  deleteInvoiceMutation.mutate(invoice.id);
                                }
                              }}
                              disabled={deleteInvoiceMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </>
                        )}
                        {invoice.status === 'sent' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => markPaidMutation.mutate(invoice.id)}
                          >
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          </Button>
                        )}
                        {invoice.status === 'sent' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm('Are you sure you want to cancel this invoice? This will reverse journal entries.')) {
                                cancelInvoiceMutation.mutate(invoice.id);
                              }
                            }}
                            title="Cancel Invoice"
                          >
                            <XCircle className="h-4 w-4 text-orange-500" />
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Download className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleQuickDownload(invoice.id, 'pdf')}>
                              <FileDown className="h-4 w-4 mr-2" />
                              Save as PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleQuickDownload(invoice.id, 'print')}>
                              <Printer className="h-4 w-4 mr-2" />
                              Print
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenTemplateSelector(invoice.id)}>
                              <FileText className="h-4 w-4 mr-2" />
                              Choose Template...
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Invoice Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingInvoice ? 'Edit Invoice' : 'Create New Invoice'}</DialogTitle>
            <DialogDescription>
              {editingInvoice ? 'Update invoice details' : 'Create a new invoice for your customer'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer *</Label>
                <Select
                  value={formData.customerId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, customerId: value }))}
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
                <Label>Invoice Date *</Label>
                <Input
                  type="date"
                  value={formData.invoiceDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, invoiceDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Due Date *</Label>
                <Input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Place of Supply</Label>
                <Select
                  value={formData.placeOfSupply}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, placeOfSupply: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MH">Maharashtra</SelectItem>
                    <SelectItem value="KA">Karnataka</SelectItem>
                    <SelectItem value="TN">Tamil Nadu</SelectItem>
                    <SelectItem value="DL">Delhi</SelectItem>
                    <SelectItem value="GJ">Gujarat</SelectItem>
                    <SelectItem value="RJ">Rajasthan</SelectItem>
                    <SelectItem value="UP">Uttar Pradesh</SelectItem>
                    <SelectItem value="WB">West Bengal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <Label>Items</Label>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[250px]">Description *</TableHead>
                      <TableHead className="w-[100px]">HSN/SAC</TableHead>
                      <TableHead className="w-[80px]">Qty</TableHead>
                      <TableHead className="w-[120px]">Rate</TableHead>
                      <TableHead className="w-[80px]">GST %</TableHead>
                      <TableHead className="w-[120px] text-right">Amount</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lineItems.map((item, index) => (
                      <TableRow key={item.id}>
                        <TableCell className="p-2">
                          <Input
                            placeholder="Item description"
                            value={item.description}
                            onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            placeholder="998311"
                            value={item.hsnSac}
                            onChange={(e) => updateLineItem(index, 'hsnSac', e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={item.rate || ''}
                            onChange={(e) => updateLineItem(index, 'rate', e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <Select
                            value={item.gstRate.toString()}
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
                        <TableCell className="p-2 text-right font-medium">
                          {formatCurrency(item.amount)}
                        </TableCell>
                        <TableCell className="p-2">
                          {lineItems.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeLineItem(index)}
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <Button variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="h-4 w-4 mr-2" />
                Add Line
              </Button>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Add any notes for the customer..."
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
              />
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-72 space-y-2 bg-muted/30 p-4 rounded-lg">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CGST</span>
                  <span>{formatCurrency(cgst)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SGST</span>
                  <span>{formatCurrency(sgst)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg border-t pt-2 mt-2">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              disabled={createInvoiceMutation.isPending || updateInvoiceMutation.isPending}
              onClick={() => {
                if (!formData.customerId || !formData.dueDate) {
                  toast({ title: 'Please fill required fields', variant: 'destructive' });
                  return;
                }
                if (!lineItems.some(item => item.description && item.amount > 0)) {
                  toast({ title: 'Please add at least one line item', variant: 'destructive' });
                  return;
                }
                const invoiceData = {
                  customerId: formData.customerId,
                  invoiceDate: formData.invoiceDate,
                  dueDate: formData.dueDate,
                  notes: formData.notes,
                  lines: lineItems.filter(item => item.description).map(item => ({
                    description: item.description,
                    hsnSacCode: item.hsnSac,
                    quantity: item.quantity,
                    unitPrice: item.rate,
                    taxRate: item.gstRate,
                  })),
                };
                if (editingInvoice) {
                  updateInvoiceMutation.mutate({ id: editingInvoice.id, data: invoiceData });
                } else {
                  createInvoiceMutation.mutate(invoiceData as any);
                }
              }}
            >
              {editingInvoice ? 'Update Invoice' : 'Save as Draft'}
            </Button>
            {!editingInvoice && (
              <Button
                disabled={createInvoiceMutation.isPending}
                onClick={() => {
                  if (!formData.customerId || !formData.dueDate) {
                    toast({ title: 'Please fill required fields', variant: 'destructive' });
                    return;
                  }
                  if (!lineItems.some(item => item.description && item.amount > 0)) {
                    toast({ title: 'Please add at least one line item', variant: 'destructive' });
                    return;
                  }
                  createInvoiceMutation.mutate({
                    customerId: formData.customerId,
                    invoiceDate: formData.invoiceDate,
                    dueDate: formData.dueDate,
                    notes: formData.notes,
                    lines: lineItems.filter(item => item.description).map(item => ({
                      description: item.description,
                      hsnSacCode: item.hsnSac,
                      quantity: item.quantity,
                      unitPrice: item.rate,
                      taxRate: item.gstRate,
                    })),
                  } as any);
                }}
              >
                <Send className="h-4 w-4 mr-2" />
                Save & Send
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Invoice Dialog */}
      <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Invoice {selectedInvoice?.invoiceNumber}</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Customer</Label>
                  <p className="font-medium">{selectedInvoice.customerName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <p>{getStatusBadge(selectedInvoice.status)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Invoice Date</Label>
                  <p>{new Date(selectedInvoice.invoiceDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Due Date</Label>
                  <p>{new Date(selectedInvoice.dueDate).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total Amount</span>
                  <span>{formatCurrency(parseFloat(selectedInvoice.totalAmount))}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedInvoice(null)}>
              Close
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => selectedInvoice && handleQuickDownload(selectedInvoice.id, 'pdf')}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Save as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => selectedInvoice && handleQuickDownload(selectedInvoice.id, 'print')}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => selectedInvoice && handleOpenTemplateSelector(selectedInvoice.id)}>
                  <FileText className="h-4 w-4 mr-2" />
                  Choose Template...
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Selector Dialog */}
      <TemplateSelector
        open={showTemplateSelector}
        onOpenChange={setShowTemplateSelector}
        defaultTemplate={(currentCompany?.defaultTemplate as TemplateId) || 'classic'}
        onSelect={handleDownloadPDF}
        documentType="invoice"
      />
    </div>
  );
}
