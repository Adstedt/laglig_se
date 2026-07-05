# Story: Laglistor group management → Personalregister popover pattern

## Status

Done

## Story

**As a** laglista user,
**I want** group management on the law list in the same compact popover as the Personalregister,
**so that** the two tables feel like one product and the oversized modal stops fighting my screen.

## Acceptance Criteria

1. The law list's group-management affordance opens a **popover anchored to its trigger** (mirroring `components/features/personalregister/manage-groups-popover.tsx`: header "Grupper", per-group row with count + reorder arrows + rename + delete, inline "Ny grupp…" + Skapa at the bottom), replacing the current full-screen modal (user screenshots 2026-07-03: modal lists every group as edit/delete rows, oversized, doesn't resize to the viewport).
2. **Presentation-layer swap ONLY**: all existing law-list group server actions, store wiring, and semantics unchanged — create, rename, delete (with its existing confirmation/behavior), and reorder keep their exact current mechanics. `LawListGroup.position` is a **Float with fractional ranking** — the reorder implementation is NOT rewritten; the popover's up/down arrows call whatever the modal called.
3. The old modal component is removed once unreferenced (delete the file, not just the trigger).
4. Functional parity checklist (all must still work end-to-end): create group → appears in table; rename → header updates; delete → documents land in "Övrigt"/ungrouped per current behavior; reorder → section order changes; drag-document-to-group unaffected.
5. `DocumentListTable` itself untouched (canonical-table rule); the popover fits the existing toolbar without layout shifts.

## Tasks / Subtasks

- [x] **Task 0 — Locate + bind:** find the current group-management modal component and its trigger (rendering path from `document-list-page-content.tsx` / the law-list toolbar). Read `manage-groups-popover.tsx` (READ ONLY — Story 7.6 is running in the personalregister zone; do not modify anything there) as the pattern source. Map every action/handler the modal calls — the popover must call the identical set.
- [x] **Task 1 — Popover component:** new `components/features/document-list/manage-law-groups-popover.tsx` mirroring the HR popover's layout/affordances but typed over the law-list group shape (`ListGroupSummary`) and wired to the law-list handlers. Swedish copy matches the HR popover's conventions; Safiro `font-medium` header; per-group counts.
- [x] **Task 2 — Trigger swap:** replace the modal trigger with the popover; remove the modal mount; delete the old modal component file once `grep` shows zero references.
- [x] **Task 3 — Tests:** RTL for the popover (create/rename/delete/reorder invoke the bound handlers; counts render); update/retarget any tests that referenced the modal; the law-list group action/store tests must pass UNCHANGED (proof the data layer wasn't touched).
- [x] **Task 4 — Validation:** targeted + `pnpm typecheck` + eslint during; **full `pnpm vitest run tests/unit` once** (known assessment-detail calendar failure excluded). No schema/migration/DB/git/dev-server.

## Dev Notes

- **This is the app's most-used surface. Maximum conservatism.** Zone: `components/features/document-list/` — but ONLY the group-management modal file, its trigger site (likely `document-list-page-content.tsx` — minimal diff there), the new popover file, and tests. **`document-list-table.tsx` and `grouped-document-list-table.tsx` are UNTOUCHABLE.** Everything outside document-list is forbidden — especially `components/features/personalregister/**` (a parallel story owns adjacent files; the HR popover is read-only reference), `app/actions/**`, `lib/**`.
- The HR popover reference implements: anchored `Popover`, group rows `[folder icon] name [count] [↑] [↓] [rename] [delete]`, inline create input + Skapa button. Match this structure; adapt handlers/types only.
- `LawListGroup.position` Float fractional ranking (vs `EmployeeGroup`'s Int) — reuse the modal's existing reorder calls verbatim; if the modal computed fractional positions client-side, lift that logic as-is into the popover.
- If the existing delete flow has a confirmation step, keep it (law-list groups hold many documents); do not weaken any guard the modal had.
- Optional (note if done): extract a shared generic `GroupManagerPopover` primitive ONLY if it falls out naturally without touching the HR side (parallel story running there).

## Change Log

| Date       | Version | Description | Author |
| ---------- | ------- | ----------- | ------ |
| 2026-07-03 | 0.1     | Backlogged at the 7.4 checkpoint (user sidenote). | Bob (SM) |
| 2026-07-03 | 0.2     | Promoted to active at user request ("should be fixed"); PO pass: presentation-swap-only contract, Float-ranking preservation, untouchable-table rule, zone fencing vs the running Story 7.6, functional-parity checklist. GO. | Sarah (PO) |
| 2026-07-03 | 1.0     | Implemented: `GroupManager` dialog replaced by `ManageLawGroupsPopover` anchored around the ViewMenu slot; modal file deleted; RTL suite added; full unit suite green (known pre-existing assessment-detail calendar failure excluded). | James (Dev) |

| 2026-07-03 | 1.1     | QA GATE-001 closed inline: `groupToDelete` cleared in the popover's `!open` reset effect — the delete confirmation can no longer outlive the popover. Popover suite green, typecheck + eslint clean. A11Y-001/LAYOUT-001 remain browser-pass items. | Checkpoint fix |
| 2026-07-03 | 1.2     | Checkpoint round 2 (user feedback): trigger lifted out of the ViewMenu dropdown into a standalone "Hantera grupper" toolbar button (outline, FolderCog icon — mirrors the Personalregister affordance). Simplification: standard `Popover`+`PopoverTrigger` composition; raw `@radix-ui/react-popover` `Anchor` import DELETED; always-on `onFocusOutside` prevention DELETED (tab-out dismiss is normal again). Kept: `onInteractOutside` guard while the delete dialog is open + GATE-001 `groupToDelete` reset. "Grupper" item removed from ViewMenu (`onOpenGroupManager` prop + `FolderPlus` import dropped). Open gating unchanged (`Boolean(isGroupManagerOpen && activeListId)`). RTL suite updated: new trigger-opens test; 10/10 green; unchanged group suites 156/156; typecheck + eslint clean. | James (Dev) |
## Dev Agent Record

### Agent Model Used

Claude Fable 5 (claude-fable-5)

### Debug Log References

- Targeted: `pnpm vitest run tests/unit/components/features/document-list/manage-law-groups-popover.test.tsx` — 9/9 pass.
- Unchanged group tests: `pnpm vitest run tests/unit/lib/stores/document-list-store.test.ts tests/unit/app/actions/document-list-sort.test.ts tests/unit/lib/validation/document-list.test.ts tests/unit/components/features/compliance-audit/scope-selector/scope-selector.test.tsx` — 156/156 pass, zero edits to those files.
- `pnpm typecheck` clean; `pnpm eslint` on changed files clean; prettier applied.
- Full suite once: `pnpm vitest run tests/unit` — 480/481 files pass, 6189 passed / 1 failed; the single failure is the known pre-existing `tests/unit/components/features/ai-chat/details/assessment-detail.test.tsx` calendar ("Träder i kraft") failure explicitly excluded by this story.

### Completion Notes List

- **Modal located:** `components/features/document-list/group-manager.tsx` (`GroupManager`, Story 4.13 Dialog + AlertDialog). Rendering path: ViewMenu dropdown item "Grupper" → `onOpenGroupManager` → `isGroupManagerOpen` state in `document-list-page-content.tsx` → `<GroupManager>` mount at the bottom of the page content. File deleted after grep showed zero remaining references.
- **Handler map (modal → popover), all identical calls/payloads:** open-fetch `getListGroups(listId)` → same; create `createListGroup({ listId, name: trimmed })` → same (inline "Ny grupp…" input replaces the modal's two-step "Skapa ny grupp" toggle — presentation only); rename `updateListGroup({ groupId, name: trimmed })` → same (inline pencil edit, Enter/Escape preserved); delete `deleteListGroup(groupId)` behind the **same AlertDialog confirmation with the same copy** ("Ta bort gruppen?", documents move to "Ogrupperade") → same; reorder `reorderGroups({ listId, groups: [{ id, position: index }] })` with optimistic reorder + revert-on-error → copied verbatim (integer indexes; the server owns the Float fractional ranking). `onGroupsUpdated` fires at the same points.
- **Judgment call — anchoring:** the trigger is a DropdownMenuItem inside ViewMenu (a menu item can't be a `PopoverTrigger`), so the popover is a controlled `Popover` with a Radix `PopoverPrimitive.Anchor` (imported directly from `@radix-ui/react-popover`; the shadcn wrapper doesn't export it — left `components/ui/popover.tsx` untouched to stay in zone) wrapped around the ViewMenu slot in `document-list-page-content.tsx`. The popover therefore opens anchored to the ViewMenu button, `align="end"`, no toolbar layout change (anchor div sits inside the toolbar's existing `shrink-0` slot wrapper).
- **Judgment call — focus guards:** `onFocusOutside` prevented on the PopoverContent (the closing dropdown restores focus to its trigger, which would otherwise instantly dismiss the popover); `onInteractOutside` prevented only while the delete confirmation is open (so the popover stays open behind the AlertDialog, matching the modal's behavior where the dialog stayed mounted behind the confirmation). Pointer-down outside and Escape still dismiss normally.
- **Judgment call — open gating:** old mount was `{activeListId && <GroupManager …>}`; equivalent preserved via `open={Boolean(isGroupManagerOpen && activeListId)}` plus `if (!listId) return` guards in fetch/create/reorder.
- Kept from the modal (not in the HR popover): error banner with "Stäng", loading spinner, `maxLength={50}` on both inputs, granular busy states (`isSubmittingNew/Edit`, `isDeleting`, `isReordering`), per-row arrow disabling. Copy adapted to laws ("Inga grupper ännu. Skapa en för att organisera dokumenten i listan."); header "Grupper" `text-sm font-medium` per HR convention.
- Did NOT extract a shared `GroupManagerPopover` primitive — it would have required touching the personalregister side (parallel Story 7.6 owns it).
- **QA scrutiny list:** (1) dropdown-closes-then-popover-opens focus dance in a real browser (happy-dom can't prove Radix focus timing — verify the popover doesn't flash-close after picking "Grupper", incl. keyboard-only); (2) popover staying open behind/after the delete confirmation, and Escape layering (Escape should close the AlertDialog first, not both); (3) tab-out no longer dismisses the popover (side effect of the `onFocusOutside` guard) — acceptable?; (4) anchor `<div>` around ViewMenu at narrow widths where the toolbar wraps (`flex-wrap`); (5) reorder under rapid clicking (optimistic revert path); (6) drag-document-to-group and expand/collapse-all untouched by inspection — confirm end-to-end (AC4).

### File List

- `components/features/document-list/manage-law-groups-popover.tsx` — NEW, then round 2: standalone `PopoverTrigger` button ("Hantera grupper", outline + FolderCog); `PopoverPrimitive.Anchor` import and `onFocusOutside` guard removed; `children` prop dropped; delete confirmation + GATE-001 reset preserved.
- `components/features/document-list/document-list-page-content.tsx` — MODIFIED (round 2: popover no longer wraps ViewMenu — rendered as a sibling button in the toolbar's right-side slot, `flex gap-2` wrapper; `onOpenGroupManager` wiring removed).
- `components/features/document-list/view-menu.tsx` — MODIFIED (round 2: "Grupper" DropdownMenuItem removed; `onOpenGroupManager` prop and `FolderPlus` import dropped; all other items kept).
- `components/features/document-list/group-manager.tsx` — DELETED (old modal, unreferenced).
- `tests/unit/components/features/document-list/manage-law-groups-popover.test.tsx` — NEW, then round 2: `children` render removed; added trigger-button open test (10 RTL tests: trigger open, fetch/render+counts, closed no-fetch, create, rename, delete-with-confirmation, delete-cancel, reorder payload, arrow disabling, fetch error).
- `docs/stories/laglistor-group-popover-alignment.md` — story bookkeeping.

## QA Results

### Review Date: 2026-07-03

### Reviewed By: Quinn (Test Architect)

### Code Quality Assessment

High-quality, disciplined presentation swap. I diffed the new popover line-by-line against the deleted modal (`git show HEAD:components/features/document-list/group-manager.tsx`) and the handler layer is a verbatim copy in every semantic respect:

- **Fetch**: `getListGroups(listId)` on open, identical result/error handling, identical `!open` state reset (minus the dropped `isCreating` flag, which no longer exists — presentation only).
- **Create**: `createListGroup({ listId, name: newGroupName.trim() })` — identical payload. The modal's two-step "Skapa ny grupp" toggle became an always-visible inline input; the only handler delta is an added `!listId` guard, necessitated by `listId: string | null` (was `string` behind the mount gate). Semantically safe.
- **Rename**: `updateListGroup({ groupId, name: editingName.trim() })` — identical, Enter/Escape keymap preserved.
- **Delete**: `deleteListGroup(groupToDelete.id)` behind the AlertDialog with **byte-identical copy** ("Ta bort gruppen?", the "Ogrupperade" move text, the empty-group branch, destructive styling, spinner). All three error paths (`!success`, catch, finally) identical.
- **Reorder**: `reorderGroups({ listId, groups: newGroups.map((g, i) => ({ id: g.id, position: i })) })` — optimistic splice + revert-to-captured-`groups` + `if (!moved) return` safety check copied verbatim. Integer indexes preserved; the Float fractional ranking stays server-owned (AC2 satisfied).
- `onGroupsUpdated()` fires at exactly the same four points.

Zone discipline confirmed via git: `document-list-table.tsx`, `grouped-document-list-table.tsx`, `legal-document-modal/**`, `components/ui/popover.tsx`, `app/actions/document-list.ts`, and `lib/**` all show an empty diff against HEAD. The other working-tree changes (kollektivavtal, personalregister, settings, collective-agreements/files actions) are by content the parallel 7.5b/7.6/7.7 workstreams — attributed, not findings of this review. `group-manager.tsx` is deleted and grep finds zero remaining code references (comments/doc mentions only).

**Focus-guard analysis (the riskiest code):** `onFocusOutside={(e) => e.preventDefault()}` on the PopoverContent is unconditionally prevented; `onInteractOutside` prevented only while `groupToDelete` is set. Reading Radix DismissableLayer semantics: pointer-down outside still dismisses (the pointer path goes through `onPointerDownOutside`/`onInteractOutside`, both untouched when no delete dialog), and Escape still dismisses (`onEscapeKeyDown` untouched; Radix's escape listener is document-level and only the topmost layer handles it, so with the AlertDialog open Escape should close the dialog first). I could not construct an undismissable state from the code: every reachable state retains at least Escape + outside-click. Focus is NOT trapped (non-modal popover, no FocusScope), so screen-reader escape routes survive. The two residual risks are (a) tab-out no longer dismissing — a deliberate, dev-flagged UX trade-off that needs a product nod, and (b) where keyboard focus actually lands after the ViewMenu dropdown's close-restore fires against the popover's open-autofocus — a timing race that happy-dom genuinely cannot prove. That is a browser-pass item, not a code defect I can confirm.

**Mount-gate parity:** old `{activeListId && <GroupManager/>}` vs new `open={Boolean(isGroupManagerOpen && activeListId)}`. Reachable states match for the popover itself (list-switch while open behaved identically before — the modal also stayed mounted across A→B switches). One genuine drift: the delete AlertDialog is gated solely on `groupToDelete`, not on `open`. If `activeListId` goes null (list deleted) while the delete confirmation is showing, the old code unmounted everything; the new code closes the popover but leaves the AlertDialog up, and confirming would still call `deleteListGroup` on the stale group. Practically hard to reach (requires the list to vanish mid-confirmation), so LOW — a `useEffect` clearing `groupToDelete` when `open` goes false would close it.

### Refactoring Performed

None. On the app's most-used surface with a parallel story in flight, zero-touch was the correct review posture; nothing found warranted risking a change.

### Compliance Check

- Coding Standards: ✓ shadcn/ui composition throughout; the direct `@radix-ui/react-popover` import for `Anchor` is a justified, documented exception (wrapper doesn't export it; wrapper left untouched). Strict types, no `any`, discriminated-union action results consumed correctly.
- Project Structure: ✓ Zone contract honored exactly (verified via git, not just the File List).
- Testing Strategy: ✓ 9 RTL tests assert exact action payloads (the story's core contract); the four unchanged suites (156 tests) prove the data layer untouched.
- All ACs Met: ✓ in code; AC1 anchoring visuals, AC4 end-to-end parity, and AC5 no-layout-shift retain a browser-verification residue (see below).

### Improvements Checklist

- [ ] Clear `groupToDelete` when the popover closes (e.g. in the existing `!open` reset effect) so the AlertDialog cannot outlive its context if `activeListId` nulls mid-confirmation (`manage-law-groups-popover.tsx`).
- [ ] Browser pass on the dev's six-item QA scrutiny list — items 1 (focus dance incl. keyboard-only), 2 (Escape layering with the AlertDialog), 3 (tab-out acceptability — product call), 4 (anchor `<div>` at wrapped-toolbar widths; `PopoverPrimitive.Anchor` renders a real div around the ViewMenu slot), 5 (rapid reorder), 6 (drag-to-group / expand-collapse E2E). Items 2, 5, 6 are near-certain from code inspection; 1, 3, 4 genuinely need the browser.
- [ ] (Future, pre-existing) `handleMoveGroup`'s `if (!moved) return` sits after `setIsReordering(true)` outside the try/finally — unreachable in practice but would leak a stuck busy state; inherited verbatim from the modal, fix only in a story that owns this file.

### Security Review

No new surface. Same five Story 4.13 server actions, same payloads, no client-side authz decisions, no new data exposure. PASS.

### Performance Considerations

Strictly lighter than the modal (no overlay, smaller tree). Fetch-on-open and optimistic reorder patterns unchanged. One cosmetic note: because the component now stays mounted across opens, a stale `groups` frame can flash on reopen before the loading effect fires — the old modal had the same behavior across list switches; not a regression.

### Files Modified During Review

None.

### Gate Status

Gate: CONCERNS → docs/qa/gates/laglistor-group-popover-alignment.yml

### Recommended Status

✗ Changes Required — nothing blocking in code; the gate is CONCERNS solely because the focus/keyboard behavior on the app's most-used surface is browser-only-verifiable and the tab-out trade-off needs an explicit product nod. After the user's browser walkthrough (and optionally the `groupToDelete` reset), this is Ready for Done.
(Story owner decides final status)
