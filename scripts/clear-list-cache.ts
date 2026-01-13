import { redis } from '@/lib/cache/redis'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function clearListCache() {
  console.log('🗑️ Clearing list item cache...\n')
  
  try {
    // Clear all list item caches (they have invalid structure)
    const keys = await redis.keys('list-item-details:*')
    
    if (keys.length > 0) {
      console.log(`Found ${keys.length} cached list items to clear`)
      
      for (const key of keys) {
        await redis.del(key)
        console.log(`  Deleted: ${key}`)
      }
      
      console.log('\n✅ List item cache cleared!')
    } else {
      console.log('No list item cache entries found')
    }
    
    // Also clear document cache to ensure fresh data
    const docKeys = await redis.keys('document:*')
    if (docKeys.length > 0) {
      console.log(`\nClearing ${docKeys.length} document cache entries...`)
      for (const key of docKeys) {
        await redis.del(key)
      }
      console.log('✅ Document cache cleared!')
    }
    
  } catch (error) {
    console.error('Error clearing cache:', error)
  }
}

clearListCache()