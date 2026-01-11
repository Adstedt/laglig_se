/**
 * Story 6.0: Performance Monitoring Utilities
 * Custom performance marks for critical paths
 */

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
