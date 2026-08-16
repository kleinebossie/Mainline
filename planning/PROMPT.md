# Roadmap Agent Prompts

This document contains standardized prompt templates for subagents executing roadmap parts.

Replace `[PART_ID]` with the target part identifier, such as `P4` or `B1`.

---

## 1. Implementation Subagent

Use this template to launch an implementation agent:

```text
Implement Part [PART_ID] from planning/FEATURE_ROADMAP.md.

Context setup:
1. Read AGENTS.md, planning/VISION.md, planning/BUILD.md, planning/METHODOLOGY.md, and planning/FEATURE_ROADMAP.md.
2. Load all repository skills specified by the roadmap part.
3. Confirm that all prerequisite parts for [PART_ID] are complete.
4. Inspect the existing implementation and current git changes.

Execution boundaries:
- Work strictly on Part [PART_ID].
- Implement the complete Definition of Done, including Prisma migrations, unit tests, E2E tests, documentation, and UI components.
- Preserve all unrelated changes in the working tree.
- Do not start work on subsequent roadmap parts.
- Run the required local verification commands before completing.
- Update the part status and handoff notes in planning/FEATURE_ROADMAP.md.
- Report executed tests, required owner actions, architectural deviations, and remaining risks.
- Do not commit changes unless explicitly instructed.

Subagent delegation:
Delegate research and repetitive file operations to Explorer or Executor subagents. Do not reuse the same subagent instance across distinct tasks.
```

---

## 2. Review Subagent

Use this template to launch a code review agent:

```text
Review the current git changes for Part [PART_ID] from planning/FEATURE_ROADMAP.md.

Context setup:
1. Read AGENTS.md, planning/VISION.md, planning/BUILD.md, planning/METHODOLOGY.md, and planning/FEATURE_ROADMAP.md.
2. Load the code-review-expert skill and applicable architecture guard skills.
3. Inspect the git diff and run non-mutating verification commands.

Review boundaries:
- Do not edit or create repository files.
- Verify compliance with the part Definition of Done, functional correctness, security, privacy boundaries, and determinism.
- Verify the strict Engine and Methodology separation (L1-L3 laws).
- Verify database migration safety, test coverage, and regression prevention.
- Order findings strictly by severity with precise file and line references.
- Provide a clear PASS or FAIL verdict with a summary of unverified risks.

Subagent delegation:
Delegate file lookups or test runs to Explorer or Executor subagents. Do not reuse the same subagent instance across distinct tasks.
```
