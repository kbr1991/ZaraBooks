import { Router } from 'express';
import { db } from '../db';
import { documentTemplates } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Get all document templates for the company
router.get('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { type } = req.query;

    let whereConditions = [eq(documentTemplates.companyId, req.companyId!)];

    if (type && type !== 'all') {
      // Filter by template type - include templates that are 'all' or match the specific type
      whereConditions.push(eq(documentTemplates.isActive, true));
    }

    const templates = await db.query.documentTemplates.findMany({
      where: and(...whereConditions),
      with: {
        createdBy: {
          columns: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [desc(documentTemplates.isDefault), desc(documentTemplates.createdAt)],
    });

    res.json(templates);
  } catch (error) {
    console.error('Get document templates error:', error);
    res.status(500).json({ error: 'Failed to get document templates' });
  }
});

// Get a single document template
router.get('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const template = await db.query.documentTemplates.findFirst({
      where: and(
        eq(documentTemplates.id, id),
        eq(documentTemplates.companyId, req.companyId!)
      ),
      with: {
        createdBy: {
          columns: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    console.error('Get document template error:', error);
    res.status(500).json({ error: 'Failed to get document template' });
  }
});

// Create a new document template
router.post('/', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { name, description, templateType, htmlContent, cssContent, isDefault } = req.body;

    if (!name || !htmlContent) {
      return res.status(400).json({ error: 'Name and HTML content are required' });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await db.update(documentTemplates)
        .set({ isDefault: false })
        .where(eq(documentTemplates.companyId, req.companyId!));
    }

    const [template] = await db.insert(documentTemplates).values({
      companyId: req.companyId!,
      name,
      description,
      templateType: templateType || 'all',
      htmlContent,
      cssContent,
      isDefault: isDefault || false,
      createdByUserId: req.userId,
    }).returning();

    res.status(201).json(template);
  } catch (error) {
    console.error('Create document template error:', error);
    res.status(500).json({ error: 'Failed to create document template' });
  }
});

// Update a document template
router.patch('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { name, description, templateType, htmlContent, cssContent, isDefault, isActive } = req.body;

    const existing = await db.query.documentTemplates.findFirst({
      where: and(
        eq(documentTemplates.id, id),
        eq(documentTemplates.companyId, req.companyId!)
      ),
    });

    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await db.update(documentTemplates)
        .set({ isDefault: false })
        .where(eq(documentTemplates.companyId, req.companyId!));
    }

    const [updated] = await db.update(documentTemplates)
      .set({
        name,
        description,
        templateType,
        htmlContent,
        cssContent,
        isDefault,
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(documentTemplates.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Update document template error:', error);
    res.status(500).json({ error: 'Failed to update document template' });
  }
});

// Delete a document template
router.delete('/:id', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const existing = await db.query.documentTemplates.findFirst({
      where: and(
        eq(documentTemplates.id, id),
        eq(documentTemplates.companyId, req.companyId!)
      ),
    });

    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    await db.delete(documentTemplates).where(eq(documentTemplates.id, id));

    res.json({ message: 'Template deleted' });
  } catch (error) {
    console.error('Delete document template error:', error);
    res.status(500).json({ error: 'Failed to delete document template' });
  }
});

// Preview a template with sample data
router.post('/preview', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { htmlContent, cssContent } = req.body;

    if (!htmlContent) {
      return res.status(400).json({ error: 'HTML content is required' });
    }

    // Sample data for preview
    const sampleData = {
      documentType: 'Invoice',
      documentNumber: 'INV-2024-00001',
      documentDate: new Date().toLocaleDateString('en-IN'),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN'),
      company: {
        name: 'Your Company Name',
        address: '123 Business Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        gstin: '27XXXXX1234X1ZX',
        pan: 'XXXXX1234X',
      },
      customer: {
        name: 'Sample Customer',
        address: '456 Customer Lane',
        city: 'Delhi',
        state: 'Delhi',
        pincode: '110001',
        gstin: '07XXXXX5678X1ZX',
      },
      items: [
        { description: 'Professional Services', hsnSac: '998311', quantity: 10, rate: 5000, amount: 50000, taxRate: 18, taxAmount: 9000 },
        { description: 'Consultation Fee', hsnSac: '998312', quantity: 5, rate: 3000, amount: 15000, taxRate: 18, taxAmount: 2700 },
      ],
      subtotal: 65000,
      cgst: 5850,
      sgst: 5850,
      igst: 0,
      totalAmount: 76700,
      notes: 'Thank you for your business!',
      terms: 'Payment due within 30 days.',
    };

    // Replace placeholders in HTML
    let renderedHtml = htmlContent;

    // Replace simple placeholders
    renderedHtml = renderedHtml.replace(/\{\{documentType\}\}/g, sampleData.documentType);
    renderedHtml = renderedHtml.replace(/\{\{documentNumber\}\}/g, sampleData.documentNumber);
    renderedHtml = renderedHtml.replace(/\{\{documentDate\}\}/g, sampleData.documentDate);
    renderedHtml = renderedHtml.replace(/\{\{dueDate\}\}/g, sampleData.dueDate);

    // Company placeholders
    renderedHtml = renderedHtml.replace(/\{\{company\.name\}\}/g, sampleData.company.name);
    renderedHtml = renderedHtml.replace(/\{\{company\.address\}\}/g, sampleData.company.address);
    renderedHtml = renderedHtml.replace(/\{\{company\.city\}\}/g, sampleData.company.city);
    renderedHtml = renderedHtml.replace(/\{\{company\.state\}\}/g, sampleData.company.state);
    renderedHtml = renderedHtml.replace(/\{\{company\.pincode\}\}/g, sampleData.company.pincode);
    renderedHtml = renderedHtml.replace(/\{\{company\.gstin\}\}/g, sampleData.company.gstin);
    renderedHtml = renderedHtml.replace(/\{\{company\.pan\}\}/g, sampleData.company.pan);

    // Customer placeholders
    renderedHtml = renderedHtml.replace(/\{\{customer\.name\}\}/g, sampleData.customer.name);
    renderedHtml = renderedHtml.replace(/\{\{customer\.address\}\}/g, sampleData.customer.address);
    renderedHtml = renderedHtml.replace(/\{\{customer\.city\}\}/g, sampleData.customer.city);
    renderedHtml = renderedHtml.replace(/\{\{customer\.state\}\}/g, sampleData.customer.state);
    renderedHtml = renderedHtml.replace(/\{\{customer\.pincode\}\}/g, sampleData.customer.pincode);
    renderedHtml = renderedHtml.replace(/\{\{customer\.gstin\}\}/g, sampleData.customer.gstin);

    // Totals
    renderedHtml = renderedHtml.replace(/\{\{subtotal\}\}/g, sampleData.subtotal.toLocaleString('en-IN'));
    renderedHtml = renderedHtml.replace(/\{\{cgst\}\}/g, sampleData.cgst.toLocaleString('en-IN'));
    renderedHtml = renderedHtml.replace(/\{\{sgst\}\}/g, sampleData.sgst.toLocaleString('en-IN'));
    renderedHtml = renderedHtml.replace(/\{\{igst\}\}/g, sampleData.igst.toLocaleString('en-IN'));
    renderedHtml = renderedHtml.replace(/\{\{totalAmount\}\}/g, sampleData.totalAmount.toLocaleString('en-IN'));
    renderedHtml = renderedHtml.replace(/\{\{notes\}\}/g, sampleData.notes);
    renderedHtml = renderedHtml.replace(/\{\{terms\}\}/g, sampleData.terms);

    // Build full HTML with CSS
    const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    ${cssContent || ''}
  </style>
</head>
<body>
  ${renderedHtml}
</body>
</html>
    `;

    res.json({ html: fullHtml, data: sampleData });
  } catch (error) {
    console.error('Preview template error:', error);
    res.status(500).json({ error: 'Failed to preview template' });
  }
});

export default router;
