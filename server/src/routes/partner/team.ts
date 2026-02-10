import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../../db';
import { requirePartnerAdmin, AuthenticatedRequest } from '../../middleware/auth';
import { partnerUsers, users } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

const router = Router();

// List partner team members
router.get('/', requirePartnerAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const partnerId = req.partnerId!;

    const teamMembers = await db.query.partnerUsers.findMany({
      where: eq(partnerUsers.partnerId, partnerId),
      with: {
        user: true,
      },
      orderBy: desc(partnerUsers.createdAt),
    });

    // Remove sensitive data
    const sanitizedMembers = teamMembers.map(member => ({
      id: member.id,
      role: member.role,
      isActive: member.isActive,
      createdAt: member.createdAt,
      user: {
        id: member.user.id,
        email: member.user.email,
        firstName: member.user.firstName,
        lastName: member.user.lastName,
        phone: member.user.phone,
        isActive: member.user.isActive,
      },
    }));

    res.json(sanitizedMembers);
  } catch (error) {
    console.error('List team error:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// Add team member
router.post('/', requirePartnerAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const partnerId = req.partnerId!;
    const { email, firstName, lastName, phone, password, role } = req.body;

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

    // Check if already a partner user
    const existing = await db.query.partnerUsers.findFirst({
      where: and(
        eq(partnerUsers.partnerId, partnerId),
        eq(partnerUsers.userId, user.id)
      ),
    });

    if (existing) {
      return res.status(400).json({ error: 'User is already a team member' });
    }

    // Add to partner
    const [newMember] = await db.insert(partnerUsers).values({
      partnerId,
      userId: user.id,
      role: role || 'staff',
    }).returning();

    res.status(201).json({
      id: newMember.id,
      role: newMember.role,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error) {
    console.error('Add team member error:', error);
    res.status(500).json({ error: 'Failed to add team member' });
  }
});

// Update team member role
router.patch('/:id', requirePartnerAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const partnerId = req.partnerId!;
    const { role, isActive } = req.body;

    // Verify member belongs to this partner
    const member = await db.query.partnerUsers.findFirst({
      where: and(
        eq(partnerUsers.id, id),
        eq(partnerUsers.partnerId, partnerId)
      ),
    });

    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Don't allow changing own role
    if (member.userId === req.userId) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    const updateData: any = {};
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;

    const [updated] = await db.update(partnerUsers)
      .set(updateData)
      .where(eq(partnerUsers.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Update team member error:', error);
    res.status(500).json({ error: 'Failed to update team member' });
  }
});

// Remove team member
router.delete('/:id', requirePartnerAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const partnerId = req.partnerId!;

    // Verify member belongs to this partner
    const member = await db.query.partnerUsers.findFirst({
      where: and(
        eq(partnerUsers.id, id),
        eq(partnerUsers.partnerId, partnerId)
      ),
    });

    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Don't allow removing yourself
    if (member.userId === req.userId) {
      return res.status(400).json({ error: 'Cannot remove yourself' });
    }

    await db.delete(partnerUsers)
      .where(eq(partnerUsers.id, id));

    res.json({ success: true });
  } catch (error) {
    console.error('Remove team member error:', error);
    res.status(500).json({ error: 'Failed to remove team member' });
  }
});

export default router;
