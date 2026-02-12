/**
 * Story 9.1, Task 3: Unit Tests for AFS HTML Scraper
 *
 * Tests the scraper's ability to parse av.se HTML and extract
 * the div.provision content with correct stats.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  scrapeAfsPage,
  parseProvisionHtml,
  scrapeAfsPages,
} from '@/lib/agency/afs-scraper'

// ============================================================================
// Test Fixtures
// ============================================================================

/** Minimal av.se page with flat structure (standalone, no chapters) */
const FLAT_PAGE_HTML = `<!DOCTYPE html>
<html lang="sv">
<head><title>AFS 2023:1 - Systematiskt arbetsmiljöarbete</title></head>
<body>
<h1>Systematiskt arbetsmiljöarbete</h1>
<div class="provision">
  <div class="document">
    <div class="root">
      <div id="preamble" class="preamble">
        <div class="paragraph">
          <p>Arbetsmiljöverket föreskriver<button class="footnote provision__opendialog" data-footnote="1" aria-label="Fotnot 1">1</button> följande.
            <div class="provision__dialog-wrapper">
              <button class="provision__closedialog"></button>
              <div class="provision__dialog">
                <div class="footnote" aria-hidden="true">
                  <div class="paragraph"><p>Jämför rådets direktiv 89/391/EEG.</p></div>
                </div>
              </div>
            </div>
          </p>
        </div>
      </div>
      <div id="rules" class="rules">
        <h2 id="varfor" data-menu="true">Varför föreskrifterna finns</h2>
        <span id="varfor1" class="section-sign">1&nbsp;§</span>
        <div class="paragraph">
          <p>Syftet med dessa föreskrifter är att arbetsgivare ska arbeta systematiskt.</p>
        </div>
        <div class="general-recommendation">
          <div class="h2">Allmänna råd</div>
          <div class="paragraph">
            <p>Det systematiska arbetsmiljöarbetet omfattar hela verksamheten.</p>
          </div>
        </div>
        <h2 id="vilka" data-menu="true">Vilka föreskrifterna gäller för</h2>
        <span id="vilka2" class="section-sign">2&nbsp;§</span>
        <div class="paragraph">
          <p>Dessa föreskrifter gäller för alla arbetsgivare.</p>
        </div>
        <span id="vilka3" class="section-sign">3&nbsp;§</span>
        <div class="paragraph">
          <p>Med arbetstagare avses även:</p>
          <ol style="--start: " class="provisionlist liststyle-decimal listsuffix-.">
            <li><div class="paragraph"><p>den som genomgår utbildning,</p></div></li>
            <li><div class="paragraph"><p>den som tjänstgör enligt lagen.</p></div></li>
          </ol>
        </div>
        <span class="provisioncmsurl">
          <a href="/stod/" class="arrow">Stöd och verktyg: SAM</a>
        </span>
      </div>
      <div class="transitionalregulations">
        <h2 id="overgang" data-menu="true">Övergångsbestämmelser</h2>
        <div class="paragraph">
          <p>Denna författning träder i kraft den 1 januari 2025.</p>
        </div>
      </div>
      <div id="appendices" class="appendices">
        <h2 id="bilaga1" data-menu="true">Bilaga 1 Arbetstagare med uppgifter</h2>
        <div class="paragraph">
          <p>Arbetsgivaren ska se till att de som får uppgifter har kunskaper.</p>
        </div>
      </div>
    </div>
  </div>
</div>
</body>
</html>`

/** av.se page with chapters + avdelningar (AFS 2023:10-like structure) */
const CHAPTER_PAGE_HTML = `<!DOCTYPE html>
<html lang="sv">
<head><title>AFS 2023:10 - Risker i arbetsmiljön</title></head>
<body>
<h1>Risker i arbetsmiljön</h1>
<div class="provision">
  <div class="document">
    <div class="root">
      <div id="rules" class="rules">
        <h2 id="avd1" data-menu="true">Avdelning 1 Gemensamma bestämmelser</h2>
        <h3 id="kap1" data-menu="true">1 kap. Allmänna bestämmelser</h3>
        <span id="kap1-1" class="section-sign">1&nbsp;§</span>
        <div class="paragraph">
          <p>Dessa föreskrifter gäller för alla arbetsgivare.</p>
        </div>
        <h2 id="avd2" data-menu="true">Avdelning 2 Fysikaliska riskkällor</h2>
        <h3 id="kap2" data-menu="true">2 kap. Buller</h3>
        <span id="kap2-1" class="section-sign">1&nbsp;§</span>
        <div class="paragraph">
          <p>Arbetsgivaren ska undersöka om det finns risk för bullerexponering.</p>
        </div>
        <div class="general-recommendation">
          <div class="h2">Allmänna råd</div>
          <div class="paragraph"><p>Buller kan vara skadligt vid nivåer över 80 dB.</p></div>
        </div>
        <table class="provision__table">
          <thead><tr><th>Exponeringsvärde</th><th>Nivå</th></tr></thead>
          <tbody><tr><td>Undre insatsvärde</td><td>80 dB(A)</td></tr></tbody>
        </table>
        <h3 id="kap3" data-menu="true">3 kap. Vibrationer</h3>
        <span id="kap3-1" class="section-sign">1&nbsp;§</span>
        <div class="paragraph">
          <p>Arbetsgivaren ska bedöma risker från vibrationer.</p>
        </div>
      </div>
      <div class="transitionalregulations">
        <h2 id="overgang" data-menu="true">Övergångsbestämmelser</h2>
        <div class="paragraph"><p>Denna författning träder i kraft den 1 januari 2025.</p></div>
      </div>
      <div id="appendices" class="appendices">
        <h2 id="bilaga1" data-menu="true">Bilaga 1</h2>
        <div class="paragraph"><p>Bilaga till 2 kap.</p></div>
        <h2 id="bilaga2" data-menu="true">Bilaga 2</h2>
        <div class="paragraph"><p>Bilaga till 3 kap.</p></div>
      </div>
    </div>
  </div>
</div>
</body>
</html>`

/** Page with no provision div */
const NO_PROVISION_HTML = `<!DOCTYPE html>
<html><head><title>404</title></head>
<body><h1>Sidan kunde inte hittas</h1></body>
</html>`

/** Page with empty provision */
const EMPTY_PROVISION_HTML = `<!DOCTYPE html>
<html><head><title>AFS</title></head>
<body><div class="provision"></div></body>
</html>`

// ============================================================================
// Tests
// ============================================================================

describe('afs-scraper', () => {
  describe('parseProvisionHtml', () => {
    it('extracts provision HTML from a flat standalone page', () => {
      const result = parseProvisionHtml(
        FLAT_PAGE_HTML,
        'https://example.com/afs-20231/'
      )
      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.data.pageTitle).toBe('Systematiskt arbetsmiljöarbete')
      expect(result.data.provisionHtml).toContain('section-sign')
      expect(result.data.provisionHtml.length).toBeGreaterThan(100)
    })

    it('detects all content sections on a flat page', () => {
      const result = parseProvisionHtml(FLAT_PAGE_HTML, 'https://example.com/')
      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.data.sections).toEqual({
        hasPreamble: true,
        hasRules: true,
        hasTransitionalRegulations: true,
        hasAppendices: true,
      })
    })

    it('collects correct stats for a flat page', () => {
      const result = parseProvisionHtml(FLAT_PAGE_HTML, 'https://example.com/')
      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.data.stats.sectionSignCount).toBe(3)
      expect(result.data.stats.generalRecommendationCount).toBe(1)
      expect(result.data.stats.footnoteCount).toBe(1)
      expect(result.data.stats.listCount).toBe(1)
      expect(result.data.stats.appendixCount).toBe(1)
    })

    it('extracts provision HTML from a chapter-based page with tables', () => {
      const result = parseProvisionHtml(
        CHAPTER_PAGE_HTML,
        'https://example.com/'
      )
      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.data.stats.sectionSignCount).toBe(3)
      expect(result.data.stats.generalRecommendationCount).toBe(1)
      expect(result.data.stats.tableCount).toBe(1)
      expect(result.data.stats.appendixCount).toBe(2)
    })

    it('returns error when no div.provision exists', () => {
      const result = parseProvisionHtml(
        NO_PROVISION_HTML,
        'https://example.com/'
      )
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error).toContain('No div.provision found')
    })

    it('returns error for empty provision', () => {
      const result = parseProvisionHtml(
        EMPTY_PROVISION_HTML,
        'https://example.com/'
      )
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error).toContain('Empty div.provision')
    })
  })

  describe('scrapeAfsPage', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it('fetches and parses a page successfully', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          text: () => Promise.resolve(FLAT_PAGE_HTML),
        })
      )

      const result = await scrapeAfsPage('https://www.av.se/test/')
      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.data.stats.sectionSignCount).toBe(3)

      const fetchCall = vi.mocked(fetch).mock.calls[0]!
      expect(fetchCall[1]).toHaveProperty('headers')
      const headers = fetchCall[1]!.headers as Record<string, string>
      expect(headers['User-Agent']).toContain('Laglig.se')
    })

    it('returns error on HTTP 404', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          text: () => Promise.resolve(''),
        })
      )

      const result = await scrapeAfsPage('https://www.av.se/missing/')
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.statusCode).toBe(404)
      expect(result.error).toContain('404')
    })

    it('retries on HTTP 500 errors', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(FLAT_PAGE_HTML),
        })

      vi.stubGlobal('fetch', mockFetch)

      const result = await scrapeAfsPage('https://www.av.se/test/')
      expect(result.success).toBe(true)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('retries on network errors', async () => {
      const mockFetch = vi
        .fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(FLAT_PAGE_HTML),
        })

      vi.stubGlobal('fetch', mockFetch)

      const result = await scrapeAfsPage('https://www.av.se/test/')
      expect(result.success).toBe(true)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('fails after max retries on persistent errors', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
      )

      const result = await scrapeAfsPage('https://www.av.se/test/')
      expect(result.success).toBe(false)
      if (result.success) return
      expect(result.error).toContain('3 retries')
      expect(result.error).toContain('ECONNREFUSED')
    })
  })

  describe('scrapeAfsPages', () => {
    beforeEach(() => {
      vi.restoreAllMocks()
    })

    it('scrapes multiple pages with progress callback', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          text: () => Promise.resolve(FLAT_PAGE_HTML),
        })
      )

      const progress: string[] = []
      const results = await scrapeAfsPages(
        [
          { documentNumber: 'AFS 2023:1', pageUrl: 'https://www.av.se/a/' },
          { documentNumber: 'AFS 2023:2', pageUrl: 'https://www.av.se/b/' },
        ],
        {
          delayMs: 0,
          onProgress: (docNumber) => progress.push(docNumber),
        }
      )

      expect(results.size).toBe(2)
      expect(results.get('AFS 2023:1')?.success).toBe(true)
      expect(results.get('AFS 2023:2')?.success).toBe(true)
      expect(progress).toEqual(['AFS 2023:1', 'AFS 2023:2'])
    })

    it('continues scraping when one page fails', async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          text: () => Promise.resolve(''),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: () => Promise.resolve(FLAT_PAGE_HTML),
        })

      vi.stubGlobal('fetch', mockFetch)

      const results = await scrapeAfsPages(
        [
          { documentNumber: 'AFS 2023:1', pageUrl: 'https://www.av.se/a/' },
          { documentNumber: 'AFS 2023:2', pageUrl: 'https://www.av.se/b/' },
        ],
        { delayMs: 0 }
      )

      expect(results.get('AFS 2023:1')?.success).toBe(false)
      expect(results.get('AFS 2023:2')?.success).toBe(true)
    })
  })
})
