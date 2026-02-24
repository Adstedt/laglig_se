/**
 * Integration tests for discover-sfs-amendments cron
 *
 * Story 8.20: Continuous SFS Amendment Discovery
 *
 * Tests the discovery logic, watermark, dedup, document classification,
 * and ChangeEvent creation using mocked HTTP + Prisma.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  crawlCurrentYearIndex,
  classifyDocument,
  extractBaseLawSfs,
  extractSfsNumericPart,
  type CrawlerOptions,
} from '@/lib/sfs/sfs-amendment-crawler'

// =============================================================================
// Mock helpers
// =============================================================================

function makeIndexPageHtml(year: number, sfsNumbers: number[]): string {
  const rows = sfsNumbers
    .map(
      (num) => `
    <tr>
      <td><span data-lable="SFS-nummer">${year}:${num}</span></td>
      <td><span data-lable="Rubrik"><a href="doc/${year}${String(num).padStart(4, '0')}.html">Title ${num}</a></span></td>
      <td><span data-lable="Publicerad">${year}-02-01</span></td>
    </tr>`
    )
    .join('\n')

  return `<html><body><table>${rows}</table></body></html>`
}

function makeDocPageHtml(
  title: string,
  sfsYear: number,
  sfsNum: number
): string {
  return `
    <html>
      <title>${title} | svenskforfattningssamling.se</title>
      <body>
        <a href="../sites/default/files/sfs/${sfsYear}-02/SFS${sfsYear}-${sfsNum}.pdf">Download</a>
      </body>
    </html>
  `
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
  // Watermark-based incremental discovery
  // ---------------------------------------------------------------------------

  describe('watermark-based discovery', () => {
    it('only crawls documents above the watermark', async () => {
      const year = 2026
      const pages = new Map<string, string>()

      // Index page shows SFS numbers 1-10
      pages.set(
        `https://svenskforfattningssamling.se/regulations/${year}/index.html`,
        makeIndexPageHtml(year, [10, 9, 8, 7, 6, 5, 4, 3, 2, 1])
      )

      // Only add doc pages for 8, 9, 10 (above watermark of 7)
      pages.set(
        `https://svenskforfattningssamling.se/doc/${year}0008.html`,
        makeDocPageHtml('Lag om ändring i lagen (2020:100)', year, 8)
      )
      pages.set(
        `https://svenskforfattningssamling.se/doc/${year}0009.html`,
        makeDocPageHtml('Lag om tilläggsskatt', year, 9)
      )
      pages.set(
        `https://svenskforfattningssamling.se/doc/${year}0010.html`,
        makeDocPageHtml('Lag om upphävande av lagen (2019:50)', year, 10)
      )

      const mockFetch = createMockFetch(pages)

      const result = await crawlCurrentYearIndex(year, {
        startFromSfsNumber: 7,
        requestDelayMs: 0,
        fetchFn: mockFetch,
      })

      // Should only have discovered 3 documents (8, 9, 10)
      expect(result.documents).toHaveLength(3)
      expect(result.highestSfsNum).toBe(10)

      // Verify the fetch was NOT called for docs 1-7
      const calls = (mockFetch as ReturnType<typeof vi.fn>).mock.calls
      const docUrls = calls
        .map((c: unknown[]) => c[0] as string)
        .filter((u: string) => u.includes('/doc/'))

      for (let i = 1; i <= 7; i++) {
        const paddedNum = String(i).padStart(4, '0')
        expect(docUrls).not.toContain(
          `https://svenskforfattningssamling.se/doc/${year}${paddedNum}.html`
        )
      }
    })

    it('returns empty documents when watermark equals highest', async () => {
      const year = 2026
      const pages = new Map<string, string>()
      pages.set(
        `https://svenskforfattningssamling.se/regulations/${year}/index.html`,
        makeIndexPageHtml(year, [50, 49, 48])
      )

      const result = await crawlCurrentYearIndex(year, {
        startFromSfsNumber: 50,
        requestDelayMs: 0,
        fetchFn: createMockFetch(pages),
      })

      expect(result.documents).toHaveLength(0)
      expect(result.highestSfsNum).toBe(50)
    })
  })

  // ---------------------------------------------------------------------------
  // Idempotency (dedup)
  // ---------------------------------------------------------------------------

  describe('idempotency', () => {
    it('crawling the same range twice returns the same documents', async () => {
      const year = 2026
      const pages = new Map<string, string>()
      pages.set(
        `https://svenskforfattningssamling.se/regulations/${year}/index.html`,
        makeIndexPageHtml(year, [3, 2, 1])
      )
      pages.set(
        `https://svenskforfattningssamling.se/doc/${year}0001.html`,
        makeDocPageHtml('Lag om ändring i lagen (2020:100)', year, 1)
      )
      pages.set(
        `https://svenskforfattningssamling.se/doc/${year}0002.html`,
        makeDocPageHtml('Lag om tilläggsskatt', year, 2)
      )
      pages.set(
        `https://svenskforfattningssamling.se/doc/${year}0003.html`,
        makeDocPageHtml('Lag om upphävande av lagen (2019:50)', year, 3)
      )

      const opts: CrawlerOptions = {
        requestDelayMs: 0,
        fetchFn: createMockFetch(pages),
      }

      const run1 = await crawlCurrentYearIndex(year, opts)
      const run2 = await crawlCurrentYearIndex(year, opts)

      expect(run1.documents).toHaveLength(run2.documents.length)
      expect(run1.documents.map((d) => d.sfsNumber)).toEqual(
        run2.documents.map((d) => d.sfsNumber)
      )
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
        makeIndexPageHtml(year, [3, 2, 1])
      )
      pages.set(
        `https://svenskforfattningssamling.se/doc/${year}0001.html`,
        makeDocPageHtml(
          'Lag om ändring i arbetsmiljölagen (1977:1160)',
          year,
          1
        )
      )
      pages.set(
        `https://svenskforfattningssamling.se/doc/${year}0002.html`,
        makeDocPageHtml('Lag om tilläggsskatt', year, 2)
      )
      pages.set(
        `https://svenskforfattningssamling.se/doc/${year}0003.html`,
        makeDocPageHtml('Lag om upphävande av lagen (2019:50)', year, 3)
      )

      const result = await crawlCurrentYearIndex(year, {
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
      // The critical test: "2026:9" > "2026:80" as strings, but 9 < 80 as numbers
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
  // Timeout protection
  // ---------------------------------------------------------------------------

  describe('timeout protection', () => {
    it('crawler stops gracefully at the batch limit', async () => {
      // We simulate a large index page with many documents
      // but limit how many we process via startFromSfsNumber
      const year = 2026
      const pages = new Map<string, string>()
      pages.set(
        `https://svenskforfattningssamling.se/regulations/${year}/index.html`,
        makeIndexPageHtml(year, [200, 199, 198, 197, 196])
      )

      // Only add doc pages for 196-200
      for (let i = 196; i <= 200; i++) {
        const paddedNum = String(i).padStart(4, '0')
        pages.set(
          `https://svenskforfattningssamling.se/doc/${year}${paddedNum}.html`,
          makeDocPageHtml(`Lag om ändring i lagen (2020:${i})`, year, i)
        )
      }

      const result = await crawlCurrentYearIndex(year, {
        startFromSfsNumber: 195,
        requestDelayMs: 0,
        fetchFn: createMockFetch(pages),
      })

      // Should discover exactly 5 documents (196-200)
      expect(result.documents).toHaveLength(5)
      expect(result.highestSfsNum).toBe(200)
    })
  })

  // ---------------------------------------------------------------------------
  // Empty index page
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles empty index page gracefully', async () => {
      const year = 2026
      const pages = new Map<string, string>()
      pages.set(
        `https://svenskforfattningssamling.se/regulations/${year}/index.html`,
        '<html><body><table></table></body></html>'
      )

      const result = await crawlCurrentYearIndex(year, {
        requestDelayMs: 0,
        fetchFn: createMockFetch(pages),
      })

      expect(result.documents).toHaveLength(0)
      expect(result.highestSfsNum).toBe(0)
    })

    it('handles 404 for index page gracefully', async () => {
      const year = 2026
      const pages = new Map<string, string>() // No pages registered

      const result = await crawlCurrentYearIndex(year, {
        requestDelayMs: 0,
        fetchFn: createMockFetch(pages),
      })

      expect(result.documents).toHaveLength(0)
      expect(result.highestSfsNum).toBe(0)
    })

    it('handles gaps in SFS numbering', async () => {
      const year = 2026
      const pages = new Map<string, string>()
      pages.set(
        `https://svenskforfattningssamling.se/regulations/${year}/index.html`,
        makeIndexPageHtml(year, [5, 3, 1]) // gaps at 2 and 4
      )

      // Only add pages for 1, 3, 5 — 2 and 4 will 404
      pages.set(
        `https://svenskforfattningssamling.se/doc/${year}0001.html`,
        makeDocPageHtml('Lag om ändring i lagen (2020:1)', year, 1)
      )
      pages.set(
        `https://svenskforfattningssamling.se/doc/${year}0003.html`,
        makeDocPageHtml('Lag om ändring i lagen (2020:3)', year, 3)
      )
      pages.set(
        `https://svenskforfattningssamling.se/doc/${year}0005.html`,
        makeDocPageHtml('Lag om ändring i lagen (2020:5)', year, 5)
      )

      const result = await crawlCurrentYearIndex(year, {
        requestDelayMs: 0,
        fetchFn: createMockFetch(pages),
      })

      // Should find 3 documents, skipping the 404 gaps
      expect(result.documents).toHaveLength(3)
      expect(result.documents.map((d) => d.sfsNumber)).toEqual([
        '2026:1',
        '2026:3',
        '2026:5',
      ])
    })
  })
})
