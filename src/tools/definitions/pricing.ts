import { z } from 'zod';
import {
  SkuSchema,
  MoneySchema,
  Iso8601UtcSchema,
  Iso4217CurrencySchema,
  ProcessModeSchema,
} from './shared-schemas.js';

// ---------- Standard (BASE) price feed (feedType=price, legacy v1.5) ----------
// Walmart legacy price-feed body:
//   { PriceHeader: {version}, Price: [{ itemIdentifier: {sku, productIdType, productId},
//     pricingList: { pricing: [{ currentPrice: { value: {amount, currency} }, currentPriceType }] }
//   }] }
const LegacyPricingEntrySchema = z
  .object({
    itemIdentifier: z
      .object({
        sku: SkuSchema,
        productIdType: z.literal('SKU').default('SKU'),
        productId: z.string().min(1).optional(),
      })
      .strict(),
    pricingList: z
      .object({
        pricing: z
          .array(
            z
              .object({
                currentPrice: z
                  .object({
                    value: z
                      .object({
                        amount: z.number().positive(),
                        currency: Iso4217CurrencySchema,
                      })
                      .strict(),
                  })
                  .strict(),
                currentPriceType: z.enum(['BASE', 'REDUCED', 'CLEARANCE']).default('BASE'),
              })
              .strict(),
          )
          .min(1, 'Need at least 1 pricing entry per SKU'),
      })
      .strict(),
  })
  .strict();

const LegacyPriceFeedSchema = z
  .object({
    PriceHeader: z
      .object({
        version: z.string().default('1.5'),
        feedDate: Iso8601UtcSchema.optional(),
      })
      .strict(),
    Price: z
      .array(LegacyPricingEntrySchema)
      .min(1, 'Need at least 1 SKU in a price feed')
      .max(10_000, 'Walmart caps price feeds at ~10000 SKUs per submission'),
  })
  .strict();

// ---------- MP_ITEM_PRICE_UPDATE feed (newer style) ----------
const MpPriceEntrySchema = z
  .object({
    sku: SkuSchema,
    pricing: z
      .array(
        z
          .object({
            currentPrice: MoneySchema,
            currentPriceType: z.enum(['BASE', 'REDUCED', 'CLEARANCE']).default('BASE'),
            processMode: ProcessModeSchema.optional(),
          })
          .strict(),
      )
      .min(1)
      .max(10, 'Max 10 pricing entries per SKU'),
  })
  .strict();

const MpPriceFeedSchema = z
  .object({
    PriceHeader: z
      .object({
        version: z.string().default('1.5.1'),
        feedDate: Iso8601UtcSchema.optional(),
      })
      .strict(),
    Price: z
      .array(MpPriceEntrySchema)
      .min(1)
      .max(10_000),
  })
  .strict();

// ---------- PROMO_PRICE feed body ----------
const PromoPricingEntrySchema = z
  .object({
    currentPrice: MoneySchema,
    currentPriceType: z.enum(['REDUCED', 'CLEARANCE']),
    comparisonPrice: MoneySchema,
    comparisonPriceType: z.literal('BASE'),
    priceDisplayCodes: z.literal('CART').default('CART'),
    effectiveDate: Iso8601UtcSchema,
    expirationDate: Iso8601UtcSchema,
    processMode: ProcessModeSchema,
  })
  .strict()
  .refine((p) => p.currentPrice.amount < p.comparisonPrice.amount, {
    message: 'currentPrice.amount must be < comparisonPrice.amount',
    path: ['currentPrice', 'amount'],
  })
  .refine((p) => new Date(p.expirationDate).getTime() > new Date(p.effectiveDate).getTime(), {
    message: 'expirationDate must be after effectiveDate',
    path: ['expirationDate'],
  })
  .refine(
    (p) => {
      const days =
        (new Date(p.expirationDate).getTime() - new Date(p.effectiveDate).getTime()) /
        (24 * 60 * 60 * 1000);
      return days <= 180;
    },
    { message: 'Promo duration cannot exceed 180 days', path: ['expirationDate'] },
  )
  .refine((p) => new Date(p.effectiveDate).getTime() - Date.now() >= 4 * 60 * 60 * 1000, {
    message: 'effectiveDate must be at least 4 hours from current UTC',
    path: ['effectiveDate'],
  })
  .refine((p) => p.currentPrice.currency === p.comparisonPrice.currency, {
    message: 'currentPrice and comparisonPrice must use the same currency',
    path: ['currentPrice', 'currency'],
  });

const PromoPriceEntrySchema = z
  .object({
    sku: SkuSchema,
    pricing: z
      .array(PromoPricingEntrySchema)
      .min(1, 'Need at least 1 pricing entry per SKU')
      .max(10, 'Max 10 active promos per SKU'),
  })
  .strict();

const PromoPriceFeedSchema = z
  .object({
    PriceHeader: z
      .object({
        version: z.string().default('1.5.1'),
        feedDate: Iso8601UtcSchema.optional(),
      })
      .strict(),
    Price: z
      .array(PromoPriceEntrySchema)
      .min(1)
      .max(10_000, 'Walmart caps PROMO_PRICE feeds at ~10000 SKUs per submission'),
  })
  .strict();

// ---------- Repricer strategy ----------
// Walmart Repricer's strategy body shape varies and is sparsely documented.
// We require the documented "must have a name + rules array" envelope and
// passthrough the rest until Walmart publishes a public spec.
const RepricerStrategySchema = z
  .object({
    strategyName: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    rules: z.array(z.unknown()).min(1, 'Repricer strategy must have at least 1 rule'),
    minPrice: z.number().positive().optional(),
    maxPrice: z.number().positive().optional(),
  })
  .passthrough()
  .refine(
    (s) => !(s.minPrice != null && s.maxPrice != null) || s.minPrice <= s.maxPrice,
    { message: 'minPrice must be <= maxPrice', path: ['minPrice'] },
  );

// ---------- Strategy assignment ----------
const StrategyAssignmentItemSchema = z
  .object({
    sku: SkuSchema,
  })
  .passthrough();

export const pricingTools = [
  {
    name: 'walmart_update_price',
    description:
      'Update the regular (BASE) price for a single item by SKU. Pass sku and amount; ' +
      'the Walmart /v3/price payload is built for you. For promo/strikethrough pricing use ' +
      'walmart_submit_promo_price_feed.',
    inputSchema: {
      sku: z.string().describe('Seller-defined SKU'),
      amount: z.number().positive().describe('New price amount, e.g. 16.99'),
      currency: z.string().length(3).optional().describe('ISO 4217 currency code (default USD)'),
    },
  },
  {
    name: 'walmart_submit_price_feed',
    description:
      'Submit a bulk legacy price update feed (feedType=price, spec 1.5). Payload: ' +
      '{ PriceHeader: { version }, Price: [{ itemIdentifier: { sku, productIdType, productId }, ' +
      'pricingList: { pricing: [{ currentPrice: { value: { amount, currency } }, ' +
      'currentPriceType }] } }] }. Returns a feedId; poll walmart_get_feed_status.',
    inputSchema: {
      feedData: LegacyPriceFeedSchema,
    },
  },
  {
    name: 'walmart_submit_mp_price_feed',
    description:
      'Submit a marketplace price update feed (feedType=MP_ITEM_PRICE_UPDATE). Payload: ' +
      '{ PriceHeader, Price: [{ sku, pricing: [{ currentPrice: { currency, amount }, ' +
      'currentPriceType }] }] }. Returns a feedId.',
    inputSchema: {
      feedData: MpPriceFeedSchema,
    },
  },
  {
    name: 'walmart_submit_promo_price_feed',
    description:
      'Submit a promotional price feed (feedType=PROMO_PRICE). Walmart business rules enforced at ' +
      'the schema layer BEFORE the API call: currentPrice < comparisonPrice, currency matches on ' +
      'both, effectiveDate >= now + 4h, expirationDate > effectiveDate, duration <= 180 days, ' +
      'max 10 promos per SKU, max 10000 SKUs per feed. Supports REDUCED and CLEARANCE ' +
      'currentPriceType. Returns a feedId; poll walmart_get_feed_status until PROCESSED.',
    inputSchema: {
      feedData: PromoPriceFeedSchema,
    },
  },
  {
    name: 'walmart_get_repricer_strategies',
    description:
      'List all configured repricer strategies. Repricer automates price adjustments based on Buy Box competition.',
    inputSchema: {},
  },
  {
    name: 'walmart_create_repricer_strategy',
    description:
      'Create a new repricer strategy. Required: strategyName, rules (non-empty array). ' +
      'Optional: description, minPrice / maxPrice (minPrice <= maxPrice).',
    inputSchema: {
      strategyData: RepricerStrategySchema,
    },
  },
  {
    name: 'walmart_update_repricer_strategy',
    description: 'Update an existing repricer strategy. Same shape as create.',
    inputSchema: {
      strategyData: RepricerStrategySchema,
    },
  },
  {
    name: 'walmart_delete_repricer_strategy',
    description: 'Delete a repricer strategy by ID.',
    inputSchema: {
      strategyId: z.string().describe('Repricer strategy ID to delete'),
    },
  },
  {
    name: 'walmart_assign_items_to_strategy',
    description:
      'Assign items to a repricer strategy. Pass items: [{ sku }, ...]. The repricer will then ' +
      'automatically manage pricing for these SKUs.',
    inputSchema: {
      strategyId: z.string().describe('Repricer strategy ID'),
      items: z
        .array(StrategyAssignmentItemSchema)
        .min(1, 'Need at least 1 item to assign')
        .max(10_000, 'Assignment capped at 10000 SKUs per call'),
    },
  },
  {
    name: 'walmart_unassign_items_from_strategy',
    description: 'Remove items from a repricer strategy. Items will return to manual pricing.',
    inputSchema: {
      strategyId: z.string().describe('Repricer strategy ID'),
      skus: z
        .array(SkuSchema)
        .min(1)
        .max(10_000)
        .describe('Array of SKUs to unassign'),
    },
  },
];
