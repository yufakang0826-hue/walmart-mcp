# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
