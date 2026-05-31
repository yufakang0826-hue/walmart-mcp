// Live sandbox smoke test — exercises read-only Walmart Marketplace calls end-to-end.
//
// Requires real credentials. Provide them via a .env file in this directory or
// via environment variables:
//   WALMART_CLIENT_ID, WALMART_CLIENT_SECRET
//   WALMART_ENVIRONMENT=sandbox   (default)
// Optional advertising check:
//   WALMART_AD_CONSUMER_ID, WALMART_AD_PRIVATE_KEY
//
// If credentials are absent the script SKIPS (exit 0) rather than failing, so it
// is safe to wire into CI where secrets may not be present.
//
// Usage:  npm run build  &&  node test-sandbox.mjs
//
// Every call here is read-only (GET). Nothing is created, modified, or deleted.

import 'dotenv/config';

const hasCreds = !!(process.env.WALMART_CLIENT_ID && process.env.WALMART_CLIENT_SECRET);
if (!hasCreds) {
  console.log('⏭  SKIP: WALMART_CLIENT_ID / WALMART_CLIENT_SECRET not set.');
  console.log('   Set them in .env (see .env.example) to run the live sandbox smoke test.');
  process.exit(0);
}

const { getConfig } = await import('./build/config/environment.js');
const { WalmartSellerApi } = await import('./build/api/index.js');

const config = getConfig();
console.log(`▶  Live sandbox smoke test — environment: ${config.environment}\n`);

const api = new WalmartSellerApi(config);
await api.initialize();

let pass = 0;
let fail = 0;
let skip = 0;

async function check(name, fn, { optional = false } = {}) {
  try {
    const result = await fn();
    const preview = JSON.stringify(result ?? null).slice(0, 90);
    console.log(`✓  ${name}\n   ${preview}`);
    pass++;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (optional) {
      console.log(`⏭  ${name} (optional) — ${msg}`);
      skip++;
    } else {
      console.log(`✗  ${name}\n   ${msg}`);
      fail++;
    }
  }
}

// ===== Auth =====
await check('Token refresh', () => api.auth.getAccessToken().then((t) => ({ tokenLength: t?.length })));
await check('Token detail', () => api.auth.getTokenDetail());

// ===== Read-only marketplace calls =====
await check('Get partner info', () => api.settings.getPartnerInfo());
await check('Get fulfillment centers', () => api.settings.getFulfillmentCenters());
await check('Get all items (limit 5)', () => api.items.getAllItems({ limit: 5 }));
await check('Get item count', () => api.items.getItemCount({}));
// /v3/inventories is the correct bulk endpoint per Walmart docs, but it 404s for
// sandbox sellers that are not multi-node provisioned. Treated as optional.
await check('Get all inventory (limit 5)', () => api.inventory.getAllInventory({ limit: 5 }), { optional: true });
await check('Get all orders (limit 5)', () => api.orders.getAllOrders({ limit: 5 }));
await check('Get all returns (limit 5)', () => api.returns.getAllReturns({ limit: 5 }));
// The sandbox /v3/feeds endpoint intermittently returns a 520 server error
// (ArrayIndexOutOfBoundsException) — a Walmart-side defect, not ours. Optional.
await check('Get all feed statuses (limit 5)', () => api.feeds.getAllFeedStatuses({ limit: 5 }), { optional: true });
await check('Get repricer strategies', () => api.pricing.getRepricerStrategies());
await check('Get listing quality score', () => api.reports.getListingQuality({}));

// ===== Advertising (optional — separate credentials) =====
if (config.adConsumerId && config.adPrivateKey) {
  await check('Get ad campaigns', () => api.advertising.getCampaigns({}), { optional: true });
} else {
  console.log('⏭  Advertising checks skipped (WALMART_AD_CONSUMER_ID / WALMART_AD_PRIVATE_KEY not set)');
  skip++;
}

console.log(`\n── Summary ──  ✓ ${pass} passed   ✗ ${fail} failed   ⏭ ${skip} skipped`);
process.exit(fail > 0 ? 1 : 0);
