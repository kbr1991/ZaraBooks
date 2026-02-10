import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { companyUsers, partnerUsers, tenantUsers, users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

// Extend Express Session type for multi-tenancy
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    companyId?: string;
    tenantId?: string;      // Tenant context
    partnerId?: string;     // Partner context
    userType?: 'super_admin' | 'partner' | 'tenant';  // User access type
  }
}

export interface AuthenticatedRequest extends Request {
  userId?: string;
  companyId?: string;
  tenantId?: string;
  partnerId?: string;
  userType?: string;
  companyRole?: string;
  tenantRole?: string;
  partnerRole?: string;
}

// Require basic authentication (user is logged in)
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.userId = req.session.userId;
  req.companyId = req.session.companyId;
  req.tenantId = req.session.tenantId;
  req.partnerId = req.session.partnerId;
  req.userType = req.session.userType;
  next();
}

// Require company context (existing behavior)
export function requireCompany(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!req.session?.companyId) {
    return res.status(400).json({ error: 'No company selected' });
  }
  req.userId = req.session.userId;
  req.companyId = req.session.companyId;
  req.tenantId = req.session.tenantId;
  next();
}

// Require specific company role
export function requireCompanyRole(roles: string[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.session?.userId || !req.session?.companyId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const companyUser = await db.query.companyUsers.findFirst({
      where: and(
        eq(companyUsers.userId, req.session.userId),
        eq(companyUsers.companyId, req.session.companyId),
        eq(companyUsers.isActive, true)
      ),
    });

    if (!companyUser || !roles.includes(companyUser.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    req.userId = req.session.userId;
    req.companyId = req.session.companyId;
    req.companyRole = companyUser.role;
    req.tenantId = req.session.tenantId;
    next();
  };
}

// NEW: Require tenant context
export function requireTenant(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!req.session?.tenantId) {
    return res.status(400).json({ error: 'No tenant selected' });
  }
  req.userId = req.session.userId;
  req.tenantId = req.session.tenantId;
  req.companyId = req.session.companyId;
  next();
}

// NEW: Require tenant admin role
export function requireTenantAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!req.session?.tenantId) {
    return res.status(400).json({ error: 'No tenant selected' });
  }

  db.query.tenantUsers.findFirst({
    where: and(
      eq(tenantUsers.userId, req.session.userId),
      eq(tenantUsers.tenantId, req.session.tenantId),
      eq(tenantUsers.isActive, true)
    ),
  }).then(tenantUser => {
    if (!tenantUser || tenantUser.role !== 'admin') {
      return res.status(403).json({ error: 'Tenant admin required' });
    }

    req.userId = req.session!.userId;
    req.tenantId = req.session!.tenantId;
    req.tenantRole = tenantUser.role;
    next();
  }).catch(() => {
    res.status(500).json({ error: 'Server error' });
  });
}

// NEW: Require partner context
export function requirePartner(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!req.session?.partnerId) {
    return res.status(400).json({ error: 'No partner context' });
  }

  db.query.partnerUsers.findFirst({
    where: and(
      eq(partnerUsers.userId, req.session.userId),
      eq(partnerUsers.partnerId, req.session.partnerId),
      eq(partnerUsers.isActive, true)
    ),
  }).then(pu => {
    if (!pu) {
      return res.status(403).json({ error: 'Not a partner user' });
    }

    req.userId = req.session!.userId;
    req.partnerId = req.session!.partnerId;
    req.partnerRole = pu.role;
    next();
  }).catch(() => {
    res.status(500).json({ error: 'Server error' });
  });
}

// NEW: Require partner admin role
export function requirePartnerAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!req.session?.partnerId) {
    return res.status(400).json({ error: 'No partner context' });
  }

  db.query.partnerUsers.findFirst({
    where: and(
      eq(partnerUsers.userId, req.session.userId),
      eq(partnerUsers.partnerId, req.session.partnerId),
      eq(partnerUsers.isActive, true)
    ),
  }).then(pu => {
    if (!pu || pu.role !== 'admin') {
      return res.status(403).json({ error: 'Partner admin required' });
    }

    req.userId = req.session!.userId;
    req.partnerId = req.session!.partnerId;
    req.partnerRole = pu.role;
    next();
  }).catch(() => {
    res.status(500).json({ error: 'Server error' });
  });
}

// NEW: Require super admin (ZaraBooks admin)
export function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  db.query.users.findFirst({
    where: eq(users.id, req.session.userId),
  }).then(user => {
    if (!user || user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Super admin required' });
    }

    req.userId = req.session!.userId;
    req.userType = 'super_admin';
    next();
  }).catch(() => {
    res.status(500).json({ error: 'Server error' });
  });
}
