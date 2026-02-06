import { Router, Request, Response } from 'express';
import { db } from '../db';
import { auditLog, users } from '../../../shared/schema';
import { eq, and, desc, gte, lte, like, or, sql } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

// Middleware to check authentication
const requireAuth = (req: Request, res: Response, next: Function) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Get audit logs with filtering
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session?.currentCompanyId;
    if (!companyId) {
      return res.status(400).json({ error: 'No company selected' });
    }

    const {
      action,
      entityType,
      userId,
      startDate,
      endDate,
      search,
      page = '1',
      limit = '50',
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = Math.min(parseInt(limit as string), 100);
    const offset = (pageNum - 1) * limitNum;

    // Build conditions
    const conditions = [eq(auditLog.companyId, companyId)];

    if (action) {
      conditions.push(eq(auditLog.action, action as string));
    }

    if (entityType) {
      conditions.push(eq(auditLog.entityType, entityType as string));
    }

    if (userId) {
      conditions.push(eq(auditLog.userId, userId as string));
    }

    if (startDate) {
      conditions.push(gte(auditLog.createdAt, new Date(startDate as string)));
    }

    if (endDate) {
      const endDateTime = new Date(endDate as string);
      endDateTime.setHours(23, 59, 59, 999);
      conditions.push(lte(auditLog.createdAt, endDateTime));
    }

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLog)
      .where(and(...conditions));

    const total = Number(countResult[0]?.count || 0);

    // Get logs with user info
    const logs = await db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        oldData: auditLog.oldData,
        newData: auditLog.newData,
        ipAddress: auditLog.ipAddress,
        userAgent: auditLog.userAgent,
        createdAt: auditLog.createdAt,
        userId: auditLog.userId,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
      })
      .from(auditLog)
      .leftJoin(users, eq(auditLog.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(auditLog.createdAt))
      .limit(limitNum)
      .offset(offset);

    // Format the response
    const formattedLogs = logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      oldData: log.oldData,
      newData: log.newData,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt,
      user: log.userId
        ? {
            id: log.userId,
            firstName: log.userFirstName,
            lastName: log.userLastName,
            email: log.userEmail,
          }
        : null,
    }));

    res.json({
      data: formattedLogs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Get audit log statistics
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session?.currentCompanyId;
    if (!companyId) {
      return res.status(400).json({ error: 'No company selected' });
    }

    // Get counts by action
    const actionStats = await db
      .select({
        action: auditLog.action,
        count: sql<number>`count(*)`,
      })
      .from(auditLog)
      .where(eq(auditLog.companyId, companyId))
      .groupBy(auditLog.action);

    // Get counts by entity type
    const entityStats = await db
      .select({
        entityType: auditLog.entityType,
        count: sql<number>`count(*)`,
      })
      .from(auditLog)
      .where(eq(auditLog.companyId, companyId))
      .groupBy(auditLog.entityType);

    // Get today's activity count
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.companyId, companyId),
          gte(auditLog.createdAt, today)
        )
      );

    // Get this week's activity count
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weekCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLog)
      .where(
        and(
          eq(auditLog.companyId, companyId),
          gte(auditLog.createdAt, weekAgo)
        )
      );

    res.json({
      byAction: actionStats.map((s) => ({
        action: s.action,
        count: Number(s.count),
      })),
      byEntityType: entityStats.map((s) => ({
        entityType: s.entityType,
        count: Number(s.count),
      })),
      todayCount: Number(todayCount[0]?.count || 0),
      weekCount: Number(weekCount[0]?.count || 0),
    });
  } catch (error) {
    console.error('Error fetching audit stats:', error);
    res.status(500).json({ error: 'Failed to fetch audit statistics' });
  }
});

// Get a single audit log entry
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session?.currentCompanyId;
    if (!companyId) {
      return res.status(400).json({ error: 'No company selected' });
    }

    const { id } = req.params;

    const log = await db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        oldData: auditLog.oldData,
        newData: auditLog.newData,
        ipAddress: auditLog.ipAddress,
        userAgent: auditLog.userAgent,
        createdAt: auditLog.createdAt,
        userId: auditLog.userId,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
      })
      .from(auditLog)
      .leftJoin(users, eq(auditLog.userId, users.id))
      .where(and(eq(auditLog.id, id), eq(auditLog.companyId, companyId)))
      .limit(1);

    if (log.length === 0) {
      return res.status(404).json({ error: 'Audit log entry not found' });
    }

    const entry = log[0];
    res.json({
      id: entry.id,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      oldData: entry.oldData,
      newData: entry.newData,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      createdAt: entry.createdAt,
      user: entry.userId
        ? {
            id: entry.userId,
            firstName: entry.userFirstName,
            lastName: entry.userLastName,
            email: entry.userEmail,
          }
        : null,
    });
  } catch (error) {
    console.error('Error fetching audit log entry:', error);
    res.status(500).json({ error: 'Failed to fetch audit log entry' });
  }
});

// Export audit logs
router.get('/export/csv', requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session?.currentCompanyId;
    if (!companyId) {
      return res.status(400).json({ error: 'No company selected' });
    }

    const { startDate, endDate } = req.query;

    const conditions = [eq(auditLog.companyId, companyId)];

    if (startDate) {
      conditions.push(gte(auditLog.createdAt, new Date(startDate as string)));
    }

    if (endDate) {
      const endDateTime = new Date(endDate as string);
      endDateTime.setHours(23, 59, 59, 999);
      conditions.push(lte(auditLog.createdAt, endDateTime));
    }

    const logs = await db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        ipAddress: auditLog.ipAddress,
        createdAt: auditLog.createdAt,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
      })
      .from(auditLog)
      .leftJoin(users, eq(auditLog.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(auditLog.createdAt))
      .limit(5000);

    // Generate CSV
    const headers = ['Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID', 'IP Address'];
    const rows = logs.map((log) => [
      log.createdAt?.toISOString() || '',
      log.userEmail || 'System',
      log.action,
      log.entityType,
      log.entityId || '',
      log.ipAddress || '',
    ]);

    const csv = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-log.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    res.status(500).json({ error: 'Failed to export audit logs' });
  }
});

export default router;
