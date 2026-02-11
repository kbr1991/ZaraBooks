/**
 * Bank Feed Transaction Categorization Service
 *
 * Provides AI-powered and rule-based categorization for bank transactions
 */

import { db } from '../../db';
import {
  categorizationRules,
  bankFeedTransactions,
  chartOfAccounts,
  parties,
  type CategorizationRule,
  type BankFeedTransaction
} from '../../../../shared/schema';
import { eq, and, desc, sql, ilike } from 'drizzle-orm';

interface CategorizationResult {
  accountId: string | null;
  partyId: string | null;
  confidenceScore: number;
  source: 'rule' | 'ml' | 'manual';
  ruleName?: string;
}

interface RuleCondition {
  field: 'description' | 'referenceNumber' | 'amount';
  operator: 'contains' | 'equals' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than';
  value: string | number;
  caseSensitive?: boolean;
}

/**
 * Applies categorization rules to a transaction
 */
export async function categorizeTransaction(
  companyId: string,
  transaction: {
    description: string;
    referenceNumber?: string | null;
    debitAmount?: string | null;
    creditAmount?: string | null;
  }
): Promise<CategorizationResult> {
  // Fetch active rules for the company, ordered by priority
  const rules = await db.select()
    .from(categorizationRules)
    .where(and(
      eq(categorizationRules.companyId, companyId),
      eq(categorizationRules.isActive, true)
    ))
    .orderBy(desc(categorizationRules.priority));

  // Try each rule in priority order
  for (const rule of rules) {
    if (matchesRule(transaction, rule.conditions as RuleCondition[])) {
      // Update rule usage count
      await db.update(categorizationRules)
        .set({
          usageCount: sql`${categorizationRules.usageCount} + 1`,
          lastUsedAt: new Date()
        })
        .where(eq(categorizationRules.id, rule.id));

      return {
        accountId: rule.targetAccountId,
        partyId: rule.targetPartyId,
        confidenceScore: 95, // High confidence for rule matches
        source: 'rule',
        ruleName: rule.ruleName
      };
    }
  }

  // Fall back to ML-based categorization using keyword matching
  const mlResult = await mlCategorize(companyId, transaction.description);
  if (mlResult) {
    return mlResult;
  }

  // No categorization found
  return {
    accountId: null,
    partyId: null,
    confidenceScore: 0,
    source: 'manual'
  };
}

/**
 * Checks if a transaction matches all conditions of a rule
 */
function matchesRule(
  transaction: { description: string; referenceNumber?: string | null; debitAmount?: string | null; creditAmount?: string | null },
  conditions: RuleCondition[]
): boolean {
  if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
    return false;
  }

  return conditions.every(condition => {
    let fieldValue: string | number;

    switch (condition.field) {
      case 'description':
        fieldValue = transaction.description || '';
        break;
      case 'referenceNumber':
        fieldValue = transaction.referenceNumber || '';
        break;
      case 'amount':
        fieldValue = parseFloat(transaction.debitAmount || transaction.creditAmount || '0');
        break;
      default:
        return false;
    }

    const conditionValue = condition.value;
    const caseSensitive = condition.caseSensitive ?? false;

    // For string comparisons
    if (typeof fieldValue === 'string' && typeof conditionValue === 'string') {
      const compareFieldValue = caseSensitive ? fieldValue : fieldValue.toLowerCase();
      const compareCondValue = caseSensitive ? conditionValue : conditionValue.toLowerCase();

      switch (condition.operator) {
        case 'contains':
          return compareFieldValue.includes(compareCondValue);
        case 'equals':
          return compareFieldValue === compareCondValue;
        case 'starts_with':
          return compareFieldValue.startsWith(compareCondValue);
        case 'ends_with':
          return compareFieldValue.endsWith(compareCondValue);
        default:
          return false;
      }
    }

    // For numeric comparisons
    if (typeof fieldValue === 'number' && typeof conditionValue === 'number') {
      switch (condition.operator) {
        case 'equals':
          return fieldValue === conditionValue;
        case 'greater_than':
          return fieldValue > conditionValue;
        case 'less_than':
          return fieldValue < conditionValue;
        default:
          return false;
      }
    }

    return false;
  });
}

/**
 * ML-based categorization using keyword matching and historical patterns
 */
async function mlCategorize(
  companyId: string,
  description: string
): Promise<CategorizationResult | null> {
  // Common keyword patterns for Indian businesses
  const keywordPatterns: { keywords: string[]; accountType: string; accountName: string }[] = [
    // Bank charges
    { keywords: ['charges', 'sms charges', 'maintenance', 'service charge'], accountType: 'expense', accountName: 'Bank Charges' },
    // Interest
    { keywords: ['interest credit', 'int cred', 'interest paid'], accountType: 'income', accountName: 'Interest Income' },
    { keywords: ['interest debit', 'int paid', 'loan interest'], accountType: 'expense', accountName: 'Interest Expense' },
    // Salary
    { keywords: ['salary', 'sal credit', 'neft-sal'], accountType: 'income', accountName: 'Salary Income' },
    // UPI/IMPS patterns
    { keywords: ['upi/', 'upi-', 'imps/', 'neft/', 'rtgs/'], accountType: 'income', accountName: 'Sales' },
    // E-commerce
    { keywords: ['amazon', 'flipkart', 'meesho', 'swiggy', 'zomato'], accountType: 'expense', accountName: 'Office Expenses' },
    // Utilities
    { keywords: ['electricity', 'power', 'bescom', 'tata power'], accountType: 'expense', accountName: 'Electricity Expenses' },
    { keywords: ['telephone', 'mobile', 'airtel', 'jio', 'vodafone'], accountType: 'expense', accountName: 'Telephone Expenses' },
    // Rent
    { keywords: ['rent', 'lease'], accountType: 'expense', accountName: 'Rent Expense' },
    // Insurance
    { keywords: ['insurance', 'lic', 'hdfc life', 'icici prudential'], accountType: 'expense', accountName: 'Insurance Expense' },
    // GST
    { keywords: ['gst', 'cgst', 'sgst', 'igst', 'gstr'], accountType: 'liability', accountName: 'GST Payable' },
    // TDS
    { keywords: ['tds', 'tax deducted'], accountType: 'asset', accountName: 'TDS Receivable' },
  ];

  const lowerDesc = description.toLowerCase();

  for (const pattern of keywordPatterns) {
    if (pattern.keywords.some(keyword => lowerDesc.includes(keyword))) {
      // Find matching account
      const accounts = await db.select()
        .from(chartOfAccounts)
        .where(and(
          eq(chartOfAccounts.companyId, companyId),
          eq(chartOfAccounts.isActive, true),
          ilike(chartOfAccounts.name, `%${pattern.accountName}%`)
        ))
        .limit(1);

      if (accounts.length > 0) {
        return {
          accountId: accounts[0].id,
          partyId: null,
          confidenceScore: 70,
          source: 'ml'
        };
      }
    }
  }

  // Try to match party from description
  const partyMatch = await matchPartyFromDescription(companyId, description);
  if (partyMatch) {
    return partyMatch;
  }

  return null;
}

/**
 * Attempts to match a party from the transaction description
 */
async function matchPartyFromDescription(
  companyId: string,
  description: string
): Promise<CategorizationResult | null> {
  const lowerDesc = description.toLowerCase();

  // Search for parties whose name appears in the description
  const matchingParties = await db.select()
    .from(parties)
    .where(and(
      eq(parties.companyId, companyId),
      eq(parties.isActive, true)
    ));

  for (const party of matchingParties) {
    const partyName = party.name.toLowerCase();
    // Check if party name (or significant part of it) is in description
    if (partyName.length > 3 && lowerDesc.includes(partyName)) {
      return {
        accountId: party.defaultAccountId,
        partyId: party.id,
        confidenceScore: 75,
        source: 'ml'
      };
    }
  }

  return null;
}

/**
 * Creates a new categorization rule from a user's manual categorization
 */
export async function createRuleFromTransaction(
  companyId: string,
  userId: string,
  transaction: BankFeedTransaction,
  targetAccountId: string | null,
  targetPartyId: string | null
): Promise<CategorizationRule | null> {
  // Extract keywords from description
  const keywords = extractKeywords(transaction.description);

  if (keywords.length === 0) {
    return null;
  }

  // Create a rule with the first significant keyword
  const primaryKeyword = keywords[0];
  const conditions: RuleCondition[] = [
    {
      field: 'description',
      operator: 'contains',
      value: primaryKeyword,
      caseSensitive: false
    }
  ];

  // Get next priority
  const existingRules = await db.select()
    .from(categorizationRules)
    .where(eq(categorizationRules.companyId, companyId))
    .orderBy(desc(categorizationRules.priority))
    .limit(1);

  const nextPriority = existingRules.length > 0 ? (existingRules[0].priority || 0) + 1 : 1;

  const [newRule] = await db.insert(categorizationRules)
    .values({
      companyId,
      ruleName: `Auto-rule: ${primaryKeyword}`,
      priority: nextPriority,
      conditions,
      targetAccountId,
      targetPartyId,
      isActive: true,
      createdByUserId: userId
    })
    .returning();

  return newRule;
}

/**
 * Extracts significant keywords from a transaction description
 */
function extractKeywords(description: string): string[] {
  // Common words to ignore
  const stopWords = new Set([
    'the', 'and', 'for', 'from', 'to', 'of', 'in', 'on', 'at', 'by',
    'upi', 'neft', 'rtgs', 'imps', 'ref', 'no', 'ref no', 'txn',
    'credit', 'debit', 'transfer', 'payment', 'received'
  ]);

  // Split description into words
  const words = description
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 3 && !stopWords.has(word));

  // Return unique keywords
  return [...new Set(words)];
}

/**
 * Bulk categorize multiple transactions
 */
export async function bulkCategorize(
  companyId: string,
  transactionIds: string[]
): Promise<{ processed: number; categorized: number }> {
  let categorized = 0;

  for (const id of transactionIds) {
    const [transaction] = await db.select()
      .from(bankFeedTransactions)
      .where(and(
        eq(bankFeedTransactions.id, id),
        eq(bankFeedTransactions.companyId, companyId)
      ));

    if (!transaction) continue;

    const result = await categorizeTransaction(companyId, {
      description: transaction.description,
      referenceNumber: transaction.referenceNumber,
      debitAmount: transaction.debitAmount,
      creditAmount: transaction.creditAmount
    });

    if (result.accountId || result.partyId) {
      await db.update(bankFeedTransactions)
        .set({
          suggestedAccountId: result.accountId,
          suggestedPartyId: result.partyId,
          confidenceScore: result.confidenceScore.toString(),
          categorizationSource: result.source
        })
        .where(eq(bankFeedTransactions.id, id));

      categorized++;
    }
  }

  return { processed: transactionIds.length, categorized };
}
