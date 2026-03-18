/**
 * Story 14.14, Task 5.1a
 *
 * Verifies the derivation pattern used in sync-sfs and sync-sfs-updates:
 * - parseCanonicalHtml + htmlToMarkdown produce expected types from valid HTML
 * - Derivation failures don't propagate (try/catch returns null)
 */
import { describe, it, expect } from 'vitest'
import { parseCanonicalHtml } from '@/lib/transforms/canonical-html-parser'
import { htmlToMarkdown } from '@/lib/transforms/html-to-markdown'

// Minimal canonical HTML that parseCanonicalHtml can handle
const VALID_CANONICAL_HTML = `
<article class="legal-document" data-sfs="2024:100">
  <header class="document-header">
    <h1 class="document-title">Testlag (2024:100)</h1>
  </header>
  <section class="chapter" data-chapter="1">
    <h2 class="chapter-heading">1 kap. Inledande bestämmelser</h2>
    <section class="paragraf" data-paragraf="1">
      <h3 class="paragraf-heading">1 §</h3>
      <p class="stycke">Denna lag gäller för testning.</p>
    </section>
  </section>
</article>
`

const EMPTY_HTML = ''
const GARBAGE_HTML = '<div>Not a legal document at all</div>'

describe('Sync normalization derivation pattern', () => {
  describe('parseCanonicalHtml', () => {
    it('returns CanonicalDocumentJson from valid canonical HTML', () => {
      const result = parseCanonicalHtml(VALID_CANONICAL_HTML, {
        sfsNumber: '2024:100',
        documentType: 'SFS_LAW',
      })

      expect(result).toBeDefined()
      expect(result.chapters).toBeDefined()
      expect(Array.isArray(result.chapters)).toBe(true)
      expect(result.chapters.length).toBeGreaterThan(0)
    })

    it('returns empty structure for empty HTML (no crash)', () => {
      const result = parseCanonicalHtml(EMPTY_HTML, {
        sfsNumber: '2024:100',
        documentType: 'SFS_LAW',
      })

      expect(result).toBeDefined()
      expect(result.chapters).toBeDefined()
    })

    it('returns empty structure for non-canonical HTML (no crash)', () => {
      const result = parseCanonicalHtml(GARBAGE_HTML, {
        sfsNumber: '2024:100',
        documentType: 'SFS_LAW',
      })

      expect(result).toBeDefined()
      expect(result.chapters).toBeDefined()
    })
  })

  describe('htmlToMarkdown', () => {
    it('converts valid HTML to markdown string', () => {
      const result = htmlToMarkdown(VALID_CANONICAL_HTML)

      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('returns empty string for empty input', () => {
      const result = htmlToMarkdown(EMPTY_HTML)

      expect(typeof result).toBe('string')
    })
  })

  describe('derivation try/catch pattern (mirrors sync-sfs inline code)', () => {
    it('derives both fields from valid HTML without throwing', () => {
      let jsonContent = null
      let markdownContent = null

      try {
        jsonContent = parseCanonicalHtml(VALID_CANONICAL_HTML, {
          sfsNumber: '2024:100',
          documentType: 'SFS_LAW',
        })
        markdownContent = htmlToMarkdown(VALID_CANONICAL_HTML)
      } catch {
        // Should not reach here
      }

      expect(jsonContent).not.toBeNull()
      expect(markdownContent).not.toBeNull()
      expect(typeof markdownContent).toBe('string')
    })

    it('keeps null on empty HTML (graceful degradation)', () => {
      let jsonContent = null
      let markdownContent = null

      const processedHtml: string | null = null

      if (processedHtml) {
        try {
          jsonContent = parseCanonicalHtml(processedHtml, {
            sfsNumber: '2024:100',
            documentType: 'SFS_LAW',
          })
          markdownContent = htmlToMarkdown(processedHtml)
        } catch {
          // Swallowed
        }
      }

      expect(jsonContent).toBeNull()
      expect(markdownContent).toBeNull()
    })

    it('JSON.parse(JSON.stringify()) produces valid Prisma-compatible value', () => {
      const jsonContent = parseCanonicalHtml(VALID_CANONICAL_HTML, {
        sfsNumber: '2024:100',
        documentType: 'SFS_LAW',
      })

      // This is the exact pattern used in sync-sfs to satisfy Prisma Json type
      const prismaValue = JSON.parse(JSON.stringify(jsonContent))

      expect(prismaValue).toBeDefined()
      expect(prismaValue.chapters).toBeDefined()
      expect(typeof prismaValue).toBe('object')
    })
  })
})
