---
name: feature
description: Implement a new product capability or extend existing behavior from requirements through focused validation. Use for feature work; use debugging for unintended existing behavior.
---

# Feature Development

Read `../../memory/project.md`, `../../memory/architecture.md`, and the applicable rules before
editing. If requirements are ambiguous, resolve only ambiguities that materially change the
public behavior or architecture.

1. Identify the user outcome, acceptance criteria, affected boundaries, and existing patterns.
2. Plan the smallest vertical slice, including data, API, UI, security, and migration impact.
3. Implement in focused changes while preserving existing public contracts.
4. Add tests at the lowest level that gives meaningful confidence, plus regression coverage for
   affected behavior.
5. Run relevant checks and review the diff for scope, error handling, accessibility, and secrets.
6. Update documentation, architectural decisions, and current-task memory when facts changed.

Do not introduce speculative infrastructure or abstractions for hypothetical future features.
