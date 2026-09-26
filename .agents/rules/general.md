# General Engineering Rules

These rules apply to every code or configuration change.

## Scope and design

- Inspect the affected code, tests, manifests, and nearby conventions before editing.
- Make the smallest complete change that satisfies the behavior; do not bundle cleanup or
  speculative abstractions.
- Preserve the Clean Architecture dependency direction recorded in
  `.agents/memory/architecture.md`.
- Prefer standard-library, platform, and existing-project capabilities before adding a dependency.
- Keep one authoritative source for each fact. Derive values instead of synchronizing copies.
- Avoid hidden global mutable state, cyclic imports, and abstractions with no concrete consumer.
- Preserve unrelated user changes and public contracts unless the task explicitly changes them.

## Code quality

- Use explicit types at module and trust boundaries. Do not use `Any`, unsafe casts, or disabled
  checks to conceal an uncertain shape.
- Follow ecosystem naming: Python modules/functions use `snake_case`; Python classes and
  TypeScript types/components use `PascalCase`; TypeScript values use `camelCase`.
- Keep side effects visible, functions cohesive, and dependency construction at composition roots.
- Handle expected failures deliberately. Never swallow an exception or continue from unknown state.
- Comments explain intent, invariants, or constraints; remove comments that only narrate the code.
- Remove dead code and unused dependencies introduced by the change. Do not retain commented-out code.
- Never hand-edit generated artifacts; change their source and regenerate them.

## Evidence and completion

- Define the observable acceptance condition before implementation.
- Run the narrowest check that can fail for the changed behavior, then broader applicable checks.
- A bug fix should include a regression test that fails without the fix when practical.
- Do not claim a command, test, migration, or deployment succeeded without reading its result.
- Report skipped checks, environmental limits, and residual risk explicitly.
- Follow `project-structure.md` whenever paths or boundaries change; synchronized documentation,
  imports, configuration, scripts, and tests are part of the same task.
