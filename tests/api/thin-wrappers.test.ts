import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Param-passthrough coverage for the thin API wrapper modules
 * (fulfillment / inventory / returns / notifications). Each method is a
 * 1-3 line delegation to the HTTP client — these tests pin the verb, the
 * path, and the payload wiring so endpoint regressions (like the
 * /v3/taxonomy and /v3/reports/reportRequests breakages) get caught by CI
 * instead of by production 404s.
 */
function createMockClient() {
  return {
    get: vi.fn().mockResolvedValue({ ok: true }),
    post: vi.fn().mockResolvedValue({ ok: true }),
    put: vi.fn().mockResolvedValue({ ok: true }),
    delete: vi.fn().mockResolvedValue({ ok: true }),
  } as any;
}

describe('FulfillmentApi', () => {
  let client: any;
  let api: any;

  beforeEach(async () => {
    client = createMockClient();
    const { FulfillmentApi } = await import('../../src/api/fulfillment/fulfillment-api.js');
    api = new FulfillmentApi(client);
  });

  it('createInboundOrder POSTs /v3/inbound-shipments', async () => {
    await api.createInboundOrder({ a: 1 });
    expect(client.post).toHaveBeenCalledWith('/v3/inbound-shipments', { a: 1 });
  });

  it('getInboundShipments GETs with params', async () => {
    await api.getInboundShipments({ limit: 5 });
    expect(client.get).toHaveBeenCalledWith('/v3/inbound-shipments', { limit: 5 });
  });

  it('getInboundErrors GETs /v3/inbound-shipment-errors', async () => {
    await api.getInboundErrors({ shipmentId: 'S1' });
    expect(client.get).toHaveBeenCalledWith('/v3/inbound-shipment-errors', { shipmentId: 'S1' });
  });

  it('getShipmentItems / getShipmentQuantities GET their endpoints', async () => {
    await api.getShipmentItems({ limit: 1 });
    await api.getShipmentQuantities({ limit: 2 });
    expect(client.get).toHaveBeenCalledWith('/v3/shipment-items', { limit: 1 });
    expect(client.get).toHaveBeenCalledWith('/v3/shipment-quantities', { limit: 2 });
  });

  it('getShipmentLabel URL-encodes the shipment id', async () => {
    await api.getShipmentLabel('SHIP/01');
    expect(client.get).toHaveBeenCalledWith('/v3/fulfillment/label/SHIP%2F01');
  });

  it('updateShipmentTracking POSTs tracking data', async () => {
    const body = { shipmentId: 'S1', carrier: 'USPS', trackingNumber: 'T1' };
    await api.updateShipmentTracking(body);
    expect(client.post).toHaveBeenCalledWith('/v3/shipment-tracking', body);
  });

  it('cancelInboundOrder DELETEs by id', async () => {
    await api.cancelInboundOrder('IB-1');
    expect(client.delete).toHaveBeenCalledWith('/v3/inbound-shipments/IB-1');
  });

  it('getShippingLabel GETs by purchase order id', async () => {
    await api.getShippingLabel('PO-9');
    expect(client.get).toHaveBeenCalledWith('/v3/shipping/labels/PO-9');
  });

  it('discardLabel POSTs to labels/discard', async () => {
    await api.discardLabel({ trackingNo: 'T' });
    expect(client.post).toHaveBeenCalledWith('/v3/shipping/labels/discard', { trackingNo: 'T' });
  });

  it('MCS order lifecycle hits /v3/mcs paths', async () => {
    await api.createMcsOrder({ o: 1 });
    await api.cancelMcsOrder({ c: 1 });
    await api.getMcsOrderStatus('M-1');
    expect(client.post).toHaveBeenCalledWith('/v3/mcs/orders', { o: 1 });
    expect(client.post).toHaveBeenCalledWith('/v3/mcs/orders/cancel', { c: 1 });
    expect(client.get).toHaveBeenCalledWith('/v3/mcs/orders/M-1');
  });

  it('WFS carrier flow hits /v3/wfs/carriers paths', async () => {
    await api.getCarrierRateQuotes({ q: 1 });
    await api.bookCarrierShipment({ b: 1 });
    await api.getCarrierLabel('C-1');
    await api.scheduleCarrierPickup({ p: 1 });
    expect(client.post).toHaveBeenCalledWith('/v3/wfs/carriers/quotes', { q: 1 });
    expect(client.post).toHaveBeenCalledWith('/v3/wfs/carriers/book', { b: 1 });
    expect(client.get).toHaveBeenCalledWith('/v3/wfs/carriers/labels/C-1');
    expect(client.post).toHaveBeenCalledWith('/v3/wfs/carriers/pickup', { p: 1 });
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

  it('getInventory GETs with sku param', async () => {
    await api.getInventory('SKU-1');
    expect(client.get).toHaveBeenCalledWith('/v3/inventory', { sku: 'SKU-1' });
  });

  it('updateInventory wraps quantity as { unit, amount } and repeats sku in query', async () => {
    await api.updateInventory({ sku: 'SKU-1', quantity: 5 });
    // Flat { quantity: 5 } bodies 400 — Walmart wants the object form.
    expect(client.put).toHaveBeenCalledWith('/v3/inventory?sku=SKU-1', {
      sku: 'SKU-1',
      quantity: { unit: 'EACH', amount: 5 },
    });
  });

  it('getInventoryAllNodes GETs /v3/inventories/{sku}', async () => {
    await api.getInventoryAllNodes('SKU-1');
    expect(client.get).toHaveBeenCalledWith('/v3/inventories/SKU-1');
  });

  it('getAllInventory GETs with paging params', async () => {
    await api.getAllInventory({ limit: 10 });
    expect(client.get).toHaveBeenCalledWith('/v3/inventories', { limit: 10 });
  });

  it('lag time read/write hit /v3/lagtime', async () => {
    await api.getLagTime('SKU-1');
    await api.updateLagTime({ sku: 'SKU-1', fulfillmentLagTime: 2 });
    expect(client.get).toHaveBeenCalledWith('/v3/lagtime', { sku: 'SKU-1' });
    expect(client.put).toHaveBeenCalledWith('/v3/lagtime', { sku: 'SKU-1', fulfillmentLagTime: 2 });
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

  it('getAllReturns GETs the base path with params', async () => {
    await api.getAllReturns({ limit: 20 });
    expect(client.get).toHaveBeenCalledWith('/v3/returns', { limit: 20 });
  });

  it('getReturn GETs by return order id', async () => {
    await api.getReturn('RO-1');
    expect(client.get).toHaveBeenCalledWith('/v3/returns/RO-1');
  });

  it('approve/reject POST their endpoints', async () => {
    await api.approveReturn({ a: 1 });
    await api.rejectReturn({ r: 1 });
    expect(client.post).toHaveBeenCalledWith('/v3/returns/approve', { a: 1 });
    expect(client.post).toHaveBeenCalledWith('/v3/returns/reject', { r: 1 });
  });

  it('getWfsReturns forces the isWFSEnabled flag', async () => {
    await api.getWfsReturns({ limit: 5 });
    expect(client.get).toHaveBeenCalledWith('/v3/returns', { limit: 5, isWFSEnabled: 'Y' });
  });

  it('getReturnCount GETs /v3/returns/count', async () => {
    await api.getReturnCount({ status: 'INITIATED' });
    expect(client.get).toHaveBeenCalledWith('/v3/returns/count', { status: 'INITIATED' });
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

  it('createSubscription POSTs the subscription body', async () => {
    await api.createSubscription({ eventType: 'PO_CREATED' });
    expect(client.post).toHaveBeenCalledWith('/v3/notifications/subscriptions', { eventType: 'PO_CREATED' });
  });

  it('getSubscriptions GETs with filters', async () => {
    await api.getSubscriptions({ eventType: 'PO_CREATED' });
    expect(client.get).toHaveBeenCalledWith('/v3/notifications/subscriptions', { eventType: 'PO_CREATED' });
  });

  it('get/update/delete address a subscription by id', async () => {
    await api.getSubscription('SUB-1');
    await api.updateSubscription('SUB-1', { isActive: false });
    await api.deleteSubscription('SUB-1');
    expect(client.get).toHaveBeenCalledWith('/v3/notifications/subscriptions/SUB-1');
    expect(client.put).toHaveBeenCalledWith('/v3/notifications/subscriptions/SUB-1', { isActive: false });
    expect(client.delete).toHaveBeenCalledWith('/v3/notifications/subscriptions/SUB-1');
  });
});
