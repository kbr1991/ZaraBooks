import { Router } from 'express';
import { db } from '../../db';
import { requirePartner, AuthenticatedRequest } from '../../middleware/auth';
import { partners, tenants, subscriptions, commissions, partnerPayouts } from '@shared/schema';
import { eq, and, count, sum, gte, desc } from 'drizzle-orm';

const router = Router();

// Get partner dashboard stats
router.get('/', requirePartner, async (req: AuthenticatedRequest, res) => {
  try {
    const partnerId = req.partnerId!;
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get partner details
    const partner = await db.query.partners.findFirst({
      where: eq(partners.id, partnerId),
    });

    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    // Total referrals
    const [totalReferrals] = await db.select({ count: count() })
      .from(tenants)
      .where(eq(tenants.partnerId, partnerId));

    // Active subscriptions from referrals
    const [activeSubscriptions] = await db.select({ count: count() })
      .from(subscriptions)
      .where(and(
        eq(subscriptions.partnerId, partnerId),
        eq(subscriptions.status, 'active')
      ));

    // New referrals last 30 days
    const [newReferrals] = await db.select({ count: count() })
      .from(tenants)
      .where(and(
        eq(tenants.partnerId, partnerId),
        gte(tenants.createdAt, thirtyDaysAgo)
      ));

    // Total earnings (paid commissions)
    const [totalEarnings] = await db.select({
      total: sum(commissions.commissionAmount)
    })
      .from(commissions)
      .where(and(
        eq(commissions.partnerId, partnerId),
        eq(commissions.status, 'paid')
      ));

    // Pending earnings
    const [pendingEarnings] = await db.select({
      total: sum(commissions.commissionAmount)
    })
      .from(commissions)
      .where(and(
        eq(commissions.partnerId, partnerId),
        eq(commissions.status, 'pending')
      ));

    // Approved earnings (ready for payout)
    const [approvedEarnings] = await db.select({
      total: sum(commissions.commissionAmount)
    })
      .from(commissions)
      .where(and(
        eq(commissions.partnerId, partnerId),
        eq(commissions.status, 'approved')
      ));

    // Recent referrals
    const recentReferrals = await db.query.tenants.findMany({
      where: eq(tenants.partnerId, partnerId),
      orderBy: desc(tenants.createdAt),
      limit: 5,
    });

    // Recent commissions
    const recentCommissions = await db.query.commissions.findMany({
      where: eq(commissions.partnerId, partnerId),
      with: { tenant: true },
      orderBy: desc(commissions.createdAt),
      limit: 5,
    });

    // Recent payouts
    const recentPayouts = await db.query.partnerPayouts.findMany({
      where: eq(partnerPayouts.partnerId, partnerId),
      orderBy: desc(partnerPayouts.createdAt),
      limit: 5,
    });

    res.json({
      partner: {
        id: partner.id,
        name: partner.name,
        tier: partner.tier,
        commissionRate: partner.commissionRate,
        referralCode: partner.referralCode,
        verificationStatus: partner.verificationStatus,
      },
      stats: {
        totalReferrals: totalReferrals.count,
        activeSubscriptions: activeSubscriptions.count,
        newReferralsLast30Days: newReferrals.count,
      },
      earnings: {
        total: totalEarnings.total || '0',
        pending: pendingEarnings.total || '0',
        approved: approvedEarnings.total || '0',
      },
      recent: {
        referrals: recentReferrals,
        commissions: recentCommissions,
        payouts: recentPayouts,
      },
    });
  } catch (error) {
    console.error('Partner dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Get partner profile
router.get('/profile', requirePartner, async (req: AuthenticatedRequest, res) => {
  try {
    const partner = await db.query.partners.findFirst({
      where: eq(partners.id, req.partnerId!),
    });

    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    res.json(partner);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update partner profile
router.patch('/profile', requirePartner, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      primaryPhone,
      address,
      city,
      state,
      bankAccountName,
      bankAccountNumber,
      bankIfsc,
    } = req.body;

    const [updated] = await db.update(partners)
      .set({
        primaryPhone,
        address,
        city,
        state,
        bankAccountName,
        bankAccountNumber,
        bankIfsc,
        updatedAt: new Date(),
      })
      .where(eq(partners.id, req.partnerId!))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
