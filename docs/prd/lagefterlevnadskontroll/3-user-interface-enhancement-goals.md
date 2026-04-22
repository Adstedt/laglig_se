# 3. User Interface Enhancement Goals

## 3.1 Integration with Existing UI

The module lives under a new route `/laglistor/kontroller` (sibling to the existing `/laglistor` main compliance dashboard) with a list view + detail view pattern. The cycle creation flow reuses the existing **grouped `compliance-detail-table`** for scope selection with tri-state checkboxes at list / group / item level — no new table component needed. Cycle detail pages reuse **`StatusBadge`**, **`ComplianceStatusEditor`**, **`LinkedArtifactsPanel`** (read-mostly in cycle context), and the existing **activity feed** widget. All new UI uses existing shadcn/ui primitives (Card, Button, Dialog, Tabs, Dropdown, Badge, Switch) and Laglig typography tokens.

## 3.2 Modified/New Screens and Views

**New screens:**

- `/laglistor/kontroller` — Cycle list view. Columns: Namn, Laglista, Status (badge), Period (start–end), Lead auditor, Framsteg (progress ring or %), Sealed (badge if sealed). Filter bar: status, lead auditor, date range. "Skapa kontroll" CTA top-right.
- `/laglistor/kontroller/skapa` — Cycle creation wizard. Step 1: metadata (name, laglista select, audit_type, period, cutoff date, lead auditor). Step 2: scope selection using tri-state grouped-table. Step 3: confirm + create (materialises items).
- `/laglistor/kontroller/[cycleId]` — Cycle detail page. Header: cycle metadata + status + action buttons ("Sign off all", "Complete", "Seal", "Export PDF"). Tab 1 (default): Items — virtualised list of `ComplianceAuditItem` rows with inline bedömning + motivering + per-item sign-off. Tab 2: Findings — list of `ComplianceFinding` with filter by type/severity. Tab 3: Rapport — HTML preview of the revisionsrapport + download PDF button. Tab 4: Aktivitet — filtered activity feed for this cycle.
- `/laglistor/kontroller/[cycleId]/items/[itemId]` — Item detail drawer (slide-in, not full page). Shows source `LawListItem` summary, kravpunkter snapshot, linked artifacts, findings tied to this item, bedömning editor, motivering, per-kravpunkt verify toggle.

**Modified screens:**

- `/laglistor` (existing main page): add a small "Öppna kontroller (N)" link in the page header if any active cycle exists. No other layout change.
- `/workspace/activity` (existing): automatically picks up cycle entity types via existing format; add Swedish labels for new entity types in the label map.

## 3.3 UI Consistency Requirements

- Use existing colour tokens; status badges follow the existing `StatusBadge` variant map (green for UPPFYLLD, yellow for DELVIS, red for EJ_UPPFYLLD, grey for EJ_TILLAMPLIG).
- Sign-off buttons use existing primary CTA style; seal action uses destructive-style button (red) with confirm modal explicitly warning "denna åtgärd kan inte ångras".
- Copy is Swedish-first, matching existing /laglistor tone; finding types display with Swedish-native icons (avvikelse = alert, observation = eye, förbättring = sparkle).
- Empty states follow existing patterns ("Inga kontroller skapade ännu — Skapa din första kontroll" with CTA).
- Mobile breakpoint: acceptable-but-not-optimised for MVP; responsive layout degrades gracefully. Full phone-first UX is Phase 6.

---
