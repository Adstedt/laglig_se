# Architecture — First-Run Onboarding Modal (Epic B)

**Author:** Winston (Architect) — 2026-05-06
**Status:** Draft v1
**Source brief:** `docs/onboarding-first-run-brief.md`
**Sibling:** `docs/import-law-list-brief.md` (Epic A — Import pipeline; separate architecture doc when Epic A reaches arch phase)
**Scope:** Brownfield enhancement to `/dashboard`. Adds the path-choice + tutorial-while-waiting modal that gates the currently-silent auto-fire of law list generation.

> **Naming note:** PO will assign the official epic number when sharding the brief. Working name "Epic B"; doc named feature-first to avoid renumber churn.

---

## 1. Scope

This document covers **only** the post-signup first-run modal at `/dashboard`. It does NOT cover:

- The Epic A import pipeline (parsing, fuzzy + LLM matching, review surface) — that gets its own arch doc when Epic A reaches arch phase.
- The pre-signup onboarding wizard at `/onboarding` — unchanged.
- The in-app `/laglistor/skapa` create-list page (Epic A.6) — unchanged.

What it does cover:

- Schema additions (1 enum value, 1 column).
- Modal mount strategy and first-run trigger logic.
- Interaction with the existing `LawListGenerationProgress` banner (no functional change to the banner; modal sits alongside).
- "Hjälp" sidebar entry + re-entry semantics.
- Telemetry event shape.
- Component file organisation.
- Sequencing for B.0 (pre-MVP gate) → Epic B v1 (full modal).

---

## 2. Existing System Context

### 2.1 Relevant existing pieces

| Element | Path | What it does today |
|---|---|---|
| Dashboard server component | `app/(workspace)/dashboard/page.tsx` | Reads `getDashboardData`, `getUnacknowledgedChangeCount`, `workspace.law_list_generation_status`. Renders `<HemPage>`. |
| Hem page client wrapper | `components/features/dashboard/hem-page.tsx` | Client component. Hosts `<LawListGenerationProgress>` (top, conditional) + `<HemChat>` or `<ChangeAssessmentView>`. |
| Generation banner | `components/features/dashboard/law-list-generation-progress.tsx` | Polls `/api/workspace/generation-status` every 3s. Renders three states: in-progress (Card with step), completed (CompletedCard with dismiss), failed (FailedCard). |
| Generation API | `app/api/workspace/generate-law-list/route.ts` (POST) and `/api/workspace/generation-status` (GET, DELETE) | Kicks off generation, polls status, dismisses completed. |
| Workspace status field | `prisma/schema.prisma:Workspace.law_list_generation_status` (String?) | Free-form string today: `'pending' \| 'in_progress' \| 'completed' \| 'failed' \| null`. |
| Wizard → dashboard handoff | `app/onboarding/_components/confirm-step.tsx` → `createWorkspace()` | After workspace creation, fires generation API and redirects to `/dashboard`. **This is the silent auto-fire we are replacing.** |

### 2.2 Existing patterns we will follow

- **Server component → client wrapper.** Keep first-run detection on the server (in `dashboard/page.tsx`), pass props down. Client components only handle UI state.
- **SWR for polling.** `LawListGenerationProgress` uses SWR with a refresh interval. The modal's progress strip reuses the same SWR key so both surfaces render from one source of truth.
- **shadcn primitives.** `Dialog`, `Tabs`, `Card`, `Button`, `Switch` from `components/ui`. No bespoke modal chrome.
- **Brand fonts + tokens.** Safiro 500 (medium only) for headers, Google Sans Flex for body. Tone palette via `lib/ui/badge-tones.ts`. Warm off-white from `app/globals.css`. (See `feedback_safiro_weight_pairing.md`.)

### 2.3 Existing constraints

- **`Workspace.law_list_generation_status` is `String?` not an enum.** Adding new states is a copy-only change; no migration to a Prisma enum is needed (and would be out of scope).
- **No telemetry table for product events today.** `ChatUsageEvent` (Story 14.27) is for chat-cost telemetry only; `Activity` model is for audit-log activity. We need a separate `OnboardingEvent` table to avoid overloading either.
- **The wizard auto-fires generation via a `revalidatePath('/dashboard')` redirect.** This is the entry point we have to interrupt.

---

## 3. Enhancement Scope

### 3.1 Two-step rollout

| Slot | What ships | When |
|---|---|---|
| **Story B.0** | Minimal modal: 3 buttons (Generera / Importera (disabled) / Hoppa över), dismiss handling, schema additions. **Prevents the silent auto-fire.** | First — independent of Epic A. |
| **Story B.1–B.5** | Full modal: brand chrome, path-choice cards, kickoff confirm, tutorial-while-working with 6 tabs, done states (4a/4b), Hjälp menu re-entry. | After Epic A's review surface exists (B.4 hands off to it). |

B.0 is the **wedge** — it stops token waste and validates the modal pattern with minimal investment. Everything in B.1+ replaces B.0's UI but reuses its trigger logic, schema, and dismissal contract.

### 3.2 Integration impact

- **Low.** The modal is a new component mounted inside the existing `HemPage` client wrapper. The banner stays. No existing component is rewritten.
- **The wizard's auto-fire is the one breaking change.** `confirm-step.tsx` no longer fires `POST /api/workspace/generate-law-list` automatically — it just creates the workspace and redirects to `/dashboard`. The modal becomes the user-facing trigger.
- **Backwards-compat note:** existing workspaces (created pre-Epic-B) already have `law_list_generation_status` set to one of `'pending' | 'in_progress' | 'completed' | 'failed'` or null. If null AND `first_run_dismissed_at` is null AND workspace age < 24h, modal opens. Otherwise it does not. This handles every edge case (re-signin, multi-workspace, deep-link) without explicit migration.

---

## 4. Tech Stack — No Additions

All work uses the existing stack:

| Category | Technology | Already in use? |
|---|---|---|
| UI primitives | shadcn/ui (`Dialog`, `Tabs`, `Card`, `Switch`) | Yes |
| Icons | `lucide-react` | Yes |
| Data fetching | SWR | Yes |
| Forms / state | React useState, native form | Yes |
| Polling | SWR `refreshInterval` | Yes — same pattern as `LawListGenerationProgress` |
| Prisma | Existing | Yes |
| Server actions | `app/actions/*` pattern | Yes — new file `app/actions/onboarding-modal.ts` |

**No new dependencies.** Everything composes from primitives we already ship.

---

## 5. Data Model & Schema Changes

### 5.1 Workspace table — 2 column changes

```prisma
model Workspace {
  // ... existing fields ...

  // CHANGE: extend status semantics. No enum migration; this is String? today.
  // New possible value: 'skipped' (user explicitly opted out of generation).
  // Keeps existing 'pending' | 'in_progress' | 'completed' | 'failed' | null.
  law_list_generation_status String?

  // NEW: timestamp set when user closes / minimises the first-run modal.
  // null = never closed (first-run modal auto-opens on dashboard visit).
  // not null = modal does not auto-open again, but corner FAB stays available.
  first_run_dismissed_at     DateTime?

  // NEW: timestamp set when user dismisses the corner FAB itself.
  // null = FAB is eligible to render (subject to other guards).
  // not null = FAB never renders; tutorial only reachable via Hjälp sidebar.
  // This is the user's "I'm done with this tutorial" signal — distinct from
  // simply minimising the modal back to the corner.
  tutorial_fab_dismissed_at  DateTime?

  // NEW (Story B.5 — defer to Epic B v1, NOT B.0):
  // tracks which tutorial tabs the user has viewed.
  // Stored as a JSONB array of tab IDs: `["laglista", "kravpunkter", ...]`.
  // Used by FAB unread indicator + tutorial-only mode to optionally pick up
  // where the user left off.
  first_run_tabs_viewed      Json?      @default("[]")
}
```

**Migration name (proposed):** `add_first_run_modal_columns`

**RLS:** No change. Existing workspace RLS policies cover both new columns.

### 5.2 OnboardingEvent table — new (Story B.0 ships skeleton, Epic B fills events)

```prisma
model OnboardingEvent {
  id           String   @id @default(cuid())
  workspace_id String
  user_id      String
  event_type   String   // 'modal_opened' | 'path_chosen' | 'tab_viewed' | 'modal_dismissed' | 'modal_reopened'
  payload      Json?    // event-specific data — path, tab_id, etc.
  created_at   DateTime @default(now())

  workspace    Workspace @relation(fields: [workspace_id], references: [id], onDelete: Cascade)
  user         User      @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([workspace_id, created_at])
  @@index([event_type])
}
```

**Why a separate table, not piggyback on `Activity`?**
- `Activity` is the user-facing audit log. Onboarding events are product analytics, not audit-log entries — surfacing them in the activity feed would be noise.
- `ChatUsageEvent` (Story 14.27) is cost-only. Same reasoning.
- Separate table = clean admin queries, clean retention story (we can prune old onboarding events independently).

**Event shapes:**

| `event_type` | `payload` shape |
|---|---|
| `modal_opened` | `{ trigger: 'first_run' \| 'fab' \| 'help_menu' }` |
| `path_chosen` | `{ path: 'generate' \| 'import' \| 'skipped' }` |
| `tab_viewed` | `{ tab_id: 'laglista' \| 'kravpunkter' \| 'uppgifter' \| 'kontroller' \| 'lagandringar' \| 'ai_agent' }` |
| `modal_minimised` | `{ from_state: 'path_choice' \| 'kickoff' \| 'tutorial' \| 'done' \| 'tutorial_only' }` |
| `fab_dismissed` | `{ from_state: 'visible_idle' \| 'visible_working' \| 'visible_done' }` |
| `feedback_submitted` | `{ sentiment: 'positive' \| 'negative', message?: string }` *(future — see §14)* |

**Fail-safe pattern:** event writes wrapped in try/catch, logged as `[ONBOARDING_EVENT_WRITE_FAIL]` via `console.error`, never re-thrown. (Mirrors Story 14.27's pattern at `app/api/chat/route.ts`.)

---

## 6. Component Architecture

### 6.1 New components

```
components/features/onboarding-modal/
├── first-run-modal.tsx                  # Top-level Dialog wrapper, owns mode + visibility state
├── onboarding-fab.tsx                   # Floating action button bottom-right; primary re-entry
├── path-choice-step.tsx                 # Step ① — two cards + Hoppa över
├── generate-kickoff-step.tsx            # Step ②a — confirm summary + Starta generering CTA
├── import-upload-step.tsx               # Step ②b — Epic A's upload UI (or stub if A not ready)
├── tutorial-step.tsx                    # Step ③ — progress strip (conditional) + tabs container
├── tutorial-tabs/
│   ├── index.ts
│   ├── tab-laglista.tsx                 # Tab 1 content
│   ├── tab-kravpunkter.tsx              # Tab 2 content
│   ├── tab-uppgifter.tsx                # Tab 3 content
│   ├── tab-kontroller.tsx               # Tab 4 content
│   ├── tab-lagandringar.tsx             # Tab 5 content
│   └── tab-ai-agent.tsx                 # Tab 6 content
├── done-generate-step.tsx               # Step ④a — celebrate + reveal CTA
├── done-import-step.tsx                 # Step ④b — confidence breakdown + handoff CTA
├── progress-strip.tsx                   # Reusable strip; wraps LawListGenerationProgress data
└── help-menu-trigger.tsx                # Sidebar entry — fallback after FAB dismissed
```

**Re-entry layer hierarchy** (one of these is always available):
1. **First-run auto-open** — workspace eligible per §6.4 guards.
2. **Corner FAB** (`onboarding-fab.tsx`) — visible after any modal close until user dismisses the FAB itself. Primary post-onboarding entry point.
3. **Hjälp sidebar entry** (`help-menu-trigger.tsx`) — last fallback after FAB dismissed; always available regardless of state.

**Why a dedicated `onboarding-modal/` folder, not inside `dashboard/`?**
The modal is conceptually a flow, not a dashboard widget. Mixing it into `dashboard/` would muddy the boundary. The folder name mirrors the wizard's `app/onboarding/_components/` while staying outside the route tree (because the modal mounts inside the dashboard page, not at its own route).

**Why split each step into its own file?**
Each step is independently testable and has different state ownership. Step ③ alone is ~300+ lines once tab content is in. Co-locating tab content under `tutorial-tabs/` keeps the parent component a thin orchestrator.

### 6.2 State machine

Modal has two orthogonal axes — **visibility** (open/minimised) and **mode** (which step). FAB visibility is derived from schema state, not modal state.

```
Visibility   = 'open' | 'minimised'
Mode         = 'path_choice' | 'kickoff' | 'import_upload'
             | 'tutorial' | 'tutorial_only'
             | 'done_generate' | 'done_import'

FabVisible   = first_run_dismissed_at IS NOT NULL
             AND tutorial_fab_dismissed_at IS NULL
             AND law_list_generation_status != 'skipped'

Mode transitions:
  path_choice    → kickoff           (user picks "Generera ny lista")
  path_choice    → import_upload     (user picks "Importera befintlig")  [Epic A]
  path_choice    → (close + skip)    ("Hoppa över"; sets generation_status='skipped',
                                      first_run_dismissed_at=NOW(); FAB hidden)
  kickoff        → tutorial          (user clicks "Starta generering")
  import_upload  → tutorial          (user submits import)
  tutorial       → done_generate     (SWR sees status='completed', came from generate)
  tutorial       → done_import       (Epic A signals matching done)
  done_*         → tutorial_only     (user clicks "Fortsätt utforska" or auto after N seconds)
  done_*         → (close)           (user clicks primary navigate-away CTA)

Visibility transitions:
  open           → minimised         (X / Minimera click; sets first_run_dismissed_at)
  minimised      → open              (FAB click; opens at last mode, OR tutorial_only if work done)

Re-entry from outside the modal:
  FabVisible AND user clicks FAB             → opens modal at last mode
  FAB dismissed, user clicks Hjälp menu      → opens modal at tutorial_only mode
```

**Key design points:**

- **Minimise is the default close.** The X button on the modal is "minimise to corner" — not "destroy". `first_run_dismissed_at` records that the modal has been seen at least once, but the FAB stays visible.
- **`tutorial_only` mode** strips the progress strip from `tutorial-step.tsx` (conditional render based on whether work is still running). Same component, different sub-rendering.
- **Done states transition to `tutorial_only`** rather than directly to closed. After celebrating completion, the user can keep exploring the tutorial — they don't lose access just because the work finished.
- **"Hoppa över" is the only path that hides the FAB.** Skipping means the user wants nothing; we don't pester them with a corner widget.

State lives in `first-run-modal.tsx`. Steps are pure presentation; they receive callbacks for transitions. FAB visibility is derived server-side and passed as a prop.

### 6.3 Mounting

```tsx
// app/(workspace)/dashboard/page.tsx — server component
const onboardingState = await getOnboardingState(context.workspaceId)
// returns { firstRunOpen: boolean, fabVisible: boolean, modeHint: ModalMode }

return (
  <HemPage
    {...existingProps}
    onboardingState={onboardingState}
  />
)
```

```tsx
// components/features/dashboard/hem-page.tsx — client wrapper
{onboardingState.firstRunOpen && <FirstRunModal initialMode="path_choice" />}
{onboardingState.fabVisible && <OnboardingFab />}
{showGenerationProgress && <LawListGenerationProgress ... />}
```

**Three surfaces, one data source.** The modal owns full attention when open. The FAB is the docked re-entry when minimised. The banner is the inline fallback for users who never engaged with the modal at all (edge case: support manually set `first_run_dismissed_at` for them, or workspace pre-dates Epic B). All three read from the same SWR key for generation status — no double-fetching.

**The modal supersedes the banner.** When the modal is open, the banner is hidden (the modal's own progress strip is the source of truth). When minimised, the FAB takes the foreground role; the banner can either hide or remain depending on UX call (defer to B.5 — my recommendation: hide banner whenever FAB is visible, since the FAB already signals "work in progress").

### 6.4 Onboarding state — derived server-side

One function returns everything the dashboard needs to render the right onboarding surface:

```ts
// lib/onboarding/get-onboarding-state.ts
export type OnboardingState = {
  firstRunOpen: boolean      // true → auto-open modal at path_choice
  fabVisible: boolean        // true → render OnboardingFab
  fabState: 'working' | 'done' | 'idle' // affects FAB visual + tooltip
}

export async function getOnboardingState(workspaceId: string): Promise<OnboardingState> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      created_at: true,
      first_run_dismissed_at: true,
      tutorial_fab_dismissed_at: true,
      law_list_generation_status: true,
    },
  })
  if (!ws) return { firstRunOpen: false, fabVisible: false, fabState: 'idle' }

  const ageMs = Date.now() - ws.created_at.getTime()
  const FRESH = ageMs <= 24 * 60 * 60 * 1000

  // First-run auto-open: workspace fresh, never dismissed, no path chosen yet.
  const firstRunOpen =
    FRESH &&
    ws.first_run_dismissed_at === null &&
    ws.law_list_generation_status === null

  // FAB visible: modal has been seen at least once, FAB itself not dismissed,
  //              and user did not explicitly skip the whole flow.
  const fabVisible =
    ws.first_run_dismissed_at !== null &&
    ws.tutorial_fab_dismissed_at === null &&
    ws.law_list_generation_status !== 'skipped'

  // FAB visual:
  //   'working' → spinner + "Genererar laglista..."
  //   'done'    → lightbulb + "Tutorial"
  //   'idle'    → lightbulb + "Tutorial" (same as done; included for symmetry)
  const fabState: OnboardingState['fabState'] =
    ws.law_list_generation_status === 'pending' || ws.law_list_generation_status === 'in_progress'
      ? 'working'
      : ws.law_list_generation_status === 'completed'
        ? 'done'
        : 'idle'

  return { firstRunOpen, fabVisible, fabState }
}
```

**Guard rationale:**
- `firstRunOpen` requires fresh workspace (24h cap), no prior dismissal, no path chosen — same three guards as v0, just renamed.
- `fabVisible` requires *exactly* the inverse of two of those — the modal HAS been dismissed (so we want re-entry available) AND the user didn't explicitly skip (so we're not pestering opt-outs).
- The 24h cap deliberately does NOT apply to `fabVisible`. Once the user is in the loop, the FAB stays as long as they want it.

**Hjälp menu** does not consult schema — it's always rendered in the sidebar, always opens the modal at `tutorial_only` mode. It's the unconditional fallback.

### 6.5 Re-entry — three layers

| Layer | Surface | Condition | Opens modal at |
|---|---|---|---|
| 1 | First-run auto-open | `firstRunOpen === true` (fresh workspace, no dismissal, no path) | `path_choice` |
| 2 | Corner FAB | `fabVisible === true` (post-first-dismiss, FAB itself not dismissed, not skipped) | Last mode if work running; `tutorial_only` if done |
| 3 | Hjälp sidebar | Always | `tutorial_only` |

**FAB behaviour:**

- Renders bottom-right of `/dashboard` (and any workspace route — use `app/(workspace)/layout.tsx` mount or a sidebar slot).
- Visual depends on `fabState`:
  - `working` — spinner + "Genererar laglista..." pill, mild pulse animation.
  - `done` / `idle` — lightbulb-help icon + "Tutorial" tooltip, static.
- Click → opens modal at smart-default mode (last mode if known via session storage; else `tutorial` if work running, `tutorial_only` if work done).
- Tiny X on the FAB hover-state → calls `dismissOnboardingFab()` action → sets `tutorial_fab_dismissed_at`. From then on, only the Hjälp menu re-opens the modal.

**Why URL params for the Hjälp menu (not for the FAB):**
- FAB is in-page, no need for URL routing — local state is fine.
- Hjälp menu uses `?onboarding=tutorial[&tab=ai_agent]` → shareable, deep-linkable, survives reload. Useful for support ("click here to re-watch the AI tutorial").
- URL is replaced (not pushed) on close so onboarding state doesn't pollute browser history.

---

## 7. API Design

### 7.1 New server actions (in `app/actions/onboarding-modal.ts`)

```ts
// Modal close (X / Minimera click).
// Sets first_run_dismissed_at=NOW(); FAB takes over as re-entry.
// This is the DEFAULT close behaviour — minimise, not destroy.
export async function minimiseFirstRunModal(): Promise<void>

// "Hoppa över — bygg manuellt" button on path_choice step.
// Sets law_list_generation_status='skipped' AND first_run_dismissed_at=NOW().
// FAB stays hidden because skipped state implies user wants nothing.
export async function skipLawListGeneration(): Promise<void>

// X on the FAB itself.
// Sets tutorial_fab_dismissed_at=NOW(). Modal still reachable via Hjälp menu.
export async function dismissOnboardingFab(): Promise<void>

// Append a tab_id to first_run_tabs_viewed. Idempotent.
// Called from tutorial-step on tab change.
export async function recordTabViewed(tabId: string): Promise<void>

// Record an OnboardingEvent. Fire-and-forget.
export async function recordOnboardingEvent(
  eventType: string,
  payload?: Record<string, unknown>,
): Promise<void>

// FUTURE — feedback loop on the same modal substrate. See §14.
// export async function submitOnboardingFeedback(
//   sentiment: 'positive' | 'negative',
//   message?: string,
// ): Promise<void>
```

All actions use the existing `withWorkspace(cb)` wrapper for auth + workspace context. No new permission scopes — actions only touch the user's own workspace.

### 7.2 No new HTTP routes

Existing `/api/workspace/generate-law-list` (POST) and `/api/workspace/generation-status` (GET, DELETE) are reused unchanged. Modal calls them via the same SWR key as the banner does today.

---

## 8. Source Tree Additions

```
laglig_se/
├── app/
│   ├── (workspace)/
│   │   └── dashboard/
│   │       └── page.tsx                      # Modified — adds shouldShowFirstRunModal call
│   ├── actions/
│   │   └── onboarding-modal.ts               # NEW
│   └── onboarding/
│       └── _components/
│           └── confirm-step.tsx              # Modified — drops auto-fire of generate-law-list
├── components/
│   └── features/
│       ├── dashboard/
│       │   └── hem-page.tsx                  # Modified — accepts firstRunModalOpen, mounts FirstRunModal
│       └── onboarding-modal/                 # NEW (entire folder)
│           ├── first-run-modal.tsx
│           ├── path-choice-step.tsx
│           ├── generate-kickoff-step.tsx
│           ├── import-upload-step.tsx
│           ├── tutorial-step.tsx
│           ├── tutorial-tabs/
│           │   ├── index.ts
│           │   └── tab-*.tsx (×6)
│           ├── done-generate-step.tsx
│           ├── done-import-step.tsx
│           ├── progress-strip.tsx
│           └── help-menu-trigger.tsx
├── lib/
│   └── onboarding/
│       └── should-show-first-run-modal.ts    # NEW
└── prisma/
    ├── schema.prisma                         # Modified — Workspace + OnboardingEvent
    └── migrations/
        └── 20260507000000_add_first_run_modal_columns/
            └── migration.sql                 # NEW
```

### Integration guidelines

- **File naming.** `kebab-case.tsx` for components (matches existing `law-list-generation-progress.tsx`).
- **Folder naming.** `feature-name/` for features (matches existing `dashboard/`, `compliance-audit/`, etc.).
- **Imports.** Use `@/components/...` aliases consistently.
- **Server vs. client.** Page-level files server by default; UI components opt into `'use client'`. The modal and all step components are `'use client'`.

---

## 9. Sequencing — B.0 First, Epic B Second

### Story B.0 — Path-choice gate (ships standalone)

**Schema:** All three column additions (`first_run_dismissed_at`, `tutorial_fab_dismissed_at`, `first_run_tabs_viewed`) + the `OnboardingEvent` table skeleton.

**Components:** `first-run-modal.tsx` and `path-choice-step.tsx`. **No FAB in B.0** — FAB only makes sense once there's tutorial content to re-open, which arrives in B.3. No tabs, no kickoff, no done states. Three buttons:

1. **Generera laglista nu** → fires existing `POST /api/workspace/generate-law-list`, calls `minimiseFirstRunModal()`, banner takes over.
2. **Importera befintlig (Kommer snart)** → records `path_chosen={path:'import'}`, calls `minimiseFirstRunModal()`, shows toast: "Vi mejlar dig när importen är klar att använda." Workspace stays in `law_list_generation_status=null` (no generation fired).
3. **Hoppa över — bygg manuellt** → calls `skipLawListGeneration()`, modal closes.

**Wizard change:** `confirm-step.tsx` stops calling generate-law-list automatically. Workspace lands on `/dashboard` with status=null, modal opens.

**Effort estimate:** ~1.5 days. Single component, single action file, one prisma migration.

### Stories B.1–B.5 — Full modal (after Epic A.4 ships)

| Story | What it ships |
|---|---|
| B.1 | Replace B.0's plain card with full Dialog chrome (brand bar, dim/blur, modal shadow). Path-choice cards upgraded to recommended-chip + hover-lift design. Import card un-disabled when Epic A is live. |
| B.2 | `progress-strip.tsx` + `tutorial-step.tsx` shell. Reuses `LawListGenerationProgress` SWR key. Tab navigation chrome ("X av 6" counter, scroll on narrow viewports). Minimera affordance. |
| B.3 | All 6 tab content panels. Each tab is its own file under `tutorial-tabs/`. Records `tab_viewed` events. **Can split into B.3a (3 tabs) + B.3b (3 tabs)** if velocity demands — drop Kontroller, Lagändringar, AI-agenten to a follow-up. |
| B.4 | `done-generate-step.tsx` + `done-import-step.tsx`. Generate path: sage success ring, group-breakdown chips, "Visa min laglista →". Import path: confidence breakdown card, hand-off CTA → Epic A.4 review surface. |
| B.5 | **Re-entry layers + tutorial-only mode.** `onboarding-fab.tsx` (corner FAB with three visual states: working / done / idle, tiny X to dismiss). `help-menu-trigger.tsx` sidebar entry as fallback after FAB dismissed. `tutorial_only` mode in `tutorial-step.tsx` (hides progress strip, just renders tabs). URL-driven Hjälp re-entry (`?onboarding=tutorial[&tab=...]`). Wires `first_run_tabs_viewed` for FAB unread indicator. |
| B.6 *(future)* | **Feedback loop on the same modal.** New `feedback-step.tsx` step + `submitOnboardingFeedback` server action. Surfaces as either a 7th "Feedback" tab or a banner above tutorial content. Reuses `OnboardingEvent` (`feedback_submitted` event type — already in §5.2 table). No new schema. See §14. |

---

## 10. Coding Standards (existing — confirming)

- **TypeScript strict.** No `any`, prefer `unknown` + narrowing. Existing `tsconfig.json` already enforces.
- **Prettier + ESLint.** Existing config. New files inherit.
- **Server actions.** Follow `withWorkspace(cb, scope?)` wrapper pattern. Onboarding-modal actions use no permission scope (workspace-self-write only).
- **Error handling.** Telemetry writes never throw. User-facing errors surface via `toast.error(...)` from `sonner`.
- **Comments.** Default to none. Only add when WHY is non-obvious — see project CLAUDE.md.
- **Safiro pairing.** Headers `font-safiro` + `font-medium` only. Never `font-bold` / `font-semibold`. (See `feedback_safiro_weight_pairing.md`.)

---

## 11. Testing Strategy

### Unit (Vitest, existing)

- `lib/onboarding/should-show-first-run-modal.ts` — pure function, easy to cover. Test all four guard branches.
- Server actions in `app/actions/onboarding-modal.ts` — mock Prisma, assert column writes + event records.

### Component (Vitest + React Testing Library, existing)

- `path-choice-step.tsx` — three buttons, three callbacks fire correctly.
- `first-run-modal.tsx` — state machine transitions, mode prop overrides.
- `tutorial-step.tsx` — tab switch records events, tab-viewed list updates.

### Integration (Playwright, existing)

- New scenario: signup → workspace created → first dashboard visit → modal opens → click "Hoppa över" → modal closes → banner does NOT show → reload → modal does NOT re-open.
- New scenario: signup → click "Generera" → modal closes → banner appears → wait for completion → banner shows completed card.
- B.5 scenario: dismiss modal → click Hjälp menu → modal opens in tutorial mode (no path-choice) → close → URL param cleared.

### Regression coverage to maintain

- Existing `LawListGenerationProgress` component tests — must still pass unchanged.
- Existing wizard tests in `tests/unit/components/onboarding/confirm-step.test.tsx` — needs update for the auto-fire removal. Story B.0 includes this test edit.

---

## 12. Security & Privacy

- **No new auth surface.** All actions go through `withWorkspace(cb)`; existing CSRF + session checks apply.
- **No new RLS policies.** Both new columns are on `Workspace`; existing RLS covers them. `OnboardingEvent` gets a workspace-scoped policy mirroring `Activity`.
- **No PII in `OnboardingEvent.payload`.** Tab IDs, path choices, modal states only. Add a code-review checklist note: any field added to a payload must be reviewed for PII leakage.
- **Audit log impact:** none. Onboarding events do not write to `Activity`.

---

## 13. Rollback Strategy

- **B.0 rollback:** revert the wizard change (re-enable auto-fire), feature-flag the modal off, leave schema columns in place. Dropping columns later is not free, but adding them was — so leaving them is fine.
- **No feature flag scaffolded today.** If we want one, add `lib/feature-flags/onboarding-modal.ts` with a static const for now (matches existing flag pattern in the repo). Production rollback then becomes a one-line code change + deploy.
- **Schema rollback:** if either column proves harmful, set everywhere to its default (`first_run_dismissed_at = NOW()` for everyone, modal never opens). Drop in a follow-up migration if truly unwanted.

---

## 14. Open Questions for PO

1. **Epic numbering.** I've named the doc `first-run-onboarding-modal.md` (no number). PO assigns the official epic number when they shard the brief into the registry — likely 24 (Import) and 25 (this), but I'm not committing to those.
2. **Hjälp menu placement.** Sidebar bottom? Top-right user dropdown? Both? Affects B.5 only — defer the call.
3. **First-run age cap.** I picked 24h as the defensive cap. Could be 7 days (gives more re-signin tolerance) or 1h (tighter). 24h is the safe middle.
4. **FAB scope.** Render only on `/dashboard`, or on every workspace route? My take: every workspace route (so users can re-open tutorial mid-task), but the visual gets less prominent on non-dashboard pages — small icon, no expanded "Genererar laglista..." pill text.
5. **Banner ↔ FAB visibility.** When FAB is visible, should we also render the existing dashboard banner? My recommendation: hide banner when FAB is visible (FAB already signals work-in-progress). PM call.
6. **`OnboardingEvent` retention.** No prune policy needed at v1 (low write volume, ~5 events per signup). Worth a 90-day prune cron at scale.
7. **Tutorial-only mode tab seeding.** When user re-opens via Hjälp menu, start at tab 1 always, OR pick up at last viewed tab? I'd default to tab 1 for predictability; PM can call.

### Future extension — feedback loop (post-B.5)

The user has flagged a feedback loop as a desired follow-on. The architecture supports it without schema changes:

- **Surface:** Either a 7th "Feedback" tab in the tutorial-tabs strip, or a banner above tutorial content saying "Hur går det? Skicka feedback" with thumbs up/down + optional free-text.
- **Trigger:** Could fire passively (visible after N tab views, or after path completion), or actively (modal re-opens with feedback step after a delay).
- **Storage:** `OnboardingEvent` table already accommodates this — `event_type='feedback_submitted'`, `payload={sentiment, message}`. No new table.
- **Server action:** `submitOnboardingFeedback(sentiment, message?)` — already stubbed (commented) in §7.1.
- **Story slot:** B.6 in the sequencing table.

When PO is ready to scope this, the architectural lift is small: one new step component, one new action, copy work. The hard part will be deciding *when* to surface it without feeling like a modal-overlay-on-modal-overlay nag.

---

## 15. Story-Manager Handoff

**Prompt for SM:**

> First-run onboarding modal architecture is at `docs/architecture/first-run-onboarding-modal.md`. Brief: `docs/onboarding-first-run-brief.md`. Two epics scoped — Epic A (Import) ships first, Epic B (this modal) wraps it. Pre-MVP wedge is **Story B.0 (path-choice gate)** which ships independently.
>
> Start with Story B.0. Section 9 of the architecture has the exact scope: schema additions (1 enum value + 2 columns + `OnboardingEvent` table skeleton), `first-run-modal.tsx` with `path-choice-step.tsx` only, server actions in `app/actions/onboarding-modal.ts`, removal of the wizard's auto-fire in `confirm-step.tsx`. Effort estimate ~1.5 days.
>
> Key integration check during B.0: existing `LawListGenerationProgress` tests must pass unchanged. Existing wizard tests need update for the auto-fire removal — that's part of B.0's scope.
>
> B.1–B.5 wait for Epic A.4 (review surface) since B.4 hands off to it.

## 16. Developer Handoff

**Prompt for Dev (when implementing B.0):**

> Implementing Story B.0 from `docs/architecture/first-run-onboarding-modal.md`.
>
> 1. **Schema first.** Add three columns to `Workspace`: `first_run_dismissed_at` (DateTime?), `tutorial_fab_dismissed_at` (DateTime?), `first_run_tabs_viewed` (Json default `[]`). Add `OnboardingEvent` model per §5.2. Generate one migration: `add_first_run_modal_columns`. **Do not** rename `law_list_generation_status` to a Prisma enum — keep it `String?`. The `'skipped'` value is just a new accepted string, not an enum migration.
> 2. **Server actions next.** Create `app/actions/onboarding-modal.ts` with the five functions in §7.1: `minimiseFirstRunModal`, `skipLawListGeneration`, `dismissOnboardingFab`, `recordTabViewed`, `recordOnboardingEvent`. Use `withWorkspace(cb)` wrapper. Telemetry writes wrapped in try/catch.
> 3. **State derivation.** `lib/onboarding/get-onboarding-state.ts` — pure function returning `{firstRunOpen, fabVisible, fabState}` per §6.4. Test all derivation branches.
> 4. **Modal shell.** `components/features/onboarding-modal/first-run-modal.tsx` + `path-choice-step.tsx`. Use `Dialog` from `components/ui`. Three buttons → three handlers (`generate` → fire gen API + minimise; `import` → record event + minimise + toast; `skip` → call `skipLawListGeneration`). **No FAB in B.0** — FAB ships in B.5.
> 5. **Dashboard wiring.** Modify `app/(workspace)/dashboard/page.tsx` to call `getOnboardingState` and pass result to `<HemPage>`. Modify `hem-page.tsx` to mount `<FirstRunModal>` when `onboardingState.firstRunOpen === true`.
> 6. **Wizard change.** Remove the auto-fire of `POST /api/workspace/generate-law-list` from `app/onboarding/_components/confirm-step.tsx`. Update existing test to assert the call is NOT made.
> 7. **Smoke check.** Manual: sign up → land on dashboard → modal opens → click each button → verify post-conditions (status set correctly, `first_run_dismissed_at` set, modal stays closed on reload).
>
> Do not build tab content, kickoff confirm, done states, or the FAB in B.0 — those are B.1+. The import button stays disabled with "Kommer snart" badge until Epic A.4 ships.
