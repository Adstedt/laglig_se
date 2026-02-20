/**
 * Tests for Zod Schema Validation
 * Story 14.1, Task 7 (AC: 24)
 */

import { describe, it, expect } from 'vitest'
import { validateCanonicalJson } from '@/lib/transforms/validate-document-json'
import type { CanonicalDocumentJson } from '@/lib/transforms/document-json-schema'

// ============================================================================
// Helper
// ============================================================================

function validDoc(
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
        sections: [
          {
            number: '1',
            heading: null,
            paragraphs: [
              { number: null, text: 'Denna lag gäller.', role: 'PARAGRAPH' },
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

// ============================================================================
// Tests
// ============================================================================

describe('validateCanonicalJson', () => {
  it('validates a correct document', () => {
    const result = validateCanonicalJson(validDoc())
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects missing schemaVersion', () => {
    const doc = validDoc()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (doc as any).schemaVersion
    const result = validateCanonicalJson(doc)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('schemaVersion')
  })

  it('rejects invalid document type', () => {
    const doc = validDoc()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(doc as any).documentType = 'INVALID_TYPE'
    const result = validateCanonicalJson(doc)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('documentType')
  })

  it('rejects invalid content role', () => {
    const doc = validDoc()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(doc.chapters[0]!.sections[0]!.paragraphs[0] as any).role = 'BAD_ROLE'
    const result = validateCanonicalJson(doc)
    expect(result.valid).toBe(false)
  })

  it('enforces divisions/chapters mutual exclusivity', () => {
    const doc = validDoc({
      divisions: [
        {
          number: '1',
          title: 'Avd 1',
          chapters: [
            {
              number: '1',
              title: 'Kap 1',
              sections: [],
            },
          ],
        },
      ],
      // chapters should be empty when divisions is populated
      chapters: [{ number: '1', title: 'Wrong', sections: [] }],
    })
    const result = validateCanonicalJson(doc)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('mutually exclusive')
  })

  it('allows divisions with empty chapters array', () => {
    const doc = validDoc({
      divisions: [
        {
          number: '1',
          title: 'Avd 1',
          chapters: [
            {
              number: '1',
              title: 'Kap 1',
              sections: [],
            },
          ],
        },
      ],
      chapters: [],
    })
    const result = validateCanonicalJson(doc)
    expect(result.valid).toBe(true)
  })

  it('provides path in error messages', () => {
    const doc = validDoc()
    doc.chapters[0]!.sections[0]!.paragraphs[0]!.text = 123 as unknown as string
    const result = validateCanonicalJson(doc)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('chapters')
  })

  it('rejects non-object input', () => {
    const result = validateCanonicalJson('not an object')
    expect(result.valid).toBe(false)
  })

  it('validates document with all optional fields populated', () => {
    const doc = validDoc({
      preamble: { htmlContent: '<p>Preamble</p>', text: 'Preamble' },
      transitionProvisions: [
        { number: null, text: 'Träder i kraft.', role: 'TRANSITION_PROVISION' },
      ],
      appendices: [
        {
          title: 'Bilaga 1',
          htmlContent: '<p>Content</p>',
          text: 'Content',
        },
      ],
    })
    const result = validateCanonicalJson(doc)
    expect(result.valid).toBe(true)
  })
})
