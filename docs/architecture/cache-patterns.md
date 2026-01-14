# Cache Patterns Documentation (Story P.2)

## Overview

Laglig.se implements a multi-layered caching strategy to achieve sub-100ms response times for logged-in users. This document describes the caching patterns, implementation details, and best practices.

## Cache Layers

### 1. Request-Level Cache (React cache())
- **Purpose**: Deduplicates calls within a single request
- **TTL**: Request lifetime (milliseconds)
- **Use Case**: Workspace context, user session

### 2. Server-Side Cache (Next.js unstable_cache)
- **Purpose**: Caches server function results across requests
- **TTL**: 5 minutes to 24 hours depending on data type
- **Use Case**: Law data, search results, browse pages

### 3. Redis Distributed Cache (Upstash)
- **Purpose**: Shared cache across all server instances
- **TTL**: 5 minutes to 2 hours depending on data volatility
- **Use Case**: User sessions, workspace data, API responses

### 4. Client-Side Cache (Zustand + localStorage)
- **Purpose**: Instant navigation within the app
- **TTL**: 5 minutes to 1 hour with manual invalidation
- **Use Case**: Workspace members, law lists, user preferences

## Implementation Patterns

### Pattern 1: Workspace Data Caching

```typescript
// Server-side caching with workspace isolation
import { getCachedWorkspaceContext } from '@/lib/cache/workspace-cache'

const { data, cached } = await getCachedWorkspaceContext(
  userId,
  workspaceId,
  async () => {
    // Fetch from database
    return await prisma.workspace.findUnique({
      where: { id: workspaceId }
    })
  }
)
```

### Pattern 2: User Session Caching

```typescript
// User-specific caching with TTL
import { getCachedUserSession } from '@/lib/cache/user-cache'

const { data, cached } = await getCachedUserSession(
  userId,
  async () => {
    // Fetch user data
    return await fetchUserSession(userId)
  }
)
```

### Pattern 3: Hybrid Caching (Redis + Next.js)

```typescript
// Multi-layer caching for optimal performance
import { hybridCache } from '@/lib/cache/server-cache'

const { data, source } = await hybridCache(
  `law:${lawId}`,
  async () => await fetchLawData(lawId),
  {
    redisTTL: 3600,      // 1 hour in Redis
    nextTags: ['law'],   // Next.js cache tags
    nextRevalidate: 300  // 5 minute revalidation
  }
)
```

### Pattern 4: Cache Invalidation

```typescript
// Invalidate related caches on mutation
import { invalidateWorkspaceCache } from '@/lib/cache/workspace-cache'

// After updating workspace data
await invalidateWorkspaceCache(workspaceId, ['context', 'members'])

// Invalidate Next.js cache tags
import { revalidateTag } from 'next/cache'
revalidateTag(`workspace-${workspaceId}`)
```

### Pattern 5: Cache Warming

```typescript
// Pre-load frequently accessed data
import { warmWorkspaceCache } from '@/lib/cache/workspace-cache'

await warmWorkspaceCache(userId, workspaceId, {
  context: fetchWorkspaceContext,
  members: fetchWorkspaceMembers,
  lists: fetchLawLists,
  preferences: fetchUserPreferences
})
```

## Cache Key Conventions

### Workspace-Scoped Keys
```
workspace:context:{userId}:{workspaceId}
workspace:members:{workspaceId}
workspace:lists:{workspaceId}
workspace:settings:{workspaceId}
```

### User-Scoped Keys
```
user:session:{userId}
user:prefs:{userId}
user:workspaces:{userId}
user:frequent:{userId}:{workspaceId}
```

### Document-Scoped Keys
```
document:content:{documentId}
document:metadata:{documentId}
document:version:{documentId}:{version}
list:items:{listId}
```

## TTL Configuration

| Data Type | Redis TTL | Next.js Revalidate | Client Cache |
|-----------|-----------|-------------------|--------------|
| Static Laws | 24 hours | 24 hours | - |
| Workspace Context | 5 minutes | 5 minutes | Request lifetime |
| User Session | 30 minutes | 30 minutes | Session |
| Law Lists | 5 minutes | 5 minutes | 5 minutes |
| Workspace Members | 1 hour | 1 hour | 1 hour |
| User Preferences | 30 minutes | 30 minutes | Persistent |
| Search Results | 10 minutes | 10 minutes | - |
| Browse Pages | 1 hour | 1 hour | - |

## Performance Targets

### Cache Hit Rates
- **Workspace Data**: >90% (AC from story)
- **Law Lists**: >95% (AC from story)
- **Document Content**: >85%
- **User Sessions**: >99%

### Response Times
- **Cached Data**: <100ms (AC from story)
- **Cache Miss**: <500ms
- **Cache Warming**: <30s per workspace

### Memory Limits
- **Redis Total**: <150MB (AC from story)
- **Per Workspace**: <5MB
- **Client localStorage**: <10MB

## Monitoring & Debugging

### Cache Metrics
```typescript
import { getCacheMetrics } from '@/lib/cache/server-cache'

const metrics = getCacheMetrics()
console.log(`Hit rate: ${metrics.hitRate}%`)
console.log(`Avg latency: ${metrics.averageLatency}ms`)
```

### Cache Health Check
```typescript
import { monitorCacheHealth } from '@/lib/cache/server-cache'

const health = await monitorCacheHealth()
if (health.status === 'unhealthy') {
  // Alert or take corrective action
}
```

### Debug Headers
Add `?cache=bypass` to any URL to bypass cache (development only)

## Best Practices

### DO:
- ✅ Always include workspace isolation in cache keys
- ✅ Invalidate cache on data mutations
- ✅ Use appropriate TTLs based on data volatility
- ✅ Monitor cache hit rates and adjust TTLs
- ✅ Implement cache warming for critical paths
- ✅ Handle cache misses gracefully

### DON'T:
- ❌ Cache sensitive data without encryption
- ❌ Use overly long TTLs for frequently changing data
- ❌ Forget to invalidate related caches
- ❌ Ignore cache memory limits
- ❌ Block on cache operations (use async)

## Rollback Procedures

### Quick Disable
```bash
# Disable workspace caching via environment variable
ENABLE_WORKSPACE_CACHING=false vercel --prod
```

### Clear Cache
```bash
# Clear all Redis cache
redis-cli FLUSHALL

# Clear specific pattern
redis-cli --scan --pattern "workspace:*" | xargs redis-cli DEL
```

### Monitor Errors
```bash
# Check cache errors in logs
vercel logs --prod --filter="CACHE ERROR"
```

## Testing Cache

### Unit Tests
```typescript
// Test cache hit/miss behavior
describe('Cache', () => {
  it('should return cached data on second call', async () => {
    const result1 = await getCachedData('key')
    expect(result1.cached).toBe(false)
    
    const result2 = await getCachedData('key')
    expect(result2.cached).toBe(true)
  })
})
```

### Performance Tests
```typescript
// Verify sub-100ms response
it('should respond in <100ms for cached data', async () => {
  const start = performance.now()
  await getCachedData('key')
  const duration = performance.now() - start
  expect(duration).toBeLessThan(100)
})
```

### Integration Tests
```typescript
// Test cache invalidation
it('should invalidate cache on mutation', async () => {
  await getCachedData('key')
  await mutateData()
  const result = await getCachedData('key')
  expect(result.cached).toBe(false)
})
```

## Migration Guide

### Adding New Cache Layer
1. Define cache keys in appropriate module
2. Set appropriate TTL based on data type
3. Implement invalidation on mutations
4. Add monitoring metrics
5. Test hit rates and performance

### Updating Cache TTLs
1. Update constants in cache modules
2. Clear existing cache to apply new TTLs
3. Monitor hit rates after change
4. Adjust based on metrics

## Related Documentation
- [Performance Architecture](./22-performance-architecture.md)
- [Caching Strategy](./21-caching-strategy.md)
- [Story P.2](../stories/P.2.systematic-caching.story.md)