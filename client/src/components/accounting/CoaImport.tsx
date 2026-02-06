import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/useToast';
import {
  FileSpreadsheet,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Download,
} from 'lucide-react';

interface CoaImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ValidationResult {
  totalRows: number;
  validRows: number;
  errorCount: number;
  warningCount: number;
  errors: { row: number; field: string; message: string }[];
  warnings: { row: number; field: string; message: string }[];
  preview: any[];
}

type ImportStep = 'upload' | 'validate' | 'preview' | 'importing' | 'complete';

export default function CoaImport({ open, onOpenChange }: CoaImportProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<ImportStep>('upload');
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [importResult, setImportResult] = useState<any>(null);

  // Parse CSV data
  const parseCSV = (text: string): any[] => {
    const lines = text.split('\n').filter((line) => line.trim());
    if (lines.length < 2) return [];

    // Parse header
    const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));

    // Map headers to expected field names
    const headerMap: Record<string, string> = {
      'account code': 'code',
      'code': 'code',
      'account name': 'name',
      'name': 'name',
      'account type': 'accountType',
      'type': 'accountType',
      'parent code': 'parentCode',
      'parent': 'parentCode',
      'description': 'description',
      'opening balance': 'openingBalance',
      'balance': 'openingBalance',
      'balance type': 'openingBalanceType',
      'dr/cr': 'openingBalanceType',
      'gst applicable': 'gstApplicable',
      'gst': 'gstApplicable',
      'default gst rate': 'defaultGstRate',
      'gst rate': 'defaultGstRate',
      'hsn/sac code': 'hsnSacCode',
      'hsn': 'hsnSacCode',
      'sac': 'hsnSacCode',
    };

    const mappedHeaders = headers.map((h) => {
      const normalized = h.toLowerCase().trim();
      return headerMap[normalized] || h;
    });

    // Parse data rows
    return lines.slice(1).map((line) => {
      const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
      const row: Record<string, any> = {};

      mappedHeaders.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      return row;
    });
  };

  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const data = parseCSV(text);
      if (data.length === 0) {
        toast({
          title: 'Invalid file',
          description: 'Could not parse the CSV file. Please check the format.',
          variant: 'destructive',
        });
        return;
      }
      setParsedData(data);
      setStep('validate');
    };
    reader.readAsText(file);
  }, [toast]);

  // Validate mutation
  const validateMutation = useMutation({
    mutationFn: async (data: any[]) => {
      const response = await fetch('/api/coa-import/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ data }),
      });
      if (!response.ok) throw new Error('Validation failed');
      return response.json();
    },
    onSuccess: (result) => {
      setValidationResult(result);
      setStep('preview');
    },
    onError: () => {
      toast({
        title: 'Validation failed',
        description: 'Could not validate the import data.',
        variant: 'destructive',
      });
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (data: any[]) => {
      const response = await fetch('/api/coa-import/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ data, skipExisting: true }),
      });
      if (!response.ok) throw new Error('Import failed');
      return response.json();
    },
    onSuccess: (result) => {
      setImportResult(result);
      setStep('complete');
      queryClient.invalidateQueries({ queryKey: ['chart-of-accounts'] });
    },
    onError: () => {
      toast({
        title: 'Import failed',
        description: 'Could not import the accounts. Please try again.',
        variant: 'destructive',
      });
      setStep('preview');
    },
  });

  const handleValidate = () => {
    validateMutation.mutate(parsedData);
  };

  const handleImport = () => {
    setStep('importing');
    importMutation.mutate(parsedData);
  };

  const handleClose = () => {
    setStep('upload');
    setParsedData([]);
    setValidationResult(null);
    setImportResult(null);
    onOpenChange(false);
  };

  const downloadTemplate = async () => {
    try {
      const response = await fetch('/api/coa-import/template', {
        credentials: 'include',
      });
      const template = await response.json();

      // Convert to CSV
      const headers = template.columns.map((c: any) => c.header);
      const rows = template.sampleData.map((row: any) =>
        template.columns.map((c: any) => row[c.key] || '')
      );

      const csv = [
        headers.join(','),
        ...rows.map((row: any[]) => row.map((v) => `"${v}"`).join(',')),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'coa-import-template.csv';
      a.click();
    } catch {
      toast({
        title: 'Download failed',
        description: 'Could not download the template.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Chart of Accounts</DialogTitle>
          <DialogDescription>
            Upload a CSV file with your chart of accounts data
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6">
          {['Upload', 'Validate', 'Preview', 'Import'].map((label, index) => {
            const steps: ImportStep[] = ['upload', 'validate', 'preview', 'importing'];
            const isActive = steps.indexOf(step) >= index;
            const isComplete = steps.indexOf(step) > index || step === 'complete';

            return (
              <div key={label} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    isComplete
                      ? 'bg-green-500 text-white'
                      : isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isComplete ? <CheckCircle className="h-5 w-5" /> : index + 1}
                </div>
                <span className="ml-2 text-sm">{label}</span>
                {index < 3 && (
                  <div
                    className={`w-12 h-0.5 mx-2 ${
                      isComplete ? 'bg-green-500' : 'bg-muted'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Upload Step */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium mb-2">Upload CSV File</p>
              <p className="text-sm text-muted-foreground mb-4">
                Drag and drop or click to select a CSV file
              </p>
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="max-w-xs mx-auto"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Need a template?</p>
                <p className="text-sm text-muted-foreground">
                  Download our sample CSV template
                </p>
              </div>
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="h-4 w-4 mr-2" />
                Download Template
              </Button>
            </div>
          </div>
        )}

        {/* Validate Step */}
        {step === 'validate' && (
          <div className="space-y-4 text-center">
            <p className="text-lg">
              Found <strong>{parsedData.length}</strong> accounts to validate
            </p>
            <Button onClick={handleValidate} disabled={validateMutation.isPending}>
              {validateMutation.isPending ? 'Validating...' : 'Validate Data'}
            </Button>
          </div>
        )}

        {/* Preview Step */}
        {step === 'preview' && validationResult && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-500 mb-2" />
                <p className="text-2xl font-bold">{validationResult.validRows}</p>
                <p className="text-sm text-muted-foreground">Valid Accounts</p>
              </div>
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-500 mb-2" />
                <p className="text-2xl font-bold">{validationResult.errorCount}</p>
                <p className="text-sm text-muted-foreground">Errors</p>
              </div>
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-500 mb-2" />
                <p className="text-2xl font-bold">{validationResult.warningCount}</p>
                <p className="text-sm text-muted-foreground">Warnings</p>
              </div>
            </div>

            {/* Errors */}
            {validationResult.errors.length > 0 && (
              <div className="border border-red-200 rounded-lg p-4">
                <h4 className="font-medium text-red-600 mb-2">Errors (must fix)</h4>
                <ul className="text-sm space-y-1">
                  {validationResult.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>
                      Row {err.row}: {err.message}
                    </li>
                  ))}
                  {validationResult.errors.length > 5 && (
                    <li className="text-muted-foreground">
                      ...and {validationResult.errors.length - 5} more errors
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {validationResult.warnings.length > 0 && (
              <div className="border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-yellow-600 mb-2">Warnings</h4>
                <ul className="text-sm space-y-1">
                  {validationResult.warnings.slice(0, 5).map((warn, i) => (
                    <li key={i}>
                      Row {warn.row}: {warn.message}
                    </li>
                  ))}
                  {validationResult.warnings.length > 5 && (
                    <li className="text-muted-foreground">
                      ...and {validationResult.warnings.length - 5} more warnings
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Preview Table */}
            {validationResult.preview.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Preview (first 10 rows)</h4>
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Parent</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validationResult.preview.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono">{row.code}</TableCell>
                          <TableCell>{row.name}</TableCell>
                          <TableCell className="capitalize">{row.accountType}</TableCell>
                          <TableCell className="font-mono">
                            {row.parentCode || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Importing Step */}
        {step === 'importing' && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-lg">Importing accounts...</p>
            <p className="text-sm text-muted-foreground">Please wait</p>
          </div>
        )}

        {/* Complete Step */}
        {step === 'complete' && importResult && (
          <div className="text-center py-8">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <p className="text-xl font-medium mb-4">Import Complete!</p>
            <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{importResult.imported}</p>
                <p className="text-xs text-muted-foreground">Imported</p>
              </div>
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <p className="text-2xl font-bold text-yellow-600">{importResult.skipped}</p>
                <p className="text-xs text-muted-foreground">Skipped</p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{importResult.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}

          {step === 'validate' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>
                Start Over
              </Button>
              <Button
                onClick={handleImport}
                disabled={
                  validationResult?.errorCount !== 0 ||
                  validationResult?.validRows === 0
                }
              >
                Import {validationResult?.validRows} Accounts
              </Button>
            </>
          )}

          {step === 'complete' && (
            <Button onClick={handleClose}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
