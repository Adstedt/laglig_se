/**
 * Component tests for `<ImportTableRow>` — the compact shadcn TableRow
 * that replaced `<ImportRowCard>` in the import review-surface redesign.
 *
 * Focus: per-status action variants, click-to-open-detail behaviour,
 * stop-propagation on action buttons.
 */

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, beforeEach, it, expect } from 'vitest'
import {
  acceptRow,
  rejectRow,
  type ImportRowSummary,
} from '@/app/actions/law-list-import'
import { ImportTableRow } from '@/components/features/law-list-import/import-table-row'

vi.mock('@/app/actions/law-list-import', () => ({
  acceptRow: vi.fn(),
  rejectRow: vi.fn(),
  replaceRowMatch: vi.fn(),
  undoRowDecision: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

const mockAcceptRow = vi.mocked(acceptRow)
const mockRejectRow = vi.mocked(rejectRow)

function row(overrides: Partial<ImportRowSummary> = {}): ImportRowSummary {
  return {
    id: 'r-1',
    row_index: 0,
    source_titel: 'Arbetsmiljölag',
    source_sfs_nummer: 'SFS 1977:1160',
    source_omrade: null,
    source_lagansvarig: null,
    source_kommentar: null,
    match_status: 'MATCHED_HIGH',
    matched_document_id: 'doc-1',
    matched_document: {
      id: 'doc-1',
      title: 'Arbetsmiljölag (1977:1160)',
      document_number: 'SFS 1977:1160',
      content_type: 'SFS_LAW',
      slug: 'arbetsmiljolag-1977-1160',
    },
    confidence_score: 1,
    match_candidates: [],
    match_reasoning: 'Perfekt matchning.',
    ...overrides,
  }
}

function renderRow(props: Partial<Parameters<typeof ImportTableRow>[0]> = {}) {
  const onOpenDetail = props.onOpenDetail ?? vi.fn()
  const onMutated = props.onMutated ?? vi.fn()
  const utils = render(
    <table>
      <tbody>
        <ImportTableRow
          row={props.row ?? row()}
          importId="imp-1"
          readOnly={props.readOnly ?? false}
          onOpenDetail={onOpenDetail}
          onMutated={onMutated}
        />
      </tbody>
    </table>
  )
  return { ...utils, onOpenDetail, onMutated }
}

describe('<ImportTableRow>', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAcceptRow.mockResolvedValue({ success: true })
    mockRejectRow.mockResolvedValue({ success: true })
  })

  it('renders source title + document number, matched-doc title + dnr, and tier badge', () => {
    renderRow()
    expect(screen.getByText('Arbetsmiljölag')).toBeInTheDocument()
    expect(screen.getAllByText('SFS 1977:1160').length).toBeGreaterThanOrEqual(
      1
    )
    expect(screen.getByText('Arbetsmiljölag (1977:1160)')).toBeInTheDocument()
    expect(screen.getByText('Hög')).toBeInTheDocument()
  })

  it('clicking the row body fires onOpenDetail', async () => {
    const user = userEvent.setup()
    const { onOpenDetail } = renderRow()
    await user.click(screen.getByText('Arbetsmiljölag'))
    expect(onOpenDetail).toHaveBeenCalledOnce()
  })

  it('clicking Acceptera does NOT bubble to onOpenDetail and calls acceptRow', async () => {
    const user = userEvent.setup()
    const { onOpenDetail, onMutated } = renderRow()
    await user.click(screen.getByRole('button', { name: 'Acceptera' }))
    expect(mockAcceptRow).toHaveBeenCalledWith('r-1')
    expect(onOpenDetail).not.toHaveBeenCalled()
    // Optimistic — onMutated called once mutation resolves
    expect(onMutated).toHaveBeenCalled()
  })

  it('UNMATCHED variant: shows Begär tillägg button + Avvisa icon', () => {
    renderRow({
      row: row({
        match_status: 'UNMATCHED',
        matched_document_id: null,
        matched_document: null,
        confidence_score: 0,
      }),
    })
    expect(
      screen.getByRole('button', { name: 'Begär tillägg' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Avvisa raden' })
    ).toBeInTheDocument()
    expect(screen.getByText('Inget matchande dokument')).toBeInTheDocument()
  })

  it('UNMATCHED Begär tillägg button opens the detail sheet (delegates to drawer)', async () => {
    const user = userEvent.setup()
    const { onOpenDetail } = renderRow({
      row: row({
        match_status: 'UNMATCHED',
        matched_document_id: null,
        matched_document: null,
      }),
    })
    await user.click(screen.getByRole('button', { name: 'Begär tillägg' }))
    expect(onOpenDetail).toHaveBeenCalledOnce()
  })

  it('UNMATCHED Avvisa button calls rejectRow inline (does not open sheet)', async () => {
    const user = userEvent.setup()
    const { onOpenDetail } = renderRow({
      row: row({
        match_status: 'UNMATCHED',
        matched_document_id: null,
        matched_document: null,
      }),
    })
    await user.click(screen.getByRole('button', { name: 'Avvisa raden' }))
    expect(mockRejectRow).toHaveBeenCalledWith('r-1')
    expect(onOpenDetail).not.toHaveBeenCalled()
  })

  it('decided row (ACCEPTED_BY_USER) hides actions + shows Ångra link', () => {
    renderRow({
      row: row({ match_status: 'ACCEPTED_BY_USER' }),
    })
    expect(
      screen.queryByRole('button', { name: 'Acceptera' })
    ).not.toBeInTheDocument()
    expect(screen.getByText('Ångra')).toBeInTheDocument()
  })

  it('readOnly hides primary actions, leaves status indicator visible', () => {
    renderRow({
      readOnly: true,
      row: row({ match_status: 'ACCEPTED_BY_USER' }),
    })
    expect(
      screen.queryByRole('button', { name: 'Acceptera' })
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Ångra')).not.toBeInTheDocument()
  })

  it('opens overflow menu and shows alt candidates when available', async () => {
    const user = userEvent.setup()
    renderRow({
      row: row({
        match_candidates: [
          {
            document_id: 'cand-2',
            title: 'Alternativ kandidat',
            document_number: 'SFS 2020:99',
            content_type: 'SFS_LAW',
            fuzzy_score: 0.7,
            match_signals: {
              document_number_exact: false,
              document_number_suffix_match: false,
              title_trigram_score: 0.7,
              has_amendment_match: false,
            },
          },
        ],
      }),
    })
    await user.click(screen.getByRole('button', { name: 'Fler åtgärder' }))
    const menu = await screen.findByRole('menu')
    expect(within(menu).getByText('Visa detaljer')).toBeInTheDocument()
    expect(within(menu).getByText('Alternativ kandidat')).toBeInTheDocument()
    expect(within(menu).getByText('Avvisa raden')).toBeInTheDocument()
  })
})
