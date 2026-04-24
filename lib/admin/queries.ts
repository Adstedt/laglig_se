import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type {
  CronJobRun,
  SubscriptionTier,
  WorkspaceStatus,
} from '@prisma/client'

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

// ============================================================================
// User List (Story 11.4)
// ============================================================================

export interface UserListItem {
  id: string
  name: string | null
  email: string
  last_login_at: Date | null
  created_at: Date
  _count: { workspace_members: number }
}

export interface UserListParams {
  search?: string | undefined
  sortBy?: string | undefined
  sortDir?: 'asc' | 'desc' | undefined
  page?: number | undefined
  pageSize?: number | undefined
}

export interface UserListResult {
  data: UserListItem[]
  total: number
  page: number
  pageSize: number
}

const USER_SORTABLE_FIELDS = new Set([
  'name',
  'email',
  'last_login_at',
  'created_at',
])

export async function getUserList(
  params: UserListParams
): Promise<UserListResult> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 25
  const skip = (page - 1) * pageSize

  const where: Prisma.UserWhereInput = {}
  if (params.search) {
    where.OR = [
      { name: { contains: params.search, mode: 'insensitive' } },
      { email: { contains: params.search, mode: 'insensitive' } },
    ]
  }

  const sortField = USER_SORTABLE_FIELDS.has(params.sortBy ?? '')
    ? params.sortBy!
    : 'created_at'
  const sortDir = params.sortDir ?? 'desc'
  const orderBy: Prisma.UserOrderByWithRelationInput = {
    [sortField]: sortDir,
  }

  const [data, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: pageSize,
      orderBy,
      select: {
        id: true,
        name: true,
        email: true,
        last_login_at: true,
        created_at: true,
        _count: { select: { workspace_members: true } },
      },
    }),
    prisma.user.count({ where }),
  ])

  return { data, total, page, pageSize }
}

// ============================================================================
// User Detail (Story 11.4)
// ============================================================================

export interface UserDetail {
  id: string
  name: string | null
  email: string
  avatar_url: string | null
  created_at: Date
  last_login_at: Date | null
  workspace_members: {
    role: string
    joined_at: Date
    workspace: {
      id: string
      name: string
      slug: string
      subscription_tier: SubscriptionTier
      status: WorkspaceStatus
    }
  }[]
}

export async function getUserDetail(id: string): Promise<UserDetail | null> {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      avatar_url: true,
      created_at: true,
      last_login_at: true,
      workspace_members: {
        select: {
          role: true,
          joined_at: true,
          workspace: {
            select: {
              id: true,
              name: true,
              slug: true,
              subscription_tier: true,
              status: true,
            },
          },
        },
      },
    },
  })
}

// ============================================================================
// Cron Job Runs (Story 11.6)
// ============================================================================

export async function getRecentJobRuns(
  jobNames: string[],
  count: number = 10
): Promise<Record<string, CronJobRun[]>> {
  const allRuns = await Promise.all(
    jobNames.map((jobName) =>
      prisma.cronJobRun.findMany({
        where: { job_name: jobName },
        orderBy: { started_at: 'desc' },
        take: count,
      })
    )
  )

  const result: Record<string, CronJobRun[]> = {}
  for (let i = 0; i < jobNames.length; i++) {
    result[jobNames[i]!] = allRuns[i] ?? []
  }
  return result
}

export async function getRunningJobs(): Promise<CronJobRun[]> {
  return prisma.cronJobRun.findMany({
    where: { status: 'RUNNING' },
  })
}

// ============================================================================
// Job Run History & Error Viewer (Story 11.7)
// ============================================================================

export interface JobRunHistoryParams {
  page?: number | undefined
  pageSize?: number | undefined
}

export interface JobRunHistoryResult {
  data: CronJobRun[]
  total: number
  page: number
  pageSize: number
}

export async function getJobRunHistory(
  jobName: string,
  params: JobRunHistoryParams = {}
): Promise<JobRunHistoryResult> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 25
  const skip = (page - 1) * pageSize

  const where: Prisma.CronJobRunWhereInput = { job_name: jobName }

  const [data, total] = await Promise.all([
    prisma.cronJobRun.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { started_at: 'desc' },
    }),
    prisma.cronJobRun.count({ where }),
  ])

  return { data, total, page, pageSize }
}

export async function getJobRunDetail(
  runId: string
): Promise<CronJobRun | null> {
  return prisma.cronJobRun.findUnique({
    where: { id: runId },
  })
}

export interface FailedRunsParams {
  jobName?: string | undefined
  fromDate?: Date | undefined
  toDate?: Date | undefined
  page?: number | undefined
  pageSize?: number | undefined
}

export async function getFailedRuns(
  params: FailedRunsParams = {}
): Promise<JobRunHistoryResult> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 25
  const skip = (page - 1) * pageSize

  const where: Prisma.CronJobRunWhereInput = {
    status: 'FAILED',
    ...(params.jobName ? { job_name: params.jobName } : {}),
  }

  if (params.fromDate && params.toDate) {
    where.started_at = { gte: params.fromDate, lte: params.toDate }
  } else if (params.fromDate) {
    where.started_at = { gte: params.fromDate }
  } else if (params.toDate) {
    where.started_at = { lte: params.toDate }
  }

  const [data, total] = await Promise.all([
    prisma.cronJobRun.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { started_at: 'desc' },
    }),
    prisma.cronJobRun.count({ where }),
  ])

  return { data, total, page, pageSize }
}

// ============================================================================
// Story 14.27: Chat usage telemetry aggregation queries
// ============================================================================

export interface WorkspaceUsageRow {
  workspaceId: string
  workspaceName: string
  tier: SubscriptionTier
  totalCostUsd: string // Decimal stringified from PostgreSQL
  totalInputTokens: bigint
  totalOutputTokens: bigint
  totalCacheReadTokens: bigint
  turnCount: bigint
}

export interface UserUsageRow {
  userId: string
  userName: string | null
  userEmail: string
  workspaceId: string
  workspaceName: string
  totalCostUsd: string
  totalInputTokens: bigint
  totalOutputTokens: bigint
  turnCount: bigint
}

export interface UsageTimeSeriesPoint {
  bucketStart: Date
  totalCostUsd: string
  turnCount: bigint
}

/**
 * Clamp + coerce a rangeDays parameter. Used for safe SQL parameterization.
 * Prisma's $queryRaw tagged-template parameterizes interpolated values, but
 * the explicit `::int` cast at the SQL boundary + integer clamping here
 * defence-in-depths against any future refactor accidentally interpolating
 * into a string literal.
 */
function clampRangeDays(rangeDays: number): number {
  return Math.floor(Math.max(1, Math.min(365, rangeDays)))
}

function clampLimit(limit: number): number {
  return Math.floor(Math.max(1, Math.min(100, limit)))
}

function clampOffset(offset: number): number {
  return Math.floor(Math.max(0, offset))
}

/**
 * Aggregates chat usage per workspace for the last `rangeDays` days.
 * Sorted by totalCostUsd DESC. Paginated via `limit` + `offset`.
 */
export async function getUsageByWorkspace(params: {
  rangeDays: number
  limit: number
  offset: number
}): Promise<WorkspaceUsageRow[]> {
  const rangeDaysInt = clampRangeDays(params.rangeDays)
  const limitInt = clampLimit(params.limit)
  const offsetInt = clampOffset(params.offset)

  return await prisma.$queryRaw<WorkspaceUsageRow[]>`
    SELECT
      e.workspace_id AS "workspaceId",
      w.name AS "workspaceName",
      w.subscription_tier AS tier,
      SUM(e.cost_usd_estimate)::text AS "totalCostUsd",
      SUM(e.input_tokens)::bigint AS "totalInputTokens",
      SUM(e.output_tokens)::bigint AS "totalOutputTokens",
      SUM(e.cache_read_input_tokens)::bigint AS "totalCacheReadTokens",
      COUNT(*)::bigint AS "turnCount"
    FROM chat_usage_events e
    INNER JOIN workspaces w ON w.id = e.workspace_id
    WHERE e.created_at >= NOW() - (INTERVAL '1 day' * ${rangeDaysInt}::int)
    GROUP BY e.workspace_id, w.name, w.subscription_tier
    ORDER BY SUM(e.cost_usd_estimate) DESC
    LIMIT ${limitInt} OFFSET ${offsetInt}
  `
}

/**
 * Aggregates chat usage per user for the last `rangeDays` days.
 * Optionally scoped to a single workspace. Sorted by totalCostUsd DESC.
 */
export async function getUsageByUser(params: {
  workspaceId?: string
  rangeDays: number
  limit: number
  offset: number
}): Promise<UserUsageRow[]> {
  const rangeDaysInt = clampRangeDays(params.rangeDays)
  const limitInt = clampLimit(params.limit)
  const offsetInt = clampOffset(params.offset)

  if (params.workspaceId) {
    return await prisma.$queryRaw<UserUsageRow[]>`
      SELECT
        e.user_id AS "userId",
        u.name AS "userName",
        u.email AS "userEmail",
        e.workspace_id AS "workspaceId",
        w.name AS "workspaceName",
        SUM(e.cost_usd_estimate)::text AS "totalCostUsd",
        SUM(e.input_tokens)::bigint AS "totalInputTokens",
        SUM(e.output_tokens)::bigint AS "totalOutputTokens",
        COUNT(*)::bigint AS "turnCount"
      FROM chat_usage_events e
      INNER JOIN users u ON u.id = e.user_id
      INNER JOIN workspaces w ON w.id = e.workspace_id
      WHERE e.created_at >= NOW() - (INTERVAL '1 day' * ${rangeDaysInt}::int)
        AND e.workspace_id = ${params.workspaceId}
      GROUP BY e.user_id, u.name, u.email, e.workspace_id, w.name
      ORDER BY SUM(e.cost_usd_estimate) DESC
      LIMIT ${limitInt} OFFSET ${offsetInt}
    `
  }

  return await prisma.$queryRaw<UserUsageRow[]>`
    SELECT
      e.user_id AS "userId",
      u.name AS "userName",
      u.email AS "userEmail",
      e.workspace_id AS "workspaceId",
      w.name AS "workspaceName",
      SUM(e.cost_usd_estimate)::text AS "totalCostUsd",
      SUM(e.input_tokens)::bigint AS "totalInputTokens",
      SUM(e.output_tokens)::bigint AS "totalOutputTokens",
      COUNT(*)::bigint AS "turnCount"
    FROM chat_usage_events e
    INNER JOIN users u ON u.id = e.user_id
    INNER JOIN workspaces w ON w.id = e.workspace_id
    WHERE e.created_at >= NOW() - (INTERVAL '1 day' * ${rangeDaysInt}::int)
    GROUP BY e.user_id, u.name, u.email, e.workspace_id, w.name
    ORDER BY SUM(e.cost_usd_estimate) DESC
    LIMIT ${limitInt} OFFSET ${offsetInt}
  `
}

/**
 * Time-bucketed usage series for trend plotting.
 * Default bucket is 24 hours. Optionally scoped to a single workspace or user.
 * Uses PostgreSQL 14+ `date_bin` for deterministic bucketing.
 */
export async function getUsageTimeSeries(params: {
  workspaceId?: string
  userId?: string
  rangeDays: number
  bucketHours?: number
}): Promise<UsageTimeSeriesPoint[]> {
  const rangeDaysInt = clampRangeDays(params.rangeDays)
  const bucketHoursInt = Math.floor(
    Math.max(1, Math.min(168, params.bucketHours ?? 24))
  )

  const workspaceFilter = params.workspaceId
    ? Prisma.sql`AND e.workspace_id = ${params.workspaceId}`
    : Prisma.empty
  const userFilter = params.userId
    ? Prisma.sql`AND e.user_id = ${params.userId}`
    : Prisma.empty

  return await prisma.$queryRaw<UsageTimeSeriesPoint[]>`
    SELECT
      date_bin(
        (INTERVAL '1 hour' * ${bucketHoursInt}::int),
        e.created_at,
        TIMESTAMP '2000-01-01'
      ) AS "bucketStart",
      SUM(e.cost_usd_estimate)::text AS "totalCostUsd",
      COUNT(*)::bigint AS "turnCount"
    FROM chat_usage_events e
    WHERE e.created_at >= NOW() - (INTERVAL '1 day' * ${rangeDaysInt}::int)
      ${workspaceFilter}
      ${userFilter}
    GROUP BY "bucketStart"
    ORDER BY "bucketStart" ASC
  `
}
