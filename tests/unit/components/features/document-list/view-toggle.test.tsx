/**
 * Story 4.12: ViewToggle Component Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ViewToggle } from '@/components/features/document-list/view-toggle'

describe('ViewToggle', () => {
  it('renders card and table toggle buttons', () => {
    const onChange = vi.fn()
    render(<ViewToggle value="card" onChange={onChange} />)

    expect(screen.getByRole('radio', { name: /kortvy/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /tabellvy/i })).toBeInTheDocument()
  })

  it('shows card view as selected when value is card', () => {
    const onChange = vi.fn()
    render(<ViewToggle value="card" onChange={onChange} />)

    const cardButton = screen.getByRole('radio', { name: /kortvy/i })
    // ToggleGroupItem uses aria-checked for selection state
    expect(cardButton).toHaveAttribute('aria-checked', 'true')
  })

  it('shows table view as selected when value is table', () => {
    const onChange = vi.fn()
    render(<ViewToggle value="table" onChange={onChange} />)

    const tableButton = screen.getByRole('radio', { name: /tabellvy/i })
    expect(tableButton).toHaveAttribute('aria-checked', 'true')
  })

  it('calls onChange with "table" when clicking table button', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ViewToggle value="card" onChange={onChange} />)

    const tableButton = screen.getByRole('radio', { name: /tabellvy/i })
    await user.click(tableButton)

    expect(onChange).toHaveBeenCalledWith('table')
  })

  it('calls onChange with "card" when clicking card button from table view', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ViewToggle value="table" onChange={onChange} />)

    const cardButton = screen.getByRole('radio', { name: /kortvy/i })
    await user.click(cardButton)

    expect(onChange).toHaveBeenCalledWith('card')
  })

  it('does not call onChange when clicking already selected button', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ViewToggle value="card" onChange={onChange} />)

    const cardButton = screen.getByRole('radio', { name: /kortvy/i })
    await user.click(cardButton)

    // Should not call onChange since card is already selected
    expect(onChange).not.toHaveBeenCalled()
  })
})
