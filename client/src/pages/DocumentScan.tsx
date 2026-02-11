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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/utils';
import {
  Upload,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
  Wand2,
  Receipt,
  FileImage,
  Loader2,
  Search,
  AlertCircle,
} from 'lucide-react';

interface DocumentScan {
  id: string;
  documentType: 'invoice' | 'bill' | 'receipt' | 'expense';
  fileUrl: string;
  fileName?: string;
  mimeType?: string;
  source: 'upload' | 'camera' | 'email';
  ocrStatus: 'pending' | 'processing' | 'completed' | 'failed';
  ocrConfidence?: string;
  extractedData?: {
    vendorName?: string;
    vendorGstin?: string;
    invoiceNumber?: string;
    date?: string;
    totalAmount?: number;
    taxAmount?: number;
    items?: Array<{
      description: string;
      quantity: number;
      rate: number;
      amount: number;
    }>;
  };
  languageDetected?: string;
  needsReview: boolean;
  createdAt: string;
  createdExpenseId?: string;
  createdBillId?: string;
}

interface DocumentStats {
  totalScanned: number;
  pendingReview: number;
  processed: number;
  failed: number;
}

export default function DocumentScan() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<DocumentScan | null>(null);
  const [uploadType, setUploadType] = useState<string>('receipt');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string>('');

  // Fetch stats
  const { data: stats } = useQuery<DocumentStats>({
    queryKey: ['/api/document-scan/stats'],
  });

  // Fetch documents
  const { data: documents, isLoading } = useQuery<DocumentScan[]>({
    queryKey: ['/api/document-scan', { status: statusFilter, type: typeFilter, needsReview: statusFilter === 'review' }],
  });

  // Fetch vendors for creating bills
  const { data: vendors } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['/api/parties', { partyType: 'vendor' }],
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (data: { fileUrl: string; fileName: string; mimeType: string; documentType: string }) => {
      const res = await fetch('/api/document-scan/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/document-scan'] });
      toast({ title: 'Document uploaded successfully' });
      setShowUploadDialog(false);
      setUploadFile(null);
      setUploadPreview('');
    },
    onError: (error: Error) => {
      toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
    },
  });

  // Process OCR mutation
  const processMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/document-scan/${id}/process`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/document-scan'] });
      toast({ title: 'Document processed' });
    },
    onError: (error: Error) => {
      toast({ title: 'Processing failed', description: error.message, variant: 'destructive' });
    },
  });

  // Create expense mutation
  const createExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/document-scan/${id}/create-expense`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/document-scan'] });
      toast({ title: 'Expense created successfully' });
      setShowReviewDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create expense', description: error.message, variant: 'destructive' });
    },
  });

  // Create bill mutation
  const createBillMutation = useMutation({
    mutationFn: async ({ id, vendorId }: { id: string; vendorId: string }) => {
      const res = await fetch(`/api/document-scan/${id}/create-bill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ vendorId }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/document-scan'] });
      toast({ title: 'Bill created successfully' });
      setShowReviewDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create bill', description: error.message, variant: 'destructive' });
    },
  });

  const filteredDocuments = documents?.filter((doc) => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!doc.fileName?.toLowerCase().includes(search) &&
          !doc.extractedData?.vendorName?.toLowerCase().includes(search)) {
        return false;
      }
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-orange-600"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'processing':
        return <Badge variant="outline" className="text-blue-600"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processing</Badge>;
      case 'completed':
        return <Badge variant="outline" className="text-green-600"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'failed':
        return <Badge variant="outline" className="text-red-600"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'invoice':
        return <Badge>Invoice</Badge>;
      case 'bill':
        return <Badge variant="secondary">Bill</Badge>;
      case 'receipt':
        return <Badge variant="outline">Receipt</Badge>;
      case 'expense':
        return <Badge variant="outline">Expense</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Document Scanner</h1>
          <p className="text-gray-500">Scan receipts and bills to create entries automatically</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowUploadDialog(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Upload Document
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Scanned</CardTitle>
            <FileImage className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalScanned || 0}</div>
            <p className="text-xs text-muted-foreground">Documents processed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.pendingReview || 0}</div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entries Created</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.processed || 0}</div>
            <p className="text-xs text-muted-foreground">Converted to entries</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.failed || 0}</div>
            <p className="text-xs text-muted-foreground">OCR failed</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search documents..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="review">Needs Review</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Document Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="invoice">Invoice</SelectItem>
                <SelectItem value="bill">Bill</SelectItem>
                <SelectItem value="receipt">Receipt</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Documents Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          [...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-40 w-full mb-4" />
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))
        ) : filteredDocuments?.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-12 text-center">
              <FileImage className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No documents found</p>
              <p className="text-muted-foreground mb-4">Upload your first receipt or bill to get started</p>
              <Button onClick={() => setShowUploadDialog(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Upload Document
              </Button>
            </CardContent>
          </Card>
        ) : (
          filteredDocuments?.map((doc) => (
            <Card key={doc.id} className="cursor-pointer hover:border-primary transition-colors">
              <CardContent className="pt-6" onClick={() => {
                setSelectedDocument(doc);
                setShowReviewDialog(true);
              }}>
                <div className="aspect-video bg-muted rounded-md mb-4 flex items-center justify-center">
                  {doc.fileUrl ? (
                    <img
                      src={doc.fileUrl}
                      alt={doc.fileName}
                      className="max-h-full max-w-full object-contain rounded-md"
                    />
                  ) : (
                    <FileImage className="w-16 h-16 text-muted-foreground" />
                  )}
                </div>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium truncate">{doc.fileName || 'Untitled Document'}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {getTypeBadge(doc.documentType)}
                </div>
                <div className="flex justify-between items-center">
                  {getStatusBadge(doc.ocrStatus)}
                  {doc.extractedData?.totalAmount && (
                    <span className="font-semibold">
                      {formatCurrency(doc.extractedData.totalAmount)}
                    </span>
                  )}
                </div>
                {doc.needsReview && doc.ocrStatus === 'completed' && (
                  <div className="mt-2 p-2 bg-orange-50 rounded text-sm text-orange-700">
                    Needs review before creating entry
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload a receipt, bill, or invoice to scan and extract data
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Document Type</Label>
              <Select value={uploadType} onValueChange={setUploadType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receipt">Receipt</SelectItem>
                  <SelectItem value="bill">Bill</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="expense">Expense Voucher</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Upload Image or PDF</Label>
              <div className="mt-2">
                <Input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileSelect}
                />
              </div>
              {uploadPreview && (
                <div className="mt-4 border rounded-lg p-2">
                  <img
                    src={uploadPreview}
                    alt="Preview"
                    className="max-h-48 mx-auto object-contain"
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (uploadFile) {
                  // In production, upload to cloud storage first
                  uploadMutation.mutate({
                    fileUrl: uploadPreview,
                    fileName: uploadFile.name,
                    mimeType: uploadFile.type,
                    documentType: uploadType,
                  });
                }
              }}
              disabled={!uploadFile || uploadMutation.isPending}
            >
              {uploadMutation.isPending ? 'Uploading...' : 'Upload & Scan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Review Document</DialogTitle>
            <DialogDescription>
              Review extracted data and create an entry
            </DialogDescription>
          </DialogHeader>
          {selectedDocument && (
            <div className="grid grid-cols-2 gap-4">
              <div className="border rounded-lg p-2">
                {selectedDocument.fileUrl ? (
                  <img
                    src={selectedDocument.fileUrl}
                    alt={selectedDocument.fileName}
                    className="max-h-96 mx-auto object-contain"
                  />
                ) : (
                  <div className="h-96 flex items-center justify-center bg-muted">
                    <FileImage className="w-16 h-16 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  {getStatusBadge(selectedDocument.ocrStatus)}
                  {selectedDocument.ocrConfidence && (
                    <span className="text-sm text-muted-foreground">
                      Confidence: {parseFloat(selectedDocument.ocrConfidence).toFixed(0)}%
                    </span>
                  )}
                </div>

                {selectedDocument.extractedData ? (
                  <div className="space-y-3">
                    <div>
                      <Label>Vendor Name</Label>
                      <Input
                        value={selectedDocument.extractedData.vendorName || ''}
                        readOnly
                      />
                    </div>
                    {selectedDocument.extractedData.vendorGstin && (
                      <div>
                        <Label>GSTIN</Label>
                        <Input value={selectedDocument.extractedData.vendorGstin} readOnly />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Invoice/Bill Number</Label>
                        <Input
                          value={selectedDocument.extractedData.invoiceNumber || ''}
                          readOnly
                        />
                      </div>
                      <div>
                        <Label>Date</Label>
                        <Input value={selectedDocument.extractedData.date || ''} readOnly />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Total Amount</Label>
                        <Input
                          value={formatCurrency(selectedDocument.extractedData.totalAmount || 0)}
                          readOnly
                        />
                      </div>
                      <div>
                        <Label>Tax Amount</Label>
                        <Input
                          value={formatCurrency(selectedDocument.extractedData.taxAmount || 0)}
                          readOnly
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {selectedDocument.ocrStatus === 'pending' ? (
                      <>
                        <Clock className="w-8 h-8 mx-auto mb-2" />
                        <p>Document not yet processed</p>
                        <Button
                          className="mt-4"
                          onClick={() => processMutation.mutate(selectedDocument.id)}
                          disabled={processMutation.isPending}
                        >
                          <Wand2 className="w-4 h-4 mr-2" />
                          Process Now
                        </Button>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-8 h-8 mx-auto mb-2" />
                        <p>Failed to extract data</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReviewDialog(false)}>
              Cancel
            </Button>
            {selectedDocument?.extractedData && !selectedDocument.createdExpenseId && !selectedDocument.createdBillId && (
              <>
                <Button
                  variant="outline"
                  onClick={() => createExpenseMutation.mutate(selectedDocument.id)}
                  disabled={createExpenseMutation.isPending}
                >
                  <Receipt className="w-4 h-4 mr-2" />
                  Create Expense
                </Button>
                <Button
                  onClick={() => createBillMutation.mutate({
                    id: selectedDocument.id,
                    vendorId: vendors?.[0]?.id || ''
                  })}
                  disabled={createBillMutation.isPending || !vendors?.length}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Create Bill
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
