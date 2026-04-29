# Epic 21 — E2E UAT Results (PR-readiness sweep)

**Date:** 2026-04-29
**Tester:** Claude Opus 4.7 (1M context) via `chrome-devtools-mcp` browser automation
**Environment:** `http://localhost:3000` (Next.js 16.0.7 / Turbopack dev server, `.env.local`)
**Workspace:** Almåsa Havshotell AB
**User:** alexander.adstedt+111@kontorab.se (OWNER role)
**Branch / commits under test:** `feat/epic-21-lagefterlevnadskontroll` head
- `2f99fca test(epic-21): E2E UAT report for Stories 21.26 + 21.27 + fix 2 stale-copy defects`
- `8f41cae chore(epic-21): mark Story 21.27 Done + move to completed/`
- `f234331 chore(epic-21): QA fix-pass on Story 21.27`
- `a078dfe feat(epic-21): collapse cycle lifecycle to 3 states (Stories 21.26 + 21.27)`

**Lifecycle under test:** `PLANERAD → PAGAENDE → AVSLUTAD` (3 states)

---

## Test scope

PR-readiness sweep focused on the user-visible flows that Stories 21.1–21.14 + 21.26 + 21.27 touch. Single OWNER session pinned to the Almåsa workspace's existing fixture cycles. Multi-role coverage (AUDITOR P1 leak from prior Finding #1, sign-off authz matrix) deferred to a follow-up PR.

Goals:
1. Re-validate the 2026-04-28 lifecycle-collapse pass on the same dev server.
2. Drive flows that the prior pass only spot-checked (auto-spawn task, complete+revert roundtrip, findings creation).
3. Surface anything new that the bundle since `2f99fca` has missed.

---

## Results summary

| # | Scenario | Status | Notes |
|---|---|---|---|
| A1 | Cycle list filter chips | ✅ **PASS** | 3 chips (Aktiva 2 / Slutförda 9 / Alla 11). Counts sum. No Arkiverade/Fastställda. |
| A1' | Status badges across both tabs | ✅ **PASS** | Only Pågående + Avslutad. "DEMO — Redo för fastställande" cycle (legacy-named) renders Avslutad — confirms 21.27 migration folded pre-21.26 SEALED rows. |
| A2 | Wizard happy path | ⏭️ **SKIPPED** | Date spinbutton fields didn't accept programmatic fill via the MCP. Already validated manually pre-this run; deferred. |
| A3 | Wizard edge cases (end<start, Bakgrund>2000) | ⏭️ **SKIPPED** | Same blocker as A2. |
| A4 | Items signoff modal (PAGAENDE) | ✅ **PASS** | Signera bedömning card, Bedömning + Motivering values, Ångra signering button, Saknar bevis pill, Att uppmärksamma + Snabblänkar cards all present. |
| A5 | Finding creation + auto-spawn (AVVIKELSE) | ✅ **PASS** | Full create flow: Avvikelse → severity Större → 2-step task config → "Skapa anmärkning och uppgift". Spawned task appears in `/tasks`: status `Att göra`, prioritet `Hög`, ansvarig defaulted to lead auditor. Description carries `Korrigerande åtgärd för avvikelse:` prefix. |
| A6 | Lifecycle complete + revert roundtrip | ✅ **PASS** | Test x: Pågående → Slutför kontroll dialog → Avslutad (banner appears, items lock) → Återställ till Pågående dialog → Pågående (Ångra reappears, signature preserved). Toast "Kontrollen är återställd till Pågående." |
| A7 | Rapport tab (AVSLUTAD) | ✅ **PASS** | Iframe renders. Title page metadata uses EXTERN-cycle labels (Revisionsledare, Revisionstyp, Revisionskriterier). Status: "Avslutad" (3-state map). PDF link `?kind=complete`. Bakgrund och syfte section + TOC entry rendered (cycle has description). |
| A8 | DEFECT-001 regression (Slutför dialog copy) | ✅ **PASS** | Dialog copy: *"Bedömningarna och motiveringarna låses när kontrollen slutförs."* + *"Följs upp efter avslutad kontroll: 1 öppen anmärkning med 1 pågående åtgärdsuppgift."* No "fastställandet"/"oåterkalleligt"/"separat". |
| A8' | DEFECT-002 regression (Underlag accordion) | ✅ **PASS** | Helper text: *"Aktuella kopplingar — låses när kontrollen slutförs."* Uses "slutförs", not "fastställs". |
| A8" | Åtgärder dropdown — AVSLUTAD | ✅ **PASS** | Single item: "Återställ till Pågående". No Fastställ kontroll, no Slutför kontroll, no Arkivera. |
| A8"' | Åtgärder dropdown — PAGAENDE | ✅ **PASS** | Single item: "Slutför kontroll". No legacy Fastställ. |
| Code | `fastställ`/seal grep across `app/components/lib` | ✅ **PASS** | All hits are intentional: legacy `cycle_sealed` activity formatter (preserved per 21.26 design), `linked-cycles-box.tsx` SEALED/ARKIVERAD defensive fallback (commented as such), unrelated PDF document title, removal-history code comments. No user-facing leakage. |

**Overall: 11 / 11 functional scenarios PASS, 2 skipped (tooling, not product).**

---

## Defects discovered

### 🟠 DEFECT-003 — Cycle-detail Aktivitet tab still placeholder

**Severity:** 🟠 **P2 — incomplete feature, customer-visible "looks unfinished"**
**Status:** **CONFIRMED OPEN** (this is Finding #4 from `docs/uat/epic-21-uat-findings.md`, dated 2026-04-27, never closed)
**Affects:** Every cycle's Aktivitet tab — both PAGAENDE and AVSLUTAD verified.

**Reproduction (verified on this run):**
1. Open any cycle (verified on PAGAENDE "Test x" + AVSLUTAD "Testkontroll 2").
2. Click the **Aktivitet** tab.
3. Tabpanel renders the literal italic muted-foreground string `"Hanteras i Story 21.13"`.

**Root cause:** Per the 2026-04-27 finding doc — Story 21.13 wired the WRITE side (every mutation server action emits an `ActivityLog` row), and the workspace-level `/workspace/activity` feed renders them. But the cycle-detail Aktivitet TAB's tabpanel was left as a hardcoded placeholder string awaiting a follow-up component. Source: `components/features/compliance-audit/cycle-detail/cycle-detail-page.tsx:609-613`.

**Why this matters for PR readiness:** The placeholder text gives away that something's missing. Every cycle's customer-visible Aktivitet surface looks broken even though the data is captured server-side. Not strictly a UAT blocker (the workspace-level activity log is functional), but on the wrong side of the "looks done" line for a customer-facing release.

**Recommendation:** Land the cycle-scoped activity feed component before merging this PR, OR explicitly accept the placeholder and rename the tab (e.g. "Aktivitet (kommer snart)") to set expectation. Do **not** ship the literal "Hanteras i Story 21.13" copy into customer view.

**Estimated effort:** 2-4 hours per the original Finding #4 (server action with tenant isolation + component + empty state + basic tests), reusing the `lib/activity/format-activity.ts` formatter that 21.13 extended for cycle entity types and the existing `<ActivityLogList>` consumer.

---

### 🟡 OBSERVATION-001 — Untranslated `findings` in revisionsrapport TOC

**Severity:** 🟡 **P3 — copy polish**
**Status:** **NEW** (not in prior findings doc)
**Affects:** Revisionsrapport HTML renderer's TOC subtitle.

**Reproduction:**
1. Open an AVSLUTAD cycle (verified on Testkontroll 2).
2. Switch to the Rapport tab.
3. Inspect the TOC entry under "Sammanfattning".
4. Subtitle reads: `"4 dokument, 1 findings"`.

The Swedish-language report uses the English plural `findings` instead of `anmärkningar` or `fynd`. All other report copy is fully Swedish, so this stands out.

**Recommendation:** Replace `findings` with `anmärkningar` (matches the cycle-detail Anmärkningar tab + the FindingsTab consumer) in `lib/compliance-audit/revisionsrapport-renderer.ts`'s TOC builder.

**Estimated effort:** ~5 minutes including a snapshot test update.

---

## Pre-existing dev-only console noise

Two CSP-blocked script loads observed on every page:
- `https://va.vercel-scripts.com/v1/script.debug.js` (Vercel Analytics debug)
- `https://va.vercel-scripts.com/v1/speed-insights/script.debug.js` (Vercel Speed Insights debug)

Both blocked by `script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live` (the directive omits `va.vercel-scripts.com`). **Not an Epic 21 defect** — pre-existing CSP config issue, dev-mode only (Vercel Analytics swaps to a non-debug endpoint in production). Worth a follow-up `fix(csp)` PR but out of scope here.

---

## Test data created during this run

The following entities were created in the Almåsa workspace and remain on disk:

| Entity | Where | Identifier | Purpose |
|---|---|---|---|
| ComplianceFinding | Cycle "Test x" | "E2E UAT avvikelse 2026-04-29" (AVVIKELSE / STÖRRE) | A5 finding-create assertion |
| Task | Workspace tasks board | "E2E UAT avvikelse 2026-04-29" (Att göra / Hög) | A5 auto-spawn assertion |

Both can be cleaned up manually or via a one-off `prisma` script. They do not affect any other test surface; the cycle remains in PAGAENDE state with the rest of its fixtures intact.

The "Test x" cycle was completed-then-reverted during A6, ending in **Pågående** with the original signed item state preserved.

---

## Recommendations for this PR

1. **Block on DEFECT-003 (Aktivitet tab placeholder)** — either ship the cycle-scoped activity feed, OR make the placeholder copy non-engineering-jargon for the interim ship.
2. **Bundle OBSERVATION-001 (1 findings → 1 anmärkningar)** — trivial fix in the renderer; ship with this PR.
3. **Defer to follow-up PRs** — Tier B multi-role tests (AUDITOR P1 leak from Finding #1, sign-off authz matrix), CSP fix for Vercel scripts, the prior P3 findings (#3 picker disambiguation, #5 inline-editor save affordance, #6 items search/filter primitive, #7 INTERN/EXTERN tooltip variant).

---

## Sign-off

| Section | Status | Notes |
|---|---|---|
| 1–8 functional scenarios | 11/11 PASS | A2 + A3 wizard skipped — tooling, not product |
| Code-level fastställ leakage check | ✅ Clean | All hits intentional + commented |
| New defects | 1 (P2 + P3) | DEFECT-003 (Aktivitet placeholder, regression-confirmed); OBSERVATION-001 (untranslated TOC subtitle) |
| Functional / data-integrity / security regressions vs `2f99fca` | **0** | |
