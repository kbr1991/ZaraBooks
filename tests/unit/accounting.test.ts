import { describe, it, expect } from 'vitest';

/**
 * Accounting utility functions for testing
 */

// Double-entry validation
function validateDoubleEntry(lines: { debitAmount: number; creditAmount: number }[]): {
  isValid: boolean;
  totalDebit: number;
  totalCredit: number;
  difference: number;
} {
  const totalDebit = lines.reduce((sum, line) => sum + (line.debitAmount || 0), 0);
  const totalCredit = lines.reduce((sum, line) => sum + (line.creditAmount || 0), 0);
  const difference = Math.abs(totalDebit - totalCredit);

  return {
    isValid: difference < 0.01,
    totalDebit,
    totalCredit,
    difference,
  };
}

// Trial balance computation
function computeTrialBalance(entries: {
  accountId: string;
  accountType: 'asset' | 'liability' | 'equity' | 'income' | 'expense';
  debitAmount: number;
  creditAmount: number;
}[]): Map<string, { debit: number; credit: number; accountType: string }> {
  const balances = new Map<string, { debit: number; credit: number; accountType: string }>();

  entries.forEach(entry => {
    const current = balances.get(entry.accountId) || { debit: 0, credit: 0, accountType: entry.accountType };
    current.debit += entry.debitAmount || 0;
    current.credit += entry.creditAmount || 0;
    current.accountType = entry.accountType;
    balances.set(entry.accountId, current);
  });

  return balances;
}

// Calculate account balance based on account type
function calculateAccountBalance(
  accountType: 'asset' | 'liability' | 'equity' | 'income' | 'expense',
  totalDebit: number,
  totalCredit: number
): number {
  // Assets and Expenses are debit-normal accounts
  // Liabilities, Equity, and Income are credit-normal accounts
  if (accountType === 'asset' || accountType === 'expense') {
    return totalDebit - totalCredit;
  } else {
    return totalCredit - totalDebit;
  }
}

// GST calculation
function calculateGst(
  amount: number,
  rate: number,
  isInterState: boolean
): { igst: number; cgst: number; sgst: number; total: number } {
  const taxAmount = (amount * rate) / 100;

  if (isInterState) {
    return { igst: taxAmount, cgst: 0, sgst: 0, total: taxAmount };
  } else {
    const halfTax = taxAmount / 2;
    return { igst: 0, cgst: halfTax, sgst: halfTax, total: taxAmount };
  }
}

// TDS calculation
function calculateTds(
  amount: number,
  rate: number,
  threshold: number
): { tdsAmount: number; netPayable: number; isApplicable: boolean } {
  const isApplicable = amount >= threshold;
  const tdsAmount = isApplicable ? (amount * rate) / 100 : 0;

  return {
    tdsAmount,
    netPayable: amount - tdsAmount,
    isApplicable,
  };
}

// Currency formatting (Indian format)
function formatIndianCurrency(amount: number): string {
  if (amount < 0) {
    return `(${formatIndianCurrency(Math.abs(amount))})`;
  }

  const parts = amount.toFixed(2).split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1];

  // Indian numbering: 1,00,00,000 format
  let lastThree = integerPart.slice(-3);
  const otherNumbers = integerPart.slice(0, -3);

  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }

  const formattedOthers = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',');

  return `₹${formattedOthers}${lastThree}.${decimalPart}`;
}

// Tests
describe('Double Entry Validation', () => {
  it('should validate balanced entries', () => {
    const lines = [
      { debitAmount: 1000, creditAmount: 0 },
      { debitAmount: 0, creditAmount: 1000 },
    ];

    const result = validateDoubleEntry(lines);
    expect(result.isValid).toBe(true);
    expect(result.totalDebit).toBe(1000);
    expect(result.totalCredit).toBe(1000);
    expect(result.difference).toBe(0);
  });

  it('should reject unbalanced entries', () => {
    const lines = [
      { debitAmount: 1000, creditAmount: 0 },
      { debitAmount: 0, creditAmount: 500 },
    ];

    const result = validateDoubleEntry(lines);
    expect(result.isValid).toBe(false);
    expect(result.difference).toBe(500);
  });

  it('should handle multiple lines', () => {
    const lines = [
      { debitAmount: 5000, creditAmount: 0 },
      { debitAmount: 900, creditAmount: 0 },
      { debitAmount: 0, creditAmount: 4500 },
      { debitAmount: 0, creditAmount: 1400 },
    ];

    const result = validateDoubleEntry(lines);
    expect(result.isValid).toBe(true);
    expect(result.totalDebit).toBe(5900);
    expect(result.totalCredit).toBe(5900);
  });

  it('should handle floating point precision', () => {
    const lines = [
      { debitAmount: 33.33, creditAmount: 0 },
      { debitAmount: 33.33, creditAmount: 0 },
      { debitAmount: 33.34, creditAmount: 0 },
      { debitAmount: 0, creditAmount: 100 },
    ];

    const result = validateDoubleEntry(lines);
    expect(result.isValid).toBe(true);
  });
});

describe('Trial Balance Computation', () => {
  it('should aggregate entries by account', () => {
    const entries = [
      { accountId: 'cash', accountType: 'asset' as const, debitAmount: 5000, creditAmount: 0 },
      { accountId: 'cash', accountType: 'asset' as const, debitAmount: 3000, creditAmount: 0 },
      { accountId: 'cash', accountType: 'asset' as const, debitAmount: 0, creditAmount: 2000 },
    ];

    const balances = computeTrialBalance(entries);
    const cashBalance = balances.get('cash');

    expect(cashBalance).toBeDefined();
    expect(cashBalance!.debit).toBe(8000);
    expect(cashBalance!.credit).toBe(2000);
  });

  it('should handle multiple accounts', () => {
    const entries = [
      { accountId: 'cash', accountType: 'asset' as const, debitAmount: 10000, creditAmount: 0 },
      { accountId: 'capital', accountType: 'equity' as const, debitAmount: 0, creditAmount: 10000 },
      { accountId: 'cash', accountType: 'asset' as const, debitAmount: 0, creditAmount: 5000 },
      { accountId: 'equipment', accountType: 'asset' as const, debitAmount: 5000, creditAmount: 0 },
    ];

    const balances = computeTrialBalance(entries);

    expect(balances.size).toBe(3);
    expect(balances.get('cash')!.debit).toBe(10000);
    expect(balances.get('cash')!.credit).toBe(5000);
    expect(balances.get('capital')!.credit).toBe(10000);
    expect(balances.get('equipment')!.debit).toBe(5000);
  });
});

describe('Account Balance Calculation', () => {
  it('should calculate asset balance correctly', () => {
    const balance = calculateAccountBalance('asset', 10000, 3000);
    expect(balance).toBe(7000); // Debit - Credit
  });

  it('should calculate liability balance correctly', () => {
    const balance = calculateAccountBalance('liability', 2000, 8000);
    expect(balance).toBe(6000); // Credit - Debit
  });

  it('should calculate income balance correctly', () => {
    const balance = calculateAccountBalance('income', 0, 50000);
    expect(balance).toBe(50000);
  });

  it('should calculate expense balance correctly', () => {
    const balance = calculateAccountBalance('expense', 30000, 0);
    expect(balance).toBe(30000);
  });

  it('should handle negative balances', () => {
    const balance = calculateAccountBalance('asset', 1000, 5000);
    expect(balance).toBe(-4000); // Overdrawn asset
  });
});

describe('GST Calculation', () => {
  it('should calculate IGST for inter-state supply', () => {
    const gst = calculateGst(10000, 18, true);
    expect(gst.igst).toBe(1800);
    expect(gst.cgst).toBe(0);
    expect(gst.sgst).toBe(0);
    expect(gst.total).toBe(1800);
  });

  it('should calculate CGST/SGST for intra-state supply', () => {
    const gst = calculateGst(10000, 18, false);
    expect(gst.igst).toBe(0);
    expect(gst.cgst).toBe(900);
    expect(gst.sgst).toBe(900);
    expect(gst.total).toBe(1800);
  });

  it('should handle 5% rate', () => {
    const gst = calculateGst(20000, 5, false);
    expect(gst.cgst).toBe(500);
    expect(gst.sgst).toBe(500);
    expect(gst.total).toBe(1000);
  });

  it('should handle 28% rate', () => {
    const gst = calculateGst(10000, 28, true);
    expect(gst.igst).toBe(2800);
    expect(gst.total).toBe(2800);
  });

  it('should handle zero-rated supply', () => {
    const gst = calculateGst(10000, 0, true);
    expect(gst.igst).toBe(0);
    expect(gst.total).toBe(0);
  });
});

describe('TDS Calculation', () => {
  it('should calculate TDS when amount exceeds threshold', () => {
    const tds = calculateTds(50000, 10, 30000);
    expect(tds.isApplicable).toBe(true);
    expect(tds.tdsAmount).toBe(5000);
    expect(tds.netPayable).toBe(45000);
  });

  it('should not apply TDS when amount is below threshold', () => {
    const tds = calculateTds(25000, 10, 30000);
    expect(tds.isApplicable).toBe(false);
    expect(tds.tdsAmount).toBe(0);
    expect(tds.netPayable).toBe(25000);
  });

  it('should apply TDS at exact threshold', () => {
    const tds = calculateTds(30000, 10, 30000);
    expect(tds.isApplicable).toBe(true);
    expect(tds.tdsAmount).toBe(3000);
  });

  it('should handle 194J professional fees (10%)', () => {
    const tds = calculateTds(100000, 10, 30000);
    expect(tds.tdsAmount).toBe(10000);
  });

  it('should handle 194C contractor payments (2%)', () => {
    const tds = calculateTds(100000, 2, 30000);
    expect(tds.tdsAmount).toBe(2000);
  });
});

describe('Indian Currency Formatting', () => {
  it('should format small amounts', () => {
    expect(formatIndianCurrency(500)).toBe('₹500.00');
  });

  it('should format thousands', () => {
    expect(formatIndianCurrency(5000)).toBe('₹5,000.00');
  });

  it('should format lakhs', () => {
    expect(formatIndianCurrency(100000)).toBe('₹1,00,000.00');
  });

  it('should format crores', () => {
    expect(formatIndianCurrency(10000000)).toBe('₹1,00,00,000.00');
  });

  it('should format large amounts', () => {
    expect(formatIndianCurrency(123456789)).toBe('₹12,34,56,789.00');
  });

  it('should format negative amounts in parentheses', () => {
    expect(formatIndianCurrency(-5000)).toBe('(₹5,000.00)');
  });

  it('should preserve decimal places', () => {
    expect(formatIndianCurrency(1234.56)).toBe('₹1,234.56');
  });
});
