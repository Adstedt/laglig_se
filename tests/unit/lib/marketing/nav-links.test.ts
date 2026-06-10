import { describe, it, expect } from 'vitest'
import {
  FUNKTIONER_NAV,
  BRANSCHER_NAV,
  OMRADEN_NAV,
  resolveNavHref,
} from '@/lib/marketing/nav-links'

/**
 * Slug exactness — the #1 risk in Story 26.2. These lists must match the
 * epic's canonical routes VERBATIM: a typo here 404-poisons the funnel and
 * every internal link. Update only together with the epic.
 */
describe('canonical route lists (Epic 26 v0.4)', () => {
  it('branscher: exactly the 7 Tier-1 industry routes', () => {
    expect(BRANSCHER_NAV.map((i) => i.route).sort()).toEqual(
      [
        '/branscher/hotell-restaurang',
        '/branscher/bygg',
        '/branscher/vard-omsorg',
        '/branscher/industri',
        '/branscher/transport',
        '/branscher/it',
        '/branscher/fastighet',
      ].sort()
    )
  })

  it('omraden: exactly the 8 Tier-2 topic routes', () => {
    expect(OMRADEN_NAV.map((i) => i.route).sort()).toEqual(
      [
        '/omraden/gdpr',
        '/omraden/nis2',
        '/omraden/arbetsmiljo',
        '/omraden/brandskydd',
        '/omraden/miljo',
        '/omraden/visselblasarlagen',
        '/omraden/penningtvatt',
        '/omraden/iso-14001',
      ].sort()
    )
  })

  it('funktioner: exactly the 7 feature routes', () => {
    expect(FUNKTIONER_NAV.map((i) => i.route).sort()).toEqual(
      [
        '/funktioner/kontroller',
        '/funktioner/ai-agent',
        '/funktioner/laglista',
        '/funktioner/kravpunkter',
        '/funktioner/lagandringar',
        '/funktioner/uppgifter',
        '/funktioner/styrdokument',
      ].sort()
    )
  })

  it('no ASCII-unsafe characters in any route (å/ä/ö typo guard)', () => {
    for (const item of [...FUNKTIONER_NAV, ...BRANSCHER_NAV, ...OMRADEN_NAV]) {
      expect(item.route).toMatch(
        /^\/(funktioner|branscher|omraden)\/[a-z0-9-]+$/
      )
    }
  })

  it('every funktioner item has a homepage-anchor fallback; branscher/omraden have none', () => {
    for (const item of FUNKTIONER_NAV) {
      expect(item.anchorFallback).toMatch(/^\/#/)
    }
    for (const item of [...BRANSCHER_NAV, ...OMRADEN_NAV]) {
      expect(item.anchorFallback).toBeUndefined()
    }
  })

  it('"Handel & e-handel" is not present (decision: dropped, no page planned)', () => {
    expect(BRANSCHER_NAV.map((i) => i.label)).not.toContain('Handel & e-handel')
  })
})

describe('resolveNavHref', () => {
  const bygg = BRANSCHER_NAV.find((i) => i.route === '/branscher/bygg')!
  const laglista = FUNKTIONER_NAV.find(
    (i) => i.route === '/funktioner/laglista'
  )!

  it('published route → route link', () => {
    expect(resolveNavHref(bygg, ['/branscher/bygg'])).toEqual({
      type: 'route',
      href: '/branscher/bygg',
    })
  })

  it('unpublished with fallback → root-relative anchor', () => {
    expect(resolveNavHref(laglista, [])).toEqual({
      type: 'anchor',
      href: '/#how-it-works',
    })
  })

  it('published wins over fallback', () => {
    expect(resolveNavHref(laglista, ['/funktioner/laglista'])).toEqual({
      type: 'route',
      href: '/funktioner/laglista',
    })
  })

  it('unpublished without fallback → coming-soon', () => {
    expect(resolveNavHref(bygg, ['/branscher/it'])).toEqual({
      type: 'coming-soon',
    })
  })
})
