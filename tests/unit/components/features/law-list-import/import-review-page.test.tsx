/**
 * Story 24.4 AC 16: component tests for `<ImportReviewPage>`.
 * Covers shell-level concerns: breakdown card, filter chips, batch CTA gate,
 * commit dialog rendering with name pre-fill + summary, edge states.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn(), prefetch: vi.fn() }),
}))

vi.mock('@/app/actions/law-list-import', () => ({
  acceptAllHigh: vi.fn(),
  commitImport: vi.fn(),
  getImport: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
}))

// Stub the row component so we don't need to set up its mutation deps.
vi.mock('@/components/features/law-list-import/import-table-row', () => ({
  ImportTableRow: ({
    row,
  }: {
    row: { id: string; source_titel: string | null }
  }) => (
    <tr data-testid={`row-${row.id}`}>
      <td>{row.source_titel ?? '(no title)'}</td>
    </tr>
  ),
}))

// Stub the detail sheet — we test its mount, not its internals here.
vi.mock(
  '@/components/features/law-list-import/import-row-detail-sheet',
  () => ({
    ImportRowDetailSheet: () => null,
  })
)

import { ImportReviewPage } from '@/components/features/law-list-import/import-review-page'
import { acceptAllHigh, commitImport } from '@/app/actions/law-list-import'
import type { ImportSummary } from '@/app/actions/law-list-import'

const mockAcceptAllHigh = vi.mocked(acceptAllHigh)
const mockCommitImport = vi.mocked(commitImport)

function makeImport(overrides: Partial<ImportSummary> = {}): ImportSummary {
  return {
    id: 'imp-1',
    filename: 'notisum-export.xlsx',
    source_type: 'xlsx',
    status: 'AWAITING_REVIEW',
    row_count: 2,
    committed_law_list_id: null,
    error_message: null,
    created_at: new Date(),
    committed_at: null,
    rows: [
      {
        id: 'row-1',
        row_index: 0,
        source_titel: 'Arbetsmiljölag',
        source_sfs_nummer: 'SFS 1977:1160',
        source_omrade: null,
        source_lagansvarig: null,
        source_kommentar: null,
        match_status: 'MATCHED_HIGH',
        matched_document_id: 'doc-1',
        matched_document: null,
        confidence_score: 0.95,
        match_candidates: [],
        match_reasoning: null,
      },
      {
        id: 'row-2',
        row_index: 1,
        source_titel: 'Helt unmatched',
        source_sfs_nummer: null,
        source_omrade: null,
        source_lagansvarig: null,
        source_kommentar: null,
        match_status: 'UNMATCHED',
        matched_document_id: null,
        matched_document: null,
        confidence_score: 0.1,
        match_candidates: [],
        match_reasoning: null,
      },
    ],
    counts: {
      total: 2,
      matched_high: 1,
      matched_medium: 0,
      unmatched: 1,
      accepted: 0,
      replaced: 0,
      rejected: 0,
      catalog_requested: 0,
      catalog_fulfilled: 0,
    },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAcceptAllHigh.mockResolvedValue({ success: true, data: { count: 1 } })
  mockCommitImport.mockResolvedValue({
    success: true,
    data: { lawListId: 'list-1' },
  })
})

describe('<ImportReviewPage> — breakdown + filters', () => {
  it('renders the breakdown tiles with correct labels (filter UI lives on tiles)', () => {
    render(<ImportReviewPage initialImport={makeImport()} />)
    // Tiles are now the only filter UI — three tiles are always rendered;
    // the 4th "Hanterade" tile only appears when handledCount > 0.
    expect(screen.getByText('Saknas i katalogen')).toBeInTheDocument()
    expect(screen.getByText('Hög')).toBeInTheDocument()
    expect(screen.getByText('Behöver bekräftelse')).toBeInTheDocument()
  })

  it('does NOT render the legacy filter chips (Alla / Saknas / Hanterade pills)', () => {
    render(<ImportReviewPage initialImport={makeImport()} />)
    // "Alla" / "Saknas" / "Hanterade" used to be standalone chip pills. After
    // the tile-promotion refactor those exact button names should be gone —
    // tile labels use the longer "Saknas i katalogen" / "Behöver bekräftelse"
    // copy, and "Alla" is replaced by the active-tile-toggle pattern.
    expect(
      screen.queryByRole('button', { name: 'Alla' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Saknas' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Hanterade' })
    ).not.toBeInTheDocument()
  })
})

describe('<ImportReviewPage> — batch action gating', () => {
  it('shows "Acceptera alla höga" only when MATCHED_HIGH count > 0', () => {
    render(<ImportReviewPage initialImport={makeImport()} />)
    // The button label is "Acceptera alla höga (1)" — fully accessible (no aria-hidden).
    expect(
      screen.getByRole('button', { name: /Acceptera alla höga \(1\)/ })
    ).toBeInTheDocument()
  })

  it('hides "Acceptera alla höga" when no high-confidence rows pending', () => {
    render(
      <ImportReviewPage
        initialImport={makeImport({
          counts: {
            total: 1,
            matched_high: 0,
            matched_medium: 1,
            unmatched: 0,
            accepted: 0,
            replaced: 0,
            rejected: 0,
            catalog_requested: 0,
            catalog_fulfilled: 0,
          },
        })}
      />
    )
    expect(
      screen.queryByRole('button', { name: /Acceptera alla höga/ })
    ).not.toBeInTheDocument()
  })

  it('disables commit CTA when 0 accepted', () => {
    render(<ImportReviewPage initialImport={makeImport()} />)
    expect(
      screen.getByRole('button', { name: 'Bekräfta och skapa lista' })
    ).toBeDisabled()
  })

  it('enables commit CTA when ≥1 accepted', () => {
    render(
      <ImportReviewPage
        initialImport={makeImport({
          counts: {
            total: 2,
            matched_high: 0,
            matched_medium: 0,
            unmatched: 0,
            accepted: 2,
            replaced: 0,
            rejected: 0,
            catalog_requested: 0,
            catalog_fulfilled: 0,
          },
        })}
      />
    )
    expect(
      screen.getByRole('button', { name: 'Bekräfta och skapa lista' })
    ).toBeEnabled()
  })
})

describe('<ImportReviewPage> — commit dialog', () => {
  it('pre-fills list name with filename minus extension', async () => {
    const user = userEvent.setup()
    render(
      <ImportReviewPage
        initialImport={makeImport({
          filename: 'My Custom List.xlsx',
          counts: {
            total: 1,
            matched_high: 0,
            matched_medium: 0,
            unmatched: 0,
            accepted: 1,
            replaced: 0,
            rejected: 0,
            catalog_requested: 0,
            catalog_fulfilled: 0,
          },
        })}
      />
    )

    await user.click(
      screen.getByRole('button', { name: 'Bekräfta och skapa lista' })
    )
    const input = (await screen.findByLabelText(
      'Namn på listan'
    )) as HTMLInputElement
    expect(input.value).toBe('My Custom List')
  })

  it('summary mentions accepted + requested + rejected counts', async () => {
    const user = userEvent.setup()
    render(
      <ImportReviewPage
        initialImport={makeImport({
          counts: {
            total: 5,
            matched_high: 0,
            matched_medium: 0,
            unmatched: 0,
            accepted: 3,
            replaced: 0,
            rejected: 1,
            catalog_requested: 1,
            catalog_fulfilled: 0,
          },
        })}
      />
    )

    await user.click(
      screen.getByRole('button', { name: 'Bekräfta och skapa lista' })
    )
    // "3 rader läggs till, 1 skickas för manuell registrering, 1 avvisas"
    const summary = await screen.findByText(/3 rader läggs till/)
    expect(summary.textContent).toContain('1 skickas för manuell registrering')
    expect(summary.textContent).toContain('1 avvisas')
  })

  it('routes to /laglistor/{lawListId} on successful commit', async () => {
    const user = userEvent.setup()
    render(
      <ImportReviewPage
        initialImport={makeImport({
          counts: {
            total: 1,
            matched_high: 0,
            matched_medium: 0,
            unmatched: 0,
            accepted: 1,
            replaced: 0,
            rejected: 0,
            catalog_requested: 0,
            catalog_fulfilled: 0,
          },
        })}
      />
    )

    await user.click(
      screen.getByRole('button', { name: 'Bekräfta och skapa lista' })
    )
    await user.click(screen.getByRole('button', { name: 'Bekräfta' }))

    expect(mockCommitImport).toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/laglistor?list=list-1')
  })
})

describe('<ImportReviewPage> — edge states', () => {
  it('renders MATCHING-state polling card', () => {
    render(
      <ImportReviewPage
        initialImport={makeImport({ status: 'MATCHING', rows: [] })}
      />
    )
    expect(screen.getByText('Vi matchar fortfarande…')).toBeInTheDocument()
  })

  it('renders FAILED-state error card with error_message', () => {
    render(
      <ImportReviewPage
        initialImport={makeImport({
          status: 'FAILED',
          error_message: 'Något gick fel',
          rows: [],
        })}
      />
    )
    expect(screen.getByText('Importen misslyckades')).toBeInTheDocument()
    expect(screen.getByText('Något gick fel')).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Skapa supportärende/ })
    ).toBeInTheDocument()
  })

  it('renders COMMITTED-state success card with deep link to law list', () => {
    render(
      <ImportReviewPage
        initialImport={makeImport({
          status: 'COMMITTED',
          committed_law_list_id: 'list-99',
          counts: {
            total: 1,
            matched_high: 0,
            matched_medium: 0,
            unmatched: 0,
            accepted: 1,
            replaced: 0,
            rejected: 0,
            catalog_requested: 0,
            catalog_fulfilled: 0,
          },
          rows: [],
        })}
      />
    )
    expect(screen.getByText('Listan är skapad')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /Öppna listan/ })
    expect(link).toHaveAttribute('href', '/laglistor?list=list-99')
  })

  it('renders empty-rows fallback', () => {
    render(
      <ImportReviewPage
        initialImport={makeImport({
          status: 'AWAITING_REVIEW',
          rows: [],
          counts: {
            total: 0,
            matched_high: 0,
            matched_medium: 0,
            unmatched: 0,
            accepted: 0,
            replaced: 0,
            rejected: 0,
            catalog_requested: 0,
            catalog_fulfilled: 0,
          },
        })}
      />
    )
    expect(screen.getByText('Inga rader att granska')).toBeInTheDocument()
  })
})

// Virtualisation tests removed — the table-shape redesign drops virtualisation
// entirely. Compact TableRow elements (~52 px each, plain DOM, no rich card
// chrome) render fine for the 1000-row parser cap. If perf becomes an issue
// past ~2000 rows, swap in a virtual-table wrapper and restore these tests.

describe('<ImportReviewPage> — batch accept', () => {
  it('opens confirmation dialog and calls acceptAllHigh on confirm', async () => {
    const user = userEvent.setup()
    render(<ImportReviewPage initialImport={makeImport()} />)

    await user.click(
      screen.getByRole('button', { name: /Acceptera alla höga/ })
    )
    // Inline confirmation text from AlertDialogTitle
    await screen.findByText(/Acceptera 1 höga matchningar utan granskning?/)
    await user.click(screen.getByRole('button', { name: 'Acceptera' }))
    expect(mockAcceptAllHigh).toHaveBeenCalledWith('imp-1')
  })
})
