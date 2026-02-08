import { Router } from 'express';
import { db } from '../db';
import { bills, billLines, fiscalYears, journalEntries, journalEntryLines, chartOfAccounts, paymentsMade, paymentMadeAllocations } from '@shared/schema';
import { eq, and, desc, asc, gte, lte } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all bills
router.get('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, vendorId, startDate, endDate } = req.query;

    let whereConditions = [eq(bills.companyId, req.companyId!)];

    if (status && status !== 'all') {
      whereConditions.push(eq(bills.status, status as any));
    }
    if (vendorId) {
      whereConditions.push(eq(bills.vendorId, vendorId as string));
    }
    if (startDate) {
      whereConditions.push(gte(bills.billDate, startDate as string));
    }
    if (endDate) {
      whereConditions.push(lte(bills.billDate, endDate as string));
    }

    const allBills = await db.query.bills.findMany({
      where: and(...whereConditions),
      with: {
        vendor: true,
        createdBy: true,
      },
      orderBy: [desc(bills.billDate), desc(bills.createdAt)],
    });

    // Transform for frontend
    const transformed = allBills.map(b => ({
      id: b.id,
      billNumber: b.billNumber,
      vendorBillNumber: b.vendorBillNumber,
      billDate: b.billDate,
      dueDate: b.dueDate,
      vendorId: b.vendorId,
      vendorName: b.vendor?.name || 'Unknown',
      subtotal: b.subtotal,
      taxAmount: b.taxAmount,
      totalAmount: b.totalAmount,
      paidAmount: b.paidAmount || '0',
      balanceAmount: b.balanceDue,
      status: b.status === 'pending' ? 'open' : b.status,
    }));

    res.json(transformed);
  } catch (error) {
    console.error('Get bills error:', error);
    res.status(500).json({ error: 'Failed to get bills' });
  }
});

// Get bill by ID
router.get('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const bill = await db.query.bills.findFirst({
      where: and(
        eq(bills.id, id),
        eq(bills.companyId, req.companyId!)
      ),
      with: {
        vendor: true,
        fiscalYear: true,
        lines: {
          with: {
            product: true,
            account: true,
          },
          orderBy: asc(billLines.sortOrder),
        },
        journalEntry: true,
        createdBy: true,
      },
    });

    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    res.json(bill);
  } catch (error) {
    console.error('Get bill error:', error);
    res.status(500).json({ error: 'Failed to get bill' });
  }
});

// Create bill
router.post('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      vendorId,
      vendorBillNumber,
      billDate,
      dueDate,
      notes,
      items = [],
    } = req.body;

    if (!vendorId || !billDate || !dueDate) {
      return res.status(400).json({ error: 'Vendor, bill date, and due date are required' });
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

    // Generate bill number
    const lastBill = await db.query.bills.findFirst({
      where: eq(bills.companyId, req.companyId!),
      orderBy: desc(bills.createdAt),
    });

    const nextNumber = lastBill
      ? parseInt(lastBill.billNumber.split('-').pop() || '0', 10) + 1
      : 1;
    const billNumber = `BILL-${fiscalYear.name.replace(/\s/g, '')}-${nextNumber.toString().padStart(5, '0')}`;

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

    // Create bill
    const [bill] = await db.insert(bills).values({
      companyId: req.companyId!,
      fiscalYearId: fiscalYear.id,
      billNumber,
      vendorBillNumber,
      billDate,
      dueDate,
      vendorId,
      subtotal: subtotal.toString(),
      taxAmount: totalTax.toString(),
      cgst: totalCgst.toString(),
      sgst: totalSgst.toString(),
      totalAmount: totalAmount.toString(),
      paidAmount: '0',
      balanceDue: totalAmount.toString(),
      status: 'pending',
      notes,
      createdByUserId: req.userId,
    }).returning();

    // Create line items
    if (processedLines.length > 0) {
      await db.insert(billLines).values(
        processedLines.map((line: any) => ({
          billId: bill.id,
          ...line,
        }))
      );
    }

    // Create journal entry for the bill
    const lastEntry = await db.query.journalEntries.findFirst({
      where: eq(journalEntries.companyId, req.companyId!),
      orderBy: desc(journalEntries.createdAt),
    });

    const nextNum = lastEntry
      ? parseInt(lastEntry.entryNumber.split('/').pop() || '0', 10) + 1
      : 1;
    const entryNumber = `BILL/${fiscalYear.name.replace(/\s/g, '')}/${nextNum.toString().padStart(5, '0')}`;

    // Get accounts payable account
    const apAccount = await db.query.chartOfAccounts.findFirst({
      where: and(
        eq(chartOfAccounts.companyId, req.companyId!),
        eq(chartOfAccounts.code, '2100') // Trade Payables
      ),
    });

    if (apAccount) {
      const [je] = await db.insert(journalEntries).values({
        companyId: req.companyId!,
        fiscalYearId: fiscalYear.id,
        entryNumber,
        entryDate: billDate,
        entryType: 'auto_expense',
        narration: `Bill ${billNumber}${vendorBillNumber ? ` (Vendor: ${vendorBillNumber})` : ''}`,
        totalDebit: totalAmount.toString(),
        totalCredit: totalAmount.toString(),
        sourceType: 'bill',
        sourceId: bill.id,
        status: 'posted',
        createdByUserId: req.userId,
      }).returning();

      // Journal entry lines
      const jeLines = [];

      // Credit: Accounts Payable
      jeLines.push({
        journalEntryId: je.id,
        accountId: apAccount.id,
        debitAmount: '0',
        creditAmount: totalAmount.toString(),
        partyType: 'vendor' as const,
        partyId: vendorId,
        description: `Bill ${billNumber}`,
      });

      // Debit: Expense accounts for each line
      for (const line of processedLines) {
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

      if (jeLines.length > 0) {
        await db.insert(journalEntryLines).values(jeLines);
      }

      // Update bill with journal entry id
      await db.update(bills)
        .set({ journalEntryId: je.id })
        .where(eq(bills.id, bill.id));
    }

    // Fetch complete bill
    const completeBill = await db.query.bills.findFirst({
      where: eq(bills.id, bill.id),
      with: {
        vendor: true,
        lines: true,
      },
    });

    res.status(201).json(completeBill);
  } catch (error) {
    console.error('Create bill error:', error);
    res.status(500).json({ error: 'Failed to create bill' });
  }
});

// Update bill
router.patch('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const bill = await db.query.bills.findFirst({
      where: and(
        eq(bills.id, id),
        eq(bills.companyId, req.companyId!)
      ),
    });

    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    if (bill.status !== 'draft' && bill.status !== 'pending') {
      return res.status(400).json({ error: 'Bill cannot be edited' });
    }

    const [updated] = await db.update(bills)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(bills.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Update bill error:', error);
    res.status(500).json({ error: 'Failed to update bill' });
  }
});

// Record payment for bill
router.post('/:id/record-payment', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { amount, paymentDate, paymentMode, referenceNumber, bankAccountId } = req.body;

    const bill = await db.query.bills.findFirst({
      where: and(
        eq(bills.id, id),
        eq(bills.companyId, req.companyId!)
      ),
      with: {
        vendor: true,
      },
    });

    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    if (!['pending', 'partially_paid', 'overdue'].includes(bill.status)) {
      return res.status(400).json({ error: 'Cannot record payment for this bill' });
    }

    const paymentAmount = parseFloat(amount);
    const currentPaid = parseFloat(bill.paidAmount || '0');
    const totalAmount = parseFloat(bill.totalAmount);
    const newPaidAmount = currentPaid + paymentAmount;
    const newBalanceDue = totalAmount - newPaidAmount;

    if (newPaidAmount > totalAmount) {
      return res.status(400).json({ error: 'Payment amount exceeds balance due' });
    }

    const newStatus = newBalanceDue === 0 ? 'paid' : 'partially_paid';

    // Get fiscal year
    const fiscalYear = await db.query.fiscalYears.findFirst({
      where: and(
        eq(fiscalYears.companyId, req.companyId!),
        eq(fiscalYears.isCurrent, true)
      ),
    });

    if (!fiscalYear) {
      return res.status(400).json({ error: 'No active fiscal year found' });
    }

    // Generate payment number
    const lastPayment = await db.query.paymentsMade.findFirst({
      where: eq(paymentsMade.companyId, req.companyId!),
      orderBy: desc(paymentsMade.createdAt),
    });

    const nextNum = lastPayment
      ? parseInt(lastPayment.paymentNumber.split('-').pop() || '0', 10) + 1
      : 1;
    const paymentNumber = `PM-${fiscalYear.name.replace(/\s/g, '')}-${nextNum.toString().padStart(5, '0')}`;

    // Create payment record
    const [payment] = await db.insert(paymentsMade).values({
      companyId: req.companyId!,
      fiscalYearId: fiscalYear.id,
      paymentNumber,
      paymentDate: paymentDate || new Date().toISOString().split('T')[0],
      vendorId: bill.vendorId,
      amount: paymentAmount.toString(),
      paymentMethod: paymentMode || 'bank',
      referenceNumber,
      bankAccountId,
      notes: `Payment for Bill ${bill.billNumber}`,
      createdByUserId: req.userId,
    }).returning();

    // Create payment allocation
    await db.insert(paymentMadeAllocations).values({
      paymentMadeId: payment.id,
      billId: bill.id,
      amount: paymentAmount.toString(),
    });

    // Create journal entry for payment
    if (bankAccountId) {
      const lastEntry = await db.query.journalEntries.findFirst({
        where: eq(journalEntries.companyId, req.companyId!),
        orderBy: desc(journalEntries.createdAt),
      });

      const nextEntryNum = lastEntry
        ? parseInt(lastEntry.entryNumber.split('/').pop() || '0', 10) + 1
        : 1;
      const entryNumber = `PAY/${fiscalYear.name.replace(/\s/g, '')}/${nextEntryNum.toString().padStart(5, '0')}`;

      const apAccount = await db.query.chartOfAccounts.findFirst({
        where: and(
          eq(chartOfAccounts.companyId, req.companyId!),
          eq(chartOfAccounts.code, '2100')
        ),
      });

      if (apAccount) {
        const [je] = await db.insert(journalEntries).values({
          companyId: req.companyId!,
          fiscalYearId: fiscalYear.id,
          entryNumber,
          entryDate: paymentDate || new Date().toISOString().split('T')[0],
          entryType: 'auto_payment',
          narration: `Payment made for Bill ${bill.billNumber} - ${bill.vendor.name}`,
          totalDebit: paymentAmount.toString(),
          totalCredit: paymentAmount.toString(),
          status: 'posted',
          createdByUserId: req.userId,
        }).returning();

        await db.insert(journalEntryLines).values([
          {
            journalEntryId: je.id,
            accountId: apAccount.id,
            debitAmount: paymentAmount.toString(),
            creditAmount: '0',
            partyType: 'vendor' as const,
            partyId: bill.vendorId,
            description: `Payment - ${bill.billNumber}`,
          },
          {
            journalEntryId: je.id,
            accountId: bankAccountId,
            debitAmount: '0',
            creditAmount: paymentAmount.toString(),
            description: `Payment - ${referenceNumber || bill.billNumber}`,
          },
        ]);

        // Update payment with journal entry
        await db.update(paymentsMade)
          .set({ journalEntryId: je.id })
          .where(eq(paymentsMade.id, payment.id));
      }
    }

    // Update bill
    const [updated] = await db.update(bills)
      .set({
        paidAmount: newPaidAmount.toString(),
        balanceDue: newBalanceDue.toString(),
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(bills.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Record payment error:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// Delete bill (only drafts)
router.delete('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const bill = await db.query.bills.findFirst({
      where: and(
        eq(bills.id, id),
        eq(bills.companyId, req.companyId!)
      ),
    });

    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    if (!['draft', 'pending'].includes(bill.status)) {
      return res.status(400).json({ error: 'Only draft or pending bills can be deleted' });
    }

    // If bill has a journal entry, delete it first
    if (bill.journalEntryId) {
      await db.delete(journalEntryLines).where(eq(journalEntryLines.journalEntryId, bill.journalEntryId));
      await db.delete(journalEntries).where(eq(journalEntries.id, bill.journalEntryId));
    }

    await db.delete(billLines).where(eq(billLines.billId, id));
    await db.delete(bills).where(eq(bills.id, id));

    res.json({ message: 'Bill deleted' });
  } catch (error) {
    console.error('Delete bill error:', error);
    res.status(500).json({ error: 'Failed to delete bill' });
  }
});

export default router;
