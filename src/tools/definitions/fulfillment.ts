import { z } from 'zod';

export const fulfillmentTools = [
  // ===== WFS Inbound =====
  {
    name: 'walmart_create_inbound_order',
    description: 'Create a WFS (Walmart Fulfillment Services) inbound shipment order. Send inventory to Walmart fulfillment centers.',
    inputSchema: {
      orderData: z.record(z.string(), z.unknown()).describe('Inbound order details including items, quantities, and ship-from address'),
    },
  },
  {
    name: 'walmart_get_inbound_shipments',
    description: 'Get list of WFS inbound shipments with optional filtering by status.',
    inputSchema: {
      limit: z.number().int().min(1).max(200).optional().describe('Results per page'),
      offset: z.number().int().min(0).optional().describe('Pagination offset'),
      status: z.string().optional().describe('Filter by shipment status'),
    },
  },
  {
    name: 'walmart_get_inbound_errors',
    description: 'Get inbound shipment errors. Use to diagnose issues with WFS inbound orders.',
    inputSchema: {
      inboundOrderId: z.string().optional().describe('Filter by inbound order ID'),
      shipmentId: z.string().optional().describe('Filter by shipment ID'),
    },
  },
  {
    name: 'walmart_get_shipment_items',
    description: 'Get SKU-level details for a WFS shipment including quantities received and expected.',
    inputSchema: {
      shipmentId: z.string().optional().describe('Shipment ID to get items for'),
      limit: z.number().int().min(1).max(200).optional().describe('Results per page'),
      offset: z.number().int().min(0).optional().describe('Pagination offset'),
    },
  },
  {
    name: 'walmart_get_shipment_quantities',
    description: 'Get shipment quantity breakdown: expected, received, and discrepancies.',
    inputSchema: {
      shipmentId: z.string().optional().describe('Shipment ID'),
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
    description: 'Update tracking information for a WFS inbound shipment.',
    inputSchema: {
      trackingData: z.record(z.string(), z.unknown()).describe('Tracking update data including shipmentId, carrier, and tracking number'),
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
    description: 'Void/discard a previously purchased shipping label. Must be done before carrier pickup.',
    inputSchema: {
      labelData: z.record(z.string(), z.unknown()).describe('Label discard details including trackingNumber and carrierShortName'),
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
    description: 'Create a WFS multichannel order. Ship WFS inventory for orders from other sales channels (non-Walmart).',
    inputSchema: {
      orderData: z.record(z.string(), z.unknown()).describe('Multichannel order details including items, shipping address, and service level'),
    },
  },
  {
    name: 'walmart_cancel_mcs_order',
    description: 'Cancel a WFS multichannel order before it ships.',
    inputSchema: {
      cancelData: z.record(z.string(), z.unknown()).describe('Cancellation details including orderId'),
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
    description: 'Get shipping rate quotes from WFS carriers for an inbound shipment.',
    inputSchema: {
      quoteData: z.record(z.string(), z.unknown()).describe('Quote request details including package dimensions, weight, and destination'),
    },
  },
  {
    name: 'walmart_book_carrier_shipment',
    description: 'Book a carrier shipment using a WFS carrier rate quote.',
    inputSchema: {
      bookingData: z.record(z.string(), z.unknown()).describe('Booking details including quoteId and shipment info'),
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
    description: 'Schedule a carrier pickup for a WFS inbound shipment.',
    inputSchema: {
      pickupData: z.record(z.string(), z.unknown()).describe('Pickup scheduling details including date, time window, and address'),
    },
  },
];
