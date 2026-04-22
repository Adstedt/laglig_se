# Lagefterlevnadskontroll Brownfield Enhancement PRD

**Status:** Draft v1 — awaiting Architect + PO review
**Author:** John (PM) — 2026-04-22
**Target product:** Laglig.se
**Source brief:** `docs/lagefterlevnadskontroll-brief.md`
**Planned epic:** Epic 21

---

## 1. Intro Project Analysis and Context

### 1.1 Existing Project Overview

**Analysis Source:** User-provided project context + prior codebase audit executed by the Analyst (Mary) on 2026-04-22, documented in `docs/lagefterlevnadskontroll-brief.md` §5.

**Current Project State:** Laglig.se is a Next.js 15 / React / Prisma / Postgres SaaS that helps Swedish organisations maintain **laglistor** (legal registers), track **kravpunkter** (structured per-law requirements with evidence), manage compliance-related tasks, receive **lagbevakning** (monitoring of legal changes including SFS and agency föreskrifter), and assess amendment impact through a `ChangeAssessment` pipeline. The product has workspace-scoped multi-tenancy, an immutable `ActivityLog`, five unified evidence pathways surfaced through a consolidated `LinkedArtifactsPanel` (Story 17.18), a dedicated AUDITOR role, and a working Claude streaming + reasoning chat surface. It does not, however, formalise the periodic **lagefterlevnadskontroll** cycle mandated by ISO 14001/45001 clause 9.1.2, AFS 2001:1, and miljöbalken-egenkontroll.

### 1.2 Available Documentation Analysis

- [x] Tech Stack Documentation (`docs/architecture/3-tech-stack.md`)
- [x] Source Tree / Architecture (`docs/architecture/` — sharded)
- [x] Coding Standards (`docs/architecture/17-coding-standards.md`)
- [x] API Documentation (implicit through Next.js server actions + Prisma schema)
- [x] UX/UI Guidelines (`docs/front-end-spec.md`, `docs/architecture/12-unified-project-structure.md`)
- [x] Other: complete strategic brief (`docs/lagefterlevnadskontroll-brief.md`), existing Epic 17 (document management), Epic 20 (workspace krav overview), user memory at `~/.claude/.../memory/MEMORY.md` documenting kravpunkter + linked-artifacts + AI-chat patterns.

No additional `document-project` run is required — existing documentation plus Mary's brief provide sufficient context.

### 1.3 Enhancement Scope Definition

**Enhancement Type:**

- [x] New Feature Addition
- [ ] Major Feature Modification
- [ ] Integration with New Systems
- [ ] Performance/Scalability Improvements
- [ ] UI/UX Overhaul
- [ ] Technology Stack Upgrade
- [ ] Bug Fix and Stability Improvements

**Enhancement Description:** Add a first-class **Lagefterlevnadskontroll** module that formalises the Swedish legal compliance audit cycle. Users select a scope within a laglista, run a time-boxed review with structured per-law bedömning, findings (avvikelse/observation/förbättring), evidence snapshots, and optional tamper-evident seal, then export a Laglig-branded PDF revisionsrapport.

**Impact Assessment:**

- [ ] Minimal Impact (isolated additions)
- [ ] Moderate Impact (some existing code changes)
- [x] Significant Impact (substantial existing code changes)
- [ ] Major Impact (architectural changes required)

**Significant** — introduces five new Prisma models (ComplianceAuditCycle, ComplianceAuditItem, ComplianceFinding, ComplianceEvidenceSnapshot, ComplianceAuditReport), new server actions, a new route `/laglistor/kontroller`, new UI components, extends the permission matrix with an `audit:seal` scope, and integrates with the existing Task, ActivityLog, and LinkedArtifact subsystems. Does **not** modify the existing schema destructively — additions only, with minor new relation columns on `LawListItem` and `Task` for back-references.

### 1.4 Goals and Background Context

**Goals**

- Deliver a production-ready, audit-grade Lagefterlevnadskontroll MVP that ISO-certified organisations can use for internal audits and that non-certified SMBs can use for statutory uppföljning.
- Enable customers to seal cycles with a tamper-evident SHA-256 hash and generate a Laglig-branded PDF revisionsrapport presentable to external certifieringsorgan.
- Eliminate the Excel-based workflow for 100% of laglista reviews within one cycle of adopting the module.
- Establish Laglig as the first AI-forward Swedish lagbevakning tool (foundation for Phase 4 AI-assisted bedömning).
- Ship within 8–12 weeks elapsed against existing team capacity using reuse-first patterns.

**Background Context**

Swedish organisations today manage lagefterlevnadskontroll through Excel (canonical three-sheet layout: Lagefterlevnadsregister, Bedömningsmatris, Handlingsplan) or through Notisum-style annual questionnaire SaaS. Both approaches fail on traceability, multi-reviewer coordination, evidence linkage, and post-hoc tamper evidence — which is exactly what certifieringsorgan and the CSRD/ESRS reporting framework are starting to demand. Laglig already has the structural primitives required (kravpunkter, unified linked-artifacts, ActivityLog, ChangeAssessment, AUDITOR role); the module is primarily workflow glue over existing entities plus a new aggregate root for the cycle itself. Competitive analysis (Notisum, JP Infonet, Ramboll, Lagpunkten, Laglistan, Ecowise, AM System, Canea, Stratsys, Libryo/ERM, Enhesa) confirms AI and tamper-evident snapshots are absent from the Swedish market as of 2026-04; MVP captures parity on the core workflow and lays foundation for AI differentiation in Phase 4+.

### 1.5 Change Log

| Change | Date | Version | Description | Author |
|---|---|---|---|---|
| Initial draft | 2026-04-22 | 0.1 | Full brownfield PRD drafted from analyst brief | John (PM) |

---

## 2. Requirements

### 2.1 Functional

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

### 2.2 Non-Functional

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

### 2.3 Compatibility Requirements

- **CR1:** **Existing API compatibility** — No existing server actions, API routes, or SWR keys shall change signature or behaviour. Existing surfaces (`app/actions/law-list-item-requirements.ts`, `app/actions/linked-artifacts.ts`, `app/actions/legal-document-modal.ts`, task actions) remain untouched in contract; integration happens via new call sites that read/write cycle entities.
- **CR2:** **Database schema compatibility** — Schema migration is additive only: 5 new tables, 1 new enum (`ComplianceCycleStatus`), 1 new enum (`EfterlevnadsBedomning`), 1 new enum (`FindingType`), 1 new enum (`FindingSeverity`), 1 new permission scope string. One new optional back-reference column may be added to `Task` (`compliance_finding_id` for the reverse FK convenience) — nullable, no data migration required. No existing column is dropped, renamed, or retyped.
- **CR3:** **UI/UX consistency** — Cycle UI shall reuse existing shadcn/ui components, existing `ComplianceStatusEditor` / `StatusBadge` patterns where applicable, the `compliance-detail-table` grouped view for scope selection, and the existing `LinkedArtifactsPanel` for evidence visibility within cycle items. Swedish copy, typography, and spacing shall match existing `/laglistor` surfaces. No change to existing page layouts.
- **CR4:** **Integration compatibility** — Cycle-driven corrective-action tasks shall use the existing `Task` entity with no new task-type discriminator; they appear in the existing tasks UI indistinguishably from manually created tasks, with a back-reference link to the originating finding. Cycle activity events shall use the existing `ActivityLog` format (entity_type, action, old_value, new_value) with new entity types (`compliance_audit_cycle`, `compliance_audit_item`, `compliance_finding`). The existing `/workspace/activity` feed surfaces them without UI changes other than added Swedish labels.

---

## 3. User Interface Enhancement Goals

### 3.1 Integration with Existing UI

The module lives under a new route `/laglistor/kontroller` (sibling to the existing `/laglistor` main compliance dashboard) with a list view + detail view pattern. The cycle creation flow reuses the existing **grouped `compliance-detail-table`** for scope selection with tri-state checkboxes at list / group / item level — no new table component needed. Cycle detail pages reuse **`StatusBadge`**, **`ComplianceStatusEditor`**, **`LinkedArtifactsPanel`** (read-mostly in cycle context), and the existing **activity feed** widget. All new UI uses existing shadcn/ui primitives (Card, Button, Dialog, Tabs, Dropdown, Badge, Switch) and Laglig typography tokens.

### 3.2 Modified/New Screens and Views

**New screens:**

- `/laglistor/kontroller` — Cycle list view. Columns: Namn, Laglista, Status (badge), Period (start–end), Lead auditor, Framsteg (progress ring or %), Sealed (badge if sealed). Filter bar: status, lead auditor, date range. "Skapa kontroll" CTA top-right.
- `/laglistor/kontroller/skapa` — Cycle creation wizard. Step 1: metadata (name, laglista select, audit_type, period, cutoff date, lead auditor). Step 2: scope selection using tri-state grouped-table. Step 3: confirm + create (materialises items).
- `/laglistor/kontroller/[cycleId]` — Cycle detail page. Header: cycle metadata + status + action buttons ("Sign off all", "Complete", "Seal", "Export PDF"). Tab 1 (default): Items — virtualised list of `ComplianceAuditItem` rows with inline bedömning + motivering + per-item sign-off. Tab 2: Findings — list of `ComplianceFinding` with filter by type/severity. Tab 3: Rapport — HTML preview of the revisionsrapport + download PDF button. Tab 4: Aktivitet — filtered activity feed for this cycle.
- `/laglistor/kontroller/[cycleId]/items/[itemId]` — Item detail drawer (slide-in, not full page). Shows source `LawListItem` summary, kravpunkter snapshot, linked artifacts, findings tied to this item, bedömning editor, motivering, per-kravpunkt verify toggle.

**Modified screens:**

- `/laglistor` (existing main page): add a small "Öppna kontroller (N)" link in the page header if any active cycle exists. No other layout change.
- `/workspace/activity` (existing): automatically picks up cycle entity types via existing format; add Swedish labels for new entity types in the label map.

### 3.3 UI Consistency Requirements

- Use existing colour tokens; status badges follow the existing `StatusBadge` variant map (green for UPPFYLLD, yellow for DELVIS, red for EJ_UPPFYLLD, grey for EJ_TILLAMPLIG).
- Sign-off buttons use existing primary CTA style; seal action uses destructive-style button (red) with confirm modal explicitly warning "denna åtgärd kan inte ångras".
- Copy is Swedish-first, matching existing /laglistor tone; finding types display with Swedish-native icons (avvikelse = alert, observation = eye, förbättring = sparkle).
- Empty states follow existing patterns ("Inga kontroller skapade ännu — Skapa din första kontroll" with CTA).
- Mobile breakpoint: acceptable-but-not-optimised for MVP; responsive layout degrades gracefully. Full phone-first UX is Phase 6.

---

## 4. Technical Constraints and Integration Requirements

### 4.1 Existing Technology Stack

**Languages:** TypeScript (strict), JavaScript (minimal)
**Frameworks:** Next.js 15 (App Router) with React Server Components + Server Actions, React 19, SWR for client-side caching
**Database:** PostgreSQL via Prisma ORM; Supabase hosted
**Infrastructure:** Vercel-hosted Next.js app, Supabase Postgres, Redis for caching (selective), Anthropic Claude API for AI features
**External Dependencies:** `@anthropic-ai/sdk`, `zod`, `date-fns`, shadcn/ui component set, `streamdown` + `@streamdown/code` for markdown, Swedish government data feeds (SFS, agency föreskrifter)

### 4.2 Integration Approach

**Database Integration Strategy:** Additive Prisma schema changes only. Five new tables with proper FK relations to `LawList`, `LawListItem`, `LawListItemRequirement`, `User`, `Workspace`, `Task`. One back-reference nullable column on `Task` (`compliance_finding_id`). Migration is reversible. All new tables follow existing naming conventions (snake_case DB, camelCase TS).

**API Integration Strategy:** New server actions under `app/actions/compliance-audit-cycle.ts`, `app/actions/compliance-audit-item.ts`, `app/actions/compliance-finding.ts`, `app/actions/compliance-audit-report.ts`. All actions wrap `withWorkspace()` and `hasPermission()` following existing patterns in `law-list-item-requirements.ts`. No REST API route added — server actions only, consistent with current architecture.

**Frontend Integration Strategy:** New route segment `/laglistor/kontroller/**` with RSC data-fetching for page-level reads and SWR for interactive mutations. SWR keys: `compliance-audit-cycles:${workspaceId}`, `compliance-audit-cycle:${cycleId}`, `compliance-audit-items:${cycleId}`, `compliance-findings:${cycleId}`. Cross-cache invalidation via `globalMutate` on relevant keys when linked artifacts or source LawListItem status change. Reuse of `compliance-detail-table` components and existing `LinkedArtifactsPanel`.

**Testing Integration Strategy:** Vitest unit tests for server actions + canonicalisation routine; React Testing Library component tests for the scope selector, bedömning editor, and seal confirmation dialog; Playwright end-to-end tests covering the critical paths (create cycle → set bedömning → sign off all → complete → seal → download PDF). Existing test infrastructure and patterns apply; no new test framework.

### 4.3 Code Organization and Standards

**File Structure Approach:**

```
app/actions/
  compliance-audit-cycle.ts
  compliance-audit-item.ts
  compliance-finding.ts
  compliance-audit-report.ts
  compliance-evidence-snapshot.ts

app/(workspace)/laglistor/kontroller/
  page.tsx                              (list view)
  skapa/page.tsx                        (creation wizard)
  [cycleId]/page.tsx                    (detail page with tabs)
  [cycleId]/rapport/pdf/route.ts        (PDF download route)

components/features/compliance-audit/
  cycle-list/
  cycle-creation-wizard/
  cycle-detail/
  scope-selector/                       (reuses compliance-detail-table)
  item-bedomning-editor/
  finding-editor/
  seal-confirmation-dialog/
  revisionsrapport-view/

lib/compliance-audit/
  canonicalize.ts                       (canonical-JSON serialisation)
  seal-hash.ts                          (SHA-256 computation)
  revisionsrapport-renderer.ts          (HTML renderer for the report)
  cycle-materialisation.ts              (initial item-set build)
```

**Naming Conventions:** Follow existing convention — kebab-case file names, PascalCase React components, camelCase functions, snake_case DB columns, UPPER_SNAKE_CASE enums. Module prefix `ComplianceAudit*` for all new types/entities.

**Coding Standards:** Existing `docs/architecture/17-coding-standards.md` applies. Server actions `'use server'` at file top, Zod schema for all inputs, workspace+permission check at entry, Prisma transactions for multi-step mutations, `revalidatePath` after mutations, return structured results.

**Documentation Standards:** Inline JSDoc only where non-obvious; rely on TypeScript types as primary documentation. Story-level documentation in `docs/stories/epic-21-*` per existing pattern.

### 4.4 Deployment and Operations

**Build Process Integration:** No build changes. `pnpm build` continues to work. Prisma schema change triggers automatic type regeneration via `prisma generate`.

**Deployment Strategy:** Single deploy via existing Vercel pipeline. Database migration applied before deploy via standard `prisma migrate deploy`. No feature flag required — feature is gated behind new UI routes and new permission scope, so invisible to users until sales enables or until GA.

**Monitoring and Logging:** Existing application logging (server action entry/exit + errors) applies. PDF-generation async job uses existing background-task logging pattern. Cycle seal events logged at `info` level with workspace + cycle IDs. No new monitoring dashboards in MVP.

**Configuration Management:** No new environment variables required in MVP. Phase 4+ (AI-assisted bedömning) will reuse existing `ANTHROPIC_API_KEY`.

### 4.5 Risk Assessment and Mitigation

**Technical Risks:**

- **PDF render fidelity risk:** The existing HTML→PDF stack (to be confirmed by Architect) may not produce certification-grade output. Mitigation: Architect to benchmark current pipeline on a sample revisionsrapport; if insufficient, evaluate Puppeteer or `@react-pdf/renderer` as alternatives. Story 21.11/21.12 are deliberately split so the renderer (HTML) can ship before the PDF generator is finalised.
- **Canonicalisation drift risk:** If canonical-JSON serialisation differs across code paths (e.g., after future model changes), seal hashes become unreproducible. Mitigation: golden-fixture unit test in `lib/compliance-audit/canonicalize.ts`; CI runs the test on every PR; any schema change to cycle entities requires updating the fixture with an explicit migration note.
- **Evidence-file-deletion risk:** An evidence file linked to a sealed cycle can still be deleted from `WorkspaceFile` or `WorkspaceDocument` — the seal hash then references a file that no longer exists. Mitigation: server actions on file/document delete check for references in `ComplianceEvidenceSnapshot` and either (a) block deletion, or (b) soft-delete and retain blob until the oldest referencing cycle is archived. Decision deferred to Architect.
- **Permission-scope leakage risk:** A user gains lead_auditor_user_id on a cycle but loses their workspace role; they should no longer be able to seal. Mitigation: `audit:seal` check combines (role has `audit:seal`) OR (user is cycle's lead_auditor AND still has workspace membership).

**Integration Risks:**

- **Task model contamination:** Auto-spawned corrective-action Tasks could pollute existing task views with cycle-generated entries. Mitigation: Tasks gain a nullable `compliance_finding_id` back-reference; existing task views are unaffected in query but gain an optional badge/filter for "from kontroll".
- **ActivityLog volume:** Per-item bedömning edits are frequent during cycle execution. Mitigation: debounce motivering edits at the UI layer (save on blur or 2s idle, not keystroke); per-item bedömning status change is a low-frequency event and safe to log.
- **SWR cache fragmentation:** Multiple new cache keys. Mitigation: centralise key construction in `lib/swr-keys/compliance-audit.ts` to avoid typos.

**Deployment Risks:**

- **Migration lock-contention on `Task` table:** Adding a nullable column on a large existing table can lock the table briefly. Mitigation: Prisma migration uses standard Postgres `ADD COLUMN NULL` which is online in modern Postgres. No default value backfill needed.
- **Forward-only seal:** A deploy that incorrectly computes seal hashes would silently corrupt new seals. Mitigation: pre-deploy staging run against a seed cycle; verify hash stability across two identical seal runs on the same cycle in staging.

**Mitigation Strategies (summary):** Golden-fixture canonicalisation tests; seal action wrapped in explicit Prisma transaction; all cycle mutations guarded by an `assertCycleEditable()` helper; staging environment seal-verification test in CI; Architect sign-off on HTML→PDF stack choice before Story 21.12 starts.

---

## 5. Epic and Story Structure

### 5.1 Epic Approach

**Epic Structure Decision:** Single epic (Epic 21 — Lagefterlevnadskontroll MVP) for the brownfield enhancement, with stories sized for AI-agent execution (≤1 day each) and sequenced to minimise risk to the existing system. Rationale:

- Phases 1–3 from the brief (cycle lifecycle, findings, seal) form a coherent, atomic feature — none ships independently in a useful form. Splitting across multiple epics would create artificial boundaries.
- Phases 4–6 (AI-assisted bedömning, continuous mode, CSRD/mobile) are substantive new work streams that belong in their own future epics (Epic 22+) because each has distinct user value, distinct technical surface, and distinct go-to-market implications.
- Single-epic framing keeps the PO/SM/Dev handoff tight and gives the customer a single sealable ship-point.

**Integration Strategy:** Additive-only schema, no destructive changes to existing models or UI; cycle routes and components live in their own namespace (`/laglistor/kontroller`, `components/features/compliance-audit/`) and never replace existing surfaces. Every story ends with an Integration Verification step confirming the `/laglistor`, `/laglistor` modal, task system, activity feed, and permission matrix remain fully functional.

---

## 6. Epic 21: Lagefterlevnadskontroll MVP

**Epic Goal:** Deliver a production-ready Lagefterlevnadskontroll module that enables a Swedish customer — ISO-certified or non-certified SMB — to run a complete internal compliance audit cycle end-to-end in Laglig (scope → bedömning → findings → sign-off → complete → optional seal → PDF download) and hand the output to an external certifieringsorgan or keep it as internal statutory documentation, all while fully preserving existing laglistor, kravpunkter, linked-artifacts, task, and activity-log functionality.

**Integration Requirements:** Additive Prisma migration (5 tables + enums + one nullable column on `Task`), new server actions under `app/actions/compliance-audit-*`, new routes under `app/(workspace)/laglistor/kontroller/**`, new components under `components/features/compliance-audit/**`. Reuse of `compliance-detail-table`, `StatusBadge`, `ComplianceStatusEditor`, `LinkedArtifactsPanel`, `Task` model, `ActivityLog`, `hasPermission()`, `withWorkspace()`, existing Swedish-locale date-fns formatting, existing SWR + revalidatePath patterns.

---

### Story 21.1 — Prisma schema foundations for ComplianceAuditCycle

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

### Story 21.2 — Cycle CRUD server actions

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

### Story 21.3 — Scope selection component

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

### Story 21.4 — Cycle creation wizard + materialisation

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

### Story 21.5 — Cycle detail page: item list + inline bedömning editor

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

### Story 21.6 — Cycle lifecycle transitions: Complete

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

### Story 21.7 — Findings: create, edit, close (with type + severity + root cause)

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

### Story 21.8 — Auto-spawn corrective-action Task on AVVIKELSE

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

### Story 21.9 — Seal: hash computation, evidence snapshot, immutability

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

### Story 21.10 — Immutability guard for sealed cycles

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

### Story 21.11 — Revisionsrapport HTML renderer

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

### Story 21.12 — PDF generation + storage + download

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

### Story 21.13 — ActivityLog integration + /workspace/activity surface

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

### Story 21.14 — Permissions: audit:seal scope + AUDITOR read-access threading

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

## Story Sequence and Dependencies

```
21.1 (schema) ─┬─► 21.2 (cycle CRUD) ─► 21.4 (wizard + materialisation) ─► 21.5 (item list + bedömning)
               │                                                              │
               │                                                              ├─► 21.6 (complete) ─► 21.11 (HTML rapport)
               │                                                              │
               ├─► 21.3 (scope selector) ─────────────────────────────────────┘
               │
               └─► 21.7 (findings) ─► 21.8 (task auto-spawn)
                        │
                        └─► 21.9 (seal) ─► 21.10 (immutability guard) ─► 21.12 (PDF)
                                                                            │
                                             21.13 (activity log) ◄─────────┘
                                             21.14 (permissions)  ◄─────────┘
```

Recommended execution order (optimises for incremental value + testability):

1. **21.1** (schema) — foundation
2. **21.2** (cycle CRUD) + **21.3** (scope selector) — parallelisable
3. **21.4** (wizard + materialisation) — integrates 21.2 + 21.3
4. **21.5** (item list + bedömning) — first user-visible value
5. **21.14** (permissions) — easy to land early, unblocks auditor-role tests
6. **21.13** (activity log) — wire in ActivityLog as mutations appear
7. **21.7** (findings) + **21.8** (task auto-spawn) — findings track, sequential
8. **21.6** (complete) — requires item flow working
9. **21.11** (HTML renderer) — builds on complete
10. **21.9** (seal) + **21.10** (immutability guard) — sealed cycle + safety net, sequential and paired
11. **21.12** (PDF) — last, depends on HTML renderer + seal decided; requires Architect input on stack choice before start

**Estimated elapsed: 8–12 weeks** at one full-stack developer with standard review/QA gates.

---

## Pre-Story Decisions Required from Architect

Before Story 21.12 (PDF) and Story 21.9 (seal) begin, the Architect addendum must resolve:

1. **HTML→PDF stack**: existing Laglig pipeline or new (Puppeteer / `@react-pdf/renderer`)?
2. **Canonical-JSON library**: use `json-canonicalize` (RFC 8785) or hand-rolled? Recommendation: RFC 8785 compliant.
3. **Evidence-file-deletion policy**: block deletion while referenced by any `ComplianceEvidenceSnapshot`? Soft-delete with retention? This is the biggest open operational question.
4. **Seal reversal**: strongly recommended "never" — reversal requires new cycle. Confirm or flag alternative.
5. **PDF storage location**: reuse existing WorkspaceFile storage (S3/Supabase Storage)? Or dedicated bucket for audit artefacts?

---

## Next Steps

### Immediate Actions

1. **Architect** (`/architect`) reviews this PRD's sections 4 (Technical Constraints) and the Pre-Story Decisions list; produces architecture addendum at `docs/architecture/epic-21-lagefterlevnadskontroll.md`.
2. **PO** (`/po`) runs the `pm-checklist` against this PRD + the brief + architecture addendum; flags alignment issues.
3. **`*shard-prd`** (me or PO): shards this PRD into `docs/prd/epic-21-lagefterlevnadskontroll.md` + support shards as needed, integrating into the existing `docs/prd/` structure.
4. **SM** (`/sm`) drafts Stories 21.1 → 21.14 one at a time in `docs/stories/`, per existing convention.
5. **Dev** (`/dev`) implements story-by-story with QA gates (`/qa`) between.

### Open Items to Track Through to GA

- Customer validation: 2–3 KMA-samordnare interviews before GA to verify the scope-selection UX, findings taxonomy, and PDF tone.
- Marketing-claim legal review: "tamper-evident" is defensible with SHA-256 + immutable ActivityLog; ensure no overclaiming to "tamper-proof" or "blockchain-anchored".
- Pricing-tier configuration: Phases 1–3 ship in SMB tier (~10 kSEK/år); Phases 4+ remain premium tier (~50 kSEK/år). Sales packaging deferred.
