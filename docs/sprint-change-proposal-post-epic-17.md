# Sprint Change Proposal — Post-Epic 17 Documentation Alignment

**Date:** 2026-04-07
**Prepared by:** Sarah (PO) + Alexander
**Branch:** `correct-course/post-epic-17`
**Trigger:** Accumulated documentation drift over months of active development (Epics 9–17)

---

## 1. Analysis Summary

### Issue

The project documentation (PRD + Architecture) has not kept pace with development. The PRD was last meaningfully updated at v1.4 (2026-01-30) covering only Epic 10. The architecture changelog stops at November 2025. Meanwhile, 9 additional epics (9–17) were added and most were fully implemented. The result is documentation that significantly understates the project's scope, capabilities, and current state.

### Impact Scope

- **PRD:** 7 of 10 files need updates
- **Architecture:** 10+ files need updates
- **Story tracking:** `document-completion-status.md` claims 89 stories / 8 epics — reality is ~200 stories / 17 epics

### Recommended Path Forward

**Option 1: Direct Adjustment (SELECTED)** — Update existing docs in place. No rollbacks, no re-scoping. This is purely a documentation catch-up exercise.

---

## 2. Specific Proposed Edits

### PRIORITY 1 — CRITICAL (Actively Misleading)

---

#### 2.1 `docs/prd/document-completion-status.md`

**Action:** REWRITE entirely

**Current state:** Frozen at v1.1, Nov 2025 — lists 8 epics, 89 stories, references "Ready for Architect" phase that completed months ago.

**Proposed replacement content:**

- Update header to current version and date
- List all 17 epics with: name, story count (completed/backlog), status (Done / Partial / Not Started)
- Update total to reflect ~200 tracked stories across 17 epics
- Remove stale "Next Steps" section referencing architect review
- Add section noting epics 7 (HR) and 13 (ELI) are not yet started

---

#### 2.2 `docs/prd/index.md`

**Action:** REGENERATE Table of Contents

**Issues:**
- TOC references "Version 1.3" — should be 1.5
- Epics 3–8 are in TOC but Epics 9, 11–17 are missing
- Epic 10 link points to `../epics/` instead of consistent path
- Several broken anchor links due to section renaming

**Proposed changes:**
- Update version reference to 1.5
- Add TOC entries for all brownfield epic detail files (Epics 10–17)
- Point to `epic-list.md` entries for epics without detailed PRD files
- Fix broken link to Epic 2 ("Note:" line renders as standalone heading)

---

#### 2.3 `docs/prd/changelog.md`

**Action:** ADD v1.5 entry

**Current state:** Stops at v1.4 (2026-01-30). No entries for Epics 9, 11–17.

**Proposed v1.5 entry should document:**
- Epic 9 (Myndighetsföreskrifter/Agency Regulations) — DONE, 2026-02-15
- Epic 11 (Admin Backoffice) — DONE
- Epic 12 (Law List Templates) — DONE
- Epic 13 (ELI Structured Data) — added to backlog, not started
- Epic 14 (Compliance Agent) — DONE, replaced Epic 3's RAG approach with agentic tool-use architecture
- Epic 15 (BolagsAPI Integration) — DONE (3/4 stories)
- Epic 16 (Conversion Funnel) — DONE
- Epic 17 (Document Management System) — DONE (merged PR #40)
- Note that Epic 3 (original RAG chat) was superseded by Epic 14's agent architecture
- Note estimated story total increased from 89 → ~200

---

#### 2.4 `docs/prd/epic-list.md`

**Action:** ADD status column to each epic

**Current state:** Lists all 17 epics with descriptions but no indication of what's done vs. planned.

**Proposed changes:**
- Add `**Status:** Done` / `Partial` / `Not Started` to each epic section
- Update total estimated stories line at bottom (currently "135-153")
- Add estimated timeline note reflecting actual elapsed time
- Mark dependencies as satisfied where applicable (e.g., Epic 16 deps all Done)

---

#### 2.5 `docs/architecture/3-tech-stack.md`

**Action:** ADD missing dependencies to tech stack table

**Missing packages (all in production):**
- `@tiptap/core` + 10 tiptap extensions (v3.21) — Rich text document editor
- `mammoth` (v1.12) — Word document import
- `docx` (v9.6.1) — Word document export/generation
- `puppeteer-core` (v24.40) + `@sparticuz/chromium` (v143) — PDF export
- `@streamdown/core` + `@streamdown/code` — Markdown streaming renderer
- `ai` SDK — Vercel AI SDK for agent/chat streaming

---

### PRIORITY 2 — STALE (Outdated, Should Update)

---

#### 2.6 `docs/prd/next-steps.md`

**Action:** ARCHIVE or REWRITE

**Current state:** References UX Expert and Architect handoff prompts for phases that completed 5+ months ago. Lists "Begin Implementation - Start with Story 1.1" as a next step.

**Options:**
- **A) Archive:** Rename to `next-steps-v1-archived.md`, remove from index
- **B) Rewrite:** Replace with current "what's next" — remaining partial epics (5, 17), not-started epics (7, 13), Phase 2 roadmap priorities

**Recommendation:** Option B — rewrite to reflect current state.

---

#### 2.7 `docs/prd/post-mvp-roadmap-out-of-scope.md`

**Action:** ADD clarifying header paragraph

**Current state:** Reads as if MVP = Epics 1–8 only. Epics 9–17 exist in a grey zone — not mentioned as MVP or post-MVP.

**Proposed addition (top of file, after title):**

> **Note (2026-04-07):** The MVP scope has expanded since the original PRD. Epics 9–17 were added as brownfield enhancements and are now part of the core product. The roadmap below reflects features that remain explicitly deferred beyond the current epic set.

Also review items against what's been built — "Audit Report Generation" partially overlaps with Epic 17's PDF export capability.

---

#### 2.8 `docs/prd/requirements.md`

**Action:** ANNOTATE deferred requirements

**Items to flag:**
- FR15 (Kollektivavtal drag-and-drop) — deferred, depends on Epic 7 (not started)
- FR23 (Bolagsverket API) — superseded by Epic 15 BolagsAPI
- NFR18 (Unit Economics Tracking) — not yet implemented
- NFR26 (Email Marketing Automation) — not yet implemented

No content changes needed — just add `[Deferred]` or `[Superseded]` annotations.

---

#### 2.9 `docs/architecture/14-change-log.md`

**Action:** ADD entries for Nov 2025 → Apr 2026

**Missing entries (at minimum):**
- Epic 9: Agency regulation ingestion (AFS/BFS/NFS scraping pipeline)
- Epic 10: Workspace onboarding flow
- Epic 11: Admin backoffice system
- Epic 12: Template data model + catalog
- Epic 14: AI agent architecture (system prompt, tools, skills, RAG pipeline)
- Epic 15: BolagsAPI integration
- Epic 16: Conversion funnel + headless agent skills
- Epic 17: Document management (Tiptap, WorkspaceDocument models, export pipeline)
- Performance: Caching strategy, query optimization
- ContentChunk model + embedding pipeline
- ChangeAssessment model + assessment flow

---

#### 2.10 `docs/architecture/4-data-models.md`

**Action:** UPDATE entity count, add missing models

**Missing models:**
- `ContentChunk` (RAG embedding pipeline)
- `ChangeAssessment` + `ComplianceStatusLog` (amendment assessment)
- `WorkspaceDocument` + `WorkspaceDocumentVersion` + `WorkspaceDocumentTemplate` (DMS)
- `WorkspaceDocumentTaskLink` + `WorkspaceDocumentListItemLink` (DMS linking)
- `AdminAuditLog` (admin backoffice)
- Update entity count from "35" to actual (~45+)
- Remove deprecated `LawInWorkspace` and `LawTask` references

---

#### 2.11 `docs/architecture/5-api-specification.md`

**Action:** UPDATE server actions list

**Current state:** Lists ~8 server action files. Actual codebase has 25+.

**Missing action files (at minimum):**
- `admin-auth.ts`, `admin-cron.ts`, `admin-impersonate.ts`, `admin-templates.ts`, `admin-workspaces.ts`
- `change-assessment.ts`, `change-events.ts`
- `documents.ts`, `document-list.ts`
- `legal-document-modal.ts`, `prefetch-documents.ts`, `cross-references.ts`
- `templates.ts`, `template-catalog.ts`

---

#### 2.12 `docs/architecture/6-components.md`

**Action:** ADD sections for Document Editor and Admin Backoffice

**Missing sections:**
- Section 6.3.6: Document Management — Tiptap editor, document browser, document filters, status badges, lifecycle controls
- Section 6.3.7: Admin Backoffice — admin dashboard, workspace management, user management, impersonation, cron dashboard

---

#### 2.13 `docs/architecture/11-backend-architecture.md`

**Action:** ADD AI Agent Architecture and Cron Job sections

**Missing:**
- AI Agent system: `lib/agent/system-prompt.ts`, `lib/agent/tools/`, `lib/agent/skills/`, retrieval pipeline
- Cron jobs: 13 cron endpoints in `app/api/cron/` (sync-sfs, discover-amendments, cleanup-workspaces, etc.)
- Agency regulation ingestion pipeline: `lib/agency/` (AFS scraper, transformer, splitter)

---

#### 2.14 `docs/architecture/12-unified-project-structure.md`

**Action:** UPDATE directory tree

**Missing routes/directories:**
- `app/(workspace)/workspace/styrdokument/` (document editor)
- `app/admin/` (admin backoffice)
- `lib/agent/` (AI agent system)
- `lib/agency/` (agency regulation ingestion)
- `lib/documents/` (document processing)
- `lib/bolagsapi/` (BolagsAPI integration)

---

#### 2.15 `docs/architecture/7-external-apis.md`

**Action:** ADD missing external integrations

**Missing:**
- BolagsAPI — company data enrichment
- Arbetsmiljöverket (av.se) — AFS regulation scraping
- Other agency sources (BFS, NFS, etc.)

---

### PRIORITY 3 — MINOR (Cosmetic, Low Impact)

---

#### 2.16 `docs/architecture/9-database-schema.md`

**Action:** Review for deprecated HR entity references (Employee, Department, EmployeeDocument) — these may reference models from Epic 7 that hasn't started yet vs. the current WorkspaceFile approach.

#### 2.17 `docs/architecture/6-components.md` (Mermaid diagrams)

**Action:** Update C4 diagram — references Firebase for notifications but code uses Resend.

#### 2.18 `docs/architecture/17-coding-standards.md`

**Action:** Consider adding patterns for admin-only actions, agent tools, and impersonation.

---

## 3. Story Tracking Discrepancies

### Orphaned Stories (no epic prefix)
- `column-reorder-drag-and-drop.md` → should map to Epic 6
- `legal-reference-linkification.md` → should map to Epic 2

### Missing Story Files (referenced in epics but no file exists)
- Epic 5: Stories 5.3, 5.4, 5.5, 5.6, 5.8, 5.10, 5.12 have no story files in completed or backlog
- Epic 13: No story files exist at all (3 estimated)
- Epic 17: 4 stories unaccounted for (9 of 13 estimated have files)

### Epic Status Summary

| Epic | Name | Status | Completed | Backlog |
|------|------|--------|-----------|---------|
| 1 | Foundation & Core Infrastructure | **Done** | 10 | 0 |
| 2 | Legal Content Foundation | **Done** | 14 | 12 |
| 3 | RAG-Powered AI Chat Interface | Partial (75%) | 5 | 4 |
| 4 | Dynamic Onboarding & Personalized Law Lists | **Done** (92%) | 11 | 1 |
| 5 | Workspace Management & Team Collaboration | Partial (50%) | 5 | 1 |
| 6 | Compliance Workspace (Kanban + Dashboard) | **Done** | 22 | 1 |
| 7 | HR Module (Employee Management) | Not Started | 0 | 12 |
| 8 | Change Monitoring & Notification System | **Done** | 12 | 6 |
| 9 | Legal Intelligence & AI Enrichment | Partial (71%) | 4 | 1 |
| 10 | Workspace Onboarding & Invitation Flow | **Done** | 3 | 0 |
| 11 | Admin Backoffice | **Done** | 7 | 0 |
| 12 | Law List Templates & Standard Packages | **Done** | 12 | 2 |
| 13 | ELI Structured Data & Interoperability | Not Started | 0 | 0 |
| 14 | Compliance Agent | **Done** | 18 | 3 |
| 15 | BolagsAPI Integration | Mostly Done (75%) | 3 | 0 |
| 16 | Conversion Funnel & First-Value Optimization | **Done** | 4 | 0 |
| 17 | Document Management System | Partial (69%) | 9 | 0 |
| P | Performance (Caching & Optimization) | Mostly Done | 4 | 1 |
| **TOTAL** | | **76.5%** | **153** | **47** |

---

## 4. Recommended Execution Order

### Phase A: Critical PRD fixes (this session)
1. Rewrite `document-completion-status.md`
2. Add v1.5 to `changelog.md`
3. Add status to `epic-list.md`
4. Regenerate `index.md` TOC
5. Update `3-tech-stack.md`

### Phase B: Stale architecture docs (this or next session)
6. Update `14-change-log.md` (architecture)
7. Update `4-data-models.md`
8. Update `5-api-specification.md`
9. Add sections to `6-components.md`
10. Add sections to `11-backend-architecture.md`
11. Update `12-unified-project-structure.md`

### Phase C: Secondary PRD + minor fixes
12. Rewrite `next-steps.md`
13. Update `post-mvp-roadmap-out-of-scope.md`
14. Annotate `requirements.md`
15. Update `7-external-apis.md`
16. Minor fixes (diagrams, coding standards, schema docs)

---

## 5. Agent Handoff Plan

- **PO (Sarah):** Owns this proposal. Will execute PRD edits (Phase A + C) after approval.
- **Architect agent:** Should handle Phase B (architecture doc updates) as those require deep codebase verification.
- **No PM/fundamental replan needed** — the project direction hasn't changed, docs just need to catch up.

---

## 6. Approval

- [ ] User approves Phase A (Critical PRD fixes)
- [ ] User approves Phase B (Architecture doc updates)
- [ ] User approves Phase C (Secondary fixes)

**Awaiting user review.**
