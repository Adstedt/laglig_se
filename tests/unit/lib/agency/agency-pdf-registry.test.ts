/**
 * Story 9.2 + 9.3 + 8.17: Unit Tests for Agency PDF Document Registry
 *
 * Verifies registry entries, document lookup, slug generation,
 * article ID generation, metadata building, PDF filename generation,
 * and content hash computation (Story 8.17).
 */

import { describe, it, expect } from 'vitest'
import {
  MSBFS_REGISTRY,
  NFS_REGISTRY,
  ELSAK_FS_REGISTRY,
  KIFS_REGISTRY,
  BFS_REGISTRY,
  SRVFS_REGISTRY,
  SKVFS_REGISTRY,
  SCB_FS_REGISTRY,
  SSMFS_REGISTRY,
  STAFS_REGISTRY,
  getRegistryByAuthority,
  getDocumentByNumber,
  generateAgencySlug,
  generateArticleId,
  getPdfFileName,
  buildAgencyMetadata,
  computeContentHash,
  SUPPORTED_AUTHORITIES,
} from '@/lib/agency/agency-pdf-registry'

describe('agency-pdf-registry', () => {
  describe('MSBFS registry', () => {
    it('contains 17 MSBFS documents', () => {
      expect(MSBFS_REGISTRY).toHaveLength(64)
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

    it('all document numbers follow "MSBFS YYYY:N" or "MCFFS YYYY:N" format', () => {
      for (const doc of MSBFS_REGISTRY) {
        expect(doc.documentNumber).toMatch(/^(MSBFS|MCFFS) \d{4}:\d+$/)
      }
    })

    it('contains original 12 + 5 new documents from Story 8.17', () => {
      const actual = MSBFS_REGISTRY.map((d) => d.documentNumber)
      // Original 12
      expect(actual).toContain('MSBFS 2010:4')
      expect(actual).toContain('MSBFS 2025:2')
      // New from Story 8.17
      expect(actual).toContain('MSBFS 2020:6')
      expect(actual).toContain('MSBFS 2024:5')
      expect(actual).toContain('MSBFS 2025:4')
    })

    it('ADR-S document is marked as stub with notes', () => {
      const adrs = MSBFS_REGISTRY.find(
        (d) => d.documentNumber === 'MSBFS 2024:10'
      )
      expect(adrs).toBeDefined()
      expect(adrs!.stubOnly).toBe(true)
      expect(adrs!.notes).toContain('1400+ pages')
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

  // ============================================================================
  // Story 9.3: New registry tests
  // ============================================================================

  describe('ELSÄK-FS registry', () => {
    it('contains 15 ELSÄK-FS documents', () => {
      expect(ELSAK_FS_REGISTRY).toHaveLength(20)
    })

    it('all entries have authority "elsak-fs"', () => {
      for (const doc of ELSAK_FS_REGISTRY) {
        expect(doc.authority).toBe('elsak-fs')
      }
    })

    it('all entries have valid pdfUrl starting with https', () => {
      for (const doc of ELSAK_FS_REGISTRY) {
        expect(doc.pdfUrl).toMatch(/^https:\/\//)
      }
    })

    it('all entries have valid sourceUrl starting with https', () => {
      for (const doc of ELSAK_FS_REGISTRY) {
        expect(doc.sourceUrl).toMatch(/^https:\/\//)
      }
    })

    it('all document numbers follow "ELSÄK-FS YYYY:N" format', () => {
      for (const doc of ELSAK_FS_REGISTRY) {
        expect(doc.documentNumber).toMatch(/^ELSÄK-FS \d{4}:\d+$/)
      }
    })

    it('contains original 5 + 10 new documents from Story 8.17', () => {
      const actual = ELSAK_FS_REGISTRY.map((d) => d.documentNumber)
      // Original 5
      expect(actual).toContain('ELSÄK-FS 2017:2')
      expect(actual).toContain('ELSÄK-FS 2017:3')
      expect(actual).toContain('ELSÄK-FS 2022:1')
      expect(actual).toContain('ELSÄK-FS 2022:2')
      expect(actual).toContain('ELSÄK-FS 2022:3')
      // New from Story 8.17
      expect(actual).toContain('ELSÄK-FS 2011:2')
      expect(actual).toContain('ELSÄK-FS 2016:1')
      expect(actual).toContain('ELSÄK-FS 2019:1')
    })

    it('ELSÄK-FS 2017:3 is marked as consolidated', () => {
      const doc = ELSAK_FS_REGISTRY.find(
        (d) => d.documentNumber === 'ELSÄK-FS 2017:3'
      )
      expect(doc).toBeDefined()
      expect(doc!.isConsolidated).toBe(true)
    })

    it('all entries have sourceDomain "elsakerhetsverket.se"', () => {
      for (const doc of ELSAK_FS_REGISTRY) {
        expect(doc.sourceDomain).toBe('elsakerhetsverket.se')
      }
    })
  })

  describe('KIFS registry', () => {
    it('contains 3 KIFS documents', () => {
      expect(KIFS_REGISTRY).toHaveLength(3)
    })

    it('all entries have authority "kifs"', () => {
      for (const doc of KIFS_REGISTRY) {
        expect(doc.authority).toBe('kifs')
      }
    })

    it('all entries have valid pdfUrl and sourceUrl', () => {
      for (const doc of KIFS_REGISTRY) {
        expect(doc.pdfUrl).toMatch(/^https:\/\//)
        expect(doc.sourceUrl).toMatch(/^https:\/\//)
      }
    })

    it('all document numbers follow "KIFS YYYY:N" format', () => {
      for (const doc of KIFS_REGISTRY) {
        expect(doc.documentNumber).toMatch(/^KIFS \d{4}:\d+$/)
      }
    })

    it('contains original 2 + 1 new document from Story 8.17', () => {
      const actual = KIFS_REGISTRY.map((d) => d.documentNumber)
      expect(actual).toContain('KIFS 2017:7')
      expect(actual).toContain('KIFS 2022:3')
      // New from Story 8.17
      expect(actual).toContain('KIFS 2017:8')
    })

    it('KIFS 2017:7 is marked as consolidated', () => {
      const doc = KIFS_REGISTRY.find((d) => d.documentNumber === 'KIFS 2017:7')
      expect(doc!.isConsolidated).toBe(true)
    })

    it('all entries have sourceDomain "kemi.se"', () => {
      for (const doc of KIFS_REGISTRY) {
        expect(doc.sourceDomain).toBe('kemi.se')
      }
    })
  })

  describe('BFS registry', () => {
    it('contains 1 BFS document', () => {
      expect(BFS_REGISTRY).toHaveLength(55)
    })

    it('the entry has authority "bfs"', () => {
      expect(BFS_REGISTRY[0]!.authority).toBe('bfs')
    })

    it('document number follows "BFS YYYY:N" format', () => {
      expect(BFS_REGISTRY[0]!.documentNumber).toMatch(/^BFS \d{4}:\d+$/)
    })

    it('contains BFS 2011:16 (OVK)', () => {
      expect(BFS_REGISTRY[0]!.documentNumber).toBe('BFS 2011:16')
      expect(BFS_REGISTRY[0]!.title).toContain('ventilationssystem')
    })

    it('BFS 2011:16 is marked as consolidated', () => {
      expect(BFS_REGISTRY[0]!.isConsolidated).toBe(true)
    })

    it('has sourceDomain "boverket.se"', () => {
      expect(BFS_REGISTRY[0]!.sourceDomain).toBe('boverket.se')
    })

    it('has valid pdfUrl and sourceUrl', () => {
      expect(BFS_REGISTRY[0]!.pdfUrl).toMatch(/^https:\/\//)
      expect(BFS_REGISTRY[0]!.sourceUrl).toMatch(/^https:\/\//)
    })
  })

  describe('SRVFS registry', () => {
    it('contains 7 SRVFS documents', () => {
      expect(SRVFS_REGISTRY).toHaveLength(7)
    })

    it('all entries have authority "srvfs"', () => {
      for (const doc of SRVFS_REGISTRY) {
        expect(doc.authority).toBe('srvfs')
      }
    })

    it('all entries have valid pdfUrl and sourceUrl', () => {
      for (const doc of SRVFS_REGISTRY) {
        expect(doc.pdfUrl).toMatch(/^https:\/\//)
        expect(doc.sourceUrl).toMatch(/^https:\/\//)
      }
    })

    it('all document numbers follow "SRVFS YYYY:N" format', () => {
      for (const doc of SRVFS_REGISTRY) {
        expect(doc.documentNumber).toMatch(/^SRVFS \d{4}:\d+$/)
      }
    })

    it('contains original 2 + 5 new documents from Story 8.17', () => {
      const actual = SRVFS_REGISTRY.map((d) => d.documentNumber)
      // Original 2
      expect(actual).toContain('SRVFS 2004:3')
      expect(actual).toContain('SRVFS 2004:7')
      // New from Story 8.17
      expect(actual).toContain('SRVFS 1993:6')
      expect(actual).toContain('SRVFS 2006:3')
      expect(actual).toContain('SRVFS 2008:3')
    })

    it('all entries have sourceDomain "mcf.se"', () => {
      for (const doc of SRVFS_REGISTRY) {
        expect(doc.sourceDomain).toBe('mcf.se')
      }
    })
  })

  describe('SKVFS registry', () => {
    it('contains 1 SKVFS document', () => {
      expect(SKVFS_REGISTRY).toHaveLength(1)
    })

    it('the entry has authority "skvfs"', () => {
      expect(SKVFS_REGISTRY[0]!.authority).toBe('skvfs')
    })

    it('document number follows "SKVFS YYYY:N" format', () => {
      expect(SKVFS_REGISTRY[0]!.documentNumber).toMatch(/^SKVFS \d{4}:\d+$/)
    })

    it('contains SKVFS 2015:6 (personalliggare)', () => {
      expect(SKVFS_REGISTRY[0]!.documentNumber).toBe('SKVFS 2015:6')
      expect(SKVFS_REGISTRY[0]!.title).toContain('personalliggare')
    })

    it('has sourceDomain "skatteverket.se"', () => {
      expect(SKVFS_REGISTRY[0]!.sourceDomain).toBe('skatteverket.se')
    })

    it('has valid pdfUrl and sourceUrl', () => {
      expect(SKVFS_REGISTRY[0]!.pdfUrl).toMatch(/^https:\/\//)
      expect(SKVFS_REGISTRY[0]!.sourceUrl).toMatch(/^https:\/\//)
    })
  })

  describe('SCB-FS registry', () => {
    it('contains 1 SCB-FS document', () => {
      expect(SCB_FS_REGISTRY).toHaveLength(1)
    })

    it('the entry has authority "scb-fs"', () => {
      expect(SCB_FS_REGISTRY[0]!.authority).toBe('scb-fs')
    })

    it('document number follows "SCB-FS YYYY:N" format', () => {
      expect(SCB_FS_REGISTRY[0]!.documentNumber).toMatch(/^SCB-FS \d{4}:\d+$/)
    })

    it('contains SCB-FS 2025:19 (replaced 2024:25)', () => {
      expect(SCB_FS_REGISTRY[0]!.documentNumber).toBe('SCB-FS 2025:19')
      expect(SCB_FS_REGISTRY[0]!.title).toContain('miljöskyddskostnader')
    })

    it('has sourceDomain "scb.se"', () => {
      expect(SCB_FS_REGISTRY[0]!.sourceDomain).toBe('scb.se')
    })

    it('has valid pdfUrl and sourceUrl', () => {
      expect(SCB_FS_REGISTRY[0]!.pdfUrl).toMatch(/^https:\/\//)
      expect(SCB_FS_REGISTRY[0]!.sourceUrl).toMatch(/^https:\/\//)
    })
  })

  describe('SSMFS registry', () => {
    it('contains 10 SSMFS documents', () => {
      expect(SSMFS_REGISTRY).toHaveLength(40)
    })

    it('all entries have authority "ssmfs"', () => {
      for (const doc of SSMFS_REGISTRY) {
        expect(doc.authority).toBe('ssmfs')
      }
    })

    it('all document numbers follow "SSMFS YYYY:N" format', () => {
      for (const doc of SSMFS_REGISTRY) {
        expect(doc.documentNumber).toMatch(/^SSMFS \d{4}:\d+$/)
      }
    })

    it('contains original 1 + 9 new documents from Story 8.17', () => {
      const actual = SSMFS_REGISTRY.map((d) => d.documentNumber)
      // Original
      expect(actual).toContain('SSMFS 2018:2')
      // New from Story 8.17
      expect(actual).toContain('SSMFS 2014:4')
      expect(actual).toContain('SSMFS 2018:1')
      expect(actual).toContain('SSMFS 2018:5')
      expect(actual).toContain('SSMFS 2025:1')
      expect(actual).toContain('SSMFS 2008:18')
    })

    it('all entries have sourceDomain "stralsakerhetsmyndigheten.se"', () => {
      for (const doc of SSMFS_REGISTRY) {
        expect(doc.sourceDomain).toBe('stralsakerhetsmyndigheten.se')
      }
    })

    it('all entries have valid pdfUrl and sourceUrl', () => {
      for (const doc of SSMFS_REGISTRY) {
        expect(doc.pdfUrl).toMatch(/^https:\/\//)
        expect(doc.sourceUrl).toMatch(/^https:\/\//)
      }
    })
  })

  describe('STAFS registry', () => {
    it('contains 1 STAFS document', () => {
      expect(STAFS_REGISTRY).toHaveLength(1)
    })

    it('the entry has authority "stafs"', () => {
      expect(STAFS_REGISTRY[0]!.authority).toBe('stafs')
    })

    it('document number follows "STAFS YYYY:N" format', () => {
      expect(STAFS_REGISTRY[0]!.documentNumber).toMatch(/^STAFS \d{4}:\d+$/)
    })

    it('contains STAFS 2020:1 (ackreditering)', () => {
      expect(STAFS_REGISTRY[0]!.documentNumber).toBe('STAFS 2020:1')
      expect(STAFS_REGISTRY[0]!.title).toContain('ackreditering')
    })

    it('has sourceDomain "swedac.se"', () => {
      expect(STAFS_REGISTRY[0]!.sourceDomain).toBe('swedac.se')
    })

    it('has valid pdfUrl and sourceUrl', () => {
      expect(STAFS_REGISTRY[0]!.pdfUrl).toMatch(/^https:\/\//)
      expect(STAFS_REGISTRY[0]!.sourceUrl).toMatch(/^https:\/\//)
    })
  })

  // ============================================================================
  // Helpers (existing + Story 9.3 extensions)
  // ============================================================================

  describe('getRegistryByAuthority', () => {
    it('returns MSBFS registry for "msbfs"', () => {
      const result = getRegistryByAuthority('msbfs')
      expect(result).toBe(MSBFS_REGISTRY)
      expect(result).toHaveLength(64)
    })

    it('returns NFS registry for "nfs"', () => {
      const result = getRegistryByAuthority('nfs')
      expect(result).toBe(NFS_REGISTRY)
      expect(result).toHaveLength(13)
    })

    it('returns ELSÄK-FS registry for "elsak-fs"', () => {
      const result = getRegistryByAuthority('elsak-fs')
      expect(result).toBe(ELSAK_FS_REGISTRY)
      expect(result).toHaveLength(20)
    })

    it('returns KIFS registry for "kifs"', () => {
      const result = getRegistryByAuthority('kifs')
      expect(result).toBe(KIFS_REGISTRY)
      expect(result).toHaveLength(3)
    })

    it('returns BFS registry for "bfs"', () => {
      const result = getRegistryByAuthority('bfs')
      expect(result).toBe(BFS_REGISTRY)
      expect(result).toHaveLength(55)
    })

    it('returns SRVFS registry for "srvfs"', () => {
      const result = getRegistryByAuthority('srvfs')
      expect(result).toBe(SRVFS_REGISTRY)
      expect(result).toHaveLength(7)
    })

    it('returns SKVFS registry for "skvfs"', () => {
      const result = getRegistryByAuthority('skvfs')
      expect(result).toBe(SKVFS_REGISTRY)
      expect(result).toHaveLength(1)
    })

    it('returns SCB-FS registry for "scb-fs"', () => {
      const result = getRegistryByAuthority('scb-fs')
      expect(result).toBe(SCB_FS_REGISTRY)
      expect(result).toHaveLength(1)
    })

    it('returns SSMFS registry for "ssmfs"', () => {
      const result = getRegistryByAuthority('ssmfs')
      expect(result).toBe(SSMFS_REGISTRY)
      expect(result).toHaveLength(40)
    })

    it('returns STAFS registry for "stafs"', () => {
      const result = getRegistryByAuthority('stafs')
      expect(result).toBe(STAFS_REGISTRY)
      expect(result).toHaveLength(1)
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

    it('finds ELSÄK-FS document by number', () => {
      const doc = getDocumentByNumber('ELSÄK-FS 2022:1')
      expect(doc).toBeDefined()
      expect(doc!.title).toContain('starkströmsanläggningar')
    })

    it('finds KIFS document by number', () => {
      const doc = getDocumentByNumber('KIFS 2017:7')
      expect(doc).toBeDefined()
      expect(doc!.title).toContain('kemiska produkter')
    })

    it('finds BFS document by number', () => {
      const doc = getDocumentByNumber('BFS 2011:16')
      expect(doc).toBeDefined()
      expect(doc!.title).toContain('ventilationssystem')
    })

    it('finds SRVFS document by number', () => {
      const doc = getDocumentByNumber('SRVFS 2004:3')
      expect(doc).toBeDefined()
      expect(doc!.title).toContain('brandskyddsarbete')
    })

    it('finds SKVFS document by number', () => {
      const doc = getDocumentByNumber('SKVFS 2015:6')
      expect(doc).toBeDefined()
      expect(doc!.title).toContain('personalliggare')
    })

    it('finds SCB-FS document by number', () => {
      const doc = getDocumentByNumber('SCB-FS 2025:19')
      expect(doc).toBeDefined()
      expect(doc!.title).toContain('miljöskyddskostnader')
    })

    it('finds SSMFS document by number', () => {
      const doc = getDocumentByNumber('SSMFS 2018:2')
      expect(doc).toBeDefined()
      expect(doc!.title).toContain('anmälningspliktiga')
    })

    it('finds STAFS document by number', () => {
      const doc = getDocumentByNumber('STAFS 2020:1')
      expect(doc).toBeDefined()
      expect(doc!.title).toContain('ackreditering')
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

    it('converts ELSÄK-FS with Swedish characters (ä→a)', () => {
      expect(generateAgencySlug('ELSÄK-FS 2022:1')).toBe('elsak-fs-2022-1')
    })

    it('converts SCB-FS with hyphen in prefix', () => {
      expect(generateAgencySlug('SCB-FS 2025:19')).toBe('scb-fs-2025-19')
    })

    it('converts KIFS document number to slug', () => {
      expect(generateAgencySlug('KIFS 2017:7')).toBe('kifs-2017-7')
    })

    it('converts BFS document number to slug', () => {
      expect(generateAgencySlug('BFS 2011:16')).toBe('bfs-2011-16')
    })

    it('converts SRVFS document number to slug', () => {
      expect(generateAgencySlug('SRVFS 2004:3')).toBe('srvfs-2004-3')
    })

    it('converts SKVFS document number to slug', () => {
      expect(generateAgencySlug('SKVFS 2015:6')).toBe('skvfs-2015-6')
    })

    it('converts SSMFS document number to slug', () => {
      expect(generateAgencySlug('SSMFS 2018:2')).toBe('ssmfs-2018-2')
    })

    it('converts STAFS document number to slug', () => {
      expect(generateAgencySlug('STAFS 2020:1')).toBe('stafs-2020-1')
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

    it('preserves Unicode characters for ELSÄK-FS', () => {
      expect(generateArticleId('ELSÄK-FS 2022:1')).toBe('ELSÄK-FS2022-1')
    })

    it('preserves hyphen in SCB-FS prefix', () => {
      expect(generateArticleId('SCB-FS 2025:19')).toBe('SCB-FS2025-19')
    })

    it('generates correct ID for KIFS', () => {
      expect(generateArticleId('KIFS 2017:7')).toBe('KIFS2017-7')
    })

    it('generates correct ID for BFS', () => {
      expect(generateArticleId('BFS 2011:16')).toBe('BFS2011-16')
    })

    it('generates correct ID for SRVFS', () => {
      expect(generateArticleId('SRVFS 2004:3')).toBe('SRVFS2004-3')
    })

    it('generates correct ID for SKVFS', () => {
      expect(generateArticleId('SKVFS 2015:6')).toBe('SKVFS2015-6')
    })

    it('generates correct ID for SSMFS', () => {
      expect(generateArticleId('SSMFS 2018:2')).toBe('SSMFS2018-2')
    })

    it('generates correct ID for STAFS', () => {
      expect(generateArticleId('STAFS 2020:1')).toBe('STAFS2020-1')
    })
  })

  describe('getPdfFileName', () => {
    it('generates correct filename for MSBFS', () => {
      expect(getPdfFileName('MSBFS 2020:1')).toBe('MSBFS-2020-1.pdf')
    })

    it('generates correct filename for NFS', () => {
      expect(getPdfFileName('NFS 2023:13')).toBe('NFS-2023-13.pdf')
    })

    it('generates correct filename for ELSÄK-FS', () => {
      expect(getPdfFileName('ELSÄK-FS 2022:1')).toBe('ELSÄK-FS-2022-1.pdf')
    })

    it('generates correct filename for SCB-FS', () => {
      expect(getPdfFileName('SCB-FS 2025:19')).toBe('SCB-FS-2025-19.pdf')
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
      expect(metadata.notes).toContain('1400+ pages')
    })

    it('omits notes when not present', () => {
      const doc = MSBFS_REGISTRY[0]!
      const metadata = buildAgencyMetadata(doc, { input: 0, output: 0 }, 0)
      expect(metadata.notes).toBeUndefined()
    })
  })

  // ============================================================================
  // Story 8.17: Content hash & metadata extension tests
  // ============================================================================

  describe('computeContentHash', () => {
    it('produces stable hash for same input', () => {
      const html = '<article><h1>Test</h1><p>Content</p></article>'
      const hash1 = computeContentHash(html)
      const hash2 = computeContentHash(html)
      expect(hash1).toBe(hash2)
    })

    it('produces different hash when content changes', () => {
      const html1 = '<article><h1>Version 1</h1></article>'
      const html2 = '<article><h1>Version 2</h1></article>'
      expect(computeContentHash(html1)).not.toBe(computeContentHash(html2))
    })

    it('returns a 64-character hex string (SHA-256)', () => {
      const hash = computeContentHash('<p>hello</p>')
      expect(hash).toMatch(/^[a-f0-9]{64}$/)
    })
  })

  describe('buildAgencyMetadata with htmlContent (Story 8.17)', () => {
    it('includes contentHash, lastIngested, sourceUrl when htmlContent provided', () => {
      const doc = MSBFS_REGISTRY[0]!
      const html = '<article><h1>Regulation</h1></article>'
      const metadata = buildAgencyMetadata(
        doc,
        { input: 10000, output: 5000 },
        0.35,
        html
      )

      expect(metadata.contentHash).toBe(computeContentHash(html))
      expect(metadata.lastIngested).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(metadata.sourceUrl).toBe(doc.sourceUrl)
    })

    it('omits contentHash, lastIngested, sourceUrl when htmlContent not provided', () => {
      const doc = MSBFS_REGISTRY[0]!
      const metadata = buildAgencyMetadata(
        doc,
        { input: 10000, output: 5000 },
        0.35
      )

      expect(metadata.contentHash).toBeUndefined()
      expect(metadata.lastIngested).toBeUndefined()
      expect(metadata.sourceUrl).toBeUndefined()
    })

    it('still includes base fields when htmlContent is provided', () => {
      const doc = MSBFS_REGISTRY[0]!
      const metadata = buildAgencyMetadata(
        doc,
        { input: 100, output: 50 },
        0.01,
        '<p>test</p>'
      )

      expect(metadata.source).toBe('mcf.se')
      expect(metadata.method).toBe('claude-pdf-ingestion')
      expect(metadata.pdfUrl).toBe(doc.pdfUrl)
      expect(metadata.tokenUsage).toEqual({ input: 100, output: 50 })
      expect(metadata.cost).toBe(0.01)
    })
  })

  describe('SUPPORTED_AUTHORITIES', () => {
    it('includes all 10 authorities', () => {
      expect(SUPPORTED_AUTHORITIES).toHaveLength(10)
    })

    it('includes msbfs and nfs', () => {
      expect(SUPPORTED_AUTHORITIES).toContain('msbfs')
      expect(SUPPORTED_AUTHORITIES).toContain('nfs')
    })

    it('includes all 8 new authorities from Story 9.3', () => {
      expect(SUPPORTED_AUTHORITIES).toContain('elsak-fs')
      expect(SUPPORTED_AUTHORITIES).toContain('kifs')
      expect(SUPPORTED_AUTHORITIES).toContain('bfs')
      expect(SUPPORTED_AUTHORITIES).toContain('srvfs')
      expect(SUPPORTED_AUTHORITIES).toContain('skvfs')
      expect(SUPPORTED_AUTHORITIES).toContain('scb-fs')
      expect(SUPPORTED_AUTHORITIES).toContain('ssmfs')
      expect(SUPPORTED_AUTHORITIES).toContain('stafs')
    })
  })
})
