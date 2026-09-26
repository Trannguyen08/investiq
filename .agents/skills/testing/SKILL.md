---
name: testing
description: Design, add, or improve automated tests and test infrastructure for existing behavior. Use when the main deliverable is test coverage or test reliability.
---

# Testing

Read `../../rules/testing.md` and the rules for the system under test.

Identify the contract and choose the cheapest test level that proves it. Cover important happy
paths, boundary values, permissions, and failure behavior. Reuse project fixtures and helpers;
add shared utilities only when they reduce real duplication without hiding intent.

Keep tests isolated and deterministic. Control clocks, randomness, network, and persistent state.
Use mocks at external boundaries, not as substitutes for testing internal behavior. When repairing
a flaky test, identify and remove the source of nondeterminism rather than increasing timeouts.

Run the new or changed tests and report the exact command and result.
