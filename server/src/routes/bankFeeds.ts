/**
 * Bank Feeds Routes
 *
 * Handles bank feed transactions, categorization, and reconciliation
 */

import { Router } from 'express';
import { db } from '../db';
import {
  bankConnections,
  bankFeedTransactions,
  categorizationRules,
  bankAccounts,
  chartOfAccounts,
  parties
} from '@shared/schema';
import { eq, and, desc, sql, or, ilike } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';
import {
  importTransactions,
  parseCSV,
  getBankFeedSummary,
  categorizeTransaction,
  bulkCategorize,
  createRuleFromTransaction
} from '../services/bankFeeds';
import {
  findMatch,
  reconcileTransaction,
  createJournalEntryFromTransaction,
  excludeTransaction,
  bulkAutoReconcile
} from '../services/bankFeeds/reconciliation';

const router = Router();

// ==================== BANK CONNECTIONS ====================

// Get all bank connections
router.get('/connections', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const connections = await db.select()
      .from(bankConnections)
      .where(eq(bankConnections.companyId, req.companyId!))
      .orderBy(desc(bankConnections.createdAt));

    res.json(connections);
  } catch (error) {
    console.error('Error fetching bank connections:', error);
    res.status(500).json({ error: 'Failed to fetch bank connections' });
  }
});

// Create bank connection
router.post('/connections', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { bankAccountId, bankName, connectionType, provider, syncFrequency } = req.body;

    const [connection] = await db.insert(bankConnections)
      .values({
        companyId: req.companyId!,
        bankAccountId,
        bankName,
        connectionType,
        provider,
        syncFrequency: syncFrequency || 'daily',
        isActive: true
      })
      .returning();

    res.status(201).json(connection);
  } catch (error) {
    console.error('Error creating bank connection:', error);
    res.status(500).json({ error: 'Failed to create bank connection' });
  }
});

// Delete bank connection
router.delete('/connections/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    await db.delete(bankConnections)
      .where(and(
        eq(bankConnections.id, req.params.id),
        eq(bankConnections.companyId, req.companyId!)
      ));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting bank connection:', error);
    res.status(500).json({ error: 'Failed to delete bank connection' });
  }
});

// ==================== BANK FEED TRANSACTIONS ====================

// Get bank feed summary
router.get('/summary', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const summary = await getBankFeedSummary(req.companyId!);
    res.json(summary);
  } catch (error) {
    console.error('Error fetching bank feed summary:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// Get all bank feed transactions
router.get('/transactions', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, bankAccountId, startDate, endDate, search } = req.query;

    let query = db.select({
      transaction: bankFeedTransactions,
      suggestedAccount: chartOfAccounts,
      suggestedParty: parties,
      bankAccount: bankAccounts
    })
      .from(bankFeedTransactions)
      .leftJoin(chartOfAccounts, eq(bankFeedTransactions.suggestedAccountId, chartOfAccounts.id))
      .leftJoin(parties, eq(bankFeedTransactions.suggestedPartyId, parties.id))
      .leftJoin(bankAccounts, eq(bankFeedTransactions.bankAccountId, bankAccounts.id))
      .where(eq(bankFeedTransactions.companyId, req.companyId!))
      .orderBy(desc(bankFeedTransactions.transactionDate));

    const transactions = await query;

    // Apply filters
    let filtered = transactions;

    if (status && status !== 'all') {
      filtered = filtered.filter(t => t.transaction.reconciliationStatus === status);
    }

    if (bankAccountId) {
      filtered = filtered.filter(t => t.transaction.bankAccountId === bankAccountId);
    }

    if (startDate) {
      filtered = filtered.filter(t => t.transaction.transactionDate >= startDate);
    }

    if (endDate) {
      filtered = filtered.filter(t => t.transaction.transactionDate <= endDate);
    }

    if (search) {
      const searchLower = (search as string).toLowerCase();
      filtered = filtered.filter(t =>
        t.transaction.description.toLowerCase().includes(searchLower) ||
        t.transaction.referenceNumber?.toLowerCase().includes(searchLower)
      );
    }

    res.json(filtered.map(row => ({
      ...row.transaction,
      suggestedAccount: row.suggestedAccount,
      suggestedParty: row.suggestedParty,
      bankAccount: row.bankAccount
    })));
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Import CSV transactions
router.post('/import', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { csvContent, bankAccountId, connectionId } = req.body;

    if (!csvContent || !bankAccountId) {
      return res.status(400).json({ error: 'CSV content and bank account ID required' });
    }

    const parsedTransactions = parseCSV(csvContent);

    if (parsedTransactions.length === 0) {
      return res.status(400).json({ error: 'No valid transactions found in CSV' });
    }

    const result = await importTransactions(
      req.companyId!,
      bankAccountId,
      parsedTransactions,
      connectionId
    );

    res.json({
      message: `Imported ${result.imported} transactions`,
      ...result
    });
  } catch (error) {
    console.error('Error importing transactions:', error);
    res.status(500).json({ error: 'Failed to import transactions' });
  }
});

// Categorize a transaction
router.post('/transactions/:id/categorize', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { accountId, partyId, createRule } = req.body;

    // Update transaction
    await db.update(bankFeedTransactions)
      .set({
        suggestedAccountId: accountId,
        suggestedPartyId: partyId,
        categorizationSource: 'manual',
        confidenceScore: '100'
      })
      .where(and(
        eq(bankFeedTransactions.id, req.params.id),
        eq(bankFeedTransactions.companyId, req.companyId!)
      ));

    // Optionally create a rule
    if (createRule) {
      const [transaction] = await db.select()
        .from(bankFeedTransactions)
        .where(eq(bankFeedTransactions.id, req.params.id));

      if (transaction) {
        await createRuleFromTransaction(
          req.companyId!,
          req.userId!,
          transaction,
          accountId,
          partyId
        );
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error categorizing transaction:', error);
    res.status(500).json({ error: 'Failed to categorize transaction' });
  }
});

// Auto-categorize pending transactions
router.post('/auto-categorize', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { transactionIds } = req.body;

    // Get pending transactions
    const pendingTxns = await db.select()
      .from(bankFeedTransactions)
      .where(and(
        eq(bankFeedTransactions.companyId, req.companyId!),
        eq(bankFeedTransactions.reconciliationStatus, 'pending')
      ));

    const ids = transactionIds || pendingTxns.map(t => t.id);
    const result = await bulkCategorize(req.companyId!, ids);

    res.json({
      message: `Categorized ${result.categorized} of ${result.processed} transactions`,
      ...result
    });
  } catch (error) {
    console.error('Error auto-categorizing:', error);
    res.status(500).json({ error: 'Failed to auto-categorize transactions' });
  }
});

// ==================== RECONCILIATION ====================

// Find match for a transaction
router.get('/transactions/:id/match', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const [transaction] = await db.select()
      .from(bankFeedTransactions)
      .where(and(
        eq(bankFeedTransactions.id, req.params.id),
        eq(bankFeedTransactions.companyId, req.companyId!)
      ));

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const match = await findMatch(req.companyId!, transaction);
    res.json(match);
  } catch (error) {
    console.error('Error finding match:', error);
    res.status(500).json({ error: 'Failed to find match' });
  }
});

// Reconcile a transaction
router.post('/transactions/:id/reconcile', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { matchType, matchedId } = req.body;

    if (!matchType || !matchedId) {
      return res.status(400).json({ error: 'Match type and matched ID required' });
    }

    const result = await reconcileTransaction(
      req.companyId!,
      req.params.id,
      matchType,
      matchedId
    );

    res.json(result);
  } catch (error) {
    console.error('Error reconciling transaction:', error);
    res.status(500).json({ error: 'Failed to reconcile transaction' });
  }
});

// Create journal entry from transaction
router.post('/transactions/:id/create-entry', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { accountId, partyId } = req.body;

    if (!accountId) {
      return res.status(400).json({ error: 'Account ID required' });
    }

    const result = await createJournalEntryFromTransaction(
      req.companyId!,
      req.userId!,
      req.params.id,
      accountId,
      partyId
    );

    res.json(result);
  } catch (error) {
    console.error('Error creating entry:', error);
    res.status(500).json({ error: 'Failed to create journal entry' });
  }
});

// Exclude a transaction
router.post('/transactions/:id/exclude', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { reason } = req.body;
    const result = await excludeTransaction(req.companyId!, req.params.id, reason);
    res.json(result);
  } catch (error) {
    console.error('Error excluding transaction:', error);
    res.status(500).json({ error: 'Failed to exclude transaction' });
  }
});

// Bulk auto-reconcile
router.post('/auto-reconcile', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { transactionIds } = req.body;
    const result = await bulkAutoReconcile(req.companyId!, transactionIds);

    res.json({
      message: `Matched ${result.matched} of ${result.processed} transactions`,
      ...result
    });
  } catch (error) {
    console.error('Error auto-reconciling:', error);
    res.status(500).json({ error: 'Failed to auto-reconcile' });
  }
});

// ==================== CATEGORIZATION RULES ====================

// Get categorization rules
router.get('/rules', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const rules = await db.select({
      rule: categorizationRules,
      targetAccount: chartOfAccounts,
      targetParty: parties
    })
      .from(categorizationRules)
      .leftJoin(chartOfAccounts, eq(categorizationRules.targetAccountId, chartOfAccounts.id))
      .leftJoin(parties, eq(categorizationRules.targetPartyId, parties.id))
      .where(eq(categorizationRules.companyId, req.companyId!))
      .orderBy(desc(categorizationRules.priority));

    res.json(rules.map(row => ({
      ...row.rule,
      targetAccount: row.targetAccount,
      targetParty: row.targetParty
    })));
  } catch (error) {
    console.error('Error fetching rules:', error);
    res.status(500).json({ error: 'Failed to fetch rules' });
  }
});

// Create categorization rule
router.post('/rules', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { ruleName, priority, conditions, targetAccountId, targetPartyId } = req.body;

    const [rule] = await db.insert(categorizationRules)
      .values({
        companyId: req.companyId!,
        ruleName,
        priority: priority || 0,
        conditions,
        targetAccountId,
        targetPartyId,
        isActive: true,
        createdByUserId: req.userId!
      })
      .returning();

    res.status(201).json(rule);
  } catch (error) {
    console.error('Error creating rule:', error);
    res.status(500).json({ error: 'Failed to create rule' });
  }
});

// Update categorization rule
router.patch('/rules/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const updates = req.body;

    const [rule] = await db.update(categorizationRules)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(and(
        eq(categorizationRules.id, req.params.id),
        eq(categorizationRules.companyId, req.companyId!)
      ))
      .returning();

    res.json(rule);
  } catch (error) {
    console.error('Error updating rule:', error);
    res.status(500).json({ error: 'Failed to update rule' });
  }
});

// Delete categorization rule
router.delete('/rules/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    await db.delete(categorizationRules)
      .where(and(
        eq(categorizationRules.id, req.params.id),
        eq(categorizationRules.companyId, req.companyId!)
      ));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting rule:', error);
    res.status(500).json({ error: 'Failed to delete rule' });
  }
});

export default router;
