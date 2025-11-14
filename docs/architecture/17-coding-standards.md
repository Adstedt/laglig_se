# 17. Coding Standards

## 17.1 Overview

These coding standards ensure **consistency, maintainability, and quality** across the codebase. They are designed to be **enforceable by tools** and **critical for AI agents** working on the code.

**Core Principles:**

- **Explicit over implicit:** Clear naming and types
- **Consistency:** Same patterns everywhere
- **Safety first:** Prevent runtime errors
- **Performance aware:** Optimize hot paths
- **Accessible by default:** WCAG 2.1 AA compliance

---

## 17.2 TypeScript Standards

**Strict Configuration:**

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

**Type Patterns:**

```typescript
// ✅ GOOD: Explicit types
export interface Employee {
  id: string
  name: string
  email: string
  personnummer: string | null
  createdAt: Date
  updatedAt: Date
}

// ❌ BAD: Using 'any'
export function processData(data: any) {}

// ✅ GOOD: Type guards
function isEmployee(obj: unknown): obj is Employee {
  return (
    typeof obj === 'object' && obj !== null && 'id' in obj && 'email' in obj
  )
}

// ✅ GOOD: Discriminated unions
type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string }

// ✅ GOOD: Const assertions
const TIERS = ['SOLO', 'TEAM', 'ENTERPRISE'] as const
type Tier = (typeof TIERS)[number]
```

---

## 17.3 React/Next.js Standards

**Component Patterns:**

```typescript
// ✅ GOOD: Server Component (default)
// app/components/law-list.tsx
export async function LawList({ category }: { category: string }) {
  const laws = await getLawsByCategory(category)
  return (
    <div>
      {laws.map((law) => (
        <LawCard key={law.id} law={law} />
      ))}
    </div>
  )
}

// ✅ GOOD: Client Component (when needed)
// app/components/interactive-filter.tsx
"use client"

import { useState } from 'react'

export function InteractiveFilter({ onFilter }: { onFilter: (value: string) => void }) {
  const [value, setValue] = useState('')
  // Interactive logic
}

// ❌ BAD: Unnecessary client component
"use client" // Don't add unless needed!
export function StaticHeader() {
  return <h1>Static Content</h1>
}
```

**Data Fetching Patterns:**

```typescript
// ✅ GOOD: Server-side data fetching
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params // Next.js 16 pattern
  const data = await fetchData(id)
  return <Component data={data} />
}

// ❌ BAD: Client-side fetching for static data
"use client"
export function Component() {
  const [data, setData] = useState(null)
  useEffect(() => {
    fetch('/api/data').then(...) // Avoid for SSR-able data
  }, [])
}

// ✅ GOOD: Server Actions for mutations
"use server"
export async function updateEmployee(id: string, data: UpdateData) {
  const session = await getServerSession()
  if (!session) throw new Error('Unauthorized')

  return prisma.employee.update({
    where: { id },
    data
  })
}
```

---

## 17.4 Database Standards

**Prisma Query Patterns:**

```typescript
// ✅ GOOD: Workspace isolation
export async function getEmployees(workspaceId: string) {
  return prisma.employee.findMany({
    where: {
      workspaceId,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      // Don't select sensitive fields unless needed
    },
  })
}

// ❌ BAD: Missing workspace filter
export async function getAllEmployees() {
  return prisma.employee.findMany() // Security risk!
}

// ✅ GOOD: Transaction for related operations
export async function transferEmployee(
  employeeId: string,
  fromWorkspace: string,
  toWorkspace: string
) {
  return prisma.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id: employeeId },
      data: { workspaceId: toWorkspace },
    })

    await tx.auditLog.create({
      data: {
        action: 'EMPLOYEE_TRANSFER',
        fromWorkspace,
        toWorkspace,
      },
    })
  })
}

// ✅ GOOD: Pagination with cursor
export async function getLawsPaginated(cursor?: string) {
  return prisma.law.findMany({
    take: 51, // Fetch one extra to check hasMore
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: 'desc' },
  })
}
```

---

## 17.5 Error Handling Standards

**Error Patterns:**

```typescript
// ✅ GOOD: Typed errors
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = 'AppError'
  }
}

// ✅ GOOD: Comprehensive error handling
export async function createEmployee(data: unknown) {
  try {
    // Validate input
    const validated = EmployeeSchema.parse(data)

    // Check permissions
    const session = await getServerSession()
    if (!session) {
      throw new AppError('Unauthorized', 'AUTH_REQUIRED', 401)
    }

    // Perform operation
    const employee = await prisma.employee.create({
      data: validated,
    })

    return { success: true, data: employee }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: 'Invalid input', details: error.errors }
    }

    if (error instanceof AppError) {
      return { success: false, error: error.message, code: error.code }
    }

    // Log unexpected errors
    console.error('Unexpected error:', error)
    return { success: false, error: 'Internal server error' }
  }
}

// ❌ BAD: Swallowing errors
try {
  await riskyOperation()
} catch {
  // Silent failure - don't do this!
}
```

---

## 17.6 Security Standards

**Input Validation:**

```typescript
// ✅ GOOD: Always validate user input
import { z } from 'zod'

const SearchSchema = z.object({
  query: z.string().min(1).max(100),
  category: z.enum(['ALL', 'LABOR', 'ENVIRONMENT', 'GDPR']),
  limit: z.number().int().min(1).max(100).default(20),
})

export async function searchLaws(input: unknown) {
  const validated = SearchSchema.parse(input)
  // Use validated data
}

// ❌ BAD: Direct user input usage
export async function searchLaws(query: string) {
  return prisma.law.findMany({
    where: {
      title: { contains: query }, // Unvalidated!
    },
  })
}
```

**Authentication Checks:**

```typescript
// ✅ GOOD: Check auth at every layer
export async function protectedAction() {
  const session = await getServerSession()

  if (!session) {
    throw new AppError('Authentication required', 'AUTH_REQUIRED', 401)
  }

  if (!hasPermission(session.user.role, 'ADMIN')) {
    throw new AppError('Insufficient permissions', 'FORBIDDEN', 403)
  }

  // Proceed with action
}
```

---

## 17.7 Performance Standards

**Optimization Patterns:**

```typescript
// ✅ GOOD: Selective field fetching
const employees = await prisma.employee.findMany({
  select: {
    id: true,
    name: true,
    email: true,
    // Only fetch needed fields
  },
})

// ❌ BAD: Fetching everything
const employees = await prisma.employee.findMany({
  include: {
    tasks: true,
    documents: true,
    activityLogs: true, // Unnecessary data
  },
})

// ✅ GOOD: Parallel data fetching
const [laws, employees, tasks] = await Promise.all([
  getLaws(workspaceId),
  getEmployees(workspaceId),
  getTasks(workspaceId),
])

// ❌ BAD: Sequential fetching
const laws = await getLaws(workspaceId)
const employees = await getEmployees(workspaceId)
const tasks = await getTasks(workspaceId)
```

**Caching Patterns:**

```typescript
// ✅ GOOD: Cache expensive operations
export async function getAIResponse(question: string) {
  const cacheKey = `ai:${hashQuestion(question)}`

  // Check cache first
  const cached = await redis.get(cacheKey)
  if (cached) return cached

  // Generate and cache
  const response = await generateAIResponse(question)
  await redis.set(cacheKey, response, { ex: 86400 }) // 24h TTL

  return response
}
```

---

## 17.8 Git Commit Standards

**Commit Message Format:**

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Test changes
- `chore`: Maintenance

**Examples:**

```bash
feat(auth): add magic link authentication

Implement passwordless authentication using magic links
sent via email. Includes rate limiting and link expiration.

Closes #123

---

fix(kanban): prevent card duplication on fast drag

Add optimistic locking to prevent race conditions when
dragging cards quickly between columns.
```

---
