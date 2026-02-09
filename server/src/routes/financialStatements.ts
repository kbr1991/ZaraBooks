import { Router } from 'express';
import { db } from '../db';
import {
  journalEntries, journalEntryLines, chartOfAccounts,
  fiscalYears, scheduleIIIMappings, financialStatementRuns, companies
} from '@shared/schema';
import { eq, and, lte, sql, asc } from 'drizzle-orm';
import { requireCompany, AuthenticatedRequest } from '../middleware/auth';
import { generateBalanceSheetExcel, generatePLExcel } from '../services/excelExport';

const router = Router();

interface StatementLine {
  code: string;
  name: string;
  amount: number;
  previousAmount?: number;
  indentLevel: number;
  isBold: boolean;
  isTotal: boolean;
  hasSubSchedule: boolean;
  children?: StatementLine[];
}

// Get Balance Sheet
router.get('/balance-sheet', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { fiscalYearId, asOfDate, includeComparative } = req.query;

    // Get fiscal year
    let fy;
    if (fiscalYearId) {
      fy = await db.query.fiscalYears.findFirst({
        where: and(
          eq(fiscalYears.id, fiscalYearId as string),
          eq(fiscalYears.companyId, req.companyId!)
        ),
      });
    } else {
      fy = await db.query.fiscalYears.findFirst({
        where: and(
          eq(fiscalYears.companyId, req.companyId!),
          eq(fiscalYears.isCurrent, true)
        ),
      });
    }

    if (!fy) {
      return res.status(400).json({ error: 'No fiscal year found' });
    }

    const endDate = asOfDate as string || fy.endDate;

    // Get company
    const company = await db.query.companies.findFirst({
      where: eq(companies.id, req.companyId!),
    });

    // Get schedule III mappings for balance sheet
    const mappings = await db.query.scheduleIIIMappings.findMany({
      where: and(
        eq(scheduleIIIMappings.gaapStandard, company?.gaapStandard || 'INDIA_GAAP'),
        eq(scheduleIIIMappings.statementType, 'balance_sheet')
      ),
      orderBy: asc(scheduleIIIMappings.displayOrder),
    });

    // Get account balances
    const balances = await db
      .select({
        accountId: chartOfAccounts.id,
        accountCode: chartOfAccounts.code,
        accountName: chartOfAccounts.name,
        accountType: chartOfAccounts.accountType,
        scheduleIIIMapping: chartOfAccounts.scheduleIIIMapping,
        debit: sql<string>`COALESCE(SUM(${journalEntryLines.debitAmount}), 0)`,
        credit: sql<string>`COALESCE(SUM(${journalEntryLines.creditAmount}), 0)`,
      })
      .from(chartOfAccounts)
      .leftJoin(journalEntryLines, eq(chartOfAccounts.id, journalEntryLines.accountId))
      .leftJoin(journalEntries, and(
        eq(journalEntryLines.journalEntryId, journalEntries.id),
        eq(journalEntries.status, 'posted'),
        lte(journalEntries.entryDate, endDate)
      ))
      .where(and(
        eq(chartOfAccounts.companyId, req.companyId!),
        eq(chartOfAccounts.isActive, true),
        eq(chartOfAccounts.isGroup, false)
      ))
      .groupBy(
        chartOfAccounts.id,
        chartOfAccounts.code,
        chartOfAccounts.name,
        chartOfAccounts.accountType,
        chartOfAccounts.scheduleIIIMapping
      );

    // Calculate P&L for the period (for Reserves & Surplus)
    const plBalances = balances.filter(b =>
      b.accountType === 'income' || b.accountType === 'expense'
    );

    let netProfit = 0;
    plBalances.forEach(b => {
      if (b.accountType === 'income') {
        // Income: credit balance is positive (credit - debit)
        netProfit += parseFloat(b.credit) - parseFloat(b.debit);
      } else {
        // Expense: debit balance reduces profit (subtract debit - credit)
        netProfit -= parseFloat(b.debit) - parseFloat(b.credit);
      }
    });

    // Group balances by Schedule III mapping
    const mappingBalances = new Map<string, number>();

    balances.forEach(b => {
      if (b.scheduleIIIMapping) {
        const balance = parseFloat(b.debit) - parseFloat(b.credit);
        // For liability and equity, show credit balance as positive
        let adjustedBalance = balance;
        if (b.accountType === 'liability' || b.accountType === 'equity') {
          adjustedBalance = -balance;
        }

        const current = mappingBalances.get(b.scheduleIIIMapping) || 0;
        mappingBalances.set(b.scheduleIIIMapping, current + adjustedBalance);
      }
    });

    // Build statement structure
    const buildStatement = (items: typeof mappings): StatementLine[] => {
      return items.map(item => {
        let amount = mappingBalances.get(item.lineItemCode) || 0;

        // Handle computed totals
        if (item.isTotal) {
          // Sum up relevant items based on the total line
          if (item.lineItemCode === 'BS_ASSET_NCA_TOTAL') {
            amount = ['BS_ASSET_NCA_PPE', 'BS_ASSET_NCA_CWIP', 'BS_ASSET_NCA_INTANGIBLE',
                      'BS_ASSET_NCA_INVESTMENTS', 'BS_ASSET_NCA_DTA', 'BS_ASSET_NCA_LOANS',
                      'BS_ASSET_NCA_OTHER']
              .reduce((sum, code) => sum + (mappingBalances.get(code) || 0), 0);
          } else if (item.lineItemCode === 'BS_ASSET_CA_TOTAL') {
            amount = ['BS_ASSET_CA_INVENTORIES', 'BS_ASSET_CA_INVESTMENTS', 'BS_ASSET_CA_RECEIVABLES',
                      'BS_ASSET_CA_CASH', 'BS_ASSET_CA_LOANS', 'BS_ASSET_CA_OTHER']
              .reduce((sum, code) => sum + (mappingBalances.get(code) || 0), 0);
          } else if (item.lineItemCode === 'BS_ASSETS_TOTAL') {
            const nca = ['BS_ASSET_NCA_PPE', 'BS_ASSET_NCA_CWIP', 'BS_ASSET_NCA_INTANGIBLE',
                        'BS_ASSET_NCA_INVESTMENTS', 'BS_ASSET_NCA_DTA', 'BS_ASSET_NCA_LOANS',
                        'BS_ASSET_NCA_OTHER']
              .reduce((sum, code) => sum + (mappingBalances.get(code) || 0), 0);
            const ca = ['BS_ASSET_CA_INVENTORIES', 'BS_ASSET_CA_INVESTMENTS', 'BS_ASSET_CA_RECEIVABLES',
                        'BS_ASSET_CA_CASH', 'BS_ASSET_CA_LOANS', 'BS_ASSET_CA_OTHER']
              .reduce((sum, code) => sum + (mappingBalances.get(code) || 0), 0);
            amount = nca + ca;
          } else if (item.lineItemCode === 'BS_EQUITY_TOTAL') {
            amount = ['BS_EQUITY_SHARE_CAPITAL', 'BS_EQUITY_RESERVES', 'BS_EQUITY_OTHER']
              .reduce((sum, code) => sum + (mappingBalances.get(code) || 0), 0) + netProfit;
          } else if (item.lineItemCode === 'BS_LIAB_NCL_TOTAL') {
            amount = ['BS_LIAB_NCL_BORROWINGS', 'BS_LIAB_NCL_DTL', 'BS_LIAB_NCL_PROVISIONS',
                      'BS_LIAB_NCL_OTHER']
              .reduce((sum, code) => sum + (mappingBalances.get(code) || 0), 0);
          } else if (item.lineItemCode === 'BS_LIAB_CL_TOTAL') {
            amount = ['BS_LIAB_CL_BORROWINGS', 'BS_LIAB_CL_PAYABLES', 'BS_LIAB_CL_OTHER',
                      'BS_LIAB_CL_PROVISIONS']
              .reduce((sum, code) => sum + (mappingBalances.get(code) || 0), 0);
          } else if (item.lineItemCode === 'BS_EQUITY_LIAB_TOTAL') {
            const equity = ['BS_EQUITY_SHARE_CAPITAL', 'BS_EQUITY_RESERVES', 'BS_EQUITY_OTHER']
              .reduce((sum, code) => sum + (mappingBalances.get(code) || 0), 0) + netProfit;
            const ncl = ['BS_LIAB_NCL_BORROWINGS', 'BS_LIAB_NCL_DTL', 'BS_LIAB_NCL_PROVISIONS',
                        'BS_LIAB_NCL_OTHER']
              .reduce((sum, code) => sum + (mappingBalances.get(code) || 0), 0);
            const cl = ['BS_LIAB_CL_BORROWINGS', 'BS_LIAB_CL_PAYABLES', 'BS_LIAB_CL_OTHER',
                        'BS_LIAB_CL_PROVISIONS']
              .reduce((sum, code) => sum + (mappingBalances.get(code) || 0), 0);
            amount = equity + ncl + cl;
          }
        }

        // Add current year profit to reserves
        if (item.lineItemCode === 'BS_EQUITY_RESERVES') {
          amount += netProfit;
        }

        return {
          code: item.lineItemCode,
          name: item.lineItemName,
          amount,
          indentLevel: item.indentLevel || 0,
          isBold: item.isBold || false,
          isTotal: item.isTotal || false,
          hasSubSchedule: item.hasSubSchedule || false,
        };
      });
    };

    const statement = buildStatement(mappings);

    // Save run
    const [run] = await db.insert(financialStatementRuns).values({
      companyId: req.companyId!,
      fiscalYearId: fy.id,
      statementType: 'balance_sheet',
      asOfDate: endDate,
      generatedData: { statement, netProfit },
      generatedByUserId: req.userId!,
    }).returning();

    res.json({
      fiscalYear: fy,
      company,
      asOfDate: endDate,
      statement,
      netProfit,
      runId: run.id,
    });
  } catch (error) {
    console.error('Balance sheet error:', error);
    res.status(500).json({ error: 'Failed to generate balance sheet' });
  }
});

// Get Profit & Loss Statement
router.get('/profit-loss', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { fiscalYearId, fromDate, toDate } = req.query;

    // Get fiscal year
    let fy;
    if (fiscalYearId) {
      fy = await db.query.fiscalYears.findFirst({
        where: and(
          eq(fiscalYears.id, fiscalYearId as string),
          eq(fiscalYears.companyId, req.companyId!)
        ),
      });
    } else {
      fy = await db.query.fiscalYears.findFirst({
        where: and(
          eq(fiscalYears.companyId, req.companyId!),
          eq(fiscalYears.isCurrent, true)
        ),
      });
    }

    if (!fy) {
      return res.status(400).json({ error: 'No fiscal year found' });
    }

    const startDate = fromDate as string || fy.startDate;
    const endDate = toDate as string || fy.endDate;

    // Get company
    const company = await db.query.companies.findFirst({
      where: eq(companies.id, req.companyId!),
    });

    // Get schedule III mappings for P&L
    const mappings = await db.query.scheduleIIIMappings.findMany({
      where: and(
        eq(scheduleIIIMappings.gaapStandard, company?.gaapStandard || 'INDIA_GAAP'),
        eq(scheduleIIIMappings.statementType, 'profit_loss')
      ),
      orderBy: asc(scheduleIIIMappings.displayOrder),
    });

    // Get income and expense balances
    const balances = await db
      .select({
        accountId: chartOfAccounts.id,
        accountCode: chartOfAccounts.code,
        accountName: chartOfAccounts.name,
        accountType: chartOfAccounts.accountType,
        scheduleIIIMapping: chartOfAccounts.scheduleIIIMapping,
        debit: sql<string>`COALESCE(SUM(${journalEntryLines.debitAmount}), 0)`,
        credit: sql<string>`COALESCE(SUM(${journalEntryLines.creditAmount}), 0)`,
      })
      .from(chartOfAccounts)
      .leftJoin(journalEntryLines, eq(chartOfAccounts.id, journalEntryLines.accountId))
      .leftJoin(journalEntries, and(
        eq(journalEntryLines.journalEntryId, journalEntries.id),
        eq(journalEntries.status, 'posted'),
        sql`${journalEntries.entryDate} >= ${startDate}`,
        sql`${journalEntries.entryDate} <= ${endDate}`
      ))
      .where(and(
        eq(chartOfAccounts.companyId, req.companyId!),
        eq(chartOfAccounts.isActive, true),
        eq(chartOfAccounts.isGroup, false),
        sql`${chartOfAccounts.accountType} IN ('income', 'expense')`
      ))
      .groupBy(
        chartOfAccounts.id,
        chartOfAccounts.code,
        chartOfAccounts.name,
        chartOfAccounts.accountType,
        chartOfAccounts.scheduleIIIMapping
      );

    // Group balances by Schedule III mapping
    const mappingBalances = new Map<string, number>();

    balances.forEach(b => {
      if (b.scheduleIIIMapping) {
        // For income: credit - debit (positive is income)
        // For expense: debit - credit (positive is expense)
        let amount: number;
        if (b.accountType === 'income') {
          amount = parseFloat(b.credit) - parseFloat(b.debit);
        } else {
          amount = parseFloat(b.debit) - parseFloat(b.credit);
        }

        const current = mappingBalances.get(b.scheduleIIIMapping) || 0;
        mappingBalances.set(b.scheduleIIIMapping, current + amount);
      }
    });

    // Build statement
    const buildStatement = (items: typeof mappings): StatementLine[] => {
      return items.map(item => {
        let amount = mappingBalances.get(item.lineItemCode) || 0;

        // Handle computed totals
        if (item.isTotal || item.lineItemCode.includes('TOTAL') || item.lineItemCode === 'PL_PBT' || item.lineItemCode === 'PL_PAT') {
          if (item.lineItemCode === 'PL_TOTAL_INCOME') {
            amount = (mappingBalances.get('PL_REVENUE_OPERATIONS') || 0) +
                     (mappingBalances.get('PL_OTHER_INCOME') || 0);
          } else if (item.lineItemCode === 'PL_TOTAL_EXPENSES') {
            amount = ['PL_COST_MATERIALS', 'PL_PURCHASES', 'PL_INVENTORY_CHANGE',
                      'PL_EMPLOYEE_BENEFITS', 'PL_FINANCE_COSTS', 'PL_DEPRECIATION',
                      'PL_OTHER_EXPENSES']
              .reduce((sum, code) => sum + (mappingBalances.get(code) || 0), 0);
          } else if (item.lineItemCode === 'PL_PBT') {
            const income = (mappingBalances.get('PL_REVENUE_OPERATIONS') || 0) +
                          (mappingBalances.get('PL_OTHER_INCOME') || 0);
            const expenses = ['PL_COST_MATERIALS', 'PL_PURCHASES', 'PL_INVENTORY_CHANGE',
                             'PL_EMPLOYEE_BENEFITS', 'PL_FINANCE_COSTS', 'PL_DEPRECIATION',
                             'PL_OTHER_EXPENSES']
              .reduce((sum, code) => sum + (mappingBalances.get(code) || 0), 0);
            amount = income - expenses;
          } else if (item.lineItemCode === 'PL_PAT') {
            const income = (mappingBalances.get('PL_REVENUE_OPERATIONS') || 0) +
                          (mappingBalances.get('PL_OTHER_INCOME') || 0);
            const expenses = ['PL_COST_MATERIALS', 'PL_PURCHASES', 'PL_INVENTORY_CHANGE',
                             'PL_EMPLOYEE_BENEFITS', 'PL_FINANCE_COSTS', 'PL_DEPRECIATION',
                             'PL_OTHER_EXPENSES', 'PL_TAX_EXPENSE']
              .reduce((sum, code) => sum + (mappingBalances.get(code) || 0), 0);
            amount = income - expenses;
          }
        }

        return {
          code: item.lineItemCode,
          name: item.lineItemName,
          amount,
          indentLevel: item.indentLevel || 0,
          isBold: item.isBold || false,
          isTotal: item.isTotal || false,
          hasSubSchedule: item.hasSubSchedule || false,
        };
      });
    };

    const statement = buildStatement(mappings);
    const netProfit = statement.find(s => s.code === 'PL_PAT')?.amount || 0;

    // Save run
    const [run] = await db.insert(financialStatementRuns).values({
      companyId: req.companyId!,
      fiscalYearId: fy.id,
      statementType: 'profit_loss',
      asOfDate: endDate,
      generatedData: { statement, fromDate: startDate, toDate: endDate },
      generatedByUserId: req.userId!,
    }).returning();

    res.json({
      fiscalYear: fy,
      company,
      fromDate: startDate,
      toDate: endDate,
      statement,
      netProfit,
      runId: run.id,
    });
  } catch (error) {
    console.error('P&L error:', error);
    res.status(500).json({ error: 'Failed to generate P&L statement' });
  }
});

// Export to Excel
router.get('/export/:runId', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { runId } = req.params;

    const run = await db.query.financialStatementRuns.findFirst({
      where: and(
        eq(financialStatementRuns.id, runId),
        eq(financialStatementRuns.companyId, req.companyId!)
      ),
    });

    if (!run) {
      return res.status(404).json({ error: 'Statement run not found' });
    }

    const company = await db.query.companies.findFirst({
      where: eq(companies.id, req.companyId!),
    });

    const fy = await db.query.fiscalYears.findFirst({
      where: eq(fiscalYears.id, run.fiscalYearId),
    });

    let buffer: Buffer;
    let filename: string;

    if (run.statementType === 'balance_sheet') {
      buffer = await generateBalanceSheetExcel(company!, fy!, run.generatedData as any);
      filename = `Balance_Sheet_${company?.name}_${run.asOfDate}.xlsx`;
    } else if (run.statementType === 'profit_loss') {
      buffer = await generatePLExcel(company!, fy!, run.generatedData as any);
      filename = `Profit_Loss_${company?.name}_${fy?.name}.xlsx`;
    } else {
      return res.status(400).json({ error: 'Export not supported for this statement type' });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export statement' });
  }
});

// Get Cash Flow Statement (Indirect Method)
router.get('/cash-flow', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { fiscalYearId, fromDate, toDate } = req.query;

    // Get fiscal year
    let fy;
    if (fiscalYearId) {
      fy = await db.query.fiscalYears.findFirst({
        where: and(
          eq(fiscalYears.id, fiscalYearId as string),
          eq(fiscalYears.companyId, req.companyId!)
        ),
      });
    } else {
      fy = await db.query.fiscalYears.findFirst({
        where: and(
          eq(fiscalYears.companyId, req.companyId!),
          eq(fiscalYears.isCurrent, true)
        ),
      });
    }

    if (!fy) {
      return res.status(400).json({ error: 'No fiscal year found' });
    }

    const startDate = fromDate as string || fy.startDate;
    const endDate = toDate as string || fy.endDate;

    // Get company
    const company = await db.query.companies.findFirst({
      where: eq(companies.id, req.companyId!),
    });

    // Get all account balances for the period
    const periodBalances = await db
      .select({
        accountId: chartOfAccounts.id,
        accountCode: chartOfAccounts.code,
        accountName: chartOfAccounts.name,
        accountType: chartOfAccounts.accountType,
        scheduleIIIMapping: chartOfAccounts.scheduleIIIMapping,
        debit: sql<string>`COALESCE(SUM(${journalEntryLines.debitAmount}), 0)`,
        credit: sql<string>`COALESCE(SUM(${journalEntryLines.creditAmount}), 0)`,
      })
      .from(chartOfAccounts)
      .leftJoin(journalEntryLines, eq(chartOfAccounts.id, journalEntryLines.accountId))
      .leftJoin(journalEntries, and(
        eq(journalEntryLines.journalEntryId, journalEntries.id),
        eq(journalEntries.status, 'posted'),
        sql`${journalEntries.entryDate} >= ${startDate}`,
        sql`${journalEntries.entryDate} <= ${endDate}`
      ))
      .where(and(
        eq(chartOfAccounts.companyId, req.companyId!),
        eq(chartOfAccounts.isActive, true),
        eq(chartOfAccounts.isGroup, false)
      ))
      .groupBy(
        chartOfAccounts.id,
        chartOfAccounts.code,
        chartOfAccounts.name,
        chartOfAccounts.accountType,
        chartOfAccounts.scheduleIIIMapping
      );

    // Get opening balances (up to start date - 1 day)
    const openingBalances = await db
      .select({
        accountId: chartOfAccounts.id,
        accountCode: chartOfAccounts.code,
        accountName: chartOfAccounts.name,
        accountType: chartOfAccounts.accountType,
        scheduleIIIMapping: chartOfAccounts.scheduleIIIMapping,
        debit: sql<string>`COALESCE(SUM(${journalEntryLines.debitAmount}), 0)`,
        credit: sql<string>`COALESCE(SUM(${journalEntryLines.creditAmount}), 0)`,
      })
      .from(chartOfAccounts)
      .leftJoin(journalEntryLines, eq(chartOfAccounts.id, journalEntryLines.accountId))
      .leftJoin(journalEntries, and(
        eq(journalEntryLines.journalEntryId, journalEntries.id),
        eq(journalEntries.status, 'posted'),
        sql`${journalEntries.entryDate} < ${startDate}`
      ))
      .where(and(
        eq(chartOfAccounts.companyId, req.companyId!),
        eq(chartOfAccounts.isActive, true),
        eq(chartOfAccounts.isGroup, false)
      ))
      .groupBy(
        chartOfAccounts.id,
        chartOfAccounts.code,
        chartOfAccounts.name,
        chartOfAccounts.accountType,
        chartOfAccounts.scheduleIIIMapping
      );

    // Calculate opening and closing balances for each account
    const openingMap = new Map<string, number>();
    openingBalances.forEach(b => {
      const balance = b.accountType === 'asset' || b.accountType === 'expense'
        ? parseFloat(b.debit) - parseFloat(b.credit)
        : parseFloat(b.credit) - parseFloat(b.debit);
      openingMap.set(b.accountId, balance);
    });

    // Calculate net profit
    let netProfit = 0;
    periodBalances.filter(b => b.accountType === 'income' || b.accountType === 'expense').forEach(b => {
      const balance = parseFloat(b.credit) - parseFloat(b.debit);
      if (b.accountType === 'income') {
        netProfit += balance;
      } else {
        netProfit -= (parseFloat(b.debit) - parseFloat(b.credit));
      }
    });

    // Categorize changes for cash flow
    let depreciation = 0;
    let receivablesChange = 0;
    let inventoryChange = 0;
    let payablesChange = 0;
    let otherCurrentAssetsChange = 0;
    let otherCurrentLiabilitiesChange = 0;
    let fixedAssetsChange = 0;
    let investmentsChange = 0;
    let borrowingsChange = 0;
    let equityChange = 0;

    periodBalances.forEach(b => {
      const periodChange = parseFloat(b.debit) - parseFloat(b.credit);
      const mapping = b.scheduleIIIMapping || '';
      const name = b.accountName.toLowerCase();

      // Depreciation (non-cash expense - add back)
      if (name.includes('depreciation') || name.includes('amortization')) {
        depreciation += Math.abs(periodChange);
      }
      // Trade receivables
      else if (mapping.includes('RECEIVABLE') || name.includes('receivable') || name.includes('debtor')) {
        receivablesChange += periodChange;
      }
      // Inventories
      else if (mapping.includes('INVENTOR') || name.includes('inventory') || name.includes('stock')) {
        inventoryChange += periodChange;
      }
      // Trade payables
      else if (mapping.includes('PAYABLE') || name.includes('payable') || name.includes('creditor')) {
        payablesChange += -periodChange; // Credit increase = positive for cash
      }
      // Fixed assets (PPE, Intangibles)
      else if (mapping.includes('PPE') || mapping.includes('INTANGIBLE') ||
               name.includes('plant') || name.includes('machinery') ||
               name.includes('furniture') || name.includes('vehicle') ||
               name.includes('building') || name.includes('land')) {
        fixedAssetsChange += periodChange;
      }
      // Investments
      else if (mapping.includes('INVESTMENT') || name.includes('investment')) {
        investmentsChange += periodChange;
      }
      // Borrowings
      else if (mapping.includes('BORROWING') || name.includes('loan') || name.includes('borrowing')) {
        borrowingsChange += -periodChange;
      }
      // Equity changes
      else if (b.accountType === 'equity') {
        equityChange += -periodChange;
      }
      // Other current assets
      else if (b.accountType === 'asset' && !mapping.includes('CASH') && !mapping.includes('BANK')) {
        if (mapping.includes('CA_') || name.includes('advance') || name.includes('prepaid')) {
          otherCurrentAssetsChange += periodChange;
        }
      }
      // Other current liabilities
      else if (b.accountType === 'liability') {
        if (mapping.includes('CL_') || name.includes('provision') || name.includes('accrued')) {
          otherCurrentLiabilitiesChange += -periodChange;
        }
      }
    });

    // Get cash/bank balances
    let openingCash = 0;
    let closingCash = 0;

    openingBalances
      .filter(b => b.scheduleIIIMapping?.includes('CASH') ||
                   b.accountName.toLowerCase().includes('cash') ||
                   b.accountName.toLowerCase().includes('bank'))
      .forEach(b => {
        openingCash += parseFloat(b.debit) - parseFloat(b.credit);
      });

    periodBalances
      .filter(b => b.scheduleIIIMapping?.includes('CASH') ||
                   b.accountName.toLowerCase().includes('cash') ||
                   b.accountName.toLowerCase().includes('bank'))
      .forEach(b => {
        const opening = openingMap.get(b.accountId) || 0;
        closingCash += opening + parseFloat(b.debit) - parseFloat(b.credit);
      });

    // Build Cash Flow Statement (Indirect Method)
    const operatingActivities: StatementLine[] = [
      { code: 'CFO_HEADER', name: 'A. Cash Flow from Operating Activities', amount: 0, indentLevel: 0, isBold: true, isTotal: false, hasSubSchedule: false },
      { code: 'CFO_NET_PROFIT', name: 'Net Profit Before Tax', amount: netProfit, indentLevel: 1, isBold: false, isTotal: false, hasSubSchedule: false },
      { code: 'CFO_ADJ_HEADER', name: 'Adjustments for:', amount: 0, indentLevel: 1, isBold: true, isTotal: false, hasSubSchedule: false },
      { code: 'CFO_DEPRECIATION', name: 'Depreciation and Amortization', amount: depreciation, indentLevel: 2, isBold: false, isTotal: false, hasSubSchedule: false },
      { code: 'CFO_WC_HEADER', name: 'Working Capital Changes:', amount: 0, indentLevel: 1, isBold: true, isTotal: false, hasSubSchedule: false },
      { code: 'CFO_RECEIVABLES', name: '(Increase)/Decrease in Trade Receivables', amount: -receivablesChange, indentLevel: 2, isBold: false, isTotal: false, hasSubSchedule: false },
      { code: 'CFO_INVENTORY', name: '(Increase)/Decrease in Inventories', amount: -inventoryChange, indentLevel: 2, isBold: false, isTotal: false, hasSubSchedule: false },
      { code: 'CFO_OTHER_CA', name: '(Increase)/Decrease in Other Current Assets', amount: -otherCurrentAssetsChange, indentLevel: 2, isBold: false, isTotal: false, hasSubSchedule: false },
      { code: 'CFO_PAYABLES', name: 'Increase/(Decrease) in Trade Payables', amount: payablesChange, indentLevel: 2, isBold: false, isTotal: false, hasSubSchedule: false },
      { code: 'CFO_OTHER_CL', name: 'Increase/(Decrease) in Other Current Liabilities', amount: otherCurrentLiabilitiesChange, indentLevel: 2, isBold: false, isTotal: false, hasSubSchedule: false },
    ];

    const netCashFromOperating = netProfit + depreciation - receivablesChange - inventoryChange -
                                  otherCurrentAssetsChange + payablesChange + otherCurrentLiabilitiesChange;

    operatingActivities.push({
      code: 'CFO_TOTAL',
      name: 'Net Cash from Operating Activities (A)',
      amount: netCashFromOperating,
      indentLevel: 0,
      isBold: true,
      isTotal: true,
      hasSubSchedule: false,
    });

    const investingActivities: StatementLine[] = [
      { code: 'CFI_HEADER', name: 'B. Cash Flow from Investing Activities', amount: 0, indentLevel: 0, isBold: true, isTotal: false, hasSubSchedule: false },
      { code: 'CFI_FIXED_ASSETS', name: 'Purchase of Property, Plant & Equipment', amount: -fixedAssetsChange, indentLevel: 1, isBold: false, isTotal: false, hasSubSchedule: false },
      { code: 'CFI_INVESTMENTS', name: '(Purchase)/Sale of Investments', amount: -investmentsChange, indentLevel: 1, isBold: false, isTotal: false, hasSubSchedule: false },
    ];

    const netCashFromInvesting = -fixedAssetsChange - investmentsChange;

    investingActivities.push({
      code: 'CFI_TOTAL',
      name: 'Net Cash from Investing Activities (B)',
      amount: netCashFromInvesting,
      indentLevel: 0,
      isBold: true,
      isTotal: true,
      hasSubSchedule: false,
    });

    const financingActivities: StatementLine[] = [
      { code: 'CFF_HEADER', name: 'C. Cash Flow from Financing Activities', amount: 0, indentLevel: 0, isBold: true, isTotal: false, hasSubSchedule: false },
      { code: 'CFF_BORROWINGS', name: 'Proceeds/(Repayment) of Borrowings', amount: borrowingsChange, indentLevel: 1, isBold: false, isTotal: false, hasSubSchedule: false },
      { code: 'CFF_EQUITY', name: 'Proceeds from Issue of Equity', amount: equityChange, indentLevel: 1, isBold: false, isTotal: false, hasSubSchedule: false },
    ];

    const netCashFromFinancing = borrowingsChange + equityChange;

    financingActivities.push({
      code: 'CFF_TOTAL',
      name: 'Net Cash from Financing Activities (C)',
      amount: netCashFromFinancing,
      indentLevel: 0,
      isBold: true,
      isTotal: true,
      hasSubSchedule: false,
    });

    const netIncrease = netCashFromOperating + netCashFromInvesting + netCashFromFinancing;

    const summary: StatementLine[] = [
      { code: 'CF_NET_INCREASE', name: 'Net Increase/(Decrease) in Cash (A+B+C)', amount: netIncrease, indentLevel: 0, isBold: true, isTotal: true, hasSubSchedule: false },
      { code: 'CF_OPENING', name: 'Cash and Cash Equivalents at Beginning', amount: openingCash, indentLevel: 0, isBold: false, isTotal: false, hasSubSchedule: false },
      { code: 'CF_CLOSING', name: 'Cash and Cash Equivalents at End', amount: openingCash + netIncrease, indentLevel: 0, isBold: true, isTotal: true, hasSubSchedule: false },
    ];

    const statement = [...operatingActivities, ...investingActivities, ...financingActivities, ...summary];

    // Save run
    const [run] = await db.insert(financialStatementRuns).values({
      companyId: req.companyId!,
      fiscalYearId: fy.id,
      statementType: 'cash_flow',
      asOfDate: endDate,
      generatedData: {
        statement,
        fromDate: startDate,
        toDate: endDate,
        netCashFromOperating,
        netCashFromInvesting,
        netCashFromFinancing,
        netIncrease,
        openingCash,
        closingCash: openingCash + netIncrease,
      },
      generatedByUserId: req.userId!,
    }).returning();

    res.json({
      fiscalYear: fy,
      company,
      fromDate: startDate,
      toDate: endDate,
      statement,
      summary: {
        netCashFromOperating,
        netCashFromInvesting,
        netCashFromFinancing,
        netIncrease,
        openingCash,
        closingCash: openingCash + netIncrease,
      },
      runId: run.id,
    });
  } catch (error) {
    console.error('Cash flow error:', error);
    res.status(500).json({ error: 'Failed to generate cash flow statement' });
  }
});

// Get statement history
router.get('/history', requireCompany, async (req: AuthenticatedRequest, res) => {
  try {
    const { statementType, limit = 20 } = req.query;

    let whereConditions = [eq(financialStatementRuns.companyId, req.companyId!)];
    if (statementType) {
      whereConditions.push(eq(financialStatementRuns.statementType, statementType as any));
    }

    const runs = await db.query.financialStatementRuns.findMany({
      where: and(...whereConditions),
      with: {
        fiscalYear: true,
        generatedBy: true,
      },
      orderBy: sql`${financialStatementRuns.generatedAt} DESC`,
      limit: Number(limit),
    });

    res.json(runs);
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: 'Failed to get statement history' });
  }
});

export default router;
