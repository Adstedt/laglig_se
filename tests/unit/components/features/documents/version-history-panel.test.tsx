import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VersionHistoryPanel } from '@/components/features/documents/editor/version-history-panel'

// Mock server actions
const mockGetDocumentVersions = vi.fn()
const mockRestoreDocumentVersion = vi.fn()

vi.mock('@/app/actions/documents', () => ({
  getDocumentVersions: (...args: unknown[]) => mockGetDocumentVersions(...args),
  restoreDocumentVersion: (...args: unknown[]) =>
    mockRestoreDocumentVersion(...args),
}))

const MOCK_VERSIONS = [
  {
    id: 'ver-3',
    version_number: 3,
    source: 'TIPTAP',
    change_summary: 'Updated section 2',
    created_by: 'user-1',
    created_at: new Date(),
    author: { id: 'user-1', name: 'Anna Svensson', avatar_url: null },
  },
  {
    id: 'ver-2',
    version_number: 2,
    source: 'AGENT',
    change_summary: 'AI-genererad uppdatering',
    created_by: 'agent',
    created_at: new Date(Date.now() - 3600_000),
    author: { id: 'agent', name: 'AI-assistent', avatar_url: null },
  },
  {
    id: 'ver-1',
    version_number: 1,
    source: 'TIPTAP',
    change_summary: null,
    created_by: 'user-1',
    created_at: new Date(Date.now() - 86400_000),
    author: { id: 'user-1', name: 'Anna Svensson', avatar_url: null },
  },
]

describe('VersionHistoryPanel', () => {
  const defaultProps = {
    documentId: 'doc-1',
    currentVersionNumber: 3,
    onRestore: vi.fn(),
    onCompare: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDocumentVersions.mockResolvedValue({
      success: true,
      data: MOCK_VERSIONS,
    })
  })

  it('renders the trigger button with version count badge', () => {
    render(<VersionHistoryPanel {...defaultProps} />)
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('shows version list when opened', async () => {
    const user = userEvent.setup()
    render(<VersionHistoryPanel {...defaultProps} />)

    // Click trigger button (the one with the History icon)
    const trigger = screen.getByRole('button', { name: /3/i })
    await user.click(trigger)

    await waitFor(() => {
      expect(screen.getByText('Versionshistorik')).toBeInTheDocument()
    })

    expect(screen.getByText('v3')).toBeInTheDocument()
    expect(screen.getByText('v2')).toBeInTheDocument()
    expect(screen.getByText('v1')).toBeInTheDocument()
  })

  it('shows "Aktuell" badge on the current version', async () => {
    const user = userEvent.setup()
    render(<VersionHistoryPanel {...defaultProps} />)

    const trigger = screen.getByRole('button', { name: /3/i })
    await user.click(trigger)

    await waitFor(() => {
      expect(screen.getByText('Aktuell')).toBeInTheDocument()
    })
  })

  it('shows author names resolved from data', async () => {
    const user = userEvent.setup()
    render(<VersionHistoryPanel {...defaultProps} />)

    const trigger = screen.getByRole('button', { name: /3/i })
    await user.click(trigger)

    await waitFor(() => {
      expect(screen.getAllByText('Anna Svensson')).toHaveLength(2) // ver-3 and ver-1
      expect(screen.getByText('AI-assistent')).toBeInTheDocument()
    })
  })

  it('shows source badges', async () => {
    const user = userEvent.setup()
    render(<VersionHistoryPanel {...defaultProps} />)

    const trigger = screen.getByRole('button', { name: /3/i })
    await user.click(trigger)

    await waitFor(() => {
      expect(screen.getAllByText('Tiptap')).toHaveLength(2)
      expect(screen.getByText('Agent')).toBeInTheDocument()
    })
  })

  it('shows change summary when present', async () => {
    const user = userEvent.setup()
    render(<VersionHistoryPanel {...defaultProps} />)

    const trigger = screen.getByRole('button', { name: /3/i })
    await user.click(trigger)

    await waitFor(() => {
      expect(screen.getByText('Updated section 2')).toBeInTheDocument()
      expect(screen.getByText('AI-genererad uppdatering')).toBeInTheDocument()
    })
  })

  it('does not show Återställ button on current version', async () => {
    const user = userEvent.setup()
    render(<VersionHistoryPanel {...defaultProps} />)

    const trigger = screen.getByRole('button', { name: /3/i })
    await user.click(trigger)

    await waitFor(() => {
      // Only 2 restore buttons (for v2 and v1, not v3)
      const restoreButtons = screen.getAllByText('Återställ')
      expect(restoreButtons).toHaveLength(2)
    })
  })

  it('shows loading state', async () => {
    mockGetDocumentVersions.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    )

    const user = userEvent.setup()
    render(<VersionHistoryPanel {...defaultProps} />)

    const trigger = screen.getByRole('button', { name: /3/i })
    await user.click(trigger)

    await waitFor(() => {
      expect(screen.getByText('Laddar versioner...')).toBeInTheDocument()
    })
  })
})
