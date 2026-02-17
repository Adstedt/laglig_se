/**
 * Story P.4: Zustand Store Performance Tests
 *
 * Tests for state update timing and selector efficiency.
 * Target: State updates complete in <16ms (one frame at 60fps)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { create } from 'zustand'
import { persist, devtools, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

// ============================================================================
// Test Store (mirrors production store patterns)
// ============================================================================

interface TestItem {
  id: string
  name: string
  value: number
}

interface TestState {
  items: TestItem[]
  selectedId: string | null
  isLoading: boolean
  lastUpdated: number | null

  // Actions
  addItem: (_item: TestItem) => void
  updateItem: (_id: string, _updates: Partial<TestItem>) => void
  removeItem: (_id: string) => void
  setSelectedId: (_id: string | null) => void
  setLoading: (_loading: boolean) => void
  bulkAddItems: (_items: TestItem[]) => void
}

const createTestStore = () =>
  create<TestState>()(
    devtools(
      immer((set) => ({
        items: [],
        selectedId: null,
        isLoading: false,
        lastUpdated: null,

        addItem: (item) =>
          set((state) => {
            state.items.push(item)
            state.lastUpdated = Date.now()
          }),

        updateItem: (id, updates) =>
          set((state) => {
            const item = state.items.find((i) => i.id === id)
            if (item) {
              Object.assign(item, updates)
              state.lastUpdated = Date.now()
            }
          }),

        removeItem: (id) =>
          set((state) => {
            state.items = state.items.filter((i) => i.id !== id)
            state.lastUpdated = Date.now()
          }),

        setSelectedId: (id) =>
          set((state) => {
            state.selectedId = id
          }),

        setLoading: (loading) =>
          set((state) => {
            state.isLoading = loading
          }),

        bulkAddItems: (items) =>
          set((state) => {
            state.items.push(...items)
            state.lastUpdated = Date.now()
          }),
      })),
      { name: 'TestStore' }
    )
  )

// ============================================================================
// Performance Tests
// ============================================================================

describe('Zustand Store Performance', () => {
  let useStore: ReturnType<typeof createTestStore>

  beforeEach(() => {
    useStore = createTestStore()
  })

  it('should complete single state update in <16ms', () => {
    const store = useStore.getState()

    const start = performance.now()
    store.addItem({ id: '1', name: 'Test', value: 100 })
    const duration = performance.now() - start

    expect(duration).toBeLessThan(16)
    expect(useStore.getState().items).toHaveLength(1)
  })

  it('should complete 100 sequential updates in <100ms', () => {
    const store = useStore.getState()

    const start = performance.now()
    for (let i = 0; i < 100; i++) {
      store.addItem({ id: `item-${i}`, name: `Test ${i}`, value: i })
    }
    const duration = performance.now() - start

    expect(duration).toBeLessThan(100)
    expect(useStore.getState().items).toHaveLength(100)
  })

  it('should handle bulk updates efficiently', () => {
    const items = Array.from({ length: 1000 }, (_, i) => ({
      id: `item-${i}`,
      name: `Test ${i}`,
      value: i,
    }))

    const start = performance.now()
    useStore.getState().bulkAddItems(items)
    const duration = performance.now() - start

    expect(duration).toBeLessThan(50) // Bulk should be faster than individual
    expect(useStore.getState().items).toHaveLength(1000)
  })

  it('should update single item efficiently in large list', () => {
    // Setup: Add 1000 items
    const items = Array.from({ length: 1000 }, (_, i) => ({
      id: `item-${i}`,
      name: `Test ${i}`,
      value: i,
    }))
    useStore.getState().bulkAddItems(items)

    // Test: Update single item
    const start = performance.now()
    useStore.getState().updateItem('item-500', { value: 9999 })
    const duration = performance.now() - start

    expect(duration).toBeLessThan(16)
    const updatedItem = useStore
      .getState()
      .items.find((i) => i.id === 'item-500')
    expect(updatedItem?.value).toBe(9999)
  })

  it('should toggle loading state instantly', () => {
    const store = useStore.getState()

    const measurements: number[] = []
    for (let i = 0; i < 100; i++) {
      const start = performance.now()
      store.setLoading(i % 2 === 0)
      measurements.push(performance.now() - start)
    }

    const average =
      measurements.reduce((a, b) => a + b, 0) / measurements.length
    expect(average).toBeLessThan(1) // Should be sub-millisecond
  })
})

// ============================================================================
// Selector Performance Tests
// ============================================================================

describe('Zustand Selector Performance', () => {
  let useStore: ReturnType<typeof createTestStore>

  beforeEach(() => {
    useStore = createTestStore()
    // Setup: Add 1000 items
    const items = Array.from({ length: 1000 }, (_, i) => ({
      id: `item-${i}`,
      name: `Test ${i}`,
      value: i,
    }))
    useStore.getState().bulkAddItems(items)
  })

  it('should read state instantly', () => {
    const start = performance.now()
    const items = useStore.getState().items
    const duration = performance.now() - start

    expect(duration).toBeLessThan(1)
    expect(items).toHaveLength(1000)
  })

  it('should select specific item efficiently', () => {
    const start = performance.now()
    const item = useStore.getState().items.find((i) => i.id === 'item-500')
    const duration = performance.now() - start

    expect(duration).toBeLessThan(5)
    expect(item?.id).toBe('item-500')
  })

  it('should filter items efficiently', () => {
    const start = performance.now()
    const filtered = useStore.getState().items.filter((i) => i.value > 500)
    const duration = performance.now() - start

    expect(duration).toBeLessThan(10)
    expect(filtered).toHaveLength(499)
  })

  it('should compute derived state efficiently', () => {
    const start = performance.now()
    const total = useStore
      .getState()
      .items.reduce((sum, item) => sum + item.value, 0)
    const duration = performance.now() - start

    expect(duration).toBeLessThan(10)
    expect(total).toBe((999 * 1000) / 2) // Sum of 0 to 999
  })
})

// ============================================================================
// Middleware Performance Tests
// ============================================================================

describe('Zustand Middleware Performance', () => {
  it('should not significantly impact update performance with devtools', () => {
    const withoutDevtools = create<{ count: number; inc: () => void }>()(
      (set) => ({
        count: 0,
        inc: () => set((s) => ({ count: s.count + 1 })),
      })
    )

    const withDevtools = create<{ count: number; inc: () => void }>()(
      devtools(
        (set) => ({
          count: 0,
          inc: () => set((s) => ({ count: s.count + 1 })),
        }),
        { name: 'TestStore' }
      )
    )

    // Measure without devtools
    const start1 = performance.now()
    for (let i = 0; i < 1000; i++) {
      withoutDevtools.getState().inc()
    }
    const duration1 = performance.now() - start1

    // Measure with devtools
    const start2 = performance.now()
    for (let i = 0; i < 1000; i++) {
      withDevtools.getState().inc()
    }
    const duration2 = performance.now() - start2

    // Devtools should add minimal overhead (< 10x)
    // Generous threshold — CI shared runners have highly variable scheduling
    // overhead for sub-millisecond microbenchmarks
    expect(duration2).toBeLessThan(duration1 * 10)
  })

  it('should persist efficiently to storage', () => {
    // Create an in-memory storage implementation
    const storageData: Record<string, string> = {}
    const mockStorage = {
      getItem: (name: string) => storageData[name] ?? null,
      setItem: (name: string, value: string) => {
        storageData[name] = value
      },
      removeItem: (name: string) => {
        delete storageData[name]
      },
    }

    const usePersistStore = create<{ count: number; inc: () => void }>()(
      persist(
        (set) => ({
          count: 0,
          inc: () => set((s) => ({ count: s.count + 1 })),
        }),
        {
          name: 'persist-test',
          storage: createJSONStorage(() => mockStorage),
        }
      )
    )

    const start = performance.now()
    for (let i = 0; i < 100; i++) {
      usePersistStore.getState().inc()
    }
    const duration = performance.now() - start

    expect(duration).toBeLessThan(100)
    expect(usePersistStore.getState().count).toBe(100)
  })
})
