import { Router, Request, Response } from 'express';
import { db } from '../db';
import { currencies, exchangeRates, companies } from '../../../shared/schema';
import { eq, and, desc, lte } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

// Common currencies with their details
const COMMON_CURRENCIES = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimalPlaces: 2 },
  { code: 'USD', name: 'US Dollar', symbol: '$', decimalPlaces: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', decimalPlaces: 2 },
  { code: 'GBP', name: 'British Pound', symbol: '£', decimalPlaces: 2 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', decimalPlaces: 2 },
  { code: 'SAR', name: 'Saudi Riyal', symbol: '﷼', decimalPlaces: 2 },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimalPlaces: 2 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimalPlaces: 2 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimalPlaces: 2 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimalPlaces: 0 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', decimalPlaces: 2 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimalPlaces: 2 },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', decimalPlaces: 2 },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', decimalPlaces: 2 },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', decimalPlaces: 2 },
  { code: 'THB', name: 'Thai Baht', symbol: '฿', decimalPlaces: 2 },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', decimalPlaces: 2 },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', decimalPlaces: 2 },
  { code: 'MXN', name: 'Mexican Peso', symbol: '$', decimalPlaces: 2 },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', decimalPlaces: 0 },
];

// Middleware to check authentication
const requireAuth = (req: Request, res: Response, next: Function) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Get all available currencies
router.get('/', requireAuth, async (_req: Request, res: Response) => {
  try {
    const allCurrencies = await db
      .select()
      .from(currencies)
      .orderBy(currencies.code);

    // If no currencies in DB, return common currencies
    if (allCurrencies.length === 0) {
      return res.json(COMMON_CURRENCIES.map(c => ({ ...c, id: c.code, isActive: true })));
    }

    res.json(allCurrencies);
  } catch (error) {
    console.error('Error fetching currencies:', error);
    res.status(500).json({ error: 'Failed to fetch currencies' });
  }
});

// Seed common currencies
router.post('/seed', requireAuth, async (_req: Request, res: Response) => {
  try {
    // Check if currencies already exist
    const existing = await db.select().from(currencies).limit(1);
    if (existing.length > 0) {
      return res.json({ message: 'Currencies already seeded', count: existing.length });
    }

    // Insert common currencies
    await db.insert(currencies).values(COMMON_CURRENCIES);

    res.json({ message: 'Currencies seeded successfully', count: COMMON_CURRENCIES.length });
  } catch (error) {
    console.error('Error seeding currencies:', error);
    res.status(500).json({ error: 'Failed to seed currencies' });
  }
});

// Get exchange rates for a company
router.get('/exchange-rates', requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session?.currentCompanyId;
    if (!companyId) {
      return res.status(400).json({ error: 'No company selected' });
    }

    const { fromCurrency, toCurrency, asOfDate } = req.query;

    let query = db
      .select()
      .from(exchangeRates)
      .where(eq(exchangeRates.companyId, companyId))
      .orderBy(desc(exchangeRates.effectiveDate));

    const rates = await query;

    // Filter by currencies if provided
    let filteredRates = rates;
    if (fromCurrency) {
      filteredRates = filteredRates.filter(r => r.fromCurrency === fromCurrency);
    }
    if (toCurrency) {
      filteredRates = filteredRates.filter(r => r.toCurrency === toCurrency);
    }

    // Get the rate applicable as of date if provided
    if (asOfDate) {
      const dateStr = asOfDate as string;
      filteredRates = filteredRates.filter(r => r.effectiveDate <= dateStr);

      // Group by currency pair and get the latest for each
      const latestRates = new Map<string, typeof filteredRates[0]>();
      for (const rate of filteredRates) {
        const key = `${rate.fromCurrency}-${rate.toCurrency}`;
        if (!latestRates.has(key)) {
          latestRates.set(key, rate);
        }
      }
      filteredRates = Array.from(latestRates.values());
    }

    res.json(filteredRates);
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    res.status(500).json({ error: 'Failed to fetch exchange rates' });
  }
});

// Get specific exchange rate
router.get('/exchange-rates/rate', requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session?.currentCompanyId;
    if (!companyId) {
      return res.status(400).json({ error: 'No company selected' });
    }

    const { fromCurrency, toCurrency, date } = req.query;

    if (!fromCurrency || !toCurrency) {
      return res.status(400).json({ error: 'fromCurrency and toCurrency are required' });
    }

    // Get the company's base currency
    const company = await db
      .select()
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    const baseCurrency = company[0]?.baseCurrency || 'INR';

    // If same currency, rate is 1
    if (fromCurrency === toCurrency) {
      return res.json({ rate: 1, effectiveDate: date || new Date().toISOString().split('T')[0] });
    }

    const dateStr = (date as string) || new Date().toISOString().split('T')[0];

    // Try to find direct rate
    const directRate = await db
      .select()
      .from(exchangeRates)
      .where(
        and(
          eq(exchangeRates.companyId, companyId),
          eq(exchangeRates.fromCurrency, fromCurrency as string),
          eq(exchangeRates.toCurrency, toCurrency as string),
          lte(exchangeRates.effectiveDate, dateStr)
        )
      )
      .orderBy(desc(exchangeRates.effectiveDate))
      .limit(1);

    if (directRate.length > 0) {
      return res.json({
        rate: parseFloat(directRate[0].rate),
        effectiveDate: directRate[0].effectiveDate,
        source: directRate[0].source,
      });
    }

    // Try reverse rate
    const reverseRate = await db
      .select()
      .from(exchangeRates)
      .where(
        and(
          eq(exchangeRates.companyId, companyId),
          eq(exchangeRates.fromCurrency, toCurrency as string),
          eq(exchangeRates.toCurrency, fromCurrency as string),
          lte(exchangeRates.effectiveDate, dateStr)
        )
      )
      .orderBy(desc(exchangeRates.effectiveDate))
      .limit(1);

    if (reverseRate.length > 0) {
      const rate = 1 / parseFloat(reverseRate[0].rate);
      return res.json({
        rate,
        effectiveDate: reverseRate[0].effectiveDate,
        source: reverseRate[0].source,
        calculated: true,
      });
    }

    // No rate found
    res.status(404).json({ error: 'Exchange rate not found' });
  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    res.status(500).json({ error: 'Failed to fetch exchange rate' });
  }
});

// Add exchange rate
const addExchangeRateSchema = z.object({
  fromCurrency: z.string().length(3),
  toCurrency: z.string().length(3),
  rate: z.number().positive(),
  effectiveDate: z.string(),
  source: z.string().optional(),
});

router.post('/exchange-rates', requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session?.currentCompanyId;
    if (!companyId) {
      return res.status(400).json({ error: 'No company selected' });
    }

    const validation = addExchangeRateSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors });
    }

    const { fromCurrency, toCurrency, rate, effectiveDate, source } = validation.data;

    // Check if rate already exists for this date and currency pair
    const existing = await db
      .select()
      .from(exchangeRates)
      .where(
        and(
          eq(exchangeRates.companyId, companyId),
          eq(exchangeRates.fromCurrency, fromCurrency),
          eq(exchangeRates.toCurrency, toCurrency),
          eq(exchangeRates.effectiveDate, effectiveDate)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing rate
      await db
        .update(exchangeRates)
        .set({ rate: rate.toString(), source: source || 'manual', updatedAt: new Date() })
        .where(eq(exchangeRates.id, existing[0].id));

      return res.json({ ...existing[0], rate: rate.toString(), updated: true });
    }

    // Insert new rate
    const [newRate] = await db
      .insert(exchangeRates)
      .values({
        companyId,
        fromCurrency,
        toCurrency,
        rate: rate.toString(),
        effectiveDate,
        source: source || 'manual',
      })
      .returning();

    res.status(201).json(newRate);
  } catch (error) {
    console.error('Error adding exchange rate:', error);
    res.status(500).json({ error: 'Failed to add exchange rate' });
  }
});

// Delete exchange rate
router.delete('/exchange-rates/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session?.currentCompanyId;
    if (!companyId) {
      return res.status(400).json({ error: 'No company selected' });
    }

    const { id } = req.params;

    // Verify the rate belongs to the company
    const rate = await db
      .select()
      .from(exchangeRates)
      .where(and(eq(exchangeRates.id, id), eq(exchangeRates.companyId, companyId)))
      .limit(1);

    if (rate.length === 0) {
      return res.status(404).json({ error: 'Exchange rate not found' });
    }

    await db.delete(exchangeRates).where(eq(exchangeRates.id, id));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting exchange rate:', error);
    res.status(500).json({ error: 'Failed to delete exchange rate' });
  }
});

// Bulk import exchange rates
const bulkImportSchema = z.object({
  rates: z.array(z.object({
    fromCurrency: z.string().length(3),
    toCurrency: z.string().length(3),
    rate: z.number().positive(),
    effectiveDate: z.string(),
  })),
});

router.post('/exchange-rates/bulk', requireAuth, async (req: Request, res: Response) => {
  try {
    const companyId = req.session?.currentCompanyId;
    if (!companyId) {
      return res.status(400).json({ error: 'No company selected' });
    }

    const validation = bulkImportSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.errors });
    }

    const { rates } = validation.data;
    let imported = 0;
    let updated = 0;

    for (const rateData of rates) {
      // Check if rate exists
      const existing = await db
        .select()
        .from(exchangeRates)
        .where(
          and(
            eq(exchangeRates.companyId, companyId),
            eq(exchangeRates.fromCurrency, rateData.fromCurrency),
            eq(exchangeRates.toCurrency, rateData.toCurrency),
            eq(exchangeRates.effectiveDate, rateData.effectiveDate)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(exchangeRates)
          .set({ rate: rateData.rate.toString(), updatedAt: new Date() })
          .where(eq(exchangeRates.id, existing[0].id));
        updated++;
      } else {
        await db.insert(exchangeRates).values({
          companyId,
          fromCurrency: rateData.fromCurrency,
          toCurrency: rateData.toCurrency,
          rate: rateData.rate.toString(),
          effectiveDate: rateData.effectiveDate,
          source: 'bulk_import',
        });
        imported++;
      }
    }

    res.json({ imported, updated, total: rates.length });
  } catch (error) {
    console.error('Error bulk importing exchange rates:', error);
    res.status(500).json({ error: 'Failed to bulk import exchange rates' });
  }
});

export default router;
