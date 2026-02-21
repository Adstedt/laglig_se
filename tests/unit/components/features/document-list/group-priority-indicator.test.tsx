/**
 * Story 6.17: GroupPriorityIndicator Component Tests
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TooltipProvider } from '@/components/ui/tooltip'
import { GroupPriorityIndicator } from '@/components/features/document-list/group-priority-indicator'
import type { DocumentListItem } from '@/app/actions/document-list'
import type { ComplianceStatus, LawListItemPriority } from '@prisma/client'

// Wrapper with TooltipProvider for tests
function renderWithProvider(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

// Helper to create mock items with specific statuses and priorities
function createMockItems(
  configs: { status: ComplianceStatus; priority: LawListItemPriority }[]
): DocumentListItem[] {
  return configs.map((cfg, i) => ({
    id: `item-${i}`,
    complianceStatus: cfg.status,
    priority: cfg.priority,
  })) as DocumentListItem[]
}

describe('GroupPriorityIndicator', () => {
  it('shows badges for non-zero priority counts', () => {
    // 2 HIGH, 1 MEDIUM, 0 LOW -> shows "2 Hög", "1 Medel", no LOW badge
    const items = createMockItems([
      { status: 'UPPFYLLD', priority: 'HIGH' },
      { status: 'PAGAENDE', priority: 'HIGH' },
      { status: 'EJ_PABORJAD', priority: 'MEDIUM' },
    ])
    renderWithProvider(<GroupPriorityIndicator items={items} />)

    expect(screen.getByText('2 Hög')).toBeInTheDocument()
    expect(screen.getByText('1 Medel')).toBeInTheDocument()
    expect(screen.queryByText(/Låg/)).not.toBeInTheDocument()
  })

  it('excludes EJ_TILLAMPLIG items from priority counts', () => {
    // 1 HIGH applicable, 1 HIGH EJ_TILLAMPLIG, 1 MEDIUM applicable -> "1 Hög", "1 Medel"
    const items = createMockItems([
      { status: 'UPPFYLLD', priority: 'HIGH' },
      { status: 'EJ_TILLAMPLIG', priority: 'HIGH' },
      { status: 'PAGAENDE', priority: 'MEDIUM' },
    ])
    renderWithProvider(<GroupPriorityIndicator items={items} />)

    expect(screen.getByText('1 Hög')).toBeInTheDocument()
    expect(screen.getByText('1 Medel')).toBeInTheDocument()
  })

  it('shows "—" when all items are EJ_TILLAMPLIG', () => {
    const items = createMockItems([
      { status: 'EJ_TILLAMPLIG', priority: 'HIGH' },
      { status: 'EJ_TILLAMPLIG', priority: 'MEDIUM' },
      { status: 'EJ_TILLAMPLIG', priority: 'LOW' },
    ])
    renderWithProvider(<GroupPriorityIndicator items={items} />)

    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('uses correct color coding for each priority level', () => {
    const items = createMockItems([
      { status: 'UPPFYLLD', priority: 'HIGH' },
      { status: 'UPPFYLLD', priority: 'MEDIUM' },
      { status: 'UPPFYLLD', priority: 'LOW' },
    ])
    renderWithProvider(<GroupPriorityIndicator items={items} />)

    const highBadge = screen.getByText('1 Hög')
    expect(highBadge.className).toContain('bg-rose-100')
    expect(highBadge.className).toContain('text-rose-700')

    const mediumBadge = screen.getByText('1 Medel')
    expect(mediumBadge.className).toContain('bg-amber-100')
    expect(mediumBadge.className).toContain('text-amber-700')

    const lowBadge = screen.getByText('1 Låg')
    expect(lowBadge.className).toContain('bg-slate-100')
    expect(lowBadge.className).toContain('text-slate-600')
  })

  it('displays tooltip with full breakdown on hover', async () => {
    const user = userEvent.setup()
    const items = createMockItems([
      { status: 'UPPFYLLD', priority: 'HIGH' },
      { status: 'PAGAENDE', priority: 'MEDIUM' },
      { status: 'EJ_PABORJAD', priority: 'MEDIUM' },
      { status: 'EJ_UPPFYLLD', priority: 'LOW' },
      { status: 'EJ_TILLAMPLIG', priority: 'HIGH' },
    ])
    renderWithProvider(<GroupPriorityIndicator items={items} />)

    // Hover over a badge to trigger tooltip
    const badge = screen.getByText('1 Hög')
    await user.hover(badge)

    // Tooltip should show full breakdown (use findAll since Radix may duplicate)
    const tooltipHeaders = await screen.findAllByText(
      'Prioritetsnivåer (tillämpliga dokument)'
    )
    expect(tooltipHeaders.length).toBeGreaterThan(0)
  })

  it('handles empty items array', () => {
    renderWithProvider(<GroupPriorityIndicator items={[]} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('handles single item', () => {
    const items = createMockItems([{ status: 'UPPFYLLD', priority: 'LOW' }])
    renderWithProvider(<GroupPriorityIndicator items={items} />)

    expect(screen.getByText('1 Låg')).toBeInTheDocument()
    expect(screen.queryByText(/Hög/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Medel/)).not.toBeInTheDocument()
  })

  it('shows all three badges when all priorities present', () => {
    const items = createMockItems([
      { status: 'UPPFYLLD', priority: 'HIGH' },
      { status: 'UPPFYLLD', priority: 'HIGH' },
      { status: 'PAGAENDE', priority: 'MEDIUM' },
      { status: 'EJ_PABORJAD', priority: 'LOW' },
      { status: 'EJ_PABORJAD', priority: 'LOW' },
      { status: 'EJ_PABORJAD', priority: 'LOW' },
    ])
    renderWithProvider(<GroupPriorityIndicator items={items} />)

    expect(screen.getByText('2 Hög')).toBeInTheDocument()
    expect(screen.getByText('1 Medel')).toBeInTheDocument()
    expect(screen.getByText('3 Låg')).toBeInTheDocument()
  })

  it('only counts applicable items when mixed with EJ_TILLAMPLIG', () => {
    // 2 applicable (1 HIGH, 1 LOW) + 3 EJ_TILLAMPLIG -> only show "1 Hög", "1 Låg"
    const items = createMockItems([
      { status: 'UPPFYLLD', priority: 'HIGH' },
      { status: 'PAGAENDE', priority: 'LOW' },
      { status: 'EJ_TILLAMPLIG', priority: 'HIGH' },
      { status: 'EJ_TILLAMPLIG', priority: 'MEDIUM' },
      { status: 'EJ_TILLAMPLIG', priority: 'LOW' },
    ])
    renderWithProvider(<GroupPriorityIndicator items={items} />)

    expect(screen.getByText('1 Hög')).toBeInTheDocument()
    expect(screen.getByText('1 Låg')).toBeInTheDocument()
    expect(screen.queryByText(/Medel/)).not.toBeInTheDocument()
  })
})
