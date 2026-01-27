#!/usr/bin/env npx tsx

/**
 * Test script to run sync-sfs cron job locally
 */

import 'dotenv/config'

async function testSyncSfs() {
  console.log('🚀 Testing sync-sfs cron job locally...\n')

  const url = 'http://localhost:3000/api/cron/sync-sfs'

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        // Pass empty Bearer token to bypass auth in development
        Authorization: 'Bearer test-local',
      },
    })

    if (!response.ok) {
      console.error(`❌ HTTP ${response.status}: ${response.statusText}`)
      const text = await response.text()
      console.error(text)
      return
    }

    const result = await response.json()

    console.log('✅ Sync completed successfully!\n')
    console.log('📊 Results:')
    console.log(`  - Success: ${result.success}`)
    console.log(`  - Sync Status: ${result.syncStatus}`)
    console.log(`  - Duration: ${result.duration}`)
    console.log('\n📈 Stats:')
    console.log(`  - API Count: ${result.stats.apiCount}`)
    console.log(`  - Pages Checked: ${result.stats.pagesChecked}`)
    console.log(`  - Fetched: ${result.stats.fetched}`)
    console.log(`  - Inserted: ${result.stats.inserted}`)
    console.log(`  - Skipped (already exist): ${result.stats.skipped}`)
    console.log(`  - Failed: ${result.stats.failed}`)
    console.log(`  - Early Terminated: ${result.stats.earlyTerminated}`)
    console.log(`  - DB Total Count: ${result.stats.dbCount}`)

    if (result.stats.newestApiSfs) {
      console.log('\n🔍 Newest API Document:')
      console.log(`  - SFS Number: ${result.stats.newestApiSfs}`)
      console.log(`  - Published: ${result.stats.newestApiPublicerad}`)
      console.log(
        `  - In Our DB: ${result.stats.newestInDb ? '✅ YES' : '❌ NO'}`
      )
    }

    if (result.stats.insertedDocs && result.stats.insertedDocs.length > 0) {
      console.log('\n📝 Newly Inserted Documents:')
      result.stats.insertedDocs.forEach(
        (doc: { sfsNumber: string; title: string }) => {
          console.log(`  - ${doc.sfsNumber}: ${doc.title.substring(0, 60)}...`)
        }
      )
    }

    return result
  } catch (error) {
    console.error('❌ Error running sync-sfs:', error)
  }
}

// Run the test
testSyncSfs()
  .then(() => {
    console.log('\n✨ Test complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
