/** Story 21.6 — CompleteCycleDialog + RevertCycleDialog component tests (AC 14). */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { CompleteCycleDialog } from '@/components/features/compliance-audit/cycle-detail/complete-cycle-dialog'
import { RevertCycleDialog } from '@/components/features/compliance-audit/cycle-detail/revert-cycle-dialog'

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
})

// ============================================================================
// CompleteCycleDialog
// ============================================================================

describe('CompleteCycleDialog', () => {
  function renderDialog(
    overrides: {
      open?: boolean
      isSubmitting?: boolean
      openFindings?: number
      pendingTasks?: number
    } = {}
  ) {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    const result = render(
      <CompleteCycleDialog
        open={overrides.open ?? true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
        isSubmitting={overrides.isSubmitting ?? false}
        openFindings={overrides.openFindings ?? 0}
        pendingTasks={overrides.pendingTasks ?? 0}
      />
    )
    return { ...result, onConfirm, onOpenChange }
  }

  it('closed by default when open=false', () => {
    renderDialog({ open: false })
    expect(screen.queryByText('Slutför kontrollen?')).toBeNull()
  })

  it('renders title + base body copy (AC 2)', () => {
    renderDialog()
    expect(screen.getByText('Slutför kontrollen?')).toBeInTheDocument()
    expect(
      screen.getByText(
        /Granskningen är klar\. Resultatet kan användas som det är för att dokumentera nuläget/
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Kontrollen blir låst när den slutförs/)
    ).toBeInTheDocument()
  })

  it('primary button click calls onConfirm', () => {
    const { onConfirm } = renderDialog()
    const primary = screen.getByRole('button', { name: 'Slutför kontroll' })
    fireEvent.click(primary)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('cancel click calls onOpenChange(false)', () => {
    const { onOpenChange } = renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Avbryt' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('isSubmitting=true disables both buttons', () => {
    renderDialog({ isSubmitting: true })
    expect(screen.getByRole('button', { name: 'Avbryt' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: /Slutför kontroll/ })
    ).toBeDisabled()
  })

  // -------------------------------------------------------------------------
  // Open-work advisory branches (AC 2)
  // -------------------------------------------------------------------------

  it('advisory — both counts > 0 renders combined anmärkningar + åtgärder copy', () => {
    renderDialog({ openFindings: 3, pendingTasks: 2 })
    expect(
      screen.getByText(
        /Följs upp efter avslutad kontroll: 3 öppna anmärkningar med 2 pågående åtgärdsuppgifter\./
      )
    ).toBeInTheDocument()
  })

  it('advisory — singular forms render when both counts === 1', () => {
    renderDialog({ openFindings: 1, pendingTasks: 1 })
    expect(
      screen.getByText(
        /Följs upp efter avslutad kontroll: 1 öppen anmärkning med 1 pågående åtgärdsuppgift\./
      )
    ).toBeInTheDocument()
  })

  it('advisory — only openFindings > 0 (plural) renders findings-only copy', () => {
    renderDialog({ openFindings: 2, pendingTasks: 0 })
    expect(
      screen.getByText(
        /Följs upp efter avslutad kontroll: 2 öppna anmärkningar utan aktiva åtgärder\./
      )
    ).toBeInTheDocument()
  })

  it('advisory — only openFindings > 0 (singular) renders findings-only copy', () => {
    renderDialog({ openFindings: 1, pendingTasks: 0 })
    expect(
      screen.getByText(
        /Följs upp efter avslutad kontroll: 1 öppen anmärkning utan aktiv åtgärd\./
      )
    ).toBeInTheDocument()
  })

  it('advisory — both counts === 0 omits advisory paragraph entirely', () => {
    renderDialog({ openFindings: 0, pendingTasks: 0 })
    expect(screen.queryByText(/Följs upp efter avslutad kontroll:/)).toBeNull()
    // Legacy phrasing must NOT regress.
    expect(screen.queryByText(/Just nu:/)).toBeNull()
  })

  it('advisory — openFindings=0 + pendingTasks=1 edge case falls to zero-variant (defensive)', () => {
    // Logically impossible (pendingTasks derives from openFindings), but the
    // guard ensures we don't crash if a caller passes inconsistent counts.
    renderDialog({ openFindings: 0, pendingTasks: 1 })
    expect(screen.queryByText(/Följs upp efter avslutad kontroll:/)).toBeNull()
    // Title still rendered — component did not crash.
    expect(screen.getByText('Slutför kontrollen?')).toBeInTheDocument()
  })
})

// ============================================================================
// RevertCycleDialog
// ============================================================================

describe('RevertCycleDialog', () => {
  function renderDialog(
    overrides: {
      open?: boolean
      isSubmitting?: boolean
    } = {}
  ) {
    const onConfirm = vi.fn()
    const onOpenChange = vi.fn()
    const result = render(
      <RevertCycleDialog
        open={overrides.open ?? true}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
        isSubmitting={overrides.isSubmitting ?? false}
      />
    )
    return { ...result, onConfirm, onOpenChange }
  }

  it('closed by default when open=false', () => {
    renderDialog({ open: false })
    expect(screen.queryByText('Återställ kontrollen?')).toBeNull()
  })

  it('renders title + body copy (AC 7)', () => {
    renderDialog()
    expect(screen.getByText('Återställ kontrollen?')).toBeInTheDocument()
    expect(
      screen.getByText(
        /Kontrollen går tillbaka till Pågående\. Signeringar och bedömningar behålls oförändrade\. Du kan slutföra den på nytt när du är klar\./
      )
    ).toBeInTheDocument()
  })

  it('primary button click calls onConfirm', () => {
    const { onConfirm } = renderDialog()
    const primary = screen.getByRole('button', { name: 'Återställ' })
    fireEvent.click(primary)
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('cancel click calls onOpenChange(false)', () => {
    const { onOpenChange } = renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Avbryt' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('isSubmitting=true disables both buttons', () => {
    renderDialog({ isSubmitting: true })
    expect(screen.getByRole('button', { name: 'Avbryt' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Återställ/ })).toBeDisabled()
  })
})
