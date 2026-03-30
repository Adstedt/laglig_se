import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dns/promises before importing
vi.mock('dns/promises', () => ({
  default: {
    resolve4: vi.fn(),
  },
}))

import dns from 'dns/promises'
import { fetchUrlContent } from '@/lib/company-preview/url-fetcher'

const mockDnsResolve = vi.mocked(dns.resolve4)

describe('fetchUrlContent', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.restoreAllMocks()
    mockDnsResolve.mockResolvedValue(['93.184.216.34'])
    fetchSpy = vi.spyOn(globalThis, 'fetch')
  })

  describe('Jina Reader (primary path)', () => {
    it('returns content via Jina Reader for JS-rendered sites', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          'Title: Test Site\nURL Source: https://example.com\nMarkdown Content:\nWe are a company that builds houses and renovates apartments.',
          { status: 200 }
        )
      )

      const result = await fetchUrlContent('https://example.com')
      expect(result).toContain('builds houses')
      expect(result).not.toContain('Title:')
      expect(result).not.toContain('URL Source:')
      // Verify Jina URL was called
      expect(fetchSpy.mock.calls[0]![0]).toBe(
        'https://r.jina.ai/https://example.com'
      )
    })

    it('strips markdown image noise from Jina response', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          'Title: Test\nURL Source: https://example.com\nMarkdown Content:\n![Banner](https://img.com/b.png)\nWe sell office supplies.\n[![Logo](https://img.com/l.png)](https://example.com)',
          { status: 200 }
        )
      )

      const result = await fetchUrlContent('https://example.com')
      expect(result).toContain('We sell office supplies')
      expect(result).not.toContain('img.com')
      expect(result).not.toContain('![')
    })

    it('falls back to raw fetch when Jina returns empty content', async () => {
      // Jina returns too little content
      fetchSpy.mockResolvedValueOnce(
        new Response('Title: T\nURL Source: u\nMarkdown Content:\n', {
          status: 200,
        })
      )
      // Raw fetch returns HTML
      fetchSpy.mockResolvedValueOnce(
        new Response('<html><body><p>Real content here</p></body></html>', {
          headers: { 'Content-Type': 'text/html' },
        })
      )

      const result = await fetchUrlContent('https://example.com')
      expect(result).toContain('Real content here')
    })

    it('falls back to raw fetch when Jina fails', async () => {
      // Jina returns error
      fetchSpy.mockResolvedValueOnce(new Response('', { status: 500 }))
      // Raw fetch returns HTML
      fetchSpy.mockResolvedValueOnce(
        new Response('<html><body><p>Fallback content</p></body></html>', {
          headers: { 'Content-Type': 'text/html' },
        })
      )

      const result = await fetchUrlContent('https://example.com')
      expect(result).toContain('Fallback content')
    })

    it('falls back to raw fetch when Jina times out', async () => {
      fetchSpy.mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'))
      fetchSpy.mockResolvedValueOnce(
        new Response('<html><body><p>Timeout fallback</p></body></html>', {
          headers: { 'Content-Type': 'text/html' },
        })
      )

      const result = await fetchUrlContent('https://example.com')
      expect(result).toContain('Timeout fallback')
    })

    it('sends X-Remove-Selector header for cookie banners', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          'Title: T\nURL Source: u\nMarkdown Content:\nSome company info here that is long enough.',
          { status: 200 }
        )
      )

      await fetchUrlContent('https://example.com')

      const jinaHeaders = (fetchSpy.mock.calls[0]![1] as RequestInit)
        .headers as Record<string, string>
      expect(jinaHeaders['X-Remove-Selector']).toContain('.cookie-banner')
      expect(jinaHeaders['X-Remove-Selector']).toContain('.cookie-consent')
    })
  })

  describe('raw fetch fallback (SSRF protection)', () => {
    // Force Jina to fail so raw fetch runs
    function failJina() {
      fetchSpy.mockResolvedValueOnce(new Response('', { status: 500 }))
    }

    it('returns extracted text from HTML page', async () => {
      failJina()
      const html = '<html><body><h1>Hello</h1><p>World</p></body></html>'
      fetchSpy.mockResolvedValueOnce(
        new Response(html, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      )

      const result = await fetchUrlContent('https://example.com')
      expect(result).toContain('Hello')
      expect(result).toContain('World')
      expect(result).not.toContain('<h1>')
    })

    it('strips script and style tags', async () => {
      failJina()
      const html =
        '<html><head><style>body{color:red}</style></head><body><script>alert(1)</script><p>Content</p></body></html>'
      fetchSpy.mockResolvedValueOnce(
        new Response(html, {
          headers: { 'Content-Type': 'text/html' },
        })
      )

      const result = await fetchUrlContent('https://example.com')
      expect(result).toContain('Content')
      expect(result).not.toContain('alert')
      expect(result).not.toContain('color:red')
    })

    it('blocks private IP 127.0.0.1', async () => {
      failJina()
      mockDnsResolve.mockResolvedValue(['127.0.0.1'])

      const result = await fetchUrlContent('https://evil.com')
      expect(result).toBeNull()
    })

    it('blocks private IP 10.x.x.x', async () => {
      failJina()
      mockDnsResolve.mockResolvedValue(['10.0.0.1'])

      const result = await fetchUrlContent('https://evil.com')
      expect(result).toBeNull()
    })

    it('blocks private IP 192.168.x.x', async () => {
      failJina()
      mockDnsResolve.mockResolvedValue(['192.168.1.1'])

      const result = await fetchUrlContent('https://evil.com')
      expect(result).toBeNull()
    })

    it('blocks private IP 172.16.x.x', async () => {
      failJina()
      mockDnsResolve.mockResolvedValue(['172.16.0.1'])

      const result = await fetchUrlContent('https://evil.com')
      expect(result).toBeNull()
    })

    it('blocks private IP 169.254.x.x (link-local)', async () => {
      failJina()
      mockDnsResolve.mockResolvedValue(['169.254.169.254'])

      const result = await fetchUrlContent('https://evil.com')
      expect(result).toBeNull()
    })

    it('returns null for non-HTML content type', async () => {
      failJina()
      fetchSpy.mockResolvedValueOnce(
        new Response('{"key": "value"}', {
          headers: { 'Content-Type': 'application/json' },
        })
      )

      const result = await fetchUrlContent('https://api.example.com/data')
      expect(result).toBeNull()
    })

    it('truncates content exceeding max length', async () => {
      failJina()
      const longText = 'A'.repeat(20000)
      const html = `<html><body><p>${longText}</p></body></html>`
      fetchSpy.mockResolvedValueOnce(
        new Response(html, {
          headers: { 'Content-Type': 'text/html' },
        })
      )

      const result = await fetchUrlContent('https://example.com')
      expect(result).not.toBeNull()
      expect(result!.length).toBeLessThanOrEqual(12000)
    })

    it('blocks after exceeding maximum redirects', async () => {
      failJina()
      const redirectResponse = (location: string) =>
        new Response(null, {
          status: 302,
          headers: { Location: location },
        })

      fetchSpy
        .mockResolvedValueOnce(redirectResponse('https://hop1.com'))
        .mockResolvedValueOnce(redirectResponse('https://hop2.com'))
        .mockResolvedValueOnce(redirectResponse('https://hop3.com'))

      const result = await fetchUrlContent('https://example.com')
      expect(result).toBeNull()
    })

    it('re-checks IP on redirect target', async () => {
      failJina()
      mockDnsResolve
        .mockResolvedValueOnce(['93.184.216.34'])
        .mockResolvedValueOnce(['10.0.0.1'])

      fetchSpy.mockResolvedValueOnce(
        new Response(null, {
          status: 301,
          headers: { Location: 'https://internal.evil.com/admin' },
        })
      )

      const result = await fetchUrlContent('https://legit.com')
      expect(result).toBeNull()
    })
  })

  describe('shared validation', () => {
    it('rejects non-http protocols', async () => {
      const result = await fetchUrlContent('ftp://example.com/file.txt')
      expect(result).toBeNull()
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('returns null for invalid URL', async () => {
      const result = await fetchUrlContent('not-a-url')
      expect(result).toBeNull()
      expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('returns null on both Jina and raw fetch failure', async () => {
      // Jina fails
      fetchSpy.mockRejectedValueOnce(new Error('Network error'))
      // Raw fetch also fails
      fetchSpy.mockRejectedValueOnce(new Error('Network error'))

      const result = await fetchUrlContent('https://down.example.com')
      expect(result).toBeNull()
    })
  })
})
