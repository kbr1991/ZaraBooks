import { describe, it, expect } from 'vitest';

/**
 * Schedule III (Balance Sheet) classification tests
 * Based on Companies Act 2013, Schedule III
 */

// Account classification for Schedule III
type ScheduleIIICategory =
  | 'NCA_PPE' // Non-current Assets - Property, Plant & Equipment
  | 'NCA_INTANGIBLE'
  | 'NCA_INVESTMENT'
  | 'NCA_LOANS'
  | 'NCA_OTHER_FA'
  | 'CA_INVENTORY'
  | 'CA_TRADE_RECEIVABLE'
  | 'CA_CASH'
  | 'CA_BANK'
  | 'CA_LOANS'
  | 'CA_OTHER'
  | 'EQUITY_SHARE_CAPITAL'
  | 'EQUITY_RESERVES'
  | 'EQUITY_RETAINED'
  | 'NCL_BORROWINGS'
  | 'NCL_PROVISIONS'
  | 'NCL_OTHER'
  | 'CL_BORROWINGS'
  | 'CL_TRADE_PAYABLE'
  | 'CL_PROVISIONS'
  | 'CL_OTHER';

// Map account code to Schedule III category
function mapToScheduleIII(accountCode: string, accountName: string): ScheduleIIICategory | null {
  const code = accountCode.toLowerCase();
  const name = accountName.toLowerCase();

  // Assets
  if (code.startsWith('1')) {
    // Non-current assets (10xx)
    if (code.startsWith('10')) {
      if (name.includes('land') || name.includes('building') || name.includes('machinery') || name.includes('furniture') || name.includes('vehicle')) {
        return 'NCA_PPE';
      }
      if (name.includes('goodwill') || name.includes('patent') || name.includes('trademark') || name.includes('software')) {
        return 'NCA_INTANGIBLE';
      }
      if (name.includes('investment')) {
        return 'NCA_INVESTMENT';
      }
    }
    // Current assets (11xx)
    if (code.startsWith('11')) {
      if (name.includes('inventory') || name.includes('stock')) {
        return 'CA_INVENTORY';
      }
      if (name.includes('receivable') || name.includes('debtor')) {
        return 'CA_TRADE_RECEIVABLE';
      }
      if (name.includes('cash')) {
        return 'CA_CASH';
      }
      if (name.includes('bank')) {
        return 'CA_BANK';
      }
    }
  }

  // Liabilities
  if (code.startsWith('2')) {
    // Non-current liabilities (20xx)
    if (code.startsWith('20')) {
      if (name.includes('loan') || name.includes('borrowing')) {
        return 'NCL_BORROWINGS';
      }
    }
    // Current liabilities (21xx)
    if (code.startsWith('21')) {
      if (name.includes('payable') || name.includes('creditor')) {
        return 'CL_TRADE_PAYABLE';
      }
      if (name.includes('short') && name.includes('loan')) {
        return 'CL_BORROWINGS';
      }
    }
  }

  // Equity
  if (code.startsWith('3')) {
    if (name.includes('share capital') || name.includes('capital')) {
      return 'EQUITY_SHARE_CAPITAL';
    }
    if (name.includes('reserve')) {
      return 'EQUITY_RESERVES';
    }
    if (name.includes('retained') || name.includes('surplus')) {
      return 'EQUITY_RETAINED';
    }
  }

  return null;
}

// Balance sheet structure
interface BalanceSheetLine {
  code: string;
  name: string;
  amount: number;
  previousAmount?: number;
  children?: BalanceSheetLine[];
}

// Build Schedule III balance sheet structure
function buildScheduleIIIStructure(accounts: {
  code: string;
  name: string;
  balance: number;
  accountType: string;
}[]): { assets: BalanceSheetLine[]; liabilities: BalanceSheetLine[]; equity: BalanceSheetLine[] } {
  const assets: BalanceSheetLine[] = [
    {
      code: 'NCA',
      name: 'Non-current Assets',
      amount: 0,
      children: [
        { code: 'NCA_PPE', name: 'Property, Plant and Equipment', amount: 0 },
        { code: 'NCA_INTANGIBLE', name: 'Intangible Assets', amount: 0 },
        { code: 'NCA_INVESTMENT', name: 'Non-current Investments', amount: 0 },
      ],
    },
    {
      code: 'CA',
      name: 'Current Assets',
      amount: 0,
      children: [
        { code: 'CA_INVENTORY', name: 'Inventories', amount: 0 },
        { code: 'CA_TRADE_RECEIVABLE', name: 'Trade Receivables', amount: 0 },
        { code: 'CA_CASH', name: 'Cash and Cash Equivalents', amount: 0 },
      ],
    },
  ];

  const liabilities: BalanceSheetLine[] = [
    {
      code: 'NCL',
      name: 'Non-current Liabilities',
      amount: 0,
      children: [
        { code: 'NCL_BORROWINGS', name: 'Long-term Borrowings', amount: 0 },
      ],
    },
    {
      code: 'CL',
      name: 'Current Liabilities',
      amount: 0,
      children: [
        { code: 'CL_TRADE_PAYABLE', name: 'Trade Payables', amount: 0 },
        { code: 'CL_BORROWINGS', name: 'Short-term Borrowings', amount: 0 },
      ],
    },
  ];

  const equity: BalanceSheetLine[] = [
    {
      code: 'EQUITY',
      name: "Shareholders' Equity",
      amount: 0,
      children: [
        { code: 'EQUITY_SHARE_CAPITAL', name: 'Share Capital', amount: 0 },
        { code: 'EQUITY_RESERVES', name: 'Reserves and Surplus', amount: 0 },
      ],
    },
  ];

  // Map accounts to structure
  accounts.forEach(account => {
    const category = mapToScheduleIII(account.code, account.name);
    if (!category) return;

    const findAndAdd = (lines: BalanceSheetLine[]) => {
      for (const line of lines) {
        if (line.code === category) {
          line.amount += account.balance;
          return true;
        }
        if (line.children) {
          for (const child of line.children) {
            if (child.code === category) {
              child.amount += account.balance;
              line.amount += account.balance; // Update parent too
              return true;
            }
          }
        }
      }
      return false;
    };

    findAndAdd(assets) || findAndAdd(liabilities) || findAndAdd(equity);
  });

  return { assets, liabilities, equity };
}

// Verify accounting equation
function verifyAccountingEquation(
  totalAssets: number,
  totalLiabilities: number,
  totalEquity: number
): { isBalanced: boolean; difference: number } {
  const difference = Math.abs(totalAssets - (totalLiabilities + totalEquity));
  return {
    isBalanced: difference < 0.01,
    difference,
  };
}

// Tests
describe('Schedule III Account Classification', () => {
  it('should classify land as PPE', () => {
    expect(mapToScheduleIII('1001', 'Land')).toBe('NCA_PPE');
  });

  it('should classify building as PPE', () => {
    expect(mapToScheduleIII('1002', 'Building')).toBe('NCA_PPE');
  });

  it('should classify machinery as PPE', () => {
    expect(mapToScheduleIII('1003', 'Plant and Machinery')).toBe('NCA_PPE');
  });

  it('should classify goodwill as intangible', () => {
    expect(mapToScheduleIII('1010', 'Goodwill')).toBe('NCA_INTANGIBLE');
  });

  it('should classify software as intangible', () => {
    expect(mapToScheduleIII('1011', 'Computer Software')).toBe('NCA_INTANGIBLE');
  });

  it('should classify inventory as current asset', () => {
    expect(mapToScheduleIII('1100', 'Inventory')).toBe('CA_INVENTORY');
  });

  it('should classify trade receivables as current asset', () => {
    expect(mapToScheduleIII('1101', 'Trade Receivables')).toBe('CA_TRADE_RECEIVABLE');
  });

  it('should classify sundry debtors as trade receivables', () => {
    expect(mapToScheduleIII('1102', 'Sundry Debtors')).toBe('CA_TRADE_RECEIVABLE');
  });

  it('should classify cash as current asset', () => {
    expect(mapToScheduleIII('1110', 'Cash in Hand')).toBe('CA_CASH');
  });

  it('should classify bank as current asset', () => {
    expect(mapToScheduleIII('1111', 'Bank Account')).toBe('CA_BANK');
  });

  it('should classify long-term loan as non-current liability', () => {
    expect(mapToScheduleIII('2001', 'Term Loan from Bank')).toBe('NCL_BORROWINGS');
  });

  it('should classify trade payables as current liability', () => {
    expect(mapToScheduleIII('2100', 'Trade Payables')).toBe('CL_TRADE_PAYABLE');
  });

  it('should classify share capital as equity', () => {
    expect(mapToScheduleIII('3001', 'Share Capital')).toBe('EQUITY_SHARE_CAPITAL');
  });

  it('should classify reserves as equity', () => {
    expect(mapToScheduleIII('3010', 'General Reserve')).toBe('EQUITY_RESERVES');
  });
});

describe('Schedule III Balance Sheet Structure', () => {
  it('should build correct structure with sample accounts', () => {
    const accounts = [
      { code: '1001', name: 'Land', balance: 500000, accountType: 'asset' },
      { code: '1002', name: 'Building', balance: 300000, accountType: 'asset' },
      { code: '1100', name: 'Inventory', balance: 100000, accountType: 'asset' },
      { code: '1101', name: 'Trade Receivables', balance: 150000, accountType: 'asset' },
      { code: '1110', name: 'Cash in Hand', balance: 50000, accountType: 'asset' },
      { code: '2100', name: 'Trade Payables', balance: 200000, accountType: 'liability' },
      { code: '3001', name: 'Share Capital', balance: 500000, accountType: 'equity' },
      { code: '3010', name: 'General Reserve', balance: 400000, accountType: 'equity' },
    ];

    const { assets, liabilities, equity } = buildScheduleIIIStructure(accounts);

    // Check non-current assets
    const nca = assets.find(a => a.code === 'NCA');
    expect(nca).toBeDefined();
    expect(nca!.amount).toBe(800000); // Land + Building

    // Check current assets
    const ca = assets.find(a => a.code === 'CA');
    expect(ca).toBeDefined();
    expect(ca!.amount).toBe(300000); // Inventory + Receivables + Cash

    // Check current liabilities
    const cl = liabilities.find(l => l.code === 'CL');
    expect(cl).toBeDefined();
    const tradePay = cl!.children!.find(c => c.code === 'CL_TRADE_PAYABLE');
    expect(tradePay!.amount).toBe(200000);

    // Check equity
    const eq = equity.find(e => e.code === 'EQUITY');
    expect(eq).toBeDefined();
    expect(eq!.amount).toBe(900000); // Share Capital + Reserve
  });
});

describe('Accounting Equation Verification', () => {
  it('should verify balanced equation', () => {
    const result = verifyAccountingEquation(1100000, 200000, 900000);
    expect(result.isBalanced).toBe(true);
    expect(result.difference).toBe(0);
  });

  it('should detect unbalanced equation', () => {
    const result = verifyAccountingEquation(1100000, 200000, 800000);
    expect(result.isBalanced).toBe(false);
    expect(result.difference).toBe(100000);
  });

  it('should handle floating point precision', () => {
    const result = verifyAccountingEquation(1000.001, 500.001, 500);
    expect(result.isBalanced).toBe(true);
  });
});

describe('P&L Statement Classification', () => {
  // Revenue recognition
  it('should classify service revenue correctly', () => {
    const isOperatingRevenue = (accountName: string): boolean => {
      const name = accountName.toLowerCase();
      return name.includes('service') ||
             name.includes('sales') ||
             name.includes('revenue from operations') ||
             name.includes('professional fees');
    };

    expect(isOperatingRevenue('Service Revenue')).toBe(true);
    expect(isOperatingRevenue('Professional Fees')).toBe(true);
    expect(isOperatingRevenue('Interest Income')).toBe(false);
  });

  // Expense classification
  it('should classify expenses by nature', () => {
    const classifyExpense = (accountName: string): string => {
      const name = accountName.toLowerCase();
      if (name.includes('salary') || name.includes('wages') || name.includes('staff')) {
        return 'employee_benefit';
      }
      if (name.includes('depreciation') || name.includes('amortization')) {
        return 'depreciation';
      }
      if (name.includes('interest')) {
        return 'finance_costs';
      }
      if (name.includes('rent') || name.includes('utility') || name.includes('telephone')) {
        return 'other_expenses';
      }
      return 'other_expenses';
    };

    expect(classifyExpense('Salary Expense')).toBe('employee_benefit');
    expect(classifyExpense('Depreciation - Building')).toBe('depreciation');
    expect(classifyExpense('Interest on Loan')).toBe('finance_costs');
    expect(classifyExpense('Rent Expense')).toBe('other_expenses');
  });
});
