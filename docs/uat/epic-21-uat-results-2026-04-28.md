# Epic 21 — E2E UAT Results (Stories 21.26 + 21.27)

**Date:** 2026-04-28
**Tester:** Claude Opus 4.7 (1M context) via Chrome MCP browser automation
**Environment:** `http://localhost:3000` (Next.js 16.0.7 / Turbopack dev server, `.env.local`)
**Workspace:** Almåsa Havshotell AB
**User:** Alexander Adstedt (OWNER role)
**Branch / commits under test:**
- `a078dfe feat(epic-21): collapse cycle lifecycle to 3 states (Stories 21.26 + 21.27)`
- `f234331 chore(epic-21): QA fix-pass on Story 21.27 — close CONCERNS gate items`
- `8f41cae chore(epic-21): mark Story 21.27 Done + move to completed/`

**Lifecycle under test:** `PLANERAD → PAGAENDE → AVSLUTAD` (3 states; SEALED + ARKIVERAD removed)

## Test scope

End-to-end browser walkthrough validating the bundled lifecycle collapse against a running dev server. Specifically validates:

- **Story 21.27**: 3-state lifecycle, no Arkiverade filter chip, no Arkiverad badge, no `ReadOnlyBanner`, findings stay editable on AVSLUTAD, `findingsReadOnly` plumbing gone
- **Story 21.26**: SEAL ceremony removed, `completeCycle` handles AVSLUTAD transition end-to-end (incl. `sealed_at` population + eager PDF), legacy `?kind=sealed` URL coerces, no "Fastställ kontroll" menu item, no `audit:seal` scope
- **QA fix-pass**: AVSLUTAD advisory copy reads "bedömningarna bygger på dagens snapshot" (not "fastställandet"), `.completion-block` CSS class

## Results summary

| # | Section | Status | Notes |
|---|---|---|---|
| 1 | Cycle list — filter chips | ✅ **PASS** | Aktiva (2) / Slutförda (9) / Alla (11). No Arkiverade, no Fastställda. |
| 2 | Cycle list — status badges | ✅ **PASS** | Only Pågående (blue) + Avslutad (amber) seen. No Fastställd, no Arkiverad. |
| 3 | AVSLUTAD cycle — header + banner | ✅ **PASS** | "Avslutad" badge; AVSLUTAD reassurance banner reads "...bedömningarna bygger på dagens snapshot." (not fastställandet). NO ARKIVERAD ReadOnlyBanner. |
| 4 | AVSLUTAD cycle — Items tab (locked) | ✅ **PASS** | Bedömning rendered as read-only badge (not select); no Signera buttons; no unsign X. |
| 5 | AVSLUTAD cycle — Findings tab (editable) | ✅ **PASS** | "Lägg till anmärkning" button visible; per-row "Skapa åtgärdsuppgift / Redigera / Markera som åtgärdat" all visible. |
| 6 | AVSLUTAD cycle — Åtgärder dropdown | ✅ **PASS** | Only "Återställ till Pågående" appears. No "Fastställ kontroll", no "Slutför kontroll". |
| 7 | AVSLUTAD cycle — Rapport tab + PDF | ✅ **PASS** | Rapport renders inline iframe; "Status: Avslutad" in metadata; "Ladda ner PDF" link `?kind=complete`. |
| 8 | PAGAENDE → AVSLUTAD via Slutför kontroll | ⚠️ **PASS with defects** | Functional flow works (status flips, banner appears, items lock). But the confirmation dialog has stale "fastställande" copy — see DEFECT-001. |
| 9 | AVSLUTAD → PAGAENDE via revert | ✅ **PASS** | Status reverts, banner disappears, item unsign-X reappears. Dialog copy clean. |
| 10 | Activity log entries | ✅ **PASS** | `cycle_completed`, `cycle_reverted_to_pagaende`, `cycle_report_generated`, finding_*, motivering events all render in Swedish. No `cycle_sealed` legacy entries in this workspace's history (none would exist since SEALED was never reached pre-collapse for these cycles). |
| 11 | PDF route guards | ✅ **PASS** | AVSLUTAD `?kind=complete` → 200; AVSLUTAD `?kind=sealed` (legacy) → 200 (silent coerce); AVSLUTAD no-param → 200; PAGAENDE → 409 with JSON error. |

**Overall: 10 / 11 PASS, 1 PASS-with-defects.**
**Functional / data-integrity / security regressions: 0.**
**Stale-copy defects discovered: 2 (medium severity, user-facing).**

---

## Detailed findings

### Section 1 — Cycle list filter chips ✅

Navigated to `/laglistor/kontroller`. Filter chips: **Aktiva (2) | Slutförda (9) | Alla (11)** — exactly 3 chips. Counts sum correctly (2 + 9 + 0 archived = 11 alla). No "Arkiverade" or "Fastställda" chips. Confirms Story 21.27 AC 7 (`FilterKey` union narrowed) and Story 21.26 AC 17 (Förseglade chip removed earlier).

### Section 2 — Status badges ✅

The Slutförda chip shows 9 cycles, all rendering with the amber **"Avslutad"** badge (`bg-amber-100 text-amber-700`). Notable: a cycle named *"DEMO — Redo för fastställande"* still rendered the new "Avslutad" badge — confirming the 21.27 migration's UPDATE folded any pre-21.26 SEALED rows correctly. No Fastställd or Arkiverad badges visible anywhere. Confirms Story 21.27 AC 8 (`STATUS_VARIANTS` 3-row map).

### Section 3 — AVSLUTAD cycle: header + banner ✅

Drilled into "Testkontroll 2" (4 items, 1 finding, AVSLUTAD). Observations:

- **Status badge** "Avslutad" next to title ✅
- **NO top read-only "arkiverad" banner** — confirms the QA fix-pass on `cycle-detail-header.tsx` (the buggy "Denna kontroll är arkiverad..." that surfaced earlier when the old prop-driven gate fired on AVSLUTAD)
- **AVSLUTAD reassurance banner** below the meta row reads exactly: `"Kontrollen är slutförd. Öppna anmärkningar fortsätter att följas upp — bedömningarna bygger på dagens snapshot."` — confirms QA fix-pass copy update from "fastställandet" → "bedömningarna"
- Tabs: `Dokument | Anmärkningar | Rapport | Aktivitet` (4 tabs)
- Progress cluster: `Bedömda 4 av 4` + `Signerade 4 av 4`

### Section 4 — Items tab on AVSLUTAD (locked) ✅

All 4 rows render with:
- **Bedömning** as a read-only green badge "Uppfylld" (not a `<select>`)
- **Motivering** as plain text "Test"
- **Signerad** column shows green check + timestamp + actor
- **No Signera button**, **no unsign X**, **no kebab menu** on rows
- "Nuvarande status" (sourced from the underlying laglistan) renders as "Ej påbörjad" badge — read-only

Confirms Phase 2 + Story 21.27: items lock at AVSLUTAD via `assertCycleEditableUi` (item-side); UI hides mutation affordances.

### Section 5 — Findings tab on AVSLUTAD (editable) ✅

**Critical Story 21.27 invariant**: findings stay editable forever.

The Findings tab on AVSLUTAD renders with:
- **"+ Lägg till anmärkning"** button visible top-right ✅
- **Filter chips** all interactive: Alla / Avvikelse / Observation / Förbättringsförslag (type), Alla / Öppna / Stängda (status)
- **Per-row actions** all visible on the existing AVVIKELSE / STÖRRE finding "Test":
  - `+ Skapa åtgärdsuppgift`
  - `Redigera`
  - `Markera som åtgärdat`
- **No findings-tab read-only banner** (confirms `cycle-findings-tab.tsx` `readOnly` prop deletion)
- **AVSLUTAD reassurance banner** still visible above tabs (page-level)

Confirms Story 21.27 AC 12 (`readOnly` + `cycleStatus` props dropped from `CycleFindingsTab`) end-to-end.

### Section 6 — Åtgärder dropdown on AVSLUTAD ✅

Clicked Åtgärder. Single menu item: **"Återställ till Pågående"** (red destructive styling).

- ❌ NO "Fastställ kontroll" — confirms Story 21.26 AC 11 (menu item deleted)
- ❌ NO "Slutför kontroll" — cycle is already AVSLUTAD
- ❌ NO "Arkivera" — confirms Story 21.27 + memory note (no archive transition exists)

### Section 7 — Rapport tab + PDF ✅

Rapport tab renders the revisionsrapport HTML in a sandboxed iframe within ~1s. Title page metadata block reads:
```
Laglista: Er laglista
Period: 28 apr. 2026 – 29 apr. 2026
Revisionsledare: Alexander Adstedt
Revisionstyp: Extern
Status: Avslutad      ← cycleStatusLabel('AVSLUTAD'), confirms 3-case switch
Workspace: Almåsa Havshotell AB
Rapport genererad: 28 apr. 2026 12:04
```

TOC visible: Bakgrund / Omfattning / Revisionskriterier / Metodik / Sammanfattning (4 dokument · 1 finding) / Efterlevnadsbedömningar / Avvikelser / Observationer / Förbättringsförslag / Slutsatser / Konklusion.

`Ladda ner PDF` link href:
```
/laglistor/kontroller/b3f623f1-…/rapport/pdf?kind=complete
```

Confirms Story 21.26 AC 18 (always defaults to `kind=complete`) and Story 21.27 AC 14 (renderer's 3-case `cycleStatusLabel`).

### Section 8 — Complete flow (PAGAENDE → AVSLUTAD) ⚠️

Drilled into "Test x" (1 item already signed, PAGAENDE). Åtgärder dropdown showed only **"Slutför kontroll"** ✅. Clicked it → confirmation dialog opened.

**The dialog's confirmation behavior works**: clicking "Slutför kontroll" submits, status flips to AVSLUTAD (verified via screenshot — badge changed, AVSLUTAD reassurance banner appeared, items locked).

**But the dialog copy is stale.** See DEFECT-001 below.

### Section 9 — Revert flow (AVSLUTAD → PAGAENDE) ✅

On the freshly-AVSLUTAD "Test x", Åtgärder dropdown → "Återställ till Pågående" → confirmation dialog "Återställ kontrollen?" with copy:

> "Kontrollen går tillbaka till Pågående. Signeringar och bedömningar behålls oförändrade. Du kan slutföra den på nytt när du är klar."

Clean — no SEAL or fastställande references. Clicked "Återställ" → status reverted to "**Pågående**" (blue badge), the AVSLUTAD reassurance banner disappeared, the unsign X reappeared on the item row. Full revert confirmed.

### Section 10 — Activity log ✅

Navigated to `/workspace/activity`, filtered category = Livscykel. Visible entries (post-21.26/21.27 events):

- "Alexander Adstedt **slutförde kontrollen** Miljö" — `cycle_completed` formatter (Story 21.13) renders correctly
- "Alexander Adstedt **slutförde kontrollen** Testkontroll 2"
- "Alexander Adstedt **återställde kontrollen Testkontroll 2 till pågående**" — `cycle_reverted_to_pagaende`
- "Alexander Adstedt **genererade revisionsrapport**" — `cycle_report_generated` (no kind-branching post-21.26)
- "Alexander Adstedt **stängde** Test 2213123" / "...återöppnade Test 2213123" — finding state changes
- "Alexander Adstedt **skapade avvikelsen** Test 2213123" — finding_created (AVVIKELSE-typed)
- "Alexander Adstedt **stängde** Test: anledning ‹ ...›" — finding_closed with manual close reason

No `cycle_sealed` or `cycle_archived` entries — none would exist since this workspace's cycles never reached SEALED/ARKIVERAD before the collapse. The legacy `cycle_sealed` formatter is preserved in `lib/activity/format-activity.ts` per the original Story 21.26 design but has no rows to render.

**Per-cycle Aktivitet tab** still shows the placeholder "Hanteras i Story 21.13" — pre-existing stub, not a 21.26/21.27 regression. Global activity log is the working surface.

### Section 11 — PDF route guards ✅

Tested via fetch from the running app:

| URL | Expected | Actual |
|---|---|---|
| AVSLUTAD `?kind=complete` | 200 + application/pdf | ✅ 200 + application/pdf |
| AVSLUTAD `?kind=sealed` (legacy) | 200 + application/pdf (silent coerce) | ✅ 200 + application/pdf |
| AVSLUTAD (no `kind` param) | 200 + application/pdf (defaults to complete) | ✅ 200 + application/pdf |
| PAGAENDE cycle 1 | 4xx + JSON error | ✅ 409 + application/json |
| PAGAENDE cycle 2 | 4xx + JSON error | ✅ 409 + application/json |

Confirms Story 21.26 AC 18 (legacy URL coercion) + Story 21.27 AC 15 (negative gate works for 3-state).

---

## Defects discovered

### DEFECT-001 — `complete-cycle-dialog.tsx` confirmation copy is stale (medium)

**File:** `components/features/compliance-audit/cycle-detail/complete-cycle-dialog.tsx:60-65`
**User-visible:** Yes — appears in the "Slutför kontrollen?" confirmation dialog every time someone completes a cycle.

**Current copy:**
> "Kontrollen blir låst när den slutförs. För att göra ytterligare ändringar i bedömningar, motiveringar eller **anmärkningar** måste du återställa kontrollen till pågående via Åtgärder-menyn. **Fastställandet är ett separat, oåterkalleligt steg.**"

**Why it's wrong:**
1. Includes "anmärkningar" (findings) in the lock list — but Story 21.27 made findings always-editable. Findings do NOT require a revert; they remain editable on AVSLUTAD.
2. Promises a "Fastställandet är ett separat, oåterkalleligt steg" — but Story 21.26 deleted the Fastställande step entirely. There is no separate fastställande / sealing transition any more.

**Impact:** Misleads users into thinking (a) they can't edit findings post-completion, and (b) there's a future irreversible "fastställande" step coming. Both untrue post-21.26/21.27.

**Suggested fix copy:**
> "Bedömningarna och motiveringarna låses när kontrollen slutförs. Anmärkningar fortsätter att vara redigerbara — de följs upp efter avslutad kontroll. För att ändra på en bedömning eller motivering kan du återställa kontrollen till pågående via Åtgärder-menyn."

**Severity:** medium (user-facing copy that promises wrong behavior; not a functional regression but worsens the user mental model).

**Suggested owner:** dev (PO may want to review the suggested replacement copy first).

### DEFECT-002 — `cycle-item-modal/left-panel.tsx` Underlag accordion copy stale (low)

**File:** `components/features/compliance-audit/cycle-item-modal/left-panel.tsx:278`
**User-visible:** Yes — appears as the helper text under the "Underlag" accordion in the cycle-item modal (when an auditor opens an item).

**Current copy:**
> "Aktuella kopplingar — låses när kontrollen **fastställs**."

**Why it's wrong:** Mentions "fastställs" — but Story 21.26 deleted Fastställande. The correct trigger is now "när kontrollen slutförs" (AVSLUTAD).

**Suggested fix:**
> "Aktuella kopplingar — låses när kontrollen slutförs."

**Severity:** low (single word, but visible to every auditor opening an item).

**Suggested owner:** dev.

---

## Recommendations

### Immediate (before next user-facing release)

1. **Fix DEFECT-001** (`complete-cycle-dialog.tsx`) — the dialog promises behaviors that don't exist; users will be confused when "anmärkningar" remain editable on AVSLUTAD or when no fastställande step ever materializes.
2. **Fix DEFECT-002** (`left-panel.tsx`) — single-word copy fix.

### Future / nice-to-have

3. **Per-cycle Aktivitet tab** is still a "Hanteras i Story 21.13" stub. Story 21.13 shipped (per memory) but the per-cycle activity feed component was deferred. Consider wiring up an inline filtered view of the global activity log scoped to `entity_id = cycleId`.
4. **PDF wrapper carryover** (already noted in Story 21.27 Dev Agent Record): `lib/compliance-audit/revisionsrapport-to-pdf.ts` still has a dead `sealHash: string | null` field on `RevisionsrapportPdfMetadata`. Always passes `null` from production caller; warrants its own cleanup pass.
5. **Sealed_at column rename** (already noted in 21.26 gate): `sealed_at` / `sealed_by_user_id` semantically mean "completed_at" / "completed_by_user_id" post-21.26. Defer to follow-up migration.

---

## Test artifacts

This UAT run covered the canonical post-21.26/21.27 lifecycle behavior end-to-end against a freshly-running dev server with the migrations applied. The full evidence trail is in this report; screenshot IDs (ephemeral) referenced through the Chrome MCP run are listed below for traceability:

- `ss_52406s0vy` — initial cycle list (Aktiva chip, 2 cycles)
- `ss_5429isj6o` — Slutförda chip filtered (9 AVSLUTAD cycles, all amber Avslutad badges)
- `ss_68837lt7a` — Testkontroll 2 AVSLUTAD detail page (advisory banner + locked items)
- `ss_94418xruy` — Findings tab on AVSLUTAD (Lägg till anmärkning + per-row actions)
- `ss_506048wej` — Åtgärder dropdown showing only "Återställ till Pågående"
- `ss_1405x7p5g` — Rapport tab iframe with "Status: Avslutad"
- `ss_6865vq9r9` — Per-cycle Aktivitet tab (stub)
- `ss_97920urve` + `ss_0987mnqoi` — Global activity log (all categories + Livscykel filter)
- `ss_21511t5hi` — Test x PAGAENDE detail
- `ss_28916ynrj` — Test x Åtgärder dropdown ("Slutför kontroll" only)
- `ss_5551aozru` — Slutför kontrollen confirmation dialog (DEFECT-001 visible)
- `ss_51404bqb8` — Test x flipped to AVSLUTAD post-completion
- `ss_093916eqh` — Återställ kontrollen confirmation dialog
- `ss_7061ko4ya` — Test x reverted to Pågående

## Sign-off

**Stories 21.26 + 21.27 functional behavior is correct** — all lifecycle transitions work, all UI affordances respect the 3-state model, no security/data-integrity regressions. The two defects discovered are user-facing copy drift in dialog/helper text that the QA fix-pass earlier today missed (those swept the architecture doc, UAT plan, and renderer CSS but not the dialog component or item-modal panel). Both fixes are 5-minute Edits.

**Recommend:** Merge the lifecycle collapse to main, file DEFECT-001 + DEFECT-002 as immediate follow-ups, ship after their fix.
