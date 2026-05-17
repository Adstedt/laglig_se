# Laglig GTM: Competitive language + initial SEO strategy

**Status:** v1 (initial GTM read)
**Date:** 2026-05-18
**Author:** Marketing (Alexander + Claude)
**Companion docs:** `marketing-site-strategy.md`, `market-research.md`, `prd/epic-26-marketing-pages-seo-content-engine.md`, `brief.md`, `landing-page-spec.md`, `competitive-analysis/notisum-change-notification-analysis.md`

This memo maps the competitive language of the Swedish legal-monitoring / compliance market and sets initial SEO priorities for Laglig. It is the marketing-side companion to the engineering-side Epic 26 (marketing pages + SEO content engine) and the broader `marketing-site-strategy.md` IA.

---

## TL;DR — three things that change the plan

1. **The category is owned by ISO consultancies, not SaaS.** Page 1 for *"lagbevakning"*, *"lagefterlevnadskontroll"*, *"laglista mall"* is wall-to-wall consultants (Aptor, Hållbarhetsteamet, WSP, Intersolia, Ecowise, KvalitetsGruppen, Time2Cert, Railify) bundling a portal with services. Notisum — the supposed incumbent — doesn't even rank top-10 for its own category term. This is not a "displace the SaaS incumbent" market. It's an "unbundle the consultancy stack" market. Position Laglig as "the platform consultants wish they'd built" — modern SaaS, transparent pricing, AI-native, no retainer required.

2. **Three Swedish words carry the entire category.** `lagbevakning` (monitoring), `laglista` (the artifact), `lagefterlevnadskontroll` (the ISO audit). They have no clean English equivalent, so zero international SERP pollution. Own them in URL slugs, H1s, megamenu labels, and product names. Every competitor uses them — none has a clean, well-architected product page for each.

3. **NIS2 is a 6-month newsjack window opening RIGHT NOW.** Cybersäkerhetslagen 2025:1506 entered force 2026-01-15. Every consultancy rushed up a "NIS2 checklista" blog post. None has a proper product-grade `/omraden/nis2` page that converts. Same applies to CSRD (wave-2 reporters hit 2026) and AI-förordningen (rolling effect through 2026–2027). Three concurrent newsjack windows.

---

## 1. Competitive language map

What each player actually says on their homepage / category page:

| Player | Category position | Headline (verbatim) | What they own | Their gap |
|---|---|---|---|---|
| **Notisum** (notisum.com) | Pure-SaaS incumbent (~2k customers, ~40M SEK ARR) | *"Lagbevakning som ökar er kontroll och sparar er tid"* — "Varför har över 2000 företag valt Notisum?" | The words `lagbevakning`, `laglista`, `lagefterlevnadskontroll`, `rättsnätet`. ISO 14001/45001 framing. Free 14-dagars-trial. | No AI. Dated UX ("1990-tals" framing in our brief is fair). No public catalog SEO. Parent-brand confusion (Notisum / Rättsnätet / Lagboken → Karnov Open). |
| **JP Infonet** | Premium beslutsstöd for legal pros | *"Juridisk information, beslutsstöd och kompetens på det sätt du föredrar"* | The word `beslutsstöd`. Per-domain "nets" — JP Arbetsmiljönet, JP Miljönet, JP Arbetsrättsnet (24+). Lawyer-coded language. | Not built for SMB compliance ops. No workflow surface. Expensive, opaque pricing. |
| **Karnov / Norstedts Juridik** | Premium for law firms; runs free `Karnov Open` (was Lagboken) | (now nj.se) | Free legal corpus front-door via Karnov Open. Lawyer trust. | Not in the SMB compliance workflow market at all. Acquisition target per `brief.md`. |
| **Aptor (Lagportalen)** | Consultancy bundling a portal | *"Lagbevakning – vad innebär det?"* (explainer-as-homepage) | The category-definition long-tail. Hybrid model: portal + konsultstöd + utbildning. | Educational-tone homepage doesn't sell. Portal is an afterthought. |
| **Hållbarhetsteamet** | Consultancy + portal | *"Effektivisera er lagbevakning med vårt verktyg"* — "skräddarsydd lagbevakning anpassad efter era behov" | "Personlig service. Boka möten." — the human-touch flank. | Service-led pricing makes them slow + expensive. No self-serve. |
| **WSP / Intersolia / Ecowise / Railify** | Niche consultancies (Intersolia owns chemicals/REACH) | "Lagbevakning för ISO 14001/45001" | ISO-certified buyer trust. Niche depth. | Pure services. No product. |
| **GDPR-niche SaaS** (GDPR Hero, DirSys, Adept, businesswith comparator) | Single-regulation tools | Various | GDPR-only buyers | Don't cover the rest of the compliance stack. |
| **Fieldly et al.** (adjacent) | Construction ops, *not* compliance | "Digital [feature] för bygg" | Construction vertical. Personalliggare, ID06, AB04, byggdagbok. | Zero coverage of AFS-paketen, ISO, GDPR, NIS2, EU-rätt. **Our wedge per `marketing-site-strategy.md` §13.4.** |

### The words to take from each

- **From Notisum:** `lagbevakning`, `laglista`, `lagefterlevnadskontroll` — these are *category vocabulary*, not branded terms. Use them everywhere. Don't invent synonyms.
- **From the consultancies:** `skräddarsydd`, `personlig service`, `stöd` — they own the "human helps you" register. Counter with `automatisk`, `AI-grundad`, `klart på 5 minuter`, `inget konsultarvode`.
- **From JP Infonet:** `beslutsstöd` — borrow this register for the AI-assistant page. "Beslutsstöd" is more credible than "chatbot" for a compliance buyer.
- **From Fieldly:** the *concrete artifact* trick — "postit-lappar," "miniräknare," "A4-sidor." For Laglig, the artifacts to name and replace are: **pärmar, Excel-laglistor, statiska PDF:er från konsulten, e-postdigest från Notisum, kvartalsfaktura från revisionsbyrån.**

---

## 2. Positioning words Laglig should own

| Word/phrase | Why it works | Where it lands |
|---|---|---|
| **"AI-grundad i svensk rätt"** | Specific, defensible, dodges generic "AI-powered" | Homepage hero, AI-assistent page, every Branscher hero |
| **"Inga konsultarvoden"** | Direct counter to Aptor/Hållbarhetsteamet | Pricing page, Byt-till-Laglig page |
| **"Citerar lagtexten"** | Counter to ChatGPT hallucination fear | AI-assistent page, every place AI is mentioned |
| **"Klar på 5 minuter"** | Counter to Notisum's onboarding friction | Homepage, Kom-igång page |
| **"170 000+ rättskällor — gratis att söka"** | Unique to Laglig (the catalog moat) | Homepage, Lagdatabas hub, every footer |
| **"Sigillerad revisionsrapport"** | Differentiated for ISO buyers, no competitor claims it | Lagefterlevnadskontroll page, Bygg/Industri/Vård pages |
| **"Compliance som lär sig ert företag"** | The flywheel story (marketing-site-strategy §1.5) | AI-assistent, Lagefterlevnadskontroll, every industry page |
| **"Coolt med koll"** | Brand voice — only use sparingly, never in H1 | Footer tagline, About page, social, ads — NOT product copy |

### What NOT to claim (will hurt trust)

- "Ersätt din jurist" — overreach, regulatory risk
- "AI utan fel" — set up for failure; say "citerar källa, hallucinerar inte"
- "Tränas på era data" — false (RAG ≠ fine-tuning) and a GDPR red flag
- "Komplett juridisk rådgivning" — disclaimer trap

---

## 3. Keyword strategy — five tiers, sequenced

The general principle: **don't fight for the head term until you have the long-tail foundation**. Catalog (170k pages) + glossary + topic pages first; comparison + branded second.

### Tier 1 — Category head terms (medium volume, high intent, achievable)

| Keyword | Target URL | Competitive read |
|---|---|---|
| `lagbevakning` | `/produkt/lagbevakning` | SERP = consultancies + Notisum. A proper SaaS page with screenshots beats them. |
| `laglista` / `laglista mall` | `/produkt/laglistor` + `/ordbok/laglista` | Templates dominate — outflank with "skip the template, generate yours in 5 min". |
| `lagefterlevnadskontroll` | `/produkt/lagefterlevnadskontroll` | Weakest SERP — every result is a service quote. Easy take. |
| `kravpunkter` / `kravspecifikation lag` | `/produkt/krav-och-kravpunkter` | Almost no SERP competition. |
| `compliance verktyg sverige` | `/` + `/jamfor/notisum` | Comparison aggregator (businesswith.se) ranks — counter with branded comparison pages. |

### Tier 2 — Topic / regulation pages (high commercial intent, freshness window open)

These are `/omraden/*` pages. Each is a 1–2k word reference + live `<ChangeFeedEmbed>` + catalog links.

| Keyword cluster | Why now | Target URL |
|---|---|---|
| `NIS2 sverige`, `NIS2 checklista`, `cybersäkerhetslagen` | **NEW LAW** — Cybersäkerhetslagen 2025:1506 in force 2026-01-15. Six-month freshness window. | `/omraden/nis2` |
| `GDPR efterlevnad`, `dataskyddsförordningen företag`, `DPIA mall` | Mature SERP but high intent and we have the catalog | `/omraden/gdpr` |
| `CSRD omfattas`, `CSRD rapportering`, `ESRS` | Wave 2 reporters hit in 2026. Calculator play. | `/omraden/csrd` + `/resurser/verktyg/csrd-omfattningstest` |
| `arbetsmiljölagen företag`, `systematiskt arbetsmiljöarbete`, `AFS 2023:1` | Stable, high SMB intent | `/omraden/arbetsmiljo` |
| `AI-förordningen företag`, `AI Act svensk lag` | EU AI Act rolling effect 2026–2027 | `/omraden/ai-forordningen` |
| `brandskydd lag företag`, `SBA` | Stable, vertical pull (restaurang, fastighet) | `/omraden/brandskydd` |
| `visselblåsarlagen` | Mature but underserved | `/omraden/visselblasarlagen` |
| `ISO 14001 lagefterlevnad`, `ISO 45001 lagkrav` | High commercial intent — ISO consultant audience | `/omraden/iso-14001` + `/produkt/lagefterlevnadskontroll` |

### Tier 3 — Branded competitor + buying-stage (lowest volume, highest intent)

These are the *gold queries* — searcher has wallet out. Almost zero competition because nobody else builds them.

- `notisum alternativ` → `/jamfor/notisum` ← SERP currently empty. Build first.
- `notisum pris`, `notisum recension` → same page, anchor sections
- `jp infonet alternativ` → `/jamfor/jp-infonet`
- `lex.nu alternativ` → `/jamfor/lex-nu`
- `lagportalen aptor pris` → `/jamfor/aptor`
- `byta från excel laglista` → `/jamfor/excel`
- `lagbevakning pris jämförelse` → `/priser` + comparison block

**Rule:** Be honest. The Fieldly-style "When X is the better choice" section on each comparison page boosts trust *and* rankings — Google rewards balanced comparisons over hatchet jobs.

### Tier 4 — Industry pages (long-tail, defensive moat)

Per `marketing-site-strategy.md` §5. Keyword examples per industry:

- **Bygg**: `laglista bygg`, `AFS bygg`, `arbetsmiljöplan bygg`, `ID06 lagkrav`
- **Industri**: `REACH efterlevnad`, `seveso företag`, `kemikalier lagkrav`
- **Restaurang**: `egenkontroll livsmedel mall`, `alkohollagen tillstånd`, `HACCP`
- **Tech/SaaS**: `GDPR SaaS`, `NIS2 it-bolag`, `DPA mall`
- **Vård**: `patientsäkerhetslagen`, `IVO-tillsyn checklista`, `lex maria`
- **Offentlig sektor**: `LOU stöd`, `OSL diarieföring`, `förvaltningslagen handläggning`

### Tier 5 — Glossary / long-tail (compound interest)

The `/ordbok/[term]` programmatic engine (Epic 26.11). Each term = featured-snippet target.

**Highest-leverage terms, build first 30:**
`AFS`, `BFS`, `NFS`, `FFFS`, `LIVSFS`, `kravpunkt`, `laglista`, `lagbevakning`, `lagefterlevnadskontroll`, `revisionsrapport`, `arbetsmiljöplan`, `byggherreansvar`, `OVK`, `SBA`, `HACCP`, `REACH`, `CLP`, `Seveso`, `egenkontrollprogram`, `förmodad lag`, `föreskrift vs lag`, `tolkningsbesked`, `prejudikat`, `SFS`, `proposition`, `förarbeten`, `kollektivavtal`, `arbetsmiljöansvar`, `tillsynsmyndighet`, `förvaltningsbeslut`.

Each links inline into the matching `/produkt/*` page — the highest-leverage internal-linking pattern (Fieldly research §13.3).

---

## 4. SEO content priority — what to ship first

Sequencing matters more than scope. Build in this order:

| Sprint | Ship | Why first |
|---|---|---|
| **0** (now) | `/jamfor/notisum` | Zero competition for `notisum alternativ`. Highest-intent traffic. 1 page, 1 day. |
| **1** (this month) | `/omraden/nis2` + glossary entry for `cybersäkerhetslagen` | Newsjack window closing. Every week of delay = lost traffic. |
| **2** | `/produkt/lagbevakning`, `/produkt/lagefterlevnadskontroll`, `/produkt/laglistor` | Category head terms. Beats consultancy SERPs with one round of work. |
| **3** | `/lagdatabas` hub + breadcrumb refactor on existing `/lagar/*` | Makes the 170k catalog pages funnel correctly. Compounds every existing rank. |
| **4** | `/ordbok` + first 30 terms | Long-tail engine. Featured-snippet capture compounds for months. |
| **5** | `/branscher/bygg` + `/branscher/tech-och-saas` + `/branscher/industri` | Highest commercial intent, biggest TAM segments. |
| **6** | `/omraden/csrd` + `/omraden/gdpr` + `/omraden/iso-14001` + remaining `/jamfor/*` | Rest of money pages. |
| **7+** | Remaining `/branscher/*`, `/omraden/*`, blog, persona pages | Steady editorial cadence. |

> **Note re Epic 26 sequencing:** This re-sequences Epic 26's order. Story 26.4's first validation batch was `/branscher/bygg`, `/branscher/hotell-restaurang`, `/branscher/it`, `/funktioner/kontroller`, `/funktioner/ai-agent`. Marketing recommendation: swap in `/jamfor/notisum` and `/omraden/nis2` as the first two — cheaper to ship, stronger commercial leverage right now — then continue template validation with `/branscher/bygg` and `/produkt/lagefterlevnadskontroll`. To be reconciled with PO before Story 26.4 kicks off.

---

## 5. Specific tactical recommendations

1. **Rename the Områden megamenu** — Epic 26 uses `Områden`; consider `Lagområden` or `Regelverk` for the SEO label. "Områden" alone is too generic for Google.

2. **Build `/jamfor/notisum` this week.** Format: comparison table + 800-word narrative + "When Notisum is still the right choice" honest section (their offline corpus depth, AD database for lawyers). Page will rank within 2 weeks because nothing else exists at that query.

3. **Don't mention competitors by name on `/byt-till-laglig`.** Use the Fieldly-style polite Swedish pattern ("Trött på 1990-tals UX? Saknar AI-grundade sammanfattningar?"). Save the name drops for `/jamfor/[competitor]` — that's where searchers expect them.

4. **Ship a `/omraden/nis2` page within 14 days.** Include the `cybersäkerhetslagen 2025:1506` SFS link from the catalog, a sector-by-sector "omfattas du?"-checklist, and an embedded change-feed for the regulation. The single highest-ROI page we can ship this month.

5. **Make `lagbevakning`, `laglista`, `lagefterlevnadskontroll` the megamenu labels for Produkt-column-1**, not internal naming variations. Match the SERP vocabulary exactly.

6. **Pricing page must beat consultants on transparency.** Notisum hides pricing; Aptor/Hållbarhetsteamet hide pricing. Showing 400/995/1995/2995 SEK with no "request a quote" is a competitive moat in this market. Make it the loudest message on `/priser`.

7. **Promote the catalog reciprocal-link slot from v2 to v1.** Epic 26.3 reserves `<RelatedMarketingPages>` on each `/lagar/[id]` page but ships it out-of-scope-for-v1. Currently catalog pages are SEO dead ends. The moment Tier-1 marketing pages exist, the bidirectional link compounds every catalog rank. Worth promoting.

8. **Build the public `/resurser/verktyg/lagandringsfeed`** ("Laglig's Lönekompassen") early. It's our existing change-detection pipeline unwrapped to a public URL. Captures `[lagnamn] ändring 2026` long-tail with no incremental editorial cost, and gives every blog post + every industry page a high-quality outbound link to embed.

---

## 6. Sources (live SERP + competitor scrapes, 2026-05-17/18)

- [Notisum (.com SE)](https://www.notisum.com/sv) — competitor homepage scrape
- [JP Infonet](https://www.jpinfonet.se) — competitor homepage scrape
- [Aptor – Lagbevakning](https://aptor.se/lagbevakning-lagefterlevnad/) — consultancy + portal
- [Hållbarhetsteamet – Lagbevakning](https://hallbarhetsteamet.se/vara-tjanster/lagbevakning/) — consultancy bundling
- [WSP – Compliance registers](https://www.wsp.com/en-us/services/compliance-registers-and-digital-services-for-legislation-monitoring)
- [Intersolia – Lagbevakning REACH](https://intersolia.com/sv/lagbevakning-lagefterlevnad/) — niche
- [Ecowise – Lagrevision](https://ecowise.se/ledningssystem/lagrevision)
- [KvalitetsGruppen – Laglista guide](https://kvalitetsgruppen.com/uppdatera-laglista/) — SERP leader for "laglista mall"
- [SIS – ISO 14001 tolkningar §9](https://www.sis.se/iso14001/tolkningsgruppiso14001/hanteradetolkningsfrgor/9.-utvardering-av-prestanda/) — the ISO 9.1.2 reference `/produkt/lagefterlevnadskontroll` should cite
- [Businesswith – GDPR-system jämförelse 2026](https://businesswith.se/dataskydd-gdpr/) — aggregator competitor for `/jamfor/*`
- [Businesswith – Ledningssystem 2026](https://businesswith.se/ledningssystem/) — same aggregator
- [MSB – NIS2-direktivet](https://www.msb.se/sv/amnesomraden/informationssakerhet-cybersakerhet-och-sakra-kommunikationer/krav-och-regler-inom-informationssakerhet-och-cybersakerhet/nis-direktivet/det-har-ar-nis2-direktivet/) — authoritative NIS2 source
- [eBuilder – NIS2 Sverige 2026 guide](https://ebuildersecurity.se/articles/nis2-sverige-2026-guide/) — example competing NIS2 page

---

## Change log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-05-18 | 1.0 | Initial competitive-language + SEO-tier memo. Five keyword tiers, 8-sprint ship order, 8 tactical recommendations. Re-sequences Epic 26's Story 26.4 batch — to be reconciled with PO. | Marketing (Alexander + Claude) |
