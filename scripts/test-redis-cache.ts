import { redis } from '@/lib/cache/redis'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

async function testCache() {
  console.log('🔍 Testing Redis cache operations...\n')
  
  // Test 1: Basic set/get
  console.log('1️⃣ Testing basic set/get:')
  const testKey = 'test:timestamp'
  const testValue = { timestamp: new Date().toISOString(), message: 'Test successful' }
  
  try {
    const setResult = await redis.set(testKey, JSON.stringify(testValue), { ex: 60 })
    console.log('  SET result:', setResult)
    
    const getResult = await redis.get(testKey)
    console.log('  GET result:', typeof getResult === 'string' ? JSON.parse(getResult) : getResult)
    console.log('  ✅ Basic operations work!\n')
  } catch (error) {
    console.log('  ❌ Error:', error, '\n')
  }
  
  // Test 2: Check for cached list items
  console.log('2️⃣ Looking for cached list items:')
  try {
    // Try to scan for keys (might not work with all Redis providers)
    const keys = await redis.keys('list-item-details:*')
    
    if (keys.length > 0) {
      console.log(`  Found ${keys.length} cached list items:`)
      
      for (const key of keys.slice(0, 3)) { // Show first 3
        const value = await redis.get(key)
        const parsed = typeof value === 'string' ? JSON.parse(value) : value
        
        console.log(`\n  📄 ${key}`)
        console.log(`     Document: ${parsed.document?.document_number || 'unknown'}`)
        console.log(`     Title: ${parsed.document?.title?.substring(0, 50) || 'unknown'}...`)
        console.log(`     Has full_text: ${!!parsed.document?.full_text}`)
        console.log(`     Has html_content: ${!!parsed.document?.html_content}`)
        
        if (parsed.document?.full_text) {
          console.log(`     Full text size: ${parsed.document.full_text.length} chars`)
        }
        if (parsed.document?.html_content) {
          console.log(`     HTML content size: ${parsed.document.html_content.length} chars`)
        }
      }
    } else {
      console.log('  No cached list items found')
    }
  } catch (error) {
    // Keys command might not be supported, try specific key
    console.log('  Scanning not supported, trying specific keys...')
    
    // Try a few common patterns
    const testKeys = [
      'list-item-details:5d3f9c6f-50de-47fe-8fbc-f4c93d8e8d93',
      'list-item-details:*' // This might return something
    ]
    
    for (const key of testKeys) {
      try {
        const value = await redis.get(key)
        if (value) {
          console.log(`  ✅ Found cached item: ${key}`)
          const parsed = typeof value === 'string' ? JSON.parse(value) : value
          console.log(`     Has full_text: ${!!parsed.document?.full_text}`)
          console.log(`     Has html_content: ${!!parsed.document?.html_content}`)
        }
      } catch (e) {
        // Ignore
      }
    }
  }
  
  // Test 3: Check TTL
  console.log('\n3️⃣ Testing TTL on cached items:')
  try {
    const keys = await redis.keys('list-item-details:*')
    if (keys.length > 0) {
      const ttl = await redis.ttl(keys[0])
      console.log(`  TTL for ${keys[0].substring(0, 40)}...: ${ttl} seconds`)
      if (ttl > 0) {
        console.log(`  (Expires in ${Math.round(ttl / 60)} minutes)`)
      }
    }
  } catch (e) {
    console.log('  TTL check not available')
  }
  
  console.log('\n✅ Cache test complete!')
}

testCache()