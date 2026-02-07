import { Router } from 'express';
import { db } from '../db';
import { costCenters } from '@shared/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all cost centers
router.get('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { active, flat } = req.query;

    let whereConditions = [eq(costCenters.companyId, req.companyId!)];

    if (active !== undefined) {
      whereConditions.push(eq(costCenters.isActive, active === 'true'));
    }

    const allCostCenters = await db.query.costCenters.findMany({
      where: and(...whereConditions),
      orderBy: [desc(costCenters.createdAt)],
    });

    // If flat=true, return flat list
    if (flat === 'true') {
      return res.json(allCostCenters);
    }

    // Build hierarchical structure
    const rootCenters = allCostCenters.filter(c => !c.parentCostCenterId);
    const buildTree = (parentId: string | null): any[] => {
      const children = allCostCenters.filter(c => c.parentCostCenterId === parentId);
      return children.map(c => ({
        ...c,
        children: buildTree(c.id),
      }));
    };

    const hierarchical = rootCenters.map(c => ({
      ...c,
      children: buildTree(c.id),
    }));

    res.json(hierarchical);
  } catch (error) {
    console.error('Get cost centers error:', error);
    res.status(500).json({ error: 'Failed to get cost centers' });
  }
});

// Get cost center by ID
router.get('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const costCenter = await db.query.costCenters.findFirst({
      where: and(
        eq(costCenters.id, id),
        eq(costCenters.companyId, req.companyId!)
      ),
    });

    if (!costCenter) {
      return res.status(404).json({ error: 'Cost center not found' });
    }

    // Get children
    const children = await db.query.costCenters.findMany({
      where: eq(costCenters.parentCostCenterId, id),
    });

    res.json({
      ...costCenter,
      children,
    });
  } catch (error) {
    console.error('Get cost center error:', error);
    res.status(500).json({ error: 'Failed to get cost center' });
  }
});

// Create cost center
router.post('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { code, name, description, parentCostCenterId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Cost center name is required' });
    }

    // Validate parent exists if provided
    if (parentCostCenterId) {
      const parent = await db.query.costCenters.findFirst({
        where: and(
          eq(costCenters.id, parentCostCenterId),
          eq(costCenters.companyId, req.companyId!)
        ),
      });

      if (!parent) {
        return res.status(400).json({ error: 'Parent cost center not found' });
      }
    }

    // Generate code if not provided
    let finalCode = code;
    if (!finalCode) {
      const lastCenter = await db.query.costCenters.findFirst({
        where: eq(costCenters.companyId, req.companyId!),
        orderBy: desc(costCenters.code),
      });

      if (lastCenter?.code) {
        const num = parseInt(lastCenter.code.replace(/\D/g, '') || '0') + 1;
        finalCode = `CC${num.toString().padStart(3, '0')}`;
      } else {
        finalCode = 'CC001';
      }
    }

    const [costCenter] = await db.insert(costCenters).values({
      companyId: req.companyId!,
      code: finalCode,
      name,
      description,
      parentCostCenterId,
      isActive: true,
    }).returning();

    res.status(201).json(costCenter);
  } catch (error) {
    console.error('Create cost center error:', error);
    res.status(500).json({ error: 'Failed to create cost center' });
  }
});

// Update cost center
router.patch('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { code, name, description, parentCostCenterId, isActive } = req.body;

    const costCenter = await db.query.costCenters.findFirst({
      where: and(
        eq(costCenters.id, id),
        eq(costCenters.companyId, req.companyId!)
      ),
    });

    if (!costCenter) {
      return res.status(404).json({ error: 'Cost center not found' });
    }

    // Prevent circular reference
    if (parentCostCenterId === id) {
      return res.status(400).json({ error: 'Cannot set self as parent' });
    }

    // Validate parent exists if changing
    if (parentCostCenterId && parentCostCenterId !== costCenter.parentCostCenterId) {
      const parent = await db.query.costCenters.findFirst({
        where: and(
          eq(costCenters.id, parentCostCenterId),
          eq(costCenters.companyId, req.companyId!)
        ),
      });

      if (!parent) {
        return res.status(400).json({ error: 'Parent cost center not found' });
      }
    }

    const updateData: any = { updatedAt: new Date() };
    if (code !== undefined) updateData.code = code;
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (parentCostCenterId !== undefined) updateData.parentCostCenterId = parentCostCenterId;
    if (isActive !== undefined) updateData.isActive = isActive;

    const [updated] = await db.update(costCenters)
      .set(updateData)
      .where(eq(costCenters.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Update cost center error:', error);
    res.status(500).json({ error: 'Failed to update cost center' });
  }
});

// Delete cost center
router.delete('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const costCenter = await db.query.costCenters.findFirst({
      where: and(
        eq(costCenters.id, id),
        eq(costCenters.companyId, req.companyId!)
      ),
    });

    if (!costCenter) {
      return res.status(404).json({ error: 'Cost center not found' });
    }

    // Check for children
    const children = await db.query.costCenters.findFirst({
      where: eq(costCenters.parentCostCenterId, id),
    });

    if (children) {
      return res.status(400).json({ error: 'Cannot delete cost center with children' });
    }

    await db.delete(costCenters).where(eq(costCenters.id, id));

    res.json({ message: 'Cost center deleted' });
  } catch (error) {
    console.error('Delete cost center error:', error);
    res.status(500).json({ error: 'Failed to delete cost center' });
  }
});

export default router;
