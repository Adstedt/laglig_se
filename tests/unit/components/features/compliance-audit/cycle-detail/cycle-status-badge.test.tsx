/**
 * Story 21.5 — CycleStatusBadge unit tests.
 * Story 22.1 — Updated to assert on tone-aware class strings from the
 *              shared `BADGE_TONES` map.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ComplianceCycleStatus } from '@prisma/client'
import { CycleStatusBadge } from '@/components/features/compliance-audit/cycle-detail/cycle-status-badge'
import { BADGE_TONES } from '@/lib/ui/badge-tones'

describe('CycleStatusBadge', () => {
  it.each([
    {
      status: ComplianceCycleStatus.PLANERAD,
      label: 'Planerad',
      tone: 'neutral' as const,
      variant: 'soft' as const,
    },
    {
      status: ComplianceCycleStatus.PAGAENDE,
      label: 'Pågående',
      tone: 'info' as const,
      variant: 'soft' as const,
    },
    {
      status: ComplianceCycleStatus.AVSLUTAD,
      label: 'Avslutad',
      tone: 'success' as const,
      variant: 'soft' as const,
    },
    // Story 21.27 — ARKIVERAD entry removed alongside the ARKIVERAD collapse.
  ])(
    'renders $label with tone $tone / variant $variant for $status',
    ({ status, label, tone, variant }) => {
      render(<CycleStatusBadge status={status} />)
      const badge = screen.getByText(label)
      expect(badge).toBeInTheDocument()
      // Assert each class token from the BADGE_TONES cell appears on the
      // rendered span — pinning the contract to the shared token map.
      const expected = BADGE_TONES[tone][variant].split(/\s+/)
      for (const cls of expected) {
        expect(badge.className).toContain(cls)
      }
      expect(badge.getAttribute('data-status')).toBe(status)
    }
  )
})
