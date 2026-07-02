import { WalmartApiClient } from '../client.js';

/** Compact per-order projection used when `summary: true` (the default). */
interface OrderSummary {
  purchaseOrderId?: string;
  customerOrderId?: string;
  orderDate?: string;
  shipTo?: string;
  estimatedShipDate?: string;
  lines: Array<{
    sku?: string;
    productName?: string;
    qty?: string;
    itemPrice?: number;
    status?: string;
    trackingNumber?: string;
    carrier?: string;
  }>;
}

/**
 * Project Walmart's very verbose order objects (~3KB each) down to the
 * fields an operator actually acts on (~0.3KB each). Full payloads remain
 * available via `summary: false` or walmart_get_order for a single PO.
 */
function summarizeOrders(raw: unknown): unknown {
  const list = (raw as { list?: { meta?: unknown; elements?: { order?: unknown[] } } })?.list;
  const orders = list?.elements?.order;
  if (!Array.isArray(orders)) return raw; // unexpected shape — return untouched

  const summarized: OrderSummary[] = orders.map((o) => {
    const order = o as Record<string, any>;
    const postal = order?.shippingInfo?.postalAddress ?? {};
    const lines = order?.orderLines?.orderLine ?? [];
    return {
      purchaseOrderId: order?.purchaseOrderId,
      customerOrderId: order?.customerOrderId,
      orderDate: order?.orderDate ? new Date(order.orderDate).toISOString() : undefined,
      shipTo: [postal?.name, postal?.city, postal?.state].filter(Boolean).join(', ') || undefined,
      estimatedShipDate: order?.shippingInfo?.estimatedShipDate
        ? new Date(order.shippingInfo.estimatedShipDate).toISOString()
        : undefined,
      lines: (Array.isArray(lines) ? lines : []).map((l: Record<string, any>) => {
        const lineStatus = l?.orderLineStatuses?.orderLineStatus?.[0];
        const charge = l?.charges?.charge?.[0];
        return {
          sku: l?.item?.sku,
          productName:
            typeof l?.item?.productName === 'string' && l.item.productName.length > 80
              ? `${l.item.productName.slice(0, 77)}...`
              : l?.item?.productName,
          qty: l?.orderLineQuantity?.amount,
          itemPrice: charge?.chargeAmount?.amount,
          status: lineStatus?.status,
          trackingNumber: lineStatus?.trackingInfo?.trackingNumber,
          carrier: lineStatus?.trackingInfo?.carrierName?.carrier,
        };
      }),
    };
  });

  return {
    summary: true,
    hint: 'Compact projection. Pass summary: false for full order objects, or use walmart_get_order for one PO.',
    meta: list?.meta,
    orders: summarized,
  };
}

export class OrdersApi {
  private basePath = '/v3/orders';

  constructor(private client: WalmartApiClient) {}

  async getAllOrders(params?: {
    limit?: number;
    offset?: string;
    status?: string;
    createdStartDate?: string;
    createdEndDate?: string;
    customerOrderId?: string;
    purchaseOrderId?: string;
    sku?: string;
    shipNode?: string;
    summary?: boolean;
  }) {
    const { summary, ...query } = params ?? {};
    const raw = await this.client.get(this.basePath, query);
    // Default to the compact projection: Walmart returns ~3KB per order and
    // a 100-order page would otherwise flood an AI caller's context.
    return summary === false ? raw : summarizeOrders(raw);
  }

  async getReleasedOrders(params?: {
    limit?: number;
    offset?: string;
    createdStartDate?: string;
    createdEndDate?: string;
    shipNode?: string;
  }) {
    return await this.client.get(`${this.basePath}/released`, params);
  }

  async getOrder(purchaseOrderId: string) {
    if (!purchaseOrderId) throw new Error('purchaseOrderId is required');
    return await this.client.get(`${this.basePath}/${encodeURIComponent(purchaseOrderId)}`);
  }

  async acknowledgeOrder(purchaseOrderId: string) {
    if (!purchaseOrderId) throw new Error('purchaseOrderId is required');
    return await this.client.post(
      `${this.basePath}/${encodeURIComponent(purchaseOrderId)}/acknowledge`,
    );
  }

  async shipOrder(purchaseOrderId: string, data: object) {
    if (!purchaseOrderId) throw new Error('purchaseOrderId is required');
    return await this.client.post(
      `${this.basePath}/${encodeURIComponent(purchaseOrderId)}/shipping`,
      data,
    );
  }

  async cancelOrder(purchaseOrderId: string, data: object) {
    if (!purchaseOrderId) throw new Error('purchaseOrderId is required');
    return await this.client.post(
      `${this.basePath}/${encodeURIComponent(purchaseOrderId)}/cancel`,
      data,
    );
  }

  async refundOrder(purchaseOrderId: string, data: object) {
    if (!purchaseOrderId) throw new Error('purchaseOrderId is required');
    return await this.client.post(
      `${this.basePath}/${encodeURIComponent(purchaseOrderId)}/refund`,
      data,
    );
  }

  async getShippingCarriers() {
    return await this.client.get('/v3/shipping/carriers');
  }

  async createShippingLabel(data: object) {
    return await this.client.post('/v3/shipping/labels', data);
  }

  async getShippingEstimate(params: object) {
    return await this.client.get('/v3/shipping/estimate', params);
  }
}
