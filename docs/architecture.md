# walmart-mcp Architecture

This doc explains the why behind the code organization. If you only need to
*use* the MCP server, skip to the README. If you're contributing or auditing,
this is the design rationale.

## TL;DR

walmart-mcp is a **hybrid wrapper + discovery** MCP server for Walmart's
Marketplace API. It has 128 hand-coded "wrapped" tools that LLMs use 90% of
the time, plus 2 "discovery" tools that cover the long tail. All calls go
through a single HTTP client with auth, retry, rate limiting, and error-
context injection.

```
┌──────────────────────────────────────────────────────────────────┐
│  AI client (Claude Desktop / Cursor / Cline / Continue / etc.)   │
│                                                                  │
│   Sends an MCP tool call:                                        │
│   { tool: "walmart_get_all_orders", args: {...} }                │
└────────────────────────┬─────────────────────────────────────────┘
                         │ stdio
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│  walmart-mcp (this server)                                       │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  src/index.ts — MCP server entry                            │ │
│  │   • Subcommand dispatch (server | setup | diagnose | ...)   │ │
│  │   • Tool registration (130 tools)                           │ │
│  │   • Per-call zod re-parse of args (refinements run here)    │ │
│  │   • Centralized error response (endpoint+tool+hint)         │ │
│  └────────────────────┬────────────────────────────────────────┘ │
│                       ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  src/tools/index.ts — Dispatcher                            │ │
│  │   • switch(toolName) routes to api.<module>.<method>(args)  │ │
│  │   • Two discovery cases: walmart_call_endpoint,             │ │
│  │     walmart_search_endpoints                                │ │
│  └────────────────────┬────────────────────────────────────────┘ │
│                       ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  src/api/* — API facade                                     │ │
│  │   • WalmartSellerApi composes 11 module clients             │ │
│  │   • All sit on top of WalmartApiClient (marketplace) or     │ │
│  │     WalmartAdClient (advertising, RSA-SHA256 signed)        │ │
│  └────────────────────┬────────────────────────────────────────┘ │
│                       ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  src/api/client.ts — HTTP pipeline                          │ │
│  │   • Request interceptor: token, headers, rate-limit gate    │ │
│  │   • Response interceptor:                                   │ │
│  │       401 -> refresh + retry once                           │ │
│  │       429 -> throw with retry-after                         │ │
│  │       423 -> sleep 60s + retry once                         │ │
│  │       5xx -> exponential backoff x3                         │ │
│  │       4xx -> WalmartApiError(endpoint, hint, details)       │ │
│  └────────────────────┬────────────────────────────────────────┘ │
└──────────────────────┼──────────────────────────────────────────┘
                       │ HTTPS
                       ▼
                 Walmart Marketplace API
```

## Wrapper vs Discovery — why both?

There are two schools of MCP design:

- **Wrapper school**: one MCP tool per remote API endpoint, with strict zod
  schemas. Pros: LLMs get type safety + business-rule validation before any
  call hits the network. Cons: every new Walmart endpoint requires hand-
  written code; specs drift; coverage gaps are real.

- **Discovery school**: a tiny set of meta-tools (`search`, `describe`,
  `call`) that expose any endpoint dynamically from an OpenAPI spec. Pros:
  always up to date, tiny codebase. Cons: every call costs the LLM 2-3
  tool roundtrips; no business-rule validation; LLMs make more mistakes.

walmart-mcp picks **hybrid**:

| Layer | Coverage | Schema strictness | LLM cost |
|---|---|---|---|
| **Wrapped (128 tools)** | The 90 % of seller workflows we know about | Strict — `.refine()` enforces Walmart business rules (promo < base, refunds negative, HTTPS webhooks, etc.) | 1 tool call |
| **Discovery (2 tools)** | The 10 % long tail — any Walmart endpoint, including ones we haven't shipped a wrapper for | Loose — `z.record(unknown)` body; LLM trusts Walmart for validation | 2-3 tool calls (`search_endpoints` → `call_endpoint`) |

Both layers share the same HTTP client, so retry / rate limiting / error
hints apply uniformly. The `walmart_search_endpoints` tool's response
always names the wrapped tool that already covers an endpoint, so LLMs
prefer wrapped over discovery whenever possible.

This is the same idea as Anthropic's mcp-builder guidance ("strict wrappers
on hot path, generic escape hatch for long tail").

## The error pipeline

When a Walmart API call returns 4xx/5xx, the LLM sees a structured payload
designed to help it self-correct:

```jsonc
{
  "error": "HTTP 404: <Walmart error description>",
  "status": 404,
  "endpoint": "GET /v3/insights/items/unpublished/counts",
  "tool": "walmart_get_unpublished_items",
  "hint": "Walmart's Aurora unpublished-item-service has been returning 404 since 2026-05. Use walmart_get_all_items + filter publishedStatus='UNPUBLISHED' client-side.",
  "isKnownIssue": true,
  "details": { "errors": [...] }    // raw Walmart body when present
}
```

The pipeline that builds this:

1. **`src/api/client.ts` response interceptor** catches the AxiosError,
   computes `endpoint = "METHOD path"`, and looks up a workaround hint via
   `findKnownIssueHint(method, path)` in `src/utils/known-issues.ts`.
2. **`WalmartApiError`** carries `status`, `details`, `endpoint`, `hint`.
3. **MCP dispatcher in `src/index.ts`** attaches the failing tool name
   (`error.tool = toolDef.name`) and serializes the payload via
   `error.toResponse()`.
4. **`isKnownIssue: true`** is set whenever a hint is present — LLMs use
   this flag to skip a futile retry and immediately fall back to the
   suggested workaround.

`src/utils/known-issues.ts` is the **single source of truth**. The README
"Known Issues" table is generated from the same intent (kept in sync by
PR review per CONTRIBUTING.md). If a Walmart endpoint regresses, add an
entry there and the hint propagates everywhere automatically.

## Schema design — three levels of strictness

Different tool inputs want different strictness:

| Strictness | Example | When to use |
|---|---|---|
| **Strict** `.strict()` | `walmart_submit_promo_price_feed` — five `.refine()`s enforcing promo < base, 4h lead time, ≤180 days, etc. | Walmart business rules we can encode reliably. Catches LLM errors before they reach the network. |
| **Passthrough** `.passthrough()` | `MP_ITEM` envelope — `Item.sku` required, attributes pass through | Per-attribute Walmart fields are product-type dependent (200+ possible fields). We gate the envelope, let Walmart validate the content. |
| **Loose** `z.record(z.string(), z.unknown())` | `walmart_submit_generic_feed`, `walmart_call_endpoint` body | Intentional escape hatches. Only 2 remain in the wrapped layer and 1 in discovery. |

Shared atoms live in `src/tools/definitions/shared-schemas.ts` (`SkuSchema`,
`MoneySchema`, `Iso8601UtcSchema`, etc.) so one definition propagates.

The dispatcher in `src/index.ts` runs `z.object(toolDef.inputSchema).parse(rawArgs)`
**before** the tool case dispatches, so refinements actually fire. ZodErrors
are returned as `{ error: "Input validation failed...", issues: [...] }` —
no stack traces, no Walmart API call wasted.

## Rate limiting + the `walmart_get_rate_budget` tool

Walmart Marketplace uses a per-endpoint token bucket. The server returns
`x-current-token-count` + `x-next-replenish-time` on every response.

`src/utils/rate-limiter.ts` does two things:

1. **Sliding-window throttle** (1000 req / 60s default) to prevent us from
   even getting close to Walmart's bucket cap.
2. **Server-headers cache** — caches the latest `x-current-token-count`
   and `x-next-replenish-time` so `walmart_get_rate_budget` can return a
   snapshot of both views.

There's no OAuth user-token flow in Walmart Marketplace (a common eBay-vs-
Walmart confusion). Rate limits scale with seller-account tier, not auth
scope. The `walmart_get_rate_budget` tool's response includes a note about
this so LLMs don't try to "upgrade auth" as a workaround.

## Subcommand binary

`walmart-mcp` is one binary that dispatches based on `process.argv[2]`:

```
walmart-mcp                 # default — start the MCP server over stdio
walmart-mcp setup           # interactive wizard (src/scripts/setup.ts)
walmart-mcp diagnose        # 7-step self-check (src/scripts/diagnose.ts)
walmart-mcp version         # print version
walmart-mcp help            # usage
```

Setup + diagnose are loaded via dynamic `import('./scripts/...')`, so MCP
server cold-start cost is zero — the wizard code only loads when invoked.

## Multi-MCP-client config

The setup wizard supports 7 clients. They share the
`{ mcpServers: { walmart: ... } }` shape, except **Zed**, which nests as
`{ mcp: { servers: { walmart: ... } } }`.

`src/scripts/client-configs.ts` centralizes:

- The OS-specific config path per client (`CLIENT_SPECS.resolvePath()`)
- The shape difference (`serverKey: 'mcpServers' | 'servers'`)
- The `writeWalmartEntry()` helper that backs up the original config,
  inserts/overwrites the `walmart` entry, and preserves unrelated entries

Adding a new client = one new `ClientSpec` entry in the array.

## Testing strategy

| Test type | File pattern | What it covers |
|---|---|---|
| Schema unit | `tests/tools/strict-schemas.test.ts`, `tests/tools/shared-schemas.test.ts` | Each `.refine()` business rule on a write tool, each shared atom |
| API module unit | `tests/api/<module>-api.test.ts` | Each API method calls the client with the right verb + path + body |
| Client integration | `tests/api/client-interceptor.test.ts` | 401 retry, 429 throw, 423 retry, 5xx exp backoff, endpoint+hint injection. Uses axios `adapter` override — no network. |
| Dispatcher | `tests/api/index-wrapper.test.ts` | zod re-parse fills defaults + emits structured ZodError |
| Util | `tests/utils/*.test.ts` | `formatWalmartError`, `findKnownIssueHint`, `searchEndpoints`, `RateLimiter.getStatus()`, etc. |
| Discovery | `tests/tools/discovery-schema.test.ts`, `tests/utils/endpoint-catalog.test.ts` | `walmart_call_endpoint` schema, catalog ranking |
| Setup | `tests/scripts/client-configs.test.ts` | Multi-client config write + backup + Zed nesting |
| Sandbox smoke | `test-sandbox.mjs` (run via `npm run test:sandbox`) | Live Walmart sandbox calls with schema assertions |

CI runs unit + integration on every PR (Node 22 + 24, Ubuntu + Windows).
The `sandbox.yml` workflow runs the live smoke weekly + on demand.

## Why no new runtime dependencies?

walmart-mcp is meant to install in ~2 seconds and run inside any MCP host.
Every dependency added is a supply-chain risk, a transitive load on the
install, and a thing to audit per release. The four areas where we'd
ordinarily reach for libs are handled in-tree:

- **Interactive prompts**: `node:readline/promises` instead of `enquirer`/`inquirer`.
- **Color output**: ANSI escape codes in a small `c.*` helper instead of `chalk`.
- **HTTP**: native `fetch` for the setup wizard's token validation;
  `axios` is already in the runtime stack for the marketplace + ad clients.
- **Schema-aware config write**: hand-rolled JSON in / out around the
  Claude Desktop / Cursor / etc. config files.

The dev dep tree is bigger (`vitest`, `@vitest/coverage-v8`, `typescript`,
`tsx`, `tsc-alias`, `@types/node`) but those don't ship to npm consumers.
