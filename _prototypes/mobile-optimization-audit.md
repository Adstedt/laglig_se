# Mobile Optimization Audit + Roadmap

**Date:** 2026-05-06
**Scope:** Entire `laglig_se` Next.js 16 app — public marketing, auth, onboarding, workspace, admin
**Companion prototype:** `_prototypes/mobile-optimization.html` (interactive HTML demo of proposed patterns)

---

## Executive summary

The app's **top-level shell is mobile-aware** — left sidebar hides under `md:`, a `<Sheet>`-based `MobileSidebar` drawer takes over, the `Header` has a hamburger via `md:hidden`, and a `useMediaQuery('(max-width: 1023px)')` hook is in active use in `workspace-shell.tsx`. The marketing site, auth flow, and onboarding wizard are all already responsive with sensible breakpoint coverage.

**The pain lives inside content surfaces.** Five recurring problems show up across most workspace pages:

1. **Wide data tables wrapped in `overflow-x-auto`** with no card-list fallback (10+ files)
2. **`<Dialog>` modals** that never adapt to a bottom-sheet pattern (~26 files use `<Dialog>`; only ~3 use `<Sheet>` outside of nav/filters)
3. **Kanban with horizontal-scroll columns** that don't fit any phone viewport
4. **Settings with 7 tabs** that overflow horizontally even with `hidden sm:inline` labels
5. **Tiptap document editor toolbar** packs too many icons into one row

Bottom line: **~60% of pages need touch-up to "good", ~25% need real refactors, ~15% are already mobile-ready.** The good news is the foundation (Sheet primitive, useMediaQuery, MobileSidebar pattern) is already in place — the work is mostly applying these patterns more widely.

---

## 1. Page-by-page audit

Ratings: ✅ ready · ⚠ partial · ❌ desktop-only

### Public + marketing — ✅ ready

| Page | Rating | Notes |
|---|---|---|
| `/` (landing) — `app/(public)/page.tsx` | ✅ | All landing components use mobile-first Tailwind: `sm:text-5xl md:text-6xl lg:text-7xl`, `flex flex-col gap-4 sm:flex-row`, `lg:grid-cols-2`. `navbar.tsx` uses `Sheet` with `MobileNavSection` accordion |
| `/lagar/[id]` (170k+ public law pages) | ✅ | `mx-auto max-w-4xl px-4` — narrow column reads fine on phones |
| `/(legal)/*` legal docs | ✅ | Uses shared `LegalDoc` wrapper; standard responsive container |
| `/rattsfall/*`, `/eu/*` | ✅ | Same pattern as `/lagar` |

**Minor fix candidate:** `alla-lagar/page.tsx` metadata row uses `flex items-center gap-4 text-sm` with no `flex-col sm:flex-row` — could stack awkwardly at <360px.

### Auth — ✅ ready

| Page | Rating | Notes |
|---|---|---|
| `/login` | ✅ | `max-w-md` centered card, `w-full` inputs, `space-y-6` vertical stacking |
| `/signup` | ✅ | Same pattern + Google sign-in button is full-width |
| `/reset-password` | ✅ | Inherits auth layout |

### Onboarding — ⚠ partial

| Page | Rating | Notes |
|---|---|---|
| `/onboarding` (4-step wizard) | ⚠ | Layout container is `max-w-md` (good) but `wizard-stepper.tsx` uses `text-[10px]` step labels that may be unreadable on small viewports. Connector lines `w-8` could overflow at 320px |
| `tier-picker-step.tsx` | ⚠ | 3 `<TierCard>` tiles render in `lg:grid-cols-3` — fine on mobile (single column) but each card is content-heavy; combined page height is long |

**Fix:** bump stepper label to `text-xs sm:text-[10px]` and shrink connectors `w-4 sm:w-8`.

### Workspace shell — ✅ ready (foundation works)

| Surface | Rating | Notes |
|---|---|---|
| `app/(workspace)/layout.tsx` | ✅ | Uses `WorkspaceShell` |
| `components/layout/workspace-shell.tsx` | ✅ | `LeftSidebar` is `hidden md:flex` (line 516 of `left-sidebar.tsx`). `MobileSidebar` Sheet drawer takes over below `md:`. `useMediaQuery('(max-width: 1023px)')` correctly detects mobile/tablet for ChatModal swap. `Toaster position="bottom-center"` works |
| `components/layout/header.tsx` | ✅ | Hamburger `<Button md:hidden>` triggers drawer. Search input `hidden lg:block`. "Skapa" dropdown stays visible (good — primary CTA) |
| `components/layout/mobile-sidebar.tsx` | ✅ | Sheet `side="left"` width `w-[280px]`, accordion sections, workspace switcher, auto-close on link click |

**Action item:** zero — the shell is the right shape.

### Workspace pages — mixed

| Page | Rating | Notes |
|---|---|---|
| `/dashboard` (Hem) | ✅ | Chat-first surface; uses `-m-4 md:-m-6` padding reset for full-bleed on mobile. RightSidebar folded on `/dashboard`. ChatModal swaps in when `isMobile` |
| `/laglistor` | ❌ | `LawListTabs` overflows on phones (6+ tabs, scrolls horizontally awkwardly). `compliance-detail-table.tsx` virtualised wide table — `overflow-x-auto` is the only fallback. No card-list mobile alternative |
| `/laglistor/kontroller` | ❌ | Cycle tabs + cycle-list-table, same pattern as `/laglistor`. Detail page tables (items, findings) are wide |
| `/laglistor/kontroller/[cycleId]` | ❌ | Tabs (Items / Findings / Rapport / Aktivitet) + per-tab tables. Bedömning select + Motivering editor inline — fits desktop, cramped on phone |
| `/tasks` (Kanban) | ⚠ | `flex gap-4 overflow-x-auto pb-4` for columns. 3+ columns don't fit any viewport <760px. Drag-and-drop on touch is also fragile |
| `/krav` | ❌ | Wide table, no card fallback |
| `/filer` | ⚠ | File grid + table with wide columns |
| `/styrdokument/[documentId]/edit` (Tiptap) | ❌ | Toolbar with 19 extensions packed into one horizontal row. Unusable on phone |
| `/settings` (7 tabs) | ⚠ | `hidden sm:inline` on labels helps but 7 tabs still cramp at <430px. Some tab contents use `grid grid-cols-1 md:grid-cols-2` — good. Billing tab is mobile-ready (per Story 5.13 work) |
| `/admin/*` | ❌ | Admin backoffice — wide dashboards, tables, charts. Lower priority (admin = ops desk users) |
| `/permission-denied` | ✅ | Centered message, no responsive issues |
| `/browse/*` (catalogue) | ✅ | Already uses `MobileFilterDrawer` (Sheet) for filters at `<md:` |

---

## 2. Cross-cutting issues

### Issue #1 — Modal strategy lacks mobile-first variant (HIGH IMPACT)

**Problem:** `components/ui/dialog.tsx:38-44` defines `DialogContent` as fixed-center with `max-w-lg w-full` and **no `max-h` constraint**. Tall modals overflow vertically on phones. ~26 files use `<Dialog>`:

- `create-task-modal.tsx`
- `manage-list-modal.tsx`
- `legal-document-modal/index.tsx` (a custom split-panel modal)
- `create-document-dialog.tsx`
- All 4 cycle dialogs (`verify-finding-dialog.tsx`, `manual-close-finding-dialog.tsx`, `complete-cycle-dialog.tsx`, `revert-cycle-dialog.tsx`)
- `task-modal/completion-confirm-dialog.tsx`
- `change-assessment-modal.tsx`
- `workspace-selector-dialog.tsx`, `column-add-dialog.tsx`
- `settings/invite-member-modal.tsx`

Only 3 surfaces correctly use `<Sheet>` for mobile-pattern: `mobile-sidebar.tsx`, `mobile-filter-drawer.tsx` (catalogue + search).

**Recommendation:** introduce a `<ResponsiveDialog>` adaptive wrapper that renders `<Dialog>` on `≥md` and `<Sheet side="bottom">` on `<md`. Same children, same headers, same forms — only the chrome swaps. Refactor the 26 dialogs to use this wrapper over time; new modals always use it.

```tsx
// Sketched API
<ResponsiveDialog open={open} onOpenChange={setOpen}>
  <ResponsiveDialogContent>
    <ResponsiveDialogHeader>
      <ResponsiveDialogTitle>...</ResponsiveDialogTitle>
    </ResponsiveDialogHeader>
    {/* form content */}
    <ResponsiveDialogFooter>
      <Button>Save</Button>
    </ResponsiveDialogFooter>
  </ResponsiveDialogContent>
</ResponsiveDialog>
```

The shadcn-recommended pattern: vaul `<Drawer>` on mobile (slide from bottom, has handle, swipe-to-dismiss) + `<Dialog>` on desktop. Vaul isn't installed yet; we can either install it OR use `<Sheet side="bottom">` from existing primitives. Sheet works fine; vaul is nicer.

### Issue #2 — Tables don't transform to cards on mobile (HIGH IMPACT)

**Problem:** every table in the workspace area uses `<div className="overflow-x-auto"><Table>` and that's it. Horizontal scroll on touch is poor UX, especially for tables with 5+ columns (typical for `compliance-detail-table.tsx`, `cycle-list-table.tsx`, `activity-log-table.tsx`, `krav-table.tsx`, `document-list-table.tsx`).

**Recommendation:** introduce a "table-as-cards-on-mobile" pattern. The standard approach:

```tsx
<div className="hidden md:block">
  <Table>{/* normal table rows */}</Table>
</div>
<div className="md:hidden space-y-2">
  {rows.map((row) => (
    <RowCard key={row.id} row={row} />
  ))}
</div>
```

`RowCard` collapses the most important columns into a 2-3 line stack with primary action chevron. Pattern works for compliance rows, cycle list, krav, document list, and activity log. Each table needs its own RowCard adapter (~50-80 LOC each), but the shape is identical so a single `<TableRowCard>` primitive could carry shared visual structure (title, subtitle, status badge, chevron).

For the **virtualised** `compliance-detail-table.tsx`, this is more involved — we'd need a virtualised card-list. TanStack Virtual handles this fine; it's just two render variants of the same data.

### Issue #3 — Kanban doesn't work on phones (MEDIUM IMPACT)

**Problem:** `/tasks` renders kanban columns side-by-side with `flex gap-4 overflow-x-auto pb-4`. Three columns at ~280px each = 840px+ which doesn't fit any phone. Drag-and-drop on touch is unreliable too.

**Recommendation:** **mobile = single-column mode with column tabs**. At `<md:`, show:
- A horizontal pill tab bar at the top: `Att göra (5) · Pågående (3) · Klar (12)`
- Below: just the active column's cards in a vertical list
- "Move" action on each card swaps it to another column via a Sheet picker
- No drag-and-drop on mobile (use the explicit Move action instead)

This pattern is what Linear, Notion, and Trello all do on phones. Existing Kanban view stays for `≥md`.

### Issue #4 — Settings 7 tabs (MEDIUM IMPACT)

**Problem:** `Allmänt | Företagsprofil | Team | Fakturering | Aviseringar | Integrationer | Arbetsflöde` — even with `hidden sm:inline` labels showing only icons, 7 icons-only tabs cramp at <430px and may scroll.

**Recommendation:** swap to a `<Select>` (dropdown) on mobile, keep tabs on `≥md`. Pattern:

```tsx
<div className="md:hidden">
  <Select value={initialTab} onValueChange={handleTabChange}>
    {/* 7 options */}
  </Select>
</div>
<TabsList className="hidden md:flex">
  {/* desktop tabs */}
</TabsList>
```

Bonus: select dropdowns are familiar to mobile users and work better with iOS native picker.

### Issue #5 — Tiptap toolbar packs 19 extensions (LOW-MEDIUM IMPACT)

**Problem:** `/styrdokument/[documentId]/edit` toolbar has Bold/Italic/Underline/Strikethrough/H1/H2/H3/Lists/TextAlign/Color/Highlight/Image/Link/Mention/Table/etc. all in one horizontal row. Unusable on phone.

**Recommendation:** mobile gets a **compact 6-icon primary toolbar** (Bold/Italic/H/List/Link/More) + a "More" button that opens a Sheet with the secondary actions. Or — bigger change — adopt a floating contextual menu that appears when text is selected (like Notion mobile).

### Issue #6 — Toast position not safe-area-aware

**Problem:** `<Toaster position="bottom-center" />` in `workspace-shell.tsx:115`. On iOS Safari with bottom toolbar visible, toasts may overlap the Safari UI.

**Recommendation:** Sonner supports `offset` prop with safe-area inset:

```tsx
<Toaster position="bottom-center" offset={{ bottom: 'calc(env(safe-area-inset-bottom) + 16px)' }} />
```

### Issue #7 — No bottom action bar for mobile forms

**Problem:** modals and edit pages have action buttons at the bottom of long forms. On mobile, the user has to scroll all the way down to save/cancel.

**Recommendation:** sticky bottom action bar in mobile modals (the bottom-sheet variant naturally provides this). Pattern:

```tsx
<div className="sticky bottom-0 -mx-6 -mb-6 mt-6 border-t bg-background px-6 py-4 md:static md:mx-0 md:mb-0 md:border-0 md:p-0">
  <div className="flex gap-2">
    <Button variant="outline" className="flex-1 md:flex-none">Avbryt</Button>
    <Button className="flex-1 md:flex-none">Spara</Button>
  </div>
</div>
```

---

## 3. Recommended new primitives

These should be added to `components/ui/` (or a new `components/mobile/` folder) before the page-by-page refactor:

1. **`<ResponsiveDialog>`** — adaptive Dialog/Sheet wrapper based on `useIsMobile()`. Same API as Dialog. ~40 LOC.
2. **`<TableRowCard>`** — primitive for mobile-card row representation: `{ title, subtitle?, status?, meta?, onClick }` with chevron + tap target. ~30 LOC.
3. **`<MobileColumnTabs>`** — pill-tab bar for kanban-on-mobile. Generic over column shape. ~40 LOC.
4. **`<MobileTabSelect>`** — Select dropdown that mirrors a TabsList for mobile. ~30 LOC.
5. **`<StickyMobileActionBar>`** — bottom sticky action container, auto-flat on `≥md`. ~20 LOC.
6. **`<EditorMoreMenu>`** (Tiptap-specific) — Sheet with secondary editor commands.

Total: ~190 LOC of new primitives that unlock dozens of refactors.

---

## 4. Phased implementation roadmap

### Phase A — Foundation primitives (1–2 days)
- Build `ResponsiveDialog`, `TableRowCard`, `MobileTabSelect`, `StickyMobileActionBar` primitives in `components/ui/`
- Add `vaul` package for Drawer (or use existing `Sheet side="bottom"`)
- Update `Toaster` with safe-area offset
- Add unit tests for each primitive

### Phase B — High-traffic page refactors (3–5 days)
Priority order:
1. **`/laglistor`** — `compliance-detail-table` → mobile card list. Tab strip → MobileTabSelect on mobile. Single-column grouped view stacks naturally
2. **`/tasks`** — Kanban → MobileColumnTabs + single-column card list on mobile, no drag-drop
3. **`/settings`** — 7-tab strip → MobileTabSelect on mobile
4. **`/laglistor/kontroller`** — cycle list table → mobile cards. Cycle detail tabs → MobileTabSelect
5. **All `<Dialog>` modals** → swap to `ResponsiveDialog`. Bulk find-and-replace; ~26 files; mostly mechanical

### Phase C — Editor + admin (2–3 days)
1. Tiptap editor toolbar — compact mobile variant with `EditorMoreMenu` Sheet
2. Admin pages — apply same table-card pattern (lower priority — internal ops users)

### Phase D — Polish (1–2 days)
1. Onboarding wizard stepper readable at 320px
2. Public law page metadata stacking
3. Audit toast positioning across all flows
4. Mobile-specific testing pass on real devices (iPhone SE, Pixel 5, iPad mini)

**Total estimate:** 7–12 days of focused work to bring the entire app to "mobile-good".

---

## 5. Technical preferences

- **Use existing `useMediaQuery` and `useIsMobile` hooks** — they're in `lib/hooks/`. The mobile hook lives at `@/lib/hooks/use-mobile` (NOT `use-is-mobile`); `MOBILE_BREAKPOINT = 768` matches Tailwind's `md:`. Don't introduce new ones.
- **Prefer `<Sheet>` over installing `vaul`** for v1 — Sheet is already there and good enough. Switch to vaul later if we want gesture-aware drawers (handle drag-down to dismiss).
- **Use canonical badge tones**, never hand-roll status colors. Status pills must come from `getStatusBadgeProps(domain, value)` in `lib/ui/badge-tones.ts`. Mobile row cards in particular tend to attract one-off `bg-amber-50 text-amber-900` — those are drift. Map to `{ tone, variant, label }` and pass to the Badge primitive. Domain reminders:
  - `compliance-status PAGAENDE` → **info · soft "Delvis uppfylld"** (blue), NOT amber.
  - `cycle-status PAGAENDE` → **info · soft "Pågående"** (blue).
  - Warning-amber is for `finding-severity MINOR`, `finding-type OBSERVATION`, and ad-hoc "Saknar bevis" warnings.
  - Danger-rose is for `EJ_UPPFYLLD`, `AVVIKELSE`, `CRITICAL` (solid).
- **Pair Safiro with `font-medium`** every time. Only weight 500 is registered for Safiro; `font-bold`/`font-semibold` triggers browser fake-bold and may fall back to system-ui (per project memory).
- **Stay mobile-first in Tailwind** — no override modifiers should be needed; just add `md:` and `lg:` for desktop enhancements.
- **Don't fork desktop UI** — every mobile pattern should be the SAME component with branched chrome, not a separate `MobileXyz` component sitting alongside `Xyz`. Exception: nav (where `MobileSidebar` is justified because the IA is genuinely different).
- **Test breakpoints:** target 375px (iPhone SE), 390px (iPhone 14), 768px (iPad portrait), 1024px (iPad landscape / desktop). The `hidden md:` (768px) breakpoint is the workhorse split point.

---

## 6. Anti-patterns to avoid

- ❌ **Don't add a top-level "mobile mode" routing branch** — keep one app, one route tree, branch in components only
- ❌ **Don't use `display: none` for important content on mobile** — if it doesn't fit, transform it; don't hide it
- ❌ **Don't try to make tables scroll well horizontally** — they don't. Cards.
- ❌ **Don't put primary CTAs in dropdowns on mobile** — make them full-width sticky bottom buttons
- ❌ **Don't auto-trigger keyboard on page load** — kills mobile UX (covers half the screen)
- ❌ **Don't use `position: fixed` widgets without `safe-area-inset-bottom`** — and don't forget `safe-area-inset-top` for full-screen sheets / modal headers (notch / Dynamic Island will overlap)
- ❌ **Don't pair `font-safiro` with `font-bold` or `font-semibold`** — Safiro ships at weight 500 only; the browser fakes the heavier weight and frequently falls back to system-ui. Always pair Safiro with `font-medium`.
- ❌ **Don't hand-roll status pill colors** — every `bg-amber-50 text-amber-900` instance for "Pågår" is drift. Use `getStatusBadgeProps(domain, value)` from `lib/ui/badge-tones.ts` (Story 22.1).
- ❌ **Don't use `truncate` on Swedish content text** — compounds get cut mid-syllable. Use `break-words hyphens-auto` on `<md:`. Reserve `truncate` for IDs/URLs/emails.
- ❌ **Don't make the "primary action" pop loud in a Sheet of options** — a Sheet of source options (Camera / Library / File / Link) should look uniform; signal the recommended choice with a subtle "Föreslås" tag or a leading-icon color treatment, not a full filled-border highlight that screams "tap this."

---

## 7. Open questions for product

1. **Drag-and-drop kanban on mobile:** confirm the call to drop drag-drop in favor of explicit Move action. Some users may have built muscle memory on desktop and expect parity.
2. **Tiptap mobile editing:** is full document authoring even a mobile use case, or is mobile primarily for review/comment? If review-only, we could ship a mobile read-only viewer with a "Open in desktop to edit" CTA and skip the toolbar refactor entirely.
3. **Admin pages:** worth optimizing for mobile? Audience is internal ops — they probably use desktop.
4. **Onboarding tier-picker on small screens:** with 3 tiles stacked vertically + each having ~12 features, the page is tall. Consider compact comparison table format on mobile.
5. **Public law pages (170k+):** SEO-critical. Mobile UX directly affects bounce rate + Core Web Vitals. Should be highest priority of all if bounce data shows mobile dropoff.

---

## 7b. Modal-by-modal deep dive (LegalDocumentModal + TaskModal + the rest)

The modal layer needs more than a generic `ResponsiveDialog` swap because the two flagship modals — `LegalDocumentModal` (compliance row click) and `TaskModal` (task card click) — are content-rich split-panel surfaces that already get full-screen treatment on mobile but suffer from a 3000px-stack-of-everything scroll. They need a **tab-based panel layout** on mobile, not just a Sheet wrapper.

### LegalDocumentModal — `components/features/document-list/legal-document-modal/`

**Current mobile state (verified by reading `components/shared/split-panel-modal/index.tsx:162-210`):**
- ✅ `SplitPanelModal` shell already does `max-md:max-w-full max-md:max-h-full max-md:h-full max-md:overflow-hidden` — full-screen on mobile
- ✅ `max-md:flex-col` stacks left + right panels vertically below `md:`
- ✅ `max-md:hidden` on chat panel — chat is hidden on mobile (caller decides fallback, currently no fallback wired)
- ❌ "Stacking" means user scrolls past Lagtext → KravpunkterAccordion → TasksAccordion → ActivityTabs (left) → DetailsBox → ComplianceHealthBox → BusinessContext → ComplianceNarrative → LinkedArtifactsPanel → QuickLinksBox (right) before reaching the bottom. ~3000px of scroll on a phone
- ❌ No sticky bottom action bar — primary CTA (Markera som klar / Spara ändringar) is buried somewhere mid-scroll
- ❌ AI chat completely inaccessible on mobile (the chat trigger in modal-header.tsx isn't paired with a Sheet fallback)

**Recommended mobile layout (3-tab pattern):**

```
┌─────────────────────────────────────┐
│ [×] Arbetsmiljölagen           [⋯]  │  Sticky compact header
│     AML 1977:1160  • [Pågår]        │
├─────────────────────────────────────┤
│  Översikt  │  Krav · 5  │ Aktivitet │  3 tabs (replaces left/right stack)
├─────────────────────────────────────┤
│                                     │
│  [Översikt: right-panel content     │
│   stacked into mobile cards —       │
│   Status, Compliance health,        │
│   Business context, Linked          │
│   artifacts, Quick links]           │
│                                     │
├─────────────────────────────────────┤
│ [💬]  Markera som klar              │  Sticky bottom action
└─────────────────────────────────────┘
```

- **Tab 1 (Översikt):** the current right-panel content — Details, Compliance health, Business context, Compliance narrative, Linked artifacts, Quick links
- **Tab 2 (Krav · N):** KravpunkterAccordion + ChecklistEditor as expanded list (the heaviest interaction surface — needs full screen)
- **Tab 3 (Aktivitet):** ActivityTabs nested (Alla / Kommentarer / Historik) + comment input docked at the bottom

**Implementation:** in `SplitPanelModal`, add three new optional props (`mobileTabs`, `mobilePillStrip`, `mobilePrimaryAction`). On `isMobile`, render those instead of the side-by-side split. Desktop callers unchanged. Each modal that opts in maps its left/right panel content into the new slots.

**AI chat fallback:** when `aiChatOpen` fires on mobile (currently `effectiveChatOpen = aiChatOpen && isLargeScreen` short-circuits to false), open a separate full-screen `<Sheet side="bottom">` with the AiChatPanel content instead.

### TaskModal — `components/features/tasks/task-modal/`

**Same shell, simpler content shape.** Title editor, description editor, comments on the left; status/priority/assignee/due/linked-laws/linked-cycles/quick-links on the right.

**Recommended mobile layout (sticky pill strip + 2 tabs):**

```
┌─────────────────────────────────────┐
│ [×] Uppgift                    [⋯]  │  Sticky compact header
│     Konsekvensbedöm 2024:1234       │
├─────────────────────────────────────┤
│ [Pågår] [Hög] [👤 Anna] [📅 2 jun] →│  Sticky pill strip — tap any pill
├─────────────────────────────────────┤  → focused bottom Sheet picker
│   Detaljer    │   Aktivitet · 3     │  2 tabs
├─────────────────────────────────────┤
│                                     │
│  [Beskrivning editor]               │
│  [Kopplade lagar · 1]               │
│  [Kopplade kontroller · 1]          │
│  [Bilagor · 0]                      │
│                                     │
├─────────────────────────────────────┤
│ [💬]  Markera som klar              │  Sticky bottom action
└─────────────────────────────────────┘
```

The **sticky pill strip** is the key innovation here vs the legal-doc modal — task metadata fits in a single row of pills (Status, Priority, Assignee, Due) so we surface it above the tabs. Tapping any pill opens a focused bottom Sheet picker (single-purpose, thumb-friendly, native-feeling). This pattern is what Linear, Notion, Things, and Asana all do on mobile.

**Tab 1 (Detaljer):** Description editor + Linked laws + Linked cycles + Attachments
**Tab 2 (Aktivitet · N):** ActivityFeed + comment input docked at bottom

**Implementation:** same SplitPanelModal extension as legal-doc, plus a `<MetadataPillStrip>` shared component that takes `Field[]` and renders pill + sheet picker per field. Pillars apply equally to legal-doc modal status/priority/responsible.

### Other modals — apply ResponsiveDialog wrapper

| Modal | File | Pattern | Effort |
|---|---|---|---|
| **CreateTaskModal** | `tasks/create-task-modal.tsx` | Pure form. ResponsiveDialog → bottom Sheet. Single-column form. Sticky "Spara" | XS |
| **ManageListModal** | `document-list/manage-list-modal.tsx` | Long toggle list. ResponsiveDialog → full-screen Sheet with sticky search at top + sticky save at bottom | S |
| **ChangeAssessmentModal** | `change-assessment-modal.tsx` | Multi-step (Påverkan/Åtgärd/Bevis). ResponsiveDialog → Sheet. Step indicator inside | M |
| **verify-finding-dialog** | `compliance-audit/cycle-detail/` | Confirmation. ResponsiveDialog | XS |
| **manual-close-finding-dialog** | same | Confirmation | XS |
| **complete-cycle-dialog** | same | Confirmation | XS |
| **revert-cycle-dialog** | same | Confirmation | XS |
| **InviteMemberModal** | `settings/invite-member-modal.tsx` | Email + role form. ResponsiveDialog | XS |
| **WorkspaceSelectorDialog** | `workspace-selector-dialog.tsx` | List of workspaces. ResponsiveDialog → Sheet | XS |
| **ColumnAddDialog** | `tasks/column-add-dialog.tsx` | Small form. ResponsiveDialog | XS |
| **CreateDocumentDialog** | `styrdokument/create-document-dialog.tsx` | Form + template picker grid. ResponsiveDialog. Templates stack 1-col | S |
| **CompletionConfirmDialog** | `tasks/task-modal/completion-confirm-dialog.tsx` | Tiny confirm. ResponsiveDialog | XS |

### New / extended primitives needed for the modal work

Beyond the 6 primitives in section 3, the modal-specific work needs:

7. **`SplitPanelModal` extensions** — add `mobileTabs`, `mobilePillStrip`, `mobilePrimaryAction` props. Existing desktop slots unchanged. ~80 LOC delta in the shell.
8. **`<MetadataPillStrip>`** — shared component for the task-modal sticky strip. Takes `{ pills: PillSpec[] }` where each pill specifies icon, label, value, and an `onPress` that opens a bottom Sheet picker. ~60 LOC.
9. **`<BottomSheetPicker>`** — single-purpose mobile picker (Status, Priority, Assignee, Due-date variants). Reuses Sheet primitive. ~50 LOC per picker variant × 4 = ~200 LOC.
10. **`<ChatSheetFallback>`** — `<Sheet side="bottom" className="h-[100dvh]">` that wraps `AiChatPanel`. Triggered when `aiChatOpen && isMobile`. ~30 LOC.

**Total additional primitives:** ~370 LOC on top of the 190 from section 3 = ~560 LOC of new infrastructure.

### Updated phased roadmap (modal-aware)

This replaces phases A and B from section 4 with sharper modal-focused breakdown:

**Phase A — Foundation primitives (1–2 days)**
- ResponsiveDialog (already in section 3)
- SplitPanelModal mobile-tab extensions
- MetadataPillStrip
- BottomSheetPicker variants (Status, Priority, Assignee, Due date)
- ChatSheetFallback
- TableRowCard, MobileTabSelect, StickyMobileActionBar, EditorMoreMenu (from section 3)

**Phase B1 — Flagship modal refactors (2–3 days)**
1. **TaskModal** — wire pill strip + tabs + sticky action. Drives the pattern proof
2. **LegalDocumentModal** — same wiring with 3 tabs instead of 2

**Phase B2 — Bulk Dialog → ResponsiveDialog (1–2 days)**
- All 10 small modals from the table above. Mostly mechanical find-and-replace
- One PR per feature area to keep diff sizes reviewable

**Phase B3 — Page-level mobile refactors (2–3 days)**
- /laglistor table → row cards
- /tasks kanban → column tabs
- /settings 7-tab → MobileTabSelect
- /kontroller cycle list → row cards

**Phase C — Editor + admin (2–3 days)** (unchanged)
**Phase D — Polish (1–2 days)** (unchanged)

**Updated total estimate:** 8–13 days. The modal work adds ~1 day vs the original estimate but is high-leverage — these are the deepest user surfaces in the app.

---

## 7c. Additional surface gaps (post-modal-deep-dive review)

The first audit was breadth-focused. This section captures gaps surfaced on a second pass, prioritized by user-facing impact.

### HIGH — fix before mobile sprint declares done

#### A1. Notification bell: Popover overflows on phones
**File:** `components/features/notifications/notification-bell.tsx:127`
**Current:** `<PopoverContent align="end" className="w-80 p-0">` — fixed 320px wide, anchored to the bell icon at the right edge of the header. On a 390px viewport that's ~80% of width hugging the right edge; on smaller viewports it'll clip.
**Fix:** swap to `<Sheet side="right" className="w-full sm:max-w-md">` on mobile (or full-screen). Same content, drawer chrome.
**Effort:** XS (~30 LOC)

#### A2. AI chat content rendering — needs its own audit pass
The chat shell already adapts (ChatModal swap on `isMobile`), but I never audited the rich content INSIDE chat messages. Concrete components to verify:
- **`components/features/ai-chat/citation-pill.tsx`** — citation pills inside streamed text. On tap → opens a citation-detail panel. On mobile that's modal-on-modal — needs the citation detail to be a Sheet, not a Dialog or Popover
- **`components/features/ai-chat/details/citation-detail.tsx`** — the panel that shows the source-document excerpt + AI explanation
- **`components/features/ai-chat/streaming-indicator.tsx`** + Streamdown markdown renderer — streaming text reflow at narrow widths. Code blocks (Streamdown's `@streamdown/code`) typically use `overflow-x-auto` — verify they wrap or scroll cleanly without breaking the chat bubble
- **`ToolCallRow`** (per `chat-message.tsx`) — collapsed tool-call rows; tap to expand. Needs touch-friendly tap target
- **Agent action cards** (Stories 14.22, 14.23, 14.24 — `agent-action-card-foundation`, `agent-action-extended-types-batch`, `agent-draft-document-approval`) — rich interactive cards that include action plans, draft-document approvals, change assessments. These are the most complex content surfaces in chat and warrant individual layout review
- **Streaming pacing** — server-side smoothStream is character-level (8ms delay per Story 14.x notes); on mobile this is fine, but verify no client-side typewriter is layered on top

**Action:** schedule a focused 4-hour AI-chat-content audit pass. Pick the 3 most common chat scenarios (basic question, change-assessment with action card, document-draft approval) and walk each on a phone.

#### A3. Global search ships disabled — but plan for mobile NOW
**File:** `components/layout/header.tsx:163-172`
**Current:** `<Input ... disabled title="Sökning kommer snart" />` wrapped in `<div className="hidden lg:block">`. So today no one can search; the input only renders on `≥lg` anyway.
**Future risk:** when search lights up, mobile users won't see the input at all (`hidden lg:block`). The mobile pattern is well-established: a search-icon-only button in the header that opens a full-screen search Sheet with auto-focused input + recent + results. Capture this in the search story so it's not retrofitted later.
**Effort:** N/A today; ~40 LOC when search ships

#### A4. iOS keyboard + safe-area covers sticky bars
**Pattern:** every sticky-bottom action bar we proposed (modals, edit pages) needs to shift above the iOS keyboard when an input gains focus, and to clear the home-indicator inset when no keyboard is visible. Symmetrically, every full-screen sheet header needs to clear the notch / Dynamic Island. Default browser behavior covers neither.

**Fix bundle (one PR):**
1. **Viewport meta** in `app/layout.tsx`:
   ```tsx
   export const viewport: Viewport = {
     width: 'device-width',
     initialScale: 1,
     viewportFit: 'cover',
     interactiveWidget: 'resizes-content', // iOS keyboard pushes layout up
   }
   ```
2. **Use `100dvh`** (dynamic viewport) consistently instead of `100vh`. `chat-modal.tsx:49` already does this — extend the pattern. Avoid `100svh` (stable small) for full-screen surfaces; that locks layout to the smallest possible viewport even when the URL bar collapses, which wastes space.
3. **Sticky-bottom bars: `pb-[calc(env(safe-area-inset-bottom)+12px)]`** so the home-indicator inset is respected. The `+12px` keeps a comfortable gap.
4. **Full-screen sheet/modal headers: `pt-[env(safe-area-inset-top)]`** so notch / Dynamic Island doesn't overlap the X button. Verify `chat-modal.tsx` headers honor this.
5. **For complex cases** (chat input that must stay glued to keyboard top): listen for `window.visualViewport.resize` + apply `transform: translateY()`. Use sparingly — the meta tag handles 90% of cases.

**Effort:** S — one viewport meta change + add safe-area utility + bulk-replace `100vh` → `100dvh`.

#### A5. Tooltip touch fallback (a11y, WCAG 2.1)
**Problem:** shadcn `<Tooltip>` only triggers on hover/focus. On touch devices, tooltips never fire — users miss the explanation entirely.
**Affected:** icon-only buttons, status-badge tooltips ("saknar bevis" warnings on kravpunkter), responsibility avatars, kebab-menu trigger explanations, etc.
**Fix patterns (pick one per case):**
- Replace tooltip-only labels with `<span className="sr-only md:hidden">` so screen readers + small viewports always see the label
- Swap critical Tooltip → `<HoverCard>` (Radix has touch-friendly behavior on long-press)
- Add a visible info-icon `<Info />` next to the trigger that opens a Sheet on tap
**Audit task:** grep `<Tooltip` across `components/features/**` and decide per-case which pattern fits.
**Effort:** M (depends on count — likely 30+ instances)

#### A6. Touch target sizing (WCAG 2.5.5 AAA)
**Problem:** WCAG 2.5.5 AAA recommends 44×44px minimum for touch targets. Our `<Button size="icon">` is `h-10 w-10` (40px, per `components/ui/button.tsx:26`) and `size="sm"` is `h-9` (36px). 40px clears WCAG **AA** (24px minimum), but Apple HIG and Material both target ≥44px and the 4-pixel margin matters on dense rows / kebab clusters.
**Affected:** kebab menus on row cards, modal close buttons, icon-only header buttons, tab close buttons, density-toggle filter buttons (`size="sm"` × icon-only is the worst offender at 36px square).
**Fix:** add a `size="icon-mobile"` variant in `components/ui/button.tsx` that's `h-11 w-11` on mobile and decays to `h-10 w-10` on `md+`. Use it everywhere icon-only buttons appear in row chrome / sticky bars.
```tsx
size: {
  default: 'h-10 px-4 py-2',
  sm: 'h-9 rounded-md px-3',
  lg: 'h-11 rounded-md px-8',
  icon: 'h-10 w-10',
  // NEW: bumps to 44px on phones, no change on desktop
  'icon-mobile': 'h-11 w-11 md:h-10 md:w-10',
},
```
Wrap any non-Button tap target (inline anchor, label) in `min-h-[44px] min-w-[44px]` (or pad it) on `<md:` to keep WCAG 2.5.5 AAA across the app. Important: padding alone counts toward the target — don't shrink the element if the padded hit area meets 44px.
**Effort:** S — single primitive change + bulk find-and-replace.

#### A7. Swedish word wrapping
**Problem:** Swedish compound words are long. `Lagefterlevnadskontroll`, `Personuppgiftsbiträdesavtal`, `Konsekvensbedömning`, `Arbetsmiljöverkets föreskriftssamling` — none fit a phone column without wrapping or truncating.
**Three-layer fix** (apply in order):
1. **Set `lang="sv"` on `<html>`** in `app/layout.tsx` (verify — likely already set). Swedish hyphenation rules require this for `hyphens: auto` to use the right dictionary.
2. **Use `hyphens-auto` (Tailwind) + `break-words` together** for content text (titles, descriptions, body): `Lagefterlevnadskontroll` → `Lagefter-` ↩ `levnadskontroll` instead of mid-syllable break or ellipsis.
3. **Reserve `truncate` for identifiers only** — IDs (`SFS 1977:1160`), URLs, email addresses where mid-word break harms readability.

**Recommended utility class composition for content cells:**
```tsx
<span className="break-words hyphens-auto md:hyphens-none line-clamp-2">
  {longSwedishTitle}
</span>
```
The `md:hyphens-none` disables hyphenation on desktop where the column is wider (no wrap needed); mobile gets it. `line-clamp-2` caps at two lines so a row card never grows unbounded.

**Audit:** grep `truncate` across `components/features/**` — likely 50+ instances. Triage by content type, replace per the rule above.

**Risk:** if a row card uses `truncate` on a long Swedish title, user sees `Lagefterlevnadsko…` and can't tell what it is.
**Effort:** M (manual case-by-case; ~50 instances expected, faster after the first 5 set the pattern).

### MEDIUM — should ship in mobile sprint but not blocking

#### B1. DropdownMenu overflow on right edge
**File:** anywhere `<DropdownMenu>` appears — kebab menus on row cards, "more actions" on table rows
**Issue:** menu aligns right of trigger; on a phone's right-edge trigger the menu can overflow off-screen. Radix has collision detection (`avoidCollisions={true}` is default), but worth verifying it kicks in at <410px viewport. If not, add `align="end" sideOffset={8} collisionPadding={16}` explicitly.

#### B2. Empty states + error pages
**Files to audit:** `app/error.tsx`, per-route `error.tsx` files, `not-found.tsx`, the "Inga resultat" / "Tomt" empty state cards in `/laglistor`, `/tasks`, `/filer`, etc.
**Standard mobile pattern:** centered icon + headline + body + single primary CTA. Avoid multi-column "what to do next" cards that'll squeeze. Each empty-state component takes ~10 LOC to verify/fix.

#### B3. Modal skeletons sized for desktop
**Files:** `components/features/document-list/legal-document-modal/modal-skeleton.tsx`, `components/features/tasks/task-modal/modal-skeleton.tsx`
**Issue:** skeletons mirror the desktop split-panel layout (2 columns of skeleton blocks). On mobile (full-screen tabs per pattern 10/11), the skeleton shape is wrong — should be 1-column stack, no panel divider.
**Fix:** add a mobile branch to each skeleton matching the new tab layout. Mechanical.

#### B4. Comment threading on narrow screens
**File:** `components/features/document-list/legal-document-modal/threaded-comments.tsx` (and TaskModal's `threaded-comments.tsx`)
**Issue:** nested reply indentation on a 390px viewport eats horizontal real estate. After 1-2 levels the comment text is squeezed into a narrow column.
**Fix patterns:**
- Cap visible depth at 2 levels on mobile; deeper replies show as flat "↳ replied to {name}" prefix
- Or: collapse all nesting into a single thread with prefix labels
**Effort:** M (UI change in one component)

#### B5. File / PDF preview
**Surface:** `/filer` → click file. Likely renders a PDF iframe or a custom preview. Mobile PDF viewing is hit-or-miss across browsers.
**Audit needed:** confirm what's actually shown, whether pinch-to-zoom works, whether downloading is offered as a fallback.

#### B6. Combobox / typeahead pickers
**Surfaces:** member assignment (e.g., "ansvarig" picker), law-tagging, list-item linking — anywhere we pick from a long list with type-to-search.
**Issue:** shadcn `<Command>` inside a Popover renders a small floating layer. On mobile better UX is a full-screen Sheet with auto-focused search input at the top + virtualized result list.
**Fix:** wrap Command usage in a `<MobileTypeaheadSheet>` primitive that swaps Popover → Sheet at `<md:`.

#### B7. Date pickers (native vs custom)
**Question:** what date picker do we use for due dates, trial end dates, etc.? `react-day-picker` (custom) renders a calendar grid that may be too small on mobile. `<input type="date">` (native) gives the iOS/Android native picker — much better mobile UX, less customizable.
**Recommendation:** for production use, prefer native on `<md:` and custom on `≥md:` — best of both worlds.

#### B8. Auto-focus on mount
**Pattern:** several modals (CreateTaskModal, CommentInput, search) probably auto-focus an input on mount. On iOS this triggers the keyboard to slide up immediately, covering 50% of the screen and pushing the modal content. Bad first impression.
**Fix:** on mobile, defer auto-focus to a user-initiated tap. Or remove auto-focus entirely on `<md:` — the user is already tapping into the modal, so they can tap the input.

### LOW — defer or skip for MVP

| Item | Why defer |
|---|---|
| Long-press multi-select | We don't have batch operations yet |
| Swipe-to-delete on row cards | Not expected for a B2B compliance app; explicit Delete button in DropdownMenu is clearer |
| Pull-to-refresh on lists | Not expected for B2B SaaS; data is mostly stable |
| PWA / Service Worker / install prompt | Not part of MVP product; can add later |
| Offline indicator + offline support | Same — full offline-first would be a story of its own |
| Print views (settings, invoices) | Stripe-hosted invoices are already print-friendly. Settings doesn't need print |
| `theme-color` meta + safe-area-inset CSS variables | Quick wins (~10 LOC each) but low impact; bundle into a "polish PR" later |
| Long-press to copy citation | Existing browser select-and-copy works fine |
| Share-target API | Not a frequent enough use case |

### Verify-before-ship — likely fine but worth a sanity check

| Item | Likely status | How to verify |
|---|---|---|
| **Workspace switcher dropdown** | ✓ Saw it work in screenshots | Click switcher on phone — should open as Sheet or list-Popover that fits |
| **Stripe Checkout return on mobile** | ✓ Stripe-hosted = always responsive | Manually: visit `/settings?tab=billing&reason=trial_expired` on phone, click Aktivera Team, complete with `4242 4242 4242 4242`, verify the `?success=true` landing renders |
| **Trial-ended emails (Story 5.13)** | ✓ React Email primitives are responsive by default | Open the email in Gmail mobile app + iOS Mail app + Outlook mobile |
| **Onboarding tutorial modal** | ⚠ Has a prototype at `_prototypes/onboarding-tutorial-modal.html` — unclear if shipped to `app/onboarding/_components/` | Check whether the tour is actually wired in production, then test touch flow |
| **AiChatPanel inside SplitPanelModal on mobile** | ⚠ Currently `max-md:hidden` with no fallback (per pattern 10) | Pattern 10 already proposes a Sheet fallback; verify after implementation |
| **Toaster `bottom-center` with safe-area** | (in original audit) | Already noted; verify after the offset fix |

### Updated total surface count

The first audit covered ~25 pages + ~6 cross-cutting issues + ~12 modals = **~43 surfaces**. Adding section 7c brings ~13 additional gaps + 8 verify items + 9 deferred items = **~30 more line-items to track**. Total: **~73 mobile-surface concerns** documented across the app. The phased roadmap (section 4) already absorbs A1, A4-A7, B3, B6 within Phase A/B; A2 (AI chat) needs its own dedicated 1-day mini-audit added between Phases B and C. The deferred items can stay deferred.

---

## 7d. Mobile-native: photo evidence capture (highest product leverage)

**Why this matters more than the rest of the audit:** the gaps in sections 7a–7c are about making the existing desktop product *workable* on a phone. This section is different — it's about a capability the desktop version *can't have*: the user's phone camera + their physical presence at a worksite. For a Swedish compliance SaaS, that's not polish, that's a category change. Workers in warehouses, on construction sites, in production facilities, in laboratories can document compliance evidence in seconds: PPE present, fire extinguishers in place, signage visible, machine guards installed, chemical storage compliant, evacuation routes clear.

The user's example: "for AFS that might have an obligation for protective equipment in a warehouse, we could photograph all that with our phone and attach it to the kravpunkter/law list item." Multiply that by Sweden's full AFS catalog (Arbetsmiljöverkets föreskriftssamling — protective equipment, ergonomics, machine safety, chemical handling, fire safety, ventilation, lighting, noise, vibration, etc.) and you have hundreds of compliance situations where a 30-second site walk with a phone produces all the evidence needed.

### Where this attaches in the existing model

Per Story 17.18 (in MEMORY.md): kravpunkter already support `RequirementEvidenceLink (kravpunkt bevis — file or document XOR)` — direct evidence association on a per-kravpunkt basis. The LinkedArtifactsPanel surface (visible in the user's screenshot) shows three current trigger buttons: **Ladda upp fil · Länka fil · Länka styrdokument**. None of those open the camera.

**Two attachment scopes already exist:**
1. **Kravpunkt-level (`RequirementEvidenceLink`)** — bevis for a specific kravpunkt within a law list item
2. **List-item-level (`FileListItemLink` / `WorkspaceDocumentListItemLink`)** — general attachment to the law list item

The mobile flow should **default to kravpunkt-level when entered from a kravpunkt context**, and list-item-level when entered from the LinkedArtifactsPanel directly. Same camera flow either way — only the metadata changes.

### Recommended mobile UX

**Primary trigger** (mobile-only, replaces or augments "Ladda upp fil"):

```
[ + Lägg till bevis ]    ← single button, prominent, full-width on mobile
```

Tap → bottom Sheet with 4 options (icons + label):

```
┌─────────────────────────────────────┐
│  ─                                  │  Sheet handle
├─────────────────────────────────────┤
│  Lägg till bevis                    │
├─────────────────────────────────────┤
│  📷  Ta foto                        │  → native camera (capture=environment)
│  🖼  Välj från bibliotek            │  → photo library (capture=user|environment)
│  📁  Välj fil                       │  → file picker (PDF, DOCX, etc.)
│  🔗  Länka befintlig                │  → existing fil/styrdokument modal
└─────────────────────────────────────┘
```

**"Ta foto" path — multi-shot capture:**

1. Tap → native camera opens via `<input type="file" accept="image/*" capture="environment">`
2. After capture: review screen with thumbnail + caption field + Retake / Add another / Done
3. "Add another" → loops back to camera, builds a stack of pending photos
4. "Done" → upload pending stack + dismiss
5. Each photo gets:
   - Auto-thumbnail
   - Caption field (optional but encouraged — auto-suggested from kravpunkt context, e.g. "Bevis för Skyddsutrustning §3")
   - Auto-association with the kravpunkt or list-item being viewed
   - Auto-categorized as "Bevis"

### Technical implementation notes

**Native camera trigger (works in iOS Safari, Android Chrome, Edge mobile):**
```html
<input type="file" accept="image/*" capture="environment" multiple />
```
- `capture="environment"` → back camera (best for documenting things)
- `capture="user"` → front camera (rarely useful for compliance)
- Without `capture` → file picker including library
- `multiple` → allow batch selection

**HEIC handling (iPhone defaults — must handle):**
iPhones save photos as `.heic` (High Efficiency Image Container) by default. iOS Safari hands the raw HEIC blob to the input. Two paths:
- **Browsers that decode HEIC natively** (Safari): `createImageBitmap(file)` works; the canvas re-encodes to JPEG anyway, so compression handles conversion as a side-effect. ✓
- **Browsers without native HEIC** (most desktop, some Android): need a polyfill — `heic2any` (~80 KB gzipped) or `libheif-js`. Detect via `file.type.startsWith('image/heic')` or `.heif`.

**Pragmatic approach:** since the camera-capture flow only fires from mobile (and Android cameras default to JPEG), HEIC only matters on iPhones — where Safari decodes natively. **You can ship without `heic2any`** for v1, but add HEIC detection + fallback toast (`"HEIC stöds inte i denna webbläsare — välj en JPEG-bild"`) so the failure mode is visible. Add the polyfill in v2 if real users hit it.

**Client-side compression (critical for storage costs + upload speed):**
```typescript
async function compressImage(file: File, maxDim = 1920, quality = 0.85): Promise<Blob> {
  const img = await createImageBitmap(file)
  const scale = Math.min(maxDim / img.width, maxDim / img.height, 1)
  const canvas = new OffscreenCanvas(img.width * scale, img.height * scale)
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.convertToBlob({ type: 'image/jpeg', quality })
}
```
A 6 MB iPhone photo → ~400 KB after compression. **15× storage saving** — non-trivial against Story 5.5b storage caps (1 GB Solo, 5 GB Team).

**Storage-quota pre-flight (avoid the failed-upload path entirely):**
Before the camera trigger fires, check workspace usage against the cap:
```typescript
const { usedBytes, capBytes } = await getWorkspaceStorageUsage(workspaceId)
const remainingMb = (capBytes - usedBytes) / 1_048_576
if (remainingMb < 5) {
  // Block + redirect to billing instead of letting upload fail mid-walk
  showQuotaExhaustedSheet({ usedBytes, capBytes })
  return
}
```
A worker on a site walk can't recover from "your storage is full" if they've already taken 8 photos. Pre-flight at the trigger, not at upload time.

**EXIF GPS stripping (privacy + GDPR):**
EXIF data includes precise GPS coordinates of where the photo was taken. For a workplace compliance app, this is potentially sensitive (employee location, facility addresses). Use a library like `piexifjs` or `exifr` to strip GPS-related EXIF tags before upload. Keep capture timestamp + camera model (those are useful for audit trail).

**Storage delta feedback:**
After successful upload, surface "+ 2.4 MB used · 1.2 GB / 5 GB" in a toast. Workers should know they're consuming workspace quota.

**Offline queueing (optional, post-MVP):**
Site walks may be in low-signal areas (basements, remote facilities). Photos should queue in IndexedDB with metadata, retry on reconnect. This crosses into PWA territory which we deferred — mark as a Phase E item, not blocking.

### File-side considerations

**File table (`WorkspaceFile`):**
Need to add (or verify):
- `captured_at` — when the photo was taken (from EXIF, fallback to upload time)
- `source` — enum {`upload`, `camera_capture`, `library`} for analytics
- `category` — already exists; default to `BEVIS` for camera captures

**Storage path convention:**
- Existing: `workspaces/{wsId}/files/{fileId}.{ext}`
- Proposed: same path; extension is always `.jpg` after compression

**Thumbnail generation:**
For the LinkedArtifactsPanel grid, photos should render as thumbnails not generic file icons. Use Supabase Storage's `transform` query param (`?width=200&height=200&resize=cover`) — server-side, on-demand, cached.

### Reasons this beats alternatives

| Alternative | Why mobile-native camera wins |
|---|---|
| Email photos to compliance@laglig.se | 5+ steps, no auto-association, no context |
| Take photo → upload via desktop later | Loses real-time evidence; user defers, never does |
| WhatsApp / Slack the photo to a colleague | Disconnected from compliance system entirely |
| Use a separate compliance-photo app | Yet another tool; data silo |
| Manually type "Skyddsbrillor verifierade" as a comment | Not auditable evidence |

### Estimated effort

- **Camera trigger + multi-shot UX (mobile only):** S — ~80 LOC for the Sheet + capture flow
- **Client-side compression:** XS — 30 LOC utility + integration into upload pipeline
- **EXIF stripping:** XS — install `exifr`, 20 LOC
- **Caption auto-suggestion:** XS — derive from kravpunkt text (cron-fired AI summary later if useful)
- **Thumbnail rendering in LinkedArtifactsPanel:** S — Supabase transform URL + grid layout
- **WorkspaceFile schema additions (`captured_at`, `source`):** XS — migration + type updates
- **Storage delta toast:** XS — already have UsageWidget data sources

**Total:** ~3–4 days of focused work for v1 (no offline queue). High product leverage per LOC.

### Story sketch (for product backlog)

> **Story 17.x: Mobile photo evidence capture**
> As a worksite user, I want to capture and attach photos as evidence directly from my phone, so that I can document compliance during site walks without leaving the building or returning to a desktop.
>
> **AC 1:** "Lägg till bevis" Sheet opens 4 options: Ta foto / Bibliotek / Fil / Länka. Mobile-only; desktop keeps current 3-button trigger.
> **AC 2:** "Ta foto" opens native back camera via `capture="environment"`. Multi-shot supported.
> **AC 3:** Photos compressed client-side (max 1920px, JPEG q=0.85). EXIF GPS stripped before upload.
> **AC 4:** Each photo gets caption field + auto-association with the kravpunkt or list-item context.
> **AC 5:** Photos render as thumbnails (Supabase transform) in LinkedArtifactsPanel.
> **AC 6:** Storage usage delta shown in toast post-upload.
> **AC 7:** Tests for compression utility, EXIF stripping, multi-shot stack management.
> **Out of scope:** offline queue (Phase E).

---

## 7e. Lexa mobile chat — match ChatGPT / Claude polish

The chat surface is the single most-used product page once trial-converted. ChatGPT and Claude have set user expectations for mobile AI chat to a very high bar — anything that feels like a "ported desktop app" reads as a downgrade. This section is about closing that gap explicitly.

**What's already right (verified):**
- `chat-modal.tsx:49` — `h-[100dvh] max-h-[100dvh] w-screen max-w-none rounded-none` → full-screen modal on mobile, no chrome leaking ✓
- `chat-input-modern.tsx` exists with placeholder "Fråga vad som helst..." (matching ChatGPT's "Ask anything") ✓
- Streamdown + `mode="streaming"` for fluid markdown rendering during streaming ✓
- Citation pills + tool-call rows + agent action cards (Stories 14.x) — rich content already supported ✓
- Server-side `smoothStream({ delayInMs: 8 })` pacing — character-level smooth streaming ✓
- Reasoning blocks via Anthropic extended thinking (Story 14.20) ✓

**What needs polish to reach ChatGPT/Claude feel:**

### C1. Empty state with suggested prompts (high impact, low effort)

When a fresh chat opens with zero messages, ChatGPT and Claude both show 4 example prompt cards arranged in a 2×2 grid (or vertical stack on mobile). Each card is a tappable pre-filled prompt that drops into the input + auto-submits.

For Lexa, the suggestions should be **contextual to the user's workspace state** — e.g.:
- "Vilka lagar har jag missat granska?" (when there's an unacknowledged change)
- "Sammanfatta vår efterlevnadsstatus" (always)
- "Vilka uppgifter förfaller denna vecka?" (when overdue tasks exist)
- "Granska ny lagändring AFS 2026:3" (when there's a recent change-event)

These are workspace-aware suggested prompts — pre-filled context that turns Lexa into a workflow shortcut, not just a Q&A bot. **Big differentiator vs generic ChatGPT.**

**Greeting copy fallback chain:**
- `firstName` available → "Hej {firstName}" ("Hej Alex")
- Only `fullName` → first token before space: "Hej Alexander"
- Neither → "Hej!" (with bang) — never "Hej null" or empty
- Brand-new user (first chat ever) → "Välkommen till Lexa" instead of "Hej" — surfaces the product name on first impression

Render as `<h2 className="font-safiro text-xl font-medium">` — Safiro **must** be paired with `font-medium` (per project memory: weight 500 is the only registered Safiro weight).

**Effort:** S (~60 LOC for the empty-state component + 4 contextual queries to derive suggestions).

### C2. Conversation history as left drawer (CRITICAL)

Currently `workspace-shell.tsx:122-141` mounts `ConversationHistory` as an inline `<aside hidden md:flex>` next to the left nav. On mobile it's not visible at all (`hidden md:flex` hides it below `md:`), so mobile users have **no way to access past conversations** from the ChatModal.

**Fix:** add a hamburger / "history" button in the chat-modal header that opens `ConversationHistory` as a `<Sheet side="left">`. Same component, same data, different chrome.

```tsx
// chat-modal.tsx
<DialogHeader>
  <Button onClick={() => setHistoryOpen(true)} aria-label="Tidigare samtal">
    <History />
  </Button>
  <DialogTitle>Lexa</DialogTitle>
  <Button onClick={() => startNewChat()} aria-label="Nytt samtal">
    <SquarePen />
  </Button>
</DialogHeader>

<Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
  <SheetContent side="left" className="w-[88%] sm:w-[360px] p-0">
    <ConversationHistory onSelect={...} />
  </SheetContent>
</Sheet>
```

**Effort:** S (~40 LOC delta in chat-modal.tsx)

### C3. Compact header — model/mode pill + new chat (top-right)

ChatGPT and Claude both have a tiny header: app name (centered or left), model selector pill (centered or right), new-chat button (right). Lexa already has the title + close button. Add:
- Top-left: hamburger → conversation history Sheet (per C2)
- Center: "Lexa" (title)
- Top-right: square-pen icon → new chat
- Far right: close (X)

If we have multiple AI modes / contexts (e.g., "Generell", "Granska ändring", "Skapa uppgift"), surface as a compact pill below the title bar.

**Effort:** XS (~20 LOC)

### C4. Auto-growing input with attach + voice + send (matches ChatGPT exactly)

Current `chat-input-modern.tsx` likely already auto-grows (per its name). Verify it:
- Starts at 1 line (no scrollbar)
- Grows with content up to ~5 lines
- After max, becomes scrollable inside the input (no overflow into the chat)
- Send button on the right, disabled when empty

Add to match ChatGPT/Claude:
- **`+` button on the LEFT of input** → opens attachment Sheet (Camera / Photo library / File / Lagar i din laglista). Reuses the photo-evidence Sheet from section 7d but with chat-context destinations
- **Mic button** between attach and send (or replacing send when input is empty) — kicks off iOS native dictation via the keyboard's mic, no custom voice infra needed for v1
- **Send button** → square-with-arrow icon (44×44 minimum tap target). When user is mid-message: shows arrow (send). When AI is streaming: shows stop icon (cancel)

Layout (sticky bottom, above iOS keyboard via `100dvh` + `interactive-widget=resizes-content` from section A4):

```
[+]  Fråga vad som helst...  [🎤] [⏎/⏹]
```

**Effort:** M (~120 LOC across attach Sheet wiring + stop button + mic button)

### C5. Message bubbles — tonal differentiation, not heavy

ChatGPT and Claude both use **subtle** bubble styling:
- **User messages:** right-aligned, soft background tint (e.g. `bg-secondary/50`), max-width ~85% of viewport, rounded-2xl
- **AI (Lexa) messages:** left-aligned, NO bubble (just text on background), full-width minus padding

This avoids the heavy "iMessage with two parties" feel and lets AI responses use the full reading width for code blocks, tables, citation pills.

```
                    ┌─────────────────┐
                    │ Vilka lagar har │  ← user (right-aligned bubble)
                    │ jag missat?    │
                    └─────────────────┘

  Du har 3 olästa lagändringar:                    ← AI (no bubble)

  • AFS 2026:3 — Kemiska arbetsmiljörisker ¹
  • SFS 2026:144 — Skattetillägg ²
  • AFS 2025:8 — Vibrationer ³

  Vill du att jag granskar dem? [Skapa uppgifter]
```

**Effort:** XS (~20 LOC styling delta)

### C6. Streaming UX — stop button + scroll behavior

When AI is streaming:
- The right-side send button morphs into a **stop button** (⏹ filled square). Tapping cancels generation immediately
- Auto-scroll to bottom continues UNTIL the user manually scrolls up. Then scroll-pause activates and a small "↓ Nytt innehåll" pill appears at the bottom; tap to resume auto-scroll
- Streaming indicator: subtle pulsing dot AFTER the last rendered character (not a separate "AI is typing..." blob — that's pre-2024 chat UX)

**Effort:** S (~80 LOC for stop wiring + scroll-pause logic + pulsing indicator)

### C7. Long-press message actions Sheet

ChatGPT and Claude both put message actions behind long-press (or 3-dot menu). Action sheet with:
- **Kopiera** (copy text to clipboard)
- **Dela** (share — iOS share sheet via Web Share API)
- **Regenerera** (only on AI messages — re-stream the response)
- **Redigera** (only on user messages — edit + re-submit, drops everything after)
- **Rapportera** (rare, but standard for AI safety)

Pattern: Radix `<ContextMenu>` wraps the message; on touch it's triggered by long-press. Or wrap in a button with `onLongPress` handler. Either way the action menu is a bottom Sheet (per pattern 2 / pattern 14).

**Effort:** S (~60 LOC for the action Sheet + clipboard/share wiring)

### C8. Citation pills → Sheet detail (already in pattern 13 — restate here)

Citation pills in AI messages are subtle numbered superscripts (¹ ² ³) inline with text. The codebase ships `components/ui/inline-citation.tsx` as the primitive — when refactoring for mobile, **reuse `<InlineCitation>` and swap its trigger target to a Sheet on `<md:`** rather than inventing a new pill style. Tapping opens the **citation detail as a bottom Sheet** (currently might be a Popover or Dialog — verify). The Sheet shows:
- Source citation (paragraph from the law/document)
- Snippet that the AI actually used
- "Öppna full lag" CTA → navigates to the law page (must be a real link, not just text)

This is verified in section 13 mockup. Just calling out it's part of the chat-feel work.

### C9. Tool-call rows — collapsed by default, expandable

When the AI calls a tool (e.g., "Sökte i regelverket", "Läste laglista"), it appears as a compact horizontal row — icon + tool name + status (Pågår / Klar):

```
🔍 Sökte i regelverket · 4 träffar         ↓
```

Tap → expands to show the parameters and result. ChatGPT/Claude do this for every tool call so the user sees the AI's "work". Already exists per `chat-message.tsx` ToolCallRow — verify mobile-friendly tap target (≥44px) and that expanded state doesn't break the chat scroll.

**Effort:** XS (verify only)

### C10. Reasoning blocks (Anthropic extended thinking) — collapsible

Per Story 14.20, reasoning blocks render in a collapsed-by-default state with `defaultOpen={contextType === 'change'}`. On mobile, ensure:
- Reasoning header has a visible toggle chevron with ≥44px tap target
- Long reasoning text uses `break-words`, not `truncate`
- Reasoning bubble is visually distinct from regular AI text (subtle bg, italic, or bordered)

**Effort:** XS (mostly verify)

### C11. Keyboard-aware input bar (cross-references A4)

Sticky bottom input must stay above the iOS keyboard. Per section A4: `100dvh` + viewport `interactive-widget=resizes-content` is the fix. Verify after applying.

### C12. New-chat button + state persistence

When user taps "new chat" from the header, the current chat is saved (already happens) and the empty state appears. New chats should persist immediately — don't wait for first message. Otherwise the user can lose context if the app backgrounds.

**Effort:** XS (verify SWR cache / server-action behavior)

### Non-goals for v1 (defer)

- **Custom voice input** (waveform recording + Whisper transcription) — iOS native dictation via keyboard mic is good enough for v1; build custom only if voice usage data shows traction
- **Image input from chat** (multimodal) — depends on model + cost; defer to a separate AI capability story
- **Inline editing of AI responses** — desktop polish, low mobile value
- **Conversation forking / branching** — UX complexity not justified for v1
- **Custom keyboard accessory bar** (iOS) — needs a native bridge; web app can't easily do this

### Effort summary for chat-feel sprint

| Item | Effort | Impact |
|---|---|---|
| C1 Empty state + suggested prompts | S | High |
| C2 Conversation history Sheet | S | **Critical** |
| C3 Compact header | XS | Medium |
| C4 Attach + voice + send input | M | High |
| C5 Message bubble tonal styling | XS | Medium |
| C6 Streaming + stop button | S | High |
| C7 Long-press action Sheet | S | Medium |
| C8 Citation Sheet | (already in pattern 13) | High |
| C9 Tool-call rows verify | XS | Low |
| C10 Reasoning blocks verify | XS | Low |
| C11 Keyboard input bar | (already in A4) | High |
| C12 New-chat verify | XS | Low |

**Total:** ~3–4 days for the full ChatGPT/Claude polish pass. The single most-used surface in the app deserves this investment.

### Test plan

Walk through these 8 scenarios on a real iPhone after implementation:
1. Open Lexa fresh — see empty state with 4 contextual prompts
2. Tap a prompt → submitted, streaming starts, can't scroll past streaming
3. Mid-stream, tap stop → generation halts cleanly
4. Long-press an AI message → action Sheet (Copy / Share / Regenerate)
5. Tap a citation pill → bottom Sheet with source + open-law CTA
6. Tap hamburger → conversation history left drawer with search
7. Tap a past conversation → loads, scrolls to bottom
8. Type a long message — input grows, then scrolls internally; send button stays visible

If all 8 feel native (vs "this is ChatGPT but in a different app"), Lexa mobile chat is shipped.

---

## 8. References

- Audit data: 3 parallel agent reports + manual code reads of `workspace-shell.tsx`, `left-sidebar.tsx`, `header.tsx`, `dialog.tsx`, `mobile-sidebar.tsx`
- Design system source of truth: `_prototypes/design-language.html`
- Existing prototype convention: `_prototypes/onboarding-tutorial-modal.html`, `_prototypes/marketing-site/`, etc.
- Companion prototype: `_prototypes/mobile-optimization.html` (interactive demo of all proposed patterns)
