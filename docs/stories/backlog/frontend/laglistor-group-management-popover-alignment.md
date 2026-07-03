# Backlog: Align Laglistor group management with the Personalregister popover pattern

## Status

Backlog (user-requested 2026-07-03, during Epic 7 Story 7.4 checkpoint)

## Problem

The law list's group management opens a **large modal** listing every group (edit/delete rows) that is oversized and does not resize to the viewport (user screenshot 2026-07-03 — modal overflows on a laptop screen). Meanwhile Story 7.2 shipped a compact, anchored **`ManageGroupsPopover`** (`components/features/personalregister/manage-groups-popover.tsx`) for the employee register: create / rename / reorder / delete in a small popover beside the toolbar. The two surfaces now solve the identical job with divergent UX — and the newer pattern is better (fits any screen, no context loss, no scroll-trap).

## Story

**As a** laglista user, **I want** group management on the law list to use the same compact popover pattern as the Personalregister, **so that** the two tables feel like one product and the oversized modal stops fighting my screen.

## Scope sketch (draft — SM refines when picked up)

1. Locate the current law-list group-management modal (in/near `components/features/document-list/` — the affordance the Laglistor toolbar opens; find by rendering path from `document-list-page-content.tsx`).
2. Replace its trigger with a popover mirroring `ManageGroupsPopover`'s layout/affordances, adapted to law-list group semantics (`LawListGroup`: **`position` is `Float`** with fractional ranking — unlike `EmployeeGroup`'s `Int`; keep the law list's existing reorder mechanics/actions, only the SHELL changes).
3. Keep all existing law-list group server actions/store wiring — this is a presentation-layer swap, not a data-layer change.
4. Consider extracting a shared generic `GroupManagerPopover` primitive if the two diverge only in labels/handlers — judgment call at implementation.
5. Delete the old modal component once unreferenced.

## Constraints / cautions

- `DocumentListTable` itself remains untouched (canonical-table rule — this story touches only the group-management affordance around it).
- Laglistor is the app's most-used surface: verify group create/rename/reorder/delete + drag-to-group still work end-to-end after the swap; the reorder semantics (Float fractional) must not regress.
- Do NOT schedule concurrently with any story editing `components/features/document-list/**`.

## Origin

User sidenote during Epic 7 (HR module) work: "the group-handling on law list currently is a huge modal instead of the group handling now on HR page … too large and doesn't resize to screen. Perhaps we should migrate that old solution into the new UI from HR page so they are aligned?"
