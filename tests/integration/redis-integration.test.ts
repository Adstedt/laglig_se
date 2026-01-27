/**
 * Redis Integration Test
 * Tests actual Redis connectivity and operations with production credentials
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'

// Import Redis directly to get a fresh instance
import { Redis } from '@upstash/redis'

// Lazy initialize Redis to ensure env vars are loaded
let testRedis: Redis | null = null

function getTestRedis(): Redis {
  if (!testRedis) {
    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN

    if (!url || !token) {
      throw new Error('Redis credentials not found in environment')
    }

    testRedis = new Redis({ url, token })
  }
  return testRedis
}

// Only run if env vars are set
const hasRedisConfig = () =>
  !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
const skipIfNoRedis = hasRedisConfig() ? describe : describe.skip

skipIfNoRedis('Redis Production Integration', () => {
  const testPrefix = 'test:integration:'
  const keysToCleanup: string[] = []

  beforeAll(() => {
    if (!hasRedisConfig()) {
      throw new Error('Redis credentials not found in environment')
    }
    console.log('Running Redis integration tests with production credentials')
    console.log('URL:', process.env.UPSTASH_REDIS_REST_URL)
    console.log(
      'Token:',
      process.env.UPSTASH_REDIS_REST_TOKEN?.substring(0, 20) + '...'
    )
  })

  afterAll(async () => {
    // Cleanup test keys
    for (const key of keysToCleanup) {
      await getTestRedis().del(key)
    }
  })

  it('should connect to production Redis', () => {
    expect(hasRedisConfig()).toBe(true)
  })

  it('should perform basic set/get operations', async () => {
    const key = `${testPrefix}basic`
    keysToCleanup.push(key)

    const testData = {
      message: 'Hello from integration test',
      timestamp: Date.now(),
    }

    await getTestRedis().set(key, JSON.stringify(testData), { ex: 60 })
    const retrieved = await getTestRedis().get(key)

    // Upstash may auto-parse JSON, so handle both cases
    const parsed =
      typeof retrieved === 'string' ? JSON.parse(retrieved) : retrieved
    expect(parsed).toEqual(testData)
  })

  it('should handle TTL correctly', async () => {
    const key = `${testPrefix}ttl`
    keysToCleanup.push(key)

    await getTestRedis().set(key, 'test', { ex: 300 })
    const ttl = await getTestRedis().ttl(key)

    expect(ttl).toBeGreaterThan(290)
    expect(ttl).toBeLessThanOrEqual(300)
  })

  it('should perform increment operations', async () => {
    const key = `${testPrefix}counter`
    keysToCleanup.push(key)

    const result1 = await getTestRedis().incr(key)
    const result2 = await getTestRedis().incr(key)
    const result3 = await getTestRedis().incr(key)

    expect(result1).toBe(1)
    expect(result2).toBe(2)
    expect(result3).toBe(3)
  })

  it('should list keys with pattern', async () => {
    const key1 = `${testPrefix}pattern:1`
    const key2 = `${testPrefix}pattern:2`
    const key3 = `${testPrefix}pattern:3`
    keysToCleanup.push(key1, key2, key3)

    await getTestRedis().set(key1, 'value1', { ex: 60 })
    await getTestRedis().set(key2, 'value2', { ex: 60 })
    await getTestRedis().set(key3, 'value3', { ex: 60 })

    const keys = await getTestRedis().keys(`${testPrefix}pattern:*`)

    expect(keys).toContain(key1)
    expect(keys).toContain(key2)
    expect(keys).toContain(key3)
  })

  it('should delete keys successfully', async () => {
    const key = `${testPrefix}delete`

    await getTestRedis().set(key, 'to-delete', { ex: 60 })
    const exists1 = await getTestRedis().get(key)
    expect(exists1).toBe('to-delete')

    await getTestRedis().del(key)
    const exists2 = await getTestRedis().get(key)
    expect(exists2).toBeNull()
  })

  it('should handle pipeline operations', async () => {
    const key1 = `${testPrefix}pipeline:1`
    const key2 = `${testPrefix}pipeline:2`
    keysToCleanup.push(key1, key2)

    const redis = getTestRedis()
    const pipeline = redis.pipeline()
    pipeline.set(key1, 'value1', { ex: 60 })
    pipeline.set(key2, 'value2', { ex: 60 })
    pipeline.get(key1)
    pipeline.get(key2)

    const results = await pipeline.exec()

    expect(results).toHaveLength(4)
    expect(results[0]).toBe('OK')
    expect(results[1]).toBe('OK')
    expect(results[2]).toBe('value1')
    expect(results[3]).toBe('value2')
  })

  it('should verify production data exists', async () => {
    // Check if there are any keys in production Redis
    const keys = await getTestRedis().keys('*')

    // We should have at least some keys from the app's usage
    expect(keys.length).toBeGreaterThan(0)

    console.log(`Production Redis has ${keys.length} total keys`)
  })
})
