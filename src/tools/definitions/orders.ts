import { z } from 'zod';

export const orderTools = [
  {
    name: 'walmart_get_all_orders',
    description: 'Get all orders with optional filters. Returns order details including line items, shipping, and payment info.',
    inputSchema: {
      limit: z.number().int().min(1).max(200).optional().describe('Orders per page (default 100, max 200)'),
      offset: z.string().optional().describe('Pagination offset'),
      status: z.enum(['Created', 'Acknowledged', 'Shipped', 'Delivered', 'Cancelled']).optional().describe('Filter by order status'),
      createdStartDate: z.string().optional().describe('Start date filter (ISO 8601, e.g., 2026-01-01T00:00:00.000Z)'),
      createdEndDate: z.string().optional().describe('End date filter (ISO 8601)'),
      customerOrderId: z.string().optional().describe('Filter by customer order ID'),
      purchaseOrderId: z.string().optional().describe('Filter by Walmart purchase order ID'),
      sku: z.string().optional().describe('Filter by SKU'),
      shipNode: z.string().optional().describe('Filter by ship node'),
    },
  },
  {
    name: 'walmart_get_released_orders',
    description: 'Get all released orders (ready to be fulfilled). These orders have been acknowledged and need to be shipped.',
    inputSchema: {
      limit: z.number().int().min(1).max(200).optional().describe('Orders per page'),
      offset: z.string().optional().describe('Pagination offset'),
      createdStartDate: z.string().optional().describe('Start date filter (ISO 8601)'),
      createdEndDate: z.string().optional().describe('End date filter (ISO 8601)'),
      shipNode: z.string().optional().describe('Filter by ship node'),
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
    description: 'Mark order lines as shipped with tracking information. Requires carrier name, tracking number, and ship date.',
    inputSchema: {
      purchaseOrderId: z.string().describe('Walmart purchase order ID'),
      shipmentData: z.record(z.string(), z.unknown()).describe('Shipping details including orderLines with tracking info, carrier, and shipDateTime (UTC)'),
    },
  },
  {
    name: 'walmart_cancel_order',
    description: 'Cancel order lines. Only works for orders in Created or Acknowledged status (not yet shipped).',
    inputSchema: {
      purchaseOrderId: z.string().describe('Walmart purchase order ID'),
      cancelData: z.record(z.string(), z.unknown()).describe('Cancellation details including orderLines and cancellation reason'),
    },
  },
  {
    name: 'walmart_refund_order',
    description: 'Refund order lines. Only works for orders in Shipped status. Refund amount must be negative and cannot exceed original charge.',
    inputSchema: {
      purchaseOrderId: z.string().describe('Walmart purchase order ID'),
      refundData: z.record(z.string(), z.unknown()).describe('Refund details including orderLines with refund amounts and reason'),
    },
  },
  {
    name: 'walmart_get_shipping_carriers',
    description: 'Get list of shipping carriers supported by Walmart for Ship with Walmart (SWW) label purchases.',
    inputSchema: {},
  },
  {
    name: 'walmart_create_shipping_label',
    description: 'Purchase a shipping label through Ship with Walmart (SWW). Supports USPS and FedEx.',
    inputSchema: {
      labelData: z.record(z.string(), z.unknown()).describe('Label purchase details including carrier, package info, and shipping address'),
    },
  },
  {
    name: 'walmart_get_shipping_estimate',
    description: 'Get shipping rate estimates for a package. Returns rates from available carriers.',
    inputSchema: {
      estimateParams: z.record(z.string(), z.unknown()).describe('Estimate parameters including weight, dimensions, origin, and destination'),
    },
  },
];
