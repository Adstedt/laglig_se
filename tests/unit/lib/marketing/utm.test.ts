import { describe, it, expect } from 'vitest'
import { buildUtmUrl } from '@/lib/marketing/utm'

const ctx = {
  kind: 'branscher',
  slug: 'bygg',
  placement: 'hero' as const,
}

describe('buildUtmUrl', () => {
  it('appends the full UTM set to a bare path', () => {
    const url = buildUtmUrl('/signup', ctx)
    const params = new URLSearchParams(url.split('?')[1])
    expect(url.startsWith('/signup?')).toBe(true)
    expect(params.get('utm_source')).toBe('marketing')
    expect(params.get('utm_medium')).toBe('organic')
    expect(params.get('utm_campaign')).toBe('branscher-bygg')
    expect(params.get('utm_content')).toBe('hero')
  })

  it('preserves existing query params', () => {
    const url = buildUtmUrl('/signup?org=556677-8899', ctx)
    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('org')).toBe('556677-8899')
    expect(params.get('utm_campaign')).toBe('branscher-bygg')
  })

  it('never clobbers an explicitly set utm param', () => {
    const url = buildUtmUrl('/signup?utm_source=partner', ctx)
    const params = new URLSearchParams(url.split('?')[1])
    expect(params.get('utm_source')).toBe('partner')
    expect(params.get('utm_medium')).toBe('organic')
  })

  it('keeps hash fragments at the end', () => {
    const url = buildUtmUrl('/funktioner/laglista#priser', {
      ...ctx,
      placement: 'mid-page',
    })
    expect(url.endsWith('#priser')).toBe(true)
    expect(url).toContain('utm_content=mid-page')
    expect(url.indexOf('#')).toBeGreaterThan(url.indexOf('?'))
  })
})
