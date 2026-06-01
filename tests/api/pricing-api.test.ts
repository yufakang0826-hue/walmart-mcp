import { describe, it, expect, vi, beforeEach } from 'vitest';

function createMockClient() {
  return {
    get: vi.fn().mockResolvedValue({ data: 'ok' }),
    post: vi.fn().mockResolvedValue({ data: 'ok' }),
    put: vi.fn().mockResolvedValue({ data: 'ok' }),
    delete: vi.fn().mockResolvedValue({ data: 'ok' }),
  } as any;
}

describe('PricingApi', () => {
  let client: any;
  let api: any;

  beforeEach(async () => {
    client = createMockClient();
    const { PricingApi } = await import('../../src/api/pricing/pricing-api.js');
    api = new PricingApi(client);
  });

  it('updatePrice should build the Walmart /v3/price payload from semantic params', async () => {
    await api.updatePrice({ sku: 'SKU-1', amount: 19.99 });
    expect(client.put).toHaveBeenCalledWith('/v3/price', {
      sku: 'SKU-1',
      pricing: [
        { currentPriceType: 'BASE', currentPrice: { currency: 'USD', amount: 19.99 } },
      ],
    });
  });

  it('updatePrice should honor a custom currency', async () => {
    await api.updatePrice({ sku: 'SKU-2', amount: 5, currency: 'CAD' });
    expect(client.put).toHaveBeenCalledWith('/v3/price', {
      sku: 'SKU-2',
      pricing: [
        { currentPriceType: 'BASE', currentPrice: { currency: 'CAD', amount: 5 } },
      ],
    });
  });

  it('updatePrice should throw on missing sku', async () => {
    await expect(api.updatePrice({ sku: '', amount: 1 })).rejects.toThrow(/sku is required/i);
  });

  it('updatePrice should throw when amount is not a number', async () => {
    await expect(api.updatePrice({ sku: 'SKU-1' } as any)).rejects.toThrow(/amount/i);
  });

  it('submitPriceFeed should POST with feedType=price and JSON header', async () => {
    await api.submitPriceFeed({ items: [] });
    expect(client.post).toHaveBeenCalledWith(
      '/v3/feeds?feedType=price',
      { items: [] },
      expect.objectContaining({ headers: { 'Content-Type': 'application/json' } }),
    );
  });

  it('submitMpPriceFeed should POST with feedType=MP_ITEM_PRICE_UPDATE', async () => {
    await api.submitMpPriceFeed({ items: [] });
    expect(client.post).toHaveBeenCalledWith(
      '/v3/feeds?feedType=MP_ITEM_PRICE_UPDATE',
      { items: [] },
      expect.objectContaining({ headers: { 'Content-Type': 'application/json' } }),
    );
  });

  it('submitPromoPriceFeed should POST with feedType=PROMO_PRICE', async () => {
    await api.submitPromoPriceFeed({ items: [] });
    expect(client.post).toHaveBeenCalledWith(
      '/v3/feeds?feedType=PROMO_PRICE',
      { items: [] },
      expect.objectContaining({ headers: { 'Content-Type': 'application/json' } }),
    );
  });

  it('getRepricerStrategies should GET /v3/repricer/strategies', async () => {
    await api.getRepricerStrategies();
    expect(client.get).toHaveBeenCalledWith('/v3/repricer/strategies');
  });

  it('createRepricerStrategy should POST /v3/repricer/strategy', async () => {
    await api.createRepricerStrategy({ name: 'aggressive' });
    expect(client.post).toHaveBeenCalledWith('/v3/repricer/strategy', { name: 'aggressive' });
  });

  it('updateRepricerStrategy should PUT /v3/repricer/strategy', async () => {
    await api.updateRepricerStrategy({ strategyId: 'S1' });
    expect(client.put).toHaveBeenCalledWith('/v3/repricer/strategy', { strategyId: 'S1' });
  });

  it('deleteRepricerStrategy should DELETE with strategyId param', async () => {
    await api.deleteRepricerStrategy('S1');
    expect(client.delete).toHaveBeenCalledWith('/v3/repricer/strategy', { strategyId: 'S1' });
  });

  it('deleteRepricerStrategy should throw on empty id', async () => {
    await expect(api.deleteRepricerStrategy('')).rejects.toThrow(/strategyId is required/i);
  });

  it('assignItemsToStrategy should POST /v3/repricer/strategy/items', async () => {
    const data = { strategyId: 'S1', items: [{ sku: 'A' }] };
    await api.assignItemsToStrategy(data);
    expect(client.post).toHaveBeenCalledWith('/v3/repricer/strategy/items', data);
  });

  it('unassignItemsFromStrategy should DELETE /v3/repricer/strategy/items', async () => {
    const data = { strategyId: 'S1', skus: ['A', 'B'] };
    await api.unassignItemsFromStrategy(data);
    expect(client.delete).toHaveBeenCalledWith('/v3/repricer/strategy/items', data);
  });
});
