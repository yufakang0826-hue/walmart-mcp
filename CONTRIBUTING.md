# Contributing to walmart-mcp

Thanks for considering a contribution. This MCP is meant to be the kind of
thing where AI agents can rely on Walmart calls Just Working — so the bar for
PRs is "the LLM that calls this should never be surprised."

## Quick start

```bash
git clone https://github.com/yufakang0826-hue/walmart-mcp.git
cd walmart-mcp
npm install
npm run typecheck
npm run test:run
npm run build
```

Run `walmart-mcp diagnose` from a freshly cloned checkout to verify your
local environment is healthy before touching code.

## Before opening a PR

These three commands MUST succeed locally:

```bash
npm run typecheck      # tsc --noEmit -> 0 errors
npm run test:run       # vitest run -> all green
npm run build          # tsc + tsc-alias -> build/ produced
```

CI runs the same three on every PR (Node 22 + 24 on Ubuntu, Node 22 on
Windows), plus coverage on Node 22 Ubuntu. PRs that drop coverage below the
configured threshold (70 % statements / branches / functions / lines) will
fail.

## Repo layout

```
src/
├── index.ts              # MCP server entry + subcommand dispatch
├── scripts/              # walmart-mcp setup | diagnose | future CLIs
├── api/                  # one folder per Walmart module (HTTP + per-API class)
│   └── client.ts         # marketplace HTTP client + interceptors
├── tools/
│   ├── index.ts          # tool dispatcher
│   └── definitions/      # one file per module's tool list (zod schemas)
└── utils/                # logger, rate-limiter, api-error, known-issues, ...
tests/                    # vitest tests (mirror src/ layout)
```

## Style and conventions

- **TypeScript strict mode** (see `tsconfig.json`). No `// @ts-ignore` without
  a comment explaining why.
- **Tool definitions live in `src/tools/definitions/<module>.ts`**. Each entry
  is `{ name, description, inputSchema: { fieldA: ZodType, ... } }`. The
  description gets passed to the LLM; write it like a tooltip, not a doc.
- **Write-tool inputs should be strict zod** with `.refine()` business rules
  reflecting the Walmart spec. The dispatcher in `src/index.ts` re-parses
  args through these schemas, so refinements actually run.
- **Known-issue endpoints** belong in `src/utils/known-issues.ts` with a
  `findKnownIssueHint`-matching entry. Keep the README "Known Issues" section
  in sync.
- **No new runtime dependencies** unless there's a strong reason — keeping
  the install footprint small is a feature. Dev deps (test/coverage helpers)
  are fine.

## Adding a new tool

1. Add the tool definition in `src/tools/definitions/<module>.ts` with a strict
   zod `inputSchema`.
2. Add a `case 'walmart_<name>':` in `src/tools/index.ts` that calls the
   corresponding API method.
3. If the underlying Walmart endpoint pattern is documented as broken /
   program-gated, add an entry to `src/utils/known-issues.ts` and the README
   table.
4. If the endpoint is one you expect agents to discover, add an entry to
   `src/utils/endpoint-catalog.ts` so `walmart_search_endpoints` finds it.
5. Add tests in `tests/tools/strict-schemas.test.ts` (for the schema) and the
   relevant `tests/api/` file (for the API dispatch).

## Sandbox testing

`npm run test:sandbox` exercises the live Walmart sandbox (or production if
you flip `WALMART_ENVIRONMENT`). It needs real credentials in `.env`. It
**skips gracefully** when credentials are absent so CI without secrets still
returns exit 0.

The `sandbox.yml` workflow runs this on a weekly cron (Monday 09:00 UTC) and
on `workflow_dispatch` so we catch Walmart-side regressions before users do.

## Releasing

Tag a `v*.*.*` push and `release.yml` will:

1. Verify the tag matches `package.json`'s version
2. Run typecheck + tests + build
3. Publish to npm with `--provenance --access public`
4. Cut a GitHub Release with auto-generated notes

Required GitHub secrets: `NPM_TOKEN` (automation token from npmjs.com).

## Commit messages

We don't enforce conventional commits, but a clear one-line subject + an
optional body explaining *why* is appreciated. Reference issues with
`#123` so they auto-link.

## Code of conduct

See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md). Briefly: be excellent to
each other.

## Security issues

Do NOT open a public issue for security vulnerabilities. See
[SECURITY.md](./SECURITY.md) for the responsible-disclosure process.
