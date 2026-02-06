import { Router } from 'express';
import { db } from '../db';
import { parties, journalEntryLines, journalEntries } from '@shared/schema';
import { eq, and, asc, sql, desc } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all parties
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

    // Filter by search if provided
    let filtered = allParties;
    if (search) {
      const searchLower = (search as string).toLowerCase();
      filtered = allParties.filter(p =>
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

    const [party] = await db.insert(parties).values({
      companyId: req.companyId!,
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
      currentBalance: openingBalance || '0',
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
