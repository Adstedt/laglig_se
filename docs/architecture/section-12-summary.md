# Section 12 Summary

The Unified Project Structure provides a scalable, maintainable foundation:

✅ **Clear Organization:** Feature-based components, logical grouping
✅ **Predictable:** Consistent naming conventions and structure
✅ **Type-Safe:** Path aliases and TypeScript throughout
✅ **Monorepo Benefits:** Unified tooling and deployment
✅ **Separation of Concerns:** Clear boundaries between layers

**Key Decisions:**

1. **Monorepo over Multi-repo:** Simpler for single application
2. **Feature-based Components:** Better than type-based organization
3. **App Router Structure:** Leverages Next.js 16 patterns
4. **Co-location:** Keep related files together
5. **Path Aliases:** Clean imports without relative paths

**Next:** Section 13 - Development Workflow

## 13.1 Overview

The development workflow emphasizes **rapid iteration, type safety, and automated quality checks**. All developers follow the same setup process and conventions to ensure consistency across the team.

**Workflow Principles:**

- **Fast feedback loops:** Hot reload, instant type checking
- **Automated quality:** Pre-commit hooks, CI/CD validation
- **Type-first development:** TypeScript everywhere
- **Database-driven:** Prisma schema as source of truth
- **Environment parity:** Docker for local services

---

## 13.2 Initial Setup

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

**Clone and Install:**

```bash
# Clone repository
git clone https://github.com/laglig/laglig_se.git
cd laglig_se

# Install dependencies
pnpm install

# Initialize Supabase project
supabase init

# Copy environment template
cp .env.example .env.local

# Install Playwright browsers
pnpm exec playwright install
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

# Other services
NEXTAUTH_SECRET="your-secret-here" # Generate: openssl rand -base64 32
NEXTAUTH_URL="http://localhost:3000"
OPENAI_API_KEY="sk-..."
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."
```

---

## 13.3 Local Development

**Start Services:**

```bash
# Start Supabase local development stack
supabase start

# This starts:
# - PostgreSQL on port 54322
# - Supabase Studio on http://localhost:54323
# - API Gateway on http://localhost:54321
# - Auth server, Storage server, Realtime server

# Get local credentials (save these to .env.local)
supabase status

# Run database migrations
pnpm prisma migrate dev

# Seed development data
pnpm prisma db seed

# Generate Prisma client
pnpm prisma generate

# Start development server
pnpm dev
```

**Available URLs:**

- Application: http://localhost:3000
- Supabase Studio: http://localhost:54323
- PostgreSQL: localhost:54322
- Supabase API: http://localhost:54321

**Development Commands:**

```json
// package.json scripts
{
  "scripts": {
    "dev": "next dev --turbo",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:e2e": "playwright test",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio",
    "db:seed": "tsx prisma/seed.ts"
  }
}
```

---

## 13.4 Development Patterns

**Database Changes:**

```bash
# 1. Modify schema
# Edit prisma/schema.prisma

# 2. Create migration
pnpm prisma migrate dev --name add_user_role

# 3. Generate types
pnpm prisma generate

# 4. Update seed data if needed
# Edit prisma/seed.ts
```

**Adding Features:**

```bash
# 1. Create feature branch
git checkout -b feature/employee-import

# 2. Add component
mkdir -p components/features/employee-import
touch components/features/employee-import/ImportModal.tsx

# 3. Add Server Action
touch app/actions/employee-import.ts

# 4. Add tests
touch tests/integration/employee-import.test.ts

# 5. Update types if needed
touch types/employee-import.d.ts
```

**API Development:**

```typescript
// For internal mutations - use Server Actions
// app/actions/employee.ts
'use server'
export async function createEmployee(data: EmployeeInput) {
  // Implementation
}

// For external APIs - use Route Handlers
// app/api/webhooks/stripe/route.ts
export async function POST(req: Request) {
  // Webhook handler
}
```

---

## 13.5 Quality Assurance

**Pre-commit Hooks (Husky):**

```bash
# .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

pnpm lint-staged
```

**Lint-staged Configuration:**

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

**Type Checking:**

```bash
# Run type check
pnpm typecheck

# Watch mode for development
pnpm tsc --watch --noEmit
```

---

## 13.6 Testing Workflow

**Unit Tests:**

```bash
# Run all unit tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage
```

**Integration Tests:**

```bash
# Run integration tests
pnpm test:integration

# Debug specific test
pnpm test:debug path/to/test.ts
```

**E2E Tests:**

```bash
# Run E2E tests
pnpm test:e2e

# Run in headed mode
pnpm test:e2e --headed

# Run specific test
pnpm test:e2e onboarding.spec.ts
```

---

## 13.7 Debugging

**VS Code Launch Configuration:**

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node-terminal",
      "request": "launch",
      "command": "pnpm dev"
    },
    {
      "name": "Next.js: debug client-side",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000"
    }
  ]
}
```

**Debug Logging:**

```typescript
// Enable Prisma query logging
const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
})

// Debug Server Actions
export async function myAction(data: Input) {
  console.log('[ACTION] myAction called', data)
  // Implementation
}
```

---
