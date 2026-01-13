import { redis } from '@/lib/cache/redis'
import { prisma } from '@/lib/prisma'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function checkCache() {
  console.log('🔍 Checking what\'s cached for law 1977:1160...\n')
  
  // First, find the document ID for 1977:1160
  const doc = await prisma.legalDocument.findFirst({
    where: {
      document_number: 'SFS 1977:1160'
    },
    select: {
      id: true,
      title: true
    }
  })
  
  if (doc) {
    console.log(`📄 Found document: ${doc.title}`)
    console.log(`   ID: ${doc.id}\n`)
    
    // Check if document content is cached
    const contentCacheKey = `document:content:${doc.id}`
    const contentCached = await redis.get(contentCacheKey)
    
    if (contentCached) {
      const ttl = await redis.ttl(contentCacheKey)
      const content = JSON.parse(contentCached as string)
      console.log('✅ DOCUMENT CONTENT IS CACHED!')
      console.log(`   Cache key: ${contentCacheKey}`)
      console.log(`   TTL: ${Math.floor(ttl / 3600)}h ${Math.floor((ttl % 3600) / 60)}m remaining`)
      console.log(`   Content size: ${JSON.stringify(content).length} bytes`)
      console.log(`   Has HTML: ${!!content.htmlContent}`)
      console.log(`   Has full text: ${!!content.fullText}\n`)
    } else {
      console.log('❌ Document content NOT cached\n')
    }
  }
  
  // Check all cached list items
  const listItemKeys = await redis.keys('list-item-details:*')
  console.log(`\n📋 Found ${listItemKeys.length} cached list items:`)
  
  for (const key of listItemKeys) {
    const ttl = await redis.ttl(key)
    const data = await redis.get(key)
    if (data) {
      const parsed = JSON.parse(data as string)
      console.log(`\n   ${key}`)
      console.log(`   Document: ${parsed.document?.document_number || 'unknown'}`)
      console.log(`   TTL: ${Math.floor(ttl / 60)} minutes remaining`)
    }
  }
  
  // Check all cached document contents
  const docKeys = await redis.keys('document:content:*')
  console.log(`\n📚 Total cached documents: ${docKeys.length}`)
  
  if (docKeys.length > 0) {
    console.log('\nCached documents:')
    for (const key of docKeys.slice(0, 5)) {
      const ttl = await redis.ttl(key)
      console.log(`   ${key.substring(0, 50)}... (TTL: ${Math.floor(ttl / 3600)}h)`)
    }
  }
  
  await prisma.$disconnect()
}

checkCache().catch(console.error)
