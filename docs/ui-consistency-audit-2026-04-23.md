# UI Consistency Audit — Table Surfaces

**Date:** 2026-04-23
**Scope:** Tabular surfaces across the Laglig.se workspace (browser exploration on `localhost:3000` + source cross-reference).
**Surfaces audited:**

| # | Surface | Route | Primary table component |
|---|---------|-------|-------------------------|
| 1 | Mina laglistor (efterlevnad / compliance view) | `/laglistor` | `components/features/document-list/compliance-detail-table.tsx` |
| 2 | Kontroller — list of cycles | `/laglistor/kontroller` | `components/features/compliance-audit/cycle-list/cycle-list-table.tsx` |
| 3 | Kontroller — cycle detail / Items tab | `/laglistor/kontroller/[cycleId]#items` | `components/features/compliance-audit/cycle-detail/cycle-items-tab.tsx` |
| 4 | Kontroller — cycle detail / Findings tab | `/laglistor/kontroller/[cycleId]#findings` | `components/features/compliance-audit/cycle-detail/cycle-findings-tab.tsx` |
| 5 | Uppgifter — Lista tab | `/tasks?tab=lista` | `components/features/tasks/task-workspace/list-tab.tsx` |
| 6 | Styrdokument | `/workspace/styrdokument` | `components/features/documents/document-table.tsx` |

---

## TL;DR — the biggest offenders

1. **Priority pill colors AND labels diverge between surfaces.** A task with priority "Hög" renders `bg-orange-100 text-orange-700` on Uppgifter but `bg-rose-100 text-rose-700` on Mina laglistor. A "medium" priority is rendered as **"Medel" in amber** on Laglistor but **"Medium" in blue** on Uppgifter. These are the same enum values shown side-by-side from the same domain.
2. **Three different filter-chip patterns exist**, all with `role="tab"` and all rounded — but with different sizes, active styles and presence of count badges.
3. **Status / priority pills are hand-rolled inline classes on 4 of 6 surfaces.** Only Styrdokument and Findings (rows) use the shared `components/ui/badge.tsx` primitive — and even Styrdokument mixes three Badge variants in a single column.
4. **Two of six tables don't use the shadcn `Table` primitive** (Cycle Items, Styrdokument) — they're custom div grids. The other four use `<table>` but with different toolbars, search affordances and selection chrome.
5. **Page-header buttons have inconsistent labelling and placement.** "Skapa kontroll", "Generera om laglista", "Ny uppgift", "Nytt dokument", "Lägg till dokument", "Lägg till finding", "Importera", "Åtgärder" — six surfaces, no shared pattern.

---

## Filter / toolbar chrome — three distinct patterns

| Surface | Pattern | Active style | Has count badge? | Has search input? | Notes |
|---------|---------|--------------|------------------|-------------------|-------|
| Mina laglistor | shadcn `Button` "Filter" + "Efterlevnad" with dropdowns, plus inline `SearchInput` | shadcn ghost/outline | no | yes (`Sök dokument…`) | Adds a settings cog and "Lägg till dokument" on the right |
| Kontroller list | Round chip-tab `role="tab"` — `rounded-full border px-3 py-1 text-sm` — active `border-foreground bg-foreground text-background` | dark filled | **yes** — separate `<span>` with `bg-background/20 text-background` for active count, `bg-muted text-muted-foreground` for inactive | **no** | No search bar at all |
| Cycle detail (Items + Findings) | Standard shadcn `TabsTrigger` (`rounded-sm px-3 py-1.5 text-sm`) | shadcn primitive | no | no | Findings tab also has *another* row of round chips below the tabs |
| Cycle detail / Findings filter chips | Round chip — `rounded-full border px-3 py-1 text-xs` — active `border-primary bg-primary/10 text-primary` | tinted primary | no | no | Note the **`text-xs` and `text-primary`** vs Kontroller-list's `text-sm` and `text-foreground` |
| Uppgifter | shadcn `TabsTrigger` for view-switching tabs + a separate **right-aligned** filter row of dropdown buttons (`Status`, `Prioritet`, `Förfallodatum`, `Ansvarig`, `Kolumner`) plus a borderless inline search | shadcn primitive | no | yes (`Sök uppgifter…`) | Search has `border border-input bg-background` |
| Styrdokument | shadcn `TabsTrigger` (Aktiva/Arkiverade) + a **left-aligned** row with bordered search and dropdown filters with funnel icons | shadcn primitive | no | yes (`Sök dokument…`) | Active filter dropdowns get a darker bg fill; inactive ones don't |

**Concrete inconsistencies**

- The "filter chip" primitive is reinvented in two places with different active styles:
  - `cycle-list-table.tsx` → `border-foreground bg-foreground text-background` (high-contrast dark)
  - `cycle-findings-tab.tsx` → `border-primary bg-primary/10 text-primary` (tinted)
- Filter chips on Kontroller list show inline count badges; chip filters on Findings don't, even though both are essentially "show me X subset" controls.
- Search input is sometimes the bordered Input primitive (Tasks, Styrdokument, Laglistor) and sometimes absent entirely (Kontroller list, Cycle items, Findings) — so users cannot text-search a 20-row Items list.
- Filter row position swaps between left-aligned (Laglistor, Styrdokument) and right-aligned (Tasks).

---

## Page header & primary action

| Surface | Title | Subtitle? | Primary action(s) | Action style |
|---------|-------|-----------|--------------------|--------------|
| Mina laglistor | "Mina listor" | yes | `Skapa kontroll` + `Generera om laglista` (top right) + `Lägg till dokument` (filter row right) | mixed: header buttons are outline w/ icons, "Lägg till dokument" sits in the filter strip |
| Kontroller list | "Kontroller" | yes | `Skapa kontroll` (top right) | outline w/ + icon |
| Cycle detail | Cycle name + inline `Pågående` pill, meta row | no subtitle, but a meta line that mixes laglista name, type, dates, ansvarig, **and** "Findings: 1 öppna · 3 stängda" as plain text | `Åtgärder` (top right) — a generic actions menu — plus tiny right-side stats "Bedömda 1 av 20", "Signerade 0 av 20" rendered as plain text columns | `Åtgärder` is a pill-shaped dropdown, no icon |
| Findings tab | (inherits cycle header) | — | `Lägg till finding` (filter row right) | filled / primary |
| Uppgifter | "Uppgifter" | yes | `Ny uppgift` (top right) | outline w/ + icon |
| Styrdokument | "Styrdokument" | yes | `Importera` + `Nytt dokument` (top right) | both outline; Nytt dokument has a file-plus icon |

**Concrete inconsistencies**

- Three different verbs for "create a row in this table": `Skapa kontroll`, `Ny uppgift`, `Nytt dokument`, `Lägg till dokument`, `Lägg till finding`. The pattern is split between `Skapa/Ny/Nytt` (descriptive) and `Lägg till` (locative). This isn't necessarily wrong but no convention is documented.
- "Primary action" placement differs by surface: top right for Laglistor / Kontroller list / Tasks / Styrdokument; *inside the filter strip* for `Lägg till dokument` (laglistor) and `Lägg till finding` (findings). On the Cycle detail header the only top-right button is `Åtgärder`, which is a menu — the per-tab create action is pushed down a level.
- Cycle detail has its own meta-line layout with five fields concatenated by `·` separators — none of the other surfaces use this pattern. The "Findings: 1 öppna · 3 stängda" text inside that line duplicates information that the Findings tab also surfaces with chips, so the same fact is rendered two completely different ways on the same page.

---

## Status / priority pills

This is where the inconsistency is most painful, because the same domain values render differently across surfaces. Classes pulled directly from the rendered DOM:

### Status pills

| Label | Surface | Class string | Primitive |
|-------|---------|--------------|-----------|
| `Delvis uppfylld` | Laglistor | `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap bg-blue-100 text-blue-700` | hand-rolled |
| `Ej påbörjad` | Laglistor | `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap bg-gray-100 text-gray-700` | hand-rolled |
| `Pågående` (cycle status, in cycle list AND in cycle detail title) | Kontroller | `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700` | hand-rolled |
| `Att göra` | Uppgifter | `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap` (no bg colour in class string — likely set inline) | hand-rolled |
| `Godkänd` | Styrdokument | `inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors … bg-green-100 text-green-800 border-green-200` | **shadcn `Badge`** with custom override |
| `Under granskning` | Styrdokument | `… bg-primary text-primary-foreground …` | **shadcn `Badge`** default variant |
| `Utkast` | Styrdokument | `… bg-secondary text-secondary-foreground …` | **shadcn `Badge`** secondary variant |
| `Större` (severity, finding row) | Findings | `… bg-red-100 text-red-800 border-red-300` | **shadcn `Badge`** with custom override |
| `Öppen` (finding state) | Findings | `… bg-emerald-50 text-emerald-700 border-emerald-200` | **shadcn `Badge`** with custom override |

**Visible inconsistencies:**

- Two near-identical class strings for the same blue 100/700 pill, one with `whitespace-nowrap`, the other without — and the order of `rounded-full` vs `px-2.5` is flipped (Laglistor: `px-2.5 py-0.5 rounded-full`; Cycle: `rounded-full px-2.5 py-0.5`). Pure copy-paste drift.
- Laglistor / Tasks / Cycle pills use **`font-medium` and text-700**; Styrdokument / Findings pills use **`font-semibold` and text-800** — different visual weight and contrast.
- Styrdokument pills have a 1px border (`border` + `border-green-200` etc.); pills elsewhere don't. Side-by-side this creates noticeably "heavier" pills on Styrdokument.
- Within Styrdokument's Status column, three different Badge variants are used at once: a custom green pill (`Godkänd`), the default solid-primary pill (`Under granskning`), and the secondary muted pill (`Utkast`). Visually they look like three different *kinds* of thing rather than three states of one thing.
- `Att göra` (task status) has no bg colour in its className. Either the colour is being set elsewhere (CSS-in-JS / inline style / data-attr) or the pill renders unstyled — worth confirming because that drift is invisible to the codebase grep.

### Priority pills — the worst offenders

| Label | Surface | Class string |
|-------|---------|--------------|
| `Hög` | Laglistor | `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700` |
| `Medel` | Laglistor | `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700` |
| `Hög` | Uppgifter | `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700` |
| `Medium` | Uppgifter | `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700` |

Two things:

1. **Same enum value, different colour.** "Hög" is rose on Laglistor and orange on Uppgifter. Medium-priority is amber on Laglistor and **blue** on Uppgifter. Blue conflicts directly with the `Pågående`/`Delvis uppfylld` status pill colour, so "Medium priority" and "in progress / partially compliant" look identical at a glance.
2. **Same enum value, different label.** Laglistor calls medium "Medel" (Swedish), Uppgifter calls it "Medium" (English). Same conceptual value, different word — and the source agent confirms both surfaces import a `PriorityEditor` from `components/features/document-list/table-cell-editors/priority-editor.tsx`, so this divergence is happening *inside what's meant to be the shared editor*, or there are now multiple editors. Worth grepping.

Note also that priority pills use `px-2` while status pills use `px-2.5` — a 2px width difference that shows up in dense tables.

### Type pills (Styrdokument document type)

`Övrigt` and `Policy` use the shadcn Badge `outline` variant **shrunk** with `text-[10px] px-1.5 py-0`. They appear right next to status pills (`Under granskning`, `Godkänd`) which are full-size — so two pills sit on the same row at very different sizes. Either intentional (type-as-secondary) or accidental.

---

## Table primitive

| Surface | Primitive |
|---------|-----------|
| Mina laglistor (compliance-detail-table) | shadcn `<Table>` |
| Mina laglistor (grouped variant) | shadcn `<Table>` per group section |
| Kontroller list | shadcn `<Table>` |
| **Cycle Items tab** | **custom div-based virtualized list** (no `<table>`, no `<th>`) |
| Cycle Findings tab | virtualized list of cards (also no `<table>`) |
| Uppgifter (Lista) | shadcn `<Table>` |
| **Styrdokument** | **custom grid layout** (no `<table>`) |

This affects accessibility (screen readers will treat half the surfaces as lists, the other half as tables), keyboard navigation, and column behaviour (only the `<Table>` ones expose sort arrows, resize, drag).

Concretely:

- **Cycle Items tab**: shows what looks like a 6-column table (Lag / Nuvarande status / Bedömning / Motivering / Ansvarig / Signerad) but is custom div rows, no checkboxes, no drag, no sort headers — which means features other tables have (selection, multi-edit, sort) can never be added without rewriting the row layer.
- **Styrdokument**: similar — has `…` per-row action menu, has sort arrows on Titel/Senast uppdaterad/Granskningsdatum, but is built as a custom grid.
- Compliance tables uniquely have **drag handles + checkboxes per row + a column for a coloured Typ icon** — none of the other tables do.

---

## Selection / row chrome

| Surface | Per-row checkbox | Drag handle | Inline expand drawer | Per-row action menu |
|---------|------------------|-------------|----------------------|----------------------|
| Mina laglistor | yes | yes | yes (chevron, in-table accordion with kravpunkter checklist) | per-row chevron only |
| Kontroller list | no | no | no — clicking a row navigates | no |
| Cycle Items | no | no | yes — opens a drawer | no |
| Cycle Findings | no | no | yes — chevron expands the row in place | "Redigera" + "Stäng" / "Återöppna" inline buttons |
| Uppgifter (Lista) | yes | yes | no | no per-row menu (opens modal via title) |
| Styrdokument | no | no | no | "…" overflow menu per row |

There's no shared "row trailing action" treatment: chevron, inline buttons, "…" menu, and "open in modal" are all in use, with little obvious rule about which one is appropriate.

---

## Empty states

Not all surfaces were captured with empty data, but those that were show different patterns:

- Laglistor groups expand to "+ Lägg till" placeholders inline in the Krapunkter cell when no kravpunkter exist on a row.
- Cycle Items has no observed empty state in the current data.
- Findings empty state was not surfaced (3 rows were present).
- Uppgifter Sammanfattning tab uses bare numeric stat cards ("Klara 2", "Försenade 0", "Denna vecka 1") with progress bars — a completely different visual language than any of the table surfaces.

Empty-state alignment was out of scope for this pass but is a likely follow-up audit.

---

## Tabs primitive — three variants

| Where | Primitive | Active style |
|-------|-----------|--------------|
| `/laglistor` (Mina listor / Ändringar) | shadcn `TabsTrigger` | shadcn primitive |
| `/laglistor/kontroller` (Aktiva / Slutförda / Förseglade / Arkiverade / Alla) | hand-rolled `role="tab"` chip with `rounded-full border` and **count badges** | dark filled (`border-foreground bg-foreground text-background`) |
| `/laglistor/kontroller/[cycleId]` (Items / Findings / Rapport / Aktivitet) | shadcn `TabsTrigger` | shadcn primitive |
| Findings tab inner filter row | hand-rolled chip with `rounded-full border` and **no count badges**, **smaller text** | tinted (`border-primary bg-primary/10 text-primary`) |
| `/tasks` (Sammanfattning / Aktiva / Lista / Kalender / Alla uppgifter) | shadcn `TabsTrigger` with leading icons | shadcn primitive |
| `/workspace/styrdokument` (Aktiva / Arkiverade) | shadcn `TabsTrigger` with leading icons | shadcn primitive |

So the tabs primitive itself is mostly consistent (shadcn), but the **chip-style filter pattern is reinvented in two places** with different sizes and active treatments — and these chips also use `role="tab"`, which conflates two different concepts in the markup.

---

## Source-level findings (from Explore agent, file paths)

(Cross-referenced with `git status` and a parallel code exploration.)

- `components/features/document-list/compliance-detail-table.tsx:576` — primary table for Laglistor
- `components/features/document-list/grouped-compliance-table.tsx` — grouped variant
- `components/features/compliance-audit/cycle-list/cycle-list-table.tsx:81` — kontroller list (defines the chip filters inline)
- `components/features/compliance-audit/cycle-detail/cycle-items-tab.tsx:55` — items virtualized list
- `components/features/compliance-audit/cycle-detail/cycle-findings-tab.tsx:63` — findings virtualized list (defines its own chip filters inline)
- `components/features/compliance-audit/cycle-detail/cycle-status-badge.tsx:11` — `STATUS_VARIANTS` map of cycle-status colours
- `components/features/tasks/task-workspace/list-tab.tsx:14` — TanStack table for tasks
- `components/features/tasks/task-workspace/task-filters-toolbar.tsx` — task filter dropdowns
- `components/features/documents/document-table.tsx:70` — styrdokument grid
- `components/features/documents/document-status-badge.tsx:32` — `DocumentStatusBadge` (uses shadcn Badge with custom variant overrides)
- `components/features/documents/document-filters.tsx` — styrdokument filter row
- `components/features/document-list/table-cell-editors/compliance-status-editor.tsx:26` — laglistor status pill (inline)
- `components/features/document-list/table-cell-editors/priority-editor.tsx:31` — priority pill (inline) — **check whether tasks actually reuses this one or has its own copy, given the colour/label divergence**
- `components/ui/badge.tsx:30` — base shadcn Badge (only used by Styrdokument and Findings rows currently)
- `components/ui/table.tsx:5` — base shadcn Table (only used by 3 of 6 surfaces)
- `components/ui/filter-popover.tsx:37` — `FilterPopover` (used inside ComplianceFilters; not used by Tasks or Styrdokument filter rows)

---

## Suggested groupings for an alignment pass

(Just for planning — no implementation yet.)

1. **Pill primitive consolidation.** Pick one (extend `components/ui/badge.tsx` with `variant="status"` / `variant="priority"` / `variant="severity"` colour scales). Migrate all hand-rolled `inline-flex … rounded-full bg-X-100 text-X-700` instances to it. Easy ROI.
2. **Priority enum fix.** Decide on Swedish or English label (Medel / Medium), pick a single colour for each level, and verify both Laglistor and Uppgifter import the same editor. The current state is genuinely confusing for users.
3. **Filter-chip primitive.** Either standardize on shadcn `TabsTrigger` everywhere or extract `FilterChip` (with optional count badge) and use it in both `cycle-list-table.tsx` and `cycle-findings-tab.tsx`.
4. **Toolbar / page header primitive.** A `<PageHeader title subtitle actions>` plus a `<TableToolbar searchProps filterChildren rightSlot>` would normalise the very different toolbars on Laglistor / Tasks / Styrdokument / Cycle detail.
5. **Decide whether Cycle Items and Styrdokument should migrate to the shadcn `<Table>` primitive.** If yes, plan separately because they're large refactors.
6. **Per-surface empty-state pass** — out of scope here, but the audit surfaced enough variation to suggest it as a follow-up.

---

*Generated from live DOM inspection on 2026-04-23. Class strings are quoted directly from the rendered elements; if any of them have changed since this audit, treat the class strings as historical and rerun the inspection.*
