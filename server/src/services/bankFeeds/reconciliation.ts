/**
 * Bank Feed Reconciliation Service
 *
 * Provides auto-matching of bank transactions to invoices, bills, and payments
 */

import { db } from '../../db';
import {
  bankFeedTransactions,
  invoices,
  bills,
  paymentsReceived,
  paymentsMade,
  expenses,
  journalEntries,
  journalEntryLines,
  chartOfAccounts,
  fiscalYears,
  type BankFeedTransaction
} from '../../../../shared/schema';
import { eq, and, sql, between, or, ilike, gte, lte } from 'drizzle-orm';

interface MatchResult {
  matchType: 'invoice' | 'bill' | 'payment_received' | 'payment_made' | 'expense' | 'journal_entry' | null;
  matchedId: string | null;
  matchedNumber: string | null;
  confidenceScore: number;
  matchReason: string;
}

interface ReconcileResult {
  transactionId: string;
  status: 'matched' | 'created' | 'excluded' | 'pending';
  journalEntryId?: string;
  matchedEntityType?: string;
  matchedEntityId?: string;
}

/**
 * Attempts to auto-match a bank transaction with existing records
 */
export async function findMatch(
  companyId: string,
  transaction: BankFeedTransaction
): Promise<MatchResult> {
  const amount = parseFloat(transaction.debitAmount || '0') || parseFloat(transaction.creditAmount || '0');
  const isCredit = !!transaction.creditAmount && parseFloat(transaction.creditAmount) > 0;
  const description = transaction.description.toLowerCase();
  const refNumber = transaction.referenceNumber?.toLowerCase() || '';
  const txnDate = new Date(transaction.transactionDate);

  // Date range for matching (±5 days)
  const dateFrom = new Date(txnDate);
  dateFrom.setDate(dateFrom.getDate() - 5);
  const dateTo = new Date(txnDate);
  dateTo.setDate(dateTo.getDate() + 5);

  // Match by reference number first (highest confidence)
  if (refNumber) {
    // Check invoices
    const invoiceByRef = await db.select()
      .from(invoices)
      .where(and(
        eq(invoices.companyId, companyId),
        ilike(invoices.invoiceNumber, `%${refNumber}%`)
      ))
      .limit(1);

    if (invoiceByRef.length > 0) {
      return {
        matchType: 'invoice',
        matchedId: invoiceByRef[0].id,
        matchedNumber: invoiceByRef[0].invoiceNumber,
        confidenceScore: 95,
        matchReason: 'Reference number matches invoice number'
      };
    }

    // Check bills
    const billByRef = await db.select()
      .from(bills)
      .where(and(
        eq(bills.companyId, companyId),
        or(
          ilike(bills.billNumber, `%${refNumber}%`),
          ilike(bills.vendorBillNumber || '', `%${refNumber}%`)
        )
      ))
      .limit(1);

    if (billByRef.length > 0) {
      return {
        matchType: 'bill',
        matchedId: billByRef[0].id,
        matchedNumber: billByRef[0].billNumber,
        confidenceScore: 95,
        matchReason: 'Reference number matches bill number'
      };
    }
  }

  // For credits (money received), match against open invoices
  if (isCredit) {
    const openInvoices = await db.select()
      .from(invoices)
      .where(and(
        eq(invoices.companyId, companyId),
        or(
          eq(invoices.status, 'sent'),
          eq(invoices.status, 'partially_paid'),
          eq(invoices.status, 'overdue')
        )
      ));

    // Exact amount match
    for (const invoice of openInvoices) {
      const balanceDue = parseFloat(invoice.balanceDue);
      if (Math.abs(balanceDue - amount) < 0.01) {
        return {
          matchType: 'invoice',
          matchedId: invoice.id,
          matchedNumber: invoice.invoiceNumber,
          confidenceScore: 90,
          matchReason: 'Amount matches invoice balance due exactly'
        };
      }
    }

    // Total amount match
    for (const invoice of openInvoices) {
      const totalAmount = parseFloat(invoice.totalAmount);
      if (Math.abs(totalAmount - amount) < 0.01) {
        return {
          matchType: 'invoice',
          matchedId: invoice.id,
          matchedNumber: invoice.invoiceNumber,
          confidenceScore: 85,
          matchReason: 'Amount matches invoice total amount'
        };
      }
    }

    // Check existing payments received
    const payments = await db.select()
      .from(paymentsReceived)
      .where(and(
        eq(paymentsReceived.companyId, companyId),
        between(paymentsReceived.paymentDate, dateFrom.toISOString().split('T')[0], dateTo.toISOString().split('T')[0])
      ));

    for (const payment of payments) {
      const paymentAmount = parseFloat(payment.amount);
      if (Math.abs(paymentAmount - amount) < 0.01) {
        return {
          matchType: 'payment_received',
          matchedId: payment.id,
          matchedNumber: payment.paymentNumber,
          confidenceScore: 88,
          matchReason: 'Amount matches existing payment received'
        };
      }
    }
  } else {
    // For debits (money paid), match against open bills
    const openBills = await db.select()
      .from(bills)
      .where(and(
        eq(bills.companyId, companyId),
        or(
          eq(bills.status, 'pending'),
          eq(bills.status, 'partially_paid'),
          eq(bills.status, 'overdue')
        )
      ));

    // Exact balance match
    for (const bill of openBills) {
      const balanceDue = parseFloat(bill.balanceDue);
      if (Math.abs(balanceDue - amount) < 0.01) {
        return {
          matchType: 'bill',
          matchedId: bill.id,
          matchedNumber: bill.billNumber,
          confidenceScore: 90,
          matchReason: 'Amount matches bill balance due exactly'
        };
      }
    }

    // Total amount match
    for (const bill of openBills) {
      const totalAmount = parseFloat(bill.totalAmount);
      if (Math.abs(totalAmount - amount) < 0.01) {
        return {
          matchType: 'bill',
          matchedId: bill.id,
          matchedNumber: bill.billNumber,
          confidenceScore: 85,
          matchReason: 'Amount matches bill total amount'
        };
      }
    }

    // Check existing payments made
    const paymentsMadeList = await db.select()
      .from(paymentsMade)
      .where(and(
        eq(paymentsMade.companyId, companyId),
        between(paymentsMade.paymentDate, dateFrom.toISOString().split('T')[0], dateTo.toISOString().split('T')[0])
      ));

    for (const payment of paymentsMadeList) {
      const paymentAmount = parseFloat(payment.amount);
      if (Math.abs(paymentAmount - amount) < 0.01) {
        return {
          matchType: 'payment_made',
          matchedId: payment.id,
          matchedNumber: payment.paymentNumber,
          confidenceScore: 88,
          matchReason: 'Amount matches existing payment made'
        };
      }
    }

    // Check expenses
    const expensesList = await db.select()
      .from(expenses)
      .where(and(
        eq(expenses.companyId, companyId),
        between(expenses.expenseDate, dateFrom.toISOString().split('T')[0], dateTo.toISOString().split('T')[0])
      ));

    for (const expense of expensesList) {
      const expenseAmount = parseFloat(expense.totalAmount);
      if (Math.abs(expenseAmount - amount) < 0.01) {
        return {
          matchType: 'expense',
          matchedId: expense.id,
          matchedNumber: expense.expenseNumber,
          confidenceScore: 85,
          matchReason: 'Amount matches existing expense'
        };
      }
    }
  }

  return {
    matchType: null,
    matchedId: null,
    matchedNumber: null,
    confidenceScore: 0,
    matchReason: 'No matching record found'
  };
}

/**
 * Reconciles a bank transaction by linking it to a matched record
 */
export async function reconcileTransaction(
  companyId: string,
  transactionId: string,
  matchType: string,
  matchedId: string
): Promise<ReconcileResult> {
  const [transaction] = await db.select()
    .from(bankFeedTransactions)
    .where(and(
      eq(bankFeedTransactions.id, transactionId),
      eq(bankFeedTransactions.companyId, companyId)
    ));

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  // Update the transaction with the match
  const updateData: Partial<BankFeedTransaction> = {
    reconciliationStatus: 'matched'
  };

  switch (matchType) {
    case 'invoice':
      updateData.matchedInvoiceId = matchedId;
      break;
    case 'bill':
      updateData.matchedBillId = matchedId;
      break;
    case 'expense':
      updateData.matchedExpenseId = matchedId;
      break;
    case 'payment_received':
      updateData.matchedPaymentReceivedId = matchedId;
      break;
    case 'payment_made':
      updateData.matchedPaymentMadeId = matchedId;
      break;
    case 'journal_entry':
      updateData.matchedJournalEntryId = matchedId;
      break;
  }

  await db.update(bankFeedTransactions)
    .set(updateData)
    .where(eq(bankFeedTransactions.id, transactionId));

  return {
    transactionId,
    status: 'matched',
    matchedEntityType: matchType,
    matchedEntityId: matchedId
  };
}

/**
 * Creates a journal entry from an unmatched bank transaction
 */
export async function createJournalEntryFromTransaction(
  companyId: string,
  userId: string,
  transactionId: string,
  accountId: string,
  partyId?: string
): Promise<ReconcileResult> {
  const [transaction] = await db.select()
    .from(bankFeedTransactions)
    .where(and(
      eq(bankFeedTransactions.id, transactionId),
      eq(bankFeedTransactions.companyId, companyId)
    ));

  if (!transaction) {
    throw new Error('Transaction not found');
  }

  // Get bank account's ledger account
  const bankAccount = await db.select()
    .from(chartOfAccounts)
    .where(and(
      eq(chartOfAccounts.companyId, companyId),
      eq(chartOfAccounts.id, transaction.bankAccountId || '')
    ))
    .limit(1);

  if (!bankAccount.length) {
    throw new Error('Bank account not found');
  }

  // Get current fiscal year
  const [fiscalYear] = await db.select()
    .from(fiscalYears)
    .where(and(
      eq(fiscalYears.companyId, companyId),
      eq(fiscalYears.isCurrent, true)
    ))
    .limit(1);

  if (!fiscalYear) {
    throw new Error('No active fiscal year found');
  }

  // Generate entry number
  const existingEntries = await db.select({ count: sql<number>`count(*)` })
    .from(journalEntries)
    .where(eq(journalEntries.fiscalYearId, fiscalYear.id));

  const count = existingEntries[0]?.count || 0;
  const entryNumber = `JV/${fiscalYear.name.replace('FY ', '')}/${String(Number(count) + 1).padStart(4, '0')}`;

  const amount = parseFloat(transaction.debitAmount || '0') || parseFloat(transaction.creditAmount || '0');
  const isCredit = !!transaction.creditAmount && parseFloat(transaction.creditAmount) > 0;

  // Create journal entry
  const [journalEntry] = await db.insert(journalEntries)
    .values({
      companyId,
      fiscalYearId: fiscalYear.id,
      entryNumber,
      entryDate: transaction.transactionDate,
      entryType: 'bank_import',
      narration: transaction.description,
      totalDebit: amount.toFixed(2),
      totalCredit: amount.toFixed(2),
      sourceType: 'bank_feed',
      sourceId: transactionId,
      status: 'posted',
      createdByUserId: userId
    })
    .returning();

  // Create journal entry lines
  const lines = [];

  if (isCredit) {
    // Money received: Debit Bank, Credit Account
    lines.push({
      journalEntryId: journalEntry.id,
      accountId: bankAccount[0].id,
      debitAmount: amount.toFixed(2),
      creditAmount: '0',
      description: transaction.description,
      partyId: partyId || null
    });
    lines.push({
      journalEntryId: journalEntry.id,
      accountId,
      debitAmount: '0',
      creditAmount: amount.toFixed(2),
      description: transaction.description,
      partyId: partyId || null
    });
  } else {
    // Money paid: Debit Account, Credit Bank
    lines.push({
      journalEntryId: journalEntry.id,
      accountId,
      debitAmount: amount.toFixed(2),
      creditAmount: '0',
      description: transaction.description,
      partyId: partyId || null
    });
    lines.push({
      journalEntryId: journalEntry.id,
      accountId: bankAccount[0].id,
      debitAmount: '0',
      creditAmount: amount.toFixed(2),
      description: transaction.description,
      partyId: partyId || null
    });
  }

  await db.insert(journalEntryLines).values(lines);

  // Update transaction status
  await db.update(bankFeedTransactions)
    .set({
      reconciliationStatus: 'created',
      matchedJournalEntryId: journalEntry.id
    })
    .where(eq(bankFeedTransactions.id, transactionId));

  return {
    transactionId,
    status: 'created',
    journalEntryId: journalEntry.id
  };
}

/**
 * Excludes a transaction from reconciliation
 */
export async function excludeTransaction(
  companyId: string,
  transactionId: string,
  reason?: string
): Promise<ReconcileResult> {
  await db.update(bankFeedTransactions)
    .set({
      reconciliationStatus: 'excluded',
      // Store reason in rawData if needed
    })
    .where(and(
      eq(bankFeedTransactions.id, transactionId),
      eq(bankFeedTransactions.companyId, companyId)
    ));

  return {
    transactionId,
    status: 'excluded'
  };
}

/**
 * Bulk auto-reconcile transactions
 */
export async function bulkAutoReconcile(
  companyId: string,
  transactionIds?: string[]
): Promise<{ processed: number; matched: number; created: number }> {
  let matched = 0;
  let processed = 0;

  // Get pending transactions
  let query = db.select()
    .from(bankFeedTransactions)
    .where(and(
      eq(bankFeedTransactions.companyId, companyId),
      eq(bankFeedTransactions.reconciliationStatus, 'pending')
    ));

  const transactions = await query;

  for (const transaction of transactions) {
    if (transactionIds && !transactionIds.includes(transaction.id)) {
      continue;
    }

    processed++;

    const match = await findMatch(companyId, transaction);

    if (match.matchType && match.matchedId && match.confidenceScore >= 85) {
      await reconcileTransaction(companyId, transaction.id, match.matchType, match.matchedId);
      matched++;
    }
  }

  return { processed, matched, created: 0 };
}
