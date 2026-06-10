import { describe, it, expect } from 'vitest'
import { ContentType } from '@prisma/client'
import { getPublicUrlPath } from '@/lib/catalog/public-url'

/**
 * Pins the ContentType → public URL mapping that BOTH the sitemap generator
 * and the marketing catalog-link resolver rely on (Story 26.3 AC 1–2, 12).
 */
describe('getPublicUrlPath', () => {
  it.each([
    [ContentType.SFS_LAW, '/lagar/arbetsmiljolag-1977-1160'],
    [ContentType.SFS_AMENDMENT, '/lagar/andringar/arbetsmiljolag-1977-1160'],
    [ContentType.AGENCY_REGULATION, '/foreskrifter/arbetsmiljolag-1977-1160'],
    [ContentType.EU_REGULATION, '/eu/forordningar/arbetsmiljolag-1977-1160'],
    [ContentType.EU_DIRECTIVE, '/eu/direktiv/arbetsmiljolag-1977-1160'],
  ])('%s → %s', (contentType, expected) => {
    expect(getPublicUrlPath(contentType, 'arbetsmiljolag-1977-1160')).toBe(
      expected
    )
  })

  it.each([
    ContentType.COURT_CASE_AD,
    ContentType.COURT_CASE_HD,
    ContentType.COURT_CASE_HOVR,
    ContentType.COURT_CASE_HFD,
    ContentType.COURT_CASE_MOD,
    ContentType.COURT_CASE_MIG,
  ])('court case %s has no public page → null', (contentType) => {
    expect(getPublicUrlPath(contentType, 'nja-2023-s-45')).toBeNull()
  })

  it('covers every ContentType (no silent fall-through for new types)', () => {
    // The `_exhaustive: never` arm enforces this at compile time; this
    // runtime sweep documents the behavior for every current member.
    for (const ct of Object.values(ContentType)) {
      expect(() => getPublicUrlPath(ct, 'x')).not.toThrow()
    }
  })
})
