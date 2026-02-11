// Document template generator

import { DocumentData, TemplateId, TemplateFunction, TEMPLATE_CONFIGS } from './types';
import { classicTemplate } from './templates/classic';
import { modernTemplate } from './templates/modern';
import { professionalTemplate } from './templates/professional';
import { minimalTemplate } from './templates/minimal';

// Template registry
const templates: Record<TemplateId, TemplateFunction> = {
  classic: classicTemplate,
  modern: modernTemplate,
  professional: professionalTemplate,
  minimal: minimalTemplate,
};

/**
 * Generate a document HTML string using the specified template
 */
export function generateDocument(
  data: DocumentData,
  templateId: TemplateId = 'classic'
): string {
  const template = templates[templateId];
  if (!template) {
    console.warn(`Template "${templateId}" not found, falling back to classic`);
    return templates.classic(data);
  }
  return template(data);
}

/**
 * Get all available template configurations
 */
export function getTemplateConfigs() {
  return TEMPLATE_CONFIGS;
}

/**
 * Get a specific template configuration by ID
 */
export function getTemplateConfig(templateId: TemplateId) {
  return TEMPLATE_CONFIGS.find(t => t.id === templateId);
}

/**
 * Get document title based on type
 */
export function getDocumentTitle(type: DocumentData['type']): string {
  switch (type) {
    case 'invoice':
      return 'INVOICE';
    case 'quote':
      return 'QUOTE / ESTIMATE';
    case 'sales_order':
      return 'SALES ORDER';
    case 'purchase_order':
      return 'PURCHASE ORDER';
    case 'bill':
      return 'BILL';
    case 'credit_note':
      return 'CREDIT NOTE';
    case 'debit_note':
      return 'DEBIT NOTE';
    default:
      return 'DOCUMENT';
  }
}

/**
 * Get date label based on document type
 */
export function getDateLabel(type: DocumentData['type']): { primary: string; secondary?: string } {
  switch (type) {
    case 'invoice':
      return { primary: 'Invoice Date', secondary: 'Due Date' };
    case 'quote':
      return { primary: 'Quote Date', secondary: 'Valid Until' };
    case 'sales_order':
      return { primary: 'Order Date', secondary: 'Delivery Date' };
    case 'purchase_order':
      return { primary: 'Order Date', secondary: 'Expected Date' };
    case 'bill':
      return { primary: 'Bill Date', secondary: 'Due Date' };
    case 'credit_note':
      return { primary: 'Credit Note Date' };
    case 'debit_note':
      return { primary: 'Debit Note Date' };
    default:
      return { primary: 'Date' };
  }
}

/**
 * Get party label based on document type
 */
export function getPartyLabel(type: DocumentData['type']): string {
  switch (type) {
    case 'purchase_order':
    case 'bill':
    case 'debit_note':
      return 'Vendor';
    case 'invoice':
    case 'quote':
    case 'sales_order':
    case 'credit_note':
    default:
      return 'Bill To';
  }
}

/**
 * Format currency for display
 */
export function formatCurrencyValue(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format date for display
 */
export function formatDateValue(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// Re-export types
export * from './types';
