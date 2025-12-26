/**
 * Integration tests for SFS Document Utilities
 *
 * Story 2.28: Unified SFS PDF Sync & Document Classification
 *
 * Tests the integration between classification, URL construction,
 * and metadata generation for various document types.
 */

import { describe, it, expect } from 'vitest'
import {
  classifyLawType,
  classificationToMetadata,
  constructPdfUrls,
  constructStoragePath,
  parseSfsNumber,
  type PdfMetadata,
} from '@/lib/sfs'

describe('SFS Document Integration', () => {
  describe('Full workflow: classification → URL → metadata', () => {
    it('processes a new law correctly', () => {
      const title = 'Lag (2024:1087) om producentansvar för bilar'
      const sfsNumber = '2024:1087'
      const publicationDate = '2024-10-15'

      // Step 1: Classify
      const classification = classifyLawType(title)
      expect(classification.type).toBe('lag')
      expect(classification.category).toBe('new')
      expect(classification.targetSfs).toBeNull()

      // Step 2: Get classification metadata
      const classMeta = classificationToMetadata(classification)
      expect(classMeta.lawType).toBe('lag')
      expect(classMeta.documentCategory).toBe('new')

      // Step 3: Construct URLs
      const urls = constructPdfUrls(sfsNumber, publicationDate)
      expect(urls.html).toBe(
        'https://svenskforfattningssamling.se/doc/20241087.html'
      )
      expect(urls.pdf).toContain('/2024-10/')
      expect(urls.pdf).toContain('SFS2024-1087.pdf')

      // Step 4: Get storage path
      const storagePath = constructStoragePath(sfsNumber)
      expect(storagePath).toBe('2024/SFS2024-1087.pdf')
    })

    it('processes an amendment correctly', () => {
      const title = 'Lag (2024:1189) om ändring i patientlagen (2014:821)'
      const sfsNumber = '2024:1189'
      const publicationDate = '2024-11-20'

      // Step 1: Classify
      const classification = classifyLawType(title)
      expect(classification.type).toBe('lag')
      expect(classification.category).toBe('amendment')
      expect(classification.targetSfs).toBe('2014:821')
      expect(classification.targetType).toBe('lag')

      // Step 2: Get classification metadata
      const classMeta = classificationToMetadata(classification)
      expect(classMeta.lawType).toBe('lag')
      expect(classMeta.documentCategory).toBe('amendment')
      expect(classMeta.baseLawSfs).toBe('2014:821')
      expect(classMeta.baseLawType).toBe('lag')

      // Step 3: Construct URLs for the AMENDMENT document
      const urls = constructPdfUrls(sfsNumber, publicationDate)
      expect(urls.html).toBe(
        'https://svenskforfattningssamling.se/doc/20241189.html'
      )
      expect(urls.pdf).toContain('/2024-11/')
      expect(urls.pdf).toContain('SFS2024-1189.pdf')

      // Step 4: Get storage path for amendment
      const storagePath = constructStoragePath(sfsNumber)
      expect(storagePath).toBe('2024/SFS2024-1189.pdf')
    })

    it('processes a förordning correctly', () => {
      const title = 'Förordning (2024:456) om miljöskydd'
      const sfsNumber = '2024:456'
      const publicationDate = '2024-05-10'

      const classification = classifyLawType(title)
      expect(classification.type).toBe('förordning')
      expect(classification.category).toBe('new')

      const urls = constructPdfUrls(sfsNumber, publicationDate)
      expect(urls.html).toBe(
        'https://svenskforfattningssamling.se/doc/20240456.html'
      )
      expect(urls.pdf).toContain('/2024-05/')
    })

    it('processes a repeal correctly', () => {
      const title = 'Lag (2024:100) om upphävande av lagen (1990:50) om skatt'
      const sfsNumber = '2024:100'
      const publicationDate = '2024-02-01'

      const classification = classifyLawType(title)
      expect(classification.type).toBe('lag')
      expect(classification.category).toBe('repeal')
      expect(classification.targetSfs).toBe('1990:50')
      expect(classification.targetType).toBe('lag')

      const classMeta = classificationToMetadata(classification)
      expect(classMeta.documentCategory).toBe('repeal')
      expect(classMeta.baseLawSfs).toBe('1990:50')

      // Also verify URL construction for repeal documents
      const urls = constructPdfUrls(sfsNumber, publicationDate)
      expect(urls.html).toBe(
        'https://svenskforfattningssamling.se/doc/20240100.html'
      )
      expect(urls.pdf).toContain('/2024-02/')
    })
  })

  describe('Classification consistency', () => {
    const testCases: Array<{
      title: string
      expectedType: string
      expectedCategory: string
      expectedTargetSfs: string | null
    }> = [
      {
        title: 'Arbetsmiljölag (1977:1160)',
        expectedType: 'lag',
        expectedCategory: 'new',
        expectedTargetSfs: null,
      },
      {
        title: 'Brottsbalk (1962:700)',
        expectedType: 'lag',
        expectedCategory: 'new',
        expectedTargetSfs: null,
      },
      {
        title: 'Miljöbalk (1998:808)',
        expectedType: 'lag',
        expectedCategory: 'new',
        expectedTargetSfs: null,
      },
      {
        title: 'Förordning (2024:789) om dataskydd',
        expectedType: 'förordning',
        expectedCategory: 'new',
        expectedTargetSfs: null,
      },
      {
        title: 'Kungörelse (1965:123) om allmänna handlingar',
        expectedType: 'kungörelse',
        expectedCategory: 'new',
        expectedTargetSfs: null,
      },
      {
        title: 'Lag (2025:1581) om ändring i arbetsmiljölagen (1977:1160)',
        expectedType: 'lag',
        expectedCategory: 'amendment',
        expectedTargetSfs: '1977:1160',
      },
      {
        title:
          'Förordning (2024:500) om ändring i miljöförordningen (2013:251)',
        expectedType: 'förordning',
        expectedCategory: 'amendment',
        expectedTargetSfs: '2013:251',
      },
      {
        title: 'Lag (2024:200) om upphävande av lagen (2010:75)',
        expectedType: 'lag',
        expectedCategory: 'repeal',
        expectedTargetSfs: '2010:75',
      },
    ]

    testCases.forEach(
      ({ title, expectedType, expectedCategory, expectedTargetSfs }) => {
        it(`correctly classifies "${title.substring(0, 40)}..."`, () => {
          const result = classifyLawType(title)

          expect(result.type).toBe(expectedType)
          expect(result.category).toBe(expectedCategory)
          expect(result.targetSfs).toBe(expectedTargetSfs)
          expect(result.confidence).toBeGreaterThanOrEqual(0.9)
        })
      }
    )
  })

  describe('URL construction with various SFS formats', () => {
    it('handles standard 4-digit SFS numbers', () => {
      const result = constructPdfUrls('2024:1234', '2024-06-15')

      expect(result.html).toContain('20241234.html')
      expect(result.pdf).toContain('SFS2024-1234.pdf')
    })

    it('handles short SFS numbers with padding', () => {
      const result = constructPdfUrls('2024:1', '2024-01-01')

      // HTML should be padded to 4 digits
      expect(result.html).toContain('20240001.html')
      // PDF keeps original number
      expect(result.pdf).toContain('SFS2024-1.pdf')
    })

    it('handles long SFS numbers', () => {
      const result = constructPdfUrls('2024:12345', '2024-12-25')

      expect(result.html).toContain('202412345.html')
      expect(result.pdf).toContain('SFS2024-12345.pdf')
    })

    it('extracts correct year-month from dates', () => {
      expect(constructPdfUrls('2024:100', '2024-01-15').yearMonth).toBe(
        '2024-01'
      )
      expect(constructPdfUrls('2024:100', '2024-06-30').yearMonth).toBe(
        '2024-06'
      )
      expect(constructPdfUrls('2024:100', '2024-12-01').yearMonth).toBe(
        '2024-12'
      )
    })

    it('handles Date objects', () => {
      const date = new Date('2024-08-15T00:00:00Z')
      const result = constructPdfUrls('2024:999', date)

      expect(result.yearMonth).toBe('2024-08')
      expect(result.pdf).toContain('/2024-08/')
    })
  })

  describe('Metadata generation for database storage', () => {
    it('generates complete metadata for new law', () => {
      const classification = classifyLawType('Lag (2024:500) om hållbarhet')
      const meta = classificationToMetadata(classification)

      expect(meta).toEqual({
        lawType: 'lag',
        documentCategory: 'new',
        baseLawSfs: null,
        baseLawType: null,
        classificationConfidence: expect.any(Number),
      })
    })

    it('generates complete metadata for amendment', () => {
      const classification = classifyLawType(
        'Lag (2024:600) om ändring i skatteförfarandelagen (2011:1244)'
      )
      const meta = classificationToMetadata(classification)

      expect(meta).toEqual({
        lawType: 'lag',
        documentCategory: 'amendment',
        baseLawSfs: '2011:1244',
        baseLawType: 'lag',
        classificationConfidence: expect.any(Number),
      })
    })
  })

  describe('Edge cases and error handling', () => {
    it('handles documents without clear type gracefully', () => {
      const classification = classifyLawType(
        'Tillkännagivande (2024:999) om något'
      )

      expect(classification.type).toBe('other')
      expect(classification.category).toBe('new')
      expect(classification.confidence).toBeLessThan(0.9)
    })

    it('throws error for invalid SFS number format', () => {
      expect(() => constructPdfUrls('invalid')).toThrow('Invalid SFS number')
      expect(() => constructStoragePath('2024')).toThrow('Invalid SFS number')
    })

    it('handles SFS numbers with "SFS " prefix', () => {
      const parsed = parseSfsNumber('SFS 2024:1234')

      expect(parsed).toEqual({ year: '2024', number: '1234' })
    })

    it('returns null for completely invalid input', () => {
      const parsed = parseSfsNumber('not a number')

      expect(parsed).toBeNull()
    })
  })
})

describe('PDF Metadata structure', () => {
  it('defines correct PdfMetadata interface', () => {
    // This is a compile-time test ensuring the interface is correct
    const meta: PdfMetadata = {
      storagePath: '2024/SFS2024-100.pdf',
      storageBucket: 'sfs-pdfs',
      originalUrl:
        'https://svenskforfattningssamling.se/sites/default/files/sfs/2024-01/SFS2024-100.pdf',
      fileSize: 12345,
      fetchedAt: new Date().toISOString(),
    }

    expect(meta.storagePath).toBeDefined()
    expect(meta.storageBucket).toBe('sfs-pdfs')
  })

  it('allows error field for failed fetches', () => {
    const meta: PdfMetadata = {
      storagePath: '2024/SFS2024-100.pdf',
      storageBucket: 'sfs-pdfs',
      originalUrl: '',
      fileSize: 0,
      fetchedAt: new Date().toISOString(),
      error: 'Failed to fetch: 404 Not Found',
    }

    expect(meta.error).toBeDefined()
  })
})
