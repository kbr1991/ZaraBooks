/**
 * Voice Interface Routes
 *
 * Handles voice transcription and natural language command processing
 */

import { Router } from 'express';
import { db } from '../db';
import { voiceTranscriptions } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';
import {
  transcribeAudio,
  parseVoiceCommand,
  executeVoiceCommand,
  getTranscriptionHistory
} from '../services/voice';

const router = Router();

// Get voice transcription history
router.get('/history', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const history = await getTranscriptionHistory(req.companyId!, req.userId!, limit);
    res.json(history);
  } catch (error) {
    console.error('Error fetching voice history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Process voice command from text (for testing or text input)
router.post('/process-text', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { text, language } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text content required' });
    }

    // Parse the command
    const parsed = parseVoiceCommand(text, language || 'en');

    // Create transcription record
    const [transcription] = await db.insert(voiceTranscriptions)
      .values({
        companyId: req.companyId!,
        userId: req.userId!,
        transcription: text,
        transcriptionConfidence: '100',
        language: language || 'en',
        parsedIntent: parsed.intent,
        parsedEntities: parsed.entities
      })
      .returning();

    res.json({
      transcription,
      parsed,
      requiresConfirmation: parsed.intent !== 'unknown'
    });
  } catch (error) {
    console.error('Error processing text command:', error);
    res.status(500).json({ error: 'Failed to process command' });
  }
});

// Upload and process audio
router.post('/process-audio', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { audioData, mimeType, language } = req.body;

    if (!audioData) {
      return res.status(400).json({ error: 'Audio data required' });
    }

    // Transcribe audio (simulated - would integrate with Google Speech-to-Text)
    const transcriptionResult = await transcribeAudio(audioData, mimeType, language);

    if (!transcriptionResult.success) {
      return res.status(500).json({ error: transcriptionResult.error || 'Transcription failed' });
    }

    // Parse the command
    const parsed = parseVoiceCommand(
      transcriptionResult.text!,
      transcriptionResult.language || 'en'
    );

    // Create transcription record
    const [transcription] = await db.insert(voiceTranscriptions)
      .values({
        companyId: req.companyId!,
        userId: req.userId!,
        audioUrl: audioData.startsWith('http') ? audioData : undefined,
        transcription: transcriptionResult.text,
        transcriptionConfidence: transcriptionResult.confidence?.toString(),
        language: transcriptionResult.language || 'en',
        parsedIntent: parsed.intent,
        parsedEntities: parsed.entities
      })
      .returning();

    res.json({
      transcription,
      parsed,
      requiresConfirmation: parsed.intent !== 'unknown'
    });
  } catch (error) {
    console.error('Error processing audio:', error);
    res.status(500).json({ error: 'Failed to process audio' });
  }
});

// Execute a confirmed voice command
router.post('/execute', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { transcriptionId, intent, entities, overrides } = req.body;

    if (!intent) {
      return res.status(400).json({ error: 'Intent required' });
    }

    // Execute the command
    const result = await executeVoiceCommand(
      req.companyId!,
      req.userId!,
      intent,
      { ...entities, ...overrides }
    );

    // Update transcription record if provided
    if (transcriptionId) {
      await db.update(voiceTranscriptions)
        .set({
          actionTaken: result.action,
          createdEntryId: result.createdEntryId
        })
        .where(and(
          eq(voiceTranscriptions.id, transcriptionId),
          eq(voiceTranscriptions.companyId, req.companyId!)
        ));
    }

    res.json(result);
  } catch (error) {
    console.error('Error executing command:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to execute command' });
  }
});

// Get supported commands
router.get('/commands', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const commands = [
      {
        intent: 'create_expense',
        description: 'Create a new expense entry',
        examples: [
          'Add expense of 500 rupees for tea',
          'Log travel expense 1200 rupees',
          'Record office supplies expense 350'
        ],
        requiredEntities: ['amount'],
        optionalEntities: ['description', 'category', 'date', 'vendor']
      },
      {
        intent: 'create_invoice',
        description: 'Create a new invoice',
        examples: [
          'Create invoice for 5000 rupees for Sharma Electronics',
          'Bill ABC Corp 25000 for consulting',
          'Generate invoice 10000 for web development'
        ],
        requiredEntities: ['amount', 'customer'],
        optionalEntities: ['description', 'dueDate']
      },
      {
        intent: 'check_balance',
        description: 'Check account balance',
        examples: [
          'What is my bank balance',
          'Show account balance',
          'How much money in HDFC account'
        ],
        requiredEntities: [],
        optionalEntities: ['accountName']
      },
      {
        intent: 'get_report',
        description: 'Get a financial report',
        examples: [
          'Show me today\'s sales',
          'Get this month\'s expenses',
          'What\'s my profit this month'
        ],
        requiredEntities: ['reportType'],
        optionalEntities: ['period', 'startDate', 'endDate']
      },
      {
        intent: 'record_payment',
        description: 'Record a payment received',
        examples: [
          'Received 5000 from Sharma Electronics',
          'Payment of 10000 from ABC Corp',
          'Got 2500 rupees payment'
        ],
        requiredEntities: ['amount'],
        optionalEntities: ['customer', 'invoiceNumber', 'paymentMethod']
      }
    ];

    res.json(commands);
  } catch (error) {
    console.error('Error fetching commands:', error);
    res.status(500).json({ error: 'Failed to fetch commands' });
  }
});

// Get single transcription
router.get('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const [transcription] = await db.select()
      .from(voiceTranscriptions)
      .where(and(
        eq(voiceTranscriptions.id, req.params.id),
        eq(voiceTranscriptions.companyId, req.companyId!)
      ));

    if (!transcription) {
      return res.status(404).json({ error: 'Transcription not found' });
    }

    res.json(transcription);
  } catch (error) {
    console.error('Error fetching transcription:', error);
    res.status(500).json({ error: 'Failed to fetch transcription' });
  }
});

// Delete transcription
router.delete('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    await db.delete(voiceTranscriptions)
      .where(and(
        eq(voiceTranscriptions.id, req.params.id),
        eq(voiceTranscriptions.companyId, req.companyId!)
      ));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting transcription:', error);
    res.status(500).json({ error: 'Failed to delete transcription' });
  }
});

// Language settings
router.get('/settings/languages', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    res.json({
      supported: [
        { code: 'en', name: 'English' },
        { code: 'hi', name: 'Hindi', nameNative: 'हिन्दी' },
        { code: 'ta', name: 'Tamil', nameNative: 'தமிழ்' },
        { code: 'te', name: 'Telugu', nameNative: 'తెలుగు' },
        { code: 'mr', name: 'Marathi', nameNative: 'मराठी' },
        { code: 'gu', name: 'Gujarati', nameNative: 'ગુજરાતી' },
        { code: 'kn', name: 'Kannada', nameNative: 'ಕನ್ನಡ' },
        { code: 'bn', name: 'Bengali', nameNative: 'বাংলা' }
      ],
      default: 'en'
    });
  } catch (error) {
    console.error('Error fetching language settings:', error);
    res.status(500).json({ error: 'Failed to fetch language settings' });
  }
});

export default router;
