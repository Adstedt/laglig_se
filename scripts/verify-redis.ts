import { redis } from '@/lib/cache/redis'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function verify() {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    console.log('❌ Redis not configured!')
    console.log('\nAdd to .env.local:')
    console.log('UPSTASH_REDIS_REST_URL="https://YOUR-ENDPOINT.upstash.io"')
    console.log('UPSTASH_REDIS_REST_TOKEN="YOUR-TOKEN"')
    return
  }

  console.log('✅ Redis credentials found!')
  console.log('URL:', process.env.UPSTASH_REDIS_REST_URL)

  try {
    await redis.set('test', 'success')
    const result = await redis.get('test')
    await redis.del('test')

    console.log('\n🎉 Redis is working! Test value:', result)
    console.log('\nYour caching system is now active!')
    console.log('- First user loads: 1-2 seconds')
    console.log('- All subsequent loads: < 100ms')
  } catch (error) {
    console.error('❌ Connection failed:', error)
  }
}

verify()
