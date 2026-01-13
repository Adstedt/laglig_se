# Caching Architecture for Laglig.se

## Overview

Laglig.se implements a **unified, document-centric caching strategy** that maximizes performance across all document access patterns while minimizing cache duplication and storage costs.

## Key Principles

### 1. Document-Centric Caching
- **Single Source of Truth**: Each legal document's HTML content is cached once in Redis
- **Shared Across All Access Patterns**: The same cached content serves:
  - Public browsing (`/rattskallor`)
  - User law lists (modal views)
  - Search results
  - Document detail pages
  - API endpoints

### 2. Separation of Concerns
- **Document Content**: Cached for 24 hours (rarely changes)
- **List Item Metadata**: Cached for 1 hour (user-specific data)
- **Browse Results**: Cached for 5 minutes (frequently updated)

## Architecture

```
┌─────────────────────────────────────────────┐
│              User Request                   │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│         Application Layer                   │
│  ┌────────────────────────────────────┐     │
│  │  getCachedDocument(documentId)     │     │
│  └────────────┬───────────────────────┘     │
│               │                              │
│               ▼                              │
│  ┌────────────────────────────────────┐     │
│  │     Redis Cache Check              │     │
│  │  Key: document:{documentId}        │     │
│  └────────────┬───────────────────────┘     │
│               │                              │
│        HIT ───┴─── MISS                     │
│         │           │                        │
│         ▼           ▼                        │
│    Return      Fetch from DB                 │
│    Cached      & Cache Result                │
└─────────────────────────────────────────────┘
```

## Cache Keys Structure

### Document Content
```
document:{documentId}
├── id
├── documentNumber
├── title
├── htmlContent (main content)
├── summary
├── slug
├── status
├── sourceUrl
├── contentType
└── effectiveDate
```

### Lookup Mappings (for quick access)
```
document:slug:{slug} → documentId
document:number:{documentNumber} → documentId
```

### List Item Cache (without HTML to avoid duplication)
```
list-item-details:{listItemId}
├── id
├── position
├── complianceStatus
├── businessContext
├── document (metadata only, no HTML)
├── lawList
└── responsibleUser
```

## Implementation Details

### 1. Centralized Document Cache Service
Located at: `/lib/services/document-cache.ts`

**Key Functions:**
- `getCachedDocument(documentId)` - Main entry point
- `getCachedDocumentBySlug(slug)` - For public browsing
- `getCachedDocumentByNumber(number)` - For direct lookups
- `getCachedDocuments(ids[])` - Batch fetching
- `warmDocumentCache(limit)` - Pre-cache popular documents

### 2. Cache TTL Strategy

| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| Document HTML | 24 hours | Legal documents rarely change |
| List Item Metadata | 1 hour | User-specific, moderate changes |
| Browse Results | 5 minutes | Frequently updated listings |
| Document Lookups | 24 hours | Stable mappings |

### 3. Cache Warming

**Automatic Warming:**
- Popular documents (most frequently in law lists)
- Recently accessed documents
- Can be triggered via cron job

**Script:** `/scripts/warm-document-cache.ts`
```bash
npx tsx scripts/warm-document-cache.ts
```

## Performance Benefits

### Before Optimization
- Modal load time: **8 seconds**
- Every user fetches document HTML from database
- No cross-user benefit

### After Optimization
- Modal load time: **~1 second** (86% improvement)
- First user caches for all users
- Shared cache across all access patterns

### Cache Hit Scenarios

1. **User A** browses law SFS 1977:1160 publicly
   - Document cached for 24 hours
   
2. **User B** opens same law in their law list modal
   - Instant load from cache (no DB query)
   
3. **User C** searches and finds the same law
   - Instant snippet generation from cached HTML

## Monitoring & Metrics

### Key Metrics to Track
- Cache hit rate (target: >80%)
- Average response time by cache status
- Cache size and memory usage
- Popular documents (for warming strategy)

### Logging
```
⚡ Cache HIT for document: abc123...
📊 Cache MISS - fetching from database
💾 Document cached: abc123... (24h TTL)
```

## Future Optimizations

### 1. Edge Caching
- Deploy Redis to same region as application
- Consider Vercel KV for edge locations

### 2. Intelligent Pre-fetching
- Predict next document based on user behavior
- Pre-fetch related documents

### 3. Differential Caching
- Cache document sections separately
- Update only changed sections

### 4. Compression
- Compress HTML content before caching
- Reduce memory usage by ~70%

## Deployment Checklist

- [x] Redis configured (Upstash)
- [x] Environment variables set
- [x] Database indexes created
- [x] Centralized cache service implemented
- [x] Modal views using centralized cache
- [ ] Public browsing using centralized cache
- [ ] Cache warming cron job
- [ ] Monitoring dashboard

## Troubleshooting

### Cache Not Working?
1. Check Redis connection: `npx tsx scripts/test-redis-client.ts`
2. Verify environment variables
3. Check cache keys: `npx tsx scripts/check-redis-keys.ts`
4. Monitor logs for cache hit/miss messages

### Performance Still Slow?
1. Check database indexes
2. Verify cache TTL settings
3. Analyze slow queries in logs
4. Consider increasing cache warming limit