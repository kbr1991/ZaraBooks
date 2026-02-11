/**
 * Voice Interface Service
 *
 * Handles voice transcription and intent parsing for voice-based accounting
 */

import { db } from '../../db';
import {
  voiceTranscriptions,
  expenses,
  invoices,
  parties,
  chartOfAccounts,
  fiscalYears,
  type VoiceTranscription
} from '../../../../shared/schema';
import { eq, and, ilike } from 'drizzle-orm';

type VoiceIntent =
  | 'create_expense'
  | 'create_invoice'
  | 'check_balance'
  | 'get_report'
  | 'create_payment'
  | 'query_party'
  | 'unknown';

interface ParsedEntities {
  amount?: number;
  party?: string;
  date?: string;
  description?: string;
  category?: string;
  paymentMethod?: string;
}

interface ParseResult {
  intent: VoiceIntent;
  entities: ParsedEntities;
  confidence: number;
}

/**
 * Transcribes audio and parses the intent
 */
export async function processVoiceInput(
  companyId: string,
  userId: string,
  audioUrl: string
): Promise<VoiceTranscription> {
  // Create transcription record
  const [transcription] = await db.insert(voiceTranscriptions)
    .values({
      companyId,
      userId,
      audioUrl,
      language: 'en-IN'
    })
    .returning();

  try {
    // Transcribe audio (would use Google Speech-to-Text in production)
    const transcribedText = await transcribeAudio(audioUrl);

    // Parse intent and entities
    const parseResult = parseVoiceCommand(transcribedText);

    // Update transcription record
    await db.update(voiceTranscriptions)
      .set({
        transcription: transcribedText,
        transcriptionConfidence: '85', // Would come from API
        parsedIntent: parseResult.intent,
        parsedEntities: parseResult.entities,
        intentConfidence: parseResult.confidence.toString(),
        requiresConfirmation: true
      })
      .where(eq(voiceTranscriptions.id, transcription.id));

    // Return updated record
    const [updated] = await db.select()
      .from(voiceTranscriptions)
      .where(eq(voiceTranscriptions.id, transcription.id));

    return updated;
  } catch (error) {
    await db.update(voiceTranscriptions)
      .set({
        errorMessage: error instanceof Error ? error.message : 'Transcription failed'
      })
      .where(eq(voiceTranscriptions.id, transcription.id));

    throw error;
  }
}

/**
 * Transcribes audio to text
 */
async function transcribeAudio(audioUrl: string): Promise<string> {
  // In production, use Google Speech-to-Text API:
  // const speech = require('@google-cloud/speech');
  // const client = new speech.SpeechClient();

  if (!process.env.GOOGLE_SPEECH_API_KEY) {
    // Development mode - return placeholder
    return '';
  }

  // Production transcription would go here
  return '';
}

/**
 * Parses voice command to extract intent and entities
 */
export function parseVoiceCommand(text: string): ParseResult {
  const lowerText = text.toLowerCase();

  // Default result
  const result: ParseResult = {
    intent: 'unknown',
    entities: {},
    confidence: 0
  };

  // Expense creation patterns
  const expensePatterns = [
    /(?:add|create|record|log)\s+(?:an?\s+)?expense/i,
    /(?:spent|paid|purchased)\s+/i,
    /expense\s+(?:of|for)\s+/i,
    /bought\s+/i
  ];

  // Invoice creation patterns
  const invoicePatterns = [
    /(?:create|generate|make)\s+(?:an?\s+)?invoice/i,
    /invoice\s+(?:for|to)\s+/i,
    /bill\s+(?:for|to)\s+/i
  ];

  // Balance check patterns
  const balancePatterns = [
    /(?:what('?s|\s+is)\s+)?(?:my\s+)?(?:current\s+)?balance/i,
    /(?:how\s+much\s+)?(?:money\s+)?(?:do\s+)?(?:i\s+)?have/i,
    /(?:check|show)\s+balance/i
  ];

  // Report patterns
  const reportPatterns = [
    /(?:show|get|generate)\s+(?:me\s+)?(?:the\s+)?report/i,
    /(?:profit\s+(?:and\s+)?loss|p\s*&?\s*l)/i,
    /(?:trial\s+)?balance\s+sheet/i
  ];

  // Payment patterns
  const paymentPatterns = [
    /(?:record|add)\s+(?:a\s+)?payment/i,
    /(?:received|got)\s+payment/i,
    /payment\s+(?:from|of)/i
  ];

  // Check each pattern type
  if (expensePatterns.some(p => p.test(lowerText))) {
    result.intent = 'create_expense';
    result.confidence = 85;
    result.entities = extractExpenseEntities(text);
  } else if (invoicePatterns.some(p => p.test(lowerText))) {
    result.intent = 'create_invoice';
    result.confidence = 85;
    result.entities = extractInvoiceEntities(text);
  } else if (balancePatterns.some(p => p.test(lowerText))) {
    result.intent = 'check_balance';
    result.confidence = 90;
  } else if (reportPatterns.some(p => p.test(lowerText))) {
    result.intent = 'get_report';
    result.confidence = 85;
    result.entities = extractReportEntities(text);
  } else if (paymentPatterns.some(p => p.test(lowerText))) {
    result.intent = 'create_payment';
    result.confidence = 85;
    result.entities = extractPaymentEntities(text);
  }

  return result;
}

/**
 * Extracts expense entities from text
 */
function extractExpenseEntities(text: string): ParsedEntities {
  const entities: ParsedEntities = {};

  // Extract amount
  const amountMatch = text.match(/(?:rs\.?|rupees?|₹)\s*(\d+(?:,\d+)*(?:\.\d{2})?)/i) ||
    text.match(/(\d+(?:,\d+)*(?:\.\d{2})?)\s*(?:rs\.?|rupees?|₹)/i) ||
    text.match(/(?:for|of)\s+(\d+(?:,\d+)*(?:\.\d{2})?)/i);

  if (amountMatch) {
    entities.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
  }

  // Extract category/description
  const categories = [
    'travel', 'food', 'office supplies', 'utilities', 'rent',
    'internet', 'phone', 'electricity', 'fuel', 'petrol', 'diesel',
    'stationery', 'courier', 'printing', 'repairs', 'maintenance'
  ];

  for (const category of categories) {
    if (text.toLowerCase().includes(category)) {
      entities.category = category;
      entities.description = `${category.charAt(0).toUpperCase()}${category.slice(1)} expense`;
      break;
    }
  }

  // Extract payment method
  const paymentMethods = {
    'cash': ['cash', 'paid cash'],
    'upi': ['upi', 'google pay', 'paytm', 'phonepe', 'gpay'],
    'card': ['card', 'credit card', 'debit card'],
    'bank': ['bank', 'neft', 'imps', 'rtgs', 'transfer']
  };

  for (const [method, keywords] of Object.entries(paymentMethods)) {
    if (keywords.some(k => text.toLowerCase().includes(k))) {
      entities.paymentMethod = method;
      break;
    }
  }

  // Extract party name (if mentioned)
  const partyMatch = text.match(/(?:to|from|at|paid)\s+([A-Z][a-zA-Z\s]+?)(?:\s+for|$)/i);
  if (partyMatch) {
    entities.party = partyMatch[1].trim();
  }

  return entities;
}

/**
 * Extracts invoice entities from text
 */
function extractInvoiceEntities(text: string): ParsedEntities {
  const entities: ParsedEntities = {};

  // Extract amount
  const amountMatch = text.match(/(?:rs\.?|rupees?|₹)\s*(\d+(?:,\d+)*(?:\.\d{2})?)/i) ||
    text.match(/(\d+(?:,\d+)*(?:\.\d{2})?)\s*(?:rs\.?|rupees?|₹)/i);

  if (amountMatch) {
    entities.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
  }

  // Extract party name
  const partyMatch = text.match(/(?:for|to)\s+([A-Z][a-zA-Z\s]+?)(?:\s+for|$)/i);
  if (partyMatch) {
    entities.party = partyMatch[1].trim();
  }

  // Extract description
  const descMatch = text.match(/(?:for\s+)(.+?)(?:\s+(?:of|for)\s+(?:rs\.?|rupees?|₹)|\s*$)/i);
  if (descMatch) {
    entities.description = descMatch[1].trim();
  }

  return entities;
}

/**
 * Extracts report entities from text
 */
function extractReportEntities(text: string): ParsedEntities {
  const entities: ParsedEntities = {};
  const lowerText = text.toLowerCase();

  // Determine report type
  if (lowerText.includes('profit') || lowerText.includes('p&l') || lowerText.includes('p and l')) {
    entities.category = 'profit_loss';
  } else if (lowerText.includes('balance sheet')) {
    entities.category = 'balance_sheet';
  } else if (lowerText.includes('trial balance')) {
    entities.category = 'trial_balance';
  } else if (lowerText.includes('cash flow')) {
    entities.category = 'cash_flow';
  }

  return entities;
}

/**
 * Extracts payment entities from text
 */
function extractPaymentEntities(text: string): ParsedEntities {
  const entities: ParsedEntities = {};

  // Extract amount
  const amountMatch = text.match(/(?:rs\.?|rupees?|₹)\s*(\d+(?:,\d+)*(?:\.\d{2})?)/i) ||
    text.match(/(\d+(?:,\d+)*(?:\.\d{2})?)\s*(?:rs\.?|rupees?|₹)/i);

  if (amountMatch) {
    entities.amount = parseFloat(amountMatch[1].replace(/,/g, ''));
  }

  // Extract party name
  const partyMatch = text.match(/(?:from|by)\s+([A-Z][a-zA-Z\s]+?)(?:\s+(?:for|of)|$)/i);
  if (partyMatch) {
    entities.party = partyMatch[1].trim();
  }

  return entities;
}

/**
 * Executes the parsed voice command
 */
export async function executeVoiceCommand(
  transcriptionId: string,
  companyId: string,
  userId: string
): Promise<{
  success: boolean;
  entryType?: string;
  entryId?: string;
  message: string;
}> {
  const [transcription] = await db.select()
    .from(voiceTranscriptions)
    .where(and(
      eq(voiceTranscriptions.id, transcriptionId),
      eq(voiceTranscriptions.companyId, companyId)
    ));

  if (!transcription) {
    return { success: false, message: 'Transcription not found' };
  }

  const intent = transcription.parsedIntent;
  const entities = transcription.parsedEntities as ParsedEntities;

  try {
    let result: { entryType: string; entryId: string; message: string };

    switch (intent) {
      case 'create_expense':
        result = await createExpenseFromVoice(companyId, userId, entities);
        break;

      case 'check_balance':
        result = await getBalanceSummary(companyId);
        break;

      case 'get_report':
        result = { entryType: 'report', entryId: '', message: `Navigating to ${entities.category || 'reports'} report.` };
        break;

      default:
        return { success: false, message: 'Unable to process this command. Please try again.' };
    }

    // Update transcription with action taken
    await db.update(voiceTranscriptions)
      .set({
        actionTaken: intent,
        createdEntryType: result.entryType,
        createdEntryId: result.entryId,
        confirmedAt: new Date()
      })
      .where(eq(voiceTranscriptions.id, transcriptionId));

    return { success: true, ...result };
  } catch (error) {
    await db.update(voiceTranscriptions)
      .set({
        errorMessage: error instanceof Error ? error.message : 'Execution failed'
      })
      .where(eq(voiceTranscriptions.id, transcriptionId));

    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to execute command'
    };
  }
}

/**
 * Creates an expense from voice command entities
 */
async function createExpenseFromVoice(
  companyId: string,
  userId: string,
  entities: ParsedEntities
): Promise<{ entryType: string; entryId: string; message: string }> {
  if (!entities.amount) {
    throw new Error('Amount is required to create an expense');
  }

  // Get fiscal year
  const [fiscalYear] = await db.select()
    .from(fiscalYears)
    .where(and(
      eq(fiscalYears.companyId, companyId),
      eq(fiscalYears.isCurrent, true)
    ));

  if (!fiscalYear) {
    throw new Error('No active fiscal year found');
  }

  // Get expense account based on category
  let accountQuery = db.select()
    .from(chartOfAccounts)
    .where(and(
      eq(chartOfAccounts.companyId, companyId),
      eq(chartOfAccounts.accountType, 'expense'),
      eq(chartOfAccounts.isActive, true)
    ));

  if (entities.category) {
    accountQuery = db.select()
      .from(chartOfAccounts)
      .where(and(
        eq(chartOfAccounts.companyId, companyId),
        eq(chartOfAccounts.accountType, 'expense'),
        eq(chartOfAccounts.isActive, true),
        ilike(chartOfAccounts.name, `%${entities.category}%`)
      ));
  }

  const accounts = await accountQuery.limit(1);
  if (accounts.length === 0) {
    throw new Error('No expense account found');
  }

  // Find vendor if mentioned
  let vendorId: string | undefined;
  if (entities.party) {
    const vendors = await db.select()
      .from(parties)
      .where(and(
        eq(parties.companyId, companyId),
        eq(parties.partyType, 'vendor'),
        ilike(parties.name, `%${entities.party}%`)
      ))
      .limit(1);

    if (vendors.length > 0) {
      vendorId = vendors[0].id;
    }
  }

  // Generate expense number
  const expenseCount = await db.select({ count: db.$count(expenses) })
    .from(expenses)
    .where(eq(expenses.companyId, companyId));

  const count = expenseCount[0]?.count || 0;
  const expenseNumber = `EXP/${new Date().getFullYear()}/${String(Number(count) + 1).padStart(4, '0')}`;

  // Create expense
  const [expense] = await db.insert(expenses)
    .values({
      companyId,
      fiscalYearId: fiscalYear.id,
      expenseNumber,
      expenseDate: entities.date || new Date().toISOString().split('T')[0],
      vendorId,
      accountId: accounts[0].id,
      amount: entities.amount.toFixed(2),
      taxAmount: '0',
      totalAmount: entities.amount.toFixed(2),
      description: entities.description || `${entities.category || 'General'} expense`,
      paymentMethod: entities.paymentMethod || 'cash',
      status: 'pending',
      createdByUserId: userId
    })
    .returning();

  return {
    entryType: 'expense',
    entryId: expense.id,
    message: `Created expense ${expenseNumber} for Rs. ${entities.amount.toLocaleString('en-IN')}`
  };
}

/**
 * Gets balance summary for voice response
 */
async function getBalanceSummary(companyId: string): Promise<{ entryType: string; entryId: string; message: string }> {
  const accounts = await db.select()
    .from(chartOfAccounts)
    .where(and(
      eq(chartOfAccounts.companyId, companyId),
      eq(chartOfAccounts.accountType, 'asset'),
      ilike(chartOfAccounts.name, '%bank%')
    ));

  // This would calculate actual balances
  const totalBalance = 0; // Placeholder

  return {
    entryType: 'balance',
    entryId: '',
    message: `Your current bank balance is Rs. ${totalBalance.toLocaleString('en-IN')}`
  };
}
