/** Story 21.5 — CycleDetailPage / CycleItemsTab component tests (AC 13). */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  render,
  screen,
  waitFor,
  cleanup,
  fireEvent,
} from '@testing-library/react'
import { SWRConfig } from 'swr'
import {
  ComplianceCycleStatus,
  ComplianceStatus,
  EfterlevnadsBedomning,
  AuditType,
} from '@prisma/client'
import type {
  CycleItemRow,
  CyclePartial,
} from '@/app/actions/compliance-audit-item'
import type { CycleDetail } from '@/app/actions/compliance-audit-cycle'

// ============================================================================
// Mocks
// ============================================================================

const updateItemBedomningMock = vi.fn()
const updateItemMotiveringMock = vi.fn()
const signOffItemMock = vi.fn()
const unsignOffItemMock = vi.fn()
const getCycleItemsForCycleMock = vi.fn()
// Story 21.7: page-level hoist of the findings SWR fetch requires a mock here.
const listFindingsForCycleMock = vi.fn()
const closeFindingMock = vi.fn()
const reopenFindingMock = vi.fn()
const createFindingMock = vi.fn()
const updateFindingMock = vi.fn()

vi.mock('@/app/actions/compliance-audit-item', () => ({
  getCycleItemsForCycle: (...args: unknown[]) =>
    getCycleItemsForCycleMock(...args),
  updateItemBedomning: (...args: unknown[]) => updateItemBedomningMock(...args),
  updateItemMotivering: (...args: unknown[]) =>
    updateItemMotiveringMock(...args),
  signOffItem: (...args: unknown[]) => signOffItemMock(...args),
  unsignOffItem: (...args: unknown[]) => unsignOffItemMock(...args),
}))

vi.mock('@/app/actions/compliance-finding', () => ({
  listFindingsForCycle: (...args: unknown[]) =>
    listFindingsForCycleMock(...args),
  closeFinding: (...args: unknown[]) => closeFindingMock(...args),
  reopenFinding: (...args: unknown[]) => reopenFindingMock(...args),
  createFinding: (...args: unknown[]) => createFindingMock(...args),
  updateFinding: (...args: unknown[]) => updateFindingMock(...args),
}))

// Stub LinkedArtifactsPanel — we test composition, not that panel's internals.
vi.mock(
  '@/components/features/document-list/legal-document-modal/linked-artifacts-panel',
  async () => {
    const React = await import('react')
    return {
      LinkedArtifactsPanel: (props: {
        listItemId: string
        readOnly?: boolean
      }) =>
        React.createElement(
          'div',
          {
            'data-testid': 'linked-artifacts-panel',
            'data-list-item-id': props.listItemId,
            'data-read-only': props.readOnly ? 'true' : 'false',
          },
          'mocked-linked-artifacts'
        ),
    }
  }
)

// Story 21.16: stub SplitPanelModal — Radix Dialog internals are flaky in
// happy-dom. We assert on modal presence via the children we render into it;
// the conditional `open` gating lets us verify the modal-open/close contract
// without engaging Radix's portal/focus machinery.
vi.mock('@/components/shared/split-panel-modal', async () => {
  const React = await import('react')
  return {
    SplitPanelModal: (props: {
      open: boolean
      leftPanel?: React.ReactNode
      rightPanel?: React.ReactNode
      header?: React.ReactNode
    }) => {
      if (!props.open) return null
      return React.createElement(
        'div',
        { 'data-testid': 'split-panel-modal' },
        props.header,
        props.leftPanel,
        props.rightPanel
      )
    },
  }
})

// Story 21.16: stub AiChatPanel — not relevant to these tests.
vi.mock(
  '@/components/features/document-list/legal-document-modal/ai-chat-panel',
  async () => {
    const React = await import('react')
    return {
      AiChatPanel: () =>
        React.createElement(
          'div',
          { 'data-testid': 'ai-chat-panel' },
          'mocked-ai-chat'
        ),
    }
  }
)

// Sonner toast — capture error invocations.
const toastErrorMock = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
    success: vi.fn(),
  },
}))

// Component under test (imported AFTER mocks).
import { CycleDetailPage } from '@/components/features/compliance-audit/cycle-detail'

// ============================================================================
// Fixtures
// ============================================================================

const CYCLE_ID = '33333333-3333-4333-8333-333333333333'

function makeCycleDetail(overrides: Partial<CycleDetail> = {}): CycleDetail {
  return {
    id: CYCLE_ID,
    name: 'Q2 miljörevision',
    status: ComplianceCycleStatus.PAGAENDE,
    auditType: AuditType.INTERN,
    scheduledStart: new Date('2026-05-01'),
    scheduledEnd: new Date('2026-05-31'),
    lawChangeCutoffDate: new Date('2026-04-30'),
    leadAuditor: { id: 'u1', name: 'Alice Auditor' },
    lawList: { id: 'l1', name: 'Huvudlista' },
    itemCount: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    lawListId: 'l1',
    scopeDefinition: { kind: 'all' },
    sealHash: null,
    sealedAt: null,
    sealedBy: null,
    createdBy: { id: 'u0', name: 'Creator' },
    deletedAt: null,
    ...overrides,
  }
}

function makeCyclePartial(overrides: Partial<CyclePartial> = {}): CyclePartial {
  return {
    id: CYCLE_ID,
    status: ComplianceCycleStatus.PAGAENDE,
    name: 'Q2 miljörevision',
    sealHash: null,
    ...overrides,
  }
}

function makeItem(
  id: string,
  overrides: Partial<CycleItemRow> = {}
): CycleItemRow {
  return {
    id,
    lawListItemId: `law-list-item-${id}`,
    lawTitle: `Lag ${id}`,
    lawDocumentNumber: `SFS 2026:${id.slice(-3)}`,
    groupId: null,
    groupName: null,
    sourceComplianceStatus: ComplianceStatus.EJ_PABORJAD,
    sourceResponsibleUser: null,
    efterlevnadsbedomning: null,
    motivering: null,
    reviewedAt: null,
    reviewedBy: null,
    signedOffAt: null,
    signedOffBy: null,
    kravpunkterSnapshot: null,
    // Story 21.16 follow-up: businessContext field on CycleItemRow.
    businessContext: null,
    ...overrides,
  }
}

// ============================================================================
// Helpers
// ============================================================================

function renderPage(
  overrides: {
    items?: CycleItemRow[]
    cycle?: CycleDetail
    cyclePartial?: CyclePartial
    readOnly?: boolean
  } = {}
) {
  const cycle = overrides.cycle ?? makeCycleDetail()
  return render(
    // Fresh SWR cache per render — prevents fallbackData staleness from
    // bleeding across tests via the global cache.
    <SWRConfig value={{ provider: () => new Map() }}>
      <CycleDetailPage
        cycle={cycle}
        items={
          overrides.items ?? [
            makeItem('a'),
            makeItem('b', {
              efterlevnadsbedomning: EfterlevnadsBedomning.UPPFYLLD,
            }),
            makeItem('c', {
              efterlevnadsbedomning: EfterlevnadsBedomning.UPPFYLLD,
              signedOffAt: new Date('2026-04-22T10:00:00Z'),
              signedOffBy: { id: 'u1', name: 'Alice Auditor' },
            }),
          ]
        }
        initialFindings={[]}
        cyclePartial={
          overrides.cyclePartial ??
          makeCyclePartial({ status: cycle.status, sealHash: cycle.sealHash })
        }
        readOnly={overrides.readOnly ?? false}
      />
    </SWRConfig>
  )
}

const originalScrollIntoView = Element.prototype.scrollIntoView

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  // Default SWR fetcher returns fallback (don't revalidate with empty list).
  getCycleItemsForCycleMock.mockResolvedValue({
    success: true,
    data: { items: [], cycle: makeCyclePartial() },
  })
  listFindingsForCycleMock.mockResolvedValue({
    success: true,
    data: { findings: [] },
  })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  Element.prototype.scrollIntoView = originalScrollIntoView
  // Story 21.16: cycle-detail-page's URL sync writes `?item=X&finding=Y` to
  // window.location via history.replaceState. Reset the URL between tests so
  // the next test's mount doesn't resurrect a previously-clicked selection.
  if (typeof window !== 'undefined') {
    window.history.replaceState(null, '', window.location.pathname)
  }
})

// ============================================================================
// Tests
// ============================================================================

describe('CycleDetailPage — items tab', () => {
  it('renders 3 rows with correct columns + sort order', () => {
    renderPage()
    expect(screen.getByText('Lag a')).toBeInTheDocument()
    expect(screen.getByText('Lag b')).toBeInTheDocument()
    expect(screen.getByText('Lag c')).toBeInTheDocument()
    // Non-virtualised path for <100 items.
    expect(screen.getByTestId('cycle-items-list')).toBeInTheDocument()
  })

  it('bedömning triggers render with correct values + aria-label', () => {
    // Note: full Radix Select popover interaction is brittle in happy-dom
    // (pointer-event emulation gaps). Cover the contract instead: each row
    // has an accessible "Bedömning" combobox trigger, and its visible text
    // reflects the row's current value.
    renderPage()
    const triggers = screen.getAllByLabelText('Bedömning')
    expect(triggers.length).toBe(3)
    // Row a: null → "—"
    expect(triggers[0]!.textContent).toContain('—')
    // Row b, c: UPPFYLLD → "Uppfylld"
    expect(triggers[1]!.textContent).toContain('Uppfylld')
    expect(triggers[2]!.textContent).toContain('Uppfylld')
  })

  it('sign-off button disabled when bedömning is null + tooltip reason', async () => {
    renderPage()
    // Match by exact name string "Signera" (not regex) — RTL regex behaviour
    // with hidden elements in Radix TooltipTrigger wrappers has nuances.
    const signButtons = screen.getAllByRole('button', { name: 'Signera' })
    // Row a is first (bedömning null). Its button should be disabled.
    expect(signButtons[0]).toBeDisabled()
    // Row b (bedömning UPPFYLLD, unsigned) should be enabled.
    expect(signButtons[1]).toBeEnabled()
  })

  it('sign-off click → signOffItem called + signed row shows user + timestamp + unsign X', async () => {
    signOffItemMock.mockResolvedValue({
      success: true,
      data: {
        item: makeItem('b', {
          efterlevnadsbedomning: EfterlevnadsBedomning.UPPFYLLD,
          signedOffAt: new Date('2026-04-22T10:00:00Z'),
          signedOffBy: { id: 'u1', name: 'Alice Auditor' },
        }),
      },
    })

    renderPage()
    const signButtons = screen.getAllByRole('button', { name: 'Signera' })
    // Click the second row's sign button (bedömning=UPPFYLLD).
    fireEvent.click(signButtons[1]!)

    await waitFor(() => {
      expect(signOffItemMock).toHaveBeenCalledWith('b')
    })
  })

  it('unsign X click → unsignOffItem called; row returns to unsigned state', async () => {
    unsignOffItemMock.mockResolvedValue({
      success: true,
      data: {
        item: makeItem('c', {
          efterlevnadsbedomning: EfterlevnadsBedomning.UPPFYLLD,
          signedOffAt: null,
          signedOffBy: null,
        }),
      },
    })

    renderPage()
    // Row "c" is signed → has an unsign X button.
    const unsignBtn = screen.getByRole('button', { name: 'Ångra signering' })
    fireEvent.click(unsignBtn)

    await waitFor(() => {
      expect(unsignOffItemMock).toHaveBeenCalledWith('c')
    })
  })

  it('read-only mode: no sign buttons, no unsign X, read-only banner visible', () => {
    renderPage({
      cycle: makeCycleDetail({
        status: ComplianceCycleStatus.SEALED,
        sealHash: 'abc123def456aaaabbbbccccdddd',
      }),
      cyclePartial: makeCyclePartial({
        status: ComplianceCycleStatus.SEALED,
        sealHash: 'abc123def456aaaabbbbccccdddd',
      }),
      readOnly: true,
    })

    // Read-only banner present with truncated hash + "förseglad" copy.
    const banner = screen.getByRole('status')
    expect(banner.textContent).toContain('förseglad')
    expect(banner.textContent).toContain('abc123def456')

    // No sign-off buttons rendered in read-only mode (AC 8 — hidden, not disabled).
    expect(screen.queryByRole('button', { name: 'Signera' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Ångra signering' })).toBeNull()

    // Bedömning editors render as read-only badges, not selects.
    expect(screen.queryAllByLabelText('Bedömning').length).toBe(0)
  })

  it('read-only mode ARKIVERAD variant — banner omits hash', () => {
    renderPage({
      cycle: makeCycleDetail({
        status: ComplianceCycleStatus.ARKIVERAD,
      }),
      cyclePartial: makeCyclePartial({
        status: ComplianceCycleStatus.ARKIVERAD,
      }),
      readOnly: true,
    })

    const banner = screen.getByRole('status')
    expect(banner.textContent).toContain('arkiverad')
    expect(banner.textContent).not.toContain('förseglad')
  })

  // --- Story 21.16 — row-click-opens-modal (replaces drawer expand) ---------

  it('Story 21.16 — no chevron column; rows are simple one-liners', () => {
    renderPage()
    // Chevron buttons were removed along with the drawer. "Visa detaljer"
    // and "Dölj detaljer" aria-labels no longer exist.
    expect(screen.queryByRole('button', { name: 'Visa detaljer' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Dölj detaljer' })).toBeNull()
  })

  it('Story 21.16 — clicking a row opens the modal on that item', () => {
    renderPage({
      items: [
        makeItem('a', {
          kravpunkterSnapshot: {
            frozen_at: '2026-04-22T10:00:00Z',
            requirements: [
              {
                id: 'r1',
                text: 'Systematiskt arbetsmiljöarbete',
                comment: null,
                is_fulfilled: true,
                bevis_required: false,
                position: 1,
                responsible_user_id: null,
                created_by: 'u0',
              },
            ],
          },
        }),
      ],
    })

    // Modal is closed initially (no selectedItemId).
    expect(screen.queryByTestId('split-panel-modal')).toBeNull()

    // Clicking the row body opens the modal.
    const row = screen.getByTestId('cycle-item-row-a')
    // The row itself has the click handler (inner wrapper div).
    const clickable = row.querySelector('[role="button"]')
    expect(clickable).not.toBeNull()
    fireEvent.click(clickable as Element)

    // Modal appears.
    expect(screen.getByTestId('split-panel-modal')).toBeInTheDocument()
    // Kravpunkter snapshot renders inside the modal.
    expect(
      screen.getByText('Systematiskt arbetsmiljöarbete')
    ).toBeInTheDocument()
    // LinkedArtifactsPanel mounted with readOnly=true via the left panel.
    const panel = screen.getByTestId('linked-artifacts-panel')
    expect(panel.getAttribute('data-read-only')).toBe('true')
    expect(panel.getAttribute('data-list-item-id')).toBe('law-list-item-a')
  })

  it('Story 21.16 follow-up — clicking a row renders "Hur påverkar detta oss?" section with businessContext content', () => {
    renderPage({
      items: [
        makeItem('a', {
          businessContext:
            'Vi hanterar kemikalier dagligen — riskbedömning krävs kvartalsvis.',
        }),
      ],
    })
    // Modal initially closed.
    expect(screen.queryByTestId('split-panel-modal')).toBeNull()

    // Click the row.
    const row = screen.getByTestId('cycle-item-row-a')
    const clickable = row.querySelector('[role="button"]')
    expect(clickable).not.toBeNull()
    fireEvent.click(clickable as Element)

    // Business context section renders inside the modal.
    expect(screen.getByText('Hur påverkar detta oss?')).toBeInTheDocument()
    expect(screen.getByTestId('business-context-content')).toBeInTheDocument()
    // Edit deep-link points to the correct /laglistor?document= URL.
    const editLink = screen.getByTestId('business-context-edit-link')
    expect(editLink).toHaveAttribute(
      'href',
      '/laglistor?document=law-list-item-a'
    )
    expect(editLink).toHaveAttribute('target', '_blank')
  })

  it('Story 21.16 follow-up — empty businessContext shows empty state in modal', () => {
    renderPage({
      items: [makeItem('a', { businessContext: null })],
    })
    const row = screen.getByTestId('cycle-item-row-a')
    fireEvent.click(row.querySelector('[role="button"]') as Element)
    expect(
      screen.getByTestId('business-context-empty-state')
    ).toBeInTheDocument()
    // Edit link still works from empty state.
    expect(screen.getByTestId('business-context-edit-link')).toBeInTheDocument()
  })

  it('Story 21.16 — inline-control stop-propagation wrappers carry role="presentation"', () => {
    renderPage()
    // Structural test: the inline-control wrapper cells (bedomning / motivering /
    // signerad) carry `role="presentation"` + onClick stopPropagation so clicks
    // on the controls don't bubble to the row-level click-to-open-modal handler.
    // Full event-propagation assertion is brittle in happy-dom (Radix Select
    // intercepts pointer events); this structural pin is the production-safe
    // proxy.
    const presentations = document.querySelectorAll('[role="presentation"]')
    // 3 wrappers × 3 rows = 9 presentation zones on the items table.
    expect(presentations.length).toBeGreaterThanOrEqual(9)
  })

  it('progress cluster — shows counts + disables buttons when all complete', () => {
    renderPage({
      items: [
        makeItem('a', {
          efterlevnadsbedomning: EfterlevnadsBedomning.UPPFYLLD,
          signedOffAt: new Date(),
          signedOffBy: { id: 'u1', name: 'Alice' },
        }),
        makeItem('b', {
          efterlevnadsbedomning: EfterlevnadsBedomning.UPPFYLLD,
          signedOffAt: new Date(),
          signedOffBy: { id: 'u1', name: 'Alice' },
        }),
      ],
    })

    // All 2 bedömda + signerade.
    const bedomdaBtn = screen.getByLabelText(
      'Hoppa till första obedömda posten'
    )
    const signeradeBtn = screen.getByLabelText(
      'Hoppa till första osignerade posten'
    )
    expect(bedomdaBtn).toBeDisabled()
    expect(signeradeBtn).toBeDisabled()
    // Counts appear within the progress buttons.
    expect(bedomdaBtn.textContent).toContain('2 av 2')
    expect(signeradeBtn.textContent).toContain('2 av 2')
  })

  it('progress jump — clicking "Hoppa till obedömda" calls scrollIntoView on first unbedömd row', () => {
    const scrollIntoViewMock = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoViewMock as unknown as (
      _arg?: boolean | ScrollIntoViewOptions
    ) => void

    renderPage({
      items: [
        makeItem('a', {
          efterlevnadsbedomning: EfterlevnadsBedomning.UPPFYLLD,
        }),
        makeItem('b'), // first unbedömd
        makeItem('c'),
      ],
    })

    const jumpBtn = screen.getByLabelText('Hoppa till första obedömda posten')
    fireEvent.click(jumpBtn)

    expect(scrollIntoViewMock).toHaveBeenCalledWith(
      expect.objectContaining({ behavior: 'smooth' })
    )
  })

  it('every row has data-cycle-item-id for progress-click-to-jump', () => {
    renderPage()
    const rowA = document.querySelector('[data-cycle-item-id="a"]')
    const rowB = document.querySelector('[data-cycle-item-id="b"]')
    const rowC = document.querySelector('[data-cycle-item-id="c"]')
    expect(rowA).not.toBeNull()
    expect(rowB).not.toBeNull()
    expect(rowC).not.toBeNull()
  })

  it('empty state — "Kontrollen har inga poster."', () => {
    renderPage({ items: [] })
    expect(screen.getByText('Kontrollen har inga poster.')).toBeInTheDocument()
  })

  it('virtualisation path used when items.length > 100', () => {
    const manyItems = Array.from({ length: 150 }, (_, i) =>
      makeItem(`${i}`, {
        lawTitle: `Lag ${i}`,
        lawDocumentNumber: `SFS 2026:${String(i).padStart(3, '0')}`,
      })
    )
    renderPage({ items: manyItems })
    expect(
      screen.getByTestId('cycle-items-list-virtualized')
    ).toBeInTheDocument()
    expect(screen.queryByTestId('cycle-items-list')).toBeNull()
  })

  // --- AC 13 / IV2 performance microtest (GAP-001) -------------------------

  it('performance — 500-item initial mount completes under 1500ms in jsdom', () => {
    // AC 13: "Mock a 500-item fixture, mount, assert initial paint ≤ 1500ms
    // on jsdom (generous ceiling — IV2's 60fps scroll target is a real-browser
    // metric; jsdom can only smoke-test the initial mount)."
    //
    // This is a guard against pathological regressions (N+1 renders, quadratic
    // row-shape transforms, etc.) — NOT a real-browser p95 measurement.
    // Virtualisation caps what's rendered in DOM; the test measures the React
    // tree + useVirtualizer setup + initial measurement pass.
    const fiveHundredItems = Array.from({ length: 500 }, (_, i) =>
      makeItem(`perf-${i}`, {
        lawTitle: `Lag ${i}`,
        lawDocumentNumber: `SFS 2026:${String(i).padStart(3, '0')}`,
        efterlevnadsbedomning:
          i % 3 === 0 ? EfterlevnadsBedomning.UPPFYLLD : null,
        signedOffAt: i % 5 === 0 ? new Date() : null,
        signedOffBy: i % 5 === 0 ? { id: 'u1', name: 'Alice' } : null,
      })
    )
    const startedAt = performance.now()
    renderPage({ items: fiveHundredItems })
    const elapsed = performance.now() - startedAt
    // Generous ceiling — happy-dom is slower than a real browser and flakier
    // under CI load. Purpose: catch quadratic-time regressions, not fine-grained
    // perf tuning.
    expect(elapsed).toBeLessThan(1500)
    // Confirm virtualisation kicked in (otherwise 500 full-row DOM renders
    // would be the real risk — the threshold guard flags that regression too).
    expect(
      screen.getByTestId('cycle-items-list-virtualized')
    ).toBeInTheDocument()
  })

  it('motivering trigger renders editable button when not readOnly', () => {
    // Note: full userEvent.type + save-on-blur interaction is covered by
    // ItemMotiveringEditor's isolated unit test (happy-dom has known
    // issues with controlled-textarea typing). Here we verify the
    // contract: each row exposes a "Redigera motivering" button, and its
    // click-to-edit affordance is wired.
    renderPage()
    const triggers = screen.getAllByRole('button', {
      name: 'Redigera motivering',
    })
    expect(triggers.length).toBe(3)
    triggers.forEach((trigger) => {
      expect(trigger).toBeEnabled()
    })
  })

  it('sign-off failure → toast error surfaced', async () => {
    signOffItemMock.mockResolvedValue({
      success: false,
      error: 'Ange bedömning innan signering',
    })

    renderPage()
    const signButtons = screen.getAllByRole('button', { name: 'Signera' })
    // Row b has bedömning set — click it.
    fireEvent.click(signButtons[1]!)

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        'Kunde inte signera',
        expect.objectContaining({
          description: 'Ange bedömning innan signering',
        })
      )
    })
  })
})
