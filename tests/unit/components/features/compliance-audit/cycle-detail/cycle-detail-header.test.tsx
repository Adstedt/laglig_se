/**
 * Story 21.9 — SealedCycleBanner component tests (AC 9, 14).
 * Focused on the NEW sealed-banner sub-component; the rest of the header
 * is covered indirectly by the cycle-detail-page integration tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { SealedCycleBanner } from '@/components/features/compliance-audit/cycle-detail/cycle-detail-header'
import type { CycleDetail } from '@/app/actions/compliance-audit-cycle'
import { AuditType, ComplianceCycleStatus } from '@prisma/client'
import { toast } from 'sonner'

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

function makeSealedCycle(overrides: Partial<CycleDetail> = {}): CycleDetail {
  return {
    id: 'cycle-1',
    name: 'Q1 revision',
    status: ComplianceCycleStatus.SEALED,
    auditType: AuditType.INTERN,
    scheduledStart: new Date('2026-01-01'),
    scheduledEnd: new Date('2026-03-31'),
    lawChangeCutoffDate: new Date('2026-01-01'),
    leadAuditor: { id: 'u1', name: 'Alice Auditor' },
    lawList: { id: 'l1', name: 'Huvudlista' },
    itemCount: 3,
    createdAt: new Date('2026-01-10T09:00:00Z'),
    updatedAt: new Date('2026-04-24T14:30:00Z'),
    lawListId: 'l1',
    scopeDefinition: { kind: 'all' },
    sealHash:
      'abc123def4560000111122223333444455556666777788889999aaaabbbbcccc',
    sealedAt: new Date('2026-04-24T14:30:00Z'),
    sealedBy: { id: 'u1', name: 'Alice Auditor' },
    createdBy: { id: 'u0', name: 'Creator' },
    deletedAt: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Provide a mock clipboard each test — happy-dom doesn't expose it by default.
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    configurable: true,
  })
})

afterEach(() => {
  cleanup()
})

describe('SealedCycleBanner', () => {
  it('renders with truncated hash (first 8 + "…" + last 4 chars)', () => {
    render(<SealedCycleBanner cycle={makeSealedCycle()} />)
    const code = screen.getByTestId('seal-hash-truncated')
    expect(code.textContent).toBe('abc123de…cccc')
  })

  it('renders the "Fastställd av X den Y" subline with Swedish-locale date', () => {
    render(<SealedCycleBanner cycle={makeSealedCycle()} />)
    expect(
      screen.getByText(/Fastställd av Alice Auditor den 24 apr\. 2026/)
    ).toBeInTheDocument()
  })

  it('renders "okänd användare" subline when sealedBy is null', () => {
    render(
      <SealedCycleBanner
        cycle={makeSealedCycle({ sealedBy: { id: 'u1', name: null } })}
      />
    )
    expect(
      screen.getByText(/Fastställd av okänd användare/)
    ).toBeInTheDocument()
  })

  it('copy button writes the FULL hash to clipboard + fires success toast', async () => {
    const writeText = navigator.clipboard.writeText as ReturnType<typeof vi.fn>
    const cycle = makeSealedCycle()
    render(<SealedCycleBanner cycle={cycle} />)
    const copy = screen.getByRole('button', { name: 'Kopiera kontrollsumma' })
    fireEvent.click(copy)
    // Wait a tick for the promise to resolve
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(writeText).toHaveBeenCalledWith(cycle.sealHash)
    expect(toast.success).toHaveBeenCalledWith('Kontrollsumma kopierad')
  })

  it('falls back to error toast when clipboard write throws', async () => {
    ;(
      navigator.clipboard.writeText as ReturnType<typeof vi.fn>
    ).mockRejectedValueOnce(new Error('denied'))
    render(<SealedCycleBanner cycle={makeSealedCycle()} />)
    fireEvent.click(
      screen.getByRole('button', { name: 'Kopiera kontrollsumma' })
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(toast.error).toHaveBeenCalledWith(
      'Kunde inte kopiera — försök välja texten manuellt.'
    )
  })

  it('hides the copy button when sealHash is null (defensive)', () => {
    render(<SealedCycleBanner cycle={makeSealedCycle({ sealHash: null })} />)
    expect(
      screen.queryByRole('button', { name: 'Kopiera kontrollsumma' })
    ).toBeNull()
    expect(screen.getByTestId('seal-hash-truncated').textContent).toBe(
      'okänd hash'
    )
  })
})
