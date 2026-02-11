import { Router } from 'express';
import { db } from '../db';
import { invoices, invoiceLines, fiscalYears, parties, journalEntries, journalEntryLines, chartOfAccounts } from '@shared/schema';
import { eq, and, desc, asc, sql, gte, lte } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';
import { z } from 'zod';

const invoiceLineSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  description: z.string().min(1, 'Description is required'),
  hsnSacCode: z.string().optional(),
  quantity: z.union([z.string(), z.number()]).transform(v => parseFloat(String(v))).pipe(z.number().positive('Quantity must be positive')),
  unitPrice: z.union([z.string(), z.number()]).transform(v => parseFloat(String(v))).pipe(z.number().min(0, 'Unit price must be >= 0')),
  discountPercent: z.union([z.string(), z.number()]).optional(),
  discountAmount: z.union([z.string(), z.number()]).optional(),
  taxRate: z.union([z.string(), z.number()]).optional(),
});

const createInvoiceSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  invoiceDate: z.string().min(1, 'Invoice date is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  billingAddress: z.string().optional(),
  shippingAddress: z.string().optional(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  lines: z.array(invoiceLineSchema).min(1, 'At least one line item is required'),
});

const recordPaymentSchema = z.object({
  amount: z.union([z.string(), z.number()]).transform(v => parseFloat(String(v))).pipe(z.number().positive('Amount must be positive')),
  paymentDate: z.string().optional(),
  paymentMethod: z.string().optional(),
  reference: z.string().optional(),
  bankAccountId: z.string().optional(),
});

const router = Router();

// Get all invoices
router.get('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, customerId, startDate, endDate, fiscalYearId } = req.query;

    let whereConditions = [eq(invoices.companyId, req.companyId!)];

    if (status) {
      whereConditions.push(eq(invoices.status, status as any));
    }
    if (customerId) {
      whereConditions.push(eq(invoices.customerId, customerId as string));
    }
    if (startDate) {
      whereConditions.push(gte(invoices.invoiceDate, startDate as string));
    }
    if (endDate) {
      whereConditions.push(lte(invoices.invoiceDate, endDate as string));
    }
    if (fiscalYearId) {
      whereConditions.push(eq(invoices.fiscalYearId, fiscalYearId as string));
    }

    const allInvoices = await db.query.invoices.findMany({
      where: and(...whereConditions),
      with: {
        customer: true,
        createdBy: true,
      },
      orderBy: [desc(invoices.invoiceDate), desc(invoices.createdAt)],
    });

    res.json(allInvoices);
  } catch (error) {
    console.error('Get invoices error:', error);
    res.status(500).json({ error: 'Failed to get invoices' });
  }
});

// Get invoice by ID
router.get('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const invoice = await db.query.invoices.findFirst({
      where: and(
        eq(invoices.id, id),
        eq(invoices.companyId, req.companyId!)
      ),
      with: {
        customer: true,
        fiscalYear: true,
        lines: {
          with: {
            account: true,
          },
          orderBy: asc(invoiceLines.sortOrder),
        },
        createdBy: true,
      },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json(invoice);
  } catch (error) {
    console.error('Get invoice error:', error);
    res.status(500).json({ error: 'Failed to get invoice' });
  }
});

// Create invoice
router.post('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const parseResult = createInvoiceSchema.safeParse(req.body);
    if (!parseResult.success) {
      const errors = parseResult.error.errors.map(e => e.message).join(', ');
      return res.status(400).json({ error: errors });
    }

    const {
      customerId,
      invoiceDate,
      dueDate,
      billingAddress,
      shippingAddress,
      notes,
      terms,
      lines,
    } = parseResult.data;

    // Get current fiscal year
    const fiscalYear = await db.query.fiscalYears.findFirst({
      where: and(
        eq(fiscalYears.companyId, req.companyId!),
        eq(fiscalYears.isCurrent, true)
      ),
    });

    if (!fiscalYear) {
      return res.status(400).json({ error: 'No active fiscal year found' });
    }

    // Generate invoice number
    const lastInvoice = await db.query.invoices.findFirst({
      where: eq(invoices.companyId, req.companyId!),
      orderBy: desc(invoices.createdAt),
    });

    const nextNumber = lastInvoice
      ? parseInt(lastInvoice.invoiceNumber.split('-').pop() || '0', 10) + 1
      : 1;
    const invoiceNumber = `INV-${fiscalYear.name.replace(/\s/g, '')}-${nextNumber.toString().padStart(5, '0')}`;

    // Calculate totals
    let subtotal = 0;
    let totalTax = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    const processedLines = lines.map((line: any, index: number) => {
      const quantity = parseFloat(line.quantity || 1);
      const unitPrice = parseFloat(line.unitPrice);
      const lineAmount = quantity * unitPrice;
      const discountAmount = line.discountPercent
        ? (lineAmount * parseFloat(line.discountPercent)) / 100
        : parseFloat(line.discountAmount || 0);
      const taxableAmount = lineAmount - discountAmount;
      const taxRate = parseFloat(line.taxRate || 0);
      const taxAmount = (taxableAmount * taxRate) / 100;

      // For now, split equally between CGST and SGST (intra-state)
      // In production, determine based on place of supply
      const cgst = taxAmount / 2;
      const sgst = taxAmount / 2;

      subtotal += taxableAmount;
      totalTax += taxAmount;
      totalCgst += cgst;
      totalSgst += sgst;

      return {
        ...line,
        quantity: quantity.toString(),
        unitPrice: unitPrice.toString(),
        discountAmount: discountAmount.toString(),
        taxAmount: taxAmount.toString(),
        amount: (taxableAmount + taxAmount).toString(),
        sortOrder: index,
      };
    });

    const totalAmount = subtotal + totalTax;

    // Create invoice and line items in a transaction
    const completeInvoice = await db.transaction(async (tx) => {
      const [invoice] = await tx.insert(invoices).values({
        companyId: req.companyId!,
        fiscalYearId: fiscalYear.id,
        invoiceNumber,
        invoiceDate,
        dueDate,
        customerId,
        billingAddress,
        shippingAddress,
        subtotal: subtotal.toString(),
        taxAmount: totalTax.toString(),
        cgst: totalCgst.toString(),
        sgst: totalSgst.toString(),
        igst: totalIgst.toString(),
        totalAmount: totalAmount.toString(),
        balanceDue: totalAmount.toString(),
        status: 'draft',
        notes,
        terms,
        createdByUserId: req.userId,
      }).returning();

      if (processedLines.length > 0) {
        await tx.insert(invoiceLines).values(
          processedLines.map((line: any) => ({
            invoiceId: invoice.id,
            accountId: line.accountId,
            description: line.description,
            hsnSacCode: line.hsnSacCode,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            discountPercent: line.discountPercent?.toString(),
            discountAmount: line.discountAmount,
            taxRate: line.taxRate?.toString(),
            taxAmount: line.taxAmount,
            amount: line.amount,
            sortOrder: line.sortOrder,
          }))
        );
      }

      return await tx.query.invoices.findFirst({
        where: eq(invoices.id, invoice.id),
        with: {
          customer: true,
          lines: true,
        },
      });
    });

    res.status(201).json(completeInvoice);
  } catch (error) {
    console.error('Create invoice error:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// Update invoice
router.patch('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const invoice = await db.query.invoices.findFirst({
      where: and(
        eq(invoices.id, id),
        eq(invoices.companyId, req.companyId!)
      ),
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Only allow updates to draft invoices
    if (invoice.status !== 'draft' && !['sent', 'partially_paid'].includes(updateData.status)) {
      return res.status(400).json({ error: 'Only draft invoices can be edited' });
    }

    const [updated] = await db.update(invoices)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Update invoice error:', error);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

// Mark invoice as sent
router.post('/:id/send', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const invoice = await db.query.invoices.findFirst({
      where: and(
        eq(invoices.id, id),
        eq(invoices.companyId, req.companyId!)
      ),
      with: {
        lines: true,
        customer: true,
      },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice.status !== 'draft') {
      return res.status(400).json({ error: 'Invoice has already been sent' });
    }

    // Create journal entry for the invoice
    const fiscalYear = await db.query.fiscalYears.findFirst({
      where: and(
        eq(fiscalYears.companyId, req.companyId!),
        eq(fiscalYears.isCurrent, true)
      ),
    });

    if (!fiscalYear) {
      return res.status(400).json({ error: 'No active fiscal year found' });
    }

    // Generate journal entry number
    const lastEntry = await db.query.journalEntries.findFirst({
      where: eq(journalEntries.companyId, req.companyId!),
      orderBy: desc(journalEntries.createdAt),
    });

    const nextNum = lastEntry
      ? parseInt(lastEntry.entryNumber.split('/').pop() || '0', 10) + 1
      : 1;
    const entryNumber = `INV/${fiscalYear.name.replace(/\s/g, '')}/${nextNum.toString().padStart(5, '0')}`;

    // Get accounts receivable account
    const arAccount = await db.query.chartOfAccounts.findFirst({
      where: and(
        eq(chartOfAccounts.companyId, req.companyId!),
        eq(chartOfAccounts.code, '1300') // Trade Receivables
      ),
    });

    if (!arAccount) {
      return res.status(400).json({ error: 'Accounts receivable account not found' });
    }

    // Create journal entry and update invoice in a transaction
    const updated = await db.transaction(async (tx) => {
      const [je] = await tx.insert(journalEntries).values({
        companyId: req.companyId!,
        fiscalYearId: fiscalYear.id,
        entryNumber,
        entryDate: invoice.invoiceDate,
        entryType: 'auto_invoice',
        narration: `Invoice ${invoice.invoiceNumber} - ${invoice.customer.name}`,
        totalDebit: invoice.totalAmount,
        totalCredit: invoice.totalAmount,
        sourceType: 'invoice',
        sourceId: invoice.id,
        status: 'posted',
        createdByUserId: req.userId,
      }).returning();

      const jeLines: any[] = [];

      // Debit: Accounts Receivable
      jeLines.push({
        journalEntryId: je.id,
        accountId: arAccount.id,
        debitAmount: invoice.totalAmount,
        creditAmount: '0',
        partyType: 'customer' as const,
        partyId: invoice.customerId,
        description: `Invoice ${invoice.invoiceNumber}`,
      });

      // Credit: Revenue accounts for each line item
      for (const line of invoice.lines) {
        if (line.accountId) {
          jeLines.push({
            journalEntryId: je.id,
            accountId: line.accountId,
            debitAmount: '0',
            creditAmount: line.amount,
            description: line.description,
          });
        }
      }

      await tx.insert(journalEntryLines).values(jeLines);

      const [inv] = await tx.update(invoices)
        .set({
          status: 'sent',
          journalEntryId: je.id,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, id))
        .returning();

      return inv;
    });

    res.json(updated);
  } catch (error) {
    console.error('Send invoice error:', error);
    res.status(500).json({ error: 'Failed to send invoice' });
  }
});

// Record payment
router.post('/:id/payment', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const paymentParse = recordPaymentSchema.safeParse(req.body);
    if (!paymentParse.success) {
      const errors = paymentParse.error.errors.map(e => e.message).join(', ');
      return res.status(400).json({ error: errors });
    }
    const { amount, paymentDate, paymentMethod, reference, bankAccountId } = paymentParse.data;

    const invoice = await db.query.invoices.findFirst({
      where: and(
        eq(invoices.id, id),
        eq(invoices.companyId, req.companyId!)
      ),
      with: {
        customer: true,
      },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (!['sent', 'partially_paid', 'overdue'].includes(invoice.status)) {
      return res.status(400).json({ error: 'Cannot record payment for this invoice' });
    }

    const paymentAmount = typeof amount === 'number' ? amount : parseFloat(amount);
    const currentPaid = parseFloat(invoice.paidAmount || '0');
    const totalAmount = parseFloat(invoice.totalAmount);
    const newPaidAmount = currentPaid + paymentAmount;
    const newBalanceDue = totalAmount - newPaidAmount;

    if (newPaidAmount > totalAmount) {
      return res.status(400).json({ error: 'Payment amount exceeds balance due' });
    }

    const newStatus = newBalanceDue === 0 ? 'paid' : 'partially_paid';

    // Update invoice and create journal entry in a transaction
    const updated = await db.transaction(async (tx) => {
      const [inv] = await tx.update(invoices)
        .set({
          paidAmount: newPaidAmount.toString(),
          balanceDue: newBalanceDue.toString(),
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, id))
        .returning();

      // Create journal entry for payment (if bank account provided)
      if (bankAccountId) {
        const fiscalYear = await tx.query.fiscalYears.findFirst({
          where: and(
            eq(fiscalYears.companyId, req.companyId!),
            eq(fiscalYears.isCurrent, true)
          ),
        });

        if (fiscalYear) {
          const lastEntry = await tx.query.journalEntries.findFirst({
            where: eq(journalEntries.companyId, req.companyId!),
            orderBy: desc(journalEntries.createdAt),
          });

          const nextNum = lastEntry
            ? parseInt(lastEntry.entryNumber.split('/').pop() || '0', 10) + 1
            : 1;
          const entryNumber = `RCV/${fiscalYear.name.replace(/\s/g, '')}/${nextNum.toString().padStart(5, '0')}`;

          const arAccount = await tx.query.chartOfAccounts.findFirst({
            where: and(
              eq(chartOfAccounts.companyId, req.companyId!),
              eq(chartOfAccounts.code, '1300')
            ),
          });

          if (arAccount) {
            const [je] = await tx.insert(journalEntries).values({
              companyId: req.companyId!,
              fiscalYearId: fiscalYear.id,
              entryNumber,
              entryDate: paymentDate || new Date().toISOString().split('T')[0],
              entryType: 'auto_payment',
              narration: `Payment received for Invoice ${invoice.invoiceNumber} - ${invoice.customer.name}`,
              totalDebit: paymentAmount.toString(),
              totalCredit: paymentAmount.toString(),
              status: 'posted',
              createdByUserId: req.userId,
            }).returning();

            await tx.insert(journalEntryLines).values([
              {
                journalEntryId: je.id,
                accountId: bankAccountId,
                debitAmount: paymentAmount.toString(),
                creditAmount: '0',
                description: `Payment - ${reference || invoice.invoiceNumber}`,
              },
              {
                journalEntryId: je.id,
                accountId: arAccount.id,
                debitAmount: '0',
                creditAmount: paymentAmount.toString(),
                partyType: 'customer' as const,
                partyId: invoice.customerId,
                description: `Payment - ${invoice.invoiceNumber}`,
              },
            ]);
          }
        }
      }

      return inv;
    });

    res.json(updated);
  } catch (error) {
    console.error('Record payment error:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// Get invoice stats
router.get('/stats/summary', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await db
      .select({
        status: invoices.status,
        count: sql<number>`count(*)`,
        total: sql<string>`COALESCE(SUM(${invoices.totalAmount}), 0)`,
        outstanding: sql<string>`COALESCE(SUM(${invoices.balanceDue}), 0)`,
      })
      .from(invoices)
      .where(eq(invoices.companyId, req.companyId!))
      .groupBy(invoices.status);

    const stats = {
      totalInvoiced: 0,
      totalPaid: 0,
      totalOutstanding: 0,
      drafts: 0,
      byStatus: {} as Record<string, { count: number; total: number; outstanding: number }>,
    };

    for (const row of result) {
      stats.byStatus[row.status] = {
        count: Number(row.count),
        total: parseFloat(row.total),
        outstanding: parseFloat(row.outstanding),
      };
      stats.totalInvoiced += parseFloat(row.total);
      stats.totalOutstanding += parseFloat(row.outstanding);
      if (row.status === 'draft') {
        stats.drafts = Number(row.count);
      }
    }

    stats.totalPaid = stats.totalInvoiced - stats.totalOutstanding;

    res.json(stats);
  } catch (error) {
    console.error('Get invoice stats error:', error);
    res.status(500).json({ error: 'Failed to get invoice stats' });
  }
});

// Cancel invoice
router.post('/:id/cancel', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const invoice = await db.query.invoices.findFirst({
      where: and(
        eq(invoices.id, id),
        eq(invoices.companyId, req.companyId!)
      ),
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice.status !== 'sent') {
      return res.status(400).json({ error: 'Only sent invoices can be cancelled' });
    }

    if (parseFloat(invoice.paidAmount || '0') > 0) {
      return res.status(400).json({ error: 'Cannot cancel invoice with payments. Remove payments first.' });
    }

    // Reverse journal entries
    const relatedJournals = await db.query.journalEntries.findMany({
      where: and(
        eq(journalEntries.companyId, req.companyId!),
        eq(journalEntries.referenceType, 'invoice'),
        eq(journalEntries.referenceId, id)
      ),
    });

    for (const je of relatedJournals) {
      await db.delete(journalEntryLines).where(eq(journalEntryLines.journalEntryId, je.id));
      await db.delete(journalEntries).where(eq(journalEntries.id, je.id));
    }

    const [updated] = await db.update(invoices)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Cancel invoice error:', error);
    res.status(500).json({ error: 'Failed to cancel invoice' });
  }
});

// Delete invoice (only drafts)
router.delete('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const invoice = await db.query.invoices.findFirst({
      where: and(
        eq(invoices.id, id),
        eq(invoices.companyId, req.companyId!)
      ),
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft invoices can be deleted' });
    }

    await db.transaction(async (tx) => {
      await tx.delete(invoiceLines).where(eq(invoiceLines.invoiceId, id));
      await tx.delete(invoices).where(eq(invoices.id, id));
    });

    res.json({ message: 'Invoice deleted' });
  } catch (error) {
    console.error('Delete invoice error:', error);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

export default router;
