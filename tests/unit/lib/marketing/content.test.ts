import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(import('node:fs'), async (importOriginal) => {
  const actual = await importOriginal()
  const mocked = {
    readdirSync: vi.fn(),
    readFileSync: vi.fn(),
    existsSync: vi.fn(),
  }
  // node builtins are CJS — the ESM interop reads named imports off
  // `default`, so the mock must override both surfaces.
  return { ...actual, ...mocked, default: { ...actual, ...mocked } }
})

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { getMarketingPage, listMarketingSlugs } from '@/lib/marketing/content'

const VALID_MDX = `---
title: 'Laglista för bygg'
description: 'Beskrivning.'
heroEyebrow: 'Bransch · Bygg'
heroTitle: 'Rubrik'
heroSubtitle: 'Underrubrik'
primaryCta:
  label: 'Testa gratis'
  href: '/signup'
showOrgCheck: true
relatedCatalogLaws:
  - documentNumber: 'SFS 1977:1160'
relatedPages: []
faq:
  - question: 'F1?'
    answer: 'S1.'
  - question: 'F2?'
    answer: 'S2.'
  - question: 'F3?'
    answer: 'S3.'
---

Brödtext.
`

beforeEach(() => {
  vi.mocked(existsSync).mockReturnValue(true)
  vi.mocked(readFileSync).mockReturnValue(VALID_MDX)
  vi.mocked(readdirSync).mockReturnValue([
    'bygg.mdx',
    '_template.mdx',
    '_draft-hotell.mdx',
    'it.mdx',
    'notes.txt',
  ] as unknown as ReturnType<typeof readdirSync>)
})

describe('listMarketingSlugs', () => {
  it('lists published .mdx slugs, excluding underscore-prefixed files', () => {
    expect(listMarketingSlugs('branscher')).toEqual(['bygg', 'it'])
  })

  it('returns empty when the kind folder does not exist', () => {
    vi.mocked(existsSync).mockReturnValue(false)
    expect(listMarketingSlugs('branscher')).toEqual([])
  })
})

describe('getMarketingPage', () => {
  it('parses + validates frontmatter and returns typed meta', () => {
    const page = getMarketingPage('branscher', 'bygg')
    expect(page).not.toBeNull()
    expect(page?.frontmatter.title).toBe('Laglista för bygg')
    expect(page?.frontmatter.kind).toBe('branscher')
    expect(page?.slug).toBe('bygg')
  })

  it('refuses underscore-prefixed and malformed slugs', () => {
    expect(getMarketingPage('branscher', '_template')).toBeNull()
    expect(getMarketingPage('branscher', '../etc')).toBeNull()
    expect(getMarketingPage('branscher', 'Bygg')).toBeNull()
  })

  it('returns null for a missing file', () => {
    vi.mocked(existsSync).mockReturnValue(false)
    expect(getMarketingPage('branscher', 'bygg')).toBeNull()
  })

  it('throws naming file + field on invalid frontmatter (fails the build)', () => {
    vi.mocked(readFileSync).mockReturnValue(
      VALID_MDX.replace("title: 'Laglista för bygg'\n", '')
    )
    expect(() => getMarketingPage('branscher', 'bygg')).toThrowError(
      /content\/marketing\/branscher\/bygg\.mdx.*title/s
    )
  })

  it('throws when faq has fewer than 3 items', () => {
    vi.mocked(readFileSync).mockReturnValue(
      VALID_MDX.replace(/  - question: 'F3\?'\n    answer: 'S3\.'\n/, '')
    )
    expect(() => getMarketingPage('branscher', 'bygg')).toThrowError(/faq/)
  })
})
