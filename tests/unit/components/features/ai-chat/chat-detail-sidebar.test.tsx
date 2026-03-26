import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChatDetailProvider, useChatDetail } from '@/lib/ai/chat-detail-context'
import { ChatDetailSidebar } from '@/components/features/ai-chat/chat-detail-sidebar'
import type { CitationDetailData } from '@/lib/ai/chat-detail-context'

// Mock useMediaQuery to default to desktop
vi.mock('@/lib/hooks/use-media-query', () => ({
  useMediaQuery: vi.fn(() => true),
}))

const mockCitation: CitationDetailData = {
  title: 'Arbetsmiljölagen',
  snippet: 'Arbetsgivaren skall systematiskt planera...',
  documentNumber: 'SFS 1977:1160',
  slug: 'arbetsmiljolagen-1977-1160',
  anchorId: 'K3P2',
  path: 'Kap 3 › 2 §',
}

// Helper to render sidebar with a button that opens a detail
function TestHarness() {
  const { openDetail, activeDetail } = useChatDetail()
  return (
    <div>
      <button
        data-testid="open-citation"
        onClick={() =>
          openDetail({
            type: 'citation',
            id: 'test-citation-1',
            data: mockCitation,
          })
        }
      >
        Open Citation
      </button>
      <button
        data-testid="open-tool"
        onClick={() =>
          openDetail({
            type: 'tool-result',
            id: 'tool-1',
            toolName: 'search_laws',
            data: {
              data: [
                {
                  contextualHeader: 'AML Kap 3',
                  documentNumber: 'SFS 1977:1160',
                  slug: 'test',
                  relevanceScore: 0.92,
                  snippet: 'Test snippet',
                },
              ],
              _meta: {
                tool: 'search_laws',
                executionTimeMs: 150,
                resultCount: 1,
              },
            },
          })
        }
      >
        Open Tool Result
      </button>
      <span data-testid="active-detail">
        {activeDetail ? `${activeDetail.type}:${activeDetail.id}` : 'none'}
      </span>
      <ChatDetailSidebar />
    </div>
  )
}

function renderWithProvider() {
  return render(
    <ChatDetailProvider>
      <TestHarness />
    </ChatDetailProvider>
  )
}

describe('ChatDetailSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('is hidden when no detail is open', () => {
    renderWithProvider()
    const sidebar = screen.getByRole('complementary')
    expect(sidebar.className).toContain('w-0')
  })

  it('has correct ARIA attributes', () => {
    renderWithProvider()
    const sidebar = screen.getByRole('complementary')
    expect(sidebar).toHaveAttribute('aria-label', 'Detaljpanel')
  })

  it('opens and shows citation detail when triggered', () => {
    renderWithProvider()

    fireEvent.click(screen.getByTestId('open-citation'))

    const sidebar = screen.getByRole('complementary')
    expect(sidebar.className).not.toContain('w-0')
    // Header shows combined breadcrumb: "Arbetsmiljölagen › Kap 3 › 2 §"
    expect(screen.getByText(/Arbetsmiljölagen/)).toBeInTheDocument()
    // Section label should appear
    expect(screen.getByText('Källa')).toBeInTheDocument()
  })

  it('shows tool result detail when triggered', () => {
    renderWithProvider()

    fireEvent.click(screen.getByTestId('open-tool'))

    // Search results detail should render
    expect(screen.getByText('1 resultat')).toBeInTheDocument()
  })

  it('closes on Escape key', () => {
    renderWithProvider()

    fireEvent.click(screen.getByTestId('open-citation'))
    expect(screen.getByTestId('active-detail').textContent).toBe(
      'citation:test-citation-1'
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.getByTestId('active-detail').textContent).toBe('none')
  })

  it('closes when close button is clicked', () => {
    renderWithProvider()

    fireEvent.click(screen.getByTestId('open-citation'))
    expect(screen.getByTestId('active-detail').textContent).toBe(
      'citation:test-citation-1'
    )

    fireEvent.click(screen.getByLabelText('Stäng detaljpanel'))
    expect(screen.getByTestId('active-detail').textContent).toBe('none')
  })

  it('replaces content when a different detail is opened', () => {
    renderWithProvider()

    fireEvent.click(screen.getByTestId('open-citation'))
    expect(screen.getByTestId('active-detail').textContent).toBe(
      'citation:test-citation-1'
    )

    fireEvent.click(screen.getByTestId('open-tool'))
    expect(screen.getByTestId('active-detail').textContent).toBe(
      'tool-result:tool-1'
    )
  })
})

describe('ChatDetailSidebar — mobile', () => {
  it('renders bottom sheet on mobile', async () => {
    const { useMediaQuery } = await import('@/lib/hooks/use-media-query')
    vi.mocked(useMediaQuery).mockReturnValue(false)

    renderWithProvider()
    fireEvent.click(screen.getByTestId('open-citation'))

    // The sidebar should not have role="complementary" — Sheet renders differently
    // Just check that the detail content renders somewhere
    expect(screen.getByText(/Arbetsmiljölagen/)).toBeInTheDocument()
  })
})
