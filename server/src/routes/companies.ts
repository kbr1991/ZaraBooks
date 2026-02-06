import { Router } from 'express';
import { db } from '../db';
import { companies, companyUsers, fiscalYears, chartOfAccounts, coaTemplates } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth, requireCompany, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all companies for current user
router.get('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const userCompanies = await db.query.companyUsers.findMany({
      where: and(
        eq(companyUsers.userId, req.userId!),
        eq(companyUsers.isActive, true)
      ),
      with: {
        company: true,
      },
      orderBy: desc(companyUsers.createdAt),
    });

    res.json(userCompanies.map(uc => ({
      ...uc.company,
      role: uc.role,
    })));
  } catch (error) {
    console.error('Get companies error:', error);
    res.status(500).json({ error: 'Failed to get companies' });
  }
});

// Create new company
router.post('/', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
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
      fiscalYearStart,
      gaapStandard,
      baseCurrency,
    } = req.body;

    // Create company
    const [company] = await db.insert(companies).values({
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
      fiscalYearStart: fiscalYearStart || 4, // Default to April
      gaapStandard: gaapStandard || 'INDIA_GAAP',
      baseCurrency: baseCurrency || 'INR',
      createdByUserId: req.userId!,
    }).returning();

    // Add user as owner
    await db.insert(companyUsers).values({
      companyId: company.id,
      userId: req.userId!,
      role: 'owner',
      isActive: true,
    });

    // Create default fiscal year
    const fyStart = fiscalYearStart || 4;
    const now = new Date();
    let fyStartDate: Date;
    let fyEndDate: Date;

    if (now.getMonth() + 1 >= fyStart) {
      fyStartDate = new Date(now.getFullYear(), fyStart - 1, 1);
      fyEndDate = new Date(now.getFullYear() + 1, fyStart - 1, 0);
    } else {
      fyStartDate = new Date(now.getFullYear() - 1, fyStart - 1, 1);
      fyEndDate = new Date(now.getFullYear(), fyStart - 1, 0);
    }

    const fyName = fyStart === 4
      ? `FY ${fyStartDate.getFullYear()}-${(fyEndDate.getFullYear() % 100).toString().padStart(2, '0')}`
      : `FY ${fyStartDate.getFullYear()}`;

    await db.insert(fiscalYears).values({
      companyId: company.id,
      name: fyName,
      startDate: fyStartDate.toISOString().split('T')[0],
      endDate: fyEndDate.toISOString().split('T')[0],
      isCurrent: true,
    });

    // Initialize Chart of Accounts from template
    const template = await db.query.coaTemplates.findFirst({
      where: eq(coaTemplates.gaapStandard, gaapStandard || 'INDIA_GAAP'),
    });

    if (template && template.templateData) {
      const templateData = template.templateData as { accounts: any[] };
      const accountIdMap: Record<string, string> = {};

      // First pass: create all accounts without parent references
      for (const account of templateData.accounts) {
        const [created] = await db.insert(chartOfAccounts).values({
          companyId: company.id,
          code: account.code,
          name: account.name,
          accountType: account.type,
          level: account.level,
          isGroup: account.isGroup || false,
          scheduleIIIMapping: account.scheduleIII,
          isActive: true,
          isSystem: true,
        }).returning();
        accountIdMap[account.code] = created.id;
      }

      // Second pass: update parent references
      for (const account of templateData.accounts) {
        if (account.parent) {
          const parentId = accountIdMap[account.parent];
          const accountId = accountIdMap[account.code];
          if (parentId && accountId) {
            await db.update(chartOfAccounts)
              .set({ parentAccountId: parentId })
              .where(eq(chartOfAccounts.id, accountId));
          }
        }
      }
    }

    // Set this company as active in session
    req.session.companyId = company.id;

    res.status(201).json(company);
  } catch (error) {
    console.error('Create company error:', error);
    res.status(500).json({ error: 'Failed to create company' });
  }
});

// Get company by ID
router.get('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // Verify user has access
    const companyUser = await db.query.companyUsers.findFirst({
      where: and(
        eq(companyUsers.companyId, id),
        eq(companyUsers.userId, req.userId!),
        eq(companyUsers.isActive, true)
      ),
      with: {
        company: true,
      },
    });

    if (!companyUser) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json({
      ...companyUser.company,
      role: companyUser.role,
    });
  } catch (error) {
    console.error('Get company error:', error);
    res.status(500).json({ error: 'Failed to get company' });
  }
});

// Update company
router.patch('/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // Verify user is owner or accountant
    const companyUser = await db.query.companyUsers.findFirst({
      where: and(
        eq(companyUsers.companyId, id),
        eq(companyUsers.userId, req.userId!),
        eq(companyUsers.isActive, true)
      ),
    });

    if (!companyUser || !['owner', 'accountant'].includes(companyUser.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const [updated] = await db.update(companies)
      .set({
        ...req.body,
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

// Get fiscal years for company
router.get('/:id/fiscal-years', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    if (id !== req.companyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const years = await db.query.fiscalYears.findMany({
      where: eq(fiscalYears.companyId, id),
      orderBy: desc(fiscalYears.startDate),
    });

    res.json(years);
  } catch (error) {
    console.error('Get fiscal years error:', error);
    res.status(500).json({ error: 'Failed to get fiscal years' });
  }
});

// Create fiscal year
router.post('/:id/fiscal-years', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { name, startDate, endDate, isCurrent } = req.body;

    if (id !== req.companyId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // If setting as current, unset other current years
    if (isCurrent) {
      await db.update(fiscalYears)
        .set({ isCurrent: false })
        .where(eq(fiscalYears.companyId, id));
    }

    const [fy] = await db.insert(fiscalYears).values({
      companyId: id,
      name,
      startDate,
      endDate,
      isCurrent,
    }).returning();

    res.status(201).json(fy);
  } catch (error) {
    console.error('Create fiscal year error:', error);
    res.status(500).json({ error: 'Failed to create fiscal year' });
  }
});

// Add user to company
router.post('/:id/users', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { userId, role } = req.body;

    // Verify requester is owner
    const requesterAccess = await db.query.companyUsers.findFirst({
      where: and(
        eq(companyUsers.companyId, id),
        eq(companyUsers.userId, req.userId!),
        eq(companyUsers.role, 'owner'),
        eq(companyUsers.isActive, true)
      ),
    });

    if (!requesterAccess) {
      return res.status(403).json({ error: 'Only owners can add users' });
    }

    // Check if user already has access
    const existing = await db.query.companyUsers.findFirst({
      where: and(
        eq(companyUsers.companyId, id),
        eq(companyUsers.userId, userId)
      ),
    });

    if (existing) {
      // Update existing
      const [updated] = await db.update(companyUsers)
        .set({ role, isActive: true, updatedAt: new Date() })
        .where(eq(companyUsers.id, existing.id))
        .returning();
      return res.json(updated);
    }

    const [companyUser] = await db.insert(companyUsers).values({
      companyId: id,
      userId,
      role,
      isActive: true,
    }).returning();

    res.status(201).json(companyUser);
  } catch (error) {
    console.error('Add user error:', error);
    res.status(500).json({ error: 'Failed to add user' });
  }
});

export default router;
