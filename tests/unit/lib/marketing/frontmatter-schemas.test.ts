import { describe, it, expect } from 'vitest'
import {
  featurePageSchema,
  industryPageSchema,
  topicPageSchema,
  catalogLawEntrySchema,
} from '@/lib/marketing/frontmatter-schemas'

const validBase = {
  title: 'Lagefterlevnadskontroller',
  description: 'Planera och dokumentera kontroller.',
  heroEyebrow: 'Funktion · Kontroller',
  heroTitle: 'Lagefterlevnad ni kan visa upp',
  heroSubtitle: 'Återkommande kontroller med kravpunkter.',
  primaryCta: { label: 'Testa gratis', href: '/signup' },
  showOrgCheck: true,
  relatedCatalogLaws: [
    { documentNumber: 'SFS 1977:1160', title: 'Arbetsmiljölag' },
  ],
  relatedPages: ['/funktioner/laglista'],
  faq: [
    { question: 'F1?', answer: 'S1.' },
    { question: 'F2?', answer: 'S2.' },
    { question: 'F3?', answer: 'S3.' },
  ],
}

describe('marketing frontmatter schemas', () => {
  it('accepts a fully valid feature page', () => {
    const result = featurePageSchema.safeParse({
      ...validBase,
      kind: 'funktioner',
    })
    expect(result.success).toBe(true)
  })

  it('accepts optional heroMedia and validates its shape', () => {
    const ok = industryPageSchema.safeParse({
      ...validBase,
      kind: 'branscher',
      heroMedia: { type: 'screenshot', src: '/x.webp', alt: 'Skärmbild' },
    })
    expect(ok.success).toBe(true)

    const badType = industryPageSchema.safeParse({
      ...validBase,
      kind: 'branscher',
      heroMedia: { type: 'video', src: '/x.webp', alt: 'x' },
    })
    expect(badType.success).toBe(false)

    const missingAlt = industryPageSchema.safeParse({
      ...validBase,
      kind: 'branscher',
      heroMedia: { type: 'photo', src: '/x.webp' },
    })
    expect(missingAlt.success).toBe(false)
  })

  it.each([
    'title',
    'description',
    'heroEyebrow',
    'heroTitle',
    'heroSubtitle',
    'primaryCta',
    'showOrgCheck',
    'relatedCatalogLaws',
    'relatedPages',
    'faq',
  ])('rejects when required field "%s" is missing', (field) => {
    const data: Record<string, unknown> = {
      ...validBase,
      kind: 'omraden',
    }
    delete data[field]
    const result = topicPageSchema.safeParse(data)
    expect(result.success).toBe(false)
  })

  it('rejects faq with fewer than 3 items', () => {
    const result = featurePageSchema.safeParse({
      ...validBase,
      kind: 'funktioner',
      faq: validBase.faq.slice(0, 2),
    })
    expect(result.success).toBe(false)
  })

  it('rejects description over 170 chars', () => {
    const result = featurePageSchema.safeParse({
      ...validBase,
      kind: 'funktioner',
      description: 'x'.repeat(171),
    })
    expect(result.success).toBe(false)
  })

  it('rejects relatedPages entries that are not internal routes', () => {
    const result = featurePageSchema.safeParse({
      ...validBase,
      kind: 'funktioner',
      relatedPages: ['https://example.com'],
    })
    expect(result.success).toBe(false)
  })

  it('trims whitespace on relatedPages entries (QA-26.4-1)', () => {
    const result = featurePageSchema.safeParse({
      ...validBase,
      kind: 'funktioner',
      relatedPages: ['/funktioner/laglista ', ' /branscher/bygg'],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.relatedPages).toEqual([
        '/funktioner/laglista',
        '/branscher/bygg',
      ])
    }
  })

  it('trims whitespace on catalog law entry fields (QA-26.3-1)', () => {
    const result = catalogLawEntrySchema.safeParse({
      documentNumber: ' SFS 1977:1160 ',
      title: '  Arbetsmiljölagen ',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.documentNumber).toBe('SFS 1977:1160')
      expect(result.data.title).toBe('Arbetsmiljölagen')
    }
  })

  it('rejects whitespace-only documentNumber even after trim', () => {
    expect(
      catalogLawEntrySchema.safeParse({ documentNumber: '   ' }).success
    ).toBe(false)
  })

  it('requires documentNumber or slug on catalog law entries', () => {
    expect(
      catalogLawEntrySchema.safeParse({ title: 'Utan referens' }).success
    ).toBe(false)
    expect(
      catalogLawEntrySchema.safeParse({ slug: 'afs-2023-12' }).success
    ).toBe(true)
    expect(
      catalogLawEntrySchema.safeParse({ documentNumber: 'AFS 2023:12' }).success
    ).toBe(true)
  })

  it('rejects a wrong kind literal', () => {
    const result = featurePageSchema.safeParse({
      ...validBase,
      kind: 'branscher',
    })
    expect(result.success).toBe(false)
  })
})
