/**
 * Story 14.11: Hem — Chat-first dashboard page
 * Server component that fetches dashboard data and renders the HemChat client component.
 * Route remains /dashboard (no URL breaking change).
 *
 * Supports ?changeId= deep-link from email notifications to auto-enter assessment view.
 */

import { getWorkspaceContext } from '@/lib/auth/workspace-context'
import { getCurrentUser } from '@/lib/auth/session'
import { getDashboardData } from '@/lib/db/queries/dashboard'
import {
  getUnacknowledgedChangeCount,
  getUnacknowledgedChangeById,
} from '@/app/actions/change-events'
import { HemPage } from '@/components/features/dashboard/hem-page'
import type { DashboardCardData } from '@/components/features/dashboard/context-cards'

interface DashboardPageProps {
  searchParams: Promise<{ changeId?: string }>
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const [context, user, params] = await Promise.all([
    getWorkspaceContext(),
    getCurrentUser(),
    searchParams,
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

  // Deep-link: fetch initial change if changeId is provided
  let initialChange = null
  if (params.changeId) {
    try {
      const result = await getUnacknowledgedChangeById(params.changeId)
      if (result.success && result.data) {
        initialChange = result.data
      }
    } catch {
      // Invalid or expired changeId — fall through to normal dashboard
    }
  }

  const firstName = user?.name?.split(' ')[0] ?? undefined

  return (
    <HemPage
      dashboardData={dashboardData}
      userName={firstName}
      initialChange={initialChange}
    />
  )
}
