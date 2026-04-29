/**
 * Story 6.4: Task Workspace Page
 * Main page for task management with multiple views
 */

import { Suspense } from 'react'
import { Metadata } from 'next'
import { TaskWorkspace } from '@/components/features/tasks/task-workspace'
import { WorkspaceSkeleton } from '@/components/features/tasks/task-workspace/workspace-skeleton'
import { PageHeader } from '@/components/ui/page-header'
import {
  getWorkspaceTasks,
  getTaskColumns,
  getTaskSummaryStats,
  getWorkspaceMembers,
} from '@/app/actions/tasks'

// Force dynamic rendering since this page requires authentication
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Uppgifter | Laglig',
  description:
    'Hantera efterlevnadsuppgifter med Kanban-tavla, lista och kalender.',
}

export default async function TasksPage() {
  // Fetch initial data server-side in parallel
  const [tasksResult, columnsResult, statsResult, membersResult] =
    await Promise.all([
      getWorkspaceTasks(),
      getTaskColumns(),
      getTaskSummaryStats(),
      getWorkspaceMembers(),
    ])

  const tasks = tasksResult.success ? (tasksResult.data ?? []) : []
  const columns = columnsResult.success ? (columnsResult.data ?? []) : []
  const stats = statsResult.success
    ? (statsResult.data ?? {
        total: 0,
        byStatus: { open: 0, inProgress: 0, done: 0 },
        byPriority: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
        overdue: 0,
        dueThisWeek: 0,
      })
    : {
        total: 0,
        byStatus: { open: 0, inProgress: 0, done: 0 },
        byPriority: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
        overdue: 0,
        dueThisWeek: 0,
      }
  const members = membersResult.success ? (membersResult.data ?? []) : []

  return (
    <div className="space-y-6">
      {/* Story 22.3 — PageHeader primitive. The "Ny uppgift" primaryAction
          stays inside TaskWorkspace's UnifiedToolbar (which predates this
          story's TableToolbar primitive); a full lift to page-level
          primaryAction would require restructuring TaskWorkspace's modal
          state and is out-of-scope for this story. */}
      <PageHeader
        title="Uppgifter"
        subtitle="Hantera och spåra efterlevnadsuppgifter för din organisation."
      />

      <Suspense fallback={<WorkspaceSkeleton tab="sammanfattning" />}>
        <TaskWorkspace
          initialTasks={tasks}
          initialColumns={columns}
          initialStats={stats}
          workspaceMembers={members}
        />
      </Suspense>
    </div>
  )
}
