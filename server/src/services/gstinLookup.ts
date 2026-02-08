/**
 * GSTIN Lookup Service
 *
 * Provides GSTIN validation and business details lookup with caching.
 * Supports multiple providers: gstincheck.co.in (quick start) and NIC E-Invoice API (long-term)
 */

// GSTIN details response format
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

// Cache entry with TTL
interface CacheEntry {
  data: GstinDetails;
  timestamp: number;
}

// 24-hour cache TTL in milliseconds
const CACHE_TTL = 24 * 60 * 60 * 1000;

// In-memory cache
const cache = new Map<string, CacheEntry>();

// State code to state name mapping (Indian GST state codes)
const STATE_CODES: Record<string, string> = {
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
  '25': 'Daman and Diu', // Now part of Dadra and Nagar Haveli and Daman and Diu
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
  '97': 'Other Territory',
  '99': 'Centre Jurisdiction',
};

/**
 * Validate GSTIN format
 * Format: 22AAAAA0000A1Z5 (15 characters)
 * - First 2 digits: State code (01-37)
 * - Next 10 characters: PAN
 * - 13th character: Entity number
 * - 14th character: 'Z' by default
 * - 15th character: Check digit
 */
export function validateGstinFormat(gstin: string): boolean {
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin.toUpperCase());
}

/**
 * Extract state code from GSTIN
 */
export function getStateFromGstin(gstin: string): { code: string; name: string } | null {
  if (gstin.length < 2) return null;
  const code = gstin.substring(0, 2);
  const name = STATE_CODES[code];
  return name ? { code, name } : null;
}

/**
 * Get cached GSTIN details
 */
function getCached(gstin: string): GstinDetails | null {
  const entry = cache.get(gstin.toUpperCase());
  if (!entry) return null;

  // Check if cache is still valid
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(gstin.toUpperCase());
    return null;
  }

  return entry.data;
}

/**
 * Set cache entry
 */
function setCache(gstin: string, data: GstinDetails): void {
  cache.set(gstin.toUpperCase(), {
    data,
    timestamp: Date.now(),
  });
}

/**
 * Clear expired cache entries (call periodically if needed)
 */
export function clearExpiredCache(): void {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      cache.delete(key);
    }
  }
}

// Provider interface
interface GstinProvider {
  lookup(gstin: string): Promise<GstinDetails>;
}

/**
 * gstincheck.co.in Provider
 * Simple API with key authentication
 * Free tier: 20 requests for testing
 * Production: ~₹1-2 per lookup
 */
class GstinCheckProvider implements GstinProvider {
  private apiKey: string;
  private baseUrl = 'https://appyflow.in/api/verifyGST';

  constructor() {
    this.apiKey = process.env.GSTIN_API_KEY || '';
  }

  async lookup(gstin: string): Promise<GstinDetails> {
    if (!this.apiKey) {
      throw new Error('GSTIN_API_KEY environment variable not set');
    }

    const url = `${this.baseUrl}?gstNo=${gstin}&key_secret=${this.apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('GSTIN not found in GST portal');
      }
      throw new Error('Lookup service unavailable');
    }

    const data = await response.json();

    // Handle API error responses
    if (data.error || data.flag === false) {
      throw new Error(data.message || 'GSTIN not found in GST portal');
    }

    // Transform response to standard format
    return this.transformResponse(gstin, data);
  }

  private transformResponse(gstin: string, data: any): GstinDetails {
    // Extract address components
    const pradr = data.pradr || {};
    const addr = pradr.addr || {};

    // Map status
    let status: GstinDetails['status'] = 'Active';
    const apiStatus = (data.sts || '').toLowerCase();
    if (apiStatus.includes('inactive')) {
      status = 'Inactive';
    } else if (apiStatus.includes('cancelled')) {
      status = 'Cancelled';
    } else if (apiStatus.includes('suspended')) {
      status = 'Suspended';
    }

    // Map registration type
    const regTypeMap: Record<string, string> = {
      'Regular': 'Regular',
      'Composition': 'Composition',
      'Casual Taxable Person': 'Casual',
      'SEZ Unit': 'SEZ Unit',
      'SEZ Developer': 'SEZ Developer',
      'Input Service Distributor (ISD)': 'ISD',
      'TDS': 'TDS',
      'TCS': 'TCS',
      'UIN Holders': 'UIN',
      'Non-Resident OIDAR Service Provider': 'OIDAR',
      'Non-Resident Taxable Person': 'Non-Resident',
    };

    const registrationType = regTypeMap[data.dty || ''] || data.dty || 'Regular';

    // Build full address
    const building = [addr.bno, addr.bnm, addr.flno].filter(Boolean).join(', ');
    const street = [addr.st, addr.loc].filter(Boolean).join(', ');

    return {
      gstin: gstin.toUpperCase(),
      legalName: data.lgnm || '',
      tradeName: data.tradeNam || null,
      status,
      registrationType,
      address: {
        building: building || '',
        street: street || '',
        city: addr.city || addr.dst || '',
        district: addr.dst || '',
        state: addr.stcd ? STATE_CODES[addr.stcd] || addr.stcd : '',
        pincode: addr.pncd || '',
      },
      stateCode: gstin.substring(0, 2),
      registrationDate: data.rgdt || null,
    };
  }
}

/**
 * NIC E-Invoice API Provider (Placeholder for future implementation)
 * Official government source, free unlimited lookups
 * Requires GSP registration with NIC
 */
class NicApiProvider implements GstinProvider {
  async lookup(gstin: string): Promise<GstinDetails> {
    // This would use the nicApiService for authentication
    // For now, throw error indicating setup needed
    throw new Error('NIC E-Invoice API provider not yet configured. Please set up GSP registration with NIC.');
  }
}

/**
 * GSTIN Lookup Service
 * Main service class that handles caching and provider selection
 */
class GstinLookupService {
  private provider: GstinProvider;

  constructor() {
    // Select provider based on environment variable
    const providerType = process.env.GSTIN_PROVIDER || 'gstincheck';

    switch (providerType.toLowerCase()) {
      case 'nic':
        this.provider = new NicApiProvider();
        break;
      case 'gstincheck':
      default:
        this.provider = new GstinCheckProvider();
        break;
    }
  }

  /**
   * Lookup GSTIN details
   * Returns cached data if available, otherwise fetches from provider
   */
  async lookup(gstin: string): Promise<GstinDetails> {
    const normalizedGstin = gstin.toUpperCase().trim();

    // Validate format
    if (!validateGstinFormat(normalizedGstin)) {
      throw new Error('Invalid GSTIN format. GSTIN must be 15 characters.');
    }

    // Check cache first
    const cached = getCached(normalizedGstin);
    if (cached) {
      return cached;
    }

    // Fetch from provider
    const details = await this.provider.lookup(normalizedGstin);

    // Cache the result
    setCache(normalizedGstin, details);

    return details;
  }

  /**
   * Get state name from state code
   */
  getStateName(stateCode: string): string | null {
    return STATE_CODES[stateCode] || null;
  }

  /**
   * Get all state codes
   */
  getStateCodes(): Record<string, string> {
    return { ...STATE_CODES };
  }
}

// Export singleton instance
export const gstinLookupService = new GstinLookupService();
