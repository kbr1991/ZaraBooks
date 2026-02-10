import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../../db';
import { requireTenantAdmin, AuthenticatedRequest } from '../../middleware/auth';
import { tenantUsers, users, tenants, companyUsers, companies } from '@shared/schema';
import { eq, and, desc, count } from 'drizzle-orm';

const router = Router();

// List tenant users
router.get('/', requireTenantAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = req.tenantId!;

    const usersList = await db.query.tenantUsers.findMany({
      where: eq(tenantUsers.tenantId, tenantId),
      with: {
        user: true,
      },
      orderBy: desc(tenantUsers.createdAt),
    });

    // Sanitize user data
    const sanitizedUsers = usersList.map(tu => ({
      id: tu.id,
      role: tu.role,
      isActive: tu.isActive,
      createdAt: tu.createdAt,
      user: {
        id: tu.user.id,
        email: tu.user.email,
        firstName: tu.user.firstName,
        lastName: tu.user.lastName,
        phone: tu.user.phone,
        isActive: tu.user.isActive,
      },
    }));

    res.json(sanitizedUsers);
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Invite user to tenant
router.post('/', requireTenantAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantId = req.tenantId!;
    const { email, firstName, lastName, phone, password, role, companyAccess } = req.body;

    // Check tenant limits
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Check if user exists
    let user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (!user) {
      // Create new user
      const hashedPassword = await bcrypt.hash(password, 10);
      const [newUser] = await db.insert(users).values({
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName: lastName || '',
        phone,
        role: 'user',
        isActive: true,
      }).returning();
      user = newUser;
    }

    // Check if already a tenant user
    const existing = await db.query.tenantUsers.findFirst({
      where: and(
        eq(tenantUsers.tenantId, tenantId),
        eq(tenantUsers.userId, user.id)
      ),
    });

    if (existing) {
      return res.status(400).json({ error: 'User is already a member' });
    }

    // Add to tenant
    const [newTenantUser] = await db.insert(tenantUsers).values({
      tenantId,
      userId: user.id,
      role: role || 'user',
    }).returning();

    // Add to specified companies if provided
    if (companyAccess && Array.isArray(companyAccess)) {
      for (const access of companyAccess) {
        // Verify company belongs to tenant
        const company = await db.query.companies.findFirst({
          where: and(
            eq(companies.id, access.companyId),
            eq(companies.tenantId, tenantId)
          ),
        });

        if (company) {
          await db.insert(companyUsers).values({
            companyId: access.companyId,
            userId: user.id,
            role: access.role || 'viewer',
          });
        }
      }
    }

    res.status(201).json({
      id: newTenantUser.id,
      role: newTenantUser.role,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error) {
    console.error('Add user error:', error);
    res.status(500).json({ error: 'Failed to add user' });
  }
});

// Update user role
router.patch('/:id', requireTenantAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;
    const { role, isActive } = req.body;

    // Verify user belongs to tenant
    const tenantUser = await db.query.tenantUsers.findFirst({
      where: and(
        eq(tenantUsers.id, id),
        eq(tenantUsers.tenantId, tenantId)
      ),
    });

    if (!tenantUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Don't allow changing own role
    if (tenantUser.userId === req.userId) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    const updateData: any = {};
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;

    const [updated] = await db.update(tenantUsers)
      .set(updateData)
      .where(eq(tenantUsers.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Remove user from tenant
router.delete('/:id', requireTenantAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;

    // Verify user belongs to tenant
    const tenantUser = await db.query.tenantUsers.findFirst({
      where: and(
        eq(tenantUsers.id, id),
        eq(tenantUsers.tenantId, tenantId)
      ),
    });

    if (!tenantUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Don't allow removing yourself
    if (tenantUser.userId === req.userId) {
      return res.status(400).json({ error: 'Cannot remove yourself' });
    }

    // Remove from tenant
    await db.delete(tenantUsers)
      .where(eq(tenantUsers.id, id));

    // Also remove from all companies in this tenant
    const tenantCompanies = await db.query.companies.findMany({
      where: eq(companies.tenantId, tenantId),
    });

    for (const company of tenantCompanies) {
      await db.delete(companyUsers)
        .where(and(
          eq(companyUsers.companyId, company.id),
          eq(companyUsers.userId, tenantUser.userId)
        ));
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Remove user error:', error);
    res.status(500).json({ error: 'Failed to remove user' });
  }
});

// Get user's company access
router.get('/:id/companies', requireTenantAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;

    // Verify user belongs to tenant
    const tenantUser = await db.query.tenantUsers.findFirst({
      where: and(
        eq(tenantUsers.id, id),
        eq(tenantUsers.tenantId, tenantId)
      ),
    });

    if (!tenantUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get all companies in tenant
    const tenantCompanies = await db.query.companies.findMany({
      where: eq(companies.tenantId, tenantId),
    });

    // Get user's access to each company
    const companyAccess = await Promise.all(
      tenantCompanies.map(async (company) => {
        const access = await db.query.companyUsers.findFirst({
          where: and(
            eq(companyUsers.companyId, company.id),
            eq(companyUsers.userId, tenantUser.userId)
          ),
        });

        return {
          company: {
            id: company.id,
            name: company.name,
          },
          hasAccess: !!access,
          role: access?.role || null,
        };
      })
    );

    res.json(companyAccess);
  } catch (error) {
    console.error('Get company access error:', error);
    res.status(500).json({ error: 'Failed to fetch company access' });
  }
});

// Update user's company access
router.put('/:id/companies', requireTenantAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId!;
    const { companyAccess } = req.body;

    // Verify user belongs to tenant
    const tenantUser = await db.query.tenantUsers.findFirst({
      where: and(
        eq(tenantUsers.id, id),
        eq(tenantUsers.tenantId, tenantId)
      ),
    });

    if (!tenantUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get all companies in tenant
    const tenantCompanies = await db.query.companies.findMany({
      where: eq(companies.tenantId, tenantId),
    });

    const companyIds = tenantCompanies.map(c => c.id);

    // Update access for each company
    for (const access of companyAccess) {
      if (!companyIds.includes(access.companyId)) continue;

      const existing = await db.query.companyUsers.findFirst({
        where: and(
          eq(companyUsers.companyId, access.companyId),
          eq(companyUsers.userId, tenantUser.userId)
        ),
      });

      if (access.hasAccess) {
        if (existing) {
          // Update role
          await db.update(companyUsers)
            .set({ role: access.role || 'viewer' })
            .where(eq(companyUsers.id, existing.id));
        } else {
          // Add access
          await db.insert(companyUsers).values({
            companyId: access.companyId,
            userId: tenantUser.userId,
            role: access.role || 'viewer',
          });
        }
      } else {
        if (existing) {
          // Remove access
          await db.delete(companyUsers)
            .where(eq(companyUsers.id, existing.id));
        }
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Update company access error:', error);
    res.status(500).json({ error: 'Failed to update company access' });
  }
});

export default router;
