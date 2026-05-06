/**
 * Story 5.1: Workspace Context Helper
 * Provides utilities for getting the current workspace context and checking permissions.
 * See: docs/stories/in-progress/5.1.workspace-data-model-multi-tenancy.md
 *
 * Story 6.0: Added request-level caching with React cache()
 * See: docs/stories/6.0.performance-optimization-caching.md
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { getServerSession } from './session'
import { hasPermission, type Permission } from './permissions'
import { redis, isRedisConfigured } from '@/lib/cache/redis'
import type {
  SubscriptionTier,
  WorkspaceRole,
  WorkspaceStatus,
} from '@prisma/client'

export interface WorkspaceContext {
  userId: string
  workspaceId: string
  workspaceName: string
  workspaceSlug: string
  workspaceStatus: WorkspaceStatus
  role: WorkspaceRole
  hasPermission: (_perm: Permission) => boolean
}

export type WorkspaceErrorCode =
  | 'UNAUTHORIZED'
  | 'NO_WORKSPACE'
  | 'WORKSPACE_DELETED'
  | 'ACCESS_DENIED'
  // Story 5.4: Stripe past-due grace period expired — block access until
  // payment is recovered (invoice.payment_succeeded webhook clears the flag).
  | 'PAYMENT_PAST_DUE'
  // Story 5.13: trial ended without conversion — block access until the user
  // converts via Stripe Checkout (webhook clears trial_ends_at + sets
  // stripe_subscription_id, which lifts the gate naturally).
  | 'TRIAL_EXPIRED'

export class WorkspaceAccessError extends Error {
  public readonly code: WorkspaceErrorCode

  constructor(message: string, code: WorkspaceErrorCode = 'UNAUTHORIZED') {
    super(message)
    this.name = 'WorkspaceAccessError'
    this.code = code
  }
}

/**
 * Story 5.4 + 5.13: gate enforcement.
 *
 * Originally these threw WorkspaceAccessError, but pages that call
 * getWorkspaceContext directly (DashboardPage, etc.) would throw before the
 * layout's catch could redirect — the page render and layout render are
 * concurrent, so the page-level throw wins and the user sees a 500.
 *
 * Switching to Next.js `redirect()` makes the gate framework-level: any
 * caller (page, server action, layout, API route handler) that hits the
 * gate is short-circuited via NEXT_REDIRECT, which Next.js intercepts and
 * returns as a 307 with the conversion-page Location. No try/catch needed
 * in callers. The bypass version (`getWorkspaceContextBypassBillingGates`)
 * still skips both gates entirely so the conversion page itself + the
 * /api/billing/* endpoints can run.
 *
 * Note: `redirect()` from next/navigation throws an internal NEXT_REDIRECT
 * error that propagates through async boundaries and is handled by the
 * Next.js framework. It is not a regular control-flow return.
 */
function assertNotPastDue(gracePeriodEndsAt: Date | null | undefined): void {
  if (gracePeriodEndsAt && gracePeriodEndsAt < new Date()) {
    redirect('/settings?tab=billing&reason=past_due')
  }
}

function assertTrialNotExpired(workspace: {
  subscription_tier: SubscriptionTier
  trial_ends_at: Date | null
  stripe_subscription_id: string | null
}): void {
  if (
    workspace.subscription_tier === 'TRIAL' &&
    workspace.trial_ends_at &&
    workspace.trial_ends_at < new Date() &&
    !workspace.stripe_subscription_id
  ) {
    redirect('/settings?tab=billing&reason=trial_expired')
  }
}

/**
 * Cookie name for storing the active workspace ID
 */
export const ACTIVE_WORKSPACE_COOKIE = 'active_workspace_id'

/**
 * Internal implementation of getWorkspaceContext.
 * This function performs the actual database queries.
 *
 * Story 5.13: when called with `skipBillingGates: true`, both the
 * PAYMENT_PAST_DUE and TRIAL_EXPIRED gates are skipped. This is required
 * for the conversion path itself — the /settings billing tab and the
 * /api/billing/* endpoints MUST be reachable when gated, otherwise users
 * have no way to convert and recover access.
 */
async function getWorkspaceContextInternal(
  options: { skipBillingGates?: boolean } = {}
): Promise<WorkspaceContext> {
  const { skipBillingGates = false } = options
  const session = await getServerSession()

  if (!session?.user?.email) {
    throw new WorkspaceAccessError('Unauthorized: No session', 'UNAUTHORIZED')
  }

  // Get active workspace from cookie first (needed for cache key)
  const cookieStore = await cookies()
  const activeWorkspaceId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value

  // Try Redis cache for auth context (5 minute TTL)
  let cached: unknown = null
  if (isRedisConfigured()) {
    const cacheKey = `auth:context:${session.user.email}:${activeWorkspaceId || 'default'}`
    try {
      cached = await redis.get(cacheKey)
    } catch {
      // Swallow Redis-level errors only (network, parse). Fall through to DB.
      cached = null
    }
  }

  if (cached) {
    const context = typeof cached === 'string' ? JSON.parse(cached) : cached
    if (!skipBillingGates) {
      // Story 5.4: even on cache hit, check if the cached grace-period
      // deadline has passed since we wrote the entry. The cache is keyed
      // by user+workspace and refreshed every 5 min — well inside the
      // 3-day grace window so a freshly-set deadline can't be missed.
      // Story 5.13: same applies to the trial gate.
      // Both assertion helpers call Next.js redirect() on hit, so the
      // NEXT_REDIRECT exception bubbles out without a swallowing try/catch.
      const grace = context.paymentGracePeriodEndsAt
        ? new Date(context.paymentGracePeriodEndsAt)
        : null
      assertNotPastDue(grace)
      assertTrialNotExpired({
        subscription_tier: context.subscriptionTier,
        trial_ends_at: context.trialEndsAt
          ? new Date(context.trialEndsAt)
          : null,
        stripe_subscription_id: context.stripeSubscriptionId ?? null,
      })
    }
    // Recreate the hasPermission function (functions don't survive JSON)
    return {
      ...context,
      hasPermission: (permission: Permission) =>
        hasPermission(context.role, permission),
    }
  }

  // Cache miss or Redis not configured - fetch from database
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  })

  if (!user) {
    throw new WorkspaceAccessError(
      'Unauthorized: User not found',
      'UNAUTHORIZED'
    )
  }

  let member = await prisma.workspaceMember.findFirst({
    where: activeWorkspaceId
      ? { workspace_id: activeWorkspaceId, user_id: user.id }
      : { user_id: user.id },
    include: { workspace: true },
    orderBy: { joined_at: 'asc' },
  })

  // Fallback: if the active_workspace_id cookie points to a stale/invalid workspace,
  // retry without the workspace filter to find any valid membership.
  // This prevents a redirect loop between /dashboard and /onboarding when the cookie
  // references a workspace the user is no longer a member of.
  if (!member && activeWorkspaceId) {
    member = await prisma.workspaceMember.findFirst({
      where: { user_id: user.id },
      include: { workspace: true },
      orderBy: { joined_at: 'asc' },
    })
  }

  if (!member) {
    throw new WorkspaceAccessError('No workspace access', 'NO_WORKSPACE')
  }

  // Check if workspace is deleted — also try to find a non-deleted workspace
  if (member.workspace.status === 'DELETED') {
    const activeMember = await prisma.workspaceMember.findFirst({
      where: {
        user_id: user.id,
        workspace: { status: { not: 'DELETED' } },
      },
      include: { workspace: true },
      orderBy: { joined_at: 'asc' },
    })

    if (!activeMember) {
      throw new WorkspaceAccessError(
        'Workspace has been deleted',
        'WORKSPACE_DELETED'
      )
    }

    member = activeMember
  }

  if (!skipBillingGates) {
    // Story 5.4: enforce billing past-due gate before returning the context.
    // The webhook sets payment_grace_period_ends_at to (now + 3 days) on
    // invoice.payment_failed; once that timestamp is in the past, all access
    // is denied until invoice.payment_succeeded clears it.
    assertNotPastDue(member.workspace.payment_grace_period_ends_at)

    // Story 5.13: enforce trial expiration gate. Throws TRIAL_EXPIRED for
    // unconverted trials whose 15-day window has elapsed. Workspace layout
    // catches this and redirects to /settings/billing?reason=trial_expired
    // so the user can convert via Stripe Checkout.
    assertTrialNotExpired(member.workspace)
  }

  const role = member.role

  const context = {
    userId: user.id,
    workspaceId: member.workspace_id,
    workspaceName: member.workspace.name,
    workspaceSlug: member.workspace.slug,
    workspaceStatus: member.workspace.status,
    role,
    hasPermission: (permission: Permission) => hasPermission(role, permission),
  }

  // Cache the context in Redis (excluding the function)
  if (isRedisConfigured()) {
    const cacheKey = `auth:context:${session.user.email}:${activeWorkspaceId || 'default'}`
    const cacheData = {
      userId: context.userId,
      workspaceId: context.workspaceId,
      workspaceName: context.workspaceName,
      workspaceSlug: context.workspaceSlug,
      workspaceStatus: context.workspaceStatus,
      role: context.role,
      // Story 5.4: persist the grace deadline so the cache-hit branch can
      // re-check expiry without an extra DB round-trip.
      paymentGracePeriodEndsAt:
        member.workspace.payment_grace_period_ends_at?.toISOString() ?? null,
      // Story 5.13: persist trial fields so the cache-hit branch can
      // re-evaluate the trial gate without a DB round-trip.
      subscriptionTier: member.workspace.subscription_tier,
      trialEndsAt: member.workspace.trial_ends_at?.toISOString() ?? null,
      stripeSubscriptionId: member.workspace.stripe_subscription_id ?? null,
    }

    try {
      // Cache for 5 minutes (auth changes are rare)
      await redis.set(cacheKey, JSON.stringify(cacheData), { ex: 300 })
    } catch {
      // Ignore cache write errors
    }
  }

  return context
}

/**
 * Get the current workspace context from session and cookies.
 * Returns user ID, workspace ID, role, and permission checker.
 *
 * This function is cached at the request level using React cache(),
 * ensuring that multiple calls within the same request will reuse the same result.
 *
 * @throws {WorkspaceAccessError} If user is not authenticated or has no workspace access
 */
export const getWorkspaceContext = cache(() => getWorkspaceContextInternal())

/**
 * Story 5.13: bypass version for billing surfaces. The /settings billing tab
 * and /api/billing/* endpoints MUST be reachable when the workspace is gated
 * by PAYMENT_PAST_DUE or TRIAL_EXPIRED — they ARE the conversion surface.
 *
 * Cached separately from the gated version so a single request can call both
 * (e.g. layout calls gated → throws TRIAL_EXPIRED → catches → calls bypass).
 */
export const getWorkspaceContextBypassBillingGates = cache(() =>
  getWorkspaceContextInternal({ skipBillingGates: true })
)

/**
 * Get the current workspace context (uncached version).
 * Use this only when you need to bypass the request-level cache.
 */
export const getWorkspaceContextUncached = () => getWorkspaceContextInternal()

/**
 * Execute a callback with workspace context, optionally requiring a specific permission.
 *
 * @example
 * ```ts
 * const result = await withWorkspace(async (ctx) => {
 *   return prisma.lawList.findMany({
 *     where: { workspace_id: ctx.workspaceId }
 *   })
 * }, 'read')
 * ```
 */
export async function withWorkspace<T>(
  callback: (_context: WorkspaceContext) => Promise<T>,
  requiredPermission?: Permission
): Promise<T> {
  const context = await getWorkspaceContext()

  if (requiredPermission && !context.hasPermission(requiredPermission)) {
    throw new WorkspaceAccessError(
      `Permission denied: ${requiredPermission}`,
      'ACCESS_DENIED'
    )
  }

  return callback(context)
}

/**
 * Verify the user has access to a specific workspace.
 * Throws if the current user cannot access the requested workspace.
 *
 * @example
 * ```ts
 * const ctx = await requireWorkspaceAccess(params.workspaceId)
 * ```
 */
export async function requireWorkspaceAccess(
  workspaceId: string
): Promise<WorkspaceContext> {
  const context = await getWorkspaceContext()

  // Fast path: requested workspace matches the active cookie workspace
  if (context.workspaceId === workspaceId) {
    return context
  }

  // Slow path: user selected a different workspace (e.g. via workspace picker).
  // Verify the user is actually a member of the target workspace.
  const member = await prisma.workspaceMember.findFirst({
    where: { user_id: context.userId, workspace_id: workspaceId },
    include: { workspace: true },
  })

  if (!member || member.workspace.status === 'DELETED') {
    throw new WorkspaceAccessError('Workspace access denied', 'ACCESS_DENIED')
  }

  return {
    userId: context.userId,
    workspaceId: member.workspace_id,
    workspaceName: member.workspace.name,
    workspaceSlug: member.workspace.slug,
    workspaceStatus: member.workspace.status,
    role: member.role,
    hasPermission: (permission: Permission) =>
      hasPermission(member.role, permission),
  }
}

/**
 * Get all workspaces the current user has access to.
 * Useful for workspace switcher UI.
 */
export async function getUserWorkspaces() {
  const session = await getServerSession()

  if (!session?.user?.email) {
    return []
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      workspace_members: {
        include: {
          workspace: true,
        },
        orderBy: {
          joined_at: 'asc',
        },
      },
    },
  })

  if (!user) {
    return []
  }

  return user.workspace_members
    .filter((m) => m.workspace.status !== 'DELETED')
    .map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role,
      status: m.workspace.status,
      company_logo: m.workspace.company_logo,
    }))
}

/**
 * Story 5.13: invalidate the Redis auth-context cache for a workspace.
 *
 * The cache key pattern is `auth:context:${email}:${workspaceId}` plus the
 * `default` fallback (when no active_workspace_id cookie is set). When a
 * webhook updates workspace state (subscription_tier, status, paused_at,
 * trial_ends_at, stripe_subscription_id), we MUST invalidate so the next
 * page load reads fresh state — otherwise the user sees stale gate / banner
 * UI for up to 5 min after a successful conversion / recovery.
 *
 * Looks up the workspace's owner email + all member emails since the cache
 * is keyed by user, not by workspace. Best-effort: failures don't block
 * the caller (which is typically a Stripe webhook).
 */
export async function invalidateWorkspaceAuthContextCache(
  workspaceId: string
): Promise<void> {
  if (!isRedisConfigured()) return

  try {
    const memberEmails = await prisma.workspaceMember.findMany({
      where: { workspace_id: workspaceId },
      select: { user: { select: { email: true } } },
    })

    const keys: string[] = []
    for (const m of memberEmails) {
      keys.push(`auth:context:${m.user.email}:${workspaceId}`)
      keys.push(`auth:context:${m.user.email}:default`)
    }

    if (keys.length > 0) {
      await Promise.all(keys.map((k) => redis.del(k)))
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[invalidateWorkspaceAuthContextCache]', workspaceId, err)
  }
}

/**
 * Set the active workspace cookie for the user.
 */
export async function setActiveWorkspace(workspaceId: string) {
  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  })
}
