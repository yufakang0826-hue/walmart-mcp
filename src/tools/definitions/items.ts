import { z } from 'zod';
import { SkuSchema, GtinSchema } from './shared-schemas.js';

// ---------- MP_ITEM feed envelope ----------
const MpItemEnvelopeSchema = z
  .object({
    MPItemFeedHeader: z
      .object({
        version: z.string().default('5.0'),
        sellingChannel: z.literal('marketplace').default('marketplace'),
        locale: z.string().default('en'),
        requestId: z.string().optional(),
      })
      .passthrough(),
    MPItem: z
      .array(
        z
          .object({
            Item: z
              .object({
                sku: SkuSchema,
                productIdentifiers: z
                  .object({
                    productIdType: z.enum(['GTIN', 'UPC', 'ISBN', 'EAN']).optional(),
                    productId: z.string().min(1).optional(),
                  })
                  .passthrough()
                  .optional(),
              })
              .passthrough(),
          })
          .passthrough(),
      )
      .min(1, 'MP_ITEM feed needs at least 1 item')
      .max(10_000, 'Walmart caps MP_ITEM feeds at ~10000 items per submission'),
  })
  .strict();

// ---------- MP_MAINTENANCE feed envelope ----------
// Spec 5.0 partial-update format, reverse-engineered against production and
// confirmed by the official docs (2026-07):
//
//   MPItemFeedHeader: ONLY { businessUnit, locale, version } are allowed.
//     - `subset`, `requestId`, `mart`, `feedDate` → per-item DATA_ERROR
//       ("X is not a valid field", fatal).
//     - `sellingChannel` / `processMode` → accepted by the validator BUT they
//       flip Walmart's parser into a legacy path that dereferences `subset`
//       and crashes with ERR_INT_DATA_01010092 (PGW NullPointerException,
//       itemsReceived=0) when it is absent. Never send them.
//     - `version` must be the FULL dated spec string; "5.0" fails with
//       WM_SPEC_MODE (see DEFAULT_ITEM_SPEC_VERSION).
//   MPItem[]: { Orderable: { sku, productIdentifiers }, Visible: { "<Product
//     Type>": { productName, shortDescription, keyFeatures, ... } } }.
//     The legacy `Item` wrapper is rejected by Walmart ("'Item' is not a
//     valid field") — productName lives under Visible, NOT Orderable.
//
// Header uses zod strip mode (plain .object) so dangerous extra fields are
// silently dropped locally instead of poisoning the feed.
const MaintenanceHeaderSchema = z.object({
  businessUnit: z.string().optional().describe('e.g. WALMART_US; defaults from configured market'),
  locale: z.string().default('en'),
  version: z
    .string()
    .optional()
    .describe('Full dated spec version, e.g. 5.0.20260501-19_21_29-api; defaults to the current known version'),
});

const MaintenanceItemSchema = z
  .object({
    Orderable: z
      .object({
        sku: SkuSchema,
        productIdentifiers: z
          .object({
            productIdType: z.enum(['GTIN', 'UPC', 'ISBN', 'EAN']).optional(),
            productId: z.string().min(1).optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough(),
    Visible: z
      .record(z.string(), z.record(z.string(), z.unknown()))
      .optional()
      .describe('Keyed by Product Type, e.g. { "Camera Bags & Cases": { productName, shortDescription, keyFeatures } }'),
  })
  .passthrough()
  .superRefine((val, ctx) => {
    if ('Item' in val) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Spec 5.0 does not use an `Item` wrapper. Put sku + productIdentifiers in `Orderable` ' +
          'and content fields (productName, shortDescription, keyFeatures, ...) in ' +
          '`Visible["<Product Type>"]`. Get the product type from walmart_get_item.',
      });
    }
  });

const MpMaintenanceEnvelopeSchema = z
  .object({
    MPItemFeedHeader: MaintenanceHeaderSchema.default({}),
    MPItem: z.array(MaintenanceItemSchema).min(1).max(10_000),
  })
  .strict();

// ---------- MP_RETIRE_ITEM bulk retire ----------
const BulkRetireSchema = z
  .object({
    skus: z
      .array(z.object({ sku: SkuSchema }).strict())
      .min(1, 'Need at least 1 SKU to retire')
      .max(1_000, 'Bulk retire capped at 1000 SKUs per call'),
  })
  .strict();

// ---------- Hazmat search ----------
const HazmatSearchSchema = z
  .object({
    sku: SkuSchema.optional(),
    gtin: GtinSchema.optional(),
    limit: z.number().int().min(1).max(200).optional(),
    offset: z.number().int().min(0).optional(),
  })
  .passthrough();

// ---------- WFS item feed (feedType=WFS_ITEM) ----------
// Walmart WFS item feed includes per-item dimensions, weight, and storage attributes.
const WfsItemEnvelopeSchema = z
  .object({
    WFSItemFeedHeader: z
      .object({
        version: z.string().default('1.0'),
        feedDate: z.string().datetime({ offset: true }).optional(),
      })
      .passthrough(),
    WFSItem: z
      .array(
        z
          .object({
            sku: SkuSchema,
            wfsAttributes: z
              .object({
                weight: z.number().positive().optional(),
                weightUnit: z.enum(['LB', 'OZ', 'KG', 'G']).optional(),
                length: z.number().positive().optional(),
                width: z.number().positive().optional(),
                height: z.number().positive().optional(),
                dimensionUnit: z.enum(['IN', 'CM']).optional(),
              })
              .passthrough()
              .optional(),
          })
          .passthrough(),
      )
      .min(1)
      .max(10_000),
  })
  .strict();

// ---------- OMNI_WFS conversion feed ----------
// Converts existing SF SKUs to WFS-fulfilled. Body has list of SKUs and unit attributes.
const ConvertToWfsEnvelopeSchema = z
  .object({
    OmniWFSFeedHeader: z
      .object({
        version: z.string().default('1.0'),
      })
      .passthrough(),
    OmniWFSItem: z
      .array(
        z
          .object({
            sku: SkuSchema,
            convertToWFS: z.boolean().default(true),
          })
          .passthrough(),
      )
      .min(1)
      .max(10_000),
  })
  .strict();

export const itemTools = [
  {
    name: 'walmart_get_all_items',
    description:
      'Get all items in the seller catalog with pagination. Returns item details including SKU, ' +
      'title, price, publish status, and lifecycle status.',
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
    description:
      'Get a single item by SKU. Returns full item details including product attributes, price, ' +
      'inventory, and listing quality.',
    inputSchema: {
      sku: z.string().describe('Seller-defined SKU identifier'),
    },
  },
  {
    name: 'walmart_retire_item',
    description:
      'Retire (unpublish) an item by SKU. This removes the item from the Walmart marketplace. ' +
      'The item can be re-listed later by submitting an MP_ITEM feed for the same SKU.',
    inputSchema: {
      sku: SkuSchema.describe('SKU of the item to retire'),
    },
  },
  {
    name: 'walmart_bulk_retire_items',
    description:
      'Retire multiple items at once. Pass `skus: [{ sku }, ...]`. Walmart caps bulk retire at ' +
      '~1000 SKUs per call.',
    inputSchema: {
      skus: BulkRetireSchema.shape.skus,
    },
  },
  {
    name: 'walmart_get_item_count',
    description:
      'Get item count grouped by status. Useful for monitoring catalog health. The status ' +
      'parameter is required by Walmart and defaults to PUBLISHED.',
    inputSchema: {
      status: z.enum(['PUBLISHED', 'UNPUBLISHED', 'STAGE']).optional().describe('Item status to count (defaults to PUBLISHED)'),
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
    description:
      'Get the item specification (required and optional attributes) for a product type. Use this ' +
      'before creating or updating items to know which fields are needed. Walmart requires the ' +
      'FULL dated spec version (defaulted automatically) and throttles this endpoint at ~3 ' +
      'requests/minute.',
    inputSchema: {
      productType: z.string().describe('Product type name from taxonomy (e.g., "Camera Bags & Cases")'),
      feedType: z
        .enum(['MP_ITEM', 'MP_MAINTENANCE', 'MP_WFS_ITEM', 'OMNI_WFS'])
        .optional()
        .describe('Item setup data model (default MP_ITEM)'),
      version: z
        .string()
        .optional()
        .describe('Full dated spec version, e.g. 5.0.20260501-19_21_29-api (defaults to current known version)'),
    },
  },
  {
    name: 'walmart_submit_item_feed',
    description:
      'Submit a bulk item creation feed (feedType=item). Envelope: { MPItemFeedHeader, ' +
      'MPItem: [{ Item: { sku, productIdentifiers, ...attributes } }] }. Per-item content fields ' +
      'vary by productType — call walmart_get_item_spec first. Returns a feedId.',
    inputSchema: {
      feedData: MpItemEnvelopeSchema,
    },
  },
  {
    name: 'walmart_submit_item_update_feed',
    description:
      'Submit a bulk item update / maintenance feed (feedType=MP_MAINTENANCE, spec 5.0 partial ' +
      'update) to change listing content (title, description, key features, attributes) of ' +
      'existing SKUs. Envelope: { MPItemFeedHeader: { businessUnit, locale, version }, MPItem: ' +
      '[{ Orderable: { sku, productIdentifiers }, Visible: { "<Product Type>": { productName, ' +
      'shortDescription, keyFeatures, ... } } }] }. Header/version defaults are filled in ' +
      'automatically — usually just pass MPItem. productName goes in Visible (NOT Orderable); ' +
      'get the Product Type string from walmart_get_item. Price/inventory have their own tools. ' +
      'Returns a feedId. Example item: { Orderable: { sku: "ABC-1", productIdentifiers: { ' +
      'productIdType: "UPC", productId: "123456789012" } }, Visible: { "Camera Bags & Cases": { ' +
      'productName: "New Title", shortDescription: "...", keyFeatures: ["...", "..."] } } }',
    inputSchema: {
      feedData: MpMaintenanceEnvelopeSchema,
    },
  },
  {
    name: 'walmart_submit_wfs_item_feed',
    description:
      'Submit a WFS item setup feed (feedType=WFS_ITEM). Envelope: { WFSItemFeedHeader, ' +
      'WFSItem: [{ sku, wfsAttributes: { weight, length, width, height, units } }] }. ' +
      'Returns a feedId.',
    inputSchema: {
      feedData: WfsItemEnvelopeSchema,
    },
  },
  {
    name: 'walmart_convert_to_wfs',
    description:
      'Convert existing seller-fulfilled items to WFS fulfillment (feedType=OMNI_WFS). Envelope: ' +
      '{ OmniWFSFeedHeader, OmniWFSItem: [{ sku, convertToWFS: true }] }.',
    inputSchema: {
      feedData: ConvertToWfsEnvelopeSchema,
    },
  },
  {
    name: 'walmart_get_hazmat_items',
    description:
      'Get items on hold for hazmat compliance review (POST /v3/items/onhold/search). These items ' +
      'need compliance documentation before they can be published.',
    inputSchema: {
      requestData: HazmatSearchSchema.optional(),
    },
  },
];
