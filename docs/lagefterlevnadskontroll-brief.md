# Project Brief: Lagefterlevnadskontroll (Compliance Audit Cycle Module)

**Status:** Draft v1 — awaiting PM + Architect review
**Author:** Mary (Analyst) — 2026-04-22
**Target product:** Laglig.se
**Positioning:** New module within existing product (brownfield)

---

## Executive Summary

Lagefterlevnadskontroll is a new first-class module in Laglig.se that formalises the Swedish "legal compliance audit" cycle — the periodic verification that an organisation complies with its applicable legal and other binding requirements. It takes the Excel-based workflow that every ISO 14001 / ISO 45001 / FR2000 certified Swedish company runs 1–2 times per year and replaces it with a structured, auditable, AI-assisted cycle that produces a tamper-evident revisionsrapport in PDF. The primary user is the KMA-samordnare / miljösamordnare / HSE-ansvarig driving internal audits; the key value proposition is **traceability by construction** — every bedömning, every piece of bevis, every change is automatically logged, hashed, and exportable, replacing weeks of spreadsheet assembly with a continuously-up-to-date, one-click-sealable cycle.

---

## Problem Statement

### Current state and pain points

ISO 14001:2015 clause 9.1.2 and ISO 45001:2018 clause 9.1.2 require documented evaluation of compliance with binding requirements, and AFS 2001:1 mandates at least annual uppföljning of systematiskt arbetsmiljöarbete for every Swedish employer with 10+ employees. Independent of certification, miljöbalkens egenkontrollförordning (SFS 1998:901) requires documented self-monitoring for all permit- or notification-obliged miljöfarlig verksamhet. The statutory and certification pressures are real and enforceable — Arbetsmiljöverket can issue sanktionsavgifter up to 1 MSEK for breaches of SAM.

Despite this, the canonical workflow in Swedish industry is an Excel file with three sheets — **Lagefterlevnadsregister, Bedömningsmatris, Handlingsplan** — maintained manually by a single KMA-samordnare and emailed around for review. This breaks down in five predictable ways:

1. **Legal text drifts.** Swedish SFS and agency föreskrifter change weekly. Laglistor go stale between annual reviews because the Excel isn't connected to a bevakningstjänst.
2. **Evidence scatters.** "Bevis: Skyddsrondsprotokoll 2024-03-14" is a cell reference; the actual file lives in someone's e-mail, shared drive, or SharePoint folder. When the certifieringsorgan asks to see it, it takes hours to find.
3. **No audit trail.** Who changed an efterlevnadsbedömning from "uppfylld" to "delvis" on 2024-11-02, and why? Excel cannot answer. DNV explicitly criticises reviews that "fail to clearly articulate what compliance elements were tested and their results."
4. **Multi-site / multi-reviewer coordination is broken.** Excel forces one file, one reviewer. Splitting reviews across sites or rättsområden leads to merge conflicts and version chaos.
5. **Deadlines on korrigerande åtgärder never fire reminders.** An Excel cell with a slutdatum pings nobody.

Time2act and other Swedish practitioner sources document that **deficiencies in lagefterlevnadsbedömning are the #4 most common avvikelse at external audits**, concentrated in miljö and arbetsmiljö — the exact domains Laglig targets.

### Why existing solutions fall short

A competitive survey of Swedish lagbevakning SaaS (Notisum, JP Infonet, Ramboll Lagbevakning, Lagpunkten, Laglistan.se, Ecowise/Spineweb, Intersolia) and adjacent ledningssystem tools (AM System, Canea ONE, Stratsys) found a consistent pattern:

- **AI is effectively absent** from the 2026 marketing of every Swedish-focused vendor. International comparators (Libryo/ERM, Enhesa NOMOS) have started but do not have Swedish legal depth.
- **Laglistor remain free-text columns** (Notisum's standard is up to 8 customer-defined columns) — no structured requirement model, no per-requirement status.
- **Compliance review is a once-a-year campaign**, not continuous. State resets between cycles; prior answers get copy-pasted.
- **Evidence linking is manual upload**, disconnected from task systems and document stores.
- **Search is poor enough that users fall back to Google** (documented in Libryo reviews, echoed across Swedish forums).
- **UX is dated** (AM System reviewers: *"inte det mest användarvänliga jag har jobbat i"*; Canea: weak reporting + poor mobile).
- **Pricing is demo-call opaque** everywhere except Laglistan.se (2 750 SEK/år floor).

### Urgency

ISO 14001:2026 (published 2026-04-15) introduces explicit AI/IoT language, a new "planning and managing of changes" clause, and stronger linkage between clause 9 findings, root-cause analysis, and continual improvement. CSRD/ESRS reporting for FY2025 is live in Sweden (~4 100 affected entities), which means legal non-compliance is now a **public disclosure risk**, not just an internal audit item. Both trends raise the bar on evidence quality, timestamping, and traceability — precisely where Excel fails.

---

## Proposed Solution

### Core concept

A **ComplianceAuditCycle** is a first-class workspace entity bound to a single laglista. The user selects scope (entire list, one or more grupper, or individual lagar — their discretion), sets a scheduled period and an amendment cutoff, and assigns a lead auditor. The system materialises a frozen set of `ComplianceAuditItem`s — one per selected law — pre-populated from current kravpunkter state. Assigned responsibles confirm or revise each bedömning inline, flag avvikelser or observationer (which auto-spawn Tasks for korrigerande åtgärder via the existing Task model), and link or verify bevis using the existing LinkedArtifacts plumbing. When all items are signed off, the lead auditor **seals** the cycle: the system computes a SHA-256 hash over a canonical snapshot, locks the cycle read-only, and generates a Laglig-branded PDF revisionsrapport containing the mandatory ISO sections (omfattning, revisionskriterier, metodik, avvikelser, observationer, förbättringsförslag, styrkor, konklusion).

**The cycle is regulatory-driver-agnostic.** Although the workflow is modelled on ISO 14001/45001 compliance-evaluation practice, nothing in the data model or UI is ISO-specific. The same cycle primitive serves a non-certified SMB running an annual AFS 2001:1 SAM uppföljning, a miljöbalk-egenkontroll for a permit-obliged verksamhet, a GDPR-efterlevnad genomgång, or a full ISO 14001 + 45001 internal audit. Scope selection naturally sizes the cycle to the driver — a 15-item SAM kontroll is as native a cycle shape as a 300-item multi-standard internrevision.

### Key differentiators from existing solutions

1. **Structured kravpunkter as the primitive** (already shipped in Laglig; unique in the Swedish market). Every law is decomposed into discrete requirement rows with individual status, bevis, and assignee — not a free-text "hur vi uppfyller" cell.
2. **Unified linked-artifacts model** (Story 17.18, already shipped). Bevis flows through five pathways (direct file, direct document, evidence link, task-attached file, task-attached document), deduplicated and cross-referenced. No Swedish competitor unifies these.
3. **Immutable, hash-sealed cycle snapshots.** Tamper-evident archive satisfies ISO 14001:2026's nudge toward verifiable traceability and CSRD's evidence-quality bar. No Swedish competitor does this; only enterprise international tools (Workiva, AuditBoard) approximate.
4. **AI-assisted efterlevnadsbedömning** (Phase 4, premium tier). Drafted per-krav using Laglig's existing Claude streaming + reasoning infrastructure, grounded in linked artifacts, prior cycle bedömning, and recent ChangeAssessments. No Swedish competitor has shipped AI; Enhesa NOMOS is the international benchmark.
5. **Continuous-then-snapshot model.** Kravpunkter status stays live year-round (as today); the cycle "freezes" the state rather than restarting from zero. Matches ISO 14001:2026's change-management direction and meaningfully differs from Notisum's annual-questionnaire model.

### Why this will succeed where others haven't

Laglig already has the hard parts built: structured kravpunkter, unified linked artifacts, an immutable ActivityLog, a ChangeAssessment pipeline, a dedicated AUDITOR role, and a working Claude streaming + reasoning pipeline with Swedish-language guidance. The Lagefterlevnadskontroll module is primarily **workflow glue** over existing primitives — not a rebuild. The competitive moat comes from combining those primitives with AI, which nobody in the Swedish market has done.

### High-level vision

Laglig becomes the **system of record for Swedish lagefterlevnad** — the place where the laglista, the continuous compliance state, the formal review artefact, and the machine-readable export to CSRD/ESRS all live in a single coherent model. External certifieringsorgan eventually receive a sealed export (PDF + JSON manifest) that's comprehensive enough to conduct spot-checks without emailing the customer for follow-up.

---

## Target Users

### Primary User Segment: KMA-samordnare / HSE-ansvarig / Miljösamordnare

**Profile.** Single-person function (sometimes fractional, sometimes a team of two) in a Swedish organisation of 20–500 employees, typically in bygg/entreprenad, tillverkande industri, transport/logistik, fastighet, kemi/process, or consulting. Often reports to VD or COO. Roles are titled variably — KMA-samordnare, HSEQ-chef, miljöchef, kvalitetschef, ISO-ansvarig, HSE-ansvarig — but the responsibilities cluster. Often not a lawyer; background is usually engineering, environmental science, or operations.

**Current behaviours.** Owns the laglista (often in Notisum or Excel). Runs lagbevakning (subscribes to updates, assesses applicability, updates the list). Schedules and executes 1–2 internrevisioner per year. Handles the certifieringsorgan's external audit annually. Maintains avvikelser + handlingsplan, often in a parallel Excel. Does ledningens genomgång prep.

**Specific needs.** A single place that ties laglista → bedömning → bevis → åtgärd → revisionsrapport, with traceability good enough that the external auditor's spot-checks are one click away. Needs multi-reviewer concurrency (large laglistor cannot be reviewed single-handedly). Needs the output to be presentation-ready (PDF) without three days of formatting.

**Goals.** Pass external audit on first try. Reduce the two-week "audit prep sprint" to two days. Show management the compliance posture at any point in time, not just during the review cycle. Demonstrate to procurement / tender processes that the organisation has verifiable lagefterlevnad.

### Secondary User Segment: Lead internal auditor / VD / Ledningsgrupp

**Profile.** For internrevision, often the KMA-samordnare themselves, but sometimes a consulting firm (Aptor, Ecowise, Trossa, Envima, Certway, Ramboll) or an appointed internal auditor. For ledningens genomgång, VD and ledningsgrupp review the output of the cycle.

**Needs (within MVP scope).** Read-mostly access to the cycle, ability to add final sign-off, receive the sealed PDF. External sharing (link or login for third-party auditors) is **post-MVP**.

### Tertiary User Segment: Non-certified SMB with statutory-only compliance needs

**Profile.** Swedish SMB of 10–100 employees without ISO certification and without intent to pursue one. Statutory drivers still apply — AFS 2001:1 (annual SAM uppföljning mandatory for every employer with 10+ employees), miljöbalk-egenkontroll (if permit-/notification-obliged), GDPR, brandskydd (LSO), elsäkerhet, byggregler, NIS2 (in-scope sectors), LAS, kollektivavtal. Typically no dedicated KMA-samordnare — responsibility sits with a VD, HR-chef, office manager, or outsourced consultant doing an annual pass. Price-sensitive, time-poor, not chasing a certifieringsorgan.

**Current behaviours.** Often doing no formal lagefterlevnadskontroll at all ("we'll deal with it when Arbetsmiljöverket inspects"), or relying on a consultant's annual visit, or improvising with an internal Word document. Rarely buying Notisum — too expensive, too certification-flavoured.

**Specific needs.** A lightweight cycle focused on the narrow statutory scope that actually applies to them: often just SAM + GDPR + a handful of industry-specific regs. The PDF output matters less for an external auditor (they don't have one) and more for internal documentation, board reporting, and the "när inspektören kommer" scenario. AI-assisted bedömning (Phase 4) is disproportionately valuable to this segment because they don't have the expertise in-house.

**Goals.** Demonstrate reasonable-care due diligence if challenged by a tillsynsmyndighet. Avoid sanktionsavgifter. Give the board / VD confidence that the statutory basics are under control without hiring a full-time KMA-samordnare.

**Implications for MVP.** Three small but meaningful:
- **Vocabulary should not assume ISO.** UI labels prefer "Kontroll" / "Genomgång" as the default terms; "Revision" is a type choice, not the framing. The Swedish finding taxonomy (avvikelse/observation/förbättring) still applies — those terms are Swedish-generic, not ISO-exclusive.
- **Seal is optional, not mandatory** (see MVP Scope). A cycle can legitimately end at AVSLUTAD without a ceremonial seal for SMBs that don't have an external auditor to hand a sealed artefact to.
- **PDF tone** should read sensibly whether the reader is a DNV lead auditor or a small-company VD signing off their annual SAM check — neutral framing, minimum certification-scented jargon.

---

## Goals & Success Metrics

### Business Objectives

- Add a differentiating module that justifies price positioning at 10–50 kSEK/år within 2 quarters of GA.
- Acquire 10 paying customers using the Lagefterlevnadskontroll module as the primary wedge within 6 months of GA.
- Achieve a measurable feature parity with Notisum's compliance-control module on Phase 1–3 deliverables; exceed it on Phase 4 (AI) and Phase 5 (continuous) deliverables.
- Establish Laglig as the first AI-forward Swedish lagbevakning tool (confirmed by competitive survey as of 2026-04).

### User Success Metrics

- A customer can create, execute, and seal a complete cycle (selection → bedömning → sign-off → PDF) for a 100-item laglista in under 2 working days, including multi-reviewer coordination.
- External audit spot-check: certifieringsorganet can click from a claim in the PDF to the exact evidence version used, without Laglig staff involvement.
- Zero regressions in existing compliance-detail-table / kravpunkter / linked-artifacts flows (Stories 17.16, 17.17, 17.18, 20.x).

### Key Performance Indicators (KPIs)

- **Cycle completion rate**: % of created cycles that reach sealed state. Target: >80% within 60 days of cycle start.
- **Time-to-seal**: median business days from cycle start to seal. Target: <14 days for 100-item cycles.
- **Bedömning revision rate**: % of auto-pre-populated bedömningar that the user edits before sign-off. Informs Phase 4 AI quality; target signal rather than goal.
- **Findings-to-åtgärd closure rate**: % of avvikelser with a corrective Task closed by the next cycle. Target: >70%.
- **External audit outcome**: qualitative — do certifieringsorgan positively comment on traceability? Anecdotal metric, tracked via customer interviews.

---

## MVP Scope

### Core Features (Must Have)

- **Scope selection**: cycle is bound to one laglista; user selects any combination of entire list / specific LawListGroup(s) / individual LawListItem(s) via a reuse of the compliance-detail-table grouped view with tri-state checkboxes.
- **Cycle lifecycle**: states `PLANERAD → PAGAENDE → AVSLUTAD (sealed) → ARKIVERAD`. Amendment cutoff date captured at creation. Scheduled start/end dates. Lead auditor assignment.
- **Cycle materialisation**: on cycle start, generate frozen `ComplianceAuditItem` rows (one per in-scope law), pre-populated with the current `compliance_status` and kravpunkter snapshot. Further changes to the laglista (items added, grupper re-grouped) do not affect the cycle's scope.
- **Per-item bedömning**: structured status (`UPPFYLLD | DELVIS | EJ_UPPFYLLD | EJ_TILLAMPLIG`) with free-text motivering. Reviewed-by + reviewed-at + signed-off-by + signed-off-at captured per item.
- **Findings**: `ComplianceFinding` entity with types `AVVIKELSE | OBSERVATION | FORBATTRING`, severity (MAJOR/MINOR for AVVIKELSE), description, root-cause. Each AVVIKELSE auto-spawns a corrective-action `Task` using the existing Task model, inheriting due dates and assignees.
- **Sign-off + seal**: per-item sign-off by the responsible; the lead auditor can then either (a) **complete** the cycle — status becomes AVSLUTAD, PDF generated, but cycle remains editable, or (b) **seal** the cycle — system computes a SHA-256 over a canonical JSON of (cycle metadata + item states + findings + evidence manifest), locks cycle and all items read-only, PDF generated with seal hash on the cover page. Seal is the audit-grade ceremony (required for handover to external certifieringsorgan); complete-without-seal is the everyday path for SMBs and internal-only cycles.
- **Evidence snapshot at seal**: for every linked artifact at seal time, capture `(file_id or document_id, sha256, captured_at)` into a `ComplianceEvidenceSnapshot`. External auditors can later verify the exact file version used.
- **PDF revisionsrapport**: one tight Laglig-branded template with the mandatory ISO sections (omfattning, revisionskriterier, metodik, sammanfattning, avvikelser, observationer, förbättringsförslag, styrkor, konklusion). Generated at seal, stored, downloadable. Rendered via the existing HTML→PDF pattern.
- **Activity-log integration**: all cycle mutations written to existing `ActivityLog`; cycle events (start, sign-off, seal) also logged. Global /workspace/activity feed includes cycle events.
- **Permissions**: cycle mutations gated by existing `tasks:edit` (consistent with kravpunkter); seal action requires a new `audit:seal` permission on OWNER/ADMIN + lead-auditor assignment. AUDITOR role gets cycle read-access via existing `activity:view` pattern.

### Out of Scope for MVP

- External auditor login or tokenised public links (PDF handoff only).
- Ledningens genomgång as a distinct artefact (can be added post-implementation).
- AI-assisted bedömning generation (Phase 4 premium-tier).
- Continuous-compliance freshness/verified-at signal (Phase 5).
- Machine-readable CSRD/ESRS export manifest (Phase 6).
- Mobile-optimised field-evidence capture (Phase 6).
- Configurable PDF templates / multi-template support (one tight template only in MVP, per decision). A non-ISO-flavoured variant (lighter, SMB-framed) is a plausible Phase 2 follow-up once MVP usage signals whether it's actually needed.
- Recurring-cycle scheduling (RRULE) — cycles are created manually in MVP.
- Cross-laglista cycles (single laglista only, per decision).
- Real-time cross-cycle comparison dashboard.

### MVP Success Criteria

MVP is successful when: a paying customer can run a complete, multi-user, multi-site internal audit end-to-end in Laglig, hand the sealed PDF to their external certifieringsorgan without handholding, and have the cycle archive stand up to third-party spot-checking (every "uppfylld" claim resolves to a frozen, hashed evidence reference).

---

## Post-MVP Vision

### Phase 2+ Features (Prioritised)

- **Phase 2**: Ledningens genomgång as a cycle-linked artefact; configurable PDF templates; recurring-cycle scheduling.
- **Phase 3**: External auditor access — tokenised read-only link or time-limited external login; machine-readable JSON export manifest alongside the PDF.
- **Phase 4 (premium tier)**: AI-assisted efterlevnadsbedömning — streamed Claude-generated drafts per kravpunkt, grounded in linked artifacts, prior cycle state, and recent ChangeAssessments; reuses existing `app/api/chat/route.ts` streaming and reasoning infrastructure.
- **Phase 5 (premium tier)**: Continuous compliance — `verified_at` freshness signal per kravpunkt, auto-invalidation when linked source files change, rolling dashboard of "stale" items.
- **Phase 6 (premium tier)**: CSRD/ESRS-ready export manifest; mobile-optimised field-evidence capture (camera + geostamp + hash).

### Long-term Vision (1–2 years)

Laglig is the default Swedish system of record for lagefterlevnad in the SMB-to-mid-market lane, with AI-assisted tolkning of every legal change at ingest time (not at review time), continuous compliance state year-round, and a sealed-export pipeline that feeds directly into ESG/CSRD reporting platforms. Certifieringsorgan actively prefer customers who use Laglig because traceability is better than what they get from Notisum + SharePoint.

### Expansion Opportunities

- Föreskrifter-wide monitoring once the PDF→HTML pipeline is proven stable (already noted in memory as a post-MVP direction).
- Supply-chain / CSDDD compliance — export cycle evidence to procurement portals so the customer's suppliers can prove lagefterlevnad downstream.
- Industry-specific kravpunkt templates (bygg, kemi, transport, fastighet) so new customers start with a curated baseline instead of a blank laglista.
- Public-sector variant leveraging the existing egenkontroll pattern under miljöbalken.

---

## Technical Considerations

### Platform Requirements

- **Target Platforms**: web (existing Next.js app) — desktop-first for MVP; mobile is Phase 6.
- **Browser/OS Support**: inherit current Laglig support matrix.
- **Performance Requirements**: cycle creation for a 500-item laglista should materialise in <3 s; PDF generation in <30 s for a 200-item cycle (async job if needed).

### Technology Preferences

- **Frontend**: existing Next.js + React + shadcn/ui + SWR pattern.
- **Backend**: Next.js server actions + Prisma, consistent with kravpunkter and linked-artifacts.
- **Database**: existing Postgres via Prisma. New tables; no schema migration of existing tables beyond adding relation columns.
- **PDF render**: reuse whatever HTML→PDF pipeline is used for existing document rendering (needs confirmation — Architect to validate).
- **Hashing**: Node `crypto.createHash('sha256')` on canonical JSON (`json-canonicalize` or equivalent) — no external services.

### Architecture Considerations

- **Repository Structure**: in-repo, inside existing app; new server actions under `app/actions/compliance-audit-*.ts`; new components under `components/features/compliance-audit/`; new Prisma models in existing `prisma/schema.prisma`.
- **Service Architecture**: stays as Next.js monolith; no new services.
- **Integration Requirements**: reuse existing `Task` model for corrective actions; reuse existing `ActivityLog` for audit trail; reuse existing `LinkedArtifact` resolution for evidence; reuse existing SWR + revalidate-path patterns; reuse existing permission matrix (`lib/auth/permissions.ts`) with one new scope (`audit:seal`).
- **Security/Compliance**: sealed cycles must be immutable at the application layer (server-action validation rejects mutations on sealed cycles); seal hash provides tamper evidence at the data layer; no PII leaves Laglig; PDF generation happens server-side, stored in existing file storage.

### Proposed Data Model (indicative — Architect to finalise)

```
ComplianceAuditCycle
  id, workspace_id, law_list_id, name,
  scope_definition_json ({kind: 'all'|'groups'|'items', groupIds?, itemIds?}),
  audit_type (INTERN | EXTERN),
  scheduled_start, scheduled_end, law_change_cutoff_date,
  status (PLANERAD | PAGAENDE | AVSLUTAD | ARKIVERAD),
  sealed_at, sealed_by, seal_hash,
  lead_auditor_user_id, created_at, created_by

ComplianceAuditItem
  id, cycle_id, law_list_item_id,
  efterlevnadsbedomning (UPPFYLLD | DELVIS | EJ_UPPFYLLD | EJ_TILLAMPLIG),
  motivering, reviewed_at, reviewed_by,
  signed_off_at, signed_off_by, locked

ComplianceFinding
  id, cycle_id, law_list_item_id?, requirement_id?,
  type (AVVIKELSE | OBSERVATION | FORBATTRING),
  severity (MAJOR | MINOR — AVVIKELSE only),
  title, description, root_cause,
  corrective_action_task_id (FK → Task),
  due_date, closed_at, closed_by

ComplianceEvidenceSnapshot
  id, cycle_id, law_list_item_id?, requirement_id?,
  evidence_kind (FILE | DOCUMENT),
  evidence_id, evidence_sha256, captured_at

ComplianceAuditReport
  id, cycle_id, generated_at,
  pdf_storage_path, html_storage_path, manifest_json
```

---

## Constraints & Assumptions

### Constraints

- **Budget**: unknown — internal-team build; assumes existing Laglig engineering capacity.
- **Timeline**: MVP (Phases 1–3) estimated at ~8–12 weeks elapsed based on story-level decomposition; Architect and PM to validate.
- **Resources**: single full-stack team; reuse of existing patterns reduces new-surface-area risk.
- **Technical**:
  - Single laglista per cycle (not multi-list) — product decision.
  - PDF-only external delivery — product decision.
  - One tight PDF template — product decision.
  - Must reuse existing Task model for corrective actions — no duplicate task infrastructure.
  - Sealed cycles must remain queryable but not mutable at the application layer.

### Key Assumptions

- Customers will accept a cycle as a sufficient replacement for their Excel workflow if the output PDF is presentation-ready and the audit trail is complete.
- Laglig's existing kravpunkter + linked-artifacts infrastructure scales to handle a 500-item laglista × multiple concurrent reviewers without redesign.
- The AUDITOR role's current read-only scope is sufficient for internal auditor participation in Phase 1; external auditors do not need access in MVP.
- Customers' existing laglistor in Laglig are well-enough maintained that pre-populating a cycle from current state produces useful starting bedömningar (vs. requiring a from-scratch assessment each cycle).
- SHA-256 over canonical JSON is sufficient tamper-evidence for the MVP; blockchain anchoring / notarisation is not required.
- Existing HTML→PDF pipeline (whatever Laglig currently uses for document rendering) can produce Laglig-branded revisionsrapporter with acceptable typography.

---

## Risks & Open Questions

### Key Risks

- **Scope creep into ledningens genomgång**: ISO 9.3 expects a distinct management-review artefact, and Swedish customers often conflate it with lagefterlevnadskontroll. Mitigation: explicit post-MVP commitment in the brief; stay disciplined during PRD.
- **PDF quality**: "tight, presentation-ready" is subjective. If the PDF doesn't look professional on first external audit, the module loses credibility before it's evaluated on substance. Mitigation: PDF template design should involve a real customer KMA-samordnare early; Architect should confirm current HTML→PDF stack can deliver, or propose alternative (e.g., Puppeteer, React-PDF).
- **Materialisation timing**: if the cycle is materialised at creation but executed over weeks, legitimate laglista changes during the cycle window will surprise users ("why isn't my new law here?"). Mitigation: clear UX signalling; possibly a "rescope" action that re-materialises with explicit user consent and is logged.
- **Seal immutability surface**: sealed cycles must stay queryable and visible, but any mutation path — including deep-link admin endpoints or Prisma direct calls — must be blocked. Mitigation: Architect to define an application-layer guard pattern (decorator? service wrapper?) that covers all mutation surfaces; ActivityLog continues to record read-access where appropriate.
- **Performance on 500-item cycles**: materialisation + listing + sealing must stay responsive. Mitigation: Architect to review query shapes; consider background job for seal step.
- **Competitive response**: Notisum / Karnov has capital and incumbent distribution; if they ship an AI feature first, Laglig loses the "first AI-forward Swedish vendor" positioning. Mitigation: AI is Phase 4, not gating MVP — ship the core cycle fast and let the AI moat build in Phases 4–5.
- **Customer Excel parity expectation**: customers may expect every Excel column they've customised over the years. Mitigation: structured kravpunkter + motivering is a different (better) model — this is a sell, not a gap.

### Open Questions

- Which HTML→PDF pipeline should back the revisionsrapport renderer — existing infra or new? (Architect input.)
- Should findings be visible outside the cycle in which they were raised (e.g., in a global avvikelser view)? Post-MVP question but affects model.
- How do we represent "carried-over" avvikelser from a prior cycle that are still open in the current cycle? Reference by ID, duplicate, or link?
- Does the cycle need a concept of "reviewed-but-not-in-scope" (so excluded items are explicitly recorded as "ej bedömda")? Or is exclusion simply silent?
- Seal reversal: is there any supported path to un-seal (e.g., for discovered material error)? Or is the answer always "new cycle, new seal"? Strong preference for the latter for audit integrity — but needs explicit decision.
- Will external auditors ever need to *annotate* the sealed PDF from within Laglig, or is pure download sufficient? Drives Phase 3 scope.
- Do we need per-site / per-anläggning scoping in the cycle itself, or is that already captured by laglista grouping? Larger customers may push on this early.

### Areas Needing Further Research

- HTML→PDF render quality benchmark: does the existing pipeline produce output a certifieringsorgan would find professionally acceptable? If not, what replaces it?
- Real customer workflow interview with 2–3 Laglig KMA-samordnare to validate: (a) the scope-selection mental model, (b) the findings taxonomy fit, (c) the seal-as-ceremony expectation, (d) what their current Excel looks like at handoff time.
- Legal review of tamper-evidence claims: "tamper-evident" is a defensible claim with SHA-256 + immutable ActivityLog; ensure marketing does not overstate to "tamper-proof" or "blockchain-anchored."
- Benchmark a 500-item cycle materialisation end-to-end on the existing stack before committing to response-time SLAs.

---

## Appendices

### A. Research Summary

This brief synthesises three parallel research tracks executed 2026-04-22:

1. **Codebase audit** of the existing Laglig compliance domain model — LawList / LawListItem / LawListItemRequirement / RequirementEvidenceLink / Task / ActivityLog / ChangeAssessment / ComplianceStatusLog / permissions matrix. Confirmed existing primitives are sufficient to build the cycle module without rewrites.
2. **Swedish regulatory + workflow research** — ISO 14001:2015 §9.1.2, ISO 45001:2018 §9.1.2, AFS 2001:1, egenkontrollförordningen, ISO 14001:2026 (published 2026-04-15), CSRD/ESRS, Swedish terminology glossary, findings taxonomy (avvikelse / observation / förbättringsförslag), typical Excel column set, revisionsrapport section structure.
3. **Competitive landscape** — Notisum (Karnov Group), JP Infonet, Ramboll Lagbevakning, Lagpunkten, Laglistan.se, Ecowise/Spineweb, Intersolia, AM System, Canea ONE, Stratsys, plus international comparators Libryo/ERM, Enhesa, Workiva, AuditBoard, OneTrust, LogicGate. Key finding: AI is effectively absent from Swedish vendors' 2026 marketing; structured kravpunkter are unique to Laglig; evidence-auto-sync is unique to enterprise SOX tools (Workiva); tamper-evident snapshot is absent across the category.

Pricing signal: Laglistan 2.75 kSEK/år (floor) → Notisum 15–150 kSEK/år (inferred) → Stratsys / Canea 100+ kSEK/år (enterprise). Laglig target lane: 10–50 kSEK/år with AI features as premium-tier differentiator.

### B. References

**Regulatory**
- [ISO 14001:2015 clause 9.1.2](https://preteshbiswas.com/2023/09/11/iso-140012015-clause-9-1-2-evaluation-of-compliance/)
- [ISO 45001:2018 clause 9.1.2](https://preteshbiswas.com/2023/10/02/iso-450012018-clause-9-1-2-evaluation-of-compliance/)
- [Riksdagen — Förordning (1998:901)](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/forordning-1998901-om-verksamhetsutovares_sfs-1998-901/)
- [Arbetsmiljöverket — AFS 2001:1 konsoliderad](https://www.av.se/globalassets/filer/publikationer/foreskrifter/systematiskt-arbetsmiljoarbete-foreskrifter-afs2001-1.pdf)
- [Arbetsmiljöverket — Sanktionsavgifter](https://www.av.se/arbetsmiljoarbete-och-inspektioner/boter-straff-och-sanktionsavgifter/sanktionsavgifter/)
- [Naturvårdsverket — Egenkontroll](https://www.naturvardsverket.se/vagledning-och-stod/branscher-och-verksamheter/egenkontroll/)
- [Swedac — Ackreditering](https://www.swedac.se/tjanster/ackreditering/)
- [SGS — ISO 14001:2026 transition](https://www.sgs.com/en/showcases/iso-14001-2026-key-updates-and-transition-guidance)
- [KPMG Sweden — CSRD](https://kpmg.com/se/sv/tjanster/esg-hallbarhet/csrd.html)
- [PwC Sweden — CSRD i svensk rätt](https://www.pwc.se/sv/esg/csrd-svensk-ratt.html)

**Practice**
- [DNV — Internrevisioner](https://www.dnv.com/se/assurance/Management-Systems/tips_for_vassare_internrevisioner.html)
- [Time2act — Fyra vanligaste avvikelserna](https://time2act.se/de-fyra-vanligaste-avvikelserna-vid-externa-och-interna-revisioner/)
- [Internrevision.nu — Genomföra revisionsprogram](https://www.internrevision.nu/processen-for-intern-revision/genomfora-revisionsprogram/)
- [MIS / Hållbarhetsrevisorer](https://hallbarhetsrevisorer.se/revision-enligt-mis/fragor-och-svar-om-revision/)
- [Kvalitetsdokument — Utvärdering av lagefterlevnad checklista](https://www.kvalitetsdokument.se/utvardering-lagefterlevnad-checklista-miljoledningssyst-p-267.html)

**Competitors**
- [Notisum — Compliance Control](https://www.notisum.com/compliance-control)
- [Notisum — Laglista](https://lagefterlevnad.se/laglista/)
- [JP Infonet — IT-net](https://www.jpinfonet.se/tjanster/beslutsstod/jp-itnet/)
- [Ramboll Lagbevakning](https://digitaledu.ramboll.se/digitala-produkter/lagbevakning/)
- [Laglistan.se — pricing](https://laglistan.se/)
- [Ecowise Lagrevision](https://ecowise.se/ledningssystem/lagrevision)
- [Libryo / ERM](https://libryo.com/)
- [Enhesa AI compliance](https://www.enhesa.com/resources/article/ai-driven-precision-for-compliance-requirements/)
- [Workiva SOX compliance](https://www.workiva.com/solutions/sox-compliance)

---

## Next Steps

### Immediate Actions

1. Hand this brief to the PM agent (`/pm`) to produce an epic + PRD using `brownfield-create-epic` task.
2. Hand this brief to the Architect agent (`/architect`) in parallel to produce the architecture addendum — specifically confirming the HTML→PDF stack, the immutability guard pattern for sealed cycles, and the canonical-JSON + SHA-256 approach.
3. PM + Architect pair briefly to resolve the open questions in the "Open Questions" section before stories are drafted.
4. PO validates the resulting PRD + architecture against the brownfield checklist.
5. SM drafts the first epic's stories (likely Epic 21, following existing convention from Epic 20 — krav route).
6. Dev begins implementation story-by-story; QA gates.
7. Before GA, conduct 2–3 customer KMA-samordnare interviews to validate the scope-selection UX, findings taxonomy, and PDF output.

### PM Handoff

This Project Brief provides the full context for the **Lagefterlevnadskontroll** module in Laglig.se. Please start in 'PRD Generation Mode', review the brief thoroughly (particularly the MVP Scope, Open Questions, and Risks sections), and work with the user section-by-section to create a brownfield epic using the `brownfield-create-epic` task. Ask for clarification on any Open Question before proposing story-level decomposition. Reuse of existing Laglig primitives (Task, ActivityLog, LinkedArtifact, kravpunkter, permission matrix) is a hard constraint — flag any proposed deviation explicitly.
