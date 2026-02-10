import { Router } from 'express';
import { db } from '../../db';
import { requireSuperAdmin, AuthenticatedRequest } from '../../middleware/auth';
import { subscriptions, subscriptionPlans, tenants } from '@shared/schema';
import { eq, and, desc, count } from 'drizzle-orm';

const router = Router();

// List subscription plans
router.get('/plans', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const plans = await db.query.subscriptionPlans.findMany({
      orderBy: subscriptionPlans.displayOrder,
    });
    res.json(plans);
  } catch (error) {
    console.error('List plans error:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// Create subscription plan
router.post('/plans', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      code,
      name,
      monthlyPrice,
      yearlyPrice,
      maxCompanies,
      maxUsersPerCompany,
      features,
      displayOrder,
    } = req.body;

    // Check code uniqueness
    const existing = await db.query.subscriptionPlans.findFirst({
      where: eq(subscriptionPlans.code, code),
    });

    if (existing) {
      return res.status(400).json({ error: 'Plan code already exists' });
    }

    const [newPlan] = await db.insert(subscriptionPlans).values({
      code,
      name,
      monthlyPrice,
      yearlyPrice,
      maxCompanies,
      maxUsersPerCompany,
      features: features || [],
      displayOrder: displayOrder || 0,
    }).returning();

    res.status(201).json(newPlan);
  } catch (error) {
    console.error('Create plan error:', error);
    res.status(500).json({ error: 'Failed to create plan' });
  }
});

// Update subscription plan
router.patch('/plans/:id', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      monthlyPrice,
      yearlyPrice,
      maxCompanies,
      maxUsersPerCompany,
      features,
      displayOrder,
      isActive,
    } = req.body;

    const [updated] = await db.update(subscriptionPlans)
      .set({
        name,
        monthlyPrice,
        yearlyPrice,
        maxCompanies,
        maxUsersPerCompany,
        features,
        displayOrder,
        isActive,
      })
      .where(eq(subscriptionPlans.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Update plan error:', error);
    res.status(500).json({ error: 'Failed to update plan' });
  }
});

// List all subscriptions
router.get('/', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status as string;

    let whereClause;
    if (status) {
      whereClause = eq(subscriptions.status, status as any);
    }

    const subscriptionList = await db.query.subscriptions.findMany({
      where: whereClause,
      with: {
        tenant: true,
        partner: true,
      },
      orderBy: desc(subscriptions.createdAt),
      limit,
      offset,
    });

    const [totalCount] = await db.select({ count: count() })
      .from(subscriptions)
      .where(whereClause);

    res.json({
      subscriptions: subscriptionList,
      pagination: {
        page,
        limit,
        total: totalCount.count,
        totalPages: Math.ceil(totalCount.count / limit),
      },
    });
  } catch (error) {
    console.error('List subscriptions error:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
});

// Get subscription details
router.get('/:id', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const subscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.id, id),
      with: {
        tenant: true,
        partner: true,
        commissions: true,
      },
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    res.json(subscription);
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// Create subscription for tenant
router.post('/', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      tenantId,
      planCode,
      billingCycle,
      amount,
    } = req.body;

    // Get tenant to check for partner
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
      with: { partner: true },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const now = new Date();
    const periodEnd = new Date(now);
    if (billingCycle === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const [newSubscription] = await db.insert(subscriptions).values({
      tenantId,
      planCode,
      status: 'active',
      billingCycle,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      amount,
      partnerId: tenant.partnerId,
      commissionRate: tenant.partner?.commissionRate || null,
    }).returning();

    // Update tenant subscription plan
    await db.update(tenants)
      .set({
        subscriptionPlan: planCode,
        subscriptionStatus: 'active',
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));

    res.status(201).json(newSubscription);
  } catch (error) {
    console.error('Create subscription error:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// Cancel subscription
router.post('/:id/cancel', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const subscription = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.id, id),
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const [updated] = await db.update(subscriptions)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
      })
      .where(eq(subscriptions.id, id))
      .returning();

    // Update tenant status
    await db.update(tenants)
      .set({
        subscriptionStatus: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, subscription.tenantId));

    res.json(updated);
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

export default router;
