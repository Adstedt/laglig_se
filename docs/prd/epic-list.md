# Epic List

## Epic 1: Foundation & Core Infrastructure

**Status:** Done (10 stories completed)

**Goal:** Establish project foundation while delivering initial 100 public law pages to validate SEO strategy.

**Delivers:** Next.js app, database, auth, CI/CD, 100 law pages, monitoring, security

**Requirements covered:** NFR1, FR29, NFR6, NFR13, NFR22, NFR23

---

## Epic 2: Legal Content Foundation

**Status:** Done (14 stories completed, 12 in backlog for future expansion)

**Goal:** Build comprehensive multi-source legal content database with 170,000+ public SEO-optimized pages covering Swedish laws, court precedent, and EU legislation. Provide category structure, search/discovery features, and begin recording law change history.

**Delivers:** 170,000+ legal content pages (SFS laws, court cases from HD/HovR/HFD/MÖD/MIG, EU regulations/directives), multi-content-type search, cross-document navigation, change history recording (no UI yet)

**Requirements covered:** FR1, FR4, FR8, FR24, FR35, FR36, FR37, NFR1

## **Note:** Expanded from single-source (SFS laws only) to multi-content-type architecture based on competitive analysis. Court cases and EU legislation critical for SEO coverage.

## Epic 3: RAG-Powered AI Chat Interface

**Status:** Partial (6 completed incl. Story 3.15 per-user chat-history scoping, 4 backlog — drag-and-drop context building deferred; core chat superseded by Epic 14)

**Goal:** Implement zero-hallucination AI chatbot with drag-and-drop context building and citation-first responses.

**Delivers:** Vector database, AI chat UI, drag-and-drop, RAG responses, streaming, citations, per-user chat-history scoping (Story 3.15)

**Requirements covered:** FR4, FR5, FR6, NFR2, NFR3, NFR9, NFR20, NFR24

---

## Epic 4: Dynamic Onboarding & Personalized Law Lists

**Status:** Done (11 completed, 1 backlog)

**Goal:** Create conversion engine that transforms homepage visitors into trial users through AI-driven conversational onboarding, dynamic questioning, and two-phase comprehensive law list generation (60-80 laws).

**Delivers:** Onboarding widget, Bolagsverket integration, dynamic contextual questioning (3-5 AI-selected questions), two-phase streaming generation (Phase 1: 15-30 laws pre-signup, Phase 2: 45-65 laws post-signup background), trial signup, email verification

**Requirements covered:** FR2, FR3, FR21, FR23, FR30, NFR4, NFR5

---

## Epic 5: Workspace Management & Team Collaboration

**Status:** Partial (5 completed, 1 backlog — Stripe billing, usage limits, team invites not started)

**Goal:** Enable multi-user workspaces with subscription tiers, team invites, role-based access, and billing integration.

**Delivers:** Multi-tenancy, roles, invites, tiers, Stripe, usage tracking, workspace settings

**Requirements covered:** FR17, FR18, FR19, FR20, FR22, FR32, FR33, FR34, NFR18

---

## Epic 6: Compliance Workspace (Kanban + Dashboard)

**Status:** Done (22 completed, 1 backlog — significantly exceeded original estimate)

**Goal:** Provide Jira-inspired Kanban board for visual compliance tracking and summary dashboard.

**Delivers:** Dashboard, Kanban, drag-and-drop cards, law card modal, task management

**Requirements covered:** FR7, FR27, FR28, FR25

---

## Epic 7: HR Module (Employee Management)

**Status:** Not Started (0 completed, 12 in backlog)

**Goal:** Connect employees to laws for context-aware HR compliance, improving AI chatbot value.

**Delivers:** Employee CRUD, CSV import, compliance status, kollektivavtal, drag to chat

**Requirements covered:** FR13, FR14, FR15, FR16, FR41, NFR4

---

## Epic 8: Change Monitoring & Notification System

**Status:** Done (12 completed, 6 backlog — core pipeline operational, optimization and digests remaining)

**Goal:** Implement retention engine that automatically detects law changes and notifies users.

**Delivers:** Change detection, AI summaries, email/in-app notifications, diff view, reminders, weekly digest, timeline

**Requirements covered:** FR8, FR9, FR10, FR11, FR12, FR38, FR39, FR40, NFR10, NFR11, NFR26

---

## Epic 9: Legal Intelligence & AI Enrichment

**Status:** Partial (4 completed, 1 backlog — agency regulation ingestion done, parliamentary context deferred)

**Goal:** Enrich raw legal content with AI-generated contextual analysis using parliamentary documents (propositions, committee reports) to provide genuine legal insight beyond raw text.

**Delivers:** AI-generated legal comments with parliamentary context, proposition summaries, cross-references to preparatory works, "why did this change?" explanations

**Requirements covered:** FR4 (enhanced), NFR9, NFR24

---

## Epic 10: Workspace Onboarding & Invitation Flow

**Status:** Done (3/3 completed)

**Goal:** Fix broken new-user experience (crash on first login due to missing workspace) by implementing a multi-step workspace creation wizard and invitation acceptance flow, ensuring every authenticated user has a clear path to a functional workspace.

**Delivers:** Post-auth workspace guard with redirect to onboarding, multi-step workspace creation wizard (company info aligned to Bolagsverket data model, review & confirm), WorkspaceInvitation model with token-based acceptance flow for invited users

**Requirements covered:** FR17 (workspace creation), FR18 (team invites - acceptance side), FR20 (onboarding)

**Note:** Brownfield enhancement. Tier selection, Stripe billing, Bolagsverket API lookup, and law list generator step explicitly deferred. All new workspaces start as TRIAL. Wizard architecture supports future step insertion (law list generator). Story 5.3 (Team Invite System) depends on the invitation model created here.

**Priority:** Critical - blocks all new-user access to the platform.

---

## Epic 11: Admin Backoffice

**Status:** Done (7/7 completed)

**Goal:** Provide an internal admin backoffice at `/admin` for the Laglig team to monitor the platform, manage customers and subscriptions, debug issues via user impersonation, and operate/monitor cron jobs with detailed execution logs.

**Delivers:** Admin auth, admin shell layout, customer overview dashboard, workspace/user management, user impersonation with audit trail, cron job dashboard, job execution log persistence

**Note:** Brownfield enhancement. Internal tooling, not user-facing. Separate admin auth via `ADMIN_EMAILS` env var.

---

## Epic 12: Law List Templates & Standard Regulatory Packages

**Status:** Done (12 completed, 2 backlog)

**Goal:** Create a curated library of expert-quality law list templates that serve as both a browsable product catalog for users and the structured foundation for AI-assisted law list generation. Phase 1: 3 gold-standard domains (Arbetsmiljö, Arb. tjänsteföretag, Miljö) with 265 documents.

**Delivers:** Template data model (LawListTemplate, TemplateSection, TemplateItem), ~130 agency regulation stub records, AI-generated compliance summaries and expert commentary, admin template management UI, authenticated template catalog with browse/preview/adopt, refactored AI onboarding drawing from templates

**Requirements covered:** FR2 (enhanced), FR3 (enhanced), FR4 (enhanced)

**Note:** Derived from Notisum competitive analysis (data/notisum-amnesfokus/analysis/). Stub records for agency regulations (AFS, BFS, NFS, etc.) unblock templates; full ingestion deferred to Epic 9. Tjänsteföretag variants modeled as filtered views. Depends on Epic 11 for admin shell.

**Priority:** High - core product differentiator, enables conversion and content quality improvements.

---

## Epic 13: ELI Structured Data & Legislation Interoperability

**Status:** Not Started (no stories scoped yet)

**Goal:** Adopt the European Legislation Identifier (ELI) standard across all public document pages to enhance SEO with rich structured data, provide machine-readable ELI URIs for European interoperability, and enable automated legislation discovery via sitemaps and Atom feeds.

**Delivers:** Enhanced JSON-LD with ELI ontology properties on all 4 document page types, ELI-compliant URI routes with HTTP 303 redirects, legislation-specific sitemaps and Atom feeds (Pillar 4)

**Note:** Brownfield enhancement. Sweden has not officially implemented ELI — Laglig.se would be the first Swedish legal information source with ELI compliance. Three of four public page types already have basic schema.org JSON-LD; this epic enhances and extends it. No database schema changes required. See `docs/stories/backlog/epic-eli-structured-data.md` for full epic.

---

## Epic 14: Compliance Agent

**Status:** Core Done (18 completed). Phase 5 (Agent Approval Cards) in active development — 14.22 Ready for Review, 14.23/14.24/14.28–14.31 Approved, 14.32 Draft. Phase 6 (prompt-caching + usage telemetry, 14.26/14.27) Done (added 2026-04-24 as 5.5 prereqs). Original estimate was 14 stories.

**Goal:** Build an AI compliance partner that provides contextual, cited legal guidance through conversational interaction with company-aware tooling.

**Delivers:** Agent system prompt, tool suite (search_laws, get_company_context, etc.), streaming chat UI, change assessment flow, conversational onboarding, prompt-caching + usage telemetry (Phase 6, Stories 14.26 / 14.27)

**Requirements covered:** FR4, FR5, FR6, NFR2, NFR3, NFR9, NFR24

---

## Epic 15: BolagsAPI Integration & Company Data Enrichment

**Status:** Mostly Done (3/4 completed — SNI reference system remaining)

**Goal:** Integrate BolagsAPI to automatically fetch and populate company data during onboarding, enrich the CompanyProfile with authoritative signals from Bolagsverket/SCB, build an SNI reference data system, and improve the compliance agent's company context.

**Delivers:** BolagsAPI client service, onboarding auto-fill (org number → API → populate form), SNI code reference system (lookup, search, validation), enriched agent company context

**Requirements covered:** FR2 (onboarding), FR3 (personalization), FR20 (company profiling)

**Note:** Supersedes Story 2.9 (SNI Code Discovery) ACs 6-8 and Story 4.2 (Bolagsverket API). BolagsAPI replaces direct Bolagsverket access. Story 2.9's law list mapping, discovery UI, and analytics remain in backlog as future work.

---

## Epic 16: Conversion Funnel & First-Value Optimization

**Status:** Done (4/4 completed)

**Goal:** Transform the signup-to-value journey into a seamless experience where users see personalized compliance value within 90 seconds. Introduces headless agent skills — the same AI brain as the chat agent, running server-side to auto-generate personalized law lists.

**Delivers:** Frictionless signup (auto-login, delayed verification), landing page company preview (org number + URL → regulatory areas), contextual onboarding questions (activity flags), headless agent skill for auto-generated personalized law list (40-80 laws with commentary)

**Requirements covered:** FR2, FR3, FR20, FR21, FR23, FR30, NFR4, NFR5

**Dependencies:** Epic 15 (BolagsAPI - Done), Epic 14 (Agent tools - Done), Epic 12 (Templates - Done), Epic 10 (Onboarding - Done)

**Priority:** High — directly impacts activation rate, time-to-value, and trial-to-paid conversion.

---

## Epic 17: Document Management System (DMS)

**Status:** Partial (9 completed — core DMS operational, advanced features remaining)

**Goal:** Provide a complete in-app document management system where users create, edit, version, and export compliance documents (policies, risk assessments, action plans) using a Tiptap rich text editor — and where the AI compliance agent can read, search, create, and update those documents as a first-class participant.

**Delivers:** Tiptap-based rich text editor with Word-like UX, Document & DocumentVersion data models with full version control, document lifecycle management (DRAFT → APPROVED → ARCHIVED), .docx import/export and PDF export, compliance document templates, text extraction from uploaded files, workspace document embedding into RAG pipeline, 5 new agent tools for document interaction

**Requirements covered:** FR7 (compliance workspace), FR25 (audit trail), FR27 (evidence/documentation)

**Dependencies:** Epic 6 (WorkspaceFile — Done), Epic 14 (Agent tools — Done), Story 14.14 (Chunk/embed pipeline — Done)

**Priority:** High — closes the documentation gap in the compliance workflow. Users track obligations and execute tasks but cannot create the actual documents auditors ask for. Also the largest remaining blocker for full agent usefulness (agent currently blind to workspace documentation).

**Note:** Designed for future Office 365 integration (Microsoft Graph API + WOPI) as an additive phase — not included in this epic.

---

## Epic 18: Mobile UX Optimization

**Status:** Planned (0 completed — rolling epic, stories added during mobile review passes)

**Goal:** Optimize both public-facing SEO pages (`/lagar/[id]`, `/alla-lagar`, `/rattskallor`, `/eu/*`, `/foreskrifter/*`) and the authenticated workspace UI (`/dashboard`, `/laglistor`, `/browse/*`, `/tasks`, `/settings`) for mobile devices so all core flows — discovering, reading, browsing, and managing compliance — work cleanly on phones and tablets without regressing desktop.

**Delivers:** Responsive layouts, touch-friendly interactions, and mobile-specific components (bottom sheets, drawers) across public and workspace surfaces. CSS/component-level changes only — no API or schema changes.

**Requirements covered:** NFR4 (usability), NFR5 (responsive design)

**Note:** Brownfield enhancement. Rolling/umbrella epic — story scope emerges via page-by-page mobile review. If Story Index grows past ~8–10 stories, split into sibling epics (public-pages vs. workspace). See `docs/prd/epic-18-mobile-ux-optimization.md`.

**Priority:** High — SEO moat (170,000+ public pages) is actively harmed by poor mobile UX on organic-search landings.

---

## Epic 19: Agent Partner — Attachments, Skills, Subagents & Continuous Governance

**Status:** Planned (0 completed — 12 stories scoped + 4 sibling stories in Epic 14)

**Goal:** Evolve the Laglig compliance agent from "informs users" to "helps users complete compliance work" by adding the architectural primitives required for autonomous, context-aware assistance: chat file attachment reading, a self-hosted skills layer (domain playbooks as markdown files), subagents (isolated specialists), diagnostic gap-detection tools, role-based tool filtering, and continuous-governance loops (reminders, weekly pulse, feedback).

**Delivers:** Chat attachment upload + Claude content-block wiring, 9 new agent tools (read_file, 4 entity-reads, 4 diagnostics), role-filtered tool registry + AgentDecisionLog audit trail, self-hosted Skills layer (SKILL.md loader + directory convention + context activation), 3 shipped skills (assess_change migrated, gap_analysis, draft_policy), 3 subagents (LegalReasoner, DocumentReader, ParallelAssessor), Reminder/scheduling tools, weekly pulse cron, AgentFeedback model + thumbs UI, proactive hem-chat cards, seed Swedish styrdokument template library.

**Requirements covered:** FR4 (enhanced), FR5 (enhanced), FR7 (enhanced), FR25 (audit trail — agent decisions), NFR2 (accuracy), NFR3 (hallucination prevention), NFR24 (cite-first answers)

**Dependencies:** Epic 14 (Agent — core Done; approval-card Phase 5 in flight — 14.22 Ready for Review, 14.23/14.24 Approved as pre-req for approval-card reuse), Epic 17 (DMS — Partial; Stories 17.8–17.11 Draft as pre-req for text extraction + RAG + document tools), Epic 11 (Admin shell — Done, for future monitoring views), Epic 6 (Kanban/Task — Done). Sibling stories 14.26–14.29 coordinated with Epic 14.

**Note:** Brownfield enhancement. Self-hosted only — no Anthropic Files API, no managed Skills beta, no code execution tool. Keeps stack provider-neutral and ZDR-clean. Single composite feature flag `agent_partner_v2` per workspace gates the entire epic.

**Priority:** High — largest remaining blocker for full agent usefulness once Epic 17's DMS-side tools ship. Delivers the step-change from "compliance dashboard with chat" to "compliance partner that does work."

---

## Epic 20: Workspace Krav Overview & Per-Krav Assignment

**Status:** Planned (0 completed — 3 stories scoped)

**Goal:** Surface every kravpunkt across the workspace in a single filterable table so compliance managers and responsible owners can triage gaps, missing bevis, and personal assignments without drilling into 40+ law item modals — and let individual kravpunkter carry their own assignee when responsibility needs to be delegated below the law-item level.

**Delivers:** Optional per-krav `responsible_user_id` with automatic inheritance from the parent `LawListItem` when unset; assignee picker in the existing kravpunkter checklist; `getWorkspaceRequirements` server action with filter presets (Alla / Luckor / Mina krav / Saknar bevis); new `/krav` route rendering a TanStack table that reuses the document-list-table design language (virtualization, inline editors, URL-param filters); new "Krav" subitem under the Efterlevnad sidebar accordion.

**Requirements covered:** Extends FR of Epic 6 (Compliance Workspace) — specifically deeper gap visibility — and lays groundwork for audit export/reporting (deferred).

**Dependencies:** Epic 6 (Compliance Workspace Kanban — Done; provides `LawListItem` responsible assignment, kravpunkter model, `LegalDocumentModal`, `KravpunkterChecklist`), Epic 17 (DMS — Partial; `RequirementEvidenceLink` used by the "Saknar bevis" filter).

**Note:** Brownfield enhancement. Additive schema only (nullable FK). Reuses existing table, filter-bar, assignee-picker, and sidebar patterns — no new UI primitives. See `docs/prd/epic-20-workspace-krav-overview.md`.

**Priority:** Medium-High — highest single-feature unlock for users with ≥10 laglistor preparing for external audits. Unblocks audit-export follow-ups.

---

## Epic 21: Lagefterlevnadskontroll (Compliance Audit Cycle Module)

**Status:** Substantially Done (UAT-ready) — **13 of 14 stories shipped** (21.1, 21.2, 21.3, 21.4, 21.5, 21.5.2, 21.6, 21.7, 21.8, 21.9, 21.11, 21.12, 21.13, 21.14). Story 21.9 (Seal — INTEGRITY-001 v0.5 softening) and 21.12 (background PDF generation) shipped after the 2026-04-23 catch-up snapshot. **Story 21.10** (`assertCycleEditable` runtime guard) is the single deferred story — defence-in-depth hardening only; the inline `assertCycleEditableUi` guards in `app/actions/compliance-audit-{cycle,item}.ts` already enforce SEALED/ARKIVERAD read-only correctly, so 21.10 is tech-debt cleanup rather than a UAT blocker. Tracked via `TODO(21.10)` markers grep-able from the codebase. **Story 21.15** (manual kontroll↔task linkage + Uppgifter tab) remains in `docs/stories/backlog/frontend/`, deprioritised behind post-21.9/21.12 customer-validated demand. **Out-of-band UX work** (Bakgrund description field, sign-off authorization tightening, cycle-item modal v2 audit-flow alignment, Saknar-bevis quick-win, Förseglad → Fastställd verb rename, full-viewport detail page, vertically-centered cycle-item rows, BreadcrumbOverride, table border wrapper, LinkedArtifactsPanel accordion) is documented as post-shipping addenda on Stories 21.4, 21.5, 21.9, 21.11, 21.14 — see those stories' Change Logs and Completion Notes for full traceability.

**Goal:** Replace the Excel-based Swedish compliance-audit cycle (ISO 14001 §9.1.2 / ISO 45001 §9.1.2 / AFS 2001:1 / SFS 1998:901) with a structured, auditable, AI-assisted workflow inside Laglig.se. Primary user is the KMA-samordnare / miljösamordnare / HSE-ansvarig running internal audits 1–2 times per year. Key value: traceability by construction — every bedömning, bevis, and change automatically logged, hashed, and exportable as a tamper-evident revisionsrapport.

**Delivers:**
- New aggregate `ComplianceAuditCycle` + child entities (`ComplianceAuditItem`, `ComplianceFinding`, `EvidenceSnapshot`, `ComplianceAuditReport`) — additive Prisma schema, no existing column dropped (Story 21.1).
- New route tree under `/laglistor/kontroller` — list hub (Story 21.5.2), cycle creation wizard with scope selector (Stories 21.3, 21.4), cycle detail page with Items / Findings / Rapport / Aktivitet tabs (Story 21.5).
- Cycle CRUD server actions in `app/actions/compliance-audit-cycle.ts` (Story 21.2) with `withWorkspace()` + `tasks:edit` guard convention; lifecycle transitions PLANERAD → PAGAENDE → AVSLUTAD → SEALED → ARKIVERAD with revert-to-PAGAENDE escape hatch (Story 21.6).
- Findings CRUD with type/severity/state model (Avvikelse / Observation / Förbättringsförslag × Kritisk / Större / Mindre × Öppen / Stängd / Verifierad) — Story 21.7.
- Auto-spawn corrective-action `Task` on `AVVIKELSE` finding via `lib/compliance-audit/task-spawner.ts`; M:N `ComplianceCycleTaskLink` join surfaces task in the right-rail "Länkade kontroller" card; finding ↔ task lifecycle stays in sync (Story 21.8).
- HTML revisionsrapport renderer at `lib/compliance-audit/revisionsrapport-renderer.ts` + `cycle-rapport-tab.tsx` consumer (Story 21.11; PDF generation deferred to 21.12).
- Activity-log integration for every cycle / item / finding / report mutation via the existing `lib/services/activity-logger.ts` with new entity-type label maps under `lib/activity/` (Story 21.13).
- New permission scope `audit:seal` (OWNER / ADMIN), new `AUDITOR` role (read-mostly across activity / cycles / findings), and `lib/compliance-audit/authorization.ts` with `canSealAuditCycle`, `isLeadAuditor`, `canCompleteOrRevertCycle` helpers (Story 21.14).
- Recent UX polish: Förseglad → **Fastställd** verb rename across UI + activity-log strings; cycle tables wrapped in `rounded-md border` per app brand pattern; cycle-detail uses full viewport width; vertically-centered cycle-item row cells.
- Optional **Bakgrund** (description) free-text field on `ComplianceAuditCycle` captured in cycle creation wizard, surfaced in cycle-detail header and as a "Bakgrund och syfte" section in the revisionsrapport between titelsida and TOC (post-shipping addendum, 2026-04-27).
- Sign-off authorization tightened on `ComplianceAuditItem` — sign + unsign restricted to cycle's lead auditor, item's responsible user, or workspace OWNER/ADMIN escape hatch (was previously open to any `tasks:edit` member). Pure helper `canSignOffItem` in client-safe `lib/compliance-audit/authorization-shared.ts` (post-shipping addendum, 2026-04-27).

**Requirements covered:** New FRs introduced by this epic (compliance-audit cycle lifecycle, immutable seal, evidence snapshot, revisionsrapport generation). Closes deficiency cited in Time2act Swedish-audit benchmarking — "lagefterlevnadsbedömning is the #4 most common avvikelse at external audits" — by making review continuous rather than annual.

**Dependencies:** Epic 1 (auth + workspace multi-tenancy), Epic 5 (workspace + roles), Epic 6 (Compliance Workspace — provides `LawList`, `LawListItem`, `LawListItemRequirement` substrate the cycle scopes against; Kanban / Task model the spawner targets), Epic 17 (DMS — `RequirementEvidenceLink` snapshot semantics referenced for evidence freeze at seal time), Epic 20 (per-krav assignee — drives `itemResponsibleUserId` fallback in the task spawner).

**Note:** Brownfield enhancement (significant new feature surface, minimal modification of existing code). All new code isolated under `app/actions/compliance-audit-*.ts`, `components/features/compliance-audit/`, and `lib/compliance-audit/`. Touches existing files only at: `prisma/schema.prisma` (additive), `lib/auth/permissions.ts` (one new scope), `lib/activity/*.ts` (additive label-map keys), `Task` model (one nullable `compliance_finding_id` FK column). Source artefacts: `docs/lagefterlevnadskontroll-brief.md` (strategic brief, Mary), `docs/prd-lagefterlevnadskontroll.md` (PRD with 14 stories), `docs/architecture/epic-21-lagefterlevnadskontroll.md` (architecture addendum, Winston).

**Priority:** High — flagship initiative for the 2026-Q2 release. Differentiates Laglig.se from Notisum / JP Infonet / Ramboll Lagbevakning (none of which surface a structured audit-cycle module today).

---

## Epic 22: UI Primitives Alignment

**Status:** Planned (0 completed — 4 stories scoped)

**Goal:** Eliminate cross-surface drift in the workspace's six tabular surfaces by consolidating four primitives — Badge, FilterChip, PageHeader/TableToolbar, and the table primitive itself — so the same domain value (priority, status, severity, finding type) renders identically everywhere and new features cannot reintroduce variants.

**Delivers:** Extended `components/ui/badge.tsx` with semantic `tone × variant` matrix backed by `lib/ui/badge-tones.ts`; aligned Priority enum (`Hög`/`Medel`/`Låg` in rose/amber/slate, single shared editor); new `components/ui/filter-chip.tsx` with `aria-pressed` semantics replacing two reinvented chip implementations; new `components/ui/page-header.tsx` + `components/ui/table-toolbar.tsx` with named slots, migration of all six surface page files; migration of `cycle-items-tab.tsx` and `document-table.tsx` from custom div-grids to shadcn `<Table>`.

**Requirements covered:** Cross-cutting UX consistency. Reduces tech debt accumulated across Epic 6 (Compliance Workspace), Epic 17 (Document Management), and Epic 21 (Lagefterlevnadskontroll).

**Dependencies:** Epic 6 (Done — source of `compliance-detail-table.tsx`, `PriorityEditor`, `ComplianceStatusEditor`), Epic 17 (Done — source of `document-table.tsx`, `DocumentStatusBadge`), Epic 21 (Active — source of `cycle-list-table.tsx`, `cycle-items-tab.tsx`, `cycle-findings-tab.tsx`, `cycle-status-badge.tsx`; coordination required so in-flight 21.x stories target the new primitives).

**Note:** Brownfield refactor. Zero behaviour change. No new APIs or schema. Source artefacts: `docs/ui-consistency-audit-2026-04-23.md` (current-state class strings), `_prototypes/ui-alignment-prototype.html` (target-state visual reference + JSX API stubs). See `docs/prd/epic-22-ui-primitives-alignment.md`.

**Priority:** Medium — no new user-facing features, but fixes concrete inconsistencies (priority colour collisions, screen-reader confusion on chip-tabs, inconsistent action button placement) that compound in cost as the workspace gains more surfaces.

---

## Epic 23: Anmärkningar som förstklassiga objekt

**Status:** Planned (0 completed — 5 stories scoped)

**Goal:** Lift `ComplianceFinding` out of cycle scope into a first-class workspace object with its own registry page (`/anmärkningar`), shared cross-surface modal, and ad-hoc creation pathway — so avvikelser, observationer and förbättringsförslag exist as continuously-tracked compliance signals, not just artefacts of a closed audit.

**Delivers:** Schema migration making `ComplianceFinding.cycle_id` nullable + `workspace_id`/`created_by_user_id`/`assignee_id` columns + `Comment.finding_id` polymorphic extension + anchor CHECK constraint; new `/anmärkningar` registry page mirroring `/uppgifter` architecture (PageHeader + TableToolbar + shadcn Table + URL-synced filters); shared `<FindingModal>` on the `SplitPanelModal` shell with feature-parity to `<TaskModal>` (activity feed, linked artifacts, status actions); rewire of three entry points (cycle-detail Findings tab, law-list-item modal, registry CTA) onto the shared modal; cross-cycle visibility via cycle wizard "kända vid start" panel + Findings tab "Visa öppna från tidigare kontroller" toggle; sidebar nav entry under Efterlevnad with red-pip count.

**Requirements covered:** Resolves brief Q294 ("findings visible outside the cycle?") and Q295 ("carried-over avvikelser?") from `docs/lagefterlevnadskontroll-brief.md`. Implements ISO 19011 audit-output taxonomy (avvikelse / observation / förbättringsförslag) as continuous-improvement register — core to ISO 9001 §10.2, ISO 14001 §10.2, ISO 45001 §10.2 management-system audits.

**Dependencies:** Epic 21 (Active/UAT-ready — source of `ComplianceFinding`, `FindingEditor`, `FindingCard`, `cycle-findings-tab.tsx`; hard dependency, refactored), Epic 22 (Done PR #60 — consumes `<PageHeader>`, `<TableToolbar>`, `<FilterChip>`, `<Badge tone>`, `<EmptyState>` from day one), Epic 6 (Done — source of `Comment` polymorphic model, `ActivityLog`, threaded comments UX), Epic 17 (Done — source of `LinkedArtifactsPanel` SWR pattern reused for the modal's right rail).

**Note:** Brownfield enhancement. Schema change is additive + backward-compatible (nullable column, denormalised mirrors backfilled). Existing cycle-scoped reads keep working unchanged. Sealed-cycle PDFs remain bit-identical (point-in-time guard in Story 23.5). Source artefacts: `_prototypes/anmarkningar-page-and-modal.html` (visual reference for page + modal + entry-point matrix). See `docs/prd/epic-23-anmarkningar-first-class.md`.

**Priority:** High — unblocks continuous-improvement workflows core to ISO management-system audits, resolves long-standing post-MVP question from the lagefterlevnadskontroll brief, and sequences naturally after Epic 22 (now done) so new surfaces use canonical primitives from day one.

---

## Epic 24: Import Befintlig Laglista

**Status:** Planned (0 completed — 6 stories scoped)

**Goal:** Add a self-serve import pipeline that lets switchers bring an existing curated law list (Notisum / Lex.nu / JP Infonet / Ramboll / consultant Excel / internal spreadsheet) into Laglig in minutes, using fuzzy + LLM matching against our SFS / AFS / EU catalog with a 24-hour manual-ingest SLA for documents not yet in the catalog. Surfaced both at first-run onboarding (via Epic 25) and via the in-app `/laglistor/skapa` create-list flow for existing users mid-contract.

**Delivers:** Three new Prisma models (`LawListImport` aggregate with `UPLOADED → PARSED → MATCHING → AWAITING_REVIEW → COMMITTED` state machine, `LawListImportRow` per-row staging with confidence scores, `CatalogIngestRequest` queue for unmatched rows with 24h SLA); Excel/CSV/paste parser with column auto-detect; two-stage matching engine (fuzzy retrieval against `LegalDocument` + LLM disambiguation pass via Anthropic Sonnet with prompt caching); full-page review surface at `/laglistor/skapa/[importId]/granska` with confidence-tier grouping and per-row decisions; admin queue at `/admin/catalog-requests` for ops to fulfil unmatched-row requests within 24h SLA; `/laglistor/skapa` rewire to add Generate / Import path-choice fork; email notifications on import completion + catalog-request fulfilment.

**Requirements covered:** Brief at `docs/import-law-list-brief.md` (drafted 2026-04-22). Closes the largest single objection in the switcher conversation.

**Dependencies:** Epic 6 (Compliance Workspace — Done; provides `LawList` + `LawListItem` write targets), Epic 17 (Document Management — Partial; `LegalDocument` is the matching catalog), Epic 4 (Onboarding — Done; `/laglistor/skapa` extension target), Epic 11 (Admin shell — Done; hosts catalog-requests page), Epic 14 (Agent / LLM tooling — Done; Anthropic SDK + prompt caching + cost telemetry reused).

**Note:** Brownfield enhancement. Schema changes are additive only. Sequenced **before** Epic 25 because the import pipeline has standalone value via the in-app create-list page; existing users mid-contract migrating from competitors don't need the onboarding wrapper. Source artefacts: `docs/import-law-list-brief.md` (strategic brief), `_prototypes/onboarding-tutorial-modal.html` (visual reference for upload step + confidence breakdown). See `docs/prd/epic-24-import-existing-law-list.md`.

**Priority:** High — switcher lane is the highest-conversion lane (prospects already have budget allocated). Removes the "I can't easily move my list" objection and turns each import into a catalog-coverage feedback loop.

---

## Epic 25: First-Run Onboarding Modal

**Status:** Planned (0 completed — 7 stories scoped, B.0 ships independently as pre-MVP)

**Goal:** Replace the silent auto-fire of law list generation on first `/dashboard` visit with a path-choice + tutorial-while-waiting modal that gates generation, educates new users on the six core product capabilities (laglista / kravpunkter / uppgifter / kontroller / lagändringar / AI-agenten) via realistic mini-previews, and hands off cleanly to either the laglista (generate path) or the Epic 24 review surface (import path) — with a corner FAB and Hjälp menu providing persistent re-entry, plus a future feedback-loop slot on the same modal substrate.

**Delivers:** Pre-MVP gate (Story B.0 — ships independently in 1.5 days): minimal modal with three buttons (Generera / Importera "kommer snart" / Hoppa över), 3 nullable `Workspace` columns + `OnboardingEvent` telemetry table + `'skipped'` accepted as new value of existing `law_list_generation_status` String field, removal of wizard auto-fire of `POST /api/workspace/generate-law-list`. Full modal (Stories B.1–B.4): brand-chrome Dialog with Safiro fonts, path-choice cards with hover-lift + recommended-chip, generate-kickoff confirm step, import-upload step (Epic 24 dependency), tutorial step with progress strip + 6-tab framework + per-tab realistic mini-previews of actual product surfaces, done states for both paths. Re-entry layers (Story B.5): corner FAB with three visual states (working / done / idle), tiny X to dismiss, Hjälp sidebar entry as fallback, URL-driven deep-link (`?onboarding=tutorial[&tab=ai_agent]`), `tutorial_only` mode for post-completion. Feedback loop slot (Story B.6 — future): `submitOnboardingFeedback` action + 7th-tab/banner placement on existing modal substrate; reuses `OnboardingEvent` `feedback_submitted` event type without schema changes.

**Requirements covered:** Brief at `docs/onboarding-first-run-brief.md` (drafted 2026-05-06). Architecture at `docs/architecture/first-run-onboarding-modal.md` (Winston, 2026-05-06). Closes the activation gap left by Epic 4 (wizard delivered but no post-signup orientation) and the token-cost gap (silent generation auto-fire wastes ~$0.50–$1.50 per import-or-skip signup).

**Dependencies:** Epic 4 (Onboarding — Done; wizard's `confirm-step.tsx` rewire), Epic 6 (Compliance Workspace — Done; powers Tab 3 Uppgifter Kanban preview), Epic 14 (AI Chat — Done; powers Tab 6 AI-agenten preview, plus Stories 14.20/14.26/14.27 for accuracy of the chat preview), Epic 17 (Document Management — Partial; powers Tab 2 Kravpunkter & bevis preview), Epic 21 (Lagefterlevnadskontroll — Substantially Done post 21.26+21.27; powers Tab 4 Kontroller preview, lifecycle is `PLANERAD → PAGAENDE → AVSLUTAD`), Epic 22 (UI Primitives — Done; tab content uses `<Badge tone>` / `<FilterChip>` / `<PageHeader>` / `<TableToolbar>` from day one), **Epic 24 (Import Existing Law List — sequenced first; hard dependency for B.4 import handoff and B.1 import-card un-disable)**, Story 16.4 (`LawListGenerationProgress` — Done; SWR substrate reused as progress-strip data source).

**Note:** Brownfield enhancement. Schema additions are purely additive (3 nullable columns + 1 new table). B.0 is the **pre-MVP wedge** — ships before Epic 24 with import button visibly disabled, stops token waste from auto-fired generation in 1.5 days. Source artefacts: `docs/onboarding-first-run-brief.md` (brief), `docs/architecture/first-run-onboarding-modal.md` (architecture: schema, state machine, re-entry hierarchy, source-tree additions), `_prototypes/onboarding-tutorial-modal.html` (high-fidelity 6-frame visual reference with real Safiro fonts and realistic mini-mockups of every product surface). See `docs/prd/epic-25-first-run-onboarding-modal.md`.

**Priority:** High — token-cost rationale (B.0 wedge) plus activation-conversion rationale (full modal). B.0 is the highest-leverage near-term ship: 1.5 days of work that stops measurable token waste per signup immediately.

---

**Total Stories Tracked:** ~257+ across 25 epics (~166 completed, ~89+ backlog; Epic 18 stories TBD, Epic 19 12 stories scoped, Epic 20 3 stories scoped + completed, Epic 21 14 stories scoped — **13 completed, 1 deferred (21.10)**, 1 in backlog (21.15), Epic 22 4 stories scoped, Epic 23 5 stories scoped, Epic 24 6 stories scoped, Epic 25 7 stories scoped — B.0 pre-MVP)

**Epic Status:** 12 Done (incl. Epic 21 substantially-done as of 2026-04-27, UAT-ready with 1 deferred 21.10 + 1 backlogged 21.15), 4 Partial / Active, 9 Not Started / Planned (incl. Epic 23, Epic 24, Epic 25)

**Last updated:** 2026-05-06

---
