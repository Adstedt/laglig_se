/**
 * Script to warm up the document cache with popular documents
 * Run this periodically (e.g., via cron) to pre-cache frequently accessed documents
 */

import * as dotenv from 'dotenv'
import {
  warmDocumentCache,
  getDocumentCacheStats,
} from '@/lib/services/document-cache'

dotenv.config({ path: '.env.local' })

async function main() {
  console.log('🔥 Starting document cache warming...\n')

  // Get current cache stats
  const statsBefore = await getDocumentCacheStats()
  console.log('📊 Cache stats before warming:')
  console.log(`   Cached documents: ${statsBefore.cachedDocuments}`)
  console.log(
    `   Estimated size: ${(statsBefore.estimatedSize / 1024 / 1024).toFixed(2)} MB\n`
  )

  // Warm the cache with top 100 most popular documents
  const startTime = Date.now()
  await warmDocumentCache(100)
  const duration = Date.now() - startTime

  // Get updated stats
  const statsAfter = await getDocumentCacheStats()
  console.log('\n📊 Cache stats after warming:')
  console.log(`   Cached documents: ${statsAfter.cachedDocuments}`)
  console.log(
    `   Estimated size: ${(statsAfter.estimatedSize / 1024 / 1024).toFixed(2)} MB`
  )
  console.log(
    `   New documents cached: ${statsAfter.cachedDocuments - statsBefore.cachedDocuments}`
  )
  console.log(`   Time taken: ${(duration / 1000).toFixed(1)} seconds`)

  console.log('\n✅ Cache warming complete!')
  process.exit(0)
}

main().catch((error) => {
  console.error('❌ Cache warming failed:', error)
  process.exit(1)
})
