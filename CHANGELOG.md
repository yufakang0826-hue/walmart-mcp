# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.2] - 2026-06-01

### Fixed
- API errors no longer collapse Walmart's response body into a bare
  `"HTTP 404: Not Found"`. A new `WalmartApiError` carries the HTTP status and
  raw body; `formatWalmartError` surfaces every `error[]`/`errors[]` entry
  (`CODE: description (field: x)`) or the raw body when unstructured, and tool
  results now include `status` and `details`. Applied to both the marketplace
  and advertising clients.
- `walmart_get_hazmat_items` pointed at the non-existent `/v3/items/hazmat`
  (405). Repointed to the documented on-hold search endpoint
  `POST /v3/items/onhold/search`; the request body is now optional.

### Changed
- `walmart_update_price` takes semantic params again (`sku`, `amount`,
  optional `currency`) instead of an opaque `pricing` object. The server builds
  the Walmart `/v3/price` payload, restoring field-level validation and the
  ergonomics of the older listing MCP. Promotional/strikethrough pricing
  remains in `walmart_submit_promo_price_feed`.

### Added
- Tests for `formatWalmartError`/`WalmartApiError`, the rebuilt price payload,
  and the corrected hazmat endpoint. Suite grew from 121 to 132 passing tests.

### Notes
- The test report's `get_wfs_returns` "duplicate data" finding is not a code
  defect: `GET /v3/returns?isWFSEnabled=Y` is the documented call and is sent
  correctly; Walmart returns the unfiltered set for accounts not enrolled in
  WFS. Left as-is.
- `get_item_quality_details` (405) and `get_shipping_settings` (404) are not
  changed: the correct endpoints could not be confirmed against authoritative
  docs, and guessing endpoints is exactly the failure mode to avoid. They need
  live sandbox verification.

## [0.3.1] - 2026-06-01

### Fixed
- Persisting tokens/credentials to `.env` corrupted any value containing `$`
  sequences (`$1`, `$&`, `$$`). `String.prototype.replace` interpreted them as
  replacement patterns, so a Walmart access token or client secret with a `$`
  was written mangled — breaking auth on the next restart. The shared
  `upsertEnvVars` helper now uses the function form of `replace` to write values
  literally. Affected `oauth.ts` (token cache) and `walmart_set_credentials`.
- Walmart Connect advertising signatures did not cover query-string parameters.
  GET requests with params (e.g. paginated `getCampaigns`/`getKeywords`) signed
  only the base path, so the signature would not match the actual request URL.
  Params are now folded into the request URL before signing, guaranteeing the
  signed URL is identical to what is sent.

### Changed
- Extracted the duplicated `.env`-writing logic from `oauth.ts` and the tool
  dispatcher into a single tested `src/utils/env-file.ts#upsertEnvVars`.

### Added
- Unit tests for `upsertEnvVars` (including the `$`-corruption regression) and
  for advertising request signing over the full URL with a query string. Suite
  grew from 114 to 121 passing tests.

## [0.3.0] - 2026-06-01

### Added
- `walmart_setup_guide` tool (127 tools total) — returns step-by-step setup
  instructions and reports what is already configured (environment, market,
  whether marketplace and advertising credentials are set). Call it first when
  getting started or when calls fail due to missing credentials.

### Changed
- Missing-credentials handling now guides the user instead of failing obscurely:
  - Token refresh throws an actionable error naming the env vars, the
    `walmart_set_credentials` tool, and the developer-portal URL, instead of
    surfacing a raw 401.
  - The startup banner (shown when credentials are absent) is a clear, multi-line
    checklist pointing to `walmart_setup_guide`.

## [0.2.0] - 2026-06-01

### Fixed
- `getPartnerInfo` targeted the non-existent `/v3/settings/partner` (404). Walmart
  has no dedicated partner endpoint; the seller record is returned as the `partner`
  object on `/v3/settings/shippingprofile`. Repointed the method there and surfaced
  the `partner` object. Verified against the live sandbox (partnerId 100009).
- `getItemCount` omitted the mandatory `status` query parameter on `/v3/items/count`
  (400). Now defaults `status` to `PUBLISHED` and accepts a caller override.
- Both bugs were discovered by the new live sandbox smoke test. Two remaining sandbox
  failures are environmental, not code defects: `/v3/inventories` 404 (account not
  multi-node provisioned) and `/v3/feeds` 520 (Walmart-side server error); the smoke
  test marks them optional.

### Changed
- Package renamed to the scoped name `@yufakang0826-hue/walmart-mcp` because the
  unscoped `walmart-mcp` name on npm belongs to a different author. Added
  `publishConfig.access: public` so the scoped package can be published openly.
- README install instructions updated to the scoped package name.

### Added
- Dedicated unit tests for the Pricing, Reports, and Advertising API modules.
- `ad-client` signing tests that verify the RSA-SHA256 request signature against a
  generated public key (canonical string, method casing, missing-key error path).
- `test-sandbox.mjs` live read-only smoke test plus `npm run test:sandbox` and
  `npm run test:run` scripts. The smoke test skips gracefully when credentials are
  absent, so it is CI-safe.
- Test suite grew from 70 to 112 passing tests across 10 files.

## [0.1.0] - 2026-02-26

### Added
- Initial release of the Walmart Marketplace MCP server.
- 126 tools across 12 modules: token management, items, inventory, orders, pricing,
  feeds, WFS fulfillment, returns, reports, notifications, advertising, settings.
- OAuth 2.0 with 15-minute token auto-refresh and proactive renewal.
- Walmart Connect advertising client with separate RSA-SHA256 signed authentication.
- Feed polling with progressive intervals.
- Auto-retry on 401, 429, 423, and 5xx responses.
- Sliding-window rate limiter.
- Sandbox and production environment support.
