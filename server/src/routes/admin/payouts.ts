import { Router } from 'express';
import { db } from '../../db';
import { requireSuperAdmin, AuthenticatedRequest } from '../../middleware/auth';
import { partnerPayouts, commissions, partners } from '@shared/schema';
import { eq, and, desc, count, sum, inArray } from 'drizzle-orm';

const router = Router();

// Minimum payout threshold (Rs. 5000)
const MINIMUM_PAYOUT_THRESHOLD = 5000;

// TDS rate for commissions (10%)
const TDS_RATE = 0.10;

// List all payouts
router.get('/', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status as string;
    const partnerId = req.query.partnerId as string;

    let whereConditions: any[] = [];

    if (status) {
      whereConditions.push(eq(partnerPayouts.status, status as any));
    }

    if (partnerId) {
      whereConditions.push(eq(partnerPayouts.partnerId, partnerId));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const payoutList = await db.query.partnerPayouts.findMany({
      where: whereClause,
      with: {
        partner: true,
        commissions: true,
      },
      orderBy: desc(partnerPayouts.createdAt),
      limit,
      offset,
    });

    const [totalCount] = await db.select({ count: count() })
      .from(partnerPayouts)
      .where(whereClause);

    res.json({
      payouts: payoutList,
      pagination: {
        page,
        limit,
        total: totalCount.count,
        totalPages: Math.ceil(totalCount.count / limit),
      },
    });
  } catch (error) {
    console.error('List payouts error:', error);
    res.status(500).json({ error: 'Failed to fetch payouts' });
  }
});

// Get payout details
router.get('/:id', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const payout = await db.query.partnerPayouts.findFirst({
      where: eq(partnerPayouts.id, id),
      with: {
        partner: true,
        commissions: {
          with: {
            tenant: true,
            subscription: true,
          },
        },
      },
    });

    if (!payout) {
      return res.status(404).json({ error: 'Payout not found' });
    }

    res.json(payout);
  } catch (error) {
    console.error('Get payout error:', error);
    res.status(500).json({ error: 'Failed to fetch payout' });
  }
});

// Get partners eligible for payout
router.get('/eligible/partners', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    // Get partners with approved commissions
    const eligiblePartners = await db.select({
      partnerId: commissions.partnerId,
      totalAmount: sum(commissions.commissionAmount),
    })
      .from(commissions)
      .where(eq(commissions.status, 'approved'))
      .groupBy(commissions.partnerId);

    // Filter by threshold and get partner details
    const results = await Promise.all(
      eligiblePartners
        .filter(p => parseFloat(p.totalAmount || '0') >= MINIMUM_PAYOUT_THRESHOLD)
        .map(async (p) => {
          const partner = await db.query.partners.findFirst({
            where: eq(partners.id, p.partnerId),
          });
          return {
            partner,
            totalAmount: p.totalAmount,
            tdsAmount: (parseFloat(p.totalAmount || '0') * TDS_RATE).toFixed(2),
            netAmount: (parseFloat(p.totalAmount || '0') * (1 - TDS_RATE)).toFixed(2),
          };
        })
    );

    res.json({
      eligiblePartners: results,
      threshold: MINIMUM_PAYOUT_THRESHOLD,
      tdsRate: TDS_RATE * 100,
    });
  } catch (error) {
    console.error('Get eligible partners error:', error);
    res.status(500).json({ error: 'Failed to fetch eligible partners' });
  }
});

// Create payout for partner
router.post('/', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      partnerId,
      periodStart,
      periodEnd,
      paymentMethod,
      paymentReference,
    } = req.body;

    // Get approved commissions for this partner
    const approvedCommissions = await db.query.commissions.findMany({
      where: and(
        eq(commissions.partnerId, partnerId),
        eq(commissions.status, 'approved')
      ),
    });

    if (approvedCommissions.length === 0) {
      return res.status(400).json({ error: 'No approved commissions for this partner' });
    }

    const totalAmount = approvedCommissions.reduce(
      (sum, c) => sum + parseFloat(c.commissionAmount),
      0
    );

    if (totalAmount < MINIMUM_PAYOUT_THRESHOLD) {
      return res.status(400).json({
        error: `Total amount (${totalAmount}) is below minimum threshold (${MINIMUM_PAYOUT_THRESHOLD})`,
      });
    }

    const tdsAmount = totalAmount * TDS_RATE;
    const netAmount = totalAmount - tdsAmount;

    // Create payout
    const [newPayout] = await db.insert(partnerPayouts).values({
      partnerId,
      totalAmount: totalAmount.toFixed(2),
      tdsAmount: tdsAmount.toFixed(2),
      netAmount: netAmount.toFixed(2),
      paymentMethod,
      paymentReference,
      periodStart,
      periodEnd,
      status: 'pending',
    }).returning();

    // Update commissions with payout ID
    const commissionIds = approvedCommissions.map(c => c.id);
    await db.update(commissions)
      .set({ payoutId: newPayout.id })
      .where(inArray(commissions.id, commissionIds));

    res.status(201).json(newPayout);
  } catch (error) {
    console.error('Create payout error:', error);
    res.status(500).json({ error: 'Failed to create payout' });
  }
});

// Process payout (mark as completed)
router.post('/:id/process', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { paymentReference } = req.body;

    // Update payout status
    const [updated] = await db.update(partnerPayouts)
      .set({
        status: 'completed',
        paymentReference,
        processedAt: new Date(),
      })
      .where(eq(partnerPayouts.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Payout not found' });
    }

    // Update associated commissions to paid
    await db.update(commissions)
      .set({ status: 'paid' })
      .where(eq(commissions.payoutId, id));

    res.json(updated);
  } catch (error) {
    console.error('Process payout error:', error);
    res.status(500).json({ error: 'Failed to process payout' });
  }
});

// Mark payout as failed
router.post('/:id/fail', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // Update payout status
    const [updated] = await db.update(partnerPayouts)
      .set({
        status: 'failed',
      })
      .where(eq(partnerPayouts.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Payout not found' });
    }

    // Revert commissions back to approved
    await db.update(commissions)
      .set({
        status: 'approved',
        payoutId: null,
      })
      .where(eq(commissions.payoutId, id));

    res.json(updated);
  } catch (error) {
    console.error('Fail payout error:', error);
    res.status(500).json({ error: 'Failed to mark payout as failed' });
  }
});

export default router;
