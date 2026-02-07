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
import {
  Target,
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  ChevronRight,
  Building,
} from 'lucide-react';

interface CostCenter {
  id: string;
  code: string;
  name: string;
  description?: string;
  parentId?: string;
  parentName?: string;
  level: number;
  isActive: boolean;
  children?: CostCenter[];
}

export default function CostCenters() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedCostCenter, setSelectedCostCenter] = useState<CostCenter | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    parentId: '',
    isActive: true,
  });

  // Fetch cost centers
  const { data: costCenters, isLoading } = useQuery<CostCenter[]>({
    queryKey: ['cost-centers'],
    queryFn: async () => {
      const response = await fetch('/api/cost-centers', {
        credentials: 'include',
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Create cost center mutation
  const createCostCenterMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch('/api/cost-centers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create cost center');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-centers'] });
      setShowCreateDialog(false);
      resetForm();
      toast({ title: 'Cost center created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  // Update cost center mutation
  const updateCostCenterMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<typeof formData> }) => {
      const response = await fetch(`/api/cost-centers/${data.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data.updates),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update cost center');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-centers'] });
      setShowEditDialog(false);
      setSelectedCostCenter(null);
      resetForm();
      toast({ title: 'Cost center updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  // Delete cost center mutation
  const deleteCostCenterMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/cost-centers/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete cost center');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-centers'] });
      toast({ title: 'Cost center deleted' });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      description: '',
      parentId: '',
      isActive: true,
    });
  };

  const openEditDialog = (costCenter: CostCenter) => {
    setSelectedCostCenter(costCenter);
    setFormData({
      code: costCenter.code,
      name: costCenter.name,
      description: costCenter.description || '',
      parentId: costCenter.parentId || '',
      isActive: costCenter.isActive,
    });
    setShowEditDialog(true);
  };

  const filteredCostCenters = costCenters?.filter((cc) =>
    cc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cc.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Build hierarchical list for display
  const buildHierarchy = (centers: CostCenter[]): CostCenter[] => {
    const rootCenters = centers.filter(c => !c.parentId);
    const getChildren = (parentId: string): CostCenter[] => {
      return centers
        .filter(c => c.parentId === parentId)
        .map(c => ({ ...c, children: getChildren(c.id) }));
    };
    return rootCenters.map(c => ({ ...c, children: getChildren(c.id) }));
  };

  const renderCostCenterRow = (costCenter: CostCenter, depth = 0) => {
    const rows = [];
    rows.push(
      <TableRow key={costCenter.id} className={!costCenter.isActive ? 'opacity-50' : ''}>
        <TableCell className="font-mono">{costCenter.code}</TableCell>
        <TableCell>
          <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 1.5}rem` }}>
            {depth > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            {costCenter.name}
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground">{costCenter.description || '-'}</TableCell>
        <TableCell>{costCenter.parentName || '-'}</TableCell>
        <TableCell>
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${costCenter.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
            {costCenter.isActive ? 'Active' : 'Inactive'}
          </span>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openEditDialog(costCenter)}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (confirm('Are you sure you want to delete this cost center?')) {
                  deleteCostCenterMutation.mutate(costCenter.id);
                }
              }}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
    if (costCenter.children) {
      costCenter.children.forEach(child => {
        rows.push(...renderCostCenterRow(child, depth + 1));
      });
    }
    return rows;
  };

  // Calculate stats
  const stats = {
    total: costCenters?.length || 0,
    active: costCenters?.filter(cc => cc.isActive).length || 0,
    rootCenters: costCenters?.filter(cc => !cc.parentId).length || 0,
    subCenters: costCenters?.filter(cc => cc.parentId).length || 0,
  };

  const hierarchy = filteredCostCenters ? buildHierarchy(filteredCostCenters) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cost Centers</h1>
          <p className="text-muted-foreground">
            Manage cost centers for expense tracking and reporting
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Cost Center
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-500" />
              Total Cost Centers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All cost centers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building className="h-4 w-4 text-green-500" />
              Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Main Centers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rootCenters}</div>
            <p className="text-xs text-muted-foreground">Top-level centers</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sub-Centers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.subCenters}</div>
            <p className="text-xs text-muted-foreground">Nested centers</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search cost centers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Cost Center List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Cost Center List
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !filteredCostCenters?.length ? (
            <div className="text-center py-12">
              <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No cost centers found</p>
              <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Cost Center
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {hierarchy.flatMap(cc => renderCostCenterRow(cc))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Cost Center Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Cost Center</DialogTitle>
            <DialogDescription>
              Create a new cost center for tracking expenses
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  placeholder="e.g., CC-001"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="Cost center name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Input
                placeholder="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Parent Cost Center (Optional)</Label>
              <Select
                value={formData.parentId}
                onValueChange={(value) => setFormData({ ...formData, parentId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select parent (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No Parent</SelectItem>
                  {costCenters?.filter(cc => cc.isActive).map((cc) => (
                    <SelectItem key={cc.id} value={cc.id}>
                      {cc.code} - {cc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createCostCenterMutation.mutate(formData)}
              disabled={!formData.code || !formData.name || createCostCenterMutation.isPending}
            >
              {createCostCenterMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Cost Center Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => {
        setShowEditDialog(open);
        if (!open) {
          setSelectedCostCenter(null);
          resetForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Cost Center</DialogTitle>
            <DialogDescription>
              Update cost center details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  placeholder="e.g., CC-001"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="Cost center name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Input
                placeholder="Description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Parent Cost Center (Optional)</Label>
              <Select
                value={formData.parentId}
                onValueChange={(value) => setFormData({ ...formData, parentId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select parent (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No Parent</SelectItem>
                  {costCenters?.filter(cc => cc.isActive && cc.id !== selectedCostCenter?.id).map((cc) => (
                    <SelectItem key={cc.id} value={cc.id}>
                      {cc.code} - {cc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="isActiveEdit"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label htmlFor="isActiveEdit">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowEditDialog(false);
              setSelectedCostCenter(null);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedCostCenter) {
                  updateCostCenterMutation.mutate({
                    id: selectedCostCenter.id,
                    updates: formData,
                  });
                }
              }}
              disabled={!formData.code || !formData.name || updateCostCenterMutation.isPending}
            >
              {updateCostCenterMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
