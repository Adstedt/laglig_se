/**
 * Tests for document chunking pipeline
 * Story 14.2, Task 8 (AC: 17)
 */

import { describe, it, expect } from 'vitest'
import {
  chunkDocument,
  type ChunkDocumentInput,
} from '@/lib/chunks/chunk-document'
import type { CanonicalDocumentJson } from '@/lib/transforms/document-json-schema'
import { estimateTokenCount } from '@/lib/chunks/token-count'

// ============================================================================
// Helpers
// ============================================================================

function makeJson(
  overrides: Partial<CanonicalDocumentJson> = {}
): CanonicalDocumentJson {
  return {
    schemaVersion: '1.0',
    documentType: 'SFS_LAW',
    title: 'Testlag',
    documentNumber: 'SFS 2025:1',
    divisions: null,
    chapters: [
      {
        number: '1',
        title: 'Inledning',
        paragrafer: [
          {
            number: '1',
            heading: null,
            content: 'Denna lag gäller för alla.',
            amendedBy: null,
            stycken: [
              { number: 1, text: 'Denna lag gäller för alla.', role: 'STYCKE' },
            ],
          },
          {
            number: '2',
            heading: 'Tillämpning',
            content: 'Lagen tillämpas på arbetsgivare.',
            amendedBy: 'SFS 2024:100',
            stycken: [
              {
                number: 1,
                text: 'Lagen tillämpas på arbetsgivare.',
                role: 'STYCKE',
              },
            ],
          },
        ],
      },
      {
        number: '2',
        title: 'Skyldigheter',
        paragrafer: [
          {
            number: '1',
            heading: null,
            content: 'Arbetsgivaren ska vidta åtgärder.',
            amendedBy: null,
            stycken: [
              {
                number: 1,
                text: 'Arbetsgivaren ska vidta åtgärder.',
                role: 'STYCKE',
              },
            ],
          },
        ],
      },
    ],
    preamble: null,
    transitionProvisions: null,
    appendices: null,
    metadata: {
      sfsNumber: 'SFS 2025:1',
      baseLawSfs: null,
      effectiveDate: null,
    },
    ...overrides,
  }
}

function makeInput(
  overrides: Partial<ChunkDocumentInput> = {}
): ChunkDocumentInput {
  return {
    documentId: 'doc-123',
    title: 'Testlag',
    documentNumber: 'SFS 2025:1',
    contentType: 'SFS_LAW',
    slug: 'testlag-20251-2025-1',
    jsonContent: makeJson(),
    markdownContent: null,
    htmlContent: null,
    ...overrides,
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('chunkDocument', () => {
  describe('Tier 1: Paragraf-level chunking', () => {
    it('creates one chunk per paragraf for chaptered document', () => {
      const chunks = chunkDocument(makeInput())
      // 2 paragrafer in ch1 + 1 in ch2 = 3
      expect(chunks).toHaveLength(3)
      expect(chunks.every((c) => c.source_type === 'LEGAL_DOCUMENT')).toBe(true)
      expect(chunks.every((c) => c.source_id === 'doc-123')).toBe(true)
      expect(chunks.every((c) => c.workspace_id === null)).toBe(true)
    })

    it('generates correct paths for chaptered documents', () => {
      const chunks = chunkDocument(makeInput())
      expect(chunks[0]!.path).toBe('kap1.§1')
      expect(chunks[1]!.path).toBe('kap1.§2')
      expect(chunks[2]!.path).toBe('kap2.§1')
    })

    it('uses kap0 for flat documents (implicit chapter)', () => {
      const json = makeJson({
        chapters: [
          {
            number: null,
            title: null,
            paragrafer: [
              {
                number: '5',
                heading: null,
                content: 'Paragraf fem.',
                amendedBy: null,
                stycken: [{ number: 1, text: 'Paragraf fem.', role: 'STYCKE' }],
              },
            ],
          },
        ],
      })
      const chunks = chunkDocument(makeInput({ jsonContent: json }))
      expect(chunks[0]!.path).toBe('kap0.§5')
    })

    it('generates correct contextual header for chaptered doc', () => {
      const chunks = chunkDocument(makeInput())
      expect(chunks[0]!.contextual_header).toBe(
        'Testlag (SFS 2025:1) > Kap 1: Inledning > 1 §'
      )
      expect(chunks[2]!.contextual_header).toBe(
        'Testlag (SFS 2025:1) > Kap 2: Skyldigheter > 1 §'
      )
    })

    it('omits chapter from header for flat docs', () => {
      const json = makeJson({
        chapters: [
          {
            number: null,
            title: null,
            paragrafer: [
              {
                number: '1',
                heading: null,
                content: 'Text.',
                amendedBy: null,
                stycken: [{ number: 1, text: 'Text.', role: 'STYCKE' }],
              },
            ],
          },
        ],
      })
      const chunks = chunkDocument(makeInput({ jsonContent: json }))
      expect(chunks[0]!.contextual_header).toBe('Testlag (SFS 2025:1) > 1 §')
    })

    it('propagates dominant content role', () => {
      const json = makeJson({
        chapters: [
          {
            number: '1',
            title: 'Test',
            paragrafer: [
              {
                number: '1',
                heading: null,
                content: 'Allmänt råd.',
                amendedBy: null,
                stycken: [
                  { number: 1, text: 'Allmänt råd.', role: 'ALLMANT_RAD' },
                  { number: 2, text: 'Mer råd.', role: 'ALLMANT_RAD' },
                ],
              },
            ],
          },
        ],
      })
      const chunks = chunkDocument(makeInput({ jsonContent: json }))
      expect(chunks[0]!.content_role).toBe('ALLMANT_RAD')
    })

    it('defaults to STYCKE for mixed roles', () => {
      const json = makeJson({
        chapters: [
          {
            number: '1',
            title: 'Test',
            paragrafer: [
              {
                number: '1',
                heading: null,
                content: 'Mixed content.',
                amendedBy: null,
                stycken: [
                  { number: 1, text: 'Text.', role: 'STYCKE' },
                  { number: 2, text: 'Tabell.', role: 'TABLE' },
                ],
              },
            ],
          },
        ],
      })
      const chunks = chunkDocument(makeInput({ jsonContent: json }))
      expect(chunks[0]!.content_role).toBe('STYCKE')
    })

    it('sets tokenCount matching stored content (including heading)', () => {
      const chunks = chunkDocument(makeInput())
      // First chunk has no heading — token_count matches content
      expect(chunks[0]!.token_count).toBe(
        estimateTokenCount(chunks[0]!.content)
      )
      // Second chunk has heading 'Tillämpning' — token_count must include it
      expect(chunks[1]!.token_count).toBe(
        estimateTokenCount(chunks[1]!.content)
      )
      expect(chunks[1]!.content).toContain('Tillämpning')
    })

    it('includes amendedBy in metadata', () => {
      const chunks = chunkDocument(makeInput())
      // Second paragraf has amendedBy + base fields
      expect(chunks[1]!.metadata).toEqual({
        documentNumber: 'SFS 2025:1',
        contentType: 'SFS_LAW',
        slug: 'testlag-20251-2025-1',
        anchorId: 'SFS2025-1_K1_P2',
        amendedBy: 'SFS 2024:100',
        heading: 'Tillämpning',
      })
    })

    it('includes heading in content when present', () => {
      const chunks = chunkDocument(makeInput())
      expect(chunks[1]!.content).toContain('Tillämpning')
      expect(chunks[1]!.content).toContain('Lagen tillämpas på arbetsgivare.')
    })

    it('handles divisions (3-level hierarchy)', () => {
      const json = makeJson({
        divisions: [
          {
            number: '1',
            title: 'Avd 1',
            chapters: [
              {
                number: '3',
                title: 'Kap tre',
                paragrafer: [
                  {
                    number: '7',
                    heading: null,
                    content: 'Division content.',
                    amendedBy: null,
                    stycken: [
                      { number: 1, text: 'Division content.', role: 'STYCKE' },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        chapters: [],
      })
      const chunks = chunkDocument(makeInput({ jsonContent: json }))
      expect(chunks).toHaveLength(1)
      expect(chunks[0]!.path).toBe('kap3.§7')
      expect(chunks[0]!.contextual_header).toContain('Kap 3')
    })
  })

  describe('Tier 2: Non-§ content', () => {
    it('chunks transition provisions', () => {
      const json = makeJson({
        transitionProvisions: [
          {
            number: 1,
            text: 'Denna lag träder i kraft den 1 januari 2025.',
            role: 'TRANSITION_PROVISION',
          },
          {
            number: 2,
            text: 'Äldre föreskrifter gäller fortfarande.',
            role: 'TRANSITION_PROVISION',
          },
        ],
      })
      const chunks = chunkDocument(makeInput({ jsonContent: json }))
      const tp = chunks.find((c) => c.path === 'overgangsbest')
      expect(tp).toBeDefined()
      expect(tp!.content_role).toBe('TRANSITION_PROVISION')
      expect(tp!.content).toContain('Denna lag träder i kraft')
      expect(tp!.content).toContain('Äldre föreskrifter')
      expect(tp!.contextual_header).toContain('Övergångsbestämmelser')
    })

    it('chunks preamble', () => {
      const json = makeJson({
        preamble: {
          htmlContent: '<p>Inledande text</p>',
          text: 'Inledande text till denna förordning.',
        },
      })
      const chunks = chunkDocument(makeInput({ jsonContent: json }))
      const pre = chunks.find((c) => c.path === 'preamble')
      expect(pre).toBeDefined()
      expect(pre!.content_role).toBe('STYCKE')
      expect(pre!.contextual_header).toContain('Inledning')
    })

    it('chunks appendices with 1-indexed paths', () => {
      const json = makeJson({
        appendices: [
          {
            title: 'Bilaga 1',
            htmlContent: '<p>Appendix content</p>',
            text: 'Appendix one content that is long enough.',
          },
          {
            title: 'Bilaga 2',
            htmlContent: '<p>Second</p>',
            text: 'Second appendix content that is long enough.',
          },
        ],
      })
      const chunks = chunkDocument(makeInput({ jsonContent: json }))
      const b1 = chunks.find((c) => c.path === 'bilaga.1')
      const b2 = chunks.find((c) => c.path === 'bilaga.2')
      expect(b1).toBeDefined()
      expect(b2).toBeDefined()
      expect(b1!.contextual_header).toContain('Bilaga 1')
      expect(b2!.contextual_header).toContain('Bilaga 2')
    })
  })

  describe('Tier 3: Markdown fallback', () => {
    it('falls back to markdown when JSON has 0 paragrafer', () => {
      const json = makeJson({
        chapters: [{ number: null, title: null, paragrafer: [] }],
      })
      const markdown =
        'First paragraph about something important.\n\nSecond paragraph about regulations.'
      const chunks = chunkDocument(
        makeInput({ jsonContent: json, markdownContent: markdown })
      )
      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks.every((c) => c.content_role === 'MARKDOWN_CHUNK')).toBe(
        true
      )
      expect(chunks[0]!.path).toBe('md.chunk1')
    })

    it('falls back when jsonContent is null', () => {
      const markdown = 'Some legal text.\n\nAnother paragraph of legal text.'
      const chunks = chunkDocument(
        makeInput({ jsonContent: null, markdownContent: markdown })
      )
      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0]!.content_role).toBe('MARKDOWN_CHUNK')
    })

    it('merges small paragraphs to reach target size', () => {
      // Create many small paragraphs
      const paragraphs = Array.from(
        { length: 10 },
        (_, i) => `Short paragraph ${i + 1}.`
      )
      const markdown = paragraphs.join('\n\n')
      const chunks = chunkDocument(
        makeInput({ jsonContent: null, markdownContent: markdown })
      )
      // Should merge into fewer chunks than 10
      expect(chunks.length).toBeLessThan(10)
      expect(chunks.length).toBeGreaterThan(0)
    })

    it('does not merge across headings', () => {
      const markdown =
        'Intro text before heading.\n\n## New Section\n\nText after heading.'
      const chunks = chunkDocument(
        makeInput({ jsonContent: null, markdownContent: markdown })
      )
      // Heading should force a split
      const headingChunk = chunks.find((c) =>
        c.content.includes('## New Section')
      )
      expect(headingChunk).toBeDefined()
      // Intro should not be in the same chunk as heading
      expect(headingChunk!.content).not.toContain('Intro text before heading')
    })

    it('filters out tiny chunks (< 20 chars)', () => {
      const markdown = 'A\n\nB\n\nThis is a long enough paragraph to be kept.'
      const chunks = chunkDocument(
        makeInput({ jsonContent: null, markdownContent: markdown })
      )
      // "A" and "B" alone are < 20 chars — but they get merged, so the test
      // verifies no chunk has content < 20 chars
      for (const chunk of chunks) {
        expect(chunk.content.length).toBeGreaterThanOrEqual(MIN_CHUNK_CHARS)
      }
    })

    it('returns empty array when no content at all', () => {
      const chunks = chunkDocument(
        makeInput({
          jsonContent: null,
          markdownContent: null,
          htmlContent: null,
        })
      )
      expect(chunks).toEqual([])
    })

    it('falls back to htmlToPlainText when only HTML is available', () => {
      const json = makeJson({
        chapters: [{ number: null, title: null, paragrafer: [] }],
      })
      const chunks = chunkDocument(
        makeInput({
          jsonContent: json,
          markdownContent: null,
          htmlContent: '<p>HTML only content that should be extracted.</p>',
        })
      )
      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks[0]!.content).toContain('HTML only content')
    })

    it('uses contextual header with just title and document number', () => {
      const markdown =
        'Long enough paragraph of legal text for markdown fallback chunking.'
      const chunks = chunkDocument(
        makeInput({ jsonContent: null, markdownContent: markdown })
      )
      expect(chunks[0]!.contextual_header).toBe('Testlag (SFS 2025:1)')
    })

    it('splits oversized paragraphs exceeding cap threshold (~1000 tokens)', () => {
      // Generate a single paragraph > 1000 tokens (~4000+ chars)
      // Use sentences ending with ". " followed by uppercase to give splitOversized a boundary
      const sentences = Array.from(
        { length: 60 },
        (_, i) =>
          `Denna bestämmelse nummer ${i + 1} reglerar arbetsgivarens skyldigheter avseende arbetsmiljön och skyddet för arbetstagare.`
      )
      const bigParagraph = sentences.join(' ')
      // Verify our test data actually exceeds the cap
      expect(bigParagraph.length).toBeGreaterThan(4000) // >1000 tokens
      // Single block, no \n\n splits — forces the oversized cap path
      const chunks = chunkDocument(
        makeInput({ jsonContent: null, markdownContent: bigParagraph })
      )
      // Should be split into multiple chunks, each <= ~1000 tokens
      expect(chunks.length).toBeGreaterThan(1)
      for (const chunk of chunks) {
        expect(chunk.token_count).toBeLessThanOrEqual(1100) // allow small margin
        expect(chunk.content_role).toBe('MARKDOWN_CHUNK')
      }
    })
  })

  describe('Token counting', () => {
    it('estimateTokenCount returns ~chars/4', () => {
      expect(estimateTokenCount('')).toBe(0)
      expect(estimateTokenCount('abcd')).toBe(1)
      expect(estimateTokenCount('a'.repeat(100))).toBe(25)
      // Ceiling
      expect(estimateTokenCount('abc')).toBe(1)
    })
  })

  describe('Fix 1: Oversized non-§ content splitting', () => {
    it('keeps small transition provisions as a single chunk', () => {
      const json = makeJson({
        transitionProvisions: [
          {
            number: 1,
            text: '2025:1\nDenna lag träder i kraft den 1 januari 2025.',
            role: 'TRANSITION_PROVISION',
          },
        ],
      })
      const chunks = chunkDocument(makeInput({ jsonContent: json }))
      const tp = chunks.filter((c) => c.path.startsWith('overgangsbest'))
      expect(tp).toHaveLength(1)
      expect(tp[0]!.path).toBe('overgangsbest')
    })

    it('splits oversized transition provisions at SFS-number boundaries', () => {
      // Generate many transition entries that exceed 1000 tokens total (need >4000 chars)
      const entries: string[] = []
      for (let year = 2000; year <= 2025; year++) {
        entries.push(
          `${year}:${100 + year - 2000}\nDenna lag träder i kraft den 1 januari ${year}. Äldre föreskrifter gäller fortfarande för förmåner som avser tid före ikraftträdandet av denna lagändring och alla tillhörande bestämmelser som har meddelats med stöd av den upphävda lagen. Den som har påbörjat en utbildning enligt äldre föreskrifter har rätt att slutföra utbildningen.`
        )
      }
      const fullText = entries.join('\n')
      // Verify test data exceeds cap
      expect(estimateTokenCount(fullText)).toBeGreaterThan(1000)

      const json = makeJson({
        transitionProvisions: [
          { number: 1, text: fullText, role: 'TRANSITION_PROVISION' },
        ],
      })
      const chunks = chunkDocument(makeInput({ jsonContent: json }))
      const tp = chunks.filter((c) => c.path.startsWith('overgangsbest'))

      expect(tp.length).toBeGreaterThan(1)
      // Each sub-chunk should be within cap
      for (const chunk of tp) {
        expect(chunk.token_count).toBeLessThanOrEqual(1100)
        expect(chunk.content_role).toBe('TRANSITION_PROVISION')
      }
      // Paths should be numbered
      expect(tp[0]!.path).toBe('overgangsbest.1')
      expect(tp[1]!.path).toBe('overgangsbest.2')
      // Headers should include SFS number
      expect(tp[0]!.contextual_header).toContain('Övergångsbestämmelser')
    })

    it('splits oversized appendix into sub-chunks', () => {
      // Generate a large appendix > 1000 tokens (need >4000 chars since token = chars/4)
      const paragraphs = Array.from(
        { length: 40 },
        (_, i) =>
          `Punkt ${i + 1}. Denna bestämmelse reglerar hantering av kemiska ämnen och farliga produkter i arbetsmiljön samt skydd för arbetstagare enligt gällande föreskrifter och riktlinjer för säkerhet på arbetsplatsen.`
      )
      const bigAppendix = paragraphs.join('\n\n')
      expect(estimateTokenCount(bigAppendix)).toBeGreaterThan(1000)

      const json = makeJson({
        appendices: [{ title: 'Bilaga 1', htmlContent: '', text: bigAppendix }],
      })
      const chunks = chunkDocument(makeInput({ jsonContent: json }))
      const bilagor = chunks.filter((c) => c.path.startsWith('bilaga.1'))

      expect(bilagor.length).toBeGreaterThan(1)
      // Sub-chunks should be numbered
      expect(bilagor[0]!.path).toBe('bilaga.1.1')
      expect(bilagor[1]!.path).toBe('bilaga.1.2')
      for (const chunk of bilagor) {
        expect(chunk.token_count).toBeLessThanOrEqual(1100)
        expect(chunk.contextual_header).toContain('Bilaga 1')
      }
    })

    it('splits oversized preamble into sub-chunks', () => {
      const paragraphs = Array.from(
        { length: 40 },
        (_, i) =>
          `Stycke ${i + 1} av inledningen till denna förordning som beskriver bakgrunden och syftet med lagstiftningen i detalj och som anger de principer som ska tillämpas vid genomförandet av bestämmelserna.`
      )
      const bigPreamble = paragraphs.join('\n\n')
      expect(estimateTokenCount(bigPreamble)).toBeGreaterThan(1000)

      const json = makeJson({
        preamble: { htmlContent: '', text: bigPreamble },
      })
      const chunks = chunkDocument(makeInput({ jsonContent: json }))
      const preambles = chunks.filter((c) => c.path.startsWith('preamble'))

      expect(preambles.length).toBeGreaterThan(1)
      expect(preambles[0]!.path).toBe('preamble.1')
      expect(preambles[1]!.path).toBe('preamble.2')
      for (const chunk of preambles) {
        expect(chunk.token_count).toBeLessThanOrEqual(1100)
        expect(chunk.contextual_header).toContain('Inledning')
      }
    })
  })

  describe('Fix 2: Duplicate path deduplication', () => {
    it('appends .v2 for duplicate paragraf paths', () => {
      // Simulate two paragrafer with the same number (current + future version)
      const json = makeJson({
        chapters: [
          {
            number: '6',
            title: 'Samverkan',
            paragrafer: [
              {
                number: '17',
                heading: null,
                content:
                  '/Upphör att gälla U:2028-07-01/ Nuvarande version av paragraf 17.',
                amendedBy: null,
                stycken: [
                  {
                    number: 1,
                    text: '/Upphör att gälla U:2028-07-01/ Nuvarande version.',
                    role: 'STYCKE',
                  },
                ],
              },
              {
                number: '17',
                heading: null,
                content:
                  '/Träder i kraft I:2028-07-01/ Framtida version av paragraf 17.',
                amendedBy: 'SFS 2025:732',
                stycken: [
                  {
                    number: 1,
                    text: '/Träder i kraft I:2028-07-01/ Framtida version.',
                    role: 'STYCKE',
                  },
                ],
              },
            ],
          },
        ],
      })
      const chunks = chunkDocument(makeInput({ jsonContent: json }))
      const paths = chunks.map((c) => c.path)
      expect(paths).toContain('kap6.§17')
      expect(paths).toContain('kap6.§17.v2')
      // No further duplicates
      expect(new Set(paths).size).toBe(paths.length)
    })

    it('handles multiple duplicates (.v2, .v3)', () => {
      const json = makeJson({
        chapters: [
          {
            number: '1',
            title: 'Test',
            paragrafer: [
              {
                number: '1',
                heading: null,
                content: 'Version A.',
                amendedBy: null,
                stycken: [{ number: 1, text: 'Version A.', role: 'STYCKE' }],
              },
              {
                number: '1',
                heading: null,
                content: 'Version B.',
                amendedBy: null,
                stycken: [{ number: 1, text: 'Version B.', role: 'STYCKE' }],
              },
              {
                number: '1',
                heading: null,
                content: 'Version C.',
                amendedBy: null,
                stycken: [{ number: 1, text: 'Version C.', role: 'STYCKE' }],
              },
            ],
          },
        ],
      })
      const chunks = chunkDocument(makeInput({ jsonContent: json }))
      const paths = chunks.map((c) => c.path)
      expect(paths).toEqual(['kap1.§1', 'kap1.§1.v2', 'kap1.§1.v3'])
    })

    it('does not modify unique paths', () => {
      const chunks = chunkDocument(makeInput())
      const paths = chunks.map((c) => c.path)
      // Default fixture has kap1.§1, kap1.§2, kap2.§1 — all unique
      expect(paths).toEqual(['kap1.§1', 'kap1.§2', 'kap2.§1'])
    })
  })
})

// Re-export for the filter test
const MIN_CHUNK_CHARS = 20
