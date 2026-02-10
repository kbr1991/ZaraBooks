import { Router } from 'express';
import { db } from '../../db';
import { requireSuperAdmin, AuthenticatedRequest } from '../../middleware/auth';
import { partners, partnerUsers, tenants, commissions, partnerPayouts, users } from '@shared/schema';
import { eq, and, desc, count, ilike, or, sum } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const router = Router();

// Generate unique referral code
function generateReferralCode(name: string): string {
  const prefix = name.replace(/[^a-zA-Z]/g, '').substring(0, 4).toUpperCase();
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${suffix}`;
}

// List all partners with pagination
router.get('/', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search as string;
    const status = req.query.status as string;
    const tier = req.query.tier as string;

    let whereConditions: any[] = [];

    if (search) {
      whereConditions.push(
        or(
          ilike(partners.name, `%${search}%`),
          ilike(partners.primaryEmail, `%${search}%`),
          ilike(partners.referralCode, `%${search}%`)
        )
      );
    }

    if (status === 'active') {
      whereConditions.push(eq(partners.isActive, true));
    } else if (status === 'inactive') {
      whereConditions.push(eq(partners.isActive, false));
    } else if (status === 'pending') {
      whereConditions.push(eq(partners.verificationStatus, 'pending'));
    } else if (status === 'verified') {
      whereConditions.push(eq(partners.verificationStatus, 'verified'));
    }

    if (tier) {
      whereConditions.push(eq(partners.tier, tier as any));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const partnerList = await db.query.partners.findMany({
      where: whereClause,
      orderBy: desc(partners.createdAt),
      limit,
      offset,
    });

    // Get referral count and earnings for each partner
    const enrichedPartners = await Promise.all(
      partnerList.map(async (partner) => {
        const [referralCount] = await db.select({ count: count() })
          .from(tenants)
          .where(eq(tenants.partnerId, partner.id));

        const [totalEarnings] = await db.select({
          total: sum(commissions.commissionAmount)
        })
          .from(commissions)
          .where(and(
            eq(commissions.partnerId, partner.id),
            eq(commissions.status, 'paid')
          ));

        const [pendingEarnings] = await db.select({
          total: sum(commissions.commissionAmount)
        })
          .from(commissions)
          .where(and(
            eq(commissions.partnerId, partner.id),
            eq(commissions.status, 'pending')
          ));

        return {
          ...partner,
          referralCount: referralCount.count,
          totalEarnings: totalEarnings.total || '0',
          pendingEarnings: pendingEarnings.total || '0',
        };
      })
    );

    const [totalCount] = await db.select({ count: count() })
      .from(partners)
      .where(whereClause);

    res.json({
      partners: enrichedPartners,
      pagination: {
        page,
        limit,
        total: totalCount.count,
        totalPages: Math.ceil(totalCount.count / limit),
      },
    });
  } catch (error) {
    console.error('List partners error:', error);
    res.status(500).json({ error: 'Failed to fetch partners' });
  }
});

// Get partner details
router.get('/:id', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const partner = await db.query.partners.findFirst({
      where: eq(partners.id, id),
      with: {
        partnerUsers: {
          with: {
            user: true,
          },
        },
        tenants: true,
        commissions: {
          orderBy: desc(commissions.createdAt),
          limit: 20,
        },
        payouts: {
          orderBy: desc(partnerPayouts.createdAt),
          limit: 10,
        },
      },
    });

    if (!partner) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    // Get summary stats
    const [totalEarnings] = await db.select({
      total: sum(commissions.commissionAmount)
    })
      .from(commissions)
      .where(and(
        eq(commissions.partnerId, id),
        eq(commissions.status, 'paid')
      ));

    const [pendingEarnings] = await db.select({
      total: sum(commissions.commissionAmount)
    })
      .from(commissions)
      .where(and(
        eq(commissions.partnerId, id),
        eq(commissions.status, 'pending')
      ));

    res.json({
      ...partner,
      stats: {
        totalEarnings: totalEarnings.total || '0',
        pendingEarnings: pendingEarnings.total || '0',
        totalReferrals: partner.tenants.length,
      },
    });
  } catch (error) {
    console.error('Get partner error:', error);
    res.status(500).json({ error: 'Failed to fetch partner' });
  }
});

// Create partner
router.post('/', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      name,
      primaryEmail,
      primaryPhone,
      address,
      city,
      state,
      pan,
      gstin,
      tier,
      commissionRate,
      bankAccountName,
      bankAccountNumber,
      bankIfsc,
      adminFirstName,
      adminLastName,
      adminPassword,
    } = req.body;

    // Generate unique slug and referral code
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now();
    const referralCode = generateReferralCode(name);

    // Create partner
    const [newPartner] = await db.insert(partners).values({
      name,
      slug,
      primaryEmail,
      primaryPhone,
      address,
      city,
      state,
      pan,
      gstin,
      tier: tier || 'bronze',
      commissionRate: commissionRate || '10.00',
      referralCode,
      bankAccountName,
      bankAccountNumber,
      bankIfsc,
      verificationStatus: 'pending',
    }).returning();

    // Create admin user if credentials provided
    if (adminFirstName && adminPassword) {
      // Check if user exists
      let partnerAdmin = await db.query.users.findFirst({
        where: eq(users.email, primaryEmail.toLowerCase()),
      });

      if (!partnerAdmin) {
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        const [newUser] = await db.insert(users).values({
          email: primaryEmail.toLowerCase(),
          password: hashedPassword,
          firstName: adminFirstName,
          lastName: adminLastName || '',
          role: 'user',
          isActive: true,
        }).returning();
        partnerAdmin = newUser;
      }

      // Add as partner admin
      await db.insert(partnerUsers).values({
        partnerId: newPartner.id,
        userId: partnerAdmin.id,
        role: 'admin',
      });
    }

    res.status(201).json(newPartner);
  } catch (error) {
    console.error('Create partner error:', error);
    res.status(500).json({ error: 'Failed to create partner' });
  }
});

// Update partner
router.patch('/:id', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      primaryEmail,
      primaryPhone,
      address,
      city,
      state,
      pan,
      gstin,
      tier,
      commissionRate,
      bankAccountName,
      bankAccountNumber,
      bankIfsc,
      verificationStatus,
      isActive,
    } = req.body;

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (primaryEmail !== undefined) updateData.primaryEmail = primaryEmail;
    if (primaryPhone !== undefined) updateData.primaryPhone = primaryPhone;
    if (address !== undefined) updateData.address = address;
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;
    if (pan !== undefined) updateData.pan = pan;
    if (gstin !== undefined) updateData.gstin = gstin;
    if (tier !== undefined) updateData.tier = tier;
    if (commissionRate !== undefined) updateData.commissionRate = commissionRate;
    if (bankAccountName !== undefined) updateData.bankAccountName = bankAccountName;
    if (bankAccountNumber !== undefined) updateData.bankAccountNumber = bankAccountNumber;
    if (bankIfsc !== undefined) updateData.bankIfsc = bankIfsc;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (verificationStatus !== undefined) {
      updateData.verificationStatus = verificationStatus;
      if (verificationStatus === 'verified') {
        updateData.verifiedAt = new Date();
      }
    }

    const [updated] = await db.update(partners)
      .set(updateData)
      .where(eq(partners.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Update partner error:', error);
    res.status(500).json({ error: 'Failed to update partner' });
  }
});

// Verify partner
router.post('/:id/verify', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const [updated] = await db.update(partners)
      .set({
        verificationStatus: 'verified',
        verifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(partners.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Verify partner error:', error);
    res.status(500).json({ error: 'Failed to verify partner' });
  }
});

// Reject partner
router.post('/:id/reject', requireSuperAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const [updated] = await db.update(partners)
      .set({
        verificationStatus: 'rejected',
        updatedAt: new Date(),
      })
      .where(eq(partners.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Partner not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Reject partner error:', error);
    res.status(500).json({ error: 'Failed to reject partner' });
  }
});

export default router;
