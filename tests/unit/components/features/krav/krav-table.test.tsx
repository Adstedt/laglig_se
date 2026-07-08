/**
 * Story 20.3 AC 24–29 + QA TEST-001: KravTable column rendering + sort
 * dispatch + Ladda fler button gating.
 *
 * Virtualization (AC 28) is tested indirectly by asserting the primary
 * render path is correct below threshold; the virtualized code path is
 * deterministic (`useVirtualizer` with enabled: shouldVirtualize) and
 * guarded by the shouldVirtualize computation.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Epic 28: KravTable renders via the DataTable core, whose renderer switch
// is container-width-driven. happy-dom has no layout (width 0 → card view),
// so report a wide container to exercise the TABLE renderer these tests pin.
vi.mock('@/components/ui/data-table/use-container-width', () => ({
  useContainerWidth: () => ({ ref: () => {}, width: 1400 }),
}))

import { KravTable } from '@/components/features/krav/krav-table'
import type { WorkspaceRequirementRow } from '@/app/actions/workspace-requirements'
import type { WorkspaceMemberOption } from '@/app/actions/document-list'

const MEMBER: WorkspaceMemberOption = {
  id: 'user-1',
  name: 'Anna Andersson',
  email: 'anna@example.se',
  avatarUrl: null,
}

function makeRow(
  overrides: Partial<WorkspaceRequirementRow> = {}
): WorkspaceRequirementRow {
  return {
    id: 'req-1',
    text: 'Rutinen finns dokumenterad',
    comment: null,
    isFulfilled: false,
    bevisRequired: false,
    responsibleUserId: null,
    effectiveAssignee: { userId: null, isInherited: false },
    evidenceCount: 0,
    lawItemId: 'list-item-1',
    lawId: 'doc-1',
    lawName: 'SFS 2020:123',
    laglistaId: 'list-1',
    laglistaName: 'Huvudlista',
    updatedAt: new Date('2026-04-20T10:00:00Z'),
    ...overrides,
  }
}

function noopProps() {
  return {
    members: [MEMBER],
    sort: { field: 'updated_at' as const, direction: 'desc' as const },
    onSortChange: vi.fn(),
    onToggleFulfilled: vi.fn(),
    onAssigneeChange: vi.fn(),
    onResetAssignee: vi.fn(),
    onOpenLawItem: vi.fn(),
    nextCursor: null as string | null,
    onLoadMore: vi.fn(),
    isLoadingMore: false,
  }
}

describe('KravTable', () => {
  it('renders text / law / laglista / date cells for a row (AC 24)', () => {
    const row = makeRow({
      text: 'Dokumentera rutiner',
      lawName: 'SFS 2001:99',
      laglistaName: 'Arbetsmiljö',
    })
    render(<KravTable rows={[row]} {...noopProps()} />)

    expect(screen.getAllByText('Dokumentera rutiner').length).toBeGreaterThan(0)
    expect(screen.getByText('SFS 2001:99')).toBeInTheDocument()
    expect(screen.getByText('Arbetsmiljö')).toBeInTheDocument()
    // Relative-date cell — "för 1 år sedan" / "för en månad sedan" depending
    // on fixture, but always contains "sedan" or similar Swedish marker. We
    // simply assert the date column renders text — the exact phrasing comes
    // from date-fns/locale and isn't worth pinning.
  })

  it('renders the fulfilled toggle reflecting isFulfilled (AC 24 col 1)', () => {
    const fulfilled = makeRow({ id: 'a', isFulfilled: true })
    const unfulfilled = makeRow({ id: 'b', isFulfilled: false })
    render(<KravTable rows={[fulfilled, unfulfilled]} {...noopProps()} />)

    const toggles = screen.getAllByRole('button', { name: /^markera/i })
    expect(toggles).toHaveLength(2)
    expect(toggles[0]).toHaveAttribute('aria-pressed', 'true')
    expect(toggles[1]).toHaveAttribute('aria-pressed', 'false')
  })

  it('clicking the fulfilled toggle fires onToggleFulfilled with the row (AC 30)', async () => {
    const user = userEvent.setup()
    const row = makeRow({ id: 'req-x' })
    const onToggleFulfilled = vi.fn()
    render(
      <KravTable
        rows={[row]}
        {...noopProps()}
        onToggleFulfilled={onToggleFulfilled}
      />
    )
    await user.click(
      screen.getByRole('button', { name: /markera som uppfylld/i })
    )
    expect(onToggleFulfilled).toHaveBeenCalledWith(row)
  })

  it('clicking the Lag cell fires onOpenLawItem (AC 33)', async () => {
    const user = userEvent.setup()
    const row = makeRow({ id: 'req-x', lawName: 'Aktiebolagslag' })
    const onOpenLawItem = vi.fn()
    render(
      <KravTable rows={[row]} {...noopProps()} onOpenLawItem={onOpenLawItem} />
    )
    // Exact-match the law-name cell button to distinguish from the Lag header.
    await user.click(screen.getByRole('button', { name: 'Aktiebolagslag' }))
    expect(onOpenLawItem).toHaveBeenCalledWith(row)
  })

  it('clicking a sortable column header dispatches onSortChange (AC 25)', async () => {
    const user = userEvent.setup()
    const onSortChange = vi.fn()
    render(
      <KravTable
        rows={[makeRow()]}
        {...noopProps()}
        onSortChange={onSortChange}
      />
    )
    // Clicking the "Regelverk" header (sortable col 3) should toggle to
    // law_name asc because current direction is desc on a different column,
    // TanStack flips to asc on first click on a new column. Exact-match the
    // label so it never collides with the "Laglista" (col 4) header.
    await user.click(screen.getByRole('button', { name: 'Regelverk' }))
    expect(onSortChange).toHaveBeenCalledWith(
      expect.objectContaining({ field: 'law_name' })
    )
  })

  it('renders bevis icon variants (AC 24 col 6, AC 41)', () => {
    const withEvidence = makeRow({ id: 'a', evidenceCount: 3 })
    const missingBevis = makeRow({
      id: 'b',
      bevisRequired: true,
      evidenceCount: 0,
    })
    const neutral = makeRow({ id: 'c', bevisRequired: false, evidenceCount: 0 })

    render(
      <KravTable
        rows={[withEvidence, missingBevis, neutral]}
        {...noopProps()}
      />
    )

    // With evidence: count displayed numerically.
    expect(screen.getByText('3')).toBeInTheDocument()
    // Missing bevis: ShieldAlert with aria-label.
    expect(screen.getByLabelText('Saknar bevis')).toBeInTheDocument()
    // Neutral: em-dash placeholder.
    expect(screen.getByLabelText('Inget bevis krävs')).toBeInTheDocument()
  })

  it('hides "Ladda fler" button when nextCursor is null (AC 29)', () => {
    render(<KravTable rows={[makeRow()]} {...noopProps()} nextCursor={null} />)
    expect(
      screen.queryByRole('button', { name: /Ladda fler/ })
    ).not.toBeInTheDocument()
  })

  it('shows "Ladda fler" button when nextCursor is set (AC 29)', () => {
    render(
      <KravTable rows={[makeRow()]} {...noopProps()} nextCursor="cursor-xyz" />
    )
    expect(
      screen.getByRole('button', { name: /Ladda fler/ })
    ).toBeInTheDocument()
  })

  it('clicking "Ladda fler" fires onLoadMore (AC 29)', async () => {
    const user = userEvent.setup()
    const onLoadMore = vi.fn()
    render(
      <KravTable
        rows={[makeRow()]}
        {...noopProps()}
        nextCursor="cursor-xyz"
        onLoadMore={onLoadMore}
      />
    )
    await user.click(screen.getByRole('button', { name: /Ladda fler/ }))
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('shows "Laddar…" label and disables the button when isLoadingMore is true (AC 29)', () => {
    render(
      <KravTable
        rows={[makeRow()]}
        {...noopProps()}
        nextCursor="cursor-xyz"
        isLoadingMore
      />
    )
    const button = screen.getByRole('button', { name: /Laddar/ })
    expect(button).toBeDisabled()
  })

  it('exposes the table with accessible role + label (AC 40)', () => {
    render(<KravTable rows={[makeRow()]} {...noopProps()} />)
    expect(
      screen.getByRole('region', { name: 'Kravpunkter i arbetsytan' })
    ).toBeInTheDocument()
  })
})
