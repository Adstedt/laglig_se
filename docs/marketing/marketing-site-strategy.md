# Laglig.se Marketing Site Strategy — Multi-Page Expansion

**Status:** Concept (pre-epic)
**Date:** 2026-04-30
**Companion docs:** `landing-page-spec.md` (homepage), `prd.md`, `prd-lagefterlevnadskontroll.md`, `architecture.md`

This document defines the information architecture, page templates, and content strategy for laglig.se's marketing site beyond the homepage — the **Produkt**, **Branscher**, **Resurser**, and **Lagdatabas** sections accessible from the top navigation. It is informed by a thorough audit of Fieldly's marketing site (the most disciplined Swedish-SaaS reference for our market) and translated to laglig.se's ICP, product surface, and unique SEO position.

The homepage spec (`landing-page-spec.md`) is unchanged — this strategy adds the next layer.

---

## 1. Executive summary

### What Fieldly does well (worth borrowing)

- **One-product / many-doors discovery.** A buyer can enter via *what they need* (Produkt), *who they are* (Branscher), or *what they're researching* (Resurser). Same site, three doors.
- **Tight chassis discipline.** Every product page is the same skeleton — hero, benefit strip, logos, 3–5 feature blocks, testimonials, FAQ, cross-sell, CTA — only content varies. Industry pages reuse the chassis with reordered features and industry-specific proof.
- **Two consistent CTAs everywhere.** "Testa Gratis" + "Fieldly på 3 minuter" — repeated 4–6× per page. Removes thinking.
- **Each feature page is a landing page.** Self-contained, ranks for "[feature] bygg," converts solo. Cross-sells back to the suite at the end.
- **Resurser is both SEO funnel and trust scaffold.** Glossary + Lönekompassen + ungated calculators = compound organic traffic. Case studies + Byt-till-Fieldly = bottom-of-funnel close.
- **Two-axis pain framing.** Concrete artifact replacement ("postit-lappar," "A4-sidor," "miniräknare") + regulator endorsement ("Skatteverket-godkänd," "AB04-kompliant"). Both translate directly to compliance.

### What we deliberately *don't* copy from Fieldly

- **Inconsistent proof stats** ("1,4M projekt" vs. "2M projekt" vs. "80 000 kunder" — pick one, use everywhere).
- **Industry pages with zero testimonials and recycled feature grids** (Byggservice/Mark/Entreprenad share a near-identical 11-block list with no industry quotes — feels lazy).
- **Two H1 voices on different industry pages** ("ultimata projektverktyget" vs. "X-arens bästa vän" — pick one register).
- **Legacy-URL drift** (Fieldly has /branscher/X *and* /fieldly-for-vvs as a parallel page — confusing).
- **Two competing testimonial pools recycled across all pages** — laglig should aim for industry-coded testimonials (small set per industry, not one universal pool).
- **A "Branscher" hub that's a thin nav router** — laglig's hub should sell the cross-industry compliance proposition before fanning out.

### Strategic translation to laglig.se

Where Fieldly sells **operational efficiency to construction SMEs**, laglig.se sells **regulatory peace-of-mind to compliance-conscious orgs across all industries**. Four structural consequences:

1. **Compliance is universal, but trust signals are industry-specific.** Construction has AFS/ID06/AB04; healthcare has IVO/HSL/SoL; tech has GDPR/NIS2/DSA. Industry pages must show fluency in *that industry's* regulations — not just rebadge the same product copy.
2. **Our SEO moat is bigger than Fieldly's.** They have a glossary (~100 terms) + Lönekompassen. We have **170 000+ public legal documents already SSR'd and indexable**. The Lagdatabas is its own nav item, not a Resurser sub-page.
3. **Buyers are more research-driven.** Fieldly sells to a foreman; we sell to a Compliance Manager who reads the FAQ. Our pages need more substance — fewer marketing platitudes, more concrete workflows, real screenshots, cited regulations.
4. **We have a data flywheel Fieldly doesn't.** Every law tracked, every kravpunkt assessed, every uppgift closed, every dokument uploaded becomes RAG context for the AI assistant — *for that customer specifically*. Notisum and Karnov are document libraries; Fieldly is a workflow tool; laglig.se is a workflow tool **whose AI compounds in value the longer you use it**. This network-effect story is unique to us and must be sold deliberately. See §1.5.

### 1.5 The data flywheel — a cross-cutting story

**This is laglig.se's most defensible moat and the single most important message to land across the marketing site.** It must appear, in the language appropriate to that page, on every Produkt page where it's relevant (AI-assistent, Uppgifter, Lagefterlevnadskontroll, Krav & Kravpunkter, Lagbevakning, Filer & Bevis, Styrdokument) and on every Branscher page.

**The story in one sentence:** *Lagar, kravpunkter, uppgifter, bevis, styrdokument, findings och ändringar lever i samma graf — och AI-assistenten läser samma graf som ni gör. Ju mer ni jobbar i laglig.se, desto vassare blir den för just ert företag.*

**Why this matters competitively:**

- **vs. Notisum / JP Infonet / Karnov:** they are document libraries. They show you the law. That's it. There's no graph, no workflow, no learning.
- **vs. Fieldly and other ops tools:** they have a graph (projects ↔ work orders ↔ time entries) but no deep AI grounded in it, and certainly not in legal context.
- **vs. ChatGPT / Claude / generic AI:** they have AI but no graph of *your compliance state*. They hallucinate; we cite.

The combination — **a structured compliance graph + RAG-grounded AI that reads it** — is the wedge.

**How to surface it on each page (what marketing should write):**

| Page | Flywheel angle to lead with |
|---|---|
| `/produkt/ai-assistent` | "Citerar lagtexten *och* era egna styrdokument" — the AI's accuracy compounds with your data. |
| `/produkt/uppgifter` | "Findings spawnar uppgifter. Avslutade uppgifter blir bevis nästa cykel." Bidirectional links to laws and kravpunkter shown. |
| `/produkt/lagefterlevnadskontroll` | The "En plattform som lär sig ert företag" callout block (already prototyped) — visualizes the four-node flywheel. |
| `/produkt/krav-och-kravpunkter` | "Varje kravpunkt har bevis. Varje bevis blir AI-kontext." |
| `/produkt/lagbevakning` | "När en lag ändras vet vi vilka av era kravpunkter som påverkas — inte bara att något har hänt." |
| `/produkt/filer-och-bevis` | "Bevis länkas till krav och uppgifter. AI:n hittar dem nästa gång ni frågar." |
| `/produkt/styrdokument` | "Era policys blir AI-kontext, inte bara bibliotek." |
| Industry pages | Industry-coded version, e.g. for Bygg: "Skyddsronden ni dokumenterade i går blir kontext nästa gång AI:n får en AFS-fråga." |

**Visual pattern (recommended for at least one anchor page):** A four-node orbit with the AI at the center — Lagar & kravpunkter / Uppgifter & findings / Bevis & styrdokument / Ändringar & historik feeding into it. Already prototyped on `/produkt/lagefterlevnadskontroll`.

**What to NOT claim:** that the underlying *foundation models* (OpenAI/Anthropic) train on your data — they don't, and that's a critical privacy/GDPR claim. The "learning" is RAG-driven retrieval over your private graph, not model fine-tuning. Be precise: "RAG-grundad", "kontext", "citerar era dokument" — not "tränas på era data."

---

## 2. Top-level information architecture

### 2.1 Top navigation

```
laglig.se   |   Produkt ▾   Branscher ▾   Lagdatabas   Priser   Resurser ▾   Kontakt
                                                                          |  Logga in   Kom igång gratis
```

Six items. Three are mega-dropdowns (Produkt, Branscher, Resurser). **Lagdatabas is a direct link** — it's our SEO front door (170K+ public documents). **Priser** is a direct link.

Persistent top-right CTA pair: **Logga in** + **Kom igång gratis** (matching the existing landing-page spec).

### 2.2 Produkt mega-menu

Three columns, mirroring Fieldly's "Funktioner / Enheter / Välj rätt verktyg" structure but adapted:

**Column 1 — Kärnfunktioner** (the compliance loop)
- Laglistor *(personlig laglista per bransch)*
- Krav & Kravpunkter *(bryt ner lagar i åtgärder)*
- Lagbevakning *(ändringar i realtid)*
- Lagefterlevnadskontroll *(formella revisioner)*
- AI-assistent *(grundad i svensk rätt)*
- Uppgifter *(åtgärder och Kanban)*

**Column 2 — Plattform** (the operational layer)
- Filer & Bevis *(dokumentation och spårbarhet)*
- Styrdokument *(intern policy)*
- Aktivitetslogg *(immutabel historik)*
- Roller & rättigheter *(team-styrning)*
- Integrationer *(Bolagsverket, Riksdagen, EUR-Lex, m.fl.)*
- Revisionsrapport *(sigillerad PDF · ISO 19011 · SHA-256)*

**Column 3 — För vem**
- Compliance Manager
- HR-chef
- Hållbarhets- & miljöansvarig
- ISO-konsult / Auditor
- VD / CFO
- Offentlig sektor

**Footer of mega-menu:** "Alla funktioner →" · Produktnyheter · Support · Kontakt

### 2.3 Branscher mega-menu

Single column of industry cards (icon + name + 1-line subhead), matching Fieldly's hub. **Six launch industries** (Tier 1):

1. **Bygg & Anläggning** — AFS, AB04, ID06, arbetsmiljöplan
2. **Industri & Tillverkning** — kemikalier, REACH, ISO 14001/45001
3. **Restaurang & Livsmedel** — egenkontroll livsmedel, alkohollagen, smittskydd
4. **Tech & SaaS** — GDPR, NIS2, DSA, dataskyddsförordning
5. **Vård & Omsorg** — patientsäkerhet, HSL, SoL, IVO
6. **Offentlig sektor** — kommun, region, statliga myndigheter

**Tier 2 (post-launch):** Detaljhandel, Energi & Miljö, Fastighet & Bostäder, Transport & Logistik, Finans & Försäkring.

Footer of mega-menu: "Alla branscher →" · "Är din bransch inte med? Kontakta oss"

### 2.4 Resurser mega-menu

Two columns, prioritized by SEO leverage:

**Column 1 — Innehåll & utbildning**
- Lagordlista *(laglig-fluent definitions, internal links into Produkt)*
- Blogg & Nyheter
- Kundcase / Referenser
- Webinars
- Guider & E-böcker
- Verktyg & Kalkylatorer

**Column 2 — Företag & community**
- Om oss
- Karriär
- Partners
- Byt till laglig.se *(competitor-migration page)*
- Tipsa om laglig *(referral program)*
- Kontakt & support

### 2.5 Sitemap (URL plan)

```
/                                         Homepage (existing spec)
/priser                                   Pricing
/kontakt                                  Contact

/produkt                                  Produkt hub
/produkt/laglistor
/produkt/krav-och-kravpunkter
/produkt/lagbevakning
/produkt/lagefterlevnadskontroll
/produkt/ai-assistent
/produkt/uppgifter
/produkt/filer-och-bevis
/produkt/styrdokument
/produkt/aktivitetslogg
/produkt/roller-och-rattigheter
/produkt/integrationer
/produkt/revisionsrapport

/produkt/for-vem/compliance-manager
/produkt/for-vem/hr-chef
/produkt/for-vem/hallbarhetsansvarig
/produkt/for-vem/iso-konsult
/produkt/for-vem/vd-cfo
/produkt/for-vem/offentlig-sektor

/branscher                                Branscher hub
/branscher/bygg-och-anlaggning
/branscher/industri-och-tillverkning
/branscher/restaurang-och-livsmedel
/branscher/tech-och-saas
/branscher/vard-och-omsorg
/branscher/offentlig-sektor

/lagdatabas                               Lagdatabas hub (links into existing /lagar, /alla-lagar, /eu, /foreskrifter)
  ↪ existing public routes already cover the leaf pages

/resurser                                 Resurser hub
/resurser/lagordlista                     ⭐ highest-leverage SEO asset
/resurser/blogg
/resurser/blogg/[slug]
/resurser/kundcase
/resurser/kundcase/[slug]
/resurser/webinars
/resurser/guider-och-e-bocker
/resurser/guider-och-e-bocker/[slug]
/resurser/verktyg                         tools/calculators hub
/resurser/verktyg/csrd-omfattningstest
/resurser/verktyg/gdpr-botesraknare
/resurser/verktyg/iso-mognadsanalys
/resurser/verktyg/lagandringsfeed         ⭐ data-tool play (laglig's "Lönekompassen")
/resurser/om-oss
/resurser/karriar
/resurser/partners
/resurser/byt-till-laglig
/resurser/tipsa-om-laglig
```

Total new pages at launch: **12 product features + 6 personas + 6 industries + ~10 resurser pages = ~34 new marketing pages**, plus the homepage/pricing already in scope.

---

## 3. Page templates

### 3.1 Master chassis (used by every Produkt and Branscher page)

Every Produkt feature page and every Branscher page follows this skeleton. Only the *content* in each block varies.

| # | Block | Purpose | Content per page |
|---|---|---|---|
| 1 | **Hero** | Capture in 5s | H1 (feature/industry-specific) · subhead (the pain) · 2 CTAs · screenshot or product UI |
| 2 | **Benefit strip** | 3-bullet promise | Three short benefit lines with icons (e.g. "Spårbar historik · Säker molnlagring · Automatisk dokumentation") |
| 3 | **Logo strip** | Volume trust | 30+ customer logos · proof stat ("X svenska bolag har koll med laglig.se") |
| 4 | **Feature blocks (3–5)** | Show the product | Each = headline + paragraph + screenshot/UI capture, alternating sides |
| 5 | **Testimonials (3–5)** | Named, attributed | Quote · photo · name · role · company logo · 1-line context |
| 6 | **Stat callout** | Single hero metric | "170 000+ lagar och rättskällor på en plattform" (one number, used everywhere) |
| 6.5 | **Flywheel block** *(opt-in)* | Surface the network effect | Required on AI/Uppgifter/Lagefterlevnadskontroll/Krav/Lagbevakning/Filer/Styrdokument and on every Branscher page. See §1.5. |
| 7 | **FAQ (3–7)** | Answer "what is X?" + product Qs | Mix of awareness-stage (SEO-rich) and product-specific |
| 8 | **Cross-sell strip** | Sell the suite | "Detta är en del av laglig.se's compliance-plattform" + 3 adjacent feature/industry links |
| 9 | **Closing CTA** | Reprise hero CTAs | Org-number entry input + "Kom igång gratis" + "Boka demo" |
| 10 | **Footer** | Standard | Site-wide footer |

**Key discipline (from Fieldly's playbook):**
- The two CTAs are **identical on every page**: `Kom igång gratis` (primary) + `Boka demo` (secondary). The 3-min product video may be a tertiary inline link from the hero ("Se laglig.se på 3 min →"), matching Fieldly's pattern but not crowding the CTA pair.
- The stat callout is **one consistent number** across the whole site. Pick once. Recommended: `170 000+ lagar och rättskällor` — it's verifiable from our own database and unique to us. (If we want a customer count, also pick one and use everywhere.)
- The cross-sell at block 8 is **mandatory** — every page sells the suite, not just itself.

### 3.2 Industry-page reordering rules

Industry pages use the same chassis but customize:

- **H1 voice** (single register across all industries): `Compliance och lagbevakning för [industry]` or `Laglig.se för [industry] — full koll på [industry-specific concern]`. Pick one and use across all 6.
- **Hero subhead** names the *industry-specific compliance burden* (e.g. for Bygg: "Arbetsmiljöplan, AFS, AB04 och ID06 — utan postit-lappar och pärmar").
- **Block 4 features are reordered** — the feature most relevant to that industry comes first. *Example*: for Bygg, "Lagefterlevnadskontroll" leads (ISO 45001 audits); for Tech, "Lagbevakning" leads (GDPR/NIS2 change cadence).
- **Block 3 logos and Block 5 testimonials** are filtered to that industry. Aim for **2–4 industry-coded testimonials per page** (Fieldly's weakness was zero quotes on most industry pages).
- **Industry-specific jargon is foregrounded** in feature copy and FAQ — for Bygg: AFS, AB04, ID06, arbetsmiljöplan; for Tech: GDPR, NIS2, DSA, DPIA; etc. This is the single biggest signal of "you understand my industry."
- **Industry-specific integrations or data sources** if relevant (e.g. Bygg → Bolagsverket+Skatteverket personalliggare integration; Restaurang → kommunens livsmedelsregister; Vård → IVO).

### 3.3 Persona page template (For vem)

Persona pages are **lighter** than feature/industry pages — they're a routing layer that re-tells the same product story through one role's lens.

| # | Block | Content |
|---|---|---|
| 1 | Hero | "Laglig.se för [role]" · subhead = role's daily pain · 2 standard CTAs |
| 2 | "En vanlig dag med laglig.se" | Narrative walkthrough: morning brief → AI assist → assign tasks → audit-ready report |
| 3 | 3 feature blocks | The 3 features most relevant to *this role* |
| 4 | Testimonial | One strong named quote from someone in this role |
| 5 | "Vad andra [role] säger" | Mini-grid of 3 short quotes |
| 6 | Cross-sell | Links to the role's most-relevant industry pages + features |
| 7 | Closing CTA | Standard |

### 3.4 Resurser detail templates

- **Blog post / case study** — single template (Fieldly merges these too). Author, date, hero quote (if case), body, related posts (3), single demo form embedded above-the-fold.
- **Glossary (Lagordlista)** — single page, A–Ö anchors, ~150 entries at launch, **inline links from each definition into the matching Produkt page** (the highest-leverage internal-linking pattern in Fieldly's site, fully transferable).
- **Calculator/tool detail** — utility-above-the-fold, educational content below, related-tools rail at the bottom. Replicate Fieldly's ROT-kalkylator template structure exactly (it's the cleanest pattern they have).
- **E-book detail** — short page, gated form above-the-fold, contents preview, 3 related e-books at bottom.

---

## 4. Per-page content briefs — Produkt

For each feature page below: **what we're selling, the H1, the 3-bullet benefit strip, the 3–5 feature blocks (titles only), and the FAQ topics**. Detailed copy gets written in the build epic.

### 4.1 `/produkt/laglistor`

- **What it is:** Personalized law list per company, AI-curated from SNI code + activity flags, with categorized grouping and per-law status tracking.
- **H1:** "Din egen laglista — automatiskt anpassad efter ditt företag"
- **Benefit strip:** Anpassad efter SNI · Grupperad och sorterbar · Statusspårning per lag
- **Feature blocks:**
  1. AI föreslår tillämpliga lagar baserat på bolagsverkets registerdata
  2. Drag & drop-gruppering i kategorier (Arbetsmiljö, GDPR, branschspecifika, m.m.)
  3. Statusspårning per lag (Ej påbörjad → Pågående → Uppfylld)
  4. Kommentarer och AI-genererad kontext per lag
- **FAQ topics:** Vad är en laglista? Måste mitt företag ha en laglista? Vilka lagar gäller för min bransch? Hur ofta uppdateras laglistan? Kan vi importera vår nuvarande laglista?

### 4.2 `/produkt/krav-och-kravpunkter`

- **What it is:** Atomic compliance requirements broken out per law, with assignee, due date, and evidence linking.
- **H1:** "Bryt ner varje lag till åtgärdbara kravpunkter"
- **Benefit strip:** Per-lag uppdelning · Tilldelad ansvarig · Bevis kopplade direkt
- **Feature blocks:** Auto-generera kravpunkter från lagtext · Tilldela per kravpunkt (story 20.1) · Koppla bevis (filer, datum, ansvariga) · Mäta täckningsgrad per lag
- **FAQ topics:** Vad är en kravpunkt? Skiljer det sig från en uppgift? Kan vi skapa egna kravpunkter? Hur länkar vi bevis?

### 4.3 `/produkt/lagbevakning`

- **What it is:** Automated daily monitoring of SFS, agency regulations, EU legislation, and court rulings; AI-summarized impact per change.
- **H1:** "Lagbevakning som faktiskt analyserar — inte bara notifierar"
- **Benefit strip:** Dagliga koll · AI-konsekvensanalys · Inga falska larm
- **Feature blocks:** Daglig polling av Riksdagen + Domstolsverket + EUR-Lex · AI-summering med inline-citat · E-postdigest + in-app-notiser · Per-bransch-filter (NIS2 till techbolag, AFS till byggbolag)
- **FAQ topics:** Hur ofta uppdateras data? Vilka rättskällor täcks? Får vi förvarsel om nya lagar? Hur skiljer ni er från Notisum's notiser?

### 4.4 `/produkt/lagefterlevnadskontroll` ⭐

- **What it is:** Formal periodic compliance audits per ISO 14001/45001 9.1.2, with sealed tamper-evident reports. **This is laglig's most differentiated paid feature** — it should get the deepest page.
- **H1:** "Lagefterlevnadskontroll — formell revision med sigillerad rapport"
- **Benefit strip:** ISO 14001/45001-kompatibel · SHA-256-sigill · Spårbar evidence chain
- **Feature blocks:**
  1. Skapa cykler med valbart scope (alla lagar / grupper / enskilda)
  2. Per-objekt-bedömning (Uppfylld / Delvis / Ej uppfylld / Ej tillämplig) med motivering
  3. Findings-hantering: Avvikelse, observation, förbättring — auto-spawnar uppgifter
  4. Sigillerad revisionsrapport (PDF, ISO 19011-stil, evidence manifest, hash)
  5. Externa auditors: multi-workspace read-only access
- **FAQ topics:** Vad kräver ISO 14001 9.1.2? Vad är ett tamper-evident sigill? Kan en extern revisor få access? Vad händer vid avvikelse? Är detta godkänt som intern revision?

### 4.5 `/produkt/ai-assistent`

- **What it is:** RAG chatbot grounded in Swedish laws, court cases, EU legislation, kollektivavtal — zero hallucinations, mandatory inline citations.
- **H1:** "Fråga vad som helst om svensk rätt — med citat"
- **Benefit strip:** Grundad i 170k+ rättskällor · Inline-citat · Aldrig påhittade svar
- **Feature blocks:** Kontextuell sökning · Inline-citat och källänkar · Strömmande komponenter (rekommendera lagar, skapa uppgifter direkt) · Lag-, ändrings- och uppgiftsspecifik kontext
- **FAQ topics:** Hallucinerar AI:n? Vilka källor används? Kan vi koppla våra egna styrdokument? GDPR och AI?

### 4.6 `/produkt/uppgifter`

- **What it is:** Kanban-style task workflow tied to laws, kravpunkter, and compliance findings.
- **H1:** "Från lag till åtgärd — operationalisera compliance"
- **Benefit strip:** Kopplad till lagar och kravpunkter · Auto-spawn vid avvikelse · Aktivitet immutabel
- **Feature blocks:** Kanban med custom-kolumner · Koppling till lagar/filer/styrdokument · Auto-spawn från lagefterlevnadskontroll-findings · Aktivitetsspårning
- **FAQ topics:** Hur skiljer sig detta från Asana/Trello? Kan vi importera befintliga uppgifter? Notifieringar?

### 4.7 `/produkt/filer-och-bevis`

- **What it is:** Workspace file storage with category tagging (Bevis, Policy, Avtal, Certifikat) and evidence-linking to kravpunkter, tasks, and audit cycles.
- **H1:** "Bevis och dokument — kopplade till rätt lag, varje gång"
- **Benefit strip:** Mappstruktur · Kategorisering · Frysta snapshots vid revision
- **Feature blocks:** Mappstruktur med drag-and-drop · Kategorier (Bevis, Policy, Avtal, Certifikat) · Evidens-länkar · Snapshot-frysning vid lagefterlevnadskontroll
- **FAQ topics:** Var lagras filer? GDPR? Versionshantering? Filstorlek?

### 4.8 `/produkt/styrdokument`

- **What it is:** Internal governance documents with versioning and rich editing.
- **H1:** "Styrdokument — levande policy, inte statiska PDF:er"
- **Benefit strip:** Versionshantering · Rich-text-redigering · Kopplad till lagar
- **Feature blocks:** Rich-text-editor med samarbetsstöd · Versionshistorik · Koppling till relevanta lagar/kravpunkter · Godkännandeflöde
- **FAQ topics:** Kan vi importera Word? Versionshantering? Behörigheter?

### 4.9 `/produkt/aktivitetslogg`

- **What it is:** Immutable audit trail of all workspace mutations.
- **H1:** "Komplett spårbarhet — varje ändring, varje signatur"
- **Benefit strip:** Immutabel · Tidsstämplad · Exporterbar
- **Feature blocks:** Per-användare-logg · Per-objekt-logg · Filter och export · Bevis vid extern revision
- **FAQ topics:** Kan vi radera loggar? Hur länge sparas? GDPR och loggar?

### 4.10 `/produkt/roller-och-rattigheter`

- **What it is:** Five workspace roles (Owner, Admin, HR Manager, Member, Auditor) with scoped permissions.
- **H1:** "Roller och rättigheter — rätt person ser rätt sak"
- **Benefit strip:** 5 fördefinierade roller · Multi-workspace för konsulter · Auditor-läge för extern revision
- **Feature blocks:** Roll-översikt · HR-känsligt material · Auditor multi-workspace-access · Inbjudningsflöde
- **FAQ topics:** Kan vi skapa egna roller? Hur fungerar Auditor-rollen? GDPR och HR-data?

### 4.11 `/produkt/integrationer`

> **Marketing rule:** This page lists **only what we ship today**. Roadmap items (Fortnox, Slack, Power BI, ERP-bridges) are deliberately omitted from marketing — overpromising kills trust faster than missing checkboxes do. When a roadmap item ships, it gets added here, not before.

- **What it is:** Direkta kopplingar mot Sveriges officiella rättskällor (Riksdagen, Domstolsverket, Arbetsmiljöverket, EUR-Lex), Bolagsverket-uppslag vid onboarding, autentisering via Supabase, transaktionsmail via Resend, betalning via Stripe.
- **H1:** "Integrationer — kopplade till Sveriges officiella källor"
- **Benefit strip:** Officiella API:er · Daglig sync · GDPR-säker EU-hosting
- **Feature blocks (today's reality, no roadmap claims):**
  1. **Rättskällor** — Riksdagen Open Data API (SFS), Domstolsverket PUH (AD/HD/HovR/HFD), EUR-Lex (EU-förordningar och direktiv), agency-feeds (Arbetsmiljöverket m.fl.). Daglig polling via Vercel Cron.
  2. **Företagsdata** — Bolagsverket-API auto-fyller bolagsnamn, SNI-kod och adress vid signup. Ingen manuell datainmatning.
  3. **AI-kärna** — OpenAI och Anthropic används för RAG-grundad sammanfattning och chat. Era data skickas inte till modellträning.
  4. **Plattformsintegrationer** — Supabase Auth + Storage, Stripe-billing, Resend för e-post, NextAuth för session management.
- **FAQ topics:** Vilka officiella källor täcks? Hur ofta uppdateras data? Skickas vår data till AI-leverantörer för träning? Var lagras data? Kan vi exportera all data?

### 4.12 `/produkt/revisionsrapport`

> **Scope check:** the canonical export today is the *sigillerade revisionsrapporten* (PDF) som genereras från en avslutad lagefterlevnadskontroll-cykel — plus exporter från Aktivitetsloggen. Generiska "rapporter över allt" påstås inte. Om scope växer flyttar vi denna sida till `/produkt/rapporter-och-export`.

- **What it is:** Sigillerad revisionsrapport från en avslutad lagefterlevnadskontroll, plus tids-filtrerad export från aktivitetsloggen.
- **H1:** "Revisionsrapport — sigillerad PDF som överlever extern revision"
- **Benefit strip:** ISO 19011-stil · SHA-256-sigill · Bevis-manifest medföljer
- **Feature blocks:**
  1. Rapportstruktur enligt ISO 19011 (scope, metod, per-krav-bedömning, findings, signaturer)
  2. Bevis-manifest med filhash per länkat dokument
  3. Tamper-evident SHA-256-sigill — manipulering syns
  4. Tids-filtrerad export från Aktivitetsloggen (CSV)
- **FAQ topics:** Vilket format? Är hashen manipulerbar? Kan vi brand'a rapporten med vår logo? Hur långt bak går aktivitetsloggen?

---

## 5. Per-page content briefs — Branscher

For each industry page: **the angle, regulations to foreground, recommended ordering of feature blocks (block 4 of the chassis), and FAQ topics that signal industry fluency**.

### 5.1 `/branscher/bygg-och-anlaggning`

- **Angle:** Construction is regulation-dense — AFS, AB04, ID06, arbetsmiljöplan, byggdagbok. Most companies in this space already use Fieldly for ops; we're complementary, not competitive.
- **H1:** "Compliance och lagbevakning för bygg och anläggning"
- **Subhead:** "Arbetsmiljöplan, AFS, AB04 och ID06 — full koll utan postit-lappar och pärmar."
- **Feature ordering:** 1. Lagefterlevnadskontroll (ISO 45001), 2. Lagbevakning (AFS uppdateras ofta), 3. Krav & Kravpunkter (arbetsmiljöplan), 4. AI-assistent.
- **Industry jargon:** AFS, AB04, ABT06, ID06, BAS-P, BAS-U, arbetsmiljöplan, byggherreansvar, byggdagbok.
- **FAQ topics:** Vilka AFS gäller mitt byggbolag? Hur uppfyller vi AFS 2001:1? ID06 och personalliggare — kopplar ni mot Fieldly? Är detta godkänt som intern revision enligt ISO 45001?

### 5.2 `/branscher/industri-och-tillverkning`

- **Angle:** Heavy regulation around chemicals (REACH, Seveso), occupational health (AFS), environmental (Miljöbalken, IED), and ISO 14001/45001.
- **H1:** "Compliance för industri och tillverkning"
- **Subhead:** "REACH, Seveso, AFS och miljöbalken — en plattform, all spårbarhet."
- **Feature ordering:** 1. Lagefterlevnadskontroll (ISO 14001 + 45001), 2. Krav & Kravpunkter (kemikalielistor), 3. Lagbevakning, 4. Filer & bevis (säkerhetsdatablad).
- **Industry jargon:** REACH, CLP, Seveso, miljöbalken, IED, BREF, AFS-paketen, säkerhetsdatablad, ISO 14001, ISO 45001, IPPC.
- **FAQ topics:** Hanterar ni REACH-uppdateringar? Seveso-anläggningar? Hur kopplar vi säkerhetsdatablad till våra kravpunkter?

### 5.3 `/branscher/restaurang-och-livsmedel`

- **Angle:** Egenkontroll livsmedel, alkohollagen, smittskydd, arbetsmiljö.
- **H1:** "Compliance för restaurang och livsmedel"
- **Subhead:** "Egenkontroll, alkohollagen och Livsmedelsverkets föreskrifter — ett system för hela kedjan."
- **Feature ordering:** 1. Krav & Kravpunkter (egenkontroll), 2. Filer & bevis (HACCP-dokument), 3. Lagefterlevnadskontroll, 4. Lagbevakning.
- **Industry jargon:** Egenkontrollprogram, HACCP, LIVSFS, alkohollagen, serveringstillstånd, smittskydd.
- **FAQ topics:** Stödjer ni HACCP-mallar? Hur fungerar det vid kommunens livsmedelskontroll? Alkohollagen — vilka kravpunkter?

### 5.4 `/branscher/tech-och-saas`

- **Angle:** GDPR, NIS2, DSA, DORA, AI-förordningen — explosion of EU tech regulation. Buyers are technically fluent and skeptical.
- **H1:** "Compliance för tech- och SaaS-bolag"
- **Subhead:** "GDPR, NIS2, DSA, DORA och AI-förordningen — håll koll på allt EU släpper."
- **Feature ordering:** 1. Lagbevakning (EU-takten), 2. AI-assistent (komplext rättsområde), 3. Krav & Kravpunkter (DPIA, DPA), 4. Lagefterlevnadskontroll (ISO 27001).
- **Industry jargon:** GDPR, dataskyddsförordningen, NIS2, DSA, DMA, DORA, AI-förordningen, DPIA, DPO, DPA, ISO 27001, SOC 2.
- **FAQ topics:** Täcker ni DSA? NIS2 — när träder kraven i kraft för oss? Kan AI-assistenten användas för DPIA-utkast? GDPR och er egen behandling?

### 5.5 `/branscher/vard-och-omsorg`

- **Angle:** Patientsäkerhet, HSL, SoL, Lag om stöd och service, IVO-tillsyn, GDPR + sjukjournaler.
- **H1:** "Compliance för vård och omsorg"
- **Subhead:** "Patientsäkerhetslagen, HSL, SoL och IVO:s krav — full spårbarhet, varje patient, varje kontroll."
- **Feature ordering:** 1. Lagefterlevnadskontroll (IVO-redo), 2. Aktivitetslogg (patientsäkerhet), 3. Krav & Kravpunkter, 4. AI-assistent.
- **Industry jargon:** Patientsäkerhetslagen, HSL, SoL, LSS, SOSFS, HSLF-FS, IVO, Lex Maria, Lex Sarah.
- **FAQ topics:** IVO-redo? Hur hanteras patientuppgifter? Lex Maria-utredning?

### 5.6 `/branscher/offentlig-sektor`

- **Angle:** Kommun, region, statlig myndighet — offentlighetsprincipen, förvaltningslagen, kommunallagen, LOU.
- **H1:** "Laglig.se för kommuner, regioner och myndigheter"
- **Subhead:** "Offentlighetsprincipen, förvaltningslagen, LOU och GDPR — ett verktyg för hela förvaltningen."
- **Feature ordering:** 1. Lagbevakning, 2. Roller & rättigheter (förvaltningsstruktur), 3. Lagefterlevnadskontroll, 4. Aktivitetslogg.
- **Industry jargon:** Offentlighetsprincipen, förvaltningslagen, kommunallagen, LOU, LUF, OSL, arkivlagen, e-förvaltning.
- **FAQ topics:** Kan vi upphandla? LOU-stöd? OSL och vår plattform? Pris för kommun?

---

## 6. Per-page briefs — För vem (personas)

Persona pages are a **lighter, role-lens layer** on top of the product. They should not duplicate Branscher — they sell *the same product through one role's lens*.

### 6.1 `/produkt/for-vem/compliance-manager`
- "En vanlig dag" walkthrough: morning digest → AI-fråga → tilldela uppgift → granska revisionscykel → rapport
- Top 3 features: Lagefterlevnadskontroll, Lagbevakning, Krav & Kravpunkter

### 6.2 `/produkt/for-vem/hr-chef`
- Focus on: arbetsmiljö, kollektivavtal, GDPR (HR-sensitive), arbetstidslagen
- Top 3 features: Krav & Kravpunkter, Filer (HR-bevis), Roller (HR Manager-läge)

### 6.3 `/produkt/for-vem/hallbarhetsansvarig`
- Focus on: CSRD, ESRS, miljöbalken, klimatrapportering
- Top 3 features: Lagbevakning, Krav & Kravpunkter, Rapporter

### 6.4 `/produkt/for-vem/iso-konsult`
- Focus on: multi-workspace, auditor-läge, mallar, repeterbart arbete
- Top 3 features: Roller (Auditor), Lagefterlevnadskontroll, Mallar

### 6.5 `/produkt/for-vem/vd-cfo`
- Focus on: ROI, sömnro, audit-readiness, juridisk risk
- Top 3 features: Lagefterlevnadskontroll (audit-readiness), Revisionsrapport, AI-assistent (för snabba lägen)

### 6.6 `/produkt/for-vem/offentlig-sektor`
- Sammanslagen med branschsidan — länka dit istället. (Don't duplicate.)

---

## 7. Lagdatabas — laglig.se's unique 5th nav item

Fieldly has no equivalent. We do.

### 7.1 What it is

170 000+ Swedish legal documents (SFS-lagar, AFS, BFS, NFS, FFFS, EU-förordningar, EU-direktiv, AD, HD, HovR, HFD), already SSR'd at:

- `/lagar` — SFS browse
- `/alla-lagar` — full catalog
- `/sok` — search
- `/rattskallor` — sources directory
- `/eu/[type]/[id]` — EU detail
- `/foreskrifter/[slug]` — agency regulation stubs
- `/lagar/[id]/historik` — amendment history
- `/lagar/[id]/version/[date]` — historical versions

### 7.2 What needs adding for marketing positioning

A `/lagdatabas` **hub page** that:
- Frames the database as a **freemium SEO product** ("Sveriges mest kompletta öppna lagdatabas — gratis att använda")
- Cards into each rättskälla-kategori
- Shows live stats ("174 213 dokument · uppdaterad 2026-04-30 06:15")
- Includes a clear (but non-pushy) "Vill du få notiser när dina lagar ändras? Kom igång gratis →" CTA
- Internal-links to `/produkt/lagbevakning` and `/produkt/laglistor` from the inline content (not from a banner)

This is the page Google should show as the front door to our content. The leaf pages already exist; they need cross-linking back to /lagdatabas in their breadcrumbs.

---

## 8. Resurser — content priorities

Ranked by **leverage × cost** based on Fieldly's measurable wins:

### 8.1 ⭐ Tier 1 — must ship at launch

1. **Lagordlista** (`/resurser/lagordlista`) — single page, ~150 entries (CSRD, ESRS, lagboken, författningssamling, tillsynsmyndighet, AFS, AB04, GDPR, NIS2, DSA, DPIA, ISO 14001/45001/27001, lagefterlevnadskontroll, kravpunkt, byggherreansvar, etc.). Inline links from each definition into the matching `/produkt/X` page. **This will be the highest-traffic page on the site.**
2. **Byt till laglig.se** (`/resurser/byt-till-laglig`) — competitor-migration page. 3 benefit pillars · 3-step migration · 6-question FAQ · 8 feature deep-dives each cross-linking to `/produkt/X`. Don't name competitors directly (Notisum, JP Infonet, Karnov) — just describe pain ("Trött på 1990-tals UX? Saknar du AI-grundade ändringssammanfattningar?").
3. **Kundcase index** (`/resurser/kundcase`) — even with 0 cases at launch, ship the template. Goal: 5 launch cases within 90 days.
4. **Om oss** (`/resurser/om-oss`) — trust + contact routing.
5. **Blogg-template** (`/resurser/blogg`) — categories: Lagnyheter · Kundcase · Tips & Guider · Produktnyheter · Branschinsikter. Aim for 12 posts at launch, then 1/week.
6. **Lagändringsfeed** (`/resurser/verktyg/lagandringsfeed`) — laglig's "Lönekompassen" equivalent. Public live feed of the latest detected law changes (from our existing change-detection pipeline). One URL, dynamic content, captures "[lagnamn] ändring 2026" long-tail. Easy to ship — it's our existing data unwrapped.

### 8.2 Tier 2 — within 6 months

7. **CSRD-omfattningstest** (`/resurser/verktyg/csrd-omfattningstest`) — interactive calculator: anställda × omsättning × balansomslutning → omfattas du?
8. **GDPR-bötesräknare** (`/resurser/verktyg/gdpr-botesraknare`) — modeled exactly on Fieldly's ROT-kalkylator template (utility above, education below, related-tools rail).
9. **ISO-mognadsanalys** (`/resurser/verktyg/iso-mognadsanalys`) — 10-question scoring tool. Gated download of the personalized PDF report.
10. **Webinars** (`/resurser/webinars`) — gated. 3 launch episodes (e.g. "Lagefterlevnadskontroll i praktiken," "CSRD för SMEs," "AI och GDPR — vad är okej?").
11. **Guider & E-böcker** (`/resurser/guider-och-e-bocker`) — 4 launch lead magnets: "Välj rätt compliance-system," "Bygg din första laglista," "ISO 14001-revision på en eftermiddag," "GDPR för SaaS-bolag."
12. **Partners** (`/resurser/partners`) — recruit ISO-konsulter and revisionsbyråer as referral partners. Embedded form + named human contact.
13. **Tipsa om laglig** (`/resurser/tipsa-om-laglig`) — referral program (15 % off för ett år).
14. **Karriär** (`/resurser/karriar`) — link out to Teamtailor or similar; not a build-from-scratch.

---

## 9. CTA strategy

### 9.1 Two-CTA discipline (mirroring Fieldly)

Every page in scope has the same two CTAs in the same order, in the hero **and** in the closing CTA block:

- **Primary:** `Kom igång gratis` → org-number entry → 14-day trial signup
- **Secondary:** `Boka demo` → calendar booking

Inline tertiary (hero-zone link, not button): `Se laglig.se på 3 min →` → product video. Matches Fieldly's "Fieldly på 3 minuter" without competing with the primary CTA pair.

### 9.2 Where CTAs appear

- Sticky top nav (right side): `Logga in` + `Kom igång gratis`
- Hero block: 2-CTA pair + 3-min link
- Mid-page (after the feature blocks): 1 CTA inline ("Se det själv — 14 dagar gratis")
- Closing block: 2-CTA pair (reprise)
- Site-wide footer: tertiary CTA

That's **3 explicit CTA placements per page** plus persistent sticky nav. Same as Fieldly. Don't add more.

### 9.3 Org-number entry as micro-commitment

Per `landing-page-spec.md`, the homepage uses org-number entry as the hero's micro-commitment. **Reuse this pattern** in the closing CTA block on every Produkt and Branscher page — it's our single strongest conversion move.

---

## 10. Build phasing

Total scope at launch: ~34 new marketing pages. Don't ship all at once.

### Phase 1 — "Skeleton" (ship together as one epic)

The minimum viable mega-menu — every dropdown link must resolve to *some* page. No 404s.

- Top nav with mega-menus (skeleton even if pages are thin)
- `/produkt` hub
- 4 hero feature pages (Laglistor, Lagbevakning, Lagefterlevnadskontroll, AI-assistent) — full content
- 8 remaining feature pages — **stub** (hero + 3 bullets + cross-sell to the live ones)
- `/branscher` hub
- 3 launch industry pages (Bygg, Industri, Tech) — full content
- 3 remaining industry pages — stub
- 0 persona pages — defer to Phase 2
- `/lagdatabas` hub
- `/resurser` hub
- Lagordlista (full ~150 entries)
- Blogg-template (with 5 launch posts)
- Kundcase index (template only, "Kundcase kommer snart")
- Om oss
- Byt till laglig.se (full)
- Lagändringsfeed (full, since data is already there)

**Result:** complete site, every nav link works, hero pages convert. Roughly 22 net new pages with real content + 8 stubs.

### Phase 2 — "Fill in" (4–8 weeks later)

- Remaining 8 product feature pages — full content
- Remaining 3 industry pages — full content
- 5 persona pages
- 5 launch kundcase posts
- CSRD-omfattningstest
- GDPR-bötesräknare

### Phase 3 — "Compound" (3–6 months later)

- ISO-mognadsanalys
- 3 launch webinars
- 4 launch e-böcker
- Partners hub
- Tipsa-om-laglig
- Continuous: 1 blog post/week, 1 kundcase/month

---

## 11. Open questions for the team

These are decision points the team should resolve before the build epic starts. Keeping them surfaced rather than guessing:

1. **Hero stat:** Do we use `170 000+ lagar och rättskällor` or a customer-count metric? (Recommendation: rättskällor at launch — verifiable, unique. Switch to customer count once we cross 250.)
2. **Persona pages:** Build all 5 in Phase 2, or keep them as anchor links inside Branscher pages? (Recommendation: build them — they're cheap and rank for `[role]-roll lagbevakning` queries.)
3. **Branscher hub design:** Cards-only (Fieldly-style) or cards + intro narrative selling cross-industry compliance? (Recommendation: cards + 200-word narrative intro — Fieldly's hub feels too thin.)
4. **Should we name competitors on `/byt-till-laglig`?** (Recommendation: no, mirror Fieldly's polite Swedish-market stance — describe pain without naming Notisum/JP Infonet/Karnov. We can A/B test naming later.)
5. **Lagordlista — how many terms at launch?** ~150 is a starting point; we likely need 250–400 to dominate the SEO surface long-term. (Recommendation: 150 launch, +20/month.)
6. **3-min product video:** does it exist yet? If not, this becomes a Phase-1 dependency. (Owner: marketing.)
7. **Existing `/lagar`, `/eu`, `/foreskrifter` public routes** — do their breadcrumbs need updating to surface a `/lagdatabas` parent? (Recommendation: yes, light refactor.)
8. **Calculator data source for Lagändringsfeed:** is there a public read-only endpoint we can hang the feed off, or do we need a new SSG route? (Owner: engineering.)

---

## 12. What this strategy does and doesn't replace

- **Does not replace** `landing-page-spec.md` — that document remains the spec for `/` (homepage). The strategy here adds the supporting marketing pages reachable from the homepage's nav.
- **Does not replace** `prd.md` — product strategy stays canonical there.
- **Should be referenced by** the upcoming epic that builds these pages.
- **Should be revisited** after Phase 1 ships — measure conversion-by-page, refine Phase 2 priorities based on what's actually working.

---

## 13. Appendix — Fieldly research summary

The full crawl-and-map of Fieldly's site lives in the conversation history (4 background research agents, 2026-04-30). Compressed key findings:

### 13.1 Fieldly Produkt pages (16 pages mapped)

- **Universal CTAs:** "Testa Gratis" + "Fieldly på 3 minuter" — 100 % consistent across all 16 pages. *(Lesson: pick a CTA pair and never deviate.)*
- **Universal H1 pattern:** "Digital [feature] för bygg och installation" or "[Feature] för bygg och installation." *(Lesson: outcome + audience anchor.)*
- **Inconsistencies:** Three competing proof stats (1,4M projekt / 2M projekt / 80k kunder); 3-bullet benefit strip on only 5/16 pages. *(Lesson: single stat, consistent benefit-strip pattern.)*
- **FAQ as SEO weapon:** Personalliggare has 17 FAQs covering the entire ID06 topic; Offert has 10 covering quote-vs-invoice basics. *(Lesson: heavy-FAQ pages on ambiguous regulatory topics — exactly what laglig should do for terms like CSRD, NIS2, lagefterlevnadskontroll.)*
- **Two recycled testimonial pools** — most pages reuse the same 5 or 9 quotes. *(Lesson: don't aim for unique quotes per page; build a rotating pool of 8–12 named, attributed customers.)*
- **Cross-sell at every page footer:** "Den här sidan är en del av det större affärssystemet" + 2–3 adjacent links. *(Lesson: mandatory.)*
- **Pain-imagery hooks:** "postit-lappar," "A4-sidor," "miniräknare," "borttappade kvitton" — concrete artifacts being replaced. *(Lesson: name what we're replacing — pärmar, Excel-mallar, statiska PDF-laglistor.)*

### 13.2 Fieldly Branscher pages (7 pages mapped)

- **Two H1 voices** ("ultimata projektverktyget för X" vs. "X-arens bästa vän") — split confusingly. *(Lesson: one register only.)*
- **Industry investment is uneven** — Installation has 8 testimonials and a real product-FAQ; Mark and Byggservice have 0 testimonials and reuse the chassis verbatim with only a hero swap. *(Lesson: invest equally per industry or don't ship the page.)*
- **Fully-built page wins:** Installation (8 testimonials, named integrations, real FAQ, KMA + EDI + AFC37 + SVA jargon). *(Lesson: this is the bar for every laglig industry page.)*
- **VVS lives at a legacy URL** outside /branscher, missing from the footer — clearly a high-ranking SEO landing they daren't redirect. *(Lesson: pick clean URLs from day one — no parallel pages.)*
- **Industry-specific feature ordering matters more than industry-specific copy.** Entreprenad foregrounds UE-hantering + ID06 + Creditsafe; Håltagning foregrounds smarta artiklar (auto-pricing). *(Lesson: reorder block 4 per industry; don't just rephrase block 1.)*

### 13.3 Fieldly Resurser (12 pages mapped)

- **Highest-leverage assets:** Lagordlista + Lönekompassen — both are single URLs that capture hundreds of long-tail queries with one build. *(Lesson: prioritize these two patterns above all else.)*
- **Glossary internal-linking pattern:** definitions of product terms (ÄTA, Personalliggare, etc.) link inline to /produkt/X; non-product terms stay informational. *(Lesson: directly transferable to laglig — definitions for Krav, Bevakning, Lagefterlevnadskontroll, Laglista, etc. each link inline to /produkt/X.)*
- **Restraint on commercial pages:** Blog and case-study pages have only one form embedded — no in-body product pushes. *(Lesson: protect content-page bounce rate; sell hard on commercial pages, soft on editorial pages.)*
- **/byt-till-fieldly** is the most cross-linked page on the site — 8 feature deep-dives each linking back to /produkt/X. *(Lesson: this is where laglig's heavy cross-linking belongs.)*
- **Calculator template (ROT-kalkylator):** utility above the fold, ~500-word education below, related-tools rail at the bottom. *(Lesson: replicate verbatim for our calculators — CSRD-omfattningstest, GDPR-bötesräknare, ISO-mognadsanalys.)*
- **Webinars are gated, blog and case studies are not.** Trade-off they made deliberately — content marketing is open, sales-oriented assets are gated. *(Lesson: do the same. Lagordlista and Lagändringsfeed must stay ungated.)*

### 13.4 Where Fieldly's compliance moat is shallow (our wedge)

Fieldly's only compliance claims are: AFC37 byggdagbok, Skatteverket-godkänd personalliggare, ID06 (Entreprenad-page only). They do **not** claim:
- Lagbevakning of any kind
- AB04/ABT06/AFB-uppdateringar
- ISO 14001/45001 9.1.2 lagefterlevnadskontroll
- Arbetsmiljöregler beyond the personalliggare
- GDPR, NIS2, CSRD, or EU-rätt

Every one of these is a laglig.se feature. **The gap is a 4-meter-wide wedge** — laglig should occupy it deliberately on Bygg/Industri pages where Fieldly is the closest neighbor.
