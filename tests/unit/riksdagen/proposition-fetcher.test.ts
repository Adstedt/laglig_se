import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  extractPropositionRef,
  extractHuvudsakligtInnehall,
  fetchPropositionContext,
} from '@/lib/riksdagen/proposition-fetcher'

// ---------------------------------------------------------------------------
// extractPropositionRef
// ---------------------------------------------------------------------------

describe('extractPropositionRef', () => {
  it('extracts standard prop reference', () => {
    const text =
      'Enligt riksdagens beslut1 föreskrivs Prop. 2024/25:205, bet. 2025/26:FöU4'
    expect(extractPropositionRef(text)).toBe('2024/25:205')
  })

  it('handles lowercase prop.', () => {
    const text = 'Enligt prop. 2024/25:171 föreskrivs att'
    expect(extractPropositionRef(text)).toBe('2024/25:171')
  })

  it('extracts first reference when multiple exist', () => {
    const text = 'Prop. 2024/25:205, prop. 2024/25:169 och prop. 2025/26:28'
    expect(extractPropositionRef(text)).toBe('2024/25:205')
  })

  it('handles extra whitespace after Prop.', () => {
    const text = 'Prop.  2024/25:60 innehåller förslag'
    expect(extractPropositionRef(text)).toBe('2024/25:60')
  })

  it('returns null for förordning (no prop reference)', () => {
    const text =
      'Regeringen föreskriver att 2 kap. 22 a § förordningen (2011:326) ska ha följande lydelse.'
    expect(extractPropositionRef(text)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(extractPropositionRef('')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// extractHuvudsakligtInnehall
// ---------------------------------------------------------------------------

describe('extractHuvudsakligtInnehall', () => {
  it('extracts and strips HTML from huvudsakligt section', () => {
    const text = `Propositionens huvudsakliga innehåll&lt;/P&gt;
&lt;P class="p10 ft3"&gt;I propositionen föreslås att MSB ska byta namn.&lt;/P&gt;
&lt;P class="p11 ft3"&gt;Lagändringarna träder i kraft den 1 januari 2026.&lt;/P&gt;
&lt;DIV id="page_2"&gt;`
    const result = extractHuvudsakligtInnehall(text)
    expect(result).toContain('MSB ska byta namn')
    expect(result).toContain('1 januari 2026')
    expect(result).not.toContain('&lt;')
    expect(result).not.toContain('class=')
  })

  it('returns null when section not found', () => {
    const text =
      'Regeringen föreskriver att paragrafen ska ha följande lydelse.'
    expect(extractHuvudsakligtInnehall(text)).toBeNull()
  })

  it('returns null for empty content after heading', () => {
    const text = 'Propositionens huvudsakliga innehåll   '
    expect(extractHuvudsakligtInnehall(text)).toBeNull()
  })

  it('handles case variation in heading', () => {
    const text =
      'PROPOSITIONENS HUVUDSAKLIGA INNEHÅLL&lt;/P&gt;&lt;P&gt;Viktigt förslag här.&lt;/P&gt;'
    const result = extractHuvudsakligtInnehall(text)
    expect(result).toContain('Viktigt förslag här')
  })
})

// ---------------------------------------------------------------------------
// fetchPropositionContext
// ---------------------------------------------------------------------------

describe('fetchPropositionContext', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('returns full context from search + text APIs', async () => {
    const searchResponse = {
      dokumentlista: {
        dokument: [
          {
            titel: 'Begränsad tillgång till lustgas',
            organ: 'Socialdepartementet',
            datum: '2025-04-01',
            dok_id: 'HC03127',
            dokument_url_text: '//data.riksdagen.se/dokument/HC03127.text',
          },
        ],
      },
    }

    const textResponse = `Propositionens huvudsakliga innehåll&lt;/P&gt;
&lt;P&gt;I propositionen föreslås en ny lag om lustgas.&lt;/P&gt;
&lt;DIV id="page_2"&gt;`

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(searchResponse),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        text: () => Promise.resolve(textResponse),
      } as Response)

    const result = await fetchPropositionContext('2024/25:127')

    expect(result).not.toBeNull()
    expect(result!.id).toBe('2024/25:127')
    expect(result!.title).toBe('Begränsad tillgång till lustgas')
    expect(result!.organ).toBe('Socialdepartementet')
    expect(result!.summary).toContain('ny lag om lustgas')
    expect(result!.datum).toEqual(new Date('2025-04-01'))
  })

  it('returns context with null summary when text API fails', async () => {
    const searchResponse = {
      dokumentlista: {
        dokument: [
          {
            titel: 'Test proposition',
            organ: 'Justitiedepartementet',
            datum: '2025-01-01',
            dok_id: 'HC03999',
          },
        ],
      },
    }

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(searchResponse),
      } as Response)
      .mockResolvedValueOnce({ ok: false } as Response)

    const result = await fetchPropositionContext('2024/25:999')

    expect(result).not.toBeNull()
    expect(result!.title).toBe('Test proposition')
    expect(result!.summary).toBeNull()
  })

  it('returns null when search API returns no results', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ dokumentlista: { dokument: [] } }),
    } as unknown as Response)

    const result = await fetchPropositionContext('2024/25:000')
    expect(result).toBeNull()
  })

  it('returns null when search API fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
    } as Response)

    const result = await fetchPropositionContext('2024/25:000')
    expect(result).toBeNull()
  })

  it('returns null on network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'))

    const result = await fetchPropositionContext('2024/25:000')
    expect(result).toBeNull()
  })

  it('returns null when search result has no titel', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          dokumentlista: { dokument: [{ titel: null, organ: null }] },
        }),
    } as unknown as Response)

    const result = await fetchPropositionContext('2024/25:000')
    expect(result).toBeNull()
  })
})
