import { describe, it, expect } from 'vitest'
import { parseCitations, createCitationsFromContext } from '@/lib/ai/citations'

describe('parseCitations', () => {
  it('returns empty segments for empty string', () => {
    const result = parseCitations('')
    expect(result.segments).toEqual([])
    expect(result.citationNumbers).toEqual([])
  })

  it('returns text segment for string without citations', () => {
    const result = parseCitations('This is plain text')
    expect(result.segments).toEqual([
      { type: 'text', content: 'This is plain text' },
    ])
    expect(result.citationNumbers).toEqual([])
  })

  it('parses single citation', () => {
    const result = parseCitations('According to [1] this is true.')
    expect(result.segments).toEqual([
      { type: 'text', content: 'According to ' },
      { type: 'citation', content: '1' },
      { type: 'text', content: ' this is true.' },
    ])
    expect(result.citationNumbers).toEqual([1])
  })

  it('parses multiple citations', () => {
    const result = parseCitations('See [1] and [2] for more info.')
    expect(result.segments).toEqual([
      { type: 'text', content: 'See ' },
      { type: 'citation', content: '1' },
      { type: 'text', content: ' and ' },
      { type: 'citation', content: '2' },
      { type: 'text', content: ' for more info.' },
    ])
    expect(result.citationNumbers).toEqual([1, 2])
  })

  it('handles citation at start of text', () => {
    const result = parseCitations('[1] is the first citation.')
    expect(result.segments[0]).toEqual({ type: 'citation', content: '1' })
  })

  it('handles citation at end of text', () => {
    const result = parseCitations('See reference [1]')
    expect(result.segments[result.segments.length - 1]).toEqual({
      type: 'citation',
      content: '1',
    })
  })

  it('handles consecutive citations', () => {
    const result = parseCitations('[1][2][3]')
    expect(result.citationNumbers).toEqual([1, 2, 3])
  })

  it('handles double-digit citations', () => {
    const result = parseCitations('See [10] and [12]')
    expect(result.citationNumbers).toEqual([10, 12])
  })
})

describe('createCitationsFromContext', () => {
  it('creates citations from context array', () => {
    const context = [
      {
        id: 'law-1',
        title: 'Arbetsmiljölagen',
        sfsNumber: 'SFS 1977:1160',
        content:
          'This is the content of the law that goes on for a while and should be truncated if too long.',
      },
      {
        id: 'law-2',
        title: 'GDPR',
        sfsNumber: 'EU 2016/679',
        content: 'Short content.',
      },
    ]

    const citations = createCitationsFromContext(context)

    expect(citations).toHaveLength(2)
    expect(citations[0]).toMatchObject({
      id: 'law-1',
      number: 1,
      lawTitle: 'Arbetsmiljölagen',
      sfsNumber: 'SFS 1977:1160',
      lawId: 'law-1',
    })
    expect(citations[1]).toMatchObject({
      id: 'law-2',
      number: 2,
      lawTitle: 'GDPR',
      sfsNumber: 'EU 2016/679',
    })
  })

  it('truncates long snippets', () => {
    const context = [
      {
        id: 'law-1',
        title: 'Test Law',
        sfsNumber: 'SFS 2024:1',
        content: 'A'.repeat(200), // 200 characters
      },
    ]

    const citations = createCitationsFromContext(context)

    expect(citations[0].snippet.length).toBeLessThanOrEqual(103) // 100 + "..."
    expect(citations[0].snippet.endsWith('...')).toBe(true)
  })

  it('returns empty array for empty context', () => {
    const citations = createCitationsFromContext([])
    expect(citations).toEqual([])
  })
})
