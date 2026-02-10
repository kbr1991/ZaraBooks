import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CreditCard,
  Search,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Subscriptions() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [tab, setTab] = useState('subscriptions');

  const { data: subscriptions, isLoading } = useQuery({
    queryKey: ['admin-subscriptions', page, status],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (status !== 'all') params.set('status', status);

      const response = await fetch(`/api/admin/subscriptions?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch subscriptions');
      return response.json();
    },
    enabled: tab === 'subscriptions',
  });

  const { data: plans } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: async () => {
      const response = await fetch('/api/admin/subscriptions/plans', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch plans');
      return response.json();
    },
    enabled: tab === 'plans',
  });

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-500',
      trialing: 'bg-blue-500',
      cancelled: 'bg-gray-500',
      expired: 'bg-red-500',
      past_due: 'bg-yellow-500',
    };
    return (
      <Badge className={colors[status] || 'bg-gray-500'}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Subscriptions</h1>
          <p className="text-muted-foreground">
            Manage subscription plans and billing
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions" className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-4">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trialing">Trialing</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Billing</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : subscriptions?.subscriptions?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      No subscriptions found
                    </TableCell>
                  </TableRow>
                ) : (
                  subscriptions?.subscriptions?.map((sub: any) => (
                    <TableRow key={sub.id}>
                      <TableCell>
                        <div className="font-medium">{sub.tenant?.name}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {sub.planCode}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">{sub.billingCycle}</TableCell>
                      <TableCell>
                        ₹{parseFloat(sub.amount).toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell>{getStatusBadge(sub.status)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {new Date(sub.currentPeriodStart).toLocaleDateString()} -{' '}
                          {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        {sub.partner ? (
                          <span className="text-sm">{sub.partner.name}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            <DropdownMenuItem>Cancel</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {subscriptions?.pagination && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * 20 + 1} to{' '}
                {Math.min(page * 20, subscriptions.pagination.total)} of{' '}
                {subscriptions.pagination.total}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Page {page} of {subscriptions.pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= subscriptions.pagination.totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="plans" className="space-y-4">
          <div className="flex justify-end">
            <Button>Add Plan</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans?.map((plan: any) => (
              <Card key={plan.id}>
                <CardHeader>
                  <CardTitle className="capitalize">{plan.name}</CardTitle>
                  <CardDescription>Code: {plan.code}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-2xl font-bold">
                      ₹{parseFloat(plan.monthlyPrice).toLocaleString('en-IN')}
                      <span className="text-sm text-muted-foreground font-normal">
                        /month
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      ₹{parseFloat(plan.yearlyPrice).toLocaleString('en-IN')}/year
                    </p>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p>
                      <span className="text-muted-foreground">Companies:</span>{' '}
                      {plan.maxCompanies}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Users/Company:</span>{' '}
                      {plan.maxUsersPerCompany}
                    </p>
                  </div>
                  <Badge variant={plan.isActive ? 'default' : 'secondary'}>
                    {plan.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
