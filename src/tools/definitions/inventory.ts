import { z } from 'zod';
import { SkuSchema, ShipNodeSchema, QuantitySchema, ProcessModeSchema } from './shared-schemas.js';

// ---------- Single-node inventory feed (feedType=inventory) ----------
// Walmart spec: InventoryHeader + Inventory[] with sku + quantity.
const SingleNodeInventoryFeedSchema = z
  .object({
    InventoryHeader: z
      .object({
        version: z.string().default('1.4'),
        feedDate: z.string().datetime({ offset: true }).optional(),
      })
      .strict(),
    Inventory: z
      .array(
        z
          .object({
            sku: SkuSchema,
            quantity: QuantitySchema,
            fulfillmentLagTime: z
              .number()
              .int()
              .min(0)
              .max(28, 'Walmart caps lag time at 28 days')
              .optional(),
          })
          .strict(),
      )
      .min(1, 'Need at least 1 inventory entry')
      .max(10_000, 'Walmart caps inventory feeds at ~10000 SKUs'),
  })
  .strict();

// ---------- Multi-node inventory feed (feedType=MP_INVENTORY) ----------
// Each SKU can have inventory at multiple ship nodes.
const ShipNodeInventorySchema = z
  .object({
    shipNode: ShipNodeSchema,
    availToSellQty: QuantitySchema,
    processMode: ProcessModeSchema.optional(),
  })
  .strict();

const MultiNodeInventoryFeedSchema = z
  .object({
    InventoryFeed: z
      .object({
        InventoryHeader: z
          .object({
            version: z.string().default('1.0'),
            requestId: z.string().optional(),
          })
          .strict(),
        inventory: z
          .array(
            z
              .object({
                sku: SkuSchema,
                shipNodes: z.array(ShipNodeInventorySchema).min(1, 'At least 1 ship node per SKU'),
              })
              .strict(),
          )
          .min(1, 'Need at least 1 SKU')
          .max(10_000, 'Walmart caps multi-node inventory feeds at ~10000 SKUs'),
      })
      .strict(),
  })
  .strict();

// ---------- Single-SKU multi-node inventory body (used by update_inventory_multi_node) ----------
const MultiNodeInventoryBodySchema = z
  .object({
    sku: SkuSchema,
    shipNodes: z
      .array(ShipNodeInventorySchema)
      .min(1, 'At least 1 ship node entry required'),
  })
  .strict();

// ---------- LAGTIME feed ----------
const LagTimeFeedSchema = z
  .object({
    LagTimeHeader: z
      .object({
        version: z.string().default('1.0'),
        feedDate: z.string().datetime({ offset: true }).optional(),
      })
      .strict(),
    lagTime: z
      .array(
        z
          .object({
            sku: SkuSchema,
            fulfillmentLagTime: z.number().int().min(0).max(28),
          })
          .strict(),
      )
      .min(1)
      .max(10_000),
  })
  .strict();

export const inventoryTools = [
  {
    name: 'walmart_get_inventory',
    description:
      'Get inventory for a single SKU at the default fulfillment center. Returns quantity and fulfillment type.',
    inputSchema: {
      sku: z.string().describe('Seller-defined SKU'),
    },
  },
  {
    name: 'walmart_update_inventory',
    description: 'Update inventory quantity for a single SKU at the default fulfillment center.',
    inputSchema: {
      sku: z.string().describe('Seller-defined SKU'),
      quantity: z.number().int().min(0).describe('Available quantity'),
      shipNode: z.string().optional().describe('Ship node / fulfillment center ID (optional)'),
    },
  },
  {
    name: 'walmart_get_inventory_all_nodes',
    description: 'Get inventory for a SKU across all fulfillment centers (ship nodes).',
    inputSchema: {
      sku: z.string().describe('Seller-defined SKU'),
    },
  },
  {
    name: 'walmart_update_inventory_multi_node',
    description:
      'Update inventory for a SKU at specific fulfillment centers (multi-node). Pass shipNodes array, ' +
      'each entry { shipNode, availToSellQty: { unit, amount }, processMode? }. Walmart enforces ' +
      'integer non-negative quantities; bad payloads now caught by zod before the API call.',
    inputSchema: {
      sku: z.string().describe('Seller-defined SKU'),
      inventoryData: MultiNodeInventoryBodySchema,
    },
  },
  {
    name: 'walmart_get_all_inventory',
    description: 'Get inventory for all SKUs with pagination. Can filter by ship node.',
    inputSchema: {
      limit: z.number().int().min(1).max(50).optional().describe('Items per page (default 50)'),
      offset: z.string().optional().describe('Pagination offset'),
      shipNode: z.string().optional().describe('Filter by fulfillment center ID'),
    },
  },
  {
    name: 'walmart_submit_inventory_feed',
    description:
      'Submit a bulk inventory update feed for a single fulfillment center (feedType=inventory). ' +
      'Payload: { InventoryHeader: { version }, Inventory: [{ sku, quantity: { unit, amount }, ' +
      'fulfillmentLagTime? }] }. Quantities must be integer non-negative; lag time max 28 days. ' +
      'Returns a feedId; poll walmart_get_feed_status until PROCESSED.',
    inputSchema: {
      feedData: SingleNodeInventoryFeedSchema,
    },
  },
  {
    name: 'walmart_submit_multi_node_inventory_feed',
    description:
      'Submit a bulk multi-node inventory feed (feedType=MP_INVENTORY, JSON only). ' +
      'Payload: { InventoryFeed: { InventoryHeader: { version }, inventory: [{ sku, ' +
      'shipNodes: [{ shipNode, availToSellQty: { unit, amount }, processMode? }] }] } }. ' +
      'Returns a feedId.',
    inputSchema: {
      feedData: MultiNodeInventoryFeedSchema,
    },
  },
  {
    name: 'walmart_get_lag_time',
    description: 'Get the fulfillment lag time for a SKU (time between order placement and shipment).',
    inputSchema: {
      sku: z.string().describe('Seller-defined SKU'),
    },
  },
  {
    name: 'walmart_update_lag_time',
    description: 'Update the fulfillment lag time for a SKU (0-28 days).',
    inputSchema: {
      sku: z.string().describe('Seller-defined SKU'),
      fulfillmentLagTime: z
        .number()
        .int()
        .min(0)
        .max(28)
        .describe('Lag time in days (0-28; Walmart caps at 28)'),
    },
  },
  {
    name: 'walmart_submit_lagtime_feed',
    description:
      'Submit a bulk lag time update feed (feedType=LAGTIME). Payload: { LagTimeHeader, ' +
      'lagTime: [{ sku, fulfillmentLagTime: 0-28 }] }. Returns a feedId.',
    inputSchema: {
      feedData: LagTimeFeedSchema,
    },
  },
];
