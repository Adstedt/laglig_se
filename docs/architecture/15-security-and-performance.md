# 15. Security and Performance

## 15.1 Security Overview

Laglig.se implements **defense-in-depth security** with multiple layers of protection for user data, especially sensitive information like Swedish personnummer.

**Security Layers:**

```
Edge Network → WAF → Rate Limiting → Auth → Input Validation → Encryption
     ↓           ↓         ↓           ↓           ↓              ↓
  Cloudflare   DDoS    API Limits   NextAuth   Zod Schemas   AES-256
  Protection  Mitigation            + Supabase  Sanitization  at Rest
```

---

## 15.2 Authentication Security

**Password Requirements:**

```typescript
// lib/validation/auth.ts
export const PasswordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[A-Z]/, 'Must contain uppercase letter')
  .regex(/[a-z]/, 'Must contain lowercase letter')
  .regex(/[0-9]/, 'Must contain number')
  .regex(/[^A-Za-z0-9]/, 'Must contain special character')
```

**Session Security:**

```typescript
// lib/auth/auth-options.ts
export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
    encryption: true,
  },
  cookies: {
    sessionToken: {
      name: '__Secure-next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: true,
      },
    },
  },
}
```

---

## 15.3 Data Protection

**Personnummer Encryption (NFR4):**

```typescript
// lib/security/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const algorithm = 'aes-256-gcm'
const key = Buffer.from(process.env.ENCRYPTION_KEY!, 'base64')

export function encryptPersonnummer(personnummer: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv(algorithm, key, iv)

  let encrypted = cipher.update(personnummer, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted
}

export function decryptPersonnummer(encrypted: string): string {
  const [ivHex, authTagHex, encryptedData] = encrypted.split(':')

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const decipher = createDecipheriv(algorithm, key, iv)

  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
```

**Database Security:**

```sql
-- Row Level Security (RLS) for multi-tenancy
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_isolation ON employees
  FOR ALL
  USING (workspace_id = current_setting('app.workspace_id')::uuid);
```

---

## 15.4 Input Validation & Sanitization

**Request Validation:**

```typescript
// app/actions/employee.ts
import { z } from 'zod'
import DOMPurify from 'isomorphic-dompurify'

const CreateEmployeeSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  personnummer: z.string().regex(/^\d{6}-\d{4}$/),
  notes: z.string().transform((val) => DOMPurify.sanitize(val)),
})

export async function createEmployee(input: unknown) {
  const validated = CreateEmployeeSchema.parse(input)
  // Validated and sanitized data
}
```

**SQL Injection Prevention:**

```typescript
// Always use parameterized queries
const user = await prisma.user.findFirst({
  where: {
    email: userInput, // Prisma handles escaping
  },
})

// Never use raw string concatenation
// ❌ BAD: prisma.$queryRaw(`SELECT * FROM users WHERE email = '${input}'`)
// ✅ GOOD: prisma.$queryRaw`SELECT * FROM users WHERE email = ${input}`
```

---

## 15.5 API Security

**Rate Limiting (NFR8):**

```typescript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit'

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'), // 10 requests per minute
  analytics: true,
})

export async function rateLimitMiddleware(req: Request) {
  const ip = req.headers.get('x-forwarded-for') ?? 'anonymous'
  const { success, limit, reset, remaining } = await ratelimit.limit(ip)

  if (!success) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': new Date(reset).toISOString(),
      },
    })
  }
}
```

**CORS Configuration:**

```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.NEXT_PUBLIC_APP_URL,
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
        ],
      },
    ]
  },
}
```

---

## 15.6 Performance Optimization

**Database Performance:**

```sql
-- Indexes for common queries
CREATE INDEX idx_laws_workspace_status ON law_in_workspace(workspace_id, status);
CREATE INDEX idx_employees_workspace ON employees(workspace_id);
CREATE INDEX idx_tasks_employee_status ON tasks(employee_id, status);

-- pgvector HNSW index for fast similarity search
CREATE INDEX ON law_embeddings USING hnsw (embedding vector_cosine_ops);
```

**Caching Strategy (NFR3):**

```typescript
// lib/cache/strategies.ts
export async function getCachedOrFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 3600
): Promise<T> {
  // Check cache
  const cached = await redis.get(key)
  if (cached) {
    metrics.increment('cache.hit')
    return cached as T
  }

  // Fetch and cache
  metrics.increment('cache.miss')
  const data = await fetcher()
  await redis.set(key, data, { ex: ttl })

  return data
}

// Usage for RAG queries
const response = await getCachedOrFetch(
  `rag:${hashQuery(question)}`,
  async () => queryOpenAI(question),
  86400 // 24 hours
)
```

**Bundle Optimization:**

```javascript
// next.config.js
module.exports = {
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  experimental: {
    optimizeCss: true,
  },
  swcMinify: true,
  productionBrowserSourceMaps: false,
}
```

---

## 15.7 Security Headers

**Content Security Policy (NFR22):**

```typescript
// lib/security/headers.ts
export const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: `
      default-src 'self';
      script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live;
      style-src 'self' 'unsafe-inline';
      img-src 'self' blob: data: https:;
      font-src 'self';
      connect-src 'self' https://api.openai.com https://*.supabase.co;
      frame-ancestors 'none';
    `.replace(/\n/g, ''),
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
]
```

---

## 15.8 GDPR Compliance (NFR5)

**Data Export:**

```typescript
// app/actions/gdpr.ts
export async function exportUserData(userId: string) {
  const userData = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      workspaceMemberships: true,
      chatMessages: true,
      activityLogs: true,
    },
  })

  // Remove internal fields
  delete userData.passwordHash

  return {
    data: userData,
    exportedAt: new Date().toISOString(),
    format: 'json',
  }
}
```

**Right to Deletion:**

```typescript
export async function deleteUserAccount(userId: string) {
  await prisma.$transaction(async (tx) => {
    // Anonymize rather than delete for audit trail
    await tx.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@example.com`,
        name: 'Deleted User',
        personnummer: null,
        deletedAt: new Date(),
      },
    })

    // Delete personal data
    await tx.chatMessage.deleteMany({
      where: { userId },
    })
  })
}
```

---
