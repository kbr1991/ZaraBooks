import { Router } from 'express';
import { db } from '../db';
import { paymentsReceived, paymentAllocations, fiscalYears, invoices, journalEntries, journalEntryLines, chartOfAccounts } from '@shared/schema';
import { eq, and, desc, gte, lte } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all payments received
router.get('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { customerId, startDate, endDate } = req.query;

    let whereConditions = [eq(paymentsReceived.companyId, req.companyId!)];

    if (customerId) {
      whereConditions.push(eq(paymentsReceived.customerId, customerId as string));
    }
    if (startDate) {
      whereConditions.push(gte(paymentsReceived.paymentDate, startDate as string));
    }
    if (endDate) {
      whereConditions.push(lte(paymentsReceived.paymentDate, endDate as string));
    }

    const allPayments = await db.query.paymentsReceived.findMany({
      where: and(...whereConditions),
      with: {
        customer: true,
        bankAccount: true,
        allocations: {
          with: {
            invoice: true,
          },
        },
        createdBy: true,
      },
      orderBy: [desc(paymentsReceived.paymentDate), desc(paymentsReceived.createdAt)],
    });

    // Transform for frontend
    const transformed = allPayments.map(p => ({
      id: p.id,
      paymentNumber: p.paymentNumber,
      paymentDate: p.paymentDate,
      customerId: p.customerId,
      customerName: p.customer?.name || 'Unknown',
      amount: p.amount,
      paymentMethod: p.paymentMethod,
      referenceNumber: p.referenceNumber,
      bankAccountName: p.bankAccount?.bankName,
      notes: p.notes,
      allocations: p.allocations?.map(a => ({
        invoiceId: a.invoiceId,
        invoiceNumber: a.invoice?.invoiceNumber,
        amount: a.amount,
      })),
    }));

    res.json(transformed);
  } catch (error) {
    console.error('Get payments received error:', error);
    res.status(500).json({ error: 'Failed to get payments received' });
  }
});

// Get payment by ID
router.get('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const payment = await db.query.paymentsReceived.findFirst({
      where: and(
        eq(paymentsReceived.id, id),
        eq(paymentsReceived.companyId, req.companyId!)
      ),
      with: {
        customer: true,
        bankAccount: true,
        fiscalYear: true,
        allocations: {
          with: {
            invoice: true,
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

// Get unpaid invoices for a customer
router.get('/customer/:customerId/unpaid-invoices', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { customerId } = req.params;

    const unpaidInvoices = await db.query.invoices.findMany({
      where: and(
        eq(invoices.companyId, req.companyId!),
        eq(invoices.customerId, customerId),
      ),
      orderBy: [desc(invoices.invoiceDate)],
    });

    // Filter to only unpaid/partially paid
    const filtered = unpaidInvoices.filter(inv =>
      ['sent', 'partially_paid', 'overdue'].includes(inv.status) &&
      parseFloat(inv.balanceDue) > 0
    );

    res.json(filtered);
  } catch (error) {
    console.error('Get unpaid invoices error:', error);
    res.status(500).json({ error: 'Failed to get unpaid invoices' });
  }
});

// Create payment received
router.post('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      customerId,
      paymentDate,
      amount,
      paymentMethod,
      referenceNumber,
      bankAccountId,
      notes,
      allocations = [],
    } = req.body;

    if (!customerId || !paymentDate || !amount) {
      return res.status(400).json({ error: 'Customer, payment date, and amount are required' });
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
    const lastPayment = await db.query.paymentsReceived.findFirst({
      where: eq(paymentsReceived.companyId, req.companyId!),
      orderBy: desc(paymentsReceived.createdAt),
    });

    const nextNumber = lastPayment
      ? parseInt(lastPayment.paymentNumber.split('-').pop() || '0', 10) + 1
      : 1;
    const paymentNumber = `PR-${fiscalYear.name.replace(/\s/g, '')}-${nextNumber.toString().padStart(5, '0')}`;

    // Create payment
    const [payment] = await db.insert(paymentsReceived).values({
      companyId: req.companyId!,
      fiscalYearId: fiscalYear.id,
      paymentNumber,
      paymentDate,
      customerId,
      amount: amount.toString(),
      paymentMethod: paymentMethod || 'bank',
      referenceNumber,
      bankAccountId,
      notes,
      createdByUserId: req.userId,
    }).returning();

    // Create allocations and update invoices
    const paymentAmount = parseFloat(amount);
    let allocatedAmount = 0;

    for (const alloc of allocations) {
      if (allocatedAmount >= paymentAmount) break;

      const invoice = await db.query.invoices.findFirst({
        where: and(
          eq(invoices.id, alloc.invoiceId),
          eq(invoices.companyId, req.companyId!)
        ),
      });

      if (!invoice) continue;

      const invoiceBalance = parseFloat(invoice.balanceDue);
      const allocAmount = Math.min(parseFloat(alloc.amount), invoiceBalance, paymentAmount - allocatedAmount);

      if (allocAmount <= 0) continue;

      // Create allocation
      await db.insert(paymentAllocations).values({
        paymentReceivedId: payment.id,
        invoiceId: alloc.invoiceId,
        amount: allocAmount.toString(),
      });

      // Update invoice
      const newPaid = parseFloat(invoice.paidAmount || '0') + allocAmount;
      const newBalance = parseFloat(invoice.totalAmount) - newPaid;

      await db.update(invoices)
        .set({
          paidAmount: newPaid.toString(),
          balanceDue: newBalance.toString(),
          status: newBalance === 0 ? 'paid' : 'partially_paid',
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, alloc.invoiceId));

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
      const entryNumber = `RCV/${fiscalYear.name.replace(/\s/g, '')}/${nextNum.toString().padStart(5, '0')}`;

      const arAccount = await db.query.chartOfAccounts.findFirst({
        where: and(
          eq(chartOfAccounts.companyId, req.companyId!),
          eq(chartOfAccounts.code, '1300') // Trade Receivables
        ),
      });

      if (arAccount) {
        const [je] = await db.insert(journalEntries).values({
          companyId: req.companyId!,
          fiscalYearId: fiscalYear.id,
          entryNumber,
          entryDate: paymentDate,
          entryType: 'auto_payment',
          narration: `Payment received - ${paymentNumber}`,
          totalDebit: amount.toString(),
          totalCredit: amount.toString(),
          status: 'posted',
          createdByUserId: req.userId,
        }).returning();

        await db.insert(journalEntryLines).values([
          {
            journalEntryId: je.id,
            accountId: bankAccountId,
            debitAmount: amount.toString(),
            creditAmount: '0',
            description: `Payment - ${referenceNumber || paymentNumber}`,
          },
          {
            journalEntryId: je.id,
            accountId: arAccount.id,
            debitAmount: '0',
            creditAmount: amount.toString(),
            partyType: 'customer' as const,
            partyId: customerId,
            description: `Payment received - ${paymentNumber}`,
          },
        ]);

        // Update payment with journal entry
        await db.update(paymentsReceived)
          .set({ journalEntryId: je.id })
          .where(eq(paymentsReceived.id, payment.id));
      }
    }

    // Fetch complete payment
    const completePayment = await db.query.paymentsReceived.findFirst({
      where: eq(paymentsReceived.id, payment.id),
      with: {
        customer: true,
        allocations: {
          with: {
            invoice: true,
          },
        },
      },
    });

    res.status(201).json(completePayment);
  } catch (error) {
    console.error('Create payment received error:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

// Delete payment (reverse allocations)
router.delete('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const payment = await db.query.paymentsReceived.findFirst({
      where: and(
        eq(paymentsReceived.id, id),
        eq(paymentsReceived.companyId, req.companyId!)
      ),
      with: {
        allocations: true,
      },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Reverse allocations on invoices
    for (const alloc of payment.allocations) {
      const invoice = await db.query.invoices.findFirst({
        where: eq(invoices.id, alloc.invoiceId),
      });

      if (invoice) {
        const newPaid = Math.max(0, parseFloat(invoice.paidAmount || '0') - parseFloat(alloc.amount));
        const newBalance = parseFloat(invoice.totalAmount) - newPaid;

        await db.update(invoices)
          .set({
            paidAmount: newPaid.toString(),
            balanceDue: newBalance.toString(),
            status: newBalance === parseFloat(invoice.totalAmount) ? 'sent' : 'partially_paid',
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, alloc.invoiceId));
      }
    }

    // Delete allocations
    await db.delete(paymentAllocations).where(eq(paymentAllocations.paymentReceivedId, id));

    // Delete payment
    await db.delete(paymentsReceived).where(eq(paymentsReceived.id, id));

    res.json({ message: 'Payment deleted and allocations reversed' });
  } catch (error) {
    console.error('Delete payment error:', error);
    res.status(500).json({ error: 'Failed to delete payment' });
  }
});

export default router;
