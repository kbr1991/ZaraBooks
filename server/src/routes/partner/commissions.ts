import { Router } from 'express';
import { db } from '../../db';
import { requirePartner, AuthenticatedRequest } from '../../middleware/auth';
import { commissions } from '@shared/schema';
import { eq, and, desc, count, sum, gte, lte } from 'drizzle-orm';

const router = Router();

// List partner's commissions
router.get('/', requirePartner, async (req: AuthenticatedRequest, res) => {
  try {
    const partnerId = req.partnerId!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    let whereConditions: any[] = [eq(commissions.partnerId, partnerId)];

    if (status) {
      whereConditions.push(eq(commissions.status, status as any));
    }

    if (startDate) {
      whereConditions.push(gte(commissions.periodStart, startDate));
    }

    if (endDate) {
      whereConditions.push(lte(commissions.periodEnd, endDate));
    }

    const whereClause = and(...whereConditions);

    const commissionList = await db.query.commissions.findMany({
      where: whereClause,
      with: {
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

    // Get summary by status
    const [pending] = await db.select({
      total: sum(commissions.commissionAmount)
    })
      .from(commissions)
      .where(and(
        eq(commissions.partnerId, partnerId),
        eq(commissions.status, 'pending')
      ));

    const [approved] = await db.select({
      total: sum(commissions.commissionAmount)
    })
      .from(commissions)
      .where(and(
        eq(commissions.partnerId, partnerId),
        eq(commissions.status, 'approved')
      ));

    const [paid] = await db.select({
      total: sum(commissions.commissionAmount)
    })
      .from(commissions)
      .where(and(
        eq(commissions.partnerId, partnerId),
        eq(commissions.status, 'paid')
      ));

    res.json({
      commissions: commissionList,
      summary: {
        pending: pending.total || '0',
        approved: approved.total || '0',
        paid: paid.total || '0',
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

// Get commission details
router.get('/:id', requirePartner, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const partnerId = req.partnerId!;

    const commission = await db.query.commissions.findFirst({
      where: and(
        eq(commissions.id, id),
        eq(commissions.partnerId, partnerId)
      ),
      with: {
        tenant: true,
        subscription: true,
        payout: true,
      },
    });

    if (!commission) {
      return res.status(404).json({ error: 'Commission not found' });
    }

    res.json(commission);
  } catch (error) {
    console.error('Get commission error:', error);
    res.status(500).json({ error: 'Failed to fetch commission' });
  }
});

export default router;
