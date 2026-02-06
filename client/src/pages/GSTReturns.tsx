import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import {
  Download,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw
} from 'lucide-react';

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

export default function GSTReturns() {
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'));
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [activeTab, setActiveTab] = useState<'gstr1' | 'gstr3b' | 'itc'>('gstr1');

  const returnPeriod = `${selectedMonth}${selectedYear}`;

  const { data: gstConfig } = useQuery({
    queryKey: ['gst-config'],
    queryFn: async () => {
      const response = await fetch('/api/gst/config', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch GST config');
      return response.json();
    },
  });

  const { data: gstr1Data, isLoading: gstr1Loading } = useQuery({
    queryKey: ['gstr1', returnPeriod],
    queryFn: async () => {
      const response = await fetch(`/api/gst/gstr1?period=${returnPeriod}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch GSTR-1 data');
      return response.json();
    },
    enabled: activeTab === 'gstr1',
  });

  const { data: gstr3bData, isLoading: gstr3bLoading } = useQuery({
    queryKey: ['gstr3b', returnPeriod],
    queryFn: async () => {
      const response = await fetch(`/api/gst/gstr3b?period=${returnPeriod}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch GSTR-3B data');
      return response.json();
    },
    enabled: activeTab === 'gstr3b',
  });

  const { data: itcData, isLoading: itcLoading } = useQuery({
    queryKey: ['itc', returnPeriod],
    queryFn: async () => {
      const response = await fetch(`/api/gst/itc?period=${returnPeriod}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch ITC data');
      return response.json();
    },
    enabled: activeTab === 'itc',
  });

  const handleExport = async (type: string) => {
    const response = await fetch(`/api/gst/${type}/export?period=${returnPeriod}`, {
      credentials: 'include',
    });
    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type.toUpperCase()}-${returnPeriod}.xlsx`;
      a.click();
    }
  };

  const isLoading = gstr1Loading || gstr3bLoading || itcLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">GST Returns</h1>
          <p className="text-muted-foreground">
            GSTIN: {gstConfig?.gstin || 'Not configured'}
          </p>
        </div>
      </div>

      {/* Period Selection */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Month</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month, index) => (
                    <SelectItem key={month} value={(index + 1).toString().padStart(2, '0')}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Year</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1" />
            <div className="flex gap-2">
              <Button
                variant={activeTab === 'gstr1' ? 'default' : 'outline'}
                onClick={() => setActiveTab('gstr1')}
              >
                GSTR-1
              </Button>
              <Button
                variant={activeTab === 'gstr3b' ? 'default' : 'outline'}
                onClick={() => setActiveTab('gstr3b')}
              >
                GSTR-3B
              </Button>
              <Button
                variant={activeTab === 'itc' ? 'default' : 'outline'}
                onClick={() => setActiveTab('itc')}
              >
                ITC Register
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      )}

      {/* GSTR-1 Tab */}
      {activeTab === 'gstr1' && !gstr1Loading && (
        <>
          {/* GSTR-1 Summary */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Invoices</p>
                    <p className="text-2xl font-bold">{gstr1Data?.summary?.totalInvoices || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div>
                  <p className="text-sm text-muted-foreground">Taxable Value</p>
                  <p className="text-xl font-bold">{formatCurrency(gstr1Data?.summary?.taxableValue || 0)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div>
                  <p className="text-sm text-muted-foreground">Total Tax</p>
                  <p className="text-xl font-bold">{formatCurrency(gstr1Data?.summary?.totalTax || 0)}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  {gstr1Data?.summary?.status === 'filed' ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <span className="text-green-600 font-medium">Filed</span>
                    </>
                  ) : (
                    <>
                      <Clock className="h-5 w-5 text-yellow-500" />
                      <span className="text-yellow-600 font-medium">Pending</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* GSTR-1 Sections */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>GSTR-1 Details</CardTitle>
                <CardDescription>Outward supplies for the period</CardDescription>
              </div>
              <Button onClick={() => handleExport('gstr1')}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* B2B Invoices */}
                <div>
                  <h3 className="font-semibold mb-3">B2B Invoices (4A, 4B, 4C, 6B, 6C)</h3>
                  <table className="w-full">
                    <thead className="border-b bg-muted/50">
                      <tr>
                        <th className="py-2 pl-4 text-left text-sm font-medium">Invoice No</th>
                        <th className="py-2 text-left text-sm font-medium">Date</th>
                        <th className="py-2 text-left text-sm font-medium">Recipient GSTIN</th>
                        <th className="py-2 text-right text-sm font-medium">Taxable Value</th>
                        <th className="py-2 text-right text-sm font-medium">IGST</th>
                        <th className="py-2 text-right text-sm font-medium">CGST</th>
                        <th className="py-2 pr-4 text-right text-sm font-medium">SGST</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(gstr1Data?.b2b || []).map((invoice: any) => (
                        <tr key={invoice.id} className="border-b hover:bg-muted/50">
                          <td className="py-2 pl-4 font-mono text-sm">{invoice.invoiceNumber}</td>
                          <td className="py-2 text-sm">{invoice.invoiceDate}</td>
                          <td className="py-2 font-mono text-sm">{invoice.partyGstin}</td>
                          <td className="py-2 text-right">{formatCurrency(invoice.taxableValue)}</td>
                          <td className="py-2 text-right">{formatCurrency(invoice.igst)}</td>
                          <td className="py-2 text-right">{formatCurrency(invoice.cgst)}</td>
                          <td className="py-2 pr-4 text-right">{formatCurrency(invoice.sgst)}</td>
                        </tr>
                      ))}
                      {(!gstr1Data?.b2b || gstr1Data.b2b.length === 0) && (
                        <tr>
                          <td colSpan={7} className="py-4 text-center text-muted-foreground">
                            No B2B invoices for this period
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* B2C Large */}
                <div>
                  <h3 className="font-semibold mb-3">B2C Large (5A, 5B)</h3>
                  <table className="w-full">
                    <thead className="border-b bg-muted/50">
                      <tr>
                        <th className="py-2 pl-4 text-left text-sm font-medium">Place of Supply</th>
                        <th className="py-2 text-right text-sm font-medium">Taxable Value</th>
                        <th className="py-2 text-right text-sm font-medium">IGST</th>
                        <th className="py-2 pr-4 text-right text-sm font-medium">Invoice Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(gstr1Data?.b2cLarge || []).map((row: any, index: number) => (
                        <tr key={index} className="border-b hover:bg-muted/50">
                          <td className="py-2 pl-4">{row.placeOfSupply}</td>
                          <td className="py-2 text-right">{formatCurrency(row.taxableValue)}</td>
                          <td className="py-2 text-right">{formatCurrency(row.igst)}</td>
                          <td className="py-2 pr-4 text-right">{row.invoiceCount}</td>
                        </tr>
                      ))}
                      {(!gstr1Data?.b2cLarge || gstr1Data.b2cLarge.length === 0) && (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-muted-foreground">
                            No B2C Large invoices for this period
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* HSN Summary */}
                <div>
                  <h3 className="font-semibold mb-3">HSN Summary (12)</h3>
                  <table className="w-full">
                    <thead className="border-b bg-muted/50">
                      <tr>
                        <th className="py-2 pl-4 text-left text-sm font-medium">HSN/SAC</th>
                        <th className="py-2 text-left text-sm font-medium">Description</th>
                        <th className="py-2 text-right text-sm font-medium">Quantity</th>
                        <th className="py-2 text-right text-sm font-medium">Taxable Value</th>
                        <th className="py-2 text-right text-sm font-medium">Total Tax</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(gstr1Data?.hsnSummary || []).map((row: any) => (
                        <tr key={row.hsnCode} className="border-b hover:bg-muted/50">
                          <td className="py-2 pl-4 font-mono">{row.hsnCode}</td>
                          <td className="py-2">{row.description}</td>
                          <td className="py-2 text-right">{row.quantity}</td>
                          <td className="py-2 text-right">{formatCurrency(row.taxableValue)}</td>
                          <td className="py-2 text-right">{formatCurrency(row.totalTax)}</td>
                        </tr>
                      ))}
                      {(!gstr1Data?.hsnSummary || gstr1Data.hsnSummary.length === 0) && (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-muted-foreground">
                            No HSN summary data
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* GSTR-3B Tab */}
      {activeTab === 'gstr3b' && !gstr3bLoading && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>GSTR-3B Summary</CardTitle>
              <CardDescription>Monthly summary return</CardDescription>
            </div>
            <Button onClick={() => handleExport('gstr3b')}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* 3.1 Outward Supplies */}
              <div>
                <h3 className="font-semibold mb-3">3.1 Details of Outward Supplies and Inward Supplies liable to reverse charge</h3>
                <table className="w-full">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="py-2 pl-4 text-left text-sm font-medium">Nature of Supplies</th>
                      <th className="py-2 text-right text-sm font-medium">Taxable Value</th>
                      <th className="py-2 text-right text-sm font-medium">IGST</th>
                      <th className="py-2 text-right text-sm font-medium">CGST</th>
                      <th className="py-2 pr-4 text-right text-sm font-medium">SGST</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 pl-4">(a) Outward taxable supplies (other than zero rated, nil rated and exempted)</td>
                      <td className="py-2 text-right">{formatCurrency(gstr3bData?.section31?.outwardTaxable?.taxableValue || 0)}</td>
                      <td className="py-2 text-right">{formatCurrency(gstr3bData?.section31?.outwardTaxable?.igst || 0)}</td>
                      <td className="py-2 text-right">{formatCurrency(gstr3bData?.section31?.outwardTaxable?.cgst || 0)}</td>
                      <td className="py-2 pr-4 text-right">{formatCurrency(gstr3bData?.section31?.outwardTaxable?.sgst || 0)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pl-4">(b) Outward taxable supplies (zero rated)</td>
                      <td className="py-2 text-right">{formatCurrency(gstr3bData?.section31?.zeroRated?.taxableValue || 0)}</td>
                      <td className="py-2 text-right">{formatCurrency(gstr3bData?.section31?.zeroRated?.igst || 0)}</td>
                      <td className="py-2 text-right">-</td>
                      <td className="py-2 pr-4 text-right">-</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pl-4">(c) Other outward supplies (Nil rated, exempted)</td>
                      <td className="py-2 text-right">{formatCurrency(gstr3bData?.section31?.exempted?.taxableValue || 0)}</td>
                      <td className="py-2 text-right">-</td>
                      <td className="py-2 text-right">-</td>
                      <td className="py-2 pr-4 text-right">-</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pl-4">(d) Inward supplies (liable to reverse charge)</td>
                      <td className="py-2 text-right">{formatCurrency(gstr3bData?.section31?.reverseCharge?.taxableValue || 0)}</td>
                      <td className="py-2 text-right">{formatCurrency(gstr3bData?.section31?.reverseCharge?.igst || 0)}</td>
                      <td className="py-2 text-right">{formatCurrency(gstr3bData?.section31?.reverseCharge?.cgst || 0)}</td>
                      <td className="py-2 pr-4 text-right">{formatCurrency(gstr3bData?.section31?.reverseCharge?.sgst || 0)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pl-4">(e) Non-GST outward supplies</td>
                      <td className="py-2 text-right">{formatCurrency(gstr3bData?.section31?.nonGst?.taxableValue || 0)}</td>
                      <td className="py-2 text-right">-</td>
                      <td className="py-2 text-right">-</td>
                      <td className="py-2 pr-4 text-right">-</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* 4 Eligible ITC */}
              <div>
                <h3 className="font-semibold mb-3">4. Eligible ITC</h3>
                <table className="w-full">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="py-2 pl-4 text-left text-sm font-medium">Details</th>
                      <th className="py-2 text-right text-sm font-medium">IGST</th>
                      <th className="py-2 text-right text-sm font-medium">CGST</th>
                      <th className="py-2 pr-4 text-right text-sm font-medium">SGST</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 pl-4">(A) ITC Available (whether in full or part)</td>
                      <td className="py-2 text-right">{formatCurrency(gstr3bData?.section4?.itcAvailable?.igst || 0)}</td>
                      <td className="py-2 text-right">{formatCurrency(gstr3bData?.section4?.itcAvailable?.cgst || 0)}</td>
                      <td className="py-2 pr-4 text-right">{formatCurrency(gstr3bData?.section4?.itcAvailable?.sgst || 0)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pl-4">(B) ITC Reversed</td>
                      <td className="py-2 text-right">{formatCurrency(gstr3bData?.section4?.itcReversed?.igst || 0)}</td>
                      <td className="py-2 text-right">{formatCurrency(gstr3bData?.section4?.itcReversed?.cgst || 0)}</td>
                      <td className="py-2 pr-4 text-right">{formatCurrency(gstr3bData?.section4?.itcReversed?.sgst || 0)}</td>
                    </tr>
                    <tr className="border-b bg-muted/30 font-semibold">
                      <td className="py-2 pl-4">(C) Net ITC Available (A) - (B)</td>
                      <td className="py-2 text-right">{formatCurrency(gstr3bData?.section4?.netItc?.igst || 0)}</td>
                      <td className="py-2 text-right">{formatCurrency(gstr3bData?.section4?.netItc?.cgst || 0)}</td>
                      <td className="py-2 pr-4 text-right">{formatCurrency(gstr3bData?.section4?.netItc?.sgst || 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Tax Liability */}
              <div>
                <h3 className="font-semibold mb-3">6.1 Payment of Tax</h3>
                <table className="w-full">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="py-2 pl-4 text-left text-sm font-medium">Description</th>
                      <th className="py-2 text-right text-sm font-medium">Tax Payable</th>
                      <th className="py-2 text-right text-sm font-medium">ITC Utilized</th>
                      <th className="py-2 pr-4 text-right text-sm font-medium">Cash Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 pl-4">IGST</td>
                      <td className="py-2 text-right">{formatCurrency(gstr3bData?.taxPayable?.igst || 0)}</td>
                      <td className="py-2 text-right">{formatCurrency(gstr3bData?.itcUtilized?.igst || 0)}</td>
                      <td className="py-2 pr-4 text-right">{formatCurrency(gstr3bData?.cashPayable?.igst || 0)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pl-4">CGST</td>
                      <td className="py-2 text-right">{formatCurrency(gstr3bData?.taxPayable?.cgst || 0)}</td>
                      <td className="py-2 text-right">{formatCurrency(gstr3bData?.itcUtilized?.cgst || 0)}</td>
                      <td className="py-2 pr-4 text-right">{formatCurrency(gstr3bData?.cashPayable?.cgst || 0)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pl-4">SGST/UTGST</td>
                      <td className="py-2 text-right">{formatCurrency(gstr3bData?.taxPayable?.sgst || 0)}</td>
                      <td className="py-2 text-right">{formatCurrency(gstr3bData?.itcUtilized?.sgst || 0)}</td>
                      <td className="py-2 pr-4 text-right">{formatCurrency(gstr3bData?.cashPayable?.sgst || 0)}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 pl-4">Cess</td>
                      <td className="py-2 text-right">{formatCurrency(gstr3bData?.taxPayable?.cess || 0)}</td>
                      <td className="py-2 text-right">{formatCurrency(gstr3bData?.itcUtilized?.cess || 0)}</td>
                      <td className="py-2 pr-4 text-right">{formatCurrency(gstr3bData?.cashPayable?.cess || 0)}</td>
                    </tr>
                  </tbody>
                  <tfoot className="bg-muted/30">
                    <tr>
                      <td className="py-2 pl-4 font-bold">Total</td>
                      <td className="py-2 text-right font-bold">
                        {formatCurrency(
                          (gstr3bData?.taxPayable?.igst || 0) +
                          (gstr3bData?.taxPayable?.cgst || 0) +
                          (gstr3bData?.taxPayable?.sgst || 0) +
                          (gstr3bData?.taxPayable?.cess || 0)
                        )}
                      </td>
                      <td className="py-2 text-right font-bold">
                        {formatCurrency(
                          (gstr3bData?.itcUtilized?.igst || 0) +
                          (gstr3bData?.itcUtilized?.cgst || 0) +
                          (gstr3bData?.itcUtilized?.sgst || 0) +
                          (gstr3bData?.itcUtilized?.cess || 0)
                        )}
                      </td>
                      <td className="py-2 pr-4 text-right font-bold">
                        {formatCurrency(
                          (gstr3bData?.cashPayable?.igst || 0) +
                          (gstr3bData?.cashPayable?.cgst || 0) +
                          (gstr3bData?.cashPayable?.sgst || 0) +
                          (gstr3bData?.cashPayable?.cess || 0)
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ITC Register Tab */}
      {activeTab === 'itc' && !itcLoading && (
        <>
          {/* ITC Summary */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <ArrowDownRight className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total ITC Available</p>
                    <p className="text-xl font-bold text-green-600">
                      {formatCurrency(itcData?.summary?.totalAvailable || 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Matched (2A/2B)</p>
                    <p className="text-xl font-bold text-blue-600">
                      {formatCurrency(itcData?.summary?.matched || 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Mismatched</p>
                    <p className="text-xl font-bold text-yellow-600">
                      {formatCurrency(itcData?.summary?.mismatched || 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <ArrowUpRight className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Reversed</p>
                    <p className="text-xl font-bold text-red-600">
                      {formatCurrency(itcData?.summary?.reversed || 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>ITC Register</CardTitle>
                <CardDescription>Input Tax Credit details with 2A/2B reconciliation status</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => {}}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reconcile
                </Button>
                <Button onClick={() => handleExport('itc')}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="py-2 pl-4 text-left text-sm font-medium">Vendor GSTIN</th>
                    <th className="py-2 text-left text-sm font-medium">Invoice No</th>
                    <th className="py-2 text-left text-sm font-medium">Date</th>
                    <th className="py-2 text-right text-sm font-medium">Taxable Value</th>
                    <th className="py-2 text-right text-sm font-medium">Total ITC</th>
                    <th className="py-2 text-center text-sm font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(itcData?.entries || []).map((entry: any) => (
                    <tr key={entry.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 pl-4">
                        <div>
                          <p className="font-mono text-sm">{entry.vendorGstin}</p>
                          <p className="text-xs text-muted-foreground">{entry.vendorName}</p>
                        </div>
                      </td>
                      <td className="py-2 font-mono text-sm">{entry.invoiceNumber}</td>
                      <td className="py-2 text-sm">{entry.invoiceDate}</td>
                      <td className="py-2 text-right">{formatCurrency(entry.taxableValue)}</td>
                      <td className="py-2 text-right font-medium">
                        {formatCurrency(entry.igst + entry.cgst + entry.sgst)}
                      </td>
                      <td className="py-2 text-center">
                        <span className={cn(
                          'px-2 py-1 rounded-full text-xs font-medium',
                          entry.reconciliationStatus === 'matched' && 'bg-green-100 text-green-700',
                          entry.reconciliationStatus === 'mismatch' && 'bg-yellow-100 text-yellow-700',
                          entry.reconciliationStatus === 'not_in_2a' && 'bg-red-100 text-red-700'
                        )}>
                          {entry.reconciliationStatus === 'matched' && 'Matched'}
                          {entry.reconciliationStatus === 'mismatch' && 'Mismatch'}
                          {entry.reconciliationStatus === 'not_in_2a' && 'Not in 2A'}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {(!itcData?.entries || itcData.entries.length === 0) && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        No ITC entries for this period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
