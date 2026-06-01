import { WalmartApiClient } from '../client.js';

export class PricingApi {
  private basePath = '/v3';

  constructor(private client: WalmartApiClient) {}

  /**
   * Update the regular (BASE) price for a single SKU. Accepts semantic params
   * and builds the Walmart `/v3/price` payload, so callers don't have to
   * hand-assemble Walmart's nested pricing structure. For promotional or
   * strikethrough pricing, use the promo price feed.
   */
  async updatePrice(data: { sku: string; amount: number; currency?: string }) {
    if (!data.sku) throw new Error('SKU is required');
    if (typeof data.amount !== 'number' || Number.isNaN(data.amount)) {
      throw new Error('amount (a number, e.g. 16.99) is required');
    }
    const currency = data.currency || 'USD';
    const payload = {
      sku: data.sku,
      pricing: [
        {
          currentPriceType: 'BASE',
          currentPrice: { currency, amount: data.amount },
        },
      ],
    };
    return await this.client.put(`${this.basePath}/price`, payload);
  }

  async submitPriceFeed(data: object) {
    return await this.client.post(
      `${this.basePath}/feeds?feedType=price`,
      data,
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  async submitMpPriceFeed(data: object) {
    return await this.client.post(
      `${this.basePath}/feeds?feedType=MP_ITEM_PRICE_UPDATE`,
      data,
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  async submitPromoPriceFeed(data: object) {
    return await this.client.post(
      `${this.basePath}/feeds?feedType=PROMO_PRICE`,
      data,
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  async getRepricerStrategies() {
    return await this.client.get(`${this.basePath}/repricer/strategies`);
  }

  async createRepricerStrategy(data: object) {
    return await this.client.post(`${this.basePath}/repricer/strategy`, data);
  }

  async updateRepricerStrategy(data: object) {
    return await this.client.put(`${this.basePath}/repricer/strategy`, data);
  }

  async deleteRepricerStrategy(strategyId: string) {
    if (!strategyId) throw new Error('strategyId is required');
    return await this.client.delete(`${this.basePath}/repricer/strategy`, { strategyId });
  }

  async assignItemsToStrategy(data: { strategyId: string; items: object[] }) {
    return await this.client.post(`${this.basePath}/repricer/strategy/items`, data);
  }

  async unassignItemsFromStrategy(data: { strategyId: string; skus: string[] }) {
    return await this.client.delete(`${this.basePath}/repricer/strategy/items`, data);
  }
}
