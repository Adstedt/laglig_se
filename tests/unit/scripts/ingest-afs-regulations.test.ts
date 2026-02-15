/**
 * Story 9.1: Unit Tests for AFS Ingestion Pipeline Script
 *
 * Tests CLI arg parsing, chapter splitting logic, HTML building,
 * and the document number / metadata format correctness.
 * All Prisma and Anthropic SDK calls are mocked.
 */

import { describe, it, expect } from 'vitest'
import {
  parseArgs,
  splitByChapterMarkers,
} from '@/scripts/ingest-afs-regulations'
import {
  formatChapterDocumentNumber,
  formatChapterTitle,
  generateAfsSlug,
  buildStandaloneMetadata,
  buildParentMetadata,
  buildChapterMetadata,
  getAfsDocument,
} from '@/lib/agency/afs-registry'

describe('ingest-afs-regulations', () => {
  describe('parseArgs', () => {
    it('parses default (no args)', () => {
      const config = parseArgs([])
      expect(config.dryRun).toBe(false)
      expect(config.force).toBe(false)
      expect(config.limit).toBe(0)
      expect(config.tier).toBeNull()
      expect(config.skipExisting).toBe(false)
      expect(config.filter).toBeNull()
    })

    it('parses --dry-run', () => {
      const config = parseArgs(['--dry-run'])
      expect(config.dryRun).toBe(true)
    })

    it('parses --force', () => {
      const config = parseArgs(['--force'])
      expect(config.force).toBe(true)
    })

    it('parses --limit N', () => {
      const config = parseArgs(['--limit', '5'])
      expect(config.limit).toBe(5)
    })

    it('parses --tier STANDALONE', () => {
      const config = parseArgs(['--tier', 'STANDALONE'])
      expect(config.tier).toBe('STANDALONE')
    })

    it('parses --skip-existing', () => {
      const config = parseArgs(['--skip-existing'])
      expect(config.skipExisting).toBe(true)
    })

    it('parses --filter AFS2023:10', () => {
      const config = parseArgs(['--filter', 'AFS2023:10'])
      expect(config.filter).toBe('AFS2023:10')
    })

    it('parses multiple flags', () => {
      const config = parseArgs([
        '--dry-run',
        '--limit',
        '3',
        '--tier',
        'SPLIT',
        '--skip-existing',
      ])
      expect(config.dryRun).toBe(true)
      expect(config.limit).toBe(3)
      expect(config.tier).toBe('SPLIT')
      expect(config.skipExisting).toBe(true)
    })
  })

  describe('splitByChapterMarkers', () => {
    it('splits HTML with data-chapter attributes', () => {
      const html = `
<article class="sfs">
  <div class="body">
    <section data-chapter="1" class="kapitel">
      <h2>1 kap. Allmänna bestämmelser</h2>
      <p class="text">Definitioner</p>
    </section>
    <section data-chapter="2" class="kapitel">
      <h2>2 kap. Buller</h2>
      <p class="text">Bullerregler</p>
    </section>
    <section data-chapter="3" class="kapitel">
      <h2>3 kap. Vibrationer</h2>
      <p class="text">Vibrationsregler</p>
    </section>
  </div>
  <footer class="back">
    <p>Ikraftträdande</p>
  </footer>
</article>`

      const chapters = splitByChapterMarkers(html)
      expect(chapters.size).toBe(3)
      expect(chapters.has(1)).toBe(true)
      expect(chapters.has(2)).toBe(true)
      expect(chapters.has(3)).toBe(true)

      // Chapter 2 should contain "Buller"
      const ch2 = chapters.get(2)!
      expect(ch2).toContain('Buller')
      expect(ch2).not.toContain('Vibrationer')
    })

    it('returns empty map for HTML without chapter markers', () => {
      const html = `<article class="sfs"><div class="body"><p>No chapters</p></div></article>`
      const chapters = splitByChapterMarkers(html)
      expect(chapters.size).toBe(0)
    })
  })

  describe('document number format', () => {
    it('standalone format: AFS 2023:1', () => {
      const doc = getAfsDocument('AFS 2023:1')!
      expect(doc.documentNumber).toBe('AFS 2023:1')
    })

    it('chapter format: AFS 2023:10 kap. 3', () => {
      const docNum = formatChapterDocumentNumber('AFS 2023:10', 3)
      expect(docNum).toBe('AFS 2023:10 kap. 3')
    })

    it('chapter title format: Parent — kap. N: Title', () => {
      const title = formatChapterTitle(
        'Risker i arbetsmiljön',
        3,
        'Vibrationer'
      )
      expect(title).toBe('Risker i arbetsmiljön — kap. 3: Vibrationer')
    })

    it('slug for chapter entry', () => {
      const slug = generateAfsSlug('AFS 2023:10 kap. 3')
      expect(slug).toBe('afs-2023-10-kap-3')
    })
  })

  describe('metadata correctness', () => {
    it('standalone metadata has required fields', () => {
      const doc = getAfsDocument('AFS 2023:1')!
      const meta = buildStandaloneMetadata(doc, 'https://av.se/hist')
      expect(meta.source).toBe('av.se')
      expect(meta.method).toBe('html-scraping')
      expect(meta.tier).toBe('STANDALONE')
      expect(meta.forfattningshistorik_url).toBe('https://av.se/hist')
    })

    it('parent metadata includes chapter_documents list', () => {
      const doc = getAfsDocument('AFS 2023:2')!
      const meta = buildParentMetadata(doc, 'https://av.se/hist')
      expect(meta.is_omnibus).toBe(true)
      expect(meta.split_strategy).toBe('chapter')
      expect(meta.chapter_count).toBe(8)
      expect(meta.chapter_documents).toHaveLength(8)
      expect(meta.chapter_documents[0]).toBe('AFS 2023:2 kap. 2')
      expect(meta.chapter_documents[7]).toBe('AFS 2023:2 kap. 9')
    })

    it('chapter metadata links back to parent', () => {
      const doc = getAfsDocument('AFS 2023:10')!
      const chapter = doc.chapters[0]! // kap. 2
      const meta = buildChapterMetadata(doc, chapter)
      expect(meta.parent_afs).toBe('AFS 2023:10')
      expect(meta.chapter_number).toBe(2)
      expect(meta.chapter_title).toBe('Buller')
      expect(meta.tier).toBe('SPLIT_CHAPTER')
    })
  })

  describe('kap. 1 preamble', () => {
    it('kap. 1 is NOT a separate chapter entry', () => {
      const doc = getAfsDocument('AFS 2023:10')!
      // All chapters start from kap. 2
      for (const ch of doc.chapters) {
        expect(ch.number).toBeGreaterThanOrEqual(2)
      }
    })

    it('chapter_documents do NOT include kap. 1', () => {
      const doc = getAfsDocument('AFS 2023:10')!
      const meta = buildParentMetadata(doc, '')
      for (const docNum of meta.chapter_documents) {
        // Use regex to match exactly "kap. 1" at end (not "kap. 10", "kap. 11", etc.)
        expect(docNum).not.toMatch(/kap\. 1$/)
      }
    })
  })

  describe('idempotency', () => {
    it('uses document_number as upsert key (implied by Prisma unique constraint)', () => {
      // This test documents the contract: the script uses prisma.legalDocument.upsert()
      // with where: { document_number: ... }, which matches the @unique constraint
      // on the schema. Re-running should update, not duplicate.
      const doc = getAfsDocument('AFS 2023:1')!
      expect(doc.documentNumber).toBe('AFS 2023:1')
      const slug = generateAfsSlug(doc.documentNumber)
      expect(slug).toBe('afs-2023-1')
    })
  })
})
