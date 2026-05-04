# `<ColorTagBadge>` — Component Specification

**Version:** 1.0
**Last Updated:** 2026-05-04
**Author:** Sarah (PO) — as-built from Story 22.7 implementation
**File:** `components/ui/color-tag-badge.tsx`
**Story of origin:** [22.7](../stories/completed/22.7.tasks-tabs-atom-alignment.md)

---

## 1. Purpose

A soft-fill pill primitive whose tinting is driven by an arbitrary hex color (rather than a semantic enum). Used for "labelled tag with workspace-defined color" — task statuses (per `TaskColumn.color` in Prisma), document content-type indicators, etc.

Distinct from `<Badge tone variant>` (`components/ui/badge.tsx`): the canonical `<Badge>` accepts a fixed `tone` enum (`neutral` / `info` / `success` / `warning` / `danger`). Use `<Badge>` for app-defined semantic states (priority, severity, finding type). Use `<ColorTagBadge>` when the color is data, not semantics.

---

## 2. API

```tsx
export interface ColorTagBadgeProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'color'> {
  name: string
  color: string                        // hex, e.g. '#2563eb'
  size?: 'sm' | 'md' | undefined       // default 'md'
  showDot?: boolean | undefined        // default true
  className?: string | undefined
}
```

**Notes:**
- `color` accepts any CSS color value, but expected/tested format is 6-digit hex.
- Optional props use the `T | undefined` form for `exactOptionalPropertyTypes: true` compatibility.
- Re-exported via standard React `forwardRef<HTMLSpanElement>`.

---

## 3. Visual specification

| Property | Value |
|---|---|
| Container | `<span>` with `inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap` |
| Background | `style.backgroundColor = ${color}24` (~14% alpha) |
| Border | `style.borderColor = ${color}59` (~35% alpha) |
| Text color | `style.color = ${color}` (full strength) |
| Dot (when `showDot`) | 8px × 8px (`h-2 w-2 rounded-full shrink-0`), `style.backgroundColor = ${color}` (full strength) |
| Padding (md) | `px-2.5 py-0.5 text-xs` |
| Padding (sm) | `px-2 py-0.5 text-[10.5px]` |

The dot is `aria-hidden="true"`. Screen readers announce just the `name`.

---

## 4. Usage

### 4.1 Display (read-only)

```tsx
import { ColorTagBadge } from '@/components/ui/color-tag-badge'

<ColorTagBadge
  name={task.column.name}
  color={task.column.color}
/>
```

### 4.2 Inside an inline editor's read mode

```tsx
// task-status-editor.tsx — trigger render
<SelectTrigger>
  {currentColumn ? (
    <ColorTagBadge name={currentColumn.name} color={currentColumn.color} />
  ) : null}
</SelectTrigger>
```

### 4.3 Inside dropdown items (compact)

```tsx
<SelectItem value={col.id}>
  <ColorTagBadge name={col.name} color={col.color} size="sm" />
</SelectItem>
```

---

## 5. Call sites

As of PR #60:

- `components/features/tasks/task-workspace/task-status-editor.tsx` — both trigger and dropdown items
- `components/features/tasks/task-workspace/all-work-tab.tsx` — status column cell

Future surfaces (currently using inline `${color}1A` alpha-trick spans or hand-rolled equivalents) should adopt this primitive when next touched. Common candidates: document content-type tags, label/tag systems.

---

## 6. When NOT to use

- **Priority / severity / status WITH FIXED SEMANTICS** — use `<Badge tone variant>` from `components/ui/badge.tsx` with `getPriorityBadgeProps(value)` from `lib/ui/badge-tones.ts`. Priority is a 4-state enum with semantic colors (LOW=gray, MEDIUM=warning amber, HIGH=danger soft, CRITICAL=danger solid); those colors live in the design system, not in user data.

- **Status that's signalled positionally** — e.g., a Kanban card's column placement. Don't add a per-card status badge that duplicates the column dot. (Story 22.7 Q2.)

- **Calendar pills with fixed 3-state semantics** (done/active/overdue, tied to a legend) — keep the hardcoded `bg-green-100 text-green-700` etc. classes. Consistency with the legend matters more than primitive reuse.

---

## 7. Token math

The alpha hex suffix trick (`${color}24` → ~14%, `${color}59` → ~35%) gives a soft-fill look without needing per-color Tailwind classes. Trade-off: requires runtime `style` props (no purely-class-based version possible because the color is data). Accessibility: contrast between text (full color) and background (14% alpha of same color over `bg-background`) should be checked when choosing column colors. Workspace admins picking very light colors will produce low-contrast badges — out of scope for this primitive to validate.

---

## 8. Test surface

No dedicated unit test — the primitive is presentational and trivial. Visual smoke verifies it on touched call sites (`/tasks?tab=lista`, `/tasks?tab=alla`).
