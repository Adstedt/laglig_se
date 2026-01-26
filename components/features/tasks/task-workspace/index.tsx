'use client'

/**
 * Story 6.4: Task Workspace Root Component
 * Story 6.6: Added TaskModal integration
 * Story 6.7: Added "Ny uppgift" button and CreateTaskModal
 * Main client component that orchestrates the task workspace UI
 */

import { Suspense, useState, useCallback, useMemo, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TabNavigation, type TaskTab } from './tab-navigation'
import { SummaryTab } from './summary-tab'
import { KanbanTab } from './kanban-tab'
import { ListTab } from './list-tab'
import { CalendarTab } from './calendar-tab'
import { AllWorkTab } from './all-work-tab'
import { WorkspaceSkeleton } from './workspace-skeleton'
import { TaskModal } from '../task-modal'
import { CreateTaskModal } from '../create-task-modal'
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
  currentUserId?: string // Story 6.7: For "Tilldela mig" in create modal
}

// ============================================================================
// Main Component
// ============================================================================

export function TaskWorkspace({
  initialTasks,
  initialColumns,
  initialStats,
  workspaceMembers,
  currentUserId,
}: TaskWorkspaceProps) {
  const searchParams = useSearchParams()
  const currentTab = (searchParams.get('tab') ?? 'sammanfattning') as TaskTab

  // Shared task state - allows modal changes to sync back to workspace
  const [tasks, setTasks] = useState(initialTasks)
  const [columns] = useState(initialColumns)

  // Story 6.6: Task modal state - synced with URL param
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  // Story 6.7: Create task modal state
  const [createTaskModalOpen, setCreateTaskModalOpen] = useState(false)

  // Sync modal state with URL param on mount and changes
  const taskIdFromUrl = searchParams.get('task')
  useEffect(() => {
    if (taskIdFromUrl !== selectedTaskId) {
      setSelectedTaskId(taskIdFromUrl)
    }
  }, [taskIdFromUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  // Get initial data for the selected task (for instant modal display)
  const selectedTaskData = useMemo(() => {
    if (!selectedTaskId) return null
    return tasks.find((t) => t.id === selectedTaskId) ?? null
  }, [selectedTaskId, tasks])

  const handleTaskClick = useCallback((taskId: string) => {
    // Update local state immediately for instant feedback
    setSelectedTaskId(taskId)
    // Update URL instantly using History API (faster than router.push)
    const params = new URLSearchParams(window.location.search)
    params.set('task', taskId)
    window.history.pushState(null, '', `?${params.toString()}`)
  }, [])

  const handleModalClose = useCallback(() => {
    // Update local state immediately for instant feedback
    setSelectedTaskId(null)
    // Update URL instantly using History API (faster than router.push)
    const params = new URLSearchParams(window.location.search)
    params.delete('task')
    const newUrl = params.toString()
      ? `?${params.toString()}`
      : window.location.pathname
    window.history.pushState(null, '', newUrl)
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
      {/* Story 6.7: Header with "Ny uppgift" button and Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <TabNavigation currentTab={currentTab} />
        <Button
          size="sm"
          onClick={() => setCreateTaskModalOpen(true)}
          className="self-start sm:self-auto"
        >
          <Plus className="h-4 w-4 mr-1" />
          Ny uppgift
        </Button>
      </div>

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

      {/* Story 6.7: Create Task Modal */}
      <CreateTaskModal
        open={createTaskModalOpen}
        onOpenChange={setCreateTaskModalOpen}
        currentUserId={currentUserId}
        onTaskCreated={handleTaskCreated}
      />
    </div>
  )
}
