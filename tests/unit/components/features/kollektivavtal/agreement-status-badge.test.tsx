/**
 * Story 7.5: CollectiveAgreementStatus badge — the canonical status surface.
 * Badge tone system (Väntar/Bearbetas/Klart/Misslyckades), never legacy variants.
 */
import { describe, test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AgreementStatusBadge } from '@/components/features/kollektivavtal/agreement-status-badge'
import type { CollectiveAgreementStatus } from '@prisma/client'

describe('AgreementStatusBadge', () => {
  test.each([
    ['PENDING', 'Väntar'],
    ['PROCESSING', 'Bearbetas'],
    ['READY', 'Klart'],
    ['FAILED', 'Misslyckades'],
  ] as [CollectiveAgreementStatus, string][])(
    '%s renders the Swedish label "%s"',
    (status, label) => {
      render(<AgreementStatusBadge status={status} />)
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  )

  test('tone mapping: PENDING neutral, PROCESSING info, READY success, FAILED danger', () => {
    const { rerender } = render(<AgreementStatusBadge status="PENDING" />)
    expect(screen.getByText('Väntar').className).toContain('bg-slate-100')

    rerender(<AgreementStatusBadge status="PROCESSING" />)
    expect(screen.getByText('Bearbetas').className).toContain('bg-blue-100')

    rerender(<AgreementStatusBadge status="READY" />)
    expect(screen.getByText('Klart').className).toContain('bg-emerald-100')

    rerender(<AgreementStatusBadge status="FAILED" />)
    expect(screen.getByText('Misslyckades').className).toContain('bg-rose-100')
  })
})
