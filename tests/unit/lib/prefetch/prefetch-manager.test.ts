import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the navigator.connection API
const mockConnection = {
  saveData: false,
  effectiveType: '4g',
}

// Store original navigator
const originalNavigator = global.navigator

describe('PrefetchManager', () => {
  let prefetchManager: typeof import('@/lib/prefetch/prefetch-manager').prefetchManager
  let mockRouter: { prefetch: ReturnType<typeof vi.fn> }

  beforeEach(async () => {
    // Reset module cache to get fresh instance
    vi.resetModules()

    // Mock navigator.connection
    Object.defineProperty(global, 'navigator', {
      value: {
        connection: mockConnection,
      },
      writable: true,
      configurable: true,
    })

    // Reset connection mock
    mockConnection.saveData = false
    mockConnection.effectiveType = '4g'

    // Create mock router
    mockRouter = {
      prefetch: vi.fn(),
    }

    // Dynamic import to get fresh instance
    const prefetchModule = await import('@/lib/prefetch/prefetch-manager')
    prefetchManager = prefetchModule.prefetchManager
    prefetchManager.reset()
    prefetchManager.init(mockRouter as never)
  })

  afterEach(() => {
    // Restore original navigator
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    })
    vi.clearAllMocks()
  })

  describe('canPrefetch', () => {
    it('returns false when router is not initialized', async () => {
      const prefetchModule = await import('@/lib/prefetch/prefetch-manager')
      const freshManager = new (prefetchModule.prefetchManager
        .constructor as new () => typeof prefetchManager)()
      // @ts-expect-error - accessing private for test
      freshManager.router = null
      // @ts-expect-error - accessing internal method
      expect(freshManager.canPrefetch()).toBe(false)
    })

    it('returns false when data-saver is enabled', () => {
      mockConnection.saveData = true
      // @ts-expect-error - accessing internal method
      expect(prefetchManager.canPrefetch()).toBe(false)
    })

    it('returns false on slow 2g connection', () => {
      mockConnection.effectiveType = '2g'
      // @ts-expect-error - accessing internal method
      expect(prefetchManager.canPrefetch()).toBe(false)
    })

    it('returns false on slow-2g connection', () => {
      mockConnection.effectiveType = 'slow-2g'
      // @ts-expect-error - accessing internal method
      expect(prefetchManager.canPrefetch()).toBe(false)
    })

    it('returns true on 3g connection', () => {
      mockConnection.effectiveType = '3g'
      // @ts-expect-error - accessing internal method
      expect(prefetchManager.canPrefetch()).toBe(true)
    })

    it('returns true on 4g connection', () => {
      mockConnection.effectiveType = '4g'
      // @ts-expect-error - accessing internal method
      expect(prefetchManager.canPrefetch()).toBe(true)
    })
  })

  describe('add', () => {
    it('adds URL to queue and triggers prefetch', async () => {
      prefetchManager.add('/test-url')

      // Wait for microtask queue to process
      await new Promise((resolve) => queueMicrotask(resolve))

      expect(mockRouter.prefetch).toHaveBeenCalledWith('/test-url')
      expect(prefetchManager.hasPrefetched('/test-url')).toBe(true)
    })

    it('does not prefetch duplicate URLs', async () => {
      prefetchManager.add('/test-url')
      prefetchManager.add('/test-url')

      await new Promise((resolve) => queueMicrotask(resolve))

      expect(mockRouter.prefetch).toHaveBeenCalledTimes(1)
    })

    it('does not prefetch when data-saver is enabled', async () => {
      mockConnection.saveData = true
      prefetchManager.add('/test-url')

      await new Promise((resolve) => queueMicrotask(resolve))

      expect(mockRouter.prefetch).not.toHaveBeenCalled()
    })
  })

  describe('addBatch', () => {
    it('adds multiple URLs with staggered timing', async () => {
      vi.useFakeTimers()

      prefetchManager.addBatch(['/url-1', '/url-2', '/url-3'])

      // First URL added immediately
      await vi.advanceTimersByTimeAsync(0)
      await new Promise((resolve) => queueMicrotask(resolve))
      expect(mockRouter.prefetch).toHaveBeenCalledWith('/url-1')

      // Second URL after 50ms
      await vi.advanceTimersByTimeAsync(50)
      await new Promise((resolve) => queueMicrotask(resolve))
      expect(mockRouter.prefetch).toHaveBeenCalledWith('/url-2')

      // Third URL after another 50ms
      await vi.advanceTimersByTimeAsync(50)
      await new Promise((resolve) => queueMicrotask(resolve))
      expect(mockRouter.prefetch).toHaveBeenCalledWith('/url-3')

      expect(mockRouter.prefetch).toHaveBeenCalledTimes(3)

      vi.useRealTimers()
    })

    it('does not add URLs when data-saver is enabled', async () => {
      mockConnection.saveData = true

      prefetchManager.addBatch(['/url-1', '/url-2', '/url-3'])

      await new Promise((resolve) => setTimeout(resolve, 200))

      expect(mockRouter.prefetch).not.toHaveBeenCalled()
    })
  })

  describe('clear', () => {
    it('clears the queue', () => {
      // Add URLs without processing
      // @ts-expect-error - accessing private for test
      prefetchManager.queue.push('/url-1', '/url-2')

      prefetchManager.clear()

      expect(prefetchManager.getQueueSize()).toBe(0)
    })

    it('aborts pending batch operations', () => {
      vi.useFakeTimers()

      prefetchManager.addBatch(['/url-1', '/url-2', '/url-3'])

      // Clear before all URLs are added
      prefetchManager.clear()

      // Advance timers - no more URLs should be added
      vi.advanceTimersByTime(200)

      // Only URLs added before clear should be processed
      expect(prefetchManager.getQueueSize()).toBe(0)

      vi.useRealTimers()
    })
  })

  describe('reset', () => {
    it('resets all state including prefetched URLs', async () => {
      prefetchManager.add('/url-1')
      await new Promise((resolve) => queueMicrotask(resolve))

      expect(prefetchManager.hasPrefetched('/url-1')).toBe(true)

      prefetchManager.reset()

      expect(prefetchManager.hasPrefetched('/url-1')).toBe(false)
      expect(prefetchManager.getQueueSize()).toBe(0)
      expect(prefetchManager.getPrefetchedCount()).toBe(0)
    })
  })

  describe('error handling', () => {
    it('silently handles prefetch errors', async () => {
      mockRouter.prefetch.mockImplementation(() => {
        throw new Error('Network error')
      })

      // Should not throw
      expect(() => prefetchManager.add('/error-url')).not.toThrow()

      await new Promise((resolve) => queueMicrotask(resolve))

      // URL is still marked as prefetched (to avoid retries)
      expect(prefetchManager.hasPrefetched('/error-url')).toBe(true)
    })
  })
})
