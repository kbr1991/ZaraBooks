import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function Commissions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-commissions', page, status],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (status !== 'all') params.set('status', status);

      const response = await fetch(`/api/admin/commissions?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch commissions');
      return response.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/commissions/${id}/approve`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to approve commission');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-commissions'] });
      toast({ title: 'Commission approved' });
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const response = await fetch('/api/admin/commissions/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ commissionIds: ids }),
      });
      if (!response.ok) throw new Error('Failed to approve commissions');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-commissions'] });
      setSelected([]);
      toast({ title: `${data.updated} commissions approved` });
    },
  });

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500',
      approved: 'bg-blue-500',
      paid: 'bg-green-500',
      cancelled: 'bg-gray-500',
    };
    return (
      <Badge className={colors[status] || 'bg-gray-500'}>
        {status}
      </Badge>
    );
  };

  const toggleSelect = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const pendingIds = data?.commissions
      ?.filter((c: any) => c.status === 'pending')
      ?.map((c: any) => c.id) || [];

    if (selected.length === pendingIds.length) {
      setSelected([]);
    } else {
      setSelected(pendingIds);
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Commissions</h1>
          <p className="text-muted-foreground">
            Approve and manage partner commissions
          </p>
        </div>
        {selected.length > 0 && (
          <Button onClick={() => bulkApproveMutation.mutate(selected)}>
            <Check className="h-4 w-4 mr-2" />
            Approve Selected ({selected.length})
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              ₹{parseFloat(data?.summary?.pendingTotal || 0).toLocaleString('en-IN')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Approved (Awaiting Payout)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              ₹{parseFloat(data?.summary?.approvedTotal || 0).toLocaleString('en-IN')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              ₹{(
                parseFloat(data?.summary?.pendingTotal || 0) +
                parseFloat(data?.summary?.approvedTotal || 0)
              ).toLocaleString('en-IN')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={
                    selected.length > 0 &&
                    selected.length === data?.commissions?.filter((c: any) => c.status === 'pending').length
                  }
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Partner</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Subscription</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : data?.commissions?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  No commissions found
                </TableCell>
              </TableRow>
            ) : (
              data?.commissions?.map((commission: any) => (
                <TableRow key={commission.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.includes(commission.id)}
                      onCheckedChange={() => toggleSelect(commission.id)}
                      disabled={commission.status !== 'pending'}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{commission.partner?.name}</div>
                  </TableCell>
                  <TableCell>{commission.tenant?.name}</TableCell>
                  <TableCell>
                    ₹{parseFloat(commission.subscriptionAmount).toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell>{commission.commissionRate}%</TableCell>
                  <TableCell className="font-medium">
                    ₹{parseFloat(commission.commissionAmount).toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell>{getStatusBadge(commission.status)}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {commission.periodStart} - {commission.periodEnd}
                    </div>
                  </TableCell>
                  <TableCell>
                    {commission.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => approveMutation.mutate(commission.id)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data?.pagination && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * 20 + 1} to{' '}
            {Math.min(page * 20, data.pagination.total)} of {data.pagination.total}
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
              Page {page} of {data.pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={page >= data.pagination.totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
