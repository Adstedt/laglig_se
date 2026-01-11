import { PrismaClient } from '@prisma/client'

/**
 * Story 6.0: Optimized connection pool configuration
 * Uses connection pooling parameters for better performance
 */
const prismaClientSingleton = () => {
  // Parse DATABASE_URL to add connection pool parameters if not present
  const databaseUrl = process.env.DATABASE_URL
  if (databaseUrl && !databaseUrl.includes('pgbouncer=true')) {
    // Add optimal pool settings to the connection string
    const url = new URL(databaseUrl)
    url.searchParams.set('pgbouncer', 'true')
    url.searchParams.set('connection_limit', '10')
    url.searchParams.set('pool_timeout', '20')
    process.env.DATABASE_URL = url.toString()
  }

  return new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    // Story 6.0: Add query performance logging in development
    ...(process.env.NODE_ENV === 'development' && {
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ],
    }),
  })
}

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma
}

// Story 6.0: Log slow queries in development
if (process.env.NODE_ENV === 'development' && prisma.$on) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma.$on('query' as any, (e: any) => {
    if (e.duration > 100) {
      console.warn(`⚠️ Slow query (${e.duration}ms):`, e.query)
    }
  })
}

// Graceful shutdown in production
if (process.env.NODE_ENV === 'production') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect()
  })
}

/**
 * Retry a database operation with exponential backoff
 * Useful for handling connection pool exhaustion during high-concurrency scenarios
 * like Vercel static generation builds.
 *
 * @param operation - Async function to retry
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param baseDelayMs - Base delay in ms, doubles each retry (default: 1000)
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error

      // Only retry on connection pool errors (P2024)
      const isPrismaPoolError =
        error instanceof Error &&
        'code' in error &&
        (error as { code: string }).code === 'P2024'

      if (!isPrismaPoolError || attempt === maxRetries) {
        throw error
      }

      // Exponential backoff with jitter
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500
      console.warn(
        `[Prisma] Connection pool timeout, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${maxRetries})`
      )
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}
