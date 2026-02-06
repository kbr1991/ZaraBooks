import { Router } from 'express';
import { db } from '../db';
import { expenses, fiscalYears, journalEntries, journalEntryLines, chartOfAccounts, companyUsers } from '@shared/schema';
import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all expenses
router.get('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, category, vendorId, startDate, endDate, fiscalYearId } = req.query;

    let whereConditions = [eq(expenses.companyId, req.companyId!)];

    if (status) {
      whereConditions.push(eq(expenses.status, status as any));
    }
    if (category) {
      whereConditions.push(eq(expenses.category, category as string));
    }
    if (vendorId) {
      whereConditions.push(eq(expenses.vendorId, vendorId as string));
    }
    if (startDate) {
      whereConditions.push(gte(expenses.expenseDate, startDate as string));
    }
    if (endDate) {
      whereConditions.push(lte(expenses.expenseDate, endDate as string));
    }
    if (fiscalYearId) {
      whereConditions.push(eq(expenses.fiscalYearId, fiscalYearId as string));
    }

    const allExpenses = await db.query.expenses.findMany({
      where: and(...whereConditions),
      with: {
        vendor: true,
        account: true,
        createdBy: true,
        approvedBy: true,
      },
      orderBy: [desc(expenses.expenseDate), desc(expenses.createdAt)],
    });

    res.json(allExpenses);
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Failed to get expenses' });
  }
});

// Get expense by ID
router.get('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const expense = await db.query.expenses.findFirst({
      where: and(
        eq(expenses.id, id),
        eq(expenses.companyId, req.companyId!)
      ),
      with: {
        vendor: true,
        account: true,
        paymentAccount: true,
        fiscalYear: true,
        journalEntry: true,
        createdBy: true,
        approvedBy: true,
      },
    });

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json(expense);
  } catch (error) {
    console.error('Get expense error:', error);
    res.status(500).json({ error: 'Failed to get expense' });
  }
});

// Create expense
router.post('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      expenseDate,
      vendorId,
      accountId,
      paymentAccountId,
      category,
      amount,
      taxAmount = '0',
      paymentMethod,
      referenceNumber,
      description,
      notes,
      receiptUrl,
    } = req.body;

    if (!expenseDate || !accountId || !amount) {
      return res.status(400).json({ error: 'Expense date, account, and amount are required' });
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

    // Generate expense number
    const lastExpense = await db.query.expenses.findFirst({
      where: eq(expenses.companyId, req.companyId!),
      orderBy: desc(expenses.createdAt),
    });

    const nextNumber = lastExpense
      ? parseInt(lastExpense.expenseNumber.split('-').pop() || '0', 10) + 1
      : 1;
    const expenseNumber = `EXP-${fiscalYear.name.replace(/\s/g, '')}-${nextNumber.toString().padStart(5, '0')}`;

    const totalAmount = parseFloat(amount) + parseFloat(taxAmount);

    const [expense] = await db.insert(expenses).values({
      companyId: req.companyId!,
      fiscalYearId: fiscalYear.id,
      expenseNumber,
      expenseDate,
      vendorId,
      accountId,
      paymentAccountId,
      category,
      amount: amount.toString(),
      taxAmount: taxAmount.toString(),
      totalAmount: totalAmount.toString(),
      paymentMethod,
      referenceNumber,
      description,
      notes,
      receiptUrl,
      status: 'pending',
      createdByUserId: req.userId,
    }).returning();

    const completeExpense = await db.query.expenses.findFirst({
      where: eq(expenses.id, expense.id),
      with: {
        vendor: true,
        account: true,
      },
    });

    res.status(201).json(completeExpense);
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ error: 'Failed to create expense' });
  }
});

// Update expense
router.patch('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const expense = await db.query.expenses.findFirst({
      where: and(
        eq(expenses.id, id),
        eq(expenses.companyId, req.companyId!)
      ),
    });

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    // Only allow updates to pending expenses
    if (expense.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending expenses can be edited' });
    }

    // Recalculate total if amount or tax changed
    if (updateData.amount !== undefined || updateData.taxAmount !== undefined) {
      const amount = parseFloat(updateData.amount ?? expense.amount);
      const taxAmount = parseFloat(updateData.taxAmount ?? expense.taxAmount ?? '0');
      updateData.totalAmount = (amount + taxAmount).toString();
    }

    const [updated] = await db.update(expenses)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(expenses.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Update expense error:', error);
    res.status(500).json({ error: 'Failed to update expense' });
  }
});

// Approve expense
router.post('/:id/approve', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // Check if user has approval permission (owner or accountant)
    const userAccess = await db.query.companyUsers.findFirst({
      where: and(
        eq(companyUsers.companyId, req.companyId!),
        eq(companyUsers.userId, req.userId!),
        eq(companyUsers.isActive, true)
      ),
    });

    if (!userAccess || !['owner', 'accountant'].includes(userAccess.role)) {
      return res.status(403).json({ error: 'Insufficient permissions to approve expenses' });
    }

    const expense = await db.query.expenses.findFirst({
      where: and(
        eq(expenses.id, id),
        eq(expenses.companyId, req.companyId!)
      ),
      with: {
        vendor: true,
        account: true,
      },
    });

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    if (expense.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending expenses can be approved' });
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

    const lastEntry = await db.query.journalEntries.findFirst({
      where: eq(journalEntries.companyId, req.companyId!),
      orderBy: desc(journalEntries.createdAt),
    });

    const nextNum = lastEntry
      ? parseInt(lastEntry.entryNumber.split('/').pop() || '0', 10) + 1
      : 1;
    const entryNumber = `EXP/${fiscalYear.name.replace(/\s/g, '')}/${nextNum.toString().padStart(5, '0')}`;

    const [je] = await db.insert(journalEntries).values({
      companyId: req.companyId!,
      fiscalYearId: fiscalYear.id,
      entryNumber,
      entryDate: expense.expenseDate,
      entryType: 'auto_expense',
      narration: expense.description || `Expense ${expense.expenseNumber}${expense.vendor ? ` - ${expense.vendor.name}` : ''}`,
      totalDebit: expense.totalAmount,
      totalCredit: expense.totalAmount,
      sourceType: 'expense',
      sourceId: expense.id,
      status: 'posted',
      createdByUserId: req.userId,
    }).returning();

    // Create journal entry lines
    const jeLines = [];

    // Debit: Expense account
    jeLines.push({
      journalEntryId: je.id,
      accountId: expense.accountId,
      debitAmount: expense.totalAmount,
      creditAmount: '0',
      description: expense.description || expense.expenseNumber,
    });

    // Credit: Payment account or Accounts Payable
    if (expense.paymentAccountId) {
      // Paid immediately
      jeLines.push({
        journalEntryId: je.id,
        accountId: expense.paymentAccountId,
        debitAmount: '0',
        creditAmount: expense.totalAmount,
        description: `Payment - ${expense.expenseNumber}`,
      });
    } else {
      // Accounts Payable
      const apAccount = await db.query.chartOfAccounts.findFirst({
        where: and(
          eq(chartOfAccounts.companyId, req.companyId!),
          eq(chartOfAccounts.code, '2100') // Trade Payables
        ),
      });

      if (apAccount) {
        jeLines.push({
          journalEntryId: je.id,
          accountId: apAccount.id,
          debitAmount: '0',
          creditAmount: expense.totalAmount,
          partyType: 'vendor' as const,
          partyId: expense.vendorId || undefined,
          description: `Payable - ${expense.expenseNumber}`,
        });
      }
    }

    await db.insert(journalEntryLines).values(jeLines);

    // Update expense
    const [updated] = await db.update(expenses)
      .set({
        status: expense.paymentAccountId ? 'paid' : 'approved',
        approvedByUserId: req.userId,
        approvedAt: new Date(),
        journalEntryId: je.id,
        updatedAt: new Date(),
      })
      .where(eq(expenses.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Approve expense error:', error);
    res.status(500).json({ error: 'Failed to approve expense' });
  }
});

// Reject expense
router.post('/:id/reject', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Check if user has approval permission
    const userAccess = await db.query.companyUsers.findFirst({
      where: and(
        eq(companyUsers.companyId, req.companyId!),
        eq(companyUsers.userId, req.userId!),
        eq(companyUsers.isActive, true)
      ),
    });

    if (!userAccess || !['owner', 'accountant'].includes(userAccess.role)) {
      return res.status(403).json({ error: 'Insufficient permissions to reject expenses' });
    }

    const expense = await db.query.expenses.findFirst({
      where: and(
        eq(expenses.id, id),
        eq(expenses.companyId, req.companyId!)
      ),
    });

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    if (expense.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending expenses can be rejected' });
    }

    const [updated] = await db.update(expenses)
      .set({
        status: 'rejected',
        notes: reason ? `Rejected: ${reason}` : expense.notes,
        updatedAt: new Date(),
      })
      .where(eq(expenses.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Reject expense error:', error);
    res.status(500).json({ error: 'Failed to reject expense' });
  }
});

// Get expense stats
router.get('/stats/summary', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { month, year } = req.query;

    let dateFilter = undefined;
    if (month && year) {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(Number(year), Number(month), 0).toISOString().split('T')[0];
      dateFilter = and(
        gte(expenses.expenseDate, startDate),
        lte(expenses.expenseDate, endDate)
      );
    }

    const whereConditions = [eq(expenses.companyId, req.companyId!)];
    if (dateFilter) whereConditions.push(dateFilter);

    const result = await db
      .select({
        status: expenses.status,
        count: sql<number>`count(*)`,
        total: sql<string>`COALESCE(SUM(${expenses.totalAmount}), 0)`,
      })
      .from(expenses)
      .where(and(...whereConditions))
      .groupBy(expenses.status);

    // Get current month total
    const now = new Date();
    const currentMonthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const monthlyResult = await db
      .select({
        total: sql<string>`COALESCE(SUM(${expenses.totalAmount}), 0)`,
      })
      .from(expenses)
      .where(and(
        eq(expenses.companyId, req.companyId!),
        gte(expenses.expenseDate, currentMonthStart),
        lte(expenses.expenseDate, currentMonthEnd)
      ));

    const stats = {
      totalExpenses: 0,
      thisMonth: parseFloat(monthlyResult[0]?.total || '0'),
      pending: 0,
      approved: 0,
      byStatus: {} as Record<string, { count: number; total: number }>,
    };

    for (const row of result) {
      stats.byStatus[row.status] = {
        count: Number(row.count),
        total: parseFloat(row.total),
      };
      stats.totalExpenses += parseFloat(row.total);
      if (row.status === 'pending') {
        stats.pending = Number(row.count);
      }
      if (row.status === 'approved' || row.status === 'paid') {
        stats.approved += Number(row.count);
      }
    }

    res.json(stats);
  } catch (error) {
    console.error('Get expense stats error:', error);
    res.status(500).json({ error: 'Failed to get expense stats' });
  }
});

// Get expense categories
router.get('/categories/list', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await db
      .selectDistinct({ category: expenses.category })
      .from(expenses)
      .where(and(
        eq(expenses.companyId, req.companyId!),
        sql`${expenses.category} IS NOT NULL`
      ))
      .orderBy(expenses.category);

    res.json(result.map(r => r.category).filter(Boolean));
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

// Delete expense (only pending)
router.delete('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const expense = await db.query.expenses.findFirst({
      where: and(
        eq(expenses.id, id),
        eq(expenses.companyId, req.companyId!)
      ),
    });

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    if (expense.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending expenses can be deleted' });
    }

    await db.delete(expenses).where(eq(expenses.id, id));

    res.json({ message: 'Expense deleted' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
});

export default router;
