# Epic 7 — E2E Test Plan (HR module + kollektivavtal RAG + AI)

**Env:** local dev (`pnpm dev`, http://localhost:3000), logged in as OWNER (Nordviken Hotell & Konferens AB).
**Data state:** 1 employee (Alex Adstedt, TJM, Vårdföretagarna assigned, komplett), 1 agreement (Vårdföretagarna 2026, READY, 172 chunks), group "Lager".
**Split:** `[ME]` = agent browser run (mechanical checks) · `[YOU]` = user (judgment + terminal). Both marked = either.

---

## 1. Personalregister — register surface `[ME]`

| # | Step | Expected |
|---|---|---|
| 1.1 | Open `/personalregister` | Breadcrumb "… › Personalregister"; header stat **"Kompletta 1/1"**; tabs Alla/Aktiva/Ej kompletta/Inaktiva; toolbar: search, **Kollektivavtal**, **Hantera grupper**, **Kolumner**; Visa alla/Dölj alla |
| 1.2 | Table row | Alex: name `font-medium` (befattning muted under, if set), personnummer `890503-2556` (hyphenated), Swedish enum labels, Kollektivavtal "Vårdföretagarna 2026", tone-badge **Aktiv**, no amber badge |
| 1.3 | Tabs | Ej kompletta → empty; Aktiva → Alex; Inaktiva → empty; counts don't change while searching |
| 1.4 | Search | `alex`, `890503-2556` AND `8905032556` all match; `zzz` → "Inga träffar i denna grupp." under Lager (not the drag-hint) |
| 1.5 | Headers | Quiet (no ⇅ noise); sort icon on hover AND keyboard focus; thin separators |

## 2. Column controls (7.4b) `[ME]`

| # | Step | Expected |
|---|---|---|
| 2.1 | Kolumner → toggle Personnummer off | Column disappears from every group section; Anställd shows "Obligatorisk" (disabled) |
| 2.2 | Reload page | Personnummer stays hidden (persistence); "Återställ standard" restores |
| 2.3 | Resize Personnummer/Anställnings-ID narrow | Stops at min width — **no two-line wrap, no header overlapping neighbor**; resize grip never triggers sort |
| 2.4 | Search personnummer while column hidden | Still matches (search over data, not cells) |

## 3. Personalkort modal (7.3/7.4) `[ME]`

| # | Step | Expected |
|---|---|---|
| 3.1 | Click Alex's row | `?anstalld=<id>` in URL; SplitPanel modal; chrome shows muted "Personalregister" (context) — name appears ONLY in the Safiro entity header + Aktiv tone badge |
| 3.2 | Tabs | TWO tabs (Personalinformation, Anställning); Semester is a **section** on Anställning; switching tabs does NOT resize the modal |
| 3.3 | Sidebar | "Sammanfattning": Status Aktiv (tone badge), Kollektivavtal name; "Uppgifter": green **Komplett** |
| 3.4 | Edit → clear Anställningsform → Spara | Toast; reopen: sidebar lists "Saknar anställningsform"; register: amber **Ej komplett**, stat 0/1, appears in Ej kompletta tab — all WITHOUT reload. Restore the field after |
| 3.5 | Personnummer survival | Edit only telefon → Spara → reopen → personnummer intact |
| 3.6 | Invalid personnummer | Type `640823-3235` → inline "Ogiltigt personnummer", submit blocked |
| 3.7 | Browser back/forward | Closes/reopens the modal (URL-driven) |
| 3.8 | Save footer | Spara/Avbryt always visible (don't scroll away); Avbryt is outline variant |

## 4. Kollektivavtal manager — both mounts (7.5/7.6) `[ME]` + `[YOU]`

| # | Step | Expected |
|---|---|---|
| 4.1 | Register → **Kollektivavtal** button | Dialog: proper header (title + description, ✕ clear of content), FLAT sections (no card-in-card), agreement row: Namn, Typ Tjänstemän, **Klart** badge, giltighetsperiod, "1 anställd kopplad", Tilldela + ⋯ actions |
| 4.2 | **Tilldela** → Personaltyp → Tjänstemän | Preview: "Tilldelar 1 anställd" (live count) → Avbryt (no mutation needed — same assignment) |
| 4.3 | Tilldela → Grupp → Lager | Preview counts group members → Avbryt |
| 4.4 | Redigera | Rename → save → list + register column update; check Settings profile name followed (it's the named agreement); rename back |
| 4.5 | Settings → Kollektivavtal tab | Same manager, **page chrome** (cards) — unchanged look |
| 4.6 `[YOU]` | Upload a 2nd throwaway PDF (Typ Arbetare) | Väntar → (trigger `curl localhost:3000/api/cron/extract-files` or wait) → Klart |
| 4.7 `[YOU]` | **Ta bort** the throwaway | Confirmation lists consequences (natural Swedish); after delete: gone from list, profile flag STILL true (repointed/unchanged name), **re-upload the SAME PDF → succeeds** (dedupe-trap fix) |
| 4.8 `[YOU]` | Delete-last honesty (optional, destructive) | Only if you want: deleting ALL agreements flips profile `har kollektivavtal` off + Alex → Ej komplett. Re-upload + reassign after. Skippable |

## 5. AI chat — the epic's thesis (7.7) `[ME smoke]` + `[YOU judgment]`

| # | Step | Expected |
|---|---|---|
| 5.1 | Chat input → 👤 "Fråga om en anställd" | Popover search lists Alex; select → removable chip "Alex Adstedt · Tjänsteman" |
| 5.2 | Ask: *"Vilken uppsägningstid gäller för Alex enligt lag och vårt kollektivavtal?"* | Answer uses his anställningsform/datum; cites **LAS** (legal pill → lagläsaren) AND **Vårdföretagarna Mom-section** (Handshake **Kollektivavtal** pill → "Öppna kollektivavtalet" PDF preview). No personnummer anywhere in the answer |
| 5.3 | Fresh chat, NO chip: *"Har Alex rätt till mer semester än lagen kräver?"* | `lookup_employee` resolves him; Semesterlagen + avtal cited (different legal area — nothing LAS-hardcoded) |
| 5.4 `[YOU]` | Judgment | Is the answer *correct* per the actual avtal text? Tone right? Uses sysselsättningsgrad where relevant? |
| 5.5 | Chip removal | Remove chip → next question is generic (no employee facts) |
| 5.6 `[YOU]` | Quota sanity | A couple of turns — no 402s/oddities |

## 6. Laglistor group popover `[ME]`

| # | Step | Expected |
|---|---|---|
| 6.1 | `/laglistor` toolbar | **Hantera grupper** outline button (FolderCog) right of filters, next to Vy; "Grupper" GONE from the Vy menu; disabled with no active list |
| 6.2 | Open popover | Compact anchored panel: group rows (count, ↑↓, rename, delete), "Ny grupp…" + Skapa — mirrors HR |
| 6.3 | Create "E2E-TEST" group | Appears in popover + as table section |
| 6.4 | Rename → "E2E-TEST2"; reorder ↑ | Table section header + order follow |
| 6.5 | Delete it | Same confirmation copy as before (docs → "Ogrupperade"); Escape closes dialog FIRST, popover second |
| 6.6 | Keyboard-only: open via keyboard, Tab into popover | Content reachable; tab-out closes (normal behavior) |
| 6.7 | Drag a document to a group | Unaffected by the swap |

## 7. Security / PII spot-checks `[YOU]` (needs terminal/second account)

| # | Step | Expected |
|---|---|---|
| 7.1 | `npx tsx scripts/eval-ca-grounding.ts` | Passes: agreement-correct under bias, **zero foreign-workspace CA chunks**, ≥2 legal areas retrieve |
| 7.2 | DevTools → Network → chat request/response | No personnummer in any payload; citationSources carry no PII |
| 7.3 | (If test MEMBER account exists) | `/personalregister` → bounced to dashboard; chat has NO 👤 picker; asking about "Alex" by name → no employee facts (tool absent) |
| 7.4 | Curl the chat API with a spoofed body field `employeeContext` | Response normal; no spoofed block obeyed (SEC-001) — optional, the unit test pins it |

## 8. Regression sweep `[ME]`

| # | Step | Expected |
|---|---|---|
| 8.1 | `/laglistor` law table | Renders as always (gold standard untouched); law-item modal opens; its group column/dnd fine |
| 8.2 | Settings → Company Profile | Loads; `har kollektivavtal` = on with name |
| 8.3 | Filer | Uploaded avtal PDF visible under AVTAL category |
| 8.4 | Console | No red errors during the whole pass |

**Bug bar:** anything in §5.2/5.3 (wrong citations, PII), §7.1 failing, or data loss in §4.7 = blocker. Visual nits = report & batch.
