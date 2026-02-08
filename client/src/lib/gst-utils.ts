/**
 * GST Utility Functions
 *
 * State code mapping, GSTIN validation, and address formatting utilities
 */

// State code to state name mapping (Indian GST state codes 01-38)
export const STATE_CODES: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman and Diu',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (Old)',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

// State code to state code options for Select components
export const STATE_CODE_OPTIONS = Object.entries(STATE_CODES).map(([code, name]) => ({
  value: code,
  label: `${code} - ${name}`,
}));

/**
 * Validate GSTIN format
 * Format: 22AAAAA0000A1Z5 (15 characters)
 * - First 2 digits: State code (01-38)
 * - Next 10 characters: PAN
 * - 13th character: Entity number (1-9 or A-Z)
 * - 14th character: 'Z' by default
 * - 15th character: Check digit (0-9 or A-Z)
 */
export function validateGstin(gstin: string): { valid: boolean; error?: string } {
  if (!gstin) {
    return { valid: true }; // Empty is valid (optional field)
  }

  const normalizedGstin = gstin.toUpperCase().trim();

  if (normalizedGstin.length !== 15) {
    return { valid: false, error: 'GSTIN must be exactly 15 characters' };
  }

  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (!gstinRegex.test(normalizedGstin)) {
    return { valid: false, error: 'Invalid GSTIN format' };
  }

  // Validate state code
  const stateCode = normalizedGstin.substring(0, 2);
  if (!STATE_CODES[stateCode]) {
    return { valid: false, error: 'Invalid state code in GSTIN' };
  }

  return { valid: true };
}

/**
 * Get state from GSTIN
 */
export function getStateFromGstin(gstin: string): { code: string; name: string } | null {
  if (!gstin || gstin.length < 2) return null;
  const code = gstin.substring(0, 2);
  const name = STATE_CODES[code];
  return name ? { code, name } : null;
}

/**
 * Get state name from state code
 */
export function getStateName(stateCode: string): string {
  return STATE_CODES[stateCode] || '';
}

/**
 * GSTIN lookup response type (matches server response)
 */
export interface GstinDetails {
  gstin: string;
  legalName: string;
  tradeName: string | null;
  status: 'Active' | 'Inactive' | 'Cancelled' | 'Suspended';
  registrationType: string;
  address: {
    building: string;
    street: string;
    city: string;
    district: string;
    state: string;
    pincode: string;
  };
  stateCode: string;
  registrationDate: string | null;
}

/**
 * Format full address from GstinDetails
 */
export function formatGstinAddress(details: GstinDetails): string {
  const parts: string[] = [];

  if (details.address.building) {
    parts.push(details.address.building);
  }
  if (details.address.street) {
    parts.push(details.address.street);
  }
  if (details.address.city) {
    parts.push(details.address.city);
  }
  if (details.address.district && details.address.district !== details.address.city) {
    parts.push(details.address.district);
  }
  if (details.address.state) {
    parts.push(details.address.state);
  }
  if (details.address.pincode) {
    parts.push(`- ${details.address.pincode}`);
  }

  return parts.join(', ');
}

/**
 * Get short address (building + street only)
 */
export function getShortAddress(details: GstinDetails): string {
  const parts: string[] = [];

  if (details.address.building) {
    parts.push(details.address.building);
  }
  if (details.address.street) {
    parts.push(details.address.street);
  }

  return parts.join(', ');
}

/**
 * Get status badge variant based on GSTIN status
 */
export function getStatusBadgeVariant(status: GstinDetails['status']): 'success' | 'warning' | 'destructive' {
  switch (status) {
    case 'Active':
      return 'success';
    case 'Inactive':
    case 'Suspended':
      return 'warning';
    case 'Cancelled':
      return 'destructive';
    default:
      return 'warning';
  }
}

/**
 * Extract PAN from GSTIN
 * GSTIN format: SSPAPPPPPXNZC
 * Where PAN is characters 3-12 (APPPPP portion)
 */
export function getPanFromGstin(gstin: string): string | null {
  if (!gstin || gstin.length !== 15) return null;
  return gstin.substring(2, 12).toUpperCase();
}
