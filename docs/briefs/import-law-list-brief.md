# Project Brief: Import Befintlig Laglista (Onboarding + In-App)

**Status:** Draft v1 — awaiting PM + Architect review
**Author:** Claude (drafted with Alexander) — 2026-04-22
**Target product:** Laglig.se
**Positioning:** Feature addition to existing onboarding wizard + in-app create-list flow (brownfield)

---

## Executive Summary

Today Laglig's onboarding and in-app create-list flows offer exactly one path: **generate a new laglista** from company profile + activity questions. Customers who already own a curated list — almost every prospect switching from Notisum, Lex.nu, JP Infonet, DIBkunskap, or a consultant-delivered Excel — have no way to bring it in. They either abandon onboarding or face hours of manual re-entry. This brief proposes an **Import Befintlig Laglista** flow, surfaced both as a first-class branch in the onboarding wizard and in the in-app create-list page/modal, using **fuzzy + LLM matching** against Laglig's catalog with a **24-hour manual-ingest SLA** for documents not yet in the catalog. The feature removes the single biggest friction point for switchers and turns catalog gaps into a self-populating feedback loop.

---

## Problem Statement

### Current state and pain points

Every Swedish lagbevakning prospect arrives with one of three artifacts:

1. **Export from a competitor tool** — Notisum, JP Infonet, Lex.nu, Ramboll, Lagpunkten, and Laglistan.se all export Excel. Typical structure: SFS-nummer, titel, rättsområde, kommentar, kanske egen status.
2. **Consultant-delivered Excel or Word** — Aptor, Ecowise, Trossa, Envima, Certway, and local KMA-konsulter hand off a curated list as an annual deliverable. Structure varies wildly; SFS-nummer is often absent and titles are sometimes abbreviated or paraphrased.
3. **Internal spreadsheet** — home-grown list, usually a subset of the above, maintained by the KMA-samordnare in the company's own format.

Laglig today has no path for any of these. The onboarding wizard runs a generation flow (company info → activity questions → generated laglista), and the in-app create-list flow offers the same generation. A switcher's options are:

- Abandon onboarding, stay on the incumbent tool.
- Complete onboarding with a generated list that doesn't match their existing curated list, then spend hours diffing the two manually.
- Ask Laglig support to import for them (does not currently exist as a supported workflow).

None of those are acceptable. The generation flow is a great default for greenfield SMBs with no existing list; it is the wrong default for the switcher segment, which is the segment with the highest willingness to pay (they already believe in the category).

### Why existing solutions fall short

Swedish competitor tools treat list migration as a sales-assisted service, not a self-serve product capability:

- **Notisum** requires a sales call and an implementation engagement; no self-serve import.
- **JP Infonet, Lex.nu, Ramboll** — same pattern.
- **Laglistan.se** — prices itself below the service tier; offers no import at all.
- **International comparators** (Libryo, Enhesa NOMOS) have onboarding consultants rather than self-serve import UIs.

Users accept this because the incumbent tools have been like that for a decade. But the expectation for modern SaaS — particularly AI-forward SaaS — is self-serve. An "upload your Excel, we'll match it, we'll fill the gaps" flow is table stakes in competitor analytics / compliance / legal tooling in the US/UK markets (Vanta, Drata, Libryo's newer surfaces) and is the right bar for Laglig.

### Urgency

Three pressures stack:

1. **Switcher lane is the highest-conversion lane.** Every switcher already has budget allocated and a buying process running; removing the "I can't easily move my list" objection converts directly.
2. **Audit cycle module (Epic 21) ships soon.** Cycles run on a laglista; a switcher without a laglista can't evaluate cycles. The import feature unblocks cycles for switchers.
3. **Catalog coverage is still growing.** Every import from a real switcher is a signal about which documents we're missing. The 24h manual-ingest SLA turns each import into a coverage expansion — the more switchers import, the faster our catalog converges on market need.

---

## Proposed Solution

### Core concept

A single import pipeline with two surfaces:

1. **Onboarding wizard branch** — at the start of the wizard, the user picks "Generera ny lista" (current flow) or "Importera befintlig lista" (new flow). Not hidden behind an "advanced" toggle — first-class equal-prominence choice.
2. **In-app create-list page/modal** — same import option in the workspace create-list flow, for users who onboarded with generation and later want to add an imported list (second entity, consultant handover mid-year, post-trial migration).

Both surfaces run the same pipeline:

**Step 1 — Upload.** Accept Excel (.xlsx), CSV, or paste-text input. Extract rows client- or server-side.

**Step 2 — Match.** For each row:
- **Fuzzy candidate retrieval** against the Laglig catalog (`LegalDocument` + related tables) on SFS-nummer (exact if present), then fuzzy on title.
- **LLM disambiguation** — Claude pass that reviews top-N candidates for each ambiguous row and picks the best match with a confidence score. Reuses existing Claude infrastructure (`app/api/chat/route.ts` patterns, though this is a background job rather than streaming UI).
- Output: `matched` (high-confidence single match), `ambiguous` (multiple candidates, user picks), `unmatched` (no candidates or all low-confidence).

**Step 3 — Review.** Single-page UI shows three sections:
- **Matchade** — row-by-row list with the resolved document, small confidence indicator, "ändra" link to override.
- **Tvetydiga** — rows with multiple candidates; user picks or marks "ingen av dessa".
- **Ej hittade** — rows we couldn't match. User sees "Vi lägger till dessa i din laglista och ingestererar dokumentet inom 24 timmar" with per-row checkbox to confirm the request.

**Step 4 — Commit.** User clicks "Skapa laglista". Matched rows create `LawListItem`s immediately. Ej-hittade rows create `LawListItem` placeholders linked to a **`DocumentIngestionRequest`** entity visible to the ingestion team. User proceeds to the rest of onboarding (activity questions become a **gap-fill pass** — "din importerade lista saknar AFS 2020:5, vill du lägga till?") or, in the in-app flow, returns to the laglista.

**Step 5 — Ops ingest.** Ingestion team has a queue of `DocumentIngestionRequest`s with a 24h SLA. When a request is fulfilled, the placeholder `LawListItem` auto-resolves to the now-ingested `LegalDocument`; the customer sees a subtle notification ("3 dokument från din import är nu aktiva").

### Key differentiators from existing solutions

1. **Self-serve import, no sales call.** Uniquely positions Laglig against every Swedish incumbent.
2. **Fuzzy + LLM matching.** No Swedish competitor does this because no Swedish competitor has shipped AI. Strict SFS-ID-only matchers surface too many "ej hittade" rows and feel worse than starting fresh; fuzzy-without-LLM silently misclassifies.
3. **24-hour manual-ingest SLA** turns catalog gaps into a growth engine. Each switcher import expands our coverage automatically, prioritised by real customer demand.
4. **Gap-fill pass, not redundant work.** Activity questions run against the imported list (what's missing?) rather than generating from scratch — no duplicated effort, no conflict between imported and generated.

### Why this will succeed

The hard parts already exist: the catalog, the SWR+server-actions pattern, the Claude integration, the `LawListItem` model with extensibility points, and an activity-question engine that can run in either "generate from blank" or "gap-fill against existing" modes. The import pipeline is new surface area, but the match quality is constrained by catalog size (we know what's in it), and the ingestion SLA is an ops commitment, not a research problem. The risk surface is small and scoped.

### High-level vision

Every prospect — switcher or greenfield — reaches a working laglista in the first onboarding session. Every import improves catalog coverage. Laglig becomes the tool where "moving from Notisum" is a 10-minute self-serve flow, not a quarter-long implementation project.

---

## Target Users

### Primary: Switcher KMA-samordnare

**Profile.** Owns a laglista in Notisum, a competitor tool, or Excel. Evaluating Laglig because of price, UX, AI, or their renewal coming up. 20–500 employee org, bygg/tillverkning/transport/fastighet/kemi.

**Current behaviour.** Exports Excel from current tool to evaluate alternatives, maintains a parallel spreadsheet during the evaluation period, only commits when they believe the new tool won't require them to re-enter everything.

**Needs.** Confidence that moving their list to Laglig is a one-session task, that nothing gets silently dropped, and that the few gaps (their niche industry regulation, their kommunala föreskrift) will be filled by Laglig, not by themselves.

**Goals.** Complete the migration in under an hour. Retain their existing curation (which documents they've deemed applicable). Avoid re-doing a year of manual applicability assessments.

### Secondary: Consultant-receiving SMB

**Profile.** Non-certified SMB, KMA is outsourced to a consultant who delivers an annual Excel or Word laglista. 10–100 employees, VD or HR-chef as internal point-of-contact.

**Current behaviour.** Stores the consultant's Excel in SharePoint, opens it once a year, does nothing between deliveries.

**Needs.** Turn the consultant's static deliverable into a live-monitored, searchable laglista without asking the consultant to do anything different.

**Goals.** Get value from between consultant deliveries (alerts on amendments, easy lookups) without changing the procurement relationship with the consultant.

### Tertiary: Multi-entity workspace owner

**Profile.** Existing Laglig customer who onboarded one entity via generation, now adding a second subsidiary or site that already has its own curated list.

**Current behaviour.** Today, has no path other than recreating the second list via generation and hoping it matches the subsidiary's existing one.

**Needs.** In-app create-list flow that supports import as a peer to generation.

---

## Goals & Success Metrics

### Business Objectives

- Remove the "I can't bring my list" objection from every switcher sales conversation within 1 quarter of launch.
- Increase switcher-segment trial-to-paid conversion by a measurable delta (baseline needed; target +10pp).
- Catalog coverage grows organically via `DocumentIngestionRequest`s — target >80% of ej-hittade requests fulfilled within 24h.
- Zero regression in the generation flow (the default for greenfield SMBs remains fast and good).

### User Success Metrics

- Switcher can import a 200-row Excel and have a working laglista in under 10 minutes, including review of ambiguous matches.
- >85% of rows in a typical Notisum export resolve to `matched` automatically (fuzzy+LLM finds the right document without user intervention).
- <5% false-positive rate in the `matched` bucket (user overrides because the auto-match was wrong).

### Key Performance Indicators (KPIs)

- **Import completion rate**: % of started imports that result in a created laglista. Target: >90%.
- **Auto-match rate**: % of rows that resolve to `matched` without user intervention. Target: >85%.
- **Ingestion SLA compliance**: % of `DocumentIngestionRequest`s fulfilled within 24h. Target: >80% (early), >95% (steady-state).
- **Switcher conversion lift**: trial-to-paid conversion for imported-list accounts vs. generated-list accounts. Target: imported ≥ generated (switchers are higher-intent, so this should overperform).
- **Catalog expansion velocity**: new `LegalDocument`s added per month sourced from `DocumentIngestionRequest`s (as distinct from scheduled ingestion runs).

---

## MVP Scope

### Core Features (Must Have)

- **Input formats**: Excel (.xlsx) upload, CSV upload, paste-text (tab-separated or line-separated).
- **Column detection**: best-effort detection of SFS-nummer, titel, and freeform comment columns. User confirms/overrides column mapping if ambiguous.
- **Match pipeline**: fuzzy candidate retrieval + LLM disambiguation + confidence scoring. Three-bucket output (`matched` / `ambiguous` / `unmatched`).
- **Review UI**: single-page interactive review with matched / ambiguous / unmatched sections, per-row override, bulk "accept all matched".
- **Ingestion request model**: new `DocumentIngestionRequest` entity tied to workspace and user. Minimum fields: raw row data, proposed SFS-nummer/title, status (`pending` / `in_progress` / `fulfilled` / `rejected`), SLA deadline, fulfilled_at, linked `LegalDocument` on fulfillment.
- **Placeholder `LawListItem`s**: ej-hittade rows get `LawListItem`s with a pending-document state; auto-resolve when the ingestion request fulfills.
- **Gap-fill activity questions** (onboarding only): when a user imports in the onboarding flow, activity questions run in "suggest additions" mode against the imported list rather than "generate from scratch".
- **Surfaces**: both onboarding wizard branch AND in-app create-list page/modal use the same flow. In-app surface built first, onboarding embeds it.
- **Ingestion admin surface**: simple queue view for the ingestion team to see, claim, and fulfill requests. Can be minimal — a table with actions is fine for MVP.
- **Customer notification on fulfillment**: subtle in-app toast or notification when placeholder items resolve ("3 dokument från din import är nu aktiva").

### Out of Scope for MVP

- Word document import (Excel/CSV/paste only). Consultants who deliver Word files get a "convert to Excel first" message with guidance.
- PDF import (scanned or native). Explicitly out.
- Bi-directional sync with competitor tools (no Notisum API integration — one-shot import only).
- Scheduled re-imports / delta imports. MVP is one-shot per laglista; subsequent additions via the existing add-document flow.
- Auto-inference of rättsområde / grupp from imported row context (nice-to-have; user assigns groups post-import using existing UI).
- Multi-language import (Swedish Excel only).
- Preservation of custom columns from the source file beyond freeform comment. Notisum's 8-custom-column model doesn't map cleanly to Laglig's `LawListItem` schema — deferred until a clear use case emerges.
- SLA enforcement tooling (alerts, escalations, dashboards for ops). MVP trust-based; ops owns the 24h commitment manually.

### MVP Success Criteria

MVP is successful when: a real switcher, given a Notisum Excel export, can complete the import flow self-serve in a single session, reach a working laglista with >85% auto-matched rows and a clear expectation on the remaining rows, and have those remaining rows resolved within 24 hours with no support intervention.

---

## Post-MVP Vision

### Phase 2+ Features (Prioritised)

- **Phase 2**: Word document import (via conversion step); custom column preservation with user-defined mapping; in-app "re-import" to merge updates from a fresh competitor export.
- **Phase 3**: Direct Notisum API integration if commercially viable; scheduled bi-directional sync during a transition period.
- **Phase 4**: Bulk-import assistance — if a switcher's Excel has >500 rows with ambiguity, offer a white-glove import by Laglig ops (paid tier).
- **Phase 5**: Import-quality feedback loop — catalog team sees patterns in ej-hittade requests and prioritizes ingestion roadmap.

### Long-term Vision

Import becomes the default onboarding path for switchers, generation remains the default for greenfield, and the 24h ingestion SLA progressively shrinks as catalog coverage converges on market need. The "moving to Laglig" narrative in sales conversations becomes "it's a 10-minute Excel upload, not a migration project."

### Expansion Opportunities

- Extend the pipeline to import **kravpunkter** (not just laws) — some consultants deliver per-§ curated requirement lists.
- Extend the pipeline to import **compliance status** — switchers sometimes want to preserve their existing "uppfylld/delvis" marks from the incumbent tool.
- Extend the pipeline to import **bevis** — upload an accompanying ZIP of evidence files with a manifest referencing law rows.

---

## Technical Considerations

### Platform Requirements

- **Target Platforms**: web (existing Next.js app); desktop-first. Mobile not needed (nobody imports a laglista on their phone).
- **Browser/OS Support**: inherit current Laglig support matrix.
- **Performance Requirements**: 500-row Excel uploaded, matched, and reviewed in <2 minutes end-to-end. LLM disambiguation budget ~30s per 50 rows (batched).

### Technology Preferences

- **Frontend**: existing Next.js + React + shadcn/ui + SWR pattern. Client-side Excel parsing via `sheetjs` (or equivalent, Architect to validate).
- **Backend**: Next.js server actions + Prisma for everything except the LLM pass, which runs as a server-side job within the same request (acceptable latency for MVP; extractable into a queued job later if needed).
- **LLM matching**: Claude via existing Anthropic SDK integration. Prompt-cache the catalog slice by rättsområde to keep costs low. Architect + PM to decide model tier (Haiku likely sufficient for disambiguation).
- **Database**: new `DocumentIngestionRequest` table, new nullable `legal_document_id` state on `LawListItem` (or equivalent) to support placeholder rows.

### Architecture Considerations

- **Repository Structure**: new `app/actions/import-laglista.ts`, new `components/features/import-laglista/` for the review UI, reuse `app/onboarding/_components/onboarding-wizard.tsx` as the mount point for the onboarding branch.
- **Service Architecture**: stays as Next.js monolith.
- **Integration Requirements**: reuse existing `LawListItem` + `LegalDocument` models; reuse existing activity-question engine with a new "gap-fill" mode flag; reuse existing permission model (onboarding does not enforce; in-app create-list enforces `lists:create` or equivalent).
- **Security/Compliance**: uploaded Excel files are parsed and discarded — no storage. Raw row data stored on `DocumentIngestionRequest` for ops context only. No PII leaves Laglig.

### Proposed Data Model (indicative — Architect to finalise)

```
DocumentIngestionRequest
  id, workspace_id, requested_by_user_id
  raw_row_json (original Excel row as-is)
  proposed_sfs_number, proposed_title
  status: pending | in_progress | fulfilled | rejected
  sla_deadline_at (created_at + 24h)
  fulfilled_at, fulfilled_by_user_id
  resolved_legal_document_id (FK, nullable)
  rejection_reason (nullable)

LawListItem  (existing, extended)
  + is_pending_ingestion: boolean (true while waiting for ingestion)
  + ingestion_request_id (FK, nullable)
```

### Open Technical Questions

- **Excel parsing location** — client-side (sheetjs in browser) vs server-side (node xlsx). Client-side keeps uploaded content out of server memory; server-side is simpler for very large files. Architect to decide.
- **LLM batch size and model tier** — 50 rows/batch on Haiku is a reasonable starting point, but needs validation on real Notisum exports.
- **Catalog slice for prompt caching** — slice by rättsområde, by agency, or flat? Affects cache-hit rate and cost.
- **Placeholder `LawListItem` representation** — render as normal row with a "pending ingestion" badge, or hide from the main view until resolved? UX decision.
- **Generation flow integration** — does the imported list completely replace the generation flow, or does generation's activity-question output merge as suggested-additions? Recommended: the latter (gap-fill mode), but requires activity-question engine support.

---

## Risks & Open Questions

### Key Risks

1. **Match quality worse than hoped.** If fuzzy+LLM delivers only 60% auto-match instead of 85%, the review UI becomes the workflow rather than the exception, and the import flow feels like more work than manual entry. Mitigation: tune fuzzy retrieval aggressively on real Notisum exports before launch; reserve ability to escalate low-confidence imports to ops white-glove.
2. **24h SLA slips under load.** A burst of imports from a trade-show lead-gen push could blow through ops capacity. Mitigation: rate-limit ingestion requests per workspace/day in MVP; scale ops or move to paid-tier priority queue in Phase 4.
3. **LLM cost per import higher than expected.** 500-row imports with catalog-slice prompt-caching could still run $0.20–$1.00 per import. Mitigation: measure on real data before launch; adjust model tier or batch size; consider gating by paid-tier after trial.
4. **Switchers' existing curation doesn't map.** If a switcher's Notisum list includes documents we've explicitly decided not to ingest (e.g. private-source documents per `feedback_no_private_deps.md`), they'll see them as "ej hittade" forever. Mitigation: surface a "we do not track this" rejection reason separately from pending-ingestion, with a link to our sourcing policy.

### Open Questions

- Should the onboarding branch choice be "Generera / Importera" side-by-side, or "Import" as a prominent secondary option under the generation primary? A/B-testable, but default position for v1 needed.
- Should imports preserve the source tool's free-text "kommentar" into Laglig's kommentar field? Lossless for users, but clutters the new workspace. Recommend yes; PM to confirm.
- Should the in-app create-list flow allow import for *additional* lists in the same workspace, or only at workspace creation? Recommend: any time. Validate with PM.
- What happens if a switcher imports, then 6 months later the source tool's document has a different SFS-nummer or has been superseded? Phase 3 question; out of MVP.

---

## Appendices

### A. Research References

- Competitor export-format survey: Notisum, JP Infonet, Lex.nu, Ramboll, Lagpunkten, Laglistan.se, DIBkunskap (sample exports from public demo accounts and prospect interviews TBC by PM).
- Related Laglig docs: `docs/lagefterlevnadskontroll-brief.md` (audit cycle module depends on a working laglista); `app/onboarding/_components/onboarding-wizard.tsx` (current onboarding flow); `feedback_no_private_deps.md` (sourcing policy that affects what we will/won't ingest).
- Activity question engine: `lib/onboarding/question-selector.ts` (current "generate from scratch" mode; gap-fill mode is a new variant).

### B. Stakeholders

- **Product**: PM to validate scope, prioritisation, and A/B test design for onboarding choice UI.
- **Architecture**: Architect to validate Excel parsing location, LLM model tier, placeholder `LawListItem` representation, and `DocumentIngestionRequest` schema.
- **Ops / Ingestion**: owner of the 24h SLA commitment and the ingestion admin queue UI. Needs to sign off on capacity assumptions before launch.
- **Sales**: primary internal customer; should validate that "import is self-serve" unblocks the switcher conversation they're currently stuck in.

---

## Next Steps

1. PM reviews and refines scope (particularly MVP core vs. out-of-scope boundary).
2. Architect reviews technical considerations, validates data model, decides on Excel parsing location and LLM model tier.
3. Ops team validates 24h SLA commitment and sizes initial capacity.
4. PM runs a small discovery with 3–5 real switcher prospects, collects real Notisum/Lex.nu exports to validate fuzzy+LLM match rates on actual data before committing to the >85% auto-match target.
5. Story decomposition: recommend splitting into (a) in-app import flow + `DocumentIngestionRequest` model, (b) onboarding wizard branch that embeds (a), (c) gap-fill activity-question mode, (d) ingestion admin queue. Build order: (a) → (d) → (b) → (c).
