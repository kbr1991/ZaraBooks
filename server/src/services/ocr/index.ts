/**
 * OCR Document Processing Service
 *
 * Handles document scanning, OCR processing, and data extraction
 * Supports Google Cloud Vision for OCR
 */

import { db } from '../../db';
import {
  documentScans,
  expenses,
  bills,
  billLines,
  invoices,
  invoiceLines,
  parties,
  chartOfAccounts,
  fiscalYears,
  journalEntries,
  journalEntryLines,
  type DocumentScan,
  type InsertDocumentScan
} from '../../../../shared/schema';
import { eq, and, ilike } from 'drizzle-orm';

// Google Cloud Vision integration would go here
// For MVP, we'll use a simpler approach that can be enhanced later

interface ExtractedData {
  vendorName?: string;
  vendorGstin?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  subtotal?: number;
  taxAmount?: number;
  totalAmount?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  items?: ExtractedItem[];
  confidence?: number;
}

interface ExtractedItem {
  description: string;
  quantity?: number;
  rate?: number;
  amount?: number;
  hsnCode?: string;
  taxRate?: number;
}

interface ProcessingResult {
  success: boolean;
  extractedData?: ExtractedData;
  confidence: number;
  language?: string;
  error?: string;
}

/**
 * Processes a document through OCR
 */
export async function processDocument(
  documentId: string,
  companyId: string
): Promise<ProcessingResult> {
  // Update status to processing
  await db.update(documentScans)
    .set({ ocrStatus: 'processing' })
    .where(eq(documentScans.id, documentId));

  const startTime = Date.now();

  try {
    // Get document info
    const [doc] = await db.select()
      .from(documentScans)
      .where(and(
        eq(documentScans.id, documentId),
        eq(documentScans.companyId, companyId)
      ));

    if (!doc) {
      throw new Error('Document not found');
    }

    // For MVP, use text extraction from file content if available
    // In production, this would call Google Cloud Vision API
    let extractedData: ExtractedData;

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Production OCR using Google Cloud Vision
      extractedData = await processWithGoogleVision(doc.fileUrl);
    } else {
      // Development fallback - return empty extraction
      extractedData = {
        confidence: 0
      };
    }

    const processingTime = Date.now() - startTime;

    // Update document with extracted data
    await db.update(documentScans)
      .set({
        ocrStatus: 'completed',
        extractedData,
        ocrConfidence: extractedData.confidence?.toString() || '0',
        processingTime,
        languageDetected: 'en',
        needsReview: true,
        updatedAt: new Date()
      })
      .where(eq(documentScans.id, documentId));

    return {
      success: true,
      extractedData,
      confidence: extractedData.confidence || 0,
      language: 'en'
    };
  } catch (error) {
    await db.update(documentScans)
      .set({
        ocrStatus: 'failed',
        updatedAt: new Date()
      })
      .where(eq(documentScans.id, documentId));

    return {
      success: false,
      confidence: 0,
      error: error instanceof Error ? error.message : 'OCR processing failed'
    };
  }
}

/**
 * Process document with Google Cloud Vision API
 */
async function processWithGoogleVision(fileUrl: string): Promise<ExtractedData> {
  // Google Cloud Vision integration
  // This would use the @google-cloud/vision package

  // For now, return a placeholder
  // In production:
  // const vision = require('@google-cloud/vision');
  // const client = new vision.ImageAnnotatorClient();
  // const [result] = await client.documentTextDetection(fileUrl);

  return {
    confidence: 0
  };
}

/**
 * Extracts structured data from OCR text for Indian invoices/bills
 */
export function extractIndianBillData(ocrText: string): ExtractedData {
  const data: ExtractedData = {};
  const lines = ocrText.split('\n').map(l => l.trim()).filter(Boolean);
  const text = ocrText.toLowerCase();

  // Extract GSTIN (15 character format)
  const gstinMatch = ocrText.match(/\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1})\b/i);
  if (gstinMatch) {
    data.vendorGstin = gstinMatch[1].toUpperCase();
  }

  // Extract Invoice Number
  const invoicePatterns = [
    /invoice\s*(?:no|number|#)?\s*[:.-]?\s*([A-Z0-9/-]+)/i,
    /bill\s*(?:no|number|#)?\s*[:.-]?\s*([A-Z0-9/-]+)/i,
    /receipt\s*(?:no|number|#)?\s*[:.-]?\s*([A-Z0-9/-]+)/i
  ];
  for (const pattern of invoicePatterns) {
    const match = ocrText.match(pattern);
    if (match) {
      data.invoiceNumber = match[1];
      break;
    }
  }

  // Extract Dates
  const datePatterns = [
    // DD/MM/YYYY or DD-MM-YYYY
    /(?:date|dated|dt)?\s*[:.-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/gi,
    // DD MMM YYYY
    /(\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{2,4})/gi
  ];

  const dates: string[] = [];
  for (const pattern of datePatterns) {
    let match;
    while ((match = pattern.exec(ocrText)) !== null) {
      dates.push(match[1]);
    }
  }

  if (dates.length > 0) {
    data.invoiceDate = parseInvoiceDate(dates[0]);
    if (dates.length > 1) {
      data.dueDate = parseInvoiceDate(dates[dates.length - 1]);
    }
  }

  // Extract amounts
  const amountPatterns = {
    total: [
      /(?:grand\s*)?total\s*[:.]?\s*(?:rs\.?|₹|inr)?\s*([\d,]+\.?\d*)/gi,
      /(?:rs\.?|₹|inr)\s*([\d,]+\.?\d*)\s*(?:only)?$/gim
    ],
    subtotal: [
      /sub\s*-?\s*total\s*[:.]?\s*(?:rs\.?|₹|inr)?\s*([\d,]+\.?\d*)/gi,
      /taxable\s*(?:value|amount)\s*[:.]?\s*(?:rs\.?|₹|inr)?\s*([\d,]+\.?\d*)/gi
    ],
    cgst: [/cgst\s*(?:@\s*\d+%?)?\s*[:.]?\s*(?:rs\.?|₹|inr)?\s*([\d,]+\.?\d*)/gi],
    sgst: [/sgst\s*(?:@\s*\d+%?)?\s*[:.]?\s*(?:rs\.?|₹|inr)?\s*([\d,]+\.?\d*)/gi],
    igst: [/igst\s*(?:@\s*\d+%?)?\s*[:.]?\s*(?:rs\.?|₹|inr)?\s*([\d,]+\.?\d*)/gi]
  };

  for (const [key, patterns] of Object.entries(amountPatterns)) {
    for (const pattern of patterns) {
      const match = pattern.exec(ocrText);
      if (match) {
        const amount = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(amount)) {
          (data as any)[key === 'total' ? 'totalAmount' : key] = amount;
          break;
        }
      }
    }
  }

  // Calculate tax amount if we have components
  if (data.cgst || data.sgst || data.igst) {
    data.taxAmount = (data.cgst || 0) + (data.sgst || 0) + (data.igst || 0);
  }

  // Try to extract vendor name from top of document
  const vendorLines = lines.slice(0, 5);
  for (const line of vendorLines) {
    // Skip lines that look like headers or generic text
    if (line.length > 5 && !line.match(/invoice|bill|receipt|tax|gst|date/i)) {
      data.vendorName = line;
      break;
    }
  }

  // Set confidence based on what we found
  let confidence = 0;
  if (data.vendorGstin) confidence += 20;
  if (data.invoiceNumber) confidence += 15;
  if (data.invoiceDate) confidence += 15;
  if (data.totalAmount) confidence += 20;
  if (data.taxAmount) confidence += 10;
  if (data.vendorName) confidence += 10;
  if (data.cgst || data.sgst || data.igst) confidence += 10;

  data.confidence = Math.min(confidence, 100);

  return data;
}

/**
 * Parse Indian date formats
 */
function parseInvoiceDate(dateStr: string): string {
  // Clean the string
  dateStr = dateStr.trim();

  // Try DD/MM/YYYY or DD-MM-YYYY
  const dmy = dateStr.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    let year = dmy[3];
    if (year.length === 2) {
      year = (parseInt(year) > 50 ? '19' : '20') + year;
    }
    return `${year}-${month}-${day}`;
  }

  // Try DD MMM YYYY
  const months: { [key: string]: string } = {
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
    'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
    'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
  };

  const mdy = dateStr.match(/(\d{1,2})\s*([a-z]{3})[a-z]*\s*(\d{2,4})/i);
  if (mdy) {
    const day = mdy[1].padStart(2, '0');
    const monthKey = mdy[2].toLowerCase();
    const month = months[monthKey] || '01';
    let year = mdy[3];
    if (year.length === 2) {
      year = (parseInt(year) > 50 ? '19' : '20') + year;
    }
    return `${year}-${month}-${day}`;
  }

  return dateStr;
}

/**
 * Creates an expense from a document scan
 */
export async function createExpenseFromScan(
  documentId: string,
  companyId: string,
  userId: string,
  overrides?: Partial<ExtractedData>
): Promise<{ expenseId: string; expenseNumber: string }> {
  const [doc] = await db.select()
    .from(documentScans)
    .where(and(
      eq(documentScans.id, documentId),
      eq(documentScans.companyId, companyId)
    ));

  if (!doc) {
    throw new Error('Document not found');
  }

  const extractedData = { ...(doc.extractedData as ExtractedData), ...overrides };

  // Get current fiscal year
  const [fiscalYear] = await db.select()
    .from(fiscalYears)
    .where(and(
      eq(fiscalYears.companyId, companyId),
      eq(fiscalYears.isCurrent, true)
    ));

  if (!fiscalYear) {
    throw new Error('No active fiscal year found');
  }

  // Find or create vendor
  let vendorId: string | undefined;
  if (extractedData.vendorGstin || extractedData.vendorName) {
    const existingVendor = await db.select()
      .from(parties)
      .where(and(
        eq(parties.companyId, companyId),
        eq(parties.partyType, 'vendor'),
        extractedData.vendorGstin
          ? eq(parties.gstin, extractedData.vendorGstin)
          : ilike(parties.name, `%${extractedData.vendorName}%`)
      ))
      .limit(1);

    if (existingVendor.length > 0) {
      vendorId = existingVendor[0].id;
    }
  }

  // Find expense account
  const [expenseAccount] = await db.select()
    .from(chartOfAccounts)
    .where(and(
      eq(chartOfAccounts.companyId, companyId),
      eq(chartOfAccounts.accountType, 'expense'),
      eq(chartOfAccounts.isActive, true)
    ))
    .limit(1);

  if (!expenseAccount) {
    throw new Error('No expense account found');
  }

  // Generate expense number
  const expenseCount = await db.select({ count: db.$count(expenses) })
    .from(expenses)
    .where(eq(expenses.companyId, companyId));

  const count = expenseCount[0]?.count || 0;
  const expenseNumber = `EXP/${new Date().getFullYear()}/${String(Number(count) + 1).padStart(4, '0')}`;

  // Create expense
  const [expense] = await db.insert(expenses)
    .values({
      companyId,
      fiscalYearId: fiscalYear.id,
      expenseNumber,
      expenseDate: extractedData.invoiceDate || new Date().toISOString().split('T')[0],
      vendorId,
      accountId: expenseAccount.id,
      amount: (extractedData.subtotal || extractedData.totalAmount || 0).toFixed(2),
      taxAmount: (extractedData.taxAmount || 0).toFixed(2),
      totalAmount: (extractedData.totalAmount || 0).toFixed(2),
      description: `${extractedData.vendorName || 'Vendor'} - ${extractedData.invoiceNumber || 'Bill'}`,
      referenceNumber: extractedData.invoiceNumber,
      receiptUrl: doc.fileUrl,
      status: 'pending',
      createdByUserId: userId
    })
    .returning();

  // Update document scan
  await db.update(documentScans)
    .set({
      createdExpenseId: expense.id,
      needsReview: false,
      reviewedByUserId: userId,
      reviewedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(documentScans.id, documentId));

  return { expenseId: expense.id, expenseNumber };
}

/**
 * Creates a bill from a document scan
 */
export async function createBillFromScan(
  documentId: string,
  companyId: string,
  userId: string,
  vendorId: string,
  overrides?: Partial<ExtractedData>
): Promise<{ billId: string; billNumber: string }> {
  const [doc] = await db.select()
    .from(documentScans)
    .where(and(
      eq(documentScans.id, documentId),
      eq(documentScans.companyId, companyId)
    ));

  if (!doc) {
    throw new Error('Document not found');
  }

  const extractedData = { ...(doc.extractedData as ExtractedData), ...overrides };

  // Get current fiscal year
  const [fiscalYear] = await db.select()
    .from(fiscalYears)
    .where(and(
      eq(fiscalYears.companyId, companyId),
      eq(fiscalYears.isCurrent, true)
    ));

  if (!fiscalYear) {
    throw new Error('No active fiscal year found');
  }

  // Generate bill number
  const billCount = await db.select({ count: db.$count(bills) })
    .from(bills)
    .where(eq(bills.companyId, companyId));

  const count = billCount[0]?.count || 0;
  const billNumber = `BILL/${new Date().getFullYear()}/${String(Number(count) + 1).padStart(4, '0')}`;

  const invoiceDate = extractedData.invoiceDate || new Date().toISOString().split('T')[0];
  const dueDate = extractedData.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Create bill
  const [bill] = await db.insert(bills)
    .values({
      companyId,
      fiscalYearId: fiscalYear.id,
      billNumber,
      vendorBillNumber: extractedData.invoiceNumber,
      billDate: invoiceDate,
      dueDate,
      vendorId,
      subtotal: (extractedData.subtotal || extractedData.totalAmount || 0).toFixed(2),
      taxAmount: (extractedData.taxAmount || 0).toFixed(2),
      totalAmount: (extractedData.totalAmount || 0).toFixed(2),
      balanceDue: (extractedData.totalAmount || 0).toFixed(2),
      cgst: (extractedData.cgst || 0).toFixed(2),
      sgst: (extractedData.sgst || 0).toFixed(2),
      igst: (extractedData.igst || 0).toFixed(2),
      status: 'pending',
      notes: `Created from scanned document`,
      createdByUserId: userId
    })
    .returning();

  // Create bill lines if items were extracted
  if (extractedData.items && extractedData.items.length > 0) {
    const lineValues = extractedData.items.map((item, idx) => ({
      billId: bill.id,
      description: item.description,
      hsnSacCode: item.hsnCode,
      quantity: (item.quantity || 1).toFixed(4),
      unitPrice: (item.rate || item.amount || 0).toFixed(2),
      taxRate: (item.taxRate || 0).toFixed(2),
      taxAmount: '0',
      amount: (item.amount || 0).toFixed(2),
      sortOrder: idx
    }));

    await db.insert(billLines).values(lineValues);
  } else {
    // Create a single line item
    await db.insert(billLines).values({
      billId: bill.id,
      description: `${extractedData.vendorName || 'Vendor'} - Purchase`,
      quantity: '1',
      unitPrice: (extractedData.subtotal || extractedData.totalAmount || 0).toFixed(2),
      taxRate: '0',
      taxAmount: (extractedData.taxAmount || 0).toFixed(2),
      amount: (extractedData.totalAmount || 0).toFixed(2),
      sortOrder: 0
    });
  }

  // Update document scan
  await db.update(documentScans)
    .set({
      createdBillId: bill.id,
      needsReview: false,
      reviewedByUserId: userId,
      reviewedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(documentScans.id, documentId));

  return { billId: bill.id, billNumber };
}

/**
 * Gets document scan statistics for a company
 */
export async function getDocumentScanStats(companyId: string): Promise<{
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  needsReview: number;
}> {
  const docs = await db.select()
    .from(documentScans)
    .where(eq(documentScans.companyId, companyId));

  return {
    total: docs.length,
    pending: docs.filter(d => d.ocrStatus === 'pending').length,
    processing: docs.filter(d => d.ocrStatus === 'processing').length,
    completed: docs.filter(d => d.ocrStatus === 'completed').length,
    failed: docs.filter(d => d.ocrStatus === 'failed').length,
    needsReview: docs.filter(d => d.needsReview).length
  };
}
