---
name: code-review
description: Review a proposed code change for correctness, regressions, security, maintainability, and missing tests. Use when asked to review a diff, branch, commit, or patch.
---

# Code Review

Review the actual diff and enough surrounding code to understand its contracts. Consult applicable
rules and architecture memory, but treat executable behavior as the primary evidence.

Prioritize findings that could cause incorrect behavior, security issues, data loss, broken public
contracts, operational failures, or missing regression coverage. For each finding, state the impact,
the triggering conditions, and a precise file and line reference. Avoid style-only findings already
enforced by tooling.

List findings in descending severity. If no findings remain, say so and note any validation gaps or
residual risks. Do not modify code unless the request explicitly includes fixes.
