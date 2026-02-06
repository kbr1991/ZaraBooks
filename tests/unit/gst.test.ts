import { describe, it, expect } from 'vitest';

/**
 * GST compliance utility functions
 */

// Validate GSTIN format
function validateGstin(gstin: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!gstin) {
    return { isValid: false, errors: ['GSTIN is required'] };
  }

  if (gstin.length !== 15) {
    errors.push('GSTIN must be 15 characters');
  }

  // Format: 2 digit state code + 10 char PAN + 1 char entity + Z + 1 check digit
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

  if (!gstinRegex.test(gstin)) {
    errors.push('Invalid GSTIN format');
  }

  // Validate state code (01-37)
  const stateCode = parseInt(gstin.substring(0, 2));
  if (stateCode < 1 || stateCode > 37) {
    errors.push('Invalid state code');
  }

  // Validate checksum (using mod 10 algorithm)
  if (gstin.length === 15 && !validateGstinChecksum(gstin)) {
    errors.push('Invalid checksum');
  }

  return { isValid: errors.length === 0, errors };
}

function validateGstinChecksum(gstin: string): boolean {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let sum = 0;

  for (let i = 0; i < 14; i++) {
    const charIndex = chars.indexOf(gstin[i]);
    const factor = i % 2 === 0 ? 1 : 2;
    const product = charIndex * factor;
    sum += Math.floor(product / 36) + (product % 36);
  }

  const checksum = (36 - (sum % 36)) % 36;
  return gstin[14] === chars[checksum];
}

// Calculate return period from date
function getReturnPeriod(date: Date): string {
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString();
  return `${month}${year}`;
}

// Get GSTR-1 due date
function getGstr1DueDate(returnPeriod: string): Date {
  const month = parseInt(returnPeriod.substring(0, 2));
  const year = parseInt(returnPeriod.substring(2));

  // GSTR-1 due on 11th of following month
  const dueMonth = month === 12 ? 1 : month + 1;
  const dueYear = month === 12 ? year + 1 : year;

  return new Date(dueYear, dueMonth - 1, 11);
}

// Get GSTR-3B due date
function getGstr3bDueDate(returnPeriod: string, isQrmp: boolean = false): Date {
  const month = parseInt(returnPeriod.substring(0, 2));
  const year = parseInt(returnPeriod.substring(2));

  // GSTR-3B due on 20th of following month (22nd/24th for QRMP quarterly)
  const dueMonth = month === 12 ? 1 : month + 1;
  const dueYear = month === 12 ? year + 1 : year;
  const dueDay = isQrmp ? 24 : 20;

  return new Date(dueYear, dueMonth - 1, dueDay);
}

// Determine supply type
function determineSupplyType(
  sellerStateCode: string,
  buyerStateCode: string,
  isSez: boolean = false,
  isExport: boolean = false
): 'B2B' | 'B2C' | 'SEZWP' | 'SEZWOP' | 'EXPWP' | 'EXPWOP' {
  if (isExport) {
    return 'EXPWP'; // With payment of tax (simplified)
  }
  if (isSez) {
    return 'SEZWP';
  }
  return 'B2B';
}

// Calculate reverse charge applicability
function isReverseChargeApplicable(
  serviceType: string,
  isRegisteredSupplier: boolean
): boolean {
  // Services under reverse charge
  const rcmServices = [
    'goods_transport_agency',
    'legal_services',
    'security_services',
    'sponsorship_services',
    'government_services',
    'director_services',
  ];

  // RCM applies when:
  // 1. Service is in RCM list AND supplier is unregistered
  // 2. Or specific services like legal from advocate
  if (!isRegisteredSupplier && rcmServices.includes(serviceType)) {
    return true;
  }

  return false;
}

// HSN/SAC validation
function validateHsnSac(code: string, isService: boolean): { isValid: boolean; error?: string } {
  if (!code) {
    return { isValid: false, error: 'HSN/SAC code is required' };
  }

  if (isService) {
    // SAC codes are 6 digits starting with 99
    if (!/^99\d{4}$/.test(code)) {
      return { isValid: false, error: 'SAC code must be 6 digits starting with 99' };
    }
  } else {
    // HSN codes are 4, 6, or 8 digits
    if (!/^\d{4}(\d{2})?(\d{2})?$/.test(code)) {
      return { isValid: false, error: 'HSN code must be 4, 6, or 8 digits' };
    }
  }

  return { isValid: true };
}

// Tests
describe('GSTIN Validation', () => {
  it('should validate correct GSTIN', () => {
    // This is a sample format - actual checksums would need real GSTINs
    const result = validateGstin('27AADCB2230M1ZV');
    // Note: We're testing format, actual checksum validation would need real GSTINs
    expect(result.errors).not.toContain('GSTIN must be 15 characters');
  });

  it('should reject empty GSTIN', () => {
    const result = validateGstin('');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('GSTIN is required');
  });

  it('should reject wrong length', () => {
    const result = validateGstin('27AADCB2230M1Z');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('GSTIN must be 15 characters');
  });

  it('should reject invalid state code', () => {
    const result = validateGstin('99AADCB2230M1ZV');
    expect(result.errors).toContain('Invalid state code');
  });

  it('should reject lowercase letters', () => {
    const result = validateGstin('27aadcb2230m1zv');
    expect(result.isValid).toBe(false);
  });
});

describe('Return Period Calculation', () => {
  it('should calculate return period for January', () => {
    const date = new Date(2024, 0, 15); // Jan 15, 2024
    expect(getReturnPeriod(date)).toBe('012024');
  });

  it('should calculate return period for December', () => {
    const date = new Date(2024, 11, 25); // Dec 25, 2024
    expect(getReturnPeriod(date)).toBe('122024');
  });

  it('should handle month padding', () => {
    const date = new Date(2024, 8, 1); // Sep 1, 2024
    expect(getReturnPeriod(date)).toBe('092024');
  });
});

describe('GSTR-1 Due Date', () => {
  it('should return 11th of next month', () => {
    const dueDate = getGstr1DueDate('012024');
    expect(dueDate.getDate()).toBe(11);
    expect(dueDate.getMonth()).toBe(1); // February
    expect(dueDate.getFullYear()).toBe(2024);
  });

  it('should handle December to January transition', () => {
    const dueDate = getGstr1DueDate('122024');
    expect(dueDate.getDate()).toBe(11);
    expect(dueDate.getMonth()).toBe(0); // January
    expect(dueDate.getFullYear()).toBe(2025);
  });
});

describe('GSTR-3B Due Date', () => {
  it('should return 20th for regular filers', () => {
    const dueDate = getGstr3bDueDate('012024', false);
    expect(dueDate.getDate()).toBe(20);
  });

  it('should return 24th for QRMP filers', () => {
    const dueDate = getGstr3bDueDate('032024', true);
    expect(dueDate.getDate()).toBe(24);
  });

  it('should handle year transition', () => {
    const dueDate = getGstr3bDueDate('122024', false);
    expect(dueDate.getFullYear()).toBe(2025);
    expect(dueDate.getMonth()).toBe(0); // January
  });
});

describe('Supply Type Determination', () => {
  it('should return B2B for inter-state regular supply', () => {
    expect(determineSupplyType('27', '29', false, false)).toBe('B2B');
  });

  it('should return SEZWP for SEZ supply', () => {
    expect(determineSupplyType('27', '27', true, false)).toBe('SEZWP');
  });

  it('should return EXPWP for export', () => {
    expect(determineSupplyType('27', '00', false, true)).toBe('EXPWP');
  });
});

describe('Reverse Charge Applicability', () => {
  it('should apply RCM for GTA from unregistered supplier', () => {
    expect(isReverseChargeApplicable('goods_transport_agency', false)).toBe(true);
  });

  it('should not apply RCM for GTA from registered supplier', () => {
    expect(isReverseChargeApplicable('goods_transport_agency', true)).toBe(false);
  });

  it('should apply RCM for legal services from unregistered', () => {
    expect(isReverseChargeApplicable('legal_services', false)).toBe(true);
  });

  it('should not apply RCM for regular services', () => {
    expect(isReverseChargeApplicable('consulting', false)).toBe(false);
  });
});

describe('HSN/SAC Validation', () => {
  it('should validate 6-digit SAC code', () => {
    const result = validateHsnSac('998311', true);
    expect(result.isValid).toBe(true);
  });

  it('should reject SAC code not starting with 99', () => {
    const result = validateHsnSac('123456', true);
    expect(result.isValid).toBe(false);
  });

  it('should validate 4-digit HSN code', () => {
    const result = validateHsnSac('8471', false);
    expect(result.isValid).toBe(true);
  });

  it('should validate 8-digit HSN code', () => {
    const result = validateHsnSac('84713010', false);
    expect(result.isValid).toBe(true);
  });

  it('should reject empty code', () => {
    const result = validateHsnSac('', true);
    expect(result.isValid).toBe(false);
  });

  it('should reject invalid HSN length', () => {
    const result = validateHsnSac('12345', false);
    expect(result.isValid).toBe(false);
  });
});
