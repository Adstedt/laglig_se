import { prisma } from '@/lib/prisma'
import type { Prisma, SubscriptionTier, WorkspaceStatus } from '@prisma/client'

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

// ============================================================================
// Workspace List (Story 11.3)
// ============================================================================

export interface WorkspaceListItem {
  id: string
  name: string
  slug: string
  subscription_tier: SubscriptionTier
  status: WorkspaceStatus
  created_at: Date
  owner: { email: string; name: string | null }
  _count: { members: number }
}

export interface WorkspaceListParams {
  search?: string | undefined
  tier?: SubscriptionTier | undefined
  status?: WorkspaceStatus | undefined
  sortBy?: string | undefined
  sortDir?: 'asc' | 'desc' | undefined
  page?: number | undefined
  pageSize?: number | undefined
}

export interface WorkspaceListResult {
  data: WorkspaceListItem[]
  total: number
  page: number
  pageSize: number
}

const WORKSPACE_SORTABLE_FIELDS = new Set([
  'name',
  'slug',
  'subscription_tier',
  'status',
  'created_at',
])

export async function getWorkspaceList(
  params: WorkspaceListParams
): Promise<WorkspaceListResult> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 25
  const skip = (page - 1) * pageSize

  const where: Prisma.WorkspaceWhereInput = {}
  if (params.search) {
    where.OR = [
      { name: { contains: params.search, mode: 'insensitive' } },
      { slug: { contains: params.search, mode: 'insensitive' } },
      { owner: { email: { contains: params.search, mode: 'insensitive' } } },
    ]
  }
  if (params.tier) where.subscription_tier = params.tier
  if (params.status) where.status = params.status

  const sortField = WORKSPACE_SORTABLE_FIELDS.has(params.sortBy ?? '')
    ? params.sortBy!
    : 'created_at'
  const sortDir = params.sortDir ?? 'desc'
  const orderBy: Prisma.WorkspaceOrderByWithRelationInput = {
    [sortField]: sortDir,
  }

  const [data, total] = await Promise.all([
    prisma.workspace.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
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
    }),
    prisma.workspace.count({ where }),
  ])

  return { data, total, page, pageSize }
}

// ============================================================================
// Workspace Detail (Story 11.3)
// ============================================================================

export interface WorkspaceDetail {
  id: string
  name: string
  slug: string
  org_number: string | null
  status: WorkspaceStatus
  subscription_tier: SubscriptionTier
  created_at: Date
  paused_at: Date | null
  deleted_at: Date | null
  company_profile: {
    company_name: string
    sni_code: string | null
    legal_form: string | null
    employee_count: number | null
    address: string | null
  } | null
  members: {
    id: string
    role: string
    joined_at: Date
    user: { name: string | null; email: string }
  }[]
  _count: {
    law_lists: number
    tasks: number
    files: number
  }
}

export async function getWorkspaceDetail(
  id: string
): Promise<WorkspaceDetail | null> {
  return prisma.workspace.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      org_number: true,
      status: true,
      subscription_tier: true,
      created_at: true,
      paused_at: true,
      deleted_at: true,
      company_profile: {
        select: {
          company_name: true,
          sni_code: true,
          legal_form: true,
          employee_count: true,
          address: true,
        },
      },
      members: {
        select: {
          id: true,
          role: true,
          joined_at: true,
          user: { select: { name: true, email: true } },
        },
        orderBy: { joined_at: 'asc' },
      },
      _count: {
        select: {
          law_lists: true,
          tasks: true,
          files: { where: { is_folder: false } },
        },
      },
    },
  })
}
