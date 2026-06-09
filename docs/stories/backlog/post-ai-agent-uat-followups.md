# Post-AI-Agent UAT Followups

## Status

Backlog rollup — captured during the `feat/ai-agent` UAT pass (2026-06-09).
Each section below is a future story stub. Promote any of them to a numbered
story file in `docs/stories/backlog/{frontend,backend,misc}/` when picked up.

All items are explicitly **non-blocking** for the `feat/ai-agent` PR merge.
They surfaced during UAT, were triaged, and the user signed off on deferring.

---

## FU-003: Mobile redesigns — workspace header, /filer 2-column, dashboard composer collision

### Story

**As a** mobile user,
**I want** the workspace header / file list / dashboard to lay out correctly on small viewports,
**so that** I can use the app on my phone without horizontal scroll or overlapping controls.

### Acceptance Criteria

1. Workspace header (top of every `(workspace)` route) reflows to a single-row mobile pattern below `md`.
2. `/filer` 2-column grid collapses to single column below `md` without truncating file metadata.
3. Dashboard composer (`/dashboard`) and adjacent widgets stop overlapping at narrow widths — verify against iPhone SE, iPhone 14 Pro, Pixel 6.

### Scope notes

- Three distinct surfaces, each a small redesign.
- Could be one story or three. Prefer three if any need design review separately.
- No backend changes.

### Effort

Frontend, ~1 day per surface.

---

## FU-005: IN_REVIEW vs DRAFT badge differentiation

### Story

**As a** document author or reviewer,
**I want** to tell at a glance whether a draft is in DRAFT or IN_REVIEW state,
**so that** I don't have to open the document to know whose action is pending.

### Acceptance Criteria

1. The composite badge in the styrdokument list + editor header visually distinguishes `draft_status === 'IN_REVIEW'` from `draft_status === 'DRAFT'`.
2. Distinction works in both light and dark mode and meets contrast guidelines.
3. The status copy stays as it is (Swedish) — only visual styling changes.

### Scope notes

- Touch points: `DocumentStatusBadge` (`components/features/documents/document-status-badge.tsx`) + any composite badge that wraps it (look for the `?view=approved` composite header). 
- Look at how the table row chip already renders status — match the pattern.

### Effort

Frontend, half-day.

---

## FU-008: `logo-icon-black.png` preloaded but unused

### Story

**As a** performance-conscious engineer,
**I want** to remove or correct the preload hint for `logo-icon-black.png`,
**so that** the browser doesn't fetch an asset it won't render on the current route.

### Acceptance Criteria

1. The "preloaded but unused" warning for `/images/logo-icon-black.png` no longer appears in a Lighthouse / Coverage audit on the route where it was originally observed.
2. The asset stays available to the routes that actually render it (`landing-v3/ai-comparison-section.tsx`, `landing-v3/hero-product-shot.tsx`, `landing-v3/hero-shot-views.tsx`).

### Scope notes

- A `grep` across `app/`, `components/`, `public/` finds NO `<link rel="preload">` in source, no `<Image priority>` referencing this asset, no web manifest. The warning likely comes from one of: (a) Next.js auto-prefetching a `<Link>` to a landing-v3 route from another page, (b) `next/image` priority inference on a small viewport, (c) a CSS `image-set()` rule. Reproduce the original Lighthouse audit first to localize, then fix.

### Effort

Investigation + fix, ~1 hour.

---

## FU-009: Favicon multi-size set

### Story

**As a** site visitor,
**I want** browser tabs / iOS bookmarks / Android home-screen icons to render at the right resolution,
**so that** the brand looks intentional everywhere.

### Acceptance Criteria

1. `app/icon.png` complemented with size variants per Next.js App Router conventions: 16×16, 32×32, 192×192, 512×512.
2. `app/apple-icon.png` (180×180) added.
3. `app/favicon.ico` provided for legacy fallback.
4. Verified in Chrome tab, Safari iOS "Add to home screen", Android Chrome "Install app".

### Scope notes

- Existing source asset: `app/icon.png` (size unknown). Likely needs design pass to ensure the icon scales cleanly to 16×16.
- Next.js supports `app/icon{1,2,...}.png` for multi-size handled automatically.
- Alternative: programmatic `app/icon.tsx` using `next/og` for one source of truth, but rasterized PNGs are simpler.

### Effort

Design + frontend, half-day (gated on icon asset).

---

## FU-010: Brand voice consistency sweep

### Story

**As a** product owner,
**I want** the in-app copy to use a consistent voice (tilltal, formality, terminology),
**so that** the product feels like one cohesive thing rather than several authors stitched together.

### Acceptance Criteria

1. Audit catalogue of every user-facing string in `(workspace)` routes flagged for voice drift.
2. Standardise: tilltal ("ni" vs "du"), terminology ("styrdokument" vs "policy" vs "dokument" within the same surface), tone (formal vs casual).
3. Update strings in-place; no architectural changes.

### Scope notes

- Cross-cuts every screen — best done as a focused sweep PR after the AI-agent PR lands.
- Prior session's system-prompt + assess_change skill already align the chat surface; this is the rest of the UI.

### Effort

PO + frontend, 1–2 days.

---

## FU-011: REL-001 atomicity hardening (cross-story)

### Story

**As an** engineer,
**I want** the multi-statement document-mutation paths to be atomic,
**so that** partial failures don't leave the DB in an inconsistent state.

### Acceptance Criteria

1. Inventory of write paths that issue 2+ Prisma mutations outside a single `$transaction`.
2. Each non-atomic path either (a) wrapped in a transaction, or (b) documented as intentionally non-atomic with a comment explaining why and what recovery looks like.
3. The 17.10b reindex pattern (write inside tx, embed in `after()` outside tx) stays as-is — that one is intentional.

### Scope notes

- Cross-story: touches Epic 17 (documents), Epic 14 (agent tool writes), Epic 21 (compliance audit cycles).
- Start with `app/actions/documents.ts` and `app/actions/compliance-audit-*.ts`.

### Effort

Backend audit + fixes, 2–3 days.

---

## FU-012: UX prose-leak guardrail (system-prompt remainder)

### Story

**As a** user reading the agent's prose,
**I want** to never see internal field names, tool names, enum codes, or system block identifiers,
**so that** the agent reads like a domain expert rather than a debugger.

### Acceptance Criteria

1. Audit remaining surfaces beyond the chat (toasts, error messages, validation messages, tooltips) for leaks of `PAGAENDE`-style enum codes, `lawListItemId`-style field names, `change_context`-style block names.
2. Translate every leak to natural Swedish.
3. Add a lint rule or unit test that fails the build if specific internal tokens appear in user-facing copy files.

### Scope notes

- This PR's commit `cec47105` already tightened the system-prompt + assess_change skill (the agent-chat surface). That covers the highest-volume leak path. Re-scope this story to the remainder once the chat-surface fix has been validated post-merge.

### Effort

Frontend + PO sweep, 1 day.

---

## FU-013: AGENT-001 reconciliation cron

### Story

**As an** operator,
**I want** a background reconciliation job that catches divergence between agent-proposed actions and their executed counterparts,
**so that** silent inconsistencies don't accumulate.

### Acceptance Criteria

1. Cron route at `/api/cron/reconcile-agent-actions` running on a schedule (TBD by ops — start daily).
2. Scans recent `AgentProposal` rows whose status is `APPROVED` but no corresponding side-effect can be traced via activity log within N minutes.
3. Emits a structured log + Sentry event per divergence; no auto-rollback in v1.
4. Idempotent — re-runs safely.

### Scope notes

- Small follow-up flagged during UAT smoke.
- Pattern mirrors `sweep-draft-reindex` (same auth gate, same `force-dynamic` + `maxDuration` shape).
- Production-only execution (Vercel crons don't fire on Preview).

### Effort

Backend, 1 day.

---

## Editor autosave race during discard

### Story

**As a** document author,
**I want** clicking "Förkasta utkast" to not race with a pending autosave,
**so that** I don't see "Kunde inte spara" errors immediately after discarding.

### Acceptance Criteria

1. When `handleDiscardDraft` fires, any in-flight or queued autosave timer is cancelled before the `discardDraft` server action runs.
2. The autosave debounce hook (`use-document-autosave`) exposes a cancel method that `DocumentEditor` calls from the discard / promote / reject / submit-for-review handlers.
3. UAT scenario: rapidly edit content → click "Förkasta utkast" → no "Kunde inte spara" toast surfaces.

### Scope notes

- 500 console error briefly surfaced during UAT as "Kunde inte spara".
- Separate from FU-001 (the version-number drift fix). The autosave fires AFTER the draft pointer is cleared → tries to update a now-orphaned version → server action errors.
- Same fix probably applies to "Promote to approved" and "Submit for review" — both also dereference the in-progress draft.

### Effort

Frontend, half-day.

---

## Change Log

| Date       | Version | Description                                    | Author       |
| ---------- | ------- | ---------------------------------------------- | ------------ |
| 2026-06-09 | 1.0     | Initial rollup from `feat/ai-agent` UAT pass  | Alexander A. |
