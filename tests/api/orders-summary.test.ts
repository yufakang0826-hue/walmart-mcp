import { describe, it, expect, vi } from 'vitest';
import { OrdersApi } from '../../src/api/orders/orders-api.js';
import type { WalmartApiClient } from '../../src/api/client.js';

const RAW_ORDERS = {
  list: {
    meta: { totalCount: 1, limit: 5, nextCursor: 'cursor-1' },
    elements: {
      order: [
        {
          purchaseOrderId: 'PO-1',
          customerOrderId: 'CO-1',
          customerEmailId: 'buyer@example.com',
          orderDate: 1782825987674,
          shippingInfo: {
            phone: '5551234567',
            estimatedShipDate: 1782918000000,
            methodCode: 'Standard',
            postalAddress: {
              name: 'JANE DOE',
              address1: '1 Main St',
              city: 'Columbus',
              state: 'IN',
              postalCode: '47201',
              country: 'USA',
            },
          },
          orderLines: {
            orderLine: [
              {
                lineNumber: '1',
                item: {
                  productName:
                    'An Extremely Long Product Name That Definitely Exceeds Eighty Characters For Truncation Testing Purposes',
                  sku: 'SKU-1',
                },
                charges: {
                  charge: [
                    {
                      chargeType: 'PRODUCT',
                      chargeName: 'ItemPrice',
                      chargeAmount: { currency: 'USD', amount: 33.79 },
                    },
                  ],
                },
                orderLineQuantity: { unitOfMeasurement: 'EACH', amount: '1' },
                orderLineStatuses: {
                  orderLineStatus: [
                    {
                      status: 'Shipped',
                      trackingInfo: {
                        trackingNumber: 'TRACK123',
                        carrierName: { carrier: 'USPS' },
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    },
  },
};

function makeApi(raw: unknown = RAW_ORDERS) {
  const client = { get: vi.fn().mockResolvedValue(raw) } as unknown as WalmartApiClient;
  return { api: new OrdersApi(client), client };
}

describe('OrdersApi.getAllOrders summary projection', () => {
  it('returns the compact projection by default', async () => {
    const { api } = makeApi();
    const result = (await api.getAllOrders({ limit: 5 })) as {
      summary: boolean;
      meta: { totalCount: number };
      orders: Array<Record<string, unknown>>;
    };

    expect(result.summary).toBe(true);
    expect(result.meta.totalCount).toBe(1);
    expect(result.orders).toHaveLength(1);

    const order = result.orders[0] as {
      purchaseOrderId: string;
      shipTo: string;
      lines: Array<Record<string, unknown>>;
    };
    expect(order.purchaseOrderId).toBe('PO-1');
    expect(order.shipTo).toBe('JANE DOE, Columbus, IN');
    expect(order.lines[0]).toMatchObject({
      sku: 'SKU-1',
      qty: '1',
      itemPrice: 33.79,
      status: 'Shipped',
      trackingNumber: 'TRACK123',
      carrier: 'USPS',
    });
    // long product names are truncated to 80 chars
    expect((order.lines[0].productName as string).length).toBeLessThanOrEqual(80);
    expect(order.lines[0].productName as string).toMatch(/\.\.\.$/);
    // heavy fields are gone
    expect(JSON.stringify(result)).not.toContain('buyer@example.com');
    expect(JSON.stringify(result)).not.toContain('postalCode');
  });

  it('does not strip the summary flag from the Walmart query', async () => {
    const { api, client } = makeApi();
    await api.getAllOrders({ limit: 5, status: 'Shipped' });
    // `summary` must NOT leak into the Walmart query params
    expect(vi.mocked(client.get).mock.calls[0]?.[1]).toEqual({ limit: 5, status: 'Shipped' });
  });

  it('returns raw payload when summary: false', async () => {
    const { api } = makeApi();
    const result = await api.getAllOrders({ summary: false });
    expect(result).toBe(RAW_ORDERS);
  });

  it('passes unexpected shapes through untouched', async () => {
    const weird = { order: [] };
    const { api } = makeApi(weird);
    expect(await api.getAllOrders()).toBe(weird);
  });
});
