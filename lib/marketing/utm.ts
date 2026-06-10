/**
 * UTM tagging for marketing-page CTAs (Story 26.1 AC 11).
 *
 * Pure and unit-testable. Every CTA on a marketing page funnels through
 * this so GA4/Vercel can attribute signups to {kind}-{slug} × placement.
 */

export type CtaPlacement = 'hero' | 'mid-page' | 'footer-strip'

export interface UtmContext {
  kind: string
  slug: string
  placement: CtaPlacement
}

/**
 * Appends the marketing UTM set to an internal or absolute href, preserving
 * any params already on it (existing params win — never clobber an
 * explicitly set utm_*).
 */
export function buildUtmUrl(href: string, ctx: UtmContext): string {
  const [pathAndQuery, hash] = splitHash(href)
  const [path, query] = splitQuery(pathAndQuery)

  const params = new URLSearchParams(query)
  const utm: Record<string, string> = {
    utm_source: 'marketing',
    utm_medium: 'organic',
    utm_campaign: `${ctx.kind}-${ctx.slug}`,
    utm_content: ctx.placement,
  }
  for (const [key, value] of Object.entries(utm)) {
    if (!params.has(key)) params.set(key, value)
  }

  return `${path}?${params.toString()}${hash}`
}

function splitHash(href: string): [string, string] {
  const i = href.indexOf('#')
  return i === -1 ? [href, ''] : [href.slice(0, i), href.slice(i)]
}

function splitQuery(href: string): [string, string] {
  const i = href.indexOf('?')
  return i === -1 ? [href, ''] : [href.slice(0, i), href.slice(i + 1)]
}
