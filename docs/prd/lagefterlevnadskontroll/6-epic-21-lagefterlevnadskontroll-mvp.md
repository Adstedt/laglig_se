# 6. Epic 21: Lagefterlevnadskontroll MVP

**Epic Goal:** Deliver a production-ready Lagefterlevnadskontroll module that enables a Swedish customer — ISO-certified or non-certified SMB — to run a complete internal compliance audit cycle end-to-end in Laglig (scope → bedömning → findings → sign-off → complete → optional seal → PDF download) and hand the output to an external certifieringsorgan or keep it as internal statutory documentation, all while fully preserving existing laglistor, kravpunkter, linked-artifacts, task, and activity-log functionality.

**Integration Requirements:** Additive Prisma migration (5 tables + enums + one nullable column on `Task`), new server actions under `app/actions/compliance-audit-*`, new routes under `app/(workspace)/laglistor/kontroller/**`, new components under `components/features/compliance-audit/**`. Reuse of `compliance-detail-table`, `StatusBadge`, `ComplianceStatusEditor`, `LinkedArtifactsPanel`, `Task` model, `ActivityLog`, `hasPermission()`, `withWorkspace()`, existing Swedish-locale date-fns formatting, existing SWR + revalidatePath patterns.

---

## Story 21.1 — Prisma schema foundations for ComplianceAuditCycle

As a **backend developer**,
I want **the Prisma schema to define all five cycle-related models plus enums with proper relations**,
so that **subsequent stories can build server actions and UI against a stable data model**.

**Acceptance Criteria**

1. `ComplianceAuditCycle` model defined in `prisma/schema.prisma` with: `id`, `workspace_id`, `law_list_id`, `name`, `scope_definition_json` (Json), `audit_type` (enum INTERN | EXTERN), `scheduled_start`, `scheduled_end`, `law_change_cutoff_date`, `status` (enum ComplianceCycleStatus: PLANERAD | PAGAENDE | AVSLUTAD | SEALED | ARKIVERAD), `lead_auditor_user_id`, `sealed_at`, `sealed_by_user_id`, `seal_hash`, `created_at`, `updated_at`, `deleted_at`, `created_by_user_id`.
2. `ComplianceAuditItem` model with: `id`, `cycle_id`, `law_list_item_id`, `efterlevnadsbedomning` (enum UPPFYLLD | DELVIS | EJ_UPPFYLLD | EJ_TILLAMPLIG, nullable), `motivering` (text, nullable), `reviewed_at`, `reviewed_by_user_id`, `signed_off_at`, `signed_off_by_user_id`, `kravpunkter_snapshot_json` (Json, nullable), `created_at`, `updated_at`.
3. `ComplianceFinding` model with: `id`, `cycle_id`, `law_list_item_id` (nullable), `requirement_id` (nullable), `type` (enum FindingType: AVVIKELSE | OBSERVATION | FORBATTRING), `severity` (enum FindingSeverity: MAJOR | MINOR, nullable), `title`, `description`, `root_cause` (nullable), `corrective_action_task_id` (nullable FK to Task), `due_date` (nullable), `closed_at`, `closed_by_user_id`, `created_at`, `updated_at`.
4. `ComplianceEvidenceSnapshot` model with: `id`, `cycle_id`, `law_list_item_id` (nullable), `requirement_id` (nullable), `evidence_kind` (enum FILE | DOCUMENT), `evidence_id`, `evidence_sha256`, `captured_at`.
5. `ComplianceAuditReport` model with: `id`, `cycle_id`, `report_kind` (enum COMPLETE | SEALED), `generated_at`, `pdf_storage_path` (nullable), `html_storage_path` (nullable), `manifest_json` (Json).
6. New nullable column `compliance_finding_id` added to `Task` model as back-reference to the finding that spawned it.
7. All new models use workspace scoping where applicable and follow existing naming + index conventions.
8. `prisma migrate dev` runs clean against a fresh DB; `prisma generate` produces typed clients for all new models.
9. Seed / fixture helper added for cycle creation in test harness.

**Integration Verification**

- **IV1:** Existing Prisma models (`LawList`, `LawListItem`, `LawListItemRequirement`, `Task`, `ActivityLog`, `User`, `Workspace`) remain untouched in field definitions; only new relations point inward.
- **IV2:** `prisma migrate` produces a migration that, when inspected, contains only `CREATE TABLE`, `CREATE TYPE`, and a single `ALTER TABLE public.tasks ADD COLUMN compliance_finding_id UUID NULL`. No `DROP`, `ALTER COLUMN`, or `RENAME`.
- **IV3:** `pnpm build` and `npx tsc --noEmit` both pass after migration and type regeneration.

---

## Story 21.2 — Cycle CRUD server actions

As a **KMA-samordnare**,
I want **server actions to create, list, read, update, and soft-delete compliance audit cycles**,
so that **I can manage the lifecycle of cycles programmatically and from the UI**.

**Acceptance Criteria**

1. `app/actions/compliance-audit-cycle.ts` exposes: `createCycle`, `listCyclesForWorkspace`, `getCycleById`, `updateCycleMetadata`, `softDeleteCycle` (only if status === `PLANERAD`).
2. All actions wrap `withWorkspace()` and enforce `tasks:edit` (same bar as kravpunkter) for mutations; read actions require `activity:view` or `tasks:edit`.
3. Zod schemas validate all inputs; invalid inputs return structured errors without hitting Prisma.
4. `createCycle` persists in status `PLANERAD`; does NOT materialise items (Story 21.4 handles that transition).
5. Every mutation writes a corresponding `ActivityLog` row with entity_type `compliance_audit_cycle`.
6. `revalidatePath('/laglistor/kontroller')` called after every mutation.
7. Unit tests cover: valid creation, permission denied, validation errors, soft-delete blocked for non-`PLANERAD`, duplicate name within workspace + laglista allowed (no uniqueness constraint beyond `id`).

**Integration Verification**

- **IV1:** Existing server actions (`law-list-item-requirements.ts`, `linked-artifacts.ts`, task actions) continue to pass their existing tests unchanged.
- **IV2:** `/laglistor` page load unaffected — no new server call added to that page.
- **IV3:** Server-action response times for `createCycle` under 200ms p95 in test harness (no heavy lifting; materialisation is deferred).

---

## Story 21.3 — Scope selection component

As a **KMA-samordnare creating a cycle**,
I want **to select the cycle's scope using a familiar grouped laglista view with tri-state checkboxes**,
so that **I can include the entire list, specific groups, or specific individual laws without learning a new UI**.

**Acceptance Criteria**

1. New component `components/features/compliance-audit/scope-selector/ScopeSelector.tsx` renders a grouped laglista view driven by the same data source as `compliance-detail-table`.
2. Each group header and each item row has a checkbox; checkboxes support `unchecked | indeterminate | checked` states with proper parent-child propagation.
3. Selecting the "Välj alla" master checkbox selects every item; emitted `scope_definition_json` is `{kind: 'all'}`.
4. Selecting one or more groups only (no partial-group selections) emits `{kind: 'groups', groupIds: [...]}`.
5. Mixed or partial selections emit `{kind: 'items', itemIds: [...]}`.
6. Live summary below the selector: "23 lagar valda i 4 grupper" (Swedish), updates on every change.
7. Existing `compliance-detail-table` component is NOT modified — extraction of the shared rendering primitives into a reusable presentation component if needed is Story-private refactor, but the existing table's behaviour is preserved.
8. Component tests cover tri-state propagation, master toggle, and correct `scope_definition_json` emission for all three shapes.

**Integration Verification**

- **IV1:** `/laglistor` main page rendering and interaction remain identical (visual regression check on the compliance-detail-table).
- **IV2:** SWR cache for the main laglista view is not invalidated by scope-selector mounting/unmounting.
- **IV3:** Scope selector renders a 500-item laglista in under 500ms (virtualised if the existing table is).

---

## Story 21.4 — Cycle creation wizard + materialisation

As a **KMA-samordnare**,
I want **a guided cycle creation flow that captures metadata + scope and materialises the item set**,
so that **a new cycle transitions from `PLANERAD` to `PAGAENDE` with a frozen set of items ready for bedömning**.

**Acceptance Criteria**

1. New route `/laglistor/kontroller/skapa` renders a three-step wizard (metadata → scope → confirm).
2. Step 1 captures: name (required), laglista select (required, single), audit_type (INTERN | EXTERN), scheduled_start, scheduled_end, law_change_cutoff_date, lead_auditor_user_id (select from workspace members).
3. Step 2 uses `ScopeSelector` (Story 21.3).
4. Step 3 shows a summary + "Skapa kontroll" button. Button triggers `createCycle` + `materialiseCycleItems` in sequence within a Prisma transaction.
5. `materialiseCycleItems` (new server action): resolves `scope_definition_json` into a concrete list of `LawListItem` ids, creates one `ComplianceAuditItem` per law with the current `compliance_status` as initial `efterlevnadsbedomning` (mapping: UPPFYLLD→UPPFYLLD, PAGAENDE/EJ_PABORJAD→null, EJ_UPPFYLLD→EJ_UPPFYLLD, EJ_TILLAMPLIG→EJ_TILLAMPLIG) and captures a kravpunkter snapshot JSON per item.
6. On success, cycle transitions to `PAGAENDE`, user redirected to `/laglistor/kontroller/[cycleId]`.
7. Failed materialisation rolls back the transaction; cycle remains in `PLANERAD` state; user sees clear error.
8. Materialisation is logged as an ActivityLog event `cycle_materialised` with item count.

**Integration Verification**

- **IV1:** `/laglistor` main page unaffected; no cross-impact on kravpunkter state (materialisation reads, never writes LawListItem state).
- **IV2:** Materialisation of a 500-item laglista completes in under 3 seconds (p95) — NFR1 benchmark test in CI.
- **IV3:** Existing `/laglistor/[id]` modal continues to render correctly for any LawListItem that is now part of a cycle (no UI regression).

---

## Story 21.5 — Cycle detail page: item list + inline bedömning editor

As a **responsible user assigned to cycle items**,
I want **a list view of all items in the cycle with inline efterlevnadsbedomning + motivering editors**,
so that **I can efficiently work through the cycle without opening each item in a modal**.

**Acceptance Criteria**

1. New route `/laglistor/kontroller/[cycleId]` renders with tabs: Items (default), Findings, Rapport, Aktivitet.
2. Items tab shows a virtualised list/table of `ComplianceAuditItem` rows. Columns: Lag (title + link), Nuvarande status (badge), Bedömning (inline select), Motivering (click-to-edit textarea), Ansvarig, Signed off at (if signed).
3. Bedömning select uses same variants as existing `StatusBadge` for visual consistency.
4. Motivering textarea saves on blur or 2s idle; optimistic UI via SWR.
5. Row expansion reveals a drawer with the item's kravpunkter snapshot, currently linked artifacts, and findings list (read-mostly; findings edited via the Findings tab or inline action).
6. Per-row "Signera" button sets `signed_off_at = now()` and `signed_off_by_user_id = currentUser.id` via server action; idempotent (signing again is a no-op).
7. Header shows progress: "23 av 45 bedömda", "14 av 45 signerade"; clicking jumps to first unbedömd item.
8. Entire page is read-only if cycle status is `SEALED` or `ARKIVERAD`.

**Integration Verification**

- **IV1:** `/laglistor/[lawListItemId]` main modal remains fully functional; no side-effects from cycle item mutations on the source LawListItem.
- **IV2:** Virtualised rendering maintains 60fps scroll on a 500-item list in Chrome on a mid-range laptop.
- **IV3:** SWR cache `compliance-audit-items:${cycleId}` correctly invalidates on each bedömning or sign-off mutation; no stale reads observed in a 2-user concurrent edit smoke test.

---

## Story 21.6 — Cycle lifecycle transitions: Complete

As a **lead auditor**,
I want **to transition a cycle to `AVSLUTAD` once all items are signed off**,
so that **I can generate a completed (but still editable) revisionsrapport without committing to the irreversible seal**.

**Acceptance Criteria**

1. "Slutför kontroll" button visible on cycle detail header when cycle status is `PAGAENDE` and all items have `signed_off_at` set; disabled otherwise with tooltip listing blockers.
2. Confirmation dialog explains: completion freezes the report template but items remain editable (you can still fix motivering or add findings); sealing is a separate later step.
3. Server action `completeCycle(cycleId)`: validates all items signed off, transitions status to `AVSLUTAD`, writes ActivityLog.
4. Triggers Story 21.11's rapport renderer to produce an initial HTML report; PDF generation may be deferred to a background job (Story 21.12).
5. User sees the Rapport tab auto-populated after completion.
6. Cycle can be reverted to `PAGAENDE` by the lead auditor if not yet sealed (soft revert: status update only, keeps item state; logged).

**Integration Verification**

- **IV1:** A `PAGAENDE` cycle with unsigned items does not allow Complete — blocked at server-action level even if UI is bypassed.
- **IV2:** ActivityLog entry for `cycle_completed` renders correctly in the global `/workspace/activity` feed.
- **IV3:** No impact on concurrent cycles in the same workspace.

---

## Story 21.7 — Findings: create, edit, close (with type + severity + root cause)

As a **responsible user or lead auditor**,
I want **to capture findings against the cycle or a specific item**,
so that **avvikelser, observationer, and förbättringsförslag are structured, not scattered in free-text motiveringar**.

**Acceptance Criteria**

1. `/laglistor/kontroller/[cycleId]` Findings tab lists all `ComplianceFinding` for the cycle, filterable by type + severity + status (open/closed).
2. "Lägg till avvikelse / observation / förbättring" actions available both at cycle-header level and per item in the Items tab.
3. Finding editor captures: type, severity (required only for AVVIKELSE, hidden otherwise), title, description, optional root_cause, optional due_date, optional item link, optional requirement link.
4. Severity field on AVVIKELSE is required client-side and server-side (Zod `refine`).
5. Closing a finding requires `closed_at` + `closed_by_user_id`; for AVVIKELSE findings with a corrective_action_task_id set, closure is blocked until the linked Task is completed (or a manual override with a required close_reason).
6. Finding edit/create/close are all blocked when cycle status is `SEALED`.
7. Server-side: `createFinding`, `updateFinding`, `closeFinding`, `listFindingsForCycle` server actions with standard validation + permissions.

**Integration Verification**

- **IV1:** Existing task system remains unaffected; findings without linked tasks behave fully (task auto-spawn is a separate story).
- **IV2:** Cycle progress stats (from 21.5) do not change meaning when findings are added/closed.
- **IV3:** Findings-tab rendering scales to 100+ findings without noticeable lag.

---

## Story 21.8 — Auto-spawn corrective-action Task on AVVIKELSE

As a **lead auditor creating an avvikelse**,
I want **the system to automatically create a linked Task for the korrigerande åtgärd**,
so that **the deviation gets tracked in the existing task system with reminders and assignment, not as a disconnected note**.

**Acceptance Criteria**

1. On creating a `ComplianceFinding` with type `AVVIKELSE`, the system creates a new `Task` in the same workspace with:
   - `title` = finding title
   - `description` = "Korrigerande åtgärd för avvikelse: [finding description]"
   - `due_date` = finding due_date (if provided)
   - `assigned_user_id` = cycle item's responsible user (if finding is item-linked) else cycle's lead_auditor
   - `compliance_finding_id` back-reference populated
2. The created Task appears in the normal task UI alongside manually created tasks — indistinguishable except for an optional "Från kontroll [cycle name]" badge / filter chip.
3. `ComplianceFinding.corrective_action_task_id` is populated with the new task id.
4. Closing the Task in the task UI triggers a notification (Swedish copy) to the lead auditor suggesting the finding can be closed; closure of the finding itself remains a manual action.
5. Deleting the finding does NOT auto-delete the task (task becomes a standalone task with `compliance_finding_id` = null); a confirmation dialog explains this.
6. On finding close → task is marked `completed` only if it is still open; if already completed, no-op.

**Integration Verification**

- **IV1:** Existing tasks UI (task list, task detail modal) renders correctly for both manually created and cycle-originated tasks.
- **IV2:** Task server actions continue to pass their existing tests; no new permission check added to task CRUD.
- **IV3:** A workspace with 50 pre-existing tasks + 10 cycle-originated tasks shows accurate counts and filters in the existing tasks UI.

---

## Story 21.9 — Seal: hash computation, evidence snapshot, immutability

As a **lead auditor finalising an audit-grade cycle**,
I want **to seal the cycle with a tamper-evident SHA-256 hash and frozen evidence manifest**,
so that **an external certifieringsorgan can verify months later that the presented evidence is exactly what was recorded at seal time**.

**Acceptance Criteria**

1. "Försegla kontroll" button visible on cycle header when status is `AVSLUTAD`; destructive-style button with mandatory confirmation dialog ("Denna åtgärd kan inte ångras — skapa en ny kontroll om du upptäcker fel efter försegling").
2. `sealCycle(cycleId)` server action executes in a single Prisma transaction:
   - Validates cycle is `AVSLUTAD`.
   - Builds canonical-JSON via `canonicalize()` from `lib/compliance-audit/canonicalize.ts` covering cycle metadata + all items + all findings + evidence manifest (evidence_id + current sha256 of file/document content).
   - Computes SHA-256 of the canonical JSON.
   - Inserts `ComplianceEvidenceSnapshot` row per linked artifact capturing `(evidence_id, evidence_sha256, captured_at)`.
   - Persists `seal_hash`, `sealed_at`, `sealed_by_user_id` on the cycle.
   - Sets status to `SEALED`.
   - Writes ActivityLog `cycle_sealed` with hash in the new_value field.
3. Canonicalisation routine is unit-tested with a golden fixture (`canonicalize.test.ts`); any change to cycle-entity shape that would break the fixture must be accompanied by explicit fixture update.
4. `seal_hash` is displayed on the cycle detail header (truncated with copy button), and in full on the PDF cover page (Story 21.12).
5. Sealing triggers PDF regeneration via Story 21.12's renderer; the sealed PDF supersedes any AVSLUTAD-state PDF.
6. If the transaction fails at any step, cycle remains `AVSLUTAD`; no partial state visible.

**Integration Verification**

- **IV1:** File/document deletion after seal is blocked or audited — test that deleting a file still referenced by a `ComplianceEvidenceSnapshot` returns a clear error (or soft-deletes per architect decision).
- **IV2:** Two consecutive seal computations on the same cycle state produce identical hashes (determinism verified).
- **IV3:** `ActivityLog` seal entry is visible in `/workspace/activity` and includes workspace_id, cycle_id, hash.

---

## Story 21.10 — Immutability guard for sealed cycles

As a **system safeguard**,
I want **every server action that mutates cycle-related data to reject writes on sealed cycles**,
so that **no code path — UI, direct action call, or future refactor — can violate the seal invariant**.

**Acceptance Criteria**

1. New helper `assertCycleEditable(cycleId)` in `lib/compliance-audit/cycle-guards.ts` throws a structured error if cycle status is `SEALED` or `ARKIVERAD`.
2. Every mutation server action in `app/actions/compliance-audit-*.ts` calls `assertCycleEditable` at entry, before the Zod parse.
3. Task mutations are NOT blocked on sealed cycles — a corrective-action task remains editable/closable after its originating cycle is sealed (this is correct business behaviour).
4. Finding closure and edit actions reject writes on sealed cycles via the same guard.
5. Integration test: attempt to update an item bedömning on a sealed cycle via direct server action — action returns structured error; no DB write occurs.
6. UI respects the guard preemptively: sealed cycles show all editors as read-only with a clear banner "Denna kontroll är förseglad ([seal_hash]). Läsbehörighet endast."

**Integration Verification**

- **IV1:** Editing a non-sealed cycle still works end-to-end; guard does not trigger false positives.
- **IV2:** Test harness exercises all mutation actions with a sealed-cycle fixture; 100% reject rate observed.
- **IV3:** Tasks auto-spawned from findings on a now-sealed cycle can still be completed; corrective-action loop remains functional post-seal.

---

## Story 21.11 — Revisionsrapport HTML renderer

As a **lead auditor**,
I want **a Laglig-branded HTML preview of the revisionsrapport**,
so that **I can review the output before generating the PDF or handing it off to an auditor**.

**Acceptance Criteria**

1. `lib/compliance-audit/revisionsrapport-renderer.ts` exports a function that takes a full cycle + items + findings + snapshots and returns an HTML string.
2. Report contains (in order) the mandatory sections: title page (cycle name + laglista + period + lead auditor + seal hash if sealed), omfattning (scope_definition rendered in Swedish), revisionskriterier (laglista name + audit_type), metodik (short auto-generated paragraph), sammanfattning (counts + stats table), avvikelser (per finding, grouped by severity), observationer, förbättringsförslag, styrkor (future; empty section in MVP), konklusion (auto-generated based on efterlevnadsbedömning distribution), signatarer table.
3. HTML is rendered server-side (Next.js RSC), styled with Laglig brand tokens (same typography + colour tokens as `/laglistor`).
4. Rapport tab on cycle detail page shows the HTML preview inline.
5. Copy is Swedish-first, neutral-framed (not ISO-flavoured in default tone per FR18); when `audit_type` is `EXTERN`, section headings switch to the more formal "Revisionsrapport" framing.
6. HTML is deterministic for a given cycle state — two renders of the same sealed cycle produce byte-identical HTML.

**Integration Verification**

- **IV1:** Renderer handles edge cases: zero findings, 100+ findings, all UPPFYLLD, all EJ_TILLAMPLIG, mixed.
- **IV2:** Rendering a 200-item sealed cycle completes in under 2 seconds on test hardware.
- **IV3:** Existing document rendering (legal documents, amendments) unaffected.

---

## Story 21.12 — PDF generation + storage + download

As a **lead auditor**,
I want **a downloadable, Laglig-branded PDF of the revisionsrapport**,
so that **I can hand it to the external certifieringsorgan or archive it as internal documentation**.

**Acceptance Criteria**

1. New route handler `app/(workspace)/laglistor/kontroller/[cycleId]/rapport/pdf/route.ts` returns a PDF when hit.
2. PDF generation uses the stack recommended by the Architect addendum (default: existing HTML→PDF pipeline if deemed certification-grade; fallback: Puppeteer via `@sparticuz/chromium` on Vercel). **Architect decision required before this story starts.**
3. Generation is async for cycles with >100 items: server action `generateCycleReportPdf(cycleId)` kicks off a background job, UI shows progress spinner, completed PDF path persisted to `ComplianceAuditReport.pdf_storage_path`, user notified when ready.
4. Seal hash (if present) rendered as a visible string on the cover page and in the footer of the last page; truncated hash displayed on header of every interior page.
5. PDF passes visual QA against a design spec (one reference spec for MVP) on: cover, TOC, item list, findings section, signatarer, footer.
6. Download button on Rapport tab downloads the latest PDF (AVSLUTAD or SEALED version, whichever is newer).

**Integration Verification**

- **IV1:** Concurrent PDF generation from two cycles does not deadlock or exceed memory limits.
- **IV2:** Existing Laglig PDF rendering (e.g., document exports if any) unaffected.
- **IV3:** PDF file size for a 200-item cycle stays under 10MB.

---

## Story 21.13 — ActivityLog integration + /workspace/activity surface

As a **workspace admin or auditor viewing the activity feed**,
I want **cycle events to appear in the global activity feed alongside kravpunkter and task events**,
so that **the timeline of compliance activity is unified and traceable**.

**Acceptance Criteria**

1. Every cycle mutation (create, materialise, item bedömning change, item sign-off, finding create/edit/close, task auto-spawn, cycle complete, cycle seal, cycle archive) writes to `ActivityLog` with appropriate `entity_type` (`compliance_audit_cycle`, `compliance_audit_item`, `compliance_finding`).
2. `old_value` / `new_value` are JSON-serialised for state changes; for creates, only `new_value` populated.
3. New entity-type labels added to the Swedish label map used by `/workspace/activity`: "Lagefterlevnadskontroll", "Kontrollpost", "Avvikelse / Observation / Förbättring".
4. Filters on `/workspace/activity` support the new entity types.
5. Clicking an activity row linking to a cycle or item navigates to the cycle detail page.
6. Log volume is bounded: motivering edits are debounced (save on 2s idle); per-keystroke writes do NOT produce log rows.

**Integration Verification**

- **IV1:** `/workspace/activity` renders correctly with mixed kravpunkter + cycle events; filtering and pagination remain functional.
- **IV2:** Existing activity-logger utility (`lib/services/activity-logger.ts`) is used unchanged — no new logging framework added.
- **IV3:** No more than 20% increase in ActivityLog write volume on a representative workspace (measured over 7 days of simulated usage in staging).

---

## Story 21.14 — Permissions: audit:seal scope + AUDITOR read-access threading

As a **workspace owner or admin**,
I want **granular control over who can seal cycles and what auditors can see**,
so that **segregation of duties is enforceable without breaking the existing permission model**.

**Acceptance Criteria**

1. `lib/auth/permissions.ts` extended with new scope `audit:seal` granted by default to OWNER + ADMIN; not to MEMBER, HR_MANAGER, or AUDITOR.
2. `sealCycle` server action checks `hasPermission(userRole, 'audit:seal') || isLeadAuditor(userId, cycleId)`; either condition suffices.
3. `createCycle` and cycle mutations check `tasks:edit` (same bar as kravpunkter).
4. AUDITOR role's existing `activity:view` is extended with implicit read-access to cycles in workspaces where they hold the role; all cycle list/detail/report reads by AUDITOR users return full data but UI blocks all editors.
5. Updated permission matrix documented inline in `permissions.ts` with cycle-related rows.
6. End-to-end tests cover: OWNER seals, ADMIN seals, MEMBER cannot seal, lead_auditor MEMBER can seal, AUDITOR cannot seal but can read.

**Integration Verification**

- **IV1:** Existing permission checks elsewhere in the app remain functional; the matrix is purely extended.
- **IV2:** AUDITOR role does not gain any new edit permission from this story (regression test).
- **IV3:** Lead-auditor demotion (removing `lead_auditor_user_id` from cycle) immediately revokes the user's seal ability.

---
