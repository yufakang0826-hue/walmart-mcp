import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the WalmartApiClient
function createMockClient() {
  return {
    get: vi.fn().mockResolvedValue({ data: 'ok' }),
    post: vi.fn().mockResolvedValue({ data: 'ok' }),
    put: vi.fn().mockResolvedValue({ data: 'ok' }),
    delete: vi.fn().mockResolvedValue({ data: 'ok' }),
  } as any;
}

describe('API Modules', () => {
  describe('ItemsApi', () => {
    let client: any;
    let api: any;

    beforeEach(async () => {
      client = createMockClient();
      const { ItemsApi } = await import('../../src/api/items/items-api.js');
      api = new ItemsApi(client);
    });

    it('getAllItems should GET /v3/items with params', async () => {
      await api.getAllItems({ limit: 10, offset: '0' });
      expect(client.get).toHaveBeenCalledWith('/v3/items', { limit: 10, offset: '0' });
    });

    it('getItem should GET /v3/items/{sku}', async () => {
      await api.getItem('SKU-123');
      expect(client.get).toHaveBeenCalledWith('/v3/items/SKU-123');
    });

    it('getItem should throw on empty sku', async () => {
      await expect(api.getItem('')).rejects.toThrow(/sku is required/i);
    });

    it('retireItem should DELETE /v3/items/{sku}', async () => {
      await api.retireItem('SKU-123');
      expect(client.delete).toHaveBeenCalledWith('/v3/items/SKU-123');
    });

    it('getTaxonomy should GET /v3/taxonomy', async () => {
      await api.getTaxonomy();
      expect(client.get).toHaveBeenCalledWith('/v3/taxonomy');
    });

    it('submitItemFeed should POST with feedType header', async () => {
      await api.submitItemFeed({ items: [] });
      expect(client.post).toHaveBeenCalledWith(
        '/v3/feeds?feedType=item',
        { items: [] },
        expect.objectContaining({ headers: { 'Content-Type': 'application/json' } }),
      );
    });
  });

  describe('InventoryApi', () => {
    let client: any;
    let api: any;

    beforeEach(async () => {
      client = createMockClient();
      const { InventoryApi } = await import('../../src/api/inventory/inventory-api.js');
      api = new InventoryApi(client);
    });

    it('getInventory should GET with sku param', async () => {
      await api.getInventory('SKU-1');
      expect(client.get).toHaveBeenCalledWith('/v3/inventory', { sku: 'SKU-1' });
    });

    it('updateInventory should PUT with correct body', async () => {
      await api.updateInventory({ sku: 'SKU-1', quantity: 50 });
      expect(client.put).toHaveBeenCalled();
      const body = client.put.mock.calls[0][1];
      expect(body.sku).toBe('SKU-1');
    });

    it('getInventory should throw on empty sku', async () => {
      await expect(api.getInventory('')).rejects.toThrow(/sku is required/i);
    });
  });

  describe('OrdersApi', () => {
    let client: any;
    let api: any;

    beforeEach(async () => {
      client = createMockClient();
      const { OrdersApi } = await import('../../src/api/orders/orders-api.js');
      api = new OrdersApi(client);
    });

    it('getAllOrders should GET /v3/orders', async () => {
      await api.getAllOrders({ status: 'Shipped', limit: 50 });
      expect(client.get).toHaveBeenCalledWith('/v3/orders', { status: 'Shipped', limit: 50 });
    });

    it('acknowledgeOrder should POST to acknowledge endpoint', async () => {
      await api.acknowledgeOrder('PO-123');
      expect(client.post).toHaveBeenCalledWith('/v3/orders/PO-123/acknowledge');
    });

    it('shipOrder should POST shipping data', async () => {
      const data = { orderLines: [{ lineNumber: '1' }] };
      await api.shipOrder('PO-123', data);
      expect(client.post).toHaveBeenCalledWith('/v3/orders/PO-123/shipping', data);
    });

    it('getOrder should throw on empty purchaseOrderId', async () => {
      await expect(api.getOrder('')).rejects.toThrow('purchaseOrderId is required');
    });
  });

  describe('ReturnsApi', () => {
    let client: any;
    let api: any;

    beforeEach(async () => {
      client = createMockClient();
      const { ReturnsApi } = await import('../../src/api/returns/returns-api.js');
      api = new ReturnsApi(client);
    });

    it('getWfsReturns should add isWFSEnabled param', async () => {
      await api.getWfsReturns({ limit: 10 });
      expect(client.get).toHaveBeenCalledWith('/v3/returns', {
        limit: 10,
        isWFSEnabled: 'Y',
      });
    });

    it('issueReturnRefund should POST to correct nested path', async () => {
      await api.issueReturnRefund('R1', 'I1', { amount: -5 });
      expect(client.post).toHaveBeenCalledWith(
        '/v3/returns/R1/items/I1/refund',
        { amount: -5 },
      );
    });
  });

  describe('FulfillmentApi', () => {
    let client: any;
    let api: any;

    beforeEach(async () => {
      client = createMockClient();
      const { FulfillmentApi } = await import('../../src/api/fulfillment/fulfillment-api.js');
      api = new FulfillmentApi(client);
    });

    it('createInboundOrder should POST to /v3/inbound-shipments', async () => {
      await api.createInboundOrder({ items: [] });
      expect(client.post).toHaveBeenCalledWith('/v3/inbound-shipments', { items: [] });
    });

    it('cancelInboundOrder should DELETE by ID', async () => {
      await api.cancelInboundOrder('IN-1');
      expect(client.delete).toHaveBeenCalledWith('/v3/inbound-shipments/IN-1');
    });

    it('getLabelByTracking should build correct URL', async () => {
      await api.getLabelByTracking('USPS', 'TRACK-123');
      expect(client.get).toHaveBeenCalledWith(
        '/v3/shipping/labels/carriers/USPS/trackings/TRACK-123',
      );
    });
  });

  describe('NotificationsApi', () => {
    let client: any;
    let api: any;

    beforeEach(async () => {
      client = createMockClient();
      const { NotificationsApi } = await import('../../src/api/notifications/notifications-api.js');
      api = new NotificationsApi(client);
    });

    it('testSubscription should POST to test endpoint', async () => {
      await api.testSubscription('SUB-1');
      expect(client.post).toHaveBeenCalledWith(
        '/v3/notifications/subscriptions/SUB-1/test',
      );
    });

    it('deleteSubscription should throw on empty id', async () => {
      await expect(api.deleteSubscription('')).rejects.toThrow('subscriptionId is required');
    });
  });

  describe('SettingsApi', () => {
    let client: any;
    let api: any;

    beforeEach(async () => {
      client = createMockClient();
      const { SettingsApi } = await import('../../src/api/settings/settings-api.js');
      api = new SettingsApi(client);
    });

    it('getPartnerInfo should GET /v3/settings/partner', async () => {
      await api.getPartnerInfo();
      expect(client.get).toHaveBeenCalledWith('/v3/settings/partner');
    });

    it('getFulfillmentCenters should GET /v3/settings/shippingprofile', async () => {
      await api.getFulfillmentCenters();
      expect(client.get).toHaveBeenCalledWith('/v3/settings/shippingprofile');
    });
  });
});
