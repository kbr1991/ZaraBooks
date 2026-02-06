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
import { toast } from '@/hooks/useToast';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Download,
  Plus,
  Search,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  Receipt,
  CreditCard
} from 'lucide-react';

const currentYear = new Date().getFullYear();
const assessmentYears = Array.from({ length: 3 }, (_, i) => {
  const startYear = currentYear - i;
  return `${startYear}-${(startYear + 1).toString().slice(2)}`;
});

const quarters = [
  { value: 'Q1', label: 'Q1 (Apr-Jun)' },
  { value: 'Q2', label: 'Q2 (Jul-Sep)' },
  { value: 'Q3', label: 'Q3 (Oct-Dec)' },
  { value: 'Q4', label: 'Q4 (Jan-Mar)' },
];

export default function TDSRegister() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [assessmentYear, setAssessmentYear] = useState(assessmentYears[0]);
  const [quarter, setQuarter] = useState('Q1');
  const [activeTab, setActiveTab] = useState<'deductions' | 'challans' | '26as'>('deductions');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    deducteePan: '',
    deducteeName: '',
    sectionCode: '194J',
    transactionDate: new Date().toISOString().split('T')[0],
    baseAmount: '',
    tdsRate: '10',
    invoiceReference: '',
  });

  const { data: tdsSections } = useQuery({
    queryKey: ['tds-sections'],
    queryFn: async () => {
      const response = await fetch('/api/tds/sections', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch TDS sections');
      return response.json();
    },
  });

  const { data: deductionsData, isLoading: deductionsLoading } = useQuery({
    queryKey: ['tds-deductions', assessmentYear, quarter],
    queryFn: async () => {
      const params = new URLSearchParams({ assessmentYear, quarter });
      const response = await fetch(`/api/tds/deductions?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch TDS deductions');
      return response.json();
    },
    enabled: activeTab === 'deductions',
  });

  const { data: challansData, isLoading: challansLoading } = useQuery({
    queryKey: ['tds-challans', assessmentYear, quarter],
    queryFn: async () => {
      const params = new URLSearchParams({ assessmentYear, quarter });
      const response = await fetch(`/api/tds/challans?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch TDS challans');
      return response.json();
    },
    enabled: activeTab === 'challans',
  });

  const { data: form26asData, isLoading: form26asLoading } = useQuery({
    queryKey: ['form-26as', assessmentYear],
    queryFn: async () => {
      const params = new URLSearchParams({ assessmentYear });
      const response = await fetch(`/api/tds/form-26as?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch Form 26AS');
      return response.json();
    },
    enabled: activeTab === '26as',
  });

  const createDeductionMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const tdsAmount = (parseFloat(data.baseAmount) * parseFloat(data.tdsRate)) / 100;
      const response = await fetch('/api/tds/deductions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...data,
          baseAmount: parseFloat(data.baseAmount),
          tdsRate: parseFloat(data.tdsRate),
          tdsAmount,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create deduction');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tds-deductions'] });
      toast({ title: 'TDS deduction recorded successfully!' });
      setShowForm(false);
      setFormData({
        deducteePan: '',
        deducteeName: '',
        sectionCode: '194J',
        transactionDate: new Date().toISOString().split('T')[0],
        baseAmount: '',
        tdsRate: '10',
        invoiceReference: '',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to record deduction',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleExport = async (type: string) => {
    const params = new URLSearchParams({ assessmentYear, quarter });
    const response = await fetch(`/api/tds/${type}/export?${params}`, {
      credentials: 'include',
    });
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tds-${type}-${assessmentYear}-${quarter}.xlsx`;
      a.click();
    }
  };

  const isLoading = deductionsLoading || challansLoading || form26asLoading;
  const deductions = deductionsData?.deductions || [];
  const challans = challansData?.challans || [];
  const form26as = form26asData?.entries || [];

  const filteredDeductions = deductions.filter((d: any) =>
    !searchTerm ||
    d.deducteePan?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.deducteeName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const summary = {
    totalDeductions: deductions.reduce((sum: number, d: any) => sum + (d.tdsAmount || 0), 0),
    pendingDeposit: deductions.filter((d: any) => !d.challanId).reduce((sum: number, d: any) => sum + (d.tdsAmount || 0), 0),
    deposited: challans.reduce((sum: number, c: any) => sum + (c.amount || 0), 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">TDS Register</h1>
          <p className="text-muted-foreground">Tax Deducted at Source management</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Record TDS
        </Button>
      </div>

      {/* Period Selection */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Assessment Year</label>
              <Select value={assessmentYear} onValueChange={setAssessmentYear}>
                <SelectTrigger className="w-[150px]">
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
              <label className="text-sm font-medium">Quarter</label>
              <Select value={quarter} onValueChange={setQuarter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {quarters.map((q) => (
                    <SelectItem key={q.value} value={q.value}>
                      {q.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1" />
            <div className="flex gap-2">
              <Button
                variant={activeTab === 'deductions' ? 'default' : 'outline'}
                onClick={() => setActiveTab('deductions')}
              >
                Deductions
              </Button>
              <Button
                variant={activeTab === 'challans' ? 'default' : 'outline'}
                onClick={() => setActiveTab('challans')}
              >
                Challans
              </Button>
              <Button
                variant={activeTab === '26as' ? 'default' : 'outline'}
                onClick={() => setActiveTab('26as')}
              >
                Form 26AS
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total TDS Deducted</p>
                <p className="text-xl font-bold">{formatCurrency(summary.totalDeductions)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100 text-yellow-600">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Deposit</p>
                <p className="text-xl font-bold text-yellow-600">{formatCurrency(summary.pendingDeposit)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Deposited</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(summary.deposited)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 text-purple-600">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Challans Filed</p>
                <p className="text-xl font-bold">{challans.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add TDS Form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Record TDS Deduction</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createDeductionMutation.mutate(formData);
              }}
              className="space-y-4"
            >
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="deducteePan">Deductee PAN *</Label>
                  <Input
                    id="deducteePan"
                    value={formData.deducteePan}
                    onChange={(e) => setFormData({ ...formData, deducteePan: e.target.value.toUpperCase() })}
                    maxLength={10}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deducteeName">Deductee Name *</Label>
                  <Input
                    id="deducteeName"
                    value={formData.deducteeName}
                    onChange={(e) => setFormData({ ...formData, deducteeName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sectionCode">Section *</Label>
                  <Select
                    value={formData.sectionCode}
                    onValueChange={(value) => {
                      const section = tdsSections?.find((s: any) => s.sectionCode === value);
                      setFormData({
                        ...formData,
                        sectionCode: value,
                        tdsRate: section?.defaultRateIndividual?.toString() || '10',
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tdsSections?.map((section: any) => (
                        <SelectItem key={section.sectionCode} value={section.sectionCode}>
                          {section.sectionCode} - {section.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transactionDate">Transaction Date *</Label>
                  <Input
                    id="transactionDate"
                    type="date"
                    value={formData.transactionDate}
                    onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="baseAmount">Base Amount *</Label>
                  <Input
                    id="baseAmount"
                    type="number"
                    value={formData.baseAmount}
                    onChange={(e) => setFormData({ ...formData, baseAmount: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tdsRate">TDS Rate (%) *</Label>
                  <Input
                    id="tdsRate"
                    type="number"
                    step="0.01"
                    value={formData.tdsRate}
                    onChange={(e) => setFormData({ ...formData, tdsRate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invoiceReference">Invoice Reference</Label>
                  <Input
                    id="invoiceReference"
                    value={formData.invoiceReference}
                    onChange={(e) => setFormData({ ...formData, invoiceReference: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>TDS Amount</Label>
                  <div className="h-10 px-3 py-2 border rounded-md bg-muted/50 flex items-center font-medium">
                    {formData.baseAmount && formData.tdsRate
                      ? formatCurrency((parseFloat(formData.baseAmount) * parseFloat(formData.tdsRate)) / 100)
                      : '-'}
                  </div>
                </div>
              </div>
              <div className="flex gap-4">
                <Button type="submit" disabled={createDeductionMutation.isPending}>
                  {createDeductionMutation.isPending ? 'Recording...' : 'Record Deduction'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      )}

      {/* Deductions Tab */}
      {activeTab === 'deductions' && !deductionsLoading && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>TDS Deductions</CardTitle>
              <CardDescription>Tax deducted from payments</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-[200px]"
                />
              </div>
              <Button onClick={() => handleExport('deductions')}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="py-2 pl-4 text-left text-sm font-medium">Deductee PAN</th>
                  <th className="py-2 text-left text-sm font-medium">Name</th>
                  <th className="py-2 text-left text-sm font-medium">Section</th>
                  <th className="py-2 text-left text-sm font-medium">Date</th>
                  <th className="py-2 text-right text-sm font-medium">Base Amount</th>
                  <th className="py-2 text-right text-sm font-medium">TDS Amount</th>
                  <th className="py-2 text-center text-sm font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeductions.map((deduction: any) => (
                  <tr key={deduction.id} className="border-b hover:bg-muted/50">
                    <td className="py-2 pl-4 font-mono text-sm">{deduction.deducteePan}</td>
                    <td className="py-2">{deduction.deducteeName}</td>
                    <td className="py-2">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        {deduction.sectionCode}
                      </span>
                    </td>
                    <td className="py-2 text-sm">{formatDate(deduction.transactionDate)}</td>
                    <td className="py-2 text-right">{formatCurrency(deduction.baseAmount)}</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(deduction.tdsAmount)}</td>
                    <td className="py-2 text-center">
                      {deduction.challanId ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          Deposited
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                          Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredDeductions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      No TDS deductions for this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Challans Tab */}
      {activeTab === 'challans' && !challansLoading && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>TDS Challans</CardTitle>
              <CardDescription>Tax payment challans</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Add Challan
              </Button>
              <Button onClick={() => handleExport('challans')}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="py-2 pl-4 text-left text-sm font-medium">BSR Code</th>
                  <th className="py-2 text-left text-sm font-medium">Challan Serial</th>
                  <th className="py-2 text-left text-sm font-medium">Section</th>
                  <th className="py-2 text-left text-sm font-medium">Payment Date</th>
                  <th className="py-2 text-right text-sm font-medium">Amount</th>
                  <th className="py-2 text-left text-sm font-medium">CIN</th>
                  <th className="py-2 text-center text-sm font-medium">Verified</th>
                </tr>
              </thead>
              <tbody>
                {challans.map((challan: any) => (
                  <tr key={challan.id} className="border-b hover:bg-muted/50">
                    <td className="py-2 pl-4 font-mono text-sm">{challan.bsrCode}</td>
                    <td className="py-2 font-mono text-sm">{challan.challanSerial}</td>
                    <td className="py-2">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        {challan.sectionCode}
                      </span>
                    </td>
                    <td className="py-2 text-sm">{formatDate(challan.paymentDate)}</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(challan.amount)}</td>
                    <td className="py-2 font-mono text-xs">{challan.cin || '-'}</td>
                    <td className="py-2 text-center">
                      {challan.verifiedOnTraces ? (
                        <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-yellow-500 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
                {challans.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      No challans for this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Form 26AS Tab */}
      {activeTab === '26as' && !form26asLoading && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Form 26AS</CardTitle>
              <CardDescription>Tax Credit Statement - TDS Receivable</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                <CreditCard className="h-4 w-4 mr-2" />
                Download from TRACES
              </Button>
              <Button onClick={() => handleExport('form-26as')}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="py-2 pl-4 text-left text-sm font-medium">Deductor TAN</th>
                  <th className="py-2 text-left text-sm font-medium">Deductor Name</th>
                  <th className="py-2 text-left text-sm font-medium">Section</th>
                  <th className="py-2 text-left text-sm font-medium">Date</th>
                  <th className="py-2 text-right text-sm font-medium">Amount Paid</th>
                  <th className="py-2 text-right text-sm font-medium">TDS Deposited</th>
                  <th className="py-2 text-center text-sm font-medium">Matched</th>
                </tr>
              </thead>
              <tbody>
                {form26as.map((entry: any) => (
                  <tr key={entry.id} className="border-b hover:bg-muted/50">
                    <td className="py-2 pl-4 font-mono text-sm">{entry.deductorTan}</td>
                    <td className="py-2">{entry.deductorName}</td>
                    <td className="py-2">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        {entry.sectionCode}
                      </span>
                    </td>
                    <td className="py-2 text-sm">{formatDate(entry.transactionDate)}</td>
                    <td className="py-2 text-right">{formatCurrency(entry.amountPaid)}</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(entry.tdsDeposited)}</td>
                    <td className="py-2 text-center">
                      {entry.matchedTdsReceiptId ? (
                        <CheckCircle className="h-5 w-5 text-green-500 mx-auto" />
                      ) : (
                        <span className="text-xs text-muted-foreground">Not matched</span>
                      )}
                    </td>
                  </tr>
                ))}
                {form26as.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      No Form 26AS entries. Download from TRACES to view.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
