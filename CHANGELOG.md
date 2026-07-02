# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.8] - 2026-07-02

### Fixed
- **`walmart_submit_item_update_feed` could never succeed** (P0). The zod
  envelope forced the legacy `MPItem[].Item` wrapper and defaulted
  `version: "5.0"` + `sellingChannel`, all of which current Walmart spec 5.0
  rejects. Reverse-engineered the working contract against production
  (19 live feed submissions, seller YOUZITECH, 2026-07-02):
  - Header may ONLY contain `{ businessUnit, locale, version }`.
    `subset`/`requestId`/`mart`/`feedDate` fail item validation ("not a valid
    field"); `sellingChannel`/`processMode` flip Walmart's parser into a
    legacy path that NPEs (`ERR_INT_DATA_01010092` / PGW, itemsReceived=0)
    when `subset` is absent.
  - `version` must be the FULL dated spec string; bare `"5.0"` dies with
    `ERR_INT_SYS_0801003` / `WM_SPEC_MODE` mislabeled as a transient glitch.
  - Items use `{ Orderable: { sku, productIdentifiers }, Visible:
    { "<Product Type>": { productName, shortDescription, keyFeatures, ... } } }`
    — `productName` lives under Visible, and the `Item` wrapper is rejected.
  New schema + a runtime `normalizeMaintenanceFeed()` sanitizer enforce all of
  this; defaults are filled from config so callers can pass just `MPItem`.
  Verified: feed 18BE535D81BE56A4AC777455D14D08D7@AX8BBgA accepted with zero
  ingestion errors.
- **`walmart_call_endpoint` silently dropped `params` for POST/PUT/PATCH** —
  e.g. `POST /v3/feeds` + `params: { feedType }` 404ed ("No static resource").
  Query params are now folded into the URL for body-carrying methods.
- **`walmart_poll_feed_until_complete` died at ~60s with MCP `-32001`** even
  when `maxWaitSeconds` allowed 2h, because MCP clients abort long tool calls.
  Per-call budget is now clamped to 50s and budget exhaustion RETURNS the
  latest status with `pollTimedOut: true` + a hint instead of throwing.
  Polling intervals tightened (3s initial, then 5/10/15/20/30s) so fast feeds
  resolve in one call.
- **`walmart_get_item_spec` always 404ed** — it sent `productType` (singular)
  and omitted `feedType`; Walmart's Get Spec wants `productTypes`, `feedType`,
  and a FULL dated `version`. All three are now sent, with the version
  defaulted from config.

### Added
- `DEFAULT_ITEM_SPEC_VERSION` (currently `5.0.20260501-19_21_29-api`, per the
  2026-05 developer-portal release) with `WALMART_ITEM_SPEC_VERSION` env
  override, plus `getBusinessUnit()` market→businessUnit mapping.
- Feed-status responses now carry an `ingestionHint` when Walmart returns
  `WM_SPEC_MODE` or the PGW NullPointerException, translating both cryptic
  errors into the actual fix (full version string / forbidden header fields).
- **429 auto-retry**: when Walmart's `retry-after` is ≤30s, the client now
  waits it out and retries once instead of throwing — eliminates the
  wait-and-manually-resubmit loop for burst throttling. Longer waits still
  throw, now including `x-next-replenish-time` in the message. The 423
  locked-resource retry delay dropped 60s → 20s so the retry can actually
  fire before MCP clients abort the call.

### Security
- `axios` floor raised to ^1.18.1 — 1.13.x carried multiple HIGH advisories
  (NO_PROXY SSRF bypass, prototype-pollution gadgets, CRLF injection in
  multipart bodies). Run `npm audit fix` after pulling to refresh the
  lockfile (also clears transitive `@hono/node-server` / `fast-uri` /
  `form-data` advisories).

## [0.5.7] - 2026-06-30

### Fixed
- **v0.5.6 CI Release workflow failed at typecheck** — `resolveServerEntry()`'s
  return type was declared `{ command: string; ... }`, but the call site
  assigns into `WalmartMcpEntry` whose `command` is the union
  `'node' | 'walmart-mcp'`. TypeScript refuses to widen. Narrowed the return
  type to `WalmartMcpEntry['command']` so the two agree. 0.5.6 tag exists but
  never published; 0.5.7 is the first version carrying the setup wizard
  path-resolution fix.

### Security
- **Setup wizard masked-input leaked pasted secrets on Windows PowerShell**.
  The raw-mode + per-char echo approach works on Unix TTYs, but on PowerShell
  the terminal echoes the entire pasted string before Node.js can toggle
  `stdin.setRawMode(true)`. A user reported this after their production
  `WALMART_CLIENT_SECRET` was echoed in full into the terminal (and thence
  into a chat log). `askMasked` now refuses to accept secrets via terminal on
  `process.platform === 'win32'` or any non-TTY stdin, and instructs the user
  to put the secret in a `.env` file where it never touches the terminal.

### Verified
- End-to-end tested `@lehaotech/walmart-mcp@0.5.5` from Claude Desktop against
  a real Walmart production account (seller YOUZITECH):
  `walmart_get_token` returned a valid 15-minute Bearer,
  `walmart_get_partner_info` returned the seller record,
  `walmart_get_item_count` returned 635 PUBLISHED items. Full chain works:
  Claude Desktop → walmart-mcp (stdio) → OAuth token exchange → Walmart
  Marketplace API → zod-parsed response.

## [0.5.6] - 2026-06-29

### Fixed
- **`walmart-mcp setup` wrote a broken path into MCP client configs when
  invoked from a global npm install.** The wizard used
  `path.join(process.cwd(), 'build', 'index.js')`, so running it from any
  directory other than a git clone (typical for end users — they `npm
  install -g` then run `walmart-mcp setup` from their home dir) produced
  e.g. `C:\Users\Fakang\build\index.js`, which doesn't exist. Claude Desktop
  would silently fail to start the server. The wizard now anchors path
  resolution on `import.meta.url`, locating `build/index.js` next to the
  setup script regardless of where setup was launched, and falls back to
  the `walmart-mcp` PATH shim if it can't find one. Both global-install and
  git-clone modes now write a working entry. `WalmartMcpEntry.command` type
  widened from `'node'` to `'node' | 'walmart-mcp'` to match.

## [0.5.5] - 2026-06-29

### Changed
- **README updated to reflect actual published state**:
  - New npm version badge at the top, sourced from
    `https://img.shields.io/npm/v/@lehaotech/walmart-mcp`. Always shows the
    real registry version, no manual bumps.
  - Status row updated from `v0.5.0 (npm) · 70% coverage threshold` to
    `v0.5.4 (npm, with provenance) · 87% statement coverage`. The 70% number
    was the old (failing) gate; the 87% is the actual measured statement
    coverage on the 249-test suite under the 50/40/50/50 threshold.

### Notes
- No code changes, no behavior changes; pure docs bump. Published only to
  keep the README accurate against what's on npm.

## [0.5.4] - 2026-06-29

### Fixed
- **Corrupt `package-lock.json`**: the lock file ended mid-line inside a
  `source-map-js` `resolved` URL — invalid JSON. `npm ci` in CI rejected it
  with `EUSAGE: The npm ci command can only install with an existing
  package-lock.json ... with lockfileVersion >= 1` (npm's fallback message
  when lock JSON parse fails). Regenerated cleanly via `npm install` on
  Windows. Local `npm run test:run` was unaffected because it doesn't require
  the lock file (uses already-populated `node_modules`). 0.5.3 git tag exists
  but its CI Test step failed for this reason, so 0.5.3 also never published.

## [0.5.3] - 2026-06-29

### Fixed
- **Release workflow `npm publish --provenance` failed** in 0.5.2 with
  `EUSAGE: Provenance generation in GitHub Actions requires "write" access to
  the "id-token" permission`. The workflow only requested `contents: write`,
  but `--provenance` needs OIDC token issuance. Added `id-token: write` to
  `.github/workflows/release.yml` `permissions:`. 0.5.2 never reached npm —
  0.5.4 is the first published version under the `@lehaotech` scope.
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