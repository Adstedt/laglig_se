import { UsageTables } from '@/components/admin/usage-tables'
import { getUsageByUser, getUsageByWorkspace } from '@/lib/admin/queries'

export const dynamic = 'force-dynamic'

const VALID_RANGES = new Set([7, 30, 90])
const VALID_TABS = new Set(['workspace', 'user'])

export default async function UsagePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams

  const rawRange =
    typeof params.range === 'string' ? parseInt(params.range, 10) : 30
  const range =
    Number.isFinite(rawRange) && VALID_RANGES.has(rawRange) ? rawRange : 30

  const tab =
    typeof params.tab === 'string' && VALID_TABS.has(params.tab)
      ? (params.tab as 'workspace' | 'user')
      : 'workspace'

  const [workspaceRows, userRows] = await Promise.all([
    getUsageByWorkspace({ rangeDays: range, limit: 25, offset: 0 }),
    getUsageByUser({ rangeDays: range, limit: 25, offset: 0 }),
  ])

  return (
    <UsageTables
      workspaceRows={workspaceRows}
      userRows={userRows}
      currentTab={tab}
      currentRange={range}
    />
  )
}
