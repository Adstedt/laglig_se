/**
 * Story 9.1: Unit Tests for AFS Document Registry
 *
 * Verifies classification mapping, tier assignment, chapter counts,
 * document number formatting, slug generation, and kap. detection.
 */

import { describe, it, expect } from 'vitest'
import {
  AFS_REGISTRY,
  AFS_AMENDMENTS,
  getAfsDocument,
  getAfsByTier,
  getTotalEntryCount,
  formatChapterDocumentNumber,
  formatChapterTitle,
  generateAfsSlug,
  detectKapitelNotation,
  classifyOmnibus,
  buildStandaloneMetadata,
  buildParentMetadata,
  buildChapterMetadata,
} from '@/lib/agency/afs-registry'

describe('afs-registry', () => {
  describe('registry completeness', () => {
    it('contains all 15 AFS 2023-series documents', () => {
      expect(AFS_REGISTRY).toHaveLength(15)
    })

    it('covers AFS 2023:1 through AFS 2023:15', () => {
      for (let i = 1; i <= 15; i++) {
        const doc = getAfsDocument(`AFS 2023:${i}`)
        expect(doc, `AFS 2023:${i} should exist`).toBeDefined()
      }
    })
  })

  describe('tier classification', () => {
    it('has 6 standalone documents', () => {
      const standalone = getAfsByTier('STANDALONE')
      expect(standalone).toHaveLength(6)
    })

    it('has 3 keep-whole documents', () => {
      const keepWhole = getAfsByTier('KEEP_WHOLE')
      expect(keepWhole).toHaveLength(3)
    })

    it('has 6 split documents', () => {
      const split = getAfsByTier('SPLIT')
      expect(split).toHaveLength(6)
    })

    it('standalone documents: AFS 2023:1, :4, :5, :6, :8, :14', () => {
      const standalone = getAfsByTier('STANDALONE')
      const docNums = standalone.map((d) => d.documentNumber).sort()
      expect(docNums).toEqual([
        'AFS 2023:1',
        'AFS 2023:14',
        'AFS 2023:4',
        'AFS 2023:5',
        'AFS 2023:6',
        'AFS 2023:8',
      ])
    })

    it('keep-whole documents: AFS 2023:3, :7, :12', () => {
      const keepWhole = getAfsByTier('KEEP_WHOLE')
      const docNums = keepWhole.map((d) => d.documentNumber).sort()
      expect(docNums).toEqual(['AFS 2023:12', 'AFS 2023:3', 'AFS 2023:7'])
    })

    it('split documents: AFS 2023:2, :9, :10, :11, :13, :15', () => {
      const split = getAfsByTier('SPLIT')
      const docNums = split.map((d) => d.documentNumber).sort()
      expect(docNums).toEqual([
        'AFS 2023:10',
        'AFS 2023:11',
        'AFS 2023:13',
        'AFS 2023:15',
        'AFS 2023:2',
        'AFS 2023:9',
      ])
    })
  })

  describe('chapter counts', () => {
    it('AFS 2023:2 has 8 chapters (kap. 2-9)', () => {
      const doc = getAfsDocument('AFS 2023:2')!
      expect(doc.chapters).toHaveLength(8)
      expect(doc.chapters[0]!.number).toBe(2)
      expect(doc.chapters[7]!.number).toBe(9)
    })

    it('AFS 2023:9 has 5 chapters (kap. 2-6)', () => {
      const doc = getAfsDocument('AFS 2023:9')!
      expect(doc.chapters).toHaveLength(5)
    })

    it('AFS 2023:10 has 12 chapters (kap. 2-13)', () => {
      const doc = getAfsDocument('AFS 2023:10')!
      expect(doc.chapters).toHaveLength(12)
    })

    it('AFS 2023:11 has 14 chapters (kap. 2-15)', () => {
      const doc = getAfsDocument('AFS 2023:11')!
      expect(doc.chapters).toHaveLength(14)
    })

    it('AFS 2023:13 has 16 chapters (kap. 2-17)', () => {
      const doc = getAfsDocument('AFS 2023:13')!
      expect(doc.chapters).toHaveLength(16)
    })

    it('AFS 2023:15 has 11 chapters (kap. 2-12)', () => {
      const doc = getAfsDocument('AFS 2023:15')!
      expect(doc.chapters).toHaveLength(11)
    })

    it('standalone documents have no chapters', () => {
      const standalone = getAfsByTier('STANDALONE')
      for (const doc of standalone) {
        expect(
          doc.chapters,
          `${doc.documentNumber} should have no chapters`
        ).toHaveLength(0)
      }
    })

    it('keep-whole documents have no chapters (not split)', () => {
      const keepWhole = getAfsByTier('KEEP_WHOLE')
      for (const doc of keepWhole) {
        expect(
          doc.chapters,
          `${doc.documentNumber} should have no chapters`
        ).toHaveLength(0)
      }
    })
  })

  describe('getTotalEntryCount', () => {
    it('returns 81 total entries', () => {
      // 6 standalone + 3 keep-whole + 6 parents + 66 chapters = 81
      expect(getTotalEntryCount()).toBe(81)
    })

    it('split chapters sum to 66', () => {
      const split = getAfsByTier('SPLIT')
      const totalChapters = split.reduce((sum, d) => sum + d.chapters.length, 0)
      expect(totalChapters).toBe(66)
    })
  })

  describe('amendments', () => {
    it('registers all known amendments', () => {
      expect(AFS_AMENDMENTS.length).toBeGreaterThanOrEqual(10)
    })

    it('AFS 2023:10 has consolidatedThrough set', () => {
      const doc = getAfsDocument('AFS 2023:10')!
      expect(doc.consolidatedThrough).toBe('AFS 2025:1')
    })

    it('AFS 2023:1 has no amendments', () => {
      const doc = getAfsDocument('AFS 2023:1')!
      expect(doc.consolidatedThrough).toBeNull()
      expect(doc.amendments).toHaveLength(0)
    })

    it('AFS 2023:3 consolidated through AFS 2024:1', () => {
      const doc = getAfsDocument('AFS 2023:3')!
      expect(doc.consolidatedThrough).toBe('AFS 2024:1')
    })
  })

  describe('formatChapterDocumentNumber', () => {
    it('formats correctly', () => {
      expect(formatChapterDocumentNumber('AFS 2023:10', 3)).toBe(
        'AFS 2023:10 kap. 3'
      )
    })
  })

  describe('formatChapterTitle', () => {
    it('formats correctly', () => {
      expect(
        formatChapterTitle('Risker i arbetsmiljön', 3, 'Vibrationer')
      ).toBe('Risker i arbetsmiljön — kap. 3: Vibrationer')
    })
  })

  describe('generateAfsSlug', () => {
    it('generates slug for standalone', () => {
      expect(generateAfsSlug('AFS 2023:1')).toBe('afs-2023-1')
    })

    it('generates slug for chapter entry', () => {
      expect(generateAfsSlug('AFS 2023:10 kap. 3')).toBe('afs-2023-10-kap-3')
    })
  })

  describe('detectKapitelNotation', () => {
    it('detects kap. notation', () => {
      const result = detectKapitelNotation(
        '1 kap. Allmänna bestämmelser\n2 kap. Buller\n3 kap. Vibrationer'
      )
      expect(result.hasKapitel).toBe(true)
      expect(result.chapterNumbers).toEqual([1, 2, 3])
    })

    it('detects Kapitel notation', () => {
      const result = detectKapitelNotation('Kapitel 1\nKapitel 2')
      expect(result.hasKapitel).toBe(true)
      expect(result.chapterNumbers).toEqual([1, 2])
    })

    it('returns false for flat § notation', () => {
      const result = detectKapitelNotation(
        '1 § Tillämpningsområde\n2 § Definitioner'
      )
      expect(result.hasKapitel).toBe(false)
      expect(result.chapterNumbers).toEqual([])
    })

    it('deduplicates chapter numbers', () => {
      const result = detectKapitelNotation('2 kap. Buller\n2 kap. 3 §')
      expect(result.chapterNumbers).toEqual([2])
    })
  })

  describe('classifyOmnibus', () => {
    it('uses registry tier for known documents', () => {
      const detected = { hasKapitel: true, chapterNumbers: [1, 2, 3] }
      const result = classifyOmnibus('AFS 2023:3', detected)
      expect(result.tier).toBe('KEEP_WHOLE')
      expect(result.registryMatch).toBe(true)
    })

    it('falls back to KEEP_WHOLE for unknown omnibus', () => {
      const detected = { hasKapitel: true, chapterNumbers: [1, 2] }
      const result = classifyOmnibus('AFS 2099:1', detected)
      expect(result.tier).toBe('KEEP_WHOLE')
      expect(result.registryMatch).toBe(false)
    })

    it('classifies unknown non-omnibus as STANDALONE', () => {
      const detected = { hasKapitel: false, chapterNumbers: [] }
      const result = classifyOmnibus('AFS 2099:2', detected)
      expect(result.tier).toBe('STANDALONE')
      expect(result.registryMatch).toBe(false)
    })
  })

  describe('metadata builders', () => {
    it('buildStandaloneMetadata', () => {
      const doc = getAfsDocument('AFS 2023:1')!
      const meta = buildStandaloneMetadata(doc, 'https://av.se/hist/afs-2023-1')
      expect(meta.source).toBe('av.se')
      expect(meta.method).toBe('html-scraping')
      expect(meta.tier).toBe('STANDALONE')
      expect(meta.forfattningshistorik_url).toBe(
        'https://av.se/hist/afs-2023-1'
      )
    })

    it('buildParentMetadata', () => {
      const doc = getAfsDocument('AFS 2023:10')!
      const meta = buildParentMetadata(doc, 'https://av.se/hist/afs-2023-10')
      expect(meta.is_omnibus).toBe(true)
      expect(meta.split_strategy).toBe('chapter')
      expect(meta.chapter_count).toBe(12)
      expect(meta.chapter_documents).toHaveLength(12)
      expect(meta.chapter_documents[0]).toBe('AFS 2023:10 kap. 2')
      expect(meta.has_avdelningar).toBe(true)
      expect(meta.consolidated_through).toBe('AFS 2025:1')
    })

    it('buildChapterMetadata', () => {
      const doc = getAfsDocument('AFS 2023:10')!
      const chapter = doc.chapters[1]! // kap. 3 Vibrationer
      const meta = buildChapterMetadata(doc, chapter)
      expect(meta.tier).toBe('SPLIT_CHAPTER')
      expect(meta.parent_afs).toBe('AFS 2023:10')
      expect(meta.chapter_number).toBe(3)
      expect(meta.chapter_title).toBe('Vibrationer')
    })
  })
})
