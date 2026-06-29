# Security Policy

## Supported versions

Only the latest minor version receives security fixes. Patch releases
backport critical fixes to the previous minor for ~90 days.

| Version  | Supported |
| -------- | --------- |
| 0.5.x    | ✅ |
| 0.4.x    | ✅ (until 2026-09) |
| < 0.4    | ❌ |

## Reporting a vulnerability

**Do not open a public GitHub issue for security problems.**

Use one of these instead:

1. **GitHub Security Advisory** (preferred): https://github.com/yufakang0826-hue/walmart-mcp/security/advisories/new
2. Email the maintainer listed in `package.json` `author`.

Please include:

- A minimal reproduction or proof of concept
- The affected version (output of `walmart-mcp --version`)
- Your `walmart-mcp diagnose --export` output, with credentials removed
- Any logs (with secrets removed)

You should get an acknowledgment within 72 hours and a status update at
least weekly until the issue is resolved.

## Scope

In scope:

- Credential handling (env vars, `.env` file, MCP config writes)
- Auth/token flows (OAuth, Walmart Connect RSA signing)
- The HTTP client (retry, rate limiting, error handling)
- The setup wizard's config-file write (path traversal, JSON injection)

Out of scope:

- Vulnerabilities in Walmart's own API (report to Walmart instead)
- Issues that require a malicious MCP client (we trust the local client)
- Anything depending on a compromised local node_modules tree
- DoS via excessive concurrent requests (rate-limited by design)

## Disclosure timeline

- Day 0: report received
- Day 1-3: triage + acknowledgment
- Day 7-30: fix in a private branch, depending on severity
- Day 30: coordinated disclosure unless extended by mutual agreement
