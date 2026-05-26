---
# `name` MUST equal this directory's name (kebab-case). The loader warns + skips on mismatch.
name: _template
# One line, English with Swedish domain terms quoted (e.g. "kravpunkter", "bevis", "styrdokument").
# Shown to the agent in the <available_skills> block (Story 19.7).
description: Authoring template — copy this folder, rename, and fill it in.
# Chat contexts this skill is the PRIMARY playbook for. [] = never auto-primary (reachable only via
# activate_skill). Story 19.7's buildSystemPrompt injects the primary skill for the active context.
contextTypes: []
# Tool names this skill's procedure needs. Story 19.7 narrows the tool registry to
# (always-available read tools) ∪ (these). Use exact ToolName strings, e.g. search_laws.
tools: []
---

# Skill: \_template

This is the authoring reference for a Laglig agent skill (principle #2: _skills are
files, not code_). The loader **skips `_`-prefixed folders**, so this template is
never loaded as a real skill.

To create a skill: copy this folder to `lib/agent/skills/<your-skill-name>/`, set
`name` to match the folder, and fill in the files below. Keep this SKILL.md body to a
short overview — the step-by-step belongs in `PROCEDURE.md`.
