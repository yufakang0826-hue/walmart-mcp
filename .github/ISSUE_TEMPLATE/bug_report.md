---
name: Bug report
about: A walmart-mcp tool misbehaves, returns wrong data, or fails to install
labels: bug
---

## What happened?

<!-- A clear description of the bug. -->

## What did you expect?

<!-- What the tool should have done. -->

## Reproduction

Steps to reproduce in your AI client:

1. ...
2. ...
3. ...

If you can reproduce on the command line, even better:

```bash
walmart-mcp diagnose --export
# Attach the resulting walmart-mcp-diagnose.json (REMOVE CREDENTIALS first).
```

## Environment

- walmart-mcp version (`walmart-mcp version`): `vX.Y.Z`
- Node version (`node --version`): `vXX`
- OS: macOS / Windows / Linux
- AI client: Claude Desktop / Cursor / Cline / Continue / Windsurf / Zed / Claude Code CLI / other
- `WALMART_ENVIRONMENT`: sandbox / production
- `WALMART_MARKET`: us / mx / ca / cl

## Logs / error output

```
paste here
```

## Have you checked README "Known Issues"?

- [ ] Yes, the failing tool / endpoint is not in the Known Issues section.
- [ ] No, I should check before reporting.
