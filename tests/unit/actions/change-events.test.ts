/**
 * Story 8.1 Task 2: ChangeEvent server action logic tests
 */

import { describe, it, expect } from 'vitest'
import { derivePriority } from '@/lib/changes/change-utils'

describe('derivePriority (Story 8.1)', () => {
  it('returns HIGH for REPEAL', () => {
    expect(derivePriority('REPEAL')).toBe('HIGH')
  })

  it('returns MEDIUM for AMENDMENT', () => {
    expect(derivePriority('AMENDMENT')).toBe('MEDIUM')
  })

  it('returns MEDIUM for NEW_LAW', () => {
    expect(derivePriority('NEW_LAW')).toBe('MEDIUM')
  })

  it('returns MEDIUM for NEW_RULING', () => {
    expect(derivePriority('NEW_RULING')).toBe('MEDIUM')
  })

  it('returns LOW for METADATA_UPDATE', () => {
    expect(derivePriority('METADATA_UPDATE')).toBe('LOW')
  })

  it('has exactly one HIGH priority change type (REPEAL)', () => {
    const allTypes = [
      'AMENDMENT',
      'REPEAL',
      'NEW_LAW',
      'METADATA_UPDATE',
      'NEW_RULING',
    ] as const
    const highPriority = allTypes.filter((t) => derivePriority(t) === 'HIGH')
    expect(highPriority).toEqual(['REPEAL'])
  })

  it('has exactly one LOW priority change type (METADATA_UPDATE)', () => {
    const allTypes = [
      'AMENDMENT',
      'REPEAL',
      'NEW_LAW',
      'METADATA_UPDATE',
      'NEW_RULING',
    ] as const
    const lowPriority = allTypes.filter((t) => derivePriority(t) === 'LOW')
    expect(lowPriority).toEqual(['METADATA_UPDATE'])
  })
})
