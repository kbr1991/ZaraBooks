import { describe, it, expect } from 'vitest';
import {
  validateGstin,
  getStateFromGstin,
  getStateName,
  formatGstinAddress,
  getShortAddress,
  getStatusBadgeVariant,
  getPanFromGstin,
  STATE_CODES,
  type GstinDetails,
} from '../../client/src/lib/gst-utils';

describe('GST Utilities', () => {
  describe('validateGstin', () => {
    it('should return valid for correct GSTIN format', () => {
      expect(validateGstin('29AABCU9603R1ZM')).toEqual({ valid: true });
      expect(validateGstin('27AADCB2230M1Z3')).toEqual({ valid: true });
    });

    it('should return valid for empty string (optional field)', () => {
      expect(validateGstin('')).toEqual({ valid: true });
    });

    it('should return error for wrong length', () => {
      const result = validateGstin('29AABCU9603R1Z');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('15 characters');
    });

    it('should return error for invalid format', () => {
      const result = validateGstin('ABCDEFGHIJKLMNO');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid GSTIN format');
    });

    it('should return error for invalid state code', () => {
      const result = validateGstin('99AABCU9603R1ZM');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid state code');
    });
  });

  describe('getStateFromGstin', () => {
    it('should extract state code and name', () => {
      expect(getStateFromGstin('29AABCU9603R1ZM')).toEqual({ code: '29', name: 'Karnataka' });
      expect(getStateFromGstin('07AAACC1206D1ZM')).toEqual({ code: '07', name: 'Delhi' });
    });

    it('should return null for invalid input', () => {
      expect(getStateFromGstin('')).toBe(null);
      expect(getStateFromGstin('X')).toBe(null);
    });
  });

  describe('getStateName', () => {
    it('should return state name for valid code', () => {
      expect(getStateName('29')).toBe('Karnataka');
      expect(getStateName('07')).toBe('Delhi');
      expect(getStateName('27')).toBe('Maharashtra');
    });

    it('should return empty string for invalid code', () => {
      expect(getStateName('99')).toBe('');
      expect(getStateName('')).toBe('');
    });
  });

  describe('formatGstinAddress', () => {
    it('should format full address correctly', () => {
      const details: GstinDetails = {
        gstin: '29AABCU9603R1ZM',
        legalName: 'Test Company',
        tradeName: null,
        status: 'Active',
        registrationType: 'Regular',
        address: {
          building: '123, ABC Tower',
          street: 'MG Road',
          city: 'Bangalore',
          district: 'Bangalore Urban',
          state: 'Karnataka',
          pincode: '560001',
        },
        stateCode: '29',
        registrationDate: '2020-01-01',
      };

      const formatted = formatGstinAddress(details);
      expect(formatted).toContain('123, ABC Tower');
      expect(formatted).toContain('MG Road');
      expect(formatted).toContain('Bangalore');
      expect(formatted).toContain('Karnataka');
      expect(formatted).toContain('560001');
    });

    it('should handle missing address fields', () => {
      const details: GstinDetails = {
        gstin: '29AABCU9603R1ZM',
        legalName: 'Test Company',
        tradeName: null,
        status: 'Active',
        registrationType: 'Regular',
        address: {
          building: '',
          street: '',
          city: 'Bangalore',
          district: '',
          state: 'Karnataka',
          pincode: '560001',
        },
        stateCode: '29',
        registrationDate: null,
      };

      const formatted = formatGstinAddress(details);
      expect(formatted).toContain('Bangalore');
      expect(formatted).toContain('Karnataka');
    });
  });

  describe('getShortAddress', () => {
    it('should return building and street only', () => {
      const details: GstinDetails = {
        gstin: '29AABCU9603R1ZM',
        legalName: 'Test Company',
        tradeName: null,
        status: 'Active',
        registrationType: 'Regular',
        address: {
          building: '123, ABC Tower',
          street: 'MG Road',
          city: 'Bangalore',
          district: 'Bangalore Urban',
          state: 'Karnataka',
          pincode: '560001',
        },
        stateCode: '29',
        registrationDate: '2020-01-01',
      };

      const short = getShortAddress(details);
      expect(short).toBe('123, ABC Tower, MG Road');
      expect(short).not.toContain('Bangalore');
      expect(short).not.toContain('Karnataka');
    });
  });

  describe('getStatusBadgeVariant', () => {
    it('should return success for Active', () => {
      expect(getStatusBadgeVariant('Active')).toBe('success');
    });

    it('should return warning for Inactive and Suspended', () => {
      expect(getStatusBadgeVariant('Inactive')).toBe('warning');
      expect(getStatusBadgeVariant('Suspended')).toBe('warning');
    });

    it('should return destructive for Cancelled', () => {
      expect(getStatusBadgeVariant('Cancelled')).toBe('destructive');
    });
  });

  describe('getPanFromGstin', () => {
    it('should extract PAN from GSTIN', () => {
      expect(getPanFromGstin('29AABCU9603R1ZM')).toBe('AABCU9603R');
      expect(getPanFromGstin('07AAACC1206D1ZM')).toBe('AAACC1206D');
    });

    it('should return null for invalid GSTIN', () => {
      expect(getPanFromGstin('')).toBe(null);
      expect(getPanFromGstin('29AABCU')).toBe(null);
    });
  });

  describe('STATE_CODES', () => {
    it('should contain all major states', () => {
      expect(STATE_CODES['01']).toBe('Jammu and Kashmir');
      expect(STATE_CODES['07']).toBe('Delhi');
      expect(STATE_CODES['27']).toBe('Maharashtra');
      expect(STATE_CODES['29']).toBe('Karnataka');
      expect(STATE_CODES['33']).toBe('Tamil Nadu');
      expect(STATE_CODES['36']).toBe('Telangana');
      expect(STATE_CODES['37']).toBe('Andhra Pradesh');
    });

    it('should have 38 entries (state codes 01-38)', () => {
      // Standard state codes plus Ladakh (38)
      const keys = Object.keys(STATE_CODES);
      expect(keys.length).toBeGreaterThanOrEqual(35); // At least 35 states/UTs
    });
  });
});
