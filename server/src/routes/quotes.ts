import { Router } from 'express';
import { db } from '../db';
import { quotes, quoteLines, fiscalYears, parties, invoices, invoiceLines, salesOrders, salesOrderLines } from '@shared/schema';
import { eq, and, desc, asc, gte, lte } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all quotes
router.get('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, customerId, startDate, endDate } = req.query;

    let whereConditions = [eq(quotes.companyId, req.companyId!)];

    if (status && status !== 'all') {
      whereConditions.push(eq(quotes.status, status as any));
    }
    if (customerId) {
      whereConditions.push(eq(quotes.customerId, customerId as string));
    }
    if (startDate) {
      whereConditions.push(gte(quotes.quoteDate, startDate as string));
    }
    if (endDate) {
      whereConditions.push(lte(quotes.quoteDate, endDate as string));
    }

    const allQuotes = await db.query.quotes.findMany({
      where: and(...whereConditions),
      with: {
        customer: true,
        createdBy: true,
      },
      orderBy: [desc(quotes.quoteDate), desc(quotes.createdAt)],
    });

    // Transform for frontend
    const transformed = allQuotes.map(q => ({
      id: q.id,
      quoteNumber: q.quoteNumber,
      quoteDate: q.quoteDate,
      expiryDate: q.validUntil,
      customerId: q.customerId,
      customerName: q.customer?.name || 'Unknown',
      subtotal: q.subtotal,
      taxAmount: q.taxAmount,
      totalAmount: q.totalAmount,
      status: q.status === 'expired' ? 'expired' :
              q.status === 'rejected' ? 'declined' :
              q.status,
      terms: q.terms,
    }));

    res.json(transformed);
  } catch (error) {
    console.error('Get quotes error:', error);
    res.status(500).json({ error: 'Failed to get quotes' });
  }
});

// Get quote by ID
router.get('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const quote = await db.query.quotes.findFirst({
      where: and(
        eq(quotes.id, id),
        eq(quotes.companyId, req.companyId!)
      ),
      with: {
        customer: true,
        fiscalYear: true,
        lines: {
          orderBy: asc(quoteLines.sortOrder),
        },
        createdBy: true,
      },
    });

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    res.json(quote);
  } catch (error) {
    console.error('Get quote error:', error);
    res.status(500).json({ error: 'Failed to get quote' });
  }
});

// Create quote
router.post('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      customerId,
      quoteDate,
      expiryDate,
      terms,
      notes,
      items = [],
    } = req.body;

    if (!customerId || !quoteDate) {
      return res.status(400).json({ error: 'Customer and quote date are required' });
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

    // Generate quote number
    const lastQuote = await db.query.quotes.findFirst({
      where: eq(quotes.companyId, req.companyId!),
      orderBy: desc(quotes.createdAt),
    });

    const nextNumber = lastQuote
      ? parseInt(lastQuote.quoteNumber.split('-').pop() || '0', 10) + 1
      : 1;
    const quoteNumber = `QT-${fiscalYear.name.replace(/\s/g, '')}-${nextNumber.toString().padStart(5, '0')}`;

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

    // Calculate valid until (default 30 days if not provided)
    const validUntil = expiryDate || new Date(new Date(quoteDate).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Create quote
    const [quote] = await db.insert(quotes).values({
      companyId: req.companyId!,
      fiscalYearId: fiscalYear.id,
      quoteNumber,
      quoteDate,
      validUntil,
      customerId,
      subtotal: subtotal.toString(),
      taxAmount: totalTax.toString(),
      cgst: totalCgst.toString(),
      sgst: totalSgst.toString(),
      totalAmount: totalAmount.toString(),
      status: 'draft',
      notes,
      terms,
      createdByUserId: req.userId,
    }).returning();

    // Create line items
    if (processedLines.length > 0) {
      await db.insert(quoteLines).values(
        processedLines.map((line: any) => ({
          quoteId: quote.id,
          ...line,
        }))
      );
    }

    // Fetch complete quote with relations
    const completeQuote = await db.query.quotes.findFirst({
      where: eq(quotes.id, quote.id),
      with: {
        customer: true,
        lines: true,
      },
    });

    res.status(201).json(completeQuote);
  } catch (error) {
    console.error('Create quote error:', error);
    res.status(500).json({ error: 'Failed to create quote' });
  }
});

// Update quote
router.patch('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const quote = await db.query.quotes.findFirst({
      where: and(
        eq(quotes.id, id),
        eq(quotes.companyId, req.companyId!)
      ),
    });

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    // Allow editing draft and sent quotes (not accepted/declined/converted)
    if (!['draft', 'sent'].includes(quote.status)) {
      return res.status(400).json({ error: 'Quote cannot be edited in current status' });
    }

    // If updating items, recalculate totals
    const { items, ...otherData } = updateData;

    if (items && items.length > 0) {
      // Delete existing lines and recreate
      await db.delete(quoteLines).where(eq(quoteLines.quoteId, id));

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
          quoteId: id,
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

      await db.insert(quoteLines).values(processedLines);

      // Update quote with new totals
      const totalAmount = subtotal + totalTax;
      otherData.subtotal = subtotal.toString();
      otherData.taxAmount = totalTax.toString();
      otherData.cgst = totalCgst.toString();
      otherData.sgst = totalSgst.toString();
      otherData.totalAmount = totalAmount.toString();
    }

    const [updated] = await db.update(quotes)
      .set({
        ...otherData,
        validUntil: otherData.expiryDate || otherData.validUntil,
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, id))
      .returning();

    // Fetch complete quote with relations
    const completeQuote = await db.query.quotes.findFirst({
      where: eq(quotes.id, id),
      with: {
        customer: true,
        lines: true,
      },
    });

    res.json(completeQuote);
  } catch (error) {
    console.error('Update quote error:', error);
    res.status(500).json({ error: 'Failed to update quote' });
  }
});

// Send quote
router.post('/:id/send', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const quote = await db.query.quotes.findFirst({
      where: and(
        eq(quotes.id, id),
        eq(quotes.companyId, req.companyId!)
      ),
    });

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    if (quote.status !== 'draft') {
      return res.status(400).json({ error: 'Quote has already been sent' });
    }

    const [updated] = await db.update(quotes)
      .set({
        status: 'sent',
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Send quote error:', error);
    res.status(500).json({ error: 'Failed to send quote' });
  }
});

// Accept quote
router.post('/:id/accept', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const quote = await db.query.quotes.findFirst({
      where: and(
        eq(quotes.id, id),
        eq(quotes.companyId, req.companyId!)
      ),
    });

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    if (quote.status !== 'sent') {
      return res.status(400).json({ error: 'Only sent quotes can be accepted' });
    }

    const [updated] = await db.update(quotes)
      .set({
        status: 'accepted',
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Accept quote error:', error);
    res.status(500).json({ error: 'Failed to accept quote' });
  }
});

// Decline quote
router.post('/:id/decline', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const quote = await db.query.quotes.findFirst({
      where: and(
        eq(quotes.id, id),
        eq(quotes.companyId, req.companyId!)
      ),
    });

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    const [updated] = await db.update(quotes)
      .set({
        status: 'rejected',
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Decline quote error:', error);
    res.status(500).json({ error: 'Failed to decline quote' });
  }
});

// Convert to invoice
router.post('/:id/convert-to-invoice', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const quote = await db.query.quotes.findFirst({
      where: and(
        eq(quotes.id, id),
        eq(quotes.companyId, req.companyId!)
      ),
      with: {
        lines: true,
        customer: true,
      },
    });

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    // Allow converting sent or accepted quotes to invoice
    if (!['sent', 'accepted'].includes(quote.status)) {
      return res.status(400).json({ error: 'Only sent or accepted quotes can be converted to invoice' });
    }

    if (quote.convertedToInvoiceId) {
      return res.status(400).json({ error: 'Quote already converted to invoice' });
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

    // Create invoice
    const today = new Date().toISOString().split('T')[0];
    const dueDate = new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [invoice] = await db.insert(invoices).values({
      companyId: req.companyId!,
      fiscalYearId: fiscalYear.id,
      invoiceNumber,
      invoiceDate: today,
      dueDate,
      customerId: quote.customerId,
      billingAddress: quote.billingAddress,
      shippingAddress: quote.shippingAddress,
      subtotal: quote.subtotal,
      taxAmount: quote.taxAmount,
      cgst: quote.cgst,
      sgst: quote.sgst,
      igst: quote.igst,
      totalAmount: quote.totalAmount,
      balanceDue: quote.totalAmount,
      status: 'draft',
      notes: quote.notes,
      terms: quote.terms,
      createdByUserId: req.userId,
    }).returning();

    // Copy line items
    if (quote.lines.length > 0) {
      await db.insert(invoiceLines).values(
        quote.lines.map((line) => ({
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

    // Update quote status
    await db.update(quotes)
      .set({
        status: 'converted',
        convertedToInvoiceId: invoice.id,
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, id));

    res.json(invoice);
  } catch (error) {
    console.error('Convert to invoice error:', error);
    res.status(500).json({ error: 'Failed to convert quote to invoice' });
  }
});

// Convert to sales order
router.post('/:id/convert-to-order', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { poNumber, engagementLetterRef } = req.body;

    const quote = await db.query.quotes.findFirst({
      where: and(
        eq(quotes.id, id),
        eq(quotes.companyId, req.companyId!)
      ),
      with: {
        lines: true,
      },
    });

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    // Allow converting sent or accepted quotes to sales order
    if (!['sent', 'accepted'].includes(quote.status)) {
      return res.status(400).json({ error: 'Only sent or accepted quotes can be converted to sales order' });
    }

    if (quote.convertedToOrderId) {
      return res.status(400).json({ error: 'Quote already converted to order' });
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

    // Generate order number
    const lastOrder = await db.query.salesOrders.findFirst({
      where: eq(salesOrders.companyId, req.companyId!),
      orderBy: desc(salesOrders.createdAt),
    });

    const nextNumber = lastOrder
      ? parseInt(lastOrder.orderNumber.split('-').pop() || '0', 10) + 1
      : 1;
    const orderNumber = `SO-${fiscalYear.name.replace(/\s/g, '')}-${nextNumber.toString().padStart(5, '0')}`;

    const today = new Date().toISOString().split('T')[0];

    // Create sales order with PO/Engagement Letter reference in notes
    const referenceNotes = [
      poNumber ? `Customer PO: ${poNumber}` : null,
      engagementLetterRef ? `Engagement Letter: ${engagementLetterRef}` : null,
    ].filter(Boolean).join('\n');

    const orderNotes = [referenceNotes, quote.notes].filter(Boolean).join('\n\n');

    const [order] = await db.insert(salesOrders).values({
      companyId: req.companyId!,
      fiscalYearId: fiscalYear.id,
      orderNumber,
      orderDate: today,
      customerId: quote.customerId,
      quoteId: quote.id,
      billingAddress: quote.billingAddress,
      shippingAddress: quote.shippingAddress,
      subtotal: quote.subtotal,
      taxAmount: quote.taxAmount,
      cgst: quote.cgst,
      sgst: quote.sgst,
      igst: quote.igst,
      totalAmount: quote.totalAmount,
      status: 'confirmed',
      notes: orderNotes || null,
      createdByUserId: req.userId,
    }).returning();

    // Copy line items
    if (quote.lines.length > 0) {
      await db.insert(salesOrderLines).values(
        quote.lines.map((line) => ({
          salesOrderId: order.id,
          productId: line.productId,
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

    // Update quote status
    await db.update(quotes)
      .set({
        status: 'converted',
        convertedToOrderId: order.id,
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, id));

    res.json(order);
  } catch (error) {
    console.error('Convert to order error:', error);
    res.status(500).json({ error: 'Failed to convert quote to order' });
  }
});

// Delete quote (only drafts)
router.delete('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const quote = await db.query.quotes.findFirst({
      where: and(
        eq(quotes.id, id),
        eq(quotes.companyId, req.companyId!)
      ),
    });

    if (!quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    // Allow deleting draft and sent quotes (not accepted/declined/converted)
    if (!['draft', 'sent'].includes(quote.status)) {
      return res.status(400).json({ error: 'Quote cannot be deleted in current status' });
    }

    await db.delete(quoteLines).where(eq(quoteLines.quoteId, id));
    await db.delete(quotes).where(eq(quotes.id, id));

    res.json({ message: 'Quote deleted' });
  } catch (error) {
    console.error('Delete quote error:', error);
    res.status(500).json({ error: 'Failed to delete quote' });
  }
});

export default router;
