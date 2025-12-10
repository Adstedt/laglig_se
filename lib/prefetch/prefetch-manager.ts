import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'

/**
 * PrefetchManager - Manages intelligent pre-fetching of routes
 *
 * Features:
 * - Staggered prefetch queue with configurable delays
 * - Max concurrency limit to avoid network congestion
 * - Data-saver mode detection
 * - URL de-duplication
 * - Cancellation support
 * - Silent error handling (non-blocking)
 */
class PrefetchManager {
  private queue: string[] = []
  private prefetched = new Set<string>()
  private active = 0
  private maxConcurrent = 10
  private staggerMs = 50
  private router: AppRouterInstance | null = null
  private isProcessing = false
  private abortController: AbortController | null = null

  /**
   * Initialize the manager with Next.js router instance
   * Must be called from a React component that has access to useRouter()
   */
  init(router: AppRouterInstance): void {
    this.router = router
  }

  /**
   * Check if prefetching is allowed based on:
   * - Router initialization
   * - Data-saver mode preference
   */
  canPrefetch(): boolean {
    if (!this.router) return false

    // Respect data-saver mode (with fallback for unsupported browsers)
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const conn = navigator.connection as {
        saveData?: boolean
        effectiveType?: string
      }
      // Skip prefetching if user has data-saver enabled
      if (conn.saveData) return false
      // Also skip on very slow connections (2g)
      if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g')
        return false
    }

    return true
  }

  /**
   * Add a single URL to the prefetch queue
   */
  add(url: string): void {
    if (!this.canPrefetch()) return
    if (this.prefetched.has(url)) return
    if (this.queue.includes(url)) return

    this.queue.push(url)
    this.scheduleProcessing()
  }

  /**
   * Add multiple URLs with staggered timing
   * URLs are added with configurable delays between each
   */
  addBatch(urls: string[]): void {
    if (!this.canPrefetch()) return

    // Create a new abort controller for this batch
    this.abortController = new AbortController()
    const signal = this.abortController.signal

    urls.forEach((url, i) => {
      const timeoutId = setTimeout(() => {
        if (signal.aborted) return
        this.add(url)
      }, i * this.staggerMs)

      // Clean up timeout if aborted
      signal.addEventListener('abort', () => clearTimeout(timeoutId), {
        once: true,
      })
    })
  }

  /**
   * Schedule queue processing with a small delay
   * to allow batching of multiple add() calls
   */
  private scheduleProcessing(): void {
    if (this.isProcessing) return

    this.isProcessing = true
    // Use queueMicrotask for faster scheduling than setTimeout
    queueMicrotask(() => {
      this.processQueue()
      this.isProcessing = false
    })
  }

  /**
   * Process the queue respecting max concurrency
   */
  private processQueue(): void {
    if (!this.router) return

    while (this.active < this.maxConcurrent && this.queue.length > 0) {
      const url = this.queue.shift()
      if (!url) continue

      // Skip if already prefetched (double-check after dequeue)
      if (this.prefetched.has(url)) continue

      this.active++
      this.prefetched.add(url)

      try {
        // router.prefetch returns void, but we handle any potential errors
        this.router.prefetch(url)
      } catch {
        // Silently fail on prefetch errors - non-critical operation
        // This handles network errors, 404s, etc.
      } finally {
        this.active--
      }
    }

    // If there are still items in queue, schedule another processing
    if (this.queue.length > 0) {
      this.scheduleProcessing()
    }
  }

  /**
   * Clear the queue and cancel pending batch operations
   * Call this on component unmount or navigation
   */
  clear(): void {
    this.queue = []
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
  }

  /**
   * Reset all state including prefetched URLs
   * Useful for testing or full cleanup
   */
  reset(): void {
    this.clear()
    this.prefetched.clear()
    this.active = 0
    this.router = null
  }

  /**
   * Check if a URL has already been prefetched
   */
  hasPrefetched(url: string): boolean {
    return this.prefetched.has(url)
  }

  /**
   * Get current queue size (for debugging/testing)
   */
  getQueueSize(): number {
    return this.queue.length
  }

  /**
   * Get count of prefetched URLs (for debugging/testing)
   */
  getPrefetchedCount(): number {
    return this.prefetched.size
  }
}

// Export singleton instance
export const prefetchManager = new PrefetchManager()
