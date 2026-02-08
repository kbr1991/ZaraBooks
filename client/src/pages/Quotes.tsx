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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';
import {
  FileText,
  Plus,
  Search,
  Send,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  Clock,
  XCircle,
  FileOutput,
  AlertTriangle,
  Download,
  Printer,
  FileDown,
  MoreHorizontal,
  ShoppingCart,
  Receipt,
} from 'lucide-react';
import { generateDocument, DocumentData, TemplateId } from '@/lib/document-templates';
import TemplateSelector from '@/components/document/TemplateSelector';

interface Quote {
  id: string;
  quoteNumber: string;
  quoteDate: string;
  expiryDate: string;
  customerId: string;
  customerName: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
  terms?: string;
  items: QuoteItem[];
}

interface QuoteItem {
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

export default function Quotes() {
  const { toast } = useToast();
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [pendingDownloadQuoteId, setPendingDownloadQuoteId] = useState<string | null>(null);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [convertType, setConvertType] = useState<'order' | 'invoice'>('order');
  const [convertQuoteId, setConvertQuoteId] = useState<string | null>(null);
  const [poNumber, setPoNumber] = useState('');
  const [engagementLetterRef, setEngagementLetterRef] = useState('');
  const [formData, setFormData] = useState({
    customerId: '',
    quoteDate: new Date().toISOString().split('T')[0],
    expiryDate: '',
    terms: '',
    items: [{ description: '', quantity: 1, rate: '', hsnSac: '', gstRate: '18' }],
  });

  // Fetch quotes
  const { data: quotes, isLoading } = useQuery<Quote[]>({
    queryKey: ['quotes', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const response = await fetch(`/api/quotes?${params}`, {
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

  // Create quote mutation
  const createQuoteMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create quote');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      setShowCreateDialog(false);
      resetForm();
      toast({ title: 'Quote created successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to create quote', variant: 'destructive' });
    },
  });

  // Update quote mutation
  const updateQuoteMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const response = await fetch(`/api/quotes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update quote');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      setShowCreateDialog(false);
      setEditingQuote(null);
      resetForm();
      toast({ title: 'Quote updated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to update quote', variant: 'destructive' });
    },
  });

  // Handle edit quote
  const handleEditQuote = async (quote: Quote) => {
    const response = await fetch(`/api/quotes/${quote.id}`, { credentials: 'include' });
    if (response.ok) {
      const fullQuote = await response.json();
      setEditingQuote(fullQuote);
      setFormData({
        customerId: fullQuote.customerId,
        quoteDate: fullQuote.quoteDate,
        expiryDate: fullQuote.validUntil || fullQuote.expiryDate || '',
        terms: fullQuote.terms || '',
        items: fullQuote.lines?.map((line: any) => ({
          description: line.description || '',
          quantity: parseFloat(line.quantity) || 1,
          rate: line.unitPrice || '',
          hsnSac: line.hsnSacCode || '',
          gstRate: line.taxRate || '18',
        })) || [{ description: '', quantity: 1, rate: '', hsnSac: '', gstRate: '18' }],
      });
      setShowCreateDialog(true);
    }
  };

  // Send quote mutation
  const sendQuoteMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const response = await fetch(`/api/quotes/${quoteId}/send`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to send quote');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast({ title: 'Quote sent to customer' });
    },
    onError: () => {
      toast({ title: 'Failed to send quote', variant: 'destructive' });
    },
  });

  // Convert to invoice mutation
  const convertToInvoiceMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const response = await fetch(`/api/quotes/${quoteId}/convert-to-invoice`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to convert quote');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Quote converted to invoice' });
      setShowConvertDialog(false);
      setConvertQuoteId(null);
    },
    onError: () => {
      toast({ title: 'Failed to convert quote', variant: 'destructive' });
    },
  });

  // Convert to sales order mutation
  const convertToOrderMutation = useMutation({
    mutationFn: async ({ quoteId, poNumber, engagementLetterRef }: { quoteId: string; poNumber?: string; engagementLetterRef?: string }) => {
      const response = await fetch(`/api/quotes/${quoteId}/convert-to-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ poNumber, engagementLetterRef }),
      });
      if (!response.ok) throw new Error('Failed to convert quote');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      toast({ title: 'Quote converted to sales order' });
      setShowConvertDialog(false);
      setConvertQuoteId(null);
      setPoNumber('');
      setEngagementLetterRef('');
    },
    onError: () => {
      toast({ title: 'Failed to convert quote', variant: 'destructive' });
    },
  });

  // Delete quote mutation
  const deleteQuoteMutation = useMutation({
    mutationFn: async (quoteId: string) => {
      const response = await fetch(`/api/quotes/${quoteId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete quote');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast({ title: 'Quote deleted' });
    },
    onError: () => {
      toast({ title: 'Failed to delete quote', variant: 'destructive' });
    },
  });

  // Handle opening template selector for download
  const handleOpenTemplateSelector = (quoteId: string) => {
    setPendingDownloadQuoteId(quoteId);
    setShowTemplateSelector(true);
  };

  // Handle opening convert dialog
  const handleOpenConvertDialog = (quoteId: string, type: 'order' | 'invoice') => {
    setConvertQuoteId(quoteId);
    setConvertType(type);
    setPoNumber('');
    setEngagementLetterRef('');
    setShowConvertDialog(true);
  };

  // Handle convert action
  const handleConvert = () => {
    if (!convertQuoteId) return;
    if (convertType === 'order') {
      convertToOrderMutation.mutate({ quoteId: convertQuoteId, poNumber, engagementLetterRef });
    } else {
      convertToInvoiceMutation.mutate(convertQuoteId);
    }
  };

  // Handle download PDF with template
  const handleDownloadPDF = async (templateId: TemplateId, _action: 'print' | 'pdf') => {
    if (!pendingDownloadQuoteId) return;

    try {
      const response = await fetch(`/api/quotes/${pendingDownloadQuoteId}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        toast({ title: 'Failed to load quote', variant: 'destructive' });
        return;
      }
      const quote = await response.json();

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast({ title: 'Please allow popups to download PDF', variant: 'destructive' });
        return;
      }

      const quoteLines = quote.lines || [];
      const subtotal = parseFloat(quote.subtotal || 0);
      const cgst = parseFloat(quote.cgst || 0);
      const sgst = parseFloat(quote.sgst || 0);
      const igst = parseFloat(quote.igst || 0);
      const total = parseFloat(quote.totalAmount || 0);

      const documentData: DocumentData = {
        type: 'quote',
        documentNumber: quote.quoteNumber,
        documentDate: quote.quoteDate,
        expiryDate: quote.validUntil || quote.expiryDate,
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
          name: quote.customer?.name || 'Customer',
          address: quote.customer?.address,
          city: quote.customer?.city,
          state: quote.customer?.state,
          pincode: quote.customer?.pincode,
          gstin: quote.customer?.gstin,
          email: quote.customer?.email,
        },
        items: quoteLines.map((line: any) => {
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
        notes: quote.notes,
        terms: quote.terms,
        status: quote.status,
      };

      const htmlContent = generateDocument(documentData, templateId);

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 250);
      };

      setPendingDownloadQuoteId(null);
    } catch (error) {
      toast({ title: 'Failed to generate PDF', variant: 'destructive' });
    }
  };

  // Quick download with default template
  const handleQuickDownload = async (quoteId: string, action: 'print' | 'pdf') => {
    setPendingDownloadQuoteId(quoteId);
    const defaultTemplate = (currentCompany?.defaultTemplate as TemplateId) || 'classic';
    await handleDownloadPDF(defaultTemplate, action);
  };

  const resetForm = () => {
    setFormData({
      customerId: '',
      quoteDate: new Date().toISOString().split('T')[0],
      expiryDate: '',
      terms: '',
      items: [{ description: '', quantity: 1, rate: '', hsnSac: '', gstRate: '18' }],
    });
    setEditingQuote(null);
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

  const filteredQuotes = quotes?.filter((quote) =>
    quote.quoteNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    quote.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      sent: 'bg-blue-100 text-blue-700',
      accepted: 'bg-green-100 text-green-700',
      declined: 'bg-red-100 text-red-700',
      expired: 'bg-yellow-100 text-yellow-700',
    };
    const icons: Record<string, React.ReactNode> = {
      draft: <Edit className="h-3 w-3" />,
      sent: <Send className="h-3 w-3" />,
      accepted: <CheckCircle className="h-3 w-3" />,
      declined: <XCircle className="h-3 w-3" />,
      expired: <AlertTriangle className="h-3 w-3" />,
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
    total: quotes?.length || 0,
    draft: quotes?.filter((q) => q.status === 'draft').length || 0,
    sent: quotes?.filter((q) => q.status === 'sent').length || 0,
    accepted: quotes?.filter((q) => q.status === 'accepted').length || 0,
    declined: quotes?.filter((q) => q.status === 'declined').length || 0,
    totalAmount: quotes?.reduce((sum, q) => sum + parseFloat(q.totalAmount || '0'), 0) || 0,
    acceptedAmount: quotes?.filter((q) => q.status === 'accepted')
      .reduce((sum, q) => sum + parseFloat(q.totalAmount || '0'), 0) || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Quotes / Estimates</h1>
          <p className="text-muted-foreground">
            Create and manage customer quotes and estimates
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Quote
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Quoted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</div>
            <p className="text-xs text-muted-foreground">{stats.total} quotes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Accepted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.acceptedAmount)}</div>
            <p className="text-xs text-muted-foreground">{stats.accepted} quotes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.sent}</div>
            <p className="text-xs text-muted-foreground">Awaiting response</p>
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
                  placeholder="Search quotes..."
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
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Quote List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Quote List
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !filteredQuotes?.length ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No quotes found</p>
              <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Quote
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[180px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredQuotes.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell className="font-mono font-medium">
                      {quote.quoteNumber}
                    </TableCell>
                    <TableCell>{quote.customerName}</TableCell>
                    <TableCell>
                      {new Date(quote.quoteDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {new Date(quote.expiryDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(parseFloat(quote.totalAmount))}
                    </TableCell>
                    <TableCell>{getStatusBadge(quote.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedQuote(quote)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {quote.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => sendQuoteMutation.mutate(quote.id)}
                            title="Send Quote"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        {['draft', 'sent'].includes(quote.status) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditQuote(quote)}
                            title="Edit Quote"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {['sent', 'accepted'].includes(quote.status) && (
                              <>
                                <DropdownMenuItem onClick={() => handleOpenConvertDialog(quote.id, 'order')}>
                                  <ShoppingCart className="h-4 w-4 mr-2" />
                                  Convert to Sales Order
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenConvertDialog(quote.id, 'invoice')}>
                                  <Receipt className="h-4 w-4 mr-2" />
                                  Convert to Invoice
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuItem onClick={() => handleQuickDownload(quote.id, 'pdf')}>
                              <FileDown className="h-4 w-4 mr-2" />
                              Save as PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleQuickDownload(quote.id, 'print')}>
                              <Printer className="h-4 w-4 mr-2" />
                              Print
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenTemplateSelector(quote.id)}>
                              <FileText className="h-4 w-4 mr-2" />
                              Choose Template...
                            </DropdownMenuItem>
                            {['draft', 'sent'].includes(quote.status) && (
                              <DropdownMenuItem
                                onClick={() => {
                                  if (confirm('Are you sure you want to delete this quote?')) {
                                    deleteQuoteMutation.mutate(quote.id);
                                  }
                                }}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Quote
                              </DropdownMenuItem>
                            )}
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

      {/* Create Quote Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingQuote ? 'Edit Quote' : 'Create New Quote'}</DialogTitle>
            <DialogDescription>
              {editingQuote ? 'Update quote details' : 'Create a quote or estimate for your customer'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Customer</Label>
                <Select
                  value={formData.customerId}
                  onValueChange={(value) => setFormData({ ...formData, customerId: value })}
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
                <Label>Quote Date</Label>
                <Input
                  type="date"
                  value={formData.quoteDate}
                  onChange={(e) => setFormData({ ...formData, quoteDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <Input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Terms & Conditions</Label>
                <Input
                  placeholder="Payment terms, validity, etc."
                  value={formData.terms}
                  onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                />
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
            <Button variant="outline" onClick={() => { setShowCreateDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button
              variant="outline"
              disabled={createQuoteMutation.isPending || updateQuoteMutation.isPending}
              onClick={() => {
                if (editingQuote) {
                  updateQuoteMutation.mutate({ id: editingQuote.id, data: formData });
                } else {
                  createQuoteMutation.mutate(formData);
                }
              }}
            >
              {editingQuote ? 'Update Quote' : 'Save as Draft'}
            </Button>
            {!editingQuote && (
              <Button
                disabled={createQuoteMutation.isPending || !formData.customerId}
                onClick={() => {
                  createQuoteMutation.mutate(formData);
                }}
              >
                <Send className="h-4 w-4 mr-2" />
                Save & Send
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Quote Dialog */}
      <Dialog open={!!selectedQuote} onOpenChange={() => setSelectedQuote(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Quote {selectedQuote?.quoteNumber}</DialogTitle>
          </DialogHeader>
          {selectedQuote && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Customer</Label>
                  <p className="font-medium">{selectedQuote.customerName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <p>{getStatusBadge(selectedQuote.status)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Quote Date</Label>
                  <p>{new Date(selectedQuote.quoteDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Expiry Date</Label>
                  <p>{new Date(selectedQuote.expiryDate).toLocaleDateString()}</p>
                </div>
              </div>
              {selectedQuote.terms && (
                <div>
                  <Label className="text-muted-foreground">Terms</Label>
                  <p>{selectedQuote.terms}</p>
                </div>
              )}
              <div className="border-t pt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total Amount</span>
                  <span>{formatCurrency(parseFloat(selectedQuote.totalAmount))}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedQuote(null)}>
              Close
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => selectedQuote && handleQuickDownload(selectedQuote.id, 'pdf')}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Save as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => selectedQuote && handleQuickDownload(selectedQuote.id, 'print')}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => selectedQuote && handleOpenTemplateSelector(selectedQuote.id)}>
                  <FileText className="h-4 w-4 mr-2" />
                  Choose Template...
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {selectedQuote && ['sent', 'accepted'].includes(selectedQuote.status) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button>
                    <FileOutput className="h-4 w-4 mr-2" />
                    Convert
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => {
                    setSelectedQuote(null);
                    handleOpenConvertDialog(selectedQuote.id, 'order');
                  }}>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Convert to Sales Order
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    setSelectedQuote(null);
                    handleOpenConvertDialog(selectedQuote.id, 'invoice');
                  }}>
                    <Receipt className="h-4 w-4 mr-2" />
                    Convert to Invoice
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Selector Dialog */}
      <TemplateSelector
        open={showTemplateSelector}
        onOpenChange={setShowTemplateSelector}
        defaultTemplate={(currentCompany?.defaultTemplate as TemplateId) || 'classic'}
        onSelect={handleDownloadPDF}
        documentType="quote"
      />

      {/* Convert Quote Dialog */}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {convertType === 'order' ? 'Convert to Sales Order' : 'Convert to Invoice'}
            </DialogTitle>
            <DialogDescription>
              {convertType === 'order'
                ? 'Create a sales order from this quote. You can optionally add PO or Engagement Letter references.'
                : 'Create an invoice directly from this quote.'}
            </DialogDescription>
          </DialogHeader>
          {convertType === 'order' && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="poNumber">Customer PO Number (Optional)</Label>
                <Input
                  id="poNumber"
                  placeholder="e.g., PO-2024-001"
                  value={poNumber}
                  onChange={(e) => setPoNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="engagementLetter">Engagement Letter Reference (Optional)</Label>
                <Input
                  id="engagementLetter"
                  placeholder="e.g., EL/2024/001"
                  value={engagementLetterRef}
                  onChange={(e) => setEngagementLetterRef(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvertDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConvert}
              disabled={convertToOrderMutation.isPending || convertToInvoiceMutation.isPending}
            >
              {convertType === 'order' ? (
                <>
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Create Sales Order
                </>
              ) : (
                <>
                  <Receipt className="h-4 w-4 mr-2" />
                  Create Invoice
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
