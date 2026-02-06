import { Router } from 'express';
import { db } from '../db';
import { chartOfAccounts, coaTemplates } from '@shared/schema';
import { eq, and, asc, isNull } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all accounts for current company
router.get('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const accounts = await db.query.chartOfAccounts.findMany({
      where: eq(chartOfAccounts.companyId, req.companyId!),
      orderBy: [asc(chartOfAccounts.code)],
    });

    // Build hierarchical structure
    const accountMap = new Map<string, any>();
    const rootAccounts: any[] = [];

    accounts.forEach(account => {
      accountMap.set(account.id, { ...account, children: [] });
    });

    accounts.forEach(account => {
      const node = accountMap.get(account.id);
      if (account.parentAccountId) {
        const parent = accountMap.get(account.parentAccountId);
        if (parent) {
          parent.children.push(node);
        }
      } else {
        rootAccounts.push(node);
      }
    });

    res.json({
      accounts,
      hierarchy: rootAccounts,
    });
  } catch (error) {
    console.error('Get accounts error:', error);
    res.status(500).json({ error: 'Failed to get accounts' });
  }
});

// Get account by ID
router.get('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const account = await db.query.chartOfAccounts.findFirst({
      where: and(
        eq(chartOfAccounts.id, id),
        eq(chartOfAccounts.companyId, req.companyId!)
      ),
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Get children
    const children = await db.query.chartOfAccounts.findMany({
      where: and(
        eq(chartOfAccounts.parentAccountId, id),
        eq(chartOfAccounts.companyId, req.companyId!)
      ),
      orderBy: asc(chartOfAccounts.code),
    });

    res.json({ ...account, children });
  } catch (error) {
    console.error('Get account error:', error);
    res.status(500).json({ error: 'Failed to get account' });
  }
});

// Create account
router.post('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      code,
      name,
      description,
      accountType,
      parentAccountId,
      isGroup,
      scheduleIIIMapping,
      openingBalance,
      openingBalanceType,
      gstApplicable,
      defaultGstRate,
      hsnSacCode,
      customFields,
    } = req.body;

    // Validate code uniqueness within company
    const existing = await db.query.chartOfAccounts.findFirst({
      where: and(
        eq(chartOfAccounts.companyId, req.companyId!),
        eq(chartOfAccounts.code, code)
      ),
    });

    if (existing) {
      return res.status(400).json({ error: 'Account code already exists' });
    }

    // Calculate level based on parent
    let level = 1;
    if (parentAccountId) {
      const parent = await db.query.chartOfAccounts.findFirst({
        where: eq(chartOfAccounts.id, parentAccountId),
      });
      if (parent) {
        level = parent.level + 1;
      }
    }

    const [account] = await db.insert(chartOfAccounts).values({
      companyId: req.companyId!,
      code,
      name,
      description,
      accountType,
      parentAccountId,
      level,
      isGroup: isGroup || false,
      scheduleIIIMapping,
      openingBalance,
      openingBalanceType,
      gstApplicable,
      defaultGstRate,
      hsnSacCode,
      customFields,
      isActive: true,
      isSystem: false,
    }).returning();

    res.status(201).json(account);
  } catch (error) {
    console.error('Create account error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// Update account
router.patch('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // Check if account exists and belongs to company
    const account = await db.query.chartOfAccounts.findFirst({
      where: and(
        eq(chartOfAccounts.id, id),
        eq(chartOfAccounts.companyId, req.companyId!)
      ),
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Prevent editing system accounts' critical fields
    if (account.isSystem && (req.body.code || req.body.accountType || req.body.scheduleIIIMapping)) {
      return res.status(400).json({ error: 'Cannot modify system account structure' });
    }

    // Check code uniqueness if changing
    if (req.body.code && req.body.code !== account.code) {
      const existing = await db.query.chartOfAccounts.findFirst({
        where: and(
          eq(chartOfAccounts.companyId, req.companyId!),
          eq(chartOfAccounts.code, req.body.code)
        ),
      });
      if (existing) {
        return res.status(400).json({ error: 'Account code already exists' });
      }
    }

    // Calculate new level if parent changed
    let level = account.level;
    if (req.body.parentAccountId !== undefined && req.body.parentAccountId !== account.parentAccountId) {
      if (req.body.parentAccountId) {
        const parent = await db.query.chartOfAccounts.findFirst({
          where: eq(chartOfAccounts.id, req.body.parentAccountId),
        });
        if (parent) {
          level = parent.level + 1;
        }
      } else {
        level = 1;
      }
    }

    const [updated] = await db.update(chartOfAccounts)
      .set({
        ...req.body,
        level,
        updatedAt: new Date(),
      })
      .where(eq(chartOfAccounts.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Update account error:', error);
    res.status(500).json({ error: 'Failed to update account' });
  }
});

// Delete account
router.delete('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const account = await db.query.chartOfAccounts.findFirst({
      where: and(
        eq(chartOfAccounts.id, id),
        eq(chartOfAccounts.companyId, req.companyId!)
      ),
    });

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    if (account.isSystem) {
      return res.status(400).json({ error: 'Cannot delete system account' });
    }

    // Check for children
    const children = await db.query.chartOfAccounts.findFirst({
      where: eq(chartOfAccounts.parentAccountId, id),
    });

    if (children) {
      return res.status(400).json({ error: 'Cannot delete account with child accounts' });
    }

    // TODO: Check for journal entries using this account

    await db.delete(chartOfAccounts).where(eq(chartOfAccounts.id, id));
    res.json({ message: 'Account deleted' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

// Get available templates
router.get('/templates/list', async (_req, res) => {
  try {
    const templates = await db.query.coaTemplates.findMany({
      where: eq(coaTemplates.isActive, true),
    });

    res.json(templates.map(t => ({
      id: t.id,
      name: t.name,
      gaapStandard: t.gaapStandard,
      description: t.description,
    })));
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to get templates' });
  }
});

// Get leaf accounts (non-group accounts for transactions)
router.get('/ledgers/list', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { type } = req.query;

    let whereConditions = [
      eq(chartOfAccounts.companyId, req.companyId!),
      eq(chartOfAccounts.isGroup, false),
      eq(chartOfAccounts.isActive, true),
    ];

    if (type) {
      whereConditions.push(eq(chartOfAccounts.accountType, type as any));
    }

    const accounts = await db.query.chartOfAccounts.findMany({
      where: and(...whereConditions),
      orderBy: [asc(chartOfAccounts.code)],
    });

    res.json(accounts);
  } catch (error) {
    console.error('Get ledgers error:', error);
    res.status(500).json({ error: 'Failed to get ledgers' });
  }
});

export default router;
