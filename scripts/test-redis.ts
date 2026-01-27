#!/usr/bin/env tsx
/**
 * Script to test Redis connection and basic operations
 */

import { config } from 'dotenv'
import path from 'path'

// Load .env.local
config({ path: path.resolve(process.cwd(), '.env.local') })

import { redis, isRedisConfigured } from '../lib/cache/redis'

async function testRedis() {
  console.log('🔍 Testing Redis Connection...\n')
  console.log('Environment check:')
  console.log(
    '  UPSTASH_REDIS_REST_URL:',
    process.env.UPSTASH_REDIS_REST_URL ? '✓ Set' : '✗ Not set'
  )
  console.log(
    '  UPSTASH_REDIS_REST_TOKEN:',
    process.env.UPSTASH_REDIS_REST_TOKEN ? '✓ Set' : '✗ Not set'
  )
  console.log()

  // Check if Redis is configured
  if (!isRedisConfigured()) {
    console.error(
      '❌ Redis is not configured. Check your environment variables.'
    )
    process.exit(1)
  }

  console.log('✅ Redis configuration detected')
  console.log(`📍 Redis URL: ${process.env.UPSTASH_REDIS_REST_URL}\n`)

  try {
    // Test 1: Basic set/get
    console.log('📝 Test 1: Basic Set/Get')
    const testKey = 'test:connection'
    const testValue = {
      message: 'Hello from Laglig.se',
      timestamp: new Date().toISOString(),
    }

    await redis.set(testKey, JSON.stringify(testValue), { ex: 60 })
    console.log(`   ✓ SET ${testKey}`)

    const retrieved = await redis.get(testKey)
    console.log(`   ✓ GET ${testKey}:`, retrieved)

    // Test 2: TTL check
    console.log('\n📝 Test 2: TTL Check')
    const ttl = await redis.ttl(testKey)
    console.log(`   ✓ TTL for ${testKey}: ${ttl} seconds`)

    // Test 3: Workspace cache simulation
    console.log('\n📝 Test 3: Workspace Cache Simulation')
    const workspaceKey = 'workspace:context:test-user:test-workspace'
    const workspaceData = {
      workspaceId: 'test-workspace',
      name: 'Test Workspace',
      role: 'OWNER',
      cachedAt: new Date().toISOString(),
    }

    await redis.set(workspaceKey, JSON.stringify(workspaceData), { ex: 300 })
    console.log(`   ✓ SET workspace cache: ${workspaceKey}`)

    const cachedWorkspace = await redis.get(workspaceKey)
    console.log(`   ✓ GET workspace cache:`, cachedWorkspace)

    // Test 4: List keys
    console.log('\n📝 Test 4: List Keys')
    const keys = await redis.keys('*')
    console.log(`   ✓ Total keys in Redis: ${keys.length}`)
    if (keys.length > 0) {
      console.log('   ✓ Sample keys:', keys.slice(0, 5))
    }

    // Test 5: Cache metrics simulation
    console.log('\n📝 Test 5: Cache Metrics')
    const metricsKey = 'metrics:cache:test'
    await redis.incr(`${metricsKey}:hits`)
    await redis.incr(`${metricsKey}:hits`)
    await redis.incr(`${metricsKey}:misses`)

    const hits = await redis.get(`${metricsKey}:hits`)
    const misses = await redis.get(`${metricsKey}:misses`)
    console.log(`   ✓ Cache hits: ${hits}`)
    console.log(`   ✓ Cache misses: ${misses}`)
    console.log(
      `   ✓ Hit rate: ${hits && misses ? Math.round((Number(hits) / (Number(hits) + Number(misses))) * 100) : 0}%`
    )

    // Cleanup
    console.log('\n🧹 Cleaning up test keys...')
    await redis.del(testKey)
    await redis.del(workspaceKey)
    await redis.del(`${metricsKey}:hits`)
    await redis.del(`${metricsKey}:misses`)
    console.log('   ✓ Test keys deleted')

    console.log('\n✅ All Redis tests passed successfully!')
    console.log('🚀 Redis is ready for production use!')
  } catch (error) {
    console.error('\n❌ Redis test failed:', error)
    process.exit(1)
  }
}

// Run the test
testRedis().catch(console.error)
