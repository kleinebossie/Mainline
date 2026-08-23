---
name: ox-alpha
description: Orchestrate up to 10 parallel ox-alpha subagents with specialized roles for deep parallel work.
---

# Ox Alpha Subagents

Orchestrate up to 10 parallel `ox-alpha` subagents using OpenCode.

## Concurrency Pool

- Run a maximum of 10 active subagents at one time.
- Maintain a task queue when you have more than 10 tasks.
- If an active agent finishes, launch the next queued agent immediately.
- Use the model identifier `openrouter/stealth/ox-alpha`.

## CLI Execution Rule

Always supply the `--pure` flag:

```bash
opencode --pure run -m openrouter/stealth/ox-alpha "<role-specific prompt>"
```

The `--pure` flag avoids external platform credit checks. It also prevents title-generation stream errors.

## Execution Time and Wait Timers

`ox-alpha` performs deep reasoning and multi-step tool loops. It is slow.

- Set wait timers for 10 minutes or more (600 to 900 seconds).
- Do not poll task status in tight loops.
- Stop calling tools to wait for the timer or reactive system wakeup.

## Prompting Guidelines

1. **State the role clearly.** Assign distinct roles: Explorer, Implementer, Test Engineer, Code Reviewer, or Security Auditor.
2. **Require direct output.** Instruct the agent to provide its full report directly without interactive confirmation pauses.
3. **Protect the workspace.** Instruct agents to avoid leaving temporary test or scratch files in `src/` or `tests/`.

## Task Cleanup

After you collect reports from the subagents:

1. Terminate all remaining background tasks with the `manage_task` tool (`action: 'kill'`).
2. Remove any temporary files created during subagent audits.
3. Verify your working tree with `git status` before you run the test suite.
