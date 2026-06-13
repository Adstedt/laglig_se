/**
 * Story 17.20, Task 4.1: paragraph-preserving plaintext ↔ paragraph-nodes
 * helpers. The whole point of these helpers (vs. the existing space-joining
 * flatteners) is that they preserve paragraph boundaries and round-trip
 * paragraphs-only content idempotently.
 */

import { describe, it, expect } from 'vitest'
import {
  tiptapParagraphsToText,
  textToTiptapParagraphs,
  isParagraphsOnly,
} from '@/lib/utils/tiptap-text'

const para = (text: string) => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
})

describe('tiptapParagraphsToText', () => {
  it('joins paragraph blocks with a blank line (preserves boundaries)', () => {
    const nodes = [para('Första stycket.'), para('Andra stycket.')]
    expect(tiptapParagraphsToText(nodes)).toBe(
      'Första stycket.\n\nAndra stycket.'
    )
  })

  it('concatenates inline text runs inside a paragraph without a separator', () => {
    const nodes = [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Hej ' },
          { type: 'text', text: 'världen', marks: [{ type: 'bold' }] },
        ],
      },
    ]
    expect(tiptapParagraphsToText(nodes)).toBe('Hej världen')
  })

  it('returns an empty string for non-array / empty input', () => {
    expect(tiptapParagraphsToText(undefined)).toBe('')
    expect(tiptapParagraphsToText([])).toBe('')
  })

  it('separates block-level children (list items) with a newline — not run-together (AC 6 read-only preview)', () => {
    const list = [
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'i kök.' }],
              },
            ],
          },
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Städutrustning märks.' }],
              },
            ],
          },
        ],
      },
    ]
    // Must NOT collapse to "i kök.Städutrustning märks."
    expect(tiptapParagraphsToText(list)).toBe('i kök.\nStädutrustning märks.')
  })
})

describe('textToTiptapParagraphs', () => {
  it('splits blank-line-separated text into paragraph nodes', () => {
    expect(textToTiptapParagraphs('Ett.\n\nTvå.')).toEqual([
      para('Ett.'),
      para('Två.'),
    ])
  })

  it('drops empty blocks and trims whitespace', () => {
    expect(textToTiptapParagraphs('  Ett.  \n\n\n\n  Två.  ')).toEqual([
      para('Ett.'),
      para('Två.'),
    ])
    expect(textToTiptapParagraphs('   ')).toEqual([])
  })
})

describe('round-trip stability (paragraphs-only)', () => {
  it('text → nodes → text is idempotent', () => {
    const nodes = [para('1 gång per år.'), para('Andra raden.')]
    const text = tiptapParagraphsToText(nodes)
    const rewrapped = textToTiptapParagraphs(text)
    expect(rewrapped).toEqual(nodes)
    expect(tiptapParagraphsToText(rewrapped)).toBe(text)
  })
})

describe('isParagraphsOnly', () => {
  it('is true for a non-empty paragraphs-only array', () => {
    expect(isParagraphsOnly([para('a'), para('b')])).toBe(true)
  })

  it('is false for empty / non-array input', () => {
    expect(isParagraphsOnly([])).toBe(false)
    expect(isParagraphsOnly(undefined)).toBe(false)
    expect(isParagraphsOnly(null)).toBe(false)
  })

  it('is false when any block is a list / heading / table', () => {
    expect(isParagraphsOnly([para('a'), { type: 'bulletList' }])).toBe(false)
    expect(isParagraphsOnly([{ type: 'heading' }])).toBe(false)
    expect(isParagraphsOnly([{ type: 'table' }])).toBe(false)
  })
})
