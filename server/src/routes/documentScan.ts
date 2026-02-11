/**
 * Document Scan Routes
 *
 * Handles document upload, OCR processing, and entry creation
 */

import { Router } from 'express';
import { db } from '../db';
import { documentScans, parties, expenses, bills } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';
import {
  processDocument,
  createExpenseFromScan,
  createBillFromScan,
  getDocumentScanStats,
  extractIndianBillData
} from '../services/ocr';

const router = Router();

// Get document scan statistics
router.get('/stats', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const stats = await getDocumentScanStats(req.companyId!);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get all document scans
router.get('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, type, needsReview } = req.query;

    const scans = await db.select()
      .from(documentScans)
      .where(eq(documentScans.companyId, req.companyId!))
      .orderBy(desc(documentScans.createdAt));

    let filtered = scans;

    if (status && status !== 'all') {
      filtered = filtered.filter(s => s.ocrStatus === status);
    }

    if (type && type !== 'all') {
      filtered = filtered.filter(s => s.documentType === type);
    }

    if (needsReview === 'true') {
      filtered = filtered.filter(s => s.needsReview);
    }

    res.json(filtered);
  } catch (error) {
    console.error('Error fetching document scans:', error);
    res.status(500).json({ error: 'Failed to fetch document scans' });
  }
});

// Get single document scan
router.get('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const [scan] = await db.select()
      .from(documentScans)
      .where(and(
        eq(documentScans.id, req.params.id),
        eq(documentScans.companyId, req.companyId!)
      ));

    if (!scan) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(scan);
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// Upload document for OCR
router.post('/upload', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { fileUrl, fileName, mimeType, fileSize, documentType, source } = req.body;

    if (!fileUrl || !documentType) {
      return res.status(400).json({ error: 'File URL and document type required' });
    }

    // Create document scan record
    const [scan] = await db.insert(documentScans)
      .values({
        companyId: req.companyId!,
        documentType,
        fileUrl,
        fileName,
        mimeType,
        fileSize,
        source: source || 'upload',
        ocrStatus: 'pending',
        needsReview: true,
        uploadedByUserId: req.userId!
      })
      .returning();

    res.status(201).json(scan);
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// Process document with OCR
router.post('/:id/process', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await processDocument(req.params.id, req.companyId!);

    if (result.success) {
      res.json({
        message: 'Document processed successfully',
        extractedData: result.extractedData,
        confidence: result.confidence,
        language: result.language
      });
    } else {
      res.status(500).json({
        error: result.error || 'OCR processing failed'
      });
    }
  } catch (error) {
    console.error('Error processing document:', error);
    res.status(500).json({ error: 'Failed to process document' });
  }
});

// Update extracted data manually
router.patch('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { extractedData } = req.body;

    const [scan] = await db.update(documentScans)
      .set({
        extractedData,
        updatedAt: new Date()
      })
      .where(and(
        eq(documentScans.id, req.params.id),
        eq(documentScans.companyId, req.companyId!)
      ))
      .returning();

    res.json(scan);
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// Create expense from document
router.post('/:id/create-expense', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { overrides } = req.body;

    const result = await createExpenseFromScan(
      req.params.id,
      req.companyId!,
      req.userId!,
      overrides
    );

    res.json({
      message: 'Expense created successfully',
      ...result
    });
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create expense' });
  }
});

// Create bill from document
router.post('/:id/create-bill', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { vendorId, overrides } = req.body;

    if (!vendorId) {
      return res.status(400).json({ error: 'Vendor ID required' });
    }

    const result = await createBillFromScan(
      req.params.id,
      req.companyId!,
      req.userId!,
      vendorId,
      overrides
    );

    res.json({
      message: 'Bill created successfully',
      ...result
    });
  } catch (error) {
    console.error('Error creating bill:', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to create bill' });
  }
});

// Mark as reviewed
router.post('/:id/review', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { notes } = req.body;

    await db.update(documentScans)
      .set({
        needsReview: false,
        reviewedByUserId: req.userId!,
        reviewedAt: new Date(),
        reviewNotes: notes,
        updatedAt: new Date()
      })
      .where(and(
        eq(documentScans.id, req.params.id),
        eq(documentScans.companyId, req.companyId!)
      ));

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking as reviewed:', error);
    res.status(500).json({ error: 'Failed to mark as reviewed' });
  }
});

// Delete document scan
router.delete('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const [scan] = await db.select()
      .from(documentScans)
      .where(and(
        eq(documentScans.id, req.params.id),
        eq(documentScans.companyId, req.companyId!)
      ));

    if (!scan) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Don't delete if entry was created
    if (scan.createdExpenseId || scan.createdBillId || scan.createdInvoiceId) {
      return res.status(400).json({ error: 'Cannot delete document with linked entries' });
    }

    await db.delete(documentScans)
      .where(eq(documentScans.id, req.params.id));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Extract data from text (for manual text input)
router.post('/extract', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text content required' });
    }

    const extractedData = extractIndianBillData(text);
    res.json(extractedData);
  } catch (error) {
    console.error('Error extracting data:', error);
    res.status(500).json({ error: 'Failed to extract data' });
  }
});

export default router;
