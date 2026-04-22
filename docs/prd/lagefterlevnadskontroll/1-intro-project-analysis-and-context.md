# 1. Intro Project Analysis and Context

## 1.1 Existing Project Overview

**Analysis Source:** User-provided project context + prior codebase audit executed by the Analyst (Mary) on 2026-04-22, documented in `docs/lagefterlevnadskontroll-brief.md` §5.

**Current Project State:** Laglig.se is a Next.js 15 / React / Prisma / Postgres SaaS that helps Swedish organisations maintain **laglistor** (legal registers), track **kravpunkter** (structured per-law requirements with evidence), manage compliance-related tasks, receive **lagbevakning** (monitoring of legal changes including SFS and agency föreskrifter), and assess amendment impact through a `ChangeAssessment` pipeline. The product has workspace-scoped multi-tenancy, an immutable `ActivityLog`, five unified evidence pathways surfaced through a consolidated `LinkedArtifactsPanel` (Story 17.18), a dedicated AUDITOR role, and a working Claude streaming + reasoning chat surface. It does not, however, formalise the periodic **lagefterlevnadskontroll** cycle mandated by ISO 14001/45001 clause 9.1.2, AFS 2001:1, and miljöbalken-egenkontroll.

## 1.2 Available Documentation Analysis

- [x] Tech Stack Documentation (`docs/architecture/3-tech-stack.md`)
- [x] Source Tree / Architecture (`docs/architecture/` — sharded)
- [x] Coding Standards (`docs/architecture/17-coding-standards.md`)
- [x] API Documentation (implicit through Next.js server actions + Prisma schema)
- [x] UX/UI Guidelines (`docs/front-end-spec.md`, `docs/architecture/12-unified-project-structure.md`)
- [x] Other: complete strategic brief (`docs/lagefterlevnadskontroll-brief.md`), existing Epic 17 (document management), Epic 20 (workspace krav overview), user memory at `~/.claude/.../memory/MEMORY.md` documenting kravpunkter + linked-artifacts + AI-chat patterns.

No additional `document-project` run is required — existing documentation plus Mary's brief provide sufficient context.

## 1.3 Enhancement Scope Definition

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

## 1.4 Goals and Background Context

**Goals**

- Deliver a production-ready, audit-grade Lagefterlevnadskontroll MVP that ISO-certified organisations can use for internal audits and that non-certified SMBs can use for statutory uppföljning.
- Enable customers to seal cycles with a tamper-evident SHA-256 hash and generate a Laglig-branded PDF revisionsrapport presentable to external certifieringsorgan.
- Eliminate the Excel-based workflow for 100% of laglista reviews within one cycle of adopting the module.
- Establish Laglig as the first AI-forward Swedish lagbevakning tool (foundation for Phase 4 AI-assisted bedömning).
- Ship within 8–12 weeks elapsed against existing team capacity using reuse-first patterns.

**Background Context**

Swedish organisations today manage lagefterlevnadskontroll through Excel (canonical three-sheet layout: Lagefterlevnadsregister, Bedömningsmatris, Handlingsplan) or through Notisum-style annual questionnaire SaaS. Both approaches fail on traceability, multi-reviewer coordination, evidence linkage, and post-hoc tamper evidence — which is exactly what certifieringsorgan and the CSRD/ESRS reporting framework are starting to demand. Laglig already has the structural primitives required (kravpunkter, unified linked-artifacts, ActivityLog, ChangeAssessment, AUDITOR role); the module is primarily workflow glue over existing entities plus a new aggregate root for the cycle itself. Competitive analysis (Notisum, JP Infonet, Ramboll, Lagpunkten, Laglistan, Ecowise, AM System, Canea, Stratsys, Libryo/ERM, Enhesa) confirms AI and tamper-evident snapshots are absent from the Swedish market as of 2026-04; MVP captures parity on the core workflow and lays foundation for AI differentiation in Phase 4+.

## 1.5 Change Log

| Change | Date | Version | Description | Author |
|---|---|---|---|---|
| Initial draft | 2026-04-22 | 0.1 | Full brownfield PRD drafted from analyst brief | John (PM) |

---
