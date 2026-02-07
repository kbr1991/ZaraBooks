import { Router } from 'express';
import { db } from '../db';
import { salesOrders, salesOrderLines, fiscalYears, invoices, invoiceLines } from '@shared/schema';
import { eq, and, desc, asc, gte, lte } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all sales orders
router.get('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, customerId, startDate, endDate } = req.query;

    let whereConditions = [eq(salesOrders.companyId, req.companyId!)];

    if (status && status !== 'all') {
      whereConditions.push(eq(salesOrders.status, status as any));
    }
    if (customerId) {
      whereConditions.push(eq(salesOrders.customerId, customerId as string));
    }
    if (startDate) {
      whereConditions.push(gte(salesOrders.orderDate, startDate as string));
    }
    if (endDate) {
      whereConditions.push(lte(salesOrders.orderDate, endDate as string));
    }

    const allOrders = await db.query.salesOrders.findMany({
      where: and(...whereConditions),
      with: {
        customer: true,
        createdBy: true,
      },
      orderBy: [desc(salesOrders.orderDate), desc(salesOrders.createdAt)],
    });

    // Transform for frontend
    const transformed = allOrders.map(o => ({
      id: o.id,
      orderNumber: o.orderNumber,
      orderDate: o.orderDate,
      expectedDeliveryDate: o.expectedDeliveryDate,
      customerId: o.customerId,
      customerName: o.customer?.name || 'Unknown',
      subtotal: o.subtotal,
      taxAmount: o.taxAmount,
      totalAmount: o.totalAmount,
      status: o.status,
      notes: o.notes,
    }));

    res.json(transformed);
  } catch (error) {
    console.error('Get sales orders error:', error);
    res.status(500).json({ error: 'Failed to get sales orders' });
  }
});

// Get sales order by ID
router.get('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const order = await db.query.salesOrders.findFirst({
      where: and(
        eq(salesOrders.id, id),
        eq(salesOrders.companyId, req.companyId!)
      ),
      with: {
        customer: true,
        fiscalYear: true,
        quote: true,
        lines: {
          with: {
            product: true,
          },
          orderBy: asc(salesOrderLines.sortOrder),
        },
        createdBy: true,
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Sales order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('Get sales order error:', error);
    res.status(500).json({ error: 'Failed to get sales order' });
  }
});

// Create sales order
router.post('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      customerId,
      orderDate,
      expectedDeliveryDate,
      notes,
      items = [],
    } = req.body;

    if (!customerId || !orderDate) {
      return res.status(400).json({ error: 'Customer and order date are required' });
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
    const lastOrder = await db.query.salesOrders.findFirst({
      where: eq(salesOrders.companyId, req.companyId!),
      orderBy: desc(salesOrders.createdAt),
    });

    const nextNumber = lastOrder
      ? parseInt(lastOrder.orderNumber.split('-').pop() || '0', 10) + 1
      : 1;
    const orderNumber = `SO-${fiscalYear.name.replace(/\s/g, '')}-${nextNumber.toString().padStart(5, '0')}`;

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

    // Create sales order
    const [order] = await db.insert(salesOrders).values({
      companyId: req.companyId!,
      fiscalYearId: fiscalYear.id,
      orderNumber,
      orderDate,
      expectedDeliveryDate,
      customerId,
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
      await db.insert(salesOrderLines).values(
        processedLines.map((line: any) => ({
          salesOrderId: order.id,
          ...line,
        }))
      );
    }

    // Fetch complete order
    const completeOrder = await db.query.salesOrders.findFirst({
      where: eq(salesOrders.id, order.id),
      with: {
        customer: true,
        lines: true,
      },
    });

    res.status(201).json(completeOrder);
  } catch (error) {
    console.error('Create sales order error:', error);
    res.status(500).json({ error: 'Failed to create sales order' });
  }
});

// Update sales order
router.patch('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const order = await db.query.salesOrders.findFirst({
      where: and(
        eq(salesOrders.id, id),
        eq(salesOrders.companyId, req.companyId!)
      ),
    });

    if (!order) {
      return res.status(404).json({ error: 'Sales order not found' });
    }

    if (order.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft orders can be edited' });
    }

    const [updated] = await db.update(salesOrders)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(salesOrders.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Update sales order error:', error);
    res.status(500).json({ error: 'Failed to update sales order' });
  }
});

// Confirm order
router.post('/:id/confirm', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const order = await db.query.salesOrders.findFirst({
      where: and(
        eq(salesOrders.id, id),
        eq(salesOrders.companyId, req.companyId!)
      ),
    });

    if (!order) {
      return res.status(404).json({ error: 'Sales order not found' });
    }

    if (order.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft orders can be confirmed' });
    }

    const [updated] = await db.update(salesOrders)
      .set({
        status: 'confirmed',
        updatedAt: new Date(),
      })
      .where(eq(salesOrders.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Confirm order error:', error);
    res.status(500).json({ error: 'Failed to confirm order' });
  }
});

// Update status
router.post('/:id/status', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['draft', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = await db.query.salesOrders.findFirst({
      where: and(
        eq(salesOrders.id, id),
        eq(salesOrders.companyId, req.companyId!)
      ),
    });

    if (!order) {
      return res.status(404).json({ error: 'Sales order not found' });
    }

    const [updated] = await db.update(salesOrders)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(salesOrders.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// Convert to invoice
router.post('/:id/convert-to-invoice', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const order = await db.query.salesOrders.findFirst({
      where: and(
        eq(salesOrders.id, id),
        eq(salesOrders.companyId, req.companyId!)
      ),
      with: {
        lines: true,
        customer: true,
      },
    });

    if (!order) {
      return res.status(404).json({ error: 'Sales order not found' });
    }

    if (!['confirmed', 'processing', 'shipped', 'delivered'].includes(order.status)) {
      return res.status(400).json({ error: 'Order must be confirmed before converting to invoice' });
    }

    if (order.convertedToInvoiceId) {
      return res.status(400).json({ error: 'Order already converted to invoice' });
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

    // Generate invoice number
    const lastInvoice = await db.query.invoices.findFirst({
      where: eq(invoices.companyId, req.companyId!),
      orderBy: desc(invoices.createdAt),
    });

    const nextNumber = lastInvoice
      ? parseInt(lastInvoice.invoiceNumber.split('-').pop() || '0', 10) + 1
      : 1;
    const invoiceNumber = `INV-${fiscalYear.name.replace(/\s/g, '')}-${nextNumber.toString().padStart(5, '0')}`;

    const today = new Date().toISOString().split('T')[0];
    const dueDate = new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Create invoice
    const [invoice] = await db.insert(invoices).values({
      companyId: req.companyId!,
      fiscalYearId: fiscalYear.id,
      invoiceNumber,
      invoiceDate: today,
      dueDate,
      customerId: order.customerId,
      billingAddress: order.billingAddress,
      shippingAddress: order.shippingAddress,
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      cgst: order.cgst,
      sgst: order.sgst,
      igst: order.igst,
      totalAmount: order.totalAmount,
      balanceDue: order.totalAmount,
      status: 'draft',
      notes: order.notes,
      createdByUserId: req.userId,
    }).returning();

    // Copy line items
    if (order.lines.length > 0) {
      await db.insert(invoiceLines).values(
        order.lines.map((line) => ({
          invoiceId: invoice.id,
          description: line.description,
          hsnSacCode: line.hsnSacCode,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discountPercent: line.discountPercent,
          discountAmount: line.discountAmount,
          taxRate: line.taxRate,
          taxAmount: line.taxAmount,
          amount: line.amount,
          sortOrder: line.sortOrder,
        }))
      );
    }

    // Update order
    await db.update(salesOrders)
      .set({
        convertedToInvoiceId: invoice.id,
        updatedAt: new Date(),
      })
      .where(eq(salesOrders.id, id));

    res.json(invoice);
  } catch (error) {
    console.error('Convert to invoice error:', error);
    res.status(500).json({ error: 'Failed to convert order to invoice' });
  }
});

// Delete sales order (only drafts)
router.delete('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const order = await db.query.salesOrders.findFirst({
      where: and(
        eq(salesOrders.id, id),
        eq(salesOrders.companyId, req.companyId!)
      ),
    });

    if (!order) {
      return res.status(404).json({ error: 'Sales order not found' });
    }

    if (order.status !== 'draft') {
      return res.status(400).json({ error: 'Only draft orders can be deleted' });
    }

    await db.delete(salesOrderLines).where(eq(salesOrderLines.salesOrderId, id));
    await db.delete(salesOrders).where(eq(salesOrders.id, id));

    res.json({ message: 'Sales order deleted' });
  } catch (error) {
    console.error('Delete sales order error:', error);
    res.status(500).json({ error: 'Failed to delete sales order' });
  }
});

export default router;
