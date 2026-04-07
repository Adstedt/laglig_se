# UAT Findings — Site-wide E2E Testing (2026-04-07)

> Comprehensive user acceptance testing across all pages of Laglig.se.
> Findings documented for review and prioritization.

## Test Coverage

All 20 routes tested and confirmed loading/functional:
Dashboard, Mina listor, Ändringar, Mallar, Lagar (browse + detail + search),
EU-rätt, Uppgifter (summary/kanban/lista), Styrdokument (aktiva/arkiverade/editor),
Filer, Aktivitetslogg, Inställningar (allmänt/företagsprofil), URL redirects.

---

## Bugs

### B1. Breadcrumb: "activity" raw slug
- **Page:** Aktivitetslogg (`/workspace/activity`)
- **Issue:** Breadcrumb shows raw slug "activity" instead of "Aktivitetslogg"
- **Root cause:** Missing entry in `routeLabels` in `components/layout/breadcrumbs.tsx`
- **Fix:** Add `activity: 'Aktivitetslogg'` to routeLabels map
- **Effort:** Trivial (1 line)

### B2. Activity log: English enum values in status transitions
- **Page:** Aktivitetslogg
- **Issue:** Ändring column shows `DRAFT → ARCHIVED`, `IN_REVIEW → APPROVED`, etc.
- **Expected:** Swedish labels — `Utkast → Arkiverad`, `Under granskning → Godkänd`
- **Effort:** Small — add a status label mapper in the activity log renderer

### B3. Activity log: Raw action name displayed
- **Page:** Aktivitetslogg
- **Issue:** Action "document_linked_to_list_item" shown as raw snake_case string
- **Expected:** Swedish label like "länkade dokument till lagpost"
- **Effort:** Small — add to action label map

### B4. Activity log: Raw UUID in Ändring column
- **Page:** Aktivitetslogg
- **Issue:** One entry shows UUID `2d732f10-92bb-401e-b4e2-6ced72b71f55` instead of document/entity name
- **Root cause:** Entity name not resolved for linked entity
- **Effort:** Medium — need to resolve entity names in activity log query

### B5. Law detail: Double title suffix
- **Page:** Lagar detail (`/browse/lagar/[slug]`)
- **Issue:** Browser tab title shows "... | Laglig.se | Laglig.se" (double suffix)
- **Fix:** Remove duplicate suffix in metadata generation
- **Effort:** Trivial

### B6. Ändringar badge count mismatch
- **Page:** Mina listor → Ändringar tab
- **Issue:** Tab badge shows "10" but content shows "8 av 8 ändringar"
- **Root cause:** Badge count likely includes dismissed/acknowledged items or uses a different query
- **Effort:** Small — align badge count query with tab content query

### B7. Editor settings button: No aria-label
- **Page:** Styrdokument editor
- **Issue:** Settings gear icon button has no aria-label — inaccessible to screen readers, found as "(unlabeled)" by accessibility tools
- **Fix:** Add `aria-label="Dokumentinställningar"` to the button
- **Effort:** Trivial

### B8. Notification bell: No response on click
- **Page:** Global header (all pages)
- **Issue:** Notification bell button doesn't open a dropdown or popover when clicked
- **Root cause:** May be a placeholder not yet connected, or popover not rendering
- **Effort:** Needs investigation

---

## UX Issues

### U1. Dashboard stats cards not clickable
- **Page:** Dashboard
- **Issue:** Cards ("0 av 68 lagar uppfyllda", "10 nya lagändringar", etc.) look interactive with card styling but don't navigate anywhere on click
- **Expected:** Click should navigate to the relevant page (compliance overview, changes tab, tasks, calendar)
- **Impact:** High — this is the primary dashboard and users will instinctively click these
- **Effort:** Small — wrap cards in links to respective routes

### U2. `+ Skapa` button always creates a task
- **Page:** Global header (all pages)
- **Issue:** The button opens "Skapa uppgift" dialog regardless of current page context
- **Expected:** On Styrdokument → "Nytt dokument", on Filer → "Ladda upp", on Tasks → "Ny uppgift", etc.
- **Alternative:** Make it a dropdown with options: Uppgift, Styrdokument, Fil upload
- **Impact:** Medium — confusing for users on non-task pages
- **Effort:** Medium — either contextual or dropdown

### U3. Activity log: US date format in filters
- **Page:** Aktivitetslogg
- **Issue:** Date filter inputs show `mm/dd/yyyy` (US locale) instead of Swedish `yyyy-mm-dd`
- **Root cause:** Browser native date input defaulting to US locale
- **Effort:** Small — may need a custom date picker or locale override

### U4. Styrdokument: Granskningsdatum column mostly empty
- **Page:** Styrdokument listing
- **Issue:** "Granskningsdatum" column shows "—" for all documents, taking significant table width
- **Suggestion:** Hide column by default, show when documents have review dates set. Or use column visibility settings.
- **Effort:** Small

### U5. Editor: "0 ord" on empty document
- **Page:** Styrdokument editor
- **Issue:** Word count shows "0 ord" when document is empty
- **Suggestion:** Hide word count until content exists, or show "Tom" instead
- **Effort:** Trivial

### U6. Editor: No slash command hint
- **Page:** Styrdokument editor
- **Issue:** Placeholder text "Börja skriva..." doesn't hint at slash commands
- **Suggestion:** "Börja skriva eller tryck / för kommandon..."
- **Effort:** Trivial

### U7. Editor: Settings gear has no tooltip
- **Page:** Styrdokument editor
- **Issue:** Gear icon in metadata bar has no tooltip explaining what it does
- **Suggestion:** Add tooltip "Dokumentinställningar"
- **Effort:** Trivial

### U8. Filer: Empty state context mismatch
- **Page:** Filer (`/filer`)
- **Issue:** Root-level empty state says "Tom mapp" — should differentiate between "no files at all" (first-time) vs "empty subfolder"
- **Suggestion:** Root level: "Inga filer ännu — Ladda upp filer eller skapa en ny mapp för att komma igång." Subfolder: "Tom mapp" (current)
- **Effort:** Small

### U9. Create dialog: Dokumenttyp defaults to "Övrigt"
- **Page:** Styrdokument → Nytt dokument dialog
- **Issue:** Blank template defaults Dokumenttyp to "Övrigt" — user might forget to change
- **Suggestion:** Leave unset (placeholder "Välj typ...") or remove default
- **Effort:** Trivial

---

## Visual / Polish

### V1. Dashboard: Compliance progress bar barely visible
- **Page:** Dashboard
- **Issue:** Progress bar under "0 av 68 lagar uppfyllda" is a thin line at 0% — nearly invisible
- **Suggestion:** Make the bar taller or show 0% text more prominently
- **Effort:** Trivial

### V2. Sidebar: Notification dot clipping
- **Page:** Sidebar (collapsed state)
- **Issue:** Efterlevnad red notification dot partially clips the sidebar edge on some icon positions
- **Effort:** Trivial — adjust dot positioning

### V3. Editor: "Under granskning" badge length
- **Page:** Styrdokument editor
- **Issue:** Badge text is long compared to "Utkast", "Godkänd" — can cause crowding in metadata bar
- **Suggestion:** Consider abbreviating to "Granskas" in tight layouts
- **Effort:** Trivial

### V4. Next.js error badges visible
- **Page:** Multiple pages
- **Issue:** "1 Issue" / "2 Issues" red badge in bottom-left corner during dev
- **Note:** Dev-only, won't appear in production. But worth investigating the underlying errors.
- **Effort:** N/A for production, investigate in dev

---

## Priority Recommendation

### Quick wins (trivial effort, immediate impact):
- B1 (breadcrumb — 1 line)
- B5 (double title — 1 line)
- B7 (aria-label — 1 line)
- U5, U6, U7 (editor polish)

### High impact, small effort:
- U1 (clickable dashboard cards)
- B2, B3 (activity log i18n)
- B6 (badge count alignment)

### Medium effort, worth planning:
- U2 (contextual + Skapa button)
- B4 (UUID resolution in activity log)
- B8 (notification bell investigation)
