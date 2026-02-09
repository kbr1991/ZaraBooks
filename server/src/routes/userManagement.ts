import { Router } from 'express';
import { db } from '../db';
import { users, companyUsers, userInvitations, companies } from '@shared/schema';
import { eq, and, desc, gt, sql } from 'drizzle-orm';
import { requireAuth, requireCompany, AuthenticatedRequest } from '../middleware/auth';
import crypto from 'crypto';
import {
  sendEmail,
  getInvitationEmailHtml,
  getInvitationEmailText,
  getWelcomeEmailHtml,
  getWelcomeEmailText,
} from '../services/email';

const router = Router();

// Get all users for company
router.get('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    // Verify requester has owner or accountant role
    const requesterAccess = await db.query.companyUsers.findFirst({
      where: and(
        eq(companyUsers.companyId, req.companyId!),
        eq(companyUsers.userId, req.userId!),
        eq(companyUsers.isActive, true)
      ),
    });

    if (!requesterAccess || !['owner', 'accountant'].includes(requesterAccess.role)) {
      return res.status(403).json({ error: 'Insufficient permissions to view users' });
    }

    const companyUsersList = await db.query.companyUsers.findMany({
      where: and(
        eq(companyUsers.companyId, req.companyId!),
        eq(companyUsers.isActive, true)
      ),
      with: {
        user: true,
      },
      orderBy: desc(companyUsers.createdAt),
    });

    res.json(companyUsersList.map(cu => ({
      id: cu.id,
      userId: cu.userId,
      email: cu.user.email,
      firstName: cu.user.firstName,
      lastName: cu.user.lastName,
      role: cu.role,
      isActive: cu.isActive,
      createdAt: cu.createdAt,
    })));
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Get pending invitations
router.get('/invitations', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    // Verify requester has owner role
    const requesterAccess = await db.query.companyUsers.findFirst({
      where: and(
        eq(companyUsers.companyId, req.companyId!),
        eq(companyUsers.userId, req.userId!),
        eq(companyUsers.role, 'owner'),
        eq(companyUsers.isActive, true)
      ),
    });

    if (!requesterAccess) {
      return res.status(403).json({ error: 'Only owners can view invitations' });
    }

    const invitations = await db.query.userInvitations.findMany({
      where: and(
        eq(userInvitations.companyId, req.companyId!),
        eq(userInvitations.isActive, true),
        gt(userInvitations.expiresAt, new Date()),
        sql`${userInvitations.acceptedAt} IS NULL`
      ),
      with: {
        invitedBy: true,
      },
      orderBy: desc(userInvitations.createdAt),
    });

    res.json(invitations.map(inv => ({
      id: inv.id,
      email: inv.email,
      role: inv.role,
      invitedBy: inv.invitedBy.firstName + ' ' + (inv.invitedBy.lastName || ''),
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
    })));
  } catch (error) {
    console.error('Get invitations error:', error);
    res.status(500).json({ error: 'Failed to get invitations' });
  }
});

// Invite user
router.post('/invite', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { email, role } = req.body;

    if (!email || !role) {
      return res.status(400).json({ error: 'Email and role are required' });
    }

    // Verify requester has owner role
    const requesterAccess = await db.query.companyUsers.findFirst({
      where: and(
        eq(companyUsers.companyId, req.companyId!),
        eq(companyUsers.userId, req.userId!),
        eq(companyUsers.role, 'owner'),
        eq(companyUsers.isActive, true)
      ),
    });

    if (!requesterAccess) {
      return res.status(403).json({ error: 'Only owners can invite users' });
    }

    // Check if user already exists and has access
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (existingUser) {
      const existingAccess = await db.query.companyUsers.findFirst({
        where: and(
          eq(companyUsers.companyId, req.companyId!),
          eq(companyUsers.userId, existingUser.id)
        ),
      });

      if (existingAccess && existingAccess.isActive) {
        return res.status(400).json({ error: 'User already has access to this company' });
      }

      // Reactivate existing access or create new
      if (existingAccess) {
        await db.update(companyUsers)
          .set({ role, isActive: true, updatedAt: new Date() })
          .where(eq(companyUsers.id, existingAccess.id));
        return res.json({ message: 'User access restored', userId: existingUser.id });
      }

      // Add existing user to company
      const [cu] = await db.insert(companyUsers).values({
        companyId: req.companyId!,
        userId: existingUser.id,
        role,
        isActive: true,
      }).returning();

      return res.status(201).json({ message: 'User added to company', companyUserId: cu.id });
    }

    // Check for existing pending invitation
    const existingInvitation = await db.query.userInvitations.findFirst({
      where: and(
        eq(userInvitations.companyId, req.companyId!),
        eq(userInvitations.email, email.toLowerCase()),
        eq(userInvitations.isActive, true),
        gt(userInvitations.expiresAt, new Date()),
        sql`${userInvitations.acceptedAt} IS NULL`
      ),
    });

    if (existingInvitation) {
      return res.status(400).json({ error: 'An invitation is already pending for this email' });
    }

    // Create invitation
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    const [invitation] = await db.insert(userInvitations).values({
      companyId: req.companyId!,
      email: email.toLowerCase(),
      role,
      token,
      invitedByUserId: req.userId!,
      expiresAt,
      isActive: true,
    }).returning();

    // Get inviter and company info for email
    const [inviter, company] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, req.userId!) }),
      db.query.companies.findFirst({ where: eq(companies.id, req.companyId!) }),
    ]);

    const inviterName = inviter
      ? `${inviter.firstName} ${inviter.lastName || ''}`.trim()
      : 'A team member';
    const companyName = company?.name || 'the company';

    // Send invitation email
    const emailResult = await sendEmail({
      to: email.toLowerCase(),
      subject: `You're invited to join ${companyName} on Zara Books`,
      html: getInvitationEmailHtml({
        inviterName,
        companyName,
        role,
        inviteToken: token,
      }),
      text: getInvitationEmailText({
        inviterName,
        companyName,
        role,
        inviteToken: token,
      }),
    });

    res.status(201).json({
      message: emailResult.success
        ? 'Invitation sent successfully'
        : 'Invitation created (email delivery pending)',
      invitationId: invitation.id,
      emailSent: emailResult.success,
      // Include token for development/testing only
      ...(process.env.NODE_ENV !== 'production' && { token }),
    });
  } catch (error) {
    console.error('Invite user error:', error);
    res.status(500).json({ error: 'Failed to invite user' });
  }
});

// Accept invitation (called after user registers or logs in)
router.post('/accept-invitation', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Invitation token is required' });
    }

    const invitation = await db.query.userInvitations.findFirst({
      where: and(
        eq(userInvitations.token, token),
        eq(userInvitations.isActive, true),
        gt(userInvitations.expiresAt, new Date()),
        sql`${userInvitations.acceptedAt} IS NULL`
      ),
      with: {
        company: true,
      },
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invalid or expired invitation' });
    }

    // Verify email matches
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.userId!),
    });

    if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return res.status(403).json({ error: 'This invitation was sent to a different email' });
    }

    // Add user to company
    await db.insert(companyUsers).values({
      companyId: invitation.companyId,
      userId: req.userId!,
      role: invitation.role,
      isActive: true,
    });

    // Mark invitation as accepted
    await db.update(userInvitations)
      .set({ acceptedAt: new Date() })
      .where(eq(userInvitations.id, invitation.id));

    // Send welcome email
    const userName = `${user.firstName} ${user.lastName || ''}`.trim();
    await sendEmail({
      to: user.email,
      subject: `Welcome to ${invitation.company.name} on Zara Books`,
      html: getWelcomeEmailHtml({
        userName,
        companyName: invitation.company.name,
        role: invitation.role,
      }),
      text: getWelcomeEmailText({
        userName,
        companyName: invitation.company.name,
        role: invitation.role,
      }),
    });

    res.json({
      message: 'Invitation accepted',
      company: {
        id: invitation.company.id,
        name: invitation.company.name,
      },
      role: invitation.role,
    });
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

// Cancel invitation
router.delete('/invitations/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    // Verify requester has owner role
    const requesterAccess = await db.query.companyUsers.findFirst({
      where: and(
        eq(companyUsers.companyId, req.companyId!),
        eq(companyUsers.userId, req.userId!),
        eq(companyUsers.role, 'owner'),
        eq(companyUsers.isActive, true)
      ),
    });

    if (!requesterAccess) {
      return res.status(403).json({ error: 'Only owners can cancel invitations' });
    }

    const invitation = await db.query.userInvitations.findFirst({
      where: and(
        eq(userInvitations.id, id),
        eq(userInvitations.companyId, req.companyId!)
      ),
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    await db.update(userInvitations)
      .set({ isActive: false })
      .where(eq(userInvitations.id, id));

    res.json({ message: 'Invitation cancelled' });
  } catch (error) {
    console.error('Cancel invitation error:', error);
    res.status(500).json({ error: 'Failed to cancel invitation' });
  }
});

// Update user role
router.patch('/:userId/role', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({ error: 'Role is required' });
    }

    // Verify requester has owner role
    const requesterAccess = await db.query.companyUsers.findFirst({
      where: and(
        eq(companyUsers.companyId, req.companyId!),
        eq(companyUsers.userId, req.userId!),
        eq(companyUsers.role, 'owner'),
        eq(companyUsers.isActive, true)
      ),
    });

    if (!requesterAccess) {
      return res.status(403).json({ error: 'Only owners can change user roles' });
    }

    // Can't change own role
    if (userId === req.userId) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }

    const companyUser = await db.query.companyUsers.findFirst({
      where: and(
        eq(companyUsers.companyId, req.companyId!),
        eq(companyUsers.userId, userId)
      ),
    });

    if (!companyUser) {
      return res.status(404).json({ error: 'User not found in this company' });
    }

    const [updated] = await db.update(companyUsers)
      .set({ role, updatedAt: new Date() })
      .where(eq(companyUsers.id, companyUser.id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Remove user from company
router.delete('/:userId', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;

    // Verify requester has owner role
    const requesterAccess = await db.query.companyUsers.findFirst({
      where: and(
        eq(companyUsers.companyId, req.companyId!),
        eq(companyUsers.userId, req.userId!),
        eq(companyUsers.role, 'owner'),
        eq(companyUsers.isActive, true)
      ),
    });

    if (!requesterAccess) {
      return res.status(403).json({ error: 'Only owners can remove users' });
    }

    // Can't remove yourself
    if (userId === req.userId) {
      return res.status(400).json({ error: 'Cannot remove yourself from the company' });
    }

    const companyUser = await db.query.companyUsers.findFirst({
      where: and(
        eq(companyUsers.companyId, req.companyId!),
        eq(companyUsers.userId, userId)
      ),
    });

    if (!companyUser) {
      return res.status(404).json({ error: 'User not found in this company' });
    }

    // Soft delete
    await db.update(companyUsers)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(companyUsers.id, companyUser.id));

    res.json({ message: 'User removed from company' });
  } catch (error) {
    console.error('Remove user error:', error);
    res.status(500).json({ error: 'Failed to remove user' });
  }
});

export default router;
