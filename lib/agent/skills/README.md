# Agent skills

Self-hosted domain playbooks for the compliance agent (Epic 19, Skills track).
**Principle #2: skills are files, not code** — a PM/consultant can edit a procedure
without a deploy.

## What a skill is

A **skill is a subdirectory** of `lib/agent/skills/` containing:

| File            | Required | Purpose                                                                                                                                                                       |
| --------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SKILL.md`      | **yes**  | YAML frontmatter (identity + activation + tool whitelist) + a short overview body.                                                                                            |
| `PROCEDURE.md`  | no       | The step-by-step playbook (English).                                                                                                                                          |
| `STYLE.md`      | no       | Tone + Swedish exemplars (bilingual).                                                                                                                                         |
| `CRITERIA.md`   | no       | Guardrails / currency + must-cite checks.                                                                                                                                     |
| `types/*.md`    | no       | Per-type modules (Story 19.8) — appended under a `## Type modules` section as `### Type: <stem>`. Stem = lower-cased enum value (`risk_assessment.md` for `RISK_ASSESSMENT`). |
| `examples/*.md` | no       | Worked examples.                                                                                                                                                              |

See [`_template/`](./_template/) for the authoring reference (copy it, rename, fill in).

### SKILL.md frontmatter

```yaml
name: <kebab-case; MUST equal the directory name>
description: <one line, English with Swedish domain terms quoted>
contextTypes: [change] # chat contexts this skill is PRIMARY for; [] = never auto-primary
tools: [search_laws, get_change_details] # ToolNames the procedure needs
```

## Loader rules (`lib/agent/skill-loader.ts`, Story 19.6)

- Only **subdirectories containing a `SKILL.md`** are skills. Loose files (e.g.
  `generate-law-list.ts`) are ignored.
- **`_`-prefixed directories are skipped** (templates/examples like `_template/`).
- A skill whose frontmatter fails validation, or whose `name` ≠ directory, is
  **skipped with a `console.warn`** (one bad skill never breaks the rest).
- Skills are read + validated **once per process** (deploy-static).

## Bilingual rule (principle #5)

`PROCEDURE.md` is **English**; `STYLE.md` exemplars are **Swedish**; `description`
is English with Swedish domain terms quoted. (A CI lint to enforce this lands with
the first real skills in Story 19.7.)

## Integration

Story 19.6 ships only the convention + the loader library. The agent wiring —
context-primary injection in `buildSystemPrompt`, the `activate_skill` meta-tool, and
per-skill tool-registry narrowing in `createAgentTools` — plus the first real skills
(`assess_change`, `gap_analysis`) land in **Story 19.7**.
