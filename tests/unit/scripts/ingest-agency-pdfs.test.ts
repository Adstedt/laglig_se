/**
 * Story 9.2: Unit Tests for Agency PDF Ingestion Script
 *
 * Tests the core logic patterns without making real LLM or database calls.
 * Verifies: registry selection, slug generation, metadata building,
 * validator compatibility with agency document numbers.
 */

import { describe, it, expect } from 'vitest'
import {
  getRegistryByAuthority,
  generateAgencySlug,
  generateArticleId,
  getPdfFileName,
  buildAgencyMetadata,
  MSBFS_REGISTRY,
  NFS_REGISTRY,
} from '@/lib/agency/agency-pdf-registry'
import {
  AGENCY_REGULATION_SYSTEM_PROMPT,
  getAgencyPdfUserPrompt,
  AGENCY_MAX_TOKENS,
  AGENCY_DEFAULT_MODEL,
} from '@/lib/agency/agency-regulation-prompt'
import {
  validateLlmOutput,
  cleanRawOutput,
  needsManualReview,
} from '@/lib/sfs/llm-output-validator'

describe('ingest-agency-pdfs pipeline logic', () => {
  describe('--authority flag selects correct registry', () => {
    it('msbfs returns 12 documents', () => {
      const docs = getRegistryByAuthority('msbfs')
      expect(docs).toHaveLength(12)
      expect(docs[0]!.documentNumber).toBe('MSBFS 2010:4')
    })

    it('nfs returns 13 documents', () => {
      const docs = getRegistryByAuthority('nfs')
      expect(docs).toHaveLength(13)
      expect(docs[0]!.documentNumber).toBe('NFS 2001:2')
    })
  })

  describe('slug generation for agency documents', () => {
    it('generates slug for MSBFS', () => {
      expect(generateAgencySlug('MSBFS 2020:1')).toBe('msbfs-2020-1')
    })

    it('generates slug for NFS', () => {
      expect(generateAgencySlug('NFS 2023:13')).toBe('nfs-2023-13')
    })

    it('slugs are unique across both registries', () => {
      const allDocs = [...MSBFS_REGISTRY, ...NFS_REGISTRY]
      const slugs = allDocs.map((d) => generateAgencySlug(d.documentNumber))
      const uniqueSlugs = new Set(slugs)
      expect(uniqueSlugs.size).toBe(slugs.length)
    })
  })

  describe('validateLlmOutput works for agency document numbers', () => {
    const sampleHtml = `<article class="sfs" id="MSBFS2020-1">
      <div class="lovhead"><h1><p class="text">MSBFS 2020:1</p></h1></div>
      <div class="body">
        <h3 class="paragraph"><a class="paragraf" id="MSBFS2020-1_P1" name="MSBFS2020-1_P1">1 §</a></h3>
        <p class="text">Test paragraph content for validation.</p>
        <section class="ann"><p class="text">More content.</p></section>
      </div>
      <footer class="back"><h2>Ikraftträdande</h2><p class="text">Träder i kraft.</p></footer>
    </article>`

    it('validates valid MSBFS HTML output', () => {
      const result = validateLlmOutput(sampleHtml, 'MSBFS 2020:1')
      expect(result.valid).toBe(true)
      expect(result.cleanedHtml).toBeTruthy()
    })

    it('validates valid NFS HTML output', () => {
      const nfsHtml = sampleHtml
        .replace(/MSBFS2020-1/g, 'NFS2023-2')
        .replace(/MSBFS 2020:1/g, 'NFS 2023:2')
      const result = validateLlmOutput(nfsHtml, 'NFS 2023:2')
      expect(result.valid).toBe(true)
    })

    it('strips markdown fences from Claude output', () => {
      const withFences = '```html\n' + sampleHtml + '\n```'
      const cleaned = cleanRawOutput(withFences)
      expect(cleaned).toContain('<article')
      expect(cleaned).not.toContain('```')
    })

    it('detects missing article.sfs as error', () => {
      const badHtml = '<div>No article element</div>'
      const result = validateLlmOutput(badHtml, 'MSBFS 2020:1')
      expect(result.valid).toBe(false)
    })

    it('flags empty output', () => {
      const result = validateLlmOutput('', 'MSBFS 2020:1')
      expect(result.valid).toBe(false)
    })

    it('needsManualReview flags invalid output', () => {
      const result = validateLlmOutput('<div>bad</div>', 'MSBFS 2020:1')
      expect(needsManualReview(result)).toBe(true)
    })
  })

  describe('prompt construction', () => {
    it('system prompt references all required CSS classes', () => {
      const requiredClasses = [
        'sfs',
        'lovhead',
        'body',
        'kapitel',
        'paragraf',
        'allmanna-rad',
        'legal-table',
        'footnote-ref',
        'back',
        'appendices',
      ]
      for (const cls of requiredClasses) {
        expect(AGENCY_REGULATION_SYSTEM_PROMPT).toContain(cls)
      }
    })

    it('user prompt includes article ID without spaces', () => {
      const prompt = getAgencyPdfUserPrompt('MSBFS 2020:1', 'Test', 'msbfs')
      expect(prompt).toContain('MSBFS2020-1')
      expect(prompt).not.toContain('Article ID: MSBFS 2020-1')
    })
  })

  describe('metadata building', () => {
    it('sets method to claude-pdf-ingestion', () => {
      const doc = MSBFS_REGISTRY[0]!
      const meta = buildAgencyMetadata(doc, { input: 1000, output: 500 }, 0.1)
      expect(meta.method).toBe('claude-pdf-ingestion')
    })

    it('includes token usage and cost', () => {
      const doc = NFS_REGISTRY[0]!
      const meta = buildAgencyMetadata(doc, { input: 5000, output: 3000 }, 0.25)
      expect(meta.tokenUsage).toEqual({ input: 5000, output: 3000 })
      expect(meta.cost).toBe(0.25)
    })

    it('sets tier to STANDALONE', () => {
      const doc = MSBFS_REGISTRY[0]!
      const meta = buildAgencyMetadata(doc, { input: 0, output: 0 }, 0)
      expect(meta.tier).toBe('STANDALONE')
    })
  })

  describe('cost estimation', () => {
    it('model uses Sonnet 4.5', () => {
      expect(AGENCY_DEFAULT_MODEL).toBe('claude-sonnet-4-5-20250929')
    })

    it('standard max tokens is 64000', () => {
      expect(AGENCY_MAX_TOKENS.standard).toBe(64000)
    })
  })

  describe('PDF file naming', () => {
    it('all MSBFS PDFs have expected filenames', () => {
      for (const doc of MSBFS_REGISTRY) {
        const fileName = getPdfFileName(doc.documentNumber)
        expect(fileName).toMatch(/^MSBFS-\d{4}-\d+\.pdf$/)
      }
    })

    it('all NFS PDFs have expected filenames', () => {
      for (const doc of NFS_REGISTRY) {
        const fileName = getPdfFileName(doc.documentNumber)
        expect(fileName).toMatch(/^NFS-\d{4}-\d+\.pdf$/)
      }
    })
  })

  describe('article ID generation', () => {
    it('all MSBFS article IDs follow pattern', () => {
      for (const doc of MSBFS_REGISTRY) {
        const id = generateArticleId(doc.documentNumber)
        expect(id).toMatch(/^MSBFS\d{4}-\d+$/)
      }
    })

    it('all NFS article IDs follow pattern', () => {
      for (const doc of NFS_REGISTRY) {
        const id = generateArticleId(doc.documentNumber)
        expect(id).toMatch(/^NFS\d{4}-\d+$/)
      }
    })
  })
})
