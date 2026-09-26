---
name: debugging
description: Diagnose and fix reproducible defects using evidence, root-cause analysis, and regression coverage. Use for broken or unexpected existing behavior, not net-new features.
---

# Debugging

Start with the reported symptom and establish a minimal reproduction. Gather evidence from code,
tests, logs, and runtime state without modifying production data.

1. State expected versus actual behavior and narrow the failing boundary.
2. Form testable hypotheses and verify them one at a time; distinguish cause from correlation.
3. Trace the failure to its root cause before implementing a fix.
4. Add a regression test that fails for the original defect when feasible.
5. Apply the smallest complete fix and check adjacent paths for the same failure mode.
6. Run focused checks, then broader relevant checks, and document remaining uncertainty.

Do not suppress errors, loosen tests, or add retries unless they address the verified cause.
