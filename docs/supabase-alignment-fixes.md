# Supabase Alignment Fixes for Architecture Sections 13-19

## Fix 1: Database Connection - Supabase CLI for Local Development

### Section 13.2 - Initial Setup (UPDATED)

**Prerequisites:**
```bash
# Required versions
node --version  # 20.x LTS required
pnpm --version  # 9.0+ required
git --version   # 2.40+ required

# Install Supabase CLI
npm install -g supabase
supabase --version  # 1.142+ required
```

**Environment Configuration:**
```bash
# .env.local - Supabase Development Variables
# For local development with Supabase CLI
NEXT_PUBLIC_SUPABASE_URL="http://localhost:54321"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..." # From supabase start output
SUPABASE_SERVICE_ROLE_KEY="eyJ..." # From supabase start output

# Database URLs for local Supabase
DATABASE_URL="postgresql://postgres:postgres@localhost:54322/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres:postgres@localhost:54322/postgres"

# Production/Staging URLs (from Supabase Dashboard)
# DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"
# DIRECT_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"

# Other services
NEXTAUTH_SECRET="your-secret-here" # Generate: openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"
OPENAI_API_KEY="sk-..."
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."
```

### Section 13.3 - Local Development (UPDATED)

**Start Supabase Services:**
```bash
# Initialize Supabase project (first time only)
supabase init

# Start Supabase local development stack
supabase start

# This starts:
# - PostgreSQL on port 54322
# - Supabase Studio on http://localhost:54323
# - API Gateway on http://localhost:54321
# - Auth server
# - Storage server
# - Realtime server

# Get local credentials
supabase status

# Run database migrations
supabase migration up
# Or with Prisma
pnpm prisma migrate dev

# Seed development data
pnpm prisma db seed

# Generate Prisma client
pnpm prisma generate

# Start Next.js development server
pnpm dev
```

**Available URLs:**
- Application: http://localhost:3000
- Supabase Studio: http://localhost:54323
- PostgreSQL: localhost:54322
- Supabase API: http://localhost:54321

**Stop Supabase:**
```bash
# Stop all services
supabase stop

# Stop and reset database
supabase stop --no-backup
```

---

## Fix 2: Supabase Connection Pooling Documentation

### Section 11.3.4 - Supabase Connection Management (NEW)

**Connection String Strategy:**

Supabase provides two connection strings for different use cases:

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

**Prisma Configuration for Supabase:**
```prisma
// prisma/schema.prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")      // Pooled for queries
  directUrl = env("DIRECT_URL")        // Direct for migrations
}
```

**Connection Pool Best Practices:**
```typescript
// lib/prisma.ts - Optimized for Supabase
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  log: process.env.NODE_ENV === 'development'
    ? ['error', 'warn']
    : ['error'], // Reduce logs in production
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Important: Prisma automatically handles connection pooling
// No need to manually close connections in serverless
```

**Serverless Function Pattern:**
```typescript
// app/api/data/route.ts
import { prisma } from '@/lib/prisma'

export async function GET() {
  // PgBouncer handles connection pooling automatically
  const data = await prisma.law.findMany({
    take: 10
  })

  // No need to close connection - PgBouncer handles it
  return Response.json(data)
}
```

---

## Fix 3: Authentication Strategy Clarification

### Section 11.4.4 - Supabase Auth + NextAuth Integration (NEW)

**Authentication Responsibility Matrix:**

| Feature | Supabase Auth | NextAuth.js | Notes |
|---------|---------------|-------------|-------|
| User Registration | ✅ Primary | ❌ | Supabase handles user creation |
| Magic Links | ✅ Primary | ❌ | Supabase email service |
| OAuth Providers | ✅ Primary | 🔄 Wrapper | Supabase manages OAuth, NextAuth wraps session |
| JWT Generation | ✅ Primary | ❌ | Supabase issues JWTs |
| Session Management | 🔄 Issues JWT | ✅ Primary | NextAuth manages session in Next.js |
| Server-side Access | ❌ | ✅ Primary | NextAuth for getServerSession() |
| Client-side Access | ✅ Primary | 🔄 Via hook | Supabase client for real-time |
| Middleware Protection | ❌ | ✅ Primary | NextAuth middleware |

**Implementation Pattern:**

```typescript
// lib/auth/supabase-auth.ts - Supabase Auth Setup
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// For server-side admin operations
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)
```

```typescript
// lib/auth/auth-options.ts - NextAuth Configuration
import { NextAuthOptions } from 'next-auth'
import { SupabaseAdapter } from '@next-auth/supabase-adapter'
import CredentialsProvider from 'next-auth/providers/credentials'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Supabase',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Use Supabase for authentication
        const { data, error } = await supabase.auth.signInWithPassword({
          email: credentials?.email || '',
          password: credentials?.password || ''
        })

        if (error || !data.user) return null

        // Return user for NextAuth session
        return {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name
        }
      }
    })
  ],
  adapter: SupabaseAdapter({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secret: process.env.SUPABASE_SERVICE_ROLE_KEY!
  }),
  callbacks: {
    async session({ session, token }) {
      // Add Supabase access token to session
      const { data: { session: supabaseSession } } = await supabase.auth.getSession()

      session.supabaseAccessToken = supabaseSession?.access_token
      session.user.id = token.sub!

      return session
    }
  }
}
```

**Usage Patterns:**

```typescript
// Server Component - Use NextAuth
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth-options'

export default async function Page() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  // Use session.user
}

// Client Component - Use Supabase for real-time
"use client"
import { supabase } from '@/lib/auth/supabase-auth'

export function RealtimeComponent() {
  useEffect(() => {
    const channel = supabase
      .channel('changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks'
      }, (payload) => {
        console.log('Change:', payload)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])
}
```

---

## Fix 4: Supabase Storage Implementation

### Section 11.5.5 - Supabase Storage Integration (NEW)

**Storage Setup:**
```typescript
// lib/storage/supabase-storage.ts
import { supabase, supabaseAdmin } from '@/lib/auth/supabase-auth'

export class StorageService {
  private bucket: string

  constructor(bucket: string) {
    this.bucket = bucket
  }

  // Upload file with workspace isolation
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
        upsert: false
      })

    if (error) return { url: '', error }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(this.bucket)
      .getPublicUrl(filePath)

    return { url: publicUrl, error: null }
  }

  // Generate signed URL for private files
  async getSignedUrl(
    filePath: string,
    expiresIn: number = 3600
  ): Promise<{ url: string; error: Error | null }> {
    const { data, error } = await supabase.storage
      .from(this.bucket)
      .createSignedUrl(filePath, expiresIn)

    return { url: data?.signedUrl || '', error }
  }

  // Delete file
  async deleteFile(filePath: string): Promise<{ error: Error | null }> {
    const { error } = await supabase.storage
      .from(this.bucket)
      .remove([filePath])

    return { error }
  }

  // List files in workspace
  async listFiles(
    workspaceId: string,
    path?: string
  ): Promise<{ files: any[]; error: Error | null }> {
    const { data, error } = await supabase.storage
      .from(this.bucket)
      .list(`${workspaceId}/${path || ''}`)

    return { files: data || [], error }
  }
}

// Export instances for different buckets
export const employeeDocsStorage = new StorageService('employee-documents')
export const kollektivavtalStorage = new StorageService('kollektivavtal')
export const companyLogosStorage = new StorageService('company-logos')
```

**Server Action with File Upload:**
```typescript
// app/actions/employee-documents.ts
"use server"

import { employeeDocsStorage } from '@/lib/storage/supabase-storage'
import { getServerSession } from 'next-auth'
import { z } from 'zod'

const UploadSchema = z.object({
  employeeId: z.string().uuid(),
  documentType: z.enum(['CONTRACT', 'ID_COPY', 'CERTIFICATE']),
  file: z.instanceof(File)
})

export async function uploadEmployeeDocument(formData: FormData) {
  const session = await getServerSession()
  if (!session) throw new Error('Unauthorized')

  const file = formData.get('file') as File
  const employeeId = formData.get('employeeId') as string
  const documentType = formData.get('documentType') as string

  // Upload to Supabase Storage
  const { url, error } = await employeeDocsStorage.uploadFile(
    file,
    session.user.workspaceId,
    `employees/${employeeId}`
  )

  if (error) throw error

  // Save metadata to database
  const document = await prisma.employeeDocument.create({
    data: {
      employeeId,
      documentType,
      title: file.name,
      fileUrl: url,
      fileSizeBytes: file.size,
      mimeType: file.type,
      uploadedBy: session.user.id
    }
  })

  return { success: true, document }
}
```

**Client Component with Upload:**
```tsx
// components/employee/document-upload.tsx
"use client"

import { uploadEmployeeDocument } from '@/app/actions/employee-documents'
import { useState } from 'react'

export function DocumentUpload({ employeeId }: { employeeId: string }) {
  const [uploading, setUploading] = useState(false)

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setUploading(true)

    const formData = new FormData(e.currentTarget)
    formData.append('employeeId', employeeId)

    try {
      const result = await uploadEmployeeDocument(formData)
      if (result.success) {
        toast.success('Document uploaded successfully')
      }
    } catch (error) {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <form onSubmit={handleUpload}>
      <input
        type="file"
        name="file"
        accept=".pdf,.doc,.docx"
        required
      />
      <select name="documentType" required>
        <option value="CONTRACT">Contract</option>
        <option value="ID_COPY">ID Copy</option>
        <option value="CERTIFICATE">Certificate</option>
      </select>
      <button type="submit" disabled={uploading}>
        {uploading ? 'Uploading...' : 'Upload'}
      </button>
    </form>
  )
}
```

**Storage Bucket Policies (SQL):**
```sql
-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES
  ('employee-documents', 'employee-documents', false),
  ('kollektivavtal', 'kollektivavtal', false),
  ('company-logos', 'company-logos', true);

-- RLS policies for employee-documents
CREATE POLICY "Users can upload to their workspace"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'employee-documents' AND
  auth.uid() IN (
    SELECT user_id FROM workspace_members
    WHERE workspace_id = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Users can view their workspace files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'employee-documents' AND
  auth.uid() IN (
    SELECT user_id FROM workspace_members
    WHERE workspace_id = (storage.foldername(name))[1]
  )
);
```

---

## Fix 5: Complete Environment Variables

### Updated .env.example

```bash
# ============================================
# SUPABASE CONFIGURATION
# ============================================

# Supabase Project URL (from project settings)
NEXT_PUBLIC_SUPABASE_URL="https://[project-ref].supabase.co"

# Supabase Anonymous Key (public, safe for client)
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."

# Supabase Service Role Key (secret, server-only!)
SUPABASE_SERVICE_ROLE_KEY="eyJ..."

# Database URLs (from project settings > Database)
# Pooled connection for serverless (Transaction mode)
DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true"

# Direct connection for migrations (Session mode)
DIRECT_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"

# ============================================
# AUTHENTICATION
# ============================================

# NextAuth Configuration
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000" # Production: https://laglig.se

# ============================================
# EXTERNAL SERVICES
# ============================================

# OpenAI API
OPENAI_API_KEY="sk-..."

# Upstash Redis
UPSTASH_REDIS_REST_URL="https://[endpoint].upstash.io"
UPSTASH_REDIS_REST_TOKEN="AX..."

# Resend Email
RESEND_API_KEY="re_..."

# Stripe Payments
STRIPE_SECRET_KEY="sk_test_..." # Production: sk_live_...
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..." # Production: pk_live_...

# ============================================
# MONITORING
# ============================================

# Sentry
NEXT_PUBLIC_SENTRY_DSN="https://[key]@[org].ingest.sentry.io/[project]"
SENTRY_AUTH_TOKEN="sntr_..."

# Vercel (auto-injected in Vercel deployments)
VERCEL_URL="" # Auto-populated by Vercel

# ============================================
# FEATURE FLAGS
# ============================================

# Development flags
NEXT_PUBLIC_ENABLE_DEBUG="false"
NEXT_PUBLIC_ENABLE_DEVTOOLS="false"

# ============================================
# EXTERNAL APIS
# ============================================

# Swedish APIs
BOLAGSVERKET_API_KEY="" # If required
RIKSDAGEN_API_KEY="" # Usually not required
DOMSTOLSVERKET_API_KEY="" # If required

# ============================================
# LOCAL DEVELOPMENT OVERRIDES
# ============================================
# Create .env.local and override any values needed for local dev
# Example for local Supabase:
# NEXT_PUBLIC_SUPABASE_URL="http://localhost:54321"
# DATABASE_URL="postgresql://postgres:postgres@localhost:54322/postgres"
```

---

## Additional Fixes for Testing

### Section 16.5 - Test Database Strategy (UPDATED)

**Testing with Supabase:**

```bash
# Option 1: Separate Supabase project for testing
# Create a test project in Supabase Dashboard
# Use test project credentials in .env.test

# Option 2: Local Supabase for tests
# .env.test
NEXT_PUBLIC_SUPABASE_URL="http://localhost:54321"
DATABASE_URL="postgresql://postgres:postgres@localhost:54322/postgres"

# Start Supabase for tests
supabase start

# Run tests
pnpm test
```

**Test Setup with Supabase:**
```typescript
// tests/setup.ts
import { execSync } from 'child_process'

// Reset database before tests
beforeAll(async () => {
  // Reset Supabase local database
  execSync('supabase db reset', { stdio: 'inherit' })

  // Run migrations
  execSync('pnpm prisma migrate deploy', { stdio: 'inherit' })

  // Seed test data
  execSync('pnpm prisma db seed', { stdio: 'inherit' })
})
```

---

## Migration Commands Update

### Section 14.4 - Database Migrations (UPDATED)

```bash
# Development migrations with Supabase
# 1. Create migration
pnpm prisma migrate dev --name add_feature

# 2. Apply to local Supabase
supabase db reset # Resets and applies all migrations

# Production migrations
# 1. Generate migration SQL
pnpm prisma migrate deploy --dry-run > migration.sql

# 2. Apply via Supabase Dashboard
# Go to SQL Editor > New Query > Paste SQL > Run

# Or use Supabase CLI
supabase db push
```

---

## Summary of Critical Fixes

1. ✅ **Local Development:** Now uses Supabase CLI instead of Docker PostgreSQL
2. ✅ **Connection Pooling:** Documented pgbouncer usage and connection strings
3. ✅ **Authentication:** Clear separation between Supabase Auth and NextAuth.js
4. ✅ **Storage:** Complete implementation patterns for file uploads
5. ✅ **Environment Variables:** All Supabase-specific vars documented

These fixes ensure complete alignment with Supabase as our backend infrastructure and eliminate any confusion during development.