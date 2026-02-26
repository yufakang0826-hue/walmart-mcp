import { z } from 'zod';

export const inventoryTools = [
  {
    name: 'walmart_get_inventory',
    description: 'Get inventory for a single SKU at the default fulfillment center. Returns quantity and fulfillment type.',
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
    description: 'Update inventory for a SKU at specific fulfillment centers (multi-node).',
    inputSchema: {
      sku: z.string().describe('Seller-defined SKU'),
      inventoryData: z.record(z.string(), z.unknown()).describe('Multi-node inventory update payload'),
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
    description: 'Submit a bulk inventory update feed for a single fulfillment center (feedType=inventory).',
    inputSchema: {
      feedData: z.record(z.string(), z.unknown()).describe('Inventory feed payload'),
    },
  },
  {
    name: 'walmart_submit_multi_node_inventory_feed',
    description: 'Submit a bulk multi-node inventory update feed (feedType=MP_INVENTORY). JSON format only.',
    inputSchema: {
      feedData: z.record(z.string(), z.unknown()).describe('Multi-node inventory feed payload (JSON only)'),
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
    description: 'Update the fulfillment lag time for a SKU.',
    inputSchema: {
      sku: z.string().describe('Seller-defined SKU'),
      fulfillmentLagTime: z.number().int().min(0).describe('Lag time in days'),
    },
  },
  {
    name: 'walmart_submit_lagtime_feed',
    description: 'Submit a bulk lag time update feed (feedType=LAGTIME).',
    inputSchema: {
      feedData: z.record(z.string(), z.unknown()).describe('Lag time feed payload'),
    },
  },
];
