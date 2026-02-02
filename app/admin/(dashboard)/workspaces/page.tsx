import { WorkspaceTable } from '@/components/admin/workspace-table'
import { getWorkspaceList } from '@/lib/admin/queries'
import type { SubscriptionTier, WorkspaceStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

const VALID_TIERS = new Set<string>(['TRIAL', 'SOLO', 'TEAM', 'ENTERPRISE'])
const VALID_STATUSES = new Set<string>(['ACTIVE', 'PAUSED', 'DELETED'])

export default async function WorkspacesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams

  const search = typeof params.search === 'string' ? params.search : undefined
  const tier =
    typeof params.tier === 'string' && VALID_TIERS.has(params.tier)
      ? (params.tier as SubscriptionTier)
      : undefined
  const status =
    typeof params.status === 'string' && VALID_STATUSES.has(params.status)
      ? (params.status as WorkspaceStatus)
      : undefined
  const sortBy = typeof params.sortBy === 'string' ? params.sortBy : undefined
  const sortDir =
    params.sortDir === 'asc' ? ('asc' as const) : ('desc' as const)
  const page =
    typeof params.page === 'string'
      ? Math.max(1, parseInt(params.page, 10) || 1)
      : 1

  const pageSize = 25
  const result = await getWorkspaceList({
    search,
    tier,
    status,
    sortBy,
    sortDir,
    page,
    pageSize,
  })

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Arbetsytor</h1>
      <WorkspaceTable
        data={result.data}
        total={result.total}
        page={result.page}
        pageSize={pageSize}
        currentSearch={search}
        currentTier={tier}
        currentStatus={status}
        currentSortBy={sortBy ?? 'created_at'}
        currentSortDir={sortDir}
      />
    </div>
  )
}
