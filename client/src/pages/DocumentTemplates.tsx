import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  FileText,
  Edit,
  Trash2,
  Eye,
  Star,
  Code,
  Palette,
  Copy,
} from 'lucide-react';

interface DocumentTemplate {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  templateType: 'invoice' | 'quote' | 'sales_order' | 'all';
  htmlContent: string;
  cssContent: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  createdBy?: {
    firstName: string;
    lastName: string;
  };
}

const SAMPLE_TEMPLATE = `<div class="invoice-container">
  <div class="header">
    <h1>{{documentType}}</h1>
    <div class="document-info">
      <p><strong>Number:</strong> {{documentNumber}}</p>
      <p><strong>Date:</strong> {{documentDate}}</p>
      <p><strong>Due Date:</strong> {{dueDate}}</p>
    </div>
  </div>

  <div class="parties">
    <div class="from">
      <h3>From</h3>
      <p><strong>{{company.name}}</strong></p>
      <p>{{company.address}}</p>
      <p>{{company.city}}, {{company.state}} - {{company.pincode}}</p>
      <p>GSTIN: {{company.gstin}}</p>
    </div>
    <div class="to">
      <h3>Bill To</h3>
      <p><strong>{{customer.name}}</strong></p>
      <p>{{customer.address}}</p>
      <p>{{customer.city}}, {{customer.state}} - {{customer.pincode}}</p>
      <p>GSTIN: {{customer.gstin}}</p>
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th>Description</th>
        <th>HSN/SAC</th>
        <th>Qty</th>
        <th>Rate</th>
        <th>Tax</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      <!-- Items will be rendered here -->
    </tbody>
  </table>

  <div class="totals">
    <p><span>Subtotal:</span> <span>₹{{subtotal}}</span></p>
    <p><span>CGST:</span> <span>₹{{cgst}}</span></p>
    <p><span>SGST:</span> <span>₹{{sgst}}</span></p>
    <p class="total"><span>Total:</span> <span>₹{{totalAmount}}</span></p>
  </div>

  <div class="footer">
    <p><strong>Notes:</strong> {{notes}}</p>
    <p><strong>Terms:</strong> {{terms}}</p>
  </div>
</div>`;

const SAMPLE_CSS = `.invoice-container {
  font-family: Arial, sans-serif;
  max-width: 800px;
  margin: 0 auto;
  padding: 40px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 40px;
  border-bottom: 2px solid #333;
  padding-bottom: 20px;
}

.header h1 {
  font-size: 32px;
  color: #333;
  margin: 0;
}

.document-info {
  text-align: right;
}

.document-info p {
  margin: 5px 0;
}

.parties {
  display: flex;
  justify-content: space-between;
  margin-bottom: 40px;
}

.parties .from, .parties .to {
  width: 45%;
}

.parties h3 {
  font-size: 14px;
  color: #666;
  margin-bottom: 10px;
  text-transform: uppercase;
}

.parties p {
  margin: 5px 0;
  font-size: 14px;
}

.items {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 30px;
}

.items th, .items td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #ddd;
}

.items th {
  background: #f5f5f5;
  font-weight: 600;
}

.items td:last-child, .items th:last-child {
  text-align: right;
}

.totals {
  width: 300px;
  margin-left: auto;
  margin-bottom: 40px;
}

.totals p {
  display: flex;
  justify-content: space-between;
  margin: 8px 0;
  padding: 8px 0;
}

.totals .total {
  font-weight: bold;
  font-size: 18px;
  border-top: 2px solid #333;
  padding-top: 12px;
}

.footer {
  border-top: 1px solid #ddd;
  padding-top: 20px;
  font-size: 12px;
  color: #666;
}`;

export default function DocumentTemplates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [activeTab, setActiveTab] = useState('html');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    templateType: 'all' as 'invoice' | 'quote' | 'sales_order' | 'all',
    htmlContent: SAMPLE_TEMPLATE,
    cssContent: SAMPLE_CSS,
    isDefault: false,
  });

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery<DocumentTemplate[]>({
    queryKey: ['document-templates'],
    queryFn: async () => {
      const response = await fetch('/api/document-templates', {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch templates');
      return response.json();
    },
  });

  // Create template mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch('/api/document-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create template');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-templates'] });
      setShowEditor(false);
      resetForm();
      toast({ title: 'Template created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Update template mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const response = await fetch(`/api/document-templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update template');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-templates'] });
      setShowEditor(false);
      setEditingTemplate(null);
      resetForm();
      toast({ title: 'Template updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Delete template mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/document-templates/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete template');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-templates'] });
      toast({ title: 'Template deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Preview template mutation
  const previewMutation = useMutation({
    mutationFn: async (data: { htmlContent: string; cssContent: string }) => {
      const response = await fetch('/api/document-templates/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to preview template');
      return response.json();
    },
    onSuccess: (data) => {
      setPreviewHtml(data.html);
      setShowPreview(true);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      templateType: 'all',
      htmlContent: SAMPLE_TEMPLATE,
      cssContent: SAMPLE_CSS,
      isDefault: false,
    });
    setEditingTemplate(null);
  };

  const handleEdit = (template: DocumentTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      templateType: template.templateType,
      htmlContent: template.htmlContent,
      cssContent: template.cssContent || '',
      isDefault: template.isDefault,
    });
    setShowEditor(true);
  };

  const handleSave = () => {
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handlePreview = () => {
    previewMutation.mutate({
      htmlContent: formData.htmlContent,
      cssContent: formData.cssContent,
    });
  };

  const getTemplateTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      all: 'bg-purple-100 text-purple-700',
      invoice: 'bg-blue-100 text-blue-700',
      quote: 'bg-green-100 text-green-700',
      sales_order: 'bg-orange-100 text-orange-700',
    };
    const labels: Record<string, string> = {
      all: 'All Documents',
      invoice: 'Invoice',
      quote: 'Quote',
      sales_order: 'Sales Order',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[type]}`}>
        {labels[type]}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Document Templates</h1>
          <p className="text-muted-foreground">
            Create and manage custom templates for invoices, quotes, and sales orders
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowEditor(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Template Placeholders Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Code className="h-4 w-4" />
            Available Placeholders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="font-medium mb-1">Document</p>
              <code className="text-xs">{'{{documentType}}'}</code><br />
              <code className="text-xs">{'{{documentNumber}}'}</code><br />
              <code className="text-xs">{'{{documentDate}}'}</code><br />
              <code className="text-xs">{'{{dueDate}}'}</code>
            </div>
            <div>
              <p className="font-medium mb-1">Company</p>
              <code className="text-xs">{'{{company.name}}'}</code><br />
              <code className="text-xs">{'{{company.address}}'}</code><br />
              <code className="text-xs">{'{{company.gstin}}'}</code><br />
              <code className="text-xs">{'{{company.pan}}'}</code>
            </div>
            <div>
              <p className="font-medium mb-1">Customer</p>
              <code className="text-xs">{'{{customer.name}}'}</code><br />
              <code className="text-xs">{'{{customer.address}}'}</code><br />
              <code className="text-xs">{'{{customer.gstin}}'}</code>
            </div>
            <div>
              <p className="font-medium mb-1">Totals</p>
              <code className="text-xs">{'{{subtotal}}'}</code><br />
              <code className="text-xs">{'{{cgst}} {{sgst}} {{igst}}'}</code><br />
              <code className="text-xs">{'{{totalAmount}}'}</code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Your Templates
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <Palette className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No custom templates yet</p>
              <Button onClick={() => { resetForm(); setShowEditor(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Template
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {template.isDefault && <Star className="h-4 w-4 text-yellow-500" />}
                        <span className="font-medium">{template.name}</span>
                      </div>
                      {template.description && (
                        <p className="text-sm text-muted-foreground">{template.description}</p>
                      )}
                    </TableCell>
                    <TableCell>{getTemplateTypeBadge(template.templateType)}</TableCell>
                    <TableCell>
                      <Badge variant={template.isActive ? 'default' : 'secondary'}>
                        {template.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(template.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            previewMutation.mutate({
                              htmlContent: template.htmlContent,
                              cssContent: template.cssContent || '',
                            });
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(template)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm('Are you sure you want to delete this template?')) {
                              deleteMutation.mutate(template.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Template Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create New Template'}
            </DialogTitle>
            <DialogDescription>
              Design your custom document template using HTML and CSS
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="space-y-2">
                <Label htmlFor="name">Template Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="My Custom Invoice Template"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="templateType">Template Type</Label>
                <Select
                  value={formData.templateType}
                  onValueChange={(value: any) => setFormData({ ...formData, templateType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Documents</SelectItem>
                    <SelectItem value="invoice">Invoice Only</SelectItem>
                    <SelectItem value="quote">Quote Only</SelectItem>
                    <SelectItem value="sales_order">Sales Order Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this template"
              />
            </div>

            <div className="flex items-center gap-2 mb-4">
              <input
                type="checkbox"
                id="isDefault"
                checked={formData.isDefault}
                onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="isDefault">Set as default template</Label>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="html">
                  <Code className="h-4 w-4 mr-2" />
                  HTML
                </TabsTrigger>
                <TabsTrigger value="css">
                  <Palette className="h-4 w-4 mr-2" />
                  CSS
                </TabsTrigger>
              </TabsList>
              <TabsContent value="html" className="mt-4">
                <Textarea
                  value={formData.htmlContent}
                  onChange={(e) => setFormData({ ...formData, htmlContent: e.target.value })}
                  className="font-mono text-sm h-[300px]"
                  placeholder="Enter your HTML template..."
                />
              </TabsContent>
              <TabsContent value="css" className="mt-4">
                <Textarea
                  value={formData.cssContent}
                  onChange={(e) => setFormData({ ...formData, cssContent: e.target.value })}
                  className="font-mono text-sm h-[300px]"
                  placeholder="Enter your CSS styles..."
                />
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => { resetForm(); setShowEditor(false); }}>
              Cancel
            </Button>
            <Button variant="outline" onClick={handlePreview} disabled={previewMutation.isPending}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button
              onClick={handleSave}
              disabled={!formData.name || !formData.htmlContent || createMutation.isPending || updateMutation.isPending}
            >
              {editingTemplate ? 'Update Template' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Template Preview</DialogTitle>
            <DialogDescription>
              Preview with sample data
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto bg-white border rounded-lg" style={{ maxHeight: '60vh' }}>
            <iframe
              srcDoc={previewHtml}
              className="w-full h-[500px] border-0"
              title="Template Preview"
            />
          </div>
          <DialogFooter>
            <Button onClick={() => setShowPreview(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
