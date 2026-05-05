/**
 * Story 5.5c — Redis-backed cache for add-on seat counts.
 *
 * The chat hot path calls assertWithinTokenQuota → getEffectiveLimits with
 * an addonSeatCount argument. Without a cache, every chat turn would call
 * Stripe API to enumerate SubscriptionItems (~150ms). Vercel serverless
 * runs many cold-started instances so an in-memory Map cache would have
 * a low hit rate. Redis (Upstash, already a project dep) gives a true
 * shared cache across instances for ~5ms of network overhead per turn.
 *
 * Cache invalidation is webhook-driven: customer.subscription.updated
 * MUST call invalidateSeatCache(workspaceId) so add-on seat purchases
 * propagate without waiting for the 5-min TTL.
 */

import { redis, isRedisConfigured } from '@/lib/cache/redis'
import { countActiveAddonSeats } from './seats'

const TTL_SECONDS = 5 * 60
const cacheKey = (workspaceId: string) => `addon-seats:${workspaceId}`

/**
 * Get the workspace's add-on seat count, cached for 5 minutes in Redis.
 * Falls open to a fresh Stripe lookup if Redis is unavailable — failure
 * mode here is just slower chat turns, not over-cap acceptance.
 */
export async function getCachedAddonSeatCount(
  workspaceId: string
): Promise<number> {
  if (!isRedisConfigured()) {
    return countActiveAddonSeats(workspaceId)
  }

  const key = cacheKey(workspaceId)
  try {
    const cached = await redis.get<number>(key)
    if (cached !== null && cached !== undefined) {
      return cached
    }
  } catch {
    // Redis read failure → fall through to fresh fetch + skip cache write
    return countActiveAddonSeats(workspaceId)
  }

  const fresh = await countActiveAddonSeats(workspaceId)
  try {
    await redis.set(key, fresh, { ex: TTL_SECONDS })
  } catch {
    // Cache write failure is non-fatal — next turn will retry
  }
  return fresh
}

/**
 * Invalidate the cached seat count for a workspace.
 *
 * Called by the customer.subscription.updated webhook so add-on seat
 * purchases propagate immediately to the chat-route quota check rather
 * than waiting up to 5 minutes for the TTL to expire.
 */
export async function invalidateSeatCache(workspaceId: string): Promise<void> {
  if (!isRedisConfigured()) return
  try {
    await redis.del(cacheKey(workspaceId))
  } catch {
    // Best effort — TTL is the safety net
  }
}
