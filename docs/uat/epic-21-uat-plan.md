# Epic 21 — Lagefterlevnadskontroll UAT Plan

**Status:** Ready for UAT — 2026-04-28 (revised post Stories 21.26 + 21.27: lifecycle collapsed from 5 to 3 states; SEAL ceremony + ARKIVERAD removed)
**Author:** Sarah (PO)
**Scope:** Validate that the compliance-audit cycle module (PLANERAD → PAGAENDE → AVSLUTAD lifecycle, Items / Findings / Rapport / Aktivitet tabs, sign-off authorization, revisionsrapport HTML + PDF) behaves correctly across all five workspace roles before promoting Epic 21 to production.

---

## 0. Pre-flight

**Environments:**
- Run UAT against staging or a dedicated test workspace in production. Do NOT use a customer-bearing workspace for the seal/archive flows — sealed cycles are immutable and a misconfigured fixture will pollute the activity log.
- Confirm Supabase has all 4 Epic 21 migrations applied (see `docs/migrations/epic-21-supabase-applies.md`):
  - `20260422090000_add_compliance_audit_cycle`
  - `20260422120000_add_compliance_audit_item_unique_cycle_lawitem`
  - `20260424030000_add_compliance_audit_report_unique_cycle_kind`
  - `20260426120000_add_compliance_audit_cycle_description`

**Test data prerequisites:**
- 1 workspace with 5 members covering all 5 roles: OWNER, ADMIN, HR_MANAGER, MEMBER, AUDITOR.
- 1 LawList with at least 8 LawListItems, of which:
  - At least 2 items have a `responsible_user_id` set to a MEMBER role user (call them MEMBER_A, MEMBER_B).
  - At least 2 items have `responsible_user_id` = null.
  - At least 1 item has 2+ kravpunkter with `bevis_required: true` and zero linked evidence (drives the "Saknar bevis" pill + `INTEGRITY-001` flow).
  - At least 1 styrdokument linked as evidence is in DRAFT status (drives the v0.5 INTEGRITY-001 override path).

**Tooling:**
- Two browser sessions (incognito + regular) so you can switch between roles without logging out repeatedly.
- DevTools network tab open for the seal flow — useful for confirming the seal hash is delivered server-side.

---

## 1. Cycle creation + materialisation (Stories 21.3, 21.4)

| # | Action | Expected | Role |
|---|---|---|---|
| 1.1 | Click **Skapa kontroll** from `/laglistor` header | Wizard opens at `/laglistor/kontroller/skapa` Step 1 | OWNER, ADMIN, HR_MANAGER, MEMBER (button hidden for AUDITOR) |
| 1.2 | Step 1: enter Namn, leave Bakgrund empty, pick laglista, pick INTERN, set scheduled-start + scheduled-end + cutoff date, pick lead auditor → Nästa | Advances to Step 2 with scope selector | OWNER |
| 1.3 | Step 1: enter a multi-line Bakgrund value (e.g. "Triggad av Q1 miljötillbud.\nÅrlig ISO 14001-kontroll per ledningsbeslut 2026-02-12.") | Character counter increments; helper text reads "Visas i revisionsrapportens inledning." | OWNER |
| 1.4 | Step 2: select scope = "Alla dokument", Nästa | Advances to Confirm step | OWNER |
| 1.5 | Step 3: verify Confirm step shows the Bakgrund value in the Detaljer dl (only when set) | Bakgrund row visible only if non-empty/non-whitespace | OWNER |
| 1.6 | Click **Skapa kontroll** | Redirects to `/laglistor/kontroller/{cycleId}`; status badge reads `Pågående`; items tab populated with N rows matching scope | OWNER |
| 1.7 | Repeat 1.2–1.6 with `auditType = EXTERN` and a different scope (groups OR items) | EXTERN label appears in detail header; scope summary in revisionsrapport reflects the selection | OWNER |
| 1.8 | As MEMBER, click Skapa kontroll on `/laglistor` header | Button is enabled (MEMBER has `tasks:edit`); wizard works | MEMBER |
| 1.9 | As AUDITOR, navigate to `/laglistor` | Skapa kontroll button is hidden; direct-URL access to `/laglistor/kontroller/skapa` redirects to `/laglistor` | AUDITOR |
| 1.10 | (Edge) Submit wizard with end-date < start-date | Inline error "Slutdatum måste vara lika med eller efter startdatum"; no cycle created | OWNER |
| 1.11 | (Edge) Bakgrund > 2000 chars | Inline error "Max 2000 tecken"; no cycle created | OWNER |

---

## 2. Cycle detail page + Items tab (Story 21.5)

| # | Action | Expected | Role |
|---|---|---|---|
| 2.1 | Open a PAGAENDE cycle | Header shows cycle name, status badge `Pågående`, audit type, period, lead auditor avatar+name, findings count chip; Bakgrund text wraps under MetadataChips when set | All |
| 2.2 | Verify items table | Virtualised at 100+ items, `rounded-md border` wrapper, vertical-centered cells | OWNER |
| 2.3 | Click a row → cycle-item modal opens (split-panel) | Right panel "Signera bedömning" card visible at top, prereq pills shown if Bedömning or Motivering missing | OWNER |
| 2.4 | Set Bedömning = UPPFYLLD, write Motivering ≥ 1 char, click **Signera** | Row shows ✓ + signer name + timestamp; activity log captures `cycle_item_signed_off` | OWNER |
| 2.5 | (NEW — sign-off authz) | | |
| 2.5a | Login as MEMBER_A (responsible user of item X) | Signera button enabled on item X, disabled on items where MEMBER_A is not lead auditor and not responsible user | MEMBER_A |
| 2.5b | Hover the disabled Signera button | Tooltip reads "Endast ansvarig revisor, dokumentets ansvarige eller administratörer kan signera" | MEMBER_A |
| 2.5c | Login as MEMBER (not lead, not responsible for any item) | All Signera buttons disabled; tooltip same as 2.5b | MEMBER |
| 2.5d | Login as the cycle's lead auditor (e.g. HR_MANAGER who happens to be lead) | All Signera buttons enabled regardless of responsible user | HR_MANAGER |
| 2.5e | Login as OWNER (escape hatch) | All Signera buttons enabled regardless of responsible user | OWNER |
| 2.5f | Bypass attempt: as MEMBER who is neither lead nor responsible, right-click the disabled Signera button → Inspect → delete the `disabled` attribute → click it | Server rejects with Swedish error toast: *"Endast ansvarig revisor, dokumentets ansvarige eller administratörer kan signera."*; no row mutation. (Note: server-side gate is also covered by unit tests in `app/actions/__tests__/compliance-audit-item.test.ts` — this manual step is a visual sanity check only.) | MEMBER |
| 2.6 | Click the X (unsign) on a signed row, repeat the matrix from 2.5 | Same authz applies (symmetric); error string ends with "ångra signering." instead of "signera." | All |
| 2.7 | Bedömning + Motivering inline edits | Save on blur; activity log captures the diff | OWNER |
| 2.8 | Open the cycle-item modal's left panel — kravpunkter section | Each kravpunkt row shows linked-evidence count; rows with `bevis_required && evidence.length === 0` show a "Saknar bevis" pill (post-shipping addendum) | OWNER |
| 2.9 | Click the "Saknar bevis" pill | FindingEditor opens pre-filled with item + kravpunkt id; finding type defaults to AVVIKELSE | OWNER |
| 2.10 | Right panel "Att uppmärksamma" card | Shows bevis-gap count, open-findings count, last-reviewed timestamp (replaced the old "Hälsa" box) | OWNER |
| 2.11 | Right panel "Snabblänkar" card | Three links visible: Fråga Lexa (opens chat), lagbok, historik | OWNER |

---

## 3. Findings (Story 21.7) + Auto-spawn corrective action (Story 21.8)

| # | Action | Expected |
|---|---|---|
| 3.1 | Create a finding of type AVVIKELSE with severity MAJOR | Activity log entry `finding_created` + `finding_task_spawned`; Task auto-created in workspace's leftmost non-Done column with priority HIGH; assignee = item responsibleUser (or lead auditor fallback); right-rail "Länkade kontroller" card shows the cycle |
| 3.2 | Create a finding of type OBSERVATION | NO task spawned (only AVVIKELSE auto-spawns) |
| 3.3 | Verify the spawned Task on the Kanban board | `compliance_finding_id` FK present on the Task; right-rail card shows the originating cycle |
| 3.4 | Mark a finding as resolved (CTA: **"Markera som åtgärdat"**, replaces legacy "Stäng") | Button text reads **"Markera som åtgärdat"** on open-finding rows; finding status flips to closed in UI; Task status remains as-is (the finding-level state, not Task state); activity log captures `finding_closed` (internal action name unchanged); success toast: *"Anmärkning markerad som åtgärdad"*. **Phase 2 / Epic 23 foundation:** the resulting badge varies based on closure metadata: **Åtgärdad** (slate, no icon) when both `verification_note` and `close_reason` are NULL; **Åtgärdad ✓** (emerald, check icon) when `verification_note` is supplied via verify path; **Avskriven** (muted-slate, strike-through) when `close_reason` is supplied via manual-override path. |
| 3.4a | Click **"Markera som åtgärdat"** on an AVVIKELSE whose linked task is NOT yet done | `ManualCloseFindingDialog` opens with title **"Markera som åtgärdat utan slutförd uppgift"** and required textarea labelled "Anledning för manuell stängning *". Submit CTA reads **"Markera ändå"**. Empty/whitespace-only reason disables submit. On submit, `closeFinding` is called with `closeReason`; activity log captures `finding_closed` with the reason in `newValue`; success toast: *"Anmärkning markerad som åtgärdad med manuell anledning"*. **Phase 2 result:** finding renders the **Avskriven** badge (muted-slate, strike-through). |
| 3.5 | Verify a finding (Verifiera flow) | "Verifiera" button appears only when a finding is `ready-to-verify` (linked task `completed_at != null`). Dialog renders the task title as a **clickable link** that opens `/tasks?task={id}` in a **new tab** (target=_blank, rel=noopener noreferrer). Verifieringskommentar field is currently optional (frivilligt) — required-rule adjustment is tracked separately as a known mismatch. Submit CTA reads **"Bekräfta åtgärd"** (replaces legacy "Verifiera och stäng"). Activity log captures `finding_verified` with the verification note (when supplied) in `newValue`. **Phase 2 result:** when a `verification_note` is submitted, finding renders the **Åtgärdad ✓** badge (emerald + check icon); empty submit yields plain **Åtgärdad** badge. |
| 3.5a | Re-open a closed-verified finding (or a closed-dismissed finding) | Activity log captures `finding_reopened`. Both `verification_note` AND `close_reason` columns clear in DB. Row badge returns to **Öppen** (no badge — open is implicit) OR **Redo att verifiera** if linked task is still `completed_at != null`. Subsequent close via the verify path repopulates `verification_note`; via manual override repopulates `close_reason`. |
| 3.6 | Re-open a closed finding | Idempotent; activity log captures the diff |
| 3.7 | Filter chips at top of Findings tab | Type + severity + state chips toggle correctly |
| 3.8 | Click Redigera on a finding, edit description / root cause / due date in the dialog, click Spara | Dialog closes; row updates with the new values; activity log captures the diff |

---

## 4. Cycle lifecycle — Complete + Revert (Story 21.6)

| # | Action | Expected | Role |
|---|---|---|---|
| 4.1 | Cycle status = PAGAENDE, all items signed | Åtgärder dropdown shows "Slutför kontroll" enabled | Lead auditor or OWNER |
| 4.2 | Click "Slutför kontroll" | Status flips to AVSLUTAD; **items become read-only** (bedömning/motivering inputs disabled, sign-off buttons hidden); banner reads "Kontrollen är avslutad. Återställ till pågående för att redigera." on the **Dokument tab only**; activity log captures `cycle_completed`. **Story 21.26**: completeCycle ALSO populates `sealed_at` + `sealed_by_user_id` (was: sealCycle's job). An eager PDF generation kicks via `after()` — within ~30-60s the rapport PDF appears in Supabase Storage; subsequent downloads are immediate. Confirmation dialog's open-work advisory uses forward-looking phrasing **"Följs upp efter avslutad kontroll: N öppna anmärkningar…"** (replaces legacy "Just nu: …"). Open findings do **not** block completion — items signed-off is the sole gate. **Phase 2 / Epic 23: findings tab remains interactive on AVSLUTAD** — Markera som åtgärdat / Verifiera / Redigera / Skapa åtgärdsuppgift / Återöppna all continue to work. The Lägg till anmärkning button is still rendered. The cycle-wide AVSLUTAD reassurance banner ("Kontrollen är slutförd. Öppna anmärkningar fortsätter att följas upp…") sits above the tabs and persists across all four tabs. | Lead auditor or OWNER |
| 4.2a | On the AVSLUTAD cycle, switch between Dokument / Anmärkningar / Rapport / Aktivitet tabs | The amber AVSLUTAD reassurance banner appears between header and tab strip on **all four tabs**, reading *"Kontrollen är slutförd. Öppna anmärkningar fortsätter att följas upp — bedömningarna bygger på dagens snapshot."* Items tab additionally shows the legacy items-readonly banner inside the tab body. **Findings tab does NOT show a readOnly banner** (Story 21.27: findings have no cycle-status read-only mode any more); per-row finding actions stay interactive. Banner disappears if cycle reverts to PAGAENDE; reappears if completed again. **Story 21.27 — SEALED + ARKIVERAD states removed**; AVSLUTAD is the only terminal active state. | All roles |
| 4.3 | Cycle status = AVSLUTAD, click "Återställ till pågående" | Status reverts to PAGAENDE; activity log captures `cycle_reverted_to_pagaende` | Lead auditor or OWNER/ADMIN |
| 4.4 | (Edge) MEMBER who is NOT lead auditor attempts revert | Dropdown item disabled with tooltip; if bypassed via API call, server returns Swedish error |
| 4.5 | Try to slutför when not all items signed | Dropdown item disabled with tooltip explaining the gate; server-side enforcement also rejects |

---

## 5. Cycle seal (REMOVED — Story 21.26)

Story 21.26 collapsed the SEAL state into AVSLUTAD as the terminal active state. The cryptographic seal_hash ceremony is gone; the SealCycleDialog (with override panels) is gone; the `audit:seal` permission is gone. AVSLUTAD now records `sealed_at` + `sealed_by_user_id` and triggers eager PDF generation in one step.

What replaces this section's coverage:
- **Section 4.2** (cycle completion) extended to assert that completeCycle populates `sealed_at` + `sealed_by_user_id` AND kicks the eager PDF generation. Test the seal-equivalent behavior there.
- **Section 6** (Rapport) — PDF is generated on `cycle_completed` (was: on `cycle_sealed`).
- **Section 8** (Permissions matrix) — `Can seal cycle?` column dropped; revert + complete are gated by `tasks:edit` + the runtime lead-auditor override.

Section 5's pre-Story-21.26 rows (SealCycleDialog, INTEGRITY-001 override panels, evidence-deletion-blocked-by-SEALED-cycles) are intentionally not retested — that surface no longer exists.

---

## 6. Revisionsrapport (Story 21.11 + 21.12 PDF)

| # | Action | Expected |
|---|---|---|
| 6.1 | Open the Rapport tab on a PAGAENDE cycle | Placeholder "Rapporten genereras när kontrollen är avslutad" |
| 6.2 | Open the Rapport tab on an AVSLUTAD cycle | iframe renders the HTML revisionsrapport with all sections |
| 6.3 | Verify section order | Titelsida → Bakgrund och syfte (only if cycle.description set) → Innehåll (TOC) → Omfattning → Kriterier/Revisionskriterier → Metod/Metodik → Sammanfattning → Avvikelser → Observationer → Förbättringsförslag → Styrkor → Konklusion → Signering/Signatarer |
| 6.4 | Cycle with no Bakgrund description | Bakgrund och syfte section AND its TOC entry omitted entirely (byte-exact preserved) |
| 6.5 | Cycle with multiline Bakgrund | Newlines preserved as `<br/>` in the rendered section; HTML is escaped (try injecting `<script>` to verify) |
| 6.6 | INTERN vs EXTERN cycle | Six labels swap (Kontrolledare vs Revisionsledare, Kontrolltyp vs Revisionstyp, Kriterier vs Revisionskriterier, etc.); seal block label same in both |
| 6.7 | SEALED cycle | Seal block visible on title page with full SHA-256, "Fastställd: <date>" subline, sealedBy name |
| 6.8 | (Story 21.12) Click "Hämta PDF" on a SEALED cycle | PDF downloads via `/laglistor/kontroller/{cycleId}/rapport/pdf`; PDF cover includes overrideReason if applicable |
| 6.9 | (Story 21.12) Eager PDF generation after seal | Within ~30-60s of seal, the PDF appears in Supabase Storage; subsequent downloads are immediate |

---

## 7. Activity log (Story 21.13)

| # | Action | Expected |
|---|---|---|
| 7.1 | Open the Aktivitet tab on a cycle | All cycle/item/finding/report mutations show with Swedish labels |
| 7.2 | Verify diff rendering | `oldValue` / `newValue` snapshots render readably for status changes, bedömning changes, motivering edits |
| 7.3 | Cross-user visibility | A cycle created by OWNER and edited by MEMBER shows both authors with avatars |

---

## 8. Permissions matrix sanity sweep (Story 21.14)

| Role | Can view cycles? | Can create cycle? | Can edit items? | Can sign items? | Can edit findings post-AVSLUTAD? | Can complete cycle? | Can revert cycle? |
|---|---|---|---|---|---|---|---|
| OWNER | Yes | Yes | Yes | Yes (escape hatch) | Yes | Yes | Yes |
| ADMIN | Yes | Yes | Yes | Yes (escape hatch) | Yes | Yes | Yes |
| HR_MANAGER | Yes | Yes | Yes | Only if lead auditor or item responsible_user | Yes | Only if lead auditor | Only if lead auditor |
| MEMBER | Yes | Yes | Yes | Only if lead auditor or item responsible_user | Yes | Only if lead auditor | Only if lead auditor |
| AUDITOR | Yes (read) | No | No | No (no `tasks:edit`) | No (no `tasks:edit`) | No | No |

> **Story 21.26**: the "Can seal cycle?" column was removed when SEAL collapsed into AVSLUTAD. Completion is the only post-PAGAENDE transition; revert is the only escape hatch back to PAGAENDE.

Verify the matrix above by attempting each cell as the corresponding role.

---

## 9. Regression — `/laglistor` main page (Epic 6/17 surface)

Quick sweep that Epic 21 didn't break the parent surface:

- 9.1 — `/laglistor` page loads, shows law-list groups + items.
- 9.2 — Inline cell editors (status, priority, responsible) save without page refresh. **(2026-04-27 fix: ResponsibleEditor optimistic-update bug now resolved on the compliance-detail-table.)**
- 9.3 — Existing legal-document-modal opens on row click.
- 9.4 — Skapa kontroll button on `/laglistor` header navigates to wizard.
- 9.5 — Breadcrumbs render: "Mina listor > Kontroller > Skapa kontroll" on the wizard route.

---

## 10. Known limitations / non-blockers (document, do not retest)

- **Story 21.10** (`assertCycleEditable` runtime guard) deferred — sub-second concurrent-seal race window only; functionally guarded by inline `assertCycleEditableUi`.
- **Story 21.15** (manual kontroll↔task linkage + Uppgifter tab) deferred to backlog — only auto-spawned tasks are surfaced today.
- **Phantom story numbers** in code comments (Story 21.16, 21.18, 21.20, 21.22) — those reference iterative UX work that landed under post-shipping addenda on Stories 21.4 / 21.5 / 21.7 etc. No discoverability impact.

---

## 11. Sign-off

When all sections above pass, mark Epic 21 status **Done** in `docs/prd/epic-list.md` (currently "Substantially Done — UAT-ready") and proceed to PR.

| Section | Tester | Pass / Fail | Notes |
|---|---|---|---|
| 1 — Wizard | Alexander | ✅ Pass | Findings #2 (AUDITOR in lead-auditor picker — intentional, needs UI affordance) + #3 (duplicate names indistinguishable) raised; all 11 test cases otherwise green |
| 2 — Items tab + sign-off | | | |
| 3 — Findings | | | |
| 4 — Lifecycle | | | |
| 5 — Seal | | | |
| 6 — Revisionsrapport | | | |
| 7 — Activity log | | | |
| 8 — Permissions matrix | | | |
| 9 — Regression | | | |
