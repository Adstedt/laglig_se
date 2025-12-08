import { Redis } from '@upstash/redis'

// Initialize Redis client from environment variables
// Falls back to a no-op client if not configured (for development)
const redisUrl = process.env.UPSTASH_REDIS_REST_URL
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN

// Create a no-op Redis client for development/testing when Redis is not configured
const noopRedis = {
  get: async () => null,
  set: async () => 'OK',
  del: async () => 0,
  incr: async () => 1,
  expire: async () => 1,
  keys: async () => [],
  mget: async () => [],
  pipeline: () => ({
    get: () => noopRedis,
    set: () => noopRedis,
    exec: async () => [],
  }),
} as unknown as Redis

export const redis: Redis =
  redisUrl && redisToken
    ? new Redis({
        url: redisUrl,
        token: redisToken,
      })
    : noopRedis

// Check if Redis is properly configured
export const isRedisConfigured = Boolean(redisUrl && redisToken)
