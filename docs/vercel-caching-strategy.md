# Production Caching Strategy for Vercel

## The Challenge

Vercel uses serverless functions that:
- Cold start on first request
- Shut down after inactivity
- Scale independently
- Don't share memory

## Best Practices for Vercel

### 1. Edge Caching (Built-in, Free)
```typescript
// Use Next.js built-in caching
export const revalidate = 3600 // Cache page for 1 hour

// Or use Cache-Control headers
res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate')
```

### 2. Redis with Upstash (Your Current Setup) ✅
- Perfect for serverless
- Persists across function invocations
- Shared across all users

### 3. Proper Cache Warming for Vercel

#### Option A: Cron Job Warming (Recommended)
```typescript
// app/api/cron/warm-cache/route.ts
import { warmDocumentCache } from '@/lib/services/document-cache'

export async function GET(request: Request) {
  // Verify cron secret (Vercel Cron or GitHub Actions)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  await warmDocumentCache(50)
  return new Response('Cache warmed', { status: 200 })
}
```

**vercel.json:**
```json
{
  "crons": [{
    "path": "/api/cron/warm-cache",
    "schedule": "0 */6 * * *"  // Every 6 hours
  }]
}
```

#### Option B: On-Demand Warming
```typescript
// Warm cache when first user hits the site
export async function middleware(request: NextRequest) {
  // Only on homepage or key pages
  if (request.nextUrl.pathname === '/') {
    // Check if cache is cold (non-blocking)
    checkAndWarmCache()
  }
}
```

#### Option C: ISR (Incremental Static Regeneration)
```typescript
// Pre-render popular pages at build time
export async function generateStaticParams() {
  // Return top 100 law pages to pre-render
  const popularLaws = await getPopularLaws()
  return popularLaws.map(law => ({
    slug: law.slug
  }))
}

// Revalidate every hour
export const revalidate = 3600
```

### 4. Vercel Edge Config (Alternative to Redis)
```typescript
import { get } from '@vercel/edge-config'

// Faster than Redis for read-heavy data
const config = await get('popularDocuments')
```

## Recommended Architecture for Laglig.se on Vercel

### Tier 1: Edge Cache (Fastest)
- Static pages with ISR
- Cache-Control headers
- CDN level caching

### Tier 2: Redis (Fast)
- Document content
- User-specific data
- Cross-request caching

### Tier 3: Database (Slowest)
- Source of truth
- Write operations

## Implementation Priority

1. **Keep current Redis setup** ✅ - It's already correct
2. **Add cron job for cache warming** - Runs every few hours
3. **Use ISR for popular pages** - Pre-render at build time
4. **Add Cache-Control headers** - Leverage Vercel's edge cache

## Cost Optimization

### Current Setup Costs (Monthly)
- Upstash Redis: ~$0-10 (pay per request)
- Vercel Cron: Free (included)
- Edge Cache: Free (included)
- Total: **< $10/month**

### What NOT to Do on Vercel
❌ Long-running background tasks in functions
❌ In-memory caching (lost on cold start)
❌ Assuming persistent server state
❌ Cache warming on every request

## Environment Variables for Production

```env
# Vercel automatically injects these
VERCEL=1
VERCEL_ENV=production

# Your Redis (already set)
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# Cron secret for cache warming
CRON_SECRET=random-secret-string

# Disable instrumentation warming on Vercel
ENABLE_CACHE_WARMING=false  # Don't use instrumentation.ts warming
```

## Testing on Vercel

```bash
# Deploy to preview
vercel

# Check function logs
vercel logs

# Monitor cache hit rates
# Upstash dashboard shows metrics
```