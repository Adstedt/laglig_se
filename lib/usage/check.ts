/**
 * Story 5.5c — AI token quota check.
 *
 * Called by app/api/chat/route.ts BEFORE streamText. Reads workspace tier +
 * cached add-on seat count + current period usage in parallel; throws
 * TokenQuotaExceededError when usage hits the 2× hard cap (option B for v1);
 * returns a `warning` payload at the 80% soft threshold so the chat route
 * can surface a non-blocking "approaching limit" header to the client.
 *
 * The chat route catches TokenQuotaExceededError and maps it to HTTP 402
 * with a structured JSON body per Story 5.5 parent spec.
 */

import { prisma } from '@/lib/prisma'
import {
  getEffectiveLimits,
  isUnlimited,
  tokensHardCap,
  tokensSoftWarn,
  tokensToApproxQueries,
} from './limits'
import { getCachedAddonSeatCount } from './seat-cache'

export class TokenQuotaExceededError extends Error {
  constructor(
    public usage: number,
    public limit: number,
    public hardCap: number,
    public tier: string
  ) {
    super(
      `AI token quota exceeded: ${usage}/${hardCap} (limit: ${limit}, tier: ${tier})`
    )
    this.name = 'TokenQuotaExceededError'
  }
}

export interface TokenQuotaWarning {
  usage: number
  limit: number
  approxQueriesRemaining: number
}

/**
 * Throw if the workspace is at or above the hard cap (2× included).
 * Return `{ warning }` if at or above 80% but under the hard cap.
 *
 * Performance budget: < 30ms p95 on cache hit. Three queries run in
 * parallel via Promise.all (workspace + workspace_usage + cached add-on
 * seat lookup). Cache miss adds ~150ms (Stripe API + Redis write).
 */
export async function assertWithinTokenQuota(workspaceId: string): Promise<{
  warning?: TokenQuotaWarning
}> {
  const [workspace, usage, addonSeatCount] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { subscription_tier: true, trial_picked_tier: true },
    }),
    prisma.workspaceUsage.findUnique({
      where: { workspace_id: workspaceId },
    }),
    getCachedAddonSeatCount(workspaceId),
  ])

  const limits = getEffectiveLimits(workspace, addonSeatCount)
  if (isUnlimited(limits.aiTokensPerMonth)) return {}

  const consumed = Number(usage?.tokens_used_this_period ?? BigInt(0))
  const limit = limits.aiTokensPerMonth
  const hardCap = tokensHardCap(limit)!
  const softWarn = tokensSoftWarn(limit)!

  if (consumed >= hardCap) {
    throw new TokenQuotaExceededError(
      consumed,
      limit,
      hardCap,
      workspace.trial_picked_tier ?? workspace.subscription_tier
    )
  }

  if (consumed >= softWarn) {
    // Approx queries remaining — clamped at 0 if user is over included
    // but under hard cap (overage zone, still allowed).
    const approxQueriesRemaining = Math.max(
      0,
      tokensToApproxQueries(limit - consumed)
    )
    return {
      warning: {
        usage: consumed,
        limit,
        approxQueriesRemaining,
      },
    }
  }

  return {}
}
