# Epic 29: ISO Audit Companion — Agent Skills for Revision & Ledningens Genomgång (Brownfield Enhancement)

**Status: Planned (registered 2026-07-08).**

**Goal:** Extend the Epic 19 agent-skills layer with the three ISO-anchored moments the kontroller feature (Epic 21) does not yet serve conversationally: preparing for an **extern revision** (`prepare_audit`), assembling and drafting **ledningens genomgång** (`ledningens_genomgang`), and assisting *inside* a running **lagefterlevnadskontroll** (`periodic_review`). The connective tissue — cycle/finding read tools (absorbing scoped-but-unbuilt **Story 19.4b**), a `create_cycle`/`create_finding` proposal path, and a `CYCLE` chat context — ships alongside.

**Value:** The single most important question an external auditor asks is *"visa er senaste lagefterlevnadskontroll."* Today the agent cannot even see cycles: `lib/agent/tools/` has no cycle reader, so the workspace's strongest compliance evidence (`ComplianceAuditCycle` + findings + sealed reports, all modeled since Epic 21) is invisible to every skill. This epic makes the agent fluent in the customer's actual annual rhythm — **årshjulet**: löpande lagbevakning → periodisk kontroll → revision → ledningens genomgång — and speaks it in ISO vocabulary (*intern/extern revision, avvikelse, ledningens genomgång*), which is also the language that makes an auditor comfortable recommending the product (auditor channel strategy: win auditors through utility, not commission).

**Delivers:**

- **Cycle read tier** — `get_cycle(id)`, `get_finding(id)` (per the 19.4b `ContextHandle` lazy-traversal spec) plus `list_cycles` discovery (status/type/list/date filters), role-narrowed so AUDITOR seats get them read-only.
- **`prepare_audit` skill** — intent-activated global-chat skill that anchors extern-revision prep on cycle history (latest AVSLUTAD kontroll, open findings, `law_change_cutoff_date` diff), runs the four Epic 19 diagnostics as a supplementary sweep, and back-plans an action plan from the audit date.
- **`ledningens_genomgang` skill** — assembles the ISO 9.3.2 compliance-related inputs from workspace data (cycles, findings, lagändringar in period, action status, bevisluckor) and drafts the protokoll as a `REPORT`-type styrdokument through the existing `draft_styrdokument` machinery.
- **`ask_user` clarification chips** — the inverse of `suggest_followups` (14.10): the agent asks one question with 2–4 predefined answers rendered as tappable chips (recommended-first), free-text always available as the escape hatch. A shared chat primitive — Epic 29's skills are its first consumers; `draft_styrdokument` type selection and `gap_analysis` scoping can adopt it later.
- **`create_cycle` proposal path** — the agent can offer "ska vi planera en kontroll?" as a PendingAgentAction inline-approval card (additive `CREATE_CYCLE` enum value; dispatch to the existing cycle-creation server action).
- **`CYCLE` chat context + `periodic_review` skill** — chat on the cycle detail page with a context-primary skill that walks unreviewed items, drafts motiveringar, and proposes findings (`CREATE_FINDING`, gated on the 21.10 cycle-editable guard).

**Requirements covered:** Deepens Epic 19's AUDITOR-persona read tier (closes scoped Story 19.4b); conversational surface over Epic 21's data model; direct implementation of the auditor-channel strategy.

**Estimated stories:** 7 (two-phase: 29.1–29.4 incl. 29.2a ship both flagship skills read/propose-only against existing UI; 29.5–29.6 add the in-cycle assistant).

> **Sizing note (brownfield-create-epic guidance):** this exceeds the 1–3-story
> guideline for the lightweight brownfield path, but no architectural planning is
> required — every story composes existing, shipped patterns (skill files per 19.6/19.7,
> `ContextHandle` readers per 19.4, PendingAgentAction proposals per 14.23, additive
> Prisma enums). It follows the repo's established brownfield-epic register format
> (cf. Epic 28) rather than escalating to a full PRD/architecture cycle.

**Dependencies:**

- **Epic 19** (agent partner) — skill loader (19.6), `activate_skill` + registry narrowing (19.7a/c), diagnostics (19.3), entity readers + `ContextHandle` (19.4/19.4a), role registry + decision log (19.5), type-aware `draft_styrdokument` (19.8). All shipped. **Story 19.4b is absorbed by Story 29.1** — Epic 19's PRD explicitly sequences it "with the next Epic 21 work"; this is that work.
- **Epic 21** (lagefterlevnadskontroll) — `ComplianceAuditCycle` / `ComplianceAuditItem` / `ComplianceFinding` / `ComplianceAuditReport` models and cycle server actions, shipped. **Deferred Story 21.10** (assert-cycle-editable runtime guard) becomes a hard prerequisite for Story 29.6's `create_finding` dispatch — either 21.10 lands first or 29.6 implements the equivalent guard at the dispatch chokepoint.
- **Epic 14** (pending actions) — inline-approval card pattern + `PendingAgentActionType` additive-enum convention (14.23).
- **Epic 23** (anmärkningar first-class — planned, not started) — **coordination, not a blocker.** Epic 23 makes `cycle_id` nullable, adds `workspace_id`/`assignee_id`, ships the `/anmärkningar` registry + ad-hoc creation (item-anchored via CHECK constraint: ad-hoc findings must anchor to a law item/requirement, so cycle-less *and* item-less findings still won't exist — A10's EXTERN-cycle container for external audit results survives Epic 23 unchanged). If 23 lands first: 29.1's `get_finding` should return the post-23 shape (nullable cycle handle, assignee) and 29.6's dispatch should target the loosened `createFinding`. If 29 lands first: build readers tolerant of the coming nullable `cycle_id` (treat the cycle handle as optional from day one) so 23's migration doesn't break them. Note also the overlap in intent: 23's "kända vid start"/"öppna från tidigare kontroller" UI and 29's A3 anchor answer the same auditor question through different surfaces — they should share the same underlying query definition of "open finding relevant to scope X".
- **Migrations are applied manually by Alexander** — stories 29.3, 29.5, 29.6 each carry one additive enum migration; the story hands over the `prisma migrate deploy` command, never auto-applies.

**Priority:** High — `prepare_audit` is the strategy-aligned flagship (auditor channel + retention trigger); `ledningens_genomgang` is a deliverable customers pay consultants for today; both are mostly *authoring* once 29.1 lands.

**Source artefacts:** `docs/prd/epic-19-agent-partner-skills-subagents.md` (19.4b spec, risk register), `docs/architecture/epic-21-lagefterlevnadskontroll.md`, `docs/lagefterlevnadskontroll-brief.md`, `lib/agent/skills/README.md` (authoring contract), skill-structure working session 2026-07-08 (this doc is its BMAD projection).

---

## Epic Goal

Make the agent a participant in the customer's ISO year. Three skills, one for each moment the standard mandates — utvärdering av efterlevnad (9.1.2), revision (9.2 / extern certifieringsrevision), ledningens genomgång (9.3) — built on a thin cycle read tier, with laglig.se's existing change monitoring (Epic 8 + `assess_change`) already covering the fourth, continuous quadrant of årshjulet.

## ISO Framing — the conceptual model everything hangs on

ISO 14001:2015 / 45001:2018 / 9001:2015, clause 9 (*Utvärdering av prestanda*), gives the customer's compliance year its fixed structure. Laglig.se owns the **legal-compliance slice** of each activity — never the whole management system:

| ISO moment | Svenska | Laglig.se today | This epic adds |
| --- | --- | --- | --- |
| 6.1.3 / 9.1.2 — compliance obligations & evaluation of compliance | Lagbevakning + lagefterlevnadskontroll | Epic 8 monitoring + `assess_change` skill; Epic 21 kontroller UI (`AuditType.INTERN`) | `periodic_review` in-cycle skill (29.6) |
| 9.2 — internal audit | Intern revision | Epic 21 cycles cover the legal-compliance scope of intern revision | Cycle readers make results traversable (29.1) |
| — certification/surveillance audit (external body: certifierings-, övervaknings-, omcertifieringsrevision) | Extern revision | `AuditType.EXTERN` exists on the model; prep is entirely manual | **`prepare_audit`** (29.2) + `create_cycle` offer (29.3) |
| 9.3 — management review | Ledningens genomgång | Nothing — not modeled, not assisted | **`ledningens_genomgang`** (29.4) |

Two honesty rules follow from "the slice, not the system," and both are CRITERIA.md guardrails:

1. **Never claim audit-readiness** — the skills prepare the *legal-compliance* dimension; miljömål, resources, and interested-party communications are outside Laglig's data. Output says "lagefterlevnadsdelen är förberedd," not "ni är redo för revisionen."
2. **Never fabricate underlag** — ledningens genomgång inputs Laglig has no data for (ISO 9.3.2 c/e/f: objectives outcomes, resource adequacy, interested-party communications) are emitted as explicit *"fylls i av er"* placeholders in the protokoll draft, never generated.

## Personas

- **Maria — HR-/kvalitets-/miljösamordnare** (MEMBER/ADMIN). Owns the ISO calendar at a 20–80-person company. Runs kontroller, faces the external auditor, writes the genomgång protokoll. Thinks in ISO vocabulary (*avvikelse*, not "finding").
- **Den externa revisorn** (certification body — e.g. RISE/Kiwa/DNV), possibly holding a **free AUDITOR seat** (channel strategy). Role registry (19.5) already narrows AUDITOR to read + diagnostic tools — the cycle read tier lands inside that boundary automatically.
- **VD / ledningsgruppen** — consumers of the genomgång underlag + protokoll; never touch the chat themselves.

---

## User Journeys

### Journey A — Extern revision (flagship): `prepare_audit`

*ISO anchor: certification/surveillance audit; evidence chain 9.1.2 → 9.2. Skill activation: intent, via `activate_skill` from global chat (`contextTypes: []`).*

| # | Phase | What happens | Machinery |
| --- | --- | --- | --- |
| A1 | **Trigger** (T−6 veckor) | Revision date lands (ISO 45001 övervakningsrevision, 15 sep). Maria, global chat: *"Vi har extern revision 15 september, hjälp mig förbereda."* | `activate_skill('prepare_audit')` |
| A2 | **Scoping** (one exchange, max two questions) | Skill asks: audit **date** (typed — chips are wrong for dates) and **scope** as an `ask_user` chip card whose options are the workspace's *actual laglista names* + "Hela arbetsytan" (recommended-first); certifierings- vs övervakningsrevision if volunteered — surveillance narrows to changes-since-last. **Don't ask what the data answers:** one laglista ⇒ no scope question. Free text stays live under the chips (the "Other" escape hatch). | `ask_user` (29.2a), PROCEDURE.md step 1 |
| A3 | **Cycle-history anchor** (the ISO move) | Before any gap sweep: *do the AVSLUTAD INTERN cycles of the last 12 months **together** cover the scope?* Aggregate, not single-cycle — rolling kontroller (`scope_definition: groups/items`, e.g. a quarter of the list per quarterly cycle) are a diligence pattern, and four partial cycles that tile the list ARE current coverage. → **Covered:** open findings across those cycles become action-plan §1; the sealed reports are the evidence to bring. **Gap (whole list stale, or a tile missing):** that IS finding #1 — *"Er senaste kontroll av miljölistan avslutades för 14 månader sedan; revisorn kommer att be om en aktuell. Ska vi planera en?"* → `create_cycle` proposal (29.3; recommendation-only until then). | `list_cycles`, `get_cycle`, `get_finding` |
| A4 | **Cutoff diff** | `law_change_cutoff_date` of the anchor cycle vs today: *"Er senaste kontroll täckte ändringar t.o.m. 1 mars — 4 ändringar har kommit sedan dess och är obedömda."* Exactly the gap an auditor probes on the "how do you stay current?" question. | cycle field + `list_unassessed_changes` |
| A5 | **Supplementary sweep** | The four Epic 19 diagnostics, in severity order: unassessed changes → bevisluckor → stale styrdokument → overdue tasks. One readiness summary with true counts; count-0 reported positively. | `list_bevis_gaps`, `list_stale_documents`, `list_overdue` |
| A6 | **Guided triage** | Category by category, worst first, each item paired with an action: open avvikelse → chase its corrective task (deadline vs audit date), flag done-but-unclosed findings for verification (closing stays a human action via `closeFinding`), or propose a corrective task **linked back via `Task.compliance_finding_id`** where none exists; unassessed change → deep-link into change context (hand-off to `assess_change`, no duplication); bevislucka → drill in, `create_task` with owner; stale styrdokument → review task or hand-off to `draft_styrdokument`; overdue → `assign_task`. **Every task deadline back-planned from the audit date.** Maria can bail anytime — tasks persist, the plan survives the chat. | `get_finding`, `get_law_list_item`, `create_task` (+`findingId`), `assign_task` (all inline-approval) |
| A7 | **Deliverable** | Closing summary (plan, owners, dates) + a decision-log/context note: *"Revisionsförberedelse genomförd 8 aug: 9 åtgärder inför revision 15 sep."* The note is itself evidence that systematic preparation happened. | `add_context_note`, `decision_log` |
| A8 | **Re-run** (T−1 vecka) | *"Hur ligger vi till inför revisionen?"* Same skill re-runs the sweep, **diffs against A7's note** (*"5 av 7 bevisluckor åtgärdade, 2 kvar"*), chases stragglers. The re-run loop is what makes this a habit, not a one-off. | same reads + prior note |
| A9 | **Audit day** | Auditor asks for the senaste kontroll → Maria opens the sealed cycle + COMPLETE report + closed-findings trail. If the auditor holds an AUDITOR seat, they ran the same read-only sweep in their own cockpit beforehand (Journey D). | Epic 21 UI, no agent needed |
| A10 | **Post-audit capture** (closes the loop) | Maria returns with the revision report: *"Revisionen gav 2 avvikelser och 3 observationer."* The skill proposes recording it as an **EXTERN cycle** with the auditor's avvikelser as findings — system-level ones (e.g. "ingen aktuell lagefterlevnadskontroll") carry no law item, exactly the cycle-only grain — each with a corrective task. Next year's A3 anchor then starts from *"är avvikelserna från förra revisionen stängda?"* — the returning auditor's literal first question. **Note:** a `ComplianceFinding` requires a parent cycle, which is why the *prep-time* kontroll gap (A3) is an action-plan item + `create_cycle` proposal, never a manufactured finding record — findings enter the database only here, as the auditor's actual results. Full agent support needs 29.3 (`create_cycle`) + 29.6 (`create_finding`); until then the skill walks Maria through recording it in the kontroller UI. | `create_cycle` (29.3), `create_finding` (29.6), `create_task`, `decision_log` |

**CRITERIA.md (A):** never claim readiness while unassessed changes remain; always counts, never "vissa luckor"; scope honesty (rule 1 above); every proposed task carries owner + back-planned deadline; ISO vocabulary throughout.

### Journey B — Ledningens genomgång: `ledningens_genomgang`

*ISO anchor: 9.3 (planned intervals; documented information as evidence of results — hence the protokoll). Intent-activated, global chat.*

| # | Phase | What happens | Machinery |
| --- | --- | --- | --- |
| B1 | **Trigger** | Annual/semi-annual: *"Vi har ledningens genomgång nästa fredag, ta fram underlaget."* | `activate_skill('ledningens_genomgang')` |
| B2 | **Period determination** | Find the previous genomgång (decision-log note from the last run); confirm via `ask_user` chips — *"Sedan förra genomgången 12 juni 2025?"* → **Ja** (recommended) / **Annat datum**. Period = then → now. | `decision_log` read + `ask_user` (29.2a) |
| B3 | **Underlag assembly** (the core value) | Per ISO 9.3.2, each *compliance-related* input assembled from data Laglig already holds — see input-mapping table below. Output: structured summary in chat, per-section, with drill-in handles. | `list_cycles`, `get_cycle`, `get_finding`, period change reads (29.4 tool), `search_tasks`/`list_overdue`, `list_bevis_gaps` |
| B4 | **Protokoll draft** | Drafts the genomgång protokoll as a `REPORT`-type styrdokument via the `draft_styrdokument` machinery (19.8 type module `types/report.md` extension or sibling): assembled sections filled; out-of-data sections as *"fylls i av er"* placeholders (honesty rule 2); ISO 9.3.3 output prompts (beslut om förbättringar, resursbehov, åtgärder) left as structured empty sections for the meeting. Inline-approval card as with any draft. | `draft_styrdokument` → `DRAFT_DOCUMENT` pending action |
| B5 | **The meeting** | Ledningsgruppen meets with the underlag; decisions land in the protokoll's output sections (manually — the agent does not attend meetings). | — |
| B6 | **Close the loop** | Maria returns: *"Genomgången är klar, här är besluten…"* Skill proposes a task per decided action (ISO 9.3.3 outputs → workspace tasks) and logs the genomgång date as next year's B2 anchor. | `create_task`, `decision_log` |

**Awareness & depth model (applies to A5's readiness summary and B3's underlag alike):** the skills walk in *historically aware* — what changed, the workspace's recorded view of it, and how it played out — via three mechanisms: (1) **procedure-mandated reads**: PROCEDURE.md steps force the history pulls (A3/A4 cycle anchor + cutoff diff, B3 period assembly) so awareness is deterministic, not model-optional; (2) **stance-carrying records**: assessment rows carry the workspace's position (påverkansnivå, rekommendation, spawned tasks), so output fuses change + view + outcome ("AFS 2023:X bedömdes hög påverkan i april; åtgärden stängdes i juni"); (3) **loop-close markers**: A7/B6 notes are what the next run diffs against (A8's "5 av 7 åtgärdade", B2's period anchor). Within that, the reports **aggregate approved judgments — they do not re-derive them**. B3 reads assessment *records* (the `assess_change` conclusions saved with human approval at assessment time), cycle bedömningar/motiveringar, finding closure states, and task statuses — never the underlying law texts. Three reasons: (1) re-analysis at report time can contradict the approved record, the exact failure an auditor punishes — and ISO 9.3.2 asks for the *system's documented outputs*, not fresh analysis; (2) the 19.4 reader caps exist so one chat turn can't pretend to have deep-read a year of workspace history; (3) thin data must surface honestly — "3 av 14 ändringar bedömda" is itself a genomgång finding, never papered over. True deep-reads (per-assessment narrative paragraphs, per-finding evidence verification) are a **subagent fan-out concern** — see the Story 19.9/19.10 follow-on under Risk Mitigation — not a single-turn concern.

**ISO 9.3.2 input mapping** (what B3 assembles — the honest split):

| 9.3.2 input | Laglig data | Coverage |
| --- | --- | --- |
| a) status of actions from previous review | tasks created at last B6 | ✅ full |
| b) changes in external issues incl. **compliance obligations** | lagändringar in period + assessments (`assess_change` output) | ✅ full — Laglig's home turf |
| c) extent objectives met | — | ⬜ placeholder |
| d) **fulfilment of compliance obligations**; audit results; nonconformity/corrective-action trends | cycles completed in period, bedömningar (UPPFYLLD/DELVIS/EJ), findings opened/closed, corrective tasks | ✅ full |
| e) adequacy of resources | — | ⬜ placeholder |
| f) communications from interested parties | — | ⬜ placeholder |
| g) opportunities for improvement | bevisluckor trend, stale styrdokument | 🟡 partial (legal-compliance angle) |

### Journey C — In-cycle assistance: `periodic_review` (phase 2)

*ISO anchor: 9.1.2/9.2 execution. Context-primary on the cycle page (`contextTypes: [cycle]`) — the `assess_change` pattern applied to cycles.*

| # | Phase | What happens | Machinery |
| --- | --- | --- | --- |
| C1 | **Entry** | Maria opens a PÅGÅENDE cycle; chat is cycle-anchored; skill is auto-primary (like `assess_change` on a change). | `CYCLE` ChatContextType (29.5) |
| C2 | **Orientation** | *"Var var jag?"* → progress (12/45 granskade, 2 avvikelser öppna), suggests next unreviewed item. | `get_cycle` |
| C3 | **Item review** | Per item: agent pulls kravpunkter + bevis + senaste bedömning + changes since last cycle; Maria assesses; agent drafts **motivering** text in her tone for her to accept/edit. Sign-off stays a human UI action — the agent never signs. | `get_law_list_item`, `read_file` |
| C4 | **Avvikelse drafting** | On EJ_UPPFYLLD/DELVIS: agent proposes a finding (type, severity, description, root-cause prompt, corrective task suggestion) as an inline-approval card. **Gated on cycle-editable guard (21.10).** | `create_finding` pending action (29.6) |
| C5 | **Wrap** | At completion: findings summary, corrective tasks linked, points toward completing the cycle in the UI (agent never seals — separation of duties, same principle as the never-propose-APPROVED rule in 14.30). | `get_cycle`, existing UI |

### Journey D — The auditor seat (channel strategy, no new build)

The external auditor with a free AUDITOR seat runs Journey A's **read phases only** (A3–A5) in their own cockpit: role registry (19.5) already strips write + proposal tools from AUDITOR, so `prepare_audit` degrades gracefully to a pure readiness review — findings without task offers. Story 29.2 must verify this degradation explicitly (AC), but no auditor-specific code is built. An agent fluent in revisionsspråk giving the auditor pre-visit sight into cycle history *is* the utility play that makes them recommend Laglig.

### Årshjulet — how the journeys compose

```
            Q1                  Q2                  Q3                  Q4
   ┌─ Ledningens ─┐    ┌─ Kontroll #1 ──┐   ┌─ Extern ────────┐  ┌─ Kontroll #2 ─┐
   │  genomgång   │    │  (INTERN cykel) │   │  revision       │  │  (INTERN)     │
   │  Journey B   │    │  Journey C      │   │  Journeys A + D │  │  Journey C    │
   └──────┬───────┘    └───────┬─────────┘   └───────┬─────────┘  └───────┬───────┘
          └──── beslut→tasks ──┴── findings→tasks ───┴── åtgärder→tasks ──┘
   ─────────────── löpande: lagbevakning + assess_change (Epic 8/19, shipped) ──────────────
```

Each moment feeds the next: kontroll findings are what `prepare_audit` anchors on; cycle results + change assessments are what `ledningens_genomgang` assembles; genomgång decisions become the tasks the next kontroll verifies. Retention is structural — the product is load-bearing at four fixed points of the customer's year.

---

## Epic Description

### Existing System Context

- **Skills layer (Epic 19, shipped):** file-based skills in `lib/agent/skills/` (`SKILL.md` frontmatter: `contextTypes` for auto-primary, `tools` whitelist; `PROCEDURE.md` English, `STYLE.md` Swedish exemplars, `CRITERIA.md` guardrails, `types/*.md` modules per 19.8). Loader (19.6) validates once per process, skips bad skills with `console.warn`. `activate_skill` meta-tool (19.7a) + per-skill registry narrowing (19.7c). Three live skills: `assess_change` (context-primary on `change`), `gap_analysis`, `draft_styrdokument`.
- **Agent tools (~30):** entity readers on the `ContextHandle` lazy-traversal model (19.4/19.4a — node fully hydrated, neighbours as typed handles, 1 hop per call, hard caps, names-not-IDs); four diagnostics (19.3: `list_unassessed_changes`, `list_bevis_gaps`, `list_stale_documents`, `list_overdue` — all return true counts + capped lists, count-0 reported positively); write tools propose-only via `PendingAgentAction` inline-approval cards (14.23 — no `execute: true` path). **No cycle tools exist.**
- **Kontroller (Epic 21, shipped):** `ComplianceAuditCycle` (`audit_type INTERN|EXTERN`, `scope_definition`, `law_change_cutoff_date`, status `PLANERAD→PÅGÅENDE→AVSLUTAD`, `sealed_at`/`sealed_by` on completion), `ComplianceAuditItem` (efterlevnadsbedömning + motivering + review/sign-off), `ComplianceFinding` (type/severity, corrective-action task link, closure metadata incl. verification), `ComplianceAuditReport` (one `COMPLETE` per cycle, canonical JSON manifest + PDF/HTML paths). UI at `laglistor/kontroller`. **21.10 (assert-cycle-editable runtime guard) deferred to backlog.**
- **Chat contexts:** `ChatContextType = GLOBAL | TASK | LAW | CHANGE` (Prisma enum + `lib/agent/thinking-effort.ts` + `lib/hooks/use-chat-interface.ts`). No cycle context.
- **Roles (19.5):** `createAgentTools(workspaceId, userId, role)` filters the registry — AUDITOR: read + diagnostics only; MEMBER: +writes; ADMIN/OWNER/HR_MANAGER: all. `AgentDecisionLog` records every tool call.
- **Styrdokument types:** `WorkspaceDocumentType` already includes `REPORT` — genomgång protokoll needs no enum change.

### Enhancement Details

- **What's being added:** 3 read tools, 2 proposal (write) tools with additive `PendingAgentActionType` values, 1 additive `ChatContextType` value + page wiring, 3 skill directories (pure authoring), 1 type module for `draft_styrdokument`.
- **How it integrates:** every piece composes a shipped pattern — readers follow 19.4's `ContextHandle` conventions; proposals follow 14.23's pending-action helper (`createPendingActionRow`) and dispatch to **existing Epic 21 server actions** (no new mutation paths); skills follow the 19.6/19.7 authoring + narrowing contract; the `CYCLE` context follows however `CHANGE` is wired today.
- **Success criteria:** (1) In a seeded workspace with an aged AVSLUTAD cycle + open findings + unassessed changes, "vi har revision 15/9" activates `prepare_audit` and yields a cycle-anchored readiness summary with true counts and back-planned task proposals within one conversation. (2) `ledningens_genomgang` produces a protokoll draft whose ✅-mapped 9.3.2 sections are populated from real workspace data and whose out-of-data sections are explicit placeholders — zero fabricated content. (3) An AUDITOR-role user can run the `prepare_audit` sweep and receives findings without write proposals. (4) Sealed (AVSLUTAD) cycles are never mutated by any agent path.

---

## Stories

Two phases; a real value cut after 29.2 (flagship works read-only after two stories).

**Phase 1 — flagship skills over existing UI (29.1–29.4)**

1. **Story 29.1 — Cycle read tier: `get_cycle`, `get_finding`, `list_cycles`** *(absorbs Story 19.4b — closes it in Epic 19's DoD).* `get_cycle(id)` → own state (name, type, status, scope, dates, `law_change_cutoff_date`, progress counts, lead auditor *name*) + handles to items/findings/reports/linked tasks; `get_finding(id)` → own state (type, severity, description, root cause, closure metadata) + handles to law-item/requirement/corrective task. `list_cycles({status?, auditType?, lawListId?, completedAfter?})` — the discovery entry point 19.4b never scoped but `prepare_audit`'s A3 anchor requires; each row carries a `scope_definition` summary (kind + group/item counts) so the skill can evaluate **aggregate coverage** across rolling partial cycles (A3), not just find the latest one. Same caps/conventions as 19.4; registered for AUDITOR and above; decision-log wrapped. **Plus one small write delta:** `create_task` gains an optional `findingId` param threaded through the CREATE_TASK proposal → dispatch → `Task.compliance_finding_id` (wired 1:1 since Story 21.8 but invisible to the agent today) — without it, agent-proposed corrective tasks in A6 would be orphans that never register as the finding's åtgärd. Finding traversal is cycle-first: `cycle_id` is the finding's required FK, the law list item only its optional pointer — so A3 costs three hops (`list_cycles` → `get_cycle` finding handles → `get_finding`), no law-list walk. **No schema changes.**
2. **Story 29.2a — `ask_user` clarification chips.** The inverse of `suggest_followups` (14.10): a client-side ephemeral tool (`question` + 2–4 `options`, one optionally `recommended`) rendered as answer chips in the assistant message; chip tap sends the option text as the user's message (same `onSelect` → send mechanic as `followup-chips.tsx`); the free-text input stays live underneath as the built-in "Other". One tool + one component (sibling of `followup-chips.tsx`) + one render case in `chat-message.tsx` — no DB, no pending-action row, no schema. Usage guardrails documented in the tool description and consumed by skill CRITERIA: **only for genuinely user-owned decisions** (never ask what workspace data answers — one laglista ⇒ no scope question), **options populated from real workspace data** (actual laglista names), recommended-first, max one card per turn, never for dates (typed is faster). AC: AUDITOR role receives it (it's a read-tier interaction, not a write). Retrofit of `draft_styrdokument` type selection and `gap_analysis` scoping is enabled but out of scope. **No schema changes.**
3. **Story 29.2 — `prepare_audit` skill.** Skill directory (`contextTypes: []`; tools: the 29.1 trio + `ask_user` + four diagnostics + `get_law_list_item`, `create_task`, `assign_task`, `add_context_note`, `decision_log`). PROCEDURE.md encodes Journey A phases A2–A8 (scoping via `ask_user` scope chips → anchor → cutoff diff → sweep → triage → note → re-run diff); STYLE.md: calm checklist tone, revisionsspråk, Swedish exemplars; CRITERIA.md: the guardrails under Journey A incl. the don't-ask-what-data-answers rule. AC includes the AUDITOR degradation check (Journey D) and the "no recent cycle → recommendation-only" branch (until 29.3 the skill recommends creating a cycle in the UI, no proposal card). **Pure authoring — no code beyond the manifest regen. Deps:** 29.1, 29.2a.
3. **Story 29.3 — `create_cycle` proposal path.** Additive `PendingAgentActionType.CREATE_CYCLE`; tool proposes a PLANERAD cycle (name, type, law list, scope, back-planned schedule, lead auditor) via `createPendingActionRow`; approval card renders the proposal; dispatch calls the existing cycle-creation server action. `prepare_audit`'s whitelist + PROCEDURE gain the offer branch. **One additive migration — handed to Alexander, never auto-applied.**
4. **Story 29.4 — `ledningens_genomgang` skill + period reads.** New/extended read for "changes in period incl. assessments" (extend the unassessed-changes loader or add `list_changes_in_period` — implementer's call, same conventions); skill directory encoding Journey B (period anchor via decision log, 9.3.2 assembly per the mapping table, placeholder honesty, B6 loop-close); protokoll via `draft_styrdokument` as `REPORT` type with a genomgång type module (19.8 pattern). **No schema changes.**

**Phase 2 — the in-cycle assistant (29.5–29.6)**

5. **Story 29.5 — `CYCLE` chat context.** Additive `ChatContextType.CYCLE` (Prisma + the two TS unions + thinking-effort + prompt-builder context-primary path + chat route context resolution); chat mounts on the cycle detail page anchored to the cycle. Mirrors the existing `CHANGE` wiring. **One additive migration — handed to Alexander.**
6. **Story 29.6 — `periodic_review` skill + `create_finding` proposal.** Additive `PendingAgentActionType.CREATE_FINDING`; proposal card + dispatch to the existing `createFinding` server action, **gated on the cycle-editable guard — 21.10 lands first or this story implements the equivalent check at the dispatch chokepoint (AVSLUTAD ⇒ reject)**. Supports **both finding grains** `createFinding` already allows: item-linked (`lawListItemId`/`requirementId`, the item-walk case) and cycle-level/system findings (no item — process observations like "bevisinsamlingsrutinen brister", the grain external auditors raise as systemkrav-avvikelser). Also whitelisted to `prepare_audit` (+ PROCEDURE addendum) to enable Journey A10's post-audit capture: recording the external auditor's avvikelser as findings on an EXTERN cycle. Skill (`contextTypes: [cycle]`) encodes Journey C: orientation, item walk, motivering drafting, avvikelse proposal; agent never signs off items, never completes/seals cycles (CRITERIA + no such tools whitelisted). **One additive migration — handed to Alexander.**

## Compatibility Requirements

- [x] Existing APIs unchanged — new tools only add registry entries; dispatches call existing Epic 21 server actions.
- [x] Schema changes are additive enum values only (`CREATE_CYCLE`, `CREATE_FINDING`, `CYCLE`) — backward compatible; migrations applied manually by Alexander per standing rule.
- [x] UI changes follow existing patterns — approval cards reuse the 14.23 card system; cycle-page chat reuses the change-page chat mount.
- [x] Performance impact minimal — reads are capped like every 19.4 reader; skills are deploy-static files.
- [x] Kontroller UI untouched in phase 1; sealed-cycle immutability (21.26/21.27) respected by construction (read-only in phase 1, guard-gated in 29.6).

## Risk Mitigation

- **Primary risk — trust damage from a wrong compliance claim** (false "ni är redo" or fabricated underlag before an audit or board meeting). *Mitigation:* CRITERIA.md honesty rules are per-skill checklists the agent must pass before concluding (scope honesty, no-fabrication placeholders, counts-not-vagueness, never-readiness-with-open-unassessed); all writes are propose-only behind human approval; `AgentDecisionLog` records every call for forensics.
- **Tool-registry bloat** (Epic 19 Risk 4: routing degrades at 30+ tools) — +5–6 tools on ~30. *Mitigation:* per-skill registry narrowing (19.7c) already bounds what any activated skill sees; `list_cycles`/`get_cycle`/`get_finding` are AUDITOR-tier reads, the same narrowing that keeps the global registry sane.
- **Sealed-cycle mutation via agent path.* *Mitigation:* phase 1 is read-only; 29.6 explicitly gated on the 21.10 guard (or dispatch-level equivalent) with an AC asserting AVSLUTAD ⇒ proposal rejected.
- **Rollback:** skills are files — deleting a skill directory (+ manifest regen) removes it with zero code risk (loader skips absent/bad skills by design). Tools are registry entries — unregistering removes exposure. Enum values are additive and inert if unused.

**Follow-on (not in this epic): deep underlag build via subagent fan-out.** When Epic 19's subagent runner (19.9) and fan-out pattern (19.10) land, `ledningens_genomgang` can gain a depth tier: one subagent per assessment record producing a narrative paragraph, one per closed finding verifying its corrective evidence exists (via `read_file`), synthesized by the main agent — depth through parallel isolation (≤2k-token summaries, capped concurrency per 19.10's cost guardrails), not through one context pretending to hold a year. Register as a story only after 19.9 ships.

## Definition of Done

- [ ] All 7 stories completed with ACs met; **Story 19.4b marked closed in Epic 19's DoD** (delivered as 29.1).
- [ ] Journey A demo passes end-to-end on a seeded workspace (success criterion 1), including the no-recent-cycle branch and the A8 re-run diff.
- [ ] Journey B protokoll draft passes the placeholder-honesty check (criterion 2) against the 9.3.2 mapping table.
- [ ] AUDITOR-role degradation verified (criterion 3); sealed-cycle immutability verified (criterion 4).
- [ ] Skill files pass the bilingual rule (PROCEDURE English / STYLE Swedish) and Swedish copy reads naturally to an HR user (no stiff derived nouns — genomgång vocabulary per STYLE.md exemplars).
- [ ] `epic-list.md` updated; skills manifest regenerated; no regression in existing skills (`assess_change`, `gap_analysis`, `draft_styrdokument`).

---

## Story Manager Handoff

"Please develop detailed user stories for this brownfield epic. Key considerations:

- Enhancement to an existing Next.js/Prisma/Supabase system with a shipped file-based agent-skills layer (Epic 19) and a shipped kontroller data model (Epic 21) — this epic is connective tissue, not new architecture.
- Integration points: `lib/agent/tools/` registry + role narrowing (`createAgentTools`), `lib/agent/skills/` authoring contract (README + `_template/`), `PendingAgentAction` proposal/dispatch chokepoint, Epic 21 cycle/finding server actions, `ChatContextType` wiring (mirror CHANGE).
- Existing patterns to follow: 19.4 `ContextHandle` lazy readers with hard caps and names-not-IDs; 19.3 diagnostics' true-count + positive-zero convention; 14.23 propose-only writes; 19.8 type modules for `draft_styrdokument`; 14.10's chip render/send mechanic (`followup-chips.tsx`) inverted for `ask_user`.
- Critical compatibility requirements: additive-only enum migrations handed to Alexander (never auto-applied); sealed (AVSLUTAD) cycles immutable through every agent path (29.6 gated on 21.10 or equivalent guard); agent never signs off items, seals cycles, or approves documents (separation of duties per 14.30 precedent); AUDITOR role receives reads only and skills must degrade gracefully.
- The user journeys in this document (A–D + årshjulet) are the acceptance backbone — each phase row maps to testable behavior; CRITERIA.md guardrails are the honesty contract protecting audit-context trust.
- Each story must include verification that existing skills and the kontroller UI remain intact.

The epic should maintain system integrity while making the agent a fluent participant in the customer's ISO year — kontroll, revision, ledningens genomgång — on top of data the product already holds."
