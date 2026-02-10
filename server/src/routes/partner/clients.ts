import { Router } from 'express';
import { db } from '../../db';
import { requirePartner, AuthenticatedRequest } from '../../middleware/auth';
import { tenants, subscriptions, companies, tenantUsers } from '@shared/schema';
import { eq, and, desc, count, ilike, or } from 'drizzle-orm';

const router = Router();

// List referred clients (tenants)
router.get('/', requirePartner, async (req: AuthenticatedRequest, res) => {
  try {
    const partnerId = req.partnerId!;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search as string;
    const status = req.query.status as string;

    let whereConditions: any[] = [eq(tenants.partnerId, partnerId)];

    if (search) {
      whereConditions.push(
        or(
          ilike(tenants.name, `%${search}%`),
          ilike(tenants.billingEmail, `%${search}%`)
        )
      );
    }

    if (status === 'active') {
      whereConditions.push(eq(tenants.isActive, true));
    } else if (status === 'inactive') {
      whereConditions.push(eq(tenants.isActive, false));
    }

    const whereClause = and(...whereConditions);

    const clientList = await db.query.tenants.findMany({
      where: whereClause,
      orderBy: desc(tenants.createdAt),
      limit,
      offset,
    });

    // Enrich with subscription and usage info
    const enrichedClients = await Promise.all(
      clientList.map(async (client) => {
        // Get current subscription
        const currentSub = await db.query.subscriptions.findFirst({
          where: and(
            eq(subscriptions.tenantId, client.id),
            eq(subscriptions.status, 'active')
          ),
          orderBy: desc(subscriptions.createdAt),
        });

        // Get company count
        const [companyCount] = await db.select({ count: count() })
          .from(companies)
          .where(eq(companies.tenantId, client.id));

        // Get user count
        const [userCount] = await db.select({ count: count() })
          .from(tenantUsers)
          .where(eq(tenantUsers.tenantId, client.id));

        return {
          ...client,
          subscription: currentSub,
          usage: {
            companies: companyCount.count,
            users: userCount.count,
          },
        };
      })
    );

    const [totalCount] = await db.select({ count: count() })
      .from(tenants)
      .where(whereClause);

    res.json({
      clients: enrichedClients,
      pagination: {
        page,
        limit,
        total: totalCount.count,
        totalPages: Math.ceil(totalCount.count / limit),
      },
    });
  } catch (error) {
    console.error('List clients error:', error);
    res.status(500).json({ error: 'Failed to fetch clients' });
  }
});

// Get client details
router.get('/:id', requirePartner, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const partnerId = req.partnerId!;

    const client = await db.query.tenants.findFirst({
      where: and(
        eq(tenants.id, id),
        eq(tenants.partnerId, partnerId)
      ),
    });

    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Get subscription history
    const subscriptionHistory = await db.query.subscriptions.findMany({
      where: eq(subscriptions.tenantId, id),
      orderBy: desc(subscriptions.createdAt),
    });

    // Get companies
    const clientCompanies = await db.query.companies.findMany({
      where: eq(companies.tenantId, id),
    });

    res.json({
      ...client,
      subscriptionHistory,
      companies: clientCompanies,
    });
  } catch (error) {
    console.error('Get client error:', error);
    res.status(500).json({ error: 'Failed to fetch client' });
  }
});

export default router;
