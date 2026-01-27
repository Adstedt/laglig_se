import { redis, isRedisConfigured } from '@/lib/cache/redis'
import { getCachedDocument } from '@/lib/services/document-cache'
import { prisma } from '@/lib/prisma'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function checkModalPerformance() {
  console.log('🔍 Checking modal performance for 1977:1160...\n')

  // 1. Check Redis configuration
  console.log('1️⃣ Redis Configuration:')
  console.log(
    '   URL:',
    process.env.UPSTASH_REDIS_REST_URL ? '✅ Set' : '❌ Missing'
  )
  console.log(
    '   Token:',
    process.env.UPSTASH_REDIS_REST_TOKEN ? '✅ Set' : '❌ Missing'
  )
  console.log('   isRedisConfigured:', isRedisConfigured)

  // 2. Test Redis connectivity
  console.log('\n2️⃣ Testing Redis connectivity:')
  try {
    const testKey = 'test:connectivity'
    await redis.set(testKey, 'test-value', { ex: 10 })
    const result = await redis.get(testKey)
    console.log(
      '   Set/Get test:',
      result === 'test-value' ? '✅ Working' : `❌ Failed (got: ${result})`
    )
  } catch (error) {
    console.log('   ❌ Redis error:', error)
  }

  // 3. Check if document is cached
  console.log('\n3️⃣ Checking document cache:')

  // Find the document ID for 1977:1160
  const doc = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 1977:1160' },
    select: { id: true, title: true },
  })

  if (!doc) {
    console.log('   ❌ Document not found in database!')
    return
  }

  console.log(`   Document found: ${doc.id}`)

  // Check if it's in Redis
  const docCacheKey = `document:${doc.id}`
  const cachedDoc = await redis.get(docCacheKey)

  if (cachedDoc) {
    console.log('   ✅ Document IS in Redis cache')
    const parsed =
      typeof cachedDoc === 'string' ? JSON.parse(cachedDoc) : cachedDoc
    console.log(`      Size: ${JSON.stringify(parsed).length} bytes`)
  } else {
    console.log('   ❌ Document NOT in Redis cache')
  }

  // 4. Test fetching through centralized cache
  console.log('\n4️⃣ Testing getCachedDocument function:')
  const startTime = Date.now()
  const cached = await getCachedDocument(doc.id)
  const duration = Date.now() - startTime

  if (cached) {
    console.log(`   ✅ Retrieved in ${duration}ms`)
    console.log(`      Has HTML: ${!!cached.htmlContent}`)
    console.log(`      HTML size: ${cached.htmlContent?.length || 0} chars`)
  } else {
    console.log(`   ❌ Failed to retrieve (took ${duration}ms)`)
  }

  // 5. Check list item cache
  console.log('\n5️⃣ Checking list item cache:')
  const listItems = await prisma.lawListItem.findMany({
    where: { document_id: doc.id },
    select: { id: true, law_list_id: true },
  })

  console.log(`   Found ${listItems.length} list items with this document`)

  for (const item of listItems.slice(0, 3)) {
    const cacheKey = `list-item-details:${item.id}`
    const cached = await redis.get(cacheKey)
    console.log(
      `   Item ${item.id.substring(0, 8)}...: ${cached ? '✅ Cached' : '❌ Not cached'}`
    )
  }

  // 6. Check database connection
  console.log('\n6️⃣ Testing database query performance:')
  const queryStart = Date.now()
  const _testQuery = await prisma.legalDocument.findFirst({
    where: { document_number: 'SFS 1977:1160' },
    select: { id: true },
  })
  const queryDuration = Date.now() - queryStart
  console.log(
    `   Simple query took: ${queryDuration}ms ${queryDuration > 100 ? '⚠️ SLOW' : '✅'}`
  )

  // 7. Check if indexes exist
  console.log('\n7️⃣ Checking critical indexes:')
  const indexes = (await prisma.$queryRaw`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'law_list_items'
    AND indexname IN ('idx_law_list_items_document_id', 'idx_law_list_items_list_id')
  `) as any[]

  console.log(`   Found ${indexes.length} of 2 critical indexes`)
  indexes.forEach((idx: any) => {
    console.log(`   ✅ ${idx.indexname}`)
  })

  if (indexes.length < 2) {
    console.log('   ⚠️ Missing indexes! This will cause slow queries.')
  }
}

checkModalPerformance().then(() => process.exit(0))
