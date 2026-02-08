import { describe, it, expect } from 'vitest';
import { validateGstinFormat, getStateFromGstin } from '../../server/src/services/gstinLookup';

describe('GSTIN Lookup Service', () => {
  describe('validateGstinFormat', () => {
    it('should validate correct GSTIN format', () => {
      // Valid GSTINs
      expect(validateGstinFormat('29AABCU9603R1ZM')).toBe(true);
      expect(validateGstinFormat('27AADCB2230M1Z3')).toBe(true);
      expect(validateGstinFormat('07AAACC1206D1ZM')).toBe(true);
      expect(validateGstinFormat('22AAAAA0000A1Z5')).toBe(true);
    });

    it('should reject invalid GSTIN format', () => {
      // Invalid GSTINs
      expect(validateGstinFormat('')).toBe(false);
      expect(validateGstinFormat('29AABCU9603R1Z')).toBe(false);  // Too short (14 chars)
      expect(validateGstinFormat('29AABCU9603R1ZMX')).toBe(false); // Too long (16 chars)
      expect(validateGstinFormat('29AABCU9603R1AM')).toBe(false);  // Missing Z at position 14
    });

    it('should accept lowercase GSTIN (normalized to uppercase)', () => {
      // Lowercase is valid because it gets normalized
      expect(validateGstinFormat('29aabcu9603r1zm')).toBe(true);
    });

    it('should handle edge cases', () => {
      expect(validateGstinFormat('12345')).toBe(false);
      expect(validateGstinFormat('ABCDEFGHIJKLMNO')).toBe(false);
      expect(validateGstinFormat('123456789012345')).toBe(false);
    });
  });

  describe('getStateFromGstin', () => {
    it('should extract state code and name from valid GSTIN', () => {
      const result = getStateFromGstin('29AABCU9603R1ZM');
      expect(result).toEqual({ code: '29', name: 'Karnataka' });
    });

    it('should return correct states for various state codes', () => {
      expect(getStateFromGstin('07AAACC1206D1ZM')).toEqual({ code: '07', name: 'Delhi' });
      expect(getStateFromGstin('27AADCB2230M1Z3')).toEqual({ code: '27', name: 'Maharashtra' });
      expect(getStateFromGstin('33AABCT1332L1ZP')).toEqual({ code: '33', name: 'Tamil Nadu' });
      expect(getStateFromGstin('22AAAAA0000A1Z5')).toEqual({ code: '22', name: 'Chhattisgarh' });
    });

    it('should return null for empty or too short input', () => {
      expect(getStateFromGstin('')).toBe(null);
      expect(getStateFromGstin('0')).toBe(null);
    });

    it('should return null for invalid state code', () => {
      // 00 is not a valid state code
      expect(getStateFromGstin('00AABCU9603R1ZM')).toBe(null);
      // 45 is not a valid state code
      expect(getStateFromGstin('45AABCU9603R1ZM')).toBe(null);
    });

    it('should return valid for special state codes', () => {
      // 99 is Centre Jurisdiction (valid)
      expect(getStateFromGstin('99AABCU9603R1ZM')).toEqual({ code: '99', name: 'Centre Jurisdiction' });
      // 97 is Other Territory (valid)
      expect(getStateFromGstin('97AABCU9603R1ZM')).toEqual({ code: '97', name: 'Other Territory' });
    });
  });
});
