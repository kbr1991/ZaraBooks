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
import { toast } from '@/hooks/useToast';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Plus, Search, Users, Building2, User, Phone, Mail, MapPin } from 'lucide-react';

const partyTypeColors: Record<string, string> = {
  customer: 'bg-green-100 text-green-700',
  vendor: 'bg-blue-100 text-blue-700',
  employee: 'bg-purple-100 text-purple-700',
  other: 'bg-gray-100 text-gray-700',
};

export default function Parties() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    partyType: 'customer',
    pan: '',
    gstin: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    creditLimit: '',
    paymentTerms: 30,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['parties', typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.append('type', typeFilter);

      const response = await fetch(`/api/parties?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch parties');
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch('/api/parties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...data,
          creditLimit: data.creditLimit ? parseFloat(data.creditLimit) : null,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create party');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      toast({ title: 'Party created successfully!' });
      setShowForm(false);
      setFormData({
        name: '',
        partyType: 'customer',
        pan: '',
        gstin: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        creditLimit: '',
        paymentTerms: 30,
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to create party',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const parties = data?.parties || [];
  const filteredParties = parties.filter((party: any) =>
    !searchTerm ||
    party.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    party.gstin?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    party.pan?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const partyCounts = {
    all: parties.length,
    customer: parties.filter((p: any) => p.partyType === 'customer').length,
    vendor: parties.filter((p: any) => p.partyType === 'vendor').length,
    employee: parties.filter((p: any) => p.partyType === 'employee').length,
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Parties</h1>
          <p className="text-muted-foreground">Manage customers, vendors, and employees</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Party
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card
          className={cn("cursor-pointer", typeFilter === 'all' && "ring-2 ring-primary")}
          onClick={() => setTypeFilter('all')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">All Parties</p>
                <p className="text-2xl font-bold">{partyCounts.all}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn("cursor-pointer", typeFilter === 'customer' && "ring-2 ring-primary")}
          onClick={() => setTypeFilter('customer')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Customers</p>
                <p className="text-2xl font-bold">{partyCounts.customer}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn("cursor-pointer", typeFilter === 'vendor' && "ring-2 ring-primary")}
          onClick={() => setTypeFilter('vendor')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vendors</p>
                <p className="text-2xl font-bold">{partyCounts.vendor}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={cn("cursor-pointer", typeFilter === 'employee' && "ring-2 ring-primary")}
          onClick={() => setTypeFilter('employee')}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Employees</p>
                <p className="text-2xl font-bold">{partyCounts.employee}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Party Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New Party</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate(formData);
              }}
              className="space-y-4"
            >
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="partyType">Type *</Label>
                  <Select
                    value={formData.partyType}
                    onValueChange={(value) => setFormData({ ...formData, partyType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="vendor">Vendor</SelectItem>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pan">PAN</Label>
                  <Input
                    id="pan"
                    value={formData.pan}
                    onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                    maxLength={10}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gstin">GSTIN</Label>
                  <Input
                    id="gstin"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                    maxLength={15}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pincode">Pincode</Label>
                  <Input
                    id="pincode"
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    maxLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="creditLimit">Credit Limit</Label>
                  <Input
                    id="creditLimit"
                    type="number"
                    value={formData.creditLimit}
                    onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Creating...' : 'Create Party'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Parties List */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle>Party List</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search parties..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-[300px]"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="py-3 pl-4 text-left text-sm font-medium">Name</th>
                <th className="py-3 text-left text-sm font-medium">Type</th>
                <th className="py-3 text-left text-sm font-medium">GSTIN</th>
                <th className="py-3 text-left text-sm font-medium">Contact</th>
                <th className="py-3 text-left text-sm font-medium">Location</th>
                <th className="py-3 text-right text-sm font-medium">Balance</th>
                <th className="py-3 pr-4 text-right text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredParties.map((party: any) => (
                <tr key={party.id} className="border-b hover:bg-muted/50">
                  <td className="py-3 pl-4">
                    <div>
                      <p className="font-medium">{party.name}</p>
                      {party.pan && (
                        <p className="text-xs text-muted-foreground">PAN: {party.pan}</p>
                      )}
                    </div>
                  </td>
                  <td className="py-3">
                    <span className={cn(
                      'px-2 py-1 rounded-full text-xs font-medium capitalize',
                      partyTypeColors[party.partyType]
                    )}>
                      {party.partyType}
                    </span>
                  </td>
                  <td className="py-3">
                    <span className="font-mono text-sm">{party.gstin || '-'}</span>
                  </td>
                  <td className="py-3">
                    <div className="space-y-1">
                      {party.phone && (
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3" />
                          {party.phone}
                        </div>
                      )}
                      {party.email && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {party.email}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-3">
                    {party.city && (
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3" />
                        {party.city}{party.state && `, ${party.state}`}
                      </div>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    <span className={cn(
                      "font-medium",
                      party.balance > 0 ? "text-green-600" : party.balance < 0 ? "text-red-600" : ""
                    )}>
                      {formatCurrency(party.balance || 0)}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </td>
                </tr>
              ))}
              {filteredParties.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No parties found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
