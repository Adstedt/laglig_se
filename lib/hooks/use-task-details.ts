'use client'

/**
 * SWR hook for fetching and caching task details
 *
 * Performance optimization:
 * - If initialData is provided, displays instantly without loading state
 * - Caches data so subsequent modal opens are instant
 * - Supports optimistic updates for status, priority, title changes
 * - Uses preloadedMembers if provided (fetch once at page level)
 */

import { useMemo, useCallback } from 'react'
import useSWR from 'swr'
import {
  getTaskDetails,
  getTaskActivity,
  type TaskDetails,
  type TaskComment,
  type TaskEvidence,
} from '@/app/actions/task-modal'
import type { TaskColumnWithCount } from '@/app/actions/tasks'

// Activity log entry type (matches what getTaskActivity returns)
export interface ActivityLogEntry {
  id: string
  action: string
  entity_type: string
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  created_at: Date
  actor: {
    id: string
    name: string | null
    email: string
    avatar_url: string | null
  }
}

// ============================================================================
// Exported Types
// ============================================================================

/**
 * Initial data from Kanban/List view - used for instant modal display
 */
export interface InitialTaskData {
  id: string
  title: string
  description: string | null
  priority: string
  position: number
  due_date: Date | null
  column_id: string
  column: {
    id: string
    name: string
    color: string
    is_done: boolean
  }
  assignee: {
    id: string
    name: string | null
    email: string
    avatar_url: string | null
  } | null
  creator?: {
    id: string
    name: string | null
    email: string
  } | null
  created_at?: Date
  updated_at?: Date
  _count?: {
    comments: number
  }
  list_item_links?: Array<{
    law_list_item: {
      id: string
      document: {
        title: string
        document_number: string
      }
    }
  }>
}

export interface WorkspaceMember {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
}

interface UseTaskDetailsResult {
  task: TaskDetails | null
  comments: TaskComment[]
  evidence: TaskEvidence[]
  activity: ActivityLogEntry[]
  workspaceMembers: WorkspaceMember[]
  columns: TaskColumnWithCount[]
  isLoading: boolean
  isLoadingComments: boolean
  isLoadingActivity: boolean
  error: string | null
  mutate: () => Promise<void>
  mutateComments: () => Promise<void>
  mutateActivity: () => Promise<void>
  // Optimistic update helpers
  optimisticUpdateStatus: (_columnId: string) => void
  optimisticUpdatePriority: (_priority: string) => void
  optimisticUpdateTitle: (_title: string) => void
  optimisticUpdateAssignee: (_assignee: WorkspaceMember | null) => void
  optimisticUpdateDueDate: (_dueDate: Date | null) => void
}

/**
 * Convert initial data from Kanban/List view to TaskDetails format
 */
function initialDataToTaskDetails(
  initial: InitialTaskData,
  extraData?: Partial<TaskDetails>
): TaskDetails {
  return {
    id: initial.id,
    workspace_id: extraData?.workspace_id ?? '',
    title: initial.title,
    description: initial.description,
    priority: initial.priority as TaskDetails['priority'],
    position: initial.position,
    due_date: initial.due_date,
    column_id: initial.column_id,
    assignee_id: initial.assignee?.id ?? null,
    created_by: initial.creator?.id ?? extraData?.created_by ?? '',
    created_at: initial.created_at ?? new Date(),
    updated_at: initial.updated_at ?? new Date(),
    completed_at: extraData?.completed_at ?? null,
    column: initial.column,
    assignee: initial.assignee,
    creator: initial.creator
      ? {
          id: initial.creator.id,
          name: initial.creator.name,
          email: initial.creator.email,
          avatar_url: null,
        }
      : (extraData?.creator ?? {
          id: '',
          name: null,
          email: '',
          avatar_url: null,
        }),
    labels: extraData?.labels ?? [],
    list_item_links: (initial.list_item_links ?? []).map((link) => ({
      id: '',
      law_list_item: {
        id: link.law_list_item.id,
        document: {
          id: '',
          title: link.law_list_item.document.title,
          document_number: link.law_list_item.document.document_number,
          slug: '',
        },
      },
    })),
    comments: extraData?.comments ?? [],
    evidence: extraData?.evidence ?? [],
    _count: {
      comments: initial._count?.comments ?? 0,
      evidence: extraData?._count?.evidence ?? 0,
    },
  }
}

/**
 * SWR hook for fetching and caching task details
 */
export function useTaskDetails(
  taskId: string | null,
  initialData?: InitialTaskData | null,
  preloadedMembers?: WorkspaceMember[],
  preloadedColumns?: TaskColumnWithCount[]
): UseTaskDetailsResult {
  // Fetch full task details (only if no initialData or need full data)
  const {
    data: fullData,
    error: fullDataError,
    isLoading: isLoadingFullData,
    mutate: mutateFullData,
  } = useSWR(
    taskId ? `task:${taskId}` : null,
    async () => {
      const result = await getTaskDetails(taskId!)
      if (!result.success || !result.data) {
        throw new Error(result.error ?? 'Kunde inte ladda uppgiften')
      }
      return result.data
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 30000, // 30 seconds
    }
  )

  // Fetch comments separately (can be paginated later)
  const {
    data: commentsData,
    isLoading: isLoadingComments,
    mutate: mutateComments,
  } = useSWR(
    taskId ? `task-comments:${taskId}` : null,
    async () => {
      const result = await getTaskDetails(taskId!)
      if (!result.success || !result.data) {
        return []
      }
      // Comments come with task details
      return result.data.comments ?? []
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 15000, // 15 seconds - comments can update more frequently
    }
  )

  // Fetch activity log
  const {
    data: activityData,
    isLoading: isLoadingActivity,
    mutate: mutateActivity,
  } = useSWR(
    taskId ? `task-activity:${taskId}` : null,
    async () => {
      const result = await getTaskActivity(taskId!)
      if (!result.success || !result.data) {
        return []
      }
      return result.data as unknown as ActivityLogEntry[]
    },
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  )

  // Merge data: prefer fullData, fall back to initialData
  const task = useMemo(() => {
    if (fullData) {
      return fullData
    }
    if (initialData) {
      return initialDataToTaskDetails(initialData)
    }
    return null
  }, [initialData, fullData])

  // Optimistic update helpers
  const optimisticUpdateStatus = useCallback(
    (columnId: string) => {
      if (!task) return
      const column = preloadedColumns?.find((c) => c.id === columnId)
      if (!column) return

      mutateFullData(
        (current) => {
          if (!current) return current
          return {
            ...current,
            column_id: columnId,
            column: {
              id: column.id,
              name: column.name,
              color: column.color,
              is_done: column.is_done,
            },
          }
        },
        { revalidate: false }
      )
    },
    [task, preloadedColumns, mutateFullData]
  )

  const optimisticUpdatePriority = useCallback(
    (priority: string) => {
      mutateFullData(
        (current) => {
          if (!current) return current
          return {
            ...current,
            priority: priority as TaskDetails['priority'],
          }
        },
        { revalidate: false }
      )
    },
    [mutateFullData]
  )

  const optimisticUpdateTitle = useCallback(
    (title: string) => {
      mutateFullData(
        (current) => {
          if (!current) return current
          return {
            ...current,
            title,
          }
        },
        { revalidate: false }
      )
    },
    [mutateFullData]
  )

  const optimisticUpdateAssignee = useCallback(
    (assignee: WorkspaceMember | null) => {
      mutateFullData(
        (current) => {
          if (!current) return current
          return {
            ...current,
            assignee_id: assignee?.id ?? null,
            assignee: assignee
              ? {
                  id: assignee.id,
                  name: assignee.name,
                  email: assignee.email,
                  avatar_url: assignee.avatarUrl,
                }
              : null,
          }
        },
        { revalidate: false }
      )
    },
    [mutateFullData]
  )

  const optimisticUpdateDueDate = useCallback(
    (dueDate: Date | null) => {
      mutateFullData(
        (current) => {
          if (!current) return current
          return {
            ...current,
            due_date: dueDate,
          }
        },
        { revalidate: false }
      )
    },
    [mutateFullData]
  )

  const handleMutate = async () => {
    await mutateFullData()
  }

  const handleMutateComments = async () => {
    await mutateComments()
  }

  const handleMutateActivity = async () => {
    await mutateActivity()
  }

  // Loading state: only show loading if we have no data to display
  // With initialData, we can show content immediately
  const isLoading = !initialData && isLoadingFullData

  return {
    task,
    comments: commentsData ?? [],
    evidence: fullData?.evidence ?? [],
    activity: activityData ?? [],
    workspaceMembers: preloadedMembers ?? [],
    columns: preloadedColumns ?? [],
    isLoading,
    isLoadingComments,
    isLoadingActivity,
    error: fullDataError?.message ?? null,
    mutate: handleMutate,
    mutateComments: handleMutateComments,
    mutateActivity: handleMutateActivity,
    optimisticUpdateStatus,
    optimisticUpdatePriority,
    optimisticUpdateTitle,
    optimisticUpdateAssignee,
    optimisticUpdateDueDate,
  }
}
