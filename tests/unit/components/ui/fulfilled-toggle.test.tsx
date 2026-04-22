import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FulfilledToggle } from '@/components/ui/fulfilled-toggle'

describe('FulfilledToggle', () => {
  it('renders checked state with aria-pressed=true', () => {
    render(<FulfilledToggle checked aria-label="Uppfylld" />)
    const button = screen.getByRole('button', { name: 'Uppfylld' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button).toHaveAttribute('data-state', 'checked')
  })

  it('renders unchecked state with aria-pressed=false', () => {
    render(<FulfilledToggle checked={false} aria-label="Ej uppfylld" />)
    const button = screen.getByRole('button', { name: 'Ej uppfylld' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button).toHaveAttribute('data-state', 'unchecked')
  })

  it('click fires onCheckedChange with the toggled value', async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    render(
      <FulfilledToggle
        checked={false}
        onCheckedChange={onCheckedChange}
        aria-label="Toggle"
      />
    )
    await user.click(screen.getByRole('button', { name: 'Toggle' }))
    expect(onCheckedChange).toHaveBeenCalledWith(true)
  })

  it('disabled blocks clicks and sets the disabled attribute', async () => {
    const user = userEvent.setup()
    const onCheckedChange = vi.fn()
    render(
      <FulfilledToggle
        checked={false}
        onCheckedChange={onCheckedChange}
        disabled
        aria-label="Disabled toggle"
      />
    )
    const button = screen.getByRole('button', { name: 'Disabled toggle' })
    expect(button).toBeDisabled()
    await user.click(button)
    expect(onCheckedChange).not.toHaveBeenCalled()
  })
})
