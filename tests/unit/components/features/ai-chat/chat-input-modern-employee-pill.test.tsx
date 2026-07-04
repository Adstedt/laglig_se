/**
 * Story 7.7 (AC 1): the employee pill in ChatInputModern.
 *  - removable pill renders name + personaltyp (attachment-chip pattern);
 *  - remove button fires onRemoveEmployee;
 *  - the picker mounts only when onSelectEmployee is provided.
 *
 * EmployeeContextPicker is stubbed — its own gating/fetch behavior is pinned
 * in employee-context-picker.test.tsx.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ChatInputModern } from '@/components/features/ai-chat/chat-input-modern'

vi.mock('@/components/features/ai-chat/employee-context-picker', () => ({
  EmployeeContextPicker: () => <div data-testid="employee-picker-stub" />,
}))

const employee = {
  id: 'emp-1',
  name: 'Anna Svensson',
  personelTypeLabel: 'Tjänsteman',
  inactive: false,
}

describe('ChatInputModern — employee pill (Story 7.7)', () => {
  it('renders the removable pill with name + personaltyp', () => {
    const onRemove = vi.fn()
    render(
      (
        <ChatInputModern
          onSend={vi.fn()}
          selectedEmployee={employee}
          onSelectEmployee={vi.fn()}
          onRemoveEmployee={onRemove}
        />
      ) as ReactNode
    )

    const pill = screen.getByTestId('chat-employee-pill')
    expect(pill).toHaveTextContent('Anna Svensson')
    expect(pill).toHaveTextContent('Tjänsteman')

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Ta bort Anna Svensson från chatten',
      })
    )
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('renders no pill when no employee is selected', () => {
    render(
      (
        <ChatInputModern
          onSend={vi.fn()}
          selectedEmployee={null}
          onSelectEmployee={vi.fn()}
        />
      ) as ReactNode
    )
    expect(screen.queryByTestId('chat-employee-pill')).not.toBeInTheDocument()
  })

  it('mounts the picker only when onSelectEmployee is provided', () => {
    const { rerender } = render(
      (<ChatInputModern onSend={vi.fn()} />) as ReactNode
    )
    expect(screen.queryByTestId('employee-picker-stub')).not.toBeInTheDocument()

    rerender(
      (
        <ChatInputModern onSend={vi.fn()} onSelectEmployee={vi.fn()} />
      ) as ReactNode
    )
    expect(screen.getByTestId('employee-picker-stub')).toBeInTheDocument()
  })

  it('pill without personaltyp label renders the name alone', () => {
    render(
      (
        <ChatInputModern
          onSend={vi.fn()}
          selectedEmployee={{ ...employee, personelTypeLabel: null }}
          onSelectEmployee={vi.fn()}
          onRemoveEmployee={vi.fn()}
        />
      ) as ReactNode
    )
    const pill = screen.getByTestId('chat-employee-pill')
    expect(pill).toHaveTextContent('Anna Svensson')
    expect(pill).not.toHaveTextContent('Tjänsteman')
  })
})
