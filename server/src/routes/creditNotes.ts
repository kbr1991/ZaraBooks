import { Router } from 'express';
import { db } from '../db';
import { creditNotes, creditNoteLines, fiscalYears, invoices, journalEntries, journalEntryLines, chartOfAccounts } from '@shared/schema';
import { eq, and, desc, asc, gte, lte } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all credit notes
router.get('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, customerId, startDate, endDate } = req.query;

    let whereConditions = [eq(creditNotes.companyId, req.companyId!)];

    if (status && status !== 'all') {
      whereConditions.push(eq(creditNotes.status, status as any));
    }
    if (customerId) {
      whereConditions.push(eq(creditNotes.customerId, customerId as string));
    }
    if (startDate) {
      whereConditions.push(gte(creditNotes.creditNoteDate, startDate as string));
    }
    if (endDate) {
      whereConditions.push(lte(creditNotes.creditNoteDate, endDate as string));
    }

    const allNotes = await db.query.creditNotes.findMany({
      where: and(...whereConditions),
      with: {
        customer: true,
        originalInvoice: true,
        createdBy: true,
      },
      orderBy: [desc(creditNotes.creditNoteDate), desc(creditNotes.createdAt)],
    });

    // Transform for frontend
    const transformed = allNotes.map(cn => ({
      id: cn.id,
      creditNoteNumber: cn.creditNoteNumber,
      creditNoteDate: cn.creditNoteDate,
      customerId: cn.customerId,
      customerName: cn.customer?.name || 'Unknown',
      originalInvoiceNumber: cn.originalInvoice?.invoiceNumber,
      reason: cn.reason,
      subtotal: cn.subtotal,
      taxAmount: cn.taxAmount,
      totalAmount: cn.totalAmount,
      status: cn.status,
    }));

    res.json(transformed);
  } catch (error) {
    console.error('Get credit notes error:', error);
    res.status(500).json({ error: 'Failed to get credit notes' });
  }
});

// Get credit note by ID
router.get('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const note = await db.query.creditNotes.findFirst({
      where: and(
        eq(creditNotes.id, id),
        eq(creditNotes.companyId, req.companyId!)
      ),
      with: {
        customer: true,
        originalInvoice: true,
        fiscalYear: true,
        lines: {
          with: {
            product: true,
            account: true,
          },
          orderBy: asc(creditNoteLines.sortOrder),
        },
        journalEntry: true,
        createdBy: true,
      },
    });

    if (!note) {
      return res.status(404).json({ error: 'Credit note not found' });
    }

    res.json(note);
  } catch (error) {
    console.error('Get credit note error:', error);
    res.status(500).json({ error: 'Failed to get credit note' });
  }
});

// Create credit note
router.post('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      customerId,
      creditNoteDate,
      originalInvoiceId,
      reason,
      notes,
      items = [],
    } = req.body;

    if (!customerId || !creditNoteDate) {
      return res.status(400).json({ error: 'Customer and date are required' });
    }

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

    // Generate credit note number
    const lastNote = await db.query.creditNotes.findFirst({
      where: eq(creditNotes.companyId, req.companyId!),
      orderBy: desc(creditNotes.createdAt),
    });

    const nextNumber = lastNote
      ? parseInt(lastNote.creditNoteNumber.split('-').pop() || '0', 10) + 1
      : 1;
    const creditNoteNumber = `CN-${fiscalYear.name.replace(/\s/g, '')}-${nextNumber.toString().padStart(5, '0')}`;

    // Calculate totals
    let subtotal = 0;
    let totalTax = 0;
    let totalCgst = 0;
    let totalSgst = 0;

    const processedLines = items.map((item: any, index: number) => {
      const quantity = parseFloat(item.quantity || 1);
      const unitPrice = parseFloat(item.rate || item.unitPrice || 0);
      const lineAmount = quantity * unitPrice;
      const taxRate = parseFloat(item.gstRate || item.taxRate || 0);
      const taxAmount = (lineAmount * taxRate) / 100;
      const cgst = taxAmount / 2;
      const sgst = taxAmount / 2;

      subtotal += lineAmount;
      totalTax += taxAmount;
      totalCgst += cgst;
      totalSgst += sgst;

      return {
        productId: item.productId,
        accountId: item.accountId,
        description: item.description,
        hsnSacCode: item.hsnSac || item.hsnSacCode,
        quantity: quantity.toString(),
        unitPrice: unitPrice.toString(),
        taxRate: taxRate.toString(),
        taxAmount: taxAmount.toString(),
        amount: (lineAmount + taxAmount).toString(),
        sortOrder: index,
      };
    });

    const totalAmount = subtotal + totalTax;

    // Create credit note
    const [note] = await db.insert(creditNotes).values({
      companyId: req.companyId!,
      fiscalYearId: fiscalYear.id,
      creditNoteNumber,
      creditNoteDate,
      customerId,
      originalInvoiceId,
      reason,
      subtotal: subtotal.toString(),
      taxAmount: totalTax.toString(),
      cgst: totalCgst.toString(),
      sgst: totalSgst.toString(),
      totalAmount: totalAmount.toString(),
      status: 'draft',
      notes,
      createdByUserId: req.userId,
    }).returning();

    // Create line items
    if (processedLines.length > 0) {
      await db.insert(creditNoteLines).values(
        processedLines.map((line: any) => ({
          creditNoteId: note.id,
          ...line,
        }))
      );
    }

    // Fetch complete note
    const completeNote = await db.query.creditNotes.findFirst({
      where: eq(creditNotes.id, note.id),
      with: {
        customer: true,
        lines: true,
      },
    });

    res.status(201).json(completeNote);
  } catch (error) {
    console.error('Create credit note error:', error);
    res.status(500).json({ error: 'Failed to create credit note' });
  }
});

// Issue credit note
router.post('/:id/issue', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const note = await db.query.creditNotes.findFirst({
      where: and(
        eq(creditNotes.id, id),
        eq(creditNotes.companyId, req.companyId!)
      ),
      with: {
        customer: true,
        lines: true,
      },
    });

    if (!note) {
      return res.status(404).json({ error: 'Credit note not found' });
    }

    if (note.status !== 'draft') {
      return res.status(400).json({ error: 'Credit note has already been issued' });
    }

    // Create journal entry
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
    const entryNumber = `CN/${fiscalYear.name.replace(/\s/g, '')}/${nextNum.toString().padStart(5, '0')}`;

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

    // Create journal entry
    const [je] = await db.insert(journalEntries).values({
      companyId: req.companyId!,
      fiscalYearId: fiscalYear.id,
      entryNumber,
      entryDate: note.creditNoteDate,
      entryType: 'auto_invoice',
      narration: `Credit Note ${note.creditNoteNumber} - ${note.customer.name}`,
      totalDebit: note.totalAmount,
      totalCredit: note.totalAmount,
      sourceType: 'credit_note',
      sourceId: note.id,
      status: 'posted',
      createdByUserId: req.userId,
    }).returning();

    // Journal entry lines:
    // Debit: Revenue accounts (reduces revenue)
    // Credit: Accounts Receivable (reduces receivable from customer)
    const jeLines = [];

    // Credit AR (reduce receivable)
    jeLines.push({
      journalEntryId: je.id,
      accountId: arAccount.id,
      debitAmount: '0',
      creditAmount: note.totalAmount,
      partyType: 'customer' as const,
      partyId: note.customerId,
      description: `Credit Note ${note.creditNoteNumber}`,
    });

    // Debit revenue accounts for each line
    for (const line of note.lines) {
      if (line.accountId) {
        jeLines.push({
          journalEntryId: je.id,
          accountId: line.accountId,
          debitAmount: line.amount,
          creditAmount: '0',
          description: line.description,
        });
      }
    }

    await db.insert(journalEntryLines).values(jeLines);

    // Update credit note status
    const [updated] = await db.update(creditNotes)
      .set({
        status: 'issued',
        journalEntryId: je.id,
        updatedAt: new Date(),
      })
      .where(eq(creditNotes.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Issue credit note error:', error);
    res.status(500).json({ error: 'Failed to issue credit note' });
  }
});

// Apply to invoice
router.post('/:id/apply', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { invoiceId } = req.body;

    if (!invoiceId) {
      return res.status(400).json({ error: 'Invoice ID is required' });
    }

    const note = await db.query.creditNotes.findFirst({
      where: and(
        eq(creditNotes.id, id),
        eq(creditNotes.companyId, req.companyId!)
      ),
    });

    if (!note) {
      return res.status(404).json({ error: 'Credit note not found' });
    }

    if (note.status !== 'issued') {
      return res.status(400).json({ error: 'Credit note must be issued before applying' });
    }

    const invoice = await db.query.invoices.findFirst({
      where: and(
        eq(invoices.id, invoiceId),
        eq(invoices.companyId, req.companyId!)
      ),
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Apply credit note to invoice balance
    const creditAmount = parseFloat(note.totalAmount);
    const invoiceBalance = parseFloat(invoice.balanceDue);
    const applyAmount = Math.min(creditAmount, invoiceBalance);
    const newBalance = invoiceBalance - applyAmount;

    // Update invoice
    await db.update(invoices)
      .set({
        paidAmount: (parseFloat(invoice.paidAmount || '0') + applyAmount).toString(),
        balanceDue: newBalance.toString(),
        status: newBalance === 0 ? 'paid' : 'partially_paid',
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoiceId));

    // Update credit note
    const [updated] = await db.update(creditNotes)
      .set({
        status: 'applied',
        appliedToInvoiceId: invoiceId,
        updatedAt: new Date(),
      })
      .where(eq(creditNotes.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Apply credit note error:', error);
    res.status(500).json({ error: 'Failed to apply credit note' });
  }
});

// Cancel credit note
router.post('/:id/cancel', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const note = await db.query.creditNotes.findFirst({
      where: and(
        eq(creditNotes.id, id),
        eq(creditNotes.companyId, req.companyId!)
      ),
    });

    if (!note) {
      return res.status(404).json({ error: 'Credit note not found' });
    }

    if (note.status !== 'issued') {
      return res.status(400).json({ error: 'Only issued credit notes can be cancelled' });
    }

    if (parseFloat(note.appliedAmount || '0') > 0) {
      return res.status(400).json({ error: 'Cannot cancel credit note that has been applied' });
    }

    // Reverse journal entries
    const relatedJournals = await db.query.journalEntries.findMany({
      where: and(
        eq(journalEntries.companyId, req.companyId!),
        eq(journalEntries.referenceType, 'credit_note'),
        eq(journalEntries.referenceId, id)
      ),
    });

    for (const je of relatedJournals) {
      await db.delete(journalEntryLines).where(eq(journalEntryLines.journalEntryId, je.id));
      await db.delete(journalEntries).where(eq(journalEntries.id, je.id));
    }

    const [updated] = await db.update(creditNotes)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(creditNotes.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Cancel credit note error:', error);
    res.status(500).json({ error: 'Failed to cancel credit note' });
  }
});

// Delete credit note (only drafts)
router.delete('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const note = await db.query.creditNotes.findFirst({
      where: and(
        eq(creditNotes.id, id),
        eq(creditNotes.companyId, req.companyId!)
      ),
    });

    if (!note) {
      return res.status(404).json({ error: 'Credit note not found' });
    }

    if (note.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft credit notes can be deleted' });
    }

    await db.delete(creditNoteLines).where(eq(creditNoteLines.creditNoteId, id));
    await db.delete(creditNotes).where(eq(creditNotes.id, id));

    res.json({ message: 'Credit note deleted' });
  } catch (error) {
    console.error('Delete credit note error:', error);
    res.status(500).json({ error: 'Failed to delete credit note' });
  }
});

export default router;
