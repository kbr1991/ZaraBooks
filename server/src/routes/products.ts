import { Router } from 'express';
import { db } from '../db';
import { products } from '@shared/schema';
import { eq, and, desc, like, or } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all products
router.get('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { type, search, active } = req.query;

    let whereConditions = [eq(products.companyId, req.companyId!)];

    if (type && type !== 'all') {
      whereConditions.push(eq(products.type, type as 'goods' | 'service'));
    }

    if (active !== undefined) {
      whereConditions.push(eq(products.isActive, active === 'true'));
    }

    const allProducts = await db.query.products.findMany({
      where: and(...whereConditions),
      orderBy: [desc(products.createdAt)],
    });

    // Filter by search term if provided
    let result = allProducts;
    if (search) {
      const searchLower = (search as string).toLowerCase();
      result = allProducts.filter(p =>
        p.name.toLowerCase().includes(searchLower) ||
        p.code?.toLowerCase().includes(searchLower) ||
        p.hsnSacCode?.includes(search as string)
      );
    }

    // Transform for frontend compatibility
    const transformed = result.map(p => ({
      id: p.id,
      name: p.name,
      sku: p.code,
      type: p.type === 'goods' ? 'product' : 'service',
      description: p.description,
      sellingPrice: p.salesPrice || '0',
      costPrice: p.purchasePrice,
      hsnSacCode: p.hsnSacCode,
      gstRate: p.gstRate || '18',
      unit: p.unit,
      trackInventory: p.type === 'goods',
      currentStock: p.currentStock ? parseFloat(p.currentStock) : 0,
      reorderLevel: p.reorderLevel ? parseFloat(p.reorderLevel) : 0,
      isActive: p.isActive,
    }));

    res.json(transformed);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to get products' });
  }
});

// Get product by ID
router.get('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const product = await db.query.products.findFirst({
      where: and(
        eq(products.id, id),
        eq(products.companyId, req.companyId!)
      ),
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Failed to get product' });
  }
});

// Create product
router.post('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      name,
      sku,
      type,
      description,
      sellingPrice,
      costPrice,
      hsnSacCode,
      gstRate,
      unit,
      trackInventory,
      reorderLevel,
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Product name is required' });
    }

    const [product] = await db.insert(products).values({
      companyId: req.companyId!,
      name,
      code: sku,
      type: type === 'product' ? 'goods' : 'service',
      description,
      salesPrice: sellingPrice || '0',
      purchasePrice: costPrice,
      hsnSacCode,
      gstRate: gstRate || '18',
      unit: unit || 'nos',
      reorderLevel: trackInventory && reorderLevel ? reorderLevel : null,
      isActive: true,
    }).returning();

    res.status(201).json(product);
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Update product
router.patch('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const product = await db.query.products.findFirst({
      where: and(
        eq(products.id, id),
        eq(products.companyId, req.companyId!)
      ),
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Map frontend fields to database fields
    const dbUpdateData: any = {
      updatedAt: new Date(),
    };

    if (updateData.name !== undefined) dbUpdateData.name = updateData.name;
    if (updateData.sku !== undefined) dbUpdateData.code = updateData.sku;
    if (updateData.type !== undefined) dbUpdateData.type = updateData.type === 'product' ? 'goods' : 'service';
    if (updateData.description !== undefined) dbUpdateData.description = updateData.description;
    if (updateData.sellingPrice !== undefined) dbUpdateData.salesPrice = updateData.sellingPrice;
    if (updateData.costPrice !== undefined) dbUpdateData.purchasePrice = updateData.costPrice;
    if (updateData.hsnSacCode !== undefined) dbUpdateData.hsnSacCode = updateData.hsnSacCode;
    if (updateData.gstRate !== undefined) dbUpdateData.gstRate = updateData.gstRate;
    if (updateData.unit !== undefined) dbUpdateData.unit = updateData.unit;
    if (updateData.reorderLevel !== undefined) dbUpdateData.reorderLevel = updateData.reorderLevel;
    if (updateData.isActive !== undefined) dbUpdateData.isActive = updateData.isActive;

    const [updated] = await db.update(products)
      .set(dbUpdateData)
      .where(eq(products.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Delete product
router.delete('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const product = await db.query.products.findFirst({
      where: and(
        eq(products.id, id),
        eq(products.companyId, req.companyId!)
      ),
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    await db.delete(products).where(eq(products.id, id));

    res.json({ message: 'Product deleted' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// Update stock
router.post('/:id/adjust-stock', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { adjustment, reason } = req.body;

    const product = await db.query.products.findFirst({
      where: and(
        eq(products.id, id),
        eq(products.companyId, req.companyId!)
      ),
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const currentStock = parseFloat(product.currentStock || '0');
    const newStock = currentStock + parseFloat(adjustment);

    const [updated] = await db.update(products)
      .set({
        currentStock: newStock.toString(),
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Adjust stock error:', error);
    res.status(500).json({ error: 'Failed to adjust stock' });
  }
});

export default router;
