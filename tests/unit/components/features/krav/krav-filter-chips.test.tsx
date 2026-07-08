/**
 * Story 20.3 AC 11–17: KravFilterChips unit tests.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { KravFilterChips } from '@/components/features/krav/krav-filter-chips'

const counts = { all: 100, gaps: 40, mine: 15, needs_evidence: 7 }

describe('KravFilterChips', () => {
  it('renders all four chips with labels + counts (AC 11, 15)', () => {
    render(
      <KravFilterChips
        active="gaps"
        counts={counts}
        hasSearch={false}
        onChange={vi.fn()}
        onClear={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /Alla/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Luckor/ })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Mina krav/ })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Saknar bevis/ })
    ).toBeInTheDocument()
    // Each badge is present. Epic 28: the component renders BOTH the chip
    // row and its narrow-container dropdown twin (visibility is CSS-only
    // container queries), so counts appear once per variant.
    expect(screen.getAllByText('100').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('40').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('15').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('7').length).toBeGreaterThanOrEqual(1)
  })

  it('marks exactly one chip active via aria-pressed (AC 13)', () => {
    render(
      <KravFilterChips
        active="mine"
        counts={counts}
        hasSearch={false}
        onChange={vi.fn()}
        onClear={vi.fn()}
      />
    )
    const pressed = screen
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') === 'true')
    expect(pressed).toHaveLength(1)
    expect(pressed[0]).toHaveTextContent(/Mina krav/)
  })

  it('clicking a non-active chip calls onChange with the preset (AC 13)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <KravFilterChips
        active="gaps"
        counts={counts}
        hasSearch={false}
        onChange={onChange}
        onClear={vi.fn()}
      />
    )
    await user.click(screen.getByRole('button', { name: /Mina krav/ }))
    expect(onChange).toHaveBeenCalledWith('mine')
  })

  it('clicking the active chip is a no-op (AC 13)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <KravFilterChips
        active="gaps"
        counts={counts}
        hasSearch={false}
        onChange={onChange}
        onClear={vi.fn()}
      />
    )
    await user.click(screen.getByRole('button', { name: /Luckor/ }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('hides "Rensa" when state is default (filter=gaps, no search) (AC 16)', () => {
    render(
      <KravFilterChips
        active="gaps"
        counts={counts}
        hasSearch={false}
        onChange={vi.fn()}
        onClear={vi.fn()}
      />
    )
    expect(screen.queryByText(/Rensa/)).not.toBeInTheDocument()
  })

  it('shows "Rensa (1)" when only filter differs from default (AC 16)', () => {
    render(
      <KravFilterChips
        active="mine"
        counts={counts}
        hasSearch={false}
        onChange={vi.fn()}
        onClear={vi.fn()}
      />
    )
    expect(screen.getByText(/Rensa \(1\)/)).toBeInTheDocument()
  })

  it('shows "Rensa (1)" when only search is non-empty (AC 16)', () => {
    render(
      <KravFilterChips
        active="gaps"
        counts={counts}
        hasSearch
        onChange={vi.fn()}
        onClear={vi.fn()}
      />
    )
    expect(screen.getByText(/Rensa \(1\)/)).toBeInTheDocument()
  })

  it('shows "Rensa (2)" when both filter and search differ from defaults (AC 16)', () => {
    render(
      <KravFilterChips
        active="needs_evidence"
        counts={counts}
        hasSearch
        onChange={vi.fn()}
        onClear={vi.fn()}
      />
    )
    expect(screen.getByText(/Rensa \(2\)/)).toBeInTheDocument()
  })

  it('clicking "Rensa" fires onClear (AC 17)', async () => {
    const user = userEvent.setup()
    const onClear = vi.fn()
    render(
      <KravFilterChips
        active="mine"
        counts={counts}
        hasSearch
        onChange={vi.fn()}
        onClear={onClear}
      />
    )
    // Epic 28: chip-row + dropdown twins both mount — either Rensa works.
    await user.click(screen.getAllByRole('button', { name: /Rensa/ })[0]!)
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it('gracefully handles missing counts (undefined) — chips render without badges', () => {
    render(
      <KravFilterChips
        active="gaps"
        counts={undefined}
        hasSearch={false}
        onChange={vi.fn()}
        onClear={vi.fn()}
      />
    )
    expect(screen.getByRole('button', { name: /Luckor/ })).toBeInTheDocument()
    expect(screen.queryByText(/\d+/)).not.toBeInTheDocument()
  })
})
