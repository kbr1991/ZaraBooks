import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { users, tenants, tenantUsers } from '@shared/schema';
import { eq, ilike, or } from 'drizzle-orm';

const router = Router();

// In-memory rate limiting for signup
const signupAttempts = new Map<string, { count: number; resetAt: number }>();

// Cleanup stale entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of signupAttempts.entries()) {
    if (now > value.resetAt) {
      signupAttempts.delete(key);
    }
  }
}, 10 * 60 * 1000);

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = signupAttempts.get(ip);

  if (!entry || now > entry.resetAt) {
    signupAttempts.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 }); // 1 hour window
    return true;
  }

  if (entry.count >= 5) {
    return false;
  }

  entry.count++;
  return true;
}

// Check for duplicate tenant/user before registration (public)
router.post('/check-duplicate', async (req, res) => {
  try {
    const { billingEmail, gstNumber, userEmail } = req.body;

    const matches: Array<{ matchType: string }> = [];

    if (gstNumber) {
      const gstMatch = await db.query.tenants.findFirst({
        where: eq(tenants.gstNumber, gstNumber.toUpperCase()),
      });
      if (gstMatch) {
        matches.push({ matchType: 'GST Number already registered' });
      }
    }

    if (billingEmail) {
      const emailMatch = await db.query.tenants.findFirst({
        where: ilike(tenants.billingEmail, billingEmail),
      });
      if (emailMatch) {
        matches.push({ matchType: 'Organization email already registered' });
      }
    }

    if (userEmail) {
      const userMatch = await db.query.users.findFirst({
        where: eq(users.email, userEmail.toLowerCase()),
      });
      if (userMatch) {
        matches.push({ matchType: 'User email already registered' });
      }
    }

    res.json(matches);
  } catch (error) {
    console.error('Signup check-duplicate error:', error);
    res.status(500).json({ error: 'Failed to check for duplicates' });
  }
});

// Generate a unique slug from org name
async function generateUniqueSlug(name: string): Promise<string> {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

  const suffix = Math.random().toString(36).slice(2, 5);
  let slug = `${base}-${suffix}`;

  // Retry on collision (up to 5 times)
  for (let i = 0; i < 5; i++) {
    const existing = await db.query.tenants.findFirst({
      where: eq(tenants.slug, slug),
    });
    if (!existing) return slug;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }

  // Last resort: timestamp-based
  return `${base}-${Date.now().toString(36)}`;
}

// Register new organization + admin user (public)
router.post('/register', async (req, res) => {
  try {
    // Rate limiting
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({
        error: 'Too many signup attempts. Please try again later.',
      });
    }

    const {
      orgName,
      gstNumber,
      billingEmail,
      firstName,
      lastName,
      email,
      password,
      confirmPassword,
    } = req.body;

    // Basic validation
    if (!orgName || !email || !password || !firstName) {
      return res.status(400).json({ error: 'Organization name, email, first name, and password are required' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user email already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered. Please log in instead.' });
    }

    // Generate unique slug
    const slug = await generateUniqueSlug(orgName);

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Transaction: create tenant + user + tenant_user
    const result = await db.transaction(async (tx) => {
      // 1. Create tenant (organization)
      const [newTenant] = await tx.insert(tenants).values({
        name: orgName,
        slug,
        billingEmail: billingEmail || email.toLowerCase(),
        gstNumber: gstNumber ? gstNumber.toUpperCase() : null,
        subscriptionPlan: 'free',
        maxCompanies: 1,
        maxUsersPerCompany: 3,
      }).returning();

      // 2. Create user
      const [newUser] = await tx.insert(users).values({
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName: lastName || null,
        role: 'user',
        isActive: true,
      }).returning();

      // 3. Add user as tenant admin
      await tx.insert(tenantUsers).values({
        tenantId: newTenant.id,
        userId: newUser.id,
        role: 'admin',
      });

      return { tenant: newTenant, user: newUser };
    });

    // Set session for auto-login
    req.session.userId = result.user.id;
    req.session.tenantId = result.tenant.id;
    req.session.userType = 'tenant';

    const { password: _, ...userWithoutPassword } = result.user;
    res.status(201).json({
      user: userWithoutPassword,
      tenant: result.tenant,
    });
  } catch (error) {
    console.error('Signup registration error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

export default router;
