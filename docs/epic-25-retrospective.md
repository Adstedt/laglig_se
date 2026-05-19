# Epic 25 — First-Run Onboarding Modal — Retrospective

**Period:** 2026-05-07 (B.0 drafted) → 2026-05-19 (B.6 Done flip)
**Stories shipped:** 7 (B.0 through B.6)
**Status:** All stories Done; awaiting commit + staging rollout.

---

## Outcome summary

Replaced the silent auto-fire of law-list generation on first `/dashboard` visit with a brand-on-message modal that:

1. **Gates the path** (Mall / Generera / Importera / Hoppa över) — stops the ~$0.50–$1.50 per signup token waste for the template + import + skip slice.
2. **Educates while waiting** — six narrative-arc tabs with realistic mini-previews of laglista, kravpunkter, uppgifter, kontroller, lagändringar, AI-agent.
3. **Celebrates completion** — per-path done states (template synchronous, generate with group breakdown + LawListPreview, import with confidence breakdown).
4. **Captures product feedback** — 7th tab (thumbs + optional message + optional reply-to email) routed to dev@laglig.se via the existing Resend transport.
5. **Persists re-entry** — corner FAB (working pill / done lightbulb / celebrate Sparkles) + Hjälp "Guide" sidebar entry + URL deep-link (`?onboarding=tutorial[&tab=<id>]`) so the tutorial isn't a one-shot.
6. **Self-recovers on background completion** — SWR-driven auto-refresh detects generation completion mid-minimize, flips the FAB to the celebrate variant without manual reload.

---

## Stories shipped

| Story | Title | Status | QA Gate | Quality | Net new tests |
|---|---|---|---|---|---|
| B.0 | Path-choice gate (token-saver MVP) | Done | PASS | — | — |
| B.1 | Modal shell + three-card path-choice upgrade | Done | PASS | — | — |
| B.2 | Progress strip + tab framework | Done | PASS | — | — |
| B.3 | Six tutorial tab content panels | Done | PASS | — | — |
| B.4 | Done states (template / generate / import) | Ready for Review† | PASS | 95/100 | +24 |
| B.5 | Feedback form (in-scope MVP) | Done | PASS | 100/100 | +17 |
| B.6 | Re-entry layers + tutorial-only mode | Done | PASS | 100/100 | +16 (v1.0) +16 (v1.1) |

†B.4 was QA-gated PASS at score 95/100 but the story file still reads "Ready for Review" — likely an owner-side Status-flip oversight from the 25.4 → 25.5 transition. **Action**: flip B.4 to Done for housekeeping.

**Total net tests across the epic:** ~73 new tests; ~190 lines of arch-doc updates (open questions resolved inline per story); 0 Prisma migrations (all schema work front-loaded in B.0).

---

## Architectural highlights

### What stayed clean

- **Single substrate, multiple modes**: `<FirstRunModal>` shell hosts 8 step values (`path-choice` / `template-pick` / `import-upload` / `tutorial` / `tutorial-only` / `done-generate` / `done-import` / `done-template`). Each step is a per-file component (~50–250 LOC); shell stays a thin orchestrator.
- **Single source of truth for visibility**: `getOnboardingState(workspaceId)` (~80 LOC, server-side) returns `{firstRunOpen, fabVisible, fabState}` derived from 3 Workspace columns + 1 timestamp + the 24h FRESH cap. No client-side state drift; consumed by `<HemPage>` as a single prop.
- **Telemetry is fail-safe**: every event write is wrapped in try/catch and logged but never throws; user-facing actions never fail because telemetry failed.
- **Schema is additive**: 3 Workspace columns + 1 new `OnboardingEvent` table, all shipped in B.0 — no later migration ever needed.
- **No new dependencies**: epic shipped using existing lucide-react, shadcn, Resend, React Email, Prisma, SWR, Tailwind. Zero npm install.

### What evolved during the epic

- **Story 25.3 v0.5 polish round** brought substantial post-Done refinement to the progress strip + modal-shell (asymptotic %, `--tone-*-soft-*` CSS variables, modal height-conditional, started_at API field). v0.6 added the side-by-side LawListPreview in done-generate.
- **Story 25.4 v0.4 owner-ack pivots**: template path moved to inline `adoptTemplate`; import path moved to "done-import then route on CTA"; "Fortsätt utforska" intentionally disabled with "Kommer snart" tooltip (callback plumbed for B.6 to swap).
- **Story 25.5 v0.2 framing pivot**: "onboarding feedback" → "product-wide feedback" with a `source` discriminator. Renamed `submitOnboardingFeedback` → `submitProductFeedback`, email template + env var + log prefix all renamed in lockstep.
- **Story 25.6 v1.1 post-smoke polish**: dark-mode CSS variable fix (3 tokens, 9 lines, affects 26 usage sites), smart FAB+Guide open-target (`'tutorial'` when work in flight), FAB-disappearing bug fix (`router.refresh()` after `router.replace()`), redundant-write fixes (dropped `router.push('/dashboard')` from `handleMinimiseFromTutorial`; per-trigger `onMinimise` resolution), celebrate FAB Sparkles variant with localStorage persistence, SWR-driven auto-refresh on completion.

---

## Key learnings

### What worked

1. **Architecture-first**: the `docs/architecture/first-run-onboarding-modal.md` doc (~670 lines) was written before any story drafting. It provided a stable reference for state machine, telemetry shape, file structure, and re-entry hierarchy — kept the 7 stories coherent over 12 days.
2. **Owner-ack pivots captured in Change Log**: every meaningful trade-off (B.4's three v0.4 decisions, B.5's framing pivot, B.6's seven Owner-ack'd decisions) was captured in the story Change Log inline with a date stamp. Reviewers always knew *why* a story diverged from the architecture spec.
3. **In-scope arch doc updates** (precedent from B.4 Task 11): each story that introduced new event types or renamed contracts updated the arch doc in the same PR. Doc-truth and code-truth stayed aligned across 12 days of evolution.
4. **Per-story QA gates**: 7 separate gate yml files (`docs/qa/gates/25.0-*.yml` through `25.6-*.yml`) created a clean audit trail of NFR validation + traceability per ship.
5. **Smoke before Done**: 25.6's smoke flow caught 7 real bugs (dark mode, FAB disappearing, missing ProgressStrip in tutorial-only, redundant writes, no auto-refresh) that all would have shipped silently if the story flipped to Done at v1.0.
6. **No-Prisma-migration discipline**: front-loading all schema in B.0 meant every subsequent story could honestly claim "zero schema changes" — kept migration risk concentrated in one place.

### What we'd do differently

1. **Anticipate post-smoke polish in AC count**: B.6 was approved with 50 ACs but shipped with 7 additional behaviors from v1.1 polish. The story Change Log captured this, but the original ACs understated the actual delivered surface. Future epics: either widen AC count to anticipate smoke-driven polish, OR formalize that the Change Log is the canonical post-merge record (and AC count is a v0.x target, not a contract).
2. **Defer celebrate FAB to its own story**: the localStorage seen-flag mechanism + Sparkles variant + SWR auto-refresh emerged as v1.1 polish but is really its own ~150-LOC behavior. Could have been B.7. Lesson: when a flagged "out of scope" item from a prior story ("smart done-state restoration NOT implemented") comes up during smoke, ship it as a new story not as polish.
3. **E2E tests earlier**: tests were unit-only across all 7 stories. The 7 bugs caught during 25.6 smoke would have been caught by E2E earlier in the epic. **This retrospective ships the first Epic 25 Playwright suite** (see `tests/e2e/epic-25/`).
4. **Document the smoke procedure as a script**: smoke flows for 25.4/25.5/25.6 all referenced `pnpm tsx scripts/reset-almasa-onboarding.ts` + a 5-13 step manual procedure. A `scripts/smoke-epic-25.ts` orchestrator (or the Playwright E2E suite below) would have made smoke faster + more repeatable.

---

## Production rollout checklist

Before rolling Epic 25 to 100% of users:

- [ ] **Commit + deploy to staging** — current branch `epic-25` ships all 7 stories together
- [ ] **Owner staging smoke** — 13-step procedure from 25.6 AC 49 (reset Almåsa → path-choice → Generera → Minimera → wait → celebrate FAB → done-generate → close → FAB demotes → Guide sidebar → URL deep-link → Feedback tab → submit → verify email at dev@laglig.se)
- [ ] **24h prod monitoring** (per 25.6 AC 50):
  - `select count(*), payload->>'trigger' from "OnboardingEvent" where event_type='modal_opened' and created_at > now() - interval '24 hour' group by 2` — confirm `fab` + `help_menu` triggers fire
  - `select count(*) from "OnboardingEvent" where event_type='done_cta_clicked' and payload->>'cta'='keep_exploring' and created_at > now() - interval '24 hour'` — confirm enable-swap landed
  - `select count(*) from "Workspace" where tutorial_fab_dismissed_at is not null` — confirm dismiss action works
  - Sentry scan: errors from `components/features/onboarding-modal/` or `components/features/dashboard/hem-page.tsx`
- [ ] **One real B.5 feedback** at dev@laglig.se from a staging or production user — confirms email transport works end-to-end (epic DoD requirement at line 307)
- [ ] **Token-cost validation** (per epic line 305): aggregate `ChatUsageEvent` by signup-week pre/post-B.0 deploy; confirm the template + import + skip slice drops measurably
- [ ] **Activation-conversion validation**: aggregate `OnboardingEvent.path_chosen.path` distribution; the success criterion is "non-zero `path:'template'` events" (i.e., users actually pick the template route instead of defaulting to generate)

## Rollback plan

`FIRST_RUN_MODAL_V0` env flag (Story 25.0) gates everything in HemPage. Setting it to `false` in Vercel env disables:
- the first-run modal auto-mount
- the FAB
- the Guide sidebar entry's effect (the link still renders but the modal won't mount)
- the URL deep-link
- the SWR auto-refresh

The new schema columns + OnboardingEvent rows stay in place (additive; no cleanup needed). The wizard's auto-fire of generation is permanently removed (B.0 change to `app/actions/workspace.ts`) — if this needs reverting, that's a separate one-line code change.

---

## Open follow-ups

| Follow-up | Source | Priority |
|---|---|---|
| Flip Story 25.4 Status `Ready for Review` → `Done` | Housekeeping after this retrospective | Low |
| Migrate `laglig:done-generate-shown:*` localStorage flag to DB column if cross-device matters in production | 25.6 v1.1 Owner-ack'd decision 7 | Low (re-evaluate after rollout) |
| Wrap `handleClose` in `useCallback` to silence 4 pre-existing ESLint warnings in `first-run-modal.tsx` | 25.6 QA recommendation #2 | Low |
| Consider relaxing SWR poll interval 3s → 5s if production volume warrants | 25.6 QA recommendation #1 | Low |
| Multi-tab BroadcastChannel coordination for the SWR auto-refresh | 25.6 QA recommendation #3 | Low |
| Toast notification when SWR auto-refresh detects completion (vs relying on the FAB visual flip alone) | 25.6 QA recommendation #4 | Low |
| Refresh `_prototypes/onboarding-tutorial-modal.html` frame ① to show three cards (currently shows two — predates B.1 three-card decision) | Epic line 35 known gap | Low |
| Admin dashboard surfacing OnboardingEvent rows | Epic line 232 (PO deferred at v1) | Reconsider if dev@laglig.se inbox volume becomes painful |

---

## Files of note

- **Architecture**: `docs/architecture/first-run-onboarding-modal.md` — single source of truth for state machine + telemetry + re-entry hierarchy
- **PRD**: `docs/prd/epic-25-first-run-onboarding-modal.md` — story scope + sequencing
- **QA gates**: `docs/qa/gates/25.0-*.yml` through `25.6-*.yml` — per-story PASS gates with NFR validation
- **Story files**: `docs/stories/25.2.*.md` through `docs/stories/25.6.*.md` (B.0/B.1 in `docs/stories/completed/`)
- **E2E tests**: `tests/e2e/epic-25/onboarding-modal.spec.ts` — Playwright suite covering the highest-value flows (added as part of this retrospective)
- **Reset helper**: `scripts/reset-almasa-onboarding.ts` — dev-only helper for re-smoking the full flow

---

*Compiled by Quinn (Test Architect) — 2026-05-19, end of Epic 25 shipping cycle.*
