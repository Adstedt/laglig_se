import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  fetchSFSLaws,
  fetchLawFullText,
  generateSlug,
  RiksdagenApiError,
} from '../../lib/external/riksdagen'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('Riksdagen API Client', () => {
  beforeEach(() => {
    mockFetch.mockClear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('fetchSFSLaws', () => {
    it('should fetch and parse SFS laws correctly', async () => {
      const mockResponse = {
        dokumentlista: {
          '@traffar': '11363',
          '@sida': '1',
          '@sidor': '114',
          dokument: [
            {
              dok_id: 'sfs-2025-1074',
              beteckning: '2025:1074',
              titel: 'Förordning (2025:1074) om gränsvärde',
              datum: '2025-11-13',
              publicerad: '2025-11-19 04:40:11',
              dokument_url_html:
                '//data.riksdagen.se/dokument/sfs-2025-1074.html',
            },
          ],
        },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await fetchSFSLaws(1)

      expect(result.laws).toHaveLength(1)
      expect(result.laws[0]).toMatchObject({
        dokId: 'sfs-2025-1074',
        sfsNumber: 'SFS 2025:1074',
        title: 'Förordning (2025:1074) om gränsvärde',
      })
      expect(result.totalCount).toBe(11363)
      expect(result.hasMore).toBe(true)
    })

    it('should handle empty response', async () => {
      const mockResponse = {
        dokumentlista: {
          '@traffar': '0',
          '@sida': '1',
          '@sidor': '0',
          dokument: [],
        },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await fetchSFSLaws(10)

      expect(result.laws).toHaveLength(0)
      expect(result.totalCount).toBe(0)
      expect(result.hasMore).toBe(false)
    })

    it('should throw RiksdagenApiError on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })

      await expect(fetchSFSLaws(1)).rejects.toThrow(RiksdagenApiError)
    })

    it('should retry on 429 rate limit', async () => {
      // First call returns 429, second succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            dokumentlista: {
              '@traffar': '1',
              '@sida': '1',
              '@sidor': '1',
              dokument: [],
            },
          }),
        })

      const result = await fetchSFSLaws(1)

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result.laws).toHaveLength(0)
    })
  })

  describe('fetchLawFullText', () => {
    it('should fetch and clean HTML content', async () => {
      const mockHtml = `
        <html>
          <body>
            <h1>Test Law</h1>
            <p>This is the law content.</p>
            <script>alert('bad')</script>
          </body>
        </html>
      `

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockHtml,
      })

      const result = await fetchLawFullText('sfs-2025-1074')

      expect(result).toBeTruthy()
      expect(result).toContain('Test Law')
      expect(result).toContain('This is the law content')
      expect(result).not.toContain('script')
      expect(result).not.toContain('alert')
    })

    it('should return null on fetch error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await fetchLawFullText('invalid-id')

      expect(result).toBeNull()
    })
  })

  describe('generateSlug', () => {
    it('should generate correct slug from title and SFS number', () => {
      expect(generateSlug('Arbetsmiljölagen', '1977:1160')).toBe(
        'arbetsmiljolagen-1977-1160'
      )
    })

    it('should handle titles with special characters', () => {
      expect(
        generateSlug('Lag (2025:1071) med bestämmelser', 'SFS 2025:1071')
      ).toBe('lag-20251071-med-bestammelser-2025-1071')
    })

    it('should handle very long titles by truncating', () => {
      const longTitle =
        'Detta är en väldigt lång lagtitel som behöver kortas av för att fungera bra som URL slug'
      const slug = generateSlug(longTitle, '2025:999')

      // Should truncate title part and add SFS number
      expect(slug.length).toBeLessThan(70)
      expect(slug).toContain('2025-999')
    })

    it('should remove SFS prefix if present', () => {
      expect(generateSlug('Testlag', 'SFS 2025:123')).toBe('testlag-2025-123')
    })
  })
})
