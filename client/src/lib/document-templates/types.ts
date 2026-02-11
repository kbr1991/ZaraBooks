// Document template types for Invoices, Quotes, and Sales Orders

export type TemplateId = 'classic' | 'modern' | 'professional' | 'minimal';

export type DocumentType = 'invoice' | 'quote' | 'sales_order' | 'purchase_order' | 'bill' | 'credit_note' | 'debit_note';

export interface CompanyInfo {
  name: string;
  legalName?: string | null;
  logoUrl?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
  gstin?: string | null;
  pan?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface CustomerInfo {
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  gstin?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface DocumentLineItem {
  description: string;
  hsnSac?: string;
  quantity: number;
  rate: number;
  amount: number;
  taxRate?: number;
  taxAmount?: number;
}

export interface TaxBreakdown {
  cgst: number;
  sgst: number;
  igst: number;
}

export interface DocumentData {
  type: DocumentType;
  documentNumber: string;
  documentDate: string;
  dueDate?: string;        // For invoices
  expiryDate?: string;     // For quotes
  deliveryDate?: string;   // For sales orders
  company: CompanyInfo;
  customer: CustomerInfo;
  items: DocumentLineItem[];
  subtotal: number;
  taxBreakdown: TaxBreakdown;
  totalAmount: number;
  notes?: string;
  terms?: string;
  status?: string;
  billingAddress?: string;
  shippingAddress?: string;
}

export interface TemplateConfig {
  id: TemplateId;
  name: string;
  description: string;
  preview: string; // Preview color or image
}

export const TEMPLATE_CONFIGS: TemplateConfig[] = [
  {
    id: 'classic',
    name: 'Classic',
    description: 'Traditional navy & gold design for professional businesses',
    preview: '#1e3a5f',
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'Clean blue & teal gradient for tech and startups',
    preview: '#0ea5e9',
  },
  {
    id: 'professional',
    name: 'Professional',
    description: 'Corporate gray & black for CA firms and corporates',
    preview: '#374151',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Simple monochrome design with lots of whitespace',
    preview: '#6b7280',
  },
];

export type TemplateFunction = (data: DocumentData) => string;
