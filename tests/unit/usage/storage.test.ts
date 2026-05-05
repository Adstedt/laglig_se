/**
 * Story 5.5b — unit tests for lib/usage/storage.ts pure helpers.
 *
 * Covers byte conversions and Swedish-locale formatting. Aggregate-query
 * behaviour is exercised in storage-enforcement.test.ts (integration).
 */

import { describe, it, expect } from 'vitest'
import {
  bytesToGB,
  formatBytesSwedish,
  gbToBytes,
  StorageQuotaExceededError,
} from '@/lib/usage/storage'

const BYTES_PER_GB = 1_073_741_824

describe('bytesToGB / gbToBytes', () => {
  it('1 GiB ↔ 1_073_741_824 bytes', () => {
    expect(gbToBytes(1)).toBe(BYTES_PER_GB)
    expect(bytesToGB(BYTES_PER_GB)).toBe(1)
  })

  it('5 GiB → 5,368,709,120 bytes', () => {
    expect(gbToBytes(5)).toBe(5 * BYTES_PER_GB)
  })

  it('round-trips through GB → bytes → GB', () => {
    expect(bytesToGB(gbToBytes(2.5))).toBeCloseTo(2.5)
  })
})

describe('formatBytesSwedish', () => {
  it('exactly 1 GiB → "1 GB"', () => {
    expect(formatBytesSwedish(BYTES_PER_GB)).toBe('1 GB')
  })

  it('uses Swedish comma decimal for non-integer GB', () => {
    // 1.5 GiB exact = 1610612736 bytes
    expect(formatBytesSwedish(1.5 * BYTES_PER_GB)).toBe('1,5 GB')
  })

  it('850 MiB → "850 MB" (no decimals on MB)', () => {
    expect(formatBytesSwedish(850 * 1024 * 1024)).toBe('850 MB')
  })

  it('rounds GB to 1 decimal max', () => {
    // 1.234 GiB
    expect(formatBytesSwedish(1.234 * BYTES_PER_GB)).toBe('1,2 GB')
  })

  it('values just under 1 GiB render in MB', () => {
    // 1023 MiB = below the GiB threshold
    expect(formatBytesSwedish(1023 * 1024 * 1024)).toBe('1 023 MB')
  })
})

describe('StorageQuotaExceededError', () => {
  it('carries currentBytes / incomingBytes / limitBytes / tier', () => {
    const err = new StorageQuotaExceededError(
      900_000_000,
      200_000_000,
      BYTES_PER_GB,
      'SOLO'
    )
    expect(err.currentBytes).toBe(900_000_000)
    expect(err.incomingBytes).toBe(200_000_000)
    expect(err.limitBytes).toBe(BYTES_PER_GB)
    expect(err.tier).toBe('SOLO')
    expect(err.name).toBe('StorageQuotaExceededError')
  })

  it('is an Error subclass (instanceof works for catch branches)', () => {
    const err = new StorageQuotaExceededError(0, 0, 0, 'SOLO')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(StorageQuotaExceededError)
  })
})
