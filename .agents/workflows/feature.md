# Feature Workflow

Use this workflow when introducing a new user-visible or system capability.

1. **Discover:** Read memory and applicable rules; define user outcome and acceptance criteria.
2. **Plan:** Map the smallest vertical slice across UI, API, data, security, and operations.
3. **Implement:** Follow `.agents/skills/feature/SKILL.md` and existing repository patterns.
4. **Test:** Add focused automated coverage and manually verify critical interactions when needed.
5. **Review:** Apply `.agents/skills/code-review/SKILL.md`; resolve correctness and security findings.
6. **Document:** Update public docs and durable memory only where verified facts changed.
7. **Handoff:** Summarize behavior, affected files, validation results, risks, and follow-up work.

For multi-agent execution, the planner defines the slice, the developer implements it, and the
reviewer independently checks the resulting diff. A single agent may perform all stages when the
task does not require delegation.
