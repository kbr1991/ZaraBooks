import { Router } from 'express';
import { db } from '../../db';
import { requireTenant, AuthenticatedRequest } from '../../middleware/auth';
import { tenants, companies, tenantUsers, subscriptions } from '@shared/schema';
import { eq, and, count, desc } from 'drizzle-orm';

const router = Router();

// Get tenant dashboard stats
router.get('/', requireTenant, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = req.tenantId!;

    // Get tenant details
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
      with: {
        partner: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Get company count
    const [companyCount] = await db.select({ count: count() })
      .from(companies)
      .where(eq(companies.tenantId, tenantId));

    // Get user count
    const [userCount] = await db.select({ count: count() })
      .from(tenantUsers)
      .where(eq(tenantUsers.tenantId, tenantId));

    // Get current subscription
    const currentSubscription = await db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.tenantId, tenantId),
        eq(subscriptions.status, 'active')
      ),
      orderBy: desc(subscriptions.createdAt),
    });

    // Get companies list
    const companiesList = await db.query.companies.findMany({
      where: eq(companies.tenantId, tenantId),
      orderBy: desc(companies.createdAt),
      limit: 10,
    });

    res.json({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        billingEmail: tenant.billingEmail,
        subscriptionPlan: tenant.subscriptionPlan,
        subscriptionStatus: tenant.subscriptionStatus,
        maxCompanies: tenant.maxCompanies,
        maxUsersPerCompany: tenant.maxUsersPerCompany,
        trialEndsAt: tenant.trialEndsAt,
        partner: tenant.partner ? {
          name: tenant.partner.name,
        } : null,
      },
      usage: {
        companies: companyCount.count,
        users: userCount.count,
        maxCompanies: tenant.maxCompanies,
        maxUsersPerCompany: tenant.maxUsersPerCompany,
      },
      subscription: currentSubscription,
      companies: companiesList,
    });
  } catch (error) {
    console.error('Tenant dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Get tenant profile
router.get('/profile', requireTenant, async (req: AuthenticatedRequest, res) => {
  try {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, req.tenantId!),
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json(tenant);
  } catch (error) {
    console.error('Get tenant profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update tenant profile
router.patch('/profile', requireTenant, async (req: AuthenticatedRequest, res) => {
  try {
    const { name, billingEmail, gstNumber } = req.body;

    const [updated] = await db.update(tenants)
      .set({
        name,
        billingEmail,
        gstNumber,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, req.tenantId!))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Update tenant profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
