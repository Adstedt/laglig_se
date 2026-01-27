import { Redis } from '@upstash/redis'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function testRedisClient() {
  console.log('🔍 Testing @upstash/redis client...\n')

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  })

  // Test 1: Set and get a test value
  console.log('1️⃣ Testing set/get with client:')
  const testKey = 'test:client'
  const testValue = {
    message: 'Hello from client',
    timestamp: new Date().toISOString(),
  }

  // Set with explicit JSON stringify
  const setResult = await redis.set(testKey, JSON.stringify(testValue), {
    ex: 60,
  })
  console.log('  SET result:', setResult)

  // Get the value
  const getRawResult = await redis.get(testKey)
  console.log('  GET raw result type:', typeof getRawResult)
  console.log('  GET raw result:', getRawResult)

  // Parse if string
  const parsed =
    typeof getRawResult === 'string' ? JSON.parse(getRawResult) : getRawResult
  console.log('  Parsed result:', parsed)

  // Test 2: Get existing cached item
  console.log('\n2️⃣ Getting existing cached item:')
  const existingKey = 'list-item-details:4ab4d156-b3d2-4785-b684-b62897deb370'

  const existingItem = await redis.get(existingKey)
  console.log('  Result type:', typeof existingItem)
  console.log('  Result is null?', existingItem === null)
  console.log('  Result is undefined?', existingItem === undefined)

  if (existingItem) {
    const itemParsed =
      typeof existingItem === 'string' ? JSON.parse(existingItem) : existingItem
    console.log('  ✅ Found cached item!')
    console.log('  - ID:', itemParsed.id)
    console.log('  - Document number:', itemParsed.document?.document_number)
    console.log('  - Has HTML content:', !!itemParsed.document?.html_content)
  } else {
    console.log('  ❌ Item not found via client')
  }

  // Test 3: List keys
  console.log('\n3️⃣ Listing keys:')
  try {
    const keys = await redis.keys('*')
    console.log('  Found', keys.length, 'keys')
    if (keys.includes(existingKey)) {
      console.log('  ✅ Existing key IS in the list')
    } else {
      console.log('  ❌ Existing key NOT in the list')
    }
  } catch (e) {
    console.log('  Keys command not supported')
  }
}

testRedisClient()
