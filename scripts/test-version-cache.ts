/**
 * Test caching layer for law versions
 */
import {
  getCachedLawVersion,
  getCachedLawDiff,
  getCacheStats,
  invalidateLawCache,
} from '../lib/legal-document/version-cache'

async function main() {
  console.log('=== Testing Version Cache ===\n')

  const testLaw = '1977:1160'
  const testDate = new Date('2020-01-01')

  // Initial stats
  console.log('Initial cache stats:', getCacheStats())

  // First call - should be cache miss
  console.log('\n--- First call (cache miss expected) ---')
  const start1 = Date.now()
  const v1 = await getCachedLawVersion(testLaw, testDate)
  const time1 = Date.now() - start1
  console.log(`Result: ${v1 ? 'OK' : 'null'} (${time1}ms)`)
  console.log('Stats:', getCacheStats())

  // Second call - should be cache hit
  console.log('\n--- Second call (cache hit expected) ---')
  const start2 = Date.now()
  const v2 = await getCachedLawVersion(testLaw, testDate)
  const time2 = Date.now() - start2
  console.log(`Result: ${v2 ? 'OK' : 'null'} (${time2}ms)`)
  console.log('Stats:', getCacheStats())
  console.log(`Speedup: ${(time1 / Math.max(time2, 1)).toFixed(1)}x faster`)

  // Test diff caching
  console.log('\n--- Diff cache test ---')
  const dateA = new Date('2015-01-01')
  const dateB = new Date('2020-01-01')

  const startDiff1 = Date.now()
  const d1 = await getCachedLawDiff(testLaw, dateA, dateB)
  const timeDiff1 = Date.now() - startDiff1
  console.log(`First diff call: ${d1 ? 'OK' : 'null'} (${timeDiff1}ms)`)

  const startDiff2 = Date.now()
  const d2 = await getCachedLawDiff(testLaw, dateA, dateB)
  const timeDiff2 = Date.now() - startDiff2
  console.log(`Second diff call: ${d2 ? 'OK' : 'null'} (${timeDiff2}ms)`)
  console.log('Final stats:', getCacheStats())

  // Test invalidation
  console.log('\n--- Cache invalidation test ---')
  invalidateLawCache(testLaw)
  console.log('Stats after invalidation:', getCacheStats())

  // Verify cache was cleared
  const start3 = Date.now()
  const v3 = await getCachedLawVersion(testLaw, testDate)
  const time3 = Date.now() - start3
  console.log(`After invalidation: ${v3 ? 'OK' : 'null'} (${time3}ms)`)
  console.log('Stats:', getCacheStats())

  console.log('\n=== Test Complete ===')
  process.exit(0)
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
