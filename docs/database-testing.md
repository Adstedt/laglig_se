# Database Testing Guide

**Quick Reference for running integration tests with Supabase**

## Problem

Vitest integration tests need to connect to Supabase database, but environment variables from `.env.local` are not automatically loaded. Vitest only loads `.env` files by default, not `.env.local`.

## Solution

### 1. Environment Setup

**Ensure `.env.local` exists** with Supabase connection strings:

```bash
# From .env.local (top section - most efficient connection method)
DATABASE_URL="postgresql://postgres.lezdkonjjjbvaghdwpog:PASSWORD@aws-1-eu-north-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres.lezdkonjjjbvaghdwpog:PASSWORD@aws-1-eu-north-1.pooler.supabase.com:5432/postgres"
```

**Key points:**

- Port 6543: Transaction mode (pgbouncer) - Use for app queries
- Port 5432: Session mode - Use for Prisma migrations
- Both use POOLER hostname: `aws-1-eu-north-1.pooler.supabase.com`

### 2. Vitest Configuration Fix

**File:** `vitest.config.mts`

The key fix is to load `.env.local` BEFORE vitest runs, at the config level:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { config as loadEnv } from 'dotenv'

// ✅ CRITICAL: Load .env.local before vitest runs
// This ensures DATABASE_URL is available when Prisma client initializes
loadEnv({ path: path.resolve(__dirname, '.env.local') })

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
```

**Why this works:**

- Loading dotenv at config level ensures env vars are available BEFORE Prisma client initializes
- Prisma client is often imported at module level in test files
- Loading in `tests/setup.ts` is too late - Prisma has already initialized with no DATABASE_URL

**Required package:**

```bash
pnpm add -D dotenv
```

### 3. Running Tests

```bash
# Run all integration tests
pnpm test tests/integration/

# Run specific test file
pnpm test tests/integration/ingestion/sfs-laws.test.ts

# Run with watch mode
pnpm test:watch tests/integration/
```

### 4. Common Issues

**Issue: "Can't reach database server at localhost:5432"**

- Cause: Environment variables not loaded from `.env.local`
- Fix: Load dotenv in `vitest.config.mts` BEFORE defineConfig (see section 2 above)
- Why: Prisma client initializes at module import time, before test setup runs

**Issue: "Unique constraint failed"**

- Cause: Test data from previous run not cleaned up properly
- Fix: Use `beforeEach` AND delete child records first (respecting foreign keys)
- Example:
  ```typescript
  beforeEach(async () => {
    // Delete child records first
    await prisma.amendment.deleteMany({
      where: {
        base_document: {
          document_number: { startsWith: 'TEST-' },
        },
      },
    })
    // Then delete parent records
    await prisma.legalDocument.deleteMany({
      where: { document_number: { startsWith: 'TEST-' } },
    })
  })
  ```
- Important: Delete in reverse order of foreign key dependencies

**Issue: Connection timeout**

- Cause: Supabase free tier paused after inactivity
- Fix: Visit Supabase dashboard to wake up project

### 5. Test Patterns

**Create a PrismaClient in test file:**

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Clean up after tests
afterAll(async () => {
  await prisma.$disconnect()
})
```

**Use TEST- prefix for test data:**

```typescript
// Good - easy to clean up
document_number: 'TEST-SFS 1977:480'

// Bad - might conflict with real data
document_number: 'SFS 1977:480'
```

## Verification Checklist

✅ `.env.local` exists with DATABASE_URL and DIRECT_URL
✅ `dotenv` package installed (`pnpm add -D dotenv`)
✅ `vitest.config.mts` loads `.env.local` at config level (BEFORE defineConfig)
✅ Tests use `beforeEach` to clean up (delete child records first!)
✅ Tests use TEST- prefix for all test data
✅ Supabase project is active (not paused)
✅ Run tests individually first to verify no data collisions

## Quick Debug

**Check if env vars are loaded:**

```typescript
console.log('DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50))
```

**Test database connection:**

```bash
pnpm tsx scripts/test-db-connection.ts
```

## Reference Files

- Database config: `.env.local` (top section)
- Test setup: `tests/setup.ts`
- Vitest config: `vitest.config.mts`
- Example test: `tests/integration/ingestion/sfs-laws.test.ts`
