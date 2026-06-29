import { z } from 'zod';
import { SkuSchema, MoneySchema, Iso8601UtcSchema } from './shared-schemas.js';

// ---------- Ship order ----------
// Walmart ship payload is deeply nested:
//   { orderLines: { orderLine: [{ lineNumber, orderLineStatuses: { orderLineStatus: [...] } }] } }
const TrackingInfoSchema = z
  .object({
    shipDateTime: Iso8601UtcSchema,
    carrierName: z
      .object({
        carrier: z.string().min(1).optional(),
        otherCarrier: z.string().optional(),
      })
      .passthrough(),
    methodCode: z.string().min(1),
    trackingNumber: z.string().min(1),
    trackingURL: z.string().url().optional(),
  })
  .passthrough();

const ShipOrderLineSchema = z
  .object({
    lineNumber: z.string().min(1),
    orderLineStatuses: z
      .object({
        orderLineStatus: z
          .array(
            z
              .object({
                status: z.enum(['Shipped']).default('Shipped'),
                statusQuantity: z
                  .object({
                    unitOfMeasurement: z.string().default('EACH'),
                    amount: z.string().regex(/^\d+$/, 'amount must be a numeric string'),
                  })
                  .passthrough(),
                trackingInfo: TrackingInfoSchema,
              })
              .passthrough(),
          )
          .min(1),
      })
      .strict(),
  })
  .strict();

const ShipOrderBodySchema = z
  .object({
    orderLines: z
      .object({
        orderLine: z.array(ShipOrderLineSchema).min(1, 'Need at least 1 order line to ship'),
      })
      .strict(),
  })
  .strict();

// ---------- Cancel order ----------
const CancellationReasonSchema = z.enum([
  'CUSTOMER_REQUESTED_SELLER_TO_CANCEL',
  'INVALID_BILLING_ADDRESS',
  'INVALID_SHIPPING_ADDRESS',
  'NO_INVENTORY',
  'PRICING_ERROR',
  'OTHER',
]);

const CancelOrderLineSchema = z
  .object({
    lineNumber: z.string().min(1),
    orderLineStatuses: z
      .object({
        orderLineStatus: z
          .array(
            z
              .object({
                status: z.literal('Cancelled').default('Cancelled'),
                cancellationReason: CancellationReasonSchema,
                statusQuantity: z
                  .object({
                    unitOfMeasurement: z.string().default('EACH'),
                    amount: z.string().regex(/^\d+$/, 'amount must be a numeric string'),
                  })
                  .passthrough(),
              })
              .passthrough(),
          )
          .min(1),
      })
      .strict(),
  })
  .strict();

const CancelOrderBodySchema = z
  .object({
    orderCancellation: z
      .object({
        orderLines: z
          .object({
            orderLine: z.array(CancelOrderLineSchema).min(1),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

// ---------- Refund order ----------
// Walmart wants refundAmount as a NEGATIVE number.
const ChargeSchema = z
  .object({
    chargeType: z.enum(['PRODUCT', 'SHIPPING', 'TAX', 'FEE']),
    chargeName: z.string().min(1),
    chargeAmount: z
      .object({
        currency: z.enum(['USD', 'MXN', 'CAD', 'CLP']),
        amount: z.number().negative('Refund amount must be negative (e.g. -10.50)'),
      })
      .strict(),
    tax: z.unknown().optional(),
  })
  .passthrough();

const RefundOrderLineSchema = z
  .object({
    lineNumber: z.string().min(1),
    refunds: z
      .object({
        refund: z
          .array(
            z
              .object({
                refundComments: z.string().min(1),
                refundCharges: z
                  .object({
                    refundCharge: z
                      .array(
                        z
                          .object({
                            refundReason: z.string().min(1),
                            charge: ChargeSchema,
                          })
                          .strict(),
                      )
                      .min(1),
                  })
                  .strict(),
              })
              .passthrough(),
          )
          .min(1),
      })
      .strict(),
  })
  .strict();

const RefundOrderBodySchema = z
  .object({
    orderLines: z
      .object({
        orderLine: z.array(RefundOrderLineSchema).min(1, 'Need at least 1 line to refund'),
      })
      .strict(),
  })
  .strict();

// ---------- Ship-with-Walmart label purchase ----------
const ShippingLabelSchema = z
  .object({
    purchaseOrderId: z.string().min(1),
    lineNumber: z.string().min(1).optional(),
    carrierName: z.enum(['USPS', 'FedEx']).optional(),
    serviceType: z.string().optional(),
    package: z
      .object({
        weight: z
          .object({
            value: z.number().positive(),
            unit: z.enum(['LB', 'OZ', 'KG', 'G']).default('LB'),
          })
          .strict(),
        dimensions: z
          .object({
            length: z.number().positive(),
            width: z.number().positive(),
            height: z.number().positive(),
            unit: z.enum(['IN', 'CM']).default('IN'),
          })
          .strict()
          .optional(),
      })
      .strict(),
  })
  .passthrough();

// ---------- Shipping rate estimate ----------
const ShippingEstimateSchema = z
  .object({
    fromAddress: z.unknown().optional(),
    toAddress: z.unknown().optional(),
    package: z
      .object({
        weight: z
          .object({
            value: z.number().positive(),
            unit: z.enum(['LB', 'OZ', 'KG', 'G']).default('LB'),
          })
          .strict(),
        dimensions: z
          .object({
            length: z.number().positive(),
            width: z.number().positive(),
            height: z.number().positive(),
            unit: z.enum(['IN', 'CM']).default('IN'),
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
  })
  .passthrough();

export const orderTools = [
  {
    name: 'walmart_get_all_orders',
    description:
      'Get all orders with optional filters. Returns order details including line items, shipping, and payment info.',
    inputSchema: {
      limit: z.number().int().min(1).max(200).optional().describe('Orders per page (default 100, max 200)'),
      offset: z.string().optional().describe('Pagination offset'),
      status: z
        .enum(['Created', 'Acknowledged', 'Shipped', 'Delivered', 'Cancelled'])
        .optional()
        .describe('Filter by order status'),
      createdStartDate: z.string().optional().describe('Start date filter (ISO 8601, e.g., 2026-01-01T00:00:00.000Z)'),
      createdEndDate: z.string().optional().describe('End date filter (ISO 8601)'),
      customerOrderId: z.string().optional().describe('Filter by customer order ID'),
      purchaseOrderId: z.string().optional().describe('Filter by Walmart purchase order ID'),
      sku: SkuSchema.optional().describe('Filter by SKU'),
      shipNode: z.string().optional().describe('Filter by ship node'),
    },
  },
  {
    name: 'walmart_get_released_orders',
    description: 'Get all released orders (ready to be fulfilled). These orders have been acknowledged and need to be shipped.',
    inputSchema: {
      limit: z.number().int().min(1).max(200).optional(),
      offset: z.string().optional(),
      createdStartDate: z.string().optional(),
      createdEndDate: z.string().optional(),
      shipNode: z.string().optional(),
    },
  },
  {
    name: 'walmart_get_order',
    description: 'Get a single order by purchase order ID. Returns full order details including all line items.',
    inputSchema: {
      purchaseOrderId: z.string().describe('Walmart purchase order ID'),
    },
  },
  {
    name: 'walmart_acknowledge_order',
    description: 'Acknowledge a new order. This confirms you received the order and intend to fulfill it.',
    inputSchema: {
      purchaseOrderId: z.string().describe('Walmart purchase order ID to acknowledge'),
    },
  },
  {
    name: 'walmart_ship_order',
    description:
      'Mark order lines as shipped with tracking info. Body shape: ' +
      '{ orderLines: { orderLine: [{ lineNumber, orderLineStatuses: { orderLineStatus: ' +
      '[{ status: "Shipped", statusQuantity, trackingInfo: { shipDateTime, carrierName, ' +
      'methodCode, trackingNumber } }] } }] } }. shipDateTime is ISO 8601 UTC.',
    inputSchema: {
      purchaseOrderId: z.string().describe('Walmart purchase order ID'),
      shipmentData: ShipOrderBodySchema,
    },
  },
  {
    name: 'walmart_cancel_order',
    description:
      'Cancel order lines. Only works for orders in Created or Acknowledged status (not yet shipped). ' +
      'cancellationReason must be one of CUSTOMER_REQUESTED_SELLER_TO_CANCEL, INVALID_BILLING_ADDRESS, ' +
      'INVALID_SHIPPING_ADDRESS, NO_INVENTORY, PRICING_ERROR, OTHER.',
    inputSchema: {
      purchaseOrderId: z.string().describe('Walmart purchase order ID'),
      cancelData: CancelOrderBodySchema,
    },
  },
  {
    name: 'walmart_refund_order',
    description:
      'Refund order lines. Only works for orders in Shipped status. chargeAmount.amount MUST be ' +
      'a negative number (e.g. -10.50). chargeType: PRODUCT | SHIPPING | TAX | FEE.',
    inputSchema: {
      purchaseOrderId: z.string().describe('Walmart purchase order ID'),
      refundData: RefundOrderBodySchema,
    },
  },
  {
    name: 'walmart_get_shipping_carriers',
    description: 'Get list of shipping carriers supported by Walmart for Ship with Walmart (SWW) label purchases.',
    inputSchema: {},
  },
  {
    name: 'walmart_create_shipping_label',
    description:
      'Purchase a shipping label through Ship with Walmart (SWW). Required: purchaseOrderId + ' +
      'package.weight. Optional: carrierName (USPS|FedEx), package.dimensions.',
    inputSchema: {
      labelData: ShippingLabelSchema,
    },
  },
  {
    name: 'walmart_get_shipping_estimate',
    description: 'Get shipping rate estimates for a package. Returns rates from available carriers.',
    inputSchema: {
      estimateParams: ShippingEstimateSchema,
    },
  },
];
