/**
 * Story 20.3 AC 38: useWorkspaceRequirements SWR-dedup guarantee.
 *
 * Asserts the server-action fetcher is called exactly once for identical
 * (filter, search, sort, cursor) keys within the same SWR cache scope.
 * Guards the `keepPreviousData` + key-dedup contract against silent drift
 * (e.g., if someone replaces the hook internals with a non-SWR fetch).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import type { ReactNode } from 'react'

const fetcher = vi.fn()

vi.mock('@/app/actions/workspace-requirements', () => ({
  getWorkspaceRequirements: (...args: unknown[]) => fetcher(...args),
  getWorkspaceRequirementCounts: vi.fn(),
}))

// Import under test AFTER the mock.
import { useWorkspaceRequirements } from '@/components/features/krav/hooks/use-workspace-requirements'

/**
 * Per-test SWR cache shared across every hook mounted inside this wrapper.
 * Must hoist the Map to a closure so multiple mount points inside the same
 * React tree reuse it — otherwise each render would allocate a new cache.
 */
function sharedCacheWrapper() {
  const cache = new Map()
  function SharedCacheProvider({ children }: { children: ReactNode }) {
    return <SWRConfig value={{ provider: () => cache }}>{children}</SWRConfig>
  }
  return SharedCacheProvider
}

describe('useWorkspaceRequirements SWR dedup (AC 38)', () => {
  beforeEach(() => {
    fetcher.mockReset()
    fetcher.mockResolvedValue({
      success: true,
      data: { items: [], nextCursor: null },
    })
  })

  it('calls the fetcher exactly ONCE for identical keys across two hook consumers', async () => {
    // Both hooks mount inside ONE renderHook call → one React tree → one
    // SWRConfig provider → one cache. Two hooks with identical keys therefore
    // must resolve to a single network call.
    const { result } = renderHook(
      () => {
        const a = useWorkspaceRequirements({
          filter: 'gaps',
          sort: { field: 'updated_at', direction: 'desc' },
          limit: 50,
        })
        const b = useWorkspaceRequirements({
          filter: 'gaps',
          sort: { field: 'updated_at', direction: 'desc' },
          limit: 50,
        })
        return { a, b }
      },
      { wrapper: sharedCacheWrapper() }
    )

    await waitFor(() => {
      expect(result.current.a.data).toBeDefined()
      expect(result.current.b.data).toBeDefined()
    })

    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('fires a second fetch when the filter changes (distinct key)', async () => {
    const { result } = renderHook(
      () => {
        const a = useWorkspaceRequirements({
          filter: 'gaps',
          sort: { field: 'updated_at', direction: 'desc' },
          limit: 50,
        })
        const b = useWorkspaceRequirements({
          filter: 'mine',
          sort: { field: 'updated_at', direction: 'desc' },
          limit: 50,
        })
        return { a, b }
      },
      { wrapper: sharedCacheWrapper() }
    )

    await waitFor(() => {
      expect(result.current.a.data).toBeDefined()
      expect(result.current.b.data).toBeDefined()
    })

    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
