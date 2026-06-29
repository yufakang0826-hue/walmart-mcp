import { z } from 'zod';
import { SkuSchema, Iso8601UtcSchema, QuantitySchema } from './shared-schemas.js';

// ---------- Shared atoms for WFS ----------
const PostalAddressSchema = z
  .object({
    addressLine1: z.string().min(1).max(200),
    addressLine2: z.string().max(200).optional(),
    city: z.string().min(1).max(100),
    state: z.string().min(2).max(50),
    postalCode: z.string().min(3).max(20),
    country: z.string().length(3, 'country must be ISO 3166-1 alpha-3 (USA, MEX, etc.)').default('USA'),
    phone: z.string().optional(),
    name: z.string().optional(),
  })
  .passthrough();

const PackageWeightSchema = z
  .object({
    value: z.number().positive(),
    unit: z.enum(['LB', 'OZ', 'KG', 'G']).default('LB'),
  })
  .strict();

const PackageDimensionsSchema = z
  .object({
    length: z.number().positive(),
    width: z.number().positive(),
    height: z.number().positive(),
    unit: z.enum(['IN', 'CM']).default('IN'),
  })
  .strict();

// ---------- WFS Inbound order ----------
const InboundOrderBodySchema = z
  .object({
    inboundOrderItems: z
      .array(
        z
          .object({
            sku: SkuSchema,
            expectedQuantity: z.number().int().positive(),
            packagingType: z.enum(['CASE', 'PALLET', 'EACH']).optional(),
          })
          .passthrough(),
      )
      .min(1, 'Inbound order needs at least 1 item'),
    shipFromAddress: PostalAddressSchema,
    expectedArrivalDate: Iso8601UtcSchema.optional(),
  })
  .passthrough();

// ---------- WFS tracking update ----------
const TrackingUpdateSchema = z
  .object({
    shipmentId: z.string().min(1, 'shipmentId required'),
    carrier: z.string().min(1, 'carrier required'),
    trackingNumber: z.string().min(1, 'trackingNumber required'),
    shipDateTime: Iso8601UtcSchema.optional(),
  })
  .passthrough();

// ---------- WFS label discard ----------
const DiscardLabelSchema = z
  .object({
    trackingNumber: z.string().min(1),
    carrierShortName: z.enum(['USPS', 'FedEx', 'UPS', 'DHL']),
  })
  .strict();

// ---------- WFS Multichannel order ----------
const McsOrderBodySchema = z
  .object({
    orderId: z.string().min(1),
    items: z
      .array(
        z
          .object({
            sku: SkuSchema,
            quantity: z.number().int().positive(),
          })
          .passthrough(),
      )
      .min(1),
    shippingAddress: PostalAddressSchema,
    serviceLevel: z.enum(['STANDARD', 'EXPEDITED', 'NEXT_DAY']).default('STANDARD'),
  })
  .passthrough();

const McsCancelSchema = z
  .object({
    orderId: z.string().min(1),
    reason: z.string().optional(),
  })
  .passthrough();

// ---------- WFS carrier rate quote ----------
const RateQuoteSchema = z
  .object({
    fromAddress: PostalAddressSchema,
    toAddress: PostalAddressSchema,
    packages: z
      .array(
        z
          .object({
            weight: PackageWeightSchema,
            dimensions: PackageDimensionsSchema.optional(),
            quantity: z.number().int().positive().default(1),
          })
          .strict(),
      )
      .min(1, 'Need at least 1 package'),
  })
  .passthrough();

// ---------- WFS carrier shipment booking ----------
const CarrierBookingSchema = z
  .object({
    quoteId: z.string().min(1, 'quoteId required'),
    shipmentInfo: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

// ---------- WFS pickup scheduling ----------
const PickupSchedulingSchema = z
  .object({
    shipmentId: z.string().min(1),
    pickupDate: Iso8601UtcSchema,
    pickupTimeWindow: z
      .object({
        start: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, 'start must be HH:MM'),
        end: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, 'end must be HH:MM'),
      })
      .strict()
      .optional(),
    pickupAddress: PostalAddressSchema,
  })
  .passthrough();

export const fulfillmentTools = [
  // ===== WFS Inbound =====
  {
    name: 'walmart_create_inbound_order',
    description:
      'Create a WFS inbound shipment order. Required: inboundOrderItems[] (sku + expectedQuantity), ' +
      'shipFromAddress (full postal address). Optional: expectedArrivalDate (ISO 8601 UTC).',
    inputSchema: {
      orderData: InboundOrderBodySchema,
    },
  },
  {
    name: 'walmart_get_inbound_shipments',
    description: 'Get list of WFS inbound shipments with optional filtering by status.',
    inputSchema: {
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
      status: z.string().optional(),
    },
  },
  {
    name: 'walmart_get_inbound_errors',
    description: 'Get inbound shipment errors. Use to diagnose issues with WFS inbound orders.',
    inputSchema: {
      inboundOrderId: z.string().optional(),
      shipmentId: z.string().optional(),
    },
  },
  {
    name: 'walmart_get_shipment_items',
    description: 'Get SKU-level details for a WFS shipment including quantities received and expected.',
    inputSchema: {
      shipmentId: z.string().optional(),
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.number().int().min(0).optional(),
    },
  },
  {
    name: 'walmart_get_shipment_quantities',
    description: 'Get shipment quantity breakdown: expected, received, and discrepancies.',
    inputSchema: {
      shipmentId: z.string().optional(),
    },
  },
  {
    name: 'walmart_get_shipment_label',
    description: 'Get the shipping label for a WFS inbound shipment.',
    inputSchema: {
      shipmentId: z.string().describe('Shipment ID to get label for'),
    },
  },
  {
    name: 'walmart_update_shipment_tracking',
    description:
      'Update tracking information for a WFS inbound shipment. Required: shipmentId, carrier, ' +
      'trackingNumber. Optional: shipDateTime (ISO 8601 UTC).',
    inputSchema: {
      trackingData: TrackingUpdateSchema,
    },
  },
  {
    name: 'walmart_cancel_inbound_order',
    description: 'Cancel a WFS inbound order. Only works for orders not yet received at fulfillment center.',
    inputSchema: {
      inboundOrderId: z.string().describe('Inbound order ID to cancel'),
    },
  },

  // ===== Shipping Labels =====
  {
    name: 'walmart_get_purchased_label',
    description: 'Get a previously purchased shipping label by purchase order ID (Ship with Walmart).',
    inputSchema: {
      purchaseOrderId: z.string().describe('Purchase order ID the label was created for'),
    },
  },
  {
    name: 'walmart_get_label_by_tracking',
    description: 'Get a shipping label by carrier ID and tracking number.',
    inputSchema: {
      carrierId: z.string().describe('Carrier ID (e.g., USPS, FedEx)'),
      trackingNo: z.string().describe('Tracking number'),
    },
  },
  {
    name: 'walmart_discard_label',
    description:
      'Void/discard a previously purchased shipping label. Required: trackingNumber + ' +
      'carrierShortName (USPS|FedEx|UPS|DHL). Must be done before carrier pickup.',
    inputSchema: {
      labelData: DiscardLabelSchema,
    },
  },
  {
    name: 'walmart_get_package_types',
    description: 'Get available package types for a specific carrier. Needed when creating shipping labels.',
    inputSchema: {
      carrierId: z.string().describe('Carrier ID to get package types for'),
    },
  },

  // ===== Multichannel Solutions =====
  {
    name: 'walmart_create_mcs_order',
    description:
      'Create a WFS multichannel order. Required: orderId, items[] (sku + quantity), ' +
      'shippingAddress. Optional: serviceLevel (STANDARD|EXPEDITED|NEXT_DAY).',
    inputSchema: {
      orderData: McsOrderBodySchema,
    },
  },
  {
    name: 'walmart_cancel_mcs_order',
    description: 'Cancel a WFS multichannel order before it ships.',
    inputSchema: {
      cancelData: McsCancelSchema,
    },
  },
  {
    name: 'walmart_get_mcs_order_status',
    description: 'Get status of a WFS multichannel order.',
    inputSchema: {
      orderId: z.string().describe('Multichannel order ID'),
    },
  },

  // ===== WFS Carrier =====
  {
    name: 'walmart_get_carrier_rate_quotes',
    description:
      'Get shipping rate quotes from WFS carriers. Required: fromAddress, toAddress, packages[] ' +
      '(each with weight). Returns rate options per carrier.',
    inputSchema: {
      quoteData: RateQuoteSchema,
    },
  },
  {
    name: 'walmart_book_carrier_shipment',
    description: 'Book a carrier shipment using a WFS carrier rate quote. Required: quoteId.',
    inputSchema: {
      bookingData: CarrierBookingSchema,
    },
  },
  {
    name: 'walmart_get_carrier_label',
    description: 'Get the carrier shipping label for a booked WFS shipment.',
    inputSchema: {
      shipmentId: z.string().describe('WFS shipment ID'),
    },
  },
  {
    name: 'walmart_schedule_carrier_pickup',
    description:
      'Schedule a carrier pickup for a WFS inbound shipment. Required: shipmentId, pickupDate ' +
      '(ISO 8601 UTC), pickupAddress. Optional pickupTimeWindow (HH:MM format).',
    inputSchema: {
      pickupData: PickupSchedulingSchema,
    },
  },
];
