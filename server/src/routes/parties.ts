import { Router } from 'express';
import { db } from '../db';
import { parties, journalEntryLines, journalEntries } from '@shared/schema';
import { eq, and, asc, sql, desc, inArray } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all parties with balance information
router.get('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { type, search, includeInactive } = req.query;

    let whereConditions = [eq(parties.companyId, req.companyId!)];

    if (type) {
      whereConditions.push(eq(parties.partyType, type as any));
    }

    if (!includeInactive) {
      whereConditions.push(eq(parties.isActive, true));
    }

    const allParties = await db.query.parties.findMany({
      where: and(...whereConditions),
      with: {
        defaultAccount: true,
      },
      orderBy: [asc(parties.name)],
    });

    // Get transaction balances for all parties
    const partyIds = allParties.map(p => p.id);

    let transactionBalances: any[] = [];
    if (partyIds.length > 0) {
      transactionBalances = await db
        .select({
          partyId: journalEntryLines.partyId,
          debit: sql<string>`COALESCE(SUM(${journalEntryLines.debitAmount}), 0)`,
          credit: sql<string>`COALESCE(SUM(${journalEntryLines.creditAmount}), 0)`,
          lastTxnDate: sql<string>`MAX(${journalEntries.entryDate})`,
        })
        .from(journalEntryLines)
        .innerJoin(journalEntries, and(
          eq(journalEntryLines.journalEntryId, journalEntries.id),
          eq(journalEntries.status, 'posted'),
          eq(journalEntries.companyId, req.companyId!)
        ))
        .where(sql`${journalEntryLines.partyId} IN (${sql.join(partyIds.map(id => sql`${id}`), sql`, `)})`)
        .groupBy(journalEntryLines.partyId);
    }

    const balanceMap = new Map(transactionBalances.map(b => [b.partyId, b]));

    // Calculate balances for each party
    const partiesWithBalances = allParties.map(party => {
      const openingBalance = parseFloat(party.openingBalance || '0');
      const openingType = party.openingBalanceType || 'debit';

      const txnBalance = balanceMap.get(party.id);
      const txnDebit = parseFloat(txnBalance?.debit || '0');
      const txnCredit = parseFloat(txnBalance?.credit || '0');

      // For customers: debit increases receivable, credit decreases
      // For vendors: credit increases payable, debit decreases
      let balance = openingType === 'debit' ? openingBalance : -openingBalance;
      balance += txnDebit - txnCredit;

      const isCustomer = party.partyType === 'customer';

      return {
        ...party,
        // Customer-style fields
        totalReceivable: isCustomer ? (txnDebit + (openingType === 'debit' ? openingBalance : 0)).toFixed(2) : '0.00',
        receivedAmount: isCustomer ? txnCredit.toFixed(2) : '0.00',
        // Vendor-style fields
        totalPayable: !isCustomer ? (txnCredit + (openingType === 'credit' ? openingBalance : 0)).toFixed(2) : '0.00',
        paidAmount: !isCustomer ? txnDebit.toFixed(2) : '0.00',
        // Common fields
        outstandingAmount: Math.abs(balance).toFixed(2),
        balanceType: balance >= 0 ? 'debit' : 'credit',
        lastTransactionDate: txnBalance?.lastTxnDate || null,
      };
    });

    // Filter by search if provided
    let filtered = partiesWithBalances;
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filtered = partiesWithBalances.filter(p =>
        p.name.toLowerCase().includes(searchLower) ||
        p.gstin?.toLowerCase().includes(searchLower) ||
        p.pan?.toLowerCase().includes(searchLower)
      );
    }

    res.json(filtered);
  } catch (error) {
    console.error('Get parties error:', error);
    res.status(500).json({ error: 'Failed to get parties' });
  }
});

// Get party by ID
router.get('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const party = await db.query.parties.findFirst({
      where: and(
        eq(parties.id, id),
        eq(parties.companyId, req.companyId!)
      ),
      with: {
        defaultAccount: true,
      },
    });

    if (!party) {
      return res.status(404).json({ error: 'Party not found' });
    }

    res.json(party);
  } catch (error) {
    console.error('Get party error:', error);
    res.status(500).json({ error: 'Failed to get party' });
  }
});

// Create party
router.post('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      partyType,
      name,
      legalName,
      code,
      pan,
      gstin,
      gstRegistrationType,
      email,
      phone,
      address,
      city,
      state,
      stateCode,
      pincode,
      country,
      defaultAccountId,
      creditDays,
      creditLimit,
      tdsApplicable,
      defaultTdsSection,
      openingBalance,
      openingBalanceType,
    } = req.body;

    // Validate GSTIN uniqueness if provided
    if (gstin) {
      const existing = await db.query.parties.findFirst({
        where: and(
          eq(parties.companyId, req.companyId!),
          eq(parties.gstin, gstin)
        ),
      });
      if (existing) {
        return res.status(400).json({ error: 'A party with this GSTIN already exists' });
      }
    }

    // Handle empty strings for numeric fields
    const parsedCreditDays = creditDays === '' || creditDays === undefined ? null : creditDays;
    const parsedCreditLimit = creditLimit === '' || creditLimit === undefined ? null : creditLimit;
    const parsedOpeningBalance = openingBalance === '' || openingBalance === undefined ? '0' : openingBalance;

    const [party] = await db.insert(parties).values({
      companyId: req.companyId!,
      partyType,
      name,
      legalName: legalName || null,
      code: code || null,
      pan: pan || null,
      gstin: gstin || null,
      gstRegistrationType: gstRegistrationType || null,
      email: email || null,
      phone: phone || null,
      address: address || null,
      city: city || null,
      state: state || null,
      stateCode: stateCode || null,
      pincode: pincode || null,
      country: country || null,
      defaultAccountId: defaultAccountId || null,
      creditDays: parsedCreditDays,
      creditLimit: parsedCreditLimit,
      tdsApplicable: tdsApplicable || false,
      defaultTdsSection: defaultTdsSection || null,
      openingBalance: parsedOpeningBalance,
      openingBalanceType: openingBalanceType || 'debit',
      currentBalance: parsedOpeningBalance,
      isActive: true,
    }).returning();

    res.status(201).json(party);
  } catch (error) {
    console.error('Create party error:', error);
    res.status(500).json({ error: 'Failed to create party' });
  }
});

// Update party
router.patch('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const existing = await db.query.parties.findFirst({
      where: and(
        eq(parties.id, id),
        eq(parties.companyId, req.companyId!)
      ),
    });

    if (!existing) {
      return res.status(404).json({ error: 'Party not found' });
    }

    // Validate GSTIN uniqueness if changing
    if (req.body.gstin && req.body.gstin !== existing.gstin) {
      const duplicate = await db.query.parties.findFirst({
        where: and(
          eq(parties.companyId, req.companyId!),
          eq(parties.gstin, req.body.gstin)
        ),
      });
      if (duplicate) {
        return res.status(400).json({ error: 'A party with this GSTIN already exists' });
      }
    }

    const [updated] = await db.update(parties)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(eq(parties.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Update party error:', error);
    res.status(500).json({ error: 'Failed to update party' });
  }
});

// Get party transactions (simplified for vendor/customer pages)
router.get('/:id/transactions', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { limit = 50 } = req.query;

    const party = await db.query.parties.findFirst({
      where: and(
        eq(parties.id, id),
        eq(parties.companyId, req.companyId!)
      ),
    });

    if (!party) {
      return res.status(404).json({ error: 'Party not found' });
    }

    const transactions = await db
      .select({
        id: journalEntryLines.id,
        entryId: journalEntries.id,
        date: journalEntries.entryDate,
        type: journalEntries.entryType,
        reference: journalEntries.entryNumber,
        description: journalEntries.narration,
        debit: journalEntryLines.debitAmount,
        credit: journalEntryLines.creditAmount,
        status: journalEntries.status,
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .where(and(
        eq(journalEntryLines.partyId, id),
        eq(journalEntries.companyId, req.companyId!),
        eq(journalEntries.status, 'posted')
      ))
      .orderBy(desc(journalEntries.entryDate), desc(journalEntries.createdAt))
      .limit(Number(limit));

    // Calculate running balance from opening
    let runningBalance = party.openingBalance ? parseFloat(party.openingBalance) : 0;
    if (party.openingBalanceType === 'credit') {
      runningBalance = -runningBalance;
    }

    // We need to calculate balance from oldest to newest, but return newest first
    // Get all transactions for correct balance calculation
    const allTxns = await db
      .select({
        debit: journalEntryLines.debitAmount,
        credit: journalEntryLines.creditAmount,
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .where(and(
        eq(journalEntryLines.partyId, id),
        eq(journalEntries.companyId, req.companyId!),
        eq(journalEntries.status, 'posted')
      ))
      .orderBy(asc(journalEntries.entryDate), asc(journalEntries.createdAt));

    // Calculate current total balance
    for (const txn of allTxns) {
      runningBalance += parseFloat(txn.debit || '0') - parseFloat(txn.credit || '0');
    }

    // Map transactions for display
    const txnsWithBalance = transactions.map(txn => {
      const debit = parseFloat(txn.debit || '0');
      const credit = parseFloat(txn.credit || '0');
      const amount = party.partyType === 'customer' ? debit || credit : credit || debit;

      // Determine transaction type based on entry type
      let type = 'journal';
      if (txn.type === 'auto_invoice') type = 'invoice';
      else if (txn.type === 'auto_payment') type = 'payment';
      else if (txn.type === 'auto_expense') type = 'bill';

      return {
        id: txn.id,
        date: txn.date,
        type,
        reference: txn.reference,
        description: txn.description,
        amount: amount.toFixed(2),
        balance: Math.abs(runningBalance).toFixed(2),
        status: txn.status,
      };
    });

    res.json(txnsWithBalance);
  } catch (error) {
    console.error('Get party transactions error:', error);
    res.status(500).json({ error: 'Failed to get transactions' });
  }
});

// Get party ledger
router.get('/:id/ledger', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { fiscalYearId, startDate, endDate } = req.query;

    const party = await db.query.parties.findFirst({
      where: and(
        eq(parties.id, id),
        eq(parties.companyId, req.companyId!)
      ),
    });

    if (!party) {
      return res.status(404).json({ error: 'Party not found' });
    }

    let whereConditions = [
      eq(journalEntryLines.partyId, id),
      eq(journalEntries.companyId, req.companyId!),
      eq(journalEntries.status, 'posted'),
    ];

    if (fiscalYearId) {
      whereConditions.push(eq(journalEntries.fiscalYearId, fiscalYearId as string));
    }
    if (startDate) {
      whereConditions.push(sql`${journalEntries.entryDate} >= ${startDate}`);
    }
    if (endDate) {
      whereConditions.push(sql`${journalEntries.entryDate} <= ${endDate}`);
    }

    const entries = await db
      .select({
        lineId: journalEntryLines.id,
        entryId: journalEntries.id,
        entryNumber: journalEntries.entryNumber,
        entryDate: journalEntries.entryDate,
        narration: journalEntries.narration,
        debitAmount: journalEntryLines.debitAmount,
        creditAmount: journalEntryLines.creditAmount,
        description: journalEntryLines.description,
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, eq(journalEntryLines.journalEntryId, journalEntries.id))
      .where(and(...whereConditions))
      .orderBy(asc(journalEntries.entryDate), asc(journalEntries.createdAt));

    // Calculate running balance
    let runningBalance = party.openingBalance ? parseFloat(party.openingBalance) : 0;
    if (party.openingBalanceType === 'credit') {
      runningBalance = -runningBalance;
    }

    const ledgerEntries = entries.map(entry => {
      const debit = parseFloat(entry.debitAmount || '0');
      const credit = parseFloat(entry.creditAmount || '0');
      runningBalance += debit - credit;

      return {
        ...entry,
        debit,
        credit,
        balance: Math.abs(runningBalance),
        balanceType: runningBalance >= 0 ? 'Dr' : 'Cr',
      };
    });

    res.json({
      party,
      openingBalance: party.openingBalance ? parseFloat(party.openingBalance) : 0,
      openingBalanceType: party.openingBalanceType,
      entries: ledgerEntries,
      closingBalance: Math.abs(runningBalance),
      closingBalanceType: runningBalance >= 0 ? 'Dr' : 'Cr',
    });
  } catch (error) {
    console.error('Party ledger error:', error);
    res.status(500).json({ error: 'Failed to get party ledger' });
  }
});

// Get party outstanding summary
router.get('/outstanding/summary', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { type } = req.query;

    let whereConditions = [
      eq(parties.companyId, req.companyId!),
      eq(parties.isActive, true),
    ];

    if (type) {
      whereConditions.push(eq(parties.partyType, type as any));
    }

    const allParties = await db.query.parties.findMany({
      where: and(...whereConditions),
    });

    // Get balances from journal entries
    const balances = await db
      .select({
        partyId: journalEntryLines.partyId,
        debit: sql<string>`COALESCE(SUM(${journalEntryLines.debitAmount}), 0)`,
        credit: sql<string>`COALESCE(SUM(${journalEntryLines.creditAmount}), 0)`,
      })
      .from(journalEntryLines)
      .innerJoin(journalEntries, and(
        eq(journalEntryLines.journalEntryId, journalEntries.id),
        eq(journalEntries.status, 'posted')
      ))
      .where(sql`${journalEntryLines.partyId} IS NOT NULL`)
      .groupBy(journalEntryLines.partyId);

    const balanceMap = new Map(balances.map(b => [b.partyId, b]));

    const outstanding = allParties.map(party => {
      let balance = party.openingBalance ? parseFloat(party.openingBalance) : 0;
      if (party.openingBalanceType === 'credit') {
        balance = -balance;
      }

      const txBalance = balanceMap.get(party.id);
      if (txBalance) {
        balance += parseFloat(txBalance.debit) - parseFloat(txBalance.credit);
      }

      return {
        partyId: party.id,
        partyName: party.name,
        partyType: party.partyType,
        gstin: party.gstin,
        balance: Math.abs(balance),
        balanceType: balance >= 0 ? 'Dr' : 'Cr',
      };
    }).filter(p => p.balance > 0);

    // Separate receivables and payables
    const receivables = outstanding.filter(p => p.balanceType === 'Dr');
    const payables = outstanding.filter(p => p.balanceType === 'Cr');

    res.json({
      receivables,
      payables,
      totalReceivables: receivables.reduce((sum, p) => sum + p.balance, 0),
      totalPayables: payables.reduce((sum, p) => sum + p.balance, 0),
    });
  } catch (error) {
    console.error('Outstanding summary error:', error);
    res.status(500).json({ error: 'Failed to get outstanding summary' });
  }
});

// Delete party
router.delete('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const party = await db.query.parties.findFirst({
      where: and(
        eq(parties.id, id),
        eq(parties.companyId, req.companyId!)
      ),
    });

    if (!party) {
      return res.status(404).json({ error: 'Party not found' });
    }

    // Check for transactions
    const hasTransactions = await db.query.journalEntryLines.findFirst({
      where: eq(journalEntryLines.partyId, id),
    });

    if (hasTransactions) {
      // Soft delete
      await db.update(parties)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(parties.id, id));
      return res.json({ message: 'Party deactivated (has transactions)' });
    }

    await db.delete(parties).where(eq(parties.id, id));
    res.json({ message: 'Party deleted' });
  } catch (error) {
    console.error('Delete party error:', error);
    res.status(500).json({ error: 'Failed to delete party' });
  }
});

export default router;
