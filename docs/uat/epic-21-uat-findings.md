# Epic 21 — UAT Findings Log

**UAT start:** 2026-04-27
**Tester:** Alexander Adstedt
**Workspace under test:** Almåsa Havshotell AB (`almasa-havshotell-ab-fvarlj`)
**UAT plan:** `docs/uat/epic-21-uat-plan.md`

This document collects defects, observations, and follow-ups discovered during Epic 21 UAT. Each finding is logged with a severity classification, a reproduction summary, the suspected root cause, and a recommended fix. Fixes are deliberately deferred to a post-UAT batch so the testing pass isn't repeatedly interrupted.

**Severity legend:**

- 🔴 **P1 — blocker** — defect prevents ship; must be fixed before merge to main.
- 🟠 **P2 — high** — defect harms UX or correctness materially; fix before customer rollout.
- 🟡 **P3 — medium** — minor UX polish or hardening; can ship and follow up.
- ⚪ **P4 — note** — observation, no fix needed but worth recording.

---

## Finding #1 — AUDITOR has full edit access to `/laglistor` (server + UI)

**Severity:** 🔴 **P1 — security / data integrity**
**Discovered:** 2026-04-27 during UAT plan §1.9 (AUDITOR role gating sweep).
**Affects:** All workspace members with `AUDITOR` role on the `/laglistor` route.

### Reproduction

1. Sign in as `alexander.adstedt+10@kontorab.se` (AUDITOR role in Almåsa Havshotell).
2. Navigate to `/laglistor`.
3. ✅ "Skapa kontroll" CTA in the header is correctly hidden (page-level gate at `app/(workspace)/laglistor/page.tsx:69-70` works).
4. ❌ All other editable surfaces remain interactive: status / priority / responsible / due-date cell editors, "+ Add document" search, remove buttons, drag-to-reorder, group create/rename/delete, list metadata edit. Server accepts the mutations and persists them.

### Root cause

Story 21.14 introduced the AUDITOR role with permissions `['activity:view', 'ai:chat', 'read']` (no `tasks:edit`). It patched cycle-related READ endpoints to admit AUDITOR via the OR-permission pattern (`activity:view || tasks:edit`), but it did NOT audit existing pre-21.14 endpoints to add the missing `'tasks:edit'` gate where AUDITOR should be rejected.

Server-side, **22 mutation actions** in `app/actions/document-list.ts` and `app/actions/legal-document-modal.ts` call `withWorkspace(async (ctx) => { ... })` without a `requiredPermission` argument. The wrapper's signature accepts an optional second arg; when omitted, no permission check runs. Any authenticated workspace member — including AUDITOR — can execute the mutation.

```ts
// Today — no gate, AUDITOR mutations succeed:
return await withWorkspace(async (ctx) => { ... })

// Should be:
return await withWorkspace(async (ctx) => { ... }, 'tasks:edit')
```

UI-side, `complianceReadOnly = !hasPermission(ctx.role, 'tasks:edit')` is computed at `app/(workspace)/laglistor/page.tsx:65` but only flows into the kravpunkter checklist + compliance-narrative editor. The status / priority / responsible / due-date cell editors, the row-level remove buttons, the reorder drag handles, and the group operations don't accept a `readOnly` flag at all — they assume any user reaching the page has edit access.

### Fix (proposed)

**Server-side (P1 — defence-in-depth):** add `'tasks:edit'` as the second arg to the 22 ungated `withWorkspace` calls. Mutations in scope:

- `app/actions/document-list.ts` lines 166, 209, 255, 317, 561, 664, 703, 783, 830, 1037, 1145, 1215, 1281, 1343, 1383, 1436, 1493, 1569, 1610.
- `app/actions/legal-document-modal.ts` lines 436, 485, 556, 623, 685, 747, 857, 988, 1043.

Read-only actions (`getDocumentLists`, `getDocumentListItems`, `getWorkspaceMembers`, `getExportData`, `getListGroups`, `searchLegalDocuments`) should stay ungated so AUDITOR can still browse. Lines 371, 912, 1102, 1383 (the `getListGroups` one), 1023.

**UI-side (P2 — better UX than mutation toast):** thread the existing `complianceReadOnly` flag (or a renamed `editorReadOnly` variant) into the structural mutation surfaces:
- Cell editors (`StatusEditor`, `PriorityEditor`, `ResponsibleEditor`, `DueDateEditor`) accept `readOnly`.
- Row remove button hidden when readOnly.
- Reorder drag handles disabled when readOnly.
- Group create/rename/delete buttons hidden when readOnly.
- "+ Add document" search hidden when readOnly.

**Estimated effort:** server-side 30 min (mechanical change + tests); UI-side 1-2 hours (multiple components, requires verifying each surface).

### Workaround for continued UAT

For Section 1.9 of the UAT plan, the "AUDITOR redirect away from `/laglistor/kontroller/skapa`" test still passes (the wizard route IS gated correctly). The "Skapa kontroll button hidden" test ALSO passes. Only the "AUDITOR has full edit on the rest of `/laglistor`" check fails.

Continue UAT against the cycle-detail surfaces (sections 2-8 of the UAT plan); those ARE gated correctly per Story 21.14's scope. Document any further AUDITOR leakage as additional findings here.

---

## Finding #2 — AUDITOR users appear in the "Ansvarig revisor" picker (decision required)

**Severity:** ⚪ **P4 — note / decision required, not a defect**
**Discovered:** 2026-04-27 during UAT plan §1 (cycle creation wizard).
**Affects:** Workspaces that have AUDITOR-role members.

### Reproduction

1. As any user with `tasks:edit`, navigate to `/laglistor/kontroller/skapa`.
2. Step 1 of the wizard, click the **Ansvarig revisor** select.
3. The dropdown lists ALL workspace members regardless of role — OWNER, ADMIN, HR_MANAGER, MEMBER, AND **AUDITOR**.

### Root cause

`getWorkspaceMembers()` in `app/actions/document-list.ts` returns every member; the wizard's Step-1 select renders them as-is with no role filter. This is **deliberate** per Story 21.14's design — the `isLeadAuditor` runtime override at `lib/compliance-audit/authorization.ts:28` grants the lead auditor write access (seal, complete, revert, sign-off, edit items) on the ONE cycle they're leading, irrespective of their base role's permissions. Outside that cycle they remain governed by their base role (e.g. AUDITOR stays read-only on other cycles).

The architecture doc explicitly flags this: §"AUDITOR-as-lead-auditor policy" is listed under the story's "Not-in-scope" block — recognised as mechanically allowed and product-policy-fuzzy.

### Why this is intentional, in product terms

External auditors (revisorer) are exactly the user type AUDITOR was created for, and assigning them as lead auditor of an internal-/external-cycle they were hired to run is the canonical use case. Filtering AUDITOR out would force admins to either:
- promote the external auditor temporarily to MEMBER (wider write access than warranted), or
- not assign them as lead at all (loses the audit-trail benefit of a tracked lead-auditor identity).

### Recommendation

**Keep the current behavior. But add UI affordances to make the choice conscious:**

1. **Role chip in the picker** — render a small `Badge` next to each member's name showing their workspace role. Disambiguates AUDITOR-as-lead from MEMBER-as-lead at-a-glance.
2. **Helper text under the field** — when the selected lead is AUDITOR-role, show an info note: *"AUDITOR-users får full skrivåtkomst till denna kontroll under dess livscykel. På andra kontroller behåller de sin läs-läge-behörighet."*
3. **Activity-log enrichment (already done)** — `cycle_created` activity payload already includes `leadAuditorUserId`. Consider adding their `role` at creation time to make audit-trail review easier.

### Fix (proposed)

UI-only — no schema, no permissions change. ~30 min:
- `components/features/compliance-audit/cycle-creation-wizard/CycleMetadataStep.tsx` — extend `WorkspaceMemberOption` to carry `role`, render `<Badge>` in `<SelectItem>`.
- Add the conditional helper text below the field.
- Mirror the role badge into `CycleDetailHeader`'s lead-auditor display so the role context persists post-creation.

### Status

Open — design + product decision implicitly already made (allow), waiting on UI affordance implementation.

---

## Finding #3 — Members with identical names are indistinguishable in pickers

**Severity:** 🟡 **P3 — UX gap, affects pickers project-wide**
**Discovered:** 2026-04-27 during UAT plan §1 (cycle creation wizard, surfaced via Finding #2).
**Affects:** Any workspace where two or more members share a display name (common in small family-run companies; also in test workspaces using `+suffix` aliases of one Gmail account, as Almåsa demonstrates).

### Reproduction

1. In Almåsa Havshotell, two members are both named "Alexander Adstedt" (`+111@kontorab.se` OWNER and `+10@kontorab.se` AUDITOR).
2. Open any member-picker — Ansvarig revisor (Step 1 of cycle creation wizard), responsible-user cell editor on `/laglistor`, task assignee picker, etc.
3. The dropdown shows two "Alexander Adstedt" entries with no way to tell them apart.

### Root cause

The shared `WorkspaceMemberOption` shape (returned by `getWorkspaceMembers()` in `app/actions/document-list.ts`) carries `id`, `name`, `email`, `avatarUrl`. Most pickers render only `name` (or `name ?? email`) in the dropdown, hiding the email except via the `title` attribute on the avatar.

### Recommendation

In every member-picker `<SelectItem>`, render `email` as a muted subtitle below the name when:
- The display value is just `name`, AND
- The same name appears more than once in the option list.

OR unconditionally for all options (simpler — accept the visual noise). The legal-document-modal's responsible-user picker already does this via the `title` tooltip; promote it to inline subtitle.

### Fix (proposed)

Touches multiple files — pickers in: `CycleMetadataStep.tsx`, `responsible-editor.tsx`, `assignee-editor.tsx`, possibly the task assignee picker, the finding assignee. Could be unified by introducing a shared `<MemberOption>` component that renders `name` + `email` consistently. ~1-2 hours.

### Status

Open — P3, defer to a UX polish sprint. Not a blocker for Epic 21 ship; the bug only fully manifests in unusual workspace configurations.

---

## Finding #4 — Cycle-detail Aktivitet tab is a placeholder ("Hanteras i Story 21.13")

**Severity:** 🟠 **P2 — incomplete feature**
**Discovered:** 2026-04-27 during UAT plan §2.4 (sign-off → activity log verification).
**Affects:** Every cycle's Aktivitet tab at `/laglistor/kontroller/{cycleId}#aktivitet`.

### Reproduction

1. Sign off any item on a cycle (e.g. set Bedömning + Motivering on a row, click Signera).
2. Server-side, an `ActivityLog` row IS written with `entity_type = 'compliance_audit_item'`, `action = 'cycle_item_signed_off'` (verified — Story 21.13 ships this).
3. Click the **Aktivitet** tab on the cycle detail page.
4. Tab renders the literal italic muted-foreground string `"Hanteras i Story 21.13"` instead of an activity feed.

### Root cause

Story 21.13 was scoped to wire the WRITE side — every mutation server action emits the appropriate `ActivityLog` row with `oldValue` / `newValue` snapshots, and the entity-type label map was extended to include `compliance_audit_cycle`, `compliance_audit_item`, `compliance_finding`, `compliance_audit_report`. But the cycle-detail page's Aktivitet TAB, declared at `components/features/compliance-audit/cycle-detail/cycle-detail-page.tsx:609-613`, was left as a hardcoded placeholder string awaiting a follow-up component.

```tsx
<TabsContent value="aktivitet">
  <div className="p-6 text-sm italic text-muted-foreground">
    Hanteras i Story 21.13
  </div>
</TabsContent>
```

The entries DO appear in the workspace-level activity feed (likely `/aktivitet` or wherever the global log surface lives) — they're just not scoped + displayed on the cycle detail page where users naturally look first.

### Fix (proposed)

New component `components/features/compliance-audit/cycle-detail/cycle-activity-tab.tsx` that:

1. Fetches `ActivityLog` entries scoped to the cycle: `entity_type = 'compliance_audit_cycle' AND entity_id = cycleId` UNION `entity_type IN ('compliance_audit_item', 'compliance_finding', 'compliance_audit_report') AND entity_id IN (...the cycle's children's ids...)`. Server action probably belongs in `app/actions/compliance-audit-cycle.ts` next to `getCycleById`.
2. Renders the entries via the existing `lib/activity/format-activity.ts` formatter (already updated by 21.13 to render Swedish labels for cycle entity types) + the `<ActivityLogList>` component used elsewhere in the app.
3. Auto-revalidates on cycle mutations (could share a SWR key with the page-level cache, or use `globalMutate` from the mutation handlers — same pattern as items/findings already use).
4. Empty state: "Inga händelser ännu — denna kontrolls aktivitet visas här när du gör ändringar."
5. Probably wants pagination since long-running cycles can accumulate hundreds of entries.

**Estimated effort:** 2-4 hours including a server action with proper tenant isolation, the component itself, an empty-state, and basic tests.

### Status

Open — should land before Epic 21 ship since it's a visible "incomplete feature" indicator (the placeholder text gives away that something's missing). Not strictly a UAT blocker (data is preserved, just not rendered cycle-scoped), but on the wrong side of the "looks done" line for customer-facing release.

---

## Finding #5 — Inline editors don't surface their save affordance ("how do I commit this?")

**Severity:** 🟡 **P3 — UX polish, project-wide**
**Discovered:** 2026-04-27 during UAT plan §2.7 (Bedömning + Motivering inline edits).
**Affects:** All inline save-on-blur / save-on-ctrl+enter editors across the app, including the cycle-items tab's `ItemMotiveringEditor`, the legal-document-modal's business-context + compliance-narrative editors, kravpunkt comment editors, possibly more.

### Reproduction

1. Open a cycle in PAGAENDE status.
2. Click into the Motivering cell of any unsigned row — input goes into edit mode.
3. Type some text.
4. Look for a Save button or any visual cue indicating how to commit the edit.
5. ❌ None present. The editor only saves on `blur` (mouse-out / tab-out) or `Ctrl+Enter`. New users don't know either gesture without being told.

### Root cause

Save-on-blur is a deliberate UX pattern (no clutter, fast workflow once you know it) but the discoverability cost is real — first-time users sit on the field unsure whether the edit is being saved, whether they need to press Enter, etc. The editors expose no inline hint or save chip.

### Recommendation

Three layered fixes, pick one or stack:

1. **Helper text under the field while focused** — e.g. muted-foreground italic *"Sparar automatiskt när du lämnar fältet (eller Ctrl+Enter)"*. Cheapest fix.
2. **Inline save chip / "Klart" button** that appears when the field is dirty (text differs from saved value), positioned bottom-right of the editor. Click commits. Matches the pattern used in some Notion-style editors.
3. **Pulsing dot or "sparat" indicator** post-save (1.5s flash near the field) so user gets explicit confirmation. The current toast-on-error pattern is asymmetric — silence on success is unsettling.

Recommend (1) as the minimum-viable fix; if customer feedback persists, escalate to (2) + (3) together as a unified inline-editor primitive that all surfaces share. Avoid bolting per-editor fixes onto each surface — the right shape is one shared `<InlineEditor>` component or a `useInlineEdit` hook that all the consumers wrap.

### Fix (proposed)

- **Phase 1 (P3, ~30 min):** add a `<p className="mt-1 text-xs italic text-muted-foreground">` under each focused inline editor with the helper copy. Apply to:
  - `components/features/compliance-audit/item-bedomning-editor/ItemMotiveringEditor.tsx`
  - The relevant editors in `components/features/document-list/legal-document-modal/`
  - The kravpunkt comment editor inside `kravpunkter-checklist.tsx`
- **Phase 2 (P3, post-MVP):** extract a shared `<InlineEditor>` primitive with built-in save chip + post-save flash. Out of Epic 21 scope; flag for the UI primitives consolidation work in Epic 22.

### Status

Open — P3, not an Epic 21 ship blocker. Worth logging into Epic 22 (UI Primitives Alignment) as a follow-up since the durable fix is a shared primitive.

---

## Finding #6 — Cycle items tab needs search + filter primitives for large-cycle workflows

**Severity:** 🟠 **P2 — feature gap, scale-blocker for real customer audits**
**Discovered:** 2026-04-27 during UAT of the cycle detail page (Almåsa Testkontroll, 68 items).
**Affects:** Every cycle's items tab. Pain scales linearly with cycle size — the existing 68-item Almåsa test cycle already required the user to fall back on browser Ctrl+F to locate a specific row (`Semesterlag (1977:480)`).

### Reproduction

1. Open any cycle with more than ~20 items.
2. Try to find a specific document by name (e.g. "Semesterlag") — only options today are: scroll, or use the browser's native find.
3. Try to filter by status (e.g. "show me only the unsigned rows" or "only Maria Adstedt's rows") — no UI affordance.

### Root cause

The cycle items tab (`components/features/compliance-audit/cycle-detail/cycle-items-tab.tsx`) renders the full server-loaded items array via `PlainBody` / `VirtualisedBody` with no search/filter layer in front. Story 21.5 prioritised correctness of the inline editors and sign-off flow over scale UX. Acceptable for the 21.5 v0.x ship; not acceptable for production audits where customer cycles routinely exceed 100 items (some industry-standard ISO 14001 catalogues have 200+ entries before scope filtering).

### What's needed (proposed feature scope)

A `<TableToolbar>` above the items table containing:

1. **Free-text search input** — debounced, filters on document title + SFS number client-side (the data is already loaded; no server round-trip needed at the 68-500 item scale Story 21.4 caps at).
2. **Status chip(s)** — multi-select filter chips for `Nuvarande status` values: Ej påbörjad / Delvis uppfylld / Uppfylld / Ej tillämplig / Ej relevant.
3. **Bedömning chip(s)** — multi-select for the four `EfterlevnadsBedomning` values + an "Ej bedömd" pseudo-value for null.
4. **Signerad / osignerad toggle** — binary filter chip.
5. **Ansvarig dropdown** — multi-select listing workspace members who appear as a `sourceResponsibleUser` on at least one row (don't list members with zero rows — keeps the menu short).
6. **Group filter** — if the cycle is scoped to multiple groups, multi-select groups. Hidden when only one group is in scope.
7. **Active-filter chip strip + "Rensa filter" button** when any filter is applied.

Result indicator under the toolbar: *"Visar X av Y dokument"*.

### Why this also belongs to Epic 22 (UI Primitives Alignment)

Epic 22 already has a `<FilterChip>` primitive in scope plus a `<TableToolbar>` component being scoped for the six tabular surfaces. The cycle-items toolbar should be built ON TOP of those primitives rather than as a one-off, so the cycle-items + cycle-findings + document-list + tasks-table all use the same toolbar shape. Coordinate with Epic 22 stories.

### Fix (proposed)

Two paths:

- **Path A — minimal, unblocks UAT-at-scale:** ship just (1) free-text search + (4) signerad toggle as a thin custom toolbar inside `cycle-items-tab.tsx`. ~2 hours. Defers the rest to Epic 22.
- **Path B — proper:** extend Epic 22's `<TableToolbar>` story to include the cycle-items consumer; ship all 6 filters as part of the unified primitive. ~1 day extra inside Epic 22's scope.

Recommend **Path A** as a P2-priority follow-up to land before Epic 21 customer rollout, then Path B replaces it during Epic 22.

### Status

Open — P2. Not strictly an Epic 21 ship blocker (the data model is correct, all flows work for small cycles), but a customer-rollout blocker for any laglista of meaningful size.

---

## Finding #7 — Lifecycle dropdown tooltips don't adapt INTERN / EXTERN role label

**Severity:** 🟡 **P3 — Swedish copy polish**
**Discovered:** 2026-04-27 during UAT plan §4.4 (MEMBER-not-lead-auditor revert attempt).
**Affects:** Tooltips on the Åtgärder dropdown items (`Återställ till Pågående`, `Fastställ kontroll`) when disabled because the user lacks revert/seal permission.

### Reproduction

1. As a MEMBER who is not the cycle's lead auditor, open an **Intern revision** cycle in AVSLUTAD status.
2. Click the Åtgärder dropdown.
3. Hover the disabled "Återställ till Pågående" item.
4. Tooltip reads: *"Endast revisionsledaren eller administratörer kan återställa kontrollen"*.

### Root cause

The tooltip copy uses the EXTERN-cycle Swedish term `revisionsledaren` regardless of `cycle.auditType`. Story 21.11's renderer establishes the convention: INTERN cycles use `Kontrolledare` (the role name) / `Kontrolltyp` / `Kontrollkriterier`, while EXTERN cycles use `Revisionsledare` / `Revisionstyp` / `Revisionskriterier`. See `lib/compliance-audit/revisionsrapport-renderer.ts` `SECTION_LABELS` constant — the same INTERN/EXTERN dichotomy is enforced in the rendered audit report.

The Åtgärder dropdown component (`components/features/compliance-audit/cycle-detail/cycle-actions-dropdown.tsx`) hardcodes `revisionsledaren` in the disabled-tooltip strings without consulting `cycle.auditType`.

### Fix (proposed)

Mirror the renderer's variant pattern. Either:

1. **Inline ternary** at each tooltip site:
   ```ts
   const leaderLabel = cycle.auditType === 'EXTERN' ? 'revisionsledaren' : 'kontrolledaren'
   ```
2. **Shared helper** in `lib/compliance-audit/copy.ts` (or similar) that exports `getLeaderRoleLabel(auditType)` for any UI surface that needs it. Cleaner long-term and aligns with `scope-summary-copy.ts` precedent from Story 21.4 NH-3.

Touch sites:
- `components/features/compliance-audit/cycle-detail/cycle-actions-dropdown.tsx` — both `Återställ till Pågående` and `Fastställ kontroll` disabled-tooltips.
- Possibly the Slutför kontroll tooltip too (UAT §4.5 — disabled-when-not-all-signed).
- Possibly the `Endast revisorn ...` strings elsewhere.

### Status

Open — P3, copy polish only. Behavior is correct; this is purely terminology consistency with the rendered revisionsrapport.

---

## Finding #8 — Internal permission scope identifier `'audit:seal'` leaking into user-facing tooltip

**Severity:** 🟠 **P2 — UI hygiene, customer-visible technical jargon**
**Discovered:** 2026-04-27 during UAT plan §5.1 (Fastställ kontroll disabled tooltip).
**Affects:** The Åtgärder dropdown's `Fastställ kontroll` disabled-state tooltip when the user lacks seal authority.

### Reproduction

1. Open an AVSLUTAD cycle as a user who is NOT lead auditor and NOT OWNER/ADMIN.
2. Open the Åtgärder dropdown.
3. Hover the disabled `Fastställ kontroll` item.
4. Tooltip reads: *"Endast revisionsledaren eller administratörer med behörighet **'audit:seal'** kan fastställa kontrollen."*

### Root cause

The tooltip copy was authored by quoting the literal `Permission` scope name (`'audit:seal'` from `lib/auth/permissions.ts`) directly into the user-facing string — likely a debug-era string that leaked into the v0.x ship of Story 21.9 (seal). Customers (especially compliance officers, KMA-samordnare, external revisorer) should never see internal permission identifiers; it suggests "developer-grade UI" to anyone reviewing the product.

### Fix (proposed)

Drop the scope identifier entirely; the natural-language description is sufficient. Suggested replacement copy:

- INTERN cycles: *"Endast kontrolledaren eller administratörer kan fastställa kontrollen."*
- EXTERN cycles: *"Endast revisionsledaren eller administratörer kan fastställa kontrollen."*

Same fix site as Finding #7 (`components/features/compliance-audit/cycle-detail/cycle-actions-dropdown.tsx`) — bundle the two tooltip fixes into one PR. Estimated effort: 15 minutes for both findings combined.

### Status

Open — bundle with Finding #7's fix.

---

## Future findings

_Add new findings below as they surface during UAT. Use the same template:_

- ### Finding #N — short title
- **Severity:**
- **Discovered:**
- **Affects:**
- **Reproduction:**
- **Root cause:**
- **Fix (proposed):**

---

## Sign-off

When all findings are documented and triaged:

| Finding # | Title | Severity | Status | Fix landed in |
|---|---|---|---|---|
| 1 | AUDITOR has full edit access to `/laglistor` | 🔴 P1 | Open | _pending_ |
| 2 | AUDITOR users appear in Ansvarig revisor picker | ⚪ P4 (decision made: keep) | Open — needs UI affordance | _pending_ |
| 3 | Members with identical names are indistinguishable in pickers | 🟡 P3 | Open | _pending_ |
| 4 | Cycle-detail Aktivitet tab is a placeholder ("Hanteras i Story 21.13") | 🟠 P2 | Open | _pending_ |
| 5 | Inline editors don't surface their save affordance | 🟡 P3 | Open — Epic 22 candidate | _pending_ |
| 6 | Cycle items tab needs search + filter for large-cycle workflows | 🟠 P2 | Open — coordinate with Epic 22 TableToolbar | _pending_ |
| 7 | Lifecycle dropdown tooltips don't adapt INTERN / EXTERN role label | 🟡 P3 | Open — bundle with #8 | _pending_ |
| 8 | Internal scope id `'audit:seal'` leaking into user-facing tooltip | 🟠 P2 | Open — bundle with #7 | _pending_ |
