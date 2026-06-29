## What changed

<!-- One-paragraph summary. Link to the issue this PR resolves. -->

## Why

<!-- Motivation. Why this approach and not another. -->

## Checklist

- [ ] `npm run typecheck` passes (0 errors)
- [ ] `npm run test:run` passes locally
- [ ] `npm run build` succeeds
- [ ] If a new tool was added: definition is strict zod with `.refine()`s
      for any Walmart business rules
- [ ] If a Walmart endpoint regression was discovered: an entry was added
      to `src/utils/known-issues.ts` AND the README "Known Issues" table
- [ ] If the public API surface changed: CHANGELOG.md updated
- [ ] No new runtime dependencies (or PR justifies the addition)

## Reviewer notes

<!-- Any specific areas you'd like reviewers to focus on, or known caveats. -->
