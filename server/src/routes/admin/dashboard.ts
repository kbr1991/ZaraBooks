import { Router } from 'express';
import { db } from '../../db';
import { requireSuperAdmin, AuthenticatedRequest } from '../../middleware/auth';
import { tenants, partners, subscriptions, commissions, users, companies } from '@shared/schema';
import { eq, count, sum, and, gte, sql } from 'drizzle-orm';

const router = Router();

// Get admin dashboard stats
router.get('/', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get total counts
    const [totalTenants] = await db.select({ count: count() }).from(tenants);
    const [totalPartners] = await db.select({ count: count() }).from(partners);
    const [totalUsers] = await db.select({ count: count() }).from(users);
    const [totalCompanies] = await db.select({ count: count() }).from(companies);

    // Get active subscriptions
    const [activeSubscriptions] = await db.select({ count: count() })
      .from(subscriptions)
      .where(eq(subscriptions.status, 'active'));

    // Get monthly recurring revenue
    const [mrr] = await db.select({
      total: sum(subscriptions.amount)
    })
      .from(subscriptions)
      .where(eq(subscriptions.status, 'active'));

    // Get pending commissions
    const [pendingCommissions] = await db.select({
      total: sum(commissions.commissionAmount)
    })
      .from(commissions)
      .where(eq(commissions.status, 'pending'));

    // Get new tenants in last 30 days
    const [newTenants] = await db.select({ count: count() })
      .from(tenants)
      .where(gte(tenants.createdAt, thirtyDaysAgo));

    // Get new partners in last 30 days
    const [newPartners] = await db.select({ count: count() })
      .from(partners)
      .where(gte(partners.createdAt, thirtyDaysAgo));

    // Get partner tier distribution
    const tierDistribution = await db.select({
      tier: partners.tier,
      count: count(),
    })
      .from(partners)
      .where(eq(partners.isActive, true))
      .groupBy(partners.tier);

    // Get subscription plan distribution
    const planDistribution = await db.select({
      plan: tenants.subscriptionPlan,
      count: count(),
    })
      .from(tenants)
      .where(eq(tenants.isActive, true))
      .groupBy(tenants.subscriptionPlan);

    res.json({
      totals: {
        tenants: totalTenants.count,
        partners: totalPartners.count,
        users: totalUsers.count,
        companies: totalCompanies.count,
        activeSubscriptions: activeSubscriptions.count,
      },
      revenue: {
        mrr: mrr.total || '0',
        pendingCommissions: pendingCommissions.total || '0',
      },
      growth: {
        newTenantsLast30Days: newTenants.count,
        newPartnersLast30Days: newPartners.count,
      },
      distributions: {
        partnerTiers: tierDistribution,
        subscriptionPlans: planDistribution,
      },
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

export default router;
