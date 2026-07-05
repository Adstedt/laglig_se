/**
 * Story 7.3: Personalkort modal component tests — SplitPanelModal composition
 * (create/edit/read-only/closed states), the save flow through the server
 * actions, and inline personnummer validation.
 *
 * Server actions are mocked at the module boundary (the real ones are covered
 * in tests/unit/app/actions/employees.test.ts); the shell, tabs and form
 * render for real.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PersonalkortModal } from '@/components/features/personalregister/personalkort-modal'
import type { EmployeeRow } from '@/components/features/personalregister/employee-row'

const mockGetCollectiveAgreements = vi.fn()
const mockCreateEmployee = vi.fn()
const mockUpdateEmployee = vi.fn()

vi.mock('@/app/actions/employees', () => ({
  getCollectiveAgreements: (...args: unknown[]) =>
    mockGetCollectiveAgreements(...args),
  createEmployee: (...args: unknown[]) => mockCreateEmployee(...args),
  updateEmployee: (...args: unknown[]) => mockUpdateEmployee(...args),
}))

// Story 7.5: the empty-state affordance now opens the real shared upload
// dialog, whose form calls the collective-agreements actions.
const mockUploadCollectiveAgreement = vi.fn()
const mockListCollectiveAgreements = vi.fn()
vi.mock('@/app/actions/collective-agreements', () => ({
  uploadCollectiveAgreement: (...args: unknown[]) =>
    mockUploadCollectiveAgreement(...args),
  listCollectiveAgreements: (...args: unknown[]) =>
    mockListCollectiveAgreements(...args),
}))

const mockToastSuccess = vi.fn()
const mockToastError = vi.fn()
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}))

function makeRow(overrides: Partial<EmployeeRow> = {}): EmployeeRow {
  return {
    id: 'emp-1',
    first_name: 'Anna',
    last_name: 'Svensson',
    employee_id_ref: null,
    personnummer: null,
    personnummer_masked: false,
    email: null,
    phone1: null,
    phone2: null,
    address1: null,
    address2: null,
    post_code: null,
    city: null,
    country: 'SE',
    job_title: null,
    employment_date: null,
    employed_to: null,
    employment_form: null,
    personel_type: null,
    salary_form: null,
    inactive: false,
    full_time_equivalent: null,
    average_weekly_hours: null,
    vacation_days_paid: null,
    manager_id: null,
    group_id: null,
    group: null,
    collective_agreement_id: null,
    collective_agreement: { id: 'ca-1', name: 'Byggavtalet' },
    ...overrides,
  } as EmployeeRow
}

function renderModal(
  props: Partial<React.ComponentProps<typeof PersonalkortModal>> = {}
) {
  const onClose = vi.fn()
  const onEmployeeChange = vi.fn()
  const utils = render(
    <PersonalkortModal
      anstalldId="ny"
      row={null}
      employees={[]}
      canManage
      onClose={onClose}
      onEmployeeChange={onEmployeeChange}
      {...props}
    />
  )
  return { ...utils, onClose, onEmployeeChange }
}

beforeEach(() => {
  mockGetCollectiveAgreements.mockReset()
  mockCreateEmployee.mockReset()
  mockUpdateEmployee.mockReset()
  mockToastSuccess.mockReset()
  mockToastError.mockReset()
  mockUploadCollectiveAgreement.mockReset()
  mockListCollectiveAgreements.mockReset()
  mockGetCollectiveAgreements.mockResolvedValue({ success: true, data: [] })
})

describe('PersonalkortModal — states', () => {
  test('renders nothing when closed (anstalldId null)', () => {
    renderModal({ anstalldId: null })
    expect(screen.queryByText('Ny anställd')).toBeNull()
  })

  test("create mode ('ny'): empty tabbed form + create CTA", async () => {
    renderModal()

    expect(await screen.findAllByText('Ny anställd')).not.toHaveLength(0)
    expect(
      screen.getByRole('tab', { name: 'Personalinformation' })
    ).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Anställning' })).toBeInTheDocument()
    // Semester is a SECTION on Anställning, not a tab (user checkpoint —
    // a one-field tab collapsed the modal height).
    expect(screen.queryByRole('tab', { name: 'Semester' })).toBeNull()
    expect(screen.getByLabelText('Förnamn *')).toHaveValue('')
    expect(
      screen.getByRole('button', { name: 'Lägg till anställd' })
    ).toBeInTheDocument()
  })

  test('edit mode: prefilled from the row, sidebar shows status + avtal', async () => {
    renderModal({ anstalldId: 'emp-1', row: makeRow() })

    expect(await screen.findByLabelText('Förnamn *')).toHaveValue('Anna')
    // 'Aktiv' renders twice by design: the entity header's tone badge
    // (DESIGN-002) and the compliance sidebar's status row.
    expect(screen.getAllByText('Aktiv').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Byggavtalet')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Spara ändringar' })
    ).toBeInTheDocument()
  })

  test('read-only (employees:view): inputs disabled, no save button', async () => {
    renderModal({ anstalldId: 'emp-1', row: makeRow(), canManage: false })

    expect(await screen.findByLabelText('Förnamn *')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Spara ändringar' })).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Lägg till anställd' })
    ).toBeNull()
  })

  test('edit mode with a missing row renders nothing (island clears the param)', async () => {
    renderModal({ anstalldId: 'emp-gone', row: null })
    // Flush the agreements fetch effect before asserting (act hygiene).
    await waitFor(() =>
      expect(mockGetCollectiveAgreements).toHaveBeenCalledTimes(1)
    )
    expect(screen.queryByRole('tab', { name: 'Anställning' })).toBeNull()
  })
})

describe('PersonalkortModal — save flow', () => {
  test('create: submits name-only, lifts the returned row and closes', async () => {
    const returned = makeRow({ id: 'emp-new', first_name: 'Bo' })
    mockCreateEmployee.mockResolvedValueOnce({ success: true, data: returned })
    const { onClose, onEmployeeChange } = renderModal()

    fireEvent.change(await screen.findByLabelText('Förnamn *'), {
      target: { value: 'Bo' },
    })
    fireEvent.change(screen.getByLabelText('Efternamn *'), {
      target: { value: 'Ek' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Lägg till anställd' }))

    await waitFor(() => expect(mockCreateEmployee).toHaveBeenCalledTimes(1))
    const input = mockCreateEmployee.mock.calls[0]?.[0] as {
      first_name: string
      last_name: string
      personnummer: string | null
    }
    expect(input.first_name).toBe('Bo')
    expect(input.last_name).toBe('Ek')
    expect(input.personnummer).toBeNull()
    await waitFor(() =>
      expect(onEmployeeChange).toHaveBeenCalledWith(returned, 'created')
    )
    expect(onClose).toHaveBeenCalled()
    expect(mockToastSuccess).toHaveBeenCalled()
  })

  test('invalid personnummer blocks submit with the inline Swedish error', async () => {
    renderModal()

    fireEvent.change(await screen.findByLabelText('Förnamn *'), {
      target: { value: 'Bo' },
    })
    fireEvent.change(screen.getByLabelText('Efternamn *'), {
      target: { value: 'Ek' },
    })
    fireEvent.change(screen.getByLabelText('Personnummer'), {
      target: { value: '640823-3235' }, // Luhn failure
    })
    fireEvent.click(screen.getByRole('button', { name: 'Lägg till anställd' }))

    expect(await screen.findByText('Ogiltigt personnummer')).toBeInTheDocument()
    expect(mockCreateEmployee).not.toHaveBeenCalled()
  })

  test('failed action surfaces a toast and keeps the modal open', async () => {
    mockCreateEmployee.mockResolvedValueOnce({
      success: false,
      error: 'Kunde inte skapa den anställda.',
    })
    const { onClose } = renderModal()

    fireEvent.change(await screen.findByLabelText('Förnamn *'), {
      target: { value: 'Bo' },
    })
    fireEvent.change(screen.getByLabelText('Efternamn *'), {
      target: { value: 'Ek' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Lägg till anställd' }))

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith(
        'Kunde inte skapa den anställda.'
      )
    )
    expect(onClose).not.toHaveBeenCalled()
  })

  test('DATA-001: masked prefill — field empty with keep-hint; untouched save omits the personnummer key', async () => {
    const row = makeRow({
      personnummer: '••••••-••••',
      personnummer_masked: true,
    })
    mockUpdateEmployee.mockResolvedValueOnce({ success: true, data: row })
    renderModal({ anstalldId: 'emp-1', row })

    // The mask never round-trips: field starts empty, helper explains that
    // leaving it empty keeps the stored value.
    const field = await screen.findByLabelText('Personnummer')
    expect(field).toHaveValue('')
    expect(
      screen.getByText('Befintligt personnummer behålls om fältet lämnas tomt.')
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Spara ändringar' }))

    await waitFor(() => expect(mockUpdateEmployee).toHaveBeenCalledTimes(1))
    const input = mockUpdateEmployee.mock.calls[0]?.[1] as Record<
      string,
      unknown
    >
    // The action input has NO personnummer key → the update write leaves the
    // stored (possibly just transiently undecryptable) ciphertext untouched.
    expect('personnummer' in input).toBe(false)
  })

  test('DATA-001: masked prefill — typing a new value replaces the stored one', async () => {
    const row = makeRow({
      personnummer: '••••••-••••',
      personnummer_masked: true,
    })
    mockUpdateEmployee.mockResolvedValueOnce({ success: true, data: row })
    renderModal({ anstalldId: 'emp-1', row })

    fireEvent.change(await screen.findByLabelText('Personnummer'), {
      target: { value: '640823-3234' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Spara ändringar' }))

    await waitFor(() => expect(mockUpdateEmployee).toHaveBeenCalledTimes(1))
    const input = mockUpdateEmployee.mock.calls[0]?.[1] as {
      personnummer?: string | null
    }
    expect(input.personnummer).toBe('640823-3234')
  })

  test('DATA-001: plaintext prefill — deliberately clearing the field sends an explicit clear (null)', async () => {
    const row = makeRow({
      personnummer: '640823-3234',
      personnummer_masked: false,
    })
    mockUpdateEmployee.mockResolvedValueOnce({ success: true, data: row })
    renderModal({ anstalldId: 'emp-1', row })

    const field = await screen.findByLabelText('Personnummer')
    expect(field).toHaveValue('640823-3234')
    // The keep-hint belongs to the masked path only.
    expect(
      screen.queryByText(
        'Befintligt personnummer behålls om fältet lämnas tomt.'
      )
    ).toBeNull()

    fireEvent.change(field, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Spara ändringar' }))

    await waitFor(() => expect(mockUpdateEmployee).toHaveBeenCalledTimes(1))
    const input = mockUpdateEmployee.mock.calls[0]?.[1] as Record<
      string,
      unknown
    >
    expect('personnummer' in input).toBe(true)
    expect(input.personnummer).toBeNull()
  })

  test('edit: submits through updateEmployee with the row id and preserved group', async () => {
    const row = makeRow({ group_id: 'grp-1' })
    mockUpdateEmployee.mockResolvedValueOnce({ success: true, data: row })
    const { onEmployeeChange } = renderModal({ anstalldId: 'emp-1', row })

    fireEvent.change(await screen.findByLabelText('Förnamn *'), {
      target: { value: 'Anna-Karin' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Spara ändringar' }))

    await waitFor(() => expect(mockUpdateEmployee).toHaveBeenCalledTimes(1))
    const [id, input] = mockUpdateEmployee.mock.calls[0] as [
      string,
      { first_name: string; group_id: string | null },
    ]
    expect(id).toBe('emp-1')
    expect(input.first_name).toBe('Anna-Karin')
    expect(input.group_id).toBe('grp-1')
    await waitFor(() =>
      expect(onEmployeeChange).toHaveBeenCalledWith(row, 'updated')
    )
  })
})

describe('PersonalkortModal — Anställning tab UI legs (QA TEST-002 / UX-001)', () => {
  test('manager select: only active employees, self excluded, inactive current manager kept', async () => {
    const user = userEvent.setup()
    const self = makeRow({
      id: 'emp-1',
      first_name: 'Anna',
      last_name: 'Svensson',
      manager_id: 'emp-4',
    })
    const activeColleague = makeRow({
      id: 'emp-2',
      first_name: 'Berit',
      last_name: 'Lund',
    })
    const inactiveColleague = makeRow({
      id: 'emp-3',
      first_name: 'Carl',
      last_name: 'Öst',
      inactive: true,
    })
    // Assigned manager who has since been inactivated — shipped behavior
    // keeps them listed so the stored value can render; asserted on purpose.
    const inactiveCurrentManager = makeRow({
      id: 'emp-4',
      first_name: 'Doris',
      last_name: 'Alm',
      inactive: true,
    })
    renderModal({
      anstalldId: 'emp-1',
      row: self,
      employees: [
        self,
        activeColleague,
        inactiveColleague,
        inactiveCurrentManager,
      ],
    })

    await user.click(await screen.findByRole('tab', { name: 'Anställning' }))
    await user.click(screen.getByLabelText('Chef'))

    const options = screen
      .getAllByRole('option')
      .map((option) => option.textContent)
    expect(options).toContain('Ingen chef')
    expect(options).toContain('Berit Lund') // active, non-self
    expect(options).toContain('Doris Alm') // inactive but currently assigned
    expect(options).not.toContain('Anna Svensson') // self excluded
    expect(options).not.toContain('Carl Öst') // inactive excluded
  })

  test('Story 7.5: no agreements → enabled "Ladda upp kollektivavtal" opens the shared upload dialog', async () => {
    const user = userEvent.setup()
    // Default mock resolves { success: true, data: [] } (genuinely empty).
    renderModal()

    await user.click(await screen.findByRole('tab', { name: 'Anställning' }))

    const affordance = await screen.findByRole('button', {
      name: 'Ladda upp kollektivavtal',
    })
    expect(affordance).toBeEnabled()
    expect(screen.queryByText(/kommer snart/i)).toBeNull()
    expect(screen.queryByText('Kollektivavtal kunde inte laddas.')).toBeNull()

    await user.click(affordance)

    // The dialog wraps the SAME shared upload form (Story 7.5 AC 1).
    expect(
      await screen.findByRole('heading', { name: 'Ladda upp kollektivavtal' })
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/PDF-fil/)).toBeInTheDocument()
  })

  test('Story 7.5: upload via the dialog refetches agreements → the new agreement is immediately selectable', async () => {
    const user = userEvent.setup()
    mockUploadCollectiveAgreement.mockResolvedValue({
      success: true,
      data: {
        id: 'agr-new',
        name: 'Byggavtalet 2024',
        personel_type: 'ARB',
        status: 'PENDING',
        effective_from: null,
        effective_to: null,
        uploaded_by: 'user-1',
        created_at: '2026-07-03T10:00:00.000Z',
        assignedEmployeeCount: 0,
      },
    })
    // First fetch (modal open): empty. Refetch after upload: the new agreement.
    mockGetCollectiveAgreements
      .mockResolvedValueOnce({ success: true, data: [] })
      .mockResolvedValueOnce({
        success: true,
        data: [
          {
            id: 'agr-new',
            name: 'Byggavtalet 2024',
            personel_type: 'ARB',
            status: 'PENDING',
          },
        ],
      })
    renderModal()

    await user.click(await screen.findByRole('tab', { name: 'Anställning' }))
    await user.click(
      await screen.findByRole('button', { name: 'Ladda upp kollektivavtal' })
    )
    await user.type(await screen.findByLabelText(/Namn/), 'Byggavtalet 2024')
    await user.upload(
      screen.getByLabelText(/PDF-fil/),
      new File(['%PDF-1.4'], 'byggavtalet.pdf', { type: 'application/pdf' })
    )
    await user.click(screen.getByRole('button', { name: /Ladda upp$/ }))

    // The modal refetched (open + post-upload) and the empty-state affordance
    // gave way to the select with the new agreement.
    await waitFor(() =>
      expect(mockGetCollectiveAgreements).toHaveBeenCalledTimes(2)
    )
    expect(await screen.findByLabelText('Kollektivavtal')).toBeInTheDocument()
    await user.click(screen.getByLabelText('Kollektivavtal'))
    expect(
      screen.getByRole('option', { name: 'Byggavtalet 2024' })
    ).toBeInTheDocument()
  })

  test('Story 7.5: view-only role gets the plain empty-state text, no upload affordance', async () => {
    const user = userEvent.setup()
    const row = makeRow({ collective_agreement_id: null })
    renderModal({ anstalldId: 'emp-1', row, canManage: false })

    await user.click(await screen.findByRole('tab', { name: 'Anställning' }))

    expect(
      await screen.findByText('Inga kollektivavtal har laddats upp.')
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Ladda upp kollektivavtal/ })
    ).toBeNull()
  })

  test('UX-001: failed agreements fetch shows the error hint, never the empty-state placeholder', async () => {
    const user = userEvent.setup()
    mockGetCollectiveAgreements.mockResolvedValue({
      success: false,
      error: 'Kunde inte hämta kollektivavtal.',
    })
    const row = makeRow({ collective_agreement_id: 'ca-1' })
    renderModal({ anstalldId: 'emp-1', row })

    await user.click(await screen.findByRole('tab', { name: 'Anställning' }))

    expect(
      await screen.findByText('Kollektivavtal kunde inte laddas.')
    ).toBeInTheDocument()
    // A transient error must not masquerade as "no agreements exist".
    expect(
      screen.queryByRole('button', { name: /Ladda upp kollektivavtal/ })
    ).toBeNull()
    expect(screen.getByLabelText('Kollektivavtal')).toBeDisabled()
  })
})

describe('PersonalkortModal — sidebar "Uppgifter" verdict (Story 7.4)', () => {
  const completeOverrides: Partial<EmployeeRow> = {
    personnummer: '890503-2556',
    employment_date: new Date('2020-01-01'),
    employment_form: 'TV',
    personel_type: 'ARB',
  } as Partial<EmployeeRow>

  test('create mode: neutral hint — no verdict before a record exists', async () => {
    renderModal()

    expect(
      await screen.findByText(
        'Här visas om uppgifter saknas när den anställda har sparats.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByText('Komplett')).toBeNull()
    expect(screen.queryByText('Ej komplett')).toBeNull()
  })

  test('complete row: green "Komplett" state, no reasons', async () => {
    renderModal({ anstalldId: 'emp-1', row: makeRow(completeOverrides) })

    expect(await screen.findByText('Komplett')).toBeInTheDocument()
    expect(screen.queryByText('Ej komplett')).toBeNull()
    expect(screen.queryByText(/Saknar/)).toBeNull()
  })

  test('incomplete row: "Ej komplett" + one reason per missing field, stable order', async () => {
    // Default makeRow(): personnummer/date/form/type all missing; the
    // kollektivavtal reason must NOT appear (workspace flag defaults false).
    renderModal({ anstalldId: 'emp-1', row: makeRow() })

    expect(await screen.findByText('Ej komplett')).toBeInTheDocument()
    const reasons = screen
      .getAllByRole('listitem')
      .map((li) => li.textContent?.replace('•', '').trim())
    expect(reasons).toEqual([
      'Saknar personnummer',
      'Saknar anställningsdatum',
      'Saknar anställningsform',
      'Saknar personaltyp',
    ])
  })

  test('kollektivavtal reason appears only when the workspace flag is on', async () => {
    renderModal({
      anstalldId: 'emp-1',
      row: makeRow({ ...completeOverrides, collective_agreement: null }),
      workspaceHasCollectiveAgreement: true,
    })

    expect(
      await screen.findByText('Inget kollektivavtal tilldelat')
    ).toBeInTheDocument()
    expect(screen.getByText('Ej komplett')).toBeInTheDocument()
  })

  test('masked personnummer counts as present in the sidebar too', async () => {
    renderModal({
      anstalldId: 'emp-1',
      row: makeRow({
        ...completeOverrides,
        personnummer: '••••••-••••',
        personnummer_masked: true,
      }),
    })

    expect(await screen.findByText('Komplett')).toBeInTheDocument()
    expect(screen.queryByText('Saknar personnummer')).toBeNull()
  })
})
