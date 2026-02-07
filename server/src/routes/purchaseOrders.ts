import { Router } from 'express';
import { db } from '../db';
import { purchaseOrders, purchaseOrderLines, fiscalYears, bills, billLines } from '@shared/schema';
import { eq, and, desc, asc, gte, lte } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all purchase orders
router.get('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, vendorId, startDate, endDate } = req.query;

    let whereConditions = [eq(purchaseOrders.companyId, req.companyId!)];

    if (status && status !== 'all') {
      whereConditions.push(eq(purchaseOrders.status, status as any));
    }
    if (vendorId) {
      whereConditions.push(eq(purchaseOrders.vendorId, vendorId as string));
    }
    if (startDate) {
      whereConditions.push(gte(purchaseOrders.orderDate, startDate as string));
    }
    if (endDate) {
      whereConditions.push(lte(purchaseOrders.orderDate, endDate as string));
    }

    const allOrders = await db.query.purchaseOrders.findMany({
      where: and(...whereConditions),
      with: {
        vendor: true,
        createdBy: true,
      },
      orderBy: [desc(purchaseOrders.orderDate), desc(purchaseOrders.createdAt)],
    });

    // Transform for frontend
    const transformed = allOrders.map(o => ({
      id: o.id,
      orderNumber: o.orderNumber,
      orderDate: o.orderDate,
      expectedDate: o.expectedDate,
      vendorId: o.vendorId,
      vendorName: o.vendor?.name || 'Unknown',
      subtotal: o.subtotal,
      taxAmount: o.taxAmount,
      totalAmount: o.totalAmount,
      status: o.status,
      notes: o.notes,
    }));

    res.json(transformed);
  } catch (error) {
    console.error('Get purchase orders error:', error);
    res.status(500).json({ error: 'Failed to get purchase orders' });
  }
});

// Get purchase order by ID
router.get('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const order = await db.query.purchaseOrders.findFirst({
      where: and(
        eq(purchaseOrders.id, id),
        eq(purchaseOrders.companyId, req.companyId!)
      ),
      with: {
        vendor: true,
        fiscalYear: true,
        lines: {
          with: {
            product: true,
          },
          orderBy: asc(purchaseOrderLines.sortOrder),
        },
        createdBy: true,
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('Get purchase order error:', error);
    res.status(500).json({ error: 'Failed to get purchase order' });
  }
});

// Create purchase order
router.post('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      vendorId,
      orderDate,
      expectedDate,
      notes,
      items = [],
    } = req.body;

    if (!vendorId || !orderDate) {
      return res.status(400).json({ error: 'Vendor and order date are required' });
    }

    // Get current fiscal year
    const fiscalYear = await db.query.fiscalYears.findFirst({
      where: and(
        eq(fiscalYears.companyId, req.companyId!),
        eq(fiscalYears.isCurrent, true)
      ),
    });

    if (!fiscalYear) {
      return res.status(400).json({ error: 'No active fiscal year found' });
    }

    // Generate order number
    const lastOrder = await db.query.purchaseOrders.findFirst({
      where: eq(purchaseOrders.companyId, req.companyId!),
      orderBy: desc(purchaseOrders.createdAt),
    });

    const nextNumber = lastOrder
      ? parseInt(lastOrder.orderNumber.split('-').pop() || '0', 10) + 1
      : 1;
    const orderNumber = `PO-${fiscalYear.name.replace(/\s/g, '')}-${nextNumber.toString().padStart(5, '0')}`;

    // Calculate totals
    let subtotal = 0;
    let totalTax = 0;
    let totalCgst = 0;
    let totalSgst = 0;

    const processedLines = items.map((item: any, index: number) => {
      const quantity = parseFloat(item.quantity || 1);
      const unitPrice = parseFloat(item.rate || item.unitPrice || 0);
      const lineAmount = quantity * unitPrice;
      const taxRate = parseFloat(item.gstRate || item.taxRate || 0);
      const taxAmount = (lineAmount * taxRate) / 100;
      const cgst = taxAmount / 2;
      const sgst = taxAmount / 2;

      subtotal += lineAmount;
      totalTax += taxAmount;
      totalCgst += cgst;
      totalSgst += sgst;

      return {
        productId: item.productId,
        description: item.description,
        hsnSacCode: item.hsnSac || item.hsnSacCode,
        quantity: quantity.toString(),
        unitPrice: unitPrice.toString(),
        taxRate: taxRate.toString(),
        taxAmount: taxAmount.toString(),
        amount: (lineAmount + taxAmount).toString(),
        sortOrder: index,
      };
    });

    const totalAmount = subtotal + totalTax;

    // Create purchase order
    const [order] = await db.insert(purchaseOrders).values({
      companyId: req.companyId!,
      fiscalYearId: fiscalYear.id,
      orderNumber,
      orderDate,
      expectedDate,
      vendorId,
      subtotal: subtotal.toString(),
      taxAmount: totalTax.toString(),
      cgst: totalCgst.toString(),
      sgst: totalSgst.toString(),
      totalAmount: totalAmount.toString(),
      status: 'draft',
      notes,
      createdByUserId: req.userId,
    }).returning();

    // Create line items
    if (processedLines.length > 0) {
      await db.insert(purchaseOrderLines).values(
        processedLines.map((line: any) => ({
          purchaseOrderId: order.id,
          ...line,
        }))
      );
    }

    // Fetch complete order
    const completeOrder = await db.query.purchaseOrders.findFirst({
      where: eq(purchaseOrders.id, order.id),
      with: {
        vendor: true,
        lines: true,
      },
    });

    res.status(201).json(completeOrder);
  } catch (error) {
    console.error('Create purchase order error:', error);
    res.status(500).json({ error: 'Failed to create purchase order' });
  }
});

// Update purchase order
router.patch('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const order = await db.query.purchaseOrders.findFirst({
      where: and(
        eq(purchaseOrders.id, id),
        eq(purchaseOrders.companyId, req.companyId!)
      ),
    });

    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    if (order.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft orders can be edited' });
    }

    const [updated] = await db.update(purchaseOrders)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrders.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Update purchase order error:', error);
    res.status(500).json({ error: 'Failed to update purchase order' });
  }
});

// Issue order (send to vendor)
router.post('/:id/issue', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const order = await db.query.purchaseOrders.findFirst({
      where: and(
        eq(purchaseOrders.id, id),
        eq(purchaseOrders.companyId, req.companyId!)
      ),
    });

    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    if (order.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft orders can be issued' });
    }

    const [updated] = await db.update(purchaseOrders)
      .set({
        status: 'issued',
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrders.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Issue order error:', error);
    res.status(500).json({ error: 'Failed to issue order' });
  }
});

// Update status
router.post('/:id/status', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['draft', 'issued', 'acknowledged', 'received', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = await db.query.purchaseOrders.findFirst({
      where: and(
        eq(purchaseOrders.id, id),
        eq(purchaseOrders.companyId, req.companyId!)
      ),
    });

    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    const [updated] = await db.update(purchaseOrders)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrders.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Convert to bill
router.post('/:id/convert-to-bill', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const order = await db.query.purchaseOrders.findFirst({
      where: and(
        eq(purchaseOrders.id, id),
        eq(purchaseOrders.companyId, req.companyId!)
      ),
      with: {
        lines: true,
        vendor: true,
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    if (!['issued', 'acknowledged', 'received'].includes(order.status)) {
      return res.status(400).json({ error: 'Order must be issued or received before converting to bill' });
    }

    if (order.convertedToBillId) {
      return res.status(400).json({ error: 'Order already converted to bill' });
    }

    // Get fiscal year
    const fiscalYear = await db.query.fiscalYears.findFirst({
      where: and(
        eq(fiscalYears.companyId, req.companyId!),
        eq(fiscalYears.isCurrent, true)
      ),
    });

    if (!fiscalYear) {
      return res.status(400).json({ error: 'No active fiscal year found' });
    }

    // Generate bill number
    const lastBill = await db.query.bills.findFirst({
      where: eq(bills.companyId, req.companyId!),
      orderBy: desc(bills.createdAt),
    });

    const nextNumber = lastBill
      ? parseInt(lastBill.billNumber.split('-').pop() || '0', 10) + 1
      : 1;
    const billNumber = `BILL-${fiscalYear.name.replace(/\s/g, '')}-${nextNumber.toString().padStart(5, '0')}`;

    const today = new Date().toISOString().split('T')[0];
    const dueDate = new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Create bill
    const [bill] = await db.insert(bills).values({
      companyId: req.companyId!,
      fiscalYearId: fiscalYear.id,
      billNumber,
      billDate: today,
      dueDate,
      vendorId: order.vendorId,
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      cgst: order.cgst,
      sgst: order.sgst,
      igst: order.igst,
      totalAmount: order.totalAmount,
      paidAmount: '0',
      balanceDue: order.totalAmount,
      status: 'pending',
      notes: order.notes,
      createdByUserId: req.userId,
    }).returning();

    // Copy line items
    if (order.lines.length > 0) {
      await db.insert(billLines).values(
        order.lines.map((line) => ({
          billId: bill.id,
          productId: line.productId,
          description: line.description,
          hsnSacCode: line.hsnSacCode,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          taxRate: line.taxRate,
          taxAmount: line.taxAmount,
          amount: line.amount,
          sortOrder: line.sortOrder,
        }))
      );
    }

    // Update order
    await db.update(purchaseOrders)
      .set({
        convertedToBillId: bill.id,
        status: 'received',
        updatedAt: new Date(),
      })
      .where(eq(purchaseOrders.id, id));

    res.json(bill);
  } catch (error) {
    console.error('Convert to bill error:', error);
    res.status(500).json({ error: 'Failed to convert order to bill' });
  }
});

// Delete purchase order (only drafts)
router.delete('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const order = await db.query.purchaseOrders.findFirst({
      where: and(
        eq(purchaseOrders.id, id),
        eq(purchaseOrders.companyId, req.companyId!)
      ),
    });

    if (!order) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    if (order.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft orders can be deleted' });
    }

    await db.delete(purchaseOrderLines).where(eq(purchaseOrderLines.purchaseOrderId, id));
    await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id));

    res.json({ message: 'Purchase order deleted' });
  } catch (error) {
    console.error('Delete purchase order error:', error);
    res.status(500).json({ error: 'Failed to delete purchase order' });
  }
});

export default router;
