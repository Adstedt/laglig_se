import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { FilterChip, FilterChipGroup } from '@/components/ui/filter-chip'

/**
 * Story 22.2 — FilterChip primitive contract.
 *
 * Critical regression guard: filter chips must render as
 *   `<button type="button" aria-pressed>`
 * NOT `role="tab"`. Reserve shadcn `<Tabs>` for view-switching only.
 */

describe('FilterChip', () => {
  it('renders as a button with aria-pressed reflecting the pressed prop', () => {
    render(
      <FilterChip pressed={true} onPressedChange={() => {}}>
        Avvikelse
      </FilterChip>
    )
    const btn = screen.getByRole('button', { name: /avvikelse/i })
    expect(btn).toHaveAttribute('aria-pressed', 'true')
  })

  it('aria-pressed flips with pressed prop', () => {
    const { rerender } = render(
      <FilterChip pressed={false} onPressedChange={() => {}}>
        Alla
      </FilterChip>
    )
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')

    rerender(
      <FilterChip pressed={true} onPressedChange={() => {}}>
        Alla
      </FilterChip>
    )
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('does NOT render with role="tab"', () => {
    render(
      <FilterChip pressed={false} onPressedChange={() => {}}>
        Öppna
      </FilterChip>
    )
    expect(screen.queryByRole('tab')).toBeNull()
  })

  it('invokes onPressedChange with the toggled value on click', () => {
    const onChange = vi.fn()
    render(
      <FilterChip pressed={false} onPressedChange={onChange}>
        Stängda
      </FilterChip>
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('invokes onPressedChange with false when pressed→unpressed', () => {
    const onChange = vi.fn()
    render(
      <FilterChip pressed={true} onPressedChange={onChange}>
        Stängda
      </FilterChip>
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('renders a count badge when count prop is provided', () => {
    render(
      <FilterChip pressed={false} onPressedChange={() => {}} count={42}>
        Aktiva
      </FilterChip>
    )
    expect(screen.getByText('42')).toBeInTheDocument()
    // Count badge has tabular-nums for stable width
    const countSpan = screen.getByText('42')
    expect(countSpan).toHaveClass('tabular-nums')
  })

  it('omits the count badge when count is undefined', () => {
    render(
      <FilterChip pressed={false} onPressedChange={() => {}}>
        Alla
      </FilterChip>
    )
    expect(screen.queryByText(/^\d+$/)).toBeNull()
  })

  it('renders the icon slot before the label', () => {
    render(
      <FilterChip
        pressed={false}
        onPressedChange={() => {}}
        icon={<span data-testid="chip-icon">★</span>}
      >
        Aktiva
      </FilterChip>
    )
    expect(screen.getByTestId('chip-icon')).toBeInTheDocument()
  })

  it('disables the button and prevents onPressedChange when disabled', () => {
    const onChange = vi.fn()
    render(
      <FilterChip pressed={false} onPressedChange={onChange} disabled>
        Aktiva
      </FilterChip>
    )
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    fireEvent.click(btn)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('applies pressed-state class strings', () => {
    const { rerender } = render(
      <FilterChip pressed={false} onPressedChange={() => {}}>
        Aktiva
      </FilterChip>
    )
    let btn = screen.getByRole('button')
    expect(btn).toHaveClass('border-border')
    expect(btn).toHaveClass('text-muted-foreground')

    rerender(
      <FilterChip pressed={true} onPressedChange={() => {}}>
        Aktiva
      </FilterChip>
    )
    btn = screen.getByRole('button')
    expect(btn).toHaveClass('bg-foreground')
    expect(btn).toHaveClass('text-background')
  })

  it('accepts and forwards a caller className', () => {
    render(
      <FilterChip
        pressed={false}
        onPressedChange={() => {}}
        className="custom-x"
      >
        Aktiva
      </FilterChip>
    )
    expect(screen.getByRole('button')).toHaveClass('custom-x')
  })
})

describe('FilterChipGroup', () => {
  it('renders a div with role="group" and the supplied aria-label', () => {
    render(
      <FilterChipGroup aria-label="Filtrera kontroller efter status">
        <span>chip</span>
      </FilterChipGroup>
    )
    const group = screen.getByRole('group', {
      name: 'Filtrera kontroller efter status',
    })
    expect(group).toBeInTheDocument()
  })

  it('does NOT render with role="tablist"', () => {
    render(
      <FilterChipGroup aria-label="x">
        <span>chip</span>
      </FilterChipGroup>
    )
    expect(screen.queryByRole('tablist')).toBeNull()
  })

  it('renders chips as children', () => {
    render(
      <FilterChipGroup aria-label="g">
        <FilterChip pressed={false} onPressedChange={() => {}}>
          A
        </FilterChip>
        <FilterChip pressed={true} onPressedChange={() => {}}>
          B
        </FilterChip>
      </FilterChipGroup>
    )
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })
})
