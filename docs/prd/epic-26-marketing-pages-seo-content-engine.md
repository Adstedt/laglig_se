# Epic 26: Marketing pages + SEO content engine — Brownfield Enhancement

**Goal:** Build the conversion-funnel layer the marketing site is currently missing — a coherent system of **feature pages, industry pages, topic/area pages, and comparison pages** built on a single shared template architecture, each one targeting a long-tail Swedish search cluster AND a buyer mental model. The pages plug into the existing public catalog (~10k+ indexable law pages at `/lagar/*`, `/eu/*`, already in the working `sitemap-index.xml`) via a reusable catalog-link primitive, so authority flows both ways: marketing pages catch intent-stage queries, the catalog catches research-stage queries, and internal linking compounds the two into a single SEO surface.

**Value Delivered:** Today, the marketing site is essentially a single landing page (`/`) plus pricing/legal/about — there is no surface that captures someone searching *"laglista bygg"*, *"GDPR compliance Sverige"*, *"NIS2 svenska företag"*, or *"Notisum alternativ"*. Every such prospect either lands on the homepage with no buyer-mental-model match, or drops out before reaching `/onboarding`. Meanwhile the catalog (tens of thousands of indexed law pages) is doing organic SEO work but doesn't funnel readers anywhere — readers hit a law page, satisfy their query, and leave. This epic closes both gaps: (1) **dedicated intent-stage landing pages** for the seven core features × seven priority industries × eight compliance topics, each with consistent CTAs into trial signup; (2) **bidirectional catalog linking** so a `/lagar/AFS-2023-12` reader sees "Used by companies in: Bygg, Industri" and a `/branscher/bygg` reader sees "Specific laws that apply: AFS 2023:12, …". The epic also delivers the **template architecture** that makes this scalable: a fixed set of section components, MDX-in-repo content surface, OG-image generator, JSON-LD bundle, and UTM-tagged CTA system — so adding page #15, #25, #50 is editorial work, not engineering work.

**Delivers:**
- **Template architecture (Story 26.1)** — three layout primitives (Feature template / Industry template / Topic template) composed from ~10 reusable section components (`<MarketingHero>`, `<FeatureGrid>`, `<SplitFeature>`, `<ProofBlock>`, `<CtaBlock>`, `<OrgCheckCta>`, `<CatalogLawList>`, `<ChangeFeedEmbed>`, `<FaqAccordion>`, `<RelatedPagesGrid>`). `<SplitFeature>` is the Fieldly-style workhorse: alternating media + copy rows that showcase product depth with real in-app screenshots (framed by a shared `<ScreenshotFrame>` media primitive). `<OrgCheckCta>` wraps the existing landing-v3 org-number check (`components/features/landing-v3/org-check-form.tsx` → `/api/public/company-preview` → `/signup?org=…`) so every marketing page can offer the "testa med ditt organisationsnummer" conversion device, not just the homepage. All three layouts share the same `<MarketingShell>` (navbar + footer + breadcrumbs) and the same metadata generator (title/description/canonical/OG image/JSON-LD bundled into a single `generateMarketingMetadata()` helper). Content surface is MDX-in-repo (`content/marketing/{funktioner,branscher,omraden}/*.mdx`), frontmatter-driven, with a strict TypeScript-typed schema per template kind so missing fields fail at build time.
- **Megamenu IA expansion (Story 26.2)** — extends the existing top-nav (`components/shared/navigation/navbar.tsx`) with two new dropdown columns: **Branscher** (industry pages) and **Områden** (topic pages). Existing **Regelverk** (catalog) and **Resurser** stay. The Fieldly-style 4-column megamenu pattern. Mobile sheet gets matching accordion sections.
- **Catalog-link primitive (Story 26.3)** — `<CatalogLawList>` server component takes an array of `{ slug | document_number, title?, anchor? }` entries and renders a styled list of links into `/lagar/*` (or `/eu/*` for EU regs). Live-data path looks up the matched `LegalDocument` by document_number, falls back to the provided title if no DB row exists. Used by every industry + topic page. Reciprocal embed (`<RelatedMarketingPages>`) on the catalog law-pages is **out of scope** for v1 — slot reserved, schema noted; ships in a follow-up epic once we have ≥20 marketing pages to link from.
- **First validation batch (Story 26.4)** — 5 pages that exercise BOTH layouts and prove the template before paralleled scaling: 3 industry pages (`/branscher/bygg`, `/branscher/hotell-restaurang` ← Almåsa-anchored, `/branscher/it`) + 2 feature pages (`/funktioner/kontroller`, `/funktioner/ai-agent`). Each is content-complete (≥1000 words), uses the catalog-link primitive (10–20 specific law links per page), embeds the live change-feed for the relevant area where applicable, and ships with full metadata + JSON-LD + UTM CTAs. **No further pages ship until the template is signed off post-26.4** — this is the validation gate.
- **Remaining Tier-1 industry pages (Story 26.5)** — `/branscher/{fastighet, vard-omsorg, industri, transport}`. Parallel content sprints once 26.4 proves the template.
- **Remaining Tier-1 feature pages (Story 26.6)** — `/funktioner/{laglista, kravpunkter, lagandringar, uppgifter, styrdokument}`.
- **Tier-2 topic/area pages, batch 1 (Story 26.7)** — `/omraden/{gdpr, nis2, arbetsmiljo, brandskydd}`. The 4 highest-leverage topics by search volume; NIS2 is a 2026 newsjack window.
- **Tier-2 topic/area pages, batch 2 (Story 26.8)** — `/omraden/{miljo, visselblasarlagen, penningtvatt, iso-14001}`.
- **Comparison pages (Story 26.9)** — `/jamfor/{notisum, lex-nu, excel}`. Branded-competitor + buying-stage queries; high commercial intent. Uses a comparison-specific section component (`<ComparisonTable>`) added to the template kit.
- **Conversion supports (Story 26.10)** — `/kom-igang` (2-min onboarding landing for paid traffic), `/demo` (Cal.com embed), `/kundcase/[slug]` (templated case-study page starting with Almåsa). Case-study template is its own layout primitive (fourth template kind).
- **Programmatic ordbok / glossary (Story 26.11)** — `/ordbok` index + `/ordbok/[term]` per-term pages, programmatically generated from a curated MDX folder (one term per file). 50–100 terms initially (GDPR, AFS, miljöbalk, NIS2, OVK, SBA, etc.). Each term links into the catalog where applicable. Long-tail SEO play.
- **Blog substrate (Story 26.12)** — `/blogg` index + `/blogg/[slug]` per-post pages, MDX-driven. Substrate only; ongoing content is post-epic. **Substrate ships, first 2 posts ship, content cadence is a separate effort**.

**Requirements covered:** Strategic frame established in conversation with PO (2026-05-16) building on the GA4 + sitemap-chunking + GSC submission work landed earlier the same day. Closes the conversion-funnel gap left after the marketing site launch (open beta started 2026-05-13).

**Estimated stories:** 12 (26.1–26.12 sequenced below; 26.1–26.4 are gating, 26.5–26.10 parallelize on content sprints, 26.11–26.12 stretch into Q3)

**Dependencies:**
- **Sitemap chunking** (`feat(seo): chunked sitemap + sitemap index`, merged 2026-05-16): provides `/sitemap-index.xml` and chunked sitemaps as **static XML generated postbuild by `scripts/generate-sitemaps.ts`** (chunk size `SITEMAP_CHUNK_SIZE = 2500` in `lib/constants/sitemap.ts`). There is no `app/sitemap.ts` route. The page-template architecture in 26.1 extends the generator script to walk the MDX folder and emit sitemap entries automatically (no per-page manual addition).
- **GA4 + Consent Mode v2** (`feat(consent)`, merged 2026-05-15) **+ unified event tracking** (`lib/track-event.ts`, lands via the `feat/tracking-events` branch): CTA telemetry uses `trackEvent()` (Vercel Analytics + GA4 `gtag`, consent-gated) rather than raw `gtag` calls. UTM tagging in 26.1 is the additional layer.
- **Catalog public routes** (`/lagar/[id]`, `/eu/[type]/[id]`, `/alla-lagar/[lawSlug]`, plus the public browse routes): the catalog-link primitive (26.3) reads `LegalDocument` via Prisma and resolves to these routes. No changes to catalog routes; this epic is a pure consumer.
- **Brand chrome** — two chromes exist: the homepage uses `components/features/landing-v3/{navbar-v3,footer-v3}.tsx` (NavbarV3 already contains a Produkt + Branscher megamenu shell with placeholder anchor hrefs, commented to be swapped to `/funktioner/*` + `/branscher/*` once built); catalog/legal pages use `components/shared/navigation/{navbar,footer}.tsx` via `app/(public)/layout.tsx`. **Marketing pages use the landing-v3 chrome** (`<MarketingShell>` composes NavbarV3 + FooterV3) so the funnel is visually continuous from `/`. 26.2 swaps NavbarV3's placeholder hrefs to real routes and adds Områden.
- **Story 24.6 / Story 12.10b** (Done): provides `<CreateListChooser>` + template catalog. The "Börja från mall" CTA on relevant pages may deep-link into the template gallery once Epic 25 B.1 surfaces it publicly.
- **Epic 25 — First-Run Modal** (in flight, B.0 Done, B.1 drafted): runs in parallel. Two coexistence rules: (1) Epic 25 retains dev-time priority on any conflict, (2) the `<MarketingShell>` navbar expansion in Story 26.2 must not regress the marketing-side cookie banner or beta badge that ship via the same nav.
- **Open-beta badge** (shipped 2026-05-16): visible on every marketing page. Pages built in this epic inherit it through the shared `<MarketingShell>`.

**Priority:** High — directly drives the conversion funnel for the open-beta launch window and beyond. Without these pages, paid acquisition and SEO traffic have nowhere to land that matches their intent. The template architecture (26.1–26.3) is the highest-leverage near-term ship: ~7 dev days unlock months of editorial-pace page rollout.

**Source artefacts:**
- Strategy conversation 2026-05-16 (PO + Alexander) — feature/industry/topic page list, megamenu structure, Fieldly pattern reference, three Laglig-specific differentiators (catalog inbound linking, live `lagandringar` embed, AI-agent live demo).
- Reference: `components/shared/navigation/navbar.tsx` (current nav, will be extended in 26.2)
- Reference: `components/shared/navigation/footer.tsx` (current footer, reused as-is)
- Reference: `app/globals.css` (Safiro titles/section labels at `font-medium`, Google Sans Flex body, **landing-v3 palette: near-monochrome warm ink + grays on cream, ONE sparing amber accent; sage only as muted section background, never a foreground accent**)
- Reference: `components/features/landing-v3/org-check-form.tsx` + `/api/public/company-preview` (existing org-number test on the homepage — reused by `<OrgCheckCta>`)
- Reference: `scripts/generate-sitemaps.ts`, `lib/constants/sitemap.ts` (postbuild static sitemap pipeline marketing pages register into)
- Reference: `app/(public)/lagar/[id]/page.tsx` (existing public law page — pattern for metadata + JSON-LD, will be sibling to `<CatalogLawList>` target)
- Reference: Epic 25 PRD (`docs/prd/epic-25-first-run-onboarding-modal.md`) for the brownfield-PRD house style this doc follows.
- Reference: `_prototypes/marketing-site/` — **already exists**: `index.html`, `branscher.html`, `branscher-bygg.html`, `produkt-lagefterlevnadskontroll.html`, `resurser-lagordlista.html`, `legal-pages.html`. This is the high-fidelity visual source-of-truth for the template kinds (resolves former Open Question 3).

---

## Epic Goal

Stand up a **scalable marketing-pages substrate** — template architecture + section components + MDX content surface + catalog-link primitive + metadata bundle — and use it to ship **24 high-intent pages** (7 features + 7 industries + 8 topics + 3 comparisons + 3 conversion supports — minus any cuts) by the end of Q3 2026, with the first 5 pages live within 4–6 weeks of epic kickoff. The substrate must reduce per-page build cost from "engineering sprint" to "MDX file + 30-minute review" so editorial cadence drives growth, not dev capacity.

## Epic Description

### Existing System Context

- **Current relevant functionality:** Marketing homepage is `app/page.tsx`, composed from `components/features/landing-v3/*` (HeroV3, FeatureShowcase, org-check form, etc.), plus public legal pages (`app/(public)/(legal)/villkor`, `/integritetspolicy`, `/cookiepolicy`, `/personuppgiftsbitradesavtal`, `/underbitraden`). **No `/om-oss` or `/kontakt` pages exist** (footer deliberately omits them; contact is `mailto:`). The homepage already carries the **org-number test** (`org-check-form.tsx` → `/api/public/company-preview` → `/signup?org=…`) — the epic generalizes it into a reusable CTA section. Shared chrome via `components/shared/navigation/{navbar,footer}.tsx` (navbar includes BetaBadge; cookie banner mounts via root layout). Brand fonts (Safiro headers, Google Sans Flex body) declared in `app/globals.css`; landing-v3 palette is near-monochrome warm ink/grays on cream with one sparing amber accent (sage only as muted section background). Public catalog routes already live: `/lagar/[id]`, `/eu/[type]/[id]`, `/alla-lagar/[lawSlug]`, plus browse pages under `/browse/*` and `/rattskallor`. Sitemap pipeline is **postbuild static XML** (`scripts/generate-sitemaps.ts` + `/sitemap-index.xml`) chunked at 2,500 URLs per file.
- **Technology stack (this area):** Next.js 16 App Router, React 19, TypeScript strict, Tailwind 3, shadcn/ui primitives, `lucide-react` icons, Prisma for catalog reads. MDX support not yet installed — adding `@next/mdx` + `gray-matter` (already in dependencies from Epic 24) is part of Story 26.1's setup. OG-image generation via Next 16's built-in `ImageResponse`. JSON-LD via the existing `<script type="application/ld+json">` pattern that `app/(public)/lagar/[id]/page.tsx` already uses.
- **Integration points:**
  - `scripts/generate-sitemaps.ts`: extended to walk the MDX content folder and emit one entry per marketing page (no per-page manual registration). Postbuild chunking already exists; marketing pages will sit alongside catalog URLs in the same chunk pool.
  - `app/robots.ts`: unchanged. `Sitemap:` line already points at `/sitemap-index.xml`.
  - `components/shared/navigation/navbar.tsx`: extended in Story 26.2 with two new dropdown columns (Branscher, Områden). Existing `Regelverk` + `Resurser` dropdowns untouched.
  - `components/shared/navigation/footer.tsx`: extended in Story 26.2 with a "Branscher" + "Områden" link column (mirrors the menu); existing footer columns untouched.
  - `app/(marketing)/funktioner/[slug]/page.tsx`, `app/(marketing)/branscher/[slug]/page.tsx`, `app/(marketing)/omraden/[slug]/page.tsx`, `app/(marketing)/jamfor/[slug]/page.tsx`, `app/(marketing)/kundcase/[slug]/page.tsx` — NEW dynamic routes, one per template kind. Each reads the matching MDX from `content/marketing/{kind}/[slug].mdx`, hydrates via the section-component registry, returns 404 on missing file.
  - `content/marketing/{funktioner,branscher,omraden,jamfor,kundcase}/*.mdx` — NEW content folder structure. Each MDX file has typed frontmatter validated against a Zod schema in `lib/marketing/frontmatter-schemas.ts`.
  - `components/marketing/` — NEW component folder for the section library. Subfolder `templates/` for layout primitives; `sections/` for composable section components.
  - `lib/marketing/get-page-metadata.ts` — NEW: pure function that takes a parsed frontmatter object and returns a full `Metadata` object including OG image URL, canonical, JSON-LD payload (BreadcrumbList + Article or FAQPage where applicable).
  - `app/(marketing)/og-image/[kind]/[slug]/route.tsx` — NEW: programmatic OG image generator via `ImageResponse`, one per page, cached at the edge.
  - `lib/marketing/catalog-link.ts` + `components/marketing/sections/catalog-law-list.tsx` — NEW: server-side helper that resolves `document_number` or `slug` strings to `LegalDocument` rows and renders an anchored link list.

### Enhancement Details

- **What's being added/changed:**
  1. **MDX content surface** — `@next/mdx` + `gray-matter` installed. Content folder structure `content/marketing/{kind}/[slug].mdx`. Each file has frontmatter (title, description, OG image variant, primary CTA, related catalog laws, related marketing pages, optional FAQ items) validated at build time. Body uses MDX section components.
  2. **Section component library** — ten reusable sections in `components/marketing/sections/`: `<MarketingHero>`, `<FeatureGrid>`, `<SplitFeature>`, `<ProofBlock>`, `<CtaBlock>`, `<OrgCheckCta>`, `<CatalogLawList>`, `<ChangeFeedEmbed>`, `<FaqAccordion>`, `<RelatedPagesGrid>`. Each section has a tight prop signature with TypeScript strict typing. `<OrgCheckCta>` reuses the landing-v3 org-check form so industry/feature pages can convert via "testa med ditt organisationsnummer", with UTM/`trackEvent` instrumentation matching `<CtaBlock>`. `<SplitFeature>` renders alternating media + copy rows (image left/right alternation) for product-depth storytelling, with a shared `<ScreenshotFrame>` media primitive (browser/device chrome around in-app screenshots).
  2b. **Imagery system** — pages carry real imagery, not stock-feel decoration: (a) **in-app screenshots** of actual product surfaces, framed in `<ScreenshotFrame>`; (b) **generated people photography** where human warmth helps (industry pages especially) — produced editorially with the Nano Banana 2 (Gemini image) API key Alexander holds. Generation is an **offline editorial step**: prompts + outputs are reviewed, optimized (WebP), and committed under `public/images/marketing/{kind}/{slug}/`; nothing is generated at build or runtime and the API key never enters the repo. Style constraints for generated people imagery: Scandinavian workplace realism, natural light, warm/cream-compatible grading consistent with the landing-v3 palette; no glossy stock-photo look. All images served via `next/image` with required `alt` text (a11y + image SEO).
  3. **Layout primitives** — three (plus one for kundcase later) in `components/marketing/templates/`: `<FeaturePageTemplate>`, `<IndustryPageTemplate>`, `<TopicPageTemplate>`. Each composes the section components in a fixed order with consistent CTA slots.
  4. **Megamenu IA** — `navbar.tsx` gains two dropdowns: **Branscher** (lists all 7 industries from Tier 1) + **Områden** (lists all 8 topics from Tier 2). Mobile sheet gets matching accordion sections. Footer column "Branscher" + "Områden" linked to same routes.
  5. **Catalog-link primitive** — `<CatalogLawList>` reads `LegalDocument` rows server-side, renders a styled list of links to `/lagar/[slug]` (or EU equivalents). Falls back to plain text for entries with no DB match (logs to console for editorial follow-up).
  6. **Metadata + JSON-LD bundle** — `generateMarketingMetadata()` returns a full `Metadata` object including canonical URL (uses `NEXT_PUBLIC_BASE_URL` = `https://www.laglig.se`), OG image URL (points at the generated `/og-image/[kind]/[slug]` route), and JSON-LD scripts: `BreadcrumbList` (always) + `Article` + **`FAQPage` on every marketing page** — `faq` frontmatter (min 3 Q&As) is **required** for feature/industry/topic pages, rendered visibly via `<FaqAccordion>` AND emitted as FAQPage JSON-LD from the same data so markup/visible-content parity holds (a Google requirement). Purpose: structured Q&A helps both Google and AI assistants/answer engines parse what each page covers. (Realism note: Google has restricted FAQ *rich results* to a narrow site set since 2023 — the win here is comprehension, snippets, and AI-answer citability, not guaranteed rich-result chips.)
  7. **OG image generator** — `app/(marketing)/og-image/[kind]/[slug]/route.tsx` returns a 1200×630 PNG via `ImageResponse`, rendering page title with the landing-v3 palette (warm ink on cream; the single amber accent used sparingly as a kind marker — never sage/clay as foreground), Safiro font (loaded via inline `@font-face`-equivalent in the `ImageResponse` font option), Laglig logo bottom-left.
  8. **UTM-tagged CTA system** — `<CtaBlock>` accepts a `placement` prop (e.g. `"hero"`, `"mid-page"`, `"footer-strip"`) and emits CTA URLs with `utm_source=marketing&utm_medium=organic&utm_campaign={kind}-{slug}&utm_content={placement}`. CTA clicks are tracked via `trackEvent()` from `lib/track-event.ts` (Vercel + GA4, consent-gated).
  9. **Sitemap registration** — `scripts/generate-sitemaps.ts` walks `content/marketing/` at postbuild and emits one entry per MDX file. Lastmod from file mtime. Priority 0.8 (between catalog at 0.7 and homepage at 1.0).
  10. **Section content matching brand** — every page renders inside the existing `<Navbar>` + `<Footer>` chrome. No new fonts, no new colors. The visual language follows the landing-v3 treatment (`components/features/landing-v3/*` + `_prototypes/marketing-site/*.html` as visual source-of-truth): Safiro `font-medium` for titles and section/group labels (never faux-bold), Google Sans Flex for content, near-monochrome ink/cream with one sparing amber accent.
- **How it integrates:**
  - **Catalog stays untouched** — this epic is a pure consumer of `LegalDocument`. No schema changes, no new Prisma models, no migration.
  - **Sitemap auto-registration** means editorial can add a new MDX file and it shows up in the sitemap on next deploy — no per-page coordination with engineering.
  - **Existing landing page** stays as `/` (the homepage). Marketing pages live under `/funktioner/*`, `/branscher/*`, `/omraden/*`, `/jamfor/*`, `/kundcase/*`. No collision.
  - **Three surfaces, one CTA system** — homepage, marketing pages, and existing legal pages all eventually consume `<CtaBlock>` for consistent funnel measurement. Migration of homepage + legal pages to `<CtaBlock>` is out of scope for this epic but the substrate makes it trivial.
  - **Cookie banner + beta badge** ride through the shared `<Navbar>` + root layout, automatically inherited by every marketing page.
- **Success criteria (measurable):**
  - **By end of Story 26.4 (template validation gate):** 5 pages live, indexed in GSC within 7 days of publish, each scoring ≥90 on Lighthouse SEO, each with non-trivial dwell time (>30s) per GA4. Template adds a new page in ≤30 minutes of editorial work after content is written.
  - **By end of Story 26.6 (Tier 1 complete):** 14 Tier-1 pages live (7 features + 7 industries). Organic impressions per GSC trend up week-over-week in the 4 weeks following.
  - **By end of Story 26.8 (Tier 2 complete):** 22 pages live. At least one page ranks in top 20 for its primary Swedish keyword.
  - **By end of Story 26.10 (conversion supports):** measured conversion rate from marketing-page CTAs to trial signup in GA4 — establish baseline; no specific number required until 4 weeks of data exists.

---

## Stories

### Story 26.1 — Marketing-page template architecture + MDX content surface + metadata bundle [FOUNDATIONAL GATE]

**Goal:** Ship the substrate. Three layout primitives, eight section components, MDX-in-repo content surface with typed frontmatter, OG-image generator, JSON-LD bundle, UTM-tagged CTA system, sitemap auto-registration. Nothing user-facing yet (no MDX content) — this is pure infrastructure.

**Acceptance Criteria (summary; full ACs drafted by SM):**
- AC 1: MDX support installed (`@next/mdx`), `content/marketing/` folder structure created
- AC 2: Frontmatter Zod schemas in `lib/marketing/frontmatter-schemas.ts` — one per template kind (`featurePage`, `industryPage`, `topicPage`)
- AC 3: Ten section components built with TypeScript-strict props (`<MarketingHero>`, `<FeatureGrid>`, `<SplitFeature>` — alternating media+copy rows with `<ScreenshotFrame>` media primitive, `<ProofBlock>`, `<CtaBlock>`, `<OrgCheckCta>` — reusing the landing-v3 org-check form, `<CatalogLawList>` — stub for 26.3, `<ChangeFeedEmbed>`, `<FaqAccordion>`, `<RelatedPagesGrid>`)
- AC 4: Three layout primitives composing the above (`<FeaturePageTemplate>`, `<IndustryPageTemplate>`, `<TopicPageTemplate>`)
- AC 5: Dynamic route `app/(marketing)/[kind]/[slug]/page.tsx` (or per-kind sub-routes — implementor's call) reads MDX, validates frontmatter, hydrates via template
- AC 6: `generateMarketingMetadata()` helper returns full `Metadata` + JSON-LD payloads
- AC 7: OG image generator route at `app/(marketing)/og-image/[kind]/[slug]/route.tsx` renders 1200×630 PNG, edge-cached
- AC 8: UTM-tagged CTA system in `<CtaBlock>` with `placement` prop; clicks instrumented via `trackEvent()` (`lib/track-event.ts`)
- AC 9: `scripts/generate-sitemaps.ts` extended to walk `content/marketing/` and auto-register
- AC 10: One placeholder MDX file in `content/marketing/funktioner/_template.mdx` documenting the schema for future authors
- AC 11: Build-time validation: missing required frontmatter field fails `next build`

**Estimated effort:** 5–7 dev days. Largest single story in the epic.

---

### Story 26.2 — Megamenu IA expansion (Branscher + Områden)

**Goal:** Extend the navbar with two new dropdown columns so the page list users will discover is the page list editorial actually ships.

**ACs:**
- AC 1: Desktop nav dropdown for **Branscher** lists all 7 Tier-1 industry routes (live or coming-soon disabled state per current build state)
- AC 2: Desktop nav dropdown for **Områden** lists all 8 Tier-2 topic routes (same)
- AC 3: Mobile sheet header accordion sections match
- AC 4: Footer column "Branscher" + "Områden" added with same links
- AC 5: Routes that don't yet have content show as "Kommer snart" (disabled) — editorial fills them in via Stories 26.5–26.8

**Estimated effort:** 1–2 dev days.

---

### Story 26.3 — Catalog-link primitive (`<CatalogLawList>` live data path)

**Goal:** The unique-defensible move: marketing pages link into the catalog with real `LegalDocument` data, not hand-typed links.

**ACs:**
- AC 1: `lib/marketing/catalog-link.ts` exports `resolveCatalogLinks(entries)` — takes `Array<{ document_number?, slug?, title?, anchor? }>` and returns `Array<{ href, title, status: 'matched' | 'unmatched' }>`
- AC 2: `<CatalogLawList>` server component takes resolved entries, renders styled `<ul>` with links into `/lagar/[slug]`, **`/foreskrifter/[slug]` (agency regulations — the AFS/MSBFS links industry pages lean on most)**, or `/eu/{forordningar|direktiv}/[slug]` — full mapping via the shared `getPublicUrlPath()` extracted from the sitemap script (corrected in Story 26.3 v0.1; ratified by PO 2026-06-10)
- AC 3: Unmatched entries render as plain text and log a `[CATALOG_LINK_UNMATCHED]` console warning so editorial can fix the MDX
- AC 4: Build-time prefetch — at sitemap generation, run resolution for every page's `relatedCatalogLaws` frontmatter and emit a build-warnings file (`.next/marketing-link-warnings.txt`) so we catch dead links pre-deploy
- AC 5: Component supports an optional grouping prop (`groupBy: 'content_type'`) for industry pages that want to organize laws by category

**Estimated effort:** 2–3 dev days.

---

### Story 26.4 — First validation batch: 5 pages across both layouts [VALIDATION GATE]

**Goal:** Prove the template works at content depth before scaling. Five pages, two layouts, real content, real catalog links, full metadata. If anything is awkward at this stage, fix the template now, not after 14 pages are stuck in it.

**Pages shipped:**
- `/branscher/bygg` — industry, ~1200 words, links to ~15 AFS + PBL + miljöbalk laws
- `/branscher/hotell-restaurang` — industry, ~1200 words, **Almåsa case study embedded**, links to livsmedelslag + alkohollag + brandskydd + arbetsmiljö
- `/branscher/it` — industry, ~1000 words, GDPR + NIS2 focus
- `/funktioner/kontroller` — feature, ~1100 words, screenshots of cycle detail + report, live AI-agent embedded if 26.1 allows
- `/funktioner/ai-agent` — feature, ~1200 words, the differentiator pitch, sandbox demo

**ACs:**
- AC 1: All 5 pages live at their target URLs
- AC 2: Each scores ≥90 Lighthouse SEO
- AC 3: Each registers in `/sitemap-index.xml` auto
- AC 4: Each has unique OG image rendered by 26.1's generator
- AC 5: Each has BreadcrumbList JSON-LD + an Article (or industry-appropriate) JSON-LD + FAQPage JSON-LD backed by a visible `<FaqAccordion>` with ≥3 page-specific Q&As (no boilerplate questions duplicated across pages)
- AC 6: Each `<CtaBlock>` instance emits UTM-tagged URLs trackable in GA4
- AC 7: 5–10 internal links from each page into the catalog via `<CatalogLawList>` (live data)
- AC 8: Megamenu (26.2) routes to all 5 work, no 404s
- AC 9: **Template sign-off review** with PO before any further pages ship in 26.5+
- AC 10: **Imagery** — each page carries ≥2 production-quality images: at least one real in-app screenshot in `<ScreenshotFrame>` (feature pages: ≥2 screenshots), plus a generated people photo where it adds human warmth (industry pages). All optimized (WebP), committed under `public/images/marketing/`, served via `next/image` with meaningful `alt` text

**Estimated effort:** 5–7 dev days (content-heavy).

---

### Story 26.5 — Tier-1 industry pages, remainder

`/branscher/{fastighet, vard-omsorg, industri, transport}`. Once 26.4 proves the template, these parallelize. Each ~1000 words, 10–15 catalog links, full metadata. **Acceptance: same as 26.4 ACs 1–8 + AC 10 (imagery), scoped to these 4 pages.**

**Estimated effort:** 4–5 dev days (parallelizable across days).

---

### Story 26.6 — Tier-1 feature pages, remainder

`/funktioner/{laglista, kravpunkter, lagandringar, uppgifter, styrdokument}`. ~1000 words each. **Acceptance: same as 26.4 ACs 1–8 + AC 10 (imagery), scoped to these 5 pages.**

**Estimated effort:** 5–6 dev days.

---

### Story 26.7 — Tier-2 topic pages, batch 1

`/omraden/{gdpr, nis2, arbetsmiljo, brandskydd}`. ~800–1000 words each. Topic pages lean harder on `<CatalogLawList>` (these are reference-y) and `<ChangeFeedEmbed>` (freshness signal). NIS2 is a newsjack window — prioritize within the batch.

**ACs:** same as 26.4 ACs 1–8 + AC 10 (imagery) scoped + AC 9: each topic page embeds the live `<ChangeFeedEmbed>` for its topic area. (Topic pages are reference-y — screenshots where the product genuinely surfaces the topic; people imagery optional.)

**Estimated effort:** 4–5 dev days.

---

### Story 26.8 — Tier-2 topic pages, batch 2

`/omraden/{miljo, visselblasarlagen, penningtvatt, iso-14001}`. Same shape as 26.7.

**Estimated effort:** 4–5 dev days.

---

### Story 26.9 — Comparison pages

`/jamfor/{notisum, lex-nu, excel}`. Branded-competitor + buying-stage queries. Requires a new section component `<ComparisonTable>` for the head-to-head feature matrix. Tone is honest and specific — generic competitor pages rank poorly.

**ACs:**
- AC 1: `<ComparisonTable>` added to section library (Story 26.1 retrofit if not anticipated)
- AC 2: 3 pages live with comparison table + narrative-style copy below
- AC 3: Each links to the relevant Laglig feature page (internal linking)
- AC 4: Each has a clear, fair "When [competitor] is the better choice" section — counterintuitively boosts trust + ranking
- AC 5: Standard metadata + JSON-LD + UTM CTAs, incl. FAQPage with comparison-intent Q&As ("Vad kostar X jämfört med Laglig?", "Kan man flytta sin laglista från X?")

**Estimated effort:** 3–4 dev days.

---

### Story 26.10 — Conversion supports

`/kom-igang` (2-min onboarding landing for paid traffic — short-form, single CTA), `/demo` (Cal.com embed), `/kundcase/[slug]` (templated case-study layout, ships with Almåsa as first case).

**ACs:**
- AC 1: New layout primitive `<CaseStudyTemplate>` added to template library (Story 26.1 retrofit if not anticipated). Case-study frontmatter schema: customer name, industry, headline metric, problem/solution/outcome blocks, quote, customer logo URL.
- AC 2: `/kom-igang` page ships — short hero, 3-step "how it works" mirroring the homepage section, single CTA into trial signup
- AC 3: `/demo` page ships with Cal.com iframe embed + fallback contact link
- AC 4: First case study `/kundcase/almasa-havshotell` ships (requires customer signoff on copy + quote)

**Estimated effort:** 3–4 dev days.

---

### Story 26.11 — Programmatic ordbok / glossary

`/ordbok` index + `/ordbok/[term]` per-term pages. 50–100 terms, MDX-driven (one file per term in `content/marketing/ordbok/[term].mdx`). Long-tail SEO play — captures "vad är GDPR", "vad betyder AFS", "OVK definition" style queries.

**ACs:**
- AC 1: Glossary content folder + per-term MDX schema (term, short-definition, long-definition, related catalog laws, related marketing pages)
- AC 2: `/ordbok` index page lists all terms alphabetically with anchor links + intro copy
- AC 3: `/ordbok/[term]` per-term pages — short, 200–500 words, structured for featured-snippet capture
- AC 4: Each term links into the catalog (via 26.3 primitive) where applicable
- AC 5: First batch of 30 terms shipped; remainder editorial-paced

**Estimated effort:** 5–7 dev days for substrate + first 30 terms; ongoing.

---

### Story 26.12 — Blog substrate

`/blogg` index + `/blogg/[slug]`. MDX-driven, frontmatter-typed (title, description, publish-date, author, tags, hero image). **Substrate ships + 2 inaugural posts ship; ongoing content cadence is post-epic.**

**ACs:**
- AC 1: Blog content folder + MDX schema
- AC 2: `/blogg` index page lists posts reverse-chronologically, paginated at 10/page
- AC 3: `/blogg/[slug]` per-post page using a new `<BlogPostTemplate>` (fifth layout primitive)
- AC 4: RSS feed at `/blogg/rss.xml`
- AC 5: 2 inaugural posts shipped (topics TBD with marketing — likely "Vi har lanserat Laglig.se" + a NIS2 explainer to seize the newsjack window)
- AC 6: Sitemap auto-registration for blog posts (extends 26.1's walker)

**Estimated effort:** 3–5 dev days for substrate + 2 posts; ongoing.

---

## Compatibility Requirements

- [x] **Existing APIs remain unchanged** — this epic only adds new routes and consumes existing read-only Prisma queries (`LegalDocument` for catalog links).
- [x] **Database schema changes** — none. Pure consumer.
- [x] **UI changes follow existing patterns** — uses existing brand chrome, fonts, palette. Section components match the visual language of the existing landing page.
- [x] **Performance impact is minimal** — marketing pages are static (or ISR-cached). OG images are edge-cached. Catalog-link resolution is build-time prefetched.
- [x] **Sitemap pipeline impact** — marketing pages add ~30–50 URLs to the existing 10k+ catalog URL pool. Well within the 10k-per-chunk limit; no chunking changes needed.

## Risk Mitigation

- **Primary risk:** Template ossifies wrong before validation. Story 26.4's "5-page validation gate" exists explicitly to catch this — no further pages ship in 26.5+ until PO signs off on the template after 26.4 lands. If issues surface, 26.4 spawns a fix-cycle before unblocking parallel content sprints.
- **Secondary risk:** Editorial pace doesn't keep up with template pace. Mitigation: each content-heavy story (26.4–26.8) is content-bound, not engineering-bound. PO + Alexander define a per-story content brief (target keyword, 3 must-have sub-headings, recommended catalog links, **image list: which in-app surfaces to screenshot + whether/what people imagery to generate**, **3–5 page-specific FAQ Q&As**) before dev starts. Devs write the MDX; PO reviews. No story marked Done without published-quality content.
- **Tertiary risk:** OG image generator is fiddly (custom fonts, edge runtime constraints). Mitigation: 26.1 ships with a simple text-on-color baseline; iteration on visual richness is a follow-up story outside this epic.
- **Rollback plan:** Marketing pages are pure additions. To roll back, delete the route files + MDX folder + sitemap walker entry. Existing catalog, homepage, and legal pages are untouched.

## Definition of Done

- [ ] All 12 stories completed with their AC sets met
- [ ] Template architecture (26.1–26.3) reviewed and signed off post-26.4 validation
- [ ] All shipped marketing pages score ≥90 Lighthouse SEO
- [ ] All shipped pages auto-registered in `/sitemap-index.xml`
- [ ] All shipped pages have UTM-tagged CTAs trackable in GA4
- [ ] Catalog-link primitive in active use on ≥80 % of industry + topic pages
- [ ] No regression in existing homepage, catalog, legal page, or app routes
- [ ] Megamenu IA changes don't break the cookie banner, beta badge, or mobile sheet

---

## Open Questions

These need resolution before or during Story 26.1 implementation:

1. **MDX route shape:** single dynamic route `app/(marketing)/[kind]/[slug]/page.tsx` with `kind` ∈ `{funktioner, branscher, omraden, jamfor, kundcase}`, OR five per-kind sub-routes (`app/(marketing)/funktioner/[slug]/page.tsx`, etc.)? Single-route is DRY-er; per-kind allows kind-specific `generateMetadata` overrides. **PO recommendation: per-kind sub-routes** — at marginal cost they make each kind's metadata + route customizable without an `if-else` ladder.
2. **OG image font loading:** `ImageResponse` requires fonts as `ArrayBuffer`. Safiro is a `.woff2` — needs base64-bundled into the route handler or fetched at edge cold-start. **PO recommendation: bundle as constant** at build time; ~50 KB constant in the bundle is cheaper than the cold-start fetch.
3. ~~**Marketing prototype HTML**~~ **RESOLVED (2026-06-10):** `_prototypes/marketing-site/` already exists (`branscher.html`, `branscher-bygg.html`, `produkt-lagefterlevnadskontroll.html`, `resurser-lagordlista.html`, etc.) and serves as the visual source-of-truth for Story 26.1. No pre-work story needed.
4. **Editorial workflow for non-dev authors** (post-Tier-1): MDX-in-repo means non-devs need GitHub access + PR comfort. If marketing/PO wants to author without that, we revisit CMS. **PO recommendation: defer to Q3** — Tier 1 + 2 will likely be dev-authored anyway; revisit at Story 26.7 boundary based on actual author profile.
5. **`<ChangeFeedEmbed>` data source:** needs a public-readable API of recent law changes filtered by topic. Does one exist, or does Story 26.7 also need a tiny `/api/public/lagandringar?omrade=X` endpoint? **Likely yes (new endpoint needed).** Flag for tech-spike in 26.1.

---

## Handoff to Story Manager

Please develop detailed user stories for this brownfield epic. Key considerations:

- This is an additive enhancement to an existing Next.js 16 marketing surface — zero schema changes, zero changes to authenticated app routes, pure addition of `app/(marketing)/*` routes + `content/marketing/*` MDX
- **Story 26.1 is the gating foundation** — every downstream story depends on its template architecture. SM should expand its ACs from the summary in this PRD to the full 15–25 AC set the team typically uses.
- **Story 26.4 is the validation gate** — no parallel content sprints (26.5+) start until 26.4 lands and the template is signed off
- Existing patterns to follow: `app/(public)/lagar/[id]/page.tsx` for metadata + JSON-LD shape, `components/shared/navigation/{navbar,footer}.tsx` for chrome reuse, `app/sitemap.ts` for sitemap registration shape
- Critical compatibility requirements: no changes to catalog routes, no schema changes, megamenu expansion must not regress the cookie banner / beta badge / mobile sheet that already mount through `<Navbar>`
- Each story must include a verification step that existing functionality (homepage, catalog browse, legal pages, authenticated app) remains intact

The epic should maintain system integrity while delivering a scalable marketing-pages substrate that turns page-building from "engineering sprint" into "MDX file + 30-minute review."

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-05-16 | 0.1 | Initial PRD draft, 12 stories sequenced, template-architecture gate established, MDX-in-repo content surface confirmed, validation-gate model adopted (26.4 signs off template before parallel content sprints). Five open questions flagged for resolution before/during Story 26.1. | Sarah (PO) |
| 2026-06-10 | 0.4 | FAQ structured data made standard per Alexander: `faq` frontmatter (min 3 page-specific Q&As) now REQUIRED on feature/industry/topic pages; FAQPage JSON-LD emitted on every page from the same data as the visible `<FaqAccordion>` (markup/content parity); 26.4 AC 5 + 26.9 AC 5 updated; content briefs include 3–5 FAQ Q&As. Rationale: Google + AI-assistant comprehension/citability (rich-result chips not expected — restricted since 2023). | Sarah (PO) |
| 2026-06-10 | 0.3 | Imagery system added per Alexander: `<SplitFeature>` section (Fieldly-style alternating media+copy rows) + `<ScreenshotFrame>` media primitive join the 26.1 kit (now 10 sections); new imagery AC 10 on 26.4 (≥2 production images/page: in-app screenshots + generated people photos where warming) propagated to 26.5–26.8; generated imagery produced editorially via Alexander's Nano Banana 2 (Gemini image) key — offline step, assets committed, key never in repo; content briefs now include an image list. | Sarah (PO) |
| 2026-06-10 | 0.2 | PO validation pass against codebase. Corrected: homepage path (`app/page.tsx` + landing-v3, no `(marketing)` group yet), sitemap integration (postbuild `scripts/generate-sitemaps.ts`, 2,500/chunk — not `app/sitemap.ts`), removed nonexistent `/om-oss`+`/kontakt` claims, palette guidance updated to landing-v3 (near-monochrome ink/cream, single amber accent). Added: ninth section component `<OrgCheckCta>` (reuses landing-v3 org-number test as a conversion device on marketing pages), CTA telemetry via `lib/track-event.ts`. Resolved Open Q3: `_prototypes/marketing-site/` already exists as visual source-of-truth. | Sarah (PO) |
