import { getCachedDocumentBySlug } from '@/lib/services/document-cache'
import { redis } from '@/lib/cache/redis'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function testPublicPageCache() {
  console.log('🔍 Testing public page cache for 1977:1160...\n')

  // The slug for the law page you visited
  const slug = 'arbetsmiljolag-19771160-1977-1160'

  // Test 1: Check if slug mapping exists
  const slugKey = `document:slug:${slug}`
  const cachedId = await redis.get(slugKey)

  if (cachedId) {
    console.log('✅ Slug mapping found in cache!')
    console.log(`   ${slug} → ${cachedId}\n`)

    // Test 2: Check if document is cached
    const docKey = `document:${cachedId}`
    const cachedDoc = await redis.get(docKey)

    if (cachedDoc) {
      console.log('✅ Document IS cached in Redis!')
      const parsed =
        typeof cachedDoc === 'string' ? JSON.parse(cachedDoc) : cachedDoc
      console.log(`   Document: ${parsed.documentNumber}`)
      console.log(`   Title: ${parsed.title}`)
      console.log(`   Has HTML: ${!!parsed.htmlContent}`)
      console.log(`   HTML size: ${parsed.htmlContent?.length || 0} chars`)
    } else {
      console.log('❌ Document NOT in cache (but slug mapping exists)')
    }
  } else {
    console.log(
      '❌ Slug mapping NOT found - document was never cached via public page'
    )
    console.log('   This means getCachedDocumentBySlug was never called')
  }

  // Test 3: Try to fetch via our centralized cache
  console.log('\n📚 Testing getCachedDocumentBySlug function...')
  const doc = await getCachedDocumentBySlug(slug)

  if (doc) {
    console.log('✅ Document retrieved successfully!')
    console.log(`   Document: ${doc.documentNumber}`)
    console.log(`   From cache or DB: Check logs above`)
  } else {
    console.log('❌ Document not found')
  }

  // Test 4: Check what's actually in Redis
  console.log('\n📦 All document-related keys in Redis:')
  const keys = await redis.keys('document:*')
  console.log(`   Found ${keys.length} keys`)

  // Group by type
  const slugKeys = keys.filter((k) => k.includes(':slug:'))
  const numberKeys = keys.filter((k) => k.includes(':number:'))
  const docKeys = keys.filter(
    (k) =>
      !k.includes(':slug:') &&
      !k.includes(':number:') &&
      !k.includes(':content:')
  )

  console.log(`   - ${docKeys.length} document entries`)
  console.log(`   - ${slugKeys.length} slug mappings`)
  console.log(`   - ${numberKeys.length} number mappings`)

  if (docKeys.length > 0 && docKeys.length <= 10) {
    console.log('\n   Document IDs cached:')
    docKeys.forEach((key) => {
      console.log(`     - ${key}`)
    })
  }
}

testPublicPageCache()
