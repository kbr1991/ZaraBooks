import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { users, companyUsers, companies } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Login
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

    // Set session
    req.session.userId = user.id;

    // If user has only one company, auto-select it
    if (userCompanies.length === 1) {
      req.session.companyId = userCompanies[0].companyId;
    }

    const { password: _, ...userWithoutPassword } = user;
    res.json({
      user: userWithoutPassword,
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
    const { email, password, firstName, lastName, phone } = req.body;

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

    req.session.userId = newUser.id;

    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Get current user
router.get('/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.userId!),
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

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

    const { password: _, ...userWithoutPassword } = user;
    res.json({
      user: userWithoutPassword,
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
    res.json({
      company: companyUser.company,
      role: companyUser.role,
    });
  } catch (error) {
    console.error('Select company error:', error);
    res.status(500).json({ error: 'Failed to select company' });
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
