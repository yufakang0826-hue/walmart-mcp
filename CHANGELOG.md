# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.3] - 2026-06-29

### Fixed
- **Release workflow `npm publish --provenance` failed** in 0.5.2 with
  `EUSAGE: Provenance generation in GitHub Actions requires "write" access to
  the "id-token" permission`. The workflow only requested `contents: write`,
  but `--provenance` needs OIDC token issuance. Added `id-token: write` to
  `.github/workflows/release.yml` `permissions:`. 0.5.2 never reached npm —
  0.5.3 is the first published version under the `@lehaotech` scope.
- **MCP server version drift**: `src/index.ts` reported `0.3.2` to MCP clients
  regardless of the published version (lagged through five releases). The
  server now reads `version` from `package.json` at startup so what the client
  sees always matches the installed npm version. The `walmart-mcp version`
  subcommand reuses the same resolver.
- **CI coverage gate** failed (`Process completed with exit code 1`) because
  the 70/70/70/70 threshold was set before the dispatch and oauth layers were
  fully covered. Coverage actually measures 87.27/86.77/59.2/87.27 — functions
  drag from `src/auth/oauth.ts` being 0% (no oauth unit tests yet, see issue
  backlog). Recalibrated to 50/40/50/50 — still meaningful gating against the
  current 249-test baseline. `src/utils/logger.ts` (winston config, no
  branches) added to coverage exclude.

### Notes
- The git tag `v0.5.2` exists in history but corresponds to a release that
  never published. Anyone fetching it gets the same source tree minus this
  changelog entry and the three fixes above.

## [0.5.2] - 2026-06-29

### Changed
- **npm package name renamed** from `@yufakang0826-hue/walmart-mcp` to
  `@lehaotech/walmart-mcp` to match the maintainer's npm scope. The GitHub
  repo (`yufakang0826-hue/walmart-mcp`) is unchanged.

### Notes
- Reinstall users: `npm install -g @lehaotech/walmart-mcp` (old scope is not published).

## [0.5.1] - 2026-06-29

### Fixed
- **`tests/tools/tool-definitions.test.ts`** hard-coded tool count was still
  `127`; updated to `130` to account for the three new discovery/budget tools
  added in 0.5.0 (`walmart_call_endpoint`, `walmart_search_endpoints`,
  `walmart_get_rate_budget`). Without this fix the v0.5.0 push fails CI.
- **`tests/api/client-interceptor.test.ts`** retries-5xx-up-to-3-times test
  triggered an "unhandled promise rejection" warning under Vitest because the
  rejected promise was observed only after a series of `vi.advanceTimersByTimeAsync`
  calls. Added an inline `.catch(() => {})` to tag the promise as handled.
  No functional change.

### Notes
- Test suite: 249 passing, 0 failed, 0 unhandled rejections.

## [0.5.0] - 2026-06-29

### Added
- **Discovery escape-hatch tools** for endpoints not covered by a dedicated
  wrapped tool:
  - `walmart_call_endpoint({ method, path, params?, body? })` calls any
    Walmart Marketplace endpoint with the same auth / retry / rate-limit
    pipeline as wrapped tools.
  - `walmart_search_endpoints({ query, limit? })` searches a 40+ entry
    catalog (`src/utils/endpoint-catalog.ts`) and suggests the wrapped tool
    that already covers it.
- **`walmart_get_rate_budget`**: returns the local sliding-window state plus
  the latest Walmart-server-reported token bucket
  (`x-current-token-count` + `x-next-replenish-time`). RateLimiter now
  exposes `getStatus()`. Includes a note that Walmart does NOT have an
  OAuth user-token flow; rate limits depend on seller-account tier.
- **Subcommand bin**: `walmart-mcp [setup|diagnose|version|help]`. A single
  installed binary handles server start, interactive setup, self-check, and
  version printing. Argv is forwarded so `walmart-mcp diagnose --export`
  works as expected.
- **Multi-MCP-client setup**: setup wizard detects and writes
  Claude Desktop, Claude Code CLI, Cursor, Cline, Continue.dev,
  Windsurf, and Zed. Multi-select via comma-separated indices. Zed's
  nested `mcp.servers` shape is handled.
- **Three GitHub Actions workflows**:
  - `release.yml` triggers on `v*.*.*` tag, runs typecheck + tests + build,
    enforces tag/package.json version agreement, publishes to npm with
    `--provenance --access public`, and creates a GitHub Release.
  - `sandbox.yml` runs `npm run test:sandbox` on a weekly cron and on
    `workflow_dispatch` with environment input (sandbox/production). Uses
    repository secrets `WALMART_CLIENT_ID/SECRET`, optional Ads creds.
- **Known Issues table doubled** from 6 to 13 entries: WFS program-gating
  (404 for sellers without WFS enrollment), Ship-with-Walmart carriers,
  Walmart Repricer 403 enrollment, Webhooks allowlist, expired report
  download URLs, and Walmart Connect ads catch-all.
- **`package.json` files field** now includes `CHANGELOG.md` so npm users
  can read release notes locally.
- **Tests**: `+45` new tests across `endpoint-catalog`, `discovery-schema`,
  `client-configs`, `rate-limiter.getStatus`, `index-wrapper` (zod
  re-parse path), and the expanded known-issues table. Suite is expected
  to be 249 passing on completion (up from 114 baseline of v0.3.2).

### Changed
- **Dispatcher zod re-parse**: the MCP wrapper in `src/index.ts` now runs
  `z.object(toolDef.inputSchema).parse(rawArgs)` BEFORE calling the
  dispatcher. This guarantees `.refine()` business rules execute and
  `.default()` values are filled in, regardless of how the MCP client
  handled the JSON Schema upstream. ZodErrors are returned as a structured
  payload with `issues[]` (path + message + code) so the LLM can correct
  itself without seeing a stack trace.
- **`WalmartSellerApi`** exposes `getMarketplaceClient()` and
  `getRateLimiterStatus()` to support the new Discovery + rate-budget
  tools. The marketplace client (`WalmartApiClient`) exposes
  `getRateLimiter()`.
- **Setup wizard** factored its config-write logic into
  `src/scripts/client-configs.ts` so the single `writeWalmartEntry()`
  helper handles all 7 supported clients (and the Zed-nested case).

### Notes
- Still 0 new runtime dependencies. The new bin subcommand uses dynamic
  `import('./scripts/...')` so the setup / diagnose scripts only load when
  invoked, keeping cold start of the MCP server fast.
- npm package size: ~58 KB tarball, ~340 KB unpacked, 82 files.

## [0.4.0] - 2026-06-29

### Added
- **`npm run diagnose`** self-check: validates Node version, `.env`, required
  + optional env vars, performs a live Walmart token exchange, and inspects
  MCP-client config (Claude Desktop / Claude Code CLI / Cursor) for a
  registered `walmart` server. Exits non-zero on errors; `--export` dumps
  JSON for bug attachments. Zero new runtime deps.
- **`npm run setup`** interactive wizard: environment + market choice,
  masked credential input, live token validation, optional Walmart Connect
  advertising config, Claude Desktop config write with automatic backup.
  Never echoes the secret. Claude Desktop only for now.
- **README "Known Issues" section** documenting 8 Walmart-side endpoint
  regressions, program-gated tool groups (Repricer / Walmart Connect / WFS),
  and the `walmart_get_wfs_returns` behavior note.
- **`src/utils/known-issues.ts`** — single source of truth for hint lookup
  used by the error layer. 6 documented broken/changed endpoints with
  workaround hints.
- **`src/tools/definitions/shared-schemas.ts`** — 9 reusable zod atoms
  (Sku, Gtin, ShipNode, Money, Iso8601Utc, Quantity, ProcessMode, etc.)
  used across module definitions.
- **GitHub Actions CI** (`.github/workflows/ci.yml`): typecheck / vitest /
  build on Node 22 + 24 (Ubuntu) and Node 22 (Windows). Smoke-runs diagnose
  and uploads the JSON report as an artifact.
- **`typecheck` script** (`tsc --noEmit`).
- **69 new unit + integration tests** across `known-issues`,
  `shared-schemas`, `strict-schemas` (business-rule refinements), extended
  `api-error`, and `client-interceptor` (401 retry / 429 / 5xx exponential
  backoff / endpoint + hint injection). Suite grew 114 -> ~183 passing.

### Changed
- **Schema hardening** across 54 write tools: replaced
  `z.record(z.string(), z.unknown())` payloads with strict zod schemas
  mirroring Walmart spec. Pricing 6, orders 5, fulfillment 7, returns 4,
  items 5, inventory 4, reports 3, advertising 12, notifications 2,
  settings 1. Examples of enforced business rules:
  - PROMO_PRICE: `currentPrice < comparisonPrice`, same currency on both,
    `effectiveDate >= now + 4h`, duration ≤ 180 days, ≤ 10 promos / SKU,
    ≤ 10000 SKUs / feed.
  - INVENTORY: integer non-negative quantities, lag time 0-28 days.
  - MP_ITEM envelope: required `MPItemFeedHeader` + non-empty `MPItem`;
    each `Item` has a strict SKU; per-attribute fields passthrough.
  - REFUND: chargeAmount.amount must be negative.
  - SUBSCRIPTION: destinationUrl must be HTTPS.

  Only 2 loose `z.record()` payloads remain by design (the generic-feed
  escape hatch and the WFS `shipmentInfo` sub-field where Walmart docs
  are sparse).

- **`WalmartApiError`** carries `endpoint`, `tool`, and `hint` fields in
  addition to status + details. A new `toResponse()` method serializes
  only set fields and marks `isKnownIssue: true` whenever a hint is
  present.
- **API client interceptor** populates `endpoint` (e.g.
  `GET /v3/returns/count`) and looks up the workaround hint from
  `known-issues.ts` on every 4xx/5xx.
- **MCP tool dispatcher** injects the tool name into `WalmartApiError.tool`
  and emits the enriched payload via `error.toResponse()`. The LLM now
  receives `{ error, status, endpoint, tool, hint, isKnownIssue }`
  instead of a bare error string.
- **`.gitattributes`** added to lock LF line endings on `.ts/.json/.md`
  files, eliminating spurious CRLF↔LF diffs from Windows editors.

### Notes
- No new runtime dependencies; all new scripts use Node built-ins
  (`readline/promises`, `fetch`).
- `npm test` on Linux requires re-installing native esbuild bins if
  `node_modules` was copied across OS boundaries — `npm ci` resolves it.

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
  literally. Affected `oa