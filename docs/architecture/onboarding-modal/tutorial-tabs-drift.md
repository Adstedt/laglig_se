# Tutorial-Tab Drift Notes (Story 25.3, Task 0.5)

Per-tab decisions on how each preview was grounded — prototype layout, real-app chrome where they diverged, or hybrid.

**Audit method**: source code inspection of each real surface (no browser screenshots — Dev agent has no GUI). Real surfaces listed in AC 12.5 of the story.

---

## Tab 1 — Vad är en laglista? (`tab-laglista.tsx`)

**Prototype**: simple 4-row mock table with toolbar (search + 2 chips + Filter button), one group header (Miljö), each row showing law name + lagansvarig avatar + tone pill.

**Real app** (`components/features/document-list/grouped-document-list-table.tsx` + `document-list-table.tsx`): sticky-header virtual-scroll table with title column pinned-left, many columns (status, lagansvarig, datum, etc.), expand/collapse all controls in toolbar, full row hover states. ~30+ table-related components.

**Decision**: bias toward **prototype's simplified mock**. Reasoning: the real table is too dense for a 440px-tall preview — would feel cramped and dilute the "this is what your laws look like" message. Prototype's distillation (4 rows, 3 columns) is a better tutorial signal than a faithful but unreadable miniature of the real table.

**Real-app chrome adopted**: `bg-card` for the table card surface (real app uses `bg-background` for the card, `bg-muted` for the headers — keeping prototype's `bg-card`/`bg-warm/60` since the modal context is already warm-tinted).

---

## Tab 2 — Kravpunkter & bevis (`tab-kravpunkter.tsx`)

**Prototype**: checklist with 3 requirements, file chips for uploaded bevis, "Saknar bevis" warning row.

**Real app** (`components/features/document-list/legal-document-modal/kravpunkter-checklist.tsx` + `kravpunkter-accordion.tsx`): the real kravpunkter UI is inside the legal-document modal — accordion-style. Different visual paradigm from prototype's flat checklist.

**Decision**: **prototype's flat checklist wins** — accordion is for dense legal-document context; tutorial wants the simpler "see what kravpunkter look like" pattern. Real app's tone semantics (Saknar bevis → warning) preserved via the new `--tone-warning-soft-*` tokens.

---

## Tab 3 — Uppgifter (`tab-uppgifter.tsx`)

**Prototype**: 3-col Kanban (Att göra / Pågår / Klart), one task per column, one task with "AI-skapad" chip + linked-law badge.

**Real app** (`components/features/tasks/task-workspace/kanban-tab.tsx`): full DnD-kit board with Card components (`bg-muted/30` column bg, colored dot per column, Badge with count, Plus button), individual task Cards with priority borders, due-date indicators, drag handles.

**Decision**: **hybrid** — adopt the real-app's column visual style (`bg-muted/30` card, colored dot, count badge) but keep prototype's smaller per-task content (the real cards are too tall for a 3-column-in-440px preview). Drop the priority borders + drag handles (interaction is decorative anyway).

---

## Tab 4 — Kontroller (`tab-kontroller.tsx`)

**Prototype**: cycle detail with lead-auditor avatar header, progress pill (12/24 signerade), sub-tabs (Items / Findings / Rapport), signed/unsigned items.

**Real app** (`app/(workspace)/laglistor/kontroller/` + `components/features/compliance-audit/`): the kontroller surface is one of the newer features; the real cycle-detail view is still iterating. Real `lib/compliance-audit/` exists but a single full-page reference component for the cycle detail isn't obvious from the file list.

**Decision**: **prototype-as-spec** for now — kontroller is the most recently shipped surface and the prototype was likely authored AS the design source for the real app, so they should be close to identical. If real-app drift surfaces during the smoke pass, adjust before merging.

---

## Tab 5 — Lagändringar (`tab-lagandringar.tsx`)

**Prototype**: change card with bell-icon header, "Hög påverkan" pill, red/green diff block, AI-bedömning panel, Bedöm/Ej relevant CTAs.

**Real app**: live change-assessment is implemented as a FULL MODAL (`change-assessment-modal.tsx`) that mounts `<ChatPanel>` inside — interactive AI chat, not a static card. The "static representation" doesn't exist in the real app; users interact via the modal.

**Decision**: **prototype is the only honest source for a static preview** — the real app's interaction model (a chat modal) doesn't translate to a tutorial mock. Prototype's static change card is the right teaching signal. Diff colors use the new `--tone-danger-soft-*` (removed) + `--tone-success-soft-*` (added) tokens, matching the conventions Task 0 just established.

---

## Tab 6 — AI-agenten (`tab-ai-agent.tsx`)

**Prototype**: chat conversation preview — user bubble, expanded reasoning block, tool-call card with `searchLaws`, agent response with §-citation chips, suggested-task action card, input bar.

**Real app** (`components/features/ai-chat/*`): full chat UI with `chat-message.tsx`, `chat-input.tsx`, `chat-panel.tsx`, `streaming-indicator.tsx`, `citation-pill.tsx`, `followup-chips.tsx`. Real `citation-pill.tsx` is a useful reference for the §-citation chip styling in the preview.

**Decision**: **hybrid — prototype layout, real-app citation-pill style**. Adopt the real `<CitationPill>` visual treatment for the §-citation chips in the preview (without importing the component — keep static JSX per AC 12). Everything else from the prototype (bubble shapes, reasoning block, tool-call card, suggested-task action card) stays as the layout reference.

---

## Overall trade-off

All 6 panels are tutorial mocks, not pixel-perfect screenshots. Some divergence from the real app is unavoidable (a 440px tutorial preview can't reproduce a full-feature page faithfully). The bias has been: **distill the concept, preserve the chrome signals (token colors, typography weight, layout grid), accept some structural simplification**.

If users complain that "the tutorial shows X but the real app shows Y" for a specific tab, the lookup-map architecture in `index.ts` makes a tab-specific re-grounding a one-line revert + a new component swap.
