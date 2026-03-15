import { describe, it, expect } from 'vitest'
import {
  getDocumentUrl,
  isEuLegislation,
  getEuContentTypes,
} from '@/lib/prefetch/get-document-url'

describe('getDocumentUrl', () => {
  describe('SFS Laws', () => {
    it('returns correct URL for SFS_LAW', () => {
      const result = getDocumentUrl({
        contentType: 'SFS_LAW',
        slug: 'arbetsmiljolag-1977-1160',
      })
      expect(result).toBe('/lagar/arbetsmiljolag-1977-1160')
    })
  })

  describe('SFS Amendments', () => {
    it('returns correct URL for SFS_AMENDMENT', () => {
      const result = getDocumentUrl({
        contentType: 'SFS_AMENDMENT',
        slug: 'sfs-2025-732',
      })
      expect(result).toBe('/lagar/andringar/sfs-2025-732')
    })
  })

  describe('Agency Regulations', () => {
    it('returns correct URL for AGENCY_REGULATION', () => {
      const result = getDocumentUrl({
        contentType: 'AGENCY_REGULATION',
        slug: 'afs-2001-1',
      })
      expect(result).toBe('/foreskrifter/afs-2001-1')
    })
  })

  describe('EU Legislation', () => {
    it('returns correct URL for EU_REGULATION', () => {
      const result = getDocumentUrl({
        contentType: 'EU_REGULATION',
        slug: '32016R0679',
      })
      expect(result).toBe('/eu/forordningar/32016R0679')
    })

    it('returns correct URL for EU_DIRECTIVE', () => {
      const result = getDocumentUrl({
        contentType: 'EU_DIRECTIVE',
        slug: '32016L0680',
      })
      expect(result).toBe('/eu/direktiv/32016L0680')
    })
  })

  describe('Fallback', () => {
    it('returns fallback URL for unknown content type', () => {
      const result = getDocumentUrl({
        contentType: 'UNKNOWN_TYPE',
        slug: 'some-document',
      })
      expect(result).toBe('/dokument/some-document')
    })
  })
})

describe('isEuLegislation', () => {
  it('returns true for EU content types', () => {
    expect(isEuLegislation('EU_REGULATION')).toBe(true)
    expect(isEuLegislation('EU_DIRECTIVE')).toBe(true)
  })

  it('returns false for non-EU content types', () => {
    expect(isEuLegislation('SFS_LAW')).toBe(false)
    expect(isEuLegislation('UNKNOWN')).toBe(false)
  })
})

describe('getEuContentTypes', () => {
  it('returns all EU content types', () => {
    const types = getEuContentTypes()
    expect(types).toContain('EU_REGULATION')
    expect(types).toContain('EU_DIRECTIVE')
    expect(types.length).toBe(2)
  })
})
