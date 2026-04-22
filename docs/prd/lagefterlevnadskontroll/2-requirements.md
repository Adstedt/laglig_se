# 2. Requirements

## 2.1 Functional

- **FR1:** The system shall provide a new first-class entity `ComplianceAuditCycle` scoped to a single `LawList` within a `Workspace`, with lifecycle states `PLANERAD → PAGAENDE → AVSLUTAD → SEALED → ARKIVERAD`.
- **FR2:** The user shall be able to define the cycle's scope using any combination of (a) the entire laglista, (b) one or more `LawListGroup`(s), or (c) individual `LawListItem`(s). Scope intent is stored as `scope_definition_json`; the resolved set is materialised as `ComplianceAuditItem` rows at cycle transition from `PLANERAD` to `PAGAENDE`.
- **FR3:** Once materialised, each `ComplianceAuditItem` shall be pre-populated with the current `compliance_status` of its source `LawListItem` and a frozen reference to the current kravpunkter set.
- **FR4:** Materialised `ComplianceAuditItem` set shall remain stable for the duration of the cycle — additions, removals, or regroupings of the underlying laglista shall not alter the cycle's item set. A manual "Rescope" action (lead auditor only) shall be available to re-materialise, logged as a distinct activity event.
- **FR5:** For each `ComplianceAuditItem`, an assigned responsible user shall be able to set an `efterlevnadsbedomning` (`UPPFYLLD | DELVIS | EJ_UPPFYLLD | EJ_TILLAMPLIG`) with free-text `motivering`.
- **FR6:** The system shall support per-item sign-off by the responsible user, capturing `signed_off_at` and `signed_off_by` immutably at sign-off time.
- **FR7:** The system shall support creation, edit, and closure of `ComplianceFinding` records tied to a cycle and optionally to a specific item or kravpunkt. Findings shall have `type` (`AVVIKELSE | OBSERVATION | FORBATTRING`), `severity` (`MAJOR | MINOR`, required only when type is `AVVIKELSE`), `title`, `description`, `root_cause`, `due_date`, `closed_at`, `closed_by`.
- **FR8:** When a finding of type `AVVIKELSE` is created, the system shall auto-spawn a corrective-action `Task` using the existing Task model, linked via `ComplianceFinding.corrective_action_task_id`. The Task inherits the finding's title, description, due date, and the assignee of the responsible user from the related cycle item.
- **FR9:** The lead auditor shall be able to transition the cycle to `AVSLUTAD` (Complete) once all items have been signed off. The `AVSLUTAD` state generates a PDF revisionsrapport but leaves the cycle editable.
- **FR10:** The lead auditor shall additionally be able to transition an `AVSLUTAD` cycle to `SEALED`, which: (a) computes a SHA-256 hash over a canonical-JSON serialisation of cycle metadata + all items + all findings + evidence manifest, (b) creates `ComplianceEvidenceSnapshot` rows capturing `(evidence_id, evidence_sha256, captured_at)` for every currently linked artifact, (c) persists the seal hash, and (d) locks the cycle and all child records read-only at the server-action layer.
- **FR11:** Server actions that mutate a `ComplianceAuditCycle`, `ComplianceAuditItem`, or `ComplianceFinding` shall reject any mutation when the parent cycle is in `SEALED` or `ARKIVERAD` state, returning a structured error.
- **FR12:** The system shall render a Laglig-branded HTML view and a downloadable PDF of the revisionsrapport containing the mandatory ISO 19011-style sections: omfattning, revisionskriterier, metodik, sammanfattning, avvikelser (per item), observationer, förbättringsförslag, styrkor, konklusion, signatarer (inkl. seal hash when sealed).
- **FR13:** The PDF for a `SEALED` cycle shall include the seal hash and seal timestamp visibly on the cover page and in the manifest footer of the last page.
- **FR14:** The system shall expose a `/laglistor/kontroller` workspace route listing all cycles (filterable by status, lead auditor, date range), a detail page per cycle, and a "Skapa kontroll" creation flow.
- **FR15:** All cycle-related mutations (creation, materialisation, item sign-off, finding CRUD, complete, seal) shall write to the existing `ActivityLog` and surface in the `/workspace/activity` feed.
- **FR16:** The permission matrix shall be extended with a new `audit:seal` scope; OWNER, ADMIN, and the cycle's designated `lead_auditor_user_id` shall hold it. Cycle read-access shall extend the AUDITOR role's existing `activity:view` pattern.
- **FR17:** The cycle detail UI shall support multi-reviewer concurrency — multiple responsible users can work on different items simultaneously, with SWR-cached live updates of progress visible to all participants.
- **FR18:** The UI shall default vocabulary to generic Swedish ("Kontroll", "Genomgång") rather than ISO-flavoured ("Revision"), with "Revision" available as the `INTERN | EXTERN` audit_type choice on cycle creation. Finding taxonomy retains Swedish-generic terms (avvikelse / observation / förbättring).

## 2.2 Non-Functional

- **NFR1:** Cycle materialisation for a 500-item laglista shall complete in under 3 seconds (p95) on production hardware.
- **NFR2:** PDF generation for a 200-item cycle shall complete in under 30 seconds (p95). Generation runs asynchronously; UI shall show progress and notify on completion rather than blocking the user.
- **NFR3:** Cycle detail page shall render the full item list in under 1 second for up to 500 items (p95), reusing the same virtualised table pattern as `VirtualComplianceRow`.
- **NFR4:** Seal-hash computation shall use `crypto.createHash('sha256')` (Node built-in) over a deterministic canonical-JSON serialisation; the canonicalisation routine shall be unit-tested against a golden fixture to prevent drift.
- **NFR5:** The module shall not degrade existing `/laglistor` page load time by more than 5% (measured p95) — no new data fetched on the main page; cycles live under their own route.
- **NFR6:** Existing ActivityLog write volume shall not increase by more than 20% on peak days; cycle events are incremental and infrequent relative to kravpunkter mutations.
- **NFR7:** All new server actions shall follow existing Zod validation + withWorkspace + permission-check patterns; new code coverage target: ≥80% statement coverage on server actions and canonicalisation routine.
- **NFR8:** All new Prisma models shall use existing conventions: `id UUID`, `created_at`, `updated_at`, workspace scoping, soft-delete where applicable (`deleted_at`), named foreign keys.
- **NFR9:** The module shall respect the existing light/dark theme, keyboard-navigation, and screen-reader patterns established by shadcn/ui components in use.
- **NFR10:** Seal action shall be irreversible at the application layer. Reversal requires a new cycle — explicit UI copy shall communicate this. (Database-layer recovery for operator error is an operational concern, not a feature.)

## 2.3 Compatibility Requirements

- **CR1:** **Existing API compatibility** — No existing server actions, API routes, or SWR keys shall change signature or behaviour. Existing surfaces (`app/actions/law-list-item-requirements.ts`, `app/actions/linked-artifacts.ts`, `app/actions/legal-document-modal.ts`, task actions) remain untouched in contract; integration happens via new call sites that read/write cycle entities.
- **CR2:** **Database schema compatibility** — Schema migration is additive only: 5 new tables, 1 new enum (`ComplianceCycleStatus`), 1 new enum (`EfterlevnadsBedomning`), 1 new enum (`FindingType`), 1 new enum (`FindingSeverity`), 1 new permission scope string. One new optional back-reference column may be added to `Task` (`compliance_finding_id` for the reverse FK convenience) — nullable, no data migration required. No existing column is dropped, renamed, or retyped.
- **CR3:** **UI/UX consistency** — Cycle UI shall reuse existing shadcn/ui components, existing `ComplianceStatusEditor` / `StatusBadge` patterns where applicable, the `compliance-detail-table` grouped view for scope selection, and the existing `LinkedArtifactsPanel` for evidence visibility within cycle items. Swedish copy, typography, and spacing shall match existing `/laglistor` surfaces. No change to existing page layouts.
- **CR4:** **Integration compatibility** — Cycle-driven corrective-action tasks shall use the existing `Task` entity with no new task-type discriminator; they appear in the existing tasks UI indistinguishably from manually created tasks, with a back-reference link to the originating finding. Cycle activity events shall use the existing `ActivityLog` format (entity_type, action, old_value, new_value) with new entity types (`compliance_audit_cycle`, `compliance_audit_item`, `compliance_finding`). The existing `/workspace/activity` feed surfaces them without UI changes other than added Swedish labels.

---
