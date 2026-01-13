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
  const startTime = Date.now()
  console.log(`      🔐 [Auth] Getting workspace context...`)
  
  const session = await getServerSession()
  console.log(`      🔐 [Auth +${Date.now() - startTime}ms] Got session`)

  if (!session?.user?.email) {
    throw new WorkspaceAccessError('Unauthorized: No session', 'UNAUTHORIZED')
  }

  // Get active workspace from cookie first (needed for cache key)
  const cookieStore = await cookies()
  const activeWorkspaceId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value
  console.log(`      🔐 [Auth +${Date.now() - startTime}ms] Got cookies`)

  // Try Redis cache for auth context (5 minute TTL)
  if (isRedisConfigured()) {
    const cacheKey = `auth:context:${session.user.email}:${activeWorkspaceId || 'default'}`
    console.log(`      🔐 [Auth +${Date.now() - startTime}ms] Checking Redis cache for auth context...`)
    
    try {
      const cached = await redis.get(cacheKey)
      if (cached) {
        console.log(`      🔐 [Auth +${Date.now() - startTime}ms] ⚡ Auth cache HIT! Skipping DB queries`)
        const context = typeof cached === 'string' ? JSON.parse(cached) : cached
        // Recreate the hasPermission function
        return {
          ...context,
          hasPermission: (permission: Permission) => hasPermission(context.role, permission),
        }
      }
      console.log(`      🔐 [Auth +${Date.now() - startTime}ms] Auth cache MISS, fetching from DB`)
    } catch (error) {
      console.warn(`      🔐 [Auth] Redis error, falling back to DB:`, error)
    }
  }

  // Cache miss or Redis not configured - fetch from database
  const userQueryStart = Date.now()
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  })
  console.log(`      🔐 [Auth +${Date.now() - startTime}ms] User query took ${Date.now() - userQueryStart}ms`)

  if (!user) {
    throw new WorkspaceAccessError(
      'Unauthorized: User not found',
      'UNAUTHORIZED'
    )
  }

  const memberQueryStart = Date.now()
  const member = await prisma.workspaceMember.findFirst({
    where: activeWorkspaceId
      ? { workspace_id: activeWorkspaceId, user_id: user.id }
      : { user_id: user.id },
    include: { workspace: true },
    orderBy: { joined_at: 'asc' },
  })
  console.log(`      🔐 [Auth +${Date.now() - startTime}ms] Member query took ${Date.now() - memberQueryStart}ms`)

  if (!member) {
    throw new WorkspaceAccessError('No workspace access', 'NO_WORKSPACE')
  }

  // Check if workspace is deleted
  if (member.workspace.status === 'DELETED') {
    throw new WorkspaceAccessError(
      'Workspace has been deleted',
      'WORKSPACE_DELETED'
    )
  }

  const role = member.role

  console.log(`      🔐 [Auth +${Date.now() - startTime}ms] Total auth time: ${Date.now() - startTime}ms`)

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
      console.log(`      🔐 [Auth] Cached auth context in Redis`)
    } catch (error) {
      console.warn(`      🔐 [Auth] Failed to cache auth context:`, error)
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

  if (context.workspaceId !== workspaceId) {
    throw new WorkspaceAccessError('Workspace access denied', 'ACCESS_DENIED')
  }

  return context
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
