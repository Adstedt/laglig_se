# Story Brief: Self-Improving / Auto-Learning Agent System

## For: Scrum Master (Bob) / Product Owner

## From: Architect

## Date: 2026-06-13

---

## Executive Summary

The agent today has **no learning loop**. The model doesn't fine-tune on our workspace or "remember" across sessions. The skill files (PROCEDURE/STYLE/types) are static until a human edits them. So current "improvement" = better context fed in, not a smarter model adapting to us — depth of retrieval, not depth of training.

This brief captures whether — and how — we can make the system genuinely self-improving. **Conclusion: yes, but as a data/retrieval/eval loop with human commit gates, not by fine-tuning model weights.** For a Swedish legal-compliance product, the human gate is a feature, not a limitation: every change must be auditable, reversible, and explainable to a regulator.

---

## Problem Statement

- The agent drafts a styrdokument or runs a compliance cycle, and the outcome evaporates. Expert edits and rejections are not captured.
- Workspace-specific conventions, recurring corrections, and company-profile context are not carried between sessions.
- Procedure/style/type knowledge only improves when a human manually rewrites a skill file.
- There is no way to measure whether any change actually improves output quality.

---

## Framing: Two Meanings of "Self-Improving"

| Goal | Who owns it | Verdict |
| ---- | ----------- | ------- |
| **(a) The model gets smarter at our domain** (fine-tune weights) | Not us — we call Claude (Opus/Fable) over the API; there is **no customer fine-tuning surface** for these models | **Wrong target.** The only fine-tunable models are much smaller open models; swapping the main legal-reasoning agent down to one would be a major capability regression. |
| **(b) The system gets better at retrieval, context, and procedure** | Us, completely | **Right target.** This is what frontier agent systems actually do when they "learn." Auditable, instantly reversible, explainable — exactly what a compliance product needs. |

---

## Proposed Solution — Cheapest → Deepest

### 1. Capture the feedback signal (foundation — do first)

Log every agent action with its fate: accepted as-is, edited (**with the diff**), or rejected. The edit-diff stream is the single most valuable asset — it's a continuous record of "what the expert actually wanted." Nothing downstream can learn without it.

### 2. Dynamic few-shot from our own good outputs

Build a retrieval index over accepted / expert-edited drafts. When drafting a new document, retrieve the 2–3 closest accepted examples for that document type / industry and inject them into context. Highest-leverage, lowest-risk move. (RAG over our **outputs**, not the source law.)

### 3. Persistent memory across sessions

Use first-class primitives:
- **Memory tool** — a `/memories` directory the model reads/writes.
- **Memory Stores** (managed agents) — workspace-scoped, persistent, **versioned with full audit trail + redaction**.

Carries workspace conventions, recurring corrections, and company-profile context between sessions. Versioning matters here: we need to know exactly what the agent "knew" when it produced a given document.

### 4. Self-editing skill files — with a human gate (the actual learning loop)

A meta-process periodically reads accumulated edit-diffs and rejections, clusters them (e.g. "the agent keeps framing hotell egenkontroll wrong"), and **proposes** edits to PROCEDURE/STYLE/types. A human approves or rejects. Skill files improve continuously, but a person is always the commit gate — no unbounded autonomous system rewriting legal procedures.

### 5. Prompt / procedure optimization against an eval set

Generate candidate procedure variants, score on the eval set, keep the winner. "Self-improvement" in the real ML sense — operating on prompts and retrieved context instead of weights.

### 6. Narrow fine-tuning, only where it fits

The one place real fine-tuning earns its keep: small, well-defined sub-tasks — request routing to the right document type, classifying a law change's relevance, structured field extraction. A cheap fine-tuned classifier can beat a Claude call on cost/latency there, while the main reasoning agent stays on Opus. **Don't fine-tune the agent; fine-tune the plumbing.**

---

## The Enabler: Evals

You cannot improve what you can't measure, and a self-improving loop with no eval is just a system that drifts. Build a regression set from real, expert-graded cases (a few dozen to start, drawn from the feedback log in #1). **Every proposed change — new few-shot strategy, self-edited procedure, prompt tweak — is scored against the eval set before it ships.** This is the line between "self-improving" and "self-drifting."

---

## Recommended Sequencing (laglig.se)

Keep a human in **every** commit gate.

1. Feedback / edit-diff logging (foundation)
2. Eval set from graded real cases (the ruler)
3. Dynamic few-shot over accepted outputs (biggest immediate quality jump)
4. Versioned memory for workspace conventions
5. LLM-proposes-skill-edits → human approves (the actual learning loop)

Steps 1–3 are mostly engineering, can start now, and visibly improve draft quality. Steps 4–5 are where it becomes "self-learning" in the true sense — gated by an expert who ratifies each improvement.

---

## Key Principle / Risk Guardrail

A fully autonomous loop that silently rewrites how the agent reasons about Swedish law is exactly what we **don't** want in this domain. A loop that *proposes* improvements an expert ratifies is what we **do** want. Human-in-the-loop is the safety boundary and the audit story simultaneously.

---

## Open Questions

1. Where does the feedback / edit-diff log live (data model, retention, PII handling)? Compliance edits may contain sensitive company data.
2. Who owns the eval set and the grading rubric — and how do we keep it current as Swedish law changes?
3. Memory tool (client-side `/memories`) vs. managed Memory Stores (versioned, server-side) — which fits our hosting model?
4. For the self-edit loop, what's the review cadence and who is the approver (juridik vs. eng)?

---

## Next Steps (suggested)

- Sketch the data model for the feedback / edit-diff log.
- Review current PROCEDURE/STYLE/types skill file structure to identify where the self-edit loop would hook in.

---

## Reference

- Source: strategy discussion, 2026-06-13 (agent quality / learning loop)
- Related: company profile interview tool (future), quota/usage tracking
