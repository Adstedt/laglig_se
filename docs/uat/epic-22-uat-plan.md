# Epic 22 — UI Primitives Alignment UAT Plan

**Status:** Ready for UAT — 2026-04-29
**Author:** Quinn (Test Architect) + James (Dev)
**Scope:** Validate that the four primitive consolidation stories (22.1 Badge tones, 22.2 FilterChip, 22.3 PageHeader/TableToolbar, 22.4 shadcn Table) deliver consistent rendering across all six workspace tabular surfaces + their modals before promoting Epic 22 to production.

---

## 0. Pre-flight

**Environments:**
- Run UAT against staging or a dedicated test workspace in production. Workspace data is non-mutating for this UAT (pure visual / a11y verification).
- Confirm dev server reflects latest branch tip: `git log --oneline -1 origin/feat/epic-22-ui-primitives-alignment` should match `9290212` or later.
- Tailwind needs a fresh build pass after `tailwind.config.ts` changes — restart `pnpm dev` if you've been running an older session.

**Test data prerequisites:**
- A workspace with ≥ 1 laglista populated (Almåsa Havshotell AB satisfies this).
- ≥ 1 cycle in PAGAENDE state and ≥ 1 cycle in AVSLUTAD state for cycle-detail surface coverage.
- ≥ 1 task with each priority value (LOW / MEDIUM / HIGH / CRITICAL) on `/tasks`.
- ≥ 1 styrdokument in each status (Utkast / Under granskning / Godkänd / Ersatt / Arkiverad) on `/workspace/styrdokument`.

**Tooling:**
- DevTools Inspector open (you'll be checking computed styles + ARIA attributes).
- Test in BOTH light and dark theme — toggle via OS preference or any in-app theme switcher. The dual-theme correctness is a Story 22.1 v0.2 fix (the v0.1 release shipped dark-only and broke light theme contrast).
- Optional: axe DevTools / Lighthouse for the a11y check in §6.

**Source of truth for "correct":**
- **Tone × variant matrix:** `lib/ui/badge-tones.ts` `BADGE_TONES` constant — 5 tones × 3 variants × 2 themes = 30 cells. Each pill on every surface must match its enum's mapping.
- **Prototype:** `_prototypes/ui-alignment-prototype.html` — visual reference for the "after" state of each primitive.
- **Stories' Acceptance Criteria:** `docs/stories/completed/22.{1,2,3,4}.*.md`.

---

## 1. Story 22.1 — Badge tone primitive + Priority enum alignment

| # | Action | Expected | Surface |
|---|---|---|---|
| 1.1 | Open `/laglistor`, expand all groups | Each row's "Status" cell renders the compliance pill with the correct tone: EJ_PABORJAD slate-soft, PAGAENDE blue-soft (label "Delvis uppfylld"), UPPFYLLD emerald-soft, EJ_UPPFYLLD rose-soft, EJ_TILLAMPLIG slate-outline (bordered, transparent bg, **NO strikethrough**) | Laglistor |
| 1.2 | Same row — "Prioritet" cell | LOW slate-soft, MEDIUM amber-soft, HIGH rose-soft. **Compare side-by-side with /tasks** — `Hög` and `Medel` must look BYTE-IDENTICAL on both surfaces (the audit-found "Hög rose vs orange" drift). | Laglistor |
| 1.3 | Open `/tasks?tab=lista` | Priority column: LOW slate, MEDIUM amber, HIGH rose, CRITICAL solid-rose. **`Medel` label**, NEVER `Medium` (Swedish-only display; DB enum stays English). | Tasks |
| 1.4 | Open `/laglistor/kontroller` | Cycle status pills in rows: PLANERAD slate-soft, PAGAENDE blue-soft (label "Pågående" — note the difference from compliance-status PAGAENDE which says "Delvis uppfylld"), AVSLUTAD emerald-soft. `data-status` attribute preserved on each badge for any e2e selectors. | Kontroller list |
| 1.5 | Drill into an AVSLUTAD cycle (e.g. "Testkontroll 2") → header | Title shows `Avslutad` badge inline (emerald-soft). | Cycle detail |
| 1.6 | Switch to Anmärkningar tab — finding rows | Type pills: AVVIKELSE rose-soft, OBSERVATION amber-soft, FORBATTRING blue-soft (uppercase tracking-wide treatment, h-5 size, with type icon prefix). Severity pills (when type=AVVIKELSE): MAJOR/Större rose-soft, MINOR/Mindre amber-soft. | Cycle detail Findings |
| 1.7 | Open `/workspace/styrdokument` | Document status: Utkast slate-soft (was solid before — **acknowledged delta**), Under granskning blue-soft (was solid primary — **acknowledged delta**), Godkänd emerald-soft, Ersatt slate-outline, Arkiverad slate-outline. | Styrdokument |
| 1.8 | Click ANY row on `/laglistor` to open the legal-document-modal | Header `Pågående` and `Medel` pills render via Badge primitive (not hand-rolled). Inspector check: classes contain `transition-colors focus:outline-none` (Badge primitive signature) — NOT just `bg-blue-100 text-blue-700`. | legal-document-modal |
| 1.9 | Same modal — Detaljer card → Efterlevnad + Prioritet rows | Both selects render Badge primitive pills with dropdown options also using Badge. Tooltips on hover preserved (Story 6.16). | legal-document-modal |
| 1.10 | Click any row on `/tasks` to open task-modal | Status + Priority badges in header. Priority pill (Hög/Medel/etc) goes through Badge primitive. Detaljer card Prioritet row dropdown also uses Badge. | task-modal |
| 1.11 | (Edge — light theme contrast) Toggle to LIGHT theme via OS preference | All pills above render with `-100 / -700` color pairs (high contrast on white bg). Specifically: `Hög` → bg `rgb(255,228,230)` rose-100, text `rgb(190,18,60)` rose-700. **AA contrast** ≥ 4.5:1. **NO** light-amber-300 text on near-white bg (the v0.1 bug). | All surfaces |
| 1.12 | (Edge — dark theme contrast) Toggle to DARK theme | All pills render with `-500/15 / -300` pairs (low-opacity tint on dark bg). `Hög` → bg `rgba(244,63,94,0.15)`, text `rgb(253,164,175)`. | All surfaces |

### IV4 anti-drift grep guards (run at terminal — should all return 0 hits outside the primitive layer):

```bash
# Old light-theme hand-rolled pattern (excluding primitive layer)
grep -rEn 'inline-flex items-center.*rounded-full.*bg-(blue|rose|amber|emerald|gray|slate|orange|red|green)-100' \
  --include='*.tsx' components/ app/ \
  | grep -vE 'components/ui/(badge|filter-chip|page-header|table-toolbar)\.tsx' \
  | grep -v 'lib/ui/badge-tones' \
  | grep -v 'components/features/landing/'

# New dark-theme hand-rolled pattern (anti-drift)
grep -rEn '\bbg-(blue|rose|amber|emerald|gray|slate|orange)-500/15\b' \
  --include='*.tsx' components/ app/ \
  | grep -vE 'lib/ui/badge-tones'

# Medium label literals in priority context
grep -rEn "label:\s*['\"]Medium['\"]" --include='*.tsx' --include='*.ts' components/ app/
```

Expected: zero hits on all three. Known false-positive: `landing/risk-section.tsx` hero strip (out of scope).

---

## 2. Story 22.2 — FilterChip primitive + Tabs/FilterChip semantic split

| # | Action | Expected | Surface |
|---|---|---|---|
| 2.1 | Open `/laglistor/kontroller` | Filter chip strip at top: `Aktiva (N) / Slutförda (N) / Alla (N)`. Active chip has filled foreground bg (inverse colors). DevTools: each chip is `<button aria-pressed="true|false">`, NOT `role="tab"`. The group wrapper is `<div role="group" aria-label="Filtrera kontroller efter status">`. | Kontroller list |
| 2.2 | Click `Slutförda` | List filters to AVSLUTAD cycles only. `aria-pressed` toggles to `true` on the clicked chip, `false` on the previously active one. Counts update in pills. | Kontroller list |
| 2.3 | Drill into a cycle → Anmärkningar tab | Three filter chip rows (when type=AVVIKELSE): typ filter, allvarlighetsgrad (only when type=Avvikelse selected), status filter. Each is a `<FilterChipGroup>` with `aria-label="Filtrera anmärkningar efter ..."`. | Cycle detail Findings |
| 2.4 | Click `Avvikelse` chip in type filter | Severity chip group (Större / Mindre / Alla allvar) appears (was hidden when type=Alla). | Cycle detail Findings |
| 2.5 | Inspector check on cycle-detail tabs (Items / Findings / Rapport / Aktivitet) | These ARE shadcn Tabs and DO have `role="tab"` + `aria-selected` (correct — view-switching, not filters). | Cycle detail |
| 2.6 | DevTools: search the cycle-detail page DOM for `role="tab"` | Should ONLY match the four view-switcher tabs above. **Inside the Anmärkningar tabpanel, `role="tab"` count must be 0.** This regression guard is the whole point of Story 22.2. | Cycle detail |
| 2.7 | Screen reader pass (NVDA / VoiceOver) | Chip should announce as `"toggle button [label], pressed/not pressed"` — NOT `"tab [label], selected"`. Run on at least one chip group. | Both surfaces |

---

## 3. Story 22.3 — PageHeader + TableToolbar primitives

| # | Action | Expected | Surface |
|---|---|---|---|
| 3.1 | `/laglistor` | Header: title `Laglistor` (h1), subtitle, secondaryActions row (`Skapa kontroll` + `Generera om laglista`). Below: existing tabs/filters/Lägg till dokument toolbar (UnifiedToolbar — pre-22.3, intentionally not lifted). Page-level `<PageHeader>` separator visible above the toolbar. | Laglistor |
| 3.2 | `/laglistor/kontroller` | Header: title `Kontroller` (h1), subtitle, primaryAction `Skapa kontroll`. TableToolbar below holds the FilterChipGroup. Slot order is identical to /laglistor. | Kontroller list |
| 3.3 | `/laglistor/kontroller/[cycleId]` (any cycle) | Header: breadcrumb (cycle name overrides UUID), title (cycle.name) + inline status badge, optional subtitle (cycle.description), `<PageHeader.Meta items>` row with dot-separated values: laglista name · audit type · scheduled range · {avatar} {leadAuditor name}. **No `Findings: N öppna · M stängda` chip in meta** (removed per 22.3 AC 6 — duplicate of Findings tab). Stats: Bedömda / Signerade with click-to-jump buttons. primaryAction = `<CycleActionsDropdown>` (Åtgärder menu). | Cycle detail |
| 3.4 | `/tasks` | Header: title `Uppgifter` (h1), subtitle. The `Ny uppgift` primaryAction stays inside TaskWorkspace's UnifiedToolbar (deferred — see Story 22.3 watch-item TASKS-PRIMARY-001). | Tasks |
| 3.5 | `/workspace/styrdokument` | Header: title `Styrdokument` (h1), subtitle, secondaryActions=`Importera`, primaryAction=`Nytt dokument`. TableToolbar below holds the views (Aktiva/Arkiverade tabs as shadcn Tabs) + DocumentFilterControls. | Styrdokument |
| 3.6 | Cross-surface check — same window / browser zoom | Open all five pages side-by-side. **Slot order** is identical: breadcrumb → title (+ badge if present) → subtitle/meta → divider → toolbar (views \| search + filters + right slot). Visual diff against `_prototypes/ui-alignment-prototype.html` §4 reference layout. | All |
| 3.7 | (a11y) DevTools heading outline | Each page has exactly one `<h1>`. Order: `<h1>`, then `<h2>` for section cards (etc). | All |

---

## 4. Story 22.4 — shadcn Table migration

| # | Action | Expected | Surface |
|---|---|---|---|
| 4.1 | `/workspace/styrdokument` row table | Confirm the table uses semantic `<table>` / `<thead>` / `<tbody>` / `<tr>` / `<td>`. DevTools: `getByRole('table')` matches; `getByRole('columnheader')` matches column headers; sortable headers (Titel, Senast uppdaterad, Granskningsdatum) toggle `aria-sort` correctly on click. | Styrdokument |
| 4.2 | `/laglistor/kontroller` row table | Same shadcn `<Table>` semantics. Confirmed by Story 22.3 part 1. | Kontroller list |
| 4.3 | Cycle detail Items tab | **DEFERRED** — still on the custom div-grid layout per Story 22.4 watch-item CYCLE-ITEMS-DEFERRED. Verify all functionality (click-to-modal, signoff, jump-to-first-unbedömt) still works. The migration is queued for a follow-up story. | Cycle detail Items |
| 4.4 | Cycle detail Findings tab | **Intentional non-Table layout** (cards, not rows). File-header docstring should reference Story 22.4 AC 11. Verified at `cycle-findings-tab.tsx:11-18`. | Cycle detail Findings |
| 4.5 | `/tasks` Lista tab | TanStack table (existing pre-22.4). Note: there's a known column-resize hygiene issue (header/row width drift on stale Zustand state) — flagged separately, not part of Epic 22 scope. | Tasks |

---

## 5. Modal & popover pill audit (post-Story-22.1 follow-up)

The initial Story 22.1 release missed pill rendering inside modals. UAT round 2 found and fixed 4 pill-render sites; this section verifies the cleanup landed.

| # | Action | Expected |
|---|---|---|
| 5.1 | Open legal-document-modal (click any law row on `/laglistor`) | Header pills (Pågående/Medel) render via Badge primitive. DevTools: search the dialog for `bg-blue-100` literal — should appear ONLY inside Badge's full class string with `dark:bg-blue-500/15` sibling. NOT a hand-rolled span. |
| 5.2 | Same modal, "Detaljer" card → Efterlevnad row | Select trigger pill + each dropdown option pill = Badge primitive. Tooltips preserved on hover over each option. |
| 5.3 | Same modal, "Detaljer" card → Prioritet row | Same — Flag icon + Badge primitive. |
| 5.4 | Open task-modal (click any task row on `/tasks`) | Header status badge + priority badge. Priority = Badge primitive. Status uses inline-style hex (column color, intentional — separate domain). |
| 5.5 | Same task-modal, "Detaljer" card → Prioritet row | Select trigger + dropdown options = Badge primitive. |
| 5.6 | Anti-drift sweep inside both modals | DevTools console:`document.querySelectorAll('[role="dialog"] *').forEach(el=>{const c=el.className; if(typeof c==='string' && /\bbg-(blue\|amber\|rose\|red\|orange)-(50\|100)\b/.test(c) && !/dark:bg/.test(c) && !/from-/.test(c)) console.log(el.tagName, el.textContent.trim().slice(0,30))})` — expect 0 logged hits. |

---

## 6. Cross-cutting accessibility verification

| # | Action | Expected |
|---|---|---|
| 6.1 | Run axe DevTools / Lighthouse a11y audit on each of the 5 surface pages | No new failures vs main. The Epic 22 changes should improve a11y scores (filter chips now correctly announce as toggle buttons; `<table>` semantics on Styrdokument). |
| 6.2 | Keyboard-only navigation on `/laglistor/kontroller` filter strip | Tab focuses each chip in order; Space/Enter activates. Focus ring visible. |
| 6.3 | Color contrast (Lighthouse) on light theme | All pills meet WCAG AA contrast (≥ 4.5:1 for text). Especially Medel-amber (was the failing case in v0.1). |
| 6.4 | Color contrast on dark theme | All pills still meet AA. |

---

## 7. Prototype design fidelity

Compare against `_prototypes/ui-alignment-prototype.html`:

| Prototype section | Live surface | Match? |
|---|---|---|
| §1 Badge tone × variant matrix | Any pill on any surface | Visual side-by-side. Tones should match the prototype's swatches. |
| §2 Priority alignment Option A (rose / amber / slate) | `/laglistor` + `/tasks` priority columns | Same colors per priority; same Swedish labels. |
| §3 FilterChip primitive | `/laglistor/kontroller` chip strip + cycle Anmärkningar filter rows | Pressed-state inversion (foreground bg, background text). Count badge inline at right of label. |
| §4 PageHeader reference layout | All five surface page headers | breadcrumbs → title → badge → subtitle/meta → divider → toolbar. Stats right-aligned with divider before primaryAction. |

Document any deviations as findings in §9.

---

## 8. Out-of-scope for Epic 22 (do NOT retest)

These are flagged in story completion notes / QA gates as deferred or out-of-scope:

- **Tasks list-tab column-resize / drag-reorder hygiene** — pre-existing TanStack table issue surfaced during UAT; tracked separately.
- **Cycle Items tab → shadcn `<Table>` migration** — Story 22.4 deferred. Custom div-grid still in place; functionality unchanged.
- **/tasks `Ny uppgift` primaryAction lift to PageHeader** — Story 22.3 deferred (TASKS-PRIMARY-001). Stays inside TaskWorkspace.
- **/laglistor `Lägg till dokument` primaryAction lift to PageHeader** — Story 22.3 deferred (LAGLISTOR-PRIMARY-001). Stays inside DocumentListPageContent.
- **`bedomning-copy.ts` EfterlevnadsBedomning per-item bedömning pills** — Story 22.1 watch-item BEDOMNING-001. Add as 6th badge-tones domain in a follow-up.
- **`finding-copy.ts` FINDING_STATUS_BADGES (5-state Phase 2 / Epic 23 closure metadata)** — Story 22.1 watch-item FINDING-STATUS-001. Defer to Epic 23.
- **`finding-card.tsx` Åtgärdsuppgift inline badge** — Story 22.1 watch-item ATGARDS-BADGE-001. Bundle with BEDOMNING-001 cleanup.
- **`landing/*` hero strips** — false positives on the IV4 regex; landing pages are pre-Epic-22 marketing surfaces.
- **`/tasks` filter dropdown consolidation (4 dropdowns → 1 popover)** — Story 22.3 AC 8 decision flag, deferred.

---

## 9. Sign-off

| Section | Tester | Pass / Fail | Notes |
|---|---|---|---|
| 1 — Badge tone primitive | | | |
| 2 — FilterChip primitive | | | |
| 3 — PageHeader / TableToolbar | | | |
| 4 — shadcn Table migration | | | |
| 5 — Modal pill audit | | | |
| 6 — Accessibility | | | |
| 7 — Prototype fidelity | | | |

When all sections pass, mark Epic 22 status **Done** in `docs/prd/epic-list.md` and proceed to PR review.
