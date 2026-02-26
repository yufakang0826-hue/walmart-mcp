import { WalmartApiClient } from '../client.js';

export class FulfillmentApi {
  constructor(private client: WalmartApiClient) {}

  // ===== WFS Inbound =====

  async createInboundOrder(data: object) {
    return await this.client.post('/v3/inbound-shipments', data);
  }

  async getInboundShipments(params?: {
    limit?: number;
    offset?: number;
    status?: string;
  }) {
    return await this.client.get('/v3/inbound-shipments', params);
  }

  async getInboundErrors(params?: {
    inboundOrderId?: string;
    shipmentId?: string;
  }) {
    return await this.client.get('/v3/inbound-shipment-errors', params);
  }

  async getShipmentItems(params?: {
    shipmentId?: string;
    limit?: number;
    offset?: number;
  }) {
    return await this.client.get('/v3/shipment-items', params);
  }

  async getShipmentQuantities(params?: {
    shipmentId?: string;
  }) {
    return await this.client.get('/v3/shipment-quantities', params);
  }

  async getShipmentLabel(shipmentId: string) {
    if (!shipmentId) throw new Error('shipmentId is required');
    return await this.client.get(`/v3/fulfillment/label/${encodeURIComponent(shipmentId)}`);
  }

  async updateShipmentTracking(data: object) {
    return await this.client.post('/v3/shipment-tracking', data);
  }

  async cancelInboundOrder(inboundOrderId: string) {
    if (!inboundOrderId) throw new Error('inboundOrderId is required');
    return await this.client.delete(`/v3/inbound-shipments/${encodeURIComponent(inboundOrderId)}`);
  }

  // ===== Shipping Labels =====

  async getShippingLabel(purchaseOrderId: string) {
    if (!purchaseOrderId) throw new Error('purchaseOrderId is required');
    return await this.client.get(`/v3/shipping/labels/${encodeURIComponent(purchaseOrderId)}`);
  }

  async getLabelByTracking(carrierId: string, trackingNo: string) {
    if (!carrierId || !trackingNo) throw new Error('carrierId and trackingNo are required');
    return await this.client.get(
      `/v3/shipping/labels/carriers/${encodeURIComponent(carrierId)}/trackings/${encodeURIComponent(trackingNo)}`,
    );
  }

  async discardLabel(data: object) {
    return await this.client.post('/v3/shipping/labels/discard', data);
  }

  async getPackageTypes(carrierId: string) {
    if (!carrierId) throw new Error('carrierId is required');
    return await this.client.get(
      `/v3/shipping/carriers/${encodeURIComponent(carrierId)}/packagetypes`,
    );
  }

  // ===== Multichannel Solutions =====

  async createMcsOrder(data: object) {
    return await this.client.post('/v3/mcs/orders', data);
  }

  async cancelMcsOrder(data: object) {
    return await this.client.post('/v3/mcs/orders/cancel', data);
  }

  async getMcsOrderStatus(orderId: string) {
    if (!orderId) throw new Error('orderId is required');
    return await this.client.get(`/v3/mcs/orders/${encodeURIComponent(orderId)}`);
  }

  // ===== WFS Carrier =====

  async getCarrierRateQuotes(data: object) {
    return await this.client.post('/v3/wfs/carriers/quotes', data);
  }

  async bookCarrierShipment(data: object) {
    return await this.client.post('/v3/wfs/carriers/book', data);
  }

  async getCarrierLabel(shipmentId: string) {
    if (!shipmentId) throw new Error('shipmentId is required');
    return await this.client.get(`/v3/wfs/carriers/labels/${encodeURIComponent(shipmentId)}`);
  }

  async scheduleCarrierPickup(data: object) {
    return await this.client.post('/v3/wfs/carriers/pickup', data);
  }
}
