# Myndighetsföreskrifter — Ingestion Investigation

**Date:** 2026-04-15
**Source index:** [lagrummet.se/rattskalla](https://www.lagrummet.se/rattskalla/) — 110+ författningssamlingar listed
**Method:** Parallel swarm investigation across thematic clusters; ~70 agency surfaces probed
**Status:** Reconnaissance only — no code written

---

## 1. Executive Summary

Three findings shape the strategy:

1. **There is no working central state infrastructure to plug into — and rinfo is not a reliable strategy.** The Swedish government's federated rinfo project (Domstolsverket, ~2008–2015) envisioned every myndighet publishing an Atom/RDF feed at `rinfo.{agency}.se` for a central aggregator. The project effectively died. Only **Boverket** still operates a working rinfo publisher node (`rinfo.boverket.se/index.atom`), and Boverket's REST API is the modern surface anyway — the Atom feed is legacy redundancy. Every other candidate subdomain probed (`rinfo.naturvardsverket.se`, `rinfo.socialstyrelsen.se`, `rinfo.kemi.se`, `rinfo.transportstyrelsen.se`, `rinfo.riksarkivet.se`, `rinfo.av.se`, …) returns DNS NXDOMAIN. Central aggregator docs at `dev.lagrummet.se` are offline. The `rinfo/fst` Django toolkit on GitHub is dormant. `lagrummet.se/rattskalla` is reduced to an outbound-links directory. **Treat rinfo as unreliable; do not architect around it.**
2. **Two agency-native APIs are worth consuming directly.** **Boverket REST API** (`api-portal.boverket.se`, OpenAPI 3, JSON/XML/HTML) is best-in-class. **Riksdagen data API** (`data.riksdagen.se`, JSON/XML) already powers our SFS ingestion and extends naturally to RFS + propositioner.
3. **Compliance relevance is heavily skewed.** Of ~110 publishers, ~10 carry the bulk of cross-cutting B2B obligations (BFS, TSFS, MCFFS, IMYFS, KIFS, HSLF-FS, NFS, LIVSFS, SJVFS, KOVFS, PTSFS). ~15 more matter to specific verticals. ~85 are internal-government, hyper-local, or near-dormant.

**Strategic implication:** laglig.se builds the **first-party aggregator the Swedish state never finished.** Per-agency ingestion adapters + LLM-driven extraction + proprietary canonical identifiers + knowledge graph. Every text-of-record traces to the issuing myndighet's own URL. No third-party aggregator (lagen.nu, commercial legal databases), no dependency on rinfo, no central point of failure: one broken adapter = one stale agency, not a system outage.

**Recommended ingest order:** **BFS → TSFS → MCFFS (NIS2 timing) → KIFS → IMYFS → HSLF-FS** (Socialstyrelsen + Folkhälsomyndigheten + Läkemedelsverket anchors).

---

## 2. Strategic Findings (cross-cutting)

### 2.1 Infrastructure reality check

**What was supposed to exist:**

- `rinfo.{agency}.se` publisher nodes per myndighet, each serving `index.atom` + RDF + PDF
- Central aggregator at `rinfo.lagrummet.se` crawling all publisher nodes
- `dev.lagrummet.se` + `github.com/rinfo/fst` as the developer/reference implementation
- Official digital publication since April 2018 (this part did land — official version of laws, ordinances, and certain myndighetsföreskrifter is now the digital version)

**What actually exists in 2026:**

- `rinfo.boverket.se` — **alive**, serving Atom + RDF + PDF per spec
- Every other `rinfo.{agency}.se` probed — DNS NXDOMAIN
- `dev.lagrummet.se` — timeout (offline or very slow)
- `rinfo.lagrummet.se` — timeout
- Central `lagrummet.se/rattskalla` — alive but reduced to an outbound-links directory
- `github.com/rinfo/fst` — essentially dormant

**Conclusion:** There is no state-run canonical aggregator. Every agency publishes on its own website. Our job is to be the aggregator.

### 2.2 Boverket API — the one clean win

`https://api-portal.boverket.se/` (Azure APIM, OpenAPI 3 spec, free subscription key).

Operations:

- `Hämta författningslista` — list all
- `Hämta författningsinformation` — metadata
- `Hämta författningsinnehåll` — structured content (JSON/XML)
- `Hämta författningsinnehåll som HTML` — rendered HTML
- `Sök efter författningsinnehåll` — full-text search

Stable public URLs: detail at `forfattningssamling.boverket.se/detaljer/BFS{year}-{num}`, PDF at `rinfo.boverket.se/BFS{year}-{num}/pdf/BFS{year}-{num}.pdf`, Atom at `rinfo.boverket.se/index.atom`.

Build `lib/agency/bfs-api-client.ts`. Bypass any PDF pipeline for BFS 2024+ regs — consume structured JSON directly.

### 2.3 Structural patterns we'll encounter

| Pattern                                              | Examples                                                          | Pipeline implication                                                                |
| ---------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Base + amendment, separate numbered docs**         | NFS, LIVSFS, SJVFS, FFFS, TSFS, BFS, MIGRFS, KOVFS, IMYFS, MCFFS… | Reuse SFS amendment pipeline (`lib/sfs/amendment-llm-prompt.ts`) — strong fit       |
| **Base + amendment + agency-published konsoliderad** | TSFS, BFS, ELSÄK-FS, KIFS, RA-FS, FFS (some), KVFS (some)         | Prefer the konsoliderad surface when present; show authoritative-version disclaimer |
| **Consolidated-only (agency owns the roll-up)**      | SSMFS, MDFFS (DIGG), PMFS sammanställda HTML, UHRFS konsoliderade | Easiest — single source per regulation                                              |
| **Single self-contained doc, re-issued annually**    | KFMFS (förbehållsbelopp), AFFS (post-2020 full republication)     | No amendment graph; treat each issue as a new document                              |
| **Whole-document supersession**                      | SvKFS, IMYFS partial                                              | New reg replaces old; successor pointer                                             |
| **Geospatial gazette (millions of local orders)**    | STFS rdt                                                          | **Skip** — not a compliance corpus                                                  |

### 2.4 Dual-numbering & successor events schema must model

Several agencies have renamed or restructured. Schema carries both legacy and current prefixes as aliases of the same corpus:

- **DIFS → IMYFS** (Datainspektionen → IMY, 2021)
- **MPRTFS → MEMYFS** (rebrand to Mediemyndigheten, 2024)
- **AMSFS → AFFS** (AMS → Arbetsförmedlingen, 2008)
- **TRMFS → TPPVFS** (Pliktverket rename)
- **MSBFS → MCFFS** (MSB civilförsvars-split, 2025/2026 — both still circulate)
- **LIFS → SIFS** (Lotteriinspektionen → Spelinspektionen, 2019)
- **LMVFS → LMFS** (Lantmäteriet, post-2009)
- **FoHMFS / FHIFS → HSLF-FS** (FoHM joined shared series, 2015)
- **SOSFS → HSLF-FS** (Socialstyrelsen joined shared series, 2015)
- **RFFS → FKFS** (RFV → Försäkringskassan, 2005)
- **BV-FS / VVFS / SJÖFS / LFS / JvSFS → TSFS** (Transportstyrelsen consolidation, 2009)
- **FAP ↔ PMFS** — Polismyndigheten dual numbering (subject FAP-nr + chronological PMFS year:no)
- **BBR ↔ BFS** — Boverket dual numbering (colloquial BBR XX vs legal BFS year:no)

### 2.5 Discovery mechanisms — coverage matrix (agency-native only)

| Mechanism                                         | Available at                                                                                                                                                                 |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **REST API (structured)**                         | Boverket BFS, Riksdagen (SFS/RFS/propositioner)                                                                                                                              |
| **Atom feed (rinfo.boverket.se only)**            | BFS `rinfo.boverket.se/index.atom`                                                                                                                                           |
| **Agency RSS feeds**                              | DVFS, MIGRFS, IMY news, Folkhälsomyndigheten, Boverket                                                                                                                       |
| **Predictable URL enumeration**                   | Tullverket TFS (`/webdav/files/Styrdokument/TFS/YYYY/YYYYNNN.htm`), Skolverket PDF API (`skolfs.skolverket.se/api/document/{type}/{year}:{nr}/pdf`), Riksarkivet integer IDs |
| **Static HTML index (diff-polling required)**     | Most other agencies                                                                                                                                                          |
| **JS SPA / WebForms (headless-browser required)** | SKOLFS (hash-route SPA), TSFS (dynamic search), STEMFS (Arkitektkopia), STFS rdt (ViewState)                                                                                 |
| **WAF/captcha hostile**                           | Skatteverket (`www4.` returns "URL rejected"), Bolagsverket (CAPTCHA), Konkurrensverket (403 on our probe)                                                                   |

---

## 3. Prioritized Ingestion Tiers

### Tier 1 — Prioritize now (highest cross-cutting compliance ROI)

| Rank | Source                                                                 | Why                                                                                                         | Pipeline strategy                                                                    | Effort                                                                 |
| ---- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| 1    | **BFS (Boverket)**                                                     | Construction industry core; BBR; recent 2024-series restructure; only Swedish agency API at this quality    | Dedicated `bfs-api-client.ts` consuming Boverket REST API + rinfo Atom feed          | **L** (greenfield client, pays back on every subsequent BBR amendment) |
| 2    | **TSFS (Transportstyrelsen)**                                          | 1,303 regs spanning road/rail/air/sea; clean detail-page URLs; consolidated PDF + structured change notes   | Reuse SFS pipeline; add taxonomy parsing for trafikslag tags                         | **M**                                                                  |
| 3    | **MCFFS (Myndigheten för civilt försvar)**                             | NIS2 implementation föreskrifter landing through 2026; cybersäkerhetslagen 2025:1506                        | SFS pipeline; dual-prefix MSBFS+MCFFS handling                                       | **M**                                                                  |
| 4    | **KIFS (Kemikalieinspektionen)**                                       | Universal industrial relevance; only 3 active base regs (each huge); HTML konsoliderade versioner published | Port AFS HTML scraper; per-reg bespoke template viable (n=3)                         | **S**                                                                  |
| 5    | **IMYFS (IMY)**                                                        | GDPR-adjacent national rules; small corpus; high customer-ask probability                                   | SFS pipeline; DIFS↔IMYFS prefix aliasing                                            | **S**                                                                  |
| 6    | **HSLF-FS shared** (Socialstyrelsen + FoHM + Läkemedelsverket primary) | Health/care/medicine — broad employer + life-sciences relevance                                             | Multi-publisher shared series; SFS pipeline; publisher resolved per HSLF-FS document | **L**                                                                  |

### Tier 2 — High value, do next

| Source                                | Why                                                                                                   | Effort |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------ |
| **NFS (Naturvårdsverket)**            | Miljöbalken-adjacent; ~150+ regs                                                                      | M      |
| **LIVSFS (Livsmedelsverket)**         | Food sector core; high amendment churn                                                                | M      |
| **SJVFS (Jordbruksverket)**           | Agriculture/animal/feed; high churn (annual CAP-stöd)                                                 | M      |
| **PTSFS (Post- och telestyrelsen)**   | Telecom/eIDAS/NIS2 spillover; 5 repeals in 2025 from cyber reform                                     | M      |
| **ELSÄK-FS (Elsäkerhetsverket)**      | Electrical contractors; clean HTML index, separate upphävda page                                      | S      |
| **EIFS (Energimarknadsinspektionen)** | All Swedish DSO/TSO; recently absorbed ex-SvKFS scope                                                 | M      |
| **SSMFS (Strålsäkerhet)**             | Consolidated-only HTML, small volume — quick win                                                      | S      |
| **MDFFS (DIGG)**                      | Cleanest structured HTML in landscape; ~10 regs; covers WAD/eIDAS/Peppol                              | S      |
| **RA-FS (Riksarkivet)**               | Broadest applicability — every public body + record-handling private actors; integer-ID search portal | S      |
| **KOVFS (Konsumentverket)**           | Consumer/B2C marketing/credit                                                                         | M      |
| **SvKFS (Svenska kraftnät)**          | 4 PDFs — trivial; säkerhetsskydd/elberedskap hook                                                     | XS     |

### Tier 3 — Defer (value present but technical or scope friction)

| Source                        | Why deferred                                                                                                                                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **SKVFS (Skatteverket)**      | WAF-hostile (`www4.` returns "URL rejected"). Solve with realistic User-Agent + cookie handshake + headless browser fallback. Formal SKVFS ~30/yr is high value. Rättslig vägledning corpus = separate later epic. |
| **TFS (Tullverket)**          | Very clean HTML+URL scheme; relevance only for import/export; ingest on customer signal                                                                                                                            |
| **KFMFS (Kronofogden)**       | Tiny (~30 docs), easy quick win; do once payroll-compliance priority surfaces                                                                                                                                      |
| **HVMFS (Havs- och vatten)**  | Water/fisheries niche; PDF-heavy bilagor (large tables)                                                                                                                                                            |
| **FFFS (Finansinspektionen)** | 379 entries but only relevant to FI-supervised entities (banks/insurance/funds)                                                                                                                                    |
| **BFNAR (Bokföringsnämnden)** | "Allmänna råd" not formal föreskrifter; high relevance for accounting, but content model differs — treat as separate content type                                                                                  |
| **BOLFS (Bolagsverket)**      | CAPTCHA-protected; small corpus                                                                                                                                                                                    |
| **AFFS (Arbetsförmedlingen)** | Full-republication model since 2020 — no amendment chains; small corpus                                                                                                                                            |
| **MIGRFS (Migrationsverket)** | Agency RSS available; ~30 regs; relevance only to employers of foreign workers                                                                                                                                     |
| **SiSFS, AGVFS, IAFFS, PFS**  | Narrow public-sector-facing; defer                                                                                                                                                                                 |
| **STAFS (Swedac)**            | High value for accredited cert bodies/labs — concentrated, willing-to-pay segment; revisit if vertical develops                                                                                                    |
| **HVMFS, SKSFS, SGU-FS**      | Sector-specific environmental — pair with NFS pipeline                                                                                                                                                             |
| **PMFS**                      | Cleanest consolidated HTML in cluster; defer until säkerhets-/bevakningsbransch on roadmap                                                                                                                         |
| **MYHFS, UHRFS**              | Higher-ed sector; defer until that vertical materializes                                                                                                                                                           |

### Tier 4 — Skip until customer-driven

- **Länsstyrelser (21)** — geo-local (vattenskyddsområden, naturreservat, trafik). Build a generic länsstyrelse-template scraper as dormant infra; activate per län on demand.
- **Sametinget (STFS)** — tiny, sami-cultural; near-zero B2B
- **FFS, KVFS, ÅFS, DVFS, TPPVFS** — internal state-actor regulation, no business compliance load
- **KAMFS, TVFS, UFS, CSNFS, VALFS, RFS** — narrow audience or covered by SFS already
- **KFS (Kommerskollegium), MEMYFS, VRFS, KRFS** — niche sector-specific
- **MTFS, SCB-FS, PRVFS** — statistics-reporting / IP niches
- **STFS rdt (lokala trafikorder)** — millions of geospatial orders; not a compliance corpus

---

## 4. Per-Cluster Detail

### 4.1 HSLF-FS shared collection (Socialstyrelsen + FoHM + LV + IVO + MFoF + RMV + TLV + E-hälsa)

Eight agencies publish into one shared series. Central index: `kunskapsguiden.se/gemensam-forfattningssamling/`.

- **Socialstyrelsen** maintains the most extensive split: separate "grund- och ändringsförfattningar" registry (457 publications) AND "konsoliderade föreskrifter" registry (76 active). Explicit notice: "tryckta versionen är gällande." Year filter 1982–2026, A-Z browse. URL patterns: `/publikationer/hslf-fs-{year}{nr}-{slug}/` and `/.../konsoliderade-foreskrifter/{code}/`. **Anchor of the cluster.**
- **Folkhälsomyndigheten** publishes konsoliderade versioner explicitly. Dedicated "Upphävda föreskrifter" section. RSS available (news). Two legacy series: FoHMFS + FHIFS.
- **IVO** publishes ~9 primary HSLF-FS documents into the shared collection; konsoliderade versioner exist alongside amendment PDFs.
- **Läkemedelsverket** publishes both LVFS (legacy) + HSLF-FS (current).
- **MFoF, RMV, TLV, E-hälsomyndigheten** — small contributions, covered by shared pipeline.

**Strategy:** Single HSLF-FS ingester resolving publisher-per-document via metadata.

### 4.2 Länsstyrelser + Sametinget _(degraded analysis — see §6)_

- 21 länsstyrelser on a shared Sitevision CMS. URL pattern `/{lan}/om-oss/om-lansstyrelsen-{lan}/lanets-forfattningssamling.html` (Västra Götaland: `/forfattningar.html`).
- Format: HTML index → PDF documents. No konsoliderade versions; no RSS/API.
- Per-län volume: 30–150 in-force regs. Cumulative: ~1,500–2,500.
- **Compliance relevance: LOW.** Content is geo-local (lokala trafikföreskrifter [duplicated in STFS rdt], naturreservat, jakt, fiske, terrängkörning, eldningsförbud, vattenskyddsområden).
- **Sametinget (STFS):** WordPress dokumentbank, ~20–40 STFS, near-zero B2B.
- **Recommendation:** Skip at MVP. Generic länsstyrelse-template scraper as dormant infra. The single cross-län thematic slice worth proactive ingestion: **vattenskyddsområden** (industrial siting, fuel handling, stormwater — site-specific but compliance-meaningful).

### 4.3 Financial regulators (FFFS, BFNAR, BOLFS, RGKFS, KKVFS, RIFS)

- **FFFS (Finansinspektionen):** 379 hits. Status filter (Gällande/Upphävd). Base+amendment with explicit linkage ("Ändring av Grundförfattning [2014:4]"). HTML+PDF per regulation. URL `/sv/vara-register/fffs/sok-fffs/{year}/{fffs-num}/`. **Relevance: HIGH for FI-supervised entities only — not cross-cutting.**
- **BFNAR (Bokföringsnämnden):** ~50+ BFNAR with both grundtext and konsoliderad PDF. K-regelverk (K1–K4) critical for ALL Swedish accounting. Amendment chain visible. **Note: allmänna råd, not formal föreskrifter — content type differs.**
- **BOLFS (Bolagsverket):** CAPTCHA-protected on probe. Tiny corpus. Includes Patentombudsnämndens regs.
- **RGKFS, KKVFS, RIFS:** Small corpora; not directly probed in depth (KKVFS 403).

### 4.4 Tax / Customs / Enforcement (SKVFS, TFS, KFMFS)

- **SKVFS:** `www4.skatteverket.se` returns "URL rejected" to default User-Agent — Akamai/WAF. **Not a blocker** — realistic User-Agent + cookie handshake + headless browser fallback will work; we control the scraper. Dual surface: formal SKVFS (~30/yr, base+amendment, PDF) AND Rättslig vägledning (consolidated HTML editions `edition/2025.8/`, plus thousands of ställningstaganden). Formal SKVFS = HIGH; ställningstaganden = separate UX (non-binding guidance).
- **TFS (Tullverket):** `/webdav/files/Styrdokument/TFS/YYYY/YYYYNNN.htm` — effectively a sitemap-by-convention. HTML-dominant, recent docs increasingly PDF. Base+amendment. Also publishes Inspektionen för strategiska produkter regs in same series.
- **KFMFS (Kronofogden):** Tiny (~30 lifetime, three series KFMFS/KFM A/KFM M). PDF-only. Annual-reissue model. Direct payroll relevance for any Swedish employer running löneutmätning.

### 4.5 Environment / Chemicals / Resources (NFS, KIFS, SSMFS, HVMFS, SKSFS, SGU-FS)

- **NFS (Naturvårdsverket):** Base+amendment, PDF-primary. Stable URLs `/lagar-och-regler/foreskrifter-och-allmanna-rad/{year}/nfs-{yearno}/`. ~150+ regs. HIGH relevance (miljörapport, avfall, deponering, utsläpp, jakt).
- **KIFS:** Only 3 active base regs but each huge. Konsoliderade versioner published. Dedicated `/foreskrifter-som-har-upphort-att-galla` page. **HIGH relevance.** Annex tables (CLP/REACH crosslinks) are the hard part.
- **SSMFS:** Consolidated-only HTML. Confirmed: "SSMFS 2008:1 ... (konsoliderad version)". Sidebar split active vs upphävda. ~35 regs.
- **HVMFS, SKSFS, SGU-FS:** PDF-heavy, narrower audiences. SKSFS uses filename `upphavd` suffix as repeal marker. SGU-FS tiny (~7 active).

### 4.6 Energy / Electrical / Power (ELSÄK-FS, EIFS, STEMFS, SvKFS)

- **ELSÄK-FS:** ~22 in-force, ~35 repealed. HTML landing per reg + PDF + konsoliderad PDF. Clean dedicated `/upphavda-foreskrifter/` page. Status label on every row. reCAPTCHA on search form (not list).
- **EIFS:** Topic-segmented (el/naturgas/fjärrvärme/fjärrkyla) + upphävda page. Recently absorbed ex-SvKFS regs (EIFS 2025:2 replacing SvKFS 2005:2). ~30–60 in-force.
- **STEMFS:** ASP.NET WebForms (`a-w2m.se` Arkitektkopia CMS), viewstate/postbacks, GUID URLs. 112 publications. **Highest scrape complexity in cluster (4/5).** Relevance: biofuels, solceller, NIS energi.
- **SvKFS:** Just **4 active regulations**. Trivial scrape, säkerhetsskydd/elberedskap flagship hook.

### 4.7 Transport (TSFS, TRVFS, SJÖFS, STFS rdt, KBVFS)

- **TSFS:** **Cluster collapses to this one target.** Post-2009 consolidation. 1,303 regs. Detail URL `details?RuleNumber=YYYY:NN&ruleprefix=TSFS` (works for TSFS, JvSFS, LFS legacy prefixes). Per-reg detail page lists base PDF + ändring PDFs + konsoliderad PDF + structured change-scope notes ("Ändr. 1 kap. 1, 3 och 7 §§"). Status: I kraft / Kommande / Upphävd.
- **TRVFS, SJÖFS:** Mostly archival; live content flows through TSFS.
- **STFS rdt:** WebForms/ViewState, millions of local orders, geospatial — skip.
- **KBVFS:** 4 in-force, niche.

### 4.8 Construction & Land (BFS, LMFS) — CRITICAL

- **BFS (Boverket):** REST API at `api-portal.boverket.se` with OpenAPI 3 spec. Returns JSON/XML/HTML. Additionally has `rinfo.boverket.se/index.atom` as Atom feed with RDF+PDF per entry — only working agency rinfo node on the network. BBR base `BFS 2011:6` has 13+ amendments; periodic omtryck (BFS 2011:26, 2014:3, 2024:14) republishes consolidated. **2024 thematic split** (BFS 2024:4 aktsamhet, 2024:6 bärförmåga, 2024:7 brand, etc.) running parallel to BFS 2011:6 through 2027. Each amendment ships with Konsekvensutredning PDF. **BBR↔BFS dual numbering.** EKS (2011:10) = structural eurocodes — separate flagship.
- **LMFS (Lantmäteriet):** PDF-only, no API/RSS. Static HTML page split gällande/upphävda. ~45–55 in-force. Dual series LMFS/LMVFS. Narrow audience.

### 4.9 Defense / Justice / Civil Protection (FFS, PMFS, KVFS, ÅFS, DVFS, MCFFS, TPPVFS)

**Only MCFFS deserves priority** — owns NIS2 implementation (cybersäkerhetslagen 2025:1506 + 2026 föreskrifter-paket: MCFFS 2026:1 NIS2-identifiering, 2026:4 explosiv vara, scheduled incidentrapportering/säkerhetsåtgärder/säkerhetsrevisioner through autumn 2026). Dual-prefix MSBFS+MCFFS. Domain migration msb.se → mcf.se ongoing. Expect 10–20+ new MCFFS/year through NIS2 rollout.

- FFS, PMFS, KVFS, ÅFS, DVFS, TPPVFS — skip (internal-state-actor regulation).

### 4.10 Labor / Welfare / Migration / Social-services (FKFS, PFS, AFFS, MIGRFS, AGVFS, IAFFS, SiSFS)

- **FKFS (Försäkringskassan):** Custom portal `lagrummet.forsakringskassan.se` with FKFS + RFFS (legacy) + repealed-since-1986 archive.
- **PFS (Pensionsmyndigheten):** Base+amendment; current text pointers in title text. ~250 entries 1970–2025. Mixed PFS/FKFS/RFFS prefixes.
- **AFFS (Arbetsförmedlingen):** **Single-document model since June 2020** — every amendment triggers full republication. No granular amendment tracking. Inherits AMSFS (pre-2008).
- **MIGRFS (Migrationsverket):** ~30+ regs. RSS available. PDF URL pattern `/download/18.{id}/{timestamp}/MIGRFS_{YEAR}_{NUMBER}.pdf`. Direct relevance for employers of foreign workers.
- **AGVFS, IAFFS, SiSFS:** Public-sector-facing or narrow.

### 4.11 Education / Culture / Research / Archives (SKOLFS, MYHFS, UHRFS, KRFS, RA-FS, VRFS)

**Two standouts:**

- **RA-FS (Riksarkivet):** Search portal `foreskrifter.riksarkivet.se/rafs` with integer-ID routing (`/rafs/1175`). Konsoliderade PDFs published. Detail pages mark upphävd + link successor. Separate RA-MS portal for agency-scoped beslut (thousands — skip v1). **High relevance** — every public body + many private aktörer handling allmänna handlingar.
- **SKOLFS:** Volume play — covers Skolverket + Skolinspektionen + SPSM in one stream. **Undocumented JSON API:** `skolfs.skolverket.se/api/document/{GRUNDFORFATTNING|ANDRINGSFORFATTNING}/{year}:{nr}/pdf`. Hash-route SPA. ~2,000–3,000 live entries (läroplaner dominate).

Others (MYHFS, UHRFS, KRFS, VRFS) are sector-specific; defer.

### 4.12 Consumer / Trade / Media / Privacy (KOVFS, KFS, SIFS, MEMYFS, IMYFS)

- **IMYFS (IMY):** **#1 in cluster.** GDPR-adjacent; small corpus (~10–20 live); DIFS↔IMYFS dual prefix; replacement-based supersession (DIFS 2018:2 → IMYFS 2024:1).
- **KOVFS (Konsumentverket):** ~40–60 regs; HIGH B2C relevance.
- **SIFS (Spelinspektionen):** Cleanest taxonomy in cluster — `/gallande-foreskrifter/` vs upphävd folder paths as reliable in-force signals. LIFS↔SIFS dual prefix.
- **KFS, MEMYFS:** Near-dormant, niche.

### 4.13 Telecom / Digital / Statistics / Patents (PTSFS, MDFFS, SCB-FS, PRVFS, MTFS)

- **PTSFS:** HIGH relevance (NIS2/eIDAS spillover, frequency licensing). 5 repeals in 2025 from cyber reform. ~40–60 in-force. Dedicated `/regelbibliotek/gallande-foreskrifter-och-allmanna-rad/` index.
- **MDFFS (DIGG):** **Cleanest data model of any agency probed.** Three explicit URL surfaces per regulation: `grundforfattning`, `andringsforfattning`, `konsoliderad-version`. Tiny corpus (~7–10) but covers WAD/EAA accessibility, e-legitimation, Peppol, digital post.
- **SCB-FS, PRVFS, MTFS:** Niche or scrape-hostile; defer/skip.

### 4.14 Food / Agriculture / State remainder (LIVSFS, SJVFS, CSNFS, TVFS, UFS, KAMFS, STAFS, VALFS, RFS)

- **LIVSFS:** ~150–250 in-force; HIGH for food sector; konsoliderade versioner inconsistent. Heavy EU-förordning crosslinks. Dual-numbered with SJVFS for animal-origin food.
- **SJVFS:** ~400–600 in-force; HIGH for jordbruk/djurhållning. Annual CAP-stöd creates churn. Topic-organized sakregister (rare and useful).
- **STAFS (Swedac):** Niche-but-high — accredited cert bodies/labs/anmälda organ. ~50–100 regs. Strong overlap with EU NLF.
- **CSNFS, TVFS, UFS, KAMFS, VALFS:** Skip (narrow or SFS-covered).
- **RFS (Riksdagsförvaltningen):** Riksdagen.se JSON/XML API extends naturally via `doktyp=rfs`. RFS itself irrelevant to private sector, but the API client extension is useful.

---

## 5. Architecture — "the Aggregator the State Never Finished"

### 5.1 Design pillars (cutting-edge, first-party)

1. **First-party authority.** laglig.se indexes and caches text directly from the issuing myndighet (or Boverket REST API / Riksdagen data API where native). No third-party mirror is on the critical path. The text-of-record always links back to the agency URL we fetched it from — auditable, stable, customer-defensible.

2. **LLM-first extraction (already proven for SFS).** Bypass fragile HTML scrapers where possible. Send PDFs + rendered HTML as multimodal input to Claude, emit semantic HTML + markdown + structured JSON in one pass (the existing `lib/sfs/amendment-llm-prompt.ts` pattern). For HTML-native sources (KIFS, SSMFS, DIGG, PMFS, AFS), keep the lighter `lib/agency/afs-scraper.ts` pattern but validate output with the same LLM step.

3. **Proprietary canonical identifiers + knowledge graph.** Every regulation, section (§), kravpunkt, referenced EU regulation, referenced SFS, and authorizing agency gets a laglig.se canonical URI. The graph captures: `AMENDS`, `REPEALS`, `CONSOLIDATES`, `SUPERSEDED_BY`, `AUTHORIZED_BY_SFS`, `TRANSPOSES_EU`, `IN_FORCE_AT`, `PARALLEL_WITH` (e.g. BFS 2011:6 ↔ BFS 2024:x transition). Dual-numbering aliases (BBR↔BFS, FAP↔PMFS, DIFS↔IMYFS, …) resolve to the same graph node. This is the core differentiator — no current Swedish legal database carries this structure end-to-end.

4. **Embedding-based cross-agency entity linking + dedup.** Many obligations appear in multiple places (e.g. a säkerhetsskyddslagen obligation surfaces in SFS, MCFFS, SvKFS, PTSFS, MSBFS; allmänna handlingar obligations in SFS + RA-FS + IMYFS). Embedding similarity + LLM adjudication builds the cross-agency kravpunkt graph so a customer sees a single unified obligation with all authoritative sources attached — not six parallel hits.

5. **Content-hash diff crawling for change detection.** Where no RSS/API exists (majority of agencies), a polling worker hashes each regulation's canonical PDF/HTML. Hash change → trigger re-extraction → Claude diffs old vs new structured content → emits `SectionChange`-style records (reusing our SFS model). This gives agency-grade change tracking even where the agency provides none.

6. **Event-driven pipeline.** Discovery worker (per-publisher cron) → change detection → extraction (Claude) → validation (`lib/sfs/llm-output-validator.ts`-style) → graph updater → notification fan-out (subscribed customers, affected kravpunkter). Already how SFS works; generalize for myndighet plugins.

7. **MCP/agent surface over the graph.** Expose the knowledge graph via a Model Context Protocol server so the in-app AI assistant (and future external integrations) can reason over regulations, obligations, and changes as first-class citizens — not as retrieved text chunks. This is where "cutting edge" pays off: compliance Q&A grounded in a typed graph, not RAG-over-PDFs.

8. **Multimodal ingestion (vision-grade PDFs).** For publishers with heavy bilagor (HVMFS water-body tables, KIFS REACH annexes, BBR structural tables) use Claude vision to extract tables + diagrams directly. Stop fighting OCR — just read the PDF as an image.

### 5.2 Layered ingestion stack (per-publisher)

```
┌──────────────────────────────────────────────────────────────┐
│  DISCOVERY (priority order per publisher)                    │
│  1. Agency-native REST/JSON API                              │
│     — Boverket (BFS), Riksdagen (RFS/SFS/prop),              │
│       Skolverket undocumented PDF API                        │
│  2. Agency-native RSS                                        │
│     — DVFS, MIGRFS, IMY, FoHM, Boverket                      │
│  3. Predictable URL enumeration                              │
│     — TFS `/webdav/.../YYYY/YYYYNNN.htm`,                    │
│       RA-FS integer IDs, Riksarkivet foreskrifter.*          │
│  4. Static HTML index + content-hash diff polling            │
│     — default for everyone else                              │
│  5. JS SPA / WebForms via headless browser                   │
│     — SKOLFS SPA, TSFS dynamic search, STEMFS Arkitektkopia  │
│  6. WAF-aware fetcher                                        │
│     — realistic UA + cookie handshake + headless fallback    │
│     — required for Skatteverket, Bolagsverket, Konkurrens    │
│                                                              │
│  Note: rinfo Atom feeds excluded — only Boverket runs one    │
│  and its REST API supersedes it. Not a generalizable surface.│
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  EXTRACTION (format-aware)                                   │
│  • HTML-native → AFS-style scraper + LLM validation          │
│    (KIFS, SSMFS, DIGG, PMFS, AFS)                            │
│  • PDF → multimodal Claude (document + vision for tables)    │
│    Reuses `lib/sfs/amendment-llm-prompt.ts`                  │
│    Target: most publishers (NFS, LIVSFS, SJVFS, TSFS, …)     │
│  • Agency-consolidated → use directly, skip amendment logic  │
│    (SSMFS, MDFFS, UHRFS konsoliderade)                       │
│  • Annual-reissue → replace-on-publish handler               │
│    (KFMFS, AFFS post-2020)                                   │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  NORMALIZE + GRAPH                                           │
│  • Canonicalize into AmendmentDocument + LegalDocument       │
│    (existing schema, extended with prefix/publisher meta)    │
│  • Resolve prefix aliases (DIFS↔IMYFS, MSBFS↔MCFFS, …)       │
│  • Extract references → graph edges                          │
│    (AMENDS, REPEALS, CONSOLIDATES, AUTHORIZED_BY_SFS, …)     │
│  • Embedding-link to EU regulations + cross-agency dups      │
│  • LLM adjudication on ambiguous links                       │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  DELIVERY                                                    │
│  • Store (Supabase + vector index)                           │
│  • Cache (Redis)                                             │
│  • Subscribe-to-change fan-out (customer kravpunkt alerts)   │
│  • MCP server over the graph → AI assistant surface          │
└──────────────────────────────────────────────────────────────┘
```

### 5.3 Schema additions to anticipate

- `agency_prefix` (e.g. "BFS", "AFS", "HSLF-FS")
- `agency_publisher` (resolves shared series — Socialstyrelsen vs FoHM both into HSLF-FS)
- `legacy_prefix_aliases[]` (DIFS↔IMYFS, MSBFS↔MCFFS, etc.)
- `colloquial_alias` (BBR ↔ BFS, FAP ↔ PMFS)
- `omtryck_of` (BFS-specific: omtryck points to base BFS)
- `successor_doc_id` (whole-document supersession: SvKFS, KFMFS annual reissue, AFFS post-2020)
- `consolidated_version_url` (where agency publishes its own konsoliderad)
- `in_force_status` enum: `Gällande | Kommande | Upphävd`
- `parallel_in_force` bool (for BFS 2011:6 vs 2024-series transition through 2027)
- `change_scope_notes` (TSFS-specific structured change descriptions)
- `source_url` (authoritative first-party URL — always the agency's own domain)
- `extraction_method` enum: `api_json | rinfo_atom | rss | html_scrape | pdf_llm | agency_consolidated | annual_reissue`
- `content_hash` (for diff detection)

### 5.4 Pipeline reuse map

| New source type                                                    | Reuses                                         | New code needed                                                           |
| ------------------------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------- |
| Boverket BFS                                                       | nothing                                        | `bfs-api-client.ts` (greenfield, REST API; rinfo Atom as redundancy only) |
| TSFS, NFS, LIVSFS, SJVFS, KOVFS, PTSFS, IMYFS, MCFFS, MIGRFS, FFFS | `lib/sfs/amendment-llm-prompt.ts` + transforms | thin per-prefix discovery + URL adapters + `myndfs-ingester` framework    |
| KIFS, SSMFS, DIGG, PMFS                                            | `lib/agency/afs-scraper.ts` + transformer      | per-agency HTML transformer                                               |
| KFMFS, AFFS (post-2020)                                            | minimal                                        | "annual-reissue" handler                                                  |
| Riksdagen RFS                                                      | existing SFS API client                        | extend `doktyp=rfs` filter                                                |
| WAF-hostile (Skatteverket, Bolagsverket)                           | PDF pipeline                                   | headless-browser fetcher + cookie handshake                               |

### 5.5 Operational concerns

- **Authoritativity display.** When showing an agency's konsoliderad version, always surface the "tryckta versionen gäller" disclaimer where the agency states it (Socialstyrelsen, ELSÄK-FS). Audit trail must show which extraction method produced the text.
- **Successor events (rare but high-impact).** MSBFS→MCFFS, IMY rename, MPRTFS→MEMYFS. Schema must allow corpus continuity across prefix change.
- **Allmänna råd vs föreskrifter.** Tag separately. BFNAR is _only_ allmänna råd (different legal weight). Many agencies mix both within same FS-series.
- **Transition-period parallel validity.** BFS 2011:6 vs 2024-series both gällande through 2027 — UI must surface the choice; schema needs `parallel_in_force` flag.
- **EU crosslinks.** LIVSFS, SJVFS, KIFS, STAFS, PTSFS regularly transpose or operationalize EU regulation. Customer expectation is to crosslink to EUR-Lex; the graph should carry `TRANSPOSES_EU` edges.

---

## 6. Open Questions / Caveats

1. **Boverket API subscription terms.** Free key, but verify rate limits, change-notification SLA, and long-term stability before BFS ingestion scoping.
2. **Boverket rinfo Atom feed** is still alive but the REST API is clearly their modern surface. Consume the API only; ignore the Atom feed unless the API proves unstable in practice.
3. **Skatteverket Rättslig vägledning** — ~tens of thousands of HTML pages, operationally invaluable, requires its own UX (non-binding guidance). Separate epic after formal SKVFS lands.
4. **HSLF-FS multi-publisher attribution.** Each HSLF-FS document owned by exactly one of 8 agencies. Discovery layer must resolve publisher from metadata, not infer from URL.
5. **STFS rdt geospatial dataset.** Explicitly excluded. If we ever spin up a logistics/transport-planning vertical, evaluate NVDB (Nationella Vägdatabasen) or kommun direct exchanges, not scraping rdt.
6. **Clusters degraded by WebFetch denials during this reconnaissance:** HSLF (direct fetches filled Soc/FoHM/IVO/LV-thin), Financial (FFFS/BFNAR filled; BOLFS/KKVFS/RIFS/RGKFS unverified), Labor (FKFS/PFS/AFFS/MIGRFS filled; AGVFS/IAFFS/SiSFS unverified). Volume estimates and exact selectors for those three clusters should be re-verified before pipeline build.
7. **Knowledge-graph scope for MVP.** The full graph (dual-numbering aliases, cross-agency entity resolution, EU crosslinks, MCP surface) is the end-state. MVP can ship BFS + existing SFS with a simpler schema and layer graph features incrementally as more publishers come online.

---

## 7. Suggested Next Step

Stand up a 1–2 sprint spike on **BFS via the Boverket REST API** as the reference implementation of the `myndfs-ingester` framework. BFS gives:

- Highest cross-cutting compliance value of any single myndighet outside SFS
- The cleanest API on the Swedish landscape — minimal scraping engineering
- A real test of the "konsoliderad + amendment + omtryck + parallel-in-force" data model that nearly every other agency will eventually need
- Immediate customer demo material (BBR is recognizable to every construction-adjacent buyer)

Once BFS is in production, the next four follow in order: **TSFS → MCFFS → KIFS → IMYFS**, each reusing more of the SFS pipeline than the last. In parallel, begin scaffolding the knowledge-graph layer (canonical IDs, AMENDS/REPEALS edges, prefix-alias resolution) so it's in place by the time HSLF-FS lands as Tier 1 #6 — that's where multi-publisher shared-series handling becomes load-bearing.
