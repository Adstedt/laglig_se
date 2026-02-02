import { prisma } from '@/lib/prisma'
import type { SubscriptionTier, WorkspaceStatus } from '@prisma/client'

// ============================================================================
// Types
// ============================================================================

export interface WorkspaceMetrics {
  total: number
  active: number
  paused: number
  deleted: number
  byTier: Record<SubscriptionTier, number>
}

export interface UserMetrics {
  total: number
  newLast7Days: number
  newLast30Days: number
}

export interface RecentWorkspace {
  id: string
  name: string
  slug: string
  subscription_tier: SubscriptionTier
  status: WorkspaceStatus
  created_at: Date
  owner: { email: string; name: string | null }
  _count: { members: number }
}

export interface RecentUser {
  id: string
  name: string | null
  email: string
  last_login_at: Date | null
  created_at: Date
  _count: { workspace_members: number }
}

// ============================================================================
// Queries
// ============================================================================

export async function getWorkspaceMetrics(): Promise<WorkspaceMetrics> {
  const [statusCounts, tierCounts, total] = await Promise.all([
    prisma.workspace.groupBy({ by: ['status'], _count: true }),
    prisma.workspace.groupBy({ by: ['subscription_tier'], _count: true }),
    prisma.workspace.count(),
  ])

  const statusMap: Record<WorkspaceStatus, number> = {
    ACTIVE: 0,
    PAUSED: 0,
    DELETED: 0,
  }
  for (const row of statusCounts) {
    statusMap[row.status] = row._count
  }

  const tierMap: Record<SubscriptionTier, number> = {
    TRIAL: 0,
    SOLO: 0,
    TEAM: 0,
    ENTERPRISE: 0,
  }
  for (const row of tierCounts) {
    tierMap[row.subscription_tier] = row._count
  }

  return {
    total,
    active: statusMap.ACTIVE,
    paused: statusMap.PAUSED,
    deleted: statusMap.DELETED,
    byTier: tierMap,
  }
}

export async function getUserMetrics(): Promise<UserMetrics> {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [total, newLast7Days, newLast30Days] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { created_at: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { created_at: { gte: thirtyDaysAgo } } }),
  ])

  return { total, newLast7Days, newLast30Days }
}

export async function getRecentWorkspaces(
  limit: number
): Promise<RecentWorkspace[]> {
  return prisma.workspace.findMany({
    take: limit,
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      name: true,
      slug: true,
      subscription_tier: true,
      status: true,
      created_at: true,
      owner: { select: { email: true, name: true } },
      _count: { select: { members: true } },
    },
  })
}

export async function getRecentUsers(limit: number): Promise<RecentUser[]> {
  return prisma.user.findMany({
    take: limit,
    orderBy: { created_at: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      last_login_at: true,
      created_at: true,
      _count: { select: { workspace_members: true } },
    },
  })
}
