import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Plus,
  Clock,
  CheckCircle,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export default function Payouts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState('');
  const [processDialogOpen, setProcessDialogOpen] = useState(false);
  const [processingPayout, setProcessingPayout] = useState<any>(null);
  const [paymentReference, setPaymentReference] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-payouts', page, status],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      if (status !== 'all') params.set('status', status);

      const response = await fetch(`/api/admin/payouts?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch payouts');
      return response.json();
    },
  });

  const { data: eligiblePartners } = useQuery({
    queryKey: ['admin-payouts-eligible'],
    queryFn: async () => {
      const response = await fetch('/api/admin/payouts/eligible', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch eligible partners');
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (partnerId: string) => {
      const response = await fetch('/api/admin/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ partnerId }),
      });
      if (!response.ok) throw new Error('Failed to create payout');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payouts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-payouts-eligible'] });
      setCreateDialogOpen(false);
      setSelectedPartner('');
      toast({ title: 'Payout created successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to create payout', variant: 'destructive' });
    },
  });

  const processMutation = useMutation({
    mutationFn: async ({ id, paymentReference }: { id: string; paymentReference: string }) => {
      const response = await fetch(`/api/admin/payouts/${id}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ paymentReference }),
      });
      if (!response.ok) throw new Error('Failed to process payout');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-payouts'] });
      queryClient.invalidateQueries({ queryKey: ['admin-commissions'] });
      setProcessDialogOpen(false);
      setProcessingPayout(null);
      setPaymentReference('');
      toast({ title: 'Payout processed successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to process payout', variant: 'destructive' });
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
            <Clock className="h-3 w-3 mr-1" />
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

  const openProcessDialog = (payout: any) => {
    setProcessingPayout(payout);
    setProcessDialogOpen(true);
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payouts</h1>
          <p className="text-muted-foreground">
            Process partner commission payouts
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Payout
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              Processing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              ₹{parseFloat(data?.summary?.processingTotal || 0).toLocaleString('en-IN')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed (This Month)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              ₹{parseFloat(data?.summary?.completedThisMonth || 0).toLocaleString('en-IN')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Eligible Partners
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {eligiblePartners?.length || 0}
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
              <TableHead>Partner</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Gross Amount</TableHead>
              <TableHead>TDS</TableHead>
              <TableHead>Net Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : data?.payouts?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  No payouts found
                </TableCell>
              </TableRow>
            ) : (
              data?.payouts?.map((payout: any) => (
                <TableRow key={payout.id}>
                  <TableCell>
                    <div className="font-medium">{payout.partner?.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {payout.partner?.primaryEmail}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {payout.periodStart} - {payout.periodEnd}
                    </div>
                  </TableCell>
                  <TableCell>
                    ₹{parseFloat(payout.totalAmount).toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    ₹{parseFloat(payout.tdsAmount || 0).toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell className="font-medium">
                    ₹{parseFloat(payout.netAmount).toLocaleString('en-IN')}
                  </TableCell>
                  <TableCell>{getStatusBadge(payout.status)}</TableCell>
                  <TableCell>
                    {payout.paymentReference ? (
                      <span className="text-sm font-mono">
                        {payout.paymentReference}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {payout.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => openProcessDialog(payout)}
                      >
                        Process
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

      {/* Create Payout Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Payout</DialogTitle>
            <DialogDescription>
              Select a partner to create a payout for their approved commissions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Partner</Label>
              <Select value={selectedPartner} onValueChange={setSelectedPartner}>
                <SelectTrigger>
                  <SelectValue placeholder="Select partner" />
                </SelectTrigger>
                <SelectContent>
                  {eligiblePartners?.map((partner: any) => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.name} - ₹{parseFloat(partner.eligibleAmount).toLocaleString('en-IN')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {eligiblePartners?.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No partners with approved commissions above threshold.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(selectedPartner)}
              disabled={!selectedPartner || createMutation.isPending}
            >
              Create Payout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Process Payout Dialog */}
      <Dialog open={processDialogOpen} onOpenChange={setProcessDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Payout</DialogTitle>
            <DialogDescription>
              Enter payment reference to mark this payout as completed.
            </DialogDescription>
          </DialogHeader>
          {processingPayout && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <p className="font-medium">{processingPayout.partner?.name}</p>
                <p className="text-sm text-muted-foreground">
                  Net Amount: ₹{parseFloat(processingPayout.netAmount).toLocaleString('en-IN')}
                </p>
                <p className="text-sm text-muted-foreground">
                  Bank: {processingPayout.partner?.bankAccountNumber} ({processingPayout.partner?.bankIfsc})
                </p>
              </div>
              <div className="space-y-2">
                <Label>Payment Reference / UTR</Label>
                <Input
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Enter UTR or transaction ID"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setProcessDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                processMutation.mutate({
                  id: processingPayout.id,
                  paymentReference,
                })
              }
              disabled={!paymentReference || processMutation.isPending}
            >
              <Check className="h-4 w-4 mr-2" />
              Mark as Completed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
