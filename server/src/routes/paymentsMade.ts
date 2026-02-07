import { Router } from 'express';
import { db } from '../db';
import { paymentsMade, paymentMadeAllocations, fiscalYears, bills, journalEntries, journalEntryLines, chartOfAccounts } from '@shared/schema';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all payments made
router.get('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { vendorId, startDate, endDate } = req.query;

    let whereConditions = [eq(paymentsMade.companyId, req.companyId!)];

    if (vendorId) {
      whereConditions.push(eq(paymentsMade.vendorId, vendorId as string));
    }
    if (startDate) {
      whereConditions.push(gte(paymentsMade.paymentDate, startDate as string));
    }
    if (endDate) {
      whereConditions.push(lte(paymentsMade.paymentDate, endDate as string));
    }

    const allPayments = await db.query.paymentsMade.findMany({
      where: and(...whereConditions),
      with: {
        vendor: true,
        bankAccount: true,
        allocations: {
          with: {
            bill: true,
          },
        },
        createdBy: true,
      },
      orderBy: [desc(paymentsMade.paymentDate), desc(paymentsMade.createdAt)],
    });

    // Transform for frontend
    const transformed = allPayments.map(p => ({
      id: p.id,
      paymentNumber: p.paymentNumber,
      paymentDate: p.paymentDate,
      vendorId: p.vendorId,
      vendorName: p.vendor?.name || 'Unknown',
      amount: p.amount,
      paymentMethod: p.paymentMethod,
      referenceNumber: p.referenceNumber,
      bankAccountName: p.bankAccount?.bankName,
      notes: p.notes,
      allocations: p.allocations?.map(a => ({
        billId: a.billId,
        billNumber: a.bill?.billNumber,
        amount: a.amount,
      })),
    }));

    res.json(transformed);
  } catch (error) {
    console.error('Get payments made error:', error);
    res.status(500).json({ error: 'Failed to get payments made' });
  }
});

// Get payment by ID
router.get('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const payment = await db.query.paymentsMade.findFirst({
      where: and(
        eq(paymentsMade.id, id),
        eq(paymentsMade.companyId, req.companyId!)
      ),
      with: {
        vendor: true,
        bankAccount: true,
        fiscalYear: true,
        allocations: {
          with: {
            bill: true,
          },
        },
        journalEntry: true,
        createdBy: true,
      },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    res.json(payment);
  } catch (error) {
    console.error('Get payment error:', error);
    res.status(500).json({ error: 'Failed to get payment' });
  }
});

// Get unpaid bills for a vendor
router.get('/vendor/:vendorId/unpaid-bills', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { vendorId } = req.params;

    const unpaidBills = await db.query.bills.findMany({
      where: and(
        eq(bills.companyId, req.companyId!),
        eq(bills.vendorId, vendorId),
      ),
      orderBy: [desc(bills.billDate)],
    });

    // Filter to only unpaid/partially paid
    const filtered = unpaidBills.filter(bill =>
      ['pending', 'partially_paid', 'overdue'].includes(bill.status) &&
      parseFloat(bill.balanceDue) > 0
    );

    res.json(filtered);
  } catch (error) {
    console.error('Get unpaid bills error:', error);
    res.status(500).json({ error: 'Failed to get unpaid bills' });
  }
});

// Create payment made
router.post('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      vendorId,
      paymentDate,
      amount,
      paymentMethod,
      referenceNumber,
      bankAccountId,
      notes,
      allocations = [],
    } = req.body;

    if (!vendorId || !paymentDate || !amount) {
      return res.status(400).json({ error: 'Vendor, payment date, and amount are required' });
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

    // Generate payment number
    const lastPayment = await db.query.paymentsMade.findFirst({
      where: eq(paymentsMade.companyId, req.companyId!),
      orderBy: desc(paymentsMade.createdAt),
    });

    const nextNumber = lastPayment
      ? parseInt(lastPayment.paymentNumber.split('-').pop() || '0', 10) + 1
      : 1;
    const paymentNumber = `PM-${fiscalYear.name.replace(/\s/g, '')}-${nextNumber.toString().padStart(5, '0')}`;

    // Create payment
    const [payment] = await db.insert(paymentsMade).values({
      companyId: req.companyId!,
      fiscalYearId: fiscalYear.id,
      paymentNumber,
      paymentDate,
      vendorId,
      amount: amount.toString(),
      paymentMethod: paymentMethod || 'bank',
      referenceNumber,
      bankAccountId,
      notes,
      createdByUserId: req.userId,
    }).returning();

    // Create allocations and update bills
    const paymentAmount = parseFloat(amount);
    let allocatedAmount = 0;

    for (const alloc of allocations) {
      if (allocatedAmount >= paymentAmount) break;

      const bill = await db.query.bills.findFirst({
        where: and(
          eq(bills.id, alloc.billId),
          eq(bills.companyId, req.companyId!)
        ),
      });

      if (!bill) continue;

      const billBalance = parseFloat(bill.balanceDue);
      const allocAmount = Math.min(parseFloat(alloc.amount), billBalance, paymentAmount - allocatedAmount);

      if (allocAmount <= 0) continue;

      // Create allocation
      await db.insert(paymentMadeAllocations).values({
        paymentMadeId: payment.id,
        billId: alloc.billId,
        amount: allocAmount.toString(),
      });

      // Update bill
      const newPaid = parseFloat(bill.paidAmount || '0') + allocAmount;
      const newBalance = parseFloat(bill.totalAmount) - newPaid;

      await db.update(bills)
        .set({
          paidAmount: newPaid.toString(),
          balanceDue: newBalance.toString(),
          status: newBalance === 0 ? 'paid' : 'partially_paid',
          updatedAt: new Date(),
        })
        .where(eq(bills.id, alloc.billId));

      allocatedAmount += allocAmount;
    }

    // Create journal entry
    if (bankAccountId) {
      const lastEntry = await db.query.journalEntries.findFirst({
        where: eq(journalEntries.companyId, req.companyId!),
        orderBy: desc(journalEntries.createdAt),
      });

      const nextNum = lastEntry
        ? parseInt(lastEntry.entryNumber.split('/').pop() || '0', 10) + 1
        : 1;
      const entryNumber = `PAY/${fiscalYear.name.replace(/\s/g, '')}/${nextNum.toString().padStart(5, '0')}`;

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
          entryDate: paymentDate,
          entryType: 'auto_payment',
          narration: `Payment made - ${paymentNumber}`,
          totalDebit: amount.toString(),
          totalCredit: amount.toString(),
          status: 'posted',
          createdByUserId: req.userId,
        }).returning();

        await db.insert(journalEntryLines).values([
          {
            journalEntryId: je.id,
            accountId: apAccount.id,
            debitAmount: amount.toString(),
            creditAmount: '0',
            partyType: 'vendor' as const,
            partyId: vendorId,
            description: `Payment made - ${paymentNumber}`,
          },
          {
            journalEntryId: je.id,
            accountId: bankAccountId,
            debitAmount: '0',
            creditAmount: amount.toString(),
            description: `Payment - ${referenceNumber || paymentNumber}`,
          },
        ]);

        // Update payment with journal entry
        await db.update(paymentsMade)
          .set({ journalEntryId: je.id })
          .where(eq(paymentsMade.id, payment.id));
      }
    }

    // Fetch complete payment
    const completePayment = await db.query.paymentsMade.findFirst({
      where: eq(paymentsMade.id, payment.id),
      with: {
        vendor: true,
        allocations: {
          with: {
            bill: true,
          },
        },
      },
    });

    res.status(201).json(completePayment);
  } catch (error) {
    console.error('Create payment made error:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// Delete payment (reverse allocations)
router.delete('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const payment = await db.query.paymentsMade.findFirst({
      where: and(
        eq(paymentsMade.id, id),
        eq(paymentsMade.companyId, req.companyId!)
      ),
      with: {
        allocations: true,
      },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Reverse allocations on bills
    for (const alloc of payment.allocations) {
      const bill = await db.query.bills.findFirst({
        where: eq(bills.id, alloc.billId),
      });

      if (bill) {
        const newPaid = Math.max(0, parseFloat(bill.paidAmount || '0') - parseFloat(alloc.amount));
        const newBalance = parseFloat(bill.totalAmount) - newPaid;

        await db.update(bills)
          .set({
            paidAmount: newPaid.toString(),
            balanceDue: newBalance.toString(),
            status: newBalance === parseFloat(bill.totalAmount) ? 'pending' : 'partially_paid',
            updatedAt: new Date(),
          })
          .where(eq(bills.id, alloc.billId));
      }
    }

    // Delete allocations
    await db.delete(paymentMadeAllocations).where(eq(paymentMadeAllocations.paymentMadeId, id));

    // Delete payment
    await db.delete(paymentsMade).where(eq(paymentsMade.id, id));

    res.json({ message: 'Payment deleted and allocations reversed' });
  } catch (error) {
    console.error('Delete payment error:', error);
    res.status(500).json({ error: 'Failed to delete payment' });
  }
});

export default router;
