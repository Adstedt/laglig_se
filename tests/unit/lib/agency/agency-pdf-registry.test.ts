/**
 * Story 9.2: Unit Tests for Agency PDF Document Registry
 *
 * Verifies registry entries, document lookup, slug generation,
 * article ID generation, metadata building, and PDF filename generation.
 */

import { describe, it, expect } from 'vitest'
import {
  MSBFS_REGISTRY,
  NFS_REGISTRY,
  getRegistryByAuthority,
  getDocumentByNumber,
  generateAgencySlug,
  generateArticleId,
  getPdfFileName,
  buildAgencyMetadata,
  SUPPORTED_AUTHORITIES,
} from '@/lib/agency/agency-pdf-registry'

describe('agency-pdf-registry', () => {
  describe('MSBFS registry', () => {
    it('contains 12 MSBFS documents', () => {
      expect(MSBFS_REGISTRY).toHaveLength(12)
    })

    it('all entries have authority "msbfs"', () => {
      for (const doc of MSBFS_REGISTRY) {
        expect(doc.authority).toBe('msbfs')
      }
    })

    it('all entries have valid pdfUrl starting with https', () => {
      for (const doc of MSBFS_REGISTRY) {
        expect(doc.pdfUrl).toMatch(/^https:\/\//)
      }
    })

    it('all entries have valid sourceUrl starting with https', () => {
      for (const doc of MSBFS_REGISTRY) {
        expect(doc.sourceUrl).toMatch(/^https:\/\//)
      }
    })

    it('all document numbers follow "MSBFS YYYY:N" format', () => {
      for (const doc of MSBFS_REGISTRY) {
        expect(doc.documentNumber).toMatch(/^MSBFS \d{4}:\d+$/)
      }
    })

    it('contains the specific 12 required documents', () => {
      const expected = [
        'MSBFS 2010:4',
        'MSBFS 2011:3',
        'MSBFS 2013:3',
        'MSBFS 2014:6',
        'MSBFS 2015:8',
        'MSBFS 2015:9',
        'MSBFS 2016:4',
        'MSBFS 2018:3',
        'MSBFS 2020:1',
        'MSBFS 2023:2',
        'MSBFS 2024:10',
        'MSBFS 2025:2',
      ]
      const actual = MSBFS_REGISTRY.map((d) => d.documentNumber)
      expect(actual).toEqual(expected)
    })

    it('ADR-S document has notes about size', () => {
      const adrs = MSBFS_REGISTRY.find(
        (d) => d.documentNumber === 'MSBFS 2024:10'
      )
      expect(adrs).toBeDefined()
      expect(adrs!.notes).toContain('500+ pages')
    })
  })

  describe('NFS registry', () => {
    it('contains 13 NFS documents', () => {
      expect(NFS_REGISTRY).toHaveLength(13)
    })

    it('all entries have authority "nfs"', () => {
      for (const doc of NFS_REGISTRY) {
        expect(doc.authority).toBe('nfs')
      }
    })

    it('all document numbers follow "NFS YYYY:N" format', () => {
      for (const doc of NFS_REGISTRY) {
        expect(doc.documentNumber).toMatch(/^NFS \d{4}:\d+$/)
      }
    })

    it('contains the specific 13 required documents', () => {
      const expected = [
        'NFS 2001:2',
        'NFS 2004:10',
        'NFS 2004:15',
        'NFS 2015:2',
        'NFS 2015:3',
        'NFS 2016:8',
        'NFS 2018:11',
        'NFS 2020:5',
        'NFS 2021:6',
        'NFS 2021:10',
        'NFS 2022:2',
        'NFS 2023:2',
        'NFS 2023:13',
      ]
      const actual = NFS_REGISTRY.map((d) => d.documentNumber)
      expect(actual).toEqual(expected)
    })

    it('marks consolidated versions correctly', () => {
      const consolidated = NFS_REGISTRY.filter((d) => d.isConsolidated)
      const docNumbers = consolidated.map((d) => d.documentNumber)
      expect(docNumbers).toContain('NFS 2004:10')
      expect(docNumbers).toContain('NFS 2015:2')
      expect(docNumbers).toContain('NFS 2016:8')
      expect(consolidated).toHaveLength(3)
    })
  })

  describe('getRegistryByAuthority', () => {
    it('returns MSBFS registry for "msbfs"', () => {
      const result = getRegistryByAuthority('msbfs')
      expect(result).toBe(MSBFS_REGISTRY)
      expect(result).toHaveLength(12)
    })

    it('returns NFS registry for "nfs"', () => {
      const result = getRegistryByAuthority('nfs')
      expect(result).toBe(NFS_REGISTRY)
      expect(result).toHaveLength(13)
    })

    it('throws for unknown authority', () => {
      expect(() => getRegistryByAuthority('unknown' as never)).toThrow(
        'Unknown authority'
      )
    })
  })

  describe('getDocumentByNumber', () => {
    it('finds MSBFS document by number', () => {
      const doc = getDocumentByNumber('MSBFS 2020:1')
      expect(doc).toBeDefined()
      expect(doc!.title).toContain('brandfarlig gas')
    })

    it('finds NFS document by number', () => {
      const doc = getDocumentByNumber('NFS 2023:2')
      expect(doc).toBeDefined()
      expect(doc!.title).toContain('avfall')
    })

    it('returns undefined for non-existent document', () => {
      expect(getDocumentByNumber('MSBFS 9999:1')).toBeUndefined()
    })
  })

  describe('generateAgencySlug', () => {
    it('converts MSBFS document number to slug', () => {
      expect(generateAgencySlug('MSBFS 2020:1')).toBe('msbfs-2020-1')
    })

    it('converts NFS document number to slug', () => {
      expect(generateAgencySlug('NFS 2023:13')).toBe('nfs-2023-13')
    })

    it('handles multi-digit numbers', () => {
      expect(generateAgencySlug('MSBFS 2024:10')).toBe('msbfs-2024-10')
    })
  })

  describe('generateArticleId', () => {
    it('generates correct ID for MSBFS', () => {
      expect(generateArticleId('MSBFS 2020:1')).toBe('MSBFS2020-1')
    })

    it('generates correct ID for NFS', () => {
      expect(generateArticleId('NFS 2023:13')).toBe('NFS2023-13')
    })

    it('generates correct ID for multi-digit numbers', () => {
      expect(generateArticleId('MSBFS 2024:10')).toBe('MSBFS2024-10')
    })
  })

  describe('getPdfFileName', () => {
    it('generates correct filename for MSBFS', () => {
      expect(getPdfFileName('MSBFS 2020:1')).toBe('MSBFS-2020-1.pdf')
    })

    it('generates correct filename for NFS', () => {
      expect(getPdfFileName('NFS 2023:13')).toBe('NFS-2023-13.pdf')
    })
  })

  describe('buildAgencyMetadata', () => {
    it('builds correct metadata structure', () => {
      const doc = MSBFS_REGISTRY[0]!
      const metadata = buildAgencyMetadata(
        doc,
        { input: 10000, output: 5000 },
        0.35
      )

      expect(metadata.source).toBe('mcf.se')
      expect(metadata.method).toBe('claude-pdf-ingestion')
      expect(metadata.model).toBe('claude-sonnet-4-5-20250929')
      expect(metadata.pdfUrl).toBe(doc.pdfUrl)
      expect(metadata.tokenUsage).toEqual({ input: 10000, output: 5000 })
      expect(metadata.cost).toBe(0.35)
      expect(metadata.tier).toBe('STANDALONE')
      expect(metadata.processedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('includes notes when present', () => {
      const adrs = MSBFS_REGISTRY.find(
        (d) => d.documentNumber === 'MSBFS 2024:10'
      )!
      const metadata = buildAgencyMetadata(adrs, { input: 0, output: 0 }, 0)
      expect(metadata.notes).toContain('500+ pages')
    })

    it('omits notes when not present', () => {
      const doc = MSBFS_REGISTRY[0]!
      const metadata = buildAgencyMetadata(doc, { input: 0, output: 0 }, 0)
      expect(metadata.notes).toBeUndefined()
    })
  })

  describe('SUPPORTED_AUTHORITIES', () => {
    it('includes msbfs and nfs', () => {
      expect(SUPPORTED_AUTHORITIES).toContain('msbfs')
      expect(SUPPORTED_AUTHORITIES).toContain('nfs')
    })
  })
})
