import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

// Test Upstash Redis directly without our wrapper
async function testUpstashDirect() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  
  if (!url || !token) {
    console.log('❌ Missing Redis credentials')
    return
  }
  
  console.log('🔍 Testing Upstash Redis directly...\n')
  console.log('URL:', url)
  console.log('Token:', token.substring(0, 20) + '...\n')
  
  // Test SET operation
  console.log('1️⃣ Testing SET operation:')
  const setResponse = await fetch(`${url}/set/test:direct`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ value: 'Hello from direct test', ex: 60 }),
  })
  
  const setResult = await setResponse.json()
  console.log('  SET Response:', setResult)
  
  // Test GET operation
  console.log('\n2️⃣ Testing GET operation:')
  const getResponse = await fetch(`${url}/get/test:direct`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  
  const getResult = await getResponse.json()
  console.log('  GET Response:', getResult)
  
  // Test KEYS operation
  console.log('\n3️⃣ Testing KEYS operation:')
  const keysResponse = await fetch(`${url}/keys/*`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  
  const keysResult = await keysResponse.json()
  console.log('  KEYS Response:', keysResult)
  
  if (keysResult.result && Array.isArray(keysResult.result)) {
    console.log(`  Found ${keysResult.result.length} keys`)
    keysResult.result.slice(0, 5).forEach((key: string) => {
      console.log(`    - ${key}`)
    })
  }
}

testUpstashDirect()