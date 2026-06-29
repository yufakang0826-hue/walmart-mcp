/**
 * Tests for the zod re-parse layer in src/index.ts. We can't easily boot the
 * full McpServer in a unit test, so we test the parse behavior directly: take
 * a tool's inputSchema, build a z.object from it, and verify both successful
 * defaulting and ZodError rejection paths.
 */
import { describe, it, expect } from 'vitest';
import { z, ZodError } from 'zod';
import { pricingTools } from '../../src/tools/definitions/pricing.ts';
import { inventoryTools } from '../../src/tools/definitions/inventory.ts';
import { notificationTools } from '../../src/tools/definitions/notifications.ts';

function schemaFor(tools: ReadonlyArray<{ name: string; inputSchema: Record<string, z.ZodTypeAny> }>, name: string) {
  const t = tools.find((tool) => tool.name === name);
  if (!t) throw new Error(`Tool ${name} not found`);
  return z.object(t.inputSchema);
}

describe('dispatcher zod re-parse', () => {
  it('fills in defaults for promo feed entries', () => {
    const schema = schemaFor(pricingTools, 'walmart_submit_promo_price_feed');
    const parsed = schema.parse({
      feedData: {
        PriceHeader: {},
        Price: [
          {
            sku: 'ABC',
            pricing: [
              {
                currentPrice: { currency: 'USD', amount: 9 },
                currentPriceType: 'REDUCED',
                comparisonPrice: { currency: 'USD', amount: 12 },
                comparisonPriceType: 'BASE',
                effectiveDate: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
                expirationDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
                processMode: 'UPSERT',
              },
            ],
          },
        ],
      },
    }) as {
      feedData: {
        PriceHeader: { version: string };
        Price: Array<{
          pricing: Array<{ priceDisplayCodes: string }>;
        }>;
      };
    };
    // Default version "1.5.1" and priceDisplayCodes "CART" should be filled in.
    expect(parsed.feedData.PriceHeader.version).toBe('1.5.1');
    expect(parsed.feedData.Price[0]!.pricing[0]!.priceDisplayCodes).toBe('CART');
  });

  it('throws ZodError when an inventory amount is fractional', () => {
    const schema = schemaFor(inventoryTools, 'walmart_submit_inventory_feed');
    expect(() =>
      schema.parse({
        feedData: {
          InventoryHeader: {},
          Inventory: [{ sku: 'ABC', quantity: { amount: 1.5 } }],
        },
      }),
    ).toThrow(ZodError);
  });

  it('rejects HTTP destination on subscription with structured ZodError', () => {
    const schema = schemaFor(notificationTools, 'walmart_create_subscription');
    try {
      schema.parse({
        subscriptionData: {
          eventType: 'PO_CREATED',
          destinationUrl: 'http://insecure.example.com',
        },
      });
      throw new Error('expected ZodError');
    } catch (err) {
      expect(err).toBeInstanceOf(ZodError);
      const zerr = err as ZodError;
      const messages = zerr.issues.map((i) => i.message).join('; ');
      expect(messages).toMatch(/HTTPS/);
    }
  });

  it('preserves the issues[] array with path information', () => {
    const schema = schemaFor(pricingTools, 'walmart_submit_promo_price_feed');
    try {
      schema.parse({
        feedData: {
          PriceHeader: {},
          Price: [
            {
              sku: 'ABC',
              pricing: [
                {
                  // promo amount > base amount — should fail the refine
                  currentPrice: { currency: 'USD', amount: 20 },
                  currentPriceType: 'REDUCED',
                  comparisonPrice: { currency: 'USD', amount: 10 },
                  comparisonPriceType: 'BASE',
                  effectiveDate: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
                  expirationDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
                  processMode: 'UPSERT',
                },
              ],
            },
          ],
        },
      });
      throw new Error('expected ZodError');
    } catch (err) {
      expect(err).toBeInstanceOf(ZodError);
      const zerr = err as ZodError;
      // The issue path should include 'feedData', 'Price', 0, 'pricing', 0, 'currentPrice', 'amount'
      const hasPath = zerr.issues.some(
        (iss) => iss.path.includes('currentPrice') && iss.path.includes('amount'),
      );
      expect(hasPath).toBe(true);
    }
  });
});
