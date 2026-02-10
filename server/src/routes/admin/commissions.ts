import { Router } from 'express';
import { db } from '../../db';
import { requireSuperAdmin, AuthenticatedRequest } from '../../middleware/auth';
import { commissions, subscriptions, partners, tenants } from '@shared/schema';
import { eq, and, desc, count, sum, gte, lte } from 'drizzle-orm';

const router = Router();

// List all commissions
router.get('/', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status as string;
    const partnerId = req.query.partnerId as string;

    let whereConditions: any[] = [];

    if (status) {
      whereConditions.push(eq(commissions.status, status as any));
    }

    if (partnerId) {
      whereConditions.push(eq(commissions.partnerId, partnerId));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const commissionList = await db.query.commissions.findMany({
      where: whereClause,
      with: {
        partner: true,
        tenant: true,
        subscription: true,
      },
      orderBy: desc(commissions.createdAt),
      limit,
      offset,
    });

    const [totalCount] = await db.select({ count: count() })
      .from(commissions)
      .where(whereClause);

    // Get summary stats
    const [pendingTotal] = await db.select({
      total: sum(commissions.commissionAmount)
    })
      .from(commissions)
      .where(eq(commissions.status, 'pending'));

    const [approvedTotal] = await db.select({
      total: sum(commissions.commissionAmount)
    })
      .from(commissions)
      .where(eq(commissions.status, 'approved'));

    res.json({
      commissions: commissionList,
      summary: {
        pendingTotal: pendingTotal.total || '0',
        approvedTotal: approvedTotal.total || '0',
      },
      pagination: {
        page,
        limit,
        total: totalCount.count,
        totalPages: Math.ceil(totalCount.count / limit),
      },
    });
  } catch (error) {
    console.error('List commissions error:', error);
    res.status(500).json({ error: 'Failed to fetch commissions' });
  }
});

// Approve commission
router.post('/:id/approve', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const [updated] = await db.update(commissions)
      .set({
        status: 'approved',
      })
      .where(eq(commissions.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Commission not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Approve commission error:', error);
    res.status(500).json({ error: 'Failed to approve commission' });
  }
});

// Bulk approve commissions
router.post('/bulk-approve', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { commissionIds } = req.body;

    if (!commissionIds || !Array.isArray(commissionIds)) {
      return res.status(400).json({ error: 'commissionIds array required' });
    }

    let updated = 0;
    for (const id of commissionIds) {
      const [result] = await db.update(commissions)
        .set({ status: 'approved' })
        .where(and(
          eq(commissions.id, id),
          eq(commissions.status, 'pending')
        ))
        .returning();
      if (result) updated++;
    }

    res.json({ updated });
  } catch (error) {
    console.error('Bulk approve commissions error:', error);
    res.status(500).json({ error: 'Failed to approve commissions' });
  }
});

// Cancel commission
router.post('/:id/cancel', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const [updated] = await db.update(commissions)
      .set({
        status: 'cancelled',
      })
      .where(eq(commissions.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Commission not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Cancel commission error:', error);
    res.status(500).json({ error: 'Failed to cancel commission' });
  }
});

// Calculate monthly commissions (run at end of month)
router.post('/calculate', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { periodStart, periodEnd } = req.body;

    // Get all active subscriptions with partners
    const activeSubscriptions = await db.query.subscriptions.findMany({
      where: and(
        eq(subscriptions.status, 'active'),
      ),
      with: {
        partner: true,
        tenant: true,
      },
    });

    let created = 0;
    for (const sub of activeSubscriptions) {
      if (!sub.partnerId || !sub.commissionRate) continue;

      // Check if commission already exists for this period
      const existing = await db.query.commissions.findFirst({
        where: and(
          eq(commissions.subscriptionId, sub.id),
          eq(commissions.periodStart, periodStart),
          eq(commissions.periodEnd, periodEnd)
        ),
      });

      if (existing) continue;

      const commissionAmount = parseFloat(sub.amount) * (parseFloat(sub.commissionRate) / 100);

      await db.insert(commissions).values({
        partnerId: sub.partnerId,
        tenantId: sub.tenantId,
        subscriptionId: sub.id,
        subscriptionAmount: sub.amount,
        commissionRate: sub.commissionRate,
        commissionAmount: commissionAmount.toFixed(2),
        periodStart,
        periodEnd,
        status: 'pending',
      });

      created++;
    }

    res.json({ created });
  } catch (error) {
    console.error('Calculate commissions error:', error);
    res.status(500).json({ error: 'Failed to calculate commissions' });
  }
});

export default router;
