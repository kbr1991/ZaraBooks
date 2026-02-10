import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  DollarSign,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Commissions() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['partner-commissions', page, status],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (status !== 'all') params.set('status', status);

      const response = await fetch(`/api/partner/commissions?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch commissions');
      return response.json();
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'approved':
        return (
          <Badge className="bg-blue-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case 'paid':
        return (
          <Badge className="bg-green-500">
            <DollarSign className="h-3 w-3 mr-1" />
            Paid
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="secondary">
            <XCircle className="h-3 w-3 mr-1" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Commissions</h1>
        <p className="text-muted-foreground">
          Track your commission earnings from client subscriptions
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Approval
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {'\u20B9'}{parseFloat(data?.summary?.pending || 0).toLocaleString('en-IN')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Approved
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {'\u20B9'}{parseFloat(data?.summary?.approved || 0).toLocaleString('en-IN')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Paid Out
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {'\u20B9'}{parseFloat(data?.summary?.paid || 0).toLocaleString('en-IN')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Earned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {'\u20B9'}{parseFloat(data?.summary?.total || 0).toLocaleString('en-IN')}
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
              <TableHead>Client</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Subscription</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Commission</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : data?.commissions?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="space-y-2">
                    <p>No commissions found</p>
                    <p className="text-sm text-muted-foreground">
                      Commissions are generated monthly for active subscriptions
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data?.commissions?.map((commission: any) => (
                <TableRow key={commission.id}>
                  <TableCell>
                    <div className="font-medium">{commission.tenant?.name}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {commission.periodStart} - {commission.periodEnd}
                    </div>
                  </TableCell>
                  <TableCell>
                    {'\u20B9'}{parseFloat(commission.subscriptionAmount).toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell>{commission.commissionRate}%</TableCell>
                  <TableCell className="font-medium">
                    {'\u20B9'}{parseFloat(commission.commissionAmount).toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell>{getStatusBadge(commission.status)}</TableCell>
                  <TableCell>
                    {new Date(commission.createdAt).toLocaleDateString()}
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

      {/* Info */}
      <div className="bg-muted/50 rounded-lg p-4">
        <h3 className="font-medium mb-2">How Commissions Work</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Commissions are calculated monthly based on active subscription amounts</li>
          <li>• Your commission rate is {data?.partnerRate || '10'}% based on your tier</li>
          <li>• Pending commissions are reviewed and approved by ZaraBooks</li>
          <li>• Payouts are processed when your approved balance reaches {'\u20B9'}5,000</li>
        </ul>
      </div>
    </div>
  );
}
