import { Router } from 'express';
import { db } from '../../db';
import { requireSuperAdmin, AuthenticatedRequest } from '../../middleware/auth';
import { tenants, tenantUsers, companies, subscriptions, users } from '@shared/schema';
import { eq, and, like, desc, count, ilike, or } from 'drizzle-orm';

const router = Router();

// List all tenants with pagination and filtering
router.get('/', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search as string;
    const status = req.query.status as string;
    const plan = req.query.plan as string;

    let whereConditions: any[] = [];

    if (search) {
      whereConditions.push(
        or(
          ilike(tenants.name, `%${search}%`),
          ilike(tenants.slug, `%${search}%`),
          ilike(tenants.billingEmail, `%${search}%`)
        )
      );
    }

    if (status === 'active') {
      whereConditions.push(eq(tenants.isActive, true));
    } else if (status === 'inactive') {
      whereConditions.push(eq(tenants.isActive, false));
    }

    if (plan) {
      whereConditions.push(eq(tenants.subscriptionPlan, plan));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const tenantList = await db.query.tenants.findMany({
      where: whereClause,
      with: {
        partner: true,
      },
      orderBy: desc(tenants.createdAt),
      limit,
      offset,
    });

    // Get company count and user count for each tenant
    const enrichedTenants = await Promise.all(
      tenantList.map(async (tenant) => {
        const [companyCount] = await db.select({ count: count() })
          .from(companies)
          .where(eq(companies.tenantId, tenant.id));

        const [userCount] = await db.select({ count: count() })
          .from(tenantUsers)
          .where(eq(tenantUsers.tenantId, tenant.id));

        return {
          ...tenant,
          companyCount: companyCount.count,
          userCount: userCount.count,
        };
      })
    );

    const [totalCount] = await db.select({ count: count() })
      .from(tenants)
      .where(whereClause);

    res.json({
      tenants: enrichedTenants,
      pagination: {
        page,
        limit,
        total: totalCount.count,
        totalPages: Math.ceil(totalCount.count / limit),
      },
    });
  } catch (error) {
    console.error('List tenants error:', error);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

// Get tenant details
router.get('/:id', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, id),
      with: {
        partner: true,
        tenantUsers: {
          with: {
            user: true,
          },
        },
        companies: true,
        subscriptions: {
          orderBy: desc(subscriptions.createdAt),
          limit: 10,
        },
      },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json(tenant);
  } catch (error) {
    console.error('Get tenant error:', error);
    res.status(500).json({ error: 'Failed to fetch tenant' });
  }
});

// Create tenant
router.post('/', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      name,
      slug,
      billingEmail,
      gstNumber,
      subscriptionPlan,
      partnerId,
      maxCompanies,
      maxUsersPerCompany,
    } = req.body;

    // Check slug uniqueness
    const existing = await db.query.tenants.findFirst({
      where: eq(tenants.slug, slug),
    });

    if (existing) {
      return res.status(400).json({ error: 'Slug already in use' });
    }

    const [newTenant] = await db.insert(tenants).values({
      name,
      slug,
      billingEmail,
      gstNumber,
      subscriptionPlan: subscriptionPlan || 'free',
      partnerId,
      maxCompanies: maxCompanies || 1,
      maxUsersPerCompany: maxUsersPerCompany || 3,
    }).returning();

    res.status(201).json(newTenant);
  } catch (error) {
    console.error('Create tenant error:', error);
    res.status(500).json({ error: 'Failed to create tenant' });
  }
});

// Update tenant
router.patch('/:id', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      billingEmail,
      gstNumber,
      subscriptionPlan,
      subscriptionStatus,
      maxCompanies,
      maxUsersPerCompany,
      isActive,
    } = req.body;

    const [updated] = await db.update(tenants)
      .set({
        name,
        billingEmail,
        gstNumber,
        subscriptionPlan,
        subscriptionStatus,
        maxCompanies,
        maxUsersPerCompany,
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Update tenant error:', error);
    res.status(500).json({ error: 'Failed to update tenant' });
  }
});

// Add user to tenant
router.post('/:id/users', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.body;

    // Check if user already exists in tenant
    const existing = await db.query.tenantUsers.findFirst({
      where: and(
        eq(tenantUsers.tenantId, id),
        eq(tenantUsers.userId, userId)
      ),
    });

    if (existing) {
      return res.status(400).json({ error: 'User already in tenant' });
    }

    const [newTenantUser] = await db.insert(tenantUsers).values({
      tenantId: id,
      userId,
      role: role || 'user',
    }).returning();

    res.status(201).json(newTenantUser);
  } catch (error) {
    console.error('Add tenant user error:', error);
    res.status(500).json({ error: 'Failed to add user to tenant' });
  }
});

// Remove user from tenant
router.delete('/:id/users/:userId', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id, userId } = req.params;

    await db.delete(tenantUsers)
      .where(and(
        eq(tenantUsers.tenantId, id),
        eq(tenantUsers.userId, userId)
      ));

    res.json({ success: true });
  } catch (error) {
    console.error('Remove tenant user error:', error);
    res.status(500).json({ error: 'Failed to remove user from tenant' });
  }
});

export default router;
