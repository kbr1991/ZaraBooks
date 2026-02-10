import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../../db';
import { partners, partnerUsers, users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

const router = Router();

// Generate unique referral code
function generateReferralCode(name: string): string {
  const prefix = name.replace(/[^a-zA-Z]/g, '').substring(0, 4).toUpperCase();
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${suffix}`;
}

// Partner registration
router.post('/register', async (req, res) => {
  try {
    const {
      // Partner details
      firmName,
      primaryEmail,
      primaryPhone,
      address,
      city,
      state,
      pan,
      gstin,
      // Bank details
      bankAccountName,
      bankAccountNumber,
      bankIfsc,
      // Admin user
      firstName,
      lastName,
      password,
    } = req.body;

    // Validate required fields
    if (!firmName || !primaryEmail || !firstName || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if partner email already exists
    const existingPartner = await db.query.partners.findFirst({
      where: eq(partners.primaryEmail, primaryEmail.toLowerCase()),
    });

    if (existingPartner) {
      return res.status(400).json({ error: 'Email already registered as partner' });
    }

    // Check if user email already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, primaryEmail.toLowerCase()),
    });

    // Generate slug and referral code
    const slug = firmName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now();
    const referralCode = generateReferralCode(firmName);

    // Create partner
    const [newPartner] = await db.insert(partners).values({
      name: firmName,
      slug,
      primaryEmail: primaryEmail.toLowerCase(),
      primaryPhone,
      address,
      city,
      state,
      pan,
      gstin,
      referralCode,
      bankAccountName,
      bankAccountNumber,
      bankIfsc,
      tier: 'bronze',
      commissionRate: '10.00',
      verificationStatus: 'pending',
    }).returning();

    // Create or get user
    let partnerAdmin;
    if (existingUser) {
      partnerAdmin = existingUser;
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const [newUser] = await db.insert(users).values({
        email: primaryEmail.toLowerCase(),
        password: hashedPassword,
        firstName,
        lastName: lastName || '',
        role: 'user',
        isActive: true,
      }).returning();
      partnerAdmin = newUser;
    }

    // Add user as partner admin
    await db.insert(partnerUsers).values({
      partnerId: newPartner.id,
      userId: partnerAdmin.id,
      role: 'admin',
    });

    res.status(201).json({
      message: 'Partner registration submitted successfully. Pending verification.',
      partner: {
        id: newPartner.id,
        name: newPartner.name,
        referralCode: newPartner.referralCode,
        verificationStatus: newPartner.verificationStatus,
      },
    });
  } catch (error) {
    console.error('Partner registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Check registration status
router.get('/status/:email', async (req, res) => {
  try {
    const { email } = req.params;

    const partner = await db.query.partners.findFirst({
      where: eq(partners.primaryEmail, email.toLowerCase()),
    });

    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    res.json({
      id: partner.id,
      name: partner.name,
      verificationStatus: partner.verificationStatus,
      referralCode: partner.verificationStatus === 'verified' ? partner.referralCode : null,
    });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to check status' });
  }
});

export default router;
