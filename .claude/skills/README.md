# Agent Skills for this repo

Three project-specific Agent Skills that encode this repo's conventions so the agent applies
them without being re-told each prompt. They use the cross-tool **`SKILL.md`** open standard.

## Why skills (and not more lines in CLAUDE.md)
Skills use **progressive disclosure**: only each skill's `name` + `description` (~40 tokens)
stay in context. The full instructions load **only when a skill is triggered** by the task at
hand. So adding skills raises output quality *without* a standing per-prompt token cost — the
opposite of stuffing everything into an always-on rules file.

## The skills

**Build skills** (drive implementation from `planning/BUILD.md`):
| Skill | Triggers on |
|-------|-------------|
| `build-slice` | **the one you "activate" to build** — "build M3", "do the next slice", "continue the build". Runs a full vertical slice against the BUILD.md contracts. |
| `chess-app-conventions` | any app-code task — stack, `src/` import boundaries, the three laws, CI gates (rides along so even small prompts stay terse) |
| `engine-methodology-guard` | app code / `MethodologyConfig` / data models — the L1 deep-dive (science only in config) both build skills lean on |

**Research/honesty skills** (kept; mostly relevant while the methodology is being authored):
| Skill | Triggers on |
|-------|-------------|
| `evidence-grade` | any recommendation, copy string, methodology value, or research claim |
| `research-synthesis` | editing `research/*` reports or `planning/METHODOLOGY.md` |

**Terse-prompt examples** that now carry full context: *"build the next slice"* · *"do M5"* ·
*"add the ScheduleState model"* · *"wire the tracker router"*. The skill supplies the stack, the
`src/` boundaries, the three laws, the right `BUILD.md` sections to read, and the Definition of Done —
so you don't restate them.

## How the three tools read them (single source of truth)
The real content lives once in `.claude/skills/<name>/SKILL.md`. The others point at it:

- **Claude Code** → `.claude/skills/<name>/SKILL.md` (canonical, native auto-discovery).
- **Antigravity** → `.agents/skills/<name>` is a **symlink** to the canonical folder, so edits
  propagate automatically. (If your Antigravity build doesn't follow symlinks, replace each
  link with `cp -r ../../.claude/skills/<name> <name>`.)
- **Cursor** → `.cursor/rules/<name>.mdc` is an *Agent Requested* rule (`alwaysApply: false`):
  only its `description` is in context until the model decides it's relevant, then it pulls the
  canonical `SKILL.md` via the `@`-reference. Cursor has no native skill auto-discovery, so this
  rule shim is how skills reach it.

**To edit a skill:** change `.claude/skills/<name>/SKILL.md` only. Antigravity follows the
symlink; Cursor follows the `@`-reference. Keep the `.mdc` TL;DR in sync if you change the gist.

## Verify it's wired
- Claude Code: start a session here and run `/skills` (or check that the skill name appears in
  the available-skills list). Ask it to draft a methodology value and confirm it attaches a grade.
- Antigravity: `ls -lL .agents/skills/*/SKILL.md` should resolve to real files.
- Cursor: open Settings → Rules; the three project rules should be listed as "Agent Requested".

## Adding more skills from GitHub (e.g. `skill-creator`)
The genuinely useful generic one for a repo like this is an authoring helper. Install method
that works for all three tools (just drop a `SKILL.md` folder into the canonical dir):

```bash
# from the repo root
tmp=$(mktemp -d)
git clone --depth 1 https://github.com/anthropics/skills "$tmp"
cp -r "$tmp/skill-creator" .claude/skills/skill-creator      # adjust path if the repo nests it
ln -sfn ../../.claude/skills/skill-creator .agents/skills/skill-creator
rm -rf "$tmp"
# then add a .cursor/rules/skill-creator.mdc shim like the others (description + @-reference)
```

Convenience installers also exist (`npx skills add anthropics/skills` for the CLI;
`/plugin marketplace add anthropics/skills` then `/plugin install ...` inside Claude Code) — but
the manual copy above is tool-agnostic and avoids depending on a specific CLI.

**Browse for more:** VoltAgent/awesome-agent-skills, ComposioHQ/awesome-claude-skills,
hesreallyhim/awesome-claude-code. Most listed skills are code-centric (PDF/docx/security audits)
and add little to a planning/research repo — prefer authoring repo-specific skills (or use
`skill-creator` to do so) over installing generic ones you won't trigger.
