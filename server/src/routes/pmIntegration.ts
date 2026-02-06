import { Router } from 'express';
import { db } from '../db';
import {
  pmIntegrationConfig, pmSyncLog, journalEntries, journalEntryLines,
  chartOfAccounts, parties, fiscalYears
} from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get integration config
router.get('/config', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const config = await db.query.pmIntegrationConfig.findFirst({
      where: eq(pmIntegrationConfig.companyId, req.companyId!),
      with: {
        defaultRevenueAccount: true,
        defaultBankAccount: true,
      },
    });

    res.json(config || null);
  } catch (error) {
    console.error('Get PM config error:', error);
    res.status(500).json({ error: 'Failed to get integration config' });
  }
});

// Create/Update integration config
router.post('/config', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      pmBaseUrl,
      apiKey,
      syncEnabled,
      autoSyncInvoices,
      autoSyncPayments,
      autoSyncExpenses,
      defaultRevenueAccountId,
      defaultBankAccountId,
      defaultExpenseAccountId,
      defaultReceivableAccountId,
    } = req.body;

    // Check if config exists
    const existing = await db.query.pmIntegrationConfig.findFirst({
      where: eq(pmIntegrationConfig.companyId, req.companyId!),
    });

    if (existing) {
      const [updated] = await db.update(pmIntegrationConfig)
        .set({
          pmBaseUrl,
          apiKey,
          syncEnabled,
          autoSyncInvoices,
          autoSyncPayments,
          autoSyncExpenses,
          defaultRevenueAccountId,
          defaultBankAccountId,
          defaultExpenseAccountId,
          defaultReceivableAccountId,
          updatedAt: new Date(),
        })
        .where(eq(pmIntegrationConfig.id, existing.id))
        .returning();

      return res.json(updated);
    }

    const [config] = await db.insert(pmIntegrationConfig).values({
      companyId: req.companyId!,
      pmBaseUrl,
      apiKey,
      syncEnabled,
      autoSyncInvoices,
      autoSyncPayments,
      autoSyncExpenses,
      defaultRevenueAccountId,
      defaultBankAccountId,
      defaultExpenseAccountId,
      defaultReceivableAccountId,
    }).returning();

    res.status(201).json(config);
  } catch (error) {
    console.error('Save PM config error:', error);
    res.status(500).json({ error: 'Failed to save integration config' });
  }
});

// Test connection
router.post('/test-connection', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const config = await db.query.pmIntegrationConfig.findFirst({
      where: eq(pmIntegrationConfig.companyId, req.companyId!),
    });

    if (!config || !config.pmBaseUrl || !config.apiKey) {
      return res.status(400).json({ error: 'Integration not configured' });
    }

    // Try to fetch from PM API
    const response = await fetch(`${config.pmBaseUrl}/api/health`, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
      },
    });

    if (response.ok) {
      res.json({ success: true, message: 'Connection successful' });
    } else {
      res.status(400).json({ error: 'Connection failed', status: response.status });
    }
  } catch (error) {
    console.error('Test connection error:', error);
    res.status(500).json({ error: 'Connection test failed' });
  }
});

// Get sync logs
router.get('/logs', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { entityType, status, limit = 50 } = req.query;

    let whereConditions = [eq(pmSyncLog.companyId, req.companyId!)];

    if (entityType) {
      whereConditions.push(eq(pmSyncLog.entityType, entityType as string));
    }
    if (status) {
      whereConditions.push(eq(pmSyncLog.syncStatus, status as string));
    }

    const logs = await db.query.pmSyncLog.findMany({
      where: and(...whereConditions),
      orderBy: desc(pmSyncLog.createdAt),
      limit: Number(limit),
    });

    res.json(logs);
  } catch (error) {
    console.error('Get sync logs error:', error);
    res.status(500).json({ error: 'Failed to get sync logs' });
  }
});

// Sync invoices from PM
router.post('/sync/invoices', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const config = await db.query.pmIntegrationConfig.findFirst({
      where: eq(pmIntegrationConfig.companyId, req.companyId!),
    });

    if (!config || !config.pmBaseUrl || !config.apiKey) {
      return res.status(400).json({ error: 'Integration not configured' });
    }

    // Fetch invoices from PM
    const response = await fetch(`${config.pmBaseUrl}/api/invoices?status=approved`, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
      },
    });

    if (!response.ok) {
      return res.status(400).json({ error: 'Failed to fetch invoices from PM' });
    }

    const invoices = await response.json();
    const results = { synced: 0, failed: 0, errors: [] as string[] };

    const fy = await db.query.fiscalYears.findFirst({
      where: and(
        eq(fiscalYears.companyId, req.companyId!),
        eq(fiscalYears.isCurrent, true)
      ),
    });

    if (!fy) {
      return res.status(400).json({ error: 'No current fiscal year' });
    }

    for (const invoice of invoices) {
      try {
        // Check if already synced
        const existing = await db.query.pmSyncLog.findFirst({
          where: and(
            eq(pmSyncLog.companyId, req.companyId!),
            eq(pmSyncLog.entityType, 'invoice'),
            eq(pmSyncLog.pmEntityId, invoice.id),
            eq(pmSyncLog.syncStatus, 'success')
          ),
        });

        if (existing) continue;

        // Create journal entry for invoice
        // Debit: Receivables, Credit: Revenue
        const entryNumber = `PM-INV/${invoice.invoiceNumber}`;

        // Find or create party
        let party = await db.query.parties.findFirst({
          where: and(
            eq(parties.companyId, req.companyId!),
            eq(parties.name, invoice.clientName)
          ),
        });

        if (!party) {
          [party] = await db.insert(parties).values({
            companyId: req.companyId!,
            partyType: 'customer',
            name: invoice.clientName,
            gstin: invoice.clientGstin,
          }).returning();
        }

        const [entry] = await db.insert(journalEntries).values({
          companyId: req.companyId!,
          fiscalYearId: fy.id,
          entryNumber,
          entryDate: invoice.invoiceDate,
          postingDate: invoice.invoiceDate,
          entryType: 'auto_invoice',
          narration: `Invoice ${invoice.invoiceNumber} - ${invoice.clientName}`,
          totalDebit: invoice.totalAmount.toFixed(2),
          totalCredit: invoice.totalAmount.toFixed(2),
          sourceType: 'practice_manager',
          sourceId: invoice.id,
          status: 'posted',
          createdByUserId: req.userId!,
        }).returning();

        // Create lines
        const lines = [
          {
            journalEntryId: entry.id,
            accountId: config.defaultReceivableAccountId!,
            debitAmount: invoice.totalAmount.toFixed(2),
            creditAmount: '0',
            partyId: party.id,
            partyType: 'customer' as const,
            description: `Invoice ${invoice.invoiceNumber}`,
            sortOrder: 0,
          },
          {
            journalEntryId: entry.id,
            accountId: config.defaultRevenueAccountId!,
            debitAmount: '0',
            creditAmount: invoice.taxableAmount.toFixed(2),
            description: 'Revenue from services',
            sortOrder: 1,
          },
        ];

        // Add GST lines if applicable
        if (invoice.cgstAmount > 0) {
          // Get CGST liability account
          const cgstAccount = await db.query.chartOfAccounts.findFirst({
            where: and(
              eq(chartOfAccounts.companyId, req.companyId!),
              eq(chartOfAccounts.code, '2231') // GST Output Liability
            ),
          });
          if (cgstAccount) {
            lines.push({
              journalEntryId: entry.id,
              accountId: cgstAccount.id,
              debitAmount: '0',
              creditAmount: invoice.cgstAmount.toFixed(2),
              description: 'CGST Output',
              sortOrder: 2,
              partyId: null as any,
              partyType: null as any,
            });
          }
        }

        if (invoice.sgstAmount > 0) {
          const sgstAccount = await db.query.chartOfAccounts.findFirst({
            where: and(
              eq(chartOfAccounts.companyId, req.companyId!),
              eq(chartOfAccounts.code, '2231')
            ),
          });
          if (sgstAccount) {
            lines.push({
              journalEntryId: entry.id,
              accountId: sgstAccount.id,
              debitAmount: '0',
              creditAmount: invoice.sgstAmount.toFixed(2),
              description: 'SGST Output',
              sortOrder: 3,
              partyId: null as any,
              partyType: null as any,
            });
          }
        }

        await db.insert(journalEntryLines).values(lines);

        // Log success
        await db.insert(pmSyncLog).values({
          companyId: req.companyId!,
          entityType: 'invoice',
          pmEntityId: invoice.id,
          zarabooksEntryId: entry.id,
          syncDirection: 'pull',
          syncStatus: 'success',
        });

        results.synced++;
      } catch (err: any) {
        results.failed++;
        results.errors.push(`Invoice ${invoice.invoiceNumber}: ${err.message}`);

        await db.insert(pmSyncLog).values({
          companyId: req.companyId!,
          entityType: 'invoice',
          pmEntityId: invoice.id,
          syncDirection: 'pull',
          syncStatus: 'failed',
          errorMessage: err.message,
        });
      }
    }

    // Update last sync time
    await db.update(pmIntegrationConfig)
      .set({ lastSyncAt: new Date() })
      .where(eq(pmIntegrationConfig.companyId, req.companyId!));

    res.json(results);
  } catch (error) {
    console.error('Sync invoices error:', error);
    res.status(500).json({ error: 'Failed to sync invoices' });
  }
});

// Sync payments from PM
router.post('/sync/payments', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const config = await db.query.pmIntegrationConfig.findFirst({
      where: eq(pmIntegrationConfig.companyId, req.companyId!),
    });

    if (!config || !config.pmBaseUrl || !config.apiKey) {
      return res.status(400).json({ error: 'Integration not configured' });
    }

    // Fetch payments from PM
    const response = await fetch(`${config.pmBaseUrl}/api/invoice-payments`, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
      },
    });

    if (!response.ok) {
      return res.status(400).json({ error: 'Failed to fetch payments from PM' });
    }

    const payments = await response.json();
    const results = { synced: 0, failed: 0, errors: [] as string[] };

    const fy = await db.query.fiscalYears.findFirst({
      where: and(
        eq(fiscalYears.companyId, req.companyId!),
        eq(fiscalYears.isCurrent, true)
      ),
    });

    if (!fy) {
      return res.status(400).json({ error: 'No current fiscal year' });
    }

    for (const payment of payments) {
      try {
        // Check if already synced
        const existing = await db.query.pmSyncLog.findFirst({
          where: and(
            eq(pmSyncLog.companyId, req.companyId!),
            eq(pmSyncLog.entityType, 'payment'),
            eq(pmSyncLog.pmEntityId, payment.id),
            eq(pmSyncLog.syncStatus, 'success')
          ),
        });

        if (existing) continue;

        const entryNumber = `PM-RCP/${payment.id.substring(0, 8)}`;

        // Find party
        const party = await db.query.parties.findFirst({
          where: and(
            eq(parties.companyId, req.companyId!),
            eq(parties.name, payment.clientName)
          ),
        });

        const [entry] = await db.insert(journalEntries).values({
          companyId: req.companyId!,
          fiscalYearId: fy.id,
          entryNumber,
          entryDate: payment.paymentDate,
          postingDate: payment.paymentDate,
          entryType: 'auto_payment',
          narration: `Receipt from ${payment.clientName} - ${payment.reference || ''}`,
          totalDebit: payment.amount.toFixed(2),
          totalCredit: payment.amount.toFixed(2),
          sourceType: 'practice_manager',
          sourceId: payment.id,
          status: 'posted',
          createdByUserId: req.userId!,
        }).returning();

        // Debit: Bank, Credit: Receivables
        await db.insert(journalEntryLines).values([
          {
            journalEntryId: entry.id,
            accountId: config.defaultBankAccountId!,
            debitAmount: payment.amount.toFixed(2),
            creditAmount: '0',
            description: `Receipt: ${payment.paymentMode}`,
            sortOrder: 0,
          },
          {
            journalEntryId: entry.id,
            accountId: config.defaultReceivableAccountId!,
            debitAmount: '0',
            creditAmount: payment.amount.toFixed(2),
            partyId: party?.id,
            partyType: 'customer',
            description: `Payment received`,
            sortOrder: 1,
          },
        ]);

        await db.insert(pmSyncLog).values({
          companyId: req.companyId!,
          entityType: 'payment',
          pmEntityId: payment.id,
          zarabooksEntryId: entry.id,
          syncDirection: 'pull',
          syncStatus: 'success',
        });

        results.synced++;
      } catch (err: any) {
        results.failed++;
        results.errors.push(`Payment ${payment.id}: ${err.message}`);

        await db.insert(pmSyncLog).values({
          companyId: req.companyId!,
          entityType: 'payment',
          pmEntityId: payment.id,
          syncDirection: 'pull',
          syncStatus: 'failed',
          errorMessage: err.message,
        });
      }
    }

    await db.update(pmIntegrationConfig)
      .set({ lastSyncAt: new Date() })
      .where(eq(pmIntegrationConfig.companyId, req.companyId!));

    res.json(results);
  } catch (error) {
    console.error('Sync payments error:', error);
    res.status(500).json({ error: 'Failed to sync payments' });
  }
});

// Import clients from PM
router.post('/import/clients', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const config = await db.query.pmIntegrationConfig.findFirst({
      where: eq(pmIntegrationConfig.companyId, req.companyId!),
    });

    if (!config || !config.pmBaseUrl || !config.apiKey) {
      return res.status(400).json({ error: 'Integration not configured' });
    }

    const response = await fetch(`${config.pmBaseUrl}/api/clients`, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
      },
    });

    if (!response.ok) {
      return res.status(400).json({ error: 'Failed to fetch clients from PM' });
    }

    const clients = await response.json();
    const results = { imported: 0, skipped: 0, errors: [] as string[] };

    for (const client of clients) {
      try {
        // Check if party exists
        const existing = await db.query.parties.findFirst({
          where: and(
            eq(parties.companyId, req.companyId!),
            eq(parties.name, client.name)
          ),
        });

        if (existing) {
          results.skipped++;
          continue;
        }

        await db.insert(parties).values({
          companyId: req.companyId!,
          partyType: 'customer',
          name: client.name,
          legalName: client.name,
          pan: client.pan,
          gstin: client.gstin,
          email: client.email,
          phone: client.phone,
          address: client.address,
          city: client.city,
          state: client.state,
          pincode: client.pincode,
        });

        results.imported++;
      } catch (err: any) {
        results.errors.push(`${client.name}: ${err.message}`);
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Import clients error:', error);
    res.status(500).json({ error: 'Failed to import clients' });
  }
});

export default router;
