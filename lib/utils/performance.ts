/**
 * Story 6.0: Performance Monitoring Utilities
 * Story P.3: Enhanced with server-side query monitoring
 * Custom performance marks for critical paths
 */

// ============================================================================
// Server-Side Query Performance Monitoring (Story P.3)
// ============================================================================

interface QueryMetric {
  name: string
  durationMs: number
  timestamp: Date
  success: boolean
  rowCount?: number
}

const queryMetrics: QueryMetric[] = []
const MAX_QUERY_METRICS = 1000

/**
 * Track a database query execution
 */
export function trackQuery(
  name: string,
  durationMs: number,
  success: boolean,
  rowCount?: number
): void {
  const metric: QueryMetric = {
    name,
    durationMs,
    timestamp: new Date(),
    success,
  }
  if (rowCount !== undefined) {
    metric.rowCount = rowCount
  }
  queryMetrics.push(metric)

  // Keep only last N metrics
  if (queryMetrics.length > MAX_QUERY_METRICS) {
    queryMetrics.shift()
  }

  // Log slow queries in development
  if (process.env.NODE_ENV === 'development' && durationMs > 100) {
    console.warn(`⚠️ Slow query "${name}": ${durationMs}ms`)
  }
}

/**
 * Wrap a database operation with timing
 */
export async function withQueryTiming<T>(
  name: string,
  operation: () => Promise<T>
): Promise<T> {
  const start = Date.now()
  try {
    const result = await operation()
    const duration = Date.now() - start
    const rowCount = Array.isArray(result) ? result.length : undefined
    trackQuery(name, duration, true, rowCount)
    return result
  } catch (error) {
    const duration = Date.now() - start
    trackQuery(name, duration, false)
    throw error
  }
}

/**
 * Get query performance statistics
 */
export function getQueryStats(): {
  totalQueries: number
  avgDurationMs: number
  slowQueries: number
  errorRate: number
  topSlowQueries: Array<{ name: string; avgMs: number; count: number }>
} {
  if (queryMetrics.length === 0) {
    return {
      totalQueries: 0,
      avgDurationMs: 0,
      slowQueries: 0,
      errorRate: 0,
      topSlowQueries: [],
    }
  }

  const total = queryMetrics.length
  const avgDuration =
    queryMetrics.reduce((sum, m) => sum + m.durationMs, 0) / total
  const slowCount = queryMetrics.filter((m) => m.durationMs > 500).length
  const errorCount = queryMetrics.filter((m) => !m.success).length

  // Aggregate by query name
  const byName = new Map<string, { total: number; count: number }>()
  queryMetrics.forEach((m) => {
    const existing = byName.get(m.name) || { total: 0, count: 0 }
    byName.set(m.name, {
      total: existing.total + m.durationMs,
      count: existing.count + 1,
    })
  })

  // Get top slow queries
  const topSlow = Array.from(byName.entries())
    .map(([name, { total, count }]) => ({
      name,
      avgMs: total / count,
      count,
    }))
    .sort((a, b) => b.avgMs - a.avgMs)
    .slice(0, 10)

  return {
    totalQueries: total,
    avgDurationMs: avgDuration,
    slowQueries: slowCount,
    errorRate: (errorCount / total) * 100,
    topSlowQueries: topSlow,
  }
}

/**
 * Reset query metrics (for testing)
 */
export function resetQueryMetrics(): void {
  queryMetrics.length = 0
}

// ============================================================================
// Client-Side Performance Marks (Story 6.0)
// ============================================================================

/**
 * Create a performance mark with optional metadata
 */
export function performanceMark(name: string, detail?: unknown) {
  if (typeof window !== 'undefined' && window.performance) {
    try {
      performance.mark(name, { detail })
    } catch {
      // Fallback for browsers that don't support detail
      performance.mark(name)
    }
  }
}

/**
 * Measure performance between two marks
 */
export function performanceMeasure(
  name: string,
  startMark: string,
  endMark: string
) {
  if (typeof window !== 'undefined' && window.performance) {
    try {
      performance.measure(name, startMark, endMark)

      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        const measure = performance.getEntriesByName(name, 'measure')[0]
        if (measure) {
          // eslint-disable-next-line no-console
          console.log(`⏱️ ${name}: ${measure.duration.toFixed(2)}ms`)
        }
      }

      // Send to analytics in production
      if (
        process.env.NODE_ENV === 'production' &&
        typeof window !== 'undefined'
      ) {
        const measure = performance.getEntriesByName(name, 'measure')[0]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (measure && (window as any).va) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(window as any).va('track', 'performance', {
            metric: name,
            value: Math.round(measure.duration),
          })
        }
      }
    } catch (error) {
      console.error('Performance measurement error:', error)
    }
  }
}

/**
 * Track workspace context loading time
 */
export function trackWorkspaceContext() {
  performanceMark('workspace-context-start')

  return () => {
    performanceMark('workspace-context-end')
    performanceMeasure(
      'workspace-context',
      'workspace-context-start',
      'workspace-context-end'
    )
  }
}

/**
 * Track dashboard data loading time
 */
export function trackDashboardLoad() {
  performanceMark('dashboard-load-start')

  return () => {
    performanceMark('dashboard-load-end')
    performanceMeasure(
      'dashboard-load',
      'dashboard-load-start',
      'dashboard-load-end'
    )
  }
}

/**
 * Track law list loading time
 */
export function trackLawListLoad() {
  performanceMark('law-list-load-start')

  return () => {
    performanceMark('law-list-load-end')
    performanceMeasure(
      'law-list-load',
      'law-list-load-start',
      'law-list-load-end'
    )
  }
}

/**
 * Track navigation time between pages
 */
export function trackNavigation(fromPath: string, toPath: string) {
  const markName = `nav-${fromPath}-${toPath}`.replace(/\//g, '_')
  performanceMark(`${markName}-start`)

  return () => {
    performanceMark(`${markName}-end`)
    performanceMeasure(markName, `${markName}-start`, `${markName}-end`)
  }
}

/**
 * Get Web Vitals for monitoring
 */
export function getWebVitals() {
  if (typeof window === 'undefined') return null

  const navigation = performance.getEntriesByType(
    'navigation'
  )[0] as PerformanceNavigationTiming

  if (!navigation) return null

  return {
    // Time to First Byte
    ttfb: navigation.responseStart - navigation.requestStart,
    // DOM Content Loaded
    dcl:
      navigation.domContentLoadedEventEnd -
      navigation.domContentLoadedEventStart,
    // Load Complete
    load: navigation.loadEventEnd - navigation.loadEventStart,
    // DOM Interactive
    domInteractive: navigation.domInteractive - navigation.fetchStart,
  }
}

/**
 * Report performance metrics to Vercel Analytics
 */
export function reportToAnalytics(metric: string, value: number) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof window !== 'undefined' && (window as any).va) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).va('track', metric, { value })
  }
}
