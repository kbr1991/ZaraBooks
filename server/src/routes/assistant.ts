import { Router } from 'express';
import { db } from '../db';
import { aiConversations, journalEntries, chartOfAccounts, fiscalYears, parties } from '@shared/schema';
import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';
import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';

const router = Router();

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Chat with assistant
router.post('/chat', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { message, sessionId = randomUUID() } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Save user message
    await db.insert(aiConversations).values({
      companyId: req.companyId!,
      userId: req.userId!,
      sessionId,
      messageType: 'user',
      content: message,
    });

    // Get company context
    const fy = await db.query.fiscalYears.findFirst({
      where: and(
        eq(fiscalYears.companyId, req.companyId!),
        eq(fiscalYears.isCurrent, true)
      ),
    });

    // Get relevant data based on the query
    const contextData = await getContextData(req.companyId!, message, fy?.id);

    // Get conversation history
    const history = await db.query.aiConversations.findMany({
      where: and(
        eq(aiConversations.sessionId, sessionId),
        eq(aiConversations.companyId, req.companyId!)
      ),
      orderBy: aiConversations.createdAt,
      limit: 10,
    });

    // Build messages for Claude
    const messages: { role: 'user' | 'assistant'; content: string }[] = history.map(h => ({
      role: h.messageType as 'user' | 'assistant',
      content: h.content,
    }));

    // Add current message with context
    messages.push({
      role: 'user',
      content: `Context data: ${JSON.stringify(contextData)}\n\nUser question: ${message}`,
    });

    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
      system: `You are Zara, an AI accounting assistant for Zara Books, an accounting application for CA firms and businesses in India.

Your capabilities:
- Answer questions about financial data, balances, and transactions
- Explain accounting concepts and GST/TDS compliance requirements
- Provide insights on revenue, expenses, and profitability
- Help with tax-related queries (GST filing dates, TDS rates, etc.)
- Summarize financial statements and trial balance

Guidelines:
- Be concise and professional
- Use Indian accounting terminology (Rupees/INR, Lakhs, Crores)
- Format numbers with commas for thousands (e.g., 1,00,000)
- Reference specific data when available
- If you don't have enough data, say so
- For compliance deadlines, be accurate about GST and TDS due dates
- Always consider the fiscal year (April-March) for Indian companies

Current fiscal year: ${fy?.name || 'Not set'}`,
      messages,
    });

    const assistantMessage = response.content[0].type === 'text'
      ? response.content[0].text
      : 'I apologize, but I could not generate a response.';

    // Save assistant response
    await db.insert(aiConversations).values({
      companyId: req.companyId!,
      userId: req.userId!,
      sessionId,
      messageType: 'assistant',
      content: assistantMessage,
      contextData,
    });

    res.json({
      message: assistantMessage,
      sessionId,
    });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Get quick insights
router.get('/insights', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const fy = await db.query.fiscalYears.findFirst({
      where: and(
        eq(fiscalYears.companyId, req.companyId!),
        eq(fiscalYears.isCurrent, true)
      ),
    });

    if (!fy) {
      return res.json({ insights: [] });
    }

    const insights = [];

    // Check for unusual transactions
    const recentEntries = await db.query.journalEntries.findMany({
      where: and(
        eq(journalEntries.companyId, req.companyId!),
        eq(journalEntries.status, 'posted'),
        eq(journalEntries.fiscalYearId, fy.id)
      ),
      orderBy: desc(journalEntries.entryDate),
      limit: 50,
    });

    const amounts = recentEntries.map(e => parseFloat(e.totalDebit));
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const largeEntries = recentEntries.filter(e => parseFloat(e.totalDebit) > avgAmount * 3);

    if (largeEntries.length > 0) {
      insights.push({
        type: 'alert',
        title: 'Large Transactions',
        message: `${largeEntries.length} transactions significantly higher than average detected this period.`,
      });
    }

    // Check receivables
    const receivables = await db.query.parties.findMany({
      where: and(
        eq(parties.companyId, req.companyId!),
        eq(parties.partyType, 'customer'),
        sql`${parties.currentBalance} > 0`
      ),
    });

    const totalReceivables = receivables.reduce(
      (sum, p) => sum + parseFloat(p.currentBalance || '0'), 0
    );

    if (totalReceivables > 0) {
      insights.push({
        type: 'info',
        title: 'Outstanding Receivables',
        message: `Total receivables: ₹${totalReceivables.toLocaleString('en-IN')} from ${receivables.length} customers.`,
      });
    }

    // GST reminder
    const today = new Date();
    const gstr3bDue = new Date(today.getFullYear(), today.getMonth() + 1, 20);
    const daysToGstr3b = Math.ceil((gstr3bDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysToGstr3b <= 5 && daysToGstr3b > 0) {
      insights.push({
        type: 'warning',
        title: 'GSTR-3B Due Soon',
        message: `GSTR-3B is due in ${daysToGstr3b} days. Ensure all invoices are recorded.`,
      });
    }

    // TDS reminder
    const tdsDue = new Date(today.getFullYear(), today.getMonth() + 1, 7);
    const daysToTds = Math.ceil((tdsDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysToTds <= 3 && daysToTds > 0) {
      insights.push({
        type: 'warning',
        title: 'TDS Payment Due',
        message: `TDS payment for the month is due in ${daysToTds} days.`,
      });
    }

    res.json({ insights });
  } catch (error) {
    console.error('Insights error:', error);
    res.status(500).json({ error: 'Failed to get insights' });
  }
});

// Get conversation history
router.get('/history', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { sessionId, limit = 20 } = req.query;

    let whereConditions = [
      eq(aiConversations.companyId, req.companyId!),
      eq(aiConversations.userId, req.userId!),
    ];

    if (sessionId) {
      whereConditions.push(eq(aiConversations.sessionId, sessionId as string));
    }

    const conversations = await db.query.aiConversations.findMany({
      where: and(...whereConditions),
      orderBy: desc(aiConversations.createdAt),
      limit: Number(limit),
    });

    res.json(conversations);
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// Helper function to get context data based on query
async function getContextData(companyId: string, query: string, fiscalYearId?: string) {
  const queryLower = query.toLowerCase();
  const context: Record<string, any> = {};

  // Financial queries
  if (queryLower.includes('revenue') || queryLower.includes('income') || queryLower.includes('sales')) {
    const incomeData = await db
      .select({
        total: sql<string>`COALESCE(SUM(credit_amount), 0)`,
      })
      .from(sql`journal_entry_lines jel
        JOIN journal_entries je ON jel.journal_entry_id = je.id
        JOIN chart_of_accounts coa ON jel.account_id = coa.id`)
      .where(sql`je.company_id = ${companyId}
        AND je.status = 'posted'
        AND coa.account_type = 'income'
        ${fiscalYearId ? sql`AND je.fiscal_year_id = ${fiscalYearId}` : sql``}`);

    context.totalIncome = parseFloat(incomeData[0]?.total || '0');
  }

  if (queryLower.includes('expense') || queryLower.includes('cost')) {
    const expenseData = await db
      .select({
        total: sql<string>`COALESCE(SUM(debit_amount), 0)`,
      })
      .from(sql`journal_entry_lines jel
        JOIN journal_entries je ON jel.journal_entry_id = je.id
        JOIN chart_of_accounts coa ON jel.account_id = coa.id`)
      .where(sql`je.company_id = ${companyId}
        AND je.status = 'posted'
        AND coa.account_type = 'expense'
        ${fiscalYearId ? sql`AND je.fiscal_year_id = ${fiscalYearId}` : sql``}`);

    context.totalExpenses = parseFloat(expenseData[0]?.total || '0');
  }

  if (queryLower.includes('profit') || queryLower.includes('loss')) {
    // Get both income and expense
    const plData = await db
      .select({
        accountType: sql<string>`coa.account_type`,
        debit: sql<string>`COALESCE(SUM(debit_amount), 0)`,
        credit: sql<string>`COALESCE(SUM(credit_amount), 0)`,
      })
      .from(sql`journal_entry_lines jel
        JOIN journal_entries je ON jel.journal_entry_id = je.id
        JOIN chart_of_accounts coa ON jel.account_id = coa.id`)
      .where(sql`je.company_id = ${companyId}
        AND je.status = 'posted'
        AND coa.account_type IN ('income', 'expense')
        ${fiscalYearId ? sql`AND je.fiscal_year_id = ${fiscalYearId}` : sql``}`)
      .groupBy(sql`coa.account_type`);

    let income = 0, expense = 0;
    plData.forEach((row: any) => {
      if (row.accountType === 'income') {
        income = parseFloat(row.credit) - parseFloat(row.debit);
      } else {
        expense = parseFloat(row.debit) - parseFloat(row.credit);
      }
    });

    context.netProfit = income - expense;
    context.totalIncome = income;
    context.totalExpenses = expense;
  }

  // Receivables/Payables
  if (queryLower.includes('receivable') || queryLower.includes('unpaid') || queryLower.includes('outstanding')) {
    const receivables = await db.query.parties.findMany({
      where: and(
        eq(parties.companyId, companyId),
        eq(parties.partyType, 'customer')
      ),
    });

    context.totalReceivables = receivables.reduce(
      (sum, p) => sum + parseFloat(p.currentBalance || '0'), 0
    );
    context.customerCount = receivables.filter(p => parseFloat(p.currentBalance || '0') > 0).length;
  }

  if (queryLower.includes('payable') || queryLower.includes('owe') || queryLower.includes('vendor')) {
    const payables = await db.query.parties.findMany({
      where: and(
        eq(parties.companyId, companyId),
        eq(parties.partyType, 'vendor')
      ),
    });

    context.totalPayables = payables.reduce(
      (sum, p) => sum + Math.abs(parseFloat(p.currentBalance || '0')), 0
    );
    context.vendorCount = payables.filter(p => parseFloat(p.currentBalance || '0') !== 0).length;
  }

  // GST queries
  if (queryLower.includes('gst') || queryLower.includes('tax')) {
    context.gstInfo = {
      gstr1DueDate: 'Monthly: 11th of next month',
      gstr3bDueDate: 'Monthly: 20th of next month',
      rates: '0%, 5%, 12%, 18%, 28%',
    };
  }

  // TDS queries
  if (queryLower.includes('tds')) {
    context.tdsInfo = {
      paymentDueDate: '7th of next month',
      returnDueDate: 'Quarterly: 31st of month after quarter end',
      commonSections: {
        '194J': 'Professional fees - 10%',
        '194C': 'Contractors - 1%/2%',
        '194H': 'Commission - 5%',
        '194I': 'Rent - 10%',
      },
    };
  }

  return context;
}

export default router;
