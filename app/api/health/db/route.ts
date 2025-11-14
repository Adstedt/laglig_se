import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Test database connection with simple query
    await prisma.$queryRaw`SELECT 1 as result`

    // Get database information
    const result = await prisma.$queryRaw<
      Array<{ version: string }>
    >`SELECT version()`

    const dbVersion = result[0]?.version || 'unknown'

    // Test pgvector extension
    const vectorCheck = await prisma.$queryRaw<
      Array<{ vector_enabled: boolean }>
    >`
      SELECT EXISTS(
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
      ) as vector_enabled
    `

    return NextResponse.json(
      {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
        version: dbVersion,
        extensions: {
          pgvector: vectorCheck[0]?.vector_enabled || false,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Database health check failed:', error)

    return NextResponse.json(
      {
        status: 'error',
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  }
}
