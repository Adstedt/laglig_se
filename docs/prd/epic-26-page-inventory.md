# Epic 26 — Marketing Page Inventory & Content Expansion Plan

**Status:** Draft / planning artifact (2026-06-25)
**Version:** 0.5 (PO validation pass + imagery build spec)
**Parent:** [`epic-26-marketing-pages-seo-content-engine.md`](./epic-26-marketing-pages-seo-content-engine.md)
**Purpose:** Enumerate the full set of marketing/content pages to build on the existing Epic 26 substrate — each one targeting a Swedish search cluster **and** tied to a concrete laglig.se product angle, so every page works as both an SEO surface and a paid-ad landing page that converts into trial signup.

---

## 1. Where we stand

The Epic 26 **substrate is built and working**:

- 3 layout templates (`FeaturePageTemplate`, `IndustryPageTemplate`, `TopicPageTemplate`) + `BasePageTemplate` + `MarketingShell`
- 12 section components (`MarketingHero`, `FeatureGrid`, `SplitFeature`, `ProofBlock`, `CtaBlock`, `OrgCheckCta`, `HeroOrgCheck`, `CatalogLawList`, `FaqAccordion`, `RelatedPagesGrid`, `ChangeFeedEmbed`, `ScreenshotFrame`)
- MDX content surface (`content/marketing/{kind}/[slug].mdx`) with Zod-validated frontmatter (`lib/marketing/frontmatter-schemas.ts`)
- Live catalog-link resolution (`lib/marketing/catalog-link.ts`), auto OG images, sitemap auto-registration, UTM CTA tracking

**Live today: 14 pages** — 7 `funktioner` + 7 `branscher`. `/omraden` is routed but empty (0/8). `jamfor`, `kundcase`, `ordbok`, `blogg` not built.

This document is the content build-out plan on top of that substrate. **Adding a page is editorial work (MDX file + ~30-min review), not engineering** — except for the small additions in §4 and the programmatic route engine in §7.

---

## 2. Strategic frame

### Inspiration analysed
- **Notisum kunskapsbank** (~25 evergreen concept/reference pages) — they own the *generic Swedish compliance vocabulary* (laglista, lagbevakning, lagefterlevnad, miljöbalken, ISO 14001, internrevision…). Four archetypes: concept/method, ISO standards, legislation explainers, management-system concepts.
- **Fieldly funktioner** (~16 pages, one per capability, grouped megamenu under `/produkt/[feature]`) — the model for a complete, granular feature cluster.

### The differentiator (why we outperform, not just match)
Notisum's concept pages are **static prose that goes stale**. Our three structural advantages make every page *live*:
1. **Live catalog** — 10k+ law pages (`/lagar/*`, `/foreskrifter/*`, `/eu/*`) linked via `<CatalogLawList>`, with current consolidated text + amendments.
2. **Live change feed** — `<ChangeFeedEmbed>` shows recent changes per area (freshness signal Google + AI answer engines reward).
3. **AI agent + org-number check** — interactive "testa med ditt organisationsnummer" conversion device on every page.

A legislation explainer like `miljöbalken` is the sharpest example: notisum *describes* the law; we link the **actual live text + every amendment + the change feed** — something they cannot replicate without rebuilding our catalog.

---

## 3. The product-angle rule (applies to every page)

Same conversion machine on all pages (org-check + UTM trial CTA), but the **hook** is tailored to intent. Native, concise Swedish — no fluff. Reference hooks:

| Archetype | Hook (Swedish) |
|---|---|
| Lagförklaring | *"Miljöbalken ändras flera gånger om året. Laglig.se bevakar varje ändring åt dig — kopplad direkt till din laglista."* |
| ISO-standard | *"ISO 14001 kräver en aktuell förteckning över bindande krav. Laglig.se bygger den åt dig och håller den uppdaterad."* |
| Begrepp/metod | *"Internrevision utan kalkylblad — planera, genomför och dokumentera lagefterlevnadskontrollen."* |
| Bransch | *"Vilka AFS-föreskrifter gäller för ditt byggföretag? Ange organisationsnummer, så visar vi din laglista."* |
| Intersection | *"GDPR för IT-bolag — exakt vilka krav som gäller, samlade och bevakade i Laglig.se."* |

**Copy must match the *current* product.** (Example caught this session: there is no SHA-256/cryptographic signing anymore — Story 21.26/21.27 removed it. The reports feature is a **Revisionsrapport**: a completed cycle is låst/avslutad with who+when, each bedömning signerad av ansvarig, exported as PDF. No integrity/hash claims.) Verify each page's feature description against live code before publishing.

---

## 3.1 Content quality & SEO standards (every page)

**Grounded, not hallucinated.** All factual content — laws, paragraphs, requirements, dates, standard clauses — must be researched against **primary sources**: our own catalog/corpus (live `LegalDocument` text + amendments) and official sources (riksdagen.se / SFS, Arbetsmiljöverket / AFS, Boverket, MSB, Naturvårdsverket, IMY, EUR-Lex, SIS / ISO). No invented citations, section numbers, or "facts". When unsure, link to the catalog page rather than paraphrase. The catalog is the source of truth for anything legal; product claims are cross-checked against live code (§3).

**Language.** Native, professional Swedish — correct grammar, natural phrasing, high readability (short sentences, clear structure, no machine-translation feel). A grammar/readability pass per page.

**Per-page SEO (frontmatter + on-page):**

- **Meta title** — unique, ≤ 60 chars, primary keyword front-loaded, brand suffix where it fits.
- **Meta description** — unique, ~150–160 chars, primary + one long-tail, soft CTA.
- **One H1** (keyword-bearing); H2/H3 structured around sub-intents and natural long-tail phrasings (real search questions).
- **Long-tail coverage** — weave a fair set of variants ("vad kostar", "krav", "checklista", "för [bransch]", "mall", "exempel") into headings, body, and FAQ — without keyword stuffing.
- **FAQ** (already required) — questions phrased as real search queries; powers FAQPage JSON-LD + AI-answer citability.
- **Internal links** — cross-link across the whole set **where it genuinely helps the reader**: bransch ↔ område ↔ funktion ↔ lagguide ↔ ordbok ↔ catalog (`<CatalogLawList>` to laws, `relatedPages` for the sibling-grid, a few natural in-body links). A handful of contextual, relevant links per page — **don't overdo it / no link farms**. Descriptive anchor text, never "läs mer".
- **Canonical + OG** — via `generateMarketingMetadata()`; ensure canonical is unique per page (esp. the lagguide-vs-catalog split, §6).
- **Image SEO** — meaningful `alt` on every screenshot/photo.

**Definition of done (per page):** sources verified · grammar pass · unique meta title + description · long-tail in headings/FAQ · ≥ 90 Lighthouse SEO.

---

## 4. Architecture decisions

1. **Extend `omraden`, don't invent template kinds.** The `TopicPageTemplate` renders concept/ISO/legislation/regulatory pages. Avoids a new route/schema/nav column + a second validation gate.
2. **Two new section components** (the ~10% the current 12 don't cover):
   - `<DefinitionBox>` — featured-snippet "Vad är X?" answer box (notisum's strongest SEO device; feeds AI answer engines). Optional `definition` frontmatter field.
   - `<ProcessSteps>` — numbered steps for "certifiering steg-för-steg" and the `Vad?/Hur?/Vem?/När?` framework.
   - (`<ComparisonTable>` for `/jamfor` already scoped in Story 26.9.)
3. **`/kunskapsbank` hub** — a discovery surface (we only have the megamenu today) aggregating `omraden` + concept pages + `ordbok`, grouped by the §5.3 A–E groups. Strong internal-linking nexus. No new page *kind* — just an index. **Overlaps the `/omraden` category page (§5.8); pick one as canonical — open item §11.**
4. **Cannibalization guard** — do NOT build concept `laglista` / `lagefterlevnadskontroll` pages that compete with `/funktioner/laglista` and `/funktioner/kontroller`. Instead enrich those feature pages with a "Vad är …?" `<DefinitionBox>` so they own concept-intent too. One URL per keyword.
5. **Funktioner megamenu → grouped** (Fieldly-style). At 15 pages the flat list in `nav-links.ts` becomes 5 category groups (see §5.1). Do this before adding the new feature pages.
6. **Megamenu overflow → category/index pages + "Visa alla".** The megamenu can't surface 15 funktioner / 20 branscher / 49 områden without becoming a wall. So each column shows a curated top set, then a **"Visa alla →"** link to a category/index page (`/funktioner`, `/branscher`, `/omraden`) that showcases the full set as a card grid grouped by category (see §5.8). The footer mirrors the same "Visa alla" links. Design reference already exists: `_prototypes/marketing-site/branscher.html` (3-col industry card grid hub).

---

## 5. Page inventory

### 5.1 Funktioner — 8 new → 15 total (Fieldly model)

Live: laglista, lagbevakning(=lagandringar), kontroller, kravpunkter, styrdokument, uppgifter, ai-agent.

| Page | Status | Group | Product angle / target |
|---|---|---|---|
| Laglista | live | Bevakning & laglista | bygg/importera laglista |
| Lagbevakning *(rename target of `lagandringar`)* | live | Bevakning & laglista | own "lagbevakning" (higher volume than "lagändringar") |
| **Lagkatalog & rättskällor** | 🆕 | Bevakning & laglista | the 10k+ live catalog — unique vs Notisum/Fieldly |
| **AI-sammanfattningar** | 🆕 | Bevakning & laglista | "AI sammanfattning lag" |
| Kontroller (lagefterlevnadskontroll) | live | Efterlevnad & kontroll | audit cycles |
| Kravpunkter / kravhantering | live | Efterlevnad & kontroll | gap-analys |
| **Revisionsrapport** | 🆕 | Efterlevnad & kontroll | completed-cycle PDF report (no integrity claims); auditor angle |
| **Mallar** | 🆕 | Efterlevnad & kontroll | reusable audit/control templates |
| Styrdokument | live | Styrning & dokumentation | policy library |
| **Filer & dokumenthantering** | 🆕 | Styrning & dokumentation | evidence/docs tied to krav |
| Uppgifter | live | Arbete & samarbete | kanban/list/calendar |
| **Ansvar & samarbete** | 🆕 | Arbete & samarbete | distributed ownership |
| **Aktivitetslogg & spårbarhet** | 🆕 | Arbete & samarbete | audit trail — auditor hook |
| AI-agent | live | AI & automation | the differentiator |
| **Importera laglista** | 🆕 | AI & automation | migration intent ("flytta laglista från Excel/Notisum"); bridges from `/jamfor` |

Reserve (build only if search volume justifies): behörigheter & roller, integrationer/API, översikt/dashboard.

### 5.2 Branscher — 13 new → 20 total

Live: bygg, fastighet, hotell-restaurang, industri, it, transport, vård-omsorg.

New: livsmedel/produktion · handel/detaljhandel · energi & el · kemi/kemikalieindustri · lantbruk · avfall & återvinning · offentlig sektor/kommun · skola & utbildning · BRF/bostadsrättsförening · åkeri & logistik · tandvård · verkstadsindustri · gruvor & täkter.

Angle: *"färdig laglista för [bransch], anpassad efter ditt org.nr."*

### 5.3 Områden — ~49 new

**A. Kärnområden (8)** — already planned: GDPR · NIS2 · Arbetsmiljö · Brandskydd · Miljö · Visselblåsarlagen · Penningtvätt · ISO 14001

**B. ISO-svit (5):** ISO 45001 · ISO 9001 · ISO 50001 · ISO 27001/27000 · ISO 9000

**C. Begrepp & metod (6):** Lagrevision · Internrevision · Ledningssystem · Miljöledningssystem · Kvalitetsledningssystem · Lagefterlevnad

**D. Lagförklaringar (15 curated → expands to the Lagguide-bibliotek, §6):** Miljöbalken · Arbetsmiljölagen · AFS · Plan- och bygglagen (PBL) · Lag om skydd mot olyckor (LSO) · Livsmedelslagen · Alkohollagen · LAS · Diskrimineringslagen · Elsäkerhetslagen · Arbetstidslagen · Avfallsförordningen · REACH · Boverkets byggregler (BBR) · Strålskyddslagen

**E. Regulatoriska teman (15):** CSRD/hållbarhetsrapportering · EU-taxonomin · AI Act · DORA · Systematiskt arbetsmiljöarbete (SAM) · Systematiskt brandskyddsarbete (SBA) · OVK · Egenkontroll · CE-märkning · Maskindirektivet · Riskbedömning · Kemikalieförteckning · Energikartläggning (EKL) · ESG · Avfallstrappan

### 5.4 Jämför — 6 new
Notisum · Karnov · JP Infonet · Laglista i Excel · Manuell lagbevakning · Generiska ledningssystem-verktyg. (Uses `<ComparisonTable>`, Story 26.9. Each includes a fair "När [konkurrent] passar bättre" section.)

### 5.5 Kundcase — 3–5 new
Templated, customer-dependent. **Almåsa is excluded** (real demo workspace — never feature in marketing). Start with 2–3 confirmed customers, grow editorially.

### 5.6 Ordbok — ~35 starter terms (→ 60)
laglista · lagbevakning · lagefterlevnad · efterlevnadskontroll · kravpunkt · bindande krav · rättskälla · föreskrift · förordning · direktiv · författningssamling · internrevision · lagrevision · ledningssystem · styrdokument · revisionsrapport · avvikelse · riskbedömning · egenkontroll · AFS · miljöbalken · OVK · SBA · SAM · CE-märkning · REACH · GDPR · NIS2 · ISO 14001 · ISO 45001 · ISO 9001 · visselblåsarlagen · penningtvätt · CSRD · ESG

### 5.7 Hub & conversion supports — 6 new
`/kunskapsbank` (hub) · `/ordbok` (index) · `/jamfor` (index) · `/kom-igang` · `/demo` · `/blogg` (substrate + 2 launch posts)

### 5.8 Category / index pages — 3 new

The "Visa alla" destinations from the megamenu + footer (§4.6). Each showcases its full set as a card grid grouped by category, is a strong internal-linking nexus, and ranks for the head term:

- `/funktioner` — all features, grouped by the 5 funktioner categories (§5.1)
- `/branscher` — all industries, card grid (head term "laglista per bransch"; design ref `_prototypes/marketing-site/branscher.html`)
- `/omraden` — all topics, grouped by the §5.3 A–E groups. **Overlaps `/kunskapsbank` (§4.3/§5.7); pick one as canonical to avoid duplication — open item §11.**

---

## 6. Lagguide-bibliotek — top 50–100 B2B laws (the biggest catalog lever)

Build content pages for the **top 50–100 laws/föreskrifter that apply to companies** — expand §5.3-D from 15 hand-written explainers into a full **50–100 page library** of the most B2B-relevant legislation. This is the single biggest SEO opportunity in the epic: high-intent legal terms that competitors cover only with thin, static prose, while ours are backed by live catalog data + structured markup. Real chance to outrank them at scale.

**Data-driven ranking (no guessing):**
- Rank by frequency in `LawListTemplate` / `TemplateItem` (schema ~line 1817) — laws appearing across the most standard industry lists = the top B2B laws by definition.
- Seed each page's "vad innebär den för ditt företag" from the existing **`business_context`** field on the law model (schema ~line 396: *"Why this law matters to the business"*). Half the content per page already exists in the DB.

**Two tiers (avoid duplicating our own catalog pages):**
- **Top ~20 = full hand-written explainers** (the §5.3-D set) — real depth, real search volume.
- **Long tail to ~100 = programmatic `/lagguide/[slug]`** — catalog-backed: live summary + amendments + change feed + `business_context` + "så hjälper Laglig.se dig efterleva [lag]". Cross-linked to the catalog page; canonicals split by intent.

| Surface | Intent | Owns keyword |
|---|---|---|
| Catalog `/lagar/[id]` (exists) | "läs lagtexten" — research | the law-text query |
| Lagguide `/lagguide/[slug]` (new) | "vad innebär den + hur efterlever jag" — commercial | "[lag] krav / sammanfattning / checklista" |

**Structured data (featured-snippet + AI-answer capture).** Every lagguide page emits JSON-LD — `BreadcrumbList` + `Article` + `FAQPage` (from the visible `<FaqAccordion>`) — and leads with a `<DefinitionBox>` ("Vad är [lag]?") + `<ProcessSteps>` where relevant, all structured for featured-snippet and AI-answer-engine capture. Markup/visible-content parity is required (Google rule). This is where the SEO gain compounds: ~50–100 pages × structured Q&A + definition boxes on terms the competition leaves as plain text.

**TODO:** run the ranking query over `LawListTemplate`/`TemplateItem` joined to `business_context` to produce the concrete prioritized top-100 list.

---

## 7. Programmatic intersection pages (the ad-scaling reserve)

Catalog-backed, ideal paid-ad landing pages, **not thin** because each ships a *different* real law list via `<CatalogLawList>`:

- **Bransch × Område** — e.g. "GDPR för byggföretag", "SBA i hotell". 20 industries × ~15 topics = up to 300; launch high-intent ~60–100 first.
- **Funktion × Bransch** — e.g. "Laglista för åkeri". Launch ~40.

All three programmatic families are separate routes (`/lagguide/[slug]`, the bransch×område route, the funktion×bransch route) but share **one catalog-backed resolution engine** (the same `<CatalogLawList>` + frontmatter-driven law lookup) — building that engine once is the single highest-leverage move for the ads goal. Log any coverage caps; never silently truncate.

---

## 8. Totals

| Cluster | New pages |
|---|---|
| Funktioner | 8 |
| Branscher | 13 |
| Områden | ~49 |
| Jämför | 6 |
| Kundcase | 3–5 |
| Ordbok | ~35 (→60) |
| Hub & supports | 6 |
| Category / index pages | 3 |
| **Curated subtotal** | **~124** |
| Lagguide-bibliotek (programmatic-curated) | +50–100 |
| Bransch×Område + Funktion×Bransch (programmatic) | +100–300 |

From 14 live → **~138 curated**, comfortably past Notisum's ~25, with the programmatic layer as the ad-scaling reserve.

> Note: `/kunskapsbank` (Hub & supports) and `/omraden` (Category/index) overlap — if merged into one canonical hub, the curated total is one lower (~137). Resolve via open item §11.

---

## 9. Imagery — build spec

Three image types across the pages. All served via `next/image` with meaningful Swedish `alt`, committed as optimized **WebP** under `public/images/marketing/`. `heroMedia` frontmatter type is currently `'screenshot' | 'photo'`; add **`'mockup'`** (renders a transparent image bare, no frame) when §9.3 is chosen.

### 9.1 In-app screenshots

- **What:** real product surfaces relevant to the page. Feature pages ≥ 2 screenshots; industry/topic pages where the product genuinely surfaces the topic.
- **Frame:** wrap in `<ScreenshotFrame>` (browser chrome) in hero/`<SplitFeature>`/MDX.
- **Source:** capture from the demo workspace at high DPI; **no real customer PII** (Almåsa excluded everywhere). Crop to the relevant view.
- **Path:** `public/images/marketing/{kind}/{slug}/{surface}.png` (e.g. `funktioner/laglista/hero.png`).
- **Constraint:** never AI-generate screenshots — AI distorts UI text/pixels.

### 9.2 Generated people photography — automated pipeline (RESOLVED)

Fully proven and automatable end-to-end this session.

- **Model:** Nano Banana Pro = **`gemini-3-pro-image`** via the Gemini `generateContent` API. (Cheaper/faster alt: `gemini-3.1-flash-image`.)
- **Script:** `scripts/marketing-images/generate.mjs`. Run:
  ```bash
  node --env-file=.env.local scripts/marketing-images/generate.mjs \
    --prompt "<prompt>" --out public/images/marketing/people/<name>.webp --ar 4:3 --size 2K
  ```
  Reads `GEMINI_API_KEY` from `.env.local` (gitignored, never logged/committed); POSTs the prompt; decodes the returned image → `sharp` → WebP (q90) + a `.review.png` for QC.
- **Request shape (reference):**
  ```
  POST https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent
  header: x-goog-api-key: $GEMINI_API_KEY
  body: { "contents":[{"parts":[{"text":"<prompt>"}]}],
          "generationConfig":{"responseModalities":["IMAGE"],
                              "imageConfig":{"aspectRatio":"4:3","imageSize":"2K"}} }
  ```
  Image returns at `candidates[0].content.parts[].inlineData.data` (base64) + `.mimeType`.
- **Locked prompt scaffold** (only `<ROLE>` / `<ACTIVITY>` / `<SETTING>` change per page):
  > *"Photorealistic editorial photograph. `<ROLE>` `<COMPLIANCE ACTIVITY>` in `<SWEDISH INDUSTRY SETTING>`. Authentic Scandinavian workplace, natural daylight, warm neutral colour grading that sits on a cream/off-white palette, candid and unposed, soft shallow depth of field, documentary feel. Not glossy stock photography. No text, no logos, no watermarks. Realistic skin and hands."*
- **Batch manifest** (one row per image) — `content/marketing/_imagery/people.manifest.json`:
  ```json
  { "slug": "livsmedel", "prompt": "<full prompt>", "aspectRatio": "4:3",
    "out": "public/images/marketing/people/livsmedel-kvalitetsansvarig.webp", "alt": "<svensk alt>" }
  ```
  The current script is single-prompt; **batch mode = a small loop over the manifest** (trivial extension — flag for the build).
- **QC workflow:** generate **2–3 variants** per prompt → Read-based self-review (reject bad hands/faces/off-brand, regenerate) → **human glance on faces before publish** → keep best, commit WebP, delete `.review.png`.
- **Conventions:** aspect `4:3` (hero) / `3:2` (inline); `2K` size; path `public/images/marketing/people/<descriptive-slug>.webp`; descriptive Swedish `alt`.
- **Cost:** a few cents/image; ~15–20 bransch photos ≈ trivial.
- **Constraints:** offline-editorial only (never at build/runtime); key never in repo; Gemini images carry an invisible SynthID watermark (fine for marketing).

### 9.3 Hero device mockups — OPEN (decision pending)

For premium laptop hero shots wrapping a screenshot:
- **Rejected:** home-rolled CSS laptop; procedural Three.js 3D render (not photoreal enough).
- **Current lead:** **LS Graphics "MacBook Neo"** (6K, isolated/transparent, photoreal) — either (1) hand-made via their "Edit Online" editor for the ~15–20 hero pages (max quality, no pipeline), or (2) automated via the Neo PSD + **Dynamic Mockups API** for all pages.
- Resolve via open item §11, then add the `'mockup'` `heroMedia` type.

### 9.4 Per-page imagery in content briefs

Every page brief carries both halves of the imagery spec: the **screenshot list** (which in-app surfaces to capture) + the **people-photo prompt(s)** (where human warmth helps — mainly bransch pages). The prompts double as rows in the §9.2 manifest, so writing the brief = filling the generator input.

---

## 10. Sequencing into Epic 26 stories

- **26.5 / 26.6** — remaining Tier-1 branscher + funktioner (existing scope; §5.1–5.2 new funktioner fold in here).
- **26.7 / 26.8** — `omraden` kärnområden (§5.3-A), as planned.
- **New 26.7b** — ISO-svit (§5.3-B) + `<DefinitionBox>`/`<ProcessSteps>` components (validated against real content, like the 26.4 gate).
- **New 26.8b** — begrepp/metod (§5.3-C) + lagförklaringar top 20 (§5.3-D).
- **New 26.x (route)** — programmatic catalog-backed route → Lagguide-bibliotek (§6) + intersections (§7).
- **26.9 / 26.10 / 26.11 / 26.12** — jämför / conversion supports / ordbok / blogg, as in parent PRD.
- **New** — `/kunskapsbank` hub (small).

**Recommended first content batch:** Tier-C lagförklaringar (miljöbalken, arbetsmiljölagen, AFS) — proves the live-catalog differentiator before scaling.

---

## 11. Open items

- [ ] Run the `LawListTemplate`/`business_context` ranking query → concrete top-100 B2B law list (§6).
- [ ] **Decide `/kunskapsbank` vs `/omraden` canonical** — they overlap as the topics hub (§4.3 / §5.7 / §5.8); pick one, redirect the other. Affects the §8 total by 1.
- [ ] Decide the **device-mockup** route for hero laptops (§9) — the people-photo pipeline is resolved.
- [ ] Confirm in-product naming ("revisionsrapport"?) before publishing feature copy.
- [ ] Additional competitor/inspiration URLs (only the Notisum kunskapsbank link was provided this session).

---

## Change log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-06-25 | 0.1 | Initial page-inventory plan: full new-page enumeration (~121 curated + 50–100 lagguide + 100–300 programmatic), notisum/Fieldly analysis, extend-`omraden` decision, cannibalization guard, Lagguide-bibliotek data-driven method, programmatic route, mockup direction status. Captured from planning session with Alexander. | Claude + Alexander |
| 2026-06-25 | 0.2 | Added §3.1 content-quality & SEO standards (grounded/non-hallucinated content from corpus + official sources, Swedish grammar/readability, per-page meta title/description + long-tail + per-page Definition of Done); added megamenu-overflow decision (§4.6) + §5.8 category/index pages (`/funktioner`, `/branscher`, `/omraden` "Visa alla" hubs). Curated total ~121 → ~124. | Claude + Alexander |
| 2026-06-25 | 0.3 | §6: framed the top 50–100 B2B laws/föreskrifter as the biggest SEO lever and added the structured-data spec (BreadcrumbList + Article + FAQPage + DefinitionBox/ProcessSteps for featured-snippet & AI-answer capture). §3.1: expanded internal-linking rule (cross-link bransch↔område↔funktion↔lagguide↔ordbok↔catalog where relevant; don't overdo it). | Claude + Alexander |
| 2026-06-25 | 0.4 | PO validation pass (Sarah): fixed broken cross-ref (§1 §8→§7); reconciled "4 archetypes" → §5.3 A–E groups in §4.3/§5.8; surfaced the `/kunskapsbank`↔`/omraden` overlap as an explicit decision (§4.3/§5.8/§8 note/open item); clarified §7 (three routes sharing one resolution engine, not one route); updated §9 to reflect proven autonomous people-photo generation (`gemini-3-pro-image`); added header version line. | Sarah (PO) |
| 2026-06-25 | 0.5 | Expanded §9 into a full imagery build spec: §9.1 screenshots (frame/source/path/constraints), §9.2 people-photo generation pipeline (model, script, request shape, locked prompt scaffold, batch manifest format, QC workflow, conventions, cost, constraints), §9.3 device mockups (open), §9.4 per-page brief imagery. Build-ready in one pass. | Sarah (PO) |
