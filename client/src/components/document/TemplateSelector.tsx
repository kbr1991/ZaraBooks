import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TemplateId, TEMPLATE_CONFIGS } from '@/lib/document-templates/types';
import { TemplateGrid } from './TemplatePreview';
import { FileDown, Printer } from 'lucide-react';

interface TemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTemplate: TemplateId;
  onSelect: (templateId: TemplateId, action: 'print' | 'pdf') => void;
  documentType: 'invoice' | 'quote' | 'sales_order' | 'purchase_order' | 'bill' | 'credit_note' | 'debit_note';
}

export default function TemplateSelector({
  open,
  onOpenChange,
  defaultTemplate,
  onSelect,
  documentType,
}: TemplateSelectorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId>(defaultTemplate);

  const handleAction = (action: 'print' | 'pdf') => {
    onSelect(selectedTemplate, action);
    onOpenChange(false);
  };

  const documentName: Record<string, string> = {
    invoice: 'Invoice',
    quote: 'Quote',
    sales_order: 'Sales Order',
    purchase_order: 'Purchase Order',
    bill: 'Bill',
    credit_note: 'Credit Note',
    debit_note: 'Debit Note',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose Template</DialogTitle>
          <DialogDescription>
            Select a template style for your {(documentName[documentType] || 'document').toLowerCase()}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <TemplateGrid
            selectedTemplate={selectedTemplate}
            onSelect={setSelectedTemplate}
            size="md"
          />
        </div>

        <div className="text-sm text-muted-foreground">
          <span className="font-medium">Selected: </span>
          {TEMPLATE_CONFIGS.find(t => t.id === selectedTemplate)?.name} - {' '}
          {TEMPLATE_CONFIGS.find(t => t.id === selectedTemplate)?.description}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="outline" onClick={() => handleAction('print')}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button onClick={() => handleAction('pdf')}>
            <FileDown className="h-4 w-4 mr-2" />
            Save as PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Simplified selector for quick template switch
interface QuickTemplateSelectorProps {
  value: TemplateId;
  onChange: (value: TemplateId) => void;
}

export function QuickTemplateSelector({ value, onChange }: QuickTemplateSelectorProps) {
  return (
    <div className="flex gap-2">
      {TEMPLATE_CONFIGS.map((config) => (
        <button
          key={config.id}
          onClick={() => onChange(config.id)}
          className={`
            px-3 py-1.5 text-sm rounded-md transition-colors
            ${value === config.id
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80'
            }
          `}
        >
          {config.name}
        </button>
      ))}
    </div>
  );
}
