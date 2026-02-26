import { WalmartApiClient } from '../client.js';

export class InventoryApi {
  private basePath = '/v3';

  constructor(private client: WalmartApiClient) {}

  async getInventory(sku: string) {
    if (!sku) throw new Error('SKU is required');
    return await this.client.get(`${this.basePath}/inventory`, { sku });
  }

  async updateInventory(data: { sku: string; quantity: number; shipNode?: string }) {
    if (!data.sku) throw new Error('SKU is required');
    return await this.client.put(`${this.basePath}/inventory`, data);
  }

  async getInventoryAllNodes(sku: string) {
    if (!sku) throw new Error('SKU is required');
    return await this.client.get(`${this.basePath}/inventories/${encodeURIComponent(sku)}`);
  }

  async updateInventoryMultiNode(sku: string, data: object) {
    if (!sku) throw new Error('SKU is required');
    return await this.client.put(
      `${this.basePath}/inventories/${encodeURIComponent(sku)}`,
      data,
    );
  }

  async getAllInventory(params?: { limit?: number; offset?: string; shipNode?: string }) {
    return await this.client.get(`${this.basePath}/inventories`, params);
  }

  async submitInventoryFeed(data: object) {
    return await this.client.post(
      `${this.basePath}/feeds?feedType=inventory`,
      data,
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  async submitMultiNodeInventoryFeed(data: object) {
    return await this.client.post(
      `${this.basePath}/feeds?feedType=MP_INVENTORY`,
      data,
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  async getLagTime(sku: string) {
    if (!sku) throw new Error('SKU is required');
    return await this.client.get(`${this.basePath}/lagtime`, { sku });
  }

  async updateLagTime(data: { sku: string; fulfillmentLagTime: number }) {
    if (!data.sku) throw new Error('SKU is required');
    return await this.client.put(`${this.basePath}/lagtime`, data);
  }

  async submitLagTimeFeed(data: object) {
    return await this.client.post(
      `${this.basePath}/feeds?feedType=LAGTIME`,
      data,
      { headers: { 'Content-Type': 'application/json' } },
    );
  }
}
