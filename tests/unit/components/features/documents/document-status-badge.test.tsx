import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  DocumentStatusBadge,
  STATUS_CONFIG,
} from '@/components/features/documents/document-status-badge'

describe('DocumentStatusBadge', () => {
  it('renders correct label for DRAFT', () => {
    render(<DocumentStatusBadge status="DRAFT" />)
    expect(screen.getByText('Utkast')).toBeInTheDocument()
  })

  it('renders correct label for IN_REVIEW', () => {
    render(<DocumentStatusBadge status="IN_REVIEW" />)
    expect(screen.getByText('Under granskning')).toBeInTheDocument()
  })

  it('renders correct label for APPROVED', () => {
    render(<DocumentStatusBadge status="APPROVED" />)
    expect(screen.getByText('Godkänd')).toBeInTheDocument()
  })

  it('renders correct label for SUPERSEDED', () => {
    render(<DocumentStatusBadge status="SUPERSEDED" />)
    expect(screen.getByText('Ersatt')).toBeInTheDocument()
  })

  it('renders correct label for ARCHIVED', () => {
    render(<DocumentStatusBadge status="ARCHIVED" />)
    expect(screen.getByText('Arkiverad')).toBeInTheDocument()
  })

  it('applies green className for APPROVED', () => {
    const { container } = render(<DocumentStatusBadge status="APPROVED" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('bg-green-100')
  })

  it('applies orange className for SUPERSEDED', () => {
    const { container } = render(<DocumentStatusBadge status="SUPERSEDED" />)
    const badge = container.firstChild as HTMLElement
    expect(badge.className).toContain('bg-orange-100')
  })

  it('falls back gracefully for unknown status', () => {
    render(<DocumentStatusBadge status="UNKNOWN" />)
    expect(screen.getByText('UNKNOWN')).toBeInTheDocument()
  })

  it('STATUS_CONFIG has entries for all 5 statuses', () => {
    const statuses = [
      'DRAFT',
      'IN_REVIEW',
      'APPROVED',
      'SUPERSEDED',
      'ARCHIVED',
    ]
    for (const s of statuses) {
      expect(STATUS_CONFIG).toHaveProperty(s)
    }
  })
})
