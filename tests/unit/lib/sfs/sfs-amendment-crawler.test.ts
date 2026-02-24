/**
 * Unit tests for SFS Amendment Crawler
 *
 * Story 8.20: Continuous SFS Amendment Discovery
 */

import { describe, it, expect } from 'vitest'
import {
  classifyDocument,
  extractBaseLawSfs,
  extractSfsNumericPart,
  parseIndexPageSfsNumbers,
  getNextPageNumber,
  parseDocumentPage,
} from '@/lib/sfs/sfs-amendment-crawler'

// =============================================================================
// classifyDocument
// =============================================================================

describe('classifyDocument', () => {
  it('classifies amendments with "om ändring i"', () => {
    expect(
      classifyDocument('Lag om ändring i arbetsmiljölagen (1977:1160)')
    ).toBe('amendment')
  })

  it('classifies amendments with "om ändring av"', () => {
    expect(
      classifyDocument('Förordning om ändring av förordningen (2001:100)')
    ).toBe('amendment')
  })

  it('classifies repeals with "om upphävande av"', () => {
    expect(
      classifyDocument(
        'Lag om upphävande av lagen (2020:123) om tillfälliga åtgärder'
      )
    ).toBe('repeal')
  })

  it('classifies new laws', () => {
    expect(classifyDocument('Lag om tilläggsskatt')).toBe('new_law')
    expect(classifyDocument('Förordning om statsbidrag')).toBe('new_law')
  })

  it('is case-insensitive', () => {
    expect(
      classifyDocument('LAG OM ÄNDRING I ARBETSMILJÖLAGEN (1977:1160)')
    ).toBe('amendment')
    expect(classifyDocument('Lag Om Upphävande Av Lagen (2020:123)')).toBe(
      'repeal'
    )
  })
})

// =============================================================================
// extractBaseLawSfs
// =============================================================================

describe('extractBaseLawSfs', () => {
  it('extracts from standard amendment title', () => {
    expect(
      extractBaseLawSfs('Lag om ändring i arbetsmiljölagen (1977:1160)')
    ).toBe('1977:1160')
  })

  it('extracts from title with trailing text', () => {
    expect(
      extractBaseLawSfs('Lag om ändring i lagen (2023:875) om tilläggsskatt')
    ).toBe('2023:875')
  })

  it('extracts from repeal title', () => {
    expect(
      extractBaseLawSfs(
        'Lag om upphävande av lagen (2020:123) om tillfälliga åtgärder'
      )
    ).toBe('2020:123')
  })

  it('extracts from förordning amendment', () => {
    expect(
      extractBaseLawSfs(
        'Förordning om ändring i förordningen (2001:100) om brandfarliga varor'
      )
    ).toBe('2001:100')
  })

  it('returns null for new laws without SFS reference', () => {
    expect(extractBaseLawSfs('Lag om tilläggsskatt')).toBeNull()
  })

  it('falls back to first parenthesized SFS number', () => {
    expect(extractBaseLawSfs('Särskild lag (2015:999) om skatter')).toBe(
      '2015:999'
    )
  })
})

// =============================================================================
// extractSfsNumericPart
// =============================================================================

describe('extractSfsNumericPart', () => {
  it('extracts numeric part from standard SFS number', () => {
    expect(extractSfsNumericPart('2026:42')).toBe(42)
    expect(extractSfsNumericPart('2026:1')).toBe(1)
    expect(extractSfsNumericPart('2026:1461')).toBe(1461)
  })

  it('returns NaN for invalid input', () => {
    expect(extractSfsNumericPart('invalid')).toBeNaN()
    expect(extractSfsNumericPart('')).toBeNaN()
  })

  it('handles numeric watermark comparison correctly', () => {
    // This is the critical test: string "9" > "80" but numeric 9 < 80
    const nums = ['2026:9', '2026:80', '2026:10', '2026:1']
    const sorted = nums
      .map((n) => ({ sfs: n, num: extractSfsNumericPart(n) }))
      .sort((a, b) => a.num - b.num)

    expect(sorted.map((s) => s.sfs)).toEqual([
      '2026:1',
      '2026:9',
      '2026:10',
      '2026:80',
    ])
  })

  it('computes correct max for watermark', () => {
    const sfsNumbers = ['2026:9', '2026:80', '2026:42', '2026:3']
    const max = Math.max(...sfsNumbers.map((s) => extractSfsNumericPart(s)))
    expect(max).toBe(80)
  })
})

// =============================================================================
// parseIndexPageSfsNumbers
// =============================================================================

describe('parseIndexPageSfsNumbers', () => {
  const sampleIndexHtml = `
    <table>
      <tr>
        <td><span data-lable="SFS-nummer">2026:70</span></td>
        <td><span data-lable="Rubrik"><a href="doc/20260070.html">Lag om ändring</a></span></td>
        <td><span data-lable="Publicerad">2026-02-15</span></td>
      </tr>
      <tr>
        <td><span data-lable="SFS-nummer">2026:69</span></td>
        <td><span data-lable="Rubrik"><a href="doc/20260069.html">Förordning</a></span></td>
        <td><span data-lable="Publicerad">2026-02-14</span></td>
      </tr>
      <tr>
        <td><span data-lable="SFS-nummer">2025:1400</span></td>
        <td><span data-lable="Rubrik"><a href="doc/20251400.html">Old law</a></span></td>
        <td><span data-lable="Publicerad">2025-12-01</span></td>
      </tr>
    </table>
  `

  it('extracts SFS numbers for the specified year', () => {
    const nums = parseIndexPageSfsNumbers(sampleIndexHtml, 2026)
    expect(nums).toEqual([70, 69])
  })

  it('ignores SFS numbers from other years', () => {
    const nums = parseIndexPageSfsNumbers(sampleIndexHtml, 2025)
    expect(nums).toEqual([1400])
  })

  it('returns empty array when no matches', () => {
    const nums = parseIndexPageSfsNumbers('<html></html>', 2026)
    expect(nums).toEqual([])
  })
})

// =============================================================================
// getNextPageNumber
// =============================================================================

describe('getNextPageNumber', () => {
  it('extracts next page number from pagination', () => {
    const html =
      '<li class="next"><a href="regulations%3Fpage=2.html">Next</a></li>'
    expect(getNextPageNumber(html)).toBe(2)
  })

  it('returns null when no next page', () => {
    expect(getNextPageNumber('<html>No pagination</html>')).toBeNull()
  })
})

// =============================================================================
// parseDocumentPage
// =============================================================================

describe('parseDocumentPage', () => {
  it('parses a standard amendment document page', () => {
    const html = `
      <html>
        <title>Lag om ändring i arbetsmiljölagen (1977:1160) | svenskforfattningssamling.se</title>
        <body>
          <a href="../sites/default/files/sfs/2026-02/SFS2026-45.pdf">Download PDF</a>
        </body>
      </html>
    `
    const result = parseDocumentPage(html, '2026:45')

    expect(result).not.toBeNull()
    expect(result!.title).toBe('Lag om ändring i arbetsmiljölagen (1977:1160)')
    expect(result!.documentType).toBe('amendment')
    expect(result!.baseLawSfs).toBe('1977:1160')
    expect(result!.pdfUrl).toContain('SFS2026-45.pdf')
    expect(result!.publishedDate).toBe('2026-02-01')
  })

  it('parses a repeal document page', () => {
    const html = `
      <html>
        <title>Lag om upphävande av lagen (2020:123) | svenskforfattningssamling.se</title>
        <body>
          <a href="../sites/default/files/sfs/2026-01/SFS2026-10.pdf">Download PDF</a>
        </body>
      </html>
    `
    const result = parseDocumentPage(html, '2026:10')

    expect(result).not.toBeNull()
    expect(result!.documentType).toBe('repeal')
    expect(result!.baseLawSfs).toBe('2020:123')
  })

  it('parses a new law document page', () => {
    const html = `
      <html>
        <title>Lag om tilläggsskatt | svenskforfattningssamling.se</title>
        <body>
          <a href="../sites/default/files/sfs/2026-01/SFS2026-5.pdf">Download PDF</a>
        </body>
      </html>
    `
    const result = parseDocumentPage(html, '2026:5')

    expect(result).not.toBeNull()
    expect(result!.documentType).toBe('new_law')
    expect(result!.baseLawSfs).toBeNull()
  })

  it('returns null for page without title', () => {
    const html = '<html><title></title><body></body></html>'
    expect(parseDocumentPage(html, '2026:1')).toBeNull()
  })
})
