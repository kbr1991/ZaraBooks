import { db } from './index';
import {
  users,
  coaTemplates,
  scheduleIIIMappings,
  tdsSections,
  hsnSacMaster
} from '@shared/schema';
import bcrypt from 'bcryptjs';

// ==================== COMMON ACCOUNT STRUCTURES ====================

// Common Assets (shared across all standards)
const commonAssets = [
  // Non-Current Assets
  { code: '1000', name: 'Assets', type: 'asset', isGroup: true, level: 1 },
  { code: '1100', name: 'Non-Current Assets', type: 'asset', isGroup: true, level: 2, parent: '1000' },
  { code: '1110', name: 'Property, Plant and Equipment', type: 'asset', isGroup: true, level: 3, parent: '1100', scheduleIII: 'BS_ASSET_NCA_PPE' },
  { code: '1111', name: 'Land', type: 'asset', level: 4, parent: '1110' },
  { code: '1112', name: 'Buildings', type: 'asset', level: 4, parent: '1110' },
  { code: '1113', name: 'Plant and Machinery', type: 'asset', level: 4, parent: '1110' },
  { code: '1114', name: 'Furniture and Fixtures', type: 'asset', level: 4, parent: '1110' },
  { code: '1115', name: 'Vehicles', type: 'asset', level: 4, parent: '1110' },
  { code: '1116', name: 'Office Equipment', type: 'asset', level: 4, parent: '1110' },
  { code: '1117', name: 'Computers', type: 'asset', level: 4, parent: '1110' },
  { code: '1120', name: 'Capital Work-in-Progress', type: 'asset', level: 3, parent: '1100', scheduleIII: 'BS_ASSET_NCA_CWIP' },
  { code: '1130', name: 'Intangible Assets', type: 'asset', isGroup: true, level: 3, parent: '1100', scheduleIII: 'BS_ASSET_NCA_INTANGIBLE' },
  { code: '1131', name: 'Goodwill', type: 'asset', level: 4, parent: '1130' },
  { code: '1132', name: 'Software', type: 'asset', level: 4, parent: '1130' },
  { code: '1133', name: 'Patents and Trademarks', type: 'asset', level: 4, parent: '1130' },
  { code: '1140', name: 'Non-Current Investments', type: 'asset', isGroup: true, level: 3, parent: '1100', scheduleIII: 'BS_ASSET_NCA_INVESTMENTS' },
  { code: '1150', name: 'Deferred Tax Assets (Net)', type: 'asset', level: 3, parent: '1100', scheduleIII: 'BS_ASSET_NCA_DTA' },
  { code: '1160', name: 'Long-Term Loans and Advances', type: 'asset', isGroup: true, level: 3, parent: '1100', scheduleIII: 'BS_ASSET_NCA_LOANS' },
  { code: '1170', name: 'Other Non-Current Assets', type: 'asset', isGroup: true, level: 3, parent: '1100', scheduleIII: 'BS_ASSET_NCA_OTHER' },
  // Current Assets
  { code: '1200', name: 'Current Assets', type: 'asset', isGroup: true, level: 2, parent: '1000' },
  { code: '1210', name: 'Inventories', type: 'asset', isGroup: true, level: 3, parent: '1200', scheduleIII: 'BS_ASSET_CA_INVENTORIES' },
  { code: '1211', name: 'Raw Materials', type: 'asset', level: 4, parent: '1210' },
  { code: '1212', name: 'Work-in-Progress', type: 'asset', level: 4, parent: '1210' },
  { code: '1213', name: 'Finished Goods', type: 'asset', level: 4, parent: '1210' },
  { code: '1214', name: 'Stores and Spares', type: 'asset', level: 4, parent: '1210' },
  { code: '1220', name: 'Current Investments', type: 'asset', isGroup: true, level: 3, parent: '1200', scheduleIII: 'BS_ASSET_CA_INVESTMENTS' },
  { code: '1230', name: 'Trade Receivables', type: 'asset', level: 3, parent: '1200', scheduleIII: 'BS_ASSET_CA_RECEIVABLES' },
  { code: '1240', name: 'Cash and Cash Equivalents', type: 'asset', isGroup: true, level: 3, parent: '1200', scheduleIII: 'BS_ASSET_CA_CASH' },
  { code: '1241', name: 'Cash on Hand', type: 'asset', level: 4, parent: '1240' },
  { code: '1242', name: 'Bank Accounts', type: 'asset', level: 4, parent: '1240' },
  { code: '1243', name: 'Petty Cash', type: 'asset', level: 4, parent: '1240' },
  { code: '1250', name: 'Short-Term Loans and Advances', type: 'asset', isGroup: true, level: 3, parent: '1200', scheduleIII: 'BS_ASSET_CA_LOANS' },
  { code: '1260', name: 'Other Current Assets', type: 'asset', isGroup: true, level: 3, parent: '1200', scheduleIII: 'BS_ASSET_CA_OTHER' },
  { code: '1261', name: 'Prepaid Expenses', type: 'asset', level: 4, parent: '1260' },
  { code: '1262', name: 'Advance to Suppliers', type: 'asset', level: 4, parent: '1260' },
  { code: '1263', name: 'GST Input Credit', type: 'asset', level: 4, parent: '1260' },
  { code: '1264', name: 'TDS Receivable', type: 'asset', level: 4, parent: '1260' },
  { code: '1265', name: 'Accrued Income', type: 'asset', level: 4, parent: '1260' },
];

// Common Liabilities (shared across all standards)
const commonLiabilities = [
  { code: '2000', name: 'Liabilities', type: 'liability', isGroup: true, level: 1 },
  { code: '2100', name: 'Non-Current Liabilities', type: 'liability', isGroup: true, level: 2, parent: '2000' },
  { code: '2110', name: 'Long-Term Borrowings', type: 'liability', isGroup: true, level: 3, parent: '2100', scheduleIII: 'BS_LIAB_NCL_BORROWINGS' },
  { code: '2111', name: 'Term Loans', type: 'liability', level: 4, parent: '2110' },
  { code: '2112', name: 'Debentures', type: 'liability', level: 4, parent: '2110' },
  { code: '2120', name: 'Deferred Tax Liabilities (Net)', type: 'liability', level: 3, parent: '2100', scheduleIII: 'BS_LIAB_NCL_DTL' },
  { code: '2130', name: 'Long-Term Provisions', type: 'liability', isGroup: true, level: 3, parent: '2100', scheduleIII: 'BS_LIAB_NCL_PROVISIONS' },
  { code: '2131', name: 'Provision for Gratuity', type: 'liability', level: 4, parent: '2130' },
  { code: '2132', name: 'Provision for Leave Encashment', type: 'liability', level: 4, parent: '2130' },
  { code: '2140', name: 'Other Non-Current Liabilities', type: 'liability', isGroup: true, level: 3, parent: '2100', scheduleIII: 'BS_LIAB_NCL_OTHER' },
  // Current Liabilities
  { code: '2200', name: 'Current Liabilities', type: 'liability', isGroup: true, level: 2, parent: '2000' },
  { code: '2210', name: 'Short-Term Borrowings', type: 'liability', isGroup: true, level: 3, parent: '2200', scheduleIII: 'BS_LIAB_CL_BORROWINGS' },
  { code: '2211', name: 'Bank Overdraft', type: 'liability', level: 4, parent: '2210' },
  { code: '2212', name: 'Working Capital Loans', type: 'liability', level: 4, parent: '2210' },
  { code: '2220', name: 'Trade Payables', type: 'liability', level: 3, parent: '2200', scheduleIII: 'BS_LIAB_CL_PAYABLES' },
  { code: '2230', name: 'Other Current Liabilities', type: 'liability', isGroup: true, level: 3, parent: '2200', scheduleIII: 'BS_LIAB_CL_OTHER' },
  { code: '2231', name: 'GST Output Liability', type: 'liability', level: 4, parent: '2230' },
  { code: '2232', name: 'TDS Payable', type: 'liability', level: 4, parent: '2230' },
  { code: '2233', name: 'Statutory Dues Payable', type: 'liability', level: 4, parent: '2230' },
  { code: '2234', name: 'Salary Payable', type: 'liability', level: 4, parent: '2230' },
  { code: '2235', name: 'Advance from Customers', type: 'liability', level: 4, parent: '2230' },
  { code: '2236', name: 'Accrued Expenses', type: 'liability', level: 4, parent: '2230' },
  { code: '2240', name: 'Short-Term Provisions', type: 'liability', isGroup: true, level: 3, parent: '2200', scheduleIII: 'BS_LIAB_CL_PROVISIONS' },
  { code: '2241', name: 'Provision for Expenses', type: 'liability', level: 4, parent: '2240' },
  { code: '2242', name: 'Provision for Income Tax', type: 'liability', level: 4, parent: '2240' },
];

// Common Income accounts
const commonIncome = [
  { code: '4000', name: 'Income', type: 'income', isGroup: true, level: 1 },
  { code: '4100', name: 'Revenue from Operations', type: 'income', isGroup: true, level: 2, parent: '4000', scheduleIII: 'PL_REVENUE_OPERATIONS' },
  { code: '4110', name: 'Sales of Services', type: 'income', level: 3, parent: '4100' },
  { code: '4120', name: 'Sales of Products', type: 'income', level: 3, parent: '4100' },
  { code: '4130', name: 'Professional Fees', type: 'income', level: 3, parent: '4100' },
  { code: '4140', name: 'Consultation Income', type: 'income', level: 3, parent: '4100' },
  { code: '4150', name: 'Commission Income', type: 'income', level: 3, parent: '4100' },
  { code: '4200', name: 'Other Income', type: 'income', isGroup: true, level: 2, parent: '4000', scheduleIII: 'PL_OTHER_INCOME' },
  { code: '4210', name: 'Interest Income', type: 'income', level: 3, parent: '4200' },
  { code: '4220', name: 'Dividend Income', type: 'income', level: 3, parent: '4200' },
  { code: '4230', name: 'Rent Received', type: 'income', level: 3, parent: '4200' },
  { code: '4240', name: 'Profit on Sale of Assets', type: 'income', level: 3, parent: '4200' },
  { code: '4250', name: 'Foreign Exchange Gain', type: 'income', level: 3, parent: '4200' },
  { code: '4260', name: 'Miscellaneous Income', type: 'income', level: 3, parent: '4200' },
];

// Common Expense accounts
const commonExpenses = [
  { code: '5000', name: 'Expenses', type: 'expense', isGroup: true, level: 1 },
  { code: '5100', name: 'Cost of Materials Consumed', type: 'expense', isGroup: true, level: 2, parent: '5000', scheduleIII: 'PL_COST_MATERIALS' },
  { code: '5110', name: 'Raw Material Consumed', type: 'expense', level: 3, parent: '5100' },
  { code: '5120', name: 'Consumables', type: 'expense', level: 3, parent: '5100' },
  { code: '5200', name: 'Purchases of Stock-in-Trade', type: 'expense', level: 2, parent: '5000', scheduleIII: 'PL_PURCHASES' },
  { code: '5300', name: 'Employee Benefits Expense', type: 'expense', isGroup: true, level: 2, parent: '5000', scheduleIII: 'PL_EMPLOYEE_BENEFITS' },
  { code: '5310', name: 'Salaries and Wages', type: 'expense', level: 3, parent: '5300' },
  { code: '5320', name: 'Contribution to PF/ESI', type: 'expense', level: 3, parent: '5300' },
  { code: '5330', name: 'Staff Welfare Expenses', type: 'expense', level: 3, parent: '5300' },
  { code: '5340', name: 'Bonus', type: 'expense', level: 3, parent: '5300' },
  { code: '5350', name: 'Gratuity', type: 'expense', level: 3, parent: '5300' },
  { code: '5360', name: 'Director Remuneration', type: 'expense', level: 3, parent: '5300' },
  { code: '5400', name: 'Finance Costs', type: 'expense', isGroup: true, level: 2, parent: '5000', scheduleIII: 'PL_FINANCE_COSTS' },
  { code: '5410', name: 'Interest Expense', type: 'expense', level: 3, parent: '5400' },
  { code: '5420', name: 'Bank Charges', type: 'expense', level: 3, parent: '5400' },
  { code: '5430', name: 'Processing Fees', type: 'expense', level: 3, parent: '5400' },
  { code: '5500', name: 'Depreciation and Amortisation', type: 'expense', isGroup: true, level: 2, parent: '5000', scheduleIII: 'PL_DEPRECIATION' },
  { code: '5510', name: 'Depreciation on PPE', type: 'expense', level: 3, parent: '5500' },
  { code: '5520', name: 'Amortisation of Intangibles', type: 'expense', level: 3, parent: '5500' },
  { code: '5600', name: 'Other Expenses', type: 'expense', isGroup: true, level: 2, parent: '5000', scheduleIII: 'PL_OTHER_EXPENSES' },
  { code: '5610', name: 'Rent', type: 'expense', level: 3, parent: '5600' },
  { code: '5620', name: 'Electricity', type: 'expense', level: 3, parent: '5600' },
  { code: '5630', name: 'Communication Expenses', type: 'expense', level: 3, parent: '5600' },
  { code: '5640', name: 'Travelling and Conveyance', type: 'expense', level: 3, parent: '5600' },
  { code: '5650', name: 'Printing and Stationery', type: 'expense', level: 3, parent: '5600' },
  { code: '5660', name: 'Professional Fees', type: 'expense', level: 3, parent: '5600' },
  { code: '5670', name: 'Legal Expenses', type: 'expense', level: 3, parent: '5600' },
  { code: '5680', name: 'Repairs and Maintenance', type: 'expense', level: 3, parent: '5600' },
  { code: '5690', name: 'Insurance', type: 'expense', level: 3, parent: '5600' },
  { code: '5691', name: 'Rates and Taxes', type: 'expense', level: 3, parent: '5600' },
  { code: '5692', name: 'Advertisement', type: 'expense', level: 3, parent: '5600' },
  { code: '5693', name: 'Audit Fees', type: 'expense', level: 3, parent: '5600' },
  { code: '5694', name: 'Bad Debts', type: 'expense', level: 3, parent: '5600' },
  { code: '5695', name: 'Foreign Exchange Loss', type: 'expense', level: 3, parent: '5600' },
  { code: '5696', name: 'Loss on Sale of Assets', type: 'expense', level: 3, parent: '5600' },
  { code: '5697', name: 'Miscellaneous Expenses', type: 'expense', level: 3, parent: '5600' },
  { code: '5700', name: 'Tax Expense', type: 'expense', isGroup: true, level: 2, parent: '5000', scheduleIII: 'PL_TAX_EXPENSE' },
  { code: '5710', name: 'Current Tax', type: 'expense', level: 3, parent: '5700' },
  { code: '5720', name: 'Deferred Tax', type: 'expense', level: 3, parent: '5700' },
];

// ==================== ENTITY-SPECIFIC EQUITY STRUCTURES ====================

// Company (Private Limited, Public Limited, OPC)
const companyEquity = [
  { code: '3000', name: 'Equity', type: 'equity', isGroup: true, level: 1 },
  { code: '3100', name: 'Share Capital', type: 'equity', isGroup: true, level: 2, parent: '3000', scheduleIII: 'BS_EQUITY_SHARE_CAPITAL' },
  { code: '3110', name: 'Equity Share Capital', type: 'equity', level: 3, parent: '3100' },
  { code: '3120', name: 'Preference Share Capital', type: 'equity', level: 3, parent: '3100' },
  { code: '3130', name: 'Share Application Money Pending Allotment', type: 'equity', level: 3, parent: '3100' },
  { code: '3200', name: 'Reserves and Surplus', type: 'equity', isGroup: true, level: 2, parent: '3000', scheduleIII: 'BS_EQUITY_RESERVES' },
  { code: '3210', name: 'Securities Premium', type: 'equity', level: 3, parent: '3200' },
  { code: '3220', name: 'General Reserve', type: 'equity', level: 3, parent: '3200' },
  { code: '3230', name: 'Retained Earnings', type: 'equity', level: 3, parent: '3200' },
  { code: '3240', name: 'Capital Reserve', type: 'equity', level: 3, parent: '3200' },
  { code: '3250', name: 'Capital Redemption Reserve', type: 'equity', level: 3, parent: '3200' },
  { code: '3300', name: 'Other Equity', type: 'equity', isGroup: true, level: 2, parent: '3000', scheduleIII: 'BS_EQUITY_OTHER' },
  { code: '3310', name: 'Other Comprehensive Income', type: 'equity', level: 3, parent: '3300' },
];

// Partnership Firm
const partnershipEquity = [
  { code: '3000', name: 'Equity', type: 'equity', isGroup: true, level: 1 },
  { code: '3100', name: "Partners' Capital", type: 'equity', isGroup: true, level: 2, parent: '3000', scheduleIII: 'BS_EQUITY_SHARE_CAPITAL' },
  { code: '3110', name: "Partner A - Capital Account", type: 'equity', level: 3, parent: '3100' },
  { code: '3120', name: "Partner B - Capital Account", type: 'equity', level: 3, parent: '3100' },
  { code: '3130', name: "Partner C - Capital Account", type: 'equity', level: 3, parent: '3100' },
  { code: '3200', name: "Partners' Current Accounts", type: 'equity', isGroup: true, level: 2, parent: '3000', scheduleIII: 'BS_EQUITY_RESERVES' },
  { code: '3210', name: "Partner A - Current Account", type: 'equity', level: 3, parent: '3200' },
  { code: '3220', name: "Partner B - Current Account", type: 'equity', level: 3, parent: '3200' },
  { code: '3230', name: "Partner C - Current Account", type: 'equity', level: 3, parent: '3200' },
  { code: '3300', name: 'Reserves', type: 'equity', isGroup: true, level: 2, parent: '3000', scheduleIII: 'BS_EQUITY_OTHER' },
  { code: '3310', name: 'General Reserve', type: 'equity', level: 3, parent: '3300' },
  { code: '3320', name: 'Investment Fluctuation Reserve', type: 'equity', level: 3, parent: '3300' },
  { code: '3400', name: 'Profit & Loss Account', type: 'equity', level: 2, parent: '3000' },
];

// LLP (Limited Liability Partnership)
const llpEquity = [
  { code: '3000', name: 'Equity', type: 'equity', isGroup: true, level: 1 },
  { code: '3100', name: "Partners' Contribution", type: 'equity', isGroup: true, level: 2, parent: '3000', scheduleIII: 'BS_EQUITY_SHARE_CAPITAL' },
  { code: '3110', name: "Designated Partner A - Contribution", type: 'equity', level: 3, parent: '3100' },
  { code: '3120', name: "Designated Partner B - Contribution", type: 'equity', level: 3, parent: '3100' },
  { code: '3130', name: "Partner C - Contribution", type: 'equity', level: 3, parent: '3100' },
  { code: '3200', name: 'Reserves and Surplus', type: 'equity', isGroup: true, level: 2, parent: '3000', scheduleIII: 'BS_EQUITY_RESERVES' },
  { code: '3210', name: 'General Reserve', type: 'equity', level: 3, parent: '3200' },
  { code: '3220', name: 'Retained Earnings', type: 'equity', level: 3, parent: '3200' },
  { code: '3300', name: 'Other Equity', type: 'equity', isGroup: true, level: 2, parent: '3000', scheduleIII: 'BS_EQUITY_OTHER' },
];

// Proprietorship
const proprietorshipEquity = [
  { code: '3000', name: 'Equity', type: 'equity', isGroup: true, level: 1 },
  { code: '3100', name: "Proprietor's Capital", type: 'equity', isGroup: true, level: 2, parent: '3000', scheduleIII: 'BS_EQUITY_SHARE_CAPITAL' },
  { code: '3110', name: "Proprietor's Capital Account", type: 'equity', level: 3, parent: '3100' },
  { code: '3200', name: "Proprietor's Drawings", type: 'equity', isGroup: true, level: 2, parent: '3000', scheduleIII: 'BS_EQUITY_RESERVES' },
  { code: '3210', name: "Drawings Account", type: 'equity', level: 3, parent: '3200' },
  { code: '3300', name: 'Reserves', type: 'equity', isGroup: true, level: 2, parent: '3000', scheduleIII: 'BS_EQUITY_OTHER' },
  { code: '3310', name: 'General Reserve', type: 'equity', level: 3, parent: '3300' },
  { code: '3400', name: 'Profit & Loss Account', type: 'equity', level: 2, parent: '3000' },
];

// ==================== US GAAP SPECIFIC ====================
const usGaapEquity = [
  { code: '3000', name: 'Stockholders\' Equity', type: 'equity', isGroup: true, level: 1 },
  { code: '3100', name: 'Contributed Capital', type: 'equity', isGroup: true, level: 2, parent: '3000' },
  { code: '3110', name: 'Common Stock', type: 'equity', level: 3, parent: '3100' },
  { code: '3120', name: 'Preferred Stock', type: 'equity', level: 3, parent: '3100' },
  { code: '3130', name: 'Additional Paid-in Capital', type: 'equity', level: 3, parent: '3100' },
  { code: '3140', name: 'Treasury Stock', type: 'equity', level: 3, parent: '3100' },
  { code: '3200', name: 'Retained Earnings', type: 'equity', isGroup: true, level: 2, parent: '3000' },
  { code: '3210', name: 'Appropriated Retained Earnings', type: 'equity', level: 3, parent: '3200' },
  { code: '3220', name: 'Unappropriated Retained Earnings', type: 'equity', level: 3, parent: '3200' },
  { code: '3300', name: 'Accumulated Other Comprehensive Income', type: 'equity', isGroup: true, level: 2, parent: '3000' },
  { code: '3310', name: 'Foreign Currency Translation Adjustments', type: 'equity', level: 3, parent: '3300' },
  { code: '3320', name: 'Unrealized Gains/Losses on Securities', type: 'equity', level: 3, parent: '3300' },
  { code: '3330', name: 'Pension Adjustments', type: 'equity', level: 3, parent: '3300' },
];

// US GAAP specific liability additions
const usGaapLiabilityAdditions = [
  { code: '2150', name: 'Pension Liability', type: 'liability', level: 3, parent: '2100' },
  { code: '2160', name: 'Asset Retirement Obligations', type: 'liability', level: 3, parent: '2100' },
  { code: '2250', name: 'Current Portion of Long-Term Debt', type: 'liability', level: 3, parent: '2200' },
];

// ==================== IFRS SPECIFIC ====================
const ifrsEquity = [
  { code: '3000', name: 'Equity', type: 'equity', isGroup: true, level: 1 },
  { code: '3100', name: 'Issued Capital', type: 'equity', isGroup: true, level: 2, parent: '3000' },
  { code: '3110', name: 'Ordinary Shares', type: 'equity', level: 3, parent: '3100' },
  { code: '3120', name: 'Preference Shares', type: 'equity', level: 3, parent: '3100' },
  { code: '3130', name: 'Share Premium', type: 'equity', level: 3, parent: '3100' },
  { code: '3200', name: 'Reserves', type: 'equity', isGroup: true, level: 2, parent: '3000' },
  { code: '3210', name: 'Revaluation Surplus', type: 'equity', level: 3, parent: '3200' },
  { code: '3220', name: 'Translation Reserve', type: 'equity', level: 3, parent: '3200' },
  { code: '3230', name: 'Hedging Reserve', type: 'equity', level: 3, parent: '3200' },
  { code: '3240', name: 'Fair Value Reserve', type: 'equity', level: 3, parent: '3200' },
  { code: '3250', name: 'Treasury Shares', type: 'equity', level: 3, parent: '3200' },
  { code: '3300', name: 'Retained Earnings', type: 'equity', level: 2, parent: '3000' },
  { code: '3400', name: 'Non-controlling Interests', type: 'equity', level: 2, parent: '3000' },
];

// IFRS specific additions
const ifrsLiabilityAdditions = [
  { code: '2145', name: 'Lease Liabilities (Non-Current)', type: 'liability', level: 3, parent: '2100' },
  { code: '2245', name: 'Lease Liabilities (Current)', type: 'liability', level: 3, parent: '2200' },
  { code: '2246', name: 'Contract Liabilities', type: 'liability', level: 4, parent: '2230' },
];

const ifrsAssetAdditions = [
  { code: '1118', name: 'Right-of-Use Assets', type: 'asset', level: 4, parent: '1110' },
  { code: '1266', name: 'Contract Assets', type: 'asset', level: 4, parent: '1260' },
];

async function seed() {
  console.log('Seeding database...');

  // Create default admin user
  const hashedPassword = await bcrypt.hash('Admin@123', 10);
  await db.insert(users).values({
    email: 'admin@zarabooks.com',
    password: hashedPassword,
    firstName: 'Admin',
    lastName: 'User',
    role: 'super_admin',
    isActive: true,
    emailVerified: true,
  }).onConflictDoNothing();

  // ==================== INDIA GAAP TEMPLATES ====================

  // India GAAP - Company (Private Limited, Public Limited, OPC)
  const indiaGaapCompany = {
    name: 'India GAAP - Company',
    gaapStandard: 'INDIA_GAAP' as const,
    description: 'Chart of Accounts for Private Limited, Public Limited, and One Person Companies (Schedule III)',
    entityTypes: ['private_limited', 'public_limited', 'opc'],
    templateData: {
      accounts: [...commonAssets, ...commonLiabilities, ...companyEquity, ...commonIncome, ...commonExpenses],
    },
    isActive: true,
  };

  // India GAAP - Partnership
  const indiaGaapPartnership = {
    name: 'India GAAP - Partnership Firm',
    gaapStandard: 'INDIA_GAAP_PARTNERSHIP' as const,
    description: 'Chart of Accounts for Partnership Firms with Partners\' Capital and Current Accounts',
    entityTypes: ['partnership'],
    templateData: {
      accounts: [...commonAssets, ...commonLiabilities, ...partnershipEquity, ...commonIncome, ...commonExpenses],
    },
    isActive: true,
  };

  // India GAAP - LLP
  const indiaGaapLLP = {
    name: 'India GAAP - LLP',
    gaapStandard: 'INDIA_GAAP_LLP' as const,
    description: 'Chart of Accounts for Limited Liability Partnerships',
    entityTypes: ['llp'],
    templateData: {
      accounts: [...commonAssets, ...commonLiabilities, ...llpEquity, ...commonIncome, ...commonExpenses],
    },
    isActive: true,
  };

  // India GAAP - Proprietorship
  const indiaGaapProprietorship = {
    name: 'India GAAP - Proprietorship',
    gaapStandard: 'INDIA_GAAP_PROPRIETORSHIP' as const,
    description: 'Chart of Accounts for Sole Proprietorship with Proprietor\'s Capital',
    entityTypes: ['proprietorship'],
    templateData: {
      accounts: [...commonAssets, ...commonLiabilities, ...proprietorshipEquity, ...commonIncome, ...commonExpenses],
    },
    isActive: true,
  };

  // ==================== US GAAP TEMPLATE ====================
  const usGaapTemplate = {
    name: 'US GAAP',
    gaapStandard: 'US_GAAP' as const,
    description: 'Chart of Accounts following United States Generally Accepted Accounting Principles',
    entityTypes: ['corporation', 'llc'],
    templateData: {
      accounts: [
        ...commonAssets,
        ...commonLiabilities,
        ...usGaapLiabilityAdditions,
        ...usGaapEquity,
        ...commonIncome,
        ...commonExpenses,
      ],
    },
    isActive: true,
  };

  // ==================== IFRS TEMPLATE ====================
  const ifrsTemplate = {
    name: 'IFRS',
    gaapStandard: 'IFRS' as const,
    description: 'Chart of Accounts following International Financial Reporting Standards',
    entityTypes: ['international', 'listed'],
    templateData: {
      accounts: [
        ...commonAssets,
        ...ifrsAssetAdditions,
        ...commonLiabilities,
        ...ifrsLiabilityAdditions,
        ...ifrsEquity,
        ...commonIncome,
        ...commonExpenses,
      ],
    },
    isActive: true,
  };

  // Insert all templates
  const templates = [
    indiaGaapCompany,
    indiaGaapPartnership,
    indiaGaapLLP,
    indiaGaapProprietorship,
    usGaapTemplate,
    ifrsTemplate,
  ];

  for (const template of templates) {
    await db.insert(coaTemplates).values(template).onConflictDoNothing();
  }

  console.log('Inserted COA templates:', templates.map(t => t.name).join(', '));

  // ==================== SCHEDULE III MAPPINGS ====================
  const scheduleIIIMappingData = [
    // Balance Sheet - Assets
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_ASSETS', lineItemName: 'ASSETS', displayOrder: 1, statementType: 'balance_sheet' as const, indentLevel: 0, isBold: true },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_ASSET_NCA', lineItemName: 'Non-Current Assets', displayOrder: 2, statementType: 'balance_sheet' as const, indentLevel: 1, isBold: true, parentLineItemId: 'BS_ASSETS' },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_ASSET_NCA_PPE', lineItemName: 'Property, Plant and Equipment', displayOrder: 3, statementType: 'balance_sheet' as const, indentLevel: 2, hasSubSchedule: true },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_ASSET_NCA_CWIP', lineItemName: 'Capital Work-in-Progress', displayOrder: 4, statementType: 'balance_sheet' as const, indentLevel: 2 },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_ASSET_NCA_INTANGIBLE', lineItemName: 'Intangible Assets', displayOrder: 5, statementType: 'balance_sheet' as const, indentLevel: 2, hasSubSchedule: true },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_ASSET_NCA_INVESTMENTS', lineItemName: 'Non-Current Investments', displayOrder: 6, statementType: 'balance_sheet' as const, indentLevel: 2, hasSubSchedule: true },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_ASSET_NCA_DTA', lineItemName: 'Deferred Tax Assets (Net)', displayOrder: 7, statementType: 'balance_sheet' as const, indentLevel: 2 },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_ASSET_NCA_LOANS', lineItemName: 'Long-Term Loans and Advances', displayOrder: 8, statementType: 'balance_sheet' as const, indentLevel: 2, hasSubSchedule: true },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_ASSET_NCA_OTHER', lineItemName: 'Other Non-Current Assets', displayOrder: 9, statementType: 'balance_sheet' as const, indentLevel: 2 },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_ASSET_NCA_TOTAL', lineItemName: 'Total Non-Current Assets', displayOrder: 10, statementType: 'balance_sheet' as const, indentLevel: 1, isBold: true, isTotal: true },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_ASSET_CA', lineItemName: 'Current Assets', displayOrder: 11, statementType: 'balance_sheet' as const, indentLevel: 1, isBold: true },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_ASSET_CA_INVENTORIES', lineItemName: 'Inventories', displayOrder: 12, statementType: 'balance_sheet' as const, indentLevel: 2, hasSubSchedule: true },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_ASSET_CA_INVESTMENTS', lineItemName: 'Current Investments', displayOrder: 13, statementType: 'balance_sheet' as const, indentLevel: 2 },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_ASSET_CA_RECEIVABLES', lineItemName: 'Trade Receivables', displayOrder: 14, statementType: 'balance_sheet' as const, indentLevel: 2, hasSubSchedule: true },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_ASSET_CA_CASH', lineItemName: 'Cash and Cash Equivalents', displayOrder: 15, statementType: 'balance_sheet' as const, indentLevel: 2 },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_ASSET_CA_LOANS', lineItemName: 'Short-Term Loans and Advances', displayOrder: 16, statementType: 'balance_sheet' as const, indentLevel: 2 },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_ASSET_CA_OTHER', lineItemName: 'Other Current Assets', displayOrder: 17, statementType: 'balance_sheet' as const, indentLevel: 2 },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_ASSET_CA_TOTAL', lineItemName: 'Total Current Assets', displayOrder: 18, statementType: 'balance_sheet' as const, indentLevel: 1, isBold: true, isTotal: true },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_ASSETS_TOTAL', lineItemName: 'TOTAL ASSETS', displayOrder: 19, statementType: 'balance_sheet' as const, indentLevel: 0, isBold: true, isTotal: true },
    // Balance Sheet - Equity and Liabilities
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_EQUITY_LIAB', lineItemName: 'EQUITY AND LIABILITIES', displayOrder: 20, statementType: 'balance_sheet' as const, indentLevel: 0, isBold: true },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_EQUITY', lineItemName: "Shareholders' Funds", displayOrder: 21, statementType: 'balance_sheet' as const, indentLevel: 1, isBold: true },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_EQUITY_SHARE_CAPITAL', lineItemName: 'Share Capital', displayOrder: 22, statementType: 'balance_sheet' as const, indentLevel: 2, hasSubSchedule: true },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_EQUITY_RESERVES', lineItemName: 'Reserves and Surplus', displayOrder: 23, statementType: 'balance_sheet' as const, indentLevel: 2, hasSubSchedule: true },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_EQUITY_OTHER', lineItemName: 'Other Equity', displayOrder: 24, statementType: 'balance_sheet' as const, indentLevel: 2 },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_EQUITY_TOTAL', lineItemName: "Total Shareholders' Funds", displayOrder: 25, statementType: 'balance_sheet' as const, indentLevel: 1, isBold: true, isTotal: true },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_LIAB_NCL', lineItemName: 'Non-Current Liabilities', displayOrder: 26, statementType: 'balance_sheet' as const, indentLevel: 1, isBold: true },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_LIAB_NCL_BORROWINGS', lineItemName: 'Long-Term Borrowings', displayOrder: 27, statementType: 'balance_sheet' as const, indentLevel: 2, hasSubSchedule: true },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_LIAB_NCL_DTL', lineItemName: 'Deferred Tax Liabilities (Net)', displayOrder: 28, statementType: 'balance_sheet' as const, indentLevel: 2 },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_LIAB_NCL_PROVISIONS', lineItemName: 'Long-Term Provisions', displayOrder: 29, statementType: 'balance_sheet' as const, indentLevel: 2 },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_LIAB_NCL_OTHER', lineItemName: 'Other Non-Current Liabilities', displayOrder: 30, statementType: 'balance_sheet' as const, indentLevel: 2 },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_LIAB_NCL_TOTAL', lineItemName: 'Total Non-Current Liabilities', displayOrder: 31, statementType: 'balance_sheet' as const, indentLevel: 1, isBold: true, isTotal: true },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_LIAB_CL', lineItemName: 'Current Liabilities', displayOrder: 32, statementType: 'balance_sheet' as const, indentLevel: 1, isBold: true },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_LIAB_CL_BORROWINGS', lineItemName: 'Short-Term Borrowings', displayOrder: 33, statementType: 'balance_sheet' as const, indentLevel: 2 },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_LIAB_CL_PAYABLES', lineItemName: 'Trade Payables', displayOrder: 34, statementType: 'balance_sheet' as const, indentLevel: 2, hasSubSchedule: true },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_LIAB_CL_OTHER', lineItemName: 'Other Current Liabilities', displayOrder: 35, statementType: 'balance_sheet' as const, indentLevel: 2 },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_LIAB_CL_PROVISIONS', lineItemName: 'Short-Term Provisions', displayOrder: 36, statementType: 'balance_sheet' as const, indentLevel: 2 },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_LIAB_CL_TOTAL', lineItemName: 'Total Current Liabilities', displayOrder: 37, statementType: 'balance_sheet' as const, indentLevel: 1, isBold: true, isTotal: true },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'BS_EQUITY_LIAB_TOTAL', lineItemName: 'TOTAL EQUITY AND LIABILITIES', displayOrder: 38, statementType: 'balance_sheet' as const, indentLevel: 0, isBold: true, isTotal: true },
    // Profit & Loss Statement
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'PL_REVENUE_OPERATIONS', lineItemName: 'Revenue from Operations', displayOrder: 1, statementType: 'profit_loss' as const, indentLevel: 0 },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'PL_OTHER_INCOME', lineItemName: 'Other Income', displayOrder: 2, statementType: 'profit_loss' as const, indentLevel: 0 },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'PL_TOTAL_INCOME', lineItemName: 'Total Income', displayOrder: 3, statementType: 'profit_loss' as const, indentLevel: 0, isBold: true, isTotal: true },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'PL_EXPENSES', lineItemName: 'EXPENSES', displayOrder: 4, statementType: 'profit_loss' as const, indentLevel: 0, isBold: true },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'PL_COST_MATERIALS', lineItemName: 'Cost of Materials Consumed', displayOrder: 5, statementType: 'profit_loss' as const, indentLevel: 1 },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'PL_PURCHASES', lineItemName: 'Purchases of Stock-in-Trade', displayOrder: 6, statementType: 'profit_loss' as const, indentLevel: 1 },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'PL_INVENTORY_CHANGE', lineItemName: 'Changes in Inventories', displayOrder: 7, statementType: 'profit_loss' as const, indentLevel: 1 },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'PL_EMPLOYEE_BENEFITS', lineItemName: 'Employee Benefits Expense', displayOrder: 8, statementType: 'profit_loss' as const, indentLevel: 1 },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'PL_FINANCE_COSTS', lineItemName: 'Finance Costs', displayOrder: 9, statementType: 'profit_loss' as const, indentLevel: 1 },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'PL_DEPRECIATION', lineItemName: 'Depreciation and Amortisation Expense', displayOrder: 10, statementType: 'profit_loss' as const, indentLevel: 1 },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'PL_OTHER_EXPENSES', lineItemName: 'Other Expenses', displayOrder: 11, statementType: 'profit_loss' as const, indentLevel: 1 },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'PL_TOTAL_EXPENSES', lineItemName: 'Total Expenses', displayOrder: 12, statementType: 'profit_loss' as const, indentLevel: 0, isBold: true, isTotal: true },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'PL_PBT', lineItemName: 'Profit Before Tax', displayOrder: 13, statementType: 'profit_loss' as const, indentLevel: 0, isBold: true },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'PL_TAX_EXPENSE', lineItemName: 'Tax Expense', displayOrder: 14, statementType: 'profit_loss' as const, indentLevel: 1 },
    { gaapStandard: 'INDIA_GAAP' as const, lineItemCode: 'PL_PAT', lineItemName: 'Profit for the Period', displayOrder: 15, statementType: 'profit_loss' as const, indentLevel: 0, isBold: true },
  ];

  for (const mapping of scheduleIIIMappingData) {
    await db.insert(scheduleIIIMappings).values(mapping).onConflictDoNothing();
  }

  // ==================== TDS SECTIONS ====================
  const tdsSectionsData = [
    { sectionCode: '192', description: 'Salary', defaultRateIndividual: '30.00', defaultRateCompany: null, thresholdLimit: '250000.00' },
    { sectionCode: '194A', description: 'Interest other than interest on securities', defaultRateIndividual: '10.00', defaultRateCompany: '10.00', thresholdLimit: '40000.00' },
    { sectionCode: '194C', description: 'Payment to Contractors', defaultRateIndividual: '1.00', defaultRateCompany: '2.00', thresholdLimit: '30000.00' },
    { sectionCode: '194H', description: 'Commission or Brokerage', defaultRateIndividual: '5.00', defaultRateCompany: '5.00', thresholdLimit: '15000.00' },
    { sectionCode: '194I', description: 'Rent', defaultRateIndividual: '10.00', defaultRateCompany: '10.00', thresholdLimit: '240000.00' },
    { sectionCode: '194J', description: 'Professional/Technical Services', defaultRateIndividual: '10.00', defaultRateCompany: '10.00', thresholdLimit: '30000.00' },
    { sectionCode: '194M', description: 'Payment to Commission/Brokerage by Individual/HUF', defaultRateIndividual: '5.00', defaultRateCompany: '5.00', thresholdLimit: '50000000.00' },
    { sectionCode: '194Q', description: 'Payment for Purchase of Goods', defaultRateIndividual: '0.10', defaultRateCompany: '0.10', thresholdLimit: '5000000.00' },
    { sectionCode: '195', description: 'Payment to Non-Resident', defaultRateIndividual: '20.00', defaultRateCompany: '20.00', thresholdLimit: '0.00' },
  ];

  for (const section of tdsSectionsData) {
    await db.insert(tdsSections).values(section).onConflictDoNothing();
  }

  // ==================== HSN/SAC CODES ====================
  const hsnSacData = [
    { code: '998231', description: 'Legal advisory and representation services', type: 'SAC', gstRate: '18.00' },
    { code: '998311', description: 'Management consulting and management services', type: 'SAC', gstRate: '18.00' },
    { code: '998312', description: 'Business consulting services', type: 'SAC', gstRate: '18.00' },
    { code: '998313', description: 'Information technology consulting services', type: 'SAC', gstRate: '18.00' },
    { code: '998314', description: 'Information technology design and development services', type: 'SAC', gstRate: '18.00' },
    { code: '998321', description: 'Accounting, auditing and bookkeeping services', type: 'SAC', gstRate: '18.00' },
    { code: '998322', description: 'Tax consultancy and preparation services', type: 'SAC', gstRate: '18.00' },
    { code: '998323', description: 'Insolvency and receivership services', type: 'SAC', gstRate: '18.00' },
    { code: '998331', description: 'Architectural services', type: 'SAC', gstRate: '18.00' },
    { code: '998332', description: 'Urban planning services', type: 'SAC', gstRate: '18.00' },
    { code: '998341', description: 'Engineering services', type: 'SAC', gstRate: '18.00' },
    { code: '998351', description: 'Scientific and technical consulting services', type: 'SAC', gstRate: '18.00' },
    { code: '998361', description: 'Technical testing and analysis services', type: 'SAC', gstRate: '18.00' },
    { code: '998371', description: 'Advertising services', type: 'SAC', gstRate: '18.00' },
    { code: '998381', description: 'Photography services', type: 'SAC', gstRate: '18.00' },
    { code: '998391', description: 'Specialized design services', type: 'SAC', gstRate: '18.00' },
    { code: '998511', description: 'Financial leasing services', type: 'SAC', gstRate: '18.00' },
    { code: '998599', description: 'Other financial services', type: 'SAC', gstRate: '18.00' },
    { code: '997212', description: 'Rental of residential property', type: 'SAC', gstRate: '0.00' },
    { code: '997221', description: 'Rental of commercial property', type: 'SAC', gstRate: '18.00' },
  ];

  for (const item of hsnSacData) {
    await db.insert(hsnSacMaster).values(item).onConflictDoNothing();
  }

  console.log('Seeding complete!');
}

seed().catch(console.error);
