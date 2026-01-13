# Story P.3: Sprint 3 - Query Optimization

## Status
Draft

## Story
**As a** Laglig.se user,
**I want** search and data retrieval operations to be fast and efficient,
**so that** I can find legal information quickly without waiting for slow queries.

## Acceptance Criteria

### From STORY PERF-010: Optimize Prisma Queries
1. Reduce query complexity to max 2 levels of nesting
2. Implement query result pagination for all list endpoints
3. Add field selection to reduce payload sizes
4. Optimize N+1 query problems with proper includes
5. Query time reduced by >50% for complex operations

### From STORY PERF-011: Implement Database Connection Pooling
6. Configure PgBouncer for connection pooling
7. Set optimal pool size based on load testing
8. Implement connection retry logic
9. Monitor connection pool metrics
10. Reduce connection overhead by >40%

### From STORY PERF-012: Search Performance with Elasticsearch
11. Set up Elasticsearch for legal document search
12. Create search indices for documents and law lists
13. Implement fuzzy search and Swedish language support
14. Add search result highlighting
15. Search response time <100ms for 95% of queries

## Tasks / Subtasks

- [ ] **Task 1: Optimize Prisma Query Patterns** (AC: 1-5)
  - [ ] Audit all Prisma queries for deep nesting issues
  - [ ] Refactor queries to use max 2 levels of includes
  - [ ] Implement pagination using cursor-based approach
  - [ ] Add field selection using Prisma select
  - [ ] Fix N+1 queries with proper batching
  - [ ] Create query performance monitoring
  - [ ] Test query performance improvements

- [ ] **Task 2: Configure Database Connection Pooling** (AC: 6-10)
  - [ ] Install and configure PgBouncer
  - [ ] Update DATABASE_URL to use pooled connection
  - [ ] Configure pool size based on concurrent users
  - [ ] Implement exponential backoff retry logic
  - [ ] Add connection pool monitoring dashboard
  - [ ] Load test with 500 concurrent connections
  - [ ] Document pooling configuration

- [ ] **Task 3: Implement Elasticsearch Integration** (AC: 11-15)
  - [ ] Set up Elasticsearch Cloud instance
  - [ ] Create search index mappings for documents
  - [ ] Implement Swedish analyzer configuration
  - [ ] Build indexing pipeline for existing data
  - [ ] Create search API endpoints
  - [ ] Implement search result highlighting
  - [ ] Add fuzzy search tolerance
  - [ ] Test search performance and accuracy

- [ ] **Task 4: Query Performance Testing**
  - [ ] Create query performance test suite
  - [ ] Benchmark all major query patterns
  - [ ] Identify and fix slow queries (>500ms)
  - [ ] Test with production-size datasets
  - [ ] Document query optimization patterns

## Dev Notes

### Testing Standards
[Source: architecture/17-coding-standards.md]
- Performance tests must use production-like datasets
- Query tests should validate execution time <500ms
- Search tests must include Swedish language edge cases
- Connection pool tests require concurrent load simulation

### Previous Story Context
- Story P.1 added basic database indexes
- Story P.2 implemented caching layer
- This story focuses on query-level optimization
- Works in conjunction with caching for optimal performance

### Technical Stack Context
[Source: architecture/3-tech-stack.md]
- **Database:** Supabase PostgreSQL 15.1
- **ORM:** Prisma 5.12+ 
- **Search:** Elasticsearch 8.x (Cloud)
- **Connection Pooling:** PgBouncer
- **Query Monitor:** Prisma Metrics

### Query Optimization Patterns
[Source: architecture/22-performance-architecture.md#22.4]
```typescript
// Optimized Query Pattern
const optimizedQuery = await prisma.lawList.findMany({
  take: 50,
  cursor: { id: lastId },
  select: {
    id: true,
    title: true,
    items: {
      take: 10,
      select: {
        id: true,
        title: true,
        compliance_status: true
      }
    }
  }
})

// Avoid Deep Nesting
// BAD: 5 levels deep
const bad = await prisma.workspace.findUnique({
  include: {
    users: {
      include: {
        tasks: {
          include: {
            lawListItem: {
              include: {
                lawList: true
              }
            }
          }
        }
      }
    }
  }
})

// GOOD: 2 levels max
const good = await prisma.workspace.findUnique({
  include: {
    users: true,
    tasks: {
      select: {
        id: true,
        title: true,
        lawListItemId: true
      }
    }
  }
})
```

### Elasticsearch Configuration
[Source: architecture/22-performance-architecture.md#22.4.3]
```typescript
// Search Index Mapping
{
  "mappings": {
    "properties": {
      "title": {
        "type": "text",
        "analyzer": "swedish"
      },
      "content": {
        "type": "text",
        "analyzer": "swedish",
        "search_analyzer": "swedish_search"
      },
      "keywords": {
        "type": "keyword"
      },
      "created_at": {
        "type": "date"
      }
    }
  }
}
```

### Connection Pool Configuration
```typescript
// PgBouncer settings
DATABASE_URL="postgresql://user:pass@pgbouncer:6432/db?pgbouncer=true"
DATABASE_URL_NON_POOLED="postgresql://user:pass@db:5432/db"

// Prisma configuration
datasource db {
  provider = "postgresql"
  url = env("DATABASE_URL")
  directUrl = env("DATABASE_URL_NON_POOLED")
}
```

### Implementation Files
- `/lib/db/query-optimizer.ts` - Query optimization utilities
- `/lib/search/elasticsearch.ts` - Elasticsearch client
- `/lib/db/connection-pool.ts` - Connection pool management
- `/app/api/search/route.ts` - Search API endpoints
- `/prisma/schema.prisma` - Updated Prisma schema

### Performance Targets
- Query execution: <100ms P50, <500ms P95
- Search response: <100ms for 95% of queries
- Connection pool efficiency: >90% reuse rate
- Concurrent connections: Support 500+ simultaneous

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