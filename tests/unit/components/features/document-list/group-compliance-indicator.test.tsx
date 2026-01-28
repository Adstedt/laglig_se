/**
 * Story 6.17: GroupComplianceIndicator Component Tests
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TooltipProvider } from '@/components/ui/tooltip'
import { GroupComplianceIndicator } from '@/components/features/document-list/group-compliance-indicator'
import type { DocumentListItem } from '@/app/actions/document-list'
import type { ComplianceStatus } from '@prisma/client'

// Wrapper with TooltipProvider for tests
function renderWithProvider(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

// Helper to create mock items with specific compliance statuses
function createMockItems(
  statuses: ComplianceStatus[]
): Pick<DocumentListItem, 'id' | 'complianceStatus' | 'priority'>[] {
  return statuses.map((status, i) => ({
    id: `item-${i}`,
    complianceStatus: status,
    priority: 'MEDIUM' as const,
  }))
}

// Cast to full DocumentListItem for component
function asDocumentListItems(
  items: Pick<DocumentListItem, 'id' | 'complianceStatus' | 'priority'>[]
): DocumentListItem[] {
  return items as DocumentListItem[]
}

describe('GroupComplianceIndicator', () => {
  it('shows correct fraction when some items are compliant', () => {
    // 3 items: 1 UPPFYLLD, 1 PAGAENDE, 1 EJ_PABORJAD -> "1/3"
    const items = createMockItems(['UPPFYLLD', 'PAGAENDE', 'EJ_PABORJAD'])
    renderWithProvider(
      <GroupComplianceIndicator items={asDocumentListItems(items)} />
    )

    expect(screen.getByText('1/3')).toBeInTheDocument()
  })

  it('excludes EJ_TILLAMPLIG items from calculation', () => {
    // 4 items: 1 UPPFYLLD, 1 PAGAENDE, 2 EJ_TILLAMPLIG -> "1/2"
    const items = createMockItems([
      'UPPFYLLD',
      'PAGAENDE',
      'EJ_TILLAMPLIG',
      'EJ_TILLAMPLIG',
    ])
    renderWithProvider(
      <GroupComplianceIndicator items={asDocumentListItems(items)} />
    )

    expect(screen.getByText('1/2')).toBeInTheDocument()
  })

  it('shows "—" when all items are EJ_TILLAMPLIG', () => {
    // 3 items: all EJ_TILLAMPLIG -> "—"
    const items = createMockItems([
      'EJ_TILLAMPLIG',
      'EJ_TILLAMPLIG',
      'EJ_TILLAMPLIG',
    ])
    renderWithProvider(
      <GroupComplianceIndicator items={asDocumentListItems(items)} />
    )

    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('shows green progress bar at 100%', () => {
    // All applicable items are UPPFYLLD
    const items = createMockItems(['UPPFYLLD', 'UPPFYLLD', 'UPPFYLLD'])
    renderWithProvider(
      <GroupComplianceIndicator items={asDocumentListItems(items)} />
    )

    expect(screen.getByText('3/3')).toBeInTheDocument()
    // Progress bar should have green color
    const progressBar = document.querySelector('.bg-green-500')
    expect(progressBar).toBeInTheDocument()
  })

  it('shows blue progress bar at 50-99%', () => {
    // 2 of 3 applicable items are UPPFYLLD (67%)
    const items = createMockItems(['UPPFYLLD', 'UPPFYLLD', 'PAGAENDE'])
    renderWithProvider(
      <GroupComplianceIndicator items={asDocumentListItems(items)} />
    )

    expect(screen.getByText('2/3')).toBeInTheDocument()
    const progressBar = document.querySelector('.bg-blue-500')
    expect(progressBar).toBeInTheDocument()
  })

  it('shows amber progress bar at 1-49%', () => {
    // 1 of 3 applicable items is UPPFYLLD (33%)
    const items = createMockItems(['UPPFYLLD', 'PAGAENDE', 'EJ_PABORJAD'])
    renderWithProvider(
      <GroupComplianceIndicator items={asDocumentListItems(items)} />
    )

    expect(screen.getByText('1/3')).toBeInTheDocument()
    const progressBar = document.querySelector('.bg-amber-500')
    expect(progressBar).toBeInTheDocument()
  })

  it('shows red progress bar at 0%', () => {
    // 0 of 3 applicable items are UPPFYLLD
    const items = createMockItems(['PAGAENDE', 'EJ_UPPFYLLD', 'EJ_PABORJAD'])
    renderWithProvider(
      <GroupComplianceIndicator items={asDocumentListItems(items)} />
    )

    expect(screen.getByText('0/3')).toBeInTheDocument()
    const progressBar = document.querySelector('.bg-red-500')
    expect(progressBar).toBeInTheDocument()
  })

  it('displays tooltip with full breakdown on hover', async () => {
    const user = userEvent.setup()
    const items = createMockItems([
      'UPPFYLLD',
      'UPPFYLLD',
      'PAGAENDE',
      'EJ_UPPFYLLD',
      'EJ_PABORJAD',
      'EJ_TILLAMPLIG',
      'EJ_TILLAMPLIG',
    ])
    renderWithProvider(
      <GroupComplianceIndicator items={asDocumentListItems(items)} />
    )

    // Hover over the indicator
    const indicator = screen.getByText('2/5')
    await user.hover(indicator)

    // Tooltip should show breakdown (use getAllByText since Radix duplicates for accessibility)
    const tooltipHeaders = await screen.findAllByText('Efterlevnadsstatus')
    expect(tooltipHeaders.length).toBeGreaterThan(0)
  })

  it('handles empty items array', () => {
    renderWithProvider(<GroupComplianceIndicator items={[]} />)
    // Should show "—" since there are no applicable items
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('handles single item', () => {
    const items = createMockItems(['UPPFYLLD'])
    renderWithProvider(
      <GroupComplianceIndicator items={asDocumentListItems(items)} />
    )

    expect(screen.getByText('1/1')).toBeInTheDocument()
    // Should be green at 100%
    const progressBar = document.querySelector('.bg-green-500')
    expect(progressBar).toBeInTheDocument()
  })

  it('shows exactly 50% with blue color', () => {
    // Exactly 50%: 1 of 2 UPPFYLLD
    const items = createMockItems(['UPPFYLLD', 'PAGAENDE'])
    renderWithProvider(
      <GroupComplianceIndicator items={asDocumentListItems(items)} />
    )

    expect(screen.getByText('1/2')).toBeInTheDocument()
    const progressBar = document.querySelector('.bg-blue-500')
    expect(progressBar).toBeInTheDocument()
  })

  it('progress bar is hidden on mobile', () => {
    const items = createMockItems(['UPPFYLLD', 'PAGAENDE'])
    renderWithProvider(
      <GroupComplianceIndicator items={asDocumentListItems(items)} />
    )

    // Progress bar container should have 'hidden sm:block' class
    const progressBarContainer = document.querySelector('.hidden.sm\\:block')
    expect(progressBarContainer).toBeInTheDocument()
  })
})
