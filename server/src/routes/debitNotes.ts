import { Router } from 'express';
import { db } from '../db';
import { debitNotes, debitNoteLines, fiscalYears, bills, journalEntries, journalEntryLines, chartOfAccounts } from '@shared/schema';
import { eq, and, desc, asc, gte, lte } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all debit notes
router.get('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, vendorId, startDate, endDate } = req.query;

    let whereConditions = [eq(debitNotes.companyId, req.companyId!)];

    if (status && status !== 'all') {
      whereConditions.push(eq(debitNotes.status, status as any));
    }
    if (vendorId) {
      whereConditions.push(eq(debitNotes.vendorId, vendorId as string));
    }
    if (startDate) {
      whereConditions.push(gte(debitNotes.debitNoteDate, startDate as string));
    }
    if (endDate) {
      whereConditions.push(lte(debitNotes.debitNoteDate, endDate as string));
    }

    const allNotes = await db.query.debitNotes.findMany({
      where: and(...whereConditions),
      with: {
        vendor: true,
        originalBill: true,
        createdBy: true,
      },
      orderBy: [desc(debitNotes.debitNoteDate), desc(debitNotes.createdAt)],
    });

    // Transform for frontend
    const transformed = allNotes.map(dn => ({
      id: dn.id,
      debitNoteNumber: dn.debitNoteNumber,
      debitNoteDate: dn.debitNoteDate,
      vendorId: dn.vendorId,
      vendorName: dn.vendor?.name || 'Unknown',
      originalBillNumber: dn.originalBill?.billNumber,
      reason: dn.reason,
      subtotal: dn.subtotal,
      taxAmount: dn.taxAmount,
      totalAmount: dn.totalAmount,
      status: dn.status,
    }));

    res.json(transformed);
  } catch (error) {
    console.error('Get debit notes error:', error);
    res.status(500).json({ error: 'Failed to get debit notes' });
  }
});

// Get debit note by ID
router.get('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const note = await db.query.debitNotes.findFirst({
      where: and(
        eq(debitNotes.id, id),
        eq(debitNotes.companyId, req.companyId!)
      ),
      with: {
        vendor: true,
        originalBill: true,
        fiscalYear: true,
        lines: {
          with: {
            product: true,
            account: true,
          },
          orderBy: asc(debitNoteLines.sortOrder),
        },
        journalEntry: true,
        createdBy: true,
      },
    });

    if (!note) {
      return res.status(404).json({ error: 'Debit note not found' });
    }

    res.json(note);
  } catch (error) {
    console.error('Get debit note error:', error);
    res.status(500).json({ error: 'Failed to get debit note' });
  }
});

// Create debit note
router.post('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      vendorId,
      debitNoteDate,
      originalBillId,
      reason,
      notes,
      items = [],
    } = req.body;

    if (!vendorId || !debitNoteDate) {
      return res.status(400).json({ error: 'Vendor and date are required' });
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

    // Generate debit note number
    const lastNote = await db.query.debitNotes.findFirst({
      where: eq(debitNotes.companyId, req.companyId!),
      orderBy: desc(debitNotes.createdAt),
    });

    const nextNumber = lastNote
      ? parseInt(lastNote.debitNoteNumber.split('-').pop() || '0', 10) + 1
      : 1;
    const debitNoteNumber = `DN-${fiscalYear.name.replace(/\s/g, '')}-${nextNumber.toString().padStart(5, '0')}`;

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

    // Create debit note
    const [note] = await db.insert(debitNotes).values({
      companyId: req.companyId!,
      fiscalYearId: fiscalYear.id,
      debitNoteNumber,
      debitNoteDate,
      vendorId,
      originalBillId,
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
      await db.insert(debitNoteLines).values(
        processedLines.map((line: any) => ({
          debitNoteId: note.id,
          ...line,
        }))
      );
    }

    // Fetch complete note
    const completeNote = await db.query.debitNotes.findFirst({
      where: eq(debitNotes.id, note.id),
      with: {
        vendor: true,
        lines: true,
      },
    });

    res.status(201).json(completeNote);
  } catch (error) {
    console.error('Create debit note error:', error);
    res.status(500).json({ error: 'Failed to create debit note' });
  }
});

// Issue debit note
router.post('/:id/issue', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const note = await db.query.debitNotes.findFirst({
      where: and(
        eq(debitNotes.id, id),
        eq(debitNotes.companyId, req.companyId!)
      ),
      with: {
        vendor: true,
        lines: true,
      },
    });

    if (!note) {
      return res.status(404).json({ error: 'Debit note not found' });
    }

    if (note.status !== 'draft') {
      return res.status(400).json({ error: 'Debit note has already been issued' });
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
    const entryNumber = `DN/${fiscalYear.name.replace(/\s/g, '')}/${nextNum.toString().padStart(5, '0')}`;

    // Get accounts payable account
    const apAccount = await db.query.chartOfAccounts.findFirst({
      where: and(
        eq(chartOfAccounts.companyId, req.companyId!),
        eq(chartOfAccounts.code, '2100') // Trade Payables
      ),
    });

    if (!apAccount) {
      return res.status(400).json({ error: 'Accounts payable account not found' });
    }

    // Create journal entry
    const [je] = await db.insert(journalEntries).values({
      companyId: req.companyId!,
      fiscalYearId: fiscalYear.id,
      entryNumber,
      entryDate: note.debitNoteDate,
      entryType: 'auto_expense',
      narration: `Debit Note ${note.debitNoteNumber} - ${note.vendor.name}`,
      totalDebit: note.totalAmount,
      totalCredit: note.totalAmount,
      sourceType: 'debit_note',
      sourceId: note.id,
      status: 'posted',
      createdByUserId: req.userId,
    }).returning();

    // Journal entry lines:
    // Debit: Accounts Payable (reduce liability)
    // Credit: Expense accounts (reduce expense)
    const jeLines = [];

    // Debit AP
    jeLines.push({
      journalEntryId: je.id,
      accountId: apAccount.id,
      debitAmount: note.totalAmount,
      creditAmount: '0',
      partyType: 'vendor' as const,
      partyId: note.vendorId,
      description: `Debit Note ${note.debitNoteNumber}`,
    });

    // Credit expense accounts for each line
    for (const line of note.lines) {
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

    await db.insert(journalEntryLines).values(jeLines);

    // Update debit note status
    const [updated] = await db.update(debitNotes)
      .set({
        status: 'issued',
        journalEntryId: je.id,
        updatedAt: new Date(),
      })
      .where(eq(debitNotes.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Issue debit note error:', error);
    res.status(500).json({ error: 'Failed to issue debit note' });
  }
});

// Apply to bill
router.post('/:id/apply', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { billId } = req.body;

    if (!billId) {
      return res.status(400).json({ error: 'Bill ID is required' });
    }

    const note = await db.query.debitNotes.findFirst({
      where: and(
        eq(debitNotes.id, id),
        eq(debitNotes.companyId, req.companyId!)
      ),
    });

    if (!note) {
      return res.status(404).json({ error: 'Debit note not found' });
    }

    if (note.status !== 'issued') {
      return res.status(400).json({ error: 'Debit note must be issued before applying' });
    }

    const bill = await db.query.bills.findFirst({
      where: and(
        eq(bills.id, billId),
        eq(bills.companyId, req.companyId!)
      ),
    });

    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    // Apply debit note to bill balance
    const debitAmount = parseFloat(note.totalAmount);
    const billBalance = parseFloat(bill.balanceDue);
    const applyAmount = Math.min(debitAmount, billBalance);
    const newBalance = billBalance - applyAmount;

    // Update bill
    await db.update(bills)
      .set({
        paidAmount: (parseFloat(bill.paidAmount || '0') + applyAmount).toString(),
        balanceDue: newBalance.toString(),
        status: newBalance === 0 ? 'paid' : 'partially_paid',
        updatedAt: new Date(),
      })
      .where(eq(bills.id, billId));

    // Update debit note
    const [updated] = await db.update(debitNotes)
      .set({
        status: 'applied',
        appliedToBillId: billId,
        updatedAt: new Date(),
      })
      .where(eq(debitNotes.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Apply debit note error:', error);
    res.status(500).json({ error: 'Failed to apply debit note' });
  }
});

// Cancel debit note
router.post('/:id/cancel', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const note = await db.query.debitNotes.findFirst({
      where: and(
        eq(debitNotes.id, id),
        eq(debitNotes.companyId, req.companyId!)
      ),
    });

    if (!note) {
      return res.status(404).json({ error: 'Debit note not found' });
    }

    if (note.status !== 'issued') {
      return res.status(400).json({ error: 'Only issued debit notes can be cancelled' });
    }

    if (parseFloat(note.appliedAmount || '0') > 0) {
      return res.status(400).json({ error: 'Cannot cancel debit note that has been applied' });
    }

    // Reverse journal entries
    const relatedJournals = await db.query.journalEntries.findMany({
      where: and(
        eq(journalEntries.companyId, req.companyId!),
        eq(journalEntries.referenceType, 'debit_note'),
        eq(journalEntries.referenceId, id)
      ),
    });

    for (const je of relatedJournals) {
      await db.delete(journalEntryLines).where(eq(journalEntryLines.journalEntryId, je.id));
      await db.delete(journalEntries).where(eq(journalEntries.id, je.id));
    }

    const [updated] = await db.update(debitNotes)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(debitNotes.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Cancel debit note error:', error);
    res.status(500).json({ error: 'Failed to cancel debit note' });
  }
});

// Delete debit note (only drafts)
router.delete('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const note = await db.query.debitNotes.findFirst({
      where: and(
        eq(debitNotes.id, id),
        eq(debitNotes.companyId, req.companyId!)
      ),
    });

    if (!note) {
      return res.status(404).json({ error: 'Debit note not found' });
    }

    if (note.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft debit notes can be deleted' });
    }

    await db.delete(debitNoteLines).where(eq(debitNoteLines.debitNoteId, id));
    await db.delete(debitNotes).where(eq(debitNotes.id, id));

    res.json({ message: 'Debit note deleted' });
  } catch (error) {
    console.error('Delete debit note error:', error);
    res.status(500).json({ error: 'Failed to delete debit note' });
  }
});

export default router;
