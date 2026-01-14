#!/usr/bin/env tsx
/**
 * Debug Redis authentication issue
 */

import { config } from 'dotenv'
import path from 'path'

// Load env
config({ path: path.resolve(process.cwd(), '.env.local') })

console.log('Environment Variables Check:')
console.log('UPSTASH_REDIS_REST_URL:', process.env.UPSTASH_REDIS_REST_URL)
console.log('UPSTASH_REDIS_REST_TOKEN:', process.env.UPSTASH_REDIS_REST_TOKEN?.substring(0, 20) + '...')

// Try direct API call
async function testDirectAPI() {
  const url = process.env.UPSTASH_REDIS_REST_URL!
  const token = process.env.UPSTASH_REDIS_REST_TOKEN!

  console.log('\nTesting direct API call...')
  
  try {
    const response = await fetch(`${url}/get/test`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    console.log('Response status:', response.status)
    const text = await response.text()
    console.log('Response body:', text)
  } catch (error) {
    console.error('Direct API error:', error)
  }
}

// Test with SDK
async function testWithSDK() {
  console.log('\nTesting with Upstash SDK...')
  
  const { Redis } = await import('@upstash/redis')
  
  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!
    })
    
    await redis.set('test:auth', 'OK', { ex: 60 })
    const result = await redis.get('test:auth')
    console.log('SDK test result:', result)
  } catch (error: any) {
    console.error('SDK error:', error.message)
    if (error.response) {
      console.error('Response:', await error.response.text())
    }
  }
}

async function main() {
  await testDirectAPI()
  await testWithSDK()
}

main().catch(console.error)