# Performance Fix Plan for Laglig.se

## Critical Issues Found

### 1. Legal Document Modal (10s load time)
- **Problem**: Loading entire HTML content (can be 1-2MB) from database on every open
- **Impact**: Each law list item click = 10 second wait
- **Solution**: Implement document caching (24hr cache for immutable law HTML)

### 2. Tasks Page (Frozen/Unresponsive)
- **Problems**:
  - Loading ALL tasks with nested relations on every page load
  - No caching on any queries
  - Heavy client-side props (passing huge arrays)
  - Re-rendering everything on tab switches
- **Impact**: Page almost unusable, tabs frozen
- **Solutions**:
  - Cache tasks (1 min), columns (1hr), members (1hr)
  - Implement pagination/virtualization for large task lists
  - Memoize client components

### 3. Overall Caching Strategy Missing
- **Problem**: Every page load hits database directly
- **Impact**: Slow response times, high database costs, poor scalability
- **Solution**: Comprehensive caching layer with appropriate TTLs

## Implementation Priority

### Phase 1: Emergency Fixes (Do Now)
1. Cache legal document HTML (24hr) - fixes 10s modal load
2. Cache task queries (1 min) - unblocks frozen tasks page
3. Cache workspace members & columns (1hr) - reduces DB load

### Phase 2: Optimization (This Week)
1. Implement query result pagination
2. Add client-side memoization
3. Setup cache warming for popular documents
4. Add compression for HTML transfer

### Phase 3: Long-term (Next Sprint)
1. Move document HTML to CDN
2. Implement Redis for distributed caching
3. Add database read replicas
4. Consider edge caching with Vercel

## Cache Duration Strategy

| Data Type | Cache Duration | Reason |
|-----------|---------------|---------|
| Legal Documents HTML | 24 hours | Immutable content |
| Workspace Members | 1 hour | Rarely changes |
| Task Columns | 1 hour | Rarely changes |
| Law List Items | 5 minutes | Balance freshness |
| Tasks | 1 minute | Changes frequently |
| Dashboard | 1 minute | Needs fresh stats |
| Comments/Activity | 10 seconds | Near real-time |

## Expected Results
- Legal document modal: 10s → <500ms (after first load)
- Tasks page: Frozen → <1s load time
- Navigation: 2-3s → <200ms
- Database queries: -80% reduction
- Cost savings: ~50% reduction in Supabase usage