import { WalmartApiClient } from '../client.js';
import { getBusinessUnit, getItemSpecVersion } from '../../config/environment.js';
import type { WalmartMarket } from '../../config/environment.js';

/**
 * Header fields that must NEVER reach a spec-5.0 MP_MAINTENANCE feed.
 * `subset`/`requestId`/`mart`/`feedDate` fail per-item validation ("not a
 * valid field"); `sellingChannel`/`processMode` flip Walmart's parser into a
 * legacy path that NPEs (ERR_INT_DATA_01010092 / PGW) when `subset` is
 * missing. Verified against production 2026-07-02.
 */
const FORBIDDEN_MAINTENANCE_HEADER_FIELDS = [
  'sellingChannel',
  'processMode',
  'subset',
  'requestId',
  'mart',
  'feedDate',
] as const;

export class ItemsApi {
  private basePath = '/v3';

  constructor(
    private client: WalmartApiClient,
    private market: WalmartMarket = 'us',
  ) {}

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

  async getItemSpec(params: { productType: string; feedType?: string; version?: string }) {
    if (!params.productType) throw new Error('productType is required');
    // Walmart's Get Spec endpoint expects `productTypes` (plural, up to 20 CSV),
    // `feedType`, and the FULL dated `version` — a bare "5.0" returns 404.
    return await this.client.get(`${this.basePath}/items/spec`, {
      feedType: params.feedType ?? 'MP_ITEM',
      version: params.version ?? getItemSpecVersion(),
      productTypes: params.productType,
    });
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
      this.normalizeMaintenanceFeed(data),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }

  /**
   * Enforce the spec-5.0 MP_MAINTENANCE envelope contract regardless of what
   * the caller supplied: header reduced to { businessUnit, locale, version }
   * with defaults filled in, forbidden fields dropped, and legacy
   * `MPItem[].Item` wrappers rejected with an actionable error.
   */
  private normalizeMaintenanceFeed(data: object): object {
    const feed = { ...(data as Record<string, unknown>) };
    const rawHeader = { ...((feed.MPItemFeedHeader as Record<string, unknown>) ?? {}) };

    for (const field of FORBIDDEN_MAINTENANCE_HEADER_FIELDS) delete rawHeader[field];

    feed.MPItemFeedHeader = {
      businessUnit: rawHeader.businessUnit ?? getBusinessUnit(this.market),
      locale: rawHeader.locale ?? 'en',
      version:
        typeof rawHeader.version === 'string' && rawHeader.version.length > 3
          ? rawHeader.version
          : getItemSpecVersion(),
    };

    const items = feed.MPItem;
    if (Array.isArray(items)) {
      for (const item of items) {
        if (item && typeof item === 'object' && 'Item' in (item as Record<string, unknown>)) {
          throw new Error(
            'MP_MAINTENANCE spec 5.0 rejects the legacy `Item` wrapper. Use ' +
              '{ Orderable: { sku, productIdentifiers }, Visible: { "<Product Type>": ' +
              '{ productName, shortDescription, keyFeatures, ... } } } per item.',
          );
        }
      }
    }

    return feed;
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

  async getHazmatItems(data?: object) {
    // Hazmat compliance "on hold" items are retrieved via the on-hold search
    // endpoint (POST). The previous `/v3/items/hazmat` path does not exist (405).
    return await this.client.post(`${this.basePath}/items/onhold/search`, data ?? {});
  }
}
