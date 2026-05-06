# Project Brief: First-Run Onboarding Experience (Tutorial Modal)

**Status:** Draft v1 — awaiting PM + Architect review
**Author:** Claude (drafted with Alexander) — 2026-05-06
**Target product:** Laglig.se
**Positioning:** Brownfield — replaces the silent auto-fire of law list generation on first `/dashboard` visit
**Sibling brief:** `docs/import-law-list-brief.md` (Epic A — Import pipeline)

---

## Executive Summary

Today, when a user finishes the workspace-creation wizard and lands on `/dashboard`, Laglig **silently auto-fires** law list generation in the background. A 5-minute LLM job kicks off without the user ever choosing to start it, while a banner at the top of an otherwise-empty chat-first dashboard explains what's happening. Two failure modes follow: (1) users who actually want to **import** an existing list have no way to opt out — generation runs anyway, wasting tokens and creating a list they'll throw away; (2) users who *do* want generation stare at a banner with nothing to do for 2–5 minutes, with no orientation to the product they just signed up for.

This brief proposes a **first-run modal** that opens on the first `/dashboard` visit after signup, with three jobs:

1. **Gate the path** — Generate or Import (or Hoppa över). Stop token waste from auto-firing generation.
2. **Educate while we work** — Tabbed tutorial running alongside the progress strip, previewing the actual product surfaces (laglista, kravpunkter, uppgifter, kontroller, lagändringar, AI-agenten).
3. **Hand off cleanly** — Generate path reveals the laglista; Import path hands off to the review surface from Epic A; both surfaces let the user dismiss without cancelling background work.

The modal is **non-blocking by contract** — closing it does not stop the job, and the existing `LawListGenerationProgress` banner remains as the fallback progress indicator. A "Hjälp" menu re-opens the tutorial later for users who skipped it on first run.

---

## Problem Statement

### Current state

`app/(workspace)/dashboard/page.tsx` reads `workspace.law_list_generation_status` and renders `<LawListGenerationProgress>` when status ∈ `{pending, in_progress, completed, failed}`. Generation kicks off via `POST /api/workspace/generate-law-list` from the wizard's confirm step. The banner card is a thin, dismissable strip with a step list.

This works for a single user persona — the greenfield SMB owner who has no existing list and wants Laglig to build one from scratch. It fails everyone else.

### Pain points

1. **Wasted tokens for switchers.** Every prospect arriving from Notisum, Lex.nu, or a consultant Excel runs through the same generation, even though they have a curated list they'd rather import. Cost: ~$0.50–$1.50 per generation (Sonnet, ~5min job, ~120 list items × tool calls). Across the conversion funnel, this is real money.
2. **No orientation.** New users sign up, complete the wizard, and land on a dashboard with a single chat input and a "vi skapar er laglista..." banner. There is no answer to "what does this product actually do?" until the laglista is ready, ~3–5 minutes later. Drop-off risk during the dead time is non-trivial.
3. **No choice.** Generation is auto-fired with no UI affordance. Users who want to import, or who want to build manually, have no path that doesn't waste a generation run.
4. **No tutorial surface.** Laglig has six distinct product capabilities (laglista, kravpunkter, uppgifter, kontroller, lagändringar, AI-agenten), but a new user discovers them one at a time through navigation. There is no canonical first-run "here's what's in the box" moment.

### Why now

- **Epic A (Import) ships imminently.** Without a first-run gate, the import path has nowhere natural to surface during the highest-intent moment (immediately post-signup).
- **AI cost is increasingly visible.** Story 14.27 admin dashboard now shows per-workspace token spend. Auto-firing generation for users who'll import is a line item we can remove.
- **Conversion data.** No telemetry today, but anecdotal: support tickets in the form "I made the wrong workspace, can you delete it?" suggest a meaningful slice of users hit the dashboard, realise they want import, and bail out.

---

## Proposed Solution

### Core concept

A **first-run modal** with three states:

```
[Workspace created]
  ↓
① Path choice (modal opens)
  ├─ Generate → ② kickoff confirm (optional) → ③ tutorial-while-working → ④a reveal
  ├─ Import   → ② file upload                  → ③ tutorial-while-working → ④b handoff to Epic A review
  └─ Hoppa över → set generation_status='skipped' → modal closes, dashboard shows empty state
```

Prototype: `_prototypes/onboarding-tutorial-modal.html` (high-fidelity static prototype, all six frames).

### Key design decisions (locked)

1. **Non-blocking by contract.** Closing the modal never cancels the background job. "Du kan stänga rutan — vi fortsätter i bakgrunden" is repeated three times in copy across frames. Dismiss → fall back to existing `LawListGenerationProgress` banner. No re-open on subsequent visits.
2. **Six tabs, narrative arc.** Laglista (object) → Kravpunkter (content) → Uppgifter (action) → Kontroller (rhythm) → Lagändringar (proactivity) → AI-agenten (meta). Pedagogical ordering, not feature-importance. AI-agenten gets a "Ny" chip to surface it without hiding it.
3. **Tutorial = product preview, not abstract copy.** Each tab shows a realistic mini version of the surface (`/laglistor`, `/tasks`, `/laglistor/kontroller/[id]`, etc.) with real-looking SFS numbers, avatar chips, and tone pills. Users see exactly what they'll land in.
4. **Re-entry via Hjälp menu, not auto re-pop.** Once dismissed, the modal does not re-open automatically. A "Hjälp" entry in the workspace sidebar re-opens it on demand.
5. **Import path leaves the modal.** Per Epic A's brief, the per-row confidence review is a focused full-page surface, not a "while-you-wait" overlay. Modal hands off and closes.
6. **"Hoppa över" sets `generation_status='skipped'`.** New enum value on the workspace status field. Suppresses both the modal and the banner on future visits. Manual list-building is still possible from `/laglistor`.

### Surface scope

- **First-run modal** — `/dashboard`, opens once on first visit after workspace creation.
- **Hjälp menu** — re-opens the modal in tutorial-only mode (no path choice, no progress strip).
- **NOT in scope:** the in-app `/laglistor/skapa` page (handled in Epic A as the second surface for the import pipeline). The first-run modal is exclusively about post-signup activation.

### Reuse strategy

- `LawListGenerationProgress` (existing) — its progress-step rendering is the substrate for the modal's progress strip. Same SWR key, same polling, same status state machine.
- `Dialog` / `Tabs` / `Card` from `components/ui` — standard shadcn primitives. No bespoke chrome.
- Fonts and tokens — `Safiro` (medium 500 only — never bold), `Google Sans Flex`, warm off-white palette from `app/globals.css`. Tone palette from `lib/ui/badge-tones.ts`.

---

## Strategic Decisions Baked In

| Decision | Rationale |
|---|---|
| Two epics, sequenced (A: Import → B: Onboarding) | Import is a *capability* used by multiple surfaces; onboarding is an *orchestration* that composes capabilities. Splitting lets each ship at its own pace and lets Import deliver value standalone via in-app create-list. |
| Pre-MVP path-choice gate ships before either epic completes | Auto-firing generation while we're months from finishing the full modal is wasteful. A minimal "do you want generate or import?" gate, with import disabled (coming-soon), can ship in 1–2 days and stops the bleed immediately. |
| Tab content is preview-driven | "Vad är en laglista" with abstract bullets is forgettable. A mini `/laglistor` table with real SFS numbers is memorable. Each tab follows this pattern. |
| Modal is dismiss-friendly | The first-run modal is a gift, not a gate. If the user wants to skip the tutorial and explore, that's fine — the existing banner takes over. |
| AI-agenten gets surfaced explicitly | This is the differentiator vs. Notisum / Lex.nu. Hiding it behind tab 6 is fine *if* we flag it. The "Ny" chip + the chat preview do that work. |

---

## Story Breakdown

### Pre-MVP — ships independently, before either epic completes

**B.0 — Path-choice gate (token-saver MVP)**
- Modal opens on first `/dashboard` visit after workspace creation (detected via `workspace.law_list_generation_status === null` on workspace age < 24h, or a dedicated `first_run_dismissed_at` column).
- Two cards: "Generera laglista nu" (primary) / "Importera befintlig lista" (disabled with "Kommer snart" badge until Epic A ships).
- Footer link "Hoppa över — bygg manuellt".
- Generate → fires existing `POST /api/workspace/generate-law-list`, modal closes, existing banner takes over.
- Import → currently inert; logs intent for analytics + sets a flag we can use to email the user when Epic A ships.
- Hoppa över → sets `law_list_generation_status='skipped'` (new enum value), modal closes, dashboard shows empty state.
- **Token impact:** prevents auto-firing generation for the ~?% of users who pick import or skip. Even at 10% of signups, this pays back in days.
- **Effort:** ~1 day. Single file additions, no schema changes beyond the new enum value + the dismissed-at column.

### Epic B v1 — full first-run experience

**B.1 — Modal shell + trigger refinement**
- Replace the pre-MVP modal's plain card with the full Dialog chrome (Safiro brand bar, dim/blur backdrop, modal shadow).
- First-visit detection hardened (handles re-signin edge cases, multiple workspaces, deep-links).
- Path-choice cards upgraded to the high-fidelity design from the prototype (recommended chip, hover lift, real iconography).
- Import card un-disabled when Epic A is live.

**B.2 — Progress strip + tab framework**
- Reuses `LawListGenerationProgress`'s SWR + status logic.
- Adds tab navigation chrome (Tabs component, "X av 6" counter, scrolling on narrow viewports).
- Footer affordance — "Vi fortsätter i bakgrunden", Minimera button → collapses modal to a corner toast.

**B.3 — Tutorial tab content (split if heavy)**
- All six tabs implemented with copy + previews matching the prototype.
- Each tab's preview is a static composition of existing primitives (Pill, Avatar, table rows). No live data.
- Probably one story; can split as B.3a (3 foundation tabs) + B.3b (3 advanced tabs) if velocity demands.

**B.4 — Done states**
- 4a Generate complete — sage success ring, group breakdown chips, "Visa min laglista →" CTA.
- 4b Import complete — confidence breakdown card, hands off to Epic A's review surface (full page).
- Failure states for both paths.

**B.5 — Re-entry via Hjälp menu**
- "Hjälp" sidebar entry that re-opens the modal in tutorial-only mode (path-choice and progress strip hidden, just the 6 tabs).
- Works for users who skipped the modal AND for users who want to refresh on a feature later.

### Schema changes

- `workspace.law_list_generation_status` — add `'skipped'` enum value.
- `workspace.first_run_dismissed_at` — new nullable timestamp column. Set on modal dismiss; null = never dismissed (modal shows on first visit).
- No new tables. No new RLS policies.

---

## MVP Cuts (if velocity demands)

- **B.3 minimum**: ship 3 tabs (Laglista, Uppgifter, AI-agenten) instead of 6. Add Kravpunkter / Kontroller / Lagändringar in a follow-up.
- **B.4 minimum**: skip the celebration card on 4a (just close the modal). Cheaper, less visual reward.
- **B.5 deferred**: ship without Hjälp re-entry. Users who skip can still discover features through navigation.

The pre-MVP B.0 gate is non-negotiable — the token waste argument funds it on its own.

---

## Out of Scope

- The in-app `/laglistor/skapa` create-list page. That's Epic A.6.
- A general-purpose "Hjälp center" or knowledge base. Hjälp menu re-opens *this specific modal*, nothing more.
- Localisation. All copy is Swedish; the wizard is Swedish-only today.
- Mobile-first design. Modal collapses gracefully but is not optimised for mobile-only signup. Web-first is fine.
- Analytics dashboard for path-choice rates. Telemetry events are emitted; reporting can come later.

---

## Open Questions

1. **Should B.0 include the import card at all** if Epic A is more than 4 weeks out? Showing a disabled "Kommer snart" card validates intent, but might also frustrate users who want it now. Alternative: show only Generate + Hoppa över, surface import once Epic A is live.
2. **Hjälp menu placement.** Top-right user dropdown? Sidebar? Both? Need a UX call.
3. **What replaces the modal on `/dashboard` for users who already have a laglista** (i.e., not first-run)? Current banner is fine. Confirm no change.
4. **Tab re-entry mode** — should it remember the last tab the user was on, or always start at tab 1? Probably remember, but small detail.
5. **How does the modal interact with the existing Story 16.4 generation banner?** Modal shows progress strip while open; banner shows when modal is closed. Need to confirm they don't double-render.

---

## Success Metrics

- **Token cost per signup** — should drop by N% post-B.0 (the import + skip slice no longer fires generation).
- **% of users who explore at least 2 tabs** in the first session — proxy for tutorial engagement.
- **% of signups dismissing the modal without choosing a path** — should be small; if large, the modal is felt as friction not value.
- **Time-to-first-laglista-action** — drop in median time from signup to first action (filter, assign, status change). Tutorial should accelerate this.

---

## Dependencies

- **Epic A (Import)** — B.1's import card un-disable, B.4's import handoff. B.0 ships without it (import card disabled).
- **Story 14.27 admin usage analytics** — already shipped. Used to validate the token-cost-drop hypothesis.
- **Story 16.4 `LawListGenerationProgress`** — already shipped. Reused as the progress-strip substrate.
