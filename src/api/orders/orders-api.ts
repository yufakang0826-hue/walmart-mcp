import { WalmartApiClient } from '../client.js';

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
  }) {
    return await this.client.get(this.basePath, params);
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
