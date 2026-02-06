/**
 * NIC E-Invoice API Integration
 *
 * API Documentation: https://einvoice1.gst.gov.in/
 *
 * This service handles:
 * - Authentication with NIC portal
 * - IRN (Invoice Reference Number) generation
 * - E-Invoice cancellation
 * - E-Way Bill generation
 */

import crypto from 'crypto';

interface NicConfig {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  gstin: string;
  baseUrl: string;
}

interface AuthToken {
  authToken: string;
  tokenExpiry: Date;
  sek: string; // Session Encryption Key
}

interface EInvoiceData {
  version: string;
  tranDtls: {
    taxSch: string;
    supTyp: string;
    regRev: string;
    ecmGstin?: string;
    igstOnIntra: string;
  };
  docDtls: {
    typ: string;
    no: string;
    dt: string;
  };
  sellerDtls: {
    gstin: string;
    lglNm: string;
    trdNm?: string;
    addr1: string;
    addr2?: string;
    loc: string;
    pin: number;
    stcd: string;
    ph?: string;
    em?: string;
  };
  buyerDtls: {
    gstin: string;
    lglNm: string;
    trdNm?: string;
    pos: string;
    addr1: string;
    addr2?: string;
    loc: string;
    pin: number;
    stcd: string;
    ph?: string;
    em?: string;
  };
  itemList: Array<{
    slNo: string;
    prdDesc: string;
    isServc: string;
    hsnCd: string;
    qty?: number;
    freeQty?: number;
    unit?: string;
    unitPrice: number;
    totAmt: number;
    discount?: number;
    preTaxVal?: number;
    assAmt: number;
    gstRt: number;
    igstAmt?: number;
    cgstAmt?: number;
    sgstAmt?: number;
    cessRt?: number;
    cessAmt?: number;
    cessNonAdvlAmt?: number;
    stateCessRt?: number;
    stateCessAmt?: number;
    stateCessNonAdvlAmt?: number;
    othChrg?: number;
    totItemVal: number;
  }>;
  valDtls: {
    assVal: number;
    cgstVal?: number;
    sgstVal?: number;
    igstVal?: number;
    cessVal?: number;
    stCesVal?: number;
    discount?: number;
    othChrg?: number;
    rndOffAmt?: number;
    totInvVal: number;
    totInvValFc?: number;
  };
  payDtls?: {
    nm?: string;
    accDet?: string;
    mode?: string;
    finInsBr?: string;
    payTerm?: string;
    payInstr?: string;
    crTrn?: string;
    dirDr?: string;
    crDay?: number;
    paidAmt?: number;
    paymtDue?: number;
  };
  refDtls?: {
    invRm?: string;
    docPerdDtls?: {
      invStDt?: string;
      invEndDt?: string;
    };
    precDocDtls?: Array<{
      invNo?: string;
      invDt?: string;
      othRefNo?: string;
    }>;
    contrDtls?: Array<{
      recAdvRef?: string;
      recAdvDt?: string;
      tendRefr?: string;
      contrRefr?: string;
      extRefr?: string;
      projRefr?: string;
      poRefr?: string;
      poRefDt?: string;
    }>;
  };
  ewbDtls?: {
    transId?: string;
    transName?: string;
    transMode?: string;
    distance: number;
    transDocNo?: string;
    transDocDt?: string;
    vehNo?: string;
    vehType?: string;
  };
}

interface EInvoiceResponse {
  success: boolean;
  ackNo?: string;
  ackDt?: string;
  irn?: string;
  signedInvoice?: string;
  signedQRCode?: string;
  ewbNo?: string;
  ewbDt?: string;
  ewbValidTill?: string;
  status?: string;
  error?: {
    code: string;
    message: string;
    details?: string[];
  };
}

class NicApiService {
  private config: NicConfig;
  private authToken: AuthToken | null = null;

  constructor() {
    this.config = {
      clientId: process.env.NIC_EINVOICE_CLIENT_ID || '',
      clientSecret: process.env.NIC_EINVOICE_CLIENT_SECRET || '',
      username: process.env.NIC_EINVOICE_USERNAME || '',
      password: process.env.NIC_EINVOICE_PASSWORD || '',
      gstin: process.env.NIC_EINVOICE_GSTIN || '',
      baseUrl: process.env.NIC_EINVOICE_URL || 'https://einvoice1.gst.gov.in',
    };
  }

  /**
   * Check if NIC API is configured
   */
  isConfigured(): boolean {
    return !!(
      this.config.clientId &&
      this.config.clientSecret &&
      this.config.username &&
      this.config.password &&
      this.config.gstin
    );
  }

  /**
   * Encrypt data using AES-256
   */
  private encryptWithAes(data: string, key: Buffer): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return Buffer.concat([iv, Buffer.from(encrypted, 'base64')]).toString('base64');
  }

  /**
   * Decrypt data using AES-256
   */
  private decryptWithAes(encryptedData: string, key: Buffer): string {
    const data = Buffer.from(encryptedData, 'base64');
    const iv = data.subarray(0, 16);
    const encrypted = data.subarray(16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  }

  /**
   * Generate app key for authentication
   */
  private generateAppKey(): { appKey: string; encryptedKey: string } {
    const appKey = crypto.randomBytes(32);
    // In production, encrypt with NIC's public key
    return {
      appKey: appKey.toString('base64'),
      encryptedKey: appKey.toString('base64'), // Placeholder - use RSA in production
    };
  }

  /**
   * Authenticate with NIC portal
   */
  async authenticate(): Promise<AuthToken> {
    if (!this.isConfigured()) {
      throw new Error('NIC API is not configured. Please set environment variables.');
    }

    // Check if existing token is valid
    if (this.authToken && this.authToken.tokenExpiry > new Date()) {
      return this.authToken;
    }

    try {
      const { appKey, encryptedKey } = this.generateAppKey();

      const response = await fetch(`${this.config.baseUrl}/eivital/v1.04/auth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'client_id': this.config.clientId,
          'client_secret': this.config.clientSecret,
          'gstin': this.config.gstin,
        },
        body: JSON.stringify({
          UserName: this.config.username,
          Password: this.config.password,
          AppKey: encryptedKey,
          ForceRefreshAccessToken: false,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Authentication failed: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();

      if (data.Status !== 1) {
        throw new Error(`Authentication failed: ${data.ErrorDetails?.[0]?.ErrorMessage || 'Unknown error'}`);
      }

      // Decrypt session encryption key using app key
      const sekBuffer = Buffer.from(appKey, 'base64');

      this.authToken = {
        authToken: data.Data.AuthToken,
        tokenExpiry: new Date(Date.now() + (data.Data.TokenExpiry * 1000) - 60000), // 1 min buffer
        sek: data.Data.Sek, // Encrypted SEK - decrypt in production
      };

      return this.authToken;
    } catch (error: any) {
      console.error('NIC Authentication error:', error);
      throw new Error(`NIC Authentication failed: ${error.message}`);
    }
  }

  /**
   * Generate E-Invoice (Get IRN)
   */
  async generateEInvoice(invoiceData: EInvoiceData): Promise<EInvoiceResponse> {
    try {
      const auth = await this.authenticate();

      // In production, encrypt invoice data with SEK
      const encryptedData = JSON.stringify(invoiceData);

      const response = await fetch(`${this.config.baseUrl}/eicore/v1.03/Invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'client_id': this.config.clientId,
          'client_secret': this.config.clientSecret,
          'gstin': this.config.gstin,
          'AuthToken': auth.authToken,
        },
        body: JSON.stringify({
          Data: encryptedData,
        }),
      });

      const result = await response.json();

      if (result.Status !== 1) {
        return {
          success: false,
          error: {
            code: result.ErrorDetails?.[0]?.ErrorCode || 'UNKNOWN',
            message: result.ErrorDetails?.[0]?.ErrorMessage || 'E-Invoice generation failed',
            details: result.ErrorDetails?.map((e: any) => e.ErrorMessage),
          },
        };
      }

      // In production, decrypt response data with SEK
      const decryptedData = result.Data;

      return {
        success: true,
        ackNo: decryptedData.AckNo?.toString(),
        ackDt: decryptedData.AckDt,
        irn: decryptedData.Irn,
        signedInvoice: decryptedData.SignedInvoice,
        signedQRCode: decryptedData.SignedQRCode,
        status: 'ACT',
      };
    } catch (error: any) {
      console.error('E-Invoice generation error:', error);
      return {
        success: false,
        error: {
          code: 'EXCEPTION',
          message: error.message,
        },
      };
    }
  }

  /**
   * Cancel E-Invoice
   */
  async cancelEInvoice(
    irn: string,
    cancelReason: '1' | '2' | '3' | '4', // 1=Duplicate, 2=Data Entry Mistake, 3=Order Cancelled, 4=Others
    cancelRemarks: string
  ): Promise<EInvoiceResponse> {
    try {
      const auth = await this.authenticate();

      const cancelData = {
        Irn: irn,
        CnlRsn: cancelReason,
        CnlRem: cancelRemarks,
      };

      const response = await fetch(`${this.config.baseUrl}/eicore/v1.03/Invoice/Cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'client_id': this.config.clientId,
          'client_secret': this.config.clientSecret,
          'gstin': this.config.gstin,
          'AuthToken': auth.authToken,
        },
        body: JSON.stringify({
          Data: JSON.stringify(cancelData),
        }),
      });

      const result = await response.json();

      if (result.Status !== 1) {
        return {
          success: false,
          error: {
            code: result.ErrorDetails?.[0]?.ErrorCode || 'UNKNOWN',
            message: result.ErrorDetails?.[0]?.ErrorMessage || 'E-Invoice cancellation failed',
          },
        };
      }

      return {
        success: true,
        irn,
        status: 'CNL',
      };
    } catch (error: any) {
      console.error('E-Invoice cancellation error:', error);
      return {
        success: false,
        error: {
          code: 'EXCEPTION',
          message: error.message,
        },
      };
    }
  }

  /**
   * Get E-Invoice by IRN
   */
  async getEInvoiceByIrn(irn: string): Promise<EInvoiceResponse> {
    try {
      const auth = await this.authenticate();

      const response = await fetch(
        `${this.config.baseUrl}/eicore/v1.03/Invoice/irn/${irn}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'client_id': this.config.clientId,
            'client_secret': this.config.clientSecret,
            'gstin': this.config.gstin,
            'AuthToken': auth.authToken,
          },
        }
      );

      const result = await response.json();

      if (result.Status !== 1) {
        return {
          success: false,
          error: {
            code: result.ErrorDetails?.[0]?.ErrorCode || 'UNKNOWN',
            message: result.ErrorDetails?.[0]?.ErrorMessage || 'Failed to fetch E-Invoice',
          },
        };
      }

      return {
        success: true,
        irn,
        signedInvoice: result.Data.SignedInvoice,
        signedQRCode: result.Data.SignedQRCode,
        status: result.Data.Status,
      };
    } catch (error: any) {
      console.error('Get E-Invoice error:', error);
      return {
        success: false,
        error: {
          code: 'EXCEPTION',
          message: error.message,
        },
      };
    }
  }

  /**
   * Generate E-Way Bill
   */
  async generateEwayBill(
    irn: string,
    ewbData: {
      transId?: string;
      transName?: string;
      transMode: string; // 1=Road, 2=Rail, 3=Air, 4=Ship
      distance: number;
      transDocNo?: string;
      transDocDt?: string;
      vehNo?: string;
      vehType?: string; // R=Regular, O=ODC
    }
  ): Promise<EInvoiceResponse> {
    try {
      const auth = await this.authenticate();

      const ewbPayload = {
        Irn: irn,
        Distance: ewbData.distance,
        TransMode: ewbData.transMode,
        TransId: ewbData.transId,
        TransName: ewbData.transName,
        TransDocDt: ewbData.transDocDt,
        TransDocNo: ewbData.transDocNo,
        VehNo: ewbData.vehNo,
        VehType: ewbData.vehType,
      };

      const response = await fetch(`${this.config.baseUrl}/eiewb/v1.03/ewaybill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'client_id': this.config.clientId,
          'client_secret': this.config.clientSecret,
          'gstin': this.config.gstin,
          'AuthToken': auth.authToken,
        },
        body: JSON.stringify({
          Data: JSON.stringify(ewbPayload),
        }),
      });

      const result = await response.json();

      if (result.Status !== 1) {
        return {
          success: false,
          error: {
            code: result.ErrorDetails?.[0]?.ErrorCode || 'UNKNOWN',
            message: result.ErrorDetails?.[0]?.ErrorMessage || 'E-Way Bill generation failed',
          },
        };
      }

      return {
        success: true,
        irn,
        ewbNo: result.Data.EwbNo?.toString(),
        ewbDt: result.Data.EwbDt,
        ewbValidTill: result.Data.EwbValidTill,
      };
    } catch (error: any) {
      console.error('E-Way Bill generation error:', error);
      return {
        success: false,
        error: {
          code: 'EXCEPTION',
          message: error.message,
        },
      };
    }
  }

  /**
   * Cancel E-Way Bill
   */
  async cancelEwayBill(
    ewbNo: string,
    cancelReason: '1' | '2' | '3' | '4',
    cancelRemarks: string
  ): Promise<EInvoiceResponse> {
    try {
      const auth = await this.authenticate();

      const cancelData = {
        ewbNo: parseInt(ewbNo),
        cancelRsnCode: parseInt(cancelReason),
        cancelRmrk: cancelRemarks,
      };

      const response = await fetch(`${this.config.baseUrl}/eiewb/v1.03/ewaybill/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'client_id': this.config.clientId,
          'client_secret': this.config.clientSecret,
          'gstin': this.config.gstin,
          'AuthToken': auth.authToken,
        },
        body: JSON.stringify({
          Data: JSON.stringify(cancelData),
        }),
      });

      const result = await response.json();

      if (result.Status !== 1) {
        return {
          success: false,
          error: {
            code: result.ErrorDetails?.[0]?.ErrorCode || 'UNKNOWN',
            message: result.ErrorDetails?.[0]?.ErrorMessage || 'E-Way Bill cancellation failed',
          },
        };
      }

      return {
        success: true,
        ewbNo,
        status: 'CNL',
      };
    } catch (error: any) {
      console.error('E-Way Bill cancellation error:', error);
      return {
        success: false,
        error: {
          code: 'EXCEPTION',
          message: error.message,
        },
      };
    }
  }

  /**
   * Build E-Invoice payload from invoice data
   */
  buildEInvoicePayload(invoice: {
    invoiceNumber: string;
    invoiceDate: string;
    supplyType: 'B2B' | 'SEZWP' | 'SEZWOP' | 'EXPWP' | 'EXPWOP' | 'DEXP';
    seller: {
      gstin: string;
      legalName: string;
      tradeName?: string;
      address: string;
      location: string;
      pincode: number;
      stateCode: string;
      phone?: string;
      email?: string;
    };
    buyer: {
      gstin: string;
      legalName: string;
      tradeName?: string;
      placeOfSupply: string;
      address: string;
      location: string;
      pincode: number;
      stateCode: string;
      phone?: string;
      email?: string;
    };
    items: Array<{
      slNo: number;
      description: string;
      isService: boolean;
      hsnCode: string;
      quantity?: number;
      unit?: string;
      unitPrice: number;
      discount?: number;
      gstRate: number;
    }>;
    isIgst: boolean;
    roundOff?: number;
    otherCharges?: number;
  }): EInvoiceData {
    // Calculate totals
    let totalAssessableValue = 0;
    let totalIgst = 0;
    let totalCgst = 0;
    let totalSgst = 0;

    const itemList = invoice.items.map((item) => {
      const assAmt = (item.unitPrice * (item.quantity || 1)) - (item.discount || 0);
      const taxAmt = (assAmt * item.gstRate) / 100;

      totalAssessableValue += assAmt;

      let igstAmt = 0, cgstAmt = 0, sgstAmt = 0;
      if (invoice.isIgst) {
        igstAmt = taxAmt;
        totalIgst += taxAmt;
      } else {
        cgstAmt = taxAmt / 2;
        sgstAmt = taxAmt / 2;
        totalCgst += cgstAmt;
        totalSgst += sgstAmt;
      }

      return {
        slNo: item.slNo.toString(),
        prdDesc: item.description,
        isServc: item.isService ? 'Y' : 'N',
        hsnCd: item.hsnCode,
        qty: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        totAmt: item.unitPrice * (item.quantity || 1),
        discount: item.discount,
        assAmt,
        gstRt: item.gstRate,
        igstAmt: invoice.isIgst ? igstAmt : undefined,
        cgstAmt: !invoice.isIgst ? cgstAmt : undefined,
        sgstAmt: !invoice.isIgst ? sgstAmt : undefined,
        totItemVal: assAmt + (igstAmt || cgstAmt + sgstAmt),
      };
    });

    const totalTax = totalIgst + totalCgst + totalSgst;
    const totalInvoiceValue = totalAssessableValue + totalTax + (invoice.otherCharges || 0) + (invoice.roundOff || 0);

    return {
      version: '1.1',
      tranDtls: {
        taxSch: 'GST',
        supTyp: invoice.supplyType,
        regRev: 'N',
        igstOnIntra: invoice.isIgst ? 'Y' : 'N',
      },
      docDtls: {
        typ: 'INV',
        no: invoice.invoiceNumber,
        dt: invoice.invoiceDate, // DD/MM/YYYY format
      },
      sellerDtls: {
        gstin: invoice.seller.gstin,
        lglNm: invoice.seller.legalName,
        trdNm: invoice.seller.tradeName,
        addr1: invoice.seller.address,
        loc: invoice.seller.location,
        pin: invoice.seller.pincode,
        stcd: invoice.seller.stateCode,
        ph: invoice.seller.phone,
        em: invoice.seller.email,
      },
      buyerDtls: {
        gstin: invoice.buyer.gstin,
        lglNm: invoice.buyer.legalName,
        trdNm: invoice.buyer.tradeName,
        pos: invoice.buyer.placeOfSupply,
        addr1: invoice.buyer.address,
        loc: invoice.buyer.location,
        pin: invoice.buyer.pincode,
        stcd: invoice.buyer.stateCode,
        ph: invoice.buyer.phone,
        em: invoice.buyer.email,
      },
      itemList,
      valDtls: {
        assVal: totalAssessableValue,
        igstVal: totalIgst || undefined,
        cgstVal: totalCgst || undefined,
        sgstVal: totalSgst || undefined,
        othChrg: invoice.otherCharges,
        rndOffAmt: invoice.roundOff,
        totInvVal: totalInvoiceValue,
      },
    };
  }
}

// Export singleton instance
export const nicApiService = new NicApiService();
export type { EInvoiceData, EInvoiceResponse };
