# Epic 7: HR Module — Employee Data Model & Kollektivavtal Intelligence (DETAILED)

> **Rewritten 2026-07-01.** This epic supersedes the original MVP-era 12-story HR vision. It is re-scoped to two concrete, high-value outcomes: (A) a Fortnox-grounded **Employee data model** and (B) **kollektivavtal ingestion into the existing RAG** so the AI can reason over *employee facts × LAS × the company's own collective agreement*. The prior story set (photo upload, @mentions, draggable cards, CSV fuzzy-match, auto law-assignment, etc.) is deferred to a post-epic HR backlog and is **out of scope** here.

**Goal:** Give companies a centralized, compliance-focused employee register modeled on Fortnox, and let them upload their own kollektivavtal so the AI can answer highly personalized, employee-specific compliance questions grounded in the **full law & regulation corpus** (LAS is just one example — also Semesterlagen, Arbetstidslagen, relevant AFS-föreskrifter, etc.) **and** the company's collective agreement.

**Value Delivered:**
- A structured employee register that mirrors the mental model HR users already know from Fortnox (Personalregister + Personalkort), holding only the fields that carry **compliance / LAS value** (not accounting).
- Company-specific kollektivavtal embedded alongside legal content, so AI answers combine three grounded sources — the employee's own data, the law (e.g. LAS, Semesterlagen, Arbetstidslagen), and the applicable collective agreement.
- Forward-compatibility with a future one-click Fortnox sync (schema is Fortnox-mappable; `fortnox_id` reserved).

---

## Existing System Context (what we build on — do not rebuild)

| Capability | Already exists | Location |
|---|---|---|
| Multi-tenancy + auth | `withWorkspace(cb, permission)`, `getWorkspaceContext()`, workspace-scoped queries | `lib/auth/workspace-context.ts` |
| **HR permissions** | `employees:view`, `employees:manage` already defined; `HR_MANAGER` role already holds them | `lib/auth/permissions.ts` |
| Company context | `CompanyProfile.has_collective_agreement`, `collective_agreement_name`, `workforce_composition`, `employee_count_range` | `prisma/schema.prisma` |
| **RAG retrieval** | `retrieveContext(query, workspaceId, { source/content-type filters })` — pgvector HNSW → Cohere rerank | `lib/agent/retrieval.ts` |
| **Chunk store** | `ContentChunk` (`source_type`, `source_id`, `workspace_id`, `embedding vector(1536)`); `SourceType` enum = `LEGAL_DOCUMENT \| USER_FILE \| CONVERSATION \| ASSESSMENT` | `prisma/schema.prisma` |
| Chunking / embedding | `chunkDocument()`, `embedChunks()` (OpenAI `text-embedding-3-small`) | `lib/chunks/chunk-document.ts`, `lib/chunks/embed-chunks.ts` |
| **Upload → extract → chunk** | `WorkspaceFile` + Supabase Storage (`workspace-files` bucket) + `extract-files` cron → markdown → chunk pipeline; `AVTAL` file category exists | `app/actions/files.ts`, `app/api/cron/extract-files/route.ts`, `lib/supabase/storage.ts` |
| Settings surface | Tabbed settings with Company Profile tab | `app/(workspace)/settings/page.tsx`, `components/features/settings/settings-tabs.tsx` |
| **Fortnox schema reference** | Full Employee schema + exact enum codes, from Fortnox `openapi.json` | `docs/reference/fortnox-employee-schema-analysis.md` |

**The only net-new persistence is the `Employee` model** (+ a `COLLECTIVE_AGREEMENT` source type and a kollektivavtal ↔ employee assignment). Everything else is composition of existing infra.

---

## Enhancement Details

- **What's added:** `Employee` model (Fortnox-mapped, compliance subset), a Personalregister list + Personalkort profile UI, a kollektivavtal upload+manage surface in Settings, ingestion of kollektivavtal into the existing RAG under a new `COLLECTIVE_AGREEMENT` source type, and employee-context-aware AI answers with source-distinguished citations.
- **How it integrates:** Kollektivavtal uploads reuse `WorkspaceFile` → `extract-files` cron → chunk/embed, writing `ContentChunk` rows with `source_type = COLLECTIVE_AGREEMENT` and the uploading `workspace_id`. Retrieval already filters by `workspace_id` and source type, so agreements are workspace-isolated and citations can label "Kollektivavtal" vs "Lag". Employee structured facts are injected into the agent prompt as a compact context block.
- **Success criteria:**
  1. An HR user can create/edit an employee via a Fortnox-style Personalkort covering the compliance field set below.
  2. An HR user can upload a kollektivavtal PDF from Settings; within one extraction cycle it is chunked, embedded, and queryable.
  3. The AI can answer an employee-specific question (e.g. *"Vilken uppsägningstid har Anna enligt LAS och vårt kollektivavtal?"*) citing **both** the law and the company's kollektivavtal, using Anna's actual employment form and start date.

---

## Data Model — `Employee` (Fortnox-native, compliance subset)

Fields chosen for **LAS / labour-law value**; accounting/payroll fields from Fortnox are deliberately excluded (no accounting ties). **Source of truth for field names, types, and enum codes: `docs/reference/fortnox-employee-schema-analysis.md`** (reverse-engineered from Fortnox's `openapi.json`, schema lines 5688–6204).

**Design principle for easy future sync (per the "easily integrated" requirement):**
1. **Enum values ARE the Fortnox codes verbatim** (`TV`, `TJM`, `MAN`, …). Sync becomes an identity map — no lossy translation, no round-trip drift. UI maps code → Swedish label (`TV` → "Tillsvidareanställning"); the DB never guesses.
2. **Column names mirror Fortnox property names** (snake_cased). A future `lib/integrations/fortnox/employee-mapper.ts` is then a thin, near-mechanical adapter (see Story 7.8).
3. **Required fields stay lenient** — matching Fortnox's *only* required trio (Email, FirstName, LastName is Fortnox-required; we make even those optional except name) so a bulk Fortnox import never rejects a row. Missing LAS-critical data surfaces as "Ej komplett" (Story 7.4), not a hard DB constraint.
4. **Sync metadata reserved now** (`fortnox_employee_id`, `fortnox_synced_at`, `fortnox_raw` snapshot, `fortnox_sync_status`) so the integration is additive, not a migration.

```prisma
model Employee {
  id                String          @id @default(uuid())
  workspace_id      String
  created_by        String

  // --- Fortnox: Personal & Contact (Personalinformation) ---
  employee_id_ref   String?         // Fortnox EmployeeId (Anställnings-ID, 1–15 chars, unique/company)
  personnummer      String?         // Fortnox PersonalIdentityNumber — ENCRYPTED AT REST (Fortnox-optional)
  first_name        String          // FirstName  (Fortnox-required)
  last_name         String          // LastName   (Fortnox-required)
  email             String?         // Email      (Fortnox-required for sync-OUT — flagged in completeness)
  phone1            String?         // Phone1
  phone2            String?         // Phone2
  address1          String?         // Address1
  address2          String?         // Address2
  post_code         String?         // PostCode
  city              String?         // City
  country           String?         @default("SE") // Country
  job_title         String?         // JobTitle (max 30 chars)

  // --- Fortnox: Employment (Anställning) — LAS core ---
  employment_date   DateTime?       // EmploymentDate (Anställningsdatum)
  employed_to       DateTime?       // EmployedTo (Slutdatum, visstid)
  employment_form   EmploymentForm? // EmploymentForm — LAS §4–5, §5a
  personel_type     PersonelType?   // PersonelType (Fortnox spelling; Tjänsteman/Arbetare)
  inactive          Boolean         @default(false) // Fortnox Inactive (Aktiv/Inaktiv)

  // --- Fortnox: Schedule / working time ---
  full_time_equivalent Decimal?     @db.Decimal(4,3) // FullTimeEquivalent (0–1; 1.0 = 100%, sysselsättningsgrad)
  average_weekly_hours Decimal?     @db.Decimal(5,2) // AverageWeeklyHours
  schedule_id       String?         // ScheduleId (opaque Fortnox ref; stored for sync fidelity)

  // --- Fortnox: Salary form (Löneuppgifter — form only, no amounts) ---
  salary_form       SalaryForm?     // SalaryForm (Månadslön/Timlön)

  // --- Fortnox: Vacation (Semester — headline only; full ledger stays in Fortnox) ---
  vacation_days_paid Decimal?       @db.Decimal(5,2) // VacationDaysPaid (Semesterlagen headline)

  // --- Kollektivavtal assignment + org grouping (laglig-native) ---
  collective_agreement_id String?   // FK → CollectiveAgreement
  group_id          String?         // FK → EmployeeGroup (enhet/avdelning: Lager, Huvudkontor, HR…). Laglig-native, NOT Fortnox-synced (Fortnox uses CostCenter/Project).
  manager_id        String?         // laglig-native self-relation (Chef)

  // --- Fortnox sync metadata (reserved; null until integration) ---
  fortnox_employee_id String?       // Fortnox internal id once synced
  fortnox_synced_at   DateTime?
  fortnox_sync_status FortnoxSyncStatus @default(NOT_LINKED)
  fortnox_raw         Json?          // last raw Fortnox payload (audit / conflict resolution)

  created_at        DateTime        @default(now())
  updated_at        DateTime        @updatedAt

  @@unique([workspace_id, fortnox_employee_id])
  @@index([workspace_id])
  @@index([workspace_id, inactive])
}

// Enum members ARE the Fortnox codes (identity-mappable). UI supplies Swedish labels.
enum EmploymentForm { TV PRO TID SVT VIK PRJ PRA FER SES NEJ }
// TV=Tillsvidare PRO=Prov TID=Tidsbegränsad SVT=Säsong VIK=Vikariat
// PRJ=Projekt PRA=Praktik FER=Feriearbete SES=Session NEJ=Ingen
enum PersonelType   { TJM ARB }        // TJM=Tjänsteman, ARB=Arbetare
enum SalaryForm     { MAN TIM }        // MAN=Månadslön, TIM=Timlön
enum FortnoxSyncStatus { NOT_LINKED LINKED SYNCING CONFLICT ERROR }

// Org grouping — mirrors the law-list group model so DocumentListTable's group API works unchanged.
// Laglig-native; NOT Fortnox-synced. Replaces the earlier free-text `department`.
model EmployeeGroup {
  id           String     @id @default(uuid())
  workspace_id String
  name         String     // "Lager", "Huvudkontor", "HR"…
  position     Int        @default(0) // ordering of group headers
  created_at   DateTime   @default(now())
  employees    Employee[]

  @@unique([workspace_id, name])
  @@index([workspace_id])
}
```

**Explicitly excluded (Fortnox has them; no compliance value / accounting-only):** ClearingNo, BankAccountNo, all tax fields (TaxTable, TaxColumn, TaxAllowance, NonRecurringTax, AutoNonRecurringTax, PreliminaryTaxDeducted), ForaType, CostCenter, Project, the full multi-year vacation ledger (`VacationDaysPending*`, `VacationDaysRegistered*`, `*SavedYear1-6Plus`, flex/comp/ATF/ATK balances), MonthlySalary/HourlyPay amounts, DatedWages/DatedSchedules/OpeningSalaries history, EmployeeChildren. Rationale: payroll/accounting, or granular ledgers that remain Fortnox's system-of-record. `fortnox_raw` preserves anything we drop, so a future sync can still round-trip without schema changes.

---

## Stories

### Part A — Employee Data Model & Register

#### Story 7.1: Employee schema, encryption & migration
**As a** developer, **I want** a Fortnox-mapped `Employee` model with an encrypted personnummer, **so that** the register has a compliant, sync-ready foundation.

**Acceptance Criteria:**
1. `Employee` model + `EmploymentForm` / `PersonelType` / `SalaryForm` / `FortnoxSyncStatus` enums added exactly per the data model above (enum members = Fortnox codes; column names mirror Fortnox properties); migration authored (hand-off to user to run — migrations are applied manually).
2. `personnummer` encrypted at rest (application-level encryption consistent with existing sensitive-field handling); never returned in plaintext to non-authorized roles; nullable so Fortnox imports with a missing PersonalIdentityNumber don't fail.
3. `manager_id` self-relation and `workspace_id` scoping in place; all queries go through `withWorkspace`; `@@unique([workspace_id, fortnox_employee_id])` enforced.
4. `CollectiveAgreement` model added (name, `personel_type` target, `workspace_file_id` FK, uploaded_by, status) with `Employee.collective_agreement_id` FK.
5. `EmployeeGroup` model added (workspace-scoped, `name`, `position`) with `Employee.group_id` FK — the org-unit grouping (Lager/Huvudkontor/HR); laglig-native, not Fortnox-synced. **Replaces the free-text `department` field.**
6. Unit coverage for encryption round-trip and workspace isolation.
7. Field/enum choices validated against `docs/reference/fortnox-employee-schema-analysis.md`.

#### Story 7.2: Personalregister — employee list view
**As an** HR manager, **I want** a personnel register list mirroring Fortnox, **so that** I can see and manage all employees at a glance.
**Acceptance Criteria:**
1. Route `/hr/employees` (or workspace-nav equivalent), gated by `employees:view`.
2. **Page header reuses the canonical `PageHeader`** (`components/ui/page-header.tsx`) exactly as the Laglistor page does (`app/(workspace)/laglistor/page.tsx`) — `title="Personalregister"`, `subtitle`, optional `stats` (e.g. "8/11 kompletta"). **Do not build a new header.**
2a. **`primaryAction` = a black "+ Lägg till anställd" button**, styled and positioned identically to Laglistor's "Lägg till dokument" (mirror the `LawListPrimaryAction` component). Clicking it opens the employee **creation modal** (7.3 in create mode).
3. **Table reuses the canonical `DocumentListTable` pattern** (`components/features/document-list/document-list-table.tsx`) — the same TanStack-based table primitive used by Laglistor (column visibility/sizing/order, inline cell editors, empty-state, row-click, load-more). **Do not introduce a new table component or migrate to a plain shadcn table.** Employee-specific columns are configured through the existing column API, not a fork.
4. Columns: Anställnings-ID, Anställd (namn), Personnummer (masked unless `employees:manage`), Personaltyp, Anställningsform, Löneform, Kollektivavtal, Status.
5. Status filter tabs: **Alla / Aktiva / Ej kompletta / Inaktiva** (mirrors Fortnox).
6. Search by name / personnummer / anställnings-ID.
7. Row click opens the Personalkort modal (7.3); "Lägg till anställd" (header `primaryAction`) opens the same modal in create mode.
8. **Grouping by org unit reuses `DocumentListTable`'s existing group API** — pass `groups` (from `EmployeeGroup`) and wire `onMoveToGroup(employeeId, groupId)` so rows render under collapsible group headers (Lager / Huvudkontor / HR…) and can be **dragged between groups** ("Dra till grupprubriker för att flytta"), exactly as Laglistor does. **Do not build a new grouping mechanism.**
9. Create / rename / reorder / delete groups uses the same `GroupEditor` affordance as the law list; deleting a group leaves its employees ungrouped (does not delete them).
10. Group headers may show a per-group completeness rollup (e.g. "Lager 4/6 kompletta").

> **Reuse note (do not build the wrong components):** header = `PageHeader`, table = `DocumentListTable` (incl. its `groups`/`onMoveToGroup`/`GroupEditor` API). Both are already the established primitives on the Laglistor page; the employee register is a new *configuration* of them, not new UI plumbing.

#### Story 7.3: Personalkort — create & edit employee (tabbed **modal**)
**As an** HR manager, **I want** the employee card to open as a tabbed modal like the law-list-item detail, **so that** it feels consistent with the rest of the app and I never leave the register.
**Acceptance Criteria:**
1. Personalkort is a **modal, not a page route** — reuse the canonical `SplitPanelModal` shell (`components/shared/split-panel-modal/index.tsx`), the same primitive behind the law-list-item modal (`components/features/document-list/legal-document-modal/`). **Do not build a new dialog.**
2. Opened via URL param (e.g. `?anstalld=<id>` using History API for instant feedback, exactly as `LegalDocumentModal` uses `?document=`), from a row click (7.2) or the "Lägg till anställd" action; closed by removing the param.
3. **Tabs on top** using the shared `Tabs` primitive (`components/ui/tabs.tsx`), mirroring the modal's existing `ActivityTabs` usage — tabs (compliance subset only): **Personalinformation**, **Anställning**, **Semester**. (No Skatt/ATK/Ingående Saldo tabs.) Rendered in the modal's `leftPanel`.
4. The modal's **`rightPanel` = compliance summary sidebar**: current Status (Aktiv/Inaktiv), assigned Kollektivavtal, and the "Ej komplett" reasons (from 7.4) — reusing the right-panel/details-box convention. (AI chat panel / `renderChat` optional; if wired, it is the employee-aware chat from 7.7.)
5. Gated by `employees:manage` for edit / create; `employees:view` may open read-only.
6. Required for a "complete" record: förnamn, efternamn, personnummer, anställningsdatum, anställningsform, personel_type. Others optional (nothing blocks save except surname/first name).
7. Personnummer validated (Swedish format + Luhn) when present; inline validation errors.
8. Save via `employees.ts` server action under `withWorkspace(..., 'employees:manage')`; optimistic list update via a lifted `onEmployeeChange` callback (same pattern as the law-list modal); audit-friendly `updated_at`/`created_by`.
9. Manager field is a dropdown of existing active employees.
10. **Kollektivavtal assignment is available in the modal in both create and edit mode** — a select of the workspace's uploaded agreements (from 7.5/7.6), so a brand-new employee can be linked to a kollektivavtal at creation time. If none uploaded yet, the field offers an inline "Ladda upp kollektivavtal" affordance (the shared 7.5 upload component). Writes `Employee.collective_agreement_id`.
11. Create mode is the same modal opened with no `id` (empty form); Save creates the record and (optimistically) inserts the new row into the register.

> **Reuse note:** modal shell = `SplitPanelModal`; tabs = `components/ui/tabs.tsx`; open/close = `?anstalld` URL param via History API. Mirror `LegalDocumentModal`, don't reinvent it. The header "+ Lägg till anställd" (7.2) opens this same modal in create mode.

#### Story 7.4: Completeness / "Ej komplett" status
**As an** HR manager, **I want** incomplete records flagged, **so that** I know which employees lack LAS-critical data.
**Acceptance Criteria:**
1. An employee is "Ej komplett" if any LAS-critical field is missing (personnummer, anställningsdatum, anställningsform, personaltyp) or no kollektivavtal assigned when `CompanyProfile.has_collective_agreement = true`.
2. "Ej kompletta" filter tab surfaces exactly these.
3. Per-record reasons listed on the Personalkort (e.g. "Saknar anställningsform", "Inget kollektivavtal tilldelat").
4. Register header shows a summary count (e.g. "8/11 kompletta").

### Part B — Kollektivavtal Intelligence (RAG)

#### Story 7.5: Upload kollektivavtal (from Settings **and** the HR area) + ingest into RAG
**As an** HR manager, **I want** to upload our kollektivavtal from either Settings or the HR/employee area, **so that** I can add it wherever I happen to be and the AI can reason over it.
**Acceptance Criteria:**
1. **Two entry points, one shared component:** the upload/management UI is reachable both from a **Kollektivavtal** section in Settings (own tab, or within Company Profile tab) **and** from within the HR/employee area (e.g. a "Kollektivavtal" action/section on the Personalregister and/or the Personalkort compliance sidebar). Both surfaces mount the **same** upload/manage component and server action — no duplicated logic. Gated by `employees:manage`.
2. Upload PDF (reuse `uploadFile` / `WorkspaceFile`, category `AVTAL`, max 25 MB) with fields: Namn (e.g. "Byggnads Kollektivavtal 2024"), Typ (Arbetare / Tjänstemän / Övrigt), effective period (optional).
3. `SourceType` enum extended with `COLLECTIVE_AGREEMENT`; the extract→chunk→embed pipeline writes `ContentChunk` rows with `source_type = COLLECTIVE_AGREEMENT`, `source_id = <CollectiveAgreement.id>`, and `workspace_id` set (workspace-isolated).
4. Ingestion status surfaced to the user (Pending → Processing → Klart/Failed), reusing `FileExtractionStatus`.
5. Chunks carry a `contextual_header` identifying the agreement + section so citations are meaningful.

#### Story 7.6: Manage & assign kollektivavtal
**As an** HR manager, **I want** to manage uploaded agreements and assign them to employees, **so that** the right agreement applies to each person.
**Acceptance Criteria:**
1. List of uploaded agreements: Namn, Typ, Uppladdad, Status, antal tilldelade anställda.
2. Assign to employees individually **and** in bulk — by **Personaltyp** (e.g. the Arbetare agreement to all `personel_type = ARB`, mirroring Fortnox "Avtal för löner") **and** by **EmployeeGroup** (e.g. the whole "Lager" enhet).
3. Delete an agreement (confirmation) → unassigns from employees **and** removes its `ContentChunk` rows so it is no longer retrievable.
4. `CompanyProfile.has_collective_agreement` / `collective_agreement_name` kept in sync on first upload.

#### Story 7.7: Employee-aware, corpus-grounded AI answers with source-distinguished citations
**As a** user, **I want** the AI to answer employee-specific questions grounded in the **full law & regulation corpus** plus any of our kollektivavtal, **so that** I get accurate, personalized compliance guidance — not just for LAS but for whatever law or föreskrift applies.
**Acceptance Criteria:**
1. A user can bring an employee into chat context (context pill / selector; drag optional, not required), gated so only `employees:view` roles can.
2. The agent receives a compact structured employee block (anställningsform, anställningsdatum, personel_type, sysselsättningsgrad, assigned kollektivavtal) — **not** the personnummer.
3. **Retrieval spans the entire relevant legal corpus** — all `LEGAL_DOCUMENT` chunks (SFS laws, myndighetsföreskrifter, rättsfall, EU-material — whatever the corpus contains, **not** an LAS-only carve-out) **and** the workspace's `COLLECTIVE_AGREEMENT` chunks — via the existing `retrieveContext(query, workspaceId, …)` with no source restriction beyond workspace isolation. The model selects which laws/regulations are relevant from retrieval; nothing is hardcoded to LAS.
4. Citations visually distinguish **Lag/Föreskrift** vs **Kollektivavtal** vs **Egen fil**, and name the specific instrument retrieved (e.g. "Arbetstidslagen §13", "Semesterlagen §4", "AFS 2015:4").
5. Reference queries pass across **different legal areas**, e.g.:
   - *"Vilken uppsägningstid gäller för {employee} enligt lag och vårt kollektivavtal?"* → cites LAS + the agreement clause, using the employee's actual employment form/date.
   - *"Har {employee} rätt till fler semesterdagar än lagen kräver enligt vårt avtal?"* → cites Semesterlagen + the agreement.
   - A working-time question → cites Arbetstidslagen (and any relevant AFS) + the agreement.
   Each answer is grounded in retrieved passages, not model priors.
6. Grounding eval (reuse Story 19.13 harness) confirms answers are corpus-grounded and confirms **no cross-workspace agreement leakage**.

### Part C — Fortnox Integration Readiness

#### Story 7.8: Fortnox mapping layer & sync scaffolding (no live sync)
**As a** product owner, **I want** the employee model wired for a clean future Fortnox sync, **so that** enabling the integration later is an adapter + OAuth job, not a redesign.
**Acceptance Criteria:**
1. **Mapping adapter** `lib/integrations/fortnox/employee-mapper.ts` with pure, unit-tested functions `toFortnox(employee): FortnoxEmployee` and `fromFortnox(payload): EmployeeInput`. Because our enums are the Fortnox codes, enum mapping is identity; the adapter only handles field-name casing, date formats, and the `country` default.
2. A typed `FortnoxEmployee` interface generated/copied from `docs/reference/fortnox-employee-schema-analysis.md`; a doc comment links each of our columns to its Fortnox property (single source of truth for the mapping).
3. `fromFortnox` tolerates a **partial/minimal Fortnox record** (only Email/FirstName/LastName present) without throwing, populating what it can and leaving the rest null (→ "Ej komplett").
4. Round-trip test: `toFortnox(fromFortnox(sample)) ≈ sample` for the fields we retain; unretained fields preserved via `fortnox_raw`.
5. `fortnox_employee_id` uniqueness per workspace enforced (schema `@@unique`), and `fortnox_sync_status` transitions documented (`NOT_LINKED → LINKED → SYNCING → CONFLICT/ERROR`).
6. **No OAuth, no network calls, no UI** in this epic — infrastructure only. A short `docs/reference/fortnox-integration-plan.md` records the deferred pieces (OAuth flow, conflict-resolution policy, sync direction, rate limits).

---

## Compatibility Requirements
- [ ] `SourceType` enum extension is additive; existing `LEGAL_DOCUMENT` / `USER_FILE` retrieval unaffected.
- [ ] New `Employee` / `CollectiveAgreement` tables; no changes to existing table columns → backward compatible.
- [ ] Reuses `withWorkspace`, existing permissions (`employees:*`), `WorkspaceFile` upload + `extract-files` cron, and `retrieveContext` — no new primitives.
- [ ] UI follows canonical `DocumentListTable` and existing settings-tab patterns.
- [ ] RAG performance: kollektivavtal chunks share the existing HNSW index; retrieval top-K/rerank unchanged.

## Risk Mitigation
- **Primary Risk:** PII exposure (personnummer) and cross-workspace kollektivavtal leakage in RAG.
- **Mitigation:** Application-level encryption for personnummer + role-gated masking; every `ContentChunk` for an agreement carries `workspace_id`, and `retrieveContext` already filters `workspace_id IS NULL OR = :workspaceId`; add an explicit isolation test (7.7 AC6). Personnummer never enters the agent prompt.
- **Rollback Plan:** New tables/enum value are additive and independently droppable; feature reachable only via new routes/tab, so removing nav entries + reverting the migration fully disables the module with no impact on existing features.

## Definition of Done
- [ ] All 8 stories completed with ACs met.
- [ ] Employee CRUD + completeness statuses working and workspace-isolated.
- [ ] Kollektivavtal upload → chunk/embed → retrievable within one extraction cycle.
- [ ] AI answers reference employee questions across ≥2 legal areas, each citing the relevant law/föreskrift **and** kollektivavtal, with source-distinguished citations.
- [ ] Cross-workspace isolation test passes; personnummer encryption verified.
- [ ] Fortnox mapping adapter unit-tested (round-trip); enum codes match `fortnox-employee-schema-analysis.md`; `fortnox-integration-plan.md` written.
- [ ] Migration handed to user to run (not applied automatically).
- [ ] `docs/prd/index.md` epic-7 line + `epic-list.md` status updated.

---

## Story Manager Handoff

"Please develop detailed dev-ready stories for this brownfield epic. Key considerations:
- Stack: Next.js App Router, Prisma/PostgreSQL + pgvector, Supabase Storage, OpenAI embeddings, Cohere rerank.
- Integration points: `withWorkspace`/`employees:*` permissions, `WorkspaceFile` + `extract-files` cron, `ContentChunk` + `retrieveContext`, canonical `DocumentListTable`, settings-tabs.
- Existing patterns to follow: workspace-scoped server actions in `app/actions/`, additive `SourceType` enum, encryption approach for sensitive fields.
- Fortnox fidelity: enum members must equal Fortnox codes; column names mirror Fortnox properties; **`docs/reference/fortnox-employee-schema-analysis.md` is the single source of truth** for the schema and codes.
- Critical compatibility: additive schema only; RAG workspace isolation is mandatory; personnummer never reaches the agent prompt; migrations handed to the user to run.
- Each story must verify existing document RAG and file upload remain intact."

---

**Epic 7 (re-scoped): 8 stories — ~2.5–3 weeks. Deferred to HR backlog:** photo upload, @mention notes, draggable-card polish, CSV fuzzy import, auto law-assignment, offboarding workflow, employee-law Kanban linking. **Deferred within Fortnox track:** live OAuth sync, conflict resolution, scheduled sync jobs (scaffolded by Story 7.8, not activated).
