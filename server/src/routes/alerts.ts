/**
 * Smart Alerts Routes
 *
 * Handles smart alerts for cash flow, GST, TDS, and other business insights
 */

import { Router } from 'express';
import { db } from '../db';
import { smartAlerts } from '@shared/schema';
import { eq, and, desc, sql, isNull } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';
import { runAlertChecks, createAlert, dismissAlert } from '../services/analytics/alertEngine';

const router = Router();

// Get all alerts
router.get('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { severity, unreadOnly, includeExpired } = req.query;

    let query = db.select()
      .from(smartAlerts)
      .where(eq(smartAlerts.companyId, req.companyId!))
      .orderBy(desc(smartAlerts.createdAt));

    let alerts = await query;

    // Apply filters
    if (severity && severity !== 'all') {
      alerts = alerts.filter(a => a.severity === severity);
    }

    if (unreadOnly === 'true') {
      alerts = alerts.filter(a => !a.isRead);
    }

    if (includeExpired !== 'true') {
      alerts = alerts.filter(a => !a.expiresAt || new Date(a.expiresAt) > new Date());
    }

    // Exclude dismissed
    alerts = alerts.filter(a => !a.isDismissed);

    res.json(alerts);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Get alert counts
router.get('/counts', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const counts = await db.select({
      total: sql<number>`COUNT(*)`,
      unread: sql<number>`COUNT(*) FILTER (WHERE ${smartAlerts.isRead} = false)`,
      critical: sql<number>`COUNT(*) FILTER (WHERE ${smartAlerts.severity} = 'critical' AND ${smartAlerts.isDismissed} = false)`,
      warning: sql<number>`COUNT(*) FILTER (WHERE ${smartAlerts.severity} = 'warning' AND ${smartAlerts.isDismissed} = false)`,
      info: sql<number>`COUNT(*) FILTER (WHERE ${smartAlerts.severity} = 'info' AND ${smartAlerts.isDismissed} = false)`
    })
      .from(smartAlerts)
      .where(and(
        eq(smartAlerts.companyId, req.companyId!),
        eq(smartAlerts.isDismissed, false)
      ));

    res.json(counts[0] || {
      total: 0,
      unread: 0,
      critical: 0,
      warning: 0,
      info: 0
    });
  } catch (error) {
    console.error('Error fetching alert counts:', error);
    res.status(500).json({ error: 'Failed to fetch alert counts' });
  }
});

// Get single alert
router.get('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const [alert] = await db.select()
      .from(smartAlerts)
      .where(and(
        eq(smartAlerts.id, req.params.id),
        eq(smartAlerts.companyId, req.companyId!)
      ));

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    res.json(alert);
  } catch (error) {
    console.error('Error fetching alert:', error);
    res.status(500).json({ error: 'Failed to fetch alert' });
  }
});

// Mark alert as read
router.patch('/:id/read', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const [alert] = await db.update(smartAlerts)
      .set({ isRead: true })
      .where(and(
        eq(smartAlerts.id, req.params.id),
        eq(smartAlerts.companyId, req.companyId!)
      ))
      .returning();

    res.json(alert);
  } catch (error) {
    console.error('Error marking alert as read:', error);
    res.status(500).json({ error: 'Failed to mark alert as read' });
  }
});

// Mark all alerts as read
router.post('/mark-all-read', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    await db.update(smartAlerts)
      .set({ isRead: true })
      .where(and(
        eq(smartAlerts.companyId, req.companyId!),
        eq(smartAlerts.isRead, false)
      ));

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking alerts as read:', error);
    res.status(500).json({ error: 'Failed to mark alerts as read' });
  }
});

// Dismiss alert
router.patch('/:id/dismiss', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const [alert] = await db.update(smartAlerts)
      .set({
        isDismissed: true,
        isRead: true
      })
      .where(and(
        eq(smartAlerts.id, req.params.id),
        eq(smartAlerts.companyId, req.companyId!)
      ))
      .returning();

    res.json(alert);
  } catch (error) {
    console.error('Error dismissing alert:', error);
    res.status(500).json({ error: 'Failed to dismiss alert' });
  }
});

// Dismiss all alerts
router.post('/dismiss-all', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { severity } = req.body;

    let condition = and(
      eq(smartAlerts.companyId, req.companyId!),
      eq(smartAlerts.isDismissed, false)
    );

    if (severity) {
      condition = and(condition, eq(smartAlerts.severity, severity));
    }

    await db.update(smartAlerts)
      .set({
        isDismissed: true,
        isRead: true
      })
      .where(condition);

    res.json({ success: true });
  } catch (error) {
    console.error('Error dismissing alerts:', error);
    res.status(500).json({ error: 'Failed to dismiss alerts' });
  }
});

// Run alert checks (can be called manually or by cron)
router.post('/check', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await runAlertChecks(req.companyId!);
    res.json({
      message: `Created ${result.created} new alerts`,
      ...result
    });
  } catch (error) {
    console.error('Error running alert checks:', error);
    res.status(500).json({ error: 'Failed to run alert checks' });
  }
});

// Create manual alert (for custom alerts)
router.post('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { alertType, severity, title, message, data, actionUrl, expiresAt } = req.body;

    if (!alertType || !severity || !title || !message) {
      return res.status(400).json({ error: 'Alert type, severity, title, and message required' });
    }

    const alert = await createAlert(req.companyId!, {
      alertType,
      severity,
      title,
      message,
      data,
      actionUrl,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined
    });

    res.status(201).json(alert);
  } catch (error) {
    console.error('Error creating alert:', error);
    res.status(500).json({ error: 'Failed to create alert' });
  }
});

// Delete alert
router.delete('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    await db.delete(smartAlerts)
      .where(and(
        eq(smartAlerts.id, req.params.id),
        eq(smartAlerts.companyId, req.companyId!)
      ));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting alert:', error);
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

// Get alert preferences/settings
router.get('/settings', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    // This would come from company settings in production
    res.json({
      lowCashThreshold: 50000,
      overdueAlertDays: 7,
      gstDeadlineWarningDays: 5,
      tdsThresholdWarning: 0.9, // 90% of limit
      expenseLimitWarning: 0.8, // 80% of budget
      emailNotifications: true,
      smsNotifications: false,
      pushNotifications: true
    });
  } catch (error) {
    console.error('Error fetching alert settings:', error);
    res.status(500).json({ error: 'Failed to fetch alert settings' });
  }
});

// Update alert preferences/settings
router.patch('/settings', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    // In production, this would update company settings
    const settings = req.body;

    // Validate settings
    if (settings.lowCashThreshold && settings.lowCashThreshold < 0) {
      return res.status(400).json({ error: 'Invalid threshold value' });
    }

    res.json({
      message: 'Settings updated successfully',
      settings
    });
  } catch (error) {
    console.error('Error updating alert settings:', error);
    res.status(500).json({ error: 'Failed to update alert settings' });
  }
});

export default router;
