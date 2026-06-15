/**
 * Story 17.9d: file-aware citation pill.
 *
 * Covers AC 7b/c/d:
 *  - a file-resolved pill renders the Paperclip icon + snippet preview +
 *    "Öppna filen", and a click opens the file (getFileById) rather than the
 *    legal sidebar (openDetail);
 *  - a legal doc-level source still SUPPRESSES its snippet and still routes to
 *    the sidebar (the AC 6 non-regression guard);
 *  - a file source with an empty snippet renders cleanly (no empty preview).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { CitationSourceProvider } from '@/lib/ai/citation-context'
import type { SourceInfo } from '@/lib/ai/citations'
import { CitationPillInline } from '@/components/features/ai-chat/citation-pill'

// --- mocks -----------------------------------------------------------------

vi.mock('@/lib/track-event', () => ({ trackEvent: vi.fn() }))

// CitationPillInline calls useRouter (workspace styrdokument sources navigate
// straight to the document). Provide a stub router so the component mounts.
const mockRouterPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}))

const mockGetFileById = vi.fn()
const mockGetFileDownloadUrl = vi.fn()
vi.mock('@/app/actions/files', () => ({
  getFileById: (id: string) => mockGetFileById(id),
  getFileDownloadUrl: (id: string) => mockGetFileDownloadUrl(id),
}))

// Stub QuickPreview to avoid pulling in the pdf/image preview tree.
vi.mock('@/components/features/files/quick-preview', () => ({
  QuickPreview: ({ open }: { open: boolean }) =>
    open ? <div data-testid="quick-preview" /> : null,
}))

const mockOpenDetail = vi.fn()
vi.mock('@/lib/ai/chat-detail-context', () => ({
  useChatDetailSafe: () => ({
    activeDetail: null,
    openDetail: mockOpenDetail,
  }),
}))

// --- helpers ---------------------------------------------------------------

function renderPill(label: string, source: SourceInfo) {
  const map = new Map<string, SourceInfo>([[source.documentNumber, source]])
  return render(
    (
      <CitationSourceProvider sourceMap={map}>
        <CitationPillInline>{label}</CitationPillInline>
      </CitationSourceProvider>
    ) as ReactNode
  )
}

function fileSource(overrides: Partial<SourceInfo> = {}): SourceInfo {
  return {
    documentNumber: 'anställningsavtal.pdf',
    title: 'anställningsavtal.pdf',
    snippet: 'Uppsägningstiden är tre månader.',
    slug: null,
    path: null,
    anchorId: null,
    fileId: 'file-42',
    ...overrides,
  }
}

function legalSource(): SourceInfo {
  return {
    documentNumber: 'SFS 1977:1160',
    title: 'Arbetsmiljölag',
    snippet: 'Doc-level summary that must stay hidden.',
    slug: 'sfs-1977-1160',
    path: null,
    anchorId: null,
  }
}

/** Hover the pill open (the component gates its open state behind a 200ms timer). */
function openHoverCard(label: string) {
  fireEvent.mouseEnter(screen.getByText(label))
  act(() => {
    vi.advanceTimersByTime(250)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetFileById.mockResolvedValue({
    success: true,
    data: { id: 'file-42', filename: 'anställningsavtal.pdf' },
  })
  mockGetFileDownloadUrl.mockResolvedValue({
    success: true,
    data: { url: 'https://signed.example/anställningsavtal.pdf' },
  })
})

// --- tests -----------------------------------------------------------------

describe('CitationPillInline — file sources (Story 17.9d)', () => {
  it('renders a Paperclip icon on a file pill (AC 2)', () => {
    const { container } = renderPill('anställningsavtal.pdf', fileSource())
    expect(container.querySelector('.lucide-paperclip')).not.toBeNull()
  })

  it('previews the cited passage and offers "Öppna filen" (AC 7b)', () => {
    vi.useFakeTimers()
    try {
      renderPill('anställningsavtal.pdf', fileSource())
      openHoverCard('anställningsavtal.pdf')
      expect(
        screen.getByText('Uppsägningstiden är tre månader.')
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: /Öppna filen/i })
      ).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('opens the file (getFileById) instead of the legal sidebar on click (AC 7b)', async () => {
    renderPill('anställningsavtal.pdf', fileSource())
    fireEvent.click(screen.getByText('anställningsavtal.pdf'))
    await waitFor(() => expect(mockGetFileById).toHaveBeenCalledWith('file-42'))
    expect(mockOpenDetail).not.toHaveBeenCalled()
    expect(await screen.findByTestId('quick-preview')).toBeInTheDocument()
  })

  // Regression: the pill renders inside a markdown <p>; the QuickPreview modal
  // is block-level (<div>/<p>) and MUST be portaled to <body>, or it nests a
  // <div> inside a <p> → invalid HTML + hydration errors (field bug).
  it('portals the preview modal out of the wrapping <p> (no <div>-in-<p>)', async () => {
    const map = new Map<string, SourceInfo>([
      ['anställningsavtal.pdf', fileSource()],
    ])
    render(
      (
        <CitationSourceProvider sourceMap={map}>
          <p>
            <CitationPillInline>anställningsavtal.pdf</CitationPillInline>
          </p>
        </CitationSourceProvider>
      ) as ReactNode
    )
    fireEvent.click(screen.getByText('anställningsavtal.pdf'))
    const modal = await screen.findByTestId('quick-preview')
    // Portaled to body → it has no <p> ancestor.
    expect(modal.closest('p')).toBeNull()
  })

  it('renders cleanly when the snippet is empty — no preview, still openable (AC 7d)', () => {
    vi.useFakeTimers()
    try {
      renderPill('anställningsavtal.pdf', fileSource({ snippet: null }))
      openHoverCard('anställningsavtal.pdf')
      expect(
        screen.getByRole('button', { name: /Öppna filen/i })
      ).toBeInTheDocument()
      // No empty muted preview paragraph leaks through.
      expect(
        screen.queryByText('Uppsägningstiden är tre månader.')
      ).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('CitationPillInline — legal non-regression (Story 17.9d AC 6)', () => {
  it('suppresses a legal doc-level snippet and still routes to the sidebar', () => {
    renderPill('SFS 1977:1160', legalSource())

    // Clicking a legal pill opens the sidebar detail, not a file. Done while
    // the hover card is still closed so the label matches a single element.
    fireEvent.click(screen.getByText('SFS 1977:1160'))
    expect(mockOpenDetail).toHaveBeenCalledTimes(1)
    expect(mockGetFileById).not.toHaveBeenCalled()

    // Open the hover card to verify the doc-level snippet stays hidden
    // (isChunkLevel false, not a file) and no file affordance appears.
    vi.useFakeTimers()
    try {
      openHoverCard('SFS 1977:1160')
      expect(
        screen.queryByText('Doc-level summary that must stay hidden.')
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('button', { name: /Öppna filen/i })
      ).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
