# 18. Error Handling Strategy

## 18.1 Overview

The error handling strategy ensures **graceful degradation**, **helpful error messages**, and **comprehensive logging** while maintaining security and user experience.

**Error Handling Layers:**

```
User Input → Validation → Business Logic → Database → External Services
     ↓           ↓            ↓             ↓            ↓
 Zod Schemas  AppError   Prisma Errors  Retry Logic  Circuit Breaker
     ↓           ↓            ↓             ↓            ↓
User Feedback  Logging    Rollback    Fallback     Alert Team
```

---

## 18.2 Error Classification

**Error Categories:**

| Category         | Code Range | Examples                      | User Message                      |
| ---------------- | ---------- | ----------------------------- | --------------------------------- |
| Validation       | 400-409    | Invalid input, missing fields | "Please check your input"         |
| Authentication   | 401        | No session, expired token     | "Please sign in"                  |
| Authorization    | 403        | Insufficient permissions      | "You don't have access"           |
| Not Found        | 404        | Resource doesn't exist        | "Page not found"                  |
| Business Logic   | 422        | Rule violation                | Specific message                  |
| External Service | 502-504    | API timeout, service down     | "Service temporarily unavailable" |
| Internal         | 500        | Unexpected errors             | "Something went wrong"            |

---

## 18.3 Global Error Handling

**Error Boundary (Client):**

```typescript
// app/error.tsx
"use client"

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-4">
      <h2 className="text-2xl font-bold mb-4">Något gick fel</h2>
      <p className="text-gray-600 mb-6">
        Vi har stött på ett tekniskt problem. Vårt team har meddelats.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Försök igen
      </button>
    </div>
  )
}
```

**Global Error Handler (Server):**

```typescript
// lib/error-handler.ts
export async function handleError(
  error: unknown,
  context?: {
    userId?: string
    workspaceId?: string
    action?: string
  }
): Promise<ErrorResponse> {
  // Log to Sentry with context
  Sentry.captureException(error, {
    user: { id: context?.userId },
    extra: context,
  })

  // Handle known error types
  if (error instanceof AppError) {
    return {
      success: false,
      error: error.message,
      code: error.code,
    }
  }

  if (error instanceof z.ZodError) {
    return {
      success: false,
      error: 'Validation failed',
      details: error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    }
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return {
        success: false,
        error: 'This record already exists',
      }
    }
    if (error.code === 'P2025') {
      return {
        success: false,
        error: 'Record not found',
      }
    }
  }

  // Generic error
  return {
    success: false,
    error: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
  }
}
```

---

## 18.4 Service-Specific Error Handling

**Database Errors:**

```typescript
// lib/db/error-handler.ts
export async function withDatabaseErrorHandling<T>(
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof Prisma.PrismaClientInitializationError) {
      // Database connection failed
      await notifyOps('Database connection failed', error)
      throw new AppError(
        'Database temporarily unavailable',
        'DB_CONNECTION_ERROR',
        503
      )
    }

    if (error instanceof Prisma.PrismaClientRustPanicError) {
      // Critical database error
      await notifyOps('Database panic', error)
      throw new AppError('Critical database error', 'DB_PANIC', 500)
    }

    throw error
  }
}
```

**External API Errors:**

```typescript
// lib/external/error-handler.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  options = { retries: 3, delay: 1000 }
): Promise<T> {
  let lastError: Error

  for (let i = 0; i <= options.retries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      if (i === options.retries) {
        throw new AppError(
          'External service unavailable after retries',
          'SERVICE_UNAVAILABLE',
          503
        )
      }

      // Exponential backoff
      await new Promise((resolve) =>
        setTimeout(resolve, options.delay * Math.pow(2, i))
      )
    }
  }

  throw lastError!
}

// Usage
const companyData = await withRetry(() => fetchBolagsverketData(orgNumber), {
  retries: 3,
  delay: 1000,
})
```

---

## 18.5 User-Friendly Error Messages

**Swedish Error Messages:**

```typescript
// lib/errors/messages.ts
export const ERROR_MESSAGES = {
  // Authentication
  AUTH_REQUIRED: 'Du måste vara inloggad för att fortsätta',
  SESSION_EXPIRED: 'Din session har gått ut. Vänligen logga in igen',

  // Validation
  INVALID_EMAIL: 'Ogiltig e-postadress',
  INVALID_PERSONNUMMER: 'Ogiltigt personnummer format (ÅÅMMDD-XXXX)',
  INVALID_ORG_NUMBER: 'Ogiltigt organisationsnummer',

  // Business rules
  DUPLICATE_EMPLOYEE: 'En anställd med detta personnummer finns redan',
  LAW_NOT_FOUND: 'Lagen kunde inte hittas',
  WORKSPACE_LIMIT: 'Du har nått gränsen för antal arbetsytor',

  // External services
  BOLAGSVERKET_DOWN: 'Bolagsverket är tillfälligt otillgängligt',
  AI_SERVICE_ERROR: 'AI-assistenten är tillfälligt otillgänglig',

  // Generic
  SOMETHING_WENT_WRONG: 'Något gick fel. Försök igen om en stund',
  TRY_AGAIN_LATER: 'Försök igen om några minuter',
}

export function getUserMessage(errorCode: string): string {
  return ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.SOMETHING_WENT_WRONG
}
```

**Toast Notifications:**

```typescript
// components/shared/error-toast.tsx
import { toast } from '@/components/ui/toast'

export function showError(error: string | Error) {
  const message =
    typeof error === 'string' ? error : getUserMessage(error.code || 'UNKNOWN')

  toast({
    title: 'Ett fel uppstod',
    description: message,
    variant: 'destructive',
    duration: 5000,
  })
}

// Usage
try {
  await updateEmployee(data)
  toast({ title: 'Sparad!', variant: 'success' })
} catch (error) {
  showError(error)
}
```

---

## 18.6 Logging Strategy

**Structured Logging:**

```typescript
// lib/logger.ts
interface LogContext {
  userId?: string
  workspaceId?: string
  action?: string
  metadata?: Record<string, any>
}

class Logger {
  private context: LogContext = {}

  setContext(context: LogContext) {
    this.context = { ...this.context, ...context }
  }

  info(message: string, data?: any) {
    console.log(
      JSON.stringify({
        level: 'info',
        message,
        timestamp: new Date().toISOString(),
        ...this.context,
        data,
      })
    )
  }

  error(message: string, error: Error, data?: any) {
    console.error(
      JSON.stringify({
        level: 'error',
        message,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
        timestamp: new Date().toISOString(),
        ...this.context,
        data,
      })
    )

    // Send to Sentry
    Sentry.captureException(error, {
      extra: { ...this.context, ...data },
    })
  }

  metric(name: string, value: number, tags?: Record<string, string>) {
    console.log(
      JSON.stringify({
        level: 'metric',
        name,
        value,
        tags,
        timestamp: new Date().toISOString(),
      })
    )
  }
}

export const logger = new Logger()
```

**Usage in Server Actions:**

```typescript
export async function createEmployee(data: unknown) {
  const startTime = Date.now()

  logger.setContext({
    action: 'createEmployee',
    userId: session?.user?.id,
  })

  try {
    const validated = EmployeeSchema.parse(data)
    logger.info('Creating employee', { email: validated.email })

    const employee = await prisma.employee.create({ data: validated })

    logger.info('Employee created successfully', { id: employee.id })
    logger.metric('employee.created', 1)
    logger.metric('employee.create.duration', Date.now() - startTime)

    return { success: true, data: employee }
  } catch (error) {
    logger.error('Failed to create employee', error as Error)
    return handleError(error)
  }
}
```

---

## 18.7 Error Recovery Strategies

**Optimistic Updates with Rollback:**

```typescript
// stores/kanban.ts
export const useKanbanStore = create((set, get) => ({
  moveCard: async (cardId: string, columnId: string) => {
    const previousState = get().cards

    // Optimistic update
    set((state) => ({
      cards: state.cards.map((card) =>
        card.id === cardId ? { ...card, columnId } : card
      ),
    }))

    try {
      await updateCardColumn(cardId, columnId)
    } catch (error) {
      // Rollback on error
      set({ cards: previousState })
      showError('Failed to move card')
      throw error
    }
  },
}))
```

**Circuit Breaker Pattern:**

```typescript
// lib/circuit-breaker.ts
class CircuitBreaker {
  private failures = 0
  private lastFailTime?: Date
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'

  constructor(
    private threshold = 5,
    private timeout = 60000 // 1 minute
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailTime!.getTime() > this.timeout) {
        this.state = 'HALF_OPEN'
      } else {
        throw new AppError('Service is temporarily disabled', 'CIRCUIT_OPEN', 503)
      }
    }

    try {
      const result = await fn()
      if (this.state === 'HALF_OPEN') {
        this.state = 'CLOSED'
        this.failures = 0
      }
      return result
    } catch (error) {
      this.failures++
      this.lastFailTime = new Date()

      if (this.failures >= this.threshold) {
        this.state = 'OPEN'
        logger.error('Circuit breaker opened', error as Error)
      }

      throw error
    }
  }
}

// Usage
const openAIBreaker = new CircuitBreaker(5, 60000)

export async function queryAI(prompt: string) {
  return openAIBreaker.execute(async () => {
    return await openai.chat.completions.create({ ... })
  })
}
```

---
