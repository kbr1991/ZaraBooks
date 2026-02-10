import { Router } from 'express';
import { db } from '../../db';
import { requirePartner, AuthenticatedRequest } from '../../middleware/auth';
import { partnerPayouts, commissions } from '@shared/schema';
import { eq, and, desc, count, sum } from 'drizzle-orm';

const router = Router();

// List partner's payouts
router.get('/', requirePartner, async (req: AuthenticatedRequest, res) => {
  try {
    const partnerId = req.partnerId!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status as string;

    let whereConditions: any[] = [eq(partnerPayouts.partnerId, partnerId)];

    if (status) {
      whereConditions.push(eq(partnerPayouts.status, status as any));
    }

    const whereClause = and(...whereConditions);

    const payoutList = await db.query.partnerPayouts.findMany({
      where: whereClause,
      orderBy: desc(partnerPayouts.createdAt),
      limit,
      offset,
    });

    const [totalCount] = await db.select({ count: count() })
      .from(partnerPayouts)
      .where(whereClause);

    // Get total paid amount
    const [totalPaid] = await db.select({
      total: sum(partnerPayouts.netAmount)
    })
      .from(partnerPayouts)
      .where(and(
        eq(partnerPayouts.partnerId, partnerId),
        eq(partnerPayouts.status, 'completed')
      ));

    res.json({
      payouts: payoutList,
      summary: {
        totalPaid: totalPaid.total || '0',
      },
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
router.get('/:id', requirePartner, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const partnerId = req.partnerId!;

    const payout = await db.query.partnerPayouts.findFirst({
      where: and(
        eq(partnerPayouts.id, id),
        eq(partnerPayouts.partnerId, partnerId)
      ),
      with: {
        commissions: {
          with: {
            tenant: true,
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

export default router;
