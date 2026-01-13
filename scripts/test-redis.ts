import { redis } from '@/lib/cache/redis'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function testRedis() {
  console.log('Testing Redis connection...\n')
  
  try {
    // Test set
    await redis.set('test:key', 'Hello Redis!', { ex: 60 })
    console.log('✅ SET successful')
    
    // Test get
    const value = await redis.get('test:key')
    console.log('✅ GET successful:', value)
    
    // Test TTL
    const ttl = await redis.ttl('test:key')
    console.log('✅ TTL successful:', ttl, 'seconds')
    
    // Clean up
    await redis.del('test:key')
    console.log('✅ DEL successful')
    
    console.log('\n🎉 Redis is working perfectly!')
    
  } catch (error) {
    console.error('❌ Redis error:', error)
    console.log('\nCheck your .env.local:')
    console.log('UPSTASH_REDIS_REST_URL=', process.env.UPSTASH_REDIS_REST_URL ? '✅ Set' : '❌ Missing')
    console.log('UPSTASH_REDIS_REST_TOKEN=', process.env.UPSTASH_REDIS_REST_TOKEN ? '✅ Set' : '❌ Missing')
  }
}

testRedis()
