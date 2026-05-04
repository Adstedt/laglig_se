# `<EmptyState>` — Component Specification

**Version:** 1.0
**Last Updated:** 2026-05-04
**Author:** Sarah (PO) — as-built from Story 22.7 implementation
**File:** `components/ui/empty-state.tsx`
**Story of origin:** [22.7](../stories/completed/22.7.tasks-tabs-atom-alignment.md)

---

## 1. Purpose

Shared empty-page primitive. Replaces ~8 hand-rolled `flex flex-col items-center ... rounded-full bg-muted p-4 ... <h2>title</h2><p>description</p>` blocks scattered across the workspace, each with subtly different padding, icon size, and text hierarchy.

---

## 2. API

```tsx
export interface EmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: React.ReactNode
  title?: string | undefined
  description?: string | undefined
  action?: React.ReactNode
}

export const EmptyState: React.ForwardRefExoticComponent<...> & {
  Icon: typeof EmptyStateIcon
}
```

**Notes:**
- All props optional — render only what you supply
- `EmptyState.Icon` subcomponent is the canonical icon wrapper (`rounded-full bg-muted p-4`); pass any `<Icon>` as a child
- `Omit<..., 'title'>` because HTML `<div>` has a built-in `title` attr we need to override with the React prop

---

## 3. Visual specification

| Slot | Class | Notes |
|---|---|---|
| Container | `flex flex-col items-center justify-center gap-4 py-12 text-center` | `gap-4` = 16px between slots |
| Icon (your responsibility) | passed as `icon` prop | Wrap in `<EmptyState.Icon>` for canonical look |
| `<EmptyState.Icon>` wrapper | `rounded-full bg-muted p-4` | Icon child is typically `h-8 w-8 text-muted-foreground` |
| Title | `<h2 class="text-lg font-medium">` | Renders only if `title` prop |
| Description | `<p class="text-sm text-muted-foreground max-w-md">` | Renders only if `description` prop |
| Action | passed as `action` prop | Typically `<Button>` or `<Link>` |

When neither `title` nor `description` is provided, no inner div renders. When only `icon`, you get an icon-only minimal empty.

---

## 4. Usage

### 4.1 Page-level filter-empty (most common)

```tsx
import { EmptyState } from '@/components/ui/empty-state'
import { ListTodo } from 'lucide-react'

<EmptyState
  icon={
    <EmptyState.Icon>
      <ListTodo className="h-8 w-8 text-muted-foreground" />
    </EmptyState.Icon>
  }
  title="Inga uppgifter matchar"
  description="Justera dina filter eller skapa en ny uppgift"
/>
```

### 4.2 With CTA

```tsx
<EmptyState
  icon={<EmptyState.Icon><Calendar className="h-8 w-8" /></EmptyState.Icon>}
  title="Inga uppgifter denna månad"
  description="Skapa en uppgift med ett förfallodatum för att se den i kalendern."
  action={<Button>+ Ny uppgift</Button>}
/>
```

### 4.3 Inside a bordered container (per-tab variant)

```tsx
<EmptyState
  className="rounded-md border"
  description="Du har inga aktiva kontroller just nu."
  action={<Button asChild><Link href="/skapa">+ Skapa kontroll</Link></Button>}
/>
```

### 4.4 Description-only (terse)

```tsx
<EmptyState description="Inga mallar för detta område ännu — kommer snart" />
```

---

## 5. Call sites

As of PR #60:

- `components/features/document-list/document-list-table.tsx` — flat-table empty
- `components/features/tasks/task-workspace/list-tab.tsx` — Tasks Lista filter empty
- `components/features/tasks/task-workspace/all-work-tab.tsx` — Alla uppgifter filter empty
- `components/features/tasks/task-workspace/calendar-tab.tsx` — month-empty (early return)
- `components/features/templates/template-catalog-client.tsx` — three variants (full empty, community placeholder, per-domain empty)
- `components/features/compliance-audit/cycle-list/cycle-list-table.tsx` — Kontroller list empty (with `className="rounded-md border"`)

---

## 6. When NOT to use

- **Per-column / per-section micro-empties** in tight contexts (e.g., a Kanban column body, a sidebar widget). The full primitive's `py-12 + bg-muted icon wrapper` looks oversized in <300px-wide containers. Hand-roll a smaller inline version (e.g., `py-6 text-xs text-muted-foreground` with a tiny icon) — see `kanban-tab.tsx`'s per-column "Inget i denna kolumn ännu" placeholder.

- **In-table empty rows** rendered as `<TableRow><TableCell colSpan>...` — these need to live INSIDE the `<TableBody>` for `table-fixed` layout integrity. Either keep the in-table pattern OR swap to a `filteredItems.length === 0` early-return rendering `<EmptyState>` ABOVE the `<Table>`. Story 22.7 chose the early-return for Lista + Alla (cleaner). Story 22.8 left compliance-detail-table's expanded-row in-table empty as-is (different use case).

---

## 7. Migration guide (for future surfaces)

If you have a hand-rolled empty state of the shape:

```tsx
<div className="flex flex-col items-center justify-center py-N text-center">
  <Icon className="h-N w-N text-muted-foreground mb-N" />
  <h2|h3 className="text-N font-N">Title</h2>
  <p className="text-sm text-muted-foreground">Description</p>
</div>
```

Replace with:

```tsx
<EmptyState
  icon={<EmptyState.Icon><Icon className="h-8 w-8 text-muted-foreground" /></EmptyState.Icon>}
  title="Title"
  description="Description"
/>
```

The wrapper's `gap-4 py-12` replaces both the `py-N` and the per-element `mb-N`. Match `<EmptyState.Icon>`'s `rounded-full bg-muted p-4` style if you want the canonical "decorated" look; pass the icon naked otherwise.

---

## 8. Test surface

No dedicated unit test — presentational. Visual smoke when filtering each migrated surface to zero results.
