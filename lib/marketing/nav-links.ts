/**
 * Canonical marketing-nav route data (Story 26.2).
 *
 * CLIENT-SAFE: no node:fs, no React — importable from NavbarV3/FooterV3
 * (client components) and from tests. Icons stay in the client components
 * (lucide components aren't serializable data).
 *
 * Published-state detection lives server-side: getPublishedMarketingRoutes()
 * in lib/marketing/content.ts walks the MDX folders and the result is passed
 * into the chrome as a plain string[] prop. A page shipping in 26.4–26.8
 * flips its nav item live with ZERO changes here.
 */

export interface MarketingNavItem {
  label: string
  /** canonical route — slugs must match content/marketing file names exactly */
  route: string
  desc?: string
  /** homepage section that covers this item until its page ships (root-relative) */
  anchorFallback?: string
}

export const FUNKTIONER_NAV: MarketingNavItem[] = [
  {
    label: 'Laglista',
    route: '/funktioner/laglista',
    desc: 'Lagar & krav samlat',
    anchorFallback: '/#how-it-works',
  },
  {
    label: 'Kravpunkter',
    route: '/funktioner/kravpunkter',
    desc: 'Krav ur varje lag',
    anchorFallback: '/#how-it-works',
  },
  {
    label: 'Lagändringar',
    route: '/funktioner/lagandringar',
    desc: 'AI bedömer ändringar',
    anchorFallback: '/#how-it-works',
  },
  {
    label: 'Uppgifter',
    route: '/funktioner/uppgifter',
    desc: 'Åtgärder med ansvar',
    anchorFallback: '/#how-it-works',
  },
  {
    label: 'Styrdokument',
    route: '/funktioner/styrdokument',
    desc: 'Policyer mot lagkrav',
    anchorFallback: '/#how-it-works',
  },
  {
    label: 'Kontroll',
    route: '/funktioner/kontroller',
    desc: 'Bevisa efterlevnad',
    anchorFallback: '/#how-it-works',
  },
  {
    label: 'AI-agenten',
    route: '/funktioner/ai-agent',
    desc: 'Gör jobbet, ni godkänner',
    anchorFallback: '/#ai',
  },
]

export const BRANSCHER_NAV: MarketingNavItem[] = [
  {
    label: 'Restaurang & hotell',
    route: '/branscher/hotell-restaurang',
    desc: 'Livsmedel, alkohol, brand',
  },
  {
    label: 'Bygg & anläggning',
    route: '/branscher/bygg',
    desc: 'AFS, PBL, personalliggare',
  },
  {
    label: 'Vård & omsorg',
    route: '/branscher/vard-omsorg',
    desc: 'Patientsäkerhet & miljö',
  },
  {
    label: 'Industri & tillverkning',
    route: '/branscher/industri',
    desc: 'Kemikalier & maskiner',
  },
  {
    label: 'Transport & logistik',
    route: '/branscher/transport',
    desc: 'Kör- och vilotider',
  },
  {
    label: 'IT & tech',
    route: '/branscher/it',
    desc: 'GDPR, NIS2, datasäkerhet',
  },
  {
    label: 'Fastighet',
    route: '/branscher/fastighet',
    desc: 'OVK, energi, brandskydd',
  },
]

export const OMRADEN_NAV: MarketingNavItem[] = [
  {
    label: 'GDPR & dataskydd',
    route: '/omraden/gdpr',
    desc: 'Personuppgifter & avtal',
  },
  { label: 'NIS2', route: '/omraden/nis2', desc: 'Cybersäkerhet, NIS2' },
  {
    label: 'Arbetsmiljö',
    route: '/omraden/arbetsmiljo',
    desc: 'Systematiskt SAM-arbete',
  },
  {
    label: 'Brandskydd',
    route: '/omraden/brandskydd',
    desc: 'SBA & skydd mot olyckor',
  },
  { label: 'Miljö', route: '/omraden/miljo', desc: 'Miljöbalken & avfall' },
  {
    label: 'Visselblåsarlagen',
    route: '/omraden/visselblasarlagen',
    desc: 'Rapportering & skydd',
  },
  {
    label: 'Penningtvätt',
    route: '/omraden/penningtvatt',
    desc: 'Kundkännedom & rapport',
  },
  {
    label: 'ISO 14001',
    route: '/omraden/iso-14001',
    desc: 'Miljöledning & lag',
  },
]

export type ResolvedNavHref =
  | { type: 'route'; href: string }
  | { type: 'anchor'; href: string }
  | { type: 'coming-soon' }

/**
 * Resolve a nav item against the published-route list:
 *  - published → real route (next/link, prefetch)
 *  - unpublished with a homepage-anchor fallback → root-relative anchor
 *    (works from any page; current homepage behavior preserved)
 *  - unpublished without fallback → "Kommer snart" (non-interactive)
 */
export function resolveNavHref(
  item: MarketingNavItem,
  publishedRoutes: readonly string[]
): ResolvedNavHref {
  if (publishedRoutes.includes(item.route)) {
    return { type: 'route', href: item.route }
  }
  if (item.anchorFallback) {
    return { type: 'anchor', href: item.anchorFallback }
  }
  return { type: 'coming-soon' }
}
