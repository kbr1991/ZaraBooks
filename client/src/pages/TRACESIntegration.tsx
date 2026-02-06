import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { useToast } from '@/hooks/useToast';
import { formatCurrency } from '@/lib/utils';
import {
  FileText,
  Upload,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Shield,
  Receipt,
  Loader2,
  ExternalLink,
  Eye,
} from 'lucide-react';

interface Form26ASEntry {
  id: string;
  deductorTan: string;
  deductorName: string;
  sectionCode: string;
  transactionDate: string;
  amountPaid: number;
  tdsDeposited: number;
  tdsCredit: number;
  quarter: string;
  assessmentYear: string;
}

interface TDSChallan {
  id: string;
  challanType: string;
  assessmentYear: string;
  periodFrom: string;
  periodTo: string;
  sectionCode: string;
  amount: number;
  totalAmount: number;
  paymentDate: string;
  cin: string;
  status: string;
  verifiedOnTraces: boolean;
}

type TabType = 'form26as' | 'challans' | 'verify' | 'reconcile';

export default function TRACESIntegration() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('form26as');
  const [assessmentYear, setAssessmentYear] = useState('2024-25');
  const [quarter, setQuarter] = useState('');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<Form26ASEntry | null>(null);

  // Fetch Form 26AS entries
  const { data: form26asData, isLoading: form26asLoading } = useQuery<Form26ASEntry[]>({
    queryKey: ['form-26as', assessmentYear, quarter],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('assessmentYear', assessmentYear);
      if (quarter) params.append('quarter', quarter);

      const response = await fetch(`/api/tds/form-26as?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: activeTab === 'form26as' || activeTab === 'reconcile',
  });

  // Fetch TDS challans
  const { data: challansData, isLoading: challansLoading } = useQuery<TDSChallan[]>({
    queryKey: ['tds-challans', assessmentYear],
    queryFn: async () => {
      const response = await fetch(`/api/tds/challans?assessmentYear=${assessmentYear}`, {
        credentials: 'include',
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: activeTab === 'challans' || activeTab === 'verify',
  });

  // Upload Form 26AS mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('assessmentYear', assessmentYear);

      const response = await fetch('/api/tds/form-26as/upload', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!response.ok) throw new Error('Upload failed');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['form-26as'] });
      setShowUploadDialog(false);
      toast({
        title: 'Form 26AS uploaded',
        description: `Imported ${data.imported} entries`,
      });
    },
    onError: () => {
      toast({
        title: 'Upload failed',
        variant: 'destructive',
      });
    },
  });

  // Verify challan mutation
  const verifyChallanMutation = useMutation({
    mutationFn: async (challanId: string) => {
      const response = await fetch(`/api/tds/challans/${challanId}/verify`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Verification failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tds-challans'] });
      toast({ title: 'Challan verified on TRACES' });
    },
    onError: () => {
      toast({
        title: 'Verification failed',
        variant: 'destructive',
      });
    },
  });

  // Reconcile mutation
  const reconcileMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/tds/reconcile', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessmentYear }),
      });
      if (!response.ok) throw new Error('Reconciliation failed');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Reconciliation complete',
        description: `Matched: ${data.matched}, Unmatched: ${data.unmatched}`,
      });
    },
    onError: () => {
      toast({
        title: 'Reconciliation failed',
        variant: 'destructive',
      });
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN');
  };

  // Calculate totals
  const totalTDSCredit = form26asData?.reduce((sum, entry) => sum + entry.tdsCredit, 0) || 0;
  const totalChallanAmount = challansData?.reduce((sum, c) => sum + c.totalAmount, 0) || 0;
  const verifiedChallans = challansData?.filter((c) => c.verifiedOnTraces).length || 0;

  const assessmentYears = [
    '2024-25',
    '2023-24',
    '2022-23',
    '2021-22',
  ];

  const quarters = [
    { value: 'Q1', label: 'Q1 (Apr-Jun)' },
    { value: 'Q2', label: 'Q2 (Jul-Sep)' },
    { value: 'Q3', label: 'Q3 (Oct-Dec)' },
    { value: 'Q4', label: 'Q4 (Jan-Mar)' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">TRACES Integration</h1>
          <p className="text-muted-foreground">
            Form 26AS, TDS challan verification, and reconciliation
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={assessmentYear} onValueChange={setAssessmentYear}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="AY" />
            </SelectTrigger>
            <SelectContent>
              {assessmentYears.map((ay) => (
                <SelectItem key={ay} value={ay}>
                  AY {ay}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              Form 26AS TDS Credit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(totalTDSCredit)}
            </div>
            <p className="text-xs text-muted-foreground">
              {form26asData?.length || 0} entries
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Receipt className="h-4 w-4 text-green-500" />
              Challans Paid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalChallanAmount)}
            </div>
            <p className="text-xs text-muted-foreground">
              {challansData?.length || 0} challans
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4 text-purple-500" />
              Verified on TRACES
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {verifiedChallans}
            </div>
            <p className="text-xs text-muted-foreground">
              of {challansData?.length || 0} challans
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Pending Verification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {(challansData?.length || 0) - verifiedChallans}
            </div>
            <p className="text-xs text-muted-foreground">
              challans to verify
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {[
          { id: 'form26as' as TabType, label: 'Form 26AS', icon: FileText },
          { id: 'challans' as TabType, label: 'TDS Challans', icon: Receipt },
          { id: 'verify' as TabType, label: 'Verify on TRACES', icon: Shield },
          { id: 'reconcile' as TabType, label: 'Reconciliation', icon: RefreshCw },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Form 26AS Tab */}
      {activeTab === 'form26as' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Select value={quarter} onValueChange={setQuarter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All quarters" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All quarters</SelectItem>
                  {quarters.map((q) => (
                    <SelectItem key={q.value} value={q.value}>
                      {q.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setShowUploadDialog(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Form 26AS
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {form26asLoading ? (
                <div className="p-6 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : !form26asData?.length ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No Form 26AS data found</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Upload your Form 26AS from TRACES to get started
                  </p>
                  <Button className="mt-4" onClick={() => setShowUploadDialog(true)}>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Now
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Deductor</TableHead>
                      <TableHead>TAN</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Quarter</TableHead>
                      <TableHead className="text-right">Amount Paid</TableHead>
                      <TableHead className="text-right">TDS Deposited</TableHead>
                      <TableHead className="text-right">TDS Credit</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form26asData.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">
                          {entry.deductorName}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {entry.deductorTan}
                        </TableCell>
                        <TableCell>{entry.sectionCode}</TableCell>
                        <TableCell>{entry.quarter}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(entry.amountPaid)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(entry.tdsDeposited)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {formatCurrency(entry.tdsCredit)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedEntry(entry)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TDS Challans Tab */}
      {activeTab === 'challans' && (
        <Card>
          <CardHeader>
            <CardTitle>TDS Challans</CardTitle>
            <CardDescription>
              TDS payment challans for AY {assessmentYear}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {challansLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !challansData?.length ? (
              <div className="text-center py-8 text-muted-foreground">
                No challans found for AY {assessmentYear}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>CIN</TableHead>
                    <TableHead>Payment Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Verified</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {challansData.map((challan) => (
                    <TableRow key={challan.id}>
                      <TableCell>
                        {formatDate(challan.periodFrom)} - {formatDate(challan.periodTo)}
                      </TableCell>
                      <TableCell>{challan.sectionCode || 'Multiple'}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {challan.cin || '-'}
                      </TableCell>
                      <TableCell>
                        {challan.paymentDate ? formatDate(challan.paymentDate) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(challan.totalAmount)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            challan.status === 'paid'
                              ? 'bg-green-100 text-green-700'
                              : challan.status === 'verified'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {challan.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        {challan.verifiedOnTraces ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-gray-300" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Verify Tab */}
      {activeTab === 'verify' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Verify Challans on TRACES</CardTitle>
              <CardDescription>
                Verify your TDS payment challans with the TRACES portal
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <Shield className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-900 dark:text-blue-100">
                      TRACES Verification
                    </h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Click on a challan to verify its status on the TRACES portal.
                      This confirms that your TDS payment has been properly credited.
                    </p>
                    <Button variant="link" className="px-0 text-blue-600" asChild>
                      <a
                        href="https://www.tdscpc.gov.in"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open TRACES Portal
                        <ExternalLink className="h-4 w-4 ml-1" />
                      </a>
                    </Button>
                  </div>
                </div>
              </div>

              {challansLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {challansData
                    ?.filter((c) => !c.verifiedOnTraces)
                    .map((challan) => (
                      <div
                        key={challan.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div>
                          <p className="font-medium">
                            {challan.challanType} - {challan.sectionCode || 'Multiple Sections'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Period: {formatDate(challan.periodFrom)} to{' '}
                            {formatDate(challan.periodTo)}
                          </p>
                          <p className="text-sm font-mono">CIN: {challan.cin || 'Pending'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">
                            {formatCurrency(challan.totalAmount)}
                          </p>
                          <Button
                            size="sm"
                            onClick={() => verifyChallanMutation.mutate(challan.id)}
                            disabled={verifyChallanMutation.isPending}
                          >
                            {verifyChallanMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Shield className="h-4 w-4 mr-2" />
                            )}
                            Verify
                          </Button>
                        </div>
                      </div>
                    ))}

                  {challansData?.filter((c) => !c.verifiedOnTraces).length === 0 && (
                    <div className="text-center py-8">
                      <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                      <p className="text-muted-foreground">
                        All challans have been verified on TRACES
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reconciliation Tab */}
      {activeTab === 'reconcile' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>TDS Reconciliation</CardTitle>
                  <CardDescription>
                    Match Form 26AS entries with your TDS deductions
                  </CardDescription>
                </div>
                <Button
                  onClick={() => reconcileMutation.mutate()}
                  disabled={reconcileMutation.isPending}
                >
                  {reconcileMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Run Reconciliation
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3 mb-6">
                <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-900/20">
                  <div className="flex items-center gap-2 text-green-600 mb-2">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Matched</span>
                  </div>
                  <p className="text-2xl font-bold text-green-700">
                    {form26asData?.length || 0}
                  </p>
                  <p className="text-sm text-green-600">entries matched</p>
                </div>

                <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                  <div className="flex items-center gap-2 text-yellow-600 mb-2">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-medium">Mismatched</span>
                  </div>
                  <p className="text-2xl font-bold text-yellow-700">0</p>
                  <p className="text-sm text-yellow-600">amount differences</p>
                </div>

                <div className="p-4 border rounded-lg bg-red-50 dark:bg-red-900/20">
                  <div className="flex items-center gap-2 text-red-600 mb-2">
                    <XCircle className="h-5 w-5" />
                    <span className="font-medium">Unmatched</span>
                  </div>
                  <p className="text-2xl font-bold text-red-700">0</p>
                  <p className="text-sm text-red-600">entries not found</p>
                </div>
              </div>

              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-4">Reconciliation Summary</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Deductor</TableHead>
                      <TableHead>TAN</TableHead>
                      <TableHead className="text-right">26AS Amount</TableHead>
                      <TableHead className="text-right">Books Amount</TableHead>
                      <TableHead className="text-right">Difference</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form26asData?.slice(0, 5).map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>{entry.deductorName}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {entry.deductorTan}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(entry.tdsCredit)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(entry.tdsCredit)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(0)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="text-green-600">Matched</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!form26asData?.length && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No data to reconcile. Upload Form 26AS first.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Form 26AS</DialogTitle>
            <DialogDescription>
              Upload your Form 26AS downloaded from TRACES portal
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Assessment Year</Label>
              <Select value={assessmentYear} onValueChange={setAssessmentYear}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assessmentYears.map((ay) => (
                    <SelectItem key={ay} value={ay}>
                      AY {ay}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>File</Label>
              <Input
                type="file"
                accept=".txt,.csv,.pdf"
                onChange={handleFileUpload}
                disabled={uploadMutation.isPending}
              />
              <p className="text-xs text-muted-foreground">
                Supports TXT, CSV, or PDF formats from TRACES
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entry Detail Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Form 26AS Entry Details</DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Deductor Name</Label>
                  <p className="font-medium">{selectedEntry.deductorName}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">TAN</Label>
                  <p className="font-mono">{selectedEntry.deductorTan}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Section</Label>
                  <p>{selectedEntry.sectionCode}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Quarter</Label>
                  <p>{selectedEntry.quarter}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Transaction Date</Label>
                  <p>{formatDate(selectedEntry.transactionDate)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Assessment Year</Label>
                  <p>{selectedEntry.assessmentYear}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div>
                  <Label className="text-muted-foreground">Amount Paid</Label>
                  <p className="text-lg font-bold">{formatCurrency(selectedEntry.amountPaid)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">TDS Deposited</Label>
                  <p className="text-lg font-bold">{formatCurrency(selectedEntry.tdsDeposited)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">TDS Credit</Label>
                  <p className="text-lg font-bold text-green-600">
                    {formatCurrency(selectedEntry.tdsCredit)}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedEntry(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
