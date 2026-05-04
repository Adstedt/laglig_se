# `<DatePicker>` — Component Specification

**Version:** 1.0
**Last Updated:** 2026-05-04
**Author:** Sarah (PO) — as-built from Story 22.6 implementation
**File:** `components/ui/date-picker.tsx`
**Story of origin:** [22.6](../stories/completed/22.6.datepicker-primitive-and-native-input-sweep.md)

---

## 1. Purpose

Canonical date-input primitive: outline `<Button>` trigger + Popover + shadcn `<Calendar mode="single">` + Swedish-formatted output. Replaces the OS-native `<input type="date">` chrome (different on every browser/OS) with a consistent in-app surface.

Also serves as the canonical replacement for the ~10 inline copies of the Popover+Calendar+Button pattern that pre-existed across the codebase (task creation form, due-date editor, activity filters, etc.). Those inline call sites are functional and intentionally NOT churn-migrated; they'll adopt the primitive next time they're touched.

---

## 2. API

```tsx
export interface DatePickerProps {
  value: Date | null
  onChange: (_date: Date | null) => void
  placeholder?: string | undefined           // default 'Välj datum'
  id?: string | undefined
  disabled?: boolean | undefined
  invalid?: boolean | undefined
  ariaDescribedBy?: string | undefined
  clearable?: boolean | undefined            // default true
  align?: 'start' | 'center' | 'end' | undefined  // popover content align; default 'start'
  className?: string | undefined             // forwarded to the trigger Button
}
```

**Co-located helpers** (exported from same file):

```tsx
export function parseISODate(s: string | null | undefined): Date | null
// Accepts null/undefined gracefully so callers with `string | null` state shapes
// don't need to cast. Returns null for empty/null/undefined inputs.

export function toISODate(d: Date | null): string
// 'YYYY-MM-DD' for non-null Date, '' for null. Boundary helper for callers
// that store dates as ISO strings (URL params, simple JSON state).
```

---

## 3. Visual specification

### 3.1 Trigger (closed state)

| Property | Value |
|---|---|
| Element | `<Button variant="outline" type="button">` |
| Width | `w-full` (fills its parent's width) |
| Alignment | `justify-start text-left font-normal` |
| Icon | leading `<Calendar className="h-4 w-4 mr-2 shrink-0" />` |
| Label | When `value` is set: `format(value, 'd MMMM yyyy', { locale: sv })` (e.g. "1 maj 2026"). When null: `placeholder` (default "Välj datum") in `text-muted-foreground`. |
| Invalid state | `border-destructive focus-visible:ring-destructive` (when `invalid` prop true) |

### 3.2 Popover (open state)

`<PopoverContent className="w-auto p-0" align={align}>` containing:
- `<Calendar mode="single" selected={value ?? undefined} onSelect={...} locale={sv} initialFocus />`
- Footer (only when `clearable && value`): `<div className="border-t p-2"><Button variant="ghost" size="sm" className="w-full">Rensa datum</Button></div>`

Selecting a date fires `onChange(date)` and auto-closes the popover. Clearing fires `onChange(null)` and closes.

---

## 4. Usage

### 4.1 Optional date field with clear

```tsx
import { DatePicker, parseISODate, toISODate } from '@/components/ui/date-picker'

<DatePicker
  value={parseISODate(filterValue)}        // string | null → Date | null
  onChange={(d) => setFilter(toISODate(d) || null)}  // Date | null → string | null
  placeholder="Välj datum"
/>
```

### 4.2 Required form field (no clear button)

```tsx
<DatePicker
  id={fieldId}
  value={parseISODate(formValue.scheduledStart)}
  onChange={(d) => setForm({ scheduledStart: toISODate(d) })}
  invalid={Boolean(errors.scheduledStart)}
  clearable={false}
/>
```

### 4.3 Inside a labeled form group

```tsx
<div className="space-y-2">
  <Label htmlFor={startId}>Startdatum</Label>
  <DatePicker
    id={startId}
    value={parseISODate(form.scheduledStart)}
    onChange={(d) => onChange({ scheduledStart: toISODate(d) })}
    invalid={Boolean(errors.scheduledStart)}
    clearable={false}
  />
</div>
```

---

## 5. Call sites

As of PR #60:

- `components/features/compliance-audit/cycle-creation-wizard/CycleMetadataStep.tsx` — three required date fields (`clearable={false}`)
- `components/features/search/search-filters.tsx` — Från / Till range filter (cleared = `undefined`)
- `components/features/catalogue/catalogue-filters.tsx` — same Från / Till pattern
- `components/admin/error-filters.tsx` — Från / Till (cleared = `null`)

---

## 6. When NOT to use

- **Inline-cell editing with hover-reveal** — keep `components/features/document-list/table-cell-editors/due-date-editor.tsx`. It's specifically tuned for table-cell context (ghost button, h-8, conditional reveal of the X clear icon).
- **Date-range picker** (single popover with start + end). Not yet built; out of scope for 22.6. Each existing site uses two independent single-date pickers.
- **Date + time picker.** This primitive is date-only.

---

## 7. Trade-offs accepted

- **No typed entry.** Native `<input type="date">` allowed users to type `2026-05-01`; this primitive is popover-only. Matches every other date input in the app, so the trade-off is consistency. If typed entry becomes a real user need, it's a primitive-only addition (add a masked `<Input>` next to the Calendar trigger).
- **Swedish formatting hardcoded.** Output uses `date-fns` `format(value, 'd MMMM yyyy', { locale: sv })`. The app is Swedish-only (per CLAUDE.md / project conventions); other-locale support is not a current requirement.

---

## 8. Test surface

No dedicated unit test — presentational. Visual smoke on each migrated form. Cycle wizard's invalid-date-range validation continues to work via the `invalid` prop.
