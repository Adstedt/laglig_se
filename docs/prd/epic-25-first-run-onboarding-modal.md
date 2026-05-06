# Epic 25: First-Run Onboarding Modal — Brownfield Enhancement

**Goal:** Replace the silent auto-fire of law list generation on first `/dashboard` visit with a path-choice + tutorial-while-waiting modal that gates generation, educates new users on the six core product capabilities (laglista, kravpunkter, uppgifter, kontroller, lagändringar, AI-agenten) via realistic mini-previews, and hands off cleanly to either the laglista (generate path) or the Epic 24 review surface (import path) — with a corner FAB and Hjälp menu providing persistent re-entry, plus a future feedback-loop slot on the same modal substrate.

**Value Delivered:** Today, when a new user finishes the workspace-creation wizard, generation auto-fires in the background while they stare at a chat-first dashboard with no orientation to the product. Three concrete failure modes follow: (1) **wasted tokens** — every prospect arriving from Notisum / Lex.nu / consultant Excel runs through the same LLM-driven generation, even when they want to import; ~$0.50–$1.50 per signup wasted across the import + skip slice; (2) **no orientation** — chat-first home is bewildering on day one with zero map of the product surfaces; (3) **no choice** — users who want import or manual build have no path that doesn't burn a generation run. This epic adds the missing first-run experience: a clean three-button gate (B.0) that ships independently to stop the token bleed in 1–2 days, then a full tutorial-while-working modal with six narrative-arc tabs, persistent FAB re-entry, and tutorial-only mode for post-completion learning. The same modal substrate is the future home of an in-product feedback loop (B.6).

**Delivers:**
- Pre-MVP gate (Story B.0 — ships independently): minimal modal with three buttons (Generera laglista nu / Importera befintlig — kommer snart / Hoppa över), `Workspace.first_run_dismissed_at` + `Workspace.tutorial_fab_dismissed_at` columns, `'skipped'` accepted as a new value of the existing `law_list_generation_status` String field, `OnboardingEvent` telemetry table skeleton, removal of the wizard's auto-fire of `POST /api/workspace/generate-law-list`
- Full modal (Stories B.1–B.4): brand-chrome Dialog with dim/blur backdrop and modal shadow, path-choice cards with hover-lift + recommended-chip, optional generate-kickoff confirm step, import-upload step (Epic 24 dependency for un-disable), tutorial step with progress strip + 6-tab framework + per-tab realistic mini-previews of the actual product surfaces, done states for both paths (generate reveal with group breakdown / import handoff with confidence breakdown card)
- Re-entry layer hierarchy (Story B.5): corner FAB (`onboarding-fab.tsx`, three visual states: working / done / idle, tiny X to dismiss), Hjälp sidebar entry as fallback after FAB dismissed, URL-driven deep-link (`?onboarding=tutorial[&tab=ai_agent]`) for support-shareable tutorial entry, `tutorial_only` mode that strips the progress strip from the tutorial step for post-completion learning
- Feedback loop slot (Story B.6 — future): `submitOnboardingFeedback` server action stub + 7th-tab or banner placement on the existing modal substrate; reuses `OnboardingEvent` (`feedback_submitted` event type) without any schema changes
- Six tab content panels with narrative arc: Vad är en laglista (foundation) → Kravpunkter & bevis (content) → Uppgifter (action) → Kontroller (rhythm) → Lagändringar (proactivity) → AI-agenten (meta layer, "Ny" chip) — each tab pairs concise Swedish copy with a realistic mini-mockup of the corresponding product surface (mini /laglistor table, kravpunkter checklist, mini Kanban, cycle detail, change-event card, chat conversation)

**Requirements covered:** Brief at `docs/onboarding-first-run-brief.md`. Architecture at `docs/architecture/first-run-onboarding-modal.md`. Closes the activation gap left by Epic 4 (which delivered the wizard but not the post-signup orientation moment) and the token-cost gap left by the wizard's silent auto-fire.

**Estimated stories:** 7 (B.0 + B.1–B.5 + B.6 future slot)

**Dependencies:**
- **Epic 4** (Onboarding — Done): provides the workspace-creation wizard at `/onboarding`. This epic modifies its `confirm-step.tsx` to remove the auto-fire of generation, and otherwise leaves the wizard unchanged.
- **Epic 6** (Compliance Workspace Kanban — Done): provides `LawList`, `LawListItem`, the Kanban tabs preview that powers tab 3.
- **Epic 14** (AI Chat — Done): provides the chat substrate previewed in tab 6 (AI-agenten). Stories 14.20 (extended thinking), 14.26 (prompt caching), 14.27 (telemetry) inform the chat preview accuracy.
- **Epic 17** (Document Management — Partial): kravpunkter checklist + bevis primitives previewed in tab 2.
- **Epic 21** (Lagefterlevnadskontroll — Substantially Done): cycle detail page previewed in tab 4. Lifecycle is `PLANERAD → PAGAENDE → AVSLUTAD` (post Stories 21.26 + 21.27).
- **Epic 22** (UI Primitives Alignment — Done): tab content uses `<Badge tone>`, `<FilterChip>`, `<PageHeader>`, `<TableToolbar>` from day one in the previews.
- **Epic 24** (Import Existing Law List — Sequenced first): hard dependency for B.4's import handoff (review surface) and for B.1's import card un-disable. Story B.0 ships **before** Epic 24 with the import button visibly disabled.
- **Story 16.4** (`LawListGenerationProgress` — Done): SWR substrate reused as the modal's progress-strip data source.

**Priority:** High — token-cost rationale (B.0 wedge) plus activation-conversion rationale (full modal). B.0 is the highest-leverage near-term ship: 1.5 days of work that stops $0.50–$1.50 of waste per import-or-skip signup immediately. Full modal is sequenced after Epic 24's review surface ships so B.4's handoff has somewhere to go.

**Source artefacts:**
- `docs/onboarding-first-run-brief.md` — strategic brief (drafted 2026-05-06)
- `docs/architecture/first-run-onboarding-modal.md` — Winston's architecture: schema additions, modal mount strategy, state machine (visibility × mode), re-entry hierarchy, server actions, source-tree additions
- `_prototypes/onboarding-tutorial-modal.html` — high-fidelity 6-frame visual reference: path-choice modal, generate-kickoff, import-upload, tutorial-while-working with 6 tab content panels, generate done state, import done state. Real Safiro fonts, real warm off-white palette, realistic mini-mockups of every product surface.

---

## Epic Goal

Replace the silent generation auto-fire on first `/dashboard` visit with a brand-on-message modal that gates the path, educates the user during the wait, and persists as a corner FAB + Hjälp entry for ongoing access — without breaking the existing `LawListGenerationProgress` banner contract or the wizard flow.

## Epic Description

### Existing System Context

- **Current relevant functionality:** `app/(workspace)/dashboard/page.tsx` reads `getDashboardData`, `getUnacknowledgedChangeCount`, `workspace.law_list_generation_status` and renders `<HemPage>`. `HemPage` (client wrapper) hosts `<LawListGenerationProgress>` (top, conditional on status ∈ {pending, in_progress, completed, failed}) plus `<HemChat>` or `<ChangeAssessmentView>`. Generation is fired by `app/onboarding/_components/confirm-step.tsx` immediately after workspace creation via `POST /api/workspace/generate-law-list`, then redirects to `/dashboard`.
- **Technology stack (this area):** Next.js 14 App Router, React 18, TypeScript, Tailwind, shadcn/ui (`Dialog`, `Tabs`, `Card`, `Switch`), `lucide-react`, SWR for polling. Brand fonts: Safiro (medium 500 only) for headers, Google Sans Flex for body. Tone palette via `lib/ui/badge-tones.ts` (Epic 22). Warm off-white palette in `app/globals.css`.
- **Integration points:**
  - `prisma/schema.prisma` (`Workspace` model): add 3 columns (`first_run_dismissed_at` DateTime?, `tutorial_fab_dismissed_at` DateTime?, `first_run_tabs_viewed` Json default `[]`)
  - `prisma/schema.prisma`: new `OnboardingEvent` model (workspace-scoped, polymorphic-payload, fail-safe write pattern mirroring `ChatUsageEvent`)
  - `app/onboarding/_components/confirm-step.tsx`: remove the auto-fire of `POST /api/workspace/generate-law-list`. Workspace lands on `/dashboard` with `law_list_generation_status=null`.
  - `app/(workspace)/dashboard/page.tsx`: add `getOnboardingState` server-side derivation; pass `onboardingState` prop to `<HemPage>`
  - `components/features/dashboard/hem-page.tsx`: mount `<FirstRunModal>` when `onboardingState.firstRunOpen`; mount `<OnboardingFab>` when `onboardingState.fabVisible`
  - `components/features/onboarding-modal/` (NEW folder): all modal components per architecture §6.1
  - `lib/onboarding/get-onboarding-state.ts` (NEW): pure function returning `{firstRunOpen, fabVisible, fabState}`
  - `app/actions/onboarding-modal.ts` (NEW): five server actions (`minimiseFirstRunModal`, `skipLawListGeneration`, `dismissOnboardingFab`, `recordTabViewed`, `recordOnboardingEvent`)
  - `lib/onboarding/onboarding-store.ts` (existing): wizard-side onboarding helpers; reused for wizard auto-fire removal in B.0
  - `components/layout/left-sidebar.tsx` or workspace sidebar: new "Hjälp" entry in B.5

### Enhancement Details

- **What's being added/changed:**
  1. **Schema layer (B.0)** — three nullable workspace columns + new `OnboardingEvent` table with workspace + user FKs and JSON payload. No existing column modified. `law_list_generation_status` stays `String?` (not migrated to enum); `'skipped'` is just a new accepted string value.
  2. **Wizard rewire (B.0)** — `confirm-step.tsx` stops calling generate-law-list automatically. Workspace lands on `/dashboard` with status=null.
  3. **First-run trigger (B.0)** — server-side `getOnboardingState()` returns `{firstRunOpen, fabVisible, fabState}` per dashboard load. Three guards: workspace fresh (≤24h old), no prior dismissal, no path chosen yet.
  4. **Minimal path-choice modal (B.0)** — `<FirstRunModal>` shell + `<PathChoiceStep>` only. Three buttons: Generera (fires existing API + minimises), Importera (records event + minimises + toast "Vi mejlar dig när importen är klar"), Hoppa över (sets `law_list_generation_status='skipped'` + `first_run_dismissed_at`).
  5. **Brand chrome (B.1)** — replaces B.0's plain card with full Dialog (Safiro brand bar, dim/blur backdrop, modal shadow). Path-choice cards upgraded with recommended-chip + hover-lift. Import card un-disabled (Epic 24 dependency).
  6. **Progress strip + tab framework (B.2)** — `<TutorialStep>` shell, `<ProgressStrip>` reusing `LawListGenerationProgress` SWR key, tab navigation chrome, "X av 6" counter, Minimera affordance.
  7. **Tutorial tab content (B.3)** — six `tutorial-tabs/tab-*.tsx` files, each rendering copy + mini-preview matching `_prototypes/onboarding-tutorial-modal.html`. Records `tab_viewed` events.
  8. **Done states (B.4)** — `<DoneGenerateStep>` (sage success ring, group breakdown chips, "Visa min laglista →") and `<DoneImportStep>` (confidence breakdown, "Granska matchningar →" handing off to Epic 24 review surface). Both transition to `tutorial_only` mode if user clicks "Fortsätt utforska".
  9. **Re-entry layers (B.5)** — `<OnboardingFab>` corner widget with three visual states (working / done / idle), tiny X to dismiss; Hjälp sidebar entry as fallback; URL-driven deep-link (`?onboarding=tutorial[&tab=...]`); `tutorial_only` mode in `<TutorialStep>` (hides progress strip).
  10. **Feedback loop (B.6 — future)** — `<FeedbackStep>` component + `submitOnboardingFeedback` server action; surfaces as 7th tab or banner above tutorial content; `feedback_submitted` event in `OnboardingEvent`.
- **How it integrates:**
  - **Banner stays** — `LawListGenerationProgress` is unchanged. When the modal is open, it covers the dashboard so the banner is visually hidden but still rendered. When the modal is closed/minimised, the banner is the inline fallback (or hidden if FAB is visible — defer to B.5 PM call).
  - **Wizard change is minimal** — one block removed from `confirm-step.tsx`. Existing wizard tests need a one-line update to assert the call is NOT made.
  - **Three surfaces, one data source** — modal, FAB, and banner all read from the same SWR key for generation status. No double-fetching.
  - **State derived server-side** — client gets a single `onboardingState` prop; no client-side conditional fetching.
- **Success criteria (measurable):**
  - **B.0:** Token cost per signup drops measurably for the import + skip slice (validated via `ChatUsageEvent` admin dashboard week-over-week post-launch). Existing wizard tests pass with the auto-fire assertion updated.
  - **B.1–B.4:** New user lands on `/dashboard`, modal opens, 6 tabs reachable, progress strip shows real "X / Y rader" data, dismiss-doesn't-cancel-job verified manually.
  - **B.5:** User who dismissed the modal can re-open it via FAB. User who dismissed the FAB can re-open via Hjälp menu. Deep-link `/dashboard?onboarding=tutorial&tab=ai_agent` opens directly to that tab.
  - **B.6:** (when scoped) Feedback events recorded with sentiment + optional message. Admin dashboard surfaces aggregate sentiment.
  - **Cross-cutting:** Existing `LawListGenerationProgress` tests pass unchanged. No regression in `/dashboard` load time (>p95 unchanged).

---

## Stories

### Story B.0 — Path-choice gate (token-saver MVP)

**Status:** Pre-MVP — ships independently, before Epic 24 completes. **First story to draft.**

**Scope:** Schema additions + minimal modal + wizard rewire. Stops auto-fire of generation immediately.

- Prisma migration `add_first_run_modal_columns`: add `first_run_dismissed_at`, `tutorial_fab_dismissed_at`, `first_run_tabs_viewed` to `Workspace`; add `OnboardingEvent` model with `workspace_id`, `user_id`, `event_type`, `payload (Json?)`, `created_at` + two indexes
- `lib/onboarding/get-onboarding-state.ts`: pure function with three guards. Returns `{firstRunOpen, fabVisible: false, fabState: 'idle'}` in B.0 — FAB visibility ships in B.5.
- `app/actions/onboarding-modal.ts`: five actions per architecture §7.1. All wrapped in `withWorkspace(cb)`. Telemetry writes wrapped in try/catch with `[ONBOARDING_EVENT_WRITE_FAIL]` console.error pattern.
- `components/features/onboarding-modal/first-run-modal.tsx` + `path-choice-step.tsx`: minimal shell using `Dialog` from `components/ui`. Three buttons:
  - **Generera laglista nu** → fires existing `POST /api/workspace/generate-law-list` + `minimiseFirstRunModal()`; banner takes over.
  - **Importera befintlig (Kommer snart)** → records `path_chosen={path:'import'}` + `minimiseFirstRunModal()`; toast "Vi mejlar dig när importen är klar att använda."
  - **Hoppa över — bygg manuellt** → calls `skipLawListGeneration()`. Modal closes; FAB stays hidden because `law_list_generation_status='skipped'`.
- `app/(workspace)/dashboard/page.tsx`: call `getOnboardingState`, pass `onboardingState` prop to `<HemPage>`.
- `components/features/dashboard/hem-page.tsx`: mount `<FirstRunModal>` when `onboardingState.firstRunOpen === true`. Existing `<LawListGenerationProgress>` rendering unchanged.
- `app/onboarding/_components/confirm-step.tsx`: remove the call to `POST /api/workspace/generate-law-list` after `createWorkspace()`. Update existing test (`tests/unit/components/onboarding/confirm-step.test.tsx`) to assert the call is NOT made.

**Definition of Done:**
- [ ] Migration applied; new columns + `OnboardingEvent` table exist; RLS verified
- [ ] Five server actions stubbed and tested (unit + smoke)
- [ ] First-run trigger logic returns correct values for all four guard branches
- [ ] Path-choice modal renders on first dashboard visit; three buttons fire correct handlers
- [ ] Wizard auto-fire removed; existing wizard test updated and passing
- [ ] Smoke test on staging: signup → land on `/dashboard` → modal opens → click each button → verify post-conditions (status set correctly, modal stays closed on reload)
- [ ] Existing `LawListGenerationProgress` tests pass unchanged

**Effort estimate:** ~1.5 days

---

### Story B.1 — Modal shell + path-choice upgrade

**Status:** Sequenced after Epic 24.4 (so import card can un-disable).

**Scope:** Replace B.0's plain card with full brand-chrome Dialog + production path-choice cards.

- Replace plain `Dialog` card from B.0 with full chrome: Safiro brand bar at top, dim/blur backdrop, modal shadow (`shadow-modal` from prototype), `max-w-[600px]`, rounded-2xl
- Path-choice cards upgraded to prototype frame ① fidelity: recommended chip + hover-lift, real iconography (`wand-sparkles` for Generate, `file-up` for Import), meta line ("Använd er profil →" / ".xlsx · .csv · klistra in →")
- Import card un-disabled — clicking it now routes to B.5's import-upload step instead of showing the toast (Epic 24.4 must be live)
- Workspace ID + first-run age guard already in place from B.0 — no change to trigger logic

**Definition of Done:**
- [ ] Modal chrome matches prototype frame ① (Safiro brand bar, dim/blur, shadow)
- [ ] Path-choice cards visually match prototype with hover-lift + recommended chip
- [ ] Import card routes to upload step (Epic 24 dependency)
- [ ] Existing tests pass; new visual regression captures match prototype

---

### Story B.2 — Progress strip + tab framework

**Status:** Sequenced after B.1.

**Scope:** Tutorial step shell + reusable progress strip + tab navigation chrome. **No tab content yet** — that's B.3.

- `progress-strip.tsx`: extracts and reuses the `LawListGenerationProgress` SWR data via the same key. Renders with prototype frame ③ fidelity: shimmer-bar, step trail with checks + active pulse-dot, "Steg X av Y" + "X / Y rader" font-mono row
- `tutorial-step.tsx`: shell with progress strip on top + tab navigation below + tab-body container. "X av 6" counter on right. Tabs scroll horizontally on narrow viewports
- Minimera affordance: clicking the X or Minimera button calls `minimiseFirstRunModal()` and closes the modal. (FAB lands in B.5; for now, "minimised" just means closed.)
- Tab navigation state lives in `tutorial-step.tsx` via `useState`; tab changes record `tab_viewed` events via `recordOnboardingEvent`

**Definition of Done:**
- [ ] Progress strip renders correctly during in-progress generation (live test on staging)
- [ ] Tab framework navigates between empty placeholder tabs
- [ ] "X av 6" counter updates as user navigates
- [ ] Tab changes record `tab_viewed` events
- [ ] Minimera button closes modal; banner takes over correctly

---

### Story B.3 — Six tutorial tab content panels

**Status:** Sequenced after B.2. **Splittable into B.3a + B.3b** if velocity demands.

**Scope:** Each of six tabs implemented as a separate component file with copy + mini-preview. Realistic mini-previews of actual product surfaces.

- `tutorial-tabs/tab-laglista.tsx` — mini `/laglistor` table preview (toolbar, group header, 4 real rows with avatars + tone pills)
- `tutorial-tabs/tab-kravpunkter.tsx` — kravpunkter checklist preview (3 requirements, file chips, "Saknar bevis" warning row, Kräver-bevis toggles)
- `tutorial-tabs/tab-uppgifter.tsx` — mini Kanban (Att göra / Pågår / Klart, AI-spawned task chip, linked-law badge)
- `tutorial-tabs/tab-kontroller.tsx` — cycle detail preview (header with lead-auditor avatar, progress 12/24 signerade, Items/Findings/Rapport tabs, signed/unsigned items)
- `tutorial-tabs/tab-lagandringar.tsx` — change card preview (bell icon, Hög påverkan pill, red/green diff block, AI-bedömning panel, Bedöm/Ej relevant CTAs)
- `tutorial-tabs/tab-ai-agent.tsx` — chat conversation preview (user bubble, expanded reasoning block, tool-call card, response with §-citation chips, suggested-task action card, input bar). "Ny" chip in tab strip.
- All six panels static — no live data, just realistic-feeling mock content

**Splittable scope (if needed):**
- **B.3a (foundation tabs):** laglista + kravpunkter + uppgifter
- **B.3b (advanced tabs):** kontroller + lagändringar + ai-agent

**Definition of Done:**
- [ ] All six tab panels render with copy + preview matching prototype
- [ ] AI-agenten tab's "Ny" chip visible in tab strip
- [ ] Each panel logs a `tab_viewed` event on first render
- [ ] Visual regression captures match prototype frames per tab

---

### Story B.4 — Done states for both paths

**Status:** Sequenced after B.3. **Hard dependency on Epic 24.4** for import path.

**Scope:** Generate done + Import done celebration screens. Transition to `tutorial_only` for users who want to keep exploring.

- `done-generate-step.tsx`: sage success ring with sparkles icon, group-breakdown chips ("42 Miljö, 31 Arbetsmiljö..."), Stäng + Visa min laglista CTAs (matches prototype frame ④a)
- `done-import-step.tsx`: confidence breakdown card (Hög / Behöver bekräftelse / Saknas counts with semantic colours), "Granska matchningar →" CTA (routes to Epic 24's review surface), "Lämnar guiden — granskningen sker på en egen sida" hint
- Auto-transition logic: when `law_list_generation_status` flips to `'completed'` (generate path) or `LawListImport.status` flips to `AWAITING_REVIEW` (import path) AND modal is in `tutorial` mode, auto-show the done step
- "Fortsätt utforska" secondary CTA on both done steps transitions modal to `tutorial_only` mode (B.5 dependency for the mode rendering — defer that until after B.5)
- Failure states: generation failed → show error card with retry; import matching failed → show error with "Skapa supportärende" CTA

**Definition of Done:**
- [ ] Generate done state renders on completion with correct group breakdown
- [ ] Import done state renders with correct confidence breakdown + handoff CTA
- [ ] Failure paths render correctly
- [ ] Auto-transition from tutorial mode works on both completion signals
- [ ] Existing tests pass

---

### Story B.5 — Re-entry layers + tutorial-only mode

**Status:** Sequenced after B.4.

**Scope:** Corner FAB + Hjälp sidebar + URL deep-link + tutorial-only mode.

- `onboarding-fab.tsx`: bottom-right floating button on `/dashboard` (and any workspace route — see open question 4 in arch doc). Three visual states:
  - `working` — spinner + "Genererar laglista..." pill, mild pulse animation
  - `done` / `idle` — lightbulb icon + "Tutorial" tooltip
- Tiny X on hover state of FAB → calls `dismissOnboardingFab()` action → sets `tutorial_fab_dismissed_at`
- `help-menu-trigger.tsx`: sidebar entry (placement TBD — see open question 2). Always rendered; opens modal in `tutorial_only` mode via URL navigation to `?onboarding=tutorial`
- URL-driven deep-link: `?onboarding=tutorial[&tab=ai_agent]` opens modal directly into tutorial step at specified tab. URL replaced (not pushed) on close
- `tutorial_only` mode in `tutorial-step.tsx`: hides progress strip, just renders tabs. Reuses same component, conditional render based on mode prop
- `getOnboardingState` extended to compute `fabVisible` + `fabState` per architecture §6.4
- `hem-page.tsx`: mounts `<OnboardingFab>` when `onboardingState.fabVisible === true`
- Optional: use `first_run_tabs_viewed` to highlight unread tabs with a small dot (defer if velocity-constrained)
- Banner ↔ FAB visibility: when FAB is visible, hide the existing banner (recommended) — implemented in `hem-page.tsx`

**Definition of Done:**
- [ ] FAB renders bottom-right when modal is dismissed AND not skipped AND FAB itself not dismissed
- [ ] FAB three visual states render correctly per generation status
- [ ] Tiny X on FAB calls `dismissOnboardingFab` and persists
- [ ] Hjälp sidebar entry opens modal in tutorial-only mode
- [ ] Deep-link URLs work (open modal at correct tab; survive reload)
- [ ] `tutorial_only` mode hides progress strip but keeps tabs
- [ ] Banner does not double-render when FAB is visible

---

### Story B.6 — Feedback loop (future)

**Status:** Future — not scoped for current sprint cycle. Architecture supports it without schema changes.

**Scope:** In-product feedback collection on the tutorial modal substrate.

- `feedback-step.tsx`: thumbs up/down + optional free-text textarea + Submit CTA. Surfaces as either a 7th "Feedback" tab in the tutorial-tabs strip OR a dismissable banner above tutorial content (UX call deferred to PM)
- `submitOnboardingFeedback(sentiment, message?)` server action records `OnboardingEvent` with `event_type='feedback_submitted'` + `payload={sentiment, message}`. No new schema.
- Trigger: passive (visible after N tab views) OR active (modal re-opens with feedback step after a delay) — UX call deferred
- Admin surface: aggregate sentiment + recent free-text on the existing usage admin dashboard (Story 14.27) under a new "Onboarding feedback" section

**Definition of Done (when scoped):**
- [ ] Feedback events captured with sentiment + optional message
- [ ] Admin dashboard surfaces aggregate sentiment
- [ ] No new schema required
- [ ] Trigger placement validated with PM before shipping

---

## Compatibility Requirements

- [x] Existing `LawListGenerationProgress` banner unchanged in behaviour and tests
- [x] Existing wizard at `/onboarding` unchanged except for the auto-fire removal in `confirm-step.tsx`
- [x] Existing `Workspace` model unchanged (additive columns only)
- [x] No existing API routes modified (all new server actions live in `app/actions/onboarding-modal.ts`)
- [x] Existing `/dashboard` load time within p95 envelope (one extra DB read for onboarding state — measured)
- [x] No regression in workspace RLS (new columns + table follow existing pattern)

## Risk Mitigation

- **Primary Risk:** B.0 ships, removes the auto-fire, but the modal has a bug that prevents users from successfully starting generation. Net effect: signups grind to a halt with no laglista being created. Mitigation: smoke-test gate before merge (signup → modal → click Generera → verify generation fires within 5s); feature-flag `first_run_modal_v0` ON/OFF toggle so we can revert in seconds via env-var change.
- **Secondary Risk:** Modal feels intrusive and users dismiss without engaging. Mitigation: B.0 is dismissible explicitly via "Hoppa över"; corner FAB (B.5) provides persistent re-entry. Telemetry on `modal_dismissed` event tracks the rate of disengagement.
- **Tertiary Risk:** FAB gets in the way of the chat-first dashboard's input. Mitigation: FAB position is bottom-right with z-index management; chat input is centred max-w-2xl. Visual review on staging before B.5 ships.
- **Rollback Plan:** Feature flag the modal entirely (env-var). Schema columns stay. Wizard's auto-fire removal is the only code change that needs reverting if we abandon — small diff.

## Definition of Done

- [ ] All 6 stories (B.0–B.5) completed; B.6 deferred to future sprint
- [ ] Token cost per signup drops post-B.0 (measurable via `ChatUsageEvent` admin)
- [ ] Activation telemetry (path-choice rates, tab-view rates, dismiss rates) visible in admin
- [ ] Existing `LawListGenerationProgress` tests pass unchanged
- [ ] Existing wizard tests updated for auto-fire removal and pass
- [ ] No regression in `/dashboard` load time
- [ ] Smoke flow validated on staging: new signup → modal → choose path → tutorial → completion → done state → minimise to FAB → re-open via FAB → close → re-open via Hjälp menu
