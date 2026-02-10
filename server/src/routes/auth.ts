import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { users, companyUsers, companies, partnerUsers, tenantUsers, tenants, partners } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Login - Enhanced with multi-tenancy context detection
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await db.update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, user.id));

    // Check partner access
    const partnerUser = await db.query.partnerUsers.findFirst({
      where: and(
        eq(partnerUsers.userId, user.id),
        eq(partnerUsers.isActive, true)
      ),
      with: { partner: true },
    });

    // Check tenant access
    const tenantUsersList = await db.query.tenantUsers.findMany({
      where: and(
        eq(tenantUsers.userId, user.id),
        eq(tenantUsers.isActive, true)
      ),
      with: { tenant: true },
    });

    // Get user's companies with tenant info
    const userCompanies = await db.query.companyUsers.findMany({
      where: and(
        eq(companyUsers.userId, user.id),
        eq(companyUsers.isActive, true)
      ),
      with: {
        company: true,
      },
    });

    // Set session
    req.session.userId = user.id;

    // Set context based on user type
    if (user.role === 'super_admin') {
      req.session.userType = 'super_admin';
    } else if (partnerUser) {
      req.session.partnerId = partnerUser.partnerId;
      req.session.userType = 'partner';
    }

    // Auto-select single tenant
    if (tenantUsersList.length === 1) {
      req.session.tenantId = tenantUsersList[0].tenantId;
    }

    // If user has only one company, auto-select it
    if (userCompanies.length === 1) {
      req.session.companyId = userCompanies[0].companyId;
      // Also set tenant from company if it has one
      if (userCompanies[0].company.tenantId) {
        req.session.tenantId = userCompanies[0].company.tenantId;
      }
    }

    const { password: _, ...userWithoutPassword } = user;
    res.json({
      user: userWithoutPassword,
      userType: req.session.userType || 'tenant',
      partner: partnerUser?.partner || null,
      tenants: tenantUsersList.map(tu => ({
        ...tu.tenant,
        role: tu.role,
      })),
      companies: userCompanies.map(uc => ({
        ...uc.company,
        role: uc.role,
      })),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, referralCode } = req.body;

    // Check if user exists
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const [newUser] = await db.insert(users).values({
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName,
      lastName,
      phone,
      role: 'user',
      isActive: true,
    }).returning();

    // If referral code provided, look up partner
    let partnerRef = null;
    if (referralCode) {
      partnerRef = await db.query.partners.findFirst({
        where: and(
          eq(partners.referralCode, referralCode),
          eq(partners.isActive, true)
        ),
      });
    }

    // Create a default tenant for new users
    const [newTenant] = await db.insert(tenants).values({
      name: `${firstName}'s Organization`,
      slug: `${email.toLowerCase().split('@')[0]}-${Date.now()}`,
      billingEmail: email.toLowerCase(),
      subscriptionPlan: 'free',
      partnerId: partnerRef?.id,
      referralCode: referralCode || null,
    }).returning();

    // Add user as tenant admin
    await db.insert(tenantUsers).values({
      tenantId: newTenant.id,
      userId: newUser.id,
      role: 'admin',
    });

    req.session.userId = newUser.id;
    req.session.tenantId = newTenant.id;
    req.session.userType = 'tenant';

    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json({
      user: userWithoutPassword,
      tenant: newTenant,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Get current user - Enhanced with multi-tenancy context
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.userId!),
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get partner access if any
    const partnerUser = await db.query.partnerUsers.findFirst({
      where: and(
        eq(partnerUsers.userId, user.id),
        eq(partnerUsers.isActive, true)
      ),
      with: { partner: true },
    });

    // Get tenant access
    const tenantUsersList = await db.query.tenantUsers.findMany({
      where: and(
        eq(tenantUsers.userId, user.id),
        eq(tenantUsers.isActive, true)
      ),
      with: { tenant: true },
    });

    // Get user's companies
    const userCompanies = await db.query.companyUsers.findMany({
      where: and(
        eq(companyUsers.userId, user.id),
        eq(companyUsers.isActive, true)
      ),
      with: {
        company: true,
      },
    });

    // Get current company details if selected
    let currentCompany = null;
    let currentRole = null;
    if (req.companyId) {
      const companyUser = userCompanies.find(uc => uc.companyId === req.companyId);
      if (companyUser) {
        currentCompany = companyUser.company;
        currentRole = companyUser.role;
      }
    }

    // Get current tenant if selected
    let currentTenant = null;
    let currentTenantRole = null;
    if (req.tenantId) {
      const tenantUser = tenantUsersList.find(tu => tu.tenantId === req.tenantId);
      if (tenantUser) {
        currentTenant = tenantUser.tenant;
        currentTenantRole = tenantUser.role;
      }
    }

    const { password: _, ...userWithoutPassword } = user;
    res.json({
      user: userWithoutPassword,
      userType: req.userType || (user.role === 'super_admin' ? 'super_admin' : 'tenant'),
      partner: partnerUser?.partner || null,
      partnerRole: partnerUser?.role || null,
      tenants: tenantUsersList.map(tu => ({
        ...tu.tenant,
        role: tu.role,
      })),
      currentTenant,
      currentTenantRole,
      companies: userCompanies.map(uc => ({
        ...uc.company,
        role: uc.role,
      })),
      currentCompany,
      currentRole,
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Select company
router.post('/select-company', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { companyId } = req.body;

    // Verify user has access to this company
    const companyUser = await db.query.companyUsers.findFirst({
      where: and(
        eq(companyUsers.userId, req.userId!),
        eq(companyUsers.companyId, companyId),
        eq(companyUsers.isActive, true)
      ),
      with: {
        company: true,
      },
    });

    if (!companyUser) {
      return res.status(403).json({ error: 'Access denied to this company' });
    }

    req.session.companyId = companyId;

    // Also set tenant from company if it has one
    if (companyUser.company.tenantId) {
      req.session.tenantId = companyUser.company.tenantId;
    }

    res.json({
      company: companyUser.company,
      role: companyUser.role,
    });
  } catch (error) {
    console.error('Select company error:', error);
    res.status(500).json({ error: 'Failed to select company' });
  }
});

// Select tenant
router.post('/select-tenant', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { tenantId } = req.body;

    // Verify user has access to this tenant
    const tenantUser = await db.query.tenantUsers.findFirst({
      where: and(
        eq(tenantUsers.userId, req.userId!),
        eq(tenantUsers.tenantId, tenantId),
        eq(tenantUsers.isActive, true)
      ),
      with: {
        tenant: true,
      },
    });

    if (!tenantUser) {
      return res.status(403).json({ error: 'Access denied to this tenant' });
    }

    req.session.tenantId = tenantId;
    // Clear company selection when switching tenants
    req.session.companyId = undefined;

    res.json({
      tenant: tenantUser.tenant,
      role: tenantUser.role,
    });
  } catch (error) {
    console.error('Select tenant error:', error);
    res.status(500).json({ error: 'Failed to select tenant' });
  }
});

// Switch to partner context
router.post('/switch-to-partner', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    // Verify user is a partner user
    const partnerUser = await db.query.partnerUsers.findFirst({
      where: and(
        eq(partnerUsers.userId, req.userId!),
        eq(partnerUsers.isActive, true)
      ),
      with: { partner: true },
    });

    if (!partnerUser) {
      return res.status(403).json({ error: 'Not a partner user' });
    }

    req.session.partnerId = partnerUser.partnerId;
    req.session.userType = 'partner';

    res.json({
      partner: partnerUser.partner,
      role: partnerUser.role,
    });
  } catch (error) {
    console.error('Switch to partner error:', error);
    res.status(500).json({ error: 'Failed to switch to partner context' });
  }
});

// Switch back to tenant context
router.post('/switch-to-tenant', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    req.session.partnerId = undefined;
    req.session.userType = 'tenant';

    res.json({ success: true });
  } catch (error) {
    console.error('Switch to tenant error:', error);
    res.status(500).json({ error: 'Failed to switch to tenant context' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

// Change password
router.post('/change-password', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await db.query.users.findFirst({
      where: eq(users.id, req.userId!),
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.update(users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, req.userId!));

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

export default router;
