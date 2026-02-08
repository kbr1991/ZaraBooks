import { Router } from 'express';
import { db } from '../db';
import {
  gstConfig, gstr1Entries, gstr3bSummary, itcRegister, gstPayments, hsnSacMaster
} from '@shared/schema';
import { eq, and, asc, desc, sql, gte, lte } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';
import { nicApiService } from '../services/nicApi';
import { gstinLookupService, validateGstinFormat } from '../services/gstinLookup';

const router = Router();

// ==================== GSTIN LOOKUP ====================

// Lookup GSTIN details from external API
router.get('/gstin/lookup/:gstin', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { gstin } = req.params;

    // Validate GSTIN format
    if (!validateGstinFormat(gstin)) {
      return res.status(400).json({ error: 'Invalid GSTIN format. GSTIN must be 15 characters.' });
    }

    // Lookup GSTIN details
    const details = await gstinLookupService.lookup(gstin);

    res.json(details);
  } catch (error: any) {
    console.error('GSTIN lookup error:', error);

    // Handle specific error messages
    if (error.message?.includes('not found')) {
      return res.status(404).json({ error: 'GSTIN not found in GST portal' });
    }
    if (error.message?.includes('not set') || error.message?.includes('not configured')) {
      return res.status(503).json({ error: 'GSTIN lookup service not configured' });
    }
    if (error.message?.includes('unavailable')) {
      return res.status(503).json({ error: 'Lookup service temporarily unavailable' });
    }

    res.status(500).json({ error: error.message || 'Failed to lookup GSTIN' });
  }
});

// Get state codes mapping
router.get('/gstin/state-codes', async (req, res) => {
  try {
    const stateCodes = gstinLookupService.getStateCodes();
    res.json(stateCodes);
  } catch (error) {
    console.error('Get state codes error:', error);
    res.status(500).json({ error: 'Failed to get state codes' });
  }
});

// ==================== GST CONFIG ====================

// Get GST configurations
router.get('/config', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const configs = await db.query.gstConfig.findMany({
      where: eq(gstConfig.companyId, req.companyId!),
      orderBy: [desc(gstConfig.isPrimary), asc(gstConfig.createdAt)],
    });
    res.json(configs);
  } catch (error) {
    console.error('Get GST config error:', error);
    res.status(500).json({ error: 'Failed to get GST configuration' });
  }
});

// Create GST configuration
router.post('/config', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      gstin,
      legalName,
      tradeName,
      stateCode,
      registrationType,
      filingFrequency,
      einvoiceEnabled,
      einvoiceThreshold,
      ewaybillEnabled,
      isPrimary,
    } = req.body;

    // Validate GSTIN format
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstinRegex.test(gstin)) {
      return res.status(400).json({ error: 'Invalid GSTIN format' });
    }

    // Check for duplicate
    const existing = await db.query.gstConfig.findFirst({
      where: and(
        eq(gstConfig.companyId, req.companyId!),
        eq(gstConfig.gstin, gstin)
      ),
    });
    if (existing) {
      return res.status(400).json({ error: 'GSTIN already configured' });
    }

    // If setting as primary, unset others
    if (isPrimary) {
      await db.update(gstConfig)
        .set({ isPrimary: false })
        .where(eq(gstConfig.companyId, req.companyId!));
    }

    const [config] = await db.insert(gstConfig).values({
      companyId: req.companyId!,
      gstin,
      legalName,
      tradeName,
      stateCode: stateCode || gstin.substring(0, 2),
      registrationType,
      filingFrequency,
      einvoiceEnabled,
      einvoiceThreshold,
      ewaybillEnabled,
      isPrimary,
      isActive: true,
    }).returning();

    res.status(201).json(config);
  } catch (error) {
    console.error('Create GST config error:', error);
    res.status(500).json({ error: 'Failed to create GST configuration' });
  }
});

// Update GST configuration
router.patch('/config/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const existing = await db.query.gstConfig.findFirst({
      where: and(
        eq(gstConfig.id, id),
        eq(gstConfig.companyId, req.companyId!)
      ),
    });

    if (!existing) {
      return res.status(404).json({ error: 'GST configuration not found' });
    }

    // If setting as primary, unset others
    if (req.body.isPrimary) {
      await db.update(gstConfig)
        .set({ isPrimary: false })
        .where(eq(gstConfig.companyId, req.companyId!));
    }

    const [updated] = await db.update(gstConfig)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(eq(gstConfig.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Update GST config error:', error);
    res.status(500).json({ error: 'Failed to update GST configuration' });
  }
});

// ==================== GSTR-1 ====================

// Get GSTR-1 entries
router.get('/gstr1', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { returnPeriod, invoiceType, gstConfigId } = req.query;

    let whereConditions = [eq(gstr1Entries.companyId, req.companyId!)];

    if (returnPeriod) {
      whereConditions.push(eq(gstr1Entries.returnPeriod, returnPeriod as string));
    }
    if (invoiceType) {
      whereConditions.push(eq(gstr1Entries.invoiceType, invoiceType as any));
    }
    if (gstConfigId) {
      whereConditions.push(eq(gstr1Entries.gstConfigId, gstConfigId as string));
    }

    const entries = await db.query.gstr1Entries.findMany({
      where: and(...whereConditions),
      orderBy: [desc(gstr1Entries.invoiceDate)],
    });

    // Calculate summary
    const summary = {
      totalInvoices: entries.length,
      totalTaxableValue: entries.reduce((sum, e) => sum + parseFloat(e.taxableValue || '0'), 0),
      totalIgst: entries.reduce((sum, e) => sum + parseFloat(e.igst || '0'), 0),
      totalCgst: entries.reduce((sum, e) => sum + parseFloat(e.cgst || '0'), 0),
      totalSgst: entries.reduce((sum, e) => sum + parseFloat(e.sgst || '0'), 0),
      totalCess: entries.reduce((sum, e) => sum + parseFloat(e.cess || '0'), 0),
      totalInvoiceValue: entries.reduce((sum, e) => sum + parseFloat(e.invoiceValue || '0'), 0),
    };

    // Group by invoice type
    const byType: Record<string, typeof entries> = {};
    entries.forEach(entry => {
      const type = entry.invoiceType;
      if (!byType[type]) byType[type] = [];
      byType[type].push(entry);
    });

    res.json({
      entries,
      summary,
      byType,
    });
  } catch (error) {
    console.error('Get GSTR-1 error:', error);
    res.status(500).json({ error: 'Failed to get GSTR-1 entries' });
  }
});

// Create GSTR-1 entry
router.post('/gstr1', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const entryData = {
      companyId: req.companyId!,
      ...req.body,
    };

    const [entry] = await db.insert(gstr1Entries).values(entryData).returning();
    res.status(201).json(entry);
  } catch (error) {
    console.error('Create GSTR-1 entry error:', error);
    res.status(500).json({ error: 'Failed to create GSTR-1 entry' });
  }
});

// ==================== GSTR-3B ====================

// Get GSTR-3B summary
router.get('/gstr3b/:returnPeriod', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { returnPeriod } = req.params;
    const { gstConfigId } = req.query;

    let whereConditions = [
      eq(gstr3bSummary.companyId, req.companyId!),
      eq(gstr3bSummary.returnPeriod, returnPeriod),
    ];

    if (gstConfigId) {
      whereConditions.push(eq(gstr3bSummary.gstConfigId, gstConfigId as string));
    }

    let summary = await db.query.gstr3bSummary.findFirst({
      where: and(...whereConditions),
    });

    if (!summary) {
      // Compute from GSTR-1 entries
      const gstr1 = await db.query.gstr1Entries.findMany({
        where: and(
          eq(gstr1Entries.companyId, req.companyId!),
          eq(gstr1Entries.returnPeriod, returnPeriod)
        ),
      });

      const outwardTaxable = gstr1.reduce((sum, e) => sum + parseFloat(e.taxableValue || '0'), 0);
      const outwardIgst = gstr1.reduce((sum, e) => sum + parseFloat(e.igst || '0'), 0);
      const outwardCgst = gstr1.reduce((sum, e) => sum + parseFloat(e.cgst || '0'), 0);
      const outwardSgst = gstr1.reduce((sum, e) => sum + parseFloat(e.sgst || '0'), 0);
      const outwardCess = gstr1.reduce((sum, e) => sum + parseFloat(e.cess || '0'), 0);

      // Get ITC from register
      const itcEntries = await db.query.itcRegister.findMany({
        where: and(
          eq(itcRegister.companyId, req.companyId!),
          eq(itcRegister.returnPeriod, returnPeriod)
        ),
      });

      const itcIgst = itcEntries.reduce((sum, e) => sum + parseFloat(e.igst || '0'), 0);
      const itcCgst = itcEntries.reduce((sum, e) => sum + parseFloat(e.cgst || '0'), 0);
      const itcSgst = itcEntries.reduce((sum, e) => sum + parseFloat(e.sgst || '0'), 0);
      const itcCess = itcEntries.reduce((sum, e) => sum + parseFloat(e.cess || '0'), 0);

      // Calculate payable
      const payableIgst = Math.max(0, outwardIgst - itcIgst);
      const payableCgst = Math.max(0, outwardCgst - itcCgst);
      const payableSgst = Math.max(0, outwardSgst - itcSgst);
      const payableCess = Math.max(0, outwardCess - itcCess);

      // Create summary
      [summary] = await db.insert(gstr3bSummary).values({
        companyId: req.companyId!,
        gstConfigId: gstConfigId as string,
        returnPeriod,
        outwardTaxable: outwardTaxable.toFixed(2),
        outwardIgst: outwardIgst.toFixed(2),
        outwardCgst: outwardCgst.toFixed(2),
        outwardSgst: outwardSgst.toFixed(2),
        outwardCess: outwardCess.toFixed(2),
        itcIgst: itcIgst.toFixed(2),
        itcCgst: itcCgst.toFixed(2),
        itcSgst: itcSgst.toFixed(2),
        itcCess: itcCess.toFixed(2),
        payableIgst: payableIgst.toFixed(2),
        payableCgst: payableCgst.toFixed(2),
        payableSgst: payableSgst.toFixed(2),
        payableCess: payableCess.toFixed(2),
        computedAt: new Date(),
      }).returning();
    }

    res.json(summary);
  } catch (error) {
    console.error('Get GSTR-3B error:', error);
    res.status(500).json({ error: 'Failed to get GSTR-3B summary' });
  }
});

// ==================== ITC REGISTER ====================

// Get ITC entries
router.get('/itc', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { returnPeriod, reconciliationStatus } = req.query;

    let whereConditions = [eq(itcRegister.companyId, req.companyId!)];

    if (returnPeriod) {
      whereConditions.push(eq(itcRegister.returnPeriod, returnPeriod as string));
    }
    if (reconciliationStatus) {
      whereConditions.push(eq(itcRegister.reconciliationStatus, reconciliationStatus as any));
    }

    const entries = await db.query.itcRegister.findMany({
      where: and(...whereConditions),
      orderBy: [desc(itcRegister.invoiceDate)],
    });

    const summary = {
      totalEntries: entries.length,
      totalItc: entries.reduce((sum, e) =>
        sum + parseFloat(e.igst || '0') + parseFloat(e.cgst || '0') + parseFloat(e.sgst || '0'), 0
      ),
      matched: entries.filter(e => e.reconciliationStatus === 'matched').length,
      mismatch: entries.filter(e => e.reconciliationStatus === 'mismatch').length,
      notIn2a: entries.filter(e => e.reconciliationStatus === 'not_in_2a').length,
      pending: entries.filter(e => e.reconciliationStatus === 'pending').length,
    };

    res.json({ entries, summary });
  } catch (error) {
    console.error('Get ITC error:', error);
    res.status(500).json({ error: 'Failed to get ITC register' });
  }
});

// Create ITC entry
router.post('/itc', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const [entry] = await db.insert(itcRegister).values({
      companyId: req.companyId!,
      ...req.body,
    }).returning();
    res.status(201).json(entry);
  } catch (error) {
    console.error('Create ITC entry error:', error);
    res.status(500).json({ error: 'Failed to create ITC entry' });
  }
});

// ==================== GST PAYMENTS ====================

// Get GST payments
router.get('/payments', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { returnPeriod } = req.query;

    let whereConditions = [eq(gstPayments.companyId, req.companyId!)];

    if (returnPeriod) {
      whereConditions.push(eq(gstPayments.returnPeriod, returnPeriod as string));
    }

    const payments = await db.query.gstPayments.findMany({
      where: and(...whereConditions),
      orderBy: [desc(gstPayments.paymentDate)],
    });

    res.json(payments);
  } catch (error) {
    console.error('Get GST payments error:', error);
    res.status(500).json({ error: 'Failed to get GST payments' });
  }
});

// Record GST payment
router.post('/payments', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const [payment] = await db.insert(gstPayments).values({
      companyId: req.companyId!,
      ...req.body,
    }).returning();
    res.status(201).json(payment);
  } catch (error) {
    console.error('Create GST payment error:', error);
    res.status(500).json({ error: 'Failed to record GST payment' });
  }
});

// ==================== HSN/SAC ====================

// Get HSN/SAC codes
router.get('/hsn-sac', async (req, res) => {
  try {
    const { search, type } = req.query;

    let codes = await db.query.hsnSacMaster.findMany({
      where: eq(hsnSacMaster.isActive, true),
      orderBy: asc(hsnSacMaster.code),
    });

    if (type) {
      codes = codes.filter(c => c.type === type);
    }

    if (search) {
      const searchLower = (search as string).toLowerCase();
      codes = codes.filter(c =>
        c.code.toLowerCase().includes(searchLower) ||
        c.description.toLowerCase().includes(searchLower)
      );
    }

    res.json(codes);
  } catch (error) {
    console.error('Get HSN/SAC error:', error);
    res.status(500).json({ error: 'Failed to get HSN/SAC codes' });
  }
});

// ==================== GST SUMMARY ====================

// Get GST summary for dashboard
router.get('/summary', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { fromPeriod, toPeriod } = req.query;

    // Get all GSTR-3B summaries
    let whereConditions = [eq(gstr3bSummary.companyId, req.companyId!)];

    if (fromPeriod) {
      whereConditions.push(gte(gstr3bSummary.returnPeriod, fromPeriod as string));
    }
    if (toPeriod) {
      whereConditions.push(lte(gstr3bSummary.returnPeriod, toPeriod as string));
    }

    const summaries = await db.query.gstr3bSummary.findMany({
      where: and(...whereConditions),
      orderBy: desc(gstr3bSummary.returnPeriod),
    });

    // Calculate totals
    const totals = {
      totalOutward: summaries.reduce((sum, s) => sum + parseFloat(s.outwardTaxable || '0'), 0),
      totalItc: summaries.reduce((sum, s) =>
        sum + parseFloat(s.itcIgst || '0') + parseFloat(s.itcCgst || '0') + parseFloat(s.itcSgst || '0'), 0
      ),
      totalPayable: summaries.reduce((sum, s) =>
        sum + parseFloat(s.payableIgst || '0') + parseFloat(s.payableCgst || '0') + parseFloat(s.payableSgst || '0'), 0
      ),
      pendingReturns: summaries.filter(s => s.filingStatus === 'pending').length,
      filedReturns: summaries.filter(s => s.filingStatus === 'filed').length,
    };

    res.json({
      summaries,
      totals,
    });
  } catch (error) {
    console.error('Get GST summary error:', error);
    res.status(500).json({ error: 'Failed to get GST summary' });
  }
});

// ==================== E-INVOICE ====================

// Check if E-Invoice is configured
router.get('/einvoice/status', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const isConfigured = nicApiService.isConfigured();
    const config = await db.query.gstConfig.findFirst({
      where: and(
        eq(gstConfig.companyId, req.companyId!),
        eq(gstConfig.isPrimary, true)
      ),
    });

    res.json({
      isConfigured,
      einvoiceEnabled: config?.einvoiceEnabled || false,
      einvoiceThreshold: config?.einvoiceThreshold || 500000,
      ewaybillEnabled: config?.ewaybillEnabled || false,
    });
  } catch (error) {
    console.error('E-Invoice status error:', error);
    res.status(500).json({ error: 'Failed to get E-Invoice status' });
  }
});

// Generate E-Invoice
router.post('/einvoice/generate', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    if (!nicApiService.isConfigured()) {
      return res.status(400).json({ error: 'E-Invoice API is not configured' });
    }

    const { invoice } = req.body;

    // Build e-invoice payload
    const payload = nicApiService.buildEInvoicePayload(invoice);

    // Generate e-invoice
    const result = await nicApiService.generateEInvoice(payload);

    if (!result.success) {
      return res.status(400).json({
        error: result.error?.message || 'E-Invoice generation failed',
        details: result.error?.details,
      });
    }

    // Update GSTR-1 entry with IRN
    if (invoice.gstr1EntryId) {
      await db.update(gstr1Entries)
        .set({
          irn: result.irn,
          irnDate: result.ackDt,
          signedQrCode: result.signedQRCode,
          updatedAt: new Date(),
        })
        .where(eq(gstr1Entries.id, invoice.gstr1EntryId));
    }

    res.json({
      success: true,
      ackNo: result.ackNo,
      ackDt: result.ackDt,
      irn: result.irn,
      signedQRCode: result.signedQRCode,
    });
  } catch (error) {
    console.error('Generate E-Invoice error:', error);
    res.status(500).json({ error: 'Failed to generate E-Invoice' });
  }
});

// Cancel E-Invoice
router.post('/einvoice/cancel', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { irn, cancelReason, cancelRemarks } = req.body;

    if (!irn || !cancelReason || !cancelRemarks) {
      return res.status(400).json({ error: 'IRN, cancel reason, and remarks are required' });
    }

    const result = await nicApiService.cancelEInvoice(irn, cancelReason, cancelRemarks);

    if (!result.success) {
      return res.status(400).json({
        error: result.error?.message || 'E-Invoice cancellation failed',
      });
    }

    // Update GSTR-1 entry
    await db.update(gstr1Entries)
      .set({
        isCancelled: true,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(gstr1Entries.irn, irn),
        eq(gstr1Entries.companyId, req.companyId!)
      ));

    res.json({ success: true, irn });
  } catch (error) {
    console.error('Cancel E-Invoice error:', error);
    res.status(500).json({ error: 'Failed to cancel E-Invoice' });
  }
});

// Get E-Invoice by IRN
router.get('/einvoice/:irn', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { irn } = req.params;

    const result = await nicApiService.getEInvoiceByIrn(irn);

    if (!result.success) {
      return res.status(404).json({
        error: result.error?.message || 'E-Invoice not found',
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Get E-Invoice error:', error);
    res.status(500).json({ error: 'Failed to get E-Invoice' });
  }
});

// ==================== E-WAY BILL ====================

// Generate E-Way Bill from IRN
router.post('/ewaybill/generate', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    if (!nicApiService.isConfigured()) {
      return res.status(400).json({ error: 'E-Invoice API is not configured' });
    }

    const { irn, ewbData } = req.body;

    if (!irn || !ewbData) {
      return res.status(400).json({ error: 'IRN and E-Way Bill data are required' });
    }

    const result = await nicApiService.generateEwayBill(irn, ewbData);

    if (!result.success) {
      return res.status(400).json({
        error: result.error?.message || 'E-Way Bill generation failed',
      });
    }

    // Update GSTR-1 entry with EWB
    await db.update(gstr1Entries)
      .set({
        ewbNo: result.ewbNo,
        ewbDate: result.ewbDt,
        ewbValidTill: result.ewbValidTill,
        updatedAt: new Date(),
      })
      .where(and(
        eq(gstr1Entries.irn, irn),
        eq(gstr1Entries.companyId, req.companyId!)
      ));

    res.json({
      success: true,
      ewbNo: result.ewbNo,
      ewbDt: result.ewbDt,
      ewbValidTill: result.ewbValidTill,
    });
  } catch (error) {
    console.error('Generate E-Way Bill error:', error);
    res.status(500).json({ error: 'Failed to generate E-Way Bill' });
  }
});

// Cancel E-Way Bill
router.post('/ewaybill/cancel', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { ewbNo, cancelReason, cancelRemarks } = req.body;

    if (!ewbNo || !cancelReason || !cancelRemarks) {
      return res.status(400).json({ error: 'E-Way Bill number, cancel reason, and remarks are required' });
    }

    const result = await nicApiService.cancelEwayBill(ewbNo, cancelReason, cancelRemarks);

    if (!result.success) {
      return res.status(400).json({
        error: result.error?.message || 'E-Way Bill cancellation failed',
      });
    }

    res.json({ success: true, ewbNo });
  } catch (error) {
    console.error('Cancel E-Way Bill error:', error);
    res.status(500).json({ error: 'Failed to cancel E-Way Bill' });
  }
});

export default router;
