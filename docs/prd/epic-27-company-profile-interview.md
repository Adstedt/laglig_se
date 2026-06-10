# Epic 27: Company Profile Interview — Brownfield Enhancement

**Goal:** Make the company profile — specifically `business_description`, `activity_flags`, and `contextual_answers` — the strongest input to law-list generation by (1) upgrading the existing LLM company analyzer from a one-line summary to a structured, confidence-scored profile draft, (2) surfacing that draft as an **editable "Så här förstår vi er verksamhet" card** in the onboarding wizard, and (3) replacing the static activity-question checklist with a short **adaptive micro-interview** (2–4 questions selected by confidence × legal impact) that harvests the facts no public source contains.

**Value Delivered:** A controlled model A/B on a real workspace (Ekens Golv AB, 2026-06-10) demonstrated that `business_description` is the single highest-leverage input to generation quality: the retail half of the company's law list (~10 laws — Konsumentköplagen, producentansvar, CE-märkning, KIFS butiksförvaring, m.fl.) traces to one clause of one sentence that exists nowhere else in the profile. Today that sentence is produced by an LLM analyzer the user never sees, is capped to one line by the analyzer prompt, is silently dropped on a race condition in the onboarding form, and two of its sibling fields (`contextual_answers`, `has_collective_agreement`) never reach the generation agent at all. The generated laglista is the product's first "wow" moment; this epic makes its primary input user-verified, comprehensive, and fully plumbed — and it makes the *weakest* current path (signup without a successful org lookup) the one where the interview works hardest.

**Existing System Context:**

- **Onboarding wizard** (`app/onboarding/_components/onboarding-wizard.tsx`): 4 steps — CompanyInfoStep → ActivityQuestionsStep → TierPickerStep → ConfirmStep. Generation fires after Confirm creates the workspace (Story 25.2 progress strip).
- **Company analyzer** (`lib/company-preview/company-analyzer.ts`, Sonnet 4.6): reads name + SNI + Bolagsverket description + one fetched website page; returns `companySummary` (prompt-constrained to **one line**) + 8 `activityFlags` + a `confidence` rating. Runs pre-signup on the marketing org-check (`/api/public/company-preview`) and as an **async, silent fallback** during CompanyInfoStep (`company-info-step.tsx:161-207`) — a fast user clicks Next before it returns and the result is discarded.
- **ActivityQuestionsStep** (`activity-questions-step.tsx` + `lib/onboarding/question-selector`): static checkbox list with an existing `inferredFromWebsite` badge concept. This is the slot the interview upgrades — no fifth wizard step is added.
- **Generation input** (`lib/agent/tools/get-company-context.ts`): the single tool through which the law-list agent (and chat agent) sees the profile. `employeeCount` + `activityFlags` exposure landed 2026-06-10 (feat/tracking-events); `contextual_answers` and `has_collective_agreement` are still not exposed.
- **Schema**: `CompanyProfile.contextual_answers` (Json) exists and is null everywhere — reserved for exactly this feature.
- **Post-onboarding editing**: Settings → Företagsprofil textarea (max 1000 chars) — currently the only place the description is visible.

**Two entry paths, one component:** marketing org-check users arrive with a stored summary + flags (fastest path, fewest questions); direct signups get the analyzer live during CompanyInfoStep; lookup-failure/manual-entry users have no draft at all — for them the interview expands (4–5 questions + free-text description) because it is the only source. The adaptive design self-adjusts; no per-path forks.

## Stories

1. **Story 27.1 — Profile-data foundation: richer analyzer output + full plumbing.** Relax the analyzer prompt from "one-line" to a 2–4 sentence summary structured around the four generation-relevant dimensions (what they do, what they sell + channels, who the customers are, risk-relevant specifics), and add per-dimension confidence to the response shape. Expose `contextualAnswers` and `hasCollectiveAgreement` in `get_company_context` (same pattern as the 2026-06-10 `employeeCount`/`activityFlags` change, incl. tool-description guidance + unit tests). Fix the CompanyInfoStep race: the step-advance must await in-flight analysis (brief "Analyserar er verksamhet…" state) instead of silently dropping the result. No UI redesign in this story.

2. **Story 27.2 — Editable profile summary card in onboarding.** Add the "Så här förstår vi er verksamhet" card at the top of the (renamed) ActivityQuestionsStep: pre-filled 2–4 sentence description (inline-editable textarea, 1000-char cap, same validation as settings), activity flags as toggleable chips, confirm-and-tweak framing ("Stämmer det här? Lägg gärna till detaljer"). Persists user edits to `business_description`/`activity_flags` through the existing wizard submit path (`app/actions/workspace.ts`). Handles the async-draft arrival (skeleton state) and the no-draft path (empty editable card with prompt text). Instrument with `trackEvent()`: card shown / edited / unchanged, per entry path.

3. **Story 27.3 — Adaptive micro-interview.** Replace the static question list below the summary card with 2–4 model-generated questions (Opus 4.8, token volume trivial) selected by lowest-confidence × highest-legal-impact across a fixed rubric: secondary activities, sales channels, customer types, employment specifics (minderåriga/säsong), machinery, chemicals, premises, international trade. Quick-reply chips + optional free text, visible progress ("2 frågor kvar"). Expanded variant (4–5 questions + free-text description) on the no-draft path. Answers persist as Q&A pairs to `contextual_answers` and update `activity_flags`/description where applicable; generation consumes them via the 27.1 plumbing. Instrument question-level answer/skip rates and which dimensions get corrected, so low-yield questions can be dropped.

## Out of Scope (follow-up candidates, not this epic)

- Deeper auto-research (multi-page website crawl, Platsbanken job-ads enrichment).
- Post-generation gap-fill loop ("5 nya lagar baserat på din uppdatering" — re-run against existing list; item dedupe already makes re-runs additive).
- Freeform chat interview / "berätta mer" escape hatch beyond the bounded Q&A.
- Surfacing the profile card on the law-list page ("Byggd på denna företagsprofil").

## Compatibility Requirements

- [ ] No schema migration required — `contextual_answers`, `activity_flags`, `business_description` all exist; this epic only populates and plumbs them.
- [ ] `get_company_context` changes are additive fields (chat agent + generation agent share the tool; existing consumers unaffected).
- [ ] Wizard remains 4 steps; ActivityQuestionsStep's external contract (flags out via `onNext`) is preserved or migrated in the same story that changes it.
- [ ] Onboarding without JavaScript-side analyzer success must still complete (analyzer failure → editable empty card, never a blocker).
- [ ] Settings → Företagsprofil remains the post-onboarding edit surface; no divergence in validation rules (1000-char cap shared).

## Risk Mitigation

- **Primary Risk:** Added onboarding friction depresses completion — the wizard sits directly in the activation funnel.
- **Mitigation:** No new step; the interview replaces an existing checklist; question count is bounded (2–4, expanding only where the alternative is a near-empty profile); every element is skippable; `trackEvent()` instrumentation (per-step completion, per-question skip) ships in the same stories so regression is measurable within days.
- **Secondary Risk:** Worse analyzer drafts (longer prompt, more structure) degrade the marketing org-check preview that shares `analyzeCompany()`.
- **Mitigation:** Preview consumes `companySummary` for display only — verify the org-check card renders the longer summary acceptably (truncate display-side if needed) in 27.1's testing.
- **Rollback Plan:** Each story is independently revertible: 27.1's tool fields are additive (revert = remove fields); 27.2/27.3 are contained in the onboarding step component — reverting restores the static checklist. No data written by the epic is load-bearing for existing features.

## Definition of Done

- [ ] All three stories completed with acceptance criteria met.
- [ ] A direct-signup onboarding run (with org lookup) produces a user-confirmed 2–4 sentence description, flags, and ≥2 contextual answers in the profile row, all visible in `get_company_context` output.
- [ ] A lookup-failure onboarding run completes via the expanded interview with no analyzer dependency.
- [ ] Existing onboarding e2e/unit suites green; org-check marketing preview unaffected.
- [ ] Generation on an interview-enriched profile demonstrably consumes the new fields (manual A/B on a test workspace, same method as the 2026-06-10 Ekens Golv run).
- [ ] Funnel + question-level tracking events live.

## Dependencies & Notes

- **Done prerequisite (landed 2026-06-10, feat/tracking-events):** `employeeCount` + `activityFlags` exposed in `get_company_context`; prompt-cache `prepareStep` breakpoints in generation (cost of verification re-runs ~$1–3.50).
- **Known issue to fix before A/B verification runs:** `add_laws_to_list` crashes on duplicate `documentId` within one batch (`lib/agent/tools/add-laws-to-list.ts:165`, missing `skipDuplicates`/input dedupe) — costs a retry step and inflates token numbers. One-line fix; schedule with or before 27.1.
- **Open decision (does not block 27.1):** generation model default — A/B showed Opus 4.8 materially better selection/contexts at ~2.7× cost; switchable via `LAW_LIST_GENERATION_MODEL`. The interview raises profile quality for either model.
- **Coexistence:** Epic 25 (first-run modal) and Epic 26 (marketing pages) touch adjacent surfaces; this epic is confined to the onboarding wizard internals + analyzer + agent tool. Marketing org-check is a read-only consumer.

**Priority:** High — directly upgrades the activation funnel's "wow" moment and compounds: every profile improvement also feeds the chat agent and change monitoring through the same tool.

**Source artefacts:**
- Model A/B + profile-leverage analysis, PO/dev session 2026-06-10 (Ekens Golv Sonnet vs Opus run; retail-block evidence; analyzer/plumbing gaps).
- Reference: `lib/company-preview/company-analyzer.ts` (analyzer + prompt), `app/onboarding/_components/{company-info-step,activity-questions-step}.tsx`, `lib/onboarding/question-selector`, `lib/agent/tools/get-company-context.ts`, `app/actions/workspace.ts:291`.

---

**Story Manager Handoff:**

"Please develop detailed user stories for this brownfield epic. Key considerations:

- Enhancement to an existing Next.js (App Router) + Prisma + Vercel AI SDK system; onboarding wizard at `app/onboarding/_components/`, agent tooling at `lib/agent/tools/`.
- Integration points: `analyzeCompany()` (shared with marketing org-check — display-compat check required), ActivityQuestionsStep contract (`onNext(flags)`), wizard submit → `app/actions/workspace.ts`, `get_company_context` (shared by chat + generation agents), `trackEvent()` from feat/tracking-events.
- Existing patterns to follow: additive tool-field exposure with tool-description guidance + unit tests (see 2026-06-10 `employeeCount`/`activityFlags` change), wizard step components with saved-state restore, Zod validation shared with settings (1000-char description cap).
- Critical compatibility requirements: 4-step wizard preserved, analyzer failure never blocks onboarding, marketing preview unaffected, no schema migration.
- Sequence: 27.1 → 27.2 → 27.3 (each independently shippable and revertible); each story must verify existing onboarding completion (both entry paths) remains intact.

The epic should maintain system integrity while making the company profile the user-verified, comprehensive primary input to law-list generation."
