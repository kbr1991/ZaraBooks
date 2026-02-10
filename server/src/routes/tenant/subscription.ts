import { Router } from 'express';
import { db } from '../../db';
import { requireTenantAdmin, AuthenticatedRequest } from '../../middleware/auth';
import { tenants, subscriptions, subscriptionPlans } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

const router = Router();

// Get current subscription
router.get('/', requireTenantAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = req.tenantId!;

    // Get tenant with partner info
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
      with: {
        partner: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Get current subscription
    const currentSubscription = await db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.tenantId, tenantId),
        eq(subscriptions.status, 'active')
      ),
      orderBy: desc(subscriptions.createdAt),
    });

    res.json({
      plan: tenant.subscriptionPlan,
      status: tenant.subscriptionStatus,
      trialEndsAt: tenant.trialEndsAt,
      maxCompanies: tenant.maxCompanies,
      maxUsersPerCompany: tenant.maxUsersPerCompany,
      subscription: currentSubscription,
      partner: tenant.partner ? { name: tenant.partner.name } : null,
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Failed to fetch subscription' });
  }
});

// Get available plans
router.get('/plans', requireTenantAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const plans = await db.query.subscriptionPlans.findMany({
      where: eq(subscriptionPlans.isActive, true),
      orderBy: subscriptionPlans.displayOrder,
    });

    res.json(plans);
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ error: 'Failed to fetch plans' });
  }
});

// Get subscription history
router.get('/history', requireTenantAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = req.tenantId!;

    const history = await db.query.subscriptions.findMany({
      where: eq(subscriptions.tenantId, tenantId),
      orderBy: desc(subscriptions.createdAt),
    });

    res.json(history);
  } catch (error) {
    console.error('Get subscription history error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Subscribe to a plan (placeholder - actual payment integration needed)
router.post('/subscribe', requireTenantAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = req.tenantId!;
    const { planCode, billingCycle } = req.body;

    // Get plan details
    const plan = await db.query.subscriptionPlans.findFirst({
      where: and(
        eq(subscriptionPlans.code, planCode),
        eq(subscriptionPlans.isActive, true)
      ),
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // Get tenant with partner
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
      with: { partner: true },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const amount = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;

    const now = new Date();
    const periodEnd = new Date(now);
    if (billingCycle === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    // Create subscription (in real app, this would be after payment)
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

    // Update tenant
    await db.update(tenants)
      .set({
        subscriptionPlan: planCode,
        subscriptionStatus: 'active',
        maxCompanies: plan.maxCompanies,
        maxUsersPerCompany: plan.maxUsersPerCompany,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));

    res.status(201).json({
      subscription: newSubscription,
      message: 'Subscription activated successfully',
    });
  } catch (error) {
    console.error('Subscribe error:', error);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// Cancel subscription
router.post('/cancel', requireTenantAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = req.tenantId!;

    // Get current subscription
    const currentSub = await db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.tenantId, tenantId),
        eq(subscriptions.status, 'active')
      ),
    });

    if (!currentSub) {
      return res.status(400).json({ error: 'No active subscription to cancel' });
    }

    // Cancel subscription
    await db.update(subscriptions)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
      })
      .where(eq(subscriptions.id, currentSub.id));

    // Update tenant
    await db.update(tenants)
      .set({
        subscriptionStatus: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));

    res.json({ message: 'Subscription cancelled successfully' });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

export default router;
