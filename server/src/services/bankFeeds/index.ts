/**
 * Bank Feeds Service
 *
 * Main orchestrator for bank feed functionality
 */

export * from './categorization';
export * from './reconciliation';

import { db } from '../../db';
import {
  bankConnections,
  bankFeedTransactions,
  bankAccounts,
  type BankConnection,
  type InsertBankFeedTransaction
} from '../../../../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { categorizeTransaction } from './categorization';
import { findMatch } from './reconciliation';

interface ParsedTransaction {
  transactionDate: string;
  valueDate?: string;
  description: string;
  referenceNumber?: string;
  debitAmount?: string;
  creditAmount?: string;
  runningBalance?: string;
}

interface ImportResult {
  imported: number;
  duplicates: number;
  errors: string[];
}

/**
 * Imports transactions from a parsed CSV/OFX file
 */
export async function importTransactions(
  companyId: string,
  bankAccountId: string,
  transactions: ParsedTransaction[],
  connectionId?: string
): Promise<ImportResult> {
  const result: ImportResult = { imported: 0, duplicates: 0, errors: [] };

  for (const txn of transactions) {
    try {
      // Check for duplicates based on date, amount, and description
      const existingTxn = await db.select()
        .from(bankFeedTransactions)
        .where(and(
          eq(bankFeedTransactions.companyId, companyId),
          eq(bankFeedTransactions.bankAccountId, bankAccountId),
          eq(bankFeedTransactions.transactionDate, txn.transactionDate),
          eq(bankFeedTransactions.description, txn.description)
        ))
        .limit(1);

      if (existingTxn.length > 0) {
        result.duplicates++;
        continue;
      }

      // Auto-categorize the transaction
      const categorization = await categorizeTransaction(companyId, {
        description: txn.description,
        referenceNumber: txn.referenceNumber,
        debitAmount: txn.debitAmount,
        creditAmount: txn.creditAmount
      });

      // Insert the transaction
      const [newTxn] = await db.insert(bankFeedTransactions)
        .values({
          companyId,
          bankConnectionId: connectionId,
          bankAccountId,
          transactionDate: txn.transactionDate,
          valueDate: txn.valueDate,
          description: txn.description,
          referenceNumber: txn.referenceNumber,
          debitAmount: txn.debitAmount,
          creditAmount: txn.creditAmount,
          runningBalance: txn.runningBalance,
          suggestedAccountId: categorization.accountId,
          suggestedPartyId: categorization.partyId,
          confidenceScore: categorization.confidenceScore.toString(),
          categorizationSource: categorization.source,
          reconciliationStatus: 'pending'
        })
        .returning();

      // Try to find a match
      const match = await findMatch(companyId, newTxn);
      if (match.matchType && match.matchedId && match.confidenceScore >= 85) {
        // Update with match info
        const updateData: any = { reconciliationStatus: 'matched' };
        switch (match.matchType) {
          case 'invoice':
            updateData.matchedInvoiceId = match.matchedId;
            break;
          case 'bill':
            updateData.matchedBillId = match.matchedId;
            break;
          case 'expense':
            updateData.matchedExpenseId = match.matchedId;
            break;
          case 'payment_received':
            updateData.matchedPaymentReceivedId = match.matchedId;
            break;
          case 'payment_made':
            updateData.matchedPaymentMadeId = match.matchedId;
            break;
        }
        await db.update(bankFeedTransactions)
          .set(updateData)
          .where(eq(bankFeedTransactions.id, newTxn.id));
      }

      result.imported++;
    } catch (error) {
      result.errors.push(`Row ${result.imported + result.duplicates + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return result;
}

/**
 * Parses a bank CSV file (auto-detects format)
 */
export function parseCSV(
  csvContent: string,
  format?: string
): ParsedTransaction[] {
  const lines = csvContent.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  // Auto-detect format based on header
  const header = lines[0].toLowerCase();
  const transactions: ParsedTransaction[] = [];

  // Common Indian bank formats
  if (header.includes('txn date') || header.includes('transaction date') || header.includes('value date')) {
    // Standard format with headers
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const dateIdx = headers.findIndex(h => h.includes('date') && (h.includes('txn') || h.includes('transaction')));
    const valueDateIdx = headers.findIndex(h => h.includes('value') && h.includes('date'));
    const descIdx = headers.findIndex(h => h.includes('description') || h.includes('particulars') || h.includes('narration'));
    const refIdx = headers.findIndex(h => h.includes('ref') || h.includes('reference') || h.includes('cheque'));
    const debitIdx = headers.findIndex(h => h.includes('debit') || h.includes('withdrawal'));
    const creditIdx = headers.findIndex(h => h.includes('credit') || h.includes('deposit'));
    const balanceIdx = headers.findIndex(h => h.includes('balance'));

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      if (values.length <= Math.max(dateIdx, descIdx)) continue;

      const txn: ParsedTransaction = {
        transactionDate: parseDate(values[dateIdx] || ''),
        valueDate: valueDateIdx >= 0 ? parseDate(values[valueDateIdx] || '') : undefined,
        description: values[descIdx] || '',
        referenceNumber: refIdx >= 0 ? values[refIdx] : undefined,
        debitAmount: debitIdx >= 0 ? parseAmount(values[debitIdx] || '') : undefined,
        creditAmount: creditIdx >= 0 ? parseAmount(values[creditIdx] || '') : undefined,
        runningBalance: balanceIdx >= 0 ? parseAmount(values[balanceIdx] || '') : undefined
      };

      if (txn.transactionDate && txn.description) {
        transactions.push(txn);
      }
    }
  }

  return transactions;
}

/**
 * Parses a CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());

  return values;
}

/**
 * Parses a date string to ISO format
 */
function parseDate(dateStr: string): string {
  if (!dateStr) return '';

  // Try various formats
  const formats = [
    // DD/MM/YYYY
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    // DD-MM-YYYY
    /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
    // YYYY-MM-DD
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
    // DD MMM YYYY
    /^(\d{1,2})\s+(\w{3})\s+(\d{4})$/
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      let year, month, day;

      if (format.source.startsWith('^(\\d{4})')) {
        // YYYY-MM-DD
        [, year, month, day] = match;
      } else if (format.source.includes('\\w{3}')) {
        // DD MMM YYYY
        const months: { [key: string]: string } = {
          'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
          'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
          'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
        };
        day = match[1].padStart(2, '0');
        month = months[match[2].toLowerCase()] || '01';
        year = match[3];
      } else {
        // DD/MM/YYYY or DD-MM-YYYY
        day = match[1].padStart(2, '0');
        month = match[2].padStart(2, '0');
        year = match[3];
      }

      return `${year}-${month}-${day}`;
    }
  }

  return dateStr;
}

/**
 * Parses an amount string to decimal
 */
function parseAmount(amountStr: string): string | undefined {
  if (!amountStr || amountStr.trim() === '') return undefined;

  // Remove currency symbols, commas, spaces
  const cleaned = amountStr
    .replace(/[₹$€£,\s]/g, '')
    .replace(/\(([^)]+)\)/, '-$1') // Handle (100) as -100
    .trim();

  const num = parseFloat(cleaned);
  if (isNaN(num) || num === 0) return undefined;

  return Math.abs(num).toFixed(2);
}

/**
 * Gets the bank feed dashboard summary
 */
export async function getBankFeedSummary(companyId: string): Promise<{
  totalTransactions: number;
  pendingCount: number;
  matchedCount: number;
  createdCount: number;
  excludedCount: number;
  totalCredits: number;
  totalDebits: number;
}> {
  const transactions = await db.select()
    .from(bankFeedTransactions)
    .where(eq(bankFeedTransactions.companyId, companyId));

  let totalCredits = 0;
  let totalDebits = 0;
  let pendingCount = 0;
  let matchedCount = 0;
  let createdCount = 0;
  let excludedCount = 0;

  for (const txn of transactions) {
    if (txn.creditAmount) totalCredits += parseFloat(txn.creditAmount);
    if (txn.debitAmount) totalDebits += parseFloat(txn.debitAmount);

    switch (txn.reconciliationStatus) {
      case 'pending': pendingCount++; break;
      case 'matched': matchedCount++; break;
      case 'created': createdCount++; break;
      case 'excluded': excludedCount++; break;
    }
  }

  return {
    totalTransactions: transactions.length,
    pendingCount,
    matchedCount,
    createdCount,
    excludedCount,
    totalCredits,
    totalDebits
  };
}
