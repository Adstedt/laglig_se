/**
 * Integration tests for discover-sfs-amendments cron
 *
 * Story 8.20: Continuous SFS Amendment Discovery
 *
 * Tests the two-phase discovery logic: index parsing + pagination,
 * watermark filtering, dedup, document classification, and enrichment.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  discoverFromIndex,
  classifyDocument,
  extractBaseLawSfs,
  extractSfsNumericPart,
} from '@/lib/sfs/sfs-amendment-crawler'

// =============================================================================
// Mock helpers
// =============================================================================

function makeIndexPageHtml(
  year: number,
  items: { num: number; title: string; date: string }[],
  nextPage?: number
): string {
  const rows = items
    .map(
      (item) => `
    <tr>
      <td><span data-lable="SFS-nummer">${year}:${item.num}</span></td>
      <td><span data-lable="Rubrik"><a href="doc/${year}${item.num}.html">${item.title}</a></span></td>
      <td><span data-lable="Publicerad">${item.date}</span></td>
    </tr>`
    )
    .join('\n')

  const pagination = nextPage
    ? `<li class="next"><a href="regulations%3Fpage=${nextPage}.html">Next</a></li>`
    : ''

  return `<html><body><table>${rows}</table>${pagination}</body></html>`
}

function createMockFetch(pages: Map<string, string>): typeof fetch {
  return vi.fn(async (input: string | URL | Request) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url
    const html = pages.get(url)
    if (!html) {
      return new Response('Not Found', { status: 404 })
    }
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
    })
  }) as unknown as typeof fetch
}

// =============================================================================
// Tests
// =============================================================================

describe('discover-sfs-amendments integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  // ---------------------------------------------------------------------------
  // discoverFromIndex — basic discovery
  // ---------------------------------------------------------------------------

  describe('discoverFromIndex', () => {
    it('discovers documents from the index page with correct enrichment', async () => {
      const year = 2026
      const pages = new Map<string, string>()

      pages.set(
        `https://svenskforfattningssamling.se/regulations/${year}/index.html`,
        makeIndexPageHtml(year, [
          {
            num: 10,
            title: 'Lag om ändring i lagen (2020:100)',
            date: '2026-02-01',
          },
          { num: 9, title: 'Lag om tilläggsskatt', date: '2026-01-30' },
          {
            num: 8,
            title: 'Lag om upphävande av lagen (2019:50)',
            date: '2026-01-28',
          },
        ])
      )

      const result = await discoverFromIndex(year, {
        requestDelayMs: 0,
        fetchFn: createMockFetch(pages),
      })

      expect(result.documents).toHaveLength(3)
      expect(result.pagesScanned).toBe(1)
      expect(result.highestNumericPart).toBe(10)

      // Check enrichment
      const amendment = result.documents.find((d) => d.sfsNumber === '2026:10')!
      expect(amendment.documentType).toBe('amendment')
      expect(amendment.baseLawSfs).toBe('2020:100')
      expect(amendment.pdfUrl).toContain('SFS2026-10.pdf')
      expect(amendment.htmlUrl).toContain('202610.html')
      expect(amendment.publishedDate).toBe('2026-02-01')

      const newLaw = result.documents.find((d) => d.sfsNumber === '2026:9')!
      expect(newLaw.documentType).toBe('new_law')
      expect(newLaw.baseLawSfs).toBeNull()

      const repeal = result.documents.find((d) => d.sfsNumber === '2026:8')!
      expect(repeal.documentType).toBe('repeal')
      expect(repeal.baseLawSfs).toBe('2019:50')
    })

    it('filters documents above watermark', async () => {
      const year = 2026
      const pages = new Map<string, string>()

      pages.set(
        `https://svenskforfattningssamling.se/regulations/${year}/index.html`,
        makeIndexPageHtml(year, [
          {
            num: 10,
            title: 'Lag om ändring i lagen (2020:100)',
            date: '2026-02-01',
          },
          { num: 9, title: 'Lag om tilläggsskatt', date: '2026-01-30' },
          {
            num: 8,
            title: 'Lag om ändring i lagen (2019:50)',
            date: '2026-01-28',
          },
        ])
      )

      const result = await discoverFromIndex(year, {
        afterNumericPart: 8,
        requestDelayMs: 0,
        fetchFn: createMockFetch(pages),
      })

      // Only 9 and 10 should be above watermark of 8
      expect(result.documents).toHaveLength(2)
      expect(result.documents.map((d) => d.sfsNumber)).toEqual([
        '2026:10',
        '2026:9',
      ])
      expect(result.highestNumericPart).toBe(10)
    })

    it('returns empty documents when watermark equals highest', async () => {
      const year = 2026
      const pages = new Map<string, string>()
      pages.set(
        `https://svenskforfattningssamling.se/regulations/${year}/index.html`,
        makeIndexPageHtml(year, [
          {
            num: 50,
            title: 'Lag om ändring i lagen (2020:50)',
            date: '2026-02-01',
          },
          {
            num: 49,
            title: 'Lag om ändring i lagen (2020:49)',
            date: '2026-02-01',
          },
        ])
      )

      const result = await discoverFromIndex(year, {
        afterNumericPart: 50,
        requestDelayMs: 0,
        fetchFn: createMockFetch(pages),
      })

      expect(result.documents).toHaveLength(0)
      expect(result.highestNumericPart).toBe(50)
    })
  })

  // ---------------------------------------------------------------------------
  // Pagination
  // ---------------------------------------------------------------------------

  describe('pagination', () => {
    it('follows pagination to discover more documents', async () => {
      const year = 2026
      const pages = new Map<string, string>()

      // Page 1: SFS 30, 29 (with next page link)
      pages.set(
        `https://svenskforfattningssamling.se/regulations/${year}/index.html`,
        makeIndexPageHtml(
          year,
          [
            {
              num: 30,
              title: 'Lag om ändring i lagen (2020:30)',
              date: '2026-02-15',
            },
            {
              num: 29,
              title: 'Lag om ändring i lagen (2020:29)',
              date: '2026-02-14',
            },
          ],
          2
        )
      )

      // Page 2: SFS 28, 27
      pages.set(
        `https://svenskforfattningssamling.se/regulations/${year}/index.html%3Fpage=2.html`,
        makeIndexPageHtml(year, [
          {
            num: 28,
            title: 'Lag om ändring i lagen (2020:28)',
            date: '2026-02-13',
          },
          {
            num: 27,
            title: 'Lag om ändring i lagen (2020:27)',
            date: '2026-02-12',
          },
        ])
      )

      const result = await discoverFromIndex(year, {
        requestDelayMs: 0,
        fetchFn: createMockFetch(pages),
      })

      expect(result.pagesScanned).toBe(2)
      expect(result.documents).toHaveLength(4)
      expect(result.documents.map((d) => d.numericPart)).toEqual([
        30, 29, 28, 27,
      ])
    })

    it('stops paginating when all rows are below watermark', async () => {
      const year = 2026
      const pages = new Map<string, string>()

      // Page 1: SFS 30, 29 (some above watermark=28, with next page link)
      pages.set(
        `https://svenskforfattningssamling.se/regulations/${year}/index.html`,
        makeIndexPageHtml(
          year,
          [
            {
              num: 30,
              title: 'Lag om ändring i lagen (2020:30)',
              date: '2026-02-15',
            },
            {
              num: 29,
              title: 'Lag om ändring i lagen (2020:29)',
              date: '2026-02-14',
            },
          ],
          2
        )
      )

      // Page 2: SFS 28, 27 — all at or below watermark of 28
      pages.set(
        `https://svenskforfattningssamling.se/regulations/${year}/index.html%3Fpage=2.html`,
        makeIndexPageHtml(
          year,
          [
            {
              num: 28,
              title: 'Lag om ändring i lagen (2020:28)',
              date: '2026-02-13',
            },
            {
              num: 27,
              title: 'Lag om ändring i lagen (2020:27)',
              date: '2026-02-12',
            },
          ],
          3
        )
      )

      // Page 3 should NOT be fetched
      pages.set(
        `https://svenskforfattningssamling.se/regulations/${year}/index.html%3Fpage=3.html`,
        makeIndexPageHtml(year, [
          {
            num: 26,
            title: 'Lag om ändring i lagen (2020:26)',
            date: '2026-02-11',
          },
        ])
      )

      const mockFetch = createMockFetch(pages)
      const result = await discoverFromIndex(year, {
        afterNumericPart: 28,
        requestDelayMs: 0,
        fetchFn: mockFetch,
      })

      // Should have scanned 2 pages, stopped because page 2 was all <= watermark
      expect(result.pagesScanned).toBe(2)
      // Only SFS 29 and 30 are above watermark
      expect(result.documents).toHaveLength(2)

      // Verify page 3 was never fetched
      const calls = (mockFetch as ReturnType<typeof vi.fn>).mock.calls
      const fetchedUrls = calls.map((c: unknown[]) => c[0] as string)
      expect(fetchedUrls).not.toContain(expect.stringContaining('page=3'))
    })

    it('deduplicates documents across pages', async () => {
      const year = 2026
      const pages = new Map<string, string>()

      // Same document appears on both pages (edge case: overlapping pagination)
      pages.set(
        `https://svenskforfattningssamling.se/regulations/${year}/index.html`,
        makeIndexPageHtml(
          year,
          [
            {
              num: 10,
              title: 'Lag om ändring i lagen (2020:10)',
              date: '2026-02-01',
            },
            {
              num: 9,
              title: 'Lag om ändring i lagen (2020:9)',
              date: '2026-01-30',
            },
          ],
          2
        )
      )

      pages.set(
        `https://svenskforfattningssamling.se/regulations/${year}/index.html%3Fpage=2.html`,
        makeIndexPageHtml(year, [
          {
            num: 9,
            title: 'Lag om ändring i lagen (2020:9)',
            date: '2026-01-30',
          },
          {
            num: 8,
            title: 'Lag om ändring i lagen (2020:8)',
            date: '2026-01-28',
          },
        ])
      )

      const result = await discoverFromIndex(year, {
        requestDelayMs: 0,
        fetchFn: createMockFetch(pages),
      })

      // SFS 9 should appear only once despite being on both pages
      expect(result.documents).toHaveLength(3)
      const sfsNumbers = result.documents.map((d) => d.sfsNumber)
      expect(sfsNumbers).toEqual(['2026:10', '2026:9', '2026:8'])
    })
  })

  // ---------------------------------------------------------------------------
  // Document classification
  // ---------------------------------------------------------------------------

  describe('document type filtering', () => {
    it('classifies amendments, repeals, and new laws correctly', async () => {
      const year = 2026
      const pages = new Map<string, string>()
      pages.set(
        `https://svenskforfattningssamling.se/regulations/${year}/index.html`,
        makeIndexPageHtml(year, [
          {
            num: 3,
            title: 'Lag om ändring i arbetsmiljölagen (1977:1160)',
            date: '2026-02-01',
          },
          { num: 2, title: 'Lag om tilläggsskatt', date: '2026-01-30' },
          {
            num: 1,
            title: 'Lag om upphävande av lagen (2019:50)',
            date: '2026-01-28',
          },
        ])
      )

      const result = await discoverFromIndex(year, {
        requestDelayMs: 0,
        fetchFn: createMockFetch(pages),
      })

      const amendments = result.documents.filter(
        (d) => d.documentType === 'amendment'
      )
      const newLaws = result.documents.filter(
        (d) => d.documentType === 'new_law'
      )
      const repeals = result.documents.filter(
        (d) => d.documentType === 'repeal'
      )

      expect(amendments).toHaveLength(1)
      expect(amendments[0]!.baseLawSfs).toBe('1977:1160')

      expect(newLaws).toHaveLength(1)
      expect(newLaws[0]!.baseLawSfs).toBeNull()

      expect(repeals).toHaveLength(1)
      expect(repeals[0]!.baseLawSfs).toBe('2019:50')
    })
  })

  // ---------------------------------------------------------------------------
  // Numeric watermark comparison
  // ---------------------------------------------------------------------------

  describe('numeric watermark comparison', () => {
    it('correctly ranks SFS numbers numerically, not lexicographically', () => {
      const sfsNumbers = ['2026:9', '2026:80', '2026:42', '2026:3', '2026:100']
      const max = Math.max(...sfsNumbers.map((s) => extractSfsNumericPart(s)))
      expect(max).toBe(100)

      // String comparison would give wrong result
      const strMax = sfsNumbers.reduce((a, b) => (a > b ? a : b))
      expect(strMax).toBe('2026:9') // WRONG — this is why we use numeric comparison
    })
  })

  // ---------------------------------------------------------------------------
  // ChangeEvent creation logic
  // ---------------------------------------------------------------------------

  describe('ChangeEvent creation logic', () => {
    it('amendment documents produce the correct base law SFS', () => {
      const title = 'Lag om ändring i lagen (2023:875) om tilläggsskatt'
      const type = classifyDocument(title)
      const baseLaw = extractBaseLawSfs(title)

      expect(type).toBe('amendment')
      expect(baseLaw).toBe('2023:875')
    })

    it('repeal documents produce the correct base law SFS', () => {
      const title =
        'Lag om upphävande av lagen (2020:123) om tillfälliga åtgärder'
      const type = classifyDocument(title)
      const baseLaw = extractBaseLawSfs(title)

      expect(type).toBe('repeal')
      expect(baseLaw).toBe('2020:123')
    })

    it('new law documents have no base law', () => {
      const title = 'Lag om tilläggsskatt'
      const type = classifyDocument(title)
      const baseLaw = extractBaseLawSfs(title)

      expect(type).toBe('new_law')
      expect(baseLaw).toBeNull()
    })
  })

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles empty index page gracefully', async () => {
      const year = 2026
      const pages = new Map<string, string>()
      pages.set(
        `https://svenskforfattningssamling.se/regulations/${year}/index.html`,
        '<html><body><table></table></body></html>'
      )

      const result = await discoverFromIndex(year, {
        requestDelayMs: 0,
        fetchFn: createMockFetch(pages),
      })

      expect(result.documents).toHaveLength(0)
      expect(result.highestNumericPart).toBe(0)
      expect(result.pagesScanned).toBe(1)
    })

    it('handles 404 for index page gracefully', async () => {
      const year = 2026
      const pages = new Map<string, string>() // No pages registered

      const result = await discoverFromIndex(year, {
        requestDelayMs: 0,
        fetchFn: createMockFetch(pages),
      })

      expect(result.documents).toHaveLength(0)
      expect(result.highestNumericPart).toBe(0)
      expect(result.pagesScanned).toBe(1)
    })

    it('no individual doc page fetches are made (fast discovery)', async () => {
      const year = 2026
      const pages = new Map<string, string>()
      pages.set(
        `https://svenskforfattningssamling.se/regulations/${year}/index.html`,
        makeIndexPageHtml(year, [
          {
            num: 5,
            title: 'Lag om ändring i lagen (2020:5)',
            date: '2026-02-01',
          },
          {
            num: 4,
            title: 'Lag om ändring i lagen (2020:4)',
            date: '2026-01-30',
          },
          {
            num: 3,
            title: 'Lag om ändring i lagen (2020:3)',
            date: '2026-01-28',
          },
        ])
      )

      const mockFetch = createMockFetch(pages)
      await discoverFromIndex(year, {
        requestDelayMs: 0,
        fetchFn: mockFetch,
      })

      // Verify ONLY the index page was fetched, no /doc/ pages
      const calls = (mockFetch as ReturnType<typeof vi.fn>).mock.calls
      const fetchedUrls = calls.map((c: unknown[]) => c[0] as string)

      expect(fetchedUrls).toHaveLength(1)
      expect(fetchedUrls[0]).toContain('/regulations/')
      expect(
        fetchedUrls.filter((u: string) => u.includes('/doc/'))
      ).toHaveLength(0)
    })
  })
})
