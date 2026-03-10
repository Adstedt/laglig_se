import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    amendmentDocument: { findFirst: vi.fn() },
    legalDocument: { findUnique: vi.fn() },
  },
}))

import {
  getEffectiveDateBadge,
  resolveEffectiveDate,
} from '@/lib/utils/effective-date'
import { prisma } from '@/lib/prisma'

describe('getEffectiveDateBadge', () => {
  it('returns gray variant for null date', () => {
    const badge = getEffectiveDateBadge(null)
    expect(badge.variant).toBe('gray')
    expect(badge.text).toContain('okänt')
  })

  it('returns amber variant for future date', () => {
    const future = new Date()
    future.setDate(future.getDate() + 30)
    const badge = getEffectiveDateBadge(future)
    expect(badge.variant).toBe('amber')
    expect(badge.text).toContain('Träder i kraft om')
    expect(badge.text).toContain('dagar')
  })

  it('returns red variant for today', () => {
    const badge = getEffectiveDateBadge(new Date())
    expect(badge.variant).toBe('red')
    expect(badge.text).toBe('Träder i kraft idag')
  })

  it('returns green variant for past date', () => {
    const past = new Date()
    past.setDate(past.getDate() - 10)
    const badge = getEffectiveDateBadge(past)
    expect(badge.variant).toBe('green')
    expect(badge.text).toBe('Trädde i kraft')
  })

  it('returns 1 day for tomorrow', () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const badge = getEffectiveDateBadge(tomorrow)
    expect(badge.variant).toBe('amber')
    expect(badge.text).toContain('1 dagar')
  })
})

describe('resolveEffectiveDate', () => {
  const mockAmendmentFindFirst = vi.mocked(prisma.amendmentDocument.findFirst)
  const mockDocFindUnique = vi.mocked(prisma.legalDocument.findUnique)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves from AmendmentDocument when amendment_sfs is set', async () => {
    const date = new Date('2026-07-01')
    mockAmendmentFindFirst.mockResolvedValue({ effective_date: date } as never)

    const result = await resolveEffectiveDate({
      amendment_sfs: 'SFS 2026:100',
      document_id: 'doc-1',
    })

    expect(result).toEqual(date)
    expect(mockAmendmentFindFirst).toHaveBeenCalledWith({
      where: { sfs_number: '2026:100' },
      select: { effective_date: true },
    })
  })

  it('falls back to LegalDocument when amendment has no effective_date', async () => {
    const date = new Date('2025-01-01')
    mockAmendmentFindFirst.mockResolvedValue({ effective_date: null } as never)
    mockDocFindUnique.mockResolvedValue({ effective_date: date } as never)

    const result = await resolveEffectiveDate({
      amendment_sfs: 'SFS 2025:50',
      document_id: 'doc-1',
    })

    expect(result).toEqual(date)
  })

  it('returns null when no dates found', async () => {
    mockAmendmentFindFirst.mockResolvedValue(null)
    mockDocFindUnique.mockResolvedValue({ effective_date: null } as never)

    const result = await resolveEffectiveDate({
      amendment_sfs: 'SFS 2025:999',
      document_id: 'doc-1',
    })

    expect(result).toBeNull()
  })

  it('skips amendment lookup when amendment_sfs is null', async () => {
    const date = new Date('2025-06-01')
    mockDocFindUnique.mockResolvedValue({ effective_date: date } as never)

    const result = await resolveEffectiveDate({
      amendment_sfs: null,
      document_id: 'doc-1',
    })

    expect(result).toEqual(date)
    expect(mockAmendmentFindFirst).not.toHaveBeenCalled()
  })
})
