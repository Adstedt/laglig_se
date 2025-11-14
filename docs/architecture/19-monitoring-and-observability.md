# 19. Monitoring and Observability

## 19.1 Overview

The monitoring strategy provides **real-time visibility** into system health, performance, and user behavior, enabling proactive issue detection and data-driven optimization.

**Monitoring Stack:**

```
Application → Metrics → Alerts → Dashboard
     ↓          ↓         ↓         ↓
  Sentry    Vercel    Upstash   Custom
  Errors   Analytics  Redis     Metrics
     ↓          ↓         ↓         ↓
           Unified Dashboard
```

---

## 19.2 Key Metrics

**Business Metrics:**

```typescript
// lib/metrics/business.ts
export const trackBusinessMetrics = {
  userSignup: (tier: string) => {
    logger.metric('user.signup', 1, { tier })
  },

  lawViewed: (lawId: string, source: string) => {
    logger.metric('law.viewed', 1, { lawId, source })
  },

  aiQueryCompleted: (workspaceId: string, cached: boolean) => {
    logger.metric('ai.query.completed', 1, {
      workspaceId,
      cached: cached.toString(),
    })
  },

  subscriptionCreated: (tier: string, mrr: number) => {
    logger.metric('subscription.created', 1, { tier })
    logger.metric('mrr.added', mrr)
  },

  employeeAdded: (workspaceId: string, count: number) => {
    logger.metric('employees.added', count, { workspaceId })
  },
}
```

**Technical Metrics:**

```typescript
// lib/metrics/technical.ts
export const trackTechnicalMetrics = {
  apiLatency: (endpoint: string, duration: number) => {
    logger.metric('api.latency', duration, { endpoint })
  },

  databaseQuery: (operation: string, duration: number) => {
    logger.metric('db.query.duration', duration, { operation })
  },

  cacheHitRate: (hit: boolean, type: string) => {
    logger.metric(`cache.${hit ? 'hit' : 'miss'}`, 1, { type })
  },

  errorRate: (errorType: string, endpoint: string) => {
    logger.metric('error.count', 1, { errorType, endpoint })
  },
}
```

---

## 19.3 Application Performance Monitoring

**Sentry Configuration:**

```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  profilesSampleRate: 0.1,
  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  beforeSend(event, hint) {
    // Filter out non-critical errors
    if (event.exception?.values?.[0]?.type === 'NetworkError') {
      return null
    }
    return event
  },
})
```

**Performance Tracking:**

```typescript
// lib/performance.ts
export function measurePerformance(name: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const start = performance.now()

      try {
        const result = await originalMethod.apply(this, args)
        const duration = performance.now() - start

        logger.metric(`performance.${name}`, duration)

        if (duration > 1000) {
          logger.warn(`Slow operation: ${name} took ${duration}ms`)
        }

        return result
      } catch (error) {
        const duration = performance.now() - start
        logger.metric(`performance.${name}.error`, duration)
        throw error
      }
    }

    return descriptor
  }
}

// Usage
class LawService {
  @measurePerformance('law.fetch')
  async getLaw(id: string) {
    return await prisma.law.findUnique({ where: { id } })
  }
}
```

---

## 19.4 Infrastructure Monitoring

**Health Checks:**

```typescript
// app/api/health/route.ts
export async function GET() {
  const checks = {
    database: false,
    redis: false,
    openai: false,
    timestamp: new Date().toISOString(),
  }

  // Check database
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = true
  } catch (error) {
    logger.error('Health check: Database failed', error as Error)
  }

  // Check Redis
  try {
    await redis.ping()
    checks.redis = true
  } catch (error) {
    logger.error('Health check: Redis failed', error as Error)
  }

  // Check OpenAI
  try {
    await openai.models.list()
    checks.openai = true
  } catch (error) {
    logger.error('Health check: OpenAI failed', error as Error)
  }

  const allHealthy = Object.values(checks).every(
    (v) => v === true || typeof v === 'string'
  )

  return Response.json(checks, {
    status: allHealthy ? 200 : 503,
    headers: {
      'Cache-Control': 'no-cache',
    },
  })
}
```

**Cron Job Monitoring:**

```typescript
// app/api/cron/check-law-changes/route.ts
export async function GET(request: Request) {
  const jobId = crypto.randomUUID()

  logger.info('Cron job started', {
    job: 'check-law-changes',
    jobId,
  })

  try {
    const startTime = Date.now()

    // Check in with Sentry
    const checkIn = Sentry.captureCheckIn({
      monitorSlug: 'law-change-detection',
      status: 'in_progress',
    })

    const changes = await detectLawChanges()

    logger.metric('cron.law_changes.detected', changes.length)
    logger.metric('cron.law_changes.duration', Date.now() - startTime)

    // Report success
    Sentry.captureCheckIn({
      checkInId: checkIn,
      monitorSlug: 'law-change-detection',
      status: 'ok',
      duration: Date.now() - startTime,
    })

    return Response.json({
      success: true,
      changes: changes.length,
      duration: Date.now() - startTime,
    })
  } catch (error) {
    logger.error('Cron job failed', error as Error, { jobId })

    Sentry.captureCheckIn({
      monitorSlug: 'law-change-detection',
      status: 'error',
    })

    throw error
  }
}
```

---

## 19.5 User Analytics

**Vercel Analytics Integration:**

```typescript
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
```

**Custom Event Tracking:**

```typescript
// lib/analytics.ts
import { track } from '@vercel/analytics'

export const analytics = {
  pageView: (page: string) => {
    track('page_view', { page })
  },

  userAction: (action: string, metadata?: any) => {
    track(action, metadata)
  },

  conversionEvent: (event: string, value?: number) => {
    track(event, { value })
  },
}

// Usage
analytics.userAction('law_bookmarked', {
  lawId: law.id,
  category: law.category,
})

analytics.conversionEvent('trial_started', 0)
analytics.conversionEvent('subscription_created', 299)
```

---

## 19.6 Cost Monitoring

**OpenAI Usage Tracking:**

```typescript
// lib/monitoring/costs.ts
export async function trackOpenAIUsage(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cached: boolean
) {
  const costs = {
    'gpt-4-turbo-preview': {
      input: 0.01 / 1000, // $0.01 per 1K tokens
      output: 0.03 / 1000, // $0.03 per 1K tokens
    },
    'text-embedding-3-small': {
      input: 0.00002 / 1000, // $0.02 per 1M tokens
      output: 0,
    },
  }

  const cost = cached
    ? 0
    : inputTokens * costs[model].input + outputTokens * costs[model].output

  await prisma.aiUsageLog.create({
    data: {
      model,
      inputTokens,
      outputTokens,
      costUsd: cost,
      cached,
    },
  })

  logger.metric('openai.cost', cost * 100, { model, cached: cached.toString() })

  // Alert if daily spend exceeds threshold
  const todaySpend = await getTodayOpenAISpend()
  if (todaySpend > 100) {
    await notifyOps('OpenAI daily spend exceeded $100', { spend: todaySpend })
  }
}
```

**Database Size Monitoring:**

```sql
-- Monitor database growth
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Monitor Supabase storage
SELECT
  bucket_id,
  COUNT(*) as file_count,
  SUM(metadata->>'size')::bigint as total_bytes
FROM storage.objects
GROUP BY bucket_id;
```

---

## 19.7 Alerting Strategy

**Alert Configuration:**

```typescript
// lib/monitoring/alerts.ts
interface AlertRule {
  name: string
  query: string
  threshold: number
  duration: string
  severity: 'critical' | 'warning' | 'info'
  notify: string[]
}

const alertRules: AlertRule[] = [
  {
    name: 'High Error Rate',
    query: 'error.count > 100',
    threshold: 100,
    duration: '5m',
    severity: 'critical',
    notify: ['slack', 'pagerduty'],
  },
  {
    name: 'Low Cache Hit Rate',
    query: 'cache.hit.rate < 0.5',
    threshold: 0.5,
    duration: '15m',
    severity: 'warning',
    notify: ['slack'],
  },
  {
    name: 'High AI Costs',
    query: 'openai.daily.cost > 100',
    threshold: 100,
    duration: '1h',
    severity: 'warning',
    notify: ['email', 'slack'],
  },
  {
    name: 'Database Connection Pool Exhausted',
    query: 'db.connections.available < 2',
    threshold: 2,
    duration: '1m',
    severity: 'critical',
    notify: ['slack', 'pagerduty'],
  },
]
```

**Notification Channels:**

```typescript
// lib/monitoring/notifications.ts
export async function notifyOps(
  message: string,
  data?: any,
  severity: 'info' | 'warning' | 'critical' = 'warning'
) {
  // Slack notification
  if (severity !== 'info') {
    await fetch(process.env.SLACK_WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🚨 ${severity.toUpperCase()}: ${message}`,
        attachments: [
          {
            color: severity === 'critical' ? 'danger' : 'warning',
            fields: Object.entries(data || {}).map(([k, v]) => ({
              title: k,
              value: String(v),
              short: true,
            })),
          },
        ],
      }),
    })
  }

  // PagerDuty for critical
  if (severity === 'critical') {
    await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: process.env.PAGERDUTY_TOKEN!,
      },
      body: JSON.stringify({
        routing_key: process.env.PAGERDUTY_ROUTING_KEY,
        event_action: 'trigger',
        payload: {
          summary: message,
          severity: 'critical',
          source: 'laglig.se',
          custom_details: data,
        },
      }),
    })
  }
}
```

---

## 19.8 Dashboard and Reporting

**Metrics Dashboard Example:**

```typescript
// app/admin/metrics/page.tsx
export default async function MetricsPage() {
  const metrics = await getMetrics()

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Active Users (7d)"
        value={metrics.activeUsers}
        change={metrics.activeUsersChange}
      />

      <MetricCard
        title="AI Queries Today"
        value={metrics.aiQueries}
        subtitle={`Cache Hit: ${metrics.cacheHitRate}%`}
      />

      <MetricCard
        title="Daily Cost"
        value={`$${metrics.dailyCost.toFixed(2)}`}
        subtitle={`AI: $${metrics.aiCost}, DB: $${metrics.dbCost}`}
      />

      <MetricCard
        title="Error Rate"
        value={`${metrics.errorRate}%`}
        status={metrics.errorRate > 1 ? 'warning' : 'good'}
      />
    </div>
  )
}
```

---
