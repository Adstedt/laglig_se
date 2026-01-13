/**
 * Cron endpoint for cache warming on Vercel
 *
 * This runs periodically to ensure popular documents stay cached.
 * Designed to work with Vercel Cron Jobs or external services like GitHub Actions.
 *
 * Usage:
 * - Vercel Cron: Add to vercel.json
 * - GitHub Actions: Call with CRON_SECRET
 * - Manual: curl -H "Authorization: Bearer YOUR_SECRET" https://yoursite.com/api/cron/warm-cache
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCachedDocument } from '@/lib/services/document-cache'
import { redis, isRedisConfigured } from '@/lib/cache/redis'

export const maxDuration = 300 // 5 minutes max for cron job

export async function GET(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get('authorization')
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`

  // In development, allow without auth
  if (process.env.NODE_ENV === 'production' && authHeader !== expectedAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if Redis is configured
  if (!isRedisConfigured()) {
    return NextResponse.json({ error: 'Redis not configured' }, { status: 503 })
  }

  const startTime = Date.now()

  try {
    // Get top documents from BOTH law lists AND public visits
    // This brilliant combination catches all use cases!
    const { getMostPopularDocuments } = await import(
      '@/app/actions/track-visit'
    )
    const popularDocs = await getMostPopularDocuments(200)

    console.log(`🔥 Starting cache warming for ${popularDocs.length} documents`)
    console.log('📊 Document sources:')
    const sources = {
      law_lists: popularDocs.filter((d) => d.source === 'law_lists').length,
      public_visits: popularDocs.filter((d) => d.source === 'public_visits')
        .length,
      both: popularDocs.filter((d) => d.source === 'both').length,
    }
    console.log(`   Law lists only: ${sources.law_lists}`)
    console.log(`   Public visits only: ${sources.public_visits}`)
    console.log(`   Both sources: ${sources.both} (most valuable!)`)

    // Statistics
    let alreadyCached = 0
    let newlyCached = 0
    let failed = 0
    const documents: string[] = []

    // Process in batches to avoid timeouts
    const batchSize = 20 // Larger batches for cron job

    for (let i = 0; i < popularDocs.length; i += batchSize) {
      const batch = popularDocs.slice(i, i + batchSize)

      await Promise.all(
        batch.map(async (item) => {
          if (!item.document_id) return

          try {
            // Check if already cached
            const cacheKey = `document:${item.document_id}`
            const existing = await redis.get(cacheKey)

            if (existing) {
              alreadyCached++
            } else {
              // Fetch and cache
              const doc = await getCachedDocument(item.document_id)
              if (doc) {
                newlyCached++
                documents.push(doc.documentNumber)
              } else {
                failed++
                console.log(
                  `❌ Document ${item.document_id} not found in database`
                )
              }
            }
          } catch (error) {
            failed++
            console.error(`❌ Failed to warm ${item.document_id}:`, error)
          }
        })
      )
    }

    const duration = Date.now() - startTime

    // Also get some stats about cache effectiveness
    const totalListItems = await prisma.lawListItem.count()
    const uniqueDocuments = await prisma.lawListItem.findMany({
      select: { document_id: true },
      distinct: ['document_id'],
    })

    const coveragePercent = Math.round((200 / uniqueDocuments.length) * 100)

    return NextResponse.json({
      success: true,
      stats: {
        duration: `${(duration / 1000).toFixed(1)}s`,
        processed: popularDocs.length,
        alreadyCached,
        newlyCached,
        failed,
        coverage: {
          totalListItems,
          totalUniqueDocuments: uniqueDocuments.length,
          cachedDocuments: 200,
          coveragePercent: `${coveragePercent}%`,
          estimatedHitRate: '80-90%', // Based on your 80% overlap observation
        },
      },
      // Return first few warmed documents for verification
      warmedDocuments: documents.slice(0, 10),
      message: `Warmed ${newlyCached} new documents, ${alreadyCached} already cached`,
    })
  } catch (error) {
    console.error('Cache warming error:', error)
    return NextResponse.json(
      {
        error: 'Cache warming failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// Also support POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request)
}
