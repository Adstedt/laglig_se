/**
 * Story 14.11: Hem — Chat-first dashboard page
 * Server component that fetches dashboard data and renders the HemChat client component.
 * Route remains /dashboard (no URL breaking change).
 */

import { getWorkspaceContext } from '@/lib/auth/workspace-context'
import { getCurrentUser } from '@/lib/auth/session'
import { getDashboardData } from '@/lib/db/queries/dashboard'
import { getUnacknowledgedChangeCount } from '@/app/actions/change-events'
import { HemPage } from '@/components/features/dashboard/hem-page'
import type { DashboardCardData } from '@/components/features/dashboard/context-cards'

export default async function DashboardPage() {
  const [context, user] = await Promise.all([
    getWorkspaceContext(),
    getCurrentUser(),
  ])

  let dashboardData: DashboardCardData | null = null
  try {
    const [data, changeCountResult] = await Promise.all([
      getDashboardData(context.workspaceId, context.userId),
      getUnacknowledgedChangeCount(),
    ])
    dashboardData = {
      complianceStats: data.complianceStats,
      taskCounts: data.taskCounts,
      ...(changeCountResult.success && changeCountResult.data !== undefined
        ? { pendingAmendments: changeCountResult.data }
        : {}),
    }
  } catch {
    // Data fetch failed — context cards will show "–" values
  }

  const firstName = user?.name?.split(' ')[0] ?? undefined

  return <HemPage dashboardData={dashboardData} userName={firstName} />
}
