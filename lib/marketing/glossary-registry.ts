import { listGlossarySlugs, getGlossaryTerm } from './glossary'

/**
 * Glossary term registry (Story 26.11) — the single source of truth for the
 * /ordbok index, and the anti-cannibalization spine.
 *
 * ONE indexable page per term. The index lists every term A–Ö but ROUTES each
 * to its single canonical page:
 *   - `canonical` pointing at /omraden/* or /funktioner/*  → the deep page
 *     already owns that term; we never build a competing /ordbok/[slug].
 *   - `canonical` pointing at /ordbok/*  → a genuine glossary term with no
 *     deep page; the ordbok page is canonical.
 *
 * `blurb` is required for external (route-only) canonicals — there's no ordbok
 * page to pull a shortDefinition from. Entries whose canonical is an /ordbok
 * page take their listing text from the built page's `shortDefinition`, so the
 * definition lives in exactly one place.
 *
 * The index only renders entries whose destination is LIVE (deep page assumed
 * live — all verified 2026-07-05; ordbok page must actually be built), so the
 * roster below can list terms whose pages aren't written yet — they surface as
 * each page lands.
 */

export interface GlossaryRegistryEntry {
  term: string
  slug: string
  category: string
  canonical: string
  /** Required for route-only (deep-page) entries; ignored for /ordbok entries. */
  blurb?: string
}

export const GLOSSARY_REGISTRY: GlossaryRegistryEntry[] = [
  // ── Route-only: a deep page already owns the term (blurb required) ─────────
  {
    term: 'AFS',
    slug: 'afs',
    category: 'Arbetsmiljö',
    canonical: '/omraden/afs',
    blurb:
      'Arbetsmiljöverkets författningssamling — myndighetens bindande föreskrifter om arbetsmiljö.',
  },
  {
    term: 'CE-märkning',
    slug: 'ce-markning',
    category: 'Produkt & bygg',
    canonical: '/omraden/ce-markning',
    blurb:
      'Tillverkarens försäkran att en produkt uppfyller EU:s krav — inte en kvalitetsstämpel.',
  },
  {
    term: 'CSRD',
    slug: 'csrd',
    category: 'Hållbarhet',
    canonical: '/omraden/csrd',
    blurb: 'EU-direktivet om företagens hållbarhetsrapportering.',
  },
  {
    term: 'Efterlevnadskontroll',
    slug: 'efterlevnadskontroll',
    category: 'Lagefterlevnad',
    canonical: '/funktioner/kontroller',
    blurb: 'Återkommande kontroll av att lagkraven i laglistan efterlevs.',
  },
  {
    term: 'Egenkontroll',
    slug: 'egenkontroll',
    category: 'Miljö',
    canonical: '/omraden/egenkontroll',
    blurb:
      'Verksamhetens eget, fortlöpande arbete med att kontrollera att kraven följs.',
  },
  {
    term: 'ESG',
    slug: 'esg',
    category: 'Hållbarhet',
    canonical: '/omraden/esg',
    blurb:
      'Environmental, Social, Governance — ramverket för hållbarhetsstyrning.',
  },
  {
    term: 'GDPR',
    slug: 'gdpr',
    category: 'Dataskydd & IT',
    canonical: '/omraden/gdpr',
    blurb: 'EU:s dataskyddsförordning om behandling av personuppgifter.',
  },
  {
    term: 'Internrevision',
    slug: 'internrevision',
    category: 'Ledningssystem',
    canonical: '/omraden/internrevision',
    blurb: 'Organisationens egen, oberoende granskning av sitt ledningssystem.',
  },
  {
    term: 'ISO 9001',
    slug: 'iso-9001',
    category: 'Ledningssystem',
    canonical: '/omraden/iso-9001',
    blurb: 'Standarden för kvalitetsledningssystem.',
  },
  {
    term: 'ISO 14001',
    slug: 'iso-14001',
    category: 'Ledningssystem',
    canonical: '/omraden/iso-14001',
    blurb: 'Standarden för miljöledningssystem.',
  },
  {
    term: 'ISO 45001',
    slug: 'iso-45001',
    category: 'Ledningssystem',
    canonical: '/omraden/iso-45001',
    blurb: 'Standarden för arbetsmiljöledningssystem.',
  },
  {
    term: 'Kravpunkt',
    slug: 'kravpunkt',
    category: 'Lagefterlevnad',
    canonical: '/funktioner/kravpunkter',
    blurb:
      'Ett enskilt lagkrav nedbrutet till en kontrollerbar punkt med ansvarig och status.',
  },
  {
    term: 'Lagefterlevnad',
    slug: 'lagefterlevnad',
    category: 'Lagefterlevnad',
    canonical: '/omraden/lagefterlevnad',
    blurb:
      'Att identifiera, uppfylla och kunna visa att verksamheten följer sina lagkrav.',
  },
  {
    term: 'Lagrevision',
    slug: 'lagrevision',
    category: 'Ledningssystem',
    canonical: '/omraden/lagrevision',
    blurb:
      'Systematisk genomgång av att laglistan är aktuell och att kraven efterlevs.',
  },
  {
    term: 'Ledningssystem',
    slug: 'ledningssystem',
    category: 'Ledningssystem',
    canonical: '/omraden/ledningssystem',
    blurb:
      'Ett systematiskt arbetssätt för att styra verksamheten mot krav och mål.',
  },
  {
    term: 'Miljöbalken',
    slug: 'miljobalken',
    category: 'Miljö',
    canonical: '/omraden/miljobalken',
    blurb: 'Sveriges ramlag för miljöarbete (SFS 1998:808).',
  },
  {
    term: 'NIS2',
    slug: 'nis2',
    category: 'Dataskydd & IT',
    canonical: '/omraden/nis2',
    blurb: 'EU-direktivet om cybersäkerhet för samhällsviktiga verksamheter.',
  },
  {
    term: 'OVK',
    slug: 'ovk',
    category: 'Bygg & fastighet',
    canonical: '/omraden/ovk',
    blurb:
      'Obligatorisk ventilationskontroll av byggnaders ventilationssystem.',
  },
  {
    term: 'Penningtvätt',
    slug: 'penningtvatt',
    category: 'Finans & efterlevnad',
    canonical: '/omraden/penningtvatt',
    blurb: 'Regelverket mot penningtvätt och finansiering av terrorism.',
  },
  {
    term: 'REACH',
    slug: 'reach',
    category: 'Miljö',
    canonical: '/omraden/reach',
    blurb:
      'EU:s kemikalieförordning om registrering och begränsning av kemiska ämnen.',
  },
  {
    term: 'Riskbedömning',
    slug: 'riskbedomning',
    category: 'Arbetsmiljö',
    canonical: '/omraden/riskbedomning',
    blurb:
      'Systematisk bedömning av risker för ohälsa och olycksfall i verksamheten.',
  },
  {
    term: 'SAM',
    slug: 'sam',
    category: 'Arbetsmiljö',
    canonical: '/omraden/sam',
    blurb: 'Systematiskt arbetsmiljöarbete enligt AFS 2023:1.',
  },
  {
    term: 'SBA',
    slug: 'sba',
    category: 'Säkerhet & brandskydd',
    canonical: '/omraden/sba',
    blurb: 'Systematiskt brandskyddsarbete.',
  },
  {
    term: 'Styrdokument',
    slug: 'styrdokument',
    category: 'Lagefterlevnad',
    canonical: '/funktioner/styrdokument',
    blurb:
      'Policyer och rutiner som styr hur verksamheten uppfyller sina krav.',
  },
  {
    term: 'Visselblåsarlagen',
    slug: 'visselblasarlagen',
    category: 'Arbetsrätt',
    canonical: '/omraden/visselblasarlagen',
    blurb: 'Lagen om skydd för personer som rapporterar missförhållanden.',
  },

  // ── Build: genuine glossary terms, no deep page (blurb from the page) ──────
  {
    term: 'Laglista',
    slug: 'laglista',
    category: 'Lagefterlevnad',
    canonical: '/ordbok/laglista',
  },
  {
    term: 'Rättskälla',
    slug: 'rattskalla',
    category: 'Rättskällor & lagstiftning',
    canonical: '/ordbok/rattskalla',
  },
  {
    term: 'Författningssamling',
    slug: 'forfattningssamling',
    category: 'Rättskällor & lagstiftning',
    canonical: '/ordbok/forfattningssamling',
  },
  {
    term: 'Förordning',
    slug: 'forordning',
    category: 'Rättskällor & lagstiftning',
    canonical: '/ordbok/forordning',
  },
  {
    term: 'Föreskrift',
    slug: 'foreskrift',
    category: 'Rättskällor & lagstiftning',
    canonical: '/ordbok/foreskrift',
  },
  {
    term: 'Direktiv',
    slug: 'direktiv',
    category: 'Rättskällor & lagstiftning',
    canonical: '/ordbok/direktiv',
  },
  {
    term: 'Ramlag',
    slug: 'ramlag',
    category: 'Rättskällor & lagstiftning',
    canonical: '/ordbok/ramlag',
  },
  {
    term: 'Bemyndigande',
    slug: 'bemyndigande',
    category: 'Rättskällor & lagstiftning',
    canonical: '/ordbok/bemyndigande',
  },
  {
    term: 'Proposition',
    slug: 'proposition',
    category: 'Rättskällor & lagstiftning',
    canonical: '/ordbok/proposition',
  },
  {
    term: 'Förarbeten',
    slug: 'forarbeten',
    category: 'Rättskällor & lagstiftning',
    canonical: '/ordbok/forarbeten',
  },
  {
    term: 'Prejudikat',
    slug: 'prejudikat',
    category: 'Rättskällor & lagstiftning',
    canonical: '/ordbok/prejudikat',
  },
  {
    term: 'Praxis',
    slug: 'praxis',
    category: 'Rättskällor & lagstiftning',
    canonical: '/ordbok/praxis',
  },
  {
    term: 'Dispositiv lag',
    slug: 'dispositiv-lag',
    category: 'Rättskällor & lagstiftning',
    canonical: '/ordbok/dispositiv-lag',
  },
  {
    term: 'Tillsyn',
    slug: 'tillsyn',
    category: 'Tillsyn & sanktioner',
    canonical: '/ordbok/tillsyn',
  },
  {
    term: 'Sanktionsavgift',
    slug: 'sanktionsavgift',
    category: 'Tillsyn & sanktioner',
    canonical: '/ordbok/sanktionsavgift',
  },
  {
    term: 'Vite',
    slug: 'vite',
    category: 'Tillsyn & sanktioner',
    canonical: '/ordbok/vite',
  },
  {
    term: 'Föreläggande',
    slug: 'forelaggande',
    category: 'Tillsyn & sanktioner',
    canonical: '/ordbok/forelaggande',
  },
  {
    term: 'Anmälningsplikt',
    slug: 'anmalningsplikt',
    category: 'Tillsyn & sanktioner',
    canonical: '/ordbok/anmalningsplikt',
  },
  {
    term: 'Avvikelse',
    slug: 'avvikelse',
    category: 'Ledningssystem',
    canonical: '/ordbok/avvikelse',
  },
  {
    term: 'Bindande krav',
    slug: 'bindande-krav',
    category: 'Lagefterlevnad',
    canonical: '/ordbok/bindande-krav',
  },
  {
    term: 'Lagbevakning',
    slug: 'lagbevakning',
    category: 'Lagefterlevnad',
    canonical: '/ordbok/lagbevakning',
  },
  {
    term: 'Revisionsrapport',
    slug: 'revisionsrapport',
    category: 'Ledningssystem',
    canonical: '/ordbok/revisionsrapport',
  },
  {
    term: 'PDCA',
    slug: 'pdca',
    category: 'Ledningssystem',
    canonical: '/ordbok/pdca',
  },
  {
    term: 'Väsentlighetsanalys',
    slug: 'vasentlighetsanalys',
    category: 'Hållbarhet',
    canonical: '/ordbok/vasentlighetsanalys',
  },
  {
    term: 'Verklig huvudman',
    slug: 'verklig-huvudman',
    category: 'Finans & efterlevnad',
    canonical: '/ordbok/verklig-huvudman',
  },
  {
    term: 'Kundkännedom',
    slug: 'kundkannedom',
    category: 'Finans & efterlevnad',
    canonical: '/ordbok/kundkannedom',
  },
  {
    term: 'Due diligence',
    slug: 'due-diligence',
    category: 'Finans & efterlevnad',
    canonical: '/ordbok/due-diligence',
  },
]

export interface GlossaryIndexEntry {
  term: string
  slug: string
  category: string
  canonical: string
  blurb: string
  /** true when the term routes to its own /ordbok page (vs a deep page). */
  isOwnPage: boolean
}

/**
 * The live, listable terms for the /ordbok index. A term is listable when its
 * destination exists: deep-page canonicals are assumed live (verified); ordbok
 * canonicals must have a built MDX file. Ordbok entries take their blurb from
 * the built page's `shortDefinition` (single source of truth for the def).
 */
export function getGlossaryIndexEntries(): GlossaryIndexEntry[] {
  const built = new Set(listGlossarySlugs())
  const out: GlossaryIndexEntry[] = []
  for (const e of GLOSSARY_REGISTRY) {
    const isOwnPage = e.canonical.startsWith('/ordbok/')
    if (isOwnPage) {
      if (!built.has(e.slug)) continue // page not written yet — surfaces when it lands
      const page = getGlossaryTerm(e.slug)
      if (!page) continue
      out.push({
        term: e.term,
        slug: e.slug,
        category: e.category,
        canonical: e.canonical,
        blurb: page.frontmatter.shortDefinition,
        isOwnPage: true,
      })
    } else {
      out.push({
        term: e.term,
        slug: e.slug,
        category: e.category,
        canonical: e.canonical,
        blurb: e.blurb ?? '',
        isOwnPage: false,
      })
    }
  }
  return out
}
