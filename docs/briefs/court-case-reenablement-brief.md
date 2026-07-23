# Brief: Court-case re-enablement (rättspraxis in the knowledge graph)

_2026-07-23. Companion research doc with source-by-source verification: [court-case-ingestion-research-2026-07-23.md](./court-case-ingestion-research-2026-07-23.md). All API payloads below were verified live against the production API on this date._

## 0. TL;DR

Re-enable court cases on top of Domstolsverket's "Sök rättspraxis" open-data API (`rattspraxis.etjanst.domstol.se/api/v1` — free, no auth, JSON, daily updates). We built this once (Story 2.3, ~12k cases), deleted it for beta (Story 2.31, March 2026), and kept the schema dormant. Scope this time is **narrower and deeper**: only B2B-relevant courts (~7,500–9,000 cases instead of 12k+), referat-HTML-first ingestion (not PDFs), an LLM enrichment pass that extracts what the API doesn't structure (AD lagrum, outcome, skadestånd, the compliance lesson), and §-level graph edges that feed the agent and law-list change notifications (`NEW_RULING` ChangeEvent — enum value already exists).

**Differentiator:** competitors (Notisum/Ramboll, Aptor, JP laglistor) monitor lagändringar only. Precedent-aware, §-linked answers + "AD just ruled on 7 § LAS, which is in your laglista" notifications are unoccupied ground.

## 1. Where things stand in the code

- **Schema is ready, dormant.** `CourtCase` model (`prisma/schema.prisma:862`: court_name, case_number, lower_court, decision_date, parties Json) + `ContentType.COURT_CASE_AD/HD/HOVR/HFD/MOD/MIG`. No migration needed to start; see §6 for proposed additive columns.
- **Old client recoverable:** `git show 2d1fd219^:lib/external/domstolsverket.ts` (576 lines — types match today's API, rate limiter, retry, court configs). `git show 2d1fd219^:lib/court-case-utils.ts` for slug/URL utils. Story 2.31 removed: `/rattsfall` routes (public + workspace browse), sync cron, reference-detection regexes (NJA/AD nr/HFD ref/MÖD/MIG), citing-cases components, cached queries, sitemap entries.
- **Why it was removed** (relevant to not repeating it): content quality unmaintained, no citation linking, empty pages undermining beta. This epic's answer: enrichment pass + §-edges are the *point* this time, not an afterthought behind SEO page volume.

## 2. Court scope — B2B relevance decides

| Priority | Court | API kod | Volume (verified) | Depth | Rationale |
|---|---|---|---|---|---|
| **P0** | Arbetsdomstolen | `ADO` | 1,979 | 1993→ | HR/arbetsrätt core thesis: uppsägning, avsked, kollektivavtalsbrott, diskriminering, omplacering. Edge-case knowledge the agent needs most. |
| **P0** | Mark- och miljööverdomstolen | `MOD` + `MMOD` | 709 + 1,236 | 1999→ | Miljöbalken permits/tillsyn — compliance pillar. Company parties, zero GDPR concern, lagrum populated. |
| **P1** | Högsta förvaltningsdomstolen + Regeringsrätten | `HFD` + `REGR` | 1,292 + 1,727 | ~1993→ | The precedent tier for the entire förvaltningsrätt side: tax, upphandling, tillstånd. Light exclusion filter (pure individual social-insurance cases, by nyckelord). |
| **P1** | Högsta domstolen (NJA) | `HDO` | 5,347 → keep ~1,500–2,000 | 1981→ | **Filtered slice only**: avtal, skadestånd, entreprenad, bolagsrätt, arbetsrätt-adjacent. Drop brottmål (brottsbalken lagrum + nyckelord filter) — off-thesis AND the only GDPR-sensitive slab in the corpus. |
| **P2 (optional)** | PMÖD + old Marknadsdomstolen | `PMOD` + `MD` | 237 + 478 | — | Marknadsföringslagen/konkurrens — genuinely B2B, cheap to add if MFL appears in customer law lists. |
| **Skip** | Hovrätter (RH) | HSV/HGO/HVS/HSB/HNN/HON | ~3,325 | ~1990→ | Diffuse; AD supersedes for arbetsrätt; criminal mix. |
| **Skip** | Kammarrätter | KST/KJO/KGG/KSU | ~109 | — | Near-empty in API. |
| **Skip** | MigrÖD | `MIOD` | 533 | — | Off-thesis (enum COURT_CASE_MIG stays dormant). |
| **N/A** | Förvaltningsrätter, tingsrätter | — | 0 | — | Not published anywhere open; HD (Feb 2025) lets courts refuse bulk disclosure. AV sanktionsavgift practice = future agency-data track via AV:s diarium (public-records batches), not court ingestion. |

Net corpus: **~7,500–9,000 documents** — small next to the SFS corpus; the cost sits in enrichment, not volume.

Schema note: `MOD`+`MMOD` → `COURT_CASE_MOD`; `REGR` → `COURT_CASE_HFD` (RÅ referats are HFD lineage); PMÖD/MD would need a new enum value if P2 is taken (`COURT_CASE_PMOD`).

## 3. Data formats — what ingestion actually receives (verified payloads)

The API serves **two distinct publication forms**, and they must be handled differently. `GET /publiceringar` returns both mixed; filter on `publiceringsform` client-side (the `publiceringstyper` query param behaved inconsistently in testing — lowercase values per the OpenAPI spec, but combined with other params it returned empty; client-side filtering is the safe route).

### 3a. REFERAT (the corpus — 16,390 records) → HTML, no PDF needed

`innehall` = **full referat as clean semantic HTML**: `<p>`, `<h1>`–`<h3>` section headings (Bakgrund, Yrkanden, Domskäl, Domslut), `<strong>`, `<i>`. Verified sizes 14k–35k chars for substantive cases. This is the same class of input as our SFS HTML — it goes straight through a light clean → markdown conversion → chunking, **no PDF parsing, no OCR, no vision model**.

Per-record fields (live-verified):

| Field | Format | Notes |
|---|---|---|
| `innehall` | HTML string | Full referat. **Empty on DOM_ELLER_BESLUT.** Short (~400 chars) on formality cases (e.g. AD default judgments — förhandlingsvägran) — still ingest, they're one chunk. |
| `sammanfattning` | plain text | Rubrik/abstract — the canonical case summary, use as title/description + its own chunk. |
| `referatNummerLista` | `["AD 2024 nr 104"]` | Canonical citation = our `document_number`. |
| `arbetsdomstolenDomsnummer` | `"104/24"` | AD only. |
| `malNummerLista` | `["A 150/22"]` | |
| `lagrumLista` | `[{sfsNummer: "2010:800", referens: "10 kap. 32 § skollagen (2010:800)"}]` | **Populated for HFD/MÖD/HD, EMPTY for AD** (verified on newest AD records). §-granular where present → direct edge to our SFS catalog + LawSection. |
| `nyckelordLista` | `["Kollektivavtal", "Kollektivavtalsbrott", "Lönerevision"]` | Court-curated taxonomy. Populated on referred AD cases; empty on formality entries. |
| `rattsomradeLista` | `["Övriga mål"]` | Coarse; populated on HFD, empty on AD samples. |
| `forarbeteLista` | list | Edges to prop/SOU — sparse in samples; take when present. |
| `hanvisadePubliceringarLista` | `[{fritext: "AD 1989 nr 94", gruppKorrelationsnummer?: uuid}]` | Case→case citations. `gruppKorrelationsnummer` when resolvable in-corpus; fritext always. Older cases: empty — supplement via regex over `innehall` (referat texts cite "AD YYYY nr N" inline). |
| `typ` | enum | `PREJUDIKAT` / `VAGLEDANDE_MEN_EJ_PREJUDICERANDE` / `EJ_VAGLEDANDE` / … → precedent-weight field for retrieval ranking. |
| `ecliNummer` | string, **currently always empty** | Sweden joining ECLI (DV hemställan Oct 2025) — nullable column, populate when it lands. |
| `bilagaLista` | `[{fillagringId, filnamn}]` | PDF via `GET /bilagor/{fillagringId}`. Mostly empty on referats. **Skip by default** — bilagor can carry third-party copyright and add nothing over `innehall`. |

### 3b. DOM_ELLER_BESLUT (the firehose — March 2025→) → PDF-only, defer

Verified shape: `innehall` **empty**, `lagrumLista`/`nyckelord` empty, `typ: EJ_VAGLEDANDE`, one PDF in `bilagaLista` (`"F 8748-25 Dom 2026-07-15.pdf"`). Of the 40 newest HFD publications, 31 were this form and only 9 were referats — **the default feed is dominated by these; filtering is mandatory or we re-create the 2.31 quality problem** (thousands of thin, non-vägledande PDF stubs).

Defer this stream entirely in phase 1. If later wanted for freshness (a new AD dom lands here weeks before its referat), it's a separate PDF pipeline: fetch bilaga → Claude parse (same muscle as amendment PDFs) → provisional record upgraded when the referat publishes (join on `malNummerLista`/`gruppKorrelationsnummer`).

### 3c. Supplementary: arbetsdomstolen.se (phase 2+, optional)

Non-referred AD merits judgments published as anonymized PDFs since AD 2025 nr 6 at `/sv/meddelade-domar/` (new rulings Wednesdays 11:00; per-year archive 2011→). No API/RSS — HTML scrape + PDF parse. Only add if referat lag (referats publish months after dom — AD 2024 nr 104's referat landed Oct 2025) proves to matter for customers.

## 4. Chunking & embedding strategy

Referat HTML → markdown (existing clean/normalize utilities pattern) → **section-aware chunking on the `<h1>`–`<h3>` skeleton**:

- One chunk: `sammanfattning` + parties + utfall (the "case card" — highest retrieval value per token).
- Section chunks: Bakgrund / Domskäl / Domslut split further by size; **Domskäl is where the precedent reasoning lives** — favor it in chunk budget.
- Context prefix per chunk (existing Haiku prefix step): court, referatnummer, year, nyckelord, lagrum — so an embedded Domskäl paragraph carries "AD 2024 nr 104, kollektivavtalsbrott, lönerevision" into the vector.
- New `ChunkSource`-equivalent content type for court cases; ES index gets `referat_number^2`-style boosts alongside the existing title/document_number scheme.
- Ingestion guardrails carry over verbatim: connection_limit=1, ≤50-row insert batches, never the prod transaction pooler, 300s cron cap with hard-kill awareness.

Volume estimate: ~8k documents × ~10–20 chunks ≈ 100–150k chunks — comparable to a mid-size SFS batch; well within known pipeline limits.

## 5. Enrichment pass (the moat — what the API doesn't structure)

One LLM pass per case (Batch API, 50%-off mode, same pipeline as generate-embeddings):

1. **AD lagrum extraction** (highest leverage): lagrum is stated in referat text but `lagrumLista` is empty for AD. Extract `{sfsNummer, kapitel, paragraf}` → without this, the most valuable court has the weakest edges.
2. **Outcome**: bifall/avslag, in whose favor (arbetsgivare/arbetstagarpart), settled/default.
3. **Skadestånd**: ekonomiskt + allmänt, amounts → risk quantification in agent answers ("liknande fall: 150–250 tkr allmänt skadestånd").
4. **Deciding factor / compliance lesson**: "arbetsgivaren förlorade för att omplaceringsutredning saknades" → maps dom → actionable krav.
5. **Rättsgrundsats one-liner** → clean citation text for notifications and agent answers.
6. **Party classification**: förbund vs oorganiserad, bransch → relevance filtering against the customer's kollektivavtal (ties into multi-kollektivavtal retrieval).
7. **Criminal filter (NJA)**: applied at ingest — brottsbalken lagrum + nyckelord exclusion before anything is stored.

## 6. Graph edges & schema additions

Edges (all via existing `CrossReference` typed-edge model + new relations):

- **Case → SFS §** (`lagrumLista` + AD extraction): joins to `LegalDocument` + `LawSection` → agent pulls precedent per paragraph; powers NEW_RULING scoping.
- **Case → case** (`hanvisadePubliceringarLista` + inline-citation regex): in-degree = authority score for retrieval ranking.
- **Case → förarbeten** (`forarbeteLista`): joins the prop-first knowledge-graph track.
- **Case → law-list items**: derived — a new ruling citing a law in a customer's laglista triggers `ChangeEvent(NEW_RULING)` (enum exists; notification plumbing was removed in 2.31 and needs restoring).

Proposed additive `CourtCase` columns (nullable, non-destructive migration — **hand the migration command to Alexander, never run it**): `referat_number`, `ecli`, `precedent_weight` (typ enum), `keywords String[]`, `legal_areas String[]`, `outcome`, `damages Json`, `rattsgrundsats`, `citation_in_degree Int`, `group_correlation_id`.

## 7. Sync architecture

- **Backfill**: paginate `GET /publiceringar?domstolkod=X` per court (17.3k total — hours, not days, at the polite 5 req/s profile from the old client). Script-first (`scripts/ingest-court-cases.ts`), not cron.
- **Incremental**: daily cron on `publicerad_fran_och_med=<last sync date>`, client-side `publiceringsform === 'REFERAT'` filter + court allowlist. Mirror the discover/process split + health-watchdog pattern from the SFS pipeline fix (2026-07-23) — same silent-zombie risk profile.
- **Late-referat handling**: referats publish months after avgörandedatum (verified: dom Dec 2024, publicerad Oct 2025) — incremental sync keys on **publiceringstid**, never avgorandedatum.
- No documented rate limits; keep UA string + backoff; contact rattsfallspublikation@dom.se for the license confirmation (flag: dataportal record lacks explicit CC0 marking; texts themselves are copyright-free per 9 § URL regardless).

## 8. Legal guardrails (from the research doc, condensed)

1. Referat-only corpus = pre-anonymized by the courts; process under GDPR art. 6(1)(f) with a documented balancing test. Skip bilagor (third-party copyright + un-anonymized risk).
2. **Never person-name search.** The entire enforcement wave (HFD 2024 ref. 43/Verifiera, IMY supervision, SOU 2024:75 → grundlagsändring 2027) targets person-söktjänster. Cases surface by legal topic to logged-in businesses only.
3. **No utgivningsbevis** — wrong tool, collapsing shield, unnecessary for this design.
4. NJA criminal exclusion at ingest (see §5.7).

## 9. Suggested phasing

- **Phase 1 — corpus + graph**: restore/modernize API client, backfill AD + MÖD referats, chunk/embed, AD-lagrum extraction, case→SFS + case→case edges. Agent retrieval gets precedent; no new UI yet.
- **Phase 2 — HFD/RÅ + filtered NJA** + full enrichment fields (outcome/damages/lesson) + `NEW_RULING` ChangeEvents scoped to law lists (notification plumbing restore).
- **Phase 3 — surfaces**: /rattsfall pages (public SEO + workspace browse, restored from 2.31 with the new metadata), precedent panels on law pages, laglista "relevant praxis" per group.
- **Phase 4 (optional)**: PMÖD/MD, DOM_ELLER_BESLUT freshness stream, AD non-referred scrape, AV sanktionsavgift agency track (see §11 — can run in parallel with any phase; it's an independent pipeline).

## 10. Open decisions

1. NJA inclusion filter: curated lagrum/nyckelord allowlist vs. LLM relevance classification (recommend: allowlist first, LLM for the ambiguous tail).
2. Whether P2 (PMÖD/MD) ships with phase 2 or waits for demand signal from law lists containing MFL/konkurrenslagen.
3. Public SEO pages (phase 3) vs. workspace-only: 2.31 deleted ~12k public pages for quality reasons — re-opening them should wait until enrichment quality is proven.
4. Where enriched fields live: `CourtCase` columns (proposed) vs. a generic enrichment Json — columns preferred for query/filterability (outcome, damages ranges).

## 11. Agency-enforcement track: AV avgiftsförelägganden (sanktionsavgifter)

Separate from court ingestion but highly complementary — and a data set that exists in structured form **nowhere**, including competitors and commercial databases.

**Why it's not court data:** AV issues an avgiftsföreläggande; if the employer approves it, that's legally equivalent to a final judgment and *never reaches a court*. Only contested cases go to förvaltningsrätten (unpublished). So the bulk of Swedish sanktionsavgift practice exists only as AV decisions in AV:s diarium. Occasional principle questions reach HFD (e.g. HFD 2024 ref. 61) — those arrive via the court corpus automatically.

**Access route (no API):** offentlighetsprincipen requests against AV:s diarium.
- E-tjänst "Sök och beställ handlingar" covers cases registered 2015-01-01→; **currently offline** (driftstörningar, expected back ~late Aug 2026); interim = email to handlinger@av.se.
- Cadence: quarterly begäran — "kopior av samtliga avgiftsförelägganden beslutade under [period]" (optionally + förelägganden/förbud med vite, also compliance-relevant). AV must handle skyndsamt; digital delivery is free or near-free (avgiftsförordningen).
- Backfill 2015→: stage per year to avoid a "betungande" pushback; expect a few thousand decisions total (several hundred/year; 30.8 MSEK in total fees 2025, +24% vs 2024).

**Pipeline:** PDFs (possibly scans) → Claude vision parse (same muscle as amendment PDFs) → structured rows. Extract: orgnr/company, violated provision (AFS + § or AML/arbetsmiljöförordningen), amount, violation description, decision date, kommun/län, approval status.

**Data model:** NOT a `LegalDocument` — these are enforcement data points, not precedent texts. New lightweight model (e.g. `EnforcementDecision`) with FK edges to the violated `AGENCY_REGULATION` document/§ and SNI-bransch classification. Chunk/embed only the violation description if agent retrieval proves useful; the primary value is structured.

**Product surfaces:**
- Risk quantification per krav in the laglista: "företag i din bransch har fått 40 000–400 000 kr i sanktionsavgift för brister mot detta krav" — direct motivation on kravpunkter.
- Agent answers citing real enforcement frequency/amounts per AFS provision.
- Aggregate stats as marketing content (unique data → SEO/GEO for Epic 26-style pages).

**GDPR note:** targets are employers (juridiska personer) — clean. Enskilda firmor = personal data (sanktionsavgift is administrative, not criminal, so art. 10 is not triggered, but still): pseudonymize or exclude enskild firma names at ingest; never person-searchable.

## Appendix — key references

- Old client: `git show 2d1fd219^:lib/external/domstolsverket.ts`; utils: `...:lib/court-case-utils.ts`
- Removal story: `git show c80aeb0f` (story 2.31 full task list = reverse checklist for restoration)
- Schema: `prisma/schema.prisma:862` (CourtCase), `:614` (COURT_CASE_* enum)
- API: `https://rattspraxis.etjanst.domstol.se/api/v1/` · OpenAPI: `/openapi/puh-openapi.yaml` · dataset: dataportal.se `601_3755`
- Research doc: `docs/briefs/court-case-ingestion-research-2026-07-23.md`
