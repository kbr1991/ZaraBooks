/**
 * GST API Integration Tests
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { getTestDb, closeTestDb, clearTestDb, seedTestData } from '../setup';
import * as schema from '../../shared/schema';
import { eq } from 'drizzle-orm';

describe('GST API', () => {
  let db: ReturnType<typeof getTestDb>;

  beforeAll(async () => {
    db = getTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  describe('GST Configuration', () => {
    it('should create GST configuration for company', async () => {
      const { company } = await seedTestData();

      const [gstConfig] = await db.insert(schema.gstConfig).values({
        companyId: company.id,
        gstin: '27AABCT1234A1Z5',
        legalName: 'Test Company Private Limited',
        tradeName: 'Test Company',
        stateCode: '27',
        registrationType: 'regular',
        filingFrequency: 'monthly',
        einvoiceEnabled: true,
        einvoiceThreshold: '500000.00',
        isPrimary: true,
      }).returning();

      expect(gstConfig.gstin).toBe('27AABCT1234A1Z5');
      expect(gstConfig.registrationType).toBe('regular');
      expect(gstConfig.einvoiceEnabled).toBe(true);
    });

    it('should support multiple GSTINs per company', async () => {
      const { company } = await seedTestData();

      // Primary GSTIN (Maharashtra)
      await db.insert(schema.gstConfig).values({
        companyId: company.id,
        gstin: '27AABCT1234A1Z5',
        legalName: 'Test Company Private Limited',
        stateCode: '27',
        registrationType: 'regular',
        filingFrequency: 'monthly',
        isPrimary: true,
      });

      // Secondary GSTIN (Delhi)
      await db.insert(schema.gstConfig).values({
        companyId: company.id,
        gstin: '07AABCT1234A1Z5',
        legalName: 'Test Company Private Limited',
        stateCode: '07',
        registrationType: 'regular',
        filingFrequency: 'monthly',
        isPrimary: false,
      });

      const configs = await db
        .select()
        .from(schema.gstConfig)
        .where(eq(schema.gstConfig.companyId, company.id));

      expect(configs.length).toBe(2);
      expect(configs.filter(c => c.isPrimary).length).toBe(1);
    });
  });

  describe('GSTR-1 Entries', () => {
    it('should create B2B invoice entry', async () => {
      const { company } = await seedTestData();

      // Setup GST config first
      const [gstConfig] = await db.insert(schema.gstConfig).values({
        companyId: company.id,
        gstin: '27AABCT1234A1Z5',
        legalName: 'Test Company',
        stateCode: '27',
        registrationType: 'regular',
        filingFrequency: 'monthly',
        isPrimary: true,
      }).returning();

      // Create GSTR-1 entry
      const [entry] = await db.insert(schema.gstr1Entries).values({
        companyId: company.id,
        gstin: gstConfig.gstin,
        returnPeriod: '042024',
        invoiceNumber: 'INV/2024/001',
        invoiceDate: new Date('2024-04-15'),
        invoiceType: 'B2B',
        partyGstin: '29AABCP1234B1Z5',
        partyName: 'Customer Company',
        placeOfSupply: '29',
        hsnSacCode: '998311',
        taxableValue: '100000.00',
        igst: '18000.00',
        cgst: '0.00',
        sgst: '0.00',
        cess: '0.00',
        invoiceValue: '118000.00',
        filingStatus: 'pending',
        source: 'manual',
      }).returning();

      expect(entry.invoiceType).toBe('B2B');
      expect(entry.taxableValue).toBe('100000.00');
      expect(entry.igst).toBe('18000.00'); // Interstate supply
    });

    it('should create intrastate supply entry', async () => {
      const { company } = await seedTestData();

      const [gstConfig] = await db.insert(schema.gstConfig).values({
        companyId: company.id,
        gstin: '27AABCT1234A1Z5',
        legalName: 'Test Company',
        stateCode: '27',
        registrationType: 'regular',
        filingFrequency: 'monthly',
        isPrimary: true,
      }).returning();

      const [entry] = await db.insert(schema.gstr1Entries).values({
        companyId: company.id,
        gstin: gstConfig.gstin,
        returnPeriod: '042024',
        invoiceNumber: 'INV/2024/002',
        invoiceDate: new Date('2024-04-20'),
        invoiceType: 'B2B',
        partyGstin: '27AABCP5678C1Z5',
        partyName: 'Local Customer',
        placeOfSupply: '27', // Same state as supplier
        hsnSacCode: '998311',
        taxableValue: '50000.00',
        igst: '0.00', // No IGST for intrastate
        cgst: '4500.00', // CGST @9%
        sgst: '4500.00', // SGST @9%
        cess: '0.00',
        invoiceValue: '59000.00',
        filingStatus: 'pending',
        source: 'manual',
      }).returning();

      expect(entry.cgst).toBe('4500.00');
      expect(entry.sgst).toBe('4500.00');
      expect(entry.igst).toBe('0.00');
    });
  });

  describe('GSTR-3B Summary', () => {
    it('should store GSTR-3B summary', async () => {
      const { company } = await seedTestData();

      const [gstConfig] = await db.insert(schema.gstConfig).values({
        companyId: company.id,
        gstin: '27AABCT1234A1Z5',
        legalName: 'Test Company',
        stateCode: '27',
        registrationType: 'regular',
        filingFrequency: 'monthly',
        isPrimary: true,
      }).returning();

      const [summary] = await db.insert(schema.gstr3bSummary).values({
        companyId: company.id,
        gstin: gstConfig.gstin,
        returnPeriod: '042024',
        outwardTaxable: '500000.00',
        outwardZeroRated: '50000.00',
        outwardNilRated: '0.00',
        outwardExempt: '10000.00',
        inwardReverseCharge: '0.00',
        itcIgst: '45000.00',
        itcCgst: '22500.00',
        itcSgst: '22500.00',
        itcCess: '0.00',
        interestPayable: '0.00',
        lateFee: '0.00',
        filingStatus: 'pending',
      }).returning();

      expect(summary.outwardTaxable).toBe('500000.00');
      expect(summary.itcIgst).toBe('45000.00');
    });
  });

  describe('ITC Register', () => {
    it('should track input tax credit', async () => {
      const { company } = await seedTestData();

      const [gstConfig] = await db.insert(schema.gstConfig).values({
        companyId: company.id,
        gstin: '27AABCT1234A1Z5',
        legalName: 'Test Company',
        stateCode: '27',
        registrationType: 'regular',
        filingFrequency: 'monthly',
        isPrimary: true,
      }).returning();

      const [itcEntry] = await db.insert(schema.itcRegister).values({
        companyId: company.id,
        gstin: gstConfig.gstin,
        returnPeriod: '042024',
        vendorGstin: '27AABCV1234D1Z5',
        vendorName: 'Vendor Company',
        invoiceNumber: 'VINV/001',
        invoiceDate: new Date('2024-04-10'),
        igst: '0.00',
        cgst: '9000.00',
        sgst: '9000.00',
        cess: '0.00',
        eligibleItc: '18000.00',
        ineligibleItc: '0.00',
        reversalAmount: '0.00',
        reconciliationStatus: 'pending',
      }).returning();

      expect(itcEntry.eligibleItc).toBe('18000.00');
      expect(itcEntry.reconciliationStatus).toBe('pending');
    });

    it('should track ITC reversal', async () => {
      const { company } = await seedTestData();

      const [gstConfig] = await db.insert(schema.gstConfig).values({
        companyId: company.id,
        gstin: '27AABCT1234A1Z5',
        legalName: 'Test Company',
        stateCode: '27',
        registrationType: 'regular',
        filingFrequency: 'monthly',
        isPrimary: true,
      }).returning();

      const [itcEntry] = await db.insert(schema.itcRegister).values({
        companyId: company.id,
        gstin: gstConfig.gstin,
        returnPeriod: '042024',
        vendorGstin: '27AABCV5678E1Z5',
        vendorName: 'Another Vendor',
        invoiceNumber: 'VINV/002',
        invoiceDate: new Date('2024-04-15'),
        igst: '18000.00',
        cgst: '0.00',
        sgst: '0.00',
        cess: '0.00',
        eligibleItc: '15000.00',
        ineligibleItc: '3000.00', // Blocked credit
        reversalAmount: '0.00',
        reversalReason: 'Blocked under Section 17(5)',
        reconciliationStatus: 'matched',
      }).returning();

      expect(itcEntry.ineligibleItc).toBe('3000.00');
      expect(itcEntry.reversalReason).toBe('Blocked under Section 17(5)');
    });
  });

  describe('HSN/SAC Master', () => {
    it('should store HSN codes', async () => {
      const [hsn] = await db.insert(schema.hsnSacMaster).values({
        code: '9983',
        description: 'Other professional, technical and business services',
        type: 'SAC',
        gstRate: '18',
        isActive: true,
      }).returning();

      expect(hsn.code).toBe('9983');
      expect(hsn.type).toBe('SAC');
      expect(hsn.gstRate).toBe('18');
    });
  });

  describe('GST Payments', () => {
    it('should track GST payment challan', async () => {
      const { company } = await seedTestData();

      const [gstConfig] = await db.insert(schema.gstConfig).values({
        companyId: company.id,
        gstin: '27AABCT1234A1Z5',
        legalName: 'Test Company',
        stateCode: '27',
        registrationType: 'regular',
        filingFrequency: 'monthly',
        isPrimary: true,
      }).returning();

      const [payment] = await db.insert(schema.gstPayments).values({
        companyId: company.id,
        gstin: gstConfig.gstin,
        returnPeriod: '042024',
        paymentType: 'CGST',
        liabilityAmount: '45000.00',
        itcUtilized: '22500.00',
        cashPaid: '22500.00',
        challanNumber: 'CHL/2024/001',
        paymentDate: new Date('2024-05-20'),
      }).returning();

      expect(payment.liabilityAmount).toBe('45000.00');
      expect(payment.itcUtilized).toBe('22500.00');
      expect(payment.cashPaid).toBe('22500.00');
    });
  });
});
