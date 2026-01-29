'use client'

/**
 * Story 6.4: Task Workspace Root Component
 * Story 6.6: Added TaskModal integration
 * Story 6.7: Added "Ny uppgift" button and CreateTaskModal
 * Story 6.19: Complex toolbar for Lista tab, lifted filter state, URL sync,
 *   Zustand store for column sizing/visibility/sorting, SearchInput,
 *   TaskFilterBar, ColumnSettings, ToolbarItemCount
 */

import { Suspense, useState, useCallback, useMemo, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  UnifiedToolbar,
  ToolbarItemCount,
} from '@/components/ui/unified-toolbar'
import { ColumnSettings } from '@/components/ui/column-settings'
import { SearchInput } from '@/components/features/document-list/search-input'
import { TabNavigation, type TaskTab } from './tab-navigation'
import { SummaryTab } from './summary-tab'
import { KanbanTab } from './kanban-tab'
import { ListTab } from './list-tab'
import { CalendarTab } from './calendar-tab'
import { AllWorkTab } from './all-work-tab'
import { WorkspaceSkeleton } from './workspace-skeleton'
import { TaskModal } from '../task-modal'
import { CreateTaskModal } from '../create-task-modal'
import { LegalDocumentModal } from '@/components/features/document-list/legal-document-modal'
import { TaskFilterBar, type TaskFilterState } from './task-filters-toolbar'
import { useTaskListStore } from '@/lib/stores/task-list-store'
import {
  parseTaskFiltersFromUrl,
  serializeTaskFiltersToUrl,
} from '@/lib/utils/task-filter-params'
import type {
  TaskWithRelations,
  TaskColumnWithCount,
  TaskSummaryStats,
} from '@/app/actions/tasks'
import type { ColumnOption } from '@/components/ui/column-settings'

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
// Column Settings Configuration
// ============================================================================

const TASK_COLUMN_OPTIONS: ColumnOption[] = [
  { id: 'title', label: 'Uppgift', defaultVisible: true, mandatory: true },
  { id: 'description', label: 'Beskrivning', defaultVisible: true },
  { id: 'columnName', label: 'Status', defaultVisible: true },
  { id: 'comments', label: 'Kommentarer', defaultVisible: true },
  { id: 'assignee', label: 'Ansvarig', defaultVisible: true },
  { id: 'dueDate', label: 'Förfallodatum', defaultVisible: true },
  { id: 'priority', label: 'Prioritet', defaultVisible: true },
  { id: 'createdAt', label: 'Skapad', defaultVisible: true },
]

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
  const router = useRouter()
  const currentTab = (searchParams.get('tab') ?? 'sammanfattning') as TaskTab
  const isListTab = currentTab === 'lista'

  // Shared task state - allows modal changes to sync back to workspace
  const [tasks, setTasks] = useState(initialTasks)
  const [columns] = useState(initialColumns)

  // Story 6.6: Task modal state - synced with URL param
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  // Story 6.7: Create task modal state
  const [createTaskModalOpen, setCreateTaskModalOpen] = useState(false)

  // Legal Document Modal state (opened from linked docs in task modal)
  const [selectedListItemId, setSelectedListItemId] = useState<string | null>(
    null
  )

  const handleOpenListItem = useCallback((listItemId: string) => {
    setSelectedListItemId(listItemId)
  }, [])

  const handleCloseListItemModal = useCallback(() => {
    setSelectedListItemId(null)
  }, [])

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
    setSelectedTaskId(taskId)
    const params = new URLSearchParams(window.location.search)
    params.set('task', taskId)
    window.history.pushState(null, '', `?${params.toString()}`)
  }, [])

  const handleModalClose = useCallback(() => {
    setSelectedTaskId(null)
    const params = new URLSearchParams(window.location.search)
    params.delete('task')
    const newUrl = params.toString()
      ? `?${params.toString()}`
      : window.location.pathname
    window.history.pushState(null, '', newUrl)
  }, [])

  // Callback for when task is updated in modal or inline editor
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

  // Callback for bulk delete (optimistic)
  const handleTasksDelete = useCallback((taskIds: string[]) => {
    setTasks((prev) => prev.filter((t) => !taskIds.includes(t.id)))
  }, [])

  // Callback for when a new task is created
  const handleTaskCreated = useCallback((newTask: TaskWithRelations) => {
    setTasks((prev) => [...prev, newTask])
  }, [])

  // ===========================================================================
  // Story 6.19: Filter State (URL-synced)
  // ===========================================================================

  const initialFilters = useMemo(
    () => parseTaskFiltersFromUrl(new URLSearchParams(searchParams.toString())),
    // Only parse on mount
    [] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const [searchQuery, setSearchQuery] = useState(initialFilters.searchQuery)
  const [filterState, setFilterState] = useState<TaskFilterState>({
    statusFilter: initialFilters.statusFilter,
    priorityFilter: initialFilters.priorityFilter,
    assigneeFilter: initialFilters.assigneeFilter,
  })

  // Sync filter changes to URL
  const syncFiltersToUrl = useCallback(
    (newFilters: TaskFilterState & { searchQuery: string }) => {
      const params = serializeTaskFiltersToUrl(
        newFilters,
        new URLSearchParams(window.location.search)
      )
      router.replace(`?${params.toString()}`, { scroll: false })
    },
    [router]
  )

  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query)
      syncFiltersToUrl({ ...filterState, searchQuery: query })
    },
    [filterState, syncFiltersToUrl]
  )

  const handleFiltersChange = useCallback(
    (newFilters: TaskFilterState) => {
      setFilterState(newFilters)
      syncFiltersToUrl({ ...newFilters, searchQuery })
    },
    [searchQuery, syncFiltersToUrl]
  )

  // Compute filtered tasks
  const filteredTasks = useMemo(() => {
    let result = tasks

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (task) =>
          task.title.toLowerCase().includes(query) ||
          task.description?.toLowerCase().includes(query)
      )
    }

    if (filterState.statusFilter.length > 0) {
      result = result.filter((task) =>
        filterState.statusFilter.includes(task.column.name)
      )
    }

    if (filterState.priorityFilter.length > 0) {
      result = result.filter((task) =>
        filterState.priorityFilter.includes(task.priority)
      )
    }

    if (filterState.assigneeFilter) {
      if (filterState.assigneeFilter === 'unassigned') {
        result = result.filter((task) => task.assignee_id === null)
      } else {
        result = result.filter(
          (task) => task.assignee_id === filterState.assigneeFilter
        )
      }
    }

    return result
  }, [tasks, searchQuery, filterState])

  // ===========================================================================
  // Story 6.19: Zustand Store for Column State
  // ===========================================================================

  const {
    columnSizing,
    setColumnSizing,
    columnVisibility,
    setColumnVisibility,
    sorting,
    setSorting,
  } = useTaskListStore()

  // ===========================================================================
  // Toolbar Rendering
  // ===========================================================================

  const tabNavigation = <TabNavigation currentTab={currentTab} />
  const primaryAction = (
    <Button onClick={() => setCreateTaskModalOpen(true)}>
      <Plus className="mr-2 h-4 w-4" />
      Ny uppgift
    </Button>
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Toolbar: complex for lista tab, standard for others */}
      {isListTab ? (
        <UnifiedToolbar
          layout="complex"
          contextSelector={tabNavigation}
          primaryAction={primaryAction}
          search={
            <SearchInput
              initialValue={searchQuery}
              onSearch={handleSearchChange}
              placeholder="Sök uppgifter..."
            />
          }
          filterDropdowns={
            <TaskFilterBar
              filters={filterState}
              onFiltersChange={handleFiltersChange}
              columns={columns}
              workspaceMembers={workspaceMembers}
            />
          }
          columnSettings={
            <ColumnSettings
              columnOptions={TASK_COLUMN_OPTIONS}
              columnVisibility={columnVisibility}
              onColumnVisibilityChange={setColumnVisibility}
            />
          }
          betweenRows={
            <ToolbarItemCount
              showing={filteredTasks.length}
              total={tasks.length}
              label="uppgifter"
            />
          }
        />
      ) : (
        <UnifiedToolbar
          layout="standard"
          tabs={tabNavigation}
          primaryAction={primaryAction}
        />
      )}

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
            filteredTasks={filteredTasks}
            columns={columns}
            workspaceMembers={workspaceMembers}
            columnSizing={columnSizing}
            onColumnSizingChange={setColumnSizing}
            columnVisibility={columnVisibility}
            sorting={sorting}
            onSortingChange={setSorting}
            onTaskClick={handleTaskClick}
            onTaskUpdate={handleTaskUpdate}
            onTasksDelete={handleTasksDelete}
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
        onOpenListItem={handleOpenListItem}
      />

      {/* Legal Document Modal (opened from linked docs in task modal) */}
      <LegalDocumentModal
        listItemId={selectedListItemId}
        onClose={handleCloseListItemModal}
        workspaceMembers={workspaceMembers}
        taskColumns={columns}
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
