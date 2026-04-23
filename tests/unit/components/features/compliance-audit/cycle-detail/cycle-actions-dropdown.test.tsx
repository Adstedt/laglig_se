/** Story 21.6 — CycleActionsDropdown component tests (AC 14). */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import {
  ComplianceCycleStatus,
  AuditType,
  type ComplianceCycleStatus as CycleStatusType,
} from '@prisma/client'
import {
  CycleActionsDropdown,
  DROPDOWN_TOOLTIP_COPY,
} from '@/components/features/compliance-audit/cycle-detail/cycle-actions-dropdown'
import type { CycleDetail } from '@/app/actions/compliance-audit-cycle'

const CYCLE_ID = '11111111-1111-4111-8111-111111111111'

function makeCycle(status: CycleStatusType): CycleDetail {
  return {
    id: CYCLE_ID,
    name: 'Q2 revision',
    status,
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
  }
}

interface RenderOpts {
  status?: CycleStatusType
  totalCount?: number
  signeradeCount?: number
  canRevert?: boolean
  // Radix DropdownMenu's pointer-event opening is unreliable in happy-dom, so
  // tests pass `defaultOpen=true` to assert on menu items directly. See the
  // component's `defaultOpen` prop JSDoc.
  defaultOpen?: boolean
}

function renderDropdown(opts: RenderOpts = {}) {
  const onCompleteClick = vi.fn()
  const onRevertClick = vi.fn()
  const result = render(
    <CycleActionsDropdown
      cycle={makeCycle(opts.status ?? ComplianceCycleStatus.PAGAENDE)}
      totalCount={opts.totalCount ?? 3}
      signeradeCount={opts.signeradeCount ?? 3}
      canRevert={opts.canRevert ?? false}
      onCompleteClick={onCompleteClick}
      onRevertClick={onRevertClick}
      defaultOpen={opts.defaultOpen ?? true}
    />
  )
  return { ...result, onCompleteClick, onRevertClick }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

describe('CycleActionsDropdown', () => {
  // -------------------------------------------------------------------------
  // PAGAENDE — Slutför kontroll visible, revert hidden
  // -------------------------------------------------------------------------

  it('PAGAENDE + all signed → Slutför kontroll enabled, calls onCompleteClick', () => {
    const { onCompleteClick } = renderDropdown({
      status: ComplianceCycleStatus.PAGAENDE,
      totalCount: 3,
      signeradeCount: 3,
    })

    const complete = screen.getByText('Slutför kontroll')
    expect(complete).toBeInTheDocument()
    expect(complete.closest('[role="menuitem"]')).not.toHaveAttribute(
      'aria-disabled',
      'true'
    )
    expect(
      screen.queryByText('Återställ till Pågående')
    ).not.toBeInTheDocument()

    fireEvent.click(complete)
    expect(onCompleteClick).toHaveBeenCalledTimes(1)
  })

  it('PAGAENDE + 2/3 signed → Slutför kontroll blocked with tooltip copy', () => {
    renderDropdown({
      status: ComplianceCycleStatus.PAGAENDE,
      totalCount: 3,
      signeradeCount: 2,
    })

    const item = screen
      .getByText('Slutför kontroll')
      .closest('[role="menuitem"]')
    expect(item).toHaveAttribute('aria-disabled', 'true')
    // Copy contract: exported constant pins the Swedish tooltip text. Radix
    // Tooltip portal + hover state are unreliable in happy-dom, so we assert
    // on the constant directly (production wiring verified in the component).
    expect(DROPDOWN_TOOLTIP_COPY.unsignedItems(1, 3)).toBe(
      'Slutför kontroll: 1 av 3 dokument behöver signeras.'
    )
  })

  it('PAGAENDE + 0 items → Slutför kontroll blocked with zero-items tooltip copy', () => {
    renderDropdown({
      status: ComplianceCycleStatus.PAGAENDE,
      totalCount: 0,
      signeradeCount: 0,
    })

    const item = screen
      .getByText('Slutför kontroll')
      .closest('[role="menuitem"]')
    expect(item).toHaveAttribute('aria-disabled', 'true')
    expect(DROPDOWN_TOOLTIP_COPY.zeroItems).toBe(
      'Kontrollen innehåller inga dokument att slutföra.'
    )
  })

  it('PAGAENDE blocked item does NOT fire onCompleteClick when activated', () => {
    const { onCompleteClick } = renderDropdown({
      status: ComplianceCycleStatus.PAGAENDE,
      totalCount: 3,
      signeradeCount: 2,
    })

    fireEvent.click(screen.getByText('Slutför kontroll'))

    // SF-1 contract: onSelect preventDefault + item still rendered → handler
    // MUST NOT fire. Guards against a future refactor that drops preventDefault.
    expect(onCompleteClick).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // AVSLUTAD — Återställ visible, complete hidden
  // -------------------------------------------------------------------------

  it('AVSLUTAD + canRevert=true → revert item enabled, calls onRevertClick', () => {
    const { onRevertClick } = renderDropdown({
      status: ComplianceCycleStatus.AVSLUTAD,
      canRevert: true,
    })

    const revert = screen.getByText('Återställ till Pågående')
    expect(revert).toBeInTheDocument()
    expect(revert.closest('[role="menuitem"]')).not.toHaveAttribute(
      'aria-disabled',
      'true'
    )
    expect(screen.queryByText('Slutför kontroll')).not.toBeInTheDocument()

    fireEvent.click(revert)
    expect(onRevertClick).toHaveBeenCalledTimes(1)
  })

  it('AVSLUTAD + canRevert=false → revert item blocked with permission tooltip', () => {
    const { onRevertClick } = renderDropdown({
      status: ComplianceCycleStatus.AVSLUTAD,
      canRevert: false,
    })

    const revertItem = screen
      .getByText('Återställ till Pågående')
      .closest('[role="menuitem"]')
    expect(revertItem).toHaveAttribute('aria-disabled', 'true')
    expect(DROPDOWN_TOOLTIP_COPY.cannotRevert).toBe(
      'Endast revisionsledaren eller administratörer kan återställa kontrollen.'
    )

    fireEvent.click(screen.getByText('Återställ till Pågående'))
    expect(onRevertClick).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Hidden states — PLANERAD / SEALED / ARKIVERAD
  // -------------------------------------------------------------------------

  it('PLANERAD → dropdown not rendered', () => {
    renderDropdown({
      status: ComplianceCycleStatus.PLANERAD,
      defaultOpen: false,
    })
    expect(screen.queryByRole('button', { name: /Åtgärder/ })).toBeNull()
  })

  it('SEALED → dropdown not rendered', () => {
    renderDropdown({
      status: ComplianceCycleStatus.SEALED,
      defaultOpen: false,
    })
    expect(screen.queryByRole('button', { name: /Åtgärder/ })).toBeNull()
  })

  it('ARKIVERAD → dropdown not rendered', () => {
    renderDropdown({
      status: ComplianceCycleStatus.ARKIVERAD,
      defaultOpen: false,
    })
    expect(screen.queryByRole('button', { name: /Åtgärder/ })).toBeNull()
  })
})
