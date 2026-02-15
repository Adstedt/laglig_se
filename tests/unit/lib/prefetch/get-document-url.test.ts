import { describe, it, expect } from 'vitest'
import {
  getDocumentUrl,
  isCourtCase,
  isEuLegislation,
  getCourtCaseContentTypes,
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

  describe('Court Cases', () => {
    it('returns correct URL for COURT_CASE_AD', () => {
      const result = getDocumentUrl({
        contentType: 'COURT_CASE_AD',
        slug: 'ad-2023-45',
      })
      expect(result).toBe('/rattsfall/ad/ad-2023-45')
    })

    it('returns correct URL for COURT_CASE_HD', () => {
      const result = getDocumentUrl({
        contentType: 'COURT_CASE_HD',
        slug: 'nja-2023-123',
      })
      expect(result).toBe('/rattsfall/hd/nja-2023-123')
    })

    it('returns correct URL for COURT_CASE_HFD', () => {
      const result = getDocumentUrl({
        contentType: 'COURT_CASE_HFD',
        slug: 'hfd-2023-ref-1',
      })
      expect(result).toBe('/rattsfall/hfd/hfd-2023-ref-1')
    })

    it('returns correct URL for COURT_CASE_HOVR', () => {
      const result = getDocumentUrl({
        contentType: 'COURT_CASE_HOVR',
        slug: 'hovr-case-123',
      })
      expect(result).toBe('/rattsfall/hovr/hovr-case-123')
    })

    it('returns correct URL for COURT_CASE_MOD', () => {
      const result = getDocumentUrl({
        contentType: 'COURT_CASE_MOD',
        slug: 'mod-2023-1',
      })
      expect(result).toBe('/rattsfall/mod/mod-2023-1')
    })

    it('returns correct URL for COURT_CASE_MIG', () => {
      const result = getDocumentUrl({
        contentType: 'COURT_CASE_MIG',
        slug: 'mig-2023-1',
      })
      expect(result).toBe('/rattsfall/mig/mig-2023-1')
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

describe('isCourtCase', () => {
  it('returns true for court case content types', () => {
    expect(isCourtCase('COURT_CASE_AD')).toBe(true)
    expect(isCourtCase('COURT_CASE_HD')).toBe(true)
    expect(isCourtCase('COURT_CASE_HFD')).toBe(true)
    expect(isCourtCase('COURT_CASE_HOVR')).toBe(true)
    expect(isCourtCase('COURT_CASE_MOD')).toBe(true)
    expect(isCourtCase('COURT_CASE_MIG')).toBe(true)
  })

  it('returns false for non-court case content types', () => {
    expect(isCourtCase('SFS_LAW')).toBe(false)
    expect(isCourtCase('EU_REGULATION')).toBe(false)
    expect(isCourtCase('EU_DIRECTIVE')).toBe(false)
    expect(isCourtCase('UNKNOWN')).toBe(false)
  })
})

describe('isEuLegislation', () => {
  it('returns true for EU content types', () => {
    expect(isEuLegislation('EU_REGULATION')).toBe(true)
    expect(isEuLegislation('EU_DIRECTIVE')).toBe(true)
  })

  it('returns false for non-EU content types', () => {
    expect(isEuLegislation('SFS_LAW')).toBe(false)
    expect(isEuLegislation('COURT_CASE_AD')).toBe(false)
    expect(isEuLegislation('UNKNOWN')).toBe(false)
  })
})

describe('getCourtCaseContentTypes', () => {
  it('returns all court case content types', () => {
    const types = getCourtCaseContentTypes()
    expect(types).toContain('COURT_CASE_AD')
    expect(types).toContain('COURT_CASE_HD')
    expect(types).toContain('COURT_CASE_HFD')
    expect(types).toContain('COURT_CASE_HOVR')
    expect(types).toContain('COURT_CASE_MOD')
    expect(types).toContain('COURT_CASE_MIG')
    expect(types.length).toBe(6)
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
