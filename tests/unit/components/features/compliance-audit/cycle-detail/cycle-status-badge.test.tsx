/** Story 21.5 — CycleStatusBadge unit tests. */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ComplianceCycleStatus } from '@prisma/client'
import { CycleStatusBadge } from '@/components/features/compliance-audit/cycle-detail/cycle-status-badge'

describe('CycleStatusBadge', () => {
  it.each([
    {
      status: ComplianceCycleStatus.PLANERAD,
      label: 'Planerad',
      colorClass: 'bg-gray-100',
    },
    {
      status: ComplianceCycleStatus.PAGAENDE,
      label: 'Pågående',
      colorClass: 'bg-blue-100',
    },
    {
      status: ComplianceCycleStatus.AVSLUTAD,
      label: 'Avslutad',
      colorClass: 'bg-amber-100',
    },
    // Story 21.27 — ARKIVERAD entry removed alongside the ARKIVERAD collapse.
  ])(
    'renders $label with $colorClass for $status',
    ({ status, label, colorClass }) => {
      render(<CycleStatusBadge status={status} />)
      const badge = screen.getByText(label)
      expect(badge).toBeInTheDocument()
      expect(badge.className).toContain(colorClass)
      expect(badge.getAttribute('data-status')).toBe(status)
    }
  )
})
