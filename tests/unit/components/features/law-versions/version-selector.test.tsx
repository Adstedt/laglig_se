import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { VersionSelector } from '@/components/features/law-versions/version-selector'

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('VersionSelector', () => {
  const mockAmendments = {
    amendments: [
      { sfsNumber: '2020:1', effectiveDate: '2020-01-01', sectionsChanged: 5 },
      { sfsNumber: '2019:1', effectiveDate: '2019-06-01', sectionsChanged: 3 },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAmendments),
    })
  })

  it('renders loading state initially', () => {
    render(<VersionSelector lawSlug="test-law" lawSfs="1977:1160" />)
    expect(screen.getByText('Laddar...')).toBeInTheDocument()
  })

  it('renders version selector button after loading', async () => {
    render(<VersionSelector lawSlug="test-law" lawSfs="1977:1160" />)

    await waitFor(() => {
      expect(screen.getByText('Välj version')).toBeInTheDocument()
    })
  })

  it('navigates to public version URL when isWorkspace is false', async () => {
    render(
      <VersionSelector
        lawSlug="test-law"
        lawSfs="1977:1160"
        isWorkspace={false}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Välj version')).toBeInTheDocument()
    })

    // Open popover
    fireEvent.click(screen.getByText('Välj version'))

    // Click on current version
    await waitFor(() => {
      fireEvent.click(screen.getByText('Gällande version'))
    })

    expect(mockPush).toHaveBeenCalledWith('/lagar/test-law')
  })

  it('navigates to workspace version URL when isWorkspace is true', async () => {
    render(
      <VersionSelector
        lawSlug="test-law"
        lawSfs="1977:1160"
        isWorkspace={true}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Välj version')).toBeInTheDocument()
    })

    // Open popover
    fireEvent.click(screen.getByText('Välj version'))

    // Click on current version
    await waitFor(() => {
      fireEvent.click(screen.getByText('Gällande version'))
    })

    expect(mockPush).toHaveBeenCalledWith('/browse/lagar/test-law')
  })

  it('navigates to workspace history when clicking "Alla" in workspace mode', async () => {
    render(
      <VersionSelector
        lawSlug="test-law"
        lawSfs="1977:1160"
        isWorkspace={true}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Välj version')).toBeInTheDocument()
    })

    // Open popover
    fireEvent.click(screen.getByText('Välj version'))

    // Click on "Alla" button
    await waitFor(() => {
      fireEvent.click(screen.getByText(/Alla/))
    })

    expect(mockPush).toHaveBeenCalledWith('/browse/lagar/test-law/historik')
  })
})
