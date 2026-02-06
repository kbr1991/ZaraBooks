import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { companyUsers } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

// Extend Express Request type
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    companyId?: string;
  }
}

export interface AuthenticatedRequest extends Request {
  userId?: string;
  companyId?: string;
  companyRole?: string;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.userId = req.session.userId;
  req.companyId = req.session.companyId;
  next();
}

export function requireCompany(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!req.session?.companyId) {
    return res.status(400).json({ error: 'No company selected' });
  }
  req.userId = req.session.userId;
  req.companyId = req.session.companyId;
  next();
}

export async function requireCompanyRole(roles: string[]) {
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
    next();
  };
}
