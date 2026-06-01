import { z } from 'zod';

export const pricingTools = [
  {
    name: 'walmart_update_price',
    description: 'Update the regular (BASE) price for a single item by SKU. The Walmart /v3/price payload is built for you — pass sku and amount. For promotional/strikethrough pricing use walmart_submit_promo_price_feed.',
    inputSchema: {
      sku: z.string().describe('Seller-defined SKU'),
      amount: z.number().positive().describe('New price amount, e.g. 16.99'),
      currency: z.string().length(3).optional().describe('ISO 4217 currency code (default USD)'),
    },
  },
  {
    name: 'walmart_submit_price_feed',
    description: 'Submit a bulk price update feed (feedType=price). Returns feedId for tracking.',
    inputSchema: {
      feedData: z.record(z.string(), z.unknown()).describe('Price feed payload with SKU and price mappings'),
    },
  },
  {
    name: 'walmart_submit_mp_price_feed',
    description: 'Submit a marketplace price update feed (feedType=MP_ITEM_PRICE_UPDATE).',
    inputSchema: {
      feedData: z.record(z.string(), z.unknown()).describe('MP price update feed payload'),
    },
  },
  {
    name: 'walmart_submit_promo_price_feed',
    description: 'Submit a promotional price feed (feedType=PROMO_PRICE). Supports Reduced, Clearance, SubMAP Cart, and SubMAP Checkout promotions. Max 10 promos per item, start date must be >4h from now.',
    inputSchema: {
      feedData: z.record(z.string(), z.unknown()).describe('Promotional pricing feed payload'),
    },
  },
  {
    name: 'walmart_get_repricer_strategies',
    description: 'List all configured repricer strategies. Repricer automates price adjustments based on Buy Box competition.',
    inputSchema: {},
  },
  {
    name: 'walmart_create_repricer_strategy',
    description: 'Create a new repricer strategy with rules for automatic price adjustments.',
    inputSchema: {
      strategyData: z.record(z.string(), z.unknown()).describe('Repricer strategy configuration'),
    },
  },
  {
    name: 'walmart_update_repricer_strategy',
    description: 'Update an existing repricer strategy.',
    inputSchema: {
      strategyData: z.record(z.string(), z.unknown()).describe('Updated repricer strategy configuration'),
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
    description: 'Assign items to a repricer strategy. The repricer will automatically manage pricing for these items.',
    inputSchema: {
      strategyId: z.string().describe('Repricer strategy ID'),
      items: z.array(z.record(z.string(), z.unknown())).describe('Array of items to assign'),
    },
  },
  {
    name: 'walmart_unassign_items_from_strategy',
    description: 'Remove items from a repricer strategy. Items will return to manual pricing.',
    inputSchema: {
      strategyId: z.string().describe('Repricer strategy ID'),
      skus: z.array(z.string()).describe('Array of SKUs to unassign'),
    },
  },
];
