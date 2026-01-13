# Story P.2: Sprint 2 - Systematic Caching Implementation

## Status
Draft

## Story
**As a** Laglig.se user,
**I want** consistent and fast loading times for frequently accessed content,
**so that** my experience is smooth and responsive across all application areas.

## Acceptance Criteria

### From STORY PERF-006: Server-Side Caching Layer
1. Implement Next.js unstable_cache for server functions
2. Configure cache tags for invalidation groups
3. Create cache utility functions in `/lib/cache/`
4. Add cache monitoring and hit rate tracking
5. Document caching patterns for team

### From STORY PERF-007: Database Query Result Caching
6. Implement Redis caching for expensive database queries
7. Create cache key generation strategy
8. Add TTL configuration per query type
9. Implement cache warming for critical queries
10. Monitor cache memory usage stays under 100MB

### From STORY PERF-008: Static Asset Optimization
11. Configure Next.js Image optimization
12. Implement lazy loading for below-fold images
13. Add WebP format support with fallbacks
14. Optimize font loading with font-display: swap
15. Bundle size reduced by >20%

### From STORY PERF-009: Edge Function Implementation
16. Move auth checks to edge middleware
17. Implement rate limiting at edge
18. Add geo-routing for EU users
19. Response time improvement of >30% for auth flows
20. Zero increase in cold start times

## Tasks / Subtasks

- [ ] **Task 1: Implement Server-Side Caching Layer** (AC: 1-5)
  - [ ] Install and configure unstable_cache dependencies
  - [ ] Create base cache utility functions in `/lib/cache/server-cache.ts`
  - [ ] Implement cache tag system for grouped invalidation
  - [ ] Add cache wrapper functions for common server actions
  - [ ] Create monitoring dashboard component for cache metrics
  - [ ] Write documentation in `/docs/architecture/cache-patterns.md`
  - [ ] Add unit tests for cache utilities

- [ ] **Task 2: Setup Redis Query Caching** (AC: 6-10)
  - [ ] Configure Upstash Redis client in `/lib/cache/redis-client.ts`
  - [ ] Implement cache key generator with workspace isolation
  - [ ] Create query caching middleware for Prisma
  - [ ] Configure TTL settings per entity type
  - [ ] Implement cache warming job for law lists and documents
  - [ ] Add memory usage monitoring alerts
  - [ ] Test cache invalidation patterns

- [ ] **Task 3: Optimize Static Assets** (AC: 11-15)
  - [ ] Configure next.config.js for image optimization
  - [ ] Replace img tags with Next.js Image components
  - [ ] Implement IntersectionObserver for lazy loading
  - [ ] Setup WebP conversion pipeline
  - [ ] Optimize font loading in _document.tsx
  - [ ] Analyze and reduce JavaScript bundle sizes
  - [ ] Run Lighthouse performance audit

- [ ] **Task 4: Implement Edge Functions** (AC: 16-20)
  - [ ] Create middleware.ts for edge function routing
  - [ ] Move authentication logic to edge middleware
  - [ ] Implement rate limiting with sliding window
  - [ ] Add geo-based routing for EU compliance
  - [ ] Test cold start performance impact
  - [ ] Configure edge function monitoring
  - [ ] Load test edge functions with 1000 req/s

- [ ] **Task 5: Integration Testing and Monitoring**
  - [ ] Write integration tests for cached endpoints
  - [ ] Create cache performance dashboard
  - [ ] Test cache invalidation scenarios
  - [ ] Verify memory usage stays within limits
  - [ ] Document cache debugging procedures
  - [ ] Run full E2E test suite with caching enabled

## Dev Notes

### Testing Standards
[Source: architecture/17-coding-standards.md]
- Test files location: `__tests__` directories adjacent to source files
- Testing framework: Vitest for unit/integration tests
- E2E framework: Playwright for end-to-end tests
- Cache tests must validate TTL and invalidation logic
- Performance tests must measure cache hit rates

### Previous Story Context
- Story P.1 implemented emergency fixes and basic caching
- This story builds systematic caching on that foundation
- Focus on consistency and monitoring across all cache layers

### Technical Stack Context
[Source: architecture/3-tech-stack.md]
- **Cache Provider:** Upstash Redis (serverless, EU region)
- **Framework:** Next.js 16 with App Router
- **Edge Runtime:** Vercel Edge Functions
- **Image CDN:** Vercel Image Optimization API
- **Monitoring:** Vercel Analytics + Custom Metrics

### Cache Configuration Standards
[Source: architecture/22-performance-architecture.md#22.3]
```typescript
// Cache TTL Configuration
export const CACHE_TTL = {
  LEGAL_DOCUMENTS: 86400,  // 24 hours
  LAW_LISTS: 300,          // 5 minutes
  TASKS: 60,               // 1 minute
  USER_PREFERENCES: 300,    // 5 minutes
  WORKSPACE_DATA: 120,      // 2 minutes
}

// Cache Tags for Invalidation
export const CACHE_TAGS = {
  WORKSPACE: (id: string) => `workspace:${id}`,
  USER: (id: string) => `user:${id}`,
  DOCUMENT: (id: string) => `doc:${id}`,
  LAW_LIST: (id: string) => `list:${id}`,
}
```

### Edge Function Configuration
[Source: architecture/22-performance-architecture.md#22.5]
```typescript
// middleware.ts structure
export const config = {
  matcher: [
    '/api/auth/:path*',
    '/api/workspace/:path*',
    '/((?!_next/static|favicon.ico).*)',
  ],
}
```

### Implementation Files
- `/lib/cache/server-cache.ts` - Server-side caching utilities
- `/lib/cache/redis-client.ts` - Redis client configuration
- `/lib/cache/strategies.ts` - Cache strategy implementations
- `/middleware.ts` - Edge function implementations
- `/next.config.js` - Image optimization config

### Critical Performance Targets
- Cache hit rate: >80% for document content
- Memory usage: <100MB Redis memory
- Edge function response: <50ms P95
- Image loading: <200ms for above-fold images

## Change Log
| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-01-13 | 1.0 | Initial story creation | Bob (Scrum Master) |

## Dev Agent Record

### Agent Model Used
*To be filled by dev agent*

### Debug Log References
*To be filled by dev agent*

### Completion Notes List
*To be filled by dev agent*

### File List
*To be filled by dev agent*

## QA Results
*To be filled by QA agent*