/**
 * Story 5.1: Workspace Context Helper
 * Provides utilities for getting the current workspace context and checking permissions.
 * See: docs/stories/in-progress/5.1.workspace-data-model-multi-tenancy.md
 *
 * Story 6.0: Added request-level caching with React cache()
 * See: docs/stories/6.0.performance-optimization-caching.md
 */

import { cookies } from 'next/headers'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'
import { getServerSession } from './session'
import { hasPermission, type Permission } from './permissions'
import { redis, isRedisConfigured } from '@/lib/cache/redis'
import type { WorkspaceRole, WorkspaceStatus } from '@prisma/client'

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

export class WorkspaceAccessError extends Error {
  public readonly code: WorkspaceErrorCode

  constructor(message: string, code: WorkspaceErrorCode = 'UNAUTHORIZED') {
    super(message)
    this.name = 'WorkspaceAccessError'
    this.code = code
  }
}

/**
 * Cookie name for storing the active workspace ID
 */
export const ACTIVE_WORKSPACE_COOKIE = 'active_workspace_id'

/**
 * Internal implementation of getWorkspaceContext.
 * This function performs the actual database queries.
 */
async function getWorkspaceContextInternal(): Promise<WorkspaceContext> {
  const session = await getServerSession()

  if (!session?.user?.email) {
    throw new WorkspaceAccessError('Unauthorized: No session', 'UNAUTHORIZED')
  }

  // Get active workspace from cookie first (needed for cache key)
  const cookieStore = await cookies()
  const activeWorkspaceId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value

  // Try Redis cache for auth context (5 minute TTL)
  if (isRedisConfigured()) {
    const cacheKey = `auth:context:${session.user.email}:${activeWorkspaceId || 'default'}`

    try {
      const cached = await redis.get(cacheKey)
      if (cached) {
        const context = typeof cached === 'string' ? JSON.parse(cached) : cached
        // Recreate the hasPermission function
        return {
          ...context,
          hasPermission: (permission: Permission) =>
            hasPermission(context.role, permission),
        }
      }
    } catch {
      // Redis error - fall back to DB
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
export const getWorkspaceContext = cache(getWorkspaceContextInternal)

/**
 * Get the current workspace context (uncached version).
 * Use this only when you need to bypass the request-level cache.
 */
export const getWorkspaceContextUncached = getWorkspaceContextInternal

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
