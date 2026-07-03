import { appendFile, mkdir } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import { WalmartApiClient } from '../client.js';
import { getBusinessUnit, getSpecVersionCandidates } from '../../config/environment.js';
import type { WalmartMarket } from '../../config/environment.js';
import { makePagination } from '../../utils/pagination.js';

/**
 * Append-only local ledger of every content feed this MCP submits.
 * Rationale: Walmart offers NO API to read a listing's current
 * description/key features, so an overwrite is otherwise unrecoverable.
 * The ledger preserves exactly what we sent and when, per feed.
 * Location: $WALMART_FEED_LEDGER_DIR or ~/.walmart-mcp/feed-ledger.jsonl.
 * Failures are swallowed — the ledger must never break a submission.
 */
async function appendFeedLedger(entry: Record<string, unknown>): Promise<void> {
  try {
    const dir = process.env.WALMART_FEED_LEDGER_DIR || join(homedir(), '.walmart-mcp');
    await mkdir(dir, { recursive: true });
    await appendFile(
      join(dir, 'feed-ledger.jsonl'),
      `${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`,
      'utf-8',
    );
  } catch {
    /* never block a feed on ledger I/O */
  }
}

/**
 * Reduce a full Walmart item spec (a ~100KB+ JSON Schema) to just what a
 * caller needs to build a valid feed: required attribute names per section
 * plus type/enum/title detail for each required attribute.
 */
function summarizeSpecSchema(spec: unknown): unknown {
  const schema = (spec as { schema?: Record<string, any> })?.schema;
  if (!schema?.properties) return spec; // unexpected shape — return as-is

  const detail = (node: Record<string, any> | undefined, name: string) => {
    const p = node?.properties?.[name] ?? {};
    const out: Record<string, unknown> = { type: p.type };
    if (p.title && p.title !== name) out.title = p.title;
    if (p.enum) out.enum = p.enum.length > 25 ? [...p.enum.slice(0, 25), `... ${p.enum.length - 25} more`] : p.enum;
    if (p.items?.enum) out.itemEnum = p.items.enum.slice(0, 25);
    if (p.maxLength) out.maxLength = p.maxLength;
    return out;
  };
  const section = (node: Record<string, any> | undefined) => ({
    required: Object.fromEntries((node?.required ?? []).map((n: string) => [n, detail(node, n)])),
    optionalAttributes: Object.keys(node?.properties ?? {}).filter(
      (n) => !(node?.required ?? []).includes(n),
    ),
  });

  const header = schema.properties.MPItemFeedHeader;
  const item = schema.properties.MPItem?.items;
  const orderable = item?.properties?.Orderable;
  const visible = item?.properties?.Visible;
  const productTypes: Record<string, unknown> = {};
  for (const [pt, node] of Object.entries(visible?.properties ?? {})) {
    productTypes[pt] = section(node as Record<string, any>);
  }

  return {
    summarized: true,
    hint: 'Compact projection of the item spec. Pass requiredOnly: false for the full JSON Schema.',
    headerRequired: header?.required ?? [],
    orderable: section(orderable),
    visible: productTypes,
  };
}

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
  private resolvedSpecVersion: string | null = null;
  private specVersionProbe: Promise<string> | null = null;

  constructor(
    private client: WalmartApiClient,
    private market: WalmartMarket = 'us',
  ) {}

  /**
   * Resolve the currently-valid spec 5.0 version. Probes candidates (env
   * override first, then known-good fallbacks) against the Get Spec endpoint
   * once per process and caches the winner. If every probe fails (offline,
   * throttled), falls back to the first candidate so callers still proceed.
   * This defuses the quarterly time bomb where Walmart retires a version and
   * every item feed suddenly dies with WM_SPEC_MODE.
   */
  private async resolveSpecVersion(): Promise<string> {
    if (this.resolvedSpecVersion) return this.resolvedSpecVersion;
    if (this.specVersionProbe) return this.specVersionProbe;

    const candidates = getSpecVersionCandidates();
    this.specVersionProbe = (async () => {
      for (const version of candidates) {
        try {
          await this.client.post(`${this.basePath}/items/spec`, {
            feedType: 'MP_ITEM',
            version,
            productTypes: ['Drone Propellers'],
          });
          this.resolvedSpecVersion = version;
          return version;
        } catch {
          /* try the next candidate */
        }
      }
      this.resolvedSpecVersion = candidates[0]!;
      return this.resolvedSpecVersion;
    })().finally(() => {
      this.specVersionProbe = null;
    });
    return this.specVersionProbe;
  }

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
    const raw = await this.client.get(`${this.basePath}/items`, query);
    // Attach uniform pagination metadata (non-destructive).
    const items = (raw as { ItemResponse?: unknown[]; totalItems?: number })?.ItemResponse;
    if (Array.isArray(items)) {
      const offset = params?.offset != null ? parseInt(String(params.offset), 10) : 0;
      (raw as Record<string, unknown>).pagination = makePagination({
        returned: items.length,
        totalCount: (raw as { totalItems?: number }).totalItems,
        offset: Number.isNaN(offset) ? null : offset,
      });
    }
    return raw;
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

  async getTaxonomy(params?: { feedType?: string; version?: string; category?: string }) {
    // Current endpoint is /v3/items/taxonomy (the old /v3/taxonomy is gone —
    // "No static resource"). With feedType+version it returns the spec-5.0
    // product-type tree (productTypeGroup → productTypeName), which is the
    // source of valid names for getItemSpec.
    const query = params?.feedType || params?.version
      ? {
          feedType: params?.feedType ?? 'MP_ITEM',
          version: params?.version ?? (await this.resolveSpecVersion()),
        }
      : undefined;
    const raw = await this.client.get(`${this.basePath}/items/taxonomy`, query);

    // The full tree is ~2MB. When a filter is given, match it (case-
    // insensitive substring) against BOTH top-level category names AND
    // productTypeName leaves — sellers usually search by product, not by
    // Walmart's category taxonomy ("cigar" should find Cigar Cases even
    // though the top-level category is "Home").
    if (!params?.category) return raw;
    const tree = (raw as { itemTaxonomy?: Array<Record<string, any>> })?.itemTaxonomy;
    if (!Array.isArray(tree)) return raw;
    const needle = params.category.toLowerCase();
    const matchedProductTypes: Array<{ productTypeName: string; category: string; productTypeGroup: string }> = [];
    const matched = tree.filter((node) => {
      const categoryHit =
        String(node.category ?? '').toLowerCase().includes(needle) ||
        String(node.description ?? '').toLowerCase().includes(needle);
      let ptHit = false;
      for (const group of node.productTypeGroup ?? []) {
        for (const pt of group.productType ?? []) {
          const name = String(pt.productTypeName ?? '');
          if (name.toLowerCase().includes(needle)) {
            ptHit = true;
            matchedProductTypes.push({
              productTypeName: name,
              category: String(node.category ?? ''),
              productTypeGroup: String(group.productTypeGroupName ?? ''),
            });
          }
        }
      }
      return categoryHit || ptHit;
    });
    return {
      filtered: true,
      categoryFilter: params.category,
      matchCount: matched.length,
      matchedProductTypes,
      itemTaxonomy: matched,
    };
  }

  async getItemSpec(params: {
    productType: string | string[];
    feedType?: string;
    version?: string;
    requiredOnly?: boolean;
  }) {
    if (!params.productType || (Array.isArray(params.productType) && params.productType.length === 0)) {
      throw new Error('productType is required');
    }
    // Walmart's Get Spec is POST /v3/items/spec with a JSON body — the old
    // GET form 404s ("No Items found for the input parameters"). Verified
    // against production 2026-07-02. Body: { feedType, version (FULL dated
    // string), productTypes: [up to 20 names from getTaxonomy] }.
    // Throttled at ~3 requests/minute per seller.
    const productTypes = Array.isArray(params.productType)
      ? params.productType
      : [params.productType];
    const spec = await this.client.post(`${this.basePath}/items/spec`, {
      feedType: params.feedType ?? 'MP_ITEM',
      version: params.version ?? (await this.resolveSpecVersion()),
      productTypes,
    });
    // Default to the compact required-attributes projection: the raw spec is
    // ~100KB+ of JSON Schema per product type.
    return params.requiredOnly === false ? spec : summarizeSpecSchema(spec);
  }

  async submitItemFeed(data: object) {
    // Dual-shape support:
    //  - spec 5.0 items ({ Orderable, Visible }) → feedType=MP_ITEM with a
    //    normalized { businessUnit, locale, version } header (same contract
    //    as MP_MAINTENANCE — see normalizeSpec5Envelope).
    //  - legacy items ({ Item: {...} }) → feedType=item, payload untouched
    //    (this path is proven working in production; kept for back-compat).
    const items = (data as { MPItem?: unknown[] }).MPItem;
    const first = Array.isArray(items) ? items[0] : undefined;
    const isSpec5 = !!first && typeof first === 'object' && 'Orderable' in (first as object);

    const feedType = isSpec5 ? 'MP_ITEM' : 'item';
    const payload = isSpec5
      ? await this.normalizeSpec5Envelope(data, { rejectItemWrapper: true })
      : data;
    const result = await this.client.post(
      `${this.basePath}/feeds?feedType=${feedType}`,
      payload,
      { headers: { 'Content-Type': 'application/json' } },
    );
    void appendFeedLedger({
      feedType,
      feedId: (result as { feedId?: string })?.feedId,
      payload,
    });
    return result;
  }

  async submitItemUpdateFeed(data: object) {
    const payload = await this.normalizeSpec5Envelope(data, { rejectItemWrapper: true });
    const result = await this.client.post(
      `${this.basePath}/feeds?feedType=MP_MAINTENANCE`,
      payload,
      { headers: { 'Content-Type': 'application/json' } },
    );
    void appendFeedLedger({
      feedType: 'MP_MAINTENANCE',
      feedId: (result as { feedId?: string })?.feedId,
      payload,
    });
    return result;
  }

  /**
   * Enforce the spec-5.0 feed envelope contract regardless of what the
   * caller supplied: header reduced to { businessUnit, locale, version }
   * with defaults filled in, forbidden fields dropped, and (optionally)
   * legacy `MPItem[].Item` wrappers rejected with an actionable error.
   * Shared by MP_MAINTENANCE and spec-5.0 MP_ITEM submissions.
   */
  private async normalizeSpec5Envelope(
    data: object,
    opts: { rejectItemWrapper: boolean },
  ): Promise<object> {
    const feed = { ...(data as Record<string, unknown>) };
    const rawHeader = { ...((feed.MPItemFeedHeader as Record<string, unknown>) ?? {}) };

    for (const field of FORBIDDEN_MAINTENANCE_HEADER_FIELDS) delete rawHeader[field];

    feed.MPItemFeedHeader = {
      businessUnit: rawHeader.businessUnit ?? getBusinessUnit(this.market),
      locale: rawHeader.locale ?? 'en',
      version:
        typeof rawHeader.version === 'string' && rawHeader.version.length > 3
          ? rawHeader.version
          : await this.resolveSpecVersion(),
    };

    const items = feed.MPItem;
    if (opts.rejectItemWrapper && Array.isArray(items)) {
      for (const item of items) {
        if (item && typeof item === 'object' && 'Item' in (item as Record<string, unknown>)) {
          throw new Error(
            'Spec 5.0 feeds reject the legacy `Item` wrapper. Use ' +
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
