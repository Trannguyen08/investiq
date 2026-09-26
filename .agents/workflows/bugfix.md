# Bugfix Workflow

Use this workflow for unintended behavior in an existing capability.

1. **Reproduce:** Capture expected and actual behavior with the smallest reliable reproduction.
2. **Investigate:** Follow `.agents/skills/debugging/SKILL.md` to isolate the root cause.
3. **Guard:** Add a failing regression test when feasible.
4. **Fix:** Make the smallest complete correction and inspect adjacent paths for the same defect.
5. **Validate:** Run the regression test, related tests, lint or type checks, and relevant manual checks.
6. **Review:** Check for compatibility, security, data impact, and whether the fix masks a deeper issue.
7. **Handoff:** Report root cause, fix, test evidence, residual risk, and any operational action needed.

Do not close a bug solely because the symptom disappeared; the evidence must support the identified
root cause and the regression guard should exercise the failure when practical.
