/**
 * Walmart known issues / hint lookup.
 *
 * When the marketplace API returns a 4xx/5xx for a documented "broken or
 * deprecated endpoint", we attach a hint to the error response so the LLM can
 * fall back without burning more tokens guessing. This file is the single
 * source of truth — keep README.md "Known Issues" section aligned.
 *
 * Add an entry when:
 *   - Walmart's endpoint is confirmed broken or removed (404/405/520).
 *   - The endpoint requires a seller-program enrollment (Repricer / WFS / Ads)
 *     and the failure pattern is consistent enough that a hint helps.
 *   - There is a deterministic workaround a calling agent can apply.
 *
 * Do NOT add entries for:
 *   - Transient infrastructure errors (those should retry, not steer).
 *   - Per-call validation errors (those should be caught by zod, not here).
 */

export interface KnownIssue {
  /** HTTP method, uppercase. */
  method: string;
  /** Regex against the request URL path (not host). */
  pathPattern: RegExp;
  /** What the LLM should do instead. Keep one sentence, actionable. */
  hint: string;
}

export const KNOWN_ISSUES: ReadonlyArray<KnownIssue> = [
  // ---------- Insights API ----------
  {
    method: 'GET',
    pathPattern: /\/v3\/insights\/items\/unpublished\/counts/,
    hint:
      "Walmart's Aurora unpublished-item-service has been returning 404 since 2026-05. " +
      "Use walmart_get_all_items + filter publishedStatus='UNPUBLISHED' client-side.",
  },
  {
    method: 'GET',
    pathPattern: /\/v3\/insights\/items\/listingQuality\/categories/,
    hint:
      "Walmart removed this Insights aggregation endpoint. No direct replacement; use " +
      "walmart_get_item_quality_details per SKU once that endpoint is restored, or fall back to " +
      "walmart_get_listing_quality for the store-aggregate score.",
  },
  {
    method: 'GET',
    pathPattern: /\/v3\/insights\/items\/listingQuality\/items/,
    hint:
      "Walmart's documented endpoint signature changed; current implementation returns 405. " +
      "Track via walmart_get_listing_quality (store-aggregate) until docs are updated.",
  },

  // ---------- Returns ----------
  {
    method: 'GET',
    pathPattern: /\/v3\/returns\/count/,
    hint:
      "Walmart removed /v3/returns/count. Compute client-side: walmart_get_all_returns then " +
      "group by status.",
  },

  // ---------- Settings ----------
  {
    method: 'GET',
    pathPattern: /\/v3\/settings\/shipping/,
    hint:
      "Walmart's /v3/settings/shipping endpoint returns 404 for sellers without elevated access. " +
      "No known public-API workaround — check Seller Center settings UI manually.",
  },

  // ---------- Items / Hazmat ----------
  {
    method: 'GET',
    pathPattern: /\/v3\/items\/onhold\/hazmat/,
    hint:
      "walmart_get_hazmat_items now uses POST /v3/items/onhold/search (fixed in v0.3.2). " +
      "If a 405 still appears, the implementation may be calling the old GET path.",
  },

  // ---------- WFS Fulfillment program-gated ----------
  {
    method: 'GET',
    pathPattern: /\/v3\/fulfillment\/inbound-shipments/,
    hint:
      "WFS endpoints return 404 for sellers without Walmart Fulfillment Services enrollment. " +
      "Enroll at https://seller.walmart.com/ → Walmart Fulfillment Services; otherwise this and " +
      "all walmart_*_wfs_* / walmart_*_inbound_* / walmart_*_mcs_* tools will fail.",
  },
  {
    method: 'GET',
    pathPattern: /\/v3\/fulfillment\/carriers/,
    hint:
      "Ship-with-Walmart carriers endpoint requires Ship with Walmart enrollment. " +
      "If your seller account is not enrolled, walmart_get_shipping_carriers, walmart_create_shipping_label, " +
      "and walmart_get_shipping_estimate will all 404.",
  },

  // ---------- Repricer program-gated ----------
  {
    method: 'GET',
    pathPattern: /\/v3\/repricer\/strategies/,
    hint:
      "Walmart Repricer is opt-in; 403 means your account is not enrolled. Apply via Seller Center " +
      "(Pro Seller badge usually required) before walmart_*_repricer_* tools will work.",
  },
  {
    method: 'POST',
    pathPattern: /\/v3\/repricer\/strategies/,
    hint:
      "Walmart Repricer 403 means your account is not enrolled. Apply via Seller Center " +
      "(Pro Seller badge required).",
  },

  // ---------- Notifications / Subscriptions ----------
  {
    method: 'GET',
    pathPattern: /\/v3\/notifications\/subscriptions/,
    hint:
      "Walmart Webhooks API requires explicit allowlisting per seller account. If you see 404, " +
      "request access via Seller Support before relying on walmart_*_subscription tools.",
  },

  // ---------- Reports — async download ----------
  {
    method: 'GET',
    pathPattern: /\/v3\/reports\/reportRequests\/.+\/download/,
    hint:
      "Report download URLs are valid only after status=READY. If you get 404 or 410, the report " +
      "may have expired (Walmart keeps reports ~30 days). Re-request via walmart_create_report.",
  },

  // ---------- Walmart Connect Ads — endpoint catch-all ----------
  // The ad client uses a different base URL, so these patterns are advisory.
  {
    method: 'GET',
    pathPattern: /\/api-proxy\/service\/WPA\/Api/,
    hint:
      "Walmart Connect (Advertising) needs WALMART_AD_CONSUMER_ID + WALMART_AD_PRIVATE_KEY env " +
      "vars. Apply for Walmart Connect at https://www.walmartconnect.com/ first.",
  },
];

/** Returns the workaround hint for a known-broken endpoint, or undefined. */
export function findKnownIssueHint(method: string | undefined, url: string | undefined): string | undefined {
  if (!method || !url) return undefined;
  const m = method.toUpperCase();
  for (const issue of KNOWN_ISSUES) {
    if (issue.method === m && issue.pathPattern.test(url)) return issue.hint;
  }
  return undefined;
}
