'use client'

/**
 * Story 6.4: Task Workspace Root Component
 * Story 6.6: Added TaskModal integration
 * Main client component that orchestrates the task workspace UI
 */

import { Suspense, useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { TabNavigation, type TaskTab } from './tab-navigation'
import { SummaryTab } from './summary-tab'
import { KanbanTab } from './kanban-tab'
import { ListTab } from './list-tab'
import { CalendarTab } from './calendar-tab'
import { AllWorkTab } from './all-work-tab'
import { WorkspaceSkeleton } from './workspace-skeleton'
import { TaskModal } from '../task-modal'
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

  // Shared task state - allows modal changes to sync back to workspace
  const [tasks, setTasks] = useState(initialTasks)
  const [columns] = useState(initialColumns)

  // Story 6.6: Task modal state
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  // Get initial data for the selected task (for instant modal display)
  const selectedTaskData = useMemo(() => {
    if (!selectedTaskId) return null
    return tasks.find((t) => t.id === selectedTaskId) ?? null
  }, [selectedTaskId, tasks])

  const handleTaskClick = useCallback((taskId: string) => {
    setSelectedTaskId(taskId)
  }, [])

  const handleModalClose = useCallback(() => {
    setSelectedTaskId(null)
  }, [])

  // Callback for when task is updated in modal - syncs back to workspace
  const handleTaskUpdate = useCallback(
    (taskId: string, updates: Partial<TaskWithRelations>) => {
      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId ? { ...task, ...updates } : task
        )
      )
    },
    []
  )

  // Callback for when a new task is created
  const handleTaskCreated = useCallback((newTask: TaskWithRelations) => {
    setTasks((prev) => [...prev, newTask])
  }, [])

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
            initialTasks={tasks}
            initialColumns={columns}
            workspaceMembers={workspaceMembers}
            onTaskClick={handleTaskClick}
            onTaskCreated={handleTaskCreated}
          />
        )}
        {currentTab === 'lista' && (
          <ListTab
            initialTasks={tasks}
            initialColumns={columns}
            workspaceMembers={workspaceMembers}
            onTaskClick={handleTaskClick}
          />
        )}
        {currentTab === 'kalender' && (
          <CalendarTab
            initialTasks={tasks}
            workspaceMembers={workspaceMembers}
            onTaskClick={handleTaskClick}
          />
        )}
        {currentTab === 'alla' && (
          <AllWorkTab
            initialTasks={tasks}
            initialColumns={columns}
            workspaceMembers={workspaceMembers}
            onTaskClick={handleTaskClick}
          />
        )}
      </Suspense>

      {/* Story 6.6: Task Modal */}
      <TaskModal
        taskId={selectedTaskId}
        onClose={handleModalClose}
        initialData={selectedTaskData}
        workspaceMembers={workspaceMembers}
        columns={columns}
        onTaskUpdate={handleTaskUpdate}
      />
    </div>
  )
}
