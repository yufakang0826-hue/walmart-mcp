# walmart-mcp

[![CI](https://github.com/yufakang0826-hue/walmart-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/yufakang0826-hue/walmart-mcp/actions/workflows/ci.yml)
[![Release](https://github.com/yufakang0826-hue/walmart-mcp/actions/workflows/release.yml/badge.svg)](https://github.com/yufakang0826-hue/walmart-mcp/actions/workflows/release.yml)
[![codecov](https://codecov.io/gh/yufakang0826-hue/walmart-mcp/branch/master/graph/badge.svg)](https://codecov.io/gh/yufakang0826-hue/walmart-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-Model%20Context%20Protocol-blue.svg)](https://modelcontextprotocol.io/)
![Tools](https://img.shields.io/badge/tools-130-orange.svg)
![Tests](https://img.shields.io/badge/tests-249%20passing-success.svg)

```
                  _                       _                            
                 | |                     | |                           
 __      ____ _  | |_ __ ___   __ _ _ __ | |_ ______ _ __ ___   ___ _ __
 \ \ /\ / / _` | | | '_ ` _ \ / _` | '__|| __||_____| '_ ` _ \ / __| '_ \
  \ V  V / (_| | | | | | | | | (_| | |   | |_       | | | | | | (__| |_) |
   \_/\_/ \__,_| |_|_| |_| |_|\__,_|_|    \__|      |_| |_| |_|\___| .__/
                                                                   | |  
   AI-native Walmart Marketplace toolkit — 130 strict-zod tools     |_|  
   Discovery escape hatch · Token bucket monitor · Hint-driven errors
```

| | |
|---|---|
| **Install** | `npm install -g @yufakang0826-hue/walmart-mcp` |
| **Onboard** | `walmart-mcp setup` (7 MCP clients auto-detected) |
| **Self-check** | `walmart-mcp diagnose --export` |
| **Docs** | [Quick Start](#5-minute-quick-start) · [Tools](#modules) · [Known Issues](#known-issues) · [Contributing](./CONTRIBUTING.md) · [Architecture](./docs/architecture.md) |
| **Status** | v0.5.0 (npm) · 249 tests passing · 70% coverage threshold · 3 GitHub Actions workflows |
| **License** | MIT |

A Model Context Protocol (MCP) server for the Walmart Marketplace Seller API.
130 tools covering items, inventory, orders, pricing, fulfillment (WFS),
returns, reports, notifications, and advertising (Walmart Connect) — plus a
Discovery escape hatch that lets AI agents call any other Walmart endpoint
through the same auth + retry + rate-limit pipeline.

## 5-minute Quick Start

```bash
# 1. Install the published package
npm install -g @yufakang0826-hue/walmart-mcp

# 2. Run the interactive setup wizard. It will:
#    - ask for environment + market (sandbox / production, us / mx / ca / cl)
#    - take your Walmart Client ID + Secret (masked input)
#    - LIVE-VALIDATE the credentials by exchanging an OAuth token
#    - detect which MCP clients you have installed (Claude Desktop, Cursor,
#      Cline, Continue.dev, Windsurf, Zed, Claude Code CLI) and write the
#      walmart MCP entry into each one you pick — with automatic backup
walmart-mcp setup

# 3. Restart your AI client. Try a prompt like:
#    "Show me my recent Walmart orders"
```

If something does not work, run the built-in self-check:

```bash
walmart-mcp diagnose            # 7-step health check
walmart-mcp diagnose --export   # also dumps walmart-mcp-diagnose.json for bug reports
```

Other subcommands: `walmart-mcp version`, `walmart-mcp help`.

## Features

- **130 tools** across 13 modules (items / inventory / orders / pricing /
  fulfillment / returns / reports / notifications / advertising / settings
  / token / discovery)
- **Strict zod schemas on every write tool**: 54 write tools enforce Walmart
  business rules (promo < base, `effectiveDate >= now + 4h`, refunds must be
  negative, subscription URLs must be HTTPS, etc.) BEFORE the API call so
  LLMs get structured validation errors and self-correct without burning
  Walmart API quota.
- **LLM-friendly error responses**: every 4xx/5xx carries `endpoint`, `tool`,
  and (for documented broken Walmart endpoints) a `hint` field with the
  workaround the LLM should try next — backed by a single source of truth
  `src/utils/known-issues.ts` mirrored into this README.
- **Token refresh, rate limiting, and retry built in**: 15-minute OAuth Bearer
  auto-refresh, sliding-window throttle, 401 (refresh + retry once), 429
  (rate-limit error with `retry-after`), 423 (resource lock retry), and
  5xx (exponential backoff up to 3 retries).
- **Rate budget monitor**: `walmart_get_rate_budget` returns the local
  sliding-window state plus the latest Walmart-server-reported token bucket
  (`x-current-token-count` + `x-next-replenish-time`).
- **Discovery escape hatch**: `walmart_call_endpoint` + `walmart_search_endpoints`
  cover the long tail. Same auth / retry / rate-limit pipeline as wrapped tools.
- **CI + sandbox + release workflows**: typecheck + tests run on every PR
  (Node 22 + 24, Ubuntu + Windows); tag pushes auto-publish to npm with
  provenance; weekly cron hits the real Walmart sandbox.

## Modules

| Module | Tools | Description |
|--------|-------|-------------|
| Token Management | 7 | Credentials, token lifecycle, setup guide, rate budget |
| Items | 12 | CRUD, taxonomy, feeds, WFS conversion |
| Inventory | 10 | Single/multi-node, lag time, feeds |
| Orders | 10 | Fulfill, ship, cancel, refund, labels |
| Pricing | 10 | Price updates, repricer strategies |
| Feeds | 5 | Submit, poll, status tracking |
| WFS Fulfillment | 19 | Inbound shipments, MCS, carrier booking |
| Returns | 8 | Approve, reject, refund, labels |
| Reports | 12 | On-demand, scheduled, listing quality |
| Notifications | 6 | Webhook subscriptions |
| Advertising | 25 | Campaigns, keywords, bids, analytics |
| Settings | 4 | Shipping, fulfillment centers, partner |
| **Discovery** | **2** | **`walmart_call_endpoint` + `walmart_search_endpoints`** |

## Installation

### From npm (recommended)

```bash
npm install -g @yufakang0826-hue/walmart-mcp
```

The unscoped name `walmart-mcp` on npm belongs to a different author. Use the
scoped package above.

### From source

```bash
git clone https://github.com/yufakang0826-hue/walmart-mcp.git
cd walmart-mcp
npm install
npm run build
```

## Configuration

The simplest path is `walmart-mcp setup` — it writes the MCP config for you and
validates credentials against Walmart before saving.

If you want to configure manually, the entry looks like:

```jsonc
{
  "mcpServers": {
    "walmart": {
      "type": "stdio",
      "command": "walmart-mcp",
      "env": {
        "WALMART_CLIENT_ID": "your-client-id",
        "WALMART_CLIENT_SECRET": "your-client-secret",
        "WALMART_ENVIRONMENT": "sandbox",
        "WALMART_MARKET": "us"
      }
    }
  }
}
```

Setup wizard auto-detects these locations:

| Client | Config path |
|---|---|
| Claude Desktop (macOS) | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Claude Desktop (Windows) | `%APPDATA%/Claude/claude_desktop_config.json` |
| Claude Desktop (Linux) | `~/.config/Claude/claude_desktop_config.json` |
| Claude Code CLI | `~/.claude.json` |
| Cursor | `~/.cursor/mcp.json` |
| Cline (VSCode) | `~/.../globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json` |
| Continue.dev | `~/.continue/config.json` |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| Zed | OS-dependent, with `mcp.servers` nesting |

### Environment Variables

```bash
# Required — Marketplace API
WALMART_CLIENT_ID=your-client-id
WALMART_CLIENT_SECRET=your-client-secret

# Optional (defaults shown)
WALMART_ENVIRONMENT=sandbox        # sandbox | production
WALMART_MARKET=us                  # us | mx | ca | cl
WALMART_SVC_NAME=Walmart Marketplace

# Optional — Advertising (Walmart Connect)
WALMART_AD_CONSUMER_ID=your-ad-consumer-id
WALMART_AD_PRIVATE_KEY=your-private-key
WALMART_AD_KEY_VERSION=1

# Logging
WALMART_LOG_LEVEL=info             # error | warn | info | http | debug
WALMART_ENABLE_FILE_LOGGING=false
```

## Getting Walmart API Credentials

1. Sign up at [Walmart Developer Portal](https://developer.walmart.com/)
2. Create a new application under **Marketplace**
3. Copy the **Client ID** and **Client Secret**
4. For advertising, apply for [Walmart Connect](https://www.walmartconnect.com/) access

## Usage Examples

```
"Get all my Walmart orders from the last 7 days"
→ walmart_get_all_orders({ createdStartDate, createdEndDate })

"Update inventory for SKU ABC-123 to 50 units"
→ walmart_update_inventory({ sku, quantity })

"Submit a 7-day 20% promo on SKU XYZ starting tomorrow"
→ walmart_submit_promo_price_feed({ feedData: { ... } })
  (zod refinements enforce promo<base, >=4h lead, <=180 days, etc.)

"What is my current Walmart rate-limit budget?"
→ walmart_get_rate_budget()
  { localRemaining: 996, serverTokensRemaining: 18,
    serverReplenishTime: "2026-06-29T15:30:00Z", ... }

"Find the right Walmart tool for downloading a settlement report"
→ walmart_search_endpoints({ query: "settlement report" })
  [{ wrappedTool: "walmart_create_report", signature: "POST /v3/reports/reportRequests", ... }]

"Call GET /v3/items/walmart-item/<wpid>" (no wrapped tool yet)
→ walmart_call_endpoint({ method: "GET", path: "/v3/items/walmart-item/123" })
```

## Development

```bash
npm run build           # tsc + tsc-alias -> build/
npm run dev             # tsx src/index.ts (no build step)
npm run typecheck       # tsc --noEmit
npm run inspect         # MCP Inspector against built bin
npm test                # vitest watch
npm run test:run        # vitest single run (CI)
npm run test:sandbox    # real Walmart sandbox smoke (skips when no creds)
```

The unit suite covers the tool dispatcher, every API module, the RSA-SHA256
advertising signature, the sliding-window rate limiter, the zod schemas (atom
+ business-rule refinements), the API client's response interceptor (401 / 429
/ 423 / 5xx retry + endpoint/hint injection), the known-issues lookup, the
endpoint catalog search, the multi-client config write, and the dispatcher's
zod re-parse path.

`test:sandbox` exercises ~15 read-only calls (token, partner info, items,
orders, returns, feeds, pricing strategies, listing quality, rate budget,
endpoint search) end-to-end. It requires real credentials and **skips
gracefully** (exit 0) when they are absent, so it is safe to run in CI.

The `sandbox.yml` workflow runs this weekly on a cron + on `workflow_dispatch`,
using repo secrets `WALMART_CLIENT_ID` / `WALMART_CLIENT_SECRET` (+ optional
Ads creds).

## Architecture

```
src/
├── index.ts                              # MCP server entry + subcommand dispatch
├── scripts/
│   ├── diagnose.ts                       # walmart-mcp diagnose (7-step self-check)
│   ├── setup.ts                          # walmart-mcp setup (interactive wizard)
│   └── client-configs.ts                 # 7 MCP client config paths + write helper
├── config/environment.ts                 # Config & env vars
├── auth/oauth.ts                         # OAuth 2.0 token management
├── utils/
│   ├── logger.ts                         # Winston logger (stderr only)
│   ├── rate-limiter.ts                   # Sliding-window + getStatus() snapshot
│   ├── api-error.ts                      # WalmartApiError w/ endpoint+tool+hint
│   ├── known-issues.ts                   # Lookup table for hint injection
│   ├── endpoint-catalog.ts               # 40+ entries for walmart_search_endpoints
│   └── env-file.ts                       # .env upsert helper
├── api/
│   ├── client.ts                         # Marketplace HTTP client + interceptors
│   ├── index.ts                          # API facade (WalmartSellerApi)
│   ├── advertising/                      # RSA-SHA256 signed Ads client + 25 methods
│   └── (items|inventory|orders|pricing|feeds|fulfillment|returns|reports|notifications|settings)/
└── tools/
    ├── index.ts                          # Tool registry + dispatcher
    └── definitions/
        ├── shared-schemas.ts             # 9 atomic zod schemas reused across modules
        ├── discovery.ts                  # walmart_call_endpoint + walmart_search_endpoints
        └── <module>.ts                   # 12 per-module wrapped tools
```

## Known Issues

This MCP wraps Walmart's public Marketplace API. A handful of tools surface
known limitations from Walmart's side (broken endpoints, programs you have
not enrolled in) rather than MCP-side bugs. The tools are kept in place for
forward compatibility and will work once Walmart restores the endpoint or
you enroll in the program.

When these endpoints fail, the MCP error response includes a `hint` field
pointing the LLM at the recommended workaround. The complete list is
maintained in `src/utils/known-issues.ts` (single source of truth).

### Walmart-side endpoint regressions

| Tool | Symptom | Workaround |
| --- | --- | --- |
| `walmart_get_unpublished_items` | HTTP 404 from Insights `/v3/insights/items/unpublished/counts` (Aurora backend regression since 2026-05) | `walmart_get_all_items` + filter on `publishedStatus = "UNPUBLISHED"` client-side |
| `walmart_get_quality_categories` | HTTP 404 from Insights API | None — endpoint removed. Use `walmart_get_item_quality_details` per SKU when fixed. |
| `walmart_get_item_quality_details` | HTTP 405 Method Not Allowed | None right now — endpoint signature changed |
| `walmart_get_return_count` | HTTP 404 | Compute client-side from `walmart_get_all_returns`, group by `status` |
| `walmart_get_shipping_settings` | HTTP 404 | Check Seller Center settings UI manually |

### Requires seller-program enrollment

| Tool group | Requires |
| --- | --- |
| `walmart_*_repricer_*` | Walmart Repricer enrollment (Pro Seller badge usually required) |
| `walmart_ad_*` (25 tools) | Walmart Connect — set `WALMART_AD_CONSUMER_ID` + `WALMART_AD_PRIVATE_KEY` |
| `walmart_*_wfs_*` / `walmart_create_inbound_order` / `walmart_get_fulfillment_centers` etc. | Walmart Fulfillment Services (WFS) enrollment |

### Behavior to be aware of

| Tool | Note |
| --- | --- |
| `walmart_get_wfs_returns` | Sends the documented `GET /v3/returns?isWFSEnabled=Y` call. For sellers **without** WFS enrollment, Walmart returns the unfiltered return set (same data as `walmart_get_all_returns`). Upstream behavior, not an MCP defect. |

### Region restrictions

Walmart's Insights API (which `walmart_get_listing_quality` is built on) is
US-Marketplace exclusive. Setting `WALMART_MARKET=mx|ca|cl` will surface a
Walmart 404 on these calls; switch back to `us` to use them.

If you hit something that is not on this list, open an issue with the tool
name, the arguments, and the full error response (`walmart-mcp diagnose
--export` produces a JSON dump suited for attachments).

## Contributing

PRs welcome. Before opening:

1. `npm run typecheck && npm run test:run && npm run build` must all pass.
2. New tools should follow the strict-zod-schema pattern in
   `src/tools/definitions/<module>.ts`. The dispatcher (`src/tools/index.ts`)
   re-parses args through the schema before calling the API layer.
3. Walmart-side regressions belong in `src/utils/known-issues.ts` with a
   matching workaround hint — keep this file aligned with the README "Known
   Issues" section.

## License

MIT
