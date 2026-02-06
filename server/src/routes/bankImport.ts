import { Router } from 'express';
import { db } from '../db';
import {
  journalEntries, journalEntryLines, chartOfAccounts,
  bankAccounts, bankTransactions, parties
} from '@shared/schema';
import { eq, and, sql, desc, or, like } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Bank transaction matching rules
interface MatchRule {
  pattern: string;
  accountId: string;
  partyId?: string;
  description: string;
}

// Parse CSV bank statement
function parseCSV(content: string): Array<{
  date: string;
  description: string;
  debit?: number;
  credit?: number;
  balance?: number;
  reference?: string;
}> {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  // Try to detect header row and column positions
  const header = lines[0].toLowerCase();
  const columns = header.split(',').map(c => c.trim().replace(/"/g, ''));

  const dateIdx = columns.findIndex(c => c.includes('date') || c.includes('txn'));
  const descIdx = columns.findIndex(c => c.includes('description') || c.includes('narration') || c.includes('particular'));
  const debitIdx = columns.findIndex(c => c.includes('debit') || c.includes('withdrawal') || c.includes('dr'));
  const creditIdx = columns.findIndex(c => c.includes('credit') || c.includes('deposit') || c.includes('cr'));
  const balanceIdx = columns.findIndex(c => c.includes('balance'));
  const refIdx = columns.findIndex(c => c.includes('reference') || c.includes('ref') || c.includes('chq'));

  const transactions: Array<{
    date: string;
    description: string;
    debit?: number;
    credit?: number;
    balance?: number;
    reference?: string;
  }> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle quoted CSV values
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const parseAmount = (val: string | undefined): number | undefined => {
      if (!val) return undefined;
      const cleaned = val.replace(/[,'"₹$]/g, '').trim();
      const num = parseFloat(cleaned);
      return isNaN(num) ? undefined : Math.abs(num);
    };

    const parseDate = (val: string): string => {
      // Try different date formats
      const cleaned = val.replace(/"/g, '').trim();

      // DD/MM/YYYY or DD-MM-YYYY
      const dmyMatch = cleaned.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (dmyMatch) {
        return `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
      }

      // YYYY-MM-DD
      const isoMatch = cleaned.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) {
        return cleaned;
      }

      // MM/DD/YYYY
      const mdyMatch = cleaned.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (mdyMatch) {
        return `${mdyMatch[3]}-${mdyMatch[1].padStart(2, '0')}-${mdyMatch[2].padStart(2, '0')}`;
      }

      return cleaned;
    };

    const date = dateIdx >= 0 ? parseDate(values[dateIdx] || '') : '';
    const description = descIdx >= 0 ? (values[descIdx] || '').replace(/"/g, '') : '';

    if (!date || !description) continue;

    transactions.push({
      date,
      description,
      debit: debitIdx >= 0 ? parseAmount(values[debitIdx]) : undefined,
      credit: creditIdx >= 0 ? parseAmount(values[creditIdx]) : undefined,
      balance: balanceIdx >= 0 ? parseAmount(values[balanceIdx]) : undefined,
      reference: refIdx >= 0 ? values[refIdx]?.replace(/"/g, '') : undefined,
    });
  }

  return transactions;
}

// Get bank accounts
router.get('/bank-accounts', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const accounts = await db.query.bankAccounts.findMany({
      where: and(
        eq(bankAccounts.companyId, req.companyId!),
        eq(bankAccounts.isActive, true)
      ),
    });

    // Also get chart of accounts that are bank accounts
    const coaAccounts = await db.query.chartOfAccounts.findMany({
      where: and(
        eq(chartOfAccounts.companyId, req.companyId!),
        eq(chartOfAccounts.isActive, true),
        or(
          like(chartOfAccounts.name, '%Bank%'),
          like(chartOfAccounts.scheduleIIIMapping, '%BANK%'),
          like(chartOfAccounts.scheduleIIIMapping, '%CASH%')
        )
      ),
    });

    res.json({ bankAccounts: accounts, coaAccounts });
  } catch (error) {
    console.error('Get bank accounts error:', error);
    res.status(500).json({ error: 'Failed to get bank accounts' });
  }
});

// Upload and parse bank statement
router.post('/parse', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { content, bankAccountId, format = 'csv' } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Statement content is required' });
    }

    let transactions;
    if (format === 'csv') {
      transactions = parseCSV(content);
    } else {
      return res.status(400).json({ error: 'Unsupported format. Use CSV.' });
    }

    if (transactions.length === 0) {
      return res.status(400).json({ error: 'No transactions found in statement' });
    }

    // Get matching rules for auto-categorization
    const accounts = await db.query.chartOfAccounts.findMany({
      where: and(
        eq(chartOfAccounts.companyId, req.companyId!),
        eq(chartOfAccounts.isActive, true),
        eq(chartOfAccounts.isGroup, false)
      ),
    });

    const partiesList = await db.query.parties.findMany({
      where: eq(parties.companyId, req.companyId!),
    });

    // Auto-match transactions
    const matched = transactions.map(txn => {
      const desc = txn.description.toLowerCase();
      let suggestedAccount: typeof accounts[0] | undefined;
      let suggestedParty: typeof partiesList[0] | undefined;

      // Match patterns
      if (desc.includes('salary') || desc.includes('payroll')) {
        suggestedAccount = accounts.find(a => a.name.toLowerCase().includes('salary'));
      } else if (desc.includes('rent')) {
        suggestedAccount = accounts.find(a => a.name.toLowerCase().includes('rent'));
      } else if (desc.includes('electricity') || desc.includes('power') || desc.includes('utility')) {
        suggestedAccount = accounts.find(a => a.name.toLowerCase().includes('utility') || a.name.toLowerCase().includes('electricity'));
      } else if (desc.includes('telephone') || desc.includes('mobile') || desc.includes('internet')) {
        suggestedAccount = accounts.find(a => a.name.toLowerCase().includes('telephone') || a.name.toLowerCase().includes('communication'));
      } else if (desc.includes('gst') || desc.includes('tax')) {
        suggestedAccount = accounts.find(a => a.name.toLowerCase().includes('gst') || a.name.toLowerCase().includes('tax'));
      } else if (desc.includes('insurance')) {
        suggestedAccount = accounts.find(a => a.name.toLowerCase().includes('insurance'));
      } else if (desc.includes('interest')) {
        suggestedAccount = accounts.find(a => a.name.toLowerCase().includes('interest'));
      }

      // Match parties by name
      for (const party of partiesList) {
        if (desc.includes(party.name.toLowerCase())) {
          suggestedParty = party;
          break;
        }
      }

      return {
        ...txn,
        suggestedAccountId: suggestedAccount?.id,
        suggestedAccountName: suggestedAccount?.name,
        suggestedPartyId: suggestedParty?.id,
        suggestedPartyName: suggestedParty?.name,
        isMatched: !!suggestedAccount,
      };
    });

    res.json({
      transactions: matched,
      summary: {
        total: transactions.length,
        matched: matched.filter(t => t.isMatched).length,
        unmatched: matched.filter(t => !t.isMatched).length,
        totalDebit: transactions.reduce((sum, t) => sum + (t.debit || 0), 0),
        totalCredit: transactions.reduce((sum, t) => sum + (t.credit || 0), 0),
      },
    });
  } catch (error) {
    console.error('Parse statement error:', error);
    res.status(500).json({ error: 'Failed to parse statement' });
  }
});

// Create journal entries from bank transactions
router.post('/import', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { bankAccountId, transactions } = req.body;

    if (!bankAccountId || !transactions || !Array.isArray(transactions)) {
      return res.status(400).json({ error: 'Bank account and transactions are required' });
    }

    // Get the bank account from CoA
    const bankAccount = await db.query.chartOfAccounts.findFirst({
      where: and(
        eq(chartOfAccounts.id, bankAccountId),
        eq(chartOfAccounts.companyId, req.companyId!)
      ),
    });

    if (!bankAccount) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    // Get current fiscal year
    const fiscalYear = await db.query.fiscalYears.findFirst({
      where: and(
        eq(sql`fiscal_years.company_id`, req.companyId!),
        eq(sql`fiscal_years.is_current`, true)
      ),
    });

    if (!fiscalYear) {
      return res.status(400).json({ error: 'No active fiscal year found' });
    }

    const createdEntries: string[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < transactions.length; i++) {
      const txn = transactions[i];

      if (!txn.accountId || (!txn.debit && !txn.credit)) {
        errors.push({ index: i, error: 'Account and amount are required' });
        continue;
      }

      try {
        // Generate entry number
        const lastEntry = await db.query.journalEntries.findFirst({
          where: and(
            eq(journalEntries.companyId, req.companyId!),
            eq(journalEntries.fiscalYearId, fiscalYear.id)
          ),
          orderBy: desc(journalEntries.entryNumber),
        });

        const lastNum = lastEntry?.entryNumber
          ? parseInt(lastEntry.entryNumber.split('/').pop() || '0')
          : 0;
        const entryNumber = `BK/${fiscalYear.name}/${String(lastNum + 1).padStart(4, '0')}`;

        const amount = txn.debit || txn.credit;
        const isDebit = !!txn.debit; // Bank has debit = money going out

        // Create journal entry
        const [entry] = await db.insert(journalEntries).values({
          companyId: req.companyId!,
          fiscalYearId: fiscalYear.id,
          entryNumber,
          entryDate: txn.date,
          postingDate: txn.date,
          entryType: 'bank_import',
          narration: txn.description,
          totalDebit: amount,
          totalCredit: amount,
          sourceType: 'bank_import',
          status: 'draft',
          createdByUserId: req.userId!,
        }).returning();

        // Create journal entry lines
        // If bank shows debit (money out): Debit expense/asset, Credit bank
        // If bank shows credit (money in): Debit bank, Credit income/liability
        await db.insert(journalEntryLines).values([
          {
            journalEntryId: entry.id,
            accountId: isDebit ? txn.accountId : bankAccountId,
            debitAmount: amount,
            creditAmount: 0,
            partyId: txn.partyId || null,
            description: txn.description,
          },
          {
            journalEntryId: entry.id,
            accountId: isDebit ? bankAccountId : txn.accountId,
            debitAmount: 0,
            creditAmount: amount,
            partyId: txn.partyId || null,
            description: txn.description,
          },
        ]);

        createdEntries.push(entry.id);
      } catch (err) {
        errors.push({ index: i, error: 'Failed to create entry' });
      }
    }

    res.json({
      success: true,
      created: createdEntries.length,
      errors,
      entryIds: createdEntries,
    });
  } catch (error) {
    console.error('Import transactions error:', error);
    res.status(500).json({ error: 'Failed to import transactions' });
  }
});

// Get import history
router.get('/history', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const imports = await db.query.journalEntries.findMany({
      where: and(
        eq(journalEntries.companyId, req.companyId!),
        eq(journalEntries.entryType, 'bank_import')
      ),
      orderBy: desc(journalEntries.createdAt),
      limit: 50,
      with: {
        lines: {
          with: {
            account: true,
          },
        },
      },
    });

    res.json(imports);
  } catch (error) {
    console.error('Get import history error:', error);
    res.status(500).json({ error: 'Failed to get import history' });
  }
});

export default router;
