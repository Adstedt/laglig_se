# Court-Case Ingestion Research (2026-07-23)

Research into API options and data availability for ingesting Swedish court cases (rättspraxis) into the knowledge graph, with focus on Arbetsdomstolen/HR value and B2B compliance. Three parallel research agents verified sources live; all endpoint claims below were tested 2026-07-23.

## Verdict

**Domstolsverket's "Sök rättspraxis" open-data API is the backbone — and it's the same API we already integrated once.** We built court-case ingestion in Story 2.3 (~12,000 cases across AD/HD/HFD/HovR), then deleted it for beta in Story 2.31 (March 2026). The Prisma schema (`CourtCase`, `COURT_CASE_*` content types) was kept dormant, and the 576-line API client is recoverable from git (`git show 2d1fd219^:lib/external/domstolsverket.ts`). Re-enablement is a restore-and-improve job, not a greenfield build.

## The primary source: Domstolsverket PUH API

- **Base:** `https://rattspraxis.etjanst.domstol.se/api/v1/` — free, JSON, no auth, no API key. OpenAPI spec: `/openapi/puh-openapi.yaml`. Official open data (dataportal.se dataset `601_3755`, data.europa.eu, accrual DAILY — a record published 2026-07-22 was pulled during research).
- **Endpoints:** `GET /publiceringar` (paged; filters incl. `domstolkod`, `publiceringstyper`, `malnummer`, `publicerad_fran_och_med` — ideal for incremental cron sync; total via `x-total-count`), `GET /publiceringar/{id}`, `POST /sok` (full-text + facets), `GET /domstolar`, `GET /bilagor/{lagringId}` (PDF stream).
- **Fields per case (verified):** `referatNummerLista` ("AD 2024 nr 105", "NJA 1981 s. 253"), `malNummerLista`, `sammanfattning` (rubrik), **`innehall` = full referat text as HTML** (15–70k chars), **`lagrumLista` with structured `sfsNummer` + `referens`** (e.g. `{"sfsNummer":"1982:80","referens":"7 § LAS"}` — joins directly to our SFS catalog), `nyckelordLista` (sökord), `rattsomradeLista`, `forarbeteLista` (→ Riksdagen docs), `hanvisadePubliceringarLista` (case-to-case citation graph), `litteraturLista`, `bilagaLista` (PDFs), `avgorandedatum`, `typ` (PREJUDIKAT / VAGLEDANDE_MEN_EJ_PREJUDICERANDE / …), `ecliNummer` (schema field exists, **empty so far** — DV filed hemställan DV 2025/1202 in Oct 2025 to adopt ECLI; keep a nullable column).
- **Two content streams:** (a) **REFERAT** — 16,390 rich records with full HTML, historical back to NJA 1981; (b) **DOM_ELLER_BESLUT** — from March 2025 onward, full judgments as PDF attachment with thin metadata (the new-decisions firehose).
- **Knowledge-graph payoff:** rättsfall→SFS edges (`lagrumLista`), rättsfall→förarbeten edges (`forarbeteLista`), rättsfall→rättsfall citations (`hanvisadePubliceringarLista`) all come structured, for free.

### Verified per-court coverage (x-total-count, 17,321 total)

| Code | Court | Count | Depth |
|---|---|---|---|
| ADO | Arbetsdomstolen | 1,979 | AD 1993 nr 2 → today |
| HDO | Högsta domstolen (NJA) | 5,347 | 1981 → |
| REGR + HFD | RÅ + HFD | 1,727 + 1,292 | ~1993 → |
| MOD + MMOD | MÖD (old + new) | 709 + 1,236 | 1999 → |
| HSV/HGO/HVS/HSB/HNN/HON | Hovrätter (RH) | ~3,325 | ~1990 → |
| MIOD / PMOD / MD | MigrÖD / PMÖD / MD | 533 / 237 / 478 | — |
| Kammarrätter | KST/KJO/KGG/KSU | ~109 | thin |

### Caveats

- `lagrumLista` was **empty on sampled AD records** (populated for HD/MÖD) — AD lagrum likely needs LLM extraction from referat text (we already have this muscle from the amendment parser).
- Pre-1993 AD and pre-1981 NJA are not in the API (printed yearbooks / JP Infonet has AD from 1976 — negotiated deal, only if ever needed).
- License marking on the dataportal record not explicit (CC0 per Digg recommendation; texts are copyright-free anyway under 9 § URL). Confirm with rattsfallspublikation@dom.se before contractual reliance.
- No documented rate limits — keep the old client's polite profile (5 req/s, backoff, UA string).

## Supplementary sources

- **arbetsdomstolen.se** — new rulings Wednesdays 11:00 at `/sv/meddelade-domar/`; since **AD 2025 nr 6**, even non-referred merits judgments are published as anonymized PDFs (policy change in our favor). No RSS/API — poll the page for non-referred cases if we want beyond the referat tier.
- **lagen.nu** — same DV corpus, staler; no reason to scrape. Ferenda pipeline (BSD-2) usable as inspiration only.
- **Commercial (Karnov/JUNO, InfoTorg/Rättsbanken, Lexnova, JP Infonet)** — end-user products, no public data-licensing APIs. JP Infonet has the deepest AD archive (1976→) and tingsrätt coverage (2008→) if a gap ever matters. Qura (the one API-ish startup) was acquired by Legora in April 2026.
- **Dead/not applicable:** lagrummet.se (link portal), rinfo RDF project (dead since ~2016), rattsinfosok (301s to the new service), Riksdagens öppna data (no case law), ECLI e-Justice (Sweden not yet participating), research corpora (nothing usable).
- **Not in any open source:** arbetsmiljöbrott/företagsbot judgments (tingsrätt-level, unpublished), AV sanktionsavgift decisions (public-records requests to AV's diarium only), förvaltningsrätt AV-appeals. Defer or buy.

## Legal constraints (green light, with guardrails)

- **Copyright:** domar and official referat are copyright-free (9 § upphovsrättslagen). Bilagor/parternas inlagor and commercial databases' added headnotes are NOT — ingest official texts only, skip bilagor by default.
- **GDPR:** published referat are anonymized upstream by DV/AD (no names of private parties). A referat-only corpus, surfaced by legal topic to logged-in businesses with **no person-name search**, sits on ordinary GDPR art. 6(1)(f) legitimate interest — document the balancing test.
- **Do NOT build on utgivningsbevis.** The YGL shield for rättsdatabaser is being dismantled: HFD 2024 ref. 43 (Verifiera) removed protection for sensitive data; IMY now actively supervises certificate holders; HD (Feb 2025) allowed courts to refuse/condition bulk disclosure to rättsdatabaser; SOU 2024:75 proposes grundlagsändring effective 2027-01-01 targeting person-söktjänster. We are not a person-söktjänst and must never become one — that keeps us on the right side of the entire enforcement trajectory.
- **Criminal-case hygiene (the user's explicit constraint):** AD/MÖD/HFD are inherently B2B-clean. HD (NJA) contains criminal referats against individuals — filter at ingest by lagrum (brottsbalken) + nyckelord, keep contract/damages/bolagsrätt.

## Recommended ingestion priority

1. **AD (`domstolkod=ADO`)** — 1,979 full-text referats 1993→. Highest HR value; the old code already ranked it #1.
2. **MÖD (`MOD`+`MMOD`)** — ~1,945 referats; miljöbalken permits/tillsyn, lagrum links straight into the catalog; minimal personal-data risk.
3. **HD + HFD/RÅ (`HDO`,`HFD`,`REGR`)** — with the criminal/individual exclusion filter.
4. **Ongoing sync** — daily/weekly cron on `publicerad_fran_och_med` (REFERAT stream), mirroring the SFS amendment crawler pattern; heed the cron-zombie lessons (300s cap, hard-kill detection).
5. **Later/optional:** DOM_ELLER_BESLUT PDF stream (2025→), AD non-referred PDFs from arbetsdomstolen.se, AV sanktionsavgift public-records batches, JP Infonet for pre-1993 AD.

## What changed vs. our 2.3-era integration

- Same API family, now formally launched (March 2025) as open data with an OpenAPI spec and daily updates — more legitimate and stable than when we first built on it.
- New DOM_ELLER_BESLUT stream (full judgments, PDF) since March 2025.
- AD now publishes anonymized non-referred judgments (since AD 2025 nr 6).
- ECLI field reserved and coming (DV hemställan Oct 2025).
- Old client used court codes `ADO/HDO/HFD/HSV…` — still valid; add `REGR`, `MOD`, `MMOD` (schema already has `COURT_CASE_MOD`), and decide on MIG (enum exists but low B2B value).
