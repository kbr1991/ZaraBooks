import { Router, Request, Response } from 'express';
import { db } from '../db';
import { chartOfAccounts, companies } from '../../../shared/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

// Middleware to check authentication
const requireAuth = (req: Request, res: Response, next: Function) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Account type mapping
const ACCOUNT_TYPE_MAP: Record<string, 'asset' | 'liability' | 'equity' | 'income' | 'expense'> = {
  'asset': 'asset',
  'assets': 'asset',
  'liability': 'liability',
  'liabilities': 'liability',
  'equity': 'equity',
  'capital': 'equity',
  'income': 'income',
  'revenue': 'income',
  'expense': 'expense',
  'expenses': 'expense',
};

// Validation schema for import
const importRowSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  accountType: z.string(),
  parentCode: z.string().optional(),
  description: z.string().optional(),
  openingBalance: z.number().optional(),
  openingBalanceType: z.enum(['debit', 'credit']).optional(),
  gstApplicable: z.boolean().optional(),
  defaultGstRate: z.number().optional(),
  hsnSacCode: z.string().optional(),
});

// Get import template
router.get('/template', requireAuth, async (_req: Request, res: Response) => {
  // Return JSON template structure that can be converted to Excel
  const template = {
    columns: [
      { key: 'code', header: 'Account Code', required: true, example: '1001' },
      { key: 'name', header: 'Account Name', required: true, example: 'Cash in Hand' },
      { key: 'accountType', header: 'Account Type', required: true, example: 'Asset', values: ['Asset', 'Liability', 'Equity', 'Income', 'Expense'] },
      { key: 'parentCode', header: 'Parent Code', required: false, example: '1000' },
      { key: 'description', header: 'Description', required: false, example: 'Cash balance' },
      { key: 'openingBalance', header: 'Opening Balance', required: false, example: 10000 },
      { key: 'openingBalanceType', header: 'Balance Type', required: false, example: 'Debit', values: ['Debit', 'Credit'] },
      { key: 'gstApplicable', header: 'GST Applicable', required: false, example: 'No', values: ['Yes', 'No'] },
      { key: 'defaultGstRate', header: 'Default GST Rate', required: false, example: 18 },
      { key: 'hsnSacCode', header: 'HSN/SAC Code', required: false, example: '9983' },
    ],
    sampleData: [
      { code: '1000', name: 'Current Assets', accountType: 'Asset', parentCode: '', description: 'Group for current assets', openingBalance: 0, openingBalanceType: '', gstApplicable: 'No', defaultGstRate: '', hsnSacCode: '' },
      { code: '1001', name: 'Cash in Hand', accountType: 'Asset', parentCode: '1000', description: 'Physical cash', openingBalance: 50000, openingBalanceType: 'Debit', gstApplicable: 'No', defaultGstRate: '', hsnSacCode: '' },
      { code: '1002', name: 'Bank Account', accountType: 'Asset', parentCode: '1000', description: 'Bank balance', openingBalance: 100000, openingBalanceType: 'Debit', gstApplicable: 'No', defaultGstRate: '', hsnSacCode: '' },
      { code: '2000', name: 'Liabilities', accountType: 'Liability', parentCode: '', description: 'Group for liabilities', openingBalance: 0, openingBalanceType: '', gstApplicable: 'No', defaultGstRate: '', hsnSacCode: '' },
      { code: '3000', name: 'Equity', accountType: 'Equity', parentCode: '', description: 'Share capital and reserves', openingBalance: 0, openingBalanceType: '', gstApplicable: 'No', defaultGstRate: '', hsnSacCode: '' },
      { code: '4000', name: 'Income', accountType: 'Income', parentCode: '', description: 'Revenue accounts', openingBalance: 0, openingBalanceType: '', gstApplicable: 'No', defaultGstRate: '', hsnSacCode: '' },
      { code: '4001', name: 'Service Revenue', accountType: 'Income', parentCode: '4000', description: 'Professional services', openingBalance: 0, openingBalanceType: '', gstApplicable: 'Yes', defaultGstRate: 18, hsnSacCode: '9983' },
      { code: '5000', name: 'Expenses', accountType: 'Expense', parentCode: '', description: 'Operating expenses', openingBalance: 0, openingBalanceType: '', gstApplicable: 'No', defaultGstRate: '', hsnSacCode: '' },
    ],
  };

  res.json(template);
});

// Parse and validate import data
router.post('/validate', requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session?.currentCompanyId;
    if (!companyId) {
      return res.status(400).json({ error: 'No company selected' });
    }

    const { data } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'No data provided' });
    }

    // Get existing accounts
    const existingAccounts = await db
      .select({ code: chartOfAccounts.code })
      .from(chartOfAccounts)
      .where(eq(chartOfAccounts.companyId, companyId));

    const existingCodes = new Set(existingAccounts.map((a) => a.code));

    const validRows: any[] = [];
    const errors: { row: number; field: string; message: string }[] = [];
    const warnings: { row: number; field: string; message: string }[] = [];

    // First pass: validate all rows
    data.forEach((row: any, index: number) => {
      const rowNum = index + 2; // Account for header row

      // Required fields
      if (!row.code) {
        errors.push({ row: rowNum, field: 'code', message: 'Account code is required' });
        return;
      }

      if (!row.name) {
        errors.push({ row: rowNum, field: 'name', message: 'Account name is required' });
        return;
      }

      if (!row.accountType) {
        errors.push({ row: rowNum, field: 'accountType', message: 'Account type is required' });
        return;
      }

      // Validate account type
      const normalizedType = row.accountType.toLowerCase().trim();
      if (!ACCOUNT_TYPE_MAP[normalizedType]) {
        errors.push({ row: rowNum, field: 'accountType', message: `Invalid account type: ${row.accountType}` });
        return;
      }

      // Check for duplicate codes in import data
      const duplicateInImport = validRows.some((r) => r.code === row.code);
      if (duplicateInImport) {
        errors.push({ row: rowNum, field: 'code', message: `Duplicate account code in import: ${row.code}` });
        return;
      }

      // Check if code exists in database
      if (existingCodes.has(row.code)) {
        warnings.push({ row: rowNum, field: 'code', message: `Account code already exists: ${row.code}. Will be skipped.` });
      }

      // Validate parent code if provided
      if (row.parentCode && row.parentCode.trim() !== '') {
        const parentExists = data.some((r: any) => r.code === row.parentCode) || existingCodes.has(row.parentCode);
        if (!parentExists) {
          errors.push({ row: rowNum, field: 'parentCode', message: `Parent account not found: ${row.parentCode}` });
          return;
        }
      }

      // Validate numeric fields
      if (row.openingBalance && isNaN(parseFloat(row.openingBalance))) {
        warnings.push({ row: rowNum, field: 'openingBalance', message: 'Opening balance should be a number' });
      }

      if (row.defaultGstRate && isNaN(parseFloat(row.defaultGstRate))) {
        warnings.push({ row: rowNum, field: 'defaultGstRate', message: 'GST rate should be a number' });
      }

      validRows.push({
        ...row,
        accountType: ACCOUNT_TYPE_MAP[normalizedType],
      });
    });

    res.json({
      totalRows: data.length,
      validRows: validRows.length,
      errorCount: errors.length,
      warningCount: warnings.length,
      errors,
      warnings,
      preview: validRows.slice(0, 10),
    });
  } catch (error) {
    console.error('Error validating import:', error);
    res.status(500).json({ error: 'Failed to validate import data' });
  }
});

// Process import
router.post('/import', requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session?.currentCompanyId;
    if (!companyId) {
      return res.status(400).json({ error: 'No company selected' });
    }

    const { data, skipExisting = true } = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'No data provided' });
    }

    // Get existing accounts
    const existingAccounts = await db
      .select()
      .from(chartOfAccounts)
      .where(eq(chartOfAccounts.companyId, companyId));

    const existingCodes = new Set(existingAccounts.map((a) => a.code));
    const codeToId = new Map(existingAccounts.map((a) => [a.code, a.id]));

    // Calculate levels and sort by parent hierarchy
    const processedData = data.map((row: any) => {
      const normalizedType = row.accountType.toLowerCase().trim();
      return {
        ...row,
        accountType: ACCOUNT_TYPE_MAP[normalizedType] || row.accountType,
      };
    });

    // Sort by hierarchy (parents first)
    const sortedData = [];
    const processed = new Set();
    const maxIterations = processedData.length * 2;
    let iterations = 0;

    while (sortedData.length < processedData.length && iterations < maxIterations) {
      iterations++;
      for (const row of processedData) {
        if (processed.has(row.code)) continue;

        // If no parent or parent already processed or parent exists in DB
        if (
          !row.parentCode ||
          row.parentCode.trim() === '' ||
          processed.has(row.parentCode) ||
          existingCodes.has(row.parentCode)
        ) {
          sortedData.push(row);
          processed.add(row.code);
        }
      }
    }

    // Import accounts
    let imported = 0;
    let skipped = 0;
    let updated = 0;
    const newCodeToId = new Map<string, string>();

    for (const row of sortedData) {
      // Skip if exists and skipExisting is true
      if (existingCodes.has(row.code) && skipExisting) {
        skipped++;
        continue;
      }

      // Determine parent ID
      let parentAccountId = null;
      if (row.parentCode && row.parentCode.trim() !== '') {
        parentAccountId = codeToId.get(row.parentCode) || newCodeToId.get(row.parentCode) || null;
      }

      // Calculate level
      let level = 1;
      if (parentAccountId) {
        const parent = existingAccounts.find((a) => a.id === parentAccountId);
        if (parent) {
          level = parent.level + 1;
        } else {
          // Check if parent was just created
          let parentCode = row.parentCode;
          while (parentCode) {
            level++;
            const parentRow = sortedData.find((r: any) => r.code === parentCode);
            parentCode = parentRow?.parentCode;
          }
        }
      }

      // Determine if this is a group account
      const hasChildren = sortedData.some((r: any) => r.parentCode === row.code);

      // Parse opening balance
      let openingBalance = '0';
      let openingBalanceType = null;
      if (row.openingBalance && !isNaN(parseFloat(row.openingBalance))) {
        openingBalance = parseFloat(row.openingBalance).toString();
        if (row.openingBalanceType) {
          openingBalanceType = row.openingBalanceType.toLowerCase().trim() as 'debit' | 'credit';
        }
      }

      // Parse GST fields
      const gstApplicable = row.gstApplicable === 'Yes' || row.gstApplicable === true;
      const defaultGstRate = row.defaultGstRate && !isNaN(parseFloat(row.defaultGstRate))
        ? parseFloat(row.defaultGstRate).toString()
        : null;

      // Insert the account
      const [newAccount] = await db
        .insert(chartOfAccounts)
        .values({
          companyId,
          code: row.code,
          name: row.name,
          description: row.description || null,
          accountType: row.accountType,
          parentAccountId,
          level,
          isGroup: hasChildren,
          openingBalance,
          openingBalanceType,
          gstApplicable,
          defaultGstRate,
          hsnSacCode: row.hsnSacCode || null,
          isActive: true,
          isSystem: false,
        })
        .returning();

      newCodeToId.set(row.code, newAccount.id);
      codeToId.set(row.code, newAccount.id);
      imported++;
    }

    res.json({
      success: true,
      imported,
      skipped,
      updated,
      total: sortedData.length,
    });
  } catch (error) {
    console.error('Error importing accounts:', error);
    res.status(500).json({ error: 'Failed to import accounts' });
  }
});

export default router;
