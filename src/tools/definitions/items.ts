import { z } from 'zod';

export const itemTools = [
  {
    name: 'walmart_get_all_items',
    description: 'Get all items in the seller catalog with pagination. Returns item details including SKU, title, price, publish status, and lifecycle status.',
    inputSchema: {
      limit: z.number().int().min(1).max(50).optional().describe('Items per page (default 20, max 50)'),
      offset: z.string().optional().describe('Pagination offset token from previous response'),
      lifecycleStatus: z.enum(['ACTIVE', 'RETIRED']).optional().describe('Filter by lifecycle status'),
      publishedStatus: z.enum(['PUBLISHED', 'UNPUBLISHED', 'STAGE']).optional().describe('Filter by publish status'),
      sku: z.string().optional().describe('Filter by specific SKU'),
    },
  },
  {
    name: 'walmart_get_item',
    description: 'Get a single item by SKU. Returns full item details including product attributes, price, inventory, and listing quality.',
    inputSchema: {
      sku: z.string().describe('Seller-defined SKU identifier'),
    },
  },
  {
    name: 'walmart_retire_item',
    description: 'Retire (unpublish) an item by SKU. This removes the item from the Walmart marketplace. The item can be re-listed later.',
    inputSchema: {
      sku: z.string().describe('SKU of the item to retire'),
    },
  },
  {
    name: 'walmart_bulk_retire_items',
    description: 'Retire multiple items at once by providing a list of SKUs.',
    inputSchema: {
      skus: z.array(z.object({
        sku: z.string().describe('SKU to retire'),
      })).min(1).describe('Array of SKU objects to retire'),
    },
  },
  {
    name: 'walmart_get_item_count',
    description: 'Get item count grouped by status. Useful for monitoring catalog health.',
    inputSchema: {
      lifecycleStatus: z.enum(['ACTIVE', 'RETIRED']).optional().describe('Filter by lifecycle status'),
      publishedStatus: z.enum(['PUBLISHED', 'UNPUBLISHED', 'STAGE']).optional().describe('Filter by publish status'),
    },
  },
  {
    name: 'walmart_get_taxonomy',
    description: 'Get the complete Walmart product taxonomy (category hierarchy). Use this to find the correct category for item setup.',
    inputSchema: {},
  },
  {
    name: 'walmart_get_item_spec',
    description: 'Get the item specification (required and optional attributes) for a product type. Use this before creating items to know which fields are needed.',
    inputSchema: {
      productType: z.string().describe('Product type name from taxonomy (e.g., "Electronics", "Clothing")'),
      version: z.string().optional().describe('Spec version (optional)'),
    },
  },
  {
    name: 'walmart_submit_item_feed',
    description: 'Submit a bulk item creation feed (feedType=item). Provide item data as JSON. Returns a feedId for tracking. Use walmart_get_feed_status to check progress.',
    inputSchema: {
      feedData: z.record(z.string(), z.unknown()).describe('Item feed payload in Walmart feed format'),
    },
  },
  {
    name: 'walmart_submit_item_update_feed',
    description: 'Submit a bulk item update/maintenance feed (feedType=MP_MAINTENANCE). Use for updating existing item attributes. Returns a feedId.',
    inputSchema: {
      feedData: z.record(z.string(), z.unknown()).describe('Item update feed payload in Walmart feed format'),
    },
  },
  {
    name: 'walmart_submit_wfs_item_feed',
    description: 'Submit a WFS (Walmart Fulfillment Services) item setup feed. Use for items that will be fulfilled by Walmart.',
    inputSchema: {
      feedData: z.record(z.string(), z.unknown()).describe('WFS item feed payload'),
    },
  },
  {
    name: 'walmart_convert_to_wfs',
    description: 'Convert existing seller-fulfilled items to WFS fulfillment (feedType=OMNI_WFS).',
    inputSchema: {
      feedData: z.record(z.string(), z.unknown()).describe('Conversion feed payload'),
    },
  },
  {
    name: 'walmart_get_hazmat_items',
    description: 'Get hazardous materials items currently on hold. These items need compliance documentation before they can be published.',
    inputSchema: {
      requestData: z.record(z.string(), z.unknown()).describe('Hazmat query parameters'),
    },
  },
];
