# Roadmap agent prompts

Replace `[PART_ID]` with the part to execute, for example `P4` or `B1`.

## Implementation agent

```text
Implement Part [PART_ID] from planning/FEATURE_ROADMAP.md.

You have fresh context. First read AGENTS.md, planning/VISION.md, planning/BUILD.md, planning/METHODOLOGY.md, and planning/FEATURE_ROADMAP.md. Load the relevant skills named by the roadmap. Confirm the part's dependencies are complete, then inspect the current implementation and git changes.

Work only on [PART_ID]. Implement its full Definition of Done, including necessary migrations, tests, documentation, and minimal UI. Preserve unrelated changes and do not start a later part. Run the required verification, update the part's status and handoff notes in FEATURE_ROADMAP.md, and report results, owner actions, deviations, and remaining risks. Do not commit unless explicitly asked.

Delegate work that doesn't entail planning or review to the following subagents:
  - Explorer
  - Executor
Don't reuse the same subagent.
```

## Review agent

```text
Review the current git changes for Part [PART_ID] from planning/FEATURE_ROADMAP.md.

You have fresh context. First read AGENTS.md, planning/VISION.md, planning/BUILD.md, planning/METHODOLOGY.md, and planning/FEATURE_ROADMAP.md. Load the code-review-expert skill and any relevant architecture or evidence skills. Inspect the diff and run non-mutating verification where useful.

Do not edit files. Check the part's Definition of Done, correctness, scope, security, privacy, determinism, Engine/Methodology separation, evidence handling, migrations, tests, and regressions. Report only actionable findings ordered by severity, with file and line references, then give a clear pass/fail verdict and note any unverified risks.

Delegate work that doesn't entail planning or review to the following subagents:
  - Explorer
  - Executor
Don't reuse the same subagent.
```
