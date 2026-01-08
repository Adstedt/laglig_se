/**
 * Story 6.1: Dashboard Page
 * Server component that renders the compliance dashboard with widgets
 */

import { getWorkspaceContext } from '@/lib/auth/workspace-context'
import { getDashboardData } from '@/lib/db/queries/dashboard'
import {
  ComplianceProgressRing,
  TaskSummaryCards,
  RecentActivityFeed,
  QuickActions,
  ListOverview,
  WidgetErrorBoundary,
} from '@/components/features/dashboard'

export default async function DashboardPage() {
  const context = await getWorkspaceContext()

  const { complianceStats, taskCounts, recentActivity, topLists } =
    await getDashboardData(context.workspaceId, context.userId)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Välkommen tillbaka! Här är en översikt av din efterlevnadsstatus.
        </p>
      </div>

      {/* Top row: Compliance Ring + Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-2">
        <WidgetErrorBoundary widgetName="Efterlevnad">
          <ComplianceProgressRing
            compliant={complianceStats.compliant}
            total={complianceStats.total}
          />
        </WidgetErrorBoundary>

        <WidgetErrorBoundary widgetName="Snabbåtgärder">
          <QuickActions />
        </WidgetErrorBoundary>
      </div>

      {/* Task Summary Cards */}
      <WidgetErrorBoundary widgetName="Uppgiftsöversikt">
        <TaskSummaryCards counts={taskCounts} />
      </WidgetErrorBoundary>

      {/* Bottom row: Activity Feed + List Overview */}
      <div className="grid gap-6 lg:grid-cols-2">
        <WidgetErrorBoundary widgetName="Senaste aktivitet">
          <RecentActivityFeed activities={recentActivity} />
        </WidgetErrorBoundary>

        <WidgetErrorBoundary widgetName="Mina listor">
          <ListOverview lists={topLists} />
        </WidgetErrorBoundary>
      </div>
    </div>
  )
}
