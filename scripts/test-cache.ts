import { redis } from '@/lib/cache/redis'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function checkCache() {
  console.log('🔍 Checking Redis cache for law documents...\n')
  
  // Look for any cached documents
  const keys = await redis.keys('document:content:*')
  console.log(`Found ${keys.length} cached documents\n`)
  
  if (keys.length > 0) {
    for (const key of keys.slice(0, 5)) {
      const ttl = await redis.ttl(key)
      console.log(`📄 ${key}`)
      console.log(`   TTL: ${Math.floor(ttl / 3600)} hours ${Math.floor((ttl % 3600) / 60)} minutes remaining\n`)
    }
  }
  
  // Check list item cache
  const listKeys = await redis.keys('list-item-details:*')
  console.log(`\nFound ${listKeys.length} cached list items\n`)
  
  if (listKeys.length > 0) {
    for (const key of listKeys.slice(0, 3)) {
      const ttl = await redis.ttl(key)
      console.log(`📋 ${key}`)
      console.log(`   TTL: ${Math.floor(ttl / 60)} minutes remaining\n`)
    }
  }
}

checkCache()
