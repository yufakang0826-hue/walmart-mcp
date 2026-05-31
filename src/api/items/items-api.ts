import { WalmartApiClient } from '../client.js';

export class ItemsApi {
  private basePath = '/v3';

  constructor(private client: WalmartApiClient) {}

  async getAllItems(params?: {
    limit?: number;
    offset?: string;
    lifecycleStatus?: string;
    publishedStatus?: string;
    sku?: string;
  }) {
    const query: Record<string, unknown> = {};
    if (params?.limit) query.limit = params.limit;
    if (params?.offset) query.offset = params.offset;
    if (params?.lifecycleStatus) query.lifecycleStatus = params.lifecycleStatus;
    if (params?.publishedStatus) query.publishedStatus = params.publishedStatus;
    if (params?.sku) query.sku = params.sku;
    return await this.client.get(`${this.basePath}/items`, query);
  }

  async getItem(sku: string) {
    if (!sku) throw new Error('SKU is required');
    return await this.client.get(`${this.basePath}/items/${encodeURIComponent(sku)}`);
  }

  async retireItem(sku: string) {
    if (!sku) throw new Error('SKU is required');
    return await this.client.delete(`${this.basePath}/items/${encodeURIComponent(sku)}`);
  }

  async bulkRetireItems(data: { sku: string }[]) {
    if (!data?.length) throw new Error('At least one SKU is required');
    return await this.client.post(`${this.basePath}/items/retire`, { skus: data });
  }

  async getItemCount(params?: {
    status?: string;
    lifecycleStatus?: string;
    publishedStatus?: string;
  }) {
    // `status` is mandatory on /v3/items/count (item statuses in CSV, e.g.
    // PUBLISHED, UNPUBLISHED). Default to PUBLISHED when not supplied.
    const query = { status: 'PUBLISHED', ...params };
    return await this.client.get(`${this.basePath}/items/count`, query);
  }

  async getTaxonomy() {
    return await this.client.get(`${this.basePath}/taxonomy`);
  }

  async getItemSpec(params: { productType: string; version?: string }) {
    if (!params.productType) throw new Error('productType is required');
    return await this.client.get(`${this.basePath}/items/spec`, params);
  }

  async submitItemFeed(data: object) {
    return await this.client.post(
      `${this.basePath}/feeds?feedType=item`,
      data,
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  async submitItemUpdateFeed(data: object) {
    return await this.client.post(
      `${this.basePath}/feeds?feedType=MP_MAINTENANCE`,
      data,
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  async submitWfsItemFeed(data: object) {
    return await this.client.post(
      `${this.basePath}/feeds?feedType=MP_WFS_ITEM`,
      data,
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  async convertToWfs(data: object) {
    return await this.client.post(
      `${this.basePath}/feeds?feedType=OMNI_WFS`,
      data,
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  async getHazmatItems(data: object) {
    return await this.client.post(`${this.basePath}/items/hazmat`, data);
  }
}
