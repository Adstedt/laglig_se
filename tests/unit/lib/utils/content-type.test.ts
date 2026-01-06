/**
 * Story 4.11: Unit Tests for Content Type Utilities
 */

import { describe, it, expect } from 'vitest'
import {
  getContentTypeLabel,
  getContentTypeFullLabel,
  getContentTypeBadgeColor,
  getContentTypeIcon,
  isCourtCase,
  isEuDocument,
  isSfsDocument,
  groupContentTypes,
  getContentTypesForGroup,
  getGroupForContentType,
  getDocumentUrl,
  CONTENT_TYPE_GROUPS,
  ALL_CONTENT_TYPES,
} from '@/lib/utils/content-type'
import { Scale, Gavel, Globe } from 'lucide-react'

describe('Content Type Utilities', () => {
  describe('getContentTypeLabel', () => {
    it('returns correct Swedish labels', () => {
      expect(getContentTypeLabel('SFS_LAW')).toBe('Lag')
      expect(getContentTypeLabel('SFS_AMENDMENT')).toBe('Ändring')
      expect(getContentTypeLabel('COURT_CASE_HD')).toBe('HD')
      expect(getContentTypeLabel('EU_REGULATION')).toBe('EU-förordning')
      expect(getContentTypeLabel('EU_DIRECTIVE')).toBe('EU-direktiv')
    })
  })

  describe('getContentTypeFullLabel', () => {
    it('returns correct full Swedish labels', () => {
      expect(getContentTypeFullLabel('SFS_LAW')).toBe('Lag')
      expect(getContentTypeFullLabel('SFS_AMENDMENT')).toBe('Ändringsförfattning')
      expect(getContentTypeFullLabel('COURT_CASE_HD')).toBe('Högsta domstolen')
      expect(getContentTypeFullLabel('COURT_CASE_AD')).toBe('Arbetsdomstolen')
    })
  })

  describe('getContentTypeBadgeColor', () => {
    it('returns color classes for each type', () => {
      const lawColor = getContentTypeBadgeColor('SFS_LAW')
      expect(lawColor).toContain('bg-blue')

      const courtColor = getContentTypeBadgeColor('COURT_CASE_HD')
      expect(courtColor).toContain('bg-purple')

      const euColor = getContentTypeBadgeColor('EU_REGULATION')
      expect(euColor).toContain('bg-green')
    })
  })

  describe('getContentTypeIcon', () => {
    it('returns correct icons', () => {
      expect(getContentTypeIcon('SFS_LAW')).toBe(Scale)
      expect(getContentTypeIcon('COURT_CASE_HD')).toBe(Gavel)
      expect(getContentTypeIcon('EU_REGULATION')).toBe(Globe)
    })
  })

  describe('Type checks', () => {
    describe('isCourtCase', () => {
      it('returns true for court case types', () => {
        expect(isCourtCase('COURT_CASE_HD')).toBe(true)
        expect(isCourtCase('COURT_CASE_AD')).toBe(true)
        expect(isCourtCase('COURT_CASE_HFD')).toBe(true)
        expect(isCourtCase('COURT_CASE_HOVR')).toBe(true)
        expect(isCourtCase('COURT_CASE_MOD')).toBe(true)
        expect(isCourtCase('COURT_CASE_MIG')).toBe(true)
      })

      it('returns false for non-court-case types', () => {
        expect(isCourtCase('SFS_LAW')).toBe(false)
        expect(isCourtCase('EU_REGULATION')).toBe(false)
      })
    })

    describe('isEuDocument', () => {
      it('returns true for EU document types', () => {
        expect(isEuDocument('EU_REGULATION')).toBe(true)
        expect(isEuDocument('EU_DIRECTIVE')).toBe(true)
      })

      it('returns false for non-EU types', () => {
        expect(isEuDocument('SFS_LAW')).toBe(false)
        expect(isEuDocument('COURT_CASE_HD')).toBe(false)
      })
    })

    describe('isSfsDocument', () => {
      it('returns true for SFS document types', () => {
        expect(isSfsDocument('SFS_LAW')).toBe(true)
        expect(isSfsDocument('SFS_AMENDMENT')).toBe(true)
      })

      it('returns false for non-SFS types', () => {
        expect(isSfsDocument('COURT_CASE_HD')).toBe(false)
        expect(isSfsDocument('EU_REGULATION')).toBe(false)
      })
    })
  })

  describe('Grouping', () => {
    describe('CONTENT_TYPE_GROUPS', () => {
      it('has all expected groups', () => {
        expect(CONTENT_TYPE_GROUPS).toHaveLength(4)
        expect(CONTENT_TYPE_GROUPS.map((g) => g.id)).toEqual([
          'laws',
          'amendments',
          'courtCases',
          'euDocuments',
        ])
      })
    })

    describe('groupContentTypes', () => {
      it('returns matching groups', () => {
        const groups = groupContentTypes(['SFS_LAW', 'COURT_CASE_HD'])
        expect(groups).toHaveLength(2)
        expect(groups.map((g) => g.id)).toContain('laws')
        expect(groups.map((g) => g.id)).toContain('courtCases')
      })

      it('returns empty array for empty input', () => {
        const groups = groupContentTypes([])
        expect(groups).toHaveLength(0)
      })
    })

    describe('getContentTypesForGroup', () => {
      it('returns types for valid group', () => {
        const types = getContentTypesForGroup('courtCases')
        expect(types).toContain('COURT_CASE_HD')
        expect(types).toContain('COURT_CASE_AD')
        expect(types).toHaveLength(6)
      })

      it('returns empty array for invalid group', () => {
        const types = getContentTypesForGroup('invalid')
        expect(types).toHaveLength(0)
      })
    })

    describe('getGroupForContentType', () => {
      it('returns correct group for type', () => {
        const lawGroup = getGroupForContentType('SFS_LAW')
        expect(lawGroup?.id).toBe('laws')

        const courtGroup = getGroupForContentType('COURT_CASE_HD')
        expect(courtGroup?.id).toBe('courtCases')
      })
    })
  })

  describe('URL Generation', () => {
    describe('getDocumentUrl', () => {
      it('generates correct URL for SFS law', () => {
        expect(getDocumentUrl('SFS_LAW', 'test-slug', false)).toBe('/lagar/test-slug')
        expect(getDocumentUrl('SFS_LAW', 'test-slug', true)).toBe('/browse/lagar/test-slug')
      })

      it('generates correct URL for amendments', () => {
        expect(getDocumentUrl('SFS_AMENDMENT', 'test-slug', false)).toBe('/lagar/andringar/test-slug')
        expect(getDocumentUrl('SFS_AMENDMENT', 'test-slug', true)).toBe('/browse/lagar/andringar/test-slug')
      })

      it('generates correct URL for court cases', () => {
        expect(getDocumentUrl('COURT_CASE_HD', 'test-slug', false)).toBe('/rattsfall/hd/test-slug')
        expect(getDocumentUrl('COURT_CASE_AD', 'test-slug', true)).toBe('/browse/rattsfall/ad/test-slug')
      })

      it('generates correct URL for EU documents', () => {
        expect(getDocumentUrl('EU_REGULATION', 'test-slug', false)).toBe('/eu/forordning/test-slug')
        expect(getDocumentUrl('EU_DIRECTIVE', 'test-slug', true)).toBe('/browse/eu/direktiv/test-slug')
      })
    })
  })

  describe('ALL_CONTENT_TYPES', () => {
    it('contains all content types', () => {
      expect(ALL_CONTENT_TYPES).toHaveLength(10)
      expect(ALL_CONTENT_TYPES).toContain('SFS_LAW')
      expect(ALL_CONTENT_TYPES).toContain('SFS_AMENDMENT')
      expect(ALL_CONTENT_TYPES).toContain('COURT_CASE_HD')
      expect(ALL_CONTENT_TYPES).toContain('EU_REGULATION')
    })
  })
})
