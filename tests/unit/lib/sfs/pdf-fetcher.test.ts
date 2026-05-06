/**
 * Unit tests for SFS PDF fetcher
 *
 * Verifies that PDF URL resolution always goes through the doc HTML page
 * (the gov site's source of truth) and never relies on date-based guessing.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/lib/supabase/storage', () => ({
  uploadPdf: vi.fn(),
}))

import {
  resolvePdfUrl,
  fetchAndStorePdf,
  resetRateLimiter,
} from '@/lib/sfs/pdf-fetcher'
import { uploadPdf } from '@/lib/supabase/storage'

const DOC_PAGE_HTML = (pdfHref: string) => `
  <html>
    <head><title>Lag om ändring i lagen (2013:283) | svenskforfattningssamling.se</title></head>
    <body>
      <a href="${pdfHref}">Hämta PDF</a>
    </body>
  </html>
`

const PDF_BYTES = Buffer.from('%PDF-1.4 fake pdf content')

function mockFetchSequence(responses: Array<Partial<Response>>) {
  let i = 0
  global.fetch = vi.fn(async () => {
    const r = responses[i++] ?? { ok: false, status: 500 }
    return r as Response
  }) as unknown as typeof fetch
}

beforeEach(() => {
  resetRateLimiter()
  vi.clearAllMocks()
  vi.mocked(uploadPdf).mockResolvedValue({
    path: '2026/SFS2026-422.pdf',
    error: null,
  })
})

describe('resolvePdfUrl', () => {
  it('returns the absolute PDF URL extracted from the doc page', async () => {
    mockFetchSequence([
      {
        ok: true,
        status: 200,
        text: async () =>
          DOC_PAGE_HTML('../sites/default/files/sfs/2026-04/SFS2026-422.pdf'),
      } as Response,
    ])

    const url = await resolvePdfUrl('SFS 2026:422')

    expect(url).toBe(
      'https://svenskforfattningssamling.se/sites/default/files/sfs/2026-04/SFS2026-422.pdf'
    )
    expect(global.fetch).toHaveBeenCalledWith(
      'https://svenskforfattningssamling.se/doc/2026422.html',
      expect.objectContaining({ headers: expect.any(Object) })
    )
  })

  it('handles SFS numbers without prefix', async () => {
    mockFetchSequence([
      {
        ok: true,
        status: 200,
        text: async () =>
          DOC_PAGE_HTML('../sites/default/files/sfs/2026-04/SFS2026-422.pdf'),
      } as Response,
    ])

    const url = await resolvePdfUrl('2026:422')
    expect(url).toBe(
      'https://svenskforfattningssamling.se/sites/default/files/sfs/2026-04/SFS2026-422.pdf'
    )
  })

  it('returns null when the doc page returns 404', async () => {
    mockFetchSequence([
      { ok: false, status: 404, statusText: 'Not Found' } as Response,
    ])

    const url = await resolvePdfUrl('SFS 2026:99999')
    expect(url).toBeNull()
  })

  it('returns null when the doc page has no PDF link', async () => {
    mockFetchSequence([
      {
        ok: true,
        status: 200,
        text: async () => '<html><body>No PDF here</body></html>',
      } as Response,
    ])

    const url = await resolvePdfUrl('SFS 2026:422')
    expect(url).toBeNull()
  })

  it('returns null for invalid SFS number format without making network calls', async () => {
    const fetchSpy = vi.fn()
    global.fetch = fetchSpy as unknown as typeof fetch

    const url = await resolvePdfUrl('not-a-number')

    expect(url).toBeNull()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('fetchAndStorePdf', () => {
  it('resolves URL via doc page, fetches PDF, uploads, and returns the resolved URL in metadata', async () => {
    mockFetchSequence([
      {
        ok: true,
        status: 200,
        text: async () =>
          DOC_PAGE_HTML('../sites/default/files/sfs/2026-04/SFS2026-422.pdf'),
      } as Response,
      {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/pdf' }),
        arrayBuffer: async () =>
          PDF_BYTES.buffer.slice(
            PDF_BYTES.byteOffset,
            PDF_BYTES.byteOffset + PDF_BYTES.byteLength
          ),
      } as Response,
    ])

    const result = await fetchAndStorePdf('SFS 2026:422')

    expect(result.success).toBe(true)
    expect(result.metadata?.originalUrl).toBe(
      'https://svenskforfattningssamling.se/sites/default/files/sfs/2026-04/SFS2026-422.pdf'
    )
    expect(result.metadata?.fileSize).toBe(PDF_BYTES.length)
    expect(uploadPdf).toHaveBeenCalledWith('2026:422', expect.any(Buffer))
  })

  it('ignores the deprecated publicationDate parameter', async () => {
    mockFetchSequence([
      {
        ok: true,
        status: 200,
        text: async () =>
          DOC_PAGE_HTML('../sites/default/files/sfs/2026-04/SFS2026-422.pdf'),
      } as Response,
      {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/pdf' }),
        arrayBuffer: async () =>
          PDF_BYTES.buffer.slice(
            PDF_BYTES.byteOffset,
            PDF_BYTES.byteOffset + PDF_BYTES.byteLength
          ),
      } as Response,
    ])

    // Pass a publicationDate that would have produced a wrong URL under the old logic
    const result = await fetchAndStorePdf('SFS 2026:422', '2026-05-01')

    expect(result.success).toBe(true)
    // First fetch is the doc page, regardless of the publication date passed in
    expect(
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]
    ).toBe('https://svenskforfattningssamling.se/doc/2026422.html')
    // Second fetch is the resolved PDF URL (April folder), not a guessed May URL
    expect(
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[1][0]
    ).toBe(
      'https://svenskforfattningssamling.se/sites/default/files/sfs/2026-04/SFS2026-422.pdf'
    )
  })

  it('returns failure when doc page resolution fails (no PDF fetch attempted)', async () => {
    mockFetchSequence([
      { ok: false, status: 404, statusText: 'Not Found' } as Response,
    ])

    const result = await fetchAndStorePdf('SFS 2026:99999')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Failed to resolve PDF URL')
    expect(uploadPdf).not.toHaveBeenCalled()
    // Only one fetch call: the doc page. PDF fetch never attempted.
    expect(
      (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
    ).toHaveLength(1)
  })

  it('returns failure with resolved URL in metadata when PDF download fails', async () => {
    mockFetchSequence([
      {
        ok: true,
        status: 200,
        text: async () =>
          DOC_PAGE_HTML('../sites/default/files/sfs/2026-04/SFS2026-422.pdf'),
      } as Response,
      { ok: false, status: 500, statusText: 'Server Error' } as Response,
    ])

    const result = await fetchAndStorePdf('SFS 2026:422')

    expect(result.success).toBe(false)
    expect(result.error).toContain('Failed to fetch PDF')
    expect(result.metadata?.originalUrl).toBe(
      'https://svenskforfattningssamling.se/sites/default/files/sfs/2026-04/SFS2026-422.pdf'
    )
    expect(uploadPdf).not.toHaveBeenCalled()
  })
})
