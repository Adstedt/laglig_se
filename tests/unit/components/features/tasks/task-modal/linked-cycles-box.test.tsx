/**
 * Story 21.8 — LinkedCyclesBox component tests.
 *
 * Structural render assertions: presence, label, href, aria-label, truncation.
 * Radix popover interactions are avoided (flaky in happy-dom per Story 21.13
 * Debug Log notes).
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LinkedCyclesBox } from '@/components/features/tasks/task-modal/linked-cycles-box'
import type { TaskDetails } from '@/app/actions/task-modal'

// next/link renders a plain <a> in JSDOM — pass-through mock is sufficient.
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string
    children: React.ReactNode
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const CYCLE_1_ID = 'cycle-1'
const CYCLE_2_ID = 'cycle-2'
const FINDING_ID = 'finding-1'

function makeCycle(
  overrides: Partial<TaskDetails['linkedCycles'][number]> = {}
): TaskDetails['linkedCycles'][number] {
  return {
    id: CYCLE_1_ID,
    name: 'Q2 Internrevision',
    status: 'PAGAENDE',
    itemCount: 15,
    ...overrides,
  }
}

function makeFinding(
  overrides: Partial<NonNullable<TaskDetails['complianceFinding']>> = {}
): TaskDetails['complianceFinding'] {
  return {
    id: FINDING_ID,
    title: 'Saknad utbildningsplan',
    type: 'AVVIKELSE',
    closedAt: null,
    cycle: { id: CYCLE_1_ID, name: 'Q2 Internrevision' },
    ...overrides,
  }
}

describe('LinkedCyclesBox', () => {
  it('returns null when cycles array is empty', () => {
    const { container } = render(
      <LinkedCyclesBox cycles={[]} correctiveActionFinding={null} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders a single cycle row with name, status badge, and link', () => {
    render(
      <LinkedCyclesBox cycles={[makeCycle()]} correctiveActionFinding={null} />
    )

    expect(screen.getByText('Länkade kontroller')).toBeInTheDocument()
    expect(screen.getByText('Q2 Internrevision')).toBeInTheDocument()
    expect(screen.getByText('Pågående')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /Q2 Internrevision/ })
    expect(link).toHaveAttribute('href', `/laglistor/kontroller/${CYCLE_1_ID}`)
  })

  it('renders multiple cycle rows when cycles.length === 2 (anticipating Story 21.15)', () => {
    render(
      <LinkedCyclesBox
        cycles={[
          makeCycle(),
          makeCycle({ id: CYCLE_2_ID, name: 'Extern audit ISO 14001' }),
        ]}
        correctiveActionFinding={null}
      />
    )
    expect(screen.getByText('Q2 Internrevision')).toBeInTheDocument()
    expect(screen.getByText('Extern audit ISO 14001')).toBeInTheDocument()
  })

  it('renders the "Från avvikelse" sub-badge only on the cycle that matches the finding', () => {
    render(
      <LinkedCyclesBox
        cycles={[
          makeCycle(), // CYCLE_1_ID — matches finding
          makeCycle({ id: CYCLE_2_ID, name: 'Other cycle' }), // no match
        ]}
        correctiveActionFinding={makeFinding()}
      />
    )
    // Badge text appears exactly once (only on the matching cycle).
    const badges = screen.getAllByText(/Från avvikelse/)
    expect(badges).toHaveLength(1)
    expect(screen.getByText('Saknad utbildningsplan')).toBeInTheDocument()
  })

  it('does NOT render "Från avvikelse" sub-badge when correctiveActionFinding is null', () => {
    render(
      <LinkedCyclesBox cycles={[makeCycle()]} correctiveActionFinding={null} />
    )
    expect(screen.queryByText(/Från avvikelse/)).not.toBeInTheDocument()
  })

  it('renders type-derived prefix "Från observation" for OBSERVATION-spawned tasks', () => {
    render(
      <LinkedCyclesBox
        cycles={[makeCycle()]}
        correctiveActionFinding={makeFinding({ type: 'OBSERVATION' })}
      />
    )
    expect(screen.getByText(/Från observation/)).toBeInTheDocument()
    expect(screen.queryByText(/Från avvikelse/)).not.toBeInTheDocument()
  })

  it('renders type-derived prefix "Från förbättringsförslag" for FORBATTRING-spawned tasks', () => {
    render(
      <LinkedCyclesBox
        cycles={[makeCycle()]}
        correctiveActionFinding={makeFinding({ type: 'FORBATTRING' })}
      />
    )
    expect(screen.getByText(/Från förbättringsförslag/)).toBeInTheDocument()
  })

  it('truncates finding titles longer than 60 chars with ellipsis', () => {
    const longTitle = 'A'.repeat(80)
    render(
      <LinkedCyclesBox
        cycles={[makeCycle()]}
        correctiveActionFinding={makeFinding({ title: longTitle })}
      />
    )
    // Truncated to 59 chars + ellipsis → visible string ends with '…'.
    const truncated = screen.getByText(/A+…$/)
    expect(truncated.textContent?.length).toBeLessThan(longTitle.length)
  })

  it('aria-label on the card root lists every cycle name', () => {
    const { container } = render(
      <LinkedCyclesBox
        cycles={[
          makeCycle(),
          makeCycle({ id: CYCLE_2_ID, name: 'Extern audit ISO 14001' }),
        ]}
        correctiveActionFinding={null}
      />
    )
    const root = container.querySelector('[aria-label]')
    expect(root?.getAttribute('aria-label')).toBe(
      'Länkade kontroller: Q2 Internrevision, Extern audit ISO 14001'
    )
  })
})
