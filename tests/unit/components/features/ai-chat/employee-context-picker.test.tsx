/**
 * Story 7.7 (AC 1): EmployeeContextPicker RTL tests.
 *  - capability gating: no employees:view → renders NOTHING (fail closed);
 *  - lazy fetch on open + selection hands the mapped ChatEmployeeOption up;
 *  - inactive suffix + personaltyp label rendering.
 *
 * The pill chip + per-send body payload are covered in
 * chat-input-modern (pill) and use-chat-interface (transport) tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { EmployeeContextPicker } from '@/components/features/ai-chat/employee-context-picker'

// --- mocks -----------------------------------------------------------------

const mockCan = { viewEmployees: true }
vi.mock('@/lib/hooks/use-permissions', () => ({
  usePermissions: () => ({ can: mockCan }),
}))

const mockGetEmployees = vi.fn()
vi.mock('@/app/actions/employees', () => ({
  getEmployeesForChatContext: () => mockGetEmployees(),
}))

function employees() {
  return [
    {
      id: 'emp-1',
      first_name: 'Anna',
      last_name: 'Svensson',
      personel_type: 'TJM',
      employment_form: 'TV',
      employment_date: '2020-03-01',
      full_time_equivalent: 0.75,
      inactive: false,
      collective_agreement: { id: 'agreement-42', name: 'Teknikavtalet' },
    },
    {
      id: 'emp-2',
      first_name: 'Bert',
      last_name: 'Karlsson',
      personel_type: null,
      employment_form: null,
      employment_date: null,
      full_time_equivalent: null,
      inactive: true,
      collective_agreement: null,
    },
  ]
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCan.viewEmployees = true
  mockGetEmployees.mockResolvedValue({ success: true, data: employees() })
})

// --- tests -----------------------------------------------------------------

describe('EmployeeContextPicker — capability gating (AC 1)', () => {
  it('renders NOTHING without employees:view (fail closed)', () => {
    mockCan.viewEmployees = false
    const { container } = render(
      (<EmployeeContextPicker onSelect={vi.fn()} />) as ReactNode
    )
    expect(container).toBeEmptyDOMElement()
    expect(mockGetEmployees).not.toHaveBeenCalled()
  })

  it('renders the trigger with employees:view', () => {
    render((<EmployeeContextPicker onSelect={vi.fn()} />) as ReactNode)
    expect(
      screen.getByTestId('chat-employee-picker-trigger')
    ).toBeInTheDocument()
    // Lazy: no fetch until opened.
    expect(mockGetEmployees).not.toHaveBeenCalled()
  })
})

describe('EmployeeContextPicker — open, fetch, select', () => {
  it('fetches on first open and lists employees with personaltyp + Inaktiv suffix', async () => {
    render((<EmployeeContextPicker onSelect={vi.fn()} />) as ReactNode)

    fireEvent.click(screen.getByTestId('chat-employee-picker-trigger'))

    expect(mockGetEmployees).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Anna Svensson')).toBeInTheDocument()
    expect(screen.getByText('Tjänsteman')).toBeInTheDocument()
    expect(screen.getByText('Bert Karlsson')).toBeInTheDocument()
    expect(screen.getByText('· Inaktiv')).toBeInTheDocument()
  })

  it('selecting an employee hands up the mapped ChatEmployeeOption and closes', async () => {
    const onSelect = vi.fn()
    render((<EmployeeContextPicker onSelect={onSelect} />) as ReactNode)

    fireEvent.click(screen.getByTestId('chat-employee-picker-trigger'))
    const item = await screen.findByText('Anna Svensson')
    fireEvent.click(item)

    await waitFor(() =>
      expect(onSelect).toHaveBeenCalledWith({
        id: 'emp-1',
        name: 'Anna Svensson',
        personelTypeLabel: 'Tjänsteman',
        inactive: false,
      })
    )
    // Popover closed after selection.
    await waitFor(() =>
      expect(screen.queryByText('Bert Karlsson')).not.toBeInTheDocument()
    )
  })

  it('shows the error empty-state when the fetch fails', async () => {
    mockGetEmployees.mockResolvedValue({ success: false, error: 'nope' })
    render((<EmployeeContextPicker onSelect={vi.fn()} />) as ReactNode)

    fireEvent.click(screen.getByTestId('chat-employee-picker-trigger'))
    expect(
      await screen.findByText('Kunde inte hämta anställda.')
    ).toBeInTheDocument()
  })
})
