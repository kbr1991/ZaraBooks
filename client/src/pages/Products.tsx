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
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import {
  Package,
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  Wrench,
  Box,
  Tag,
} from 'lucide-react';

interface Product {
  id: string;
  name: string;
  sku?: string;
  type: 'product' | 'service';
  description?: string;
  sellingPrice: string;
  costPrice?: string;
  hsnSacCode?: string;
  gstRate: string;
  unit?: string;
  trackInventory: boolean;
  currentStock?: number;
  reorderLevel?: number;
  isActive: boolean;
}

const itemTypes = [
  { value: 'product', label: 'Product', icon: Box },
  { value: 'service', label: 'Service', icon: Wrench },
];

const gstRates = [
  { value: '0', label: '0%' },
  { value: '5', label: '5%' },
  { value: '12', label: '12%' },
  { value: '18', label: '18%' },
  { value: '28', label: '28%' },
];

const units = [
  { value: 'nos', label: 'Numbers (NOS)' },
  { value: 'pcs', label: 'Pieces (PCS)' },
  { value: 'kg', label: 'Kilograms (KG)' },
  { value: 'gm', label: 'Grams (GM)' },
  { value: 'ltr', label: 'Liters (LTR)' },
  { value: 'ml', label: 'Milliliters (ML)' },
  { value: 'mtr', label: 'Meters (MTR)' },
  { value: 'sqft', label: 'Square Feet (SQFT)' },
  { value: 'hrs', label: 'Hours (HRS)' },
  { value: 'days', label: 'Days' },
];

export default function Products() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    type: 'product',
    description: '',
    sellingPrice: '',
    costPrice: '',
    hsnSacCode: '',
    gstRate: '18',
    unit: 'nos',
    trackInventory: false,
    reorderLevel: '',
  });

  // Fetch products
  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ['products', typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.append('type', typeFilter);
      const response = await fetch(`/api/products?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Create product mutation
  const createProductMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create product');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setShowCreateDialog(false);
      resetForm();
      toast({ title: 'Item created successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to create item', variant: 'destructive' });
    },
  });

  // Delete product mutation
  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete product');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Item deleted' });
    },
    onError: () => {
      toast({ title: 'Failed to delete item', variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      sku: '',
      type: 'product',
      description: '',
      sellingPrice: '',
      costPrice: '',
      hsnSacCode: '',
      gstRate: '18',
      unit: 'nos',
      trackInventory: false,
      reorderLevel: '',
    });
  };

  const filteredProducts = products?.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.hsnSacCode?.includes(searchTerm)
  );

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      product: 'bg-blue-100 text-blue-700',
      service: 'bg-purple-100 text-purple-700',
    };
    const icons: Record<string, React.ReactNode> = {
      product: <Box className="h-3 w-3" />,
      service: <Wrench className="h-3 w-3" />,
    };
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[type]}`}>
        {icons[type]}
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </span>
    );
  };

  // Calculate stats
  const stats = {
    totalProducts: products?.filter(p => p.type === 'product').length || 0,
    totalServices: products?.filter(p => p.type === 'service').length || 0,
    activeItems: products?.filter(p => p.isActive).length || 0,
    lowStock: products?.filter(p => p.trackInventory && (p.currentStock || 0) <= (p.reorderLevel || 0)).length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products & Services</h1>
          <p className="text-muted-foreground">
            Manage your products and services catalog
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Item
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Box className="h-4 w-4 text-blue-500" />
              Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
            <p className="text-xs text-muted-foreground">Physical items</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wrench className="h-4 w-4 text-purple-500" />
              Services
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalServices}</div>
            <p className="text-xs text-muted-foreground">Service items</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Tag className="h-4 w-4 text-green-500" />
              Active Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.activeItems}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-yellow-500" />
              Low Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.lowStock}</div>
            <p className="text-xs text-muted-foreground">Below reorder level</p>
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
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Item type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="product">Products</SelectItem>
                <SelectItem value="service">Services</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Product List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Item Catalog
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !filteredProducts?.length ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No items found</p>
              <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Item
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>HSN/SAC</TableHead>
                  <TableHead className="text-right">Selling Price</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>GST</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id} className={!product.isActive ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">
                      {product.name}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {product.sku || '-'}
                    </TableCell>
                    <TableCell>{getTypeBadge(product.type)}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {product.hsnSacCode || '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(parseFloat(product.sellingPrice))}
                    </TableCell>
                    <TableCell className="text-right">
                      {product.trackInventory ? (
                        <span className={product.currentStock && product.reorderLevel && product.currentStock <= product.reorderLevel ? 'text-yellow-600 font-medium' : ''}>
                          {product.currentStock ?? 0} {product.unit}
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>{product.gstRate}%</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedProduct(product)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this item?')) {
                              deleteProductMutation.mutate(product.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Item Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Item</DialogTitle>
            <DialogDescription>
              Add a product or service to your catalog
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Item Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value, trackInventory: value === 'product' ? formData.trackInventory : false })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {itemTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Item Name</Label>
                <Input
                  placeholder="Item name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>SKU (Optional)</Label>
                <Input
                  placeholder="SKU code"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Input
                placeholder="Item description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Selling Price</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={formData.sellingPrice}
                  onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Cost Price (Optional)</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={formData.costPrice}
                  onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{formData.type === 'product' ? 'HSN Code' : 'SAC Code'}</Label>
                <Input
                  placeholder={formData.type === 'product' ? 'HSN code' : 'SAC code'}
                  value={formData.hsnSacCode}
                  onChange={(e) => setFormData({ ...formData, hsnSacCode: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>GST Rate</Label>
                <Select
                  value={formData.gstRate}
                  onValueChange={(value) => setFormData({ ...formData, gstRate: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {gstRates.map((rate) => (
                      <SelectItem key={rate.value} value={rate.value}>
                        {rate.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(value) => setFormData({ ...formData, unit: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((unit) => (
                      <SelectItem key={unit.value} value={unit.value}>
                        {unit.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {formData.type === 'product' && formData.trackInventory && (
                <div className="space-y-2">
                  <Label>Reorder Level</Label>
                  <Input
                    type="number"
                    placeholder="Minimum stock"
                    value={formData.reorderLevel}
                    onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })}
                  />
                </div>
              )}
            </div>
            {formData.type === 'product' && (
              <div className="flex items-center space-x-2">
                <Switch
                  id="trackInventory"
                  checked={formData.trackInventory}
                  onCheckedChange={(checked) => setFormData({ ...formData, trackInventory: checked })}
                />
                <Label htmlFor="trackInventory">Track Inventory</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createProductMutation.mutate(formData)}
              disabled={!formData.name || !formData.sellingPrice || createProductMutation.isPending}
            >
              {createProductMutation.isPending ? 'Adding...' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Item Dialog */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedProduct?.name}</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Type</Label>
                  <p>{getTypeBadge(selectedProduct.type)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">SKU</Label>
                  <p className="font-mono">{selectedProduct.sku || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{selectedProduct.type === 'product' ? 'HSN Code' : 'SAC Code'}</Label>
                  <p className="font-mono">{selectedProduct.hsnSacCode || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">GST Rate</Label>
                  <p>{selectedProduct.gstRate}%</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Selling Price</Label>
                  <p className="font-medium">{formatCurrency(parseFloat(selectedProduct.sellingPrice))}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Cost Price</Label>
                  <p>{selectedProduct.costPrice ? formatCurrency(parseFloat(selectedProduct.costPrice)) : '-'}</p>
                </div>
                {selectedProduct.trackInventory && (
                  <>
                    <div>
                      <Label className="text-muted-foreground">Current Stock</Label>
                      <p>{selectedProduct.currentStock ?? 0} {selectedProduct.unit}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Reorder Level</Label>
                      <p>{selectedProduct.reorderLevel ?? 0} {selectedProduct.unit}</p>
                    </div>
                  </>
                )}
              </div>
              {selectedProduct.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p>{selectedProduct.description}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedProduct(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
