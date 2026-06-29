// Live sandbox smoke test — exercises read-only Walmart Marketplace calls and
// asserts response shapes. Failures distinguish:
//   - Connectivity / auth (network)
//   - Walmart spec drift (response shape changed)
//   - Walmart-side regression (4xx/5xx on a documented endpoint)
//
// Requires real credentials. Provide via .env or env:
//   WALMART_CLIENT_ID, WALMART_CLIENT_SECRET, WALMART_ENVIRONMENT (default sandbox)
// Optional advertising:
//   WALMART_AD_CONSUMER_ID, WALMART_AD_PRIVATE_KEY
//
// Skips with exit 0 when credentials absent — safe in CI.

import 'dotenv/config';
import { z } from 'zod';

const hasCreds = !!(process.env.WALMART_CLIENT_ID && process.env.WALMART_CLIENT_SECRET);
if (!hasCreds) {
  console.log('SKIP: WALMART_CLIENT_ID / WALMART_CLIENT_SECRET not set.');
  console.log('   Set them in .env (see .env.example) to run the live sandbox smoke test.');
  process.exit(0);
}

const { getConfig } = await import('./build/config/environment.js');
const { WalmartSellerApi } = await import('./build/api/index.js');
const { searchEndpoints } = await import('./build/utils/endpoint-catalog.js');
const { findKnownIssueHint } = await import('./build/utils/known-issues.js');

const config = getConfig();
console.log(`\nLive sandbox smoke test — environment: ${config.environment}\n`);

const api = new WalmartSellerApi(config);
await api.initialize();

let pass = 0;
let fail = 0;
let skip = 0;
const failures = [];

/**
 * Run a check. Asserts on response shape if `assert` is provided.
 * `assert` receives the resolved value and may throw or return a string
 * describing the failure.
 */
async function check(name, fn, { optional = false, assert } = {}) {
  try {
    const result = await fn();
    if (assert) {
      const violation = assert(result);
      if (violation) throw new Error(`Assertion failed: ${violation}`);
    }
    const preview = JSON.stringify(result ?? null).slice(0, 90);
    console.log(`[OK]   ${name}\n       ${preview}`);
    pass++;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (optional) {
      console.log(`[SKIP] ${name} (optional) — ${msg}`);
      skip++;
    } else {
      console.log(`[FAIL] ${name}\n       ${msg}`);
      failures.push({ name, msg });
      fail++;
    }
  }
}

// ---------- Schema definitions for assertions ----------

const TokenInfoSchema = z.object({
  tokenLength: z.number().int().positive(),
});

const TokenDetailSchema = z.object({
  // Walmart returns is_valid / expires_in / scope etc.
  is_valid: z.boolean().optional(),
  expires_in: z.number().int().positive().optional(),
}).passthrough();

const PartnerInfoSchema = z.object({}).passthrough().refine((v) => {
  // Partner info should have at least one of these documented fields.
  const r = v;
  return typeof r.partnerId === 'string' || typeof r.partnerDisplayName === 'string';
}, 'expected partnerId or partnerDisplayName in partner info');

const ItemListSchema = z.object({
  ItemResponse: z.array(z.unknown()).optional(),
  totalItems: z.number().int().nonnegative().optional(),
}).passthrough();

const OrderListSchema = z.object({}).passthrough().refine((v) => {
  // Walmart returns either elements.order or list.elements.order
  const r = v;
  return r.list || r.elements || r.order;
}, 'expected order list under list/elements/order key');

const ReturnListSchema = z.object({
  returnOrders: z.array(z.unknown()).optional(),
  meta: z.object({ totalCount: z.number().int().nonnegative().optional() }).passthrough().optional(),
}).passthrough();

const RateBudgetSchema = z.object({
  name: z.string(),
  localMaxRequests: z.number().int().positive(),
  localCurrentCount: z.number().int().nonnegative(),
  localRemaining: z.number().int().nonnegative(),
  serverTokensRemaining: z.number().int().nullable(),
});

// ===== Auth =====
await check('Token refresh', () => api.auth.getAccessToken().then((t) => ({ tokenLength: t?.length })), {
  assert: (r) => {
    const parse = TokenInfoSchema.safeParse(r);
    if (!parse.success) return parse.error.issues.map((i) => i.message).join('; ');
    if (r.tokenLength < 32) return `token suspiciously short: ${r.tokenLength}`;
    return null;
  },
});

await check('Token detail', () => api.auth.getTokenDetail(), {
  assert: (r) => TokenDetailSchema.safeParse(r).success ? null : 'token detail shape unexpected',
});

// ===== Read-only marketplace =====
await check('Get partner info', () => api.settings.getPartnerInfo(), {
  assert: (r) => {
    const parse = PartnerInfoSchema.safeParse(r);
    return parse.success ? null : parse.error.issues.map((i) => i.message).join('; ');
  },
});

await check('Get fulfillment centers', () => api.settings.getFulfillmentCenters(), {
  assert: (r) => (r ? null : 'empty response'),
});

await check('Get all items (limit 5)', () => api.items.getAllItems({ limit: 5 }), {
  assert: (r) => {
    const parse = ItemListSchema.safeParse(r);
    if (!parse.success) return 'ItemList shape unexpected';
    if (r.totalItems != null && r.totalItems < 0) return `negative totalItems: ${r.totalItems}`;
    return null;
  },
});

await check('Get item count', () => api.items.getItemCount({}), {
  assert: (r) => (r ? null : 'empty response'),
});

await check('Get all inventory (limit 5)', () => api.inventory.getAllInventory({ limit: 5 }), {
  optional: true,
});

await check('Get all orders (limit 5)', () => api.orders.getAllOrders({ limit: 5 }), {
  assert: (r) => {
    const parse = OrderListSchema.safeParse(r);
    return parse.success ? null : parse.error.issues.map((i) => i.message).join('; ');
  },
});

await check('Get all returns (limit 5)', () => api.returns.getAllReturns({ limit: 5 }), {
  assert: (r) => {
    const parse = ReturnListSchema.safeParse(r);
    return parse.success ? null : parse.error.issues.map((i) => i.message).join('; ');
  },
});

await check(
  'Get all feed statuses (limit 5)',
  () => api.feeds.getAllFeedStatuses({ limit: 5 }),
  { optional: true },
);

await check('Get repricer strategies', () => api.pricing.getRepricerStrategies(), {
  optional: true, // 403 if not enrolled
});

await check('Get listing quality score', () => api.reports.getListingQuality({}), {
  assert: (r) => {
    if (!r || typeof r !== 'object') return 'unexpected listing quality response';
    return null;
  },
});

// ===== v0.4.0+ new tools =====
await check('Rate budget snapshot (post-warmup)', async () => api.getRateLimiterStatus(), {
  assert: (r) => {
    const parse = RateBudgetSchema.safeParse(r);
    if (!parse.success) return parse.error.issues.map((i) => i.message).join('; ');
    if (r.serverTokensRemaining === null) {
      return 'serverTokensRemaining still null after warmup calls (rate limiter not capturing headers)';
    }
    return null;
  },
});

await check('Endpoint catalog search ("feed status")', () => searchEndpoints('feed status', 3), {
  assert: (matches) => {
    if (!Array.isArray(matches) || matches.length === 0) return 'no matches for "feed status"';
    if (!matches[0].wrappedTool) return 'top match has no wrappedTool';
    if (matches[0].wrappedTool !== 'walmart_get_feed_status') {
      return `top match wrappedTool=${matches[0].wrappedTool}, expected walmart_get_feed_status`;
    }
    return null;
  },
});

await check('Known-issue hint for /v3/returns/count', () => findKnownIssueHint('GET', '/v3/returns/count'), {
  assert: (h) => (h && /walmart_get_all_returns/.test(h) ? null : 'expected workaround hint mentioning walmart_get_all_returns'),
});

await check('walmart_call_endpoint via raw client', async () => {
  const client = api.getMarketplaceClient();
  return await client.get('/v3/items', { limit: 1 });
}, {
  assert: (r) => {
    const parse = ItemListSchema.safeParse(r);
    return parse.success ? null : 'call_endpoint response did not match ItemList shape';
  },
});

// ===== Advertising (optional) =====
if (config.adConsumerId && config.adPrivateKey) {
  console.log('\n── Walmart Connect Advertising sandbox checks ──');

  // Campaigns list — primary read.
  await check('Ads: get campaigns', () => api.advertising.getCampaigns({}), {
    optional: true,
    assert: (r) => {
      if (!r) return 'empty response';
      // Walmart returns either { campaigns: [] } or a flat array; accept both.
      if (Array.isArray(r)) return null;
      if (Array.isArray(r.campaigns) || Array.isArray(r.data)) return null;
      return 'campaigns response shape unexpected';
    },
  });

  // SBA (Sponsored Brands) profile — exercises the RSA-SHA256 signed path.
  await check('Ads: get SBA profile', () => api.advertising.getSbaProfile(), {
    optional: true,
    assert: (r) => (r && typeof r === 'object' ? null : 'SBA profile missing or wrong shape'),
  });

  // Search trends — read-only insight, no campaign required.
  await check('Ads: get search trends', () => api.advertising.getSearchTrends({}), {
    optional: true,
    assert: (r) => (r ? null : 'empty search-trends response'),
  });

  // Realtime stats — should return at worst an empty list, not error.
  await check('Ads: get realtime stats', () => api.advertising.getRealtimeStats({}), {
    optional: true,
  });

  // Latest report date — a tiny read used by report-generation flows.
  await check('Ads: get latest report date', () => api.advertising.getLatestReportDate(), {
    optional: true,
  });
} else {
  console.log('[SKIP] Advertising checks (WALMART_AD_CONSUMER_ID / WALMART_AD_PRIVATE_KEY not set)');
  skip++;
}

// ===== Summary =====
console.log(`\n── Summary ──  PASS ${pass}   FAIL ${fail}   SKIP ${skip}`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f.name}: ${f.msg}`);
}
process.exit(fail > 0 ? 1 : 0);
