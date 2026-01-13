/**
 * Cache Warming on Server Startup
 * 
 * This module warms up the cache when the server starts to ensure
 * the first users don't experience slow load times.
 * 
 * Strategy:
 * 1. Pre-cache the most popular documents
 * 2. Pre-cache recently accessed documents
 * 3. Run in background to not block server startup
 */

import { getCachedDocument } from '@/lib/services/document-cache'
import { prisma } from '@/lib/prisma'
import { redis, isRedisConfigured } from '@/lib/cache/redis'

let isWarming = false
let hasWarmed = false

/**
 * Warm the cache on server startup
 * This runs in the background and doesn't block server startup
 */
export async function warmCacheOnStartup() {
  // Only run once per server instance
  if (hasWarmed || isWarming) {
    return
  }
  
  // Skip if Redis not configured
  if (!isRedisConfigured()) {
    console.log('⏭️ Skipping cache warming - Redis not configured')
    return
  }
  
  isWarming = true
  
  // Run in background with a small delay to let server fully start
  setTimeout(async () => {
    try {
      await performCacheWarming()
      hasWarmed = true
    } catch (error) {
      console.error('❌ Cache warming failed:', error)
    } finally {
      isWarming = false
    }
  }, 5000) // 5 second delay to let server stabilize
}

async function performCacheWarming() {
  console.log('🔥 Starting cache warming...')
  const startTime = Date.now()
  
  try {
    // Get popular documents from BOTH law lists AND public visits
    const { getMostPopularDocuments } = await import('@/app/actions/track-visit')
    const popularDocs = await getMostPopularDocuments(200)
    
    console.log(`📊 Cache warming strategy: Law Lists + Public Visits`)
    console.log(`   Found ${popularDocs.length} documents to warm`)
    
    // Show source breakdown
    const sources = {
      both: popularDocs.filter(d => d.source === 'both').length,
      law_lists: popularDocs.filter(d => d.source === 'law_lists').length,
      public_visits: popularDocs.filter(d => d.source === 'public_visits').length
    }
    
    if (sources.both > 0) {
      console.log(`   🏆 ${sources.both} documents in BOTH (highest priority)`)
    }
    if (sources.law_lists > 0) {
      console.log(`   📋 ${sources.law_lists} documents from law lists only`)
    }
    if (sources.public_visits > 0) {
      console.log(`   🌐 ${sources.public_visits} documents from public visits only`)
    }
    
    // 2. Check which ones are already cached
    let alreadyCached = 0
    let newlyCached = 0
    let failed = 0
    
    // Process in batches of 10 (faster for 200 docs, but still controlled)
    const batchSize = 10
    const totalBatches = Math.ceil(popularDocs.length / batchSize)
    
    for (let i = 0; i < popularDocs.length; i += batchSize) {
      const batch = popularDocs.slice(i, i + batchSize)
      const batchNum = Math.floor(i / batchSize) + 1
      
      // Progress indicator for large warming
      if (batchNum % 5 === 0 || batchNum === totalBatches) {
        console.log(`   Progress: ${batchNum}/${totalBatches} batches (${Math.min(i + batchSize, popularDocs.length)}/${popularDocs.length} docs)`)
      }
      
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
              // Not cached, fetch it (which will cache it)
              const doc = await getCachedDocument(item.document_id)
              if (doc) {
                newlyCached++
                // Only log first few to avoid spam
                if (newlyCached <= 10) {
                  const sourceIcon = item.source === 'both' ? '🏆' : 
                                    item.source === 'law_lists' ? '📋' : '🌐'
                  console.log(`  ✅ Warmed: ${doc.documentNumber} ${sourceIcon} (score: ${item.score})`)
                }
              } else {
                failed++
              }
            }
          } catch (error) {
            failed++
            console.warn(`  ⚠️ Failed to warm document ${item.document_id}`)
          }
        })
      )
      
      // Small delay between batches to avoid overload
      if (i + batchSize < popularDocs.length) {
        await new Promise(resolve => setTimeout(resolve, 50)) // Reduced delay since we're doing important work
      }
    }
    
    const duration = Date.now() - startTime
    console.log(`✅ Cache warming complete in ${(duration / 1000).toFixed(1)}s`)
    console.log(`   Already cached: ${alreadyCached}`)
    console.log(`   Newly cached: ${newlyCached}`)
    console.log(`   Failed: ${failed}`)
    
    // 3. Also warm specific critical documents if configured
    const criticalDocs = process.env.CRITICAL_CACHE_DOCS?.split(',') || []
    if (criticalDocs.length > 0) {
      console.log(`🎯 Warming ${criticalDocs.length} critical documents...`)
      
      for (const docNumber of criticalDocs) {
        try {
          const doc = await prisma.legalDocument.findFirst({
            where: { document_number: docNumber.trim() },
            select: { id: true }
          })
          
          if (doc) {
            await getCachedDocument(doc.id)
            console.log(`  ✅ Warmed critical: ${docNumber}`)
          }
        } catch (error) {
          console.warn(`  ⚠️ Failed to warm critical doc ${docNumber}`)
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Cache warming error:', error)
  }
}

/**
 * Get cache warming status
 */
export function getCacheWarmingStatus() {
  return {
    isWarming,
    hasWarmed,
  }
}