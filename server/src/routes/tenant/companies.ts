import { Router } from 'express';
import { db } from '../../db';
import { requireTenantAdmin, AuthenticatedRequest } from '../../middleware/auth';
import { companies, tenants, companyUsers } from '@shared/schema';
import { eq, and, count } from 'drizzle-orm';

const router = Router();

// List tenant's companies
router.get('/', requireTenantAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = req.tenantId!;

    const companiesList = await db.query.companies.findMany({
      where: eq(companies.tenantId, tenantId),
      with: {
        createdBy: true,
      },
    });

    // Get user count for each company
    const enrichedCompanies = await Promise.all(
      companiesList.map(async (company) => {
        const [userCount] = await db.select({ count: count() })
          .from(companyUsers)
          .where(eq(companyUsers.companyId, company.id));

        return {
          ...company,
          userCount: userCount.count,
        };
      })
    );

    res.json(enrichedCompanies);
  } catch (error) {
    console.error('List companies error:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Create company within tenant
router.post('/', requireTenantAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = req.tenantId!;

    // Check tenant limits
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const [currentCount] = await db.select({ count: count() })
      .from(companies)
      .where(eq(companies.tenantId, tenantId));

    if (currentCount.count >= (tenant.maxCompanies || 1)) {
      return res.status(400).json({
        error: `Company limit reached (${tenant.maxCompanies}). Upgrade your plan for more companies.`,
      });
    }

    const {
      name,
      legalName,
      companyType,
      pan,
      gstin,
      tan,
      cin,
      address,
      city,
      state,
      stateCode,
      pincode,
      country,
      fiscalYearStart,
      gaapStandard,
      baseCurrency,
    } = req.body;

    const [newCompany] = await db.insert(companies).values({
      name,
      legalName,
      companyType,
      tenantId,
      pan,
      gstin,
      tan,
      cin,
      address,
      city,
      state,
      stateCode,
      pincode,
      country: country || 'India',
      fiscalYearStart: fiscalYearStart || 4,
      gaapStandard: gaapStandard || 'INDIA_GAAP',
      baseCurrency: baseCurrency || 'INR',
      createdByUserId: req.userId,
    }).returning();

    // Add creating user as company owner
    await db.insert(companyUsers).values({
      companyId: newCompany.id,
      userId: req.userId!,
      role: 'owner',
    });

    res.status(201).json(newCompany);
  } catch (error) {
    console.error('Create company error:', error);
    res.status(500).json({ error: 'Failed to create company' });
  }
});

// Update company
router.patch('/:id', requireTenantAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;

    // Verify company belongs to tenant
    const company = await db.query.companies.findFirst({
      where: and(
        eq(companies.id, id),
        eq(companies.tenantId, tenantId)
      ),
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const {
      name,
      legalName,
      pan,
      gstin,
      tan,
      cin,
      address,
      city,
      state,
      stateCode,
      pincode,
    } = req.body;

    const [updated] = await db.update(companies)
      .set({
        name,
        legalName,
        pan,
        gstin,
        tan,
        cin,
        address,
        city,
        state,
        stateCode,
        pincode,
        updatedAt: new Date(),
      })
      .where(eq(companies.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Update company error:', error);
    res.status(500).json({ error: 'Failed to update company' });
  }
});

// Delete company
router.delete('/:id', requireTenantAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;

    // Verify company belongs to tenant
    const company = await db.query.companies.findFirst({
      where: and(
        eq(companies.id, id),
        eq(companies.tenantId, tenantId)
      ),
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Note: This will cascade delete all related data due to FK constraints
    await db.delete(companies)
      .where(eq(companies.id, id));

    res.json({ success: true });
  } catch (error) {
    console.error('Delete company error:', error);
    res.status(500).json({ error: 'Failed to delete company' });
  }
});

export default router;
