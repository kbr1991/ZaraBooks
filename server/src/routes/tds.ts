import { Router } from 'express';
import { db } from '../db';
import { tdsSections, tdsDeductions, tdsChallans, form26asEntries } from '@shared/schema';
import { eq, and, asc, desc, sql, gte, lte } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// ==================== TDS SECTIONS ====================

// Get TDS sections
router.get('/sections', async (_req, res) => {
  try {
    const sections = await db.query.tdsSections.findMany({
      where: eq(tdsSections.isActive, true),
      orderBy: asc(tdsSections.sectionCode),
    });
    res.json(sections);
  } catch (error) {
    console.error('Get TDS sections error:', error);
    res.status(500).json({ error: 'Failed to get TDS sections' });
  }
});

// ==================== TDS DEDUCTIONS ====================

// Get TDS deductions
router.get('/deductions', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { assessmentYear, quarter, sectionCode, startDate, endDate } = req.query;

    let whereConditions = [eq(tdsDeductions.companyId, req.companyId!)];

    if (assessmentYear) {
      whereConditions.push(eq(tdsDeductions.assessmentYear, assessmentYear as string));
    }
    if (quarter) {
      whereConditions.push(eq(tdsDeductions.quarter, quarter as string));
    }
    if (sectionCode) {
      whereConditions.push(eq(tdsDeductions.sectionCode, sectionCode as string));
    }
    if (startDate) {
      whereConditions.push(gte(tdsDeductions.transactionDate, startDate as string));
    }
    if (endDate) {
      whereConditions.push(lte(tdsDeductions.transactionDate, endDate as string));
    }

    const deductions = await db.query.tdsDeductions.findMany({
      where: and(...whereConditions),
      with: {
        party: true,
      },
      orderBy: [desc(tdsDeductions.transactionDate)],
    });

    // Calculate summary
    const summary = {
      totalDeductions: deductions.length,
      totalBaseAmount: deductions.reduce((sum, d) => sum + parseFloat(d.baseAmount || '0'), 0),
      totalTdsAmount: deductions.reduce((sum, d) => sum + parseFloat(d.totalTds || '0'), 0),
      pendingCertificates: deductions.filter(d => !d.certificateNumber).length,
    };

    res.json({ deductions, summary });
  } catch (error) {
    console.error('Get TDS deductions error:', error);
    res.status(500).json({ error: 'Failed to get TDS deductions' });
  }
});

// Create TDS deduction
router.post('/deductions', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      deducteePan,
      deducteeName,
      sectionCode,
      transactionDate,
      paymentDate,
      baseAmount,
      tdsRate,
      invoiceReference,
      partyId,
      assessmentYear,
      quarter,
    } = req.body;

    // Calculate TDS amount
    const base = parseFloat(baseAmount);
    const rate = parseFloat(tdsRate);
    const tdsAmount = (base * rate) / 100;

    // Get section details for surcharge and cess calculation
    const section = await db.query.tdsSections.findFirst({
      where: eq(tdsSections.sectionCode, sectionCode),
    });

    // For now, assuming no surcharge/cess for simplicity
    const totalTds = tdsAmount;

    const [deduction] = await db.insert(tdsDeductions).values({
      companyId: req.companyId!,
      deducteePan,
      deducteeName,
      sectionCode,
      transactionDate,
      paymentDate,
      baseAmount: base.toFixed(2),
      tdsRate: rate.toFixed(2),
      tdsAmount: tdsAmount.toFixed(2),
      surcharge: '0',
      educationCess: '0',
      totalTds: totalTds.toFixed(2),
      invoiceReference,
      partyId,
      assessmentYear,
      quarter,
    }).returning();

    res.status(201).json(deduction);
  } catch (error) {
    console.error('Create TDS deduction error:', error);
    res.status(500).json({ error: 'Failed to create TDS deduction' });
  }
});

// Update TDS deduction
router.patch('/deductions/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const existing = await db.query.tdsDeductions.findFirst({
      where: and(
        eq(tdsDeductions.id, id),
        eq(tdsDeductions.companyId, req.companyId!)
      ),
    });

    if (!existing) {
      return res.status(404).json({ error: 'TDS deduction not found' });
    }

    const [updated] = await db.update(tdsDeductions)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(eq(tdsDeductions.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Update TDS deduction error:', error);
    res.status(500).json({ error: 'Failed to update TDS deduction' });
  }
});

// ==================== TDS CHALLANS ====================

// Get TDS challans
router.get('/challans', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { assessmentYear, status } = req.query;

    let whereConditions = [eq(tdsChallans.companyId, req.companyId!)];

    if (assessmentYear) {
      whereConditions.push(eq(tdsChallans.assessmentYear, assessmentYear as string));
    }
    if (status) {
      whereConditions.push(eq(tdsChallans.status, status as any));
    }

    const challans = await db.query.tdsChallans.findMany({
      where: and(...whereConditions),
      orderBy: [desc(tdsChallans.periodTo)],
    });

    const summary = {
      totalChallans: challans.length,
      totalAmount: challans.reduce((sum, c) => sum + parseFloat(c.totalAmount || '0'), 0),
      pending: challans.filter(c => c.status === 'pending').length,
      paid: challans.filter(c => c.status === 'paid').length,
      verified: challans.filter(c => c.status === 'verified').length,
    };

    res.json({ challans, summary });
  } catch (error) {
    console.error('Get TDS challans error:', error);
    res.status(500).json({ error: 'Failed to get TDS challans' });
  }
});

// Create TDS challan
router.post('/challans', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      challanType,
      assessmentYear,
      periodFrom,
      periodTo,
      sectionCode,
      amount,
      surcharge,
      educationCess,
      interest,
      penalty,
    } = req.body;

    const totalAmount = parseFloat(amount || '0') +
                       parseFloat(surcharge || '0') +
                       parseFloat(educationCess || '0') +
                       parseFloat(interest || '0') +
                       parseFloat(penalty || '0');

    const [challan] = await db.insert(tdsChallans).values({
      companyId: req.companyId!,
      challanType,
      assessmentYear,
      periodFrom,
      periodTo,
      sectionCode,
      amount: parseFloat(amount || '0').toFixed(2),
      surcharge: parseFloat(surcharge || '0').toFixed(2),
      educationCess: parseFloat(educationCess || '0').toFixed(2),
      interest: parseFloat(interest || '0').toFixed(2),
      penalty: parseFloat(penalty || '0').toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      status: 'pending',
    }).returning();

    res.status(201).json(challan);
  } catch (error) {
    console.error('Create TDS challan error:', error);
    res.status(500).json({ error: 'Failed to create TDS challan' });
  }
});

// Record challan payment
router.post('/challans/:id/payment', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { paymentDate, cin, bsrCode, challanSerial } = req.body;

    const challan = await db.query.tdsChallans.findFirst({
      where: and(
        eq(tdsChallans.id, id),
        eq(tdsChallans.companyId, req.companyId!)
      ),
    });

    if (!challan) {
      return res.status(404).json({ error: 'Challan not found' });
    }

    const [updated] = await db.update(tdsChallans)
      .set({
        paymentDate,
        cin,
        bsrCode,
        challanSerial,
        status: 'paid',
        updatedAt: new Date(),
      })
      .where(eq(tdsChallans.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Record payment error:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// ==================== FORM 26AS ====================

// Get Form 26AS entries
router.get('/form26as', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { assessmentYear, quarter } = req.query;

    let whereConditions = [eq(form26asEntries.companyId, req.companyId!)];

    if (assessmentYear) {
      whereConditions.push(eq(form26asEntries.assessmentYear, assessmentYear as string));
    }
    if (quarter) {
      whereConditions.push(eq(form26asEntries.quarter, quarter as string));
    }

    const entries = await db.query.form26asEntries.findMany({
      where: and(...whereConditions),
      orderBy: [desc(form26asEntries.transactionDate)],
    });

    const summary = {
      totalEntries: entries.length,
      totalTdsCredit: entries.reduce((sum, e) => sum + parseFloat(e.tdsCredit || '0'), 0),
      matched: entries.filter(e => e.matchedTdsReceiptId).length,
      unmatched: entries.filter(e => !e.matchedTdsReceiptId).length,
    };

    res.json({ entries, summary });
  } catch (error) {
    console.error('Get Form 26AS error:', error);
    res.status(500).json({ error: 'Failed to get Form 26AS entries' });
  }
});

// Import Form 26AS entries (manual or from TRACES)
router.post('/form26as/import', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { entries } = req.body;

    if (!Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'No entries provided' });
    }

    const insertedEntries = [];
    for (const entry of entries) {
      const [inserted] = await db.insert(form26asEntries).values({
        companyId: req.companyId!,
        ...entry,
        downloadedAt: new Date(),
      }).returning();
      insertedEntries.push(inserted);
    }

    res.status(201).json({
      message: `${insertedEntries.length} entries imported`,
      entries: insertedEntries,
    });
  } catch (error) {
    console.error('Import Form 26AS error:', error);
    res.status(500).json({ error: 'Failed to import Form 26AS entries' });
  }
});

// Match Form 26AS with TDS deductions
router.post('/form26as/:id/match', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { deductionId } = req.body;

    const entry = await db.query.form26asEntries.findFirst({
      where: and(
        eq(form26asEntries.id, id),
        eq(form26asEntries.companyId, req.companyId!)
      ),
    });

    if (!entry) {
      return res.status(404).json({ error: 'Form 26AS entry not found' });
    }

    await db.update(form26asEntries)
      .set({ matchedTdsReceiptId: deductionId })
      .where(eq(form26asEntries.id, id));

    res.json({ message: 'Entry matched successfully' });
  } catch (error) {
    console.error('Match Form 26AS error:', error);
    res.status(500).json({ error: 'Failed to match entry' });
  }
});

// ==================== TDS SUMMARY ====================

// Get TDS summary for dashboard
router.get('/summary', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { assessmentYear } = req.query;

    let deductionWhere = [eq(tdsDeductions.companyId, req.companyId!)];
    let challanWhere = [eq(tdsChallans.companyId, req.companyId!)];
    let form26asWhere = [eq(form26asEntries.companyId, req.companyId!)];

    if (assessmentYear) {
      deductionWhere.push(eq(tdsDeductions.assessmentYear, assessmentYear as string));
      challanWhere.push(eq(tdsChallans.assessmentYear, assessmentYear as string));
      form26asWhere.push(eq(form26asEntries.assessmentYear, assessmentYear as string));
    }

    // Get deductions summary
    const deductions = await db.query.tdsDeductions.findMany({
      where: and(...deductionWhere),
    });

    const totalDeducted = deductions.reduce((sum, d) => sum + parseFloat(d.totalTds || '0'), 0);

    // Get challans summary
    const challans = await db.query.tdsChallans.findMany({
      where: and(...challanWhere),
    });

    const totalDeposited = challans
      .filter(c => c.status === 'paid' || c.status === 'verified')
      .reduce((sum, c) => sum + parseFloat(c.totalAmount || '0'), 0);

    const pendingDeposit = challans
      .filter(c => c.status === 'pending')
      .reduce((sum, c) => sum + parseFloat(c.totalAmount || '0'), 0);

    // Get Form 26AS summary
    const form26as = await db.query.form26asEntries.findMany({
      where: and(...form26asWhere),
    });

    const totalTdsCredit = form26as.reduce((sum, e) => sum + parseFloat(e.tdsCredit || '0'), 0);

    // Group by section
    const bySection: Record<string, { deducted: number; deposited: number }> = {};
    deductions.forEach(d => {
      if (!bySection[d.sectionCode]) {
        bySection[d.sectionCode] = { deducted: 0, deposited: 0 };
      }
      bySection[d.sectionCode].deducted += parseFloat(d.totalTds || '0');
    });

    res.json({
      summary: {
        totalDeducted,
        totalDeposited,
        pendingDeposit,
        totalTdsCredit,
        pendingCertificates: deductions.filter(d => !d.certificateNumber).length,
        unmatchedForm26as: form26as.filter(e => !e.matchedTdsReceiptId).length,
      },
      bySection,
      quarterlyTrend: deductions.reduce((acc, d) => {
        const key = `${d.assessmentYear}-${d.quarter}`;
        if (!acc[key]) acc[key] = 0;
        acc[key] += parseFloat(d.totalTds || '0');
        return acc;
      }, {} as Record<string, number>),
    });
  } catch (error) {
    console.error('Get TDS summary error:', error);
    res.status(500).json({ error: 'Failed to get TDS summary' });
  }
});

export default router;
