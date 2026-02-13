# Epic 13: ELI Structured Data & Legislation Interoperability

## Epic Goal

Adopt the European Legislation Identifier (ELI) standard across all public document pages to enhance SEO with rich structured data, provide machine-readable ELI URIs for interoperability with European legal databases, and enable automated legislation discovery via sitemaps and Atom feeds.

## Epic Description

### Existing System Context

- **Current functionality**: 100k+ public document pages across 4 content types (lagar, rattsfall, eu, foreskrifter). Three of four page types already emit basic `schema.org/Legislation` or `schema.org/LegalCase` JSON-LD (`lagar`, `rattsfall`, `eu`). Foreskrifter pages have no JSON-LD.
- **Technology stack**: Next.js 15 (App Router), ISR with `revalidate = 3600`, Prisma/PostgreSQL, existing `generateMetadata()` on all public pages
- **Integration points**: Public document page components (`app/(public)/lagar/[id]/page.tsx`, `app/(public)/rattsfall/[court]/[id]/page.tsx`, `app/(public)/eu/[type]/[id]/page.tsx`, `app/(public)/foreskrifter/[slug]/page.tsx`), database `LegalDocument` model (has all required fields: `document_number`, `title`, `content_type`, `publication_date`, `effective_date`, `slug`, `metadata` JSONB)

### Enhancement Details

**What's being added/changed:**

The [European Legislation Identifier (ELI)](https://eur-lex.europa.eu/eli-register/what_is_eli.html) is a standard that makes legislation identifiable, describable, and exchangeable across Europe. It has four pillars:

1. **Identification** — Unique, human-readable URIs for legal texts
2. **Metadata** — Standardized properties based on FRBR (Work → Expression → Manifestation)
3. **Publication** — Metadata embedded in web pages via RDFa or JSON-LD
4. **Synchronization** — Sitemaps and Atom feeds for automated discovery

Sweden has **not officially implemented ELI** — neither Riksdagen.se nor Lagrummet.se exposes ELI metadata. Laglig.se would be the first Swedish legal information source with ELI compliance.

**Three implementation levels:**

| Level | What | Effort | Value |
|-------|------|--------|-------|
| **1. Enhanced JSON-LD** | Upgrade existing schema.org to include ELI ontology properties (`legislationLegalForce`, `encoding`, `spatialCoverage`, etc.). Add JSON-LD to föreskrifter pages. Centralize helper. | Low | SEO rich results, AI discoverability |
| **2. ELI URI Routes** | Mint ELI-compliant URIs (`/eli/se/sfs/2005/551`) that resolve (HTTP 303) to canonical document pages | Low | European interoperability, URI persistence |
| **3. Legislation Feeds** | ELI Pillar 4 sitemaps and Atom feeds for automated discovery by aggregators | Low-Medium | Ecosystem integration, N-Lex eligibility |

**How it integrates:**
- Level 1 enhances existing `<script type="application/ld+json">` blocks already in 3 page components
- Level 2 adds a single new catch-all route (`/eli/[...segments]`) with redirect logic
- Level 3 adds two new API routes (`/eli/sitemap.xml`, `/eli/feed.atom`) generated from existing database

**Success criteria:**
- All 4 public document page types emit valid ELI-compatible JSON-LD (validated via [ELI Validator](https://webgate.ec.europa.eu/eli-validator/))
- ELI URIs resolve correctly for all document types
- Legislation sitemap and Atom feed are accessible and valid
- Google Search Console shows Legislation rich result eligibility for sample pages
- Zero regression on existing SEO (page speed, metadata, canonical URLs)

### ELI URI Pattern for Sweden

Since Sweden has no official ELI scheme, we define our own following the ELI template specification:

```
/eli/se/sfs/{year}/{number}                    → SFS laws
/eli/se/sfs/{year}/{number}/andringar/{amend}  → SFS amendments
/eli/se/{agency-prefix}/{year}/{number}        → Agency regulations (AFS, MSBFS, NFS, etc.)
/eli/eu/reg/{year}/{number}                    → EU regulations
/eli/eu/dir/{year}/{number}                    → EU directives
```

Court cases do not use ELI (they are not legislation), but get enhanced `schema.org/LegalCase` structured data.

### ELI-Enhanced JSON-LD Example (Level 1)

Current (basic schema.org):
```json
{
  "@context": "https://schema.org",
  "@type": "Legislation",
  "name": "Aktiebolagslag (2005:551)",
  "identifier": "SFS 2005:551",
  "legislationIdentifier": "SFS 2005:551",
  "datePublished": "2005-06-16",
  "inLanguage": "sv",
  "legislationType": "Act"
}
```

Enhanced (ELI + schema.org):
```json
{
  "@context": {
    "@vocab": "https://schema.org/",
    "eli": "http://data.europa.eu/eli/ontology#"
  },
  "@type": "Legislation",
  "@id": "https://laglig.se/eli/se/sfs/2005/551",
  "name": "Aktiebolagslag (2005:551)",
  "identifier": "SFS 2005:551",
  "legislationIdentifier": "SFS 2005:551",
  "datePublished": "2005-06-16",
  "inLanguage": "sv",
  "legislationType": "Act",
  "legislationLegalForce": "InForce",
  "spatialCoverage": {
    "@type": "Country",
    "name": "Sweden",
    "identifier": "SE"
  },
  "publisher": {
    "@type": "GovernmentOrganization",
    "name": "Sveriges riksdag"
  },
  "encoding": {
    "@type": "LegislationObject",
    "contentUrl": "https://laglig.se/lagar/aktiebolagslag-2005-551",
    "encodingFormat": "text/html",
    "inLanguage": "sv"
  }
}
```

### FRBR Model Mapping

ELI uses a three-level FRBR model. For our purposes:

| FRBR Level | ELI Class | Laglig.se Mapping |
|------------|-----------|-------------------|
| Work (abstract law) | `eli:LegalResource` | `LegalDocument` record |
| Expression (language version) | `eli:LegalExpression` | Always Swedish (`sv`) — single expression |
| Manifestation (format) | `eli:Format` | HTML page (our only format) |

Since we only serve Swedish HTML, the three levels collapse to one — the `LegalDocument` record. The JSON-LD models this explicitly via `encoding` → `LegislationObject`.

## Stories

1. **Story 13.1: Enhance JSON-LD with ELI Properties & Centralize Helper**
   Upgrade existing JSON-LD on lagar/rattsfall/eu pages with ELI ontology properties (`legislationLegalForce`, `spatialCoverage`, `publisher`, `encoding`, `@id` with ELI URI). Add JSON-LD to föreskrifter pages (currently missing). Extract shared `toISOStringOrUndefined()` and JSON-LD generation into a centralized `lib/eli/build-jsonld.ts` helper to eliminate code duplication across 4 page files. Validate output with ELI Validator.

2. **Story 13.2: ELI URI Resolution Routes**
   Create `/eli/[...segments]` catch-all route that parses ELI URI components, looks up the target document in the database, and returns HTTP 303 redirect to the canonical document page. Handle all document types (SFS laws, amendments, agency regulations, EU legislation). Return proper 404 for unknown documents. Add `<link rel="alternate">` pointing to ELI URI on each document page.

3. **Story 13.3: ELI Pillar 4 — Legislation Sitemaps & Atom Feeds**
   Create `/eli/sitemap.xml` route serving a legislation-specific sitemap with ELI URIs and `<lastmod>` timestamps from `updated_at`. Create `/eli/feed.atom` route serving an Atom feed of recently published/updated legislation. Both generated from existing database queries. Register the ELI sitemap in `robots.txt`. Batch generation with ISR caching.

## Compatibility Requirements

- [x] Existing APIs remain unchanged
- [x] Database schema changes are backward compatible (no schema changes needed — all data already in DB)
- [x] UI changes follow existing patterns (JSON-LD is invisible, no visual changes)
- [x] Performance impact is minimal (JSON-LD is static data in `<head>`, ELI routes are simple redirects, feeds are cached)

## Risk Mitigation

- **Primary Risk:** Malformed JSON-LD could degrade existing SEO structured data recognition
- **Mitigation:** Validate all JSON-LD output with Google Rich Results Test and ELI Validator before deployment. Existing JSON-LD structure is preserved and extended, not replaced. Unit tests cover all document types.
- **Rollback Plan:** Revert the page components to previous JSON-LD. ELI routes and feeds are additive (new routes only) — removing them has zero impact on existing pages.

## Definition of Done

- [x] All stories completed with acceptance criteria met
- [x] Existing functionality verified through testing
- [x] Integration points working correctly
- [x] Documentation updated appropriately
- [x] No regression in existing features
- [x] ELI Validator passes for sample documents of each type
- [x] Google Rich Results Test confirms Legislation rich result eligibility

## References

- [ELI: What is it](https://eur-lex.europa.eu/eli-register/what_is_eli.html)
- [ELI: Implementation Guide](https://eur-lex.europa.eu/eli-register/implementing_eli.html)
- [ELI: Schema.org Integration](https://eur-lex.europa.eu/eli-register/legis_schema_org.html)
- [ELI Validator](https://webgate.ec.europa.eu/eli-validator/)
- [Schema.org: Legislation](https://schema.org/Legislation)
- [Schema.org: LegislationObject](https://schema.org/LegislationObject)
- [ELI Pillar 4 Protocol Specification v1.2](https://eur-lex.europa.eu/content/eli-register/ELI-Pillar-IV-protocol-specification-v1.2.pdf)
