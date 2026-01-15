/**
 * Story P.3: Connection Retry Logic with Exponential Backoff
 *
 * Enhanced connection management for Supabase Supavisor pooling.
 * Provides retry logic, monitoring, and graceful degradation.
 */

// ============================================================================
// Configuration
// ============================================================================

export interface RetryConfig {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  jitterMs: number
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 2000,
  backoffMultiplier: 2,
  jitterMs: 50,
}

// ============================================================================
// Metrics
// ============================================================================

interface ConnectionMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  retriedRequests: number
  totalRetries: number
  avgResponseTimeMs: number
  lastError: string | null
  lastErrorAt: Date | null
}

const metrics: ConnectionMetrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  retriedRequests: 0,
  totalRetries: 0,
  avgResponseTimeMs: 0,
  lastError: null,
  lastErrorAt: null,
}

let responseTimes: number[] = []
const MAX_RESPONSE_TIMES = 100 // Keep last 100 for rolling average

/**
 * Get current connection metrics
 */
export function getConnectionMetrics(): ConnectionMetrics {
  return { ...metrics }
}

/**
 * Reset connection metrics (for testing)
 */
export function resetConnectionMetrics(): void {
  metrics.totalRequests = 0
  metrics.successfulRequests = 0
  metrics.failedRequests = 0
  metrics.retriedRequests = 0
  metrics.totalRetries = 0
  metrics.avgResponseTimeMs = 0
  metrics.lastError = null
  metrics.lastErrorAt = null
  responseTimes = []
}

// ============================================================================
// Error Detection
// ============================================================================

/**
 * Prisma error codes that indicate connection pool issues
 */
const RETRYABLE_ERROR_CODES = [
  'P2024', // Connection pool timeout
  'P2025', // Record not found (can happen during race conditions)
  'P1001', // Can't reach database server
  'P1002', // Database server timed out
  'P1008', // Operations timed out
  'P1017', // Server has closed the connection
]

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false

  // Check Prisma error codes
  if ('code' in error) {
    const code = (error as { code: string }).code
    return RETRYABLE_ERROR_CODES.includes(code)
  }

  // Check for common connection error messages
  const message = error.message.toLowerCase()
  return (
    message.includes('connection') ||
    message.includes('timeout') ||
    message.includes('pool') ||
    message.includes('econnrefused') ||
    message.includes('enotfound')
  )
}

// ============================================================================
// Retry Logic
// ============================================================================

/**
 * Calculate delay for retry attempt with exponential backoff and jitter
 */
export function calculateRetryDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const exponentialDelay =
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt)
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs)
  const jitter = Math.random() * config.jitterMs
  return cappedDelay + jitter
}

/**
 * Execute an operation with retry logic
 *
 * @param operation - Async function to execute
 * @param config - Retry configuration
 * @returns Result of the operation
 * @throws Last error if all retries fail
 */
export async function withConnectionRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  const startTime = Date.now()
  let lastError: Error | undefined

  metrics.totalRequests++

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const result = await operation()

      // Track success metrics
      const duration = Date.now() - startTime
      trackResponseTime(duration)
      metrics.successfulRequests++

      if (attempt > 0) {
        metrics.retriedRequests++
        metrics.totalRetries += attempt
      }

      return result
    } catch (error) {
      lastError = error as Error

      // Check if error is retryable
      if (!isRetryableError(error) || attempt === config.maxRetries) {
        // Non-retryable or max retries reached
        metrics.failedRequests++
        metrics.lastError = lastError.message
        metrics.lastErrorAt = new Date()

        if (attempt > 0) {
          metrics.retriedRequests++
          metrics.totalRetries += attempt
        }

        throw error
      }

      // Calculate and wait for retry delay
      const delay = calculateRetryDelay(attempt, config)

      // Log retry attempt
      console.warn(
        `[Connection] Retry ${attempt + 1}/${config.maxRetries} after ${Math.round(delay)}ms - ${lastError.message}`
      )

      await sleep(delay)
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError
}

// ============================================================================
// Helpers
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function trackResponseTime(durationMs: number): void {
  responseTimes.push(durationMs)

  // Keep only last N response times
  if (responseTimes.length > MAX_RESPONSE_TIMES) {
    responseTimes.shift()
  }

  // Calculate rolling average
  metrics.avgResponseTimeMs =
    responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
}

// ============================================================================
// Health Check
// ============================================================================

export interface ConnectionHealth {
  status: 'healthy' | 'degraded' | 'unhealthy'
  successRate: number
  avgResponseTimeMs: number
  recentErrors: number
  message: string
}

/**
 * Get connection health status
 */
export function getConnectionHealth(): ConnectionHealth {
  const total = metrics.totalRequests
  const successful = metrics.successfulRequests

  if (total === 0) {
    return {
      status: 'healthy',
      successRate: 100,
      avgResponseTimeMs: 0,
      recentErrors: 0,
      message: 'No requests yet',
    }
  }

  const successRate = (successful / total) * 100
  const recentErrors = metrics.failedRequests

  let status: ConnectionHealth['status']
  let message: string

  if (successRate >= 99 && metrics.avgResponseTimeMs < 100) {
    status = 'healthy'
    message = 'Connection pool operating normally'
  } else if (successRate >= 95 && metrics.avgResponseTimeMs < 500) {
    status = 'degraded'
    message = 'Some connection issues detected'
  } else {
    status = 'unhealthy'
    message = `High error rate (${successRate.toFixed(1)}%) or slow responses (${metrics.avgResponseTimeMs.toFixed(0)}ms)`
  }

  return {
    status,
    successRate,
    avgResponseTimeMs: metrics.avgResponseTimeMs,
    recentErrors,
    message,
  }
}
