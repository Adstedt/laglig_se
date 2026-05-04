# `<FilterChip>` + `<FilterChipGroup>` — Component Specification

**Version:** 1.1 (re-themed in Story 22.9)
**Last Updated:** 2026-05-04
**Author:** Sarah (PO) — as-built from Story 22.2 (creation) + Story 22.9 (re-theme & canonicalization)
**File:** `components/ui/filter-chip.tsx`
**Stories of origin:** [22.2](../stories/completed/22.2.filterchip-primitive.md) (created), [22.9](../stories/completed/22.9.filter-chip-canonicalization.md) (re-themed + 3 bespoke chips migrated)

---

## 1. Purpose

In-view filter toggle. Renders as `<button type="button" aria-pressed>` — explicitly NOT `role="tab"`. Reserve shadcn `<Tabs>` for view-switching only; the semantic split between filter (toggle) and view-tab (selection) is the whole point of this primitive.

`<FilterChipGroup>` provides the `flex flex-wrap gap-2` wrapper with `role="group"` + required `aria-label` for screen-reader scoping.

---

## 2. API

```tsx
export interface FilterChipProps
  extends Omit<
      React.ButtonHTMLAttributes<HTMLButtonElement>,
      'onChange' | 'children'
    >,
    VariantProps<typeof filterChipVariants> {
  pressed: boolean                              // required
  onPressedChange?: (_pressed: boolean) => void
  count?: number | undefined                    // optional inline count badge
  icon?: React.ReactNode                        // optional leading icon slot
  children: React.ReactNode                     // the label
}

export interface FilterChipGroupProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'aria-label'> {
  'aria-label': string                          // REQUIRED — describes what's being filtered
}
```

`onClick` (inherited from button HTML attrs) fires before `onPressedChange`. Calling `event.preventDefault()` in `onClick` short-circuits `onPressedChange`. Useful for "click on the active chip is a no-op" (per Krav AC: 13).

---

## 3. Visual specification (re-themed in 22.9)

### 3.1 Base

`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors`

Plus standard a11y trim: `disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`.

### 3.2 Pressed (active)

`border-primary bg-primary text-primary-foreground`

### 3.3 Unpressed (inactive)

`border-border bg-background text-foreground hover:bg-muted`

### 3.4 Count badge (when `count !== undefined`)

`inline-flex items-center justify-center rounded-full text-[10px] font-medium px-1.5 min-w-[1.25rem] h-5 tabular-nums`

- Pressed: `bg-primary-foreground/20 text-primary-foreground`
- Unpressed: `bg-muted text-muted-foreground`

The badge is `aria-hidden="true"` (the count itself isn't useful to screen readers; the label conveys what's being filtered).

### 3.5 Group wrapper

`flex flex-wrap gap-2` + `role="group"` + the caller-provided `aria-label`.

---

## 4. Usage

### 4.1 Basic toggle group

```tsx
import { FilterChip, FilterChipGroup } from '@/components/ui/filter-chip'

<FilterChipGroup aria-label="Filtrera kontroller efter status">
  <FilterChip pressed={status === 'aktiva'} onPressedChange={() => setStatus('aktiva')}>
    Aktiva
  </FilterChip>
  <FilterChip pressed={status === 'slutförda'} onPressedChange={() => setStatus('slutförda')}>
    Slutförda
  </FilterChip>
</FilterChipGroup>
```

### 4.2 With counts

```tsx
<FilterChipGroup aria-label="Filtrera kravpunkter">
  <FilterChip pressed={f === 'all'} onPressedChange={...} count={counts.all}>
    Alla
  </FilterChip>
  <FilterChip pressed={f === 'gaps'} onPressedChange={...} count={counts.gaps}>
    Luckor
  </FilterChip>
</FilterChipGroup>
```

### 4.3 Click-on-active is a no-op

```tsx
<FilterChip
  pressed={isActive}
  onClick={(e) => { if (isActive) e.preventDefault() }}
  onPressedChange={() => setActive(...)}
>
  Min vy
</FilterChip>
```

---

## 5. Call sites

As of PR #60:

- `components/features/compliance-audit/cycle-list/cycle-list-table.tsx` — Aktiva / Slutförda / Alla cycle filter (Story 22.2)
- `components/features/compliance-audit/cycle-detail/cycle-findings-tab.tsx` — type filter + status filter (Story 22.2)
- `components/features/document-list/content-type-filter.tsx` — Laglistor type filter (Story 22.9)
- `components/features/krav/krav-filter-chips.tsx` — `/krav` preset filter (Story 22.9)
- `components/features/templates/template-catalog-client.tsx` — Mallar domain filter (Story 22.9)

---

## 6. When NOT to use

- **View switching** — use shadcn `<Tabs>` or `<WorkspaceViewTabs>` (not a chip). Tabs select one of N mutually-exclusive views; chips are toggle filters that may not be mutually-exclusive.
- **Multi-select dropdowns with many options** — use `<FilterPopover>` (`components/ui/filter-popover.tsx`). Chips work best with 2-6 options visible at once. More than 6 starts to wrap awkwardly even with `flex-wrap`.
- **Single-select with a dominant default + 1-2 alternatives** — consider a single `<Button variant="outline" size="sm">` toggle. A `FilterChipGroup` of 2 chips is heavy for that case.

---

## 7. Re-theme history (Story 22.9)

The original `<FilterChip>` (Story 22.2) used a tighter, quieter visual — `px-3 py-1 text-xs`, `text-muted-foreground` on inactive (dimmed), brighten-on-hover. Three other workspace surfaces (Laglistor type filter, Krav preset filter, Mallar domain filter) had bespoke chip implementations with looser, more legible styling — `px-3 py-1.5 text-sm`, `text-foreground` on inactive (full strength), `hover:bg-muted`.

User design call: Laglistor's "loose" variant is the gold standard. Story 22.9 re-themed `<FilterChip>` to match it AND migrated the three bespoke implementations onto the now-canonical primitive. Net result: five chip surfaces all render identically.

---

## 8. Test surface

`tests/unit/components/ui/filter-chip.test.tsx` covers:
- Pressed / unpressed render
- Count badge render (with and without `count` prop)
- Icon slot
- `aria-pressed` attribute
- `onPressedChange` firing

Visual smoke on the five call sites verifies pixel parity.
