/**
 * Story P.3: Connection Retry Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  withConnectionRetry,
  calculateRetryDelay,
  isRetryableError,
  getConnectionMetrics,
  resetConnectionMetrics,
  getConnectionHealth,
  DEFAULT_RETRY_CONFIG,
} from '@/lib/db/connection-retry'

describe('Connection Retry Logic', () => {
  beforeEach(() => {
    resetConnectionMetrics()
  })

  describe('calculateRetryDelay', () => {
    it('should calculate exponential backoff delay', () => {
      const config = { ...DEFAULT_RETRY_CONFIG, jitterMs: 0 }

      expect(calculateRetryDelay(0, config)).toBe(100) // 100 * 2^0
      expect(calculateRetryDelay(1, config)).toBe(200) // 100 * 2^1
      expect(calculateRetryDelay(2, config)).toBe(400) // 100 * 2^2
    })

    it('should cap delay at maxDelayMs', () => {
      const config = { ...DEFAULT_RETRY_CONFIG, jitterMs: 0, maxDelayMs: 500 }

      expect(calculateRetryDelay(10, config)).toBe(500)
    })

    it('should add jitter to delay', () => {
      const config = { ...DEFAULT_RETRY_CONFIG, jitterMs: 50 }
      const delay = calculateRetryDelay(0, config)

      expect(delay).toBeGreaterThanOrEqual(100)
      expect(delay).toBeLessThanOrEqual(150)
    })
  })

  describe('isRetryableError', () => {
    it('should return true for Prisma pool timeout error (P2024)', () => {
      const error = new Error('Pool timeout')
      ;(error as unknown as { code: string }).code = 'P2024'

      expect(isRetryableError(error)).toBe(true)
    })

    it('should return true for connection errors', () => {
      expect(isRetryableError(new Error('connection refused'))).toBe(true)
      expect(isRetryableError(new Error('Connection timeout'))).toBe(true)
      expect(isRetryableError(new Error('Pool exhausted'))).toBe(true)
    })

    it('should return false for non-retryable errors', () => {
      expect(isRetryableError(new Error('Record not found'))).toBe(false)
      expect(isRetryableError(new Error('Validation failed'))).toBe(false)
      expect(isRetryableError('not an error')).toBe(false)
    })
  })

  describe('withConnectionRetry', () => {
    it('should succeed on first try', async () => {
      const operation = vi.fn().mockResolvedValue('success')

      const result = await withConnectionRetry(operation)

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should retry on retryable error and succeed', async () => {
      const poolError = new Error('Pool timeout')
      ;(poolError as unknown as { code: string }).code = 'P2024'

      const operation = vi
        .fn()
        .mockRejectedValueOnce(poolError)
        .mockResolvedValue('success')

      const config = { ...DEFAULT_RETRY_CONFIG, initialDelayMs: 10 }
      const result = await withConnectionRetry(operation, config)

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('should throw after max retries', async () => {
      const poolError = new Error('Pool timeout')
      ;(poolError as unknown as { code: string }).code = 'P2024'

      const operation = vi.fn().mockRejectedValue(poolError)

      const config = {
        ...DEFAULT_RETRY_CONFIG,
        maxRetries: 2,
        initialDelayMs: 10,
      }

      await expect(withConnectionRetry(operation, config)).rejects.toThrow(
        'Pool timeout'
      )
      expect(operation).toHaveBeenCalledTimes(3) // 1 initial + 2 retries
    })

    it('should not retry non-retryable errors', async () => {
      const error = new Error('Validation failed')
      const operation = vi.fn().mockRejectedValue(error)

      await expect(withConnectionRetry(operation)).rejects.toThrow(
        'Validation failed'
      )
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should track metrics', async () => {
      const operation = vi.fn().mockResolvedValue('success')

      await withConnectionRetry(operation)

      const metrics = getConnectionMetrics()
      expect(metrics.totalRequests).toBe(1)
      expect(metrics.successfulRequests).toBe(1)
      expect(metrics.failedRequests).toBe(0)
    })
  })

  describe('getConnectionHealth', () => {
    it('should return healthy status when no requests', () => {
      const health = getConnectionHealth()

      expect(health.status).toBe('healthy')
      expect(health.successRate).toBe(100)
    })

    it('should return healthy status after successful requests', async () => {
      const operation = vi.fn().mockResolvedValue('success')

      await withConnectionRetry(operation)
      await withConnectionRetry(operation)

      const health = getConnectionHealth()
      expect(health.status).toBe('healthy')
      expect(health.successRate).toBe(100)
    })
  })
})
