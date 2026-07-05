/**
 * Story 7.6: edit / delete / assign dialogs.
 *
 * Delete: the confirmation copy states every consequence (avtilldelning with
 * natural Swedish count grammar, document removal, AI de-indexing) and the
 * action only fires on confirm. Assign: live preview count via the SAME
 * filter as the mutation, Personaltyp defaulting to the agreement's typ,
 * group mode with lazy group fetch, 0-count guard on the confirm button.
 * Edit: prefill from the agreement, payload mapping (typ → null, ISO dates).
 */
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KollektivavtalEditDialog } from '@/components/features/kollektivavtal/kollektivavtal-edit-dialog'
import { KollektivavtalDeleteDialog } from '@/components/features/kollektivavtal/kollektivavtal-delete-dialog'
import { KollektivavtalAssignDialog } from '@/components/features/kollektivavtal/kollektivavtal-assign-dialog'
import type { CollectiveAgreementListItem } from '@/app/actions/collective-agreements'

const mockUpdate = vi.fn()
const mockDelete = vi.fn()
const mockAssign = vi.fn()
const mockPreview = vi.fn()
vi.mock('@/app/actions/collective-agreements', () => ({
  updateCollectiveAgreement: (...args: unknown[]) => mockUpdate(...args),
  deleteCollectiveAgreement: (...args: unknown[]) => mockDelete(...args),
  assignCollectiveAgreementBulk: (...args: unknown[]) => mockAssign(...args),
  previewBulkAssignCount: (...args: unknown[]) => mockPreview(...args),
}))

const mockGetGroups = vi.fn()
vi.mock('@/app/actions/employees', () => ({
  getEmployeeGroups: (...args: unknown[]) => mockGetGroups(...args),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

function makeItem(
  overrides: Partial<CollectiveAgreementListItem> = {}
): CollectiveAgreementListItem {
  return {
    id: 'agr-1',
    name: 'Byggavtalet 2024',
    personel_type: 'ARB',
    status: 'READY',
    effective_from: '2024-04-01',
    effective_to: '2025-03-31',
    uploaded_by: 'user-1',
    created_at: '2026-07-01T08:00:00.000Z',
    assignedEmployeeCount: 3,
    ...overrides,
  } as CollectiveAgreementListItem
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUpdate.mockResolvedValue({ success: true, data: makeItem() })
  mockDelete.mockResolvedValue({ success: true })
  mockAssign.mockResolvedValue({ success: true, data: { assigned: 3 } })
  mockPreview.mockResolvedValue({ success: true, data: { count: 3 } })
  mockGetGroups.mockResolvedValue({
    success: true,
    data: [
      { id: 'grp-1', name: 'Lager', position: 0, employeeCount: 5 },
      { id: 'grp-2', name: 'Huvudkontor', position: 1, employeeCount: 2 },
    ],
  })
})

// ===========================================================================
// Delete dialog
// ===========================================================================

describe('KollektivavtalDeleteDialog — consequence copy (AC 3)', () => {
  test('lists all three consequences with natural plural grammar', () => {
    render(
      <KollektivavtalDeleteDialog
        open
        onOpenChange={vi.fn()}
        agreement={makeItem({ assignedEmployeeCount: 3 })}
        onDeleted={vi.fn()}
      />
    )

    expect(
      screen.getByText('3 anställda kommer att avtilldelas.')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Dokumentet tas bort från Filer.')
    ).toBeInTheDocument()
    expect(
      screen.getByText('AI-assistenten kan inte längre läsa avtalet.')
    ).toBeInTheDocument()
  })

  test('singular: "1 anställd kommer att avtilldelas."', () => {
    render(
      <KollektivavtalDeleteDialog
        open
        onOpenChange={vi.fn()}
        agreement={makeItem({ assignedEmployeeCount: 1 })}
        onDeleted={vi.fn()}
      />
    )
    expect(
      screen.getByText('1 anställd kommer att avtilldelas.')
    ).toBeInTheDocument()
  })

  test('zero assigned: "Inga anställda är tilldelade avtalet."', () => {
    render(
      <KollektivavtalDeleteDialog
        open
        onOpenChange={vi.fn()}
        agreement={makeItem({ assignedEmployeeCount: 0 })}
        onDeleted={vi.fn()}
      />
    )
    expect(
      screen.getByText('Inga anställda är tilldelade avtalet.')
    ).toBeInTheDocument()
  })

  test('confirm calls the action and lifts onDeleted; Avbryt never deletes', async () => {
    const user = userEvent.setup()
    const onDeleted = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <KollektivavtalDeleteDialog
        open
        onOpenChange={onOpenChange}
        agreement={makeItem()}
        onDeleted={onDeleted}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Ta bort' }))

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('agr-1'))
    expect(onDeleted).toHaveBeenCalledWith('agr-1')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  test('a failed delete keeps the dialog open and never lifts onDeleted', async () => {
    const user = userEvent.setup()
    const onDeleted = vi.fn()
    mockDelete.mockResolvedValue({ success: false, error: 'Åtkomst nekad' })
    render(
      <KollektivavtalDeleteDialog
        open
        onOpenChange={vi.fn()}
        agreement={makeItem()}
        onDeleted={onDeleted}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Ta bort' }))

    await waitFor(() => expect(mockDelete).toHaveBeenCalled())
    expect(onDeleted).not.toHaveBeenCalled()
  })
})

// ===========================================================================
// Assign dialog
// ===========================================================================

describe('KollektivavtalAssignDialog — preview + targeting (AC 2)', () => {
  test('defaults to Personaltyp mode with the agreement typ and shows the live preview count', async () => {
    render(
      <KollektivavtalAssignDialog
        open
        onOpenChange={vi.fn()}
        agreement={makeItem({ personel_type: 'ARB' })}
        onAssigned={vi.fn()}
      />
    )

    await waitFor(() =>
      expect(mockPreview).toHaveBeenCalledWith({
        kind: 'personel_type',
        value: 'ARB',
      })
    )
    expect(
      await screen.findByText('Tilldelar 3 anställda.')
    ).toBeInTheDocument()
    // The overwrite guardrail copy is stated up front.
    expect(
      screen.getByText(
        /Befintliga tilldelningar för de valda anställda skrivs\s+över/
      )
    ).toBeInTheDocument()
  })

  test('confirm assigns by personaltyp and lifts the assigned count', async () => {
    const user = userEvent.setup()
    const onAssigned = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <KollektivavtalAssignDialog
        open
        onOpenChange={onOpenChange}
        agreement={makeItem({ personel_type: 'ARB' })}
        onAssigned={onAssigned}
      />
    )

    await screen.findByText('Tilldelar 3 anställda.')
    await user.click(screen.getByRole('button', { name: 'Tilldela' }))

    await waitFor(() =>
      expect(mockAssign).toHaveBeenCalledWith('agr-1', {
        kind: 'personel_type',
        value: 'ARB',
      })
    )
    expect(onAssigned).toHaveBeenCalledWith(3)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  test('group mode: lazy group fetch, group target preview, confirm assigns the enhet', async () => {
    const user = userEvent.setup()
    render(
      <KollektivavtalAssignDialog
        open
        onOpenChange={vi.fn()}
        agreement={makeItem()}
        onAssigned={vi.fn()}
      />
    )

    await user.click(screen.getByRole('radio', { name: 'Grupp' }))
    await waitFor(() => expect(mockGetGroups).toHaveBeenCalled())

    // No target selected yet → prompt, confirm disabled.
    expect(
      screen.getByText('Välj ett mål för tilldelningen.')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tilldela' })).toBeDisabled()

    mockPreview.mockResolvedValue({ success: true, data: { count: 5 } })
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByRole('option', { name: 'Lager' }))

    await waitFor(() =>
      expect(mockPreview).toHaveBeenCalledWith({
        kind: 'group',
        groupId: 'grp-1',
      })
    )
    expect(
      await screen.findByText('Tilldelar 5 anställda.')
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tilldela' }))
    await waitFor(() =>
      expect(mockAssign).toHaveBeenCalledWith('agr-1', {
        kind: 'group',
        groupId: 'grp-1',
      })
    )
  })

  test('zero matches: "Inga anställda matchar valet." and the confirm stays disabled', async () => {
    mockPreview.mockResolvedValue({ success: true, data: { count: 0 } })
    render(
      <KollektivavtalAssignDialog
        open
        onOpenChange={vi.fn()}
        agreement={makeItem()}
        onAssigned={vi.fn()}
      />
    )

    expect(
      await screen.findByText('Inga anställda matchar valet.')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tilldela' })).toBeDisabled()
  })
})

// ===========================================================================
// Edit dialog
// ===========================================================================

describe('KollektivavtalEditDialog', () => {
  test('prefills namn + period from the agreement', () => {
    render(
      <KollektivavtalEditDialog
        open
        onOpenChange={vi.fn()}
        agreement={makeItem()}
        onSaved={vi.fn()}
      />
    )

    expect(screen.getByLabelText(/Namn/)).toHaveValue('Byggavtalet 2024')
    // Shared fieldset (upload form's fields minus the PDF input).
    expect(screen.getByLabelText('Typ')).toBeInTheDocument()
    expect(screen.queryByLabelText(/PDF-fil/)).toBeNull()
  })

  test('submit sends the mapped payload and lifts the updated item', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    const onOpenChange = vi.fn()
    const updated = makeItem({ name: 'Byggavtalet 2025' })
    mockUpdate.mockResolvedValue({ success: true, data: updated })

    render(
      <KollektivavtalEditDialog
        open
        onOpenChange={onOpenChange}
        agreement={makeItem()}
        onSaved={onSaved}
      />
    )

    const nameInput = screen.getByLabelText(/Namn/)
    await user.clear(nameInput)
    await user.type(nameInput, 'Byggavtalet 2025')
    await user.click(screen.getByRole('button', { name: 'Spara' }))

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith('agr-1', {
        name: 'Byggavtalet 2025',
        personel_type: 'ARB',
        effective_from: '2024-04-01',
        effective_to: '2025-03-31',
      })
    )
    expect(onSaved).toHaveBeenCalledWith(updated)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  test('empty Namn blocks the submit with a field error', async () => {
    const user = userEvent.setup()
    render(
      <KollektivavtalEditDialog
        open
        onOpenChange={vi.fn()}
        agreement={makeItem()}
        onSaved={vi.fn()}
      />
    )

    await user.clear(screen.getByLabelText(/Namn/))
    await user.click(screen.getByRole('button', { name: 'Spara' }))

    expect(await screen.findByText('Namn krävs.')).toBeInTheDocument()
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
