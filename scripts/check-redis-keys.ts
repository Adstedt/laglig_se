import { redis } from '@/lib/cache/redis'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function checkKeys() {
  console.log('🔍 Checking all keys in Redis...\n')

  try {
    // This might not work with all Redis providers
    const keys = await redis.keys('*')

    if (keys.length === 0) {
      console.log('❌ No keys found in Redis')
    } else {
      console.log(`✅ Found ${keys.length} keys:\n`)
      for (const key of keys) {
        const ttl = await redis.ttl(key)
        const type = await redis.type(key)
        console.log(`  ${key}`)
        console.log(`    Type: ${type}, TTL: ${ttl}s\n`)
      }
    }
  } catch (error) {
    // Fallback - check specific patterns
    console.log('Checking specific key patterns...\n')

    // Test if any keys exist
    await redis.set('test:ping', 'pong', { ex: 10 })
    const test = await redis.get('test:ping')
    console.log('Test key works:', test, '\n')

    // Try specific patterns
    const patterns = ['list-item-details:*', 'document:content:*', 'test:*']

    for (const pattern of patterns) {
      console.log(`Checking pattern: ${pattern}`)
      // Note: keys() might not be available in all Redis providers
    }
  }
}

checkKeys()
