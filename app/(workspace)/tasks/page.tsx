/**
 * Story 6.4: Task Workspace Page
 * Main page for task management with multiple views
 */

import { Suspense } from 'react'
import { Metadata } from 'next'
import { TaskWorkspace } from '@/components/features/tasks/task-workspace'
import { WorkspaceSkeleton } from '@/components/features/tasks/task-workspace/workspace-skeleton'
import {
  getWorkspaceTasks,
  getTaskColumns,
  getTaskSummaryStats,
  getWorkspaceMembers,
} from '@/app/actions/tasks'

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
      <div>
        <h1 className="text-2xl font-semibold">Uppgifter</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hantera och spåra efterlevnadsuppgifter för din organisation.
        </p>
      </div>

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
