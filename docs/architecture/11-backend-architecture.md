# 11. Backend Architecture

## 11.1 Overview

The Laglig.se backend leverages **Vercel's serverless infrastructure** with **Next.js 16 API Routes and Server Actions** to deliver a scalable, cost-effective architecture supporting 170,000+ legal documents, AI-powered RAG queries, and real-time collaboration features. The backend follows a **hybrid API approach**: Server Actions for internal mutations (90%) and REST endpoints for external integrations (10%).

**Core Architecture Principles:**

- **Serverless-First:** Zero idle costs, automatic scaling, no server management
- **Type-Safe Mutations:** Server Actions provide end-to-end TypeScript safety
- **Database-Centric:** Prisma ORM with PostgreSQL for all business logic
- **Edge-Optimized:** Upstash Redis and Vercel Edge Functions for low latency
- **Security-by-Default:** Authentication at every layer, input validation, rate limiting

**Request Flow:**

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Request                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Vercel Edge Network                        │
│                  (CDN, DDoS Protection)                      │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│   Server Components      │  │   API Routes/Actions      │
│   (SSR/RSC)             │  │   (Serverless Functions)  │
└──────────────────────────┘  └──────────────────────────┘
                    │                   │
                    └─────────┬─────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Supabase    │  │  Upstash     │  │   OpenAI     │     │
│  │  PostgreSQL  │  │   Redis      │  │   GPT-4      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## 11.2 API Architecture

### 11.2.1 Server Actions (90% of Mutations)

Server Actions handle all internal user-facing mutations with built-in benefits:

- **Type Safety:** Input/output types shared between client and server
- **CSRF Protection:** Automatic token validation
- **Progressive Enhancement:** Works without JavaScript
- **Optimistic Updates:** Built-in revalidation

**Server Action Pattern:**

```typescript
// app/actions/law-actions.ts
'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

// Input validation schema
const UpdateLawStatusSchema = z.object({
  lawId: z.string().uuid(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'COMPLIANT', 'NON_COMPLIANT']),
})

export async function updateLawStatus(
  input: z.infer<typeof UpdateLawStatusSchema>
) {
  // 1. Validate input
  const validated = UpdateLawStatusSchema.parse(input)

  // 2. Authenticate
  const session = await getServerSession()
  if (!session?.user) {
    throw new Error('Unauthorized')
  }

  // 3. Authorize (workspace access)
  const law = await prisma.lawInWorkspace.findFirst({
    where: {
      id: validated.lawId,
      workspaceId: session.user.workspaceId,
    },
  })

  if (!law) {
    throw new Error('Law not found or access denied')
  }

  // 4. Execute mutation
  const updated = await prisma.lawInWorkspace.update({
    where: { id: validated.lawId },
    data: {
      status: validated.status,
      updatedBy: session.user.id,
    },
  })

  // 5. Revalidate cache
  revalidatePath('/dashboard')
  revalidatePath(`/laws/${law.lawId}`)

  // 6. Return typed response
  return {
    success: true,
    law: updated,
  }
}
```

**Client Usage:**

```typescript
// components/law-status-updater.tsx
"use client"

import { updateLawStatus } from '@/app/actions/law-actions'
import { useTransition } from 'react'

export function LawStatusUpdater({ lawId, currentStatus }) {
  const [isPending, startTransition] = useTransition()

  const handleStatusChange = (newStatus: string) => {
    startTransition(async () => {
      const result = await updateLawStatus({
        lawId,
        status: newStatus
      })

      if (!result.success) {
        toast.error('Failed to update status')
      }
    })
  }

  return (
    <select
      onChange={(e) => handleStatusChange(e.target.value)}
      disabled={isPending}
    >
      {/* Status options */}
    </select>
  )
}
```

### 11.2.2 REST API Routes (10% - External Integrations)

REST endpoints handle webhooks, public API, and cron jobs:

**Webhook Pattern (Stripe):**

```typescript
// app/api/webhooks/stripe/route.ts
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { handleSubscriptionUpdate } from '@/lib/billing'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export async function POST(req: Request) {
  const body = await req.text()
  const signature = headers().get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    return new Response('Webhook signature verification failed', {
      status: 400,
    })
  }

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdate(event.data.object)
      break
    // Handle other events
  }

  return new Response('Webhook processed', { status: 200 })
}
```

**Cron Job Pattern:**

```typescript
// app/api/cron/check-law-changes/route.ts
export const runtime = 'nodejs' // Long-running job
export const maxDuration = 300 // 5 minutes

export async function GET(request: Request) {
  // Verify cron secret (Vercel Cron)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Execute law change detection
  const changes = await detectLawChanges()
  await generateAISummaries(changes)
  await sendNotifications(changes)

  return Response.json({
    processed: changes.length,
    timestamp: new Date().toISOString(),
  })
}
```

---

## 11.3 Database Access Patterns

### 11.3.1 Prisma Configuration

```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

### 11.3.2 Common Query Patterns

**Multi-Tenant Data Isolation:**

```typescript
// Always filter by workspaceId
export async function getWorkspaceLaws(workspaceId: string) {
  return prisma.lawInWorkspace.findMany({
    where: {
      workspaceId,
      isActive: true,
    },
    include: {
      law: {
        select: {
          title: true,
          documentNumber: true,
          lastUpdated: true,
        },
      },
      assignments: {
        include: {
          employee: true,
        },
      },
    },
    orderBy: {
      priority: 'desc',
    },
  })
}
```

**Optimistic Locking Pattern:**

```typescript
// Prevent concurrent updates
export async function updateTaskWithLock(
  taskId: string,
  updates: Partial<Task>,
  expectedVersion: number
) {
  const result = await prisma.task.updateMany({
    where: {
      id: taskId,
      version: expectedVersion, // Optimistic lock
    },
    data: {
      ...updates,
      version: { increment: 1 },
    },
  })

  if (result.count === 0) {
    throw new Error('Task was modified by another user')
  }

  return prisma.task.findUnique({ where: { id: taskId } })
}
```

**Batch Operations:**

```typescript
// Efficient bulk inserts
export async function createLawEmbeddings(
  embeddings: Array<{ lawId: string; chunk: string; vector: number[] }>
) {
  // Use transaction for atomicity
  return prisma.$transaction(async (tx) => {
    // Delete old embeddings
    await tx.lawEmbedding.deleteMany({
      where: {
        lawId: { in: embeddings.map((e) => e.lawId) },
      },
    })

    // Insert new embeddings
    await tx.lawEmbedding.createMany({
      data: embeddings.map((e) => ({
        lawId: e.lawId,
        chunk: e.chunk,
        embedding: e.vector,
      })),
    })
  })
}
```

### 11.3.3 Vector Search Pattern

```typescript
// pgvector similarity search
export async function searchSimilarLaws(
  queryEmbedding: number[],
  limit: number = 10
) {
  const results = await prisma.$queryRaw<
    Array<{
      id: string
      title: string
      chunk: string
      similarity: number
    }>
  >`
    SELECT
      l.id,
      l.title,
      le.chunk,
      1 - (le.embedding <=> ${queryEmbedding}::vector) as similarity
    FROM law_embeddings le
    JOIN laws l ON le.law_id = l.id
    ORDER BY le.embedding <=> ${queryEmbedding}::vector
    LIMIT ${limit}
  `

  return results
}
```

---

## 11.4 Authentication & Authorization

### 11.4.1 Authentication Flow

```typescript
// lib/auth.ts
import { NextAuthOptions } from 'next-auth'
import { SupabaseAdapter } from '@auth/supabase-adapter'
import EmailProvider from 'next-auth/providers/email'
import GoogleProvider from 'next-auth/providers/google'

export const authOptions: NextAuthOptions = {
  adapter: SupabaseAdapter({
    url: process.env.SUPABASE_URL!,
    secret: process.env.SUPABASE_SERVICE_KEY!,
  }),

  providers: [
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: process.env.EMAIL_SERVER_PORT,
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: 'noreply@laglig.se',
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  callbacks: {
    async session({ session, token }) {
      // Add workspace and role to session
      const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        include: {
          workspaceMemberships: {
            where: { isActive: true },
            include: { workspace: true },
          },
        },
      })

      session.user.id = user.id
      session.user.workspaceId = user.workspaceMemberships[0]?.workspaceId
      session.user.role = user.workspaceMemberships[0]?.role

      return session
    },
  },

  pages: {
    signIn: '/login',
    error: '/auth/error',
    verifyRequest: '/auth/verify',
  },
}
```

### 11.4.2 Authorization Middleware

```typescript
// middleware.ts
import { withAuth } from 'next-auth/middleware'

export default withAuth({
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized: ({ token, req }) => {
      // Public routes
      if (req.nextUrl.pathname.startsWith('/lagar')) return true
      if (req.nextUrl.pathname.startsWith('/api/public')) return true

      // Protected routes require authentication
      return !!token
    },
  },
})

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/hr/:path*',
    '/settings/:path*',
    '/api/((?!public|webhooks|cron).*)',
  ],
}
```

### 11.4.3 Role-Based Access Control

```typescript
// lib/rbac.ts
export enum Permission {
  VIEW_DASHBOARD = 'view:dashboard',
  EDIT_LAWS = 'edit:laws',
  MANAGE_EMPLOYEES = 'manage:employees',
  ADMIN_WORKSPACE = 'admin:workspace',
}

const rolePermissions: Record<string, Permission[]> = {
  VIEWER: [Permission.VIEW_DASHBOARD],
  MEMBER: [Permission.VIEW_DASHBOARD, Permission.EDIT_LAWS],
  ADMIN: [
    Permission.VIEW_DASHBOARD,
    Permission.EDIT_LAWS,
    Permission.MANAGE_EMPLOYEES,
    Permission.ADMIN_WORKSPACE,
  ],
}

export function hasPermission(
  userRole: string,
  permission: Permission
): boolean {
  return rolePermissions[userRole]?.includes(permission) ?? false
}

// Usage in Server Action
export async function deleteEmployee(employeeId: string) {
  const session = await getServerSession()

  if (!hasPermission(session.user.role, Permission.MANAGE_EMPLOYEES)) {
    throw new Error('Insufficient permissions')
  }

  // Proceed with deletion
}
```

---

## 11.5 External Service Integration

### 11.5.1 OpenAI Integration

```typescript
// lib/ai/openai.ts
import OpenAI from 'openai'
import { z } from 'zod'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function generateLawSummary(lawContent: string): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      {
        role: 'system',
        content:
          'Du är en svensk juridisk expert. Sammanfatta lagen koncist på svenska.',
      },
      {
        role: 'user',
        content: lawContent,
      },
    ],
    max_tokens: 500,
    temperature: 0.3, // Low temperature for consistency
  })

  return completion.choices[0].message.content!
}

// RAG query with citations
export async function queryRAG(
  question: string,
  context: string[]
): Promise<{ answer: string; citations: string[] }> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    messages: [
      {
        role: 'system',
        content: `Du är Laglig.se AI-assistent. Svara ENDAST baserat på given kontext.
        Om svaret inte finns i kontexten, säg "Jag har inte tillräcklig information."
        Inkludera alltid källhänvisningar i format [1], [2] etc.`,
      },
      {
        role: 'user',
        content: `Kontext:\n${context.join('\n\n')}\n\nFråga: ${question}`,
      },
    ],
    functions: [
      {
        name: 'provide_answer',
        parameters: {
          type: 'object',
          properties: {
            answer: { type: 'string' },
            citations: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['answer', 'citations'],
        },
      },
    ],
    function_call: { name: 'provide_answer' },
  })

  const result = JSON.parse(
    completion.choices[0].message.function_call!.arguments
  )

  return result
}
```

### 11.5.2 Redis Cache Integration

```typescript
// lib/cache.ts
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// Cache RAG responses (NFR3: 75% hit rate target)
export async function getCachedRAGResponse(
  question: string
): Promise<string | null> {
  const cacheKey = `rag:${hashQuestion(question)}`
  return redis.get(cacheKey)
}

export async function setCachedRAGResponse(
  question: string,
  response: string
): Promise<void> {
  const cacheKey = `rag:${hashQuestion(question)}`
  await redis.set(cacheKey, response, {
    ex: 86400, // 24 hour TTL
  })
}

// Circuit breaker for external services
export async function withCircuitBreaker<T>(
  key: string,
  fn: () => Promise<T>,
  options = { threshold: 3, timeout: 60 }
): Promise<T> {
  const failureCount = (await redis.get<number>(`circuit:${key}`)) ?? 0

  if (failureCount >= options.threshold) {
    throw new Error(`Service ${key} is currently unavailable`)
  }

  try {
    const result = await fn()
    await redis.del(`circuit:${key}`)
    return result
  } catch (error) {
    await redis.incr(`circuit:${key}`)
    await redis.expire(`circuit:${key}`, options.timeout)
    throw error
  }
}
```

### 11.5.3 Background Job Processing

```typescript
// lib/jobs/law-change-detector.ts
import { prisma } from '@/lib/prisma'
import { getRiksdagenAPI } from '@/lib/external/riksdagen'

export async function detectLawChanges() {
  const laws = await prisma.law.findMany({
    where: { isActive: true }
  })

  const changes: Array<{
    lawId: string
    oldVersion: string
    newVersion: string
    diff: string
  }> = []

  for (const law of laws) {
    const currentVersion = await getRiksdagenAPI(
      `/dokument/${law.documentNumber}`
    )

    if (currentVersion.hash !== law.contentHash) {
      changes.push({
        lawId: law.id,
        oldVersion: law.contentHash,
        newVersion: currentVersion.hash,
        diff: generateDiff(law.content, currentVersion.content)
      })

      // Update law with new content
      await prisma.law.update({
        where: { id: law.id },
        data: {
          content: currentVersion.content,
          contentHash: currentVersion.hash,
          lastChecked: new Date()
        }
      })
    }
  }

  return changes
}

// Vercel Cron configuration
// vercel.json
{
  "crons": [{
    "path": "/api/cron/check-law-changes",
    "schedule": "0 1 * * *" // Daily at 1 AM
  }]
}
```

### 11.5.4 Supabase Storage Integration

```typescript
// lib/storage/supabase-storage.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export class StorageService {
  private bucket: string

  constructor(bucket: string) {
    this.bucket = bucket
  }

  async uploadFile(
    file: File,
    workspaceId: string,
    path?: string
  ): Promise<{ url: string; error: Error | null }> {
    const fileName = `${Date.now()}-${file.name}`
    const filePath = `${workspaceId}/${path || ''}/${fileName}`

    const { data, error } = await supabase.storage
      .from(this.bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      })

    if (error) return { url: '', error }

    const {
      data: { publicUrl },
    } = supabase.storage.from(this.bucket).getPublicUrl(filePath)

    return { url: publicUrl, error: null }
  }

  async getSignedUrl(
    filePath: string,
    expiresIn: number = 3600
  ): Promise<{ url: string; error: Error | null }> {
    const { data, error } = await supabase.storage
      .from(this.bucket)
      .createSignedUrl(filePath, expiresIn)

    return { url: data?.signedUrl || '', error }
  }
}

export const employeeDocsStorage = new StorageService('employee-documents')
export const kollektivavtalStorage = new StorageService('kollektivavtal')
```

---

## 11.6 Error Handling & Monitoring

### 11.6.1 Global Error Handler

```typescript
// lib/error-handler.ts
import * as Sentry from '@sentry/nextjs'

export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message)
    this.name = 'AppError'
    Error.captureStackTrace(this, this.constructor)
  }
}

export async function handleError(
  error: unknown,
  context?: Record<string, any>
): Promise<{ error: string; code: string }> {
  // Log to Sentry
  Sentry.captureException(error, {
    extra: context,
  })

  if (error instanceof AppError) {
    return {
      error: error.message,
      code: error.code,
    }
  }

  if (error instanceof z.ZodError) {
    return {
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
    }
  }

  // Generic error
  return {
    error: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
  }
}
```

### 11.6.2 Rate Limiting

```typescript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

// NFR8: Rate limiting per tier
export const rateLimits = {
  solo: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(50, '30d'), // 50 queries/month
    analytics: true,
  }),
  team: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(500, '30d'), // 500 queries/month
    analytics: true,
  }),
  enterprise: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10000, '1d'), // Effectively unlimited
    analytics: true,
  }),
}

export async function checkRateLimit(
  userId: string,
  tier: 'solo' | 'team' | 'enterprise'
): Promise<{ success: boolean; remaining: number }> {
  const { success, remaining } = await rateLimits[tier].limit(userId)

  if (!success) {
    // 10% grace period
    const graceLimit = tier === 'solo' ? 5 : tier === 'team' ? 50 : 1000
    const graceCheck = await rateLimits[tier].limit(
      `${userId}:grace`,
      graceLimit
    )

    return {
      success: graceCheck.success,
      remaining: graceCheck.remaining,
    }
  }

  return { success, remaining }
}
```

---

## 11.7 Performance Optimization

### 11.7.1 Database Query Optimization

```typescript
// Efficient pagination with cursor
export async function getLawsPaginated(cursor?: string, limit: number = 50) {
  const laws = await prisma.law.findMany({
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      documentNumber: true,
      summary: true, // Don't fetch full content
    },
  })

  const hasMore = laws.length > limit
  const items = hasMore ? laws.slice(0, -1) : laws

  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  }
}
```

### 11.7.2 Connection Pooling

```typescript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")      // Pooled for queries
  directUrl = env("DIRECT_URL")        // Direct for migrations
}
```

**Supabase Connection Strategy:**

1. **Pooled Connection (Transaction Mode)** - For serverless functions

   ```
   postgresql://[user]:[password]@[host]:6543/postgres?pgbouncer=true
   ```

   - Uses PgBouncer in transaction mode
   - Maximum 100 concurrent connections per project
   - Use for: Server Components, API Routes, Server Actions
   - Set as: `DATABASE_URL`

2. **Direct Connection** - For long-running operations

   ```
   postgresql://[user]:[password]@[host]:5432/postgres
   ```

   - Direct PostgreSQL connection
   - Use for: Migrations, Prisma CLI commands
   - Set as: `DIRECT_URL`

**Production Connection URLs:**

```bash
# Pooled connection for serverless
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct connection for migrations
DIRECT_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"
```

### 11.7.3 Response Streaming

```typescript
// app/api/chat/route.ts
import { OpenAIStream, StreamingTextResponse } from 'ai'

export async function POST(req: Request) {
  const { messages } = await req.json()

  const response = await openai.chat.completions.create({
    model: 'gpt-4-turbo-preview',
    stream: true,
    messages,
  })

  const stream = OpenAIStream(response, {
    async onCompletion(completion) {
      // Save to database
      await prisma.chatMessage.create({
        data: {
          content: completion,
          role: 'assistant',
        },
      })
    },
  })

  return new StreamingTextResponse(stream)
}
```

---
