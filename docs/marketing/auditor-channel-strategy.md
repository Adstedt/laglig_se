# Auditor Channel Strategy

**Decision (2026-06-18):** Win auditors as a distribution channel by making laglig the most
*auditor-friendly* compliance platform in Sweden — competing on utility, not commission.
Auditors who experience a laglig client audit going faster, and who get tooling that makes their
own practice more efficient, will recommend us to clients the way they recommend Notisum today.

## Thesis

The auditor is not a user — they are a **channel** we currently lose to Notisum. Notisum is the safe
default because it produces an ISO-satisfying law list and keeps it updated. But Notisum is a *legal
database*: it gives the client a list of laws and gives the auditor nothing across clients.

We win the channel by being a *management system*, not a database — and specifically by making the
auditor's own job and own practice measurably easier. We do **not** buy the recommendation with
commission (see Economics).

## Design north-star

> Every auditor interaction answers their question, in clause language, with a citation to a real
> record, without the customer in the loop.

This is the filter for whether any feature is "auditor-friendly." If it requires the customer to be
present, or it produces prose without a record behind it, or it doesn't map to how an auditor thinks
(clauses, dates, evidence), it doesn't count.

## What we already have (foundation)

- `AUDITOR` role — read-only + `activity:view` + `ai:chat`
- Epic 21 audit cycles (`ComplianceAuditCycle`, INTERN/EXTERN, lead auditor, sign-off, sealing)
- Findings: `AVVIKELSE` / `OBSERVATION` / `FORBATTRING` with lifecycle
- Immutable trails: `ActivityLog`, `ComplianceStatusLog`, `ChangeAssessment`, `kravpunkter_snapshot`
- Evidence linking: `RequirementEvidenceLink` (file or styrdokument)
- Revisionsrapport renderer with internal/external variants → PDF/HTML

Gap is not data — it's surfacing the data to an outside auditor on their timeline.

## The auditor-friendly build sequence

1. **External auditor portal / invite** — scoped, time-boxed magic-link granting the `AUDITOR` view
   of one cycle or law list, expiring on a date, fully logged. Removes the customer as bottleneck.
   *Prerequisite for everything else: one auditor identity that can span workspaces.*
2. **Multi-client auditor cockpit** — one login, all granted client workspaces, showing
   audit-readiness, upcoming cycles, open AVVIKELSE, evidence gaps. This is the feature that flips an
   auditor into a promoter: every client they move onto laglig makes their cockpit more valuable —
   a flywheel Notisum's per-company-database model structurally cannot match.
3. **Audit Q&A grounded in records** — purpose-built AI mode answering *only* from workspace records,
   citing the row. ("Which kravpunkter changed status since last cycle, who, why?" → ComplianceStatusLog.)
   Returns citations, never free-generated claims.
4. **Point-in-time "as of audit date" view** — replay what a law list / requirement / approved
   styrdokument looked like on a given date, using snapshots + logs. Also our anti-backfill defensibility.
5. **Audit-readiness dashboard (customer-facing)** — flags every `bevis_required` kravpunkt with no
   evidence, every UPPFYLLD with no narrative, every overdue open AVVIKELSE. "Fix gaps before the
   auditor finds them." Fastest to ship; useful even before the portal exists.

## Credibility requirements (non-negotiable)

- **Authentic legal sourcing** — official SFS source, always. (Direction of the recent
  `link to authentic SFS source` work.) An auditor won't stake a recommendation on law text they can't trust.
- **Reliable lagbevakning** — the change-event / `ChangeAssessment` pipeline must visibly never miss an
  amendment. One missed SFS change and the recommendation evaporates.
- **Speak in clauses** — map features to ISO clause numbers (14001/45001 §6.1.3, §9.1.2) everywhere.

## Economics — utility first, no undisclosed commission

A naked commission contaminates the independence that makes the recommendation valuable, and is a
conflict under ISO 17021 (certification bodies) / Revisorsinspektionen's analysmodell (revisorer).
It would attract the least credible recommenders and repel the most credible. Structures, by defensibility:

1. **Utility-only (default for all auditor types)** — free auditor seats + cockpit. Compensation is
   tooling and time saved.
2. **Transparent reseller/agency margin (consultant segment)** — auditor manages the client's
   subscription at a partner discount; disclosed commercial relationship, not a kickback.
3. **Disclosed referral fee** — only ever disclosed. Never undisclosed.

Lead with #1. Offer #2 to consultants who want real economics. Never do an undisclosed #3.

## Open questions to validate before building the program

- **Which auditor type drives the Notisum recommendations we see?** (ISO/arbetsmiljö consultants =
  lots of economic room; certification-body auditors = utility + disclosure only.) Determines program design.
- Verify Swedish specifics: ISO 17021 impartiality, Revisorsinspektionen analysmodell.
- Notisum's current auditor/partner offering (if any) — sharpen the wedge.
