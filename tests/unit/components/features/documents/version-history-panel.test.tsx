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
  getDocumentTemplates: vi.fn().mockResolvedValue({ success: true, data: [] }),
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

  // ==========================================================================
  // Story 17.17 AC 17 — Model B-aware Återställ gating.
  //
  // The `restoreDocumentVersion` server action refuses on Path C
  // (APPROVED with no draft) and Path D (ARCHIVED / SUPERSEDED) under
  // Story 17.16 v2.1. The panel must mirror those refusals as inline-
  // disabled UI so users don't click through to a confusing error toast.
  // ==========================================================================

  describe('AC 17 — Återställ button state-awareness (Model B)', () => {
    it('Path A — dual-state doc: Återställ ENABLED, no hint', async () => {
      const user = userEvent.setup()
      render(
        <VersionHistoryPanel
          {...defaultProps}
          documentStatus="APPROVED"
          currentDraftVersionId="v-draft-active"
        />
      )
      await user.click(screen.getByRole('button', { name: /3/i }))
      await waitFor(() => {
        const buttons = screen
          .getAllByRole('button', { name: /Återställ/i })
          // Filter out icon-only chrome that happens to label-match
          .filter((b) => b.textContent?.includes('Återställ'))
        expect(buttons.length).toBeGreaterThan(0)
        for (const b of buttons) {
          expect(b).not.toBeDisabled()
        }
        expect(
          screen.queryByText(/Skapa utkast för att återställa/)
        ).not.toBeInTheDocument()
        expect(
          screen.queryByText(/Återaktivera dokumentet först/)
        ).not.toBeInTheDocument()
      })
    })

    it('Path B — never-approved DRAFT: Återställ ENABLED, no hint', async () => {
      const user = userEvent.setup()
      render(
        <VersionHistoryPanel
          {...defaultProps}
          documentStatus="DRAFT"
          currentDraftVersionId="v-draft-only"
        />
      )
      await user.click(screen.getByRole('button', { name: /3/i }))
      await waitFor(() => {
        const buttons = screen
          .getAllByRole('button', { name: /Återställ/i })
          .filter((b) => b.textContent?.includes('Återställ'))
        for (const b of buttons) {
          expect(b).not.toBeDisabled()
        }
      })
    })

    it('Path C — APPROVED with no draft: Återställ DISABLED + branch-first hint', async () => {
      const user = userEvent.setup()
      render(
        <VersionHistoryPanel
          {...defaultProps}
          documentStatus="APPROVED"
          currentDraftVersionId={null}
        />
      )
      await user.click(screen.getByRole('button', { name: /3/i }))
      await waitFor(() => {
        const buttons = screen
          .getAllByRole('button', { name: /Återställ/i })
          .filter((b) => b.textContent?.includes('Återställ'))
        expect(buttons.length).toBeGreaterThan(0)
        for (const b of buttons) {
          expect(b).toBeDisabled()
        }
        expect(
          screen.getAllByText(/Skapa utkast för att återställa/).length
        ).toBeGreaterThan(0)
      })
    })

    it.each(['ARCHIVED', 'SUPERSEDED'] as const)(
      'Path D — terminal status %s: Återställ DISABLED + reactivate-first hint',
      async (status) => {
        const user = userEvent.setup()
        render(
          <VersionHistoryPanel
            {...defaultProps}
            documentStatus={status}
            currentDraftVersionId={null}
          />
        )
        await user.click(screen.getByRole('button', { name: /3/i }))
        await waitFor(() => {
          const buttons = screen
            .getAllByRole('button', { name: /Återställ/i })
            .filter((b) => b.textContent?.includes('Återställ'))
          for (const b of buttons) {
            expect(b).toBeDisabled()
          }
          expect(
            screen.getAllByText(/Återaktivera dokumentet först/).length
          ).toBeGreaterThan(0)
        })
      }
    )
  })

  // ==========================================================================
  // Story 17.17 AC 16 — table-row mount uses a custom History-icon-only
  // trigger via the `trigger` prop (the row already shows the version
  // number in its own column).
  // ==========================================================================

  describe('AC 16 — custom trigger override', () => {
    it('renders the consumer-supplied trigger when `trigger` prop is set', () => {
      render(
        <VersionHistoryPanel
          {...defaultProps}
          trigger={
            <button aria-label="Visa versionshistorik för Arbetsmiljöpolicy">
              custom-icon
            </button>
          }
        />
      )
      expect(
        screen.getByRole('button', {
          name: /Visa versionshistorik för Arbetsmiljöpolicy/,
        })
      ).toBeInTheDocument()
      // The default "History + currentVersionNumber badge" button is not
      // rendered when a custom trigger is supplied.
      expect(screen.queryByText('3')).not.toBeInTheDocument()
    })
  })
})
