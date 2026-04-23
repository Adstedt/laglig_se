/**
 * Story 21.16 — FindingCard component tests.
 *
 * Structural assertions for the shared card used by both the items-modal
 * Findings section and the cross-item Findings tab. No Radix popover tests
 * (brittle in happy-dom per prior story debug logs).
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { FindingSeverity, FindingType } from '@prisma/client'
import {
  FindingCard,
  compareFindingsBySeverity,
} from '@/components/features/compliance-audit/finding-card'
import type { FindingRow } from '@/app/actions/compliance-finding'

function makeFinding(overrides: Partial<FindingRow> = {}): FindingRow {
  return {
    id: 'f1',
    cycleId: 'c1',
    type: FindingType.AVVIKELSE,
    severity: FindingSeverity.MAJOR,
    title: 'Saknad utbildningsplan',
    description: 'Lorem ipsum kemikaliehantering saknar riskbedömning.',
    rootCause: null,
    dueDate: null,
    closedAt: null,
    closedBy: null,
    lawListItemId: 'l1',
    lawListItem: {
      id: 'l1',
      title: 'Arbetsmiljölag',
      documentNumber: 'SFS 1977:1160',
    },
    requirementId: null,
    requirement: null,
    correctiveActionTaskId: null,
    correctiveActionTask: null,
    createdAt: new Date('2026-04-22T10:00:00Z'),
    updatedAt: new Date('2026-04-22T10:00:00Z'),
    ...overrides,
  }
}

describe('FindingCard', () => {
  afterEach(() => cleanup())

  it('renders type pill + MAJOR severity chip for AVVIKELSE-MAJOR', () => {
    render(<FindingCard finding={makeFinding()} />)
    expect(screen.getByText('Avvikelse')).toBeInTheDocument()
    expect(screen.getByText('Större')).toBeInTheDocument()
    expect(screen.getByText('Saknad utbildningsplan')).toBeInTheDocument()
  })

  it('renders type pill for OBSERVATION without severity chip', () => {
    render(
      <FindingCard
        finding={makeFinding({
          type: FindingType.OBSERVATION,
          severity: null,
        })}
      />
    )
    expect(screen.getByText('Observation')).toBeInTheDocument()
    expect(screen.queryByText('Större')).toBeNull()
    expect(screen.queryByText('Mindre')).toBeNull()
  })

  it('renders type pill for FORBATTRING', () => {
    render(
      <FindingCard
        finding={makeFinding({
          type: FindingType.FORBATTRING,
          severity: null,
        })}
      />
    )
    expect(screen.getByText('Förbättringsförslag')).toBeInTheDocument()
  })

  it('closed finding: strikethrough title + "Stängd" badge + stängd date', () => {
    render(
      <FindingCard
        finding={makeFinding({
          closedAt: new Date('2026-04-23T14:00:00Z'),
          closedBy: { id: 'u1', name: 'Alice' },
        })}
      />
    )
    const title = screen.getByText('Saknad utbildningsplan')
    expect(title.className).toContain('line-through')
    expect(screen.getByText('Stängd')).toBeInTheDocument()
    // Stängd metadata line includes "av Alice"
    expect(screen.getByText(/stängd.*av Alice/i)).toBeInTheDocument()
  })

  it('renders the Åtgärdsuppgift badge when correctiveActionTaskId is set', () => {
    render(
      <FindingCard finding={makeFinding({ correctiveActionTaskId: 't1' })} />
    )
    expect(screen.getByText('Åtgärdsuppgift')).toBeInTheDocument()
  })

  it('onClick fires when card body is clicked', () => {
    const onClick = vi.fn()
    render(<FindingCard finding={makeFinding()} onClick={onClick} />)
    const card = screen.getByTestId('finding-card-f1')
    fireEvent.click(card)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('actions slot: child clicks do NOT trigger card onClick (stopPropagation)', () => {
    const onCardClick = vi.fn()
    const onActionClick = vi.fn()
    render(
      <FindingCard
        finding={makeFinding()}
        onClick={onCardClick}
        actions={<button onClick={onActionClick}>Redigera</button>}
      />
    )
    const actionBtn = screen.getByText('Redigera')
    fireEvent.click(actionBtn)
    expect(onActionClick).toHaveBeenCalledTimes(1)
    expect(onCardClick).not.toHaveBeenCalled()
  })

  it('showLawContext renders SFS law title line', () => {
    render(<FindingCard finding={makeFinding()} showLawContext />)
    expect(
      screen.getByText(/Arbetsmiljölag \(SFS 1977:1160\)/)
    ).toBeInTheDocument()
  })

  it('hides law context when showLawContext=false (default)', () => {
    render(<FindingCard finding={makeFinding()} />)
    expect(screen.queryByText(/Arbetsmiljölag \(SFS 1977:1160\)/)).toBeNull()
  })

  it('focused=true adds ring highlight class', () => {
    render(<FindingCard finding={makeFinding()} focused />)
    const card = screen.getByTestId('finding-card-f1')
    expect(card.className).toContain('ring-2')
    expect(card.className).toContain('ring-primary')
  })

  it('non-interactive card (no onClick) has no button role', () => {
    render(<FindingCard finding={makeFinding()} />)
    const card = screen.getByTestId('finding-card-f1')
    expect(card.getAttribute('role')).not.toBe('button')
    expect(card.getAttribute('tabindex')).toBeNull()
  })

  it('interactive card (onClick set) has role=button + tabIndex=0', () => {
    render(<FindingCard finding={makeFinding()} onClick={() => {}} />)
    const card = screen.getByTestId('finding-card-f1')
    expect(card.getAttribute('role')).toBe('button')
    expect(card.getAttribute('tabindex')).toBe('0')
  })
})

describe('compareFindingsBySeverity', () => {
  it('orders: AVVIKELSE-MAJOR < AVVIKELSE-MINOR < OBSERVATION < FORBATTRING', () => {
    const major = makeFinding({
      id: 'major',
      type: FindingType.AVVIKELSE,
      severity: FindingSeverity.MAJOR,
    })
    const minor = makeFinding({
      id: 'minor',
      type: FindingType.AVVIKELSE,
      severity: FindingSeverity.MINOR,
    })
    const obs = makeFinding({
      id: 'obs',
      type: FindingType.OBSERVATION,
      severity: null,
    })
    const forb = makeFinding({
      id: 'forb',
      type: FindingType.FORBATTRING,
      severity: null,
    })
    const sorted = [forb, obs, minor, major].sort(compareFindingsBySeverity)
    expect(sorted.map((f) => f.id)).toEqual(['major', 'minor', 'obs', 'forb'])
  })

  it('within same rank, orders by createdAt desc', () => {
    const older = makeFinding({
      id: 'older',
      createdAt: new Date('2026-04-20'),
    })
    const newer = makeFinding({
      id: 'newer',
      createdAt: new Date('2026-04-22'),
    })
    const sorted = [older, newer].sort(compareFindingsBySeverity)
    expect(sorted.map((f) => f.id)).toEqual(['newer', 'older'])
  })
})
