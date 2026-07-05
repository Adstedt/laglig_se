# MDX contract

Where the page is written and the exact shape it must take. The build **fails** on a missing or invalid frontmatter field (Zod validation in `lib/marketing/content.ts` runs during SSG), so get this right.

- **File:** `content/marketing/{funktioner|branscher|omraden|jamfor|kundcase}/[slug].mdx`
- **Slug:** kebab-case, no leading underscore (underscore = unpublished, e.g. `funktioner/_template.mdx`).
- **Reference to copy the house style from:** `content/marketing/omraden/miljobalken.mdx`. Schema source of truth: `lib/marketing/frontmatter-schemas.ts`.

## What the template renders vs. what you write

The template (`components/marketing/templates/base-page-template.tsx`) renders a **fixed section order from frontmatter**. You author **only the middle `<article>` body**. Do **not** hand-write hero, CTAs, catalog list, change feed, FAQ, or related grid in the body — they come from frontmatter and would double up.

Auto-rendered order: MarketingHero → **[your MDX body]** → mid-page OrgCheckCta _or_ CtaBlock → CatalogLawList → ChangeFeedEmbed _(omraden only)_ → FaqAccordion → RelatedPagesGrid → footer CtaBlock band.

## Frontmatter (all kinds share `baseFrontmatter`)

```yaml
title: '…' # <=60 chars ideal (SEO title); root layout appends " | Laglig.se"
description: '…' # ~155 chars; Zod HARD CAP 170. Written for the click.
heroEyebrow: 'Område · Miljö' # kind · cluster label
heroTitle: '…' # H1; can differ from meta title, disambiguate ambiguous terms here
heroSubtitle: '…' # one/two sentences, plain-language, name the payoff
primaryCta:
  label: 'Testa gratis'
  href: '/signup'
showOrgCheck: true # mid-page org-number tester (vs a plain CtaBlock)
heroOrgCheck: true # optional: lead the HERO with the org tester (trial demoted to secondary)
heroMedia: # optional
  type: 'photo' # 'photo' | 'screenshot'
  src: '/images/marketing/omraden/[slug]-….webp'
  alt: '…' # required, descriptive (a11y + image SEO), no brand names/readable text
relatedCatalogLaws: # array; each entry needs documentNumber OR slug
  - documentNumber: 'SFS 1998:808' # SFS for Swedish, celex (e.g. 32006R1907) for EU
    title: 'Miljöbalk (1998:808)' # fallback text if no catalog row matches
relatedPages: # array of internal paths, each MUST start with '/'
  - '/omraden/miljo'
  - '/funktioner/laglista'
faq: # REQUIRED, min 3; real search questions; mirrored into FAQPage JSON-LD
  - question: 'Vad är …?'
    answer: '…' # answer-first, quotable, self-contained
ogVariant: '…' # optional
```

Notes:

- `relatedCatalogLaws` strings are trimmed and matched **exactly** against `document_number`/slug in the catalog — a trailing space silently unmatches. Unmatched entries degrade to plain text and log `[CATALOG_LINK_UNMATCHED]`; aim for zero.
- `relatedPages` that point at a page which doesn't exist yet are silently dropped (never a 404) — but write them to real or planned routes.
- `faq` is the single source for both the visible `<FaqAccordion>` and the `FAQPage` JSON-LD. Never add FAQ markup that isn't visible; never leave a visible FAQ out of the array. Min 3, but 5 is the norm.

## Body component vocabulary

Standard markdown (`##`, `###`, paragraphs, lists, `**bold**`, `[links](/…)`, tables) is auto-styled to brand typography (Safiro headings, `max-w-3xl` prose column). Plus these registered components (from `mdx-components.tsx`) — **only these render**; anything else is unknown JSX:

| Component                                                                     | Use                                                                                                                                             |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `<Lead>`                                                                      | Standfirst/deck — wrap only the opening sentence(s).                                                                                            |
| `<DefinitionBox term="…" source="…">`                                         | Answer-first "vad är X?" block under the first H2. `source` carries the SFS + in-force date. GEO-critical: this is the quotable citation block. |
| `<ProcessSteps steps={[{title, description}]} />`                             | Enumerated structured facts (principles, phases). Put the statute ref in each `title` (e.g. `Försiktighetsprincipen (2 kap. 3 §)`).             |
| `<SplitFeature eyebrow title media={{type,src,alt}} mediaSide="left\|right">` | The guide→product bridge row: editorial claim next to the product screenshot/photo that proves it. Body content is the copy beside the media.   |
| `<FeatureGrid …>`                                                             | Grid of short feature/point cards.                                                                                                              |
| `<ProofBlock …>`                                                              | Proof/quote/stat block.                                                                                                                         |
| `<ScreenshotFrame …>`                                                         | Browser/device chrome around an in-app screenshot.                                                                                              |

Section-level components (`CatalogLawList`, `OrgCheckCta`, `ChangeFeedEmbed`, `FaqAccordion`, `RelatedPagesGrid`, `CtaBlock`, `MarketingHero`, `HeroOrgCheck`) are **template-rendered from frontmatter — never place them in the body.**

## Structure by kind (the guide→product arc)

- **omraden (law explainer):** Lead → `<DefinitionBox>` (answer-first) → kapitel/struktur översikt → the crux (principles via `<ProcessSteps>`) → practical requirements (egenkontroll etc.) → obligations (anmälnings-/tillståndsplikt) → sanctions → **"Så gör Laglig.se X hanterbar"** with a `<SplitFeature>` (soft hand-off) + a lagbevakning `<SplitFeature>`. Reference-style; leans on the auto CatalogLawList + ChangeFeed for freshness. Target ~1100 words. JSON-LD: BreadcrumbList + FAQPage (no Article).
- **branscher:** hero + grouped-laglista screenshot → per H2 lagkrav cluster, **each handing off to the exact product surface** (`<SplitFeature>`) that operationalizes it → mid-page OrgCheckCta at peak problem-awareness → CatalogLawList (named laws, live-linked) → FAQ → footer. **No editorial H2 without a product hand-off.** JSON-LD adds Article.
- **funktioner:** inverted — each capability claim sits next to the screenshot proving it, with editorial explaining the lagkrav context that makes it matter. Product promises are allowed here (and only here). JSON-LD adds Article.

## Images

Assets live under `public/images/marketing/{kind}/{slug}/` (shared people photos under `.../people/`), committed as WebP, served via `next/image`. Generation is an **offline editorial pre-step** (Nano Banana 2) — never at build/runtime, key never in the repo. Every image needs descriptive `alt`, no readable text/logos, no company names, warm grade tuned to the cream `#faf9f6` background. If you're only authoring copy, reference existing/planned image paths and flag which need generation.
