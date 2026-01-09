# Caching Strategy

## Overview

This document defines the caching strategy for Laglig.se to ensure fast page loads and responsive user experience while maintaining data consistency. All new features should follow these patterns.

## Problem Statement

Without proper caching, each page navigation triggers:

- Session lookup (NextAuth)
- User database query
- Workspace context query (user → workspace member → workspace)
- Page-specific data queries

This results in 5-10+ database queries per page load, causing 2-6 second load times.

## Caching Layers

### 1. Request-Level Deduplication (React `cache()`)

**Use for:** Functions called multiple times within a single request

**Implementation:**

```typescript
import { cache } from 'react'

// Before: Each call triggers new DB queries
export async function getWorkspaceContext() { ... }

// After: First call queries DB, subsequent calls return cached result
export const getWorkspaceContext = cache(async () => { ... })
```

**Already implemented in:**

- `lib/auth/workspace-context.ts` - `getWorkspaceContext()`

**Note:** `getServerSession()` in `lib/auth/session.ts` is intentionally NOT wrapped with `cache()` as it can interfere with authentication flows. JWT session decoding is already efficient.

**When to use:**

- Auth/session functions called by multiple components
- Context functions used by multiple server actions
- Any function that might be called multiple times per request

### 2. Time-Based Server Cache (`unstable_cache`)

**Use for:** Data that changes infrequently and can be stale for seconds/minutes

**Implementation:**

```typescript
import { unstable_cache } from 'next/cache'

// Cache workspace data for 60 seconds
export const getCachedWorkspaceData = unstable_cache(
  async (workspaceId: string) => {
    return prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true, settings: true },
    })
  },
  ['workspace-data'], // Cache key prefix
  {
    revalidate: 60, // Seconds until stale
    tags: ['workspace'], // For manual invalidation
  }
)

// Invalidate when workspace is updated
import { revalidateTag } from 'next/cache'
await revalidateTag('workspace')
```

**When to use:**

- Dashboard statistics
- List counts and summaries
- Settings that rarely change
- Reference data (law metadata, categories)

**Cache durations:**

- Dashboard widgets: 30-60 seconds
- List summaries: 60 seconds
- Settings: 300 seconds (5 min)
- Reference data: 3600 seconds (1 hour)

### 3. Client-Side Router Cache

**Already configured in `next.config.mjs`:**

```javascript
experimental: {
  staleTimes: {
    dynamic: 60,  // Cache dynamic routes for 60 seconds
    static: 180,  // Cache static routes for 3 minutes
  },
}
```

This enables back/forward navigation without refetching.

### 4. HTTP Cache Headers (CDN/Edge)

**For public pages only** (not authenticated routes):

```javascript
// next.config.mjs
{
  source: '/rattskallor',
  headers: [{
    key: 'Cache-Control',
    value: 'public, s-maxage=60, stale-while-revalidate=3600',
  }],
}
```

**Never use for:** Authenticated workspace routes (they contain user-specific data)

### 5. Client-Side State Caching (Zustand)

**Already implemented:**

- `lib/stores/document-list-store.ts` - Law lists cached in Zustand

**Pattern:**

```typescript
// Store fetches once, components reuse
const { lists, fetchLists, isLoading } = useDocumentListStore()

useEffect(() => {
  if (!lists.length && !isLoading) {
    fetchLists()
  }
}, [])
```

## Implementation Checklist for New Features

### Server Components / Pages

1. **Does the page call `getWorkspaceContext()`?**
   - ✅ Already cached with `cache()`

2. **Does the page fetch data that could be cached?**
   - Consider `unstable_cache` with appropriate TTL
   - Add revalidation tags for manual cache invalidation

3. **Does the page call multiple server actions?**
   - Ensure shared data uses `cache()` wrapped functions

### Server Actions

1. **Does the action need workspace context?**

   ```typescript
   // Good: Uses cached wrapper
   return await withWorkspace(async (ctx) => { ... })
   ```

2. **Should the action invalidate cache?**

   ```typescript
   // After mutation, invalidate relevant caches
   import { revalidateTag, revalidatePath } from 'next/cache'

   await prisma.lawList.update({ ... })
   revalidateTag('law-lists')
   revalidatePath('/laglistor')
   ```

### Client Components

1. **Is this data already in a Zustand store?**
   - Reuse existing store instead of new fetch

2. **Should this data be cached client-side?**
   - Consider adding to relevant Zustand store
   - Or use React Query/SWR for automatic caching

## Common Patterns

### Pattern 1: Cached Page Data

```typescript
// lib/db/queries/dashboard.ts
import { unstable_cache } from 'next/cache'

export const getDashboardStats = unstable_cache(
  async (workspaceId: string) => {
    const [compliance, tasks] = await Promise.all([
      getComplianceStats(workspaceId),
      getTaskCounts(workspaceId),
    ])
    return { compliance, tasks }
  },
  ['dashboard-stats'],
  { revalidate: 30, tags: ['dashboard', 'workspace'] }
)

// app/(workspace)/dashboard/page.tsx
export default async function DashboardPage() {
  const ctx = await getWorkspaceContext() // Cached per request
  const stats = await getDashboardStats(ctx.workspaceId) // Cached 30s
  return <Dashboard stats={stats} />
}
```

### Pattern 2: Mutation with Cache Invalidation

```typescript
// app/actions/task.ts
'use server'

import { revalidateTag, revalidatePath } from 'next/cache'

export async function createTask(data: TaskInput) {
  return await withWorkspace(async (ctx) => {
    const task = await prisma.task.create({
      data: { ...data, workspace_id: ctx.workspaceId },
    })

    // Invalidate relevant caches
    revalidateTag('tasks')
    revalidateTag('dashboard') // Dashboard shows task counts
    revalidatePath('/tasks')

    return { success: true, data: task }
  })
}
```

### Pattern 3: Optimistic Updates (Client-Side)

```typescript
// For instant UI feedback while server processes
function TaskList() {
  const [tasks, setTasks] = useState(initialTasks)

  async function completeTask(taskId: string) {
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, completed: true } : t))
    )

    // Server update
    const result = await markTaskComplete(taskId)

    if (!result.success) {
      // Revert on failure
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, completed: false } : t))
      )
    }
  }
}
```

## Special Case: Frequently-Modified Data (Law Lists, Tasks)

For features where users actively work and modify data, **avoid long server-side caching**. Instead:

### Strategy: Client-Side State Management + Optimistic Updates

**Already implemented in `lib/stores/document-list-store.ts`:**

```typescript
// Zustand store with:
// - Client-side cache (itemsByList Map)
// - Optimistic updates (instant UI feedback)
// - Rollback on failure
// - 5-minute staleness check
// - LRU eviction (keeps last 10 lists)

// Usage in components:
const { listItems, updateItem, addItem } = useDocumentListStore()

// Optimistic update - instant feel
await updateItem(itemId, { status: 'COMPLETED' })
```

### Pattern for New Task/Kanban Features

```typescript
// 1. Create Zustand store (similar to document-list-store)
export const useTaskStore = create<TaskState>()((set, get) => ({
  tasks: [],
  columns: [],

  // Optimistic update with rollback
  updateTask: async (taskId, updates) => {
    const rollback = [...get().tasks]

    // Instant UI update
    set({
      tasks: get().tasks.map((t) =>
        t.id === taskId ? { ...t, ...updates } : t
      ),
    })

    // Server sync
    const result = await updateTaskAction(taskId, updates)
    if (!result.success) {
      set({ tasks: rollback, error: result.error })
    }
  },

  // Optimistic drag-and-drop
  moveTask: async (taskId, newColumnId, newPosition) => {
    const rollback = [...get().tasks]

    // Instant reorder
    set({ tasks: reorderTasks(get().tasks, taskId, newColumnId, newPosition) })

    // Server sync
    const result = await moveTaskAction(taskId, newColumnId, newPosition)
    if (!result.success) {
      set({ tasks: rollback })
    }
  },
}))
```

### Server-Side: Minimal Initial Load

For pages with Zustand stores, the server only needs to provide initial data:

```typescript
// app/(workspace)/tasks/page.tsx
export default async function TasksPage() {
  const ctx = await getWorkspaceContext() // Cached per request

  // Light query - just get initial data, client handles the rest
  const initialTasks = await getTasksForWorkspace(ctx.workspaceId)

  return (
    <TaskBoard initialTasks={initialTasks} />
  )
}

// Component hydrates Zustand store with initial data
function TaskBoard({ initialTasks }) {
  const { tasks, setTasks } = useTaskStore()

  useEffect(() => {
    if (tasks.length === 0) {
      setTasks(initialTasks)
    }
  }, [])

  // All subsequent updates via Zustand (instant, optimistic)
}
```

### Key Principles for Heavy-Use Features

1. **NO long `unstable_cache`** - Data changes too frequently
2. **YES `cache()` for auth/context** - Still deduplicate within request
3. **Zustand for state** - Single source of truth on client
4. **Optimistic updates** - Instant UI feedback
5. **Rollback on failure** - Graceful error handling
6. **Background sync** - Refresh stale data silently

## Performance Targets

| Route Type                      | Target Load Time |
| ------------------------------- | ---------------- |
| Dashboard                       | < 500ms          |
| List pages                      | < 500ms          |
| Settings                        | < 300ms          |
| Detail pages                    | < 400ms          |
| Navigation between cached pages | < 100ms          |

## Cache Invalidation Rules

| Event                      | Invalidate                         |
| -------------------------- | ---------------------------------- |
| Workspace settings updated | `workspace` tag                    |
| Law list modified          | `law-lists` tag, `/laglistor` path |
| Task created/updated       | `tasks` tag, `dashboard` tag       |
| User joins workspace       | `workspace-members` tag            |
| Compliance status changed  | `compliance` tag, `dashboard` tag  |

## Debugging Cache Issues

1. **Check if cache is working:**

   ```typescript
   console.log('Cache miss - fetching from DB')
   ```

2. **Force cache refresh in development:**

   ```bash
   # Clear Next.js cache
   rm -rf .next/cache
   ```

3. **Disable cache temporarily:**
   ```typescript
   export const dynamic = 'force-dynamic' // In page.tsx
   ```

## Related Documentation

- [Next.js Caching Docs](https://nextjs.org/docs/app/building-your-application/caching)
- [React `cache()` function](https://react.dev/reference/react/cache)
- Story 6.4: Task Workspace (apply these patterns)
