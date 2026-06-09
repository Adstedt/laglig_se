import { describe, it, expect } from 'vitest'
import {
  addSection,
  extractSection,
  hasSection,
  updateSection,
  SectionAlreadyExistsError,
  SectionNotFoundError,
  type TiptapDocumentJSON,
  type TiptapNode,
} from '@/lib/documents/update-document-section'

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function h(level: number, text: string): TiptapNode {
  return {
    type: 'heading',
    attrs: { level },
    content: [{ type: 'text', text }],
  }
}

function p(text: string): TiptapNode {
  return { type: 'paragraph', content: [{ type: 'text', text }] }
}

function doc(...content: TiptapNode[]): TiptapDocumentJSON {
  return { type: 'doc', content }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('updateSection', () => {
  it('replaces a level-2 section body and preserves the heading', () => {
    const input = doc(
      h(1, 'Arbetsmiljöpolicy'),
      h(2, 'Syfte'),
      p('Old purpose text.'),
      h(2, 'Ansvar'),
      p('Responsibility text.')
    )
    const result = updateSection(input, 'Syfte', [p('New purpose text.')])
    expect(result.content).toEqual([
      h(1, 'Arbetsmiljöpolicy'),
      h(2, 'Syfte'),
      p('New purpose text.'),
      h(2, 'Ansvar'),
      p('Responsibility text.'),
    ])
  })

  it('terminates at a higher-level heading (h2 section ends at h1)', () => {
    const input = doc(
      h(2, 'Syfte'),
      p('Old purpose.'),
      h(3, 'Nested'),
      p('Nested body — should be replaced too.'),
      h(1, 'Nästa kapitel'),
      p('Untouched.')
    )
    const result = updateSection(input, 'Syfte', [p('New purpose.')])
    expect(result.content).toEqual([
      h(2, 'Syfte'),
      p('New purpose.'),
      h(1, 'Nästa kapitel'),
      p('Untouched.'),
    ])
  })

  it('terminates at a same-level heading (h2 section ends at next h2)', () => {
    const input = doc(h(2, 'A'), p('A body'), h(2, 'B'), p('B body'))
    const result = updateSection(input, 'A', [p('New A body')])
    expect(result.content).toEqual([
      h(2, 'A'),
      p('New A body'),
      h(2, 'B'),
      p('B body'),
    ])
  })

  it('subsumes a lower-level heading nested inside the section', () => {
    const input = doc(
      h(2, 'Syfte'),
      p('Intro.'),
      h(3, 'Delavsnitt'),
      p('Sub body.'),
      h(2, 'Ansvar'),
      p('Resp.')
    )
    const result = updateSection(input, 'Syfte', [p('Rewritten.')])
    expect(result.content).toEqual([
      h(2, 'Syfte'),
      p('Rewritten.'),
      h(2, 'Ansvar'),
      p('Resp.'),
    ])
  })

  it('replaces a section that runs to the end of the document', () => {
    const input = doc(
      h(1, 'Intro'),
      p('Intro body'),
      h(2, 'Slut'),
      p('End body')
    )
    const result = updateSection(input, 'Slut', [p('New end body')])
    expect(result.content).toEqual([
      h(1, 'Intro'),
      p('Intro body'),
      h(2, 'Slut'),
      p('New end body'),
    ])
  })

  it('handles an empty replacement body (heading kept, body emptied)', () => {
    const input = doc(h(2, 'Syfte'), p('Old.'), h(2, 'Next'), p('Keep.'))
    const result = updateSection(input, 'Syfte', [])
    expect(result.content).toEqual([h(2, 'Syfte'), h(2, 'Next'), p('Keep.')])
  })

  it('matches heading text case-insensitively', () => {
    const input = doc(h(2, 'Syfte'), p('Old.'), h(2, 'Next'), p('Keep.'))
    const result = updateSection(input, 'SYFTE', [p('New.')])
    expect(result.content).toEqual([
      h(2, 'Syfte'),
      p('New.'),
      h(2, 'Next'),
      p('Keep.'),
    ])
  })

  it('trims surrounding whitespace on the search term', () => {
    const input = doc(h(2, 'Syfte'), p('Old.'))
    const result = updateSection(input, '  syfte  ', [p('New.')])
    expect(result.content).toEqual([h(2, 'Syfte'), p('New.')])
  })

  it('matches first occurrence when multiple headings share text', () => {
    const input = doc(
      h(2, 'Syfte'),
      p('First.'),
      h(2, 'Mellan'),
      p('Mid.'),
      h(2, 'Syfte'),
      p('Second — untouched.')
    )
    const result = updateSection(input, 'Syfte', [p('Replaced first.')])
    expect(result.content).toEqual([
      h(2, 'Syfte'),
      p('Replaced first.'),
      h(2, 'Mellan'),
      p('Mid.'),
      h(2, 'Syfte'),
      p('Second — untouched.'),
    ])
  })

  it('handles headings whose text is split across multiple text nodes (with marks)', () => {
    const splitHeading: TiptapNode = {
      type: 'heading',
      attrs: { level: 2 },
      content: [
        { type: 'text', text: 'Sy' },
        { type: 'text', marks: [{ type: 'bold' }], text: 'fte' },
      ],
    }
    const input = doc(splitHeading, p('Old.'))
    const result = updateSection(input, 'syfte', [p('New.')])
    expect(result.content).toEqual([splitHeading, p('New.')])
  })

  it('throws SectionNotFoundError with an informative message', () => {
    const input = doc(h(2, 'Syfte'), p('Body'))
    expect(() => updateSection(input, 'Missing', [p('x')])).toThrow(
      SectionNotFoundError
    )
    expect(() => updateSection(input, 'Missing', [p('x')])).toThrow(/Missing/)
  })

  it('throws on empty/whitespace heading', () => {
    const input = doc(h(2, 'Syfte'), p('Body'))
    expect(() => updateSection(input, '   ', [p('x')])).toThrow(
      SectionNotFoundError
    )
  })

  it('does not mutate the input document', () => {
    const input = doc(h(2, 'Syfte'), p('Old.'))
    const snapshot = JSON.parse(JSON.stringify(input))
    updateSection(input, 'Syfte', [p('New.')])
    expect(input).toEqual(snapshot)
  })
})

describe('extractSection', () => {
  it('returns the body of a section without the heading', () => {
    const input = doc(
      h(2, 'Syfte'),
      p('Line 1.'),
      p('Line 2.'),
      h(2, 'Ansvar'),
      p('Resp.')
    )
    expect(extractSection(input, 'Syfte')).toEqual([p('Line 1.'), p('Line 2.')])
  })

  it('returns an empty array when the section body is empty', () => {
    const input = doc(h(2, 'Syfte'), h(2, 'Next'), p('x'))
    expect(extractSection(input, 'Syfte')).toEqual([])
  })

  it('subsumes nested lower-level headings', () => {
    const input = doc(
      h(2, 'Syfte'),
      p('Intro.'),
      h(3, 'Delavsnitt'),
      p('Sub.'),
      h(2, 'Ansvar')
    )
    expect(extractSection(input, 'Syfte')).toEqual([
      p('Intro.'),
      h(3, 'Delavsnitt'),
      p('Sub.'),
    ])
  })

  it('throws SectionNotFoundError when heading missing', () => {
    const input = doc(h(2, 'Syfte'), p('Body'))
    expect(() => extractSection(input, 'Missing')).toThrow(SectionNotFoundError)
  })
})

describe('hasSection', () => {
  it('returns true when heading exists (case-insensitive)', () => {
    const input = doc(h(2, 'Syfte'), p('Body'))
    expect(hasSection(input, 'syfte')).toBe(true)
  })

  it('returns false when heading missing', () => {
    const input = doc(h(2, 'Syfte'))
    expect(hasSection(input, 'Annat')).toBe(false)
  })

  it('returns false for empty search term', () => {
    const input = doc(h(2, 'Syfte'))
    expect(hasSection(input, '')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Story 17.11b — addSection
// ---------------------------------------------------------------------------

describe('addSection', () => {
  it('inserts a new section at the start (at: "start")', () => {
    const input = doc(h(2, 'Syfte'), p('Old.'))
    const result = addSection(input, 'Inledning', 2, [p('Intro.')], {
      at: 'start',
    })
    expect(result.content).toEqual([
      h(2, 'Inledning'),
      p('Intro.'),
      h(2, 'Syfte'),
      p('Old.'),
    ])
  })

  it('appends a new section at the end (at: "end")', () => {
    const input = doc(h(2, 'Syfte'), p('Body.'))
    const result = addSection(input, 'Ansvar', 2, [p('Resp.')], { at: 'end' })
    expect(result.content).toEqual([
      h(2, 'Syfte'),
      p('Body.'),
      h(2, 'Ansvar'),
      p('Resp.'),
    ])
  })

  it('inserts after a target heading (at: "after")', () => {
    const input = doc(h(2, 'Syfte'), p('Purpose.'), h(2, 'Ansvar'), p('Resp.'))
    const result = addSection(input, 'Mellan', 2, [p('Mid.')], {
      at: 'after',
      heading: 'Syfte',
    })
    expect(result.content).toEqual([
      h(2, 'Syfte'),
      p('Purpose.'),
      h(2, 'Mellan'),
      p('Mid.'),
      h(2, 'Ansvar'),
      p('Resp.'),
    ])
  })

  it('inserts after a target section INCLUDING its nested subsections', () => {
    // For at:"after", the new section is placed after the located heading AND
    // all its lower-level subsections (i.e. at bounds.endIdx).
    const input = doc(
      h(2, 'Syfte'),
      p('Purpose intro.'),
      h(3, 'Delsyfte'),
      p('Sub-purpose body.'),
      h(2, 'Ansvar'),
      p('Resp.')
    )
    const result = addSection(input, 'Mellan', 2, [p('Mid.')], {
      at: 'after',
      heading: 'Syfte',
    })
    expect(result.content).toEqual([
      h(2, 'Syfte'),
      p('Purpose intro.'),
      h(3, 'Delsyfte'),
      p('Sub-purpose body.'),
      h(2, 'Mellan'),
      p('Mid.'),
      h(2, 'Ansvar'),
      p('Resp.'),
    ])
  })

  it('inserts before a target heading (at: "before")', () => {
    const input = doc(h(2, 'Syfte'), p('Purpose.'), h(2, 'Ansvar'), p('Resp.'))
    const result = addSection(input, 'Inledning', 2, [p('Intro.')], {
      at: 'before',
      heading: 'Ansvar',
    })
    expect(result.content).toEqual([
      h(2, 'Syfte'),
      p('Purpose.'),
      h(2, 'Inledning'),
      p('Intro.'),
      h(2, 'Ansvar'),
      p('Resp.'),
    ])
  })

  it('matches the position-target heading case-insensitively', () => {
    const input = doc(h(2, 'Syfte'), p('Body.'))
    const result = addSection(input, 'Ny', 2, [p('Ny body.')], {
      at: 'after',
      heading: 'SYFTE',
    })
    expect(result.content).toEqual([
      h(2, 'Syfte'),
      p('Body.'),
      h(2, 'Ny'),
      p('Ny body.'),
    ])
  })

  it('throws SectionAlreadyExistsError when the new heading already exists (case-insensitive)', () => {
    const input = doc(h(2, 'Syfte'), p('Body.'))
    expect(() =>
      addSection(input, 'syfte', 2, [p('x')], { at: 'end' })
    ).toThrow(SectionAlreadyExistsError)
    expect(() =>
      addSection(input, 'SYFTE', 2, [p('x')], { at: 'end' })
    ).toThrow(/SYFTE|syfte/i)
  })

  it('throws SectionNotFoundError when position.heading missing (at: "after")', () => {
    const input = doc(h(2, 'Syfte'), p('Body.'))
    expect(() =>
      addSection(input, 'Ny', 2, [p('x')], {
        at: 'after',
        heading: 'Saknas',
      })
    ).toThrow(SectionNotFoundError)
  })

  it('throws SectionNotFoundError when position.heading missing (at: "before")', () => {
    const input = doc(h(2, 'Syfte'), p('Body.'))
    expect(() =>
      addSection(input, 'Ny', 2, [p('x')], {
        at: 'before',
        heading: 'Saknas',
      })
    ).toThrow(SectionNotFoundError)
  })

  it('trims surrounding whitespace on the new heading text', () => {
    const input = doc(h(2, 'Syfte'), p('Body.'))
    const result = addSection(input, '  Ansvar  ', 2, [p('Resp.')], {
      at: 'end',
    })
    // The heading node carries the trimmed text in its content array.
    expect(result.content).toEqual([
      h(2, 'Syfte'),
      p('Body.'),
      h(2, 'Ansvar'),
      p('Resp.'),
    ])
  })

  it('handles inserting into an empty document at start', () => {
    const input = doc()
    const result = addSection(input, 'Inledning', 2, [p('Body.')], {
      at: 'start',
    })
    expect(result.content).toEqual([h(2, 'Inledning'), p('Body.')])
  })

  it('handles inserting into an empty document at end (== start, no diff)', () => {
    const input = doc()
    const result = addSection(input, 'Inledning', 2, [p('Body.')], {
      at: 'end',
    })
    expect(result.content).toEqual([h(2, 'Inledning'), p('Body.')])
  })

  it('produces a heading node with the requested level', () => {
    const input = doc(h(1, 'Top'))
    const result = addSection(input, 'H3-avsnitt', 3, [p('Body.')], {
      at: 'end',
    })
    expect(result.content).toEqual([
      h(1, 'Top'),
      h(3, 'H3-avsnitt'),
      p('Body.'),
    ])
  })

  it('does not mutate the input document', () => {
    const input = doc(h(2, 'Syfte'), p('Body.'))
    const snapshot = JSON.parse(JSON.stringify(input))
    addSection(input, 'Ansvar', 2, [p('Resp.')], { at: 'end' })
    expect(input).toEqual(snapshot)
  })
})
