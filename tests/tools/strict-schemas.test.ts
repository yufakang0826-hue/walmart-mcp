import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { pricingTools } from '../../src/tools/definitions/pricing.ts';
import { inventoryTools } from '../../src/tools/definitions/inventory.ts';
import { itemTools } from '../../src/tools/definitions/items.ts';
import { returnTools } from '../../src/tools/definitions/returns.ts';
import { notificationTools } from '../../src/tools/definitions/notifications.ts';
import { orderTools } from '../../src/tools/definitions/orders.ts';

/**
 * Helper: build a runnable z.object from a tool's inputSchema map.
 * Tool definitions use `inputSchema: { fieldA: zodA, fieldB: zodB }` rather
 * than a top-level z.object, mirroring how the MCP SDK consumes them.
 */
function compose(tool: { inputSchema: Record<string, z.ZodTypeAny> }) {
  return z.object(tool.inputSchema);
}

function find<T extends { name: string }>(tools: ReadonlyArray<T>, name: string): T {
  const t = tools.find((tool) => tool.name === name);
  if (!t) throw new Error(`Tool ${name} not found`);
  return t;
}

// =====================================================================
// PROMO_PRICE feed — 5 business-rule refinements
// =====================================================================
describe('walmart_submit_promo_price_feed', () => {
  const tool = find(pricingTools, 'walmart_submit_promo_price_feed');
  const schema = compose(tool as { inputSchema: Record<string, z.ZodTypeAny> });

  // Helper to build a baseline-valid feed body.
  const baseline = () => ({
    feedData: {
      PriceHeader: { version: '1.5.1' },
      Price: [
        {
          sku: 'ZTGY-058',
          pricing: [
            {
              currentPrice: { currency: 'USD' as const, amount: 16.99 },
              currentPriceType: 'REDUCED' as const,
              comparisonPrice: { currency: 'USD' as const, amount: 19.99 },
              comparisonPriceType: 'BASE' as const,
              priceDisplayCodes: 'CART' as const,
              effectiveDate: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
              expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              processMode: 'UPSERT' as const,
            },
          ],
        },
      ],
    },
  });

  it('accepts a fully-valid promo entry', () => {
    expect(() => schema.parse(baseline())).not.toThrow();
  });

  it('rejects when promo amount >= base amount', () => {
    const v = baseline();
    v.feedData.Price[0]!.pricing[0]!.currentPrice.amount = 25.0;
    expect(() => schema.parse(v)).toThrow(/must be < comparisonPrice/);
  });

  it('rejects when effectiveDate is < 4 hours from now', () => {
    const v = baseline();
    v.feedData.Price[0]!.pricing[0]!.effectiveDate = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    expect(() => schema.parse(v)).toThrow(/at least 4 hours/);
  });

  it('rejects when expirationDate is before effectiveDate', () => {
    const v = baseline();
    const eff = new Date(Date.now() + 10 * 60 * 60 * 1000);
    const exp = new Date(Date.now() + 5 * 60 * 60 * 1000);
    v.feedData.Price[0]!.pricing[0]!.effectiveDate = eff.toISOString();
    v.feedData.Price[0]!.pricing[0]!.expirationDate = exp.toISOString();
    expect(() => schema.parse(v)).toThrow(/expirationDate must be after effectiveDate/);
  });

  it('rejects when duration exceeds 180 days', () => {
    const v = baseline();
    v.feedData.Price[0]!.pricing[0]!.expirationDate = new Date(Date.now() + 200 * 24 * 60 * 60 * 1000).toISOString();
    expect(() => schema.parse(v)).toThrow(/180 days/);
  });

  it('rejects mismatched currency between currentPrice and comparisonPrice', () => {
    const v = baseline();
    // @ts-expect-error: test the cross-field rule
    v.feedData.Price[0]!.pricing[0]!.comparisonPrice.currency = 'MXN';
    expect(() => schema.parse(v)).toThrow(/same currency/);
  });

  it('rejects more than 10 pricing entries per SKU', () => {
    const v = baseline();
    const entry = v.feedData.Price[0]!.pricing[0]!;
    v.feedData.Price[0]!.pricing = Array.from({ length: 11 }, () => structuredClone(entry));
    expect(() => schema.parse(v)).toThrow(/Max 10/);
  });
});

// =====================================================================
// INVENTORY feed envelope
// =====================================================================
describe('walmart_submit_inventory_feed', () => {
  const tool = find(inventoryTools, 'walmart_submit_inventory_feed');
  const schema = compose(tool as { inputSchema: Record<string, z.ZodTypeAny> });

  it('accepts a minimal one-SKU entry', () => {
    expect(() =>
      schema.parse({
        feedData: {
          InventoryHeader: { version: '1.4' },
          Inventory: [{ sku: 'ABC', quantity: { unit: 'EACH', amount: 5 } }],
        },
      }),
    ).not.toThrow();
  });

  it('rejects empty Inventory array', () => {
    expect(() =>
      schema.parse({
        feedData: { InventoryHeader: {}, Inventory: [] },
      }),
    ).toThrow(/at least 1 inventory entry/);
  });

  it('rejects fractional quantity', () => {
    expect(() =>
      schema.parse({
        feedData: {
          InventoryHeader: {},
          Inventory: [{ sku: 'ABC', quantity: { amount: 1.5 } }],
        },
      }),
    ).toThrow();
  });

  it('rejects lag time over 28 days', () => {
    expect(() =>
      schema.parse({
        feedData: {
          InventoryHeader: {},
          Inventory: [{ sku: 'ABC', quantity: { amount: 5 }, fulfillmentLagTime: 30 }],
        },
      }),
    ).toThrow(/28/);
  });
});

// =====================================================================
// MP_ITEM feed envelope
// =====================================================================
describe('walmart_submit_item_feed envelope', () => {
  const tool = find(itemTools, 'walmart_submit_item_feed');
  const schema = compose(tool as { inputSchema: Record<string, z.ZodTypeAny> });

  it('accepts minimal item with sku only (passthrough allows extra attrs)', () => {
    const result = schema.parse({
      feedData: {
        MPItemFeedHeader: { version: '5.0', sellingChannel: 'marketplace', locale: 'en' },
        MPItem: [{ Item: { sku: 'ABC', productName: 'X', shortDescription: 'Y' } }],
      },
    });
    expect(result.feedData.MPItem).toHaveLength(1);
  });

  it('rejects MP_ITEM feed with no items', () => {
    expect(() =>
      schema.parse({
        feedData: {
          MPItemFeedHeader: {},
          MPItem: [],
        },
      }),
    ).toThrow(/at least 1 item/);
  });

  it('rejects MP_ITEM feed where an entry has no Item.sku', () => {
    expect(() =>
      schema.parse({
        feedData: {
          MPItemFeedHeader: {},
          MPItem: [{ Item: { productName: 'X' } }],
        },
      }),
    ).toThrow();
  });
});

// =====================================================================
// Returns: approve / refund body
// =====================================================================
describe('walmart_approve_return', () => {
  const tool = find(returnTools, 'walmart_approve_return');
  const schema = compose(tool as { inputSchema: Record<string, z.ZodTypeAny> });

  it('accepts a body with returnOrderId and one returnOrderLine', () => {
    expect(() =>
      schema.parse({
        approvalData: {
          returnOrderId: '179958230654176707',
          returnOrderLines: [{ returnOrderLineNumber: 1 }],
        },
      }),
    ).not.toThrow();
  });

  it('rejects missing returnOrderId', () => {
    expect(() =>
      schema.parse({
        approvalData: { returnOrderLines: [{ returnOrderLineNumber: 1 }] },
      }),
    ).toThrow();
  });

  it('rejects empty returnOrderLines', () => {
    expect(() =>
      schema.parse({
        approvalData: { returnOrderId: 'X', returnOrderLines: [] },
      }),
    ).toThrow(/at least 1/);
  });
});

describe('walmart_issue_return_refund', () => {
  const tool = find(returnTools, 'walmart_issue_return_refund');
  const schema = compose(tool as { inputSchema: Record<string, z.ZodTypeAny> });

  it('accepts a minimal refund', () => {
    expect(() =>
      schema.parse({
        returnOrderId: 'X',
        itemId: 'Y',
        refundData: {
          refundReason: 'Customer satisfaction',
          chargeRefunds: [
            {
              chargeType: 'PRODUCT',
              chargeName: 'ItemPrice',
              chargeAmount: { currency: 'USD', amount: 9.99 },
            },
          ],
        },
      }),
    ).not.toThrow();
  });

  it('rejects refund with empty refundReason', () => {
    expect(() =>
      schema.parse({
        returnOrderId: 'X',
        itemId: 'Y',
        refundData: {
          refundReason: '',
          chargeRefunds: [
            {
              chargeType: 'PRODUCT',
              chargeName: 'ItemPrice',
              chargeAmount: { currency: 'USD', amount: 9.99 },
            },
          ],
        },
      }),
    ).toThrow();
  });
});

// =====================================================================
// Notifications: HTTPS-only enforcement
// =====================================================================
describe('walmart_create_subscription', () => {
  const tool = find(notificationTools, 'walmart_create_subscription');
  const schema = compose(tool as { inputSchema: Record<string, z.ZodTypeAny> });

  it('accepts an HTTPS destination', () => {
    expect(() =>
      schema.parse({
        subscriptionData: {
          eventType: 'PO_CREATED',
          destinationUrl: 'https://example.com/walmart-hook',
        },
      }),
    ).not.toThrow();
  });

  it('rejects an HTTP destination', () => {
    expect(() =>
      schema.parse({
        subscriptionData: {
          eventType: 'PO_CREATED',
          destinationUrl: 'http://example.com/walmart-hook',
        },
      }),
    ).toThrow(/HTTPS/);
  });

  it('rejects an unknown eventType', () => {
    expect(() =>
      schema.parse({
        subscriptionData: {
          eventType: 'TOTALLY_FAKE',
          destinationUrl: 'https://example.com',
        },
      }),
    ).toThrow();
  });
});

// =====================================================================
// Orders: refund must be negative
// =====================================================================
describe('walmart_refund_order requires negative amount', () => {
  const tool = find(orderTools, 'walmart_refund_order');
  const schema = compose(tool as { inputSchema: Record<string, z.ZodTypeAny> });

  const baselineRefund = (amount: number) => ({
    purchaseOrderId: 'X',
    refundData: {
      orderLines: {
        orderLine: [
          {
            lineNumber: '1',
            refunds: {
              refund: [
                {
                  refundComments: 'damaged in shipping',
                  refundCharges: {
                    refundCharge: [
                      {
                        refundReason: 'DamagedItem',
                        charge: {
                          chargeType: 'PRODUCT' as const,
                          chargeName: 'ItemPrice',
                          chargeAmount: { currency: 'USD' as const, amount },
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
  });

  it('accepts a negative refund amount', () => {
    expect(() => schema.parse(baselineRefund(-10.5))).not.toThrow();
  });

  it('rejects a positive refund amount', () => {
    expect(() => schema.parse(baselineRefund(10.5))).toThrow(/negative/);
  });
});
