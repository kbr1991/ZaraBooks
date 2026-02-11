import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Wallet,
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

export default function Payouts() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['partner-payouts', page, status],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (status !== 'all') params.set('status', status);

      const response = await fetch(`/api/partner/payouts?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch payouts');
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
      case 'processing':
        return (
          <Badge className="bg-blue-500">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Processing
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="bg-green-500">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Payouts</h1>
        <p className="text-muted-foreground">
          Your payout history and pending payments
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Payout
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {'\u20B9'}{parseFloat(data?.summary?.pending || 0).toLocaleString('en-IN')}
            </p>
            <p className="text-sm text-muted-foreground">
              Awaiting processing
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Received
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {'\u20B9'}{parseFloat(data?.summary?.completed || 0).toLocaleString('en-IN')}
            </p>
            <p className="text-sm text-muted-foreground">
              Lifetime payouts
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Eligible Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {'\u20B9'}{parseFloat(data?.summary?.eligible || 0).toLocaleString('en-IN')}
            </p>
            <p className="text-sm text-muted-foreground">
              Min {'\u20B9'}5,000 for payout
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bank Details */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Bank Details</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.bankDetails ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Account Name</p>
                <p className="font-medium">{data.bankDetails.accountName || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Account Number</p>
                <p className="font-medium">{data.bankDetails.accountNumber || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">IFSC Code</p>
                <p className="font-medium">{data.bankDetails.ifsc || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <Badge variant={data.bankDetails.verified ? 'default' : 'outline'}>
                  {data.bankDetails.verified ? 'Verified' : 'Pending Verification'}
                </Badge>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Please update your bank details in your profile to receive payouts.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Gross Amount</TableHead>
              <TableHead>TDS (10%)</TableHead>
              <TableHead>Net Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment Reference</TableHead>
              <TableHead>Processed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : data?.payouts?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  <div className="space-y-2">
                    <Wallet className="h-12 w-12 mx-auto text-muted-foreground/50" />
                    <p>No payouts yet</p>
                    <p className="text-sm text-muted-foreground">
                      Payouts are processed when your approved balance reaches {'\u20B9'}5,000
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data?.payouts?.map((payout: any) => (
                <TableRow key={payout.id}>
                  <TableCell>
                    <div className="text-sm">
                      {payout.periodStart} - {payout.periodEnd}
                    </div>
                  </TableCell>
                  <TableCell>
                    {'\u20B9'}{parseFloat(payout.totalAmount).toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {'\u20B9'}{parseFloat(payout.tdsAmount || 0).toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell className="font-medium">
                    {'\u20B9'}{parseFloat(payout.netAmount).toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell>{getStatusBadge(payout.status)}</TableCell>
                  <TableCell>
                    {payout.paymentReference ? (
                      <span className="font-mono text-sm">{payout.paymentReference}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {payout.processedAt
                      ? new Date(payout.processedAt).toLocaleDateString()
                      : '-'}
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
        <h3 className="font-medium mb-2">Payout Information</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Minimum payout threshold: {'\u20B9'}5,000</li>
          <li>• TDS @ 10% is deducted as per Section 194H of Income Tax Act</li>
          <li>• Payouts are processed within 7 working days</li>
          <li>• Keep your bank details and PAN updated for smooth processing</li>
        </ul>
      </div>
    </div>
  );
}
