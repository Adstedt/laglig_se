/** Story 21.5.2 — CycleListTable component tests. */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from '@testing-library/react'
import { ComplianceCycleStatus, AuditType } from '@prisma/client'
import type { CycleSummary } from '@/app/actions/compliance-audit-cycle'

// ============================================================================
// Mocks — MUST come before importing the component under test.
// ============================================================================

const routerPushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: routerPushMock }),
}))

// Component under test (imported AFTER mocks).
import { CycleListTable } from '@/components/features/compliance-audit/cycle-list/cycle-list-table'

// ============================================================================
// Fixtures
// ============================================================================

function makeCycle(
  overrides: Partial<CycleSummary> & {
    id: string
    status: ComplianceCycleStatus
  }
): CycleSummary {
  return {
    name: `Cycle ${overrides.id}`,
    auditType: AuditType.INTERN,
    scheduledStart: new Date('2026-05-01'),
    scheduledEnd: new Date('2026-05-31'),
    lawChangeCutoffDate: new Date('2026-04-30'),
    leadAuditor: { id: 'u1', name: 'Alice Auditor' },
    lawList: { id: 'l1', name: 'Huvudlista' },
    itemCount: 42,
    createdAt: new Date('2026-04-22T10:00:00Z'),
    updatedAt: new Date('2026-04-22T10:00:00Z'),
    ...overrides,
  }
}

const FIXTURE_CYCLES: CycleSummary[] = [
  makeCycle({
    id: 'a',
    status: ComplianceCycleStatus.PLANERAD,
    name: 'Planerad A',
  }),
  makeCycle({
    id: 'b',
    status: ComplianceCycleStatus.PAGAENDE,
    name: 'Pågående B',
  }),
  makeCycle({
    id: 'c',
    status: ComplianceCycleStatus.AVSLUTAD,
    name: 'Avslutad C',
  }),
  // Story 21.27 — ARKIVERAD entry removed. Lifecycle is 3-state.
]

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

// ============================================================================
// Tests
// ============================================================================

describe('CycleListTable', () => {
  it('default filter "Aktiva" shows only PLANERAD + PAGAENDE rows', () => {
    render(<CycleListTable cycles={FIXTURE_CYCLES} canCreate />)

    expect(screen.getByText('Planerad A')).toBeInTheDocument()
    expect(screen.getByText('Pågående B')).toBeInTheDocument()
    expect(screen.queryByText('Avslutad C')).toBeNull()
    expect(screen.queryByText('Arkiverad D')).toBeNull()
  })

  it('clicking "Slutförda" chip filters to AVSLUTAD only', () => {
    render(<CycleListTable cycles={FIXTURE_CYCLES} canCreate />)

    fireEvent.click(screen.getByRole('button', { name: /Slutförda/ }))

    expect(screen.queryByText('Planerad A')).toBeNull()
    expect(screen.queryByText('Pågående B')).toBeNull()
    expect(screen.getByText('Avslutad C')).toBeInTheDocument()
  })

  it('clicking "Alla" chip shows every cycle regardless of status', () => {
    render(<CycleListTable cycles={FIXTURE_CYCLES} canCreate />)

    fireEvent.click(screen.getByRole('button', { name: /^Alla/ }))

    expect(screen.getByText('Planerad A')).toBeInTheDocument()
    expect(screen.getByText('Pågående B')).toBeInTheDocument()
    expect(screen.getByText('Avslutad C')).toBeInTheDocument()
  })

  it('chip count badges reflect totals across all cycles (not the current filter)', () => {
    render(<CycleListTable cycles={FIXTURE_CYCLES} canCreate />)

    // Story 21.26 — Fastställda chip removed alongside the SEAL collapse.
    // Story 21.27 — Arkiverade chip removed alongside the ARKIVERAD collapse.
    // Aktiva = 2 (PLANERAD + PAGAENDE); Slutförda = 1 (AVSLUTAD); Alla = 3.
    const aktivaTab = screen.getByRole('button', { name: /Aktiva/ })
    expect(within(aktivaTab).getByText('2')).toBeInTheDocument()

    const slutfordaTab = screen.getByRole('button', { name: /Slutförda/ })
    expect(within(slutfordaTab).getByText('1')).toBeInTheDocument()

    const allaTab = screen.getByRole('button', { name: /^Alla/ })
    expect(within(allaTab).getByText('3')).toBeInTheDocument()
  })

  it('canCreate=true renders the Skapa kontroll CTA in the page header', () => {
    render(<CycleListTable cycles={FIXTURE_CYCLES} canCreate />)

    // Button is an asChild <Link>, so it renders as <a>. Either role=link
    // or role=button may match in jsdom/happy-dom depending on shadcn version.
    const cta = screen.getAllByRole('link', { name: /Skapa kontroll/ })
    expect(cta.length).toBeGreaterThan(0)
    expect(cta[0]!.getAttribute('href')).toBe('/laglistor/kontroller/skapa')
  })

  it('canCreate=false hides the Skapa kontroll CTA', () => {
    render(<CycleListTable cycles={FIXTURE_CYCLES} canCreate={false} />)

    expect(screen.queryByRole('link', { name: /Skapa kontroll/ })).toBeNull()
  })

  it('empty state for Aktiva filter renders "inga aktiva" copy + CTA when canCreate', () => {
    // Story 21.27 — only AVSLUTAD remains as a non-active state. A workspace
    // with only AVSLUTAD cycles produces the "inga aktiva" empty state.
    const onlyClosed = [
      makeCycle({ id: 'x', status: ComplianceCycleStatus.AVSLUTAD }),
    ]
    render(<CycleListTable cycles={onlyClosed} canCreate />)

    expect(
      screen.getByText('Du har inga aktiva kontroller just nu.')
    ).toBeInTheDocument()
    // CTA also rendered in the empty-state; there are two Skapa kontroll
    // links (header + empty state) when canCreate && empty.
    expect(
      screen.getAllByRole('link', { name: /Skapa kontroll/ }).length
    ).toBeGreaterThanOrEqual(2)
  })

  it('empty state for non-Aktiva filter renders "inga matchar" copy (no empty-state CTA)', () => {
    const onlyPagaende = [
      makeCycle({ id: 'x', status: ComplianceCycleStatus.PAGAENDE }),
    ]
    render(<CycleListTable cycles={onlyPagaende} canCreate />)

    // Switch to Slutförda → zero rows match.
    fireEvent.click(screen.getByRole('button', { name: /Slutförda/ }))

    expect(
      screen.getByText('Inga kontroller matchar det valda filtret.')
    ).toBeInTheDocument()
    // Only the header CTA renders (not the empty-state CTA, which is
    // active-filter-only).
    expect(screen.getAllByRole('link', { name: /Skapa kontroll/ }).length).toBe(
      1
    )
  })

  it('row has a link on the name cell with href to the detail page', () => {
    render(<CycleListTable cycles={FIXTURE_CYCLES} canCreate />)

    // Planerad A is visible under default Aktiva filter.
    const nameLink = screen.getByRole('link', { name: 'Planerad A' })
    expect(nameLink.getAttribute('href')).toBe('/laglistor/kontroller/a')
  })

  it('clicking anywhere on a row navigates via router.push to the detail page', () => {
    render(<CycleListTable cycles={FIXTURE_CYCLES} canCreate />)

    // Fire click on the row (data-cycle-id marker).
    const row = document.querySelector<HTMLElement>('[data-cycle-id="a"]')
    expect(row).not.toBeNull()
    fireEvent.click(row!)

    expect(routerPushMock).toHaveBeenCalledWith('/laglistor/kontroller/a')
  })
})
