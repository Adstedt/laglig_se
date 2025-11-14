# 14. Deployment Architecture

## 14.1 Overview

Laglig.se uses **Vercel** for hosting with automatic deployments from GitHub. The architecture supports **preview deployments, staging, and production** environments with zero-downtime deployments.

**Deployment Flow:**

```
GitHub Push → Vercel Build → Deploy to CDN → Invalidate Cache
     ↓              ↓              ↓              ↓
PR Created    Type Check    Preview URL    Edge Network
     ↓          Lint          Available      Updated
Automatic     Test Run           ↓              ↓
Preview      Build App     Domain Routing   Global CDN
```

---

## 14.2 Environment Strategy

**Environment Types:**

| Environment | Branch     | URL                        | Purpose                |
| ----------- | ---------- | -------------------------- | ---------------------- |
| Development | -          | localhost:3000             | Local development      |
| Preview     | feature/\* | {branch}-laglig.vercel.app | PR previews            |
| Staging     | staging    | staging.laglig.se          | Pre-production testing |
| Production  | main       | laglig.se                  | Live application       |

**Environment Variables:**

```bash
# Vercel Dashboard Configuration
# Production
NEXT_PUBLIC_APP_URL=https://laglig.se
DATABASE_URL=postgresql://prod...
OPENAI_API_KEY=sk-prod...

# Staging
NEXT_PUBLIC_APP_URL=https://staging.laglig.se
DATABASE_URL=postgresql://staging...
OPENAI_API_KEY=sk-test...

# Preview (auto-injected)
NEXT_PUBLIC_VERCEL_URL=${VERCEL_URL}
```

---

## 14.3 CI/CD Pipeline

**GitHub Actions Workflow:**

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm typecheck

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm test:ci
      - run: pnpm test:e2e

  license-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npx license-checker --onlyAllow "MIT;Apache-2.0;BSD;ISC"
```

**Vercel Configuration:**

```json
// vercel.json
{
  "buildCommand": "pnpm build",
  "devCommand": "pnpm dev",
  "installCommand": "pnpm install",
  "framework": "nextjs",
  "outputDirectory": ".next",
  "crons": [
    {
      "path": "/api/cron/check-law-changes",
      "schedule": "0 1 * * *"
    },
    {
      "path": "/api/cron/generate-phase2-laws",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

---

## 14.4 Database Migrations

**Migration Strategy:**

```bash
# 1. Test migration locally
pnpm prisma migrate dev

# 2. Deploy to staging
git push origin staging

# 3. Run migration on staging
pnpm prisma migrate deploy --preview-feature

# 4. Verify staging
# Test application functionality

# 5. Deploy to production
git push origin main

# 6. Run production migration
pnpm prisma migrate deploy
```

**Rollback Plan:**

```bash
# Rollback to previous migration
pnpm prisma migrate resolve --rolled-back

# Revert deployment
vercel rollback
```

---

## 14.5 Monitoring & Alerts

**Health Checks:**

```typescript
// app/api/public/health/route.ts
export async function GET() {
  try {
    // Check database
    await prisma.$queryRaw`SELECT 1`

    // Check Redis
    await redis.ping()

    return Response.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return Response.json(
      { status: 'unhealthy', error: error.message },
      { status: 503 }
    )
  }
}
```

**Deployment Notifications:**

```yaml
# Slack webhook for deployment status
- name: Notify Slack
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: 'Deployment to ${{ env.ENVIRONMENT }} ${{ job.status }}'
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 14.6 CDN & Edge Configuration

**Static Asset Optimization:**

```javascript
// next.config.js
module.exports = {
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000, // 1 year
  },
  staticPageGenerationTimeout: 120,
  experimental: {
    isrMemoryCacheSize: 0, // Disable in-memory cache
  },
}
```

**Edge Middleware:**

```typescript
// middleware.ts
import { NextResponse } from 'next/server'

export function middleware(request: Request) {
  // Add security headers
  const response = NextResponse.next()
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  return response
}

export const config = {
  matcher: '/:path*',
}
```

---
