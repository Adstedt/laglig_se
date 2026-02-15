/**
 * Tests for StickyDocNav component (components/features/paragraf-toc.tsx)
 *
 * Verifies the three heading extraction strategies, visibility auto-hide logic,
 * aria-current accessibility, and scroll click behavior.
 */

import { render, screen, within, act, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useRef } from 'react'
import { StickyDocNav } from '@/components/features/paragraf-toc'

// ---------------------------------------------------------------------------
// Mock ResizeObserver (happy-dom may not fully support it)
// ---------------------------------------------------------------------------

let disconnectSpy: ReturnType<typeof vi.fn>

class MockResizeObserver {
  callback: ResizeObserverCallback
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }
  observe() {}
  unobserve() {}
  disconnect() {
    disconnectSpy()
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function TestHarness({ html }: { html: string }) {
  const ref = useRef<HTMLElement>(null)
  return (
    <main
      style={{ overflow: 'auto', width: 1400, height: 800 }}
      data-testid="scroll-main"
    >
      <article
        ref={ref}
        className="legal-document"
        style={{ width: 800 }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <StickyDocNav containerRef={ref} />
    </main>
  )
}

async function waitForScan() {
  await act(async () => {
    vi.advanceTimersByTime(200)
  })
}

function mockBoundingRects(
  container: HTMLElement,
  overrides?: {
    containerRight?: number
    scrollRight?: number
    containerTop?: number
    containerBottom?: number
  }
) {
  const containerRight = overrides?.containerRight ?? 800
  const containerTop = overrides?.containerTop ?? -50
  const containerBottom = overrides?.containerBottom ?? 2000

  vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
    top: containerTop,
    bottom: containerBottom,
    left: 0,
    right: containerRight,
    width: 800,
    height: containerBottom - containerTop,
    x: 0,
    y: containerTop,
    toJSON: () => ({}),
  })

  const main = container.closest('main')
  if (main) {
    vi.spyOn(main, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: 800,
      left: 0,
      right: overrides?.scrollRight ?? 1400,
      width: overrides?.scrollRight ?? 1400,
      height: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
  }
}

/** Make the TOC visible by mocking rects and triggering a scroll event */
async function makeTocVisible(article: HTMLElement) {
  mockBoundingRects(article)
  await act(async () => {
    const main = article.closest('main')!
    main.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(50)
  })
}

/** Get the nav element (returns null if TOC is hidden) */
function getNav() {
  return screen.queryByLabelText('Dokumentnavigering')
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers()
  disconnectSpy = vi.fn()
  vi.stubGlobal('ResizeObserver', MockResizeObserver)
  if (!globalThis.CSS?.escape) {
    vi.stubGlobal('CSS', { escape: (s: string) => s })
  }
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StickyDocNav', () => {
  describe('Strategy 1: h3/h4 nested hierarchy', () => {
    const html = `
      <h3 id="ch2">2 kap. Buller</h3>
      <h4 id="s1">1 § Definitioner</h4>
      <h4 id="s2">2 § Gränsvärden</h4>
      <h3 id="ch3">3 kap. Vibrationer</h3>
      <h4 id="s3">1 § Mätmetoder</h4>
    `

    it('renders parent h3 entries in the nav', async () => {
      render(<TestHarness html={html} />)
      await waitForScan()
      const article = document.querySelector('article')!
      await makeTocVisible(article)

      const nav = getNav()!
      expect(within(nav).getByText('2 kap. Buller')).toBeInTheDocument()
      expect(within(nav).getByText('3 kap. Vibrationer')).toBeInTheDocument()
    })

    it('renders nav with Dokumentnavigering label', async () => {
      render(<TestHarness html={html} />)
      await waitForScan()
      const article = document.querySelector('article')!
      await makeTocVisible(article)

      expect(getNav()).toBeInTheDocument()
    })

    it('shows Innehåll header', async () => {
      render(<TestHarness html={html} />)
      await waitForScan()
      const article = document.querySelector('article')!
      await makeTocVisible(article)

      const nav = getNav()!
      expect(within(nav).getByText('Innehåll')).toBeInTheDocument()
    })
  })

  describe('Strategy 2: flat h4 headings', () => {
    const html = `
      <h4 id="a">Avsnitt A</h4>
      <p>Content A</p>
      <h4 id="b">Avsnitt B</h4>
      <p>Content B</p>
      <h4 id="c">Avsnitt C</h4>
      <p>Content C</p>
    `

    it('renders flat h4 entries when no h3s present', async () => {
      render(<TestHarness html={html} />)
      await waitForScan()
      const article = document.querySelector('article')!
      await makeTocVisible(article)

      const nav = getNav()!
      expect(within(nav).getByText('Avsnitt A')).toBeInTheDocument()
      expect(within(nav).getByText('Avsnitt B')).toBeInTheDocument()
      expect(within(nav).getByText('Avsnitt C')).toBeInTheDocument()
    })
  })

  describe('Strategy 3: paragraph anchors', () => {
    const html = `
      <a class="paragraf" id="P1" name="P1"><b>1 §</b></a>
      <p>First paragraph text</p>
      <a class="paragraf" id="P2" name="P2"><b>2 §</b></a>
      <p>Second paragraph text</p>
      <a class="paragraf" id="P3" name="P3"><b>3 §</b></a>
      <p>Third paragraph text</p>
    `

    it('renders paragraph pill entries from a.paragraf anchors', async () => {
      render(<TestHarness html={html} />)
      await waitForScan()
      const article = document.querySelector('article')!
      await makeTocVisible(article)

      const nav = getNav()!
      expect(within(nav).getByText('1 §')).toBeInTheDocument()
      expect(within(nav).getByText('2 §')).toBeInTheDocument()
      expect(within(nav).getByText('3 §')).toBeInTheDocument()
    })

    it('applies font-mono class for § entries', async () => {
      render(<TestHarness html={html} />)
      await waitForScan()
      const article = document.querySelector('article')!
      await makeTocVisible(article)

      const nav = getNav()!
      const button = within(nav).getByText('1 §').closest('button')!
      expect(button.className).toContain('font-mono')
    })
  })

  describe('visibility', () => {
    const html = `
      <h3 id="a">Section A</h3>
      <h3 id="b">Section B</h3>
    `

    it('hides when insufficient right margin', async () => {
      render(<TestHarness html={html} />)
      await waitForScan()

      const article = document.querySelector('article')!
      mockBoundingRects(article, { containerRight: 900, scrollRight: 1000 })

      await act(async () => {
        const main = document.querySelector('main')!
        main.dispatchEvent(new Event('scroll'))
        vi.advanceTimersByTime(50)
      })

      const nav = getNav()!
      expect(nav.className).toContain('opacity-0')
    })

    it('hides when article has not scrolled into view', async () => {
      render(<TestHarness html={html} />)
      await waitForScan()

      const article = document.querySelector('article')!
      // containerTop must be > 60% of viewport height (480px) to be "not scrolled in"
      mockBoundingRects(article, { containerTop: 600 })

      await act(async () => {
        const main = document.querySelector('main')!
        main.dispatchEvent(new Event('scroll'))
        vi.advanceTimersByTime(50)
      })

      const nav = getNav()!
      expect(nav.className).toContain('opacity-0')
    })

    it('hides when article has scrolled past viewport', async () => {
      render(<TestHarness html={html} />)
      await waitForScan()

      const article = document.querySelector('article')!
      mockBoundingRects(article, { containerTop: -5000, containerBottom: 100 })

      await act(async () => {
        const main = document.querySelector('main')!
        main.dispatchEvent(new Event('scroll'))
        vi.advanceTimersByTime(50)
      })

      const nav = getNav()!
      expect(nav.className).toContain('opacity-0')
    })

    it('shows when article is visible with sufficient margin', async () => {
      render(<TestHarness html={html} />)
      await waitForScan()
      const article = document.querySelector('article')!
      await makeTocVisible(article)

      expect(getNav()).toBeInTheDocument()
    })
  })

  describe('accessibility', () => {
    const html = `
      <h3 id="ch1">Chapter 1</h3>
      <h3 id="ch2">Chapter 2</h3>
    `

    it('sets aria-current on active button', async () => {
      render(<TestHarness html={html} />)
      await waitForScan()

      const article = document.querySelector('article')!
      mockBoundingRects(article)

      // ch1 above trigger line (20% of 800 = 160), ch2 below
      const ch1 = article.querySelector('#ch1')!
      const ch2 = article.querySelector('#ch2')!
      vi.spyOn(ch1, 'getBoundingClientRect').mockReturnValue({
        top: 50,
        bottom: 80,
        left: 0,
        right: 800,
        width: 800,
        height: 30,
        x: 0,
        y: 50,
        toJSON: () => ({}),
      })
      vi.spyOn(ch2, 'getBoundingClientRect').mockReturnValue({
        top: 500,
        bottom: 530,
        left: 0,
        right: 800,
        width: 800,
        height: 30,
        x: 0,
        y: 500,
        toJSON: () => ({}),
      })

      await act(async () => {
        const main = document.querySelector('main')!
        main.dispatchEvent(new Event('scroll'))
        vi.advanceTimersByTime(50)
      })

      const nav = getNav()!
      const ch1Button = within(nav).getByText('Chapter 1').closest('button')!
      expect(ch1Button.getAttribute('aria-current')).toBe('true')

      const ch2Button = within(nav).getByText('Chapter 2').closest('button')!
      expect(ch2Button.getAttribute('aria-current')).toBeNull()
    })

    it('uses semantic nav element', async () => {
      render(<TestHarness html={html} />)
      await waitForScan()
      const article = document.querySelector('article')!
      await makeTocVisible(article)

      const nav = getNav()!
      expect(nav.tagName).toBe('NAV')
    })
  })

  describe('click navigation', () => {
    const html = `
      <h3 id="ch1">Chapter 1</h3>
      <h3 id="ch2">Chapter 2</h3>
    `

    it('calls scrollIntoView on heading click', async () => {
      render(<TestHarness html={html} />)
      await waitForScan()
      const article = document.querySelector('article')!
      await makeTocVisible(article)

      const ch2El = article.querySelector('#ch2')!
      const scrollSpy = vi
        .spyOn(ch2El, 'scrollIntoView')
        .mockImplementation(() => {})

      const nav = getNav()!
      fireEvent.click(within(nav).getByText('Chapter 2'))

      expect(scrollSpy).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start',
      })
    })
  })

  describe('edge cases', () => {
    it('renders nothing when fewer than 2 entries', async () => {
      render(<TestHarness html={`<h3 id="only">Only One</h3>`} />)
      await waitForScan()
      const nav = getNav()!
      expect(nav.className).toContain('opacity-0')
    })

    it('renders nothing for empty container', async () => {
      render(<TestHarness html={`<p>No headings here</p>`} />)
      await waitForScan()
      const nav = getNav()!
      expect(nav.className).toContain('opacity-0')
    })

    it('handles headings with name attribute instead of id', async () => {
      const html = `
        <h3 name="sec1">Section One</h3>
        <h3 name="sec2">Section Two</h3>
      `
      render(<TestHarness html={html} />)
      await waitForScan()
      const article = document.querySelector('article')!
      await makeTocVisible(article)

      const nav = getNav()!
      expect(within(nav).getByText('Section One')).toBeInTheDocument()
      expect(within(nav).getByText('Section Two')).toBeInTheDocument()
    })

    it('cleans up ResizeObserver on unmount', async () => {
      const { unmount } = render(
        <TestHarness html={`<h3 id="a">A</h3><h3 id="b">B</h3>`} />
      )
      await waitForScan()

      disconnectSpy.mockClear()
      unmount()

      expect(disconnectSpy).toHaveBeenCalled()
    })
  })
})
