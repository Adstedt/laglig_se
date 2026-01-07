# 21. Caching and Data Fetching Strategy

## Status: Future Implementation

This document outlines the comprehensive caching and data fetching architecture for Laglig.se. The full implementation is planned for a future phase. For the immediate fix, see the Story Brief at the end of this document.

---

## 1. Overview

### 1.1 Goals

- **Fluid UX**: No loading spinners for common interactions
- **Instant navigation**: Switching between views feels immediate
- **Multi-user collaboration**: Changes sync across workspace users
- **Scalability**: Support 1000+ daily active users without performance degradation
- **Consistency**: One pattern that applies across all page types

### 1.2 Current State (As of January 2026)

**Public pages** (`/rattskallor`, `/lagar`, etc.) have a mature 7-layer caching strategy:

| Layer        | Technology       | TTL                              |
| ------------ | ---------------- | -------------------------------- |
| Edge CDN     | Vercel           | 60s + 1hr stale-while-revalidate |
| Router Cache | Next.js 15       | 60-180s                          |
| Server Cache | `unstable_cache` | 300-3600s                        |
| Redis        | Upstash          | 300-3600s                        |
| SWR          | Client dedup     | 60s                              |
| HTTP Cache   | Browser          | 60s                              |
| LocalStorage | UI state         | Persistent                       |

**Authenticated pages** (`/laglistor`, `/settings`) lack equivalent caching, resulting in:

- Full refetch on every list switch
- Loading spinners during mutations
- No cross-session persistence

---

## 2. Data Classification

All application data falls into three categories with distinct caching requirements:

| Category          | Examples                                  | Characteristics                         | Strategy                                    |
| ----------------- | ----------------------------------------- | --------------------------------------- | ------------------------------------------- |
| **Public Static** | Laws, court cases, EU docs                | Read-heavy, changes via sync jobs       | Aggressive caching (5min - 1hr)             |
| **User Scoped**   | Document lists, settings, preferences     | User-specific, moderate write frequency | Light caching (30-60s) + optimistic updates |
| **Collaborative** | Comments, assignments, real-time activity | Multi-user writes, requires sync        | No cache + realtime broadcast               |

---

## 3. Unified Architecture

### 3.1 Client-Side: Unified Hooks

```typescript
// lib/hooks/use-cached-query.ts

import useSWR, { SWRConfiguration, preload } from 'swr'
import { useRealtimeInvalidation } from '@/lib/realtime/use-realtime-invalidation'

type DataType = 'public' | 'user' | 'realtime'

interface CachedQueryOptions {
  type?: DataType
  realtimeChannel?: string
}

const TYPE_CONFIG: Record<DataType, SWRConfiguration> = {
  public: {
    dedupingInterval: 300000, // 5 minutes
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    errorRetryCount: 3,
  },
  user: {
    dedupingInterval: 60000, // 1 minute
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    errorRetryCount: 2,
  },
  realtime: {
    dedupingInterval: 5000, // 5 seconds
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    refreshInterval: 30000, // Polling fallback
    errorRetryCount: 1,
  },
}

export function useCachedQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: CachedQueryOptions = {}
) {
  const { type = 'user', realtimeChannel } = options
  const config = TYPE_CONFIG[type]

  const result = useSWR(key, fetcher, {
    ...config,
    keepPreviousData: true, // Always - prevents skeleton flash
  })

  // Auto-subscribe to realtime invalidation
  useRealtimeInvalidation(key, realtimeChannel)

  return result
}

// Prefetch utility for hover/focus
export function prefetchQuery<T>(key: string, fetcher: () => Promise<T>) {
  preload(key, fetcher)
}
```

### 3.2 Client-Side: Unified Mutations

```typescript
// lib/hooks/use-cached-mutation.ts

import { useSWRConfig } from 'swr'
import { broadcast } from '@/lib/realtime/broadcast'
import type { ActionResult } from '@/types/actions'

interface MutationOptions<TData, TInput> {
  optimisticUpdate?: (current: TData, input: TInput) => TData
  realtimeChannel?: string
  onSuccess?: (data: TData) => void
  onError?: (error: string) => void
}

export function useCachedMutation<TData, TInput>(
  cacheKey: string,
  mutationFn: (input: TInput) => Promise<ActionResult<TData>>,
  options: MutationOptions<TData, TInput> = {}
) {
  const { mutate } = useSWRConfig()
  const { optimisticUpdate, realtimeChannel, onSuccess, onError } = options

  const execute = async (input: TInput): Promise<ActionResult<TData>> => {
    // 1. Optimistic update (instant UI feedback)
    let rollbackData: TData | undefined

    if (optimisticUpdate) {
      await mutate(
        cacheKey,
        (current: TData) => {
          rollbackData = current
          return optimisticUpdate(current, input)
        },
        { revalidate: false }
      )
    }

    // 2. Server mutation
    const result = await mutationFn(input)

    // 3. Handle result
    if (result.success) {
      // Revalidate to sync with server truth
      mutate(cacheKey)

      // Broadcast to collaborators
      if (realtimeChannel) {
        broadcast(realtimeChannel, {
          type: 'cache_invalidate',
          key: cacheKey,
        })
      }

      onSuccess?.(result.data!)
    } else {
      // Rollback optimistic update
      if (rollbackData !== undefined) {
        mutate(cacheKey, rollbackData, { revalidate: false })
      }

      onError?.(result.error ?? 'Unknown error')
    }

    return result
  }

  return { execute }
}
```

### 3.3 Server-Side: Unified Cache Wrapper

```typescript
// lib/cache/server-cache.ts

import { getCachedOrFetch, invalidateCacheKey } from './redis'

type CacheType = 'public' | 'user' | 'realtime'

const TTL_CONFIG: Record<CacheType, number> = {
  public: 3600, // 1 hour
  user: 60, // 1 minute
  realtime: 0, // No cache
}

/**
 * Unified server-side cache wrapper.
 *
 * @example
 * // Public data (laws, documents)
 * const law = await withCache(`law:${slug}`, () => fetchLaw(slug), 'public')
 *
 * // User-scoped data (lists, settings)
 * const items = await withCache(`lists:${listId}`, () => fetchItems(listId), 'user')
 *
 * // Realtime data (no caching)
 * const comments = await withCache(`comments:${id}`, () => fetchComments(id), 'realtime')
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  type: CacheType = 'user'
): Promise<{ data: T; cached: boolean }> {
  const ttl = TTL_CONFIG[type]

  if (ttl === 0) {
    // No caching for realtime data
    return { data: await fetcher(), cached: false }
  }

  return getCachedOrFetch(key, fetcher, ttl)
}

/**
 * Invalidate cache for a specific key or pattern.
 */
export async function invalidateCache(keyOrPattern: string): Promise<void> {
  await invalidateCacheKey(keyOrPattern)
}
```

### 3.4 Realtime Sync: Supabase Integration

```typescript
// lib/realtime/use-realtime-invalidation.ts

import { useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { mutate } from 'swr'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export function useRealtimeInvalidation(
  cacheKey: string | null,
  channel?: string
) {
  useEffect(() => {
    if (!channel || !cacheKey) return

    const subscription = supabase
      .channel(channel)
      .on('broadcast', { event: 'cache_invalidate' }, (payload) => {
        if (payload.payload.key === cacheKey) {
          // Revalidate SWR cache
          mutate(cacheKey)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [cacheKey, channel])
}
```

```typescript
// lib/realtime/broadcast.ts

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function broadcast(
  channel: string,
  payload: Record<string, unknown>
): Promise<void> {
  await supabase.channel(channel).send({
    type: 'broadcast',
    event: 'cache_invalidate',
    payload,
  })
}
```

---

## 4. Usage Patterns

### 4.1 Public Pages (Catalogue)

```typescript
// app/(public)/rattskallor/page.tsx

function CataloguePage() {
  const { data, isLoading } = useCachedQuery(
    'catalogue:laws:page-1',
    () => browseDocuments({ contentTypes: ['SFS_LAW'], page: 1 }),
    { type: 'public' }
  )

  // isLoading only true on first load
  // Subsequent visits show cached data instantly
}
```

### 4.2 User Pages (Document Lists)

```typescript
// app/(workspace)/laglistor/page.tsx

function DocumentListPage() {
  const { activeListId } = useDocumentListStore()

  const { data: items } = useCachedQuery(
    activeListId ? `list-items:${activeListId}` : null,
    () => getDocumentListItems({ listId: activeListId! }),
    {
      type: 'user',
      realtimeChannel: `workspace:${workspaceId}:lists`,
    }
  )

  // Instant switch between lists (cached)
  // Auto-syncs when colleague makes changes
}
```

### 4.3 Mutations with Optimistic Updates

```typescript
// components/features/document-list/add-document-button.tsx

function AddDocumentButton({ listId, document }) {
  const { execute: addItem } = useCachedMutation(
    `list-items:${listId}`,
    (input) => addDocumentToList(input),
    {
      optimisticUpdate: (current, input) => ({
        ...current,
        items: [...current.items, createTempItem(input.document)]
      }),
      realtimeChannel: `workspace:${workspaceId}:lists`,
      onError: (error) => toast.error(error),
    }
  )

  return (
    <Button onClick={() => addItem({ listId, documentId: document.id })}>
      Add
    </Button>
  )
}
```

### 4.4 Prefetch on Hover

```typescript
// components/layout/sidebar.tsx

import { prefetchQuery } from '@/lib/hooks/use-cached-query'

function ListLink({ list }) {
  const handlePrefetch = () => {
    prefetchQuery(
      `list-items:${list.id}`,
      () => getDocumentListItems({ listId: list.id })
    )
  }

  return (
    <Link
      href={`/laglistor?list=${list.id}`}
      onMouseEnter={handlePrefetch}
      onFocus={handlePrefetch}
    >
      {list.name}
    </Link>
  )
}
```

---

## 5. Cache Invalidation Strategy

### 5.1 Invalidation Matrix

| Trigger         | Client (SWR)  | Server (Redis)                       | Broadcast |
| --------------- | ------------- | ------------------------------------ | --------- |
| Add item        | `mutate(key)` | `invalidateCache(key)`               | Yes       |
| Remove item     | `mutate(key)` | `invalidateCache(key)`               | Yes       |
| Update item     | `mutate(key)` | `invalidateCache(key)`               | Yes       |
| Reorder items   | `mutate(key)` | `invalidateCache(key)`               | Yes       |
| Switch list     | Auto (SWR)    | Read from cache                      | No        |
| Sync job (laws) | N/A           | `invalidateCachePattern('browse:*')` | N/A       |

### 5.2 Cache Key Conventions

```
# Public data
catalogue:{contentType}:page-{n}
law:{slug}
court-case:{slug}

# User-scoped data
lists:{workspaceId}
list-items:{listId}
workspace-settings:{workspaceId}

# Realtime channels
workspace:{workspaceId}:lists
workspace:{workspaceId}:activity
document:{documentId}:comments
```

---

## 6. Performance Targets

| Metric                 | Target | Measurement            |
| ---------------------- | ------ | ---------------------- |
| First page load        | <2s    | Lighthouse             |
| List switch (cached)   | <50ms  | Performance API        |
| List switch (uncached) | <500ms | Performance API        |
| Mutation feedback      | <100ms | Perceived (optimistic) |
| Multi-user sync        | <2s    | Time to reflect change |
| Cache hit rate         | >80%   | Redis metrics          |

---

## 7. Migration Path

### Phase 1: Simple Fixes (Current)

- Fix Zustand store for per-list caching
- Implement true optimistic mutations
- No new dependencies

### Phase 2: SWR Integration

- Create `useCachedQuery` hook
- Migrate document lists to SWR
- Add prefetch on hover

### Phase 3: Server Caching

- Add Redis caching for user-scoped data
- Create `withCache` server wrapper
- Update server actions

### Phase 4: Realtime Sync

- Set up Supabase Realtime channels
- Add `useRealtimeInvalidation` hook
- Enable cross-user sync

### Phase 5: Platform-Wide Rollout

- Migrate settings pages
- Migrate workspace pages
- Standardize all data fetching

---

## 8. Decision Log

| Date       | Decision                   | Rationale                                        |
| ---------- | -------------------------- | ------------------------------------------------ |
| 2026-01-07 | Use SWR over React Query   | Already in codebase, simpler API, smaller bundle |
| 2026-01-07 | Keep Zustand for mutations | Optimistic updates well-suited to store pattern  |
| 2026-01-07 | Use Supabase Realtime      | Already on Supabase, native integration          |
| 2026-01-07 | Start with simple fix      | Lower risk, faster delivery, validates need      |

---

## 9. Related Documents

- [3. Tech Stack](./3-tech-stack.md)
- [15. Security and Performance](./15-security-and-performance.md)
- [17. Coding Standards](./17-coding-standards.md)

---

## Appendix A: Current Caching Implementation

See `lib/cache/` for existing implementation:

- `redis.ts` - Redis client and `getCachedOrFetch`
- `cached-browse.ts` - Browse/catalogue caching
- `cached-queries.ts` - Document detail caching
- `invalidation.ts` - Cache invalidation utilities
- `prewarm-browse.ts` - Cache warming after sync jobs

---

## Appendix B: Story Brief for Immediate Fix

For the immediate implementation (Phase 1), see: [Story Brief: Document List Performance Optimization](../stories/briefs/document-list-caching-brief.md)
