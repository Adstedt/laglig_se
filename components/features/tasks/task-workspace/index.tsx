'use client'

/**
 * Story 6.4: Task Workspace Root Component
 * Main client component that orchestrates the task workspace UI
 */

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { TabNavigation, type TaskTab } from './tab-navigation'
import { SummaryTab } from './summary-tab'
import { KanbanTab } from './kanban-tab'
import { ListTab } from './list-tab'
import { CalendarTab } from './calendar-tab'
import { AllWorkTab } from './all-work-tab'
import { WorkspaceSkeleton } from './workspace-skeleton'
import type {
  TaskWithRelations,
  TaskColumnWithCount,
  TaskSummaryStats,
} from '@/app/actions/tasks'

// ============================================================================
// Types
// ============================================================================

export interface WorkspaceMember {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
}

interface TaskWorkspaceProps {
  initialTasks: TaskWithRelations[]
  initialColumns: TaskColumnWithCount[]
  initialStats: TaskSummaryStats
  workspaceMembers: WorkspaceMember[]
}

// ============================================================================
// Main Component
// ============================================================================

export function TaskWorkspace({
  initialTasks,
  initialColumns,
  initialStats,
  workspaceMembers,
}: TaskWorkspaceProps) {
  const searchParams = useSearchParams()
  const currentTab = (searchParams.get('tab') ?? 'sammanfattning') as TaskTab

  return (
    <div className="flex flex-col gap-6">
      {/* Tab Navigation */}
      <TabNavigation currentTab={currentTab} />

      {/* Tab Content */}
      <Suspense fallback={<WorkspaceSkeleton tab={currentTab} />}>
        {currentTab === 'sammanfattning' && (
          <SummaryTab initialStats={initialStats} />
        )}
        {currentTab === 'aktiva' && (
          <KanbanTab
            initialTasks={initialTasks}
            initialColumns={initialColumns}
            workspaceMembers={workspaceMembers}
          />
        )}
        {currentTab === 'lista' && (
          <ListTab
            initialTasks={initialTasks}
            initialColumns={initialColumns}
            workspaceMembers={workspaceMembers}
          />
        )}
        {currentTab === 'kalender' && (
          <CalendarTab
            initialTasks={initialTasks}
            workspaceMembers={workspaceMembers}
          />
        )}
        {currentTab === 'alla' && (
          <AllWorkTab
            initialTasks={initialTasks}
            initialColumns={initialColumns}
            workspaceMembers={workspaceMembers}
          />
        )}
      </Suspense>
    </div>
  )
}
