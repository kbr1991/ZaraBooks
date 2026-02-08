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
  ShoppingCart,
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  Clock,
  Package,
  FileOutput,
  Download,
  Printer,
  FileDown,
  FileText,
} from 'lucide-react';
import { generateDocument, DocumentData, TemplateId } from '@/lib/document-templates';
import TemplateSelector from '@/components/document/TemplateSelector';

interface SalesOrder {
  id: string;
  orderNumber: string;
  orderDate: string;
  deliveryDate: string;
  customerId: string;
  customerName: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  status: 'open' | 'confirmed' | 'closed';
  items: SalesOrderItem[];
}

interface SalesOrderItem {
  id: string;
  productId?: string;
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

export default function SalesOrders() {
  const { toast } = useToast();
  const { currentCompany } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<SalesOrder | null>(null);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [pendingDownloadOrderId, setPendingDownloadOrderId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    customerId: '',
    orderDate: new Date().toISOString().split('T')[0],
    deliveryDate: '',
    items: [{ description: '', quantity: 1, rate: '', hsnSac: '', gstRate: '18' }],
  });

  // Fetch sales orders
  const { data: orders, isLoading } = useQuery<SalesOrder[]>({
    queryKey: ['sales-orders', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const response = await fetch(`/api/sales-orders?${params}`, {
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

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch('/api/sales-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create order');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      setShowCreateDialog(false);
      resetForm();
      toast({ title: 'Sales order created successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to create order', variant: 'destructive' });
    },
  });

  // Confirm order mutation
  const confirmOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await fetch(`/api/sales-orders/${orderId}/confirm`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to confirm order');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      toast({ title: 'Order confirmed' });
    },
    onError: () => {
      toast({ title: 'Failed to confirm order', variant: 'destructive' });
    },
  });

  // Convert to invoice mutation
  const convertToInvoiceMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await fetch(`/api/sales-orders/${orderId}/convert-to-invoice`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to convert order');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast({ title: 'Order converted to invoice' });
    },
    onError: () => {
      toast({ title: 'Failed to convert order', variant: 'destructive' });
    },
  });

  // Delete sales order mutation
  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await fetch(`/api/sales-orders/${orderId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete sales order');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      toast({ title: 'Sales order deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  // Handle opening template selector for download
  const handleOpenTemplateSelector = (orderId: string) => {
    setPendingDownloadOrderId(orderId);
    setShowTemplateSelector(true);
  };

  // Handle download PDF with template
  const handleDownloadPDF = async (templateId: TemplateId, _action: 'print' | 'pdf') => {
    if (!pendingDownloadOrderId) return;

    try {
      const response = await fetch(`/api/sales-orders/${pendingDownloadOrderId}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        toast({ title: 'Failed to load order', variant: 'destructive' });
        return;
      }
      const order = await response.json();

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast({ title: 'Please allow popups to download PDF', variant: 'destructive' });
        return;
      }

      const orderLines = order.lines || [];
      const subtotal = parseFloat(order.subtotal || 0);
      const cgst = parseFloat(order.cgst || 0);
      const sgst = parseFloat(order.sgst || 0);
      const igst = parseFloat(order.igst || 0);
      const total = parseFloat(order.totalAmount || 0);

      const documentData: DocumentData = {
        type: 'sales_order',
        documentNumber: order.orderNumber,
        documentDate: order.orderDate,
        deliveryDate: order.deliveryDate || order.expectedDeliveryDate,
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
          name: order.customer?.name || 'Customer',
          address: order.customer?.address,
          city: order.customer?.city,
          state: order.customer?.state,
          pincode: order.customer?.pincode,
          gstin: order.customer?.gstin,
          email: order.customer?.email,
        },
        items: orderLines.map((line: any) => {
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
        notes: order.notes,
        status: order.status,
        shippingAddress: order.shippingAddress,
      };

      const htmlContent = generateDocument(documentData, templateId);

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 250);
      };

      setPendingDownloadOrderId(null);
    } catch (error) {
      toast({ title: 'Failed to generate PDF', variant: 'destructive' });
    }
  };

  // Quick download with default template
  const handleQuickDownload = async (orderId: string, action: 'print' | 'pdf') => {
    setPendingDownloadOrderId(orderId);
    const defaultTemplate = (currentCompany?.defaultTemplate as TemplateId) || 'classic';
    await handleDownloadPDF(defaultTemplate, action);
  };

  const resetForm = () => {
    setFormData({
      customerId: '',
      orderDate: new Date().toISOString().split('T')[0],
      deliveryDate: '',
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

  const filteredOrders = orders?.filter((order) =>
    order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      open: 'bg-blue-100 text-blue-700',
      confirmed: 'bg-green-100 text-green-700',
      closed: 'bg-gray-100 text-gray-700',
    };
    const icons: Record<string, React.ReactNode> = {
      open: <Clock className="h-3 w-3" />,
      confirmed: <CheckCircle className="h-3 w-3" />,
      closed: <Package className="h-3 w-3" />,
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
    total: orders?.length || 0,
    open: orders?.filter((o) => o.status === 'open').length || 0,
    confirmed: orders?.filter((o) => o.status === 'confirmed').length || 0,
    closed: orders?.filter((o) => o.status === 'closed').length || 0,
    totalAmount: orders?.reduce((sum, o) => sum + parseFloat(o.totalAmount || '0'), 0) || 0,
    openAmount: orders?.filter((o) => o.status === 'open')
      .reduce((sum, o) => sum + parseFloat(o.totalAmount || '0'), 0) || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sales Orders</h1>
          <p className="text-muted-foreground">
            Manage customer sales orders
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Sales Order
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalAmount)}</div>
            <p className="text-xs text-muted-foreground">{stats.total} orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Open Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatCurrency(stats.openAmount)}</div>
            <p className="text-xs text-muted-foreground">{stats.open} orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Confirmed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.confirmed}</div>
            <p className="text-xs text-muted-foreground">Ready for delivery</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Closed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.closed}</div>
            <p className="text-xs text-muted-foreground">Completed orders</p>
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
                  placeholder="Search orders..."
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
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Order List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Sales Order List
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !filteredOrders?.length ? (
            <div className="text-center py-12">
              <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No sales orders found</p>
              <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create First Order
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Order Date</TableHead>
                  <TableHead>Delivery Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[150px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono font-medium">
                      {order.orderNumber}
                    </TableCell>
                    <TableCell>{order.customerName}</TableCell>
                    <TableCell>
                      {new Date(order.orderDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {new Date(order.deliveryDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(parseFloat(order.totalAmount))}
                    </TableCell>
                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedOrder(order)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {order.status === 'open' && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => confirmOrderMutation.mutate(order.id)}
                            >
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            </Button>
                            <Button variant="ghost" size="icon">
                              <Edit className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {order.status === 'confirmed' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => convertToInvoiceMutation.mutate(order.id)}
                            title="Convert to Invoice"
                          >
                            <FileOutput className="h-4 w-4 text-blue-500" />
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Download className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleQuickDownload(order.id, 'pdf')}>
                              <FileDown className="h-4 w-4 mr-2" />
                              Save as PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleQuickDownload(order.id, 'print')}>
                              <Printer className="h-4 w-4 mr-2" />
                              Print
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleOpenTemplateSelector(order.id)}>
                              <FileText className="h-4 w-4 mr-2" />
                              Choose Template...
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {order.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this sales order?')) {
                                deleteOrderMutation.mutate(order.id);
                              }
                            }}
                            disabled={deleteOrderMutation.isPending}
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

      {/* Create Order Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create Sales Order</DialogTitle>
            <DialogDescription>
              Create a new sales order for your customer
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
                <Label>Order Date</Label>
                <Input
                  type="date"
                  value={formData.orderDate}
                  onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Expected Delivery Date</Label>
                <Input
                  type="date"
                  value={formData.deliveryDate}
                  onChange={(e) => setFormData({ ...formData, deliveryDate: e.target.value })}
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
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createOrderMutation.mutate(formData)}
              disabled={createOrderMutation.isPending || !formData.customerId}
            >
              {createOrderMutation.isPending ? 'Creating...' : 'Create Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Order Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sales Order {selectedOrder?.orderNumber}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Customer</Label>
                  <p className="font-medium">{selectedOrder.customerName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <p>{getStatusBadge(selectedOrder.status)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Order Date</Label>
                  <p>{new Date(selectedOrder.orderDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Delivery Date</Label>
                  <p>{new Date(selectedOrder.deliveryDate).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total Amount</span>
                  <span>{formatCurrency(parseFloat(selectedOrder.totalAmount))}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedOrder(null)}>
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
                <DropdownMenuItem onClick={() => selectedOrder && handleQuickDownload(selectedOrder.id, 'pdf')}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Save as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => selectedOrder && handleQuickDownload(selectedOrder.id, 'print')}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => selectedOrder && handleOpenTemplateSelector(selectedOrder.id)}>
                  <FileText className="h-4 w-4 mr-2" />
                  Choose Template...
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {selectedOrder?.status === 'confirmed' && (
              <Button onClick={() => {
                convertToInvoiceMutation.mutate(selectedOrder.id);
                setSelectedOrder(null);
              }}>
                <FileOutput className="h-4 w-4 mr-2" />
                Convert to Invoice
              </Button>
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
        documentType="sales_order"
      />
    </div>
  );
}
