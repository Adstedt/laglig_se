# Unified Toolbar Specification

**Version:** 1.0
**Last Updated:** 2026-01-28
**Author:** Sally (UX Expert)

---

## 1. Design Philosophy

### 1.1 Core Principles

| Principle                       | Description                                                             |
| ------------------------------- | ----------------------------------------------------------------------- |
| **Predictable Positioning**     | Users should intuitively know where to find actions without hunting     |
| **Progressive Disclosure**      | Show essential controls always; reveal advanced options on demand       |
| **Consistent Grouping**         | Same categories of controls should always appear in the same zones      |
| **Mobile-First Responsiveness** | Controls gracefully adapt to viewport size                              |
| **Single Row When Possible**    | Consolidate into one row; use second row only when filtering is complex |

### 1.2 The Mental Model

```
LEFT = "Where am I?" + "What do I want to see?"
RIGHT = "What can I do?" + "How do I want to see it?"
```

- **Left side**: Context, navigation, filtering (affects WHAT content appears)
- **Right side**: Actions, view options, settings (affects HOW content appears or what user DOES)

---

## 2. Toolbar Anatomy

### 2.1 Zone Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ZONE A          │  ZONE B           │  ZONE C           │  ZONE D          │
│  Context         │  Filters          │  View Controls    │  Actions         │
│  (far left)      │  (left-center)    │  (right-center)   │  (far right)     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Zone Definitions

| Zone                 | Purpose                  | Always Contains             | Optional                        |
| -------------------- | ------------------------ | --------------------------- | ------------------------------- |
| **A: Context**       | Establishes "where am I" | Selector/breadcrumb OR tabs | -                               |
| **B: Filters**       | Narrows down content     | -                           | Search, filter chips, dropdowns |
| **C: View Controls** | Changes presentation     | -                           | View toggle, sort, columns      |
| **D: Actions**       | Primary user actions     | Primary CTA                 | Secondary actions, settings     |

### 2.3 Visual Hierarchy

```
Zone D (Actions)     → Most prominent (Primary Button styling)
Zone A (Context)     → High prominence (Selector or Tabs)
Zone C (View)        → Medium prominence (Outline/Ghost buttons)
Zone B (Filters)     → Lower prominence (Inputs, chips, dropdowns)
```

---

## 3. Standard Layouts

### 3.1 Layout Type: Simple (Single Row)

Use when: Basic CRUD page with minimal filtering needs.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Context Selector ▼]              [🔍 Search...]  [⊞ ☰]  [+ Primary Action] │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Examples:** Dashboard, Settings, simple listing pages

### 3.2 Layout Type: Standard (Single Row + Filters)

Use when: Page has both navigation/tabs AND filter capabilities.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Context ▼]  [Tab1] [Tab2] [Tab3]   [🔍] [Filter▼] [Filter▼]   [⊞☰] [+ CTA] │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Examples:** Tasks page, Browse pages

### 3.3 Layout Type: Complex (Two Rows)

Use when: Complex filtering that requires dedicated space.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Context Selector ▼]                          [⊞ ☰] [⬇ Export] [+ Primary] [⚙] │
├─────────────────────────────────────────────────────────────────────────────┤
│ [Chip] [Chip] [Chip] [Chip]        [🔍 Search...]  [Filter▼] [Filter▼] [Cols] │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Examples:** Law Lists (Laglistor), Document browsers with many filter dimensions

---

## 4. Component Specifications

### 4.1 Zone A: Context Components

#### Context Selector (Dropdown)

```tsx
<ContextSelector
  value={activeId}
  options={options}
  onChange={handleChange}
  placeholder="Välj..."
  showCount={true} // Shows "(11)" count badge
/>
```

**Styling:**

- `min-w-[180px]` on desktop, `w-full` on mobile
- Border with subtle shadow
- Count badge uses `text-muted-foreground`

#### Tab Navigation

```tsx
<TabNavigation
  tabs={['Tab1', 'Tab2', 'Tab3']}
  activeTab={current}
  onChange={handleTabChange}
/>
```

**Styling:**

- Pills or underline style (consistent across app)
- Active state: `bg-primary text-primary-foreground` OR underline
- Gap: `gap-1`

### 4.2 Zone B: Filter Components

#### Search Input

```tsx
<SearchInput
  value={query}
  onChange={setQuery}
  placeholder="Sök..."
  debounceMs={300}
/>
```

**Styling:**

- Width: `w-[200px]` desktop, `w-full` mobile
- Icon: Search icon inside input (left)
- Clear button appears when has value

#### Filter Chips (Toggle Pills)

```tsx
<FilterChips
  options={['Alla', 'Lagar', 'Ändringar', 'Rättsfall']}
  value={selected}
  onChange={setSelected}
  multiple={false} // Single select mode
/>
```

**Styling:**

- Compact pills: `px-3 py-1 text-sm rounded-full`
- Active: `bg-primary text-primary-foreground`
- Inactive: `bg-muted text-muted-foreground hover:bg-muted/80`

#### Filter Dropdown

```tsx
<FilterDropdown
  label="Efterlevnad"
  options={statusOptions}
  value={selectedStatuses}
  onChange={setSelectedStatuses}
  multiple={true}
/>
```

**Styling:**

- Shows label + chevron
- Badge count when filters active: `ml-1 bg-primary text-primary-foreground rounded-full px-1.5`

### 4.3 Zone C: View Controls

#### View Toggle

```tsx
<ViewToggle
  value={viewMode}
  onChange={setViewMode}
  options={[
    { value: 'grid', icon: Grid, label: 'Rutnät' },
    { value: 'table', icon: List, label: 'Tabell' },
  ]}
/>
```

**Styling:**

- Button group with `rounded-lg` container
- Active: `bg-muted`
- Icons only on mobile, icons + optional labels on desktop

#### Column Settings

```tsx
<ColumnSettings
  columns={availableColumns}
  visibility={columnVisibility}
  onChange={setColumnVisibility}
/>
```

**Styling:**

- Popover trigger: `variant="outline" size="icon"`
- Icon: `Columns` from lucide

### 4.4 Zone D: Action Components

#### Primary Action Button

```tsx
<Button onClick={handleAction}>
  <Plus className="h-4 w-4 mr-2" />
  Lägg till dokument
</Button>
```

**Styling:**

- Always uses default `variant` (primary styling)
- Icon + text on desktop
- Icon-only acceptable on mobile if space constrained
- **Position: Always rightmost**

#### Secondary Actions

```tsx
<Button variant="outline" onClick={handleExport}>
  <Download className="h-4 w-4" />
  <span className="hidden sm:inline ml-2">Exportera</span>
</Button>
```

**Styling:**

- `variant="outline"` or `variant="ghost"`
- Positioned left of Primary Action
- Can collapse to icon-only on mobile

#### Settings Button

```tsx
<Button variant="outline" size="icon" onClick={handleSettings}>
  <Settings className="h-4 w-4" />
</Button>
```

**Styling:**

- Always icon-only
- `variant="outline" size="icon"`
- Position: Between secondary actions and primary action, OR far right after primary

---

## 5. Responsive Behavior

### 5.1 Breakpoints

| Breakpoint                | Behavior                                                |
| ------------------------- | ------------------------------------------------------- |
| `< 640px` (mobile)        | Stack rows, collapse labels to icons, full-width inputs |
| `640px - 1024px` (tablet) | Single row when possible, truncate long labels          |
| `> 1024px` (desktop)      | Full layout with all labels visible                     |

### 5.2 Mobile Adaptations

```
MOBILE (Single Column Stack):
┌─────────────────────────┐
│ [Context Selector ▼]    │
├─────────────────────────┤
│ [🔍 Search...         ] │
├─────────────────────────┤
│ [Chip] [Chip] [⊞☰] [+]  │
└─────────────────────────┘
```

**Rules:**

1. Context selector goes full width
2. Search input goes full width
3. Filter chips wrap to new line
4. Action buttons stay in single row, use icons only
5. Secondary actions may move to overflow menu (`...`)

### 5.3 Collapse Priority

When space is constrained, collapse in this order:

1. Button labels → icons only
2. Filter dropdowns → overflow menu
3. Secondary actions → overflow menu
4. Search → collapsible (click icon to expand)

---

## 6. Implementation Guidelines

### 6.1 Recommended Component Structure

```tsx
interface UnifiedToolbarProps {
  // Zone A: Context
  contextSelector?: React.ReactNode
  tabs?: React.ReactNode

  // Zone B: Filters
  search?: React.ReactNode
  filterChips?: React.ReactNode
  filterDropdowns?: React.ReactNode

  // Zone C: View Controls
  viewToggle?: React.ReactNode
  sortControl?: React.ReactNode
  columnSettings?: React.ReactNode

  // Zone D: Actions
  primaryAction?: React.ReactNode
  secondaryActions?: React.ReactNode
  settingsAction?: React.ReactNode

  // Layout
  layout?: 'simple' | 'standard' | 'complex'
}
```

### 6.2 CSS Classes

```css
/* Toolbar container */
.toolbar {
  @apply flex flex-col gap-3;
}

.toolbar-row {
  @apply flex flex-wrap items-center justify-between gap-2 sm:gap-3;
}

/* Zone containers */
.toolbar-zone-left {
  @apply flex flex-wrap items-center gap-2;
}

.toolbar-zone-right {
  @apply flex items-center gap-2;
}

/* Responsive */
@screen sm {
  .toolbar-row {
    @apply flex-nowrap;
  }
}
```

### 6.3 Spacing Constants

| Element               | Gap  | Tailwind                |
| --------------------- | ---- | ----------------------- |
| Between zones         | 16px | `gap-4`                 |
| Within zones          | 8px  | `gap-2`                 |
| Button group internal | 0px  | `gap-0` with `divide-x` |

---

## 7. Page-Specific Configurations

### 7.1 Law Lists (Laglistor)

**Layout:** Complex (Two Rows)

| Row | Zone A        | Zone B                                                               | Zone C          | Zone D                                 |
| --- | ------------- | -------------------------------------------------------------------- | --------------- | -------------------------------------- |
| 1   | List Selector | -                                                                    | View Toggle     | + Lägg till, Export, Grupper, Settings |
| 2   | -             | Content chips, Group chip, Search, Status filter, Responsible filter | Column settings | Visa/Dölj alla                         |

### 7.2 Tasks (Uppgifter)

**Layout:** Standard (Single Row)

| Zone A         | Zone B | Zone C | Zone D       |
| -------------- | ------ | ------ | ------------ |
| Tab Navigation | -      | -      | + Ny uppgift |

_Note: Each tab (Kanban, Lista, Kalender) may have its own sub-toolbar for tab-specific controls._

### 7.3 Documents (Dokument)

**Layout:** Standard (Single Row)

| Zone A     | Zone B | Zone C      | Zone D            |
| ---------- | ------ | ----------- | ----------------- |
| Breadcrumb | Search | View Toggle | + Ny mapp, Upload |

### 7.4 Dashboard

**Layout:** Simple (No Toolbar)

Dashboard doesn't need a toolbar - it's a read-only overview page.

### 7.5 Browse Pages

**Layout:** Simple or Standard

| Zone A     | Zone B              | Zone C | Zone D |
| ---------- | ------------------- | ------ | ------ |
| Breadcrumb | Search, Type filter | Sort   | -      |

---

## 8. Anti-Patterns to Avoid

| Don't                                | Do Instead                               |
| ------------------------------------ | ---------------------------------------- |
| Put primary CTA on the left          | Primary CTA always on far right          |
| Mix filters and actions in same zone | Clear zone separation                    |
| Use more than 2 rows                 | Consolidate or use overflow menu         |
| Hide essential actions behind menus  | Only hide tertiary actions               |
| Different toolbar patterns per page  | Use this spec consistently               |
| Center-align toolbar content         | Left/right alignment creates clear zones |

---

## 9. Accessibility Requirements

1. **Keyboard Navigation:** All toolbar controls must be keyboard accessible
2. **Focus Order:** Left-to-right, top-to-bottom tab order
3. **ARIA Labels:** Icon-only buttons must have `aria-label`
4. **Focus Visible:** Clear focus ring on all interactive elements
5. **Screen Reader:** Filter state changes announced via `aria-live`

---

## 10. Migration Checklist

When refactoring a page to use unified toolbar:

- [ ] Identify which layout type fits the page
- [ ] Map existing controls to zones A, B, C, D
- [ ] Move primary CTA to far right (Zone D)
- [ ] Group all filters together (Zone B)
- [ ] Group all view controls together (Zone C)
- [ ] Ensure responsive behavior works
- [ ] Test keyboard navigation
- [ ] Verify visual alignment with other pages

---

## 11. Change Log

| Date       | Version | Changes               | Author            |
| ---------- | ------- | --------------------- | ----------------- |
| 2026-01-28 | 1.0     | Initial specification | Sally (UX Expert) |
