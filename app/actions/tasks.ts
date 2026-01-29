'use server'

/**
 * Story 6.4: Task Server Actions
 * Server actions for task workspace data fetching and mutations
 *
 * Performance Update: Added comprehensive caching to reduce database load
 */

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { withWorkspace } from '@/lib/auth/workspace-context'
import { z } from 'zod'
import type { TaskPriority, TaskColumn } from '@prisma/client'
import {
  invalidateTaskLinkedListItemsCache,
  invalidateListItemTasksCache,
} from './legal-document-modal'

// ============================================================================
// Action Result Type
// ============================================================================

interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

// ============================================================================
// Types
// ============================================================================

export interface TaskWithRelations {
  id: string
  title: string
  description: string | null
  column_id: string
  position: number
  priority: TaskPriority
  due_date: Date | null
  assignee_id: string | null
  created_by: string
  created_at: Date
  updated_at: Date
  completed_at: Date | null
  workspace_id: string
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
  creator: {
    id: string
    name: string | null
    email: string
  }
  list_item_links: Array<{
    law_list_item: {
      id: string
      document: {
        title: string
        document_number: string
      }
      law_list: {
        id: string
        name: string
      }
    }
  }>
  _count: {
    comments: number
  }
}

export interface TaskColumnWithCount extends TaskColumn {
  _count: {
    tasks: number
  }
}

export interface TaskSummaryStats {
  total: number
  byStatus: {
    open: number
    inProgress: number
    done: number
  }
  byPriority: {
    LOW: number
    MEDIUM: number
    HIGH: number
    CRITICAL: number
  }
  overdue: number
  dueThisWeek: number
}

export interface TaskActivity {
  id: string
  action: string
  entity_type: string
  entity_id: string
  old_value: unknown
  new_value: unknown
  created_at: Date
  user: {
    id: string
    name: string | null
    email: string
    avatar_url: string | null
  }
}

export interface WorkloadItem {
  assigneeId: string | null
  assigneeName: string | null
  assigneeAvatar: string | null
  taskCount: number
}

// ============================================================================
// Schemas
// ============================================================================

const TaskFiltersSchema = z.object({
  status: z.array(z.enum(['open', 'inProgress', 'done'])).optional(),
  assigneeId: z.string().nullable().optional(),
  priority: z.array(z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])).optional(),
  dueDateStart: z.coerce.date().optional(),
  dueDateEnd: z.coerce.date().optional(),
  search: z.string().optional(),
  includeArchived: z.boolean().optional(),
})

export type TaskFilters = z.infer<typeof TaskFiltersSchema>

// ============================================================================
// Actions
// ============================================================================

/**
 * Pagination interface for tasks
 * Story P.1: Added pagination support to prevent browser freezing with large datasets
 */
export interface TaskPaginationOptions {
  page?: number
  limit?: number
}

export interface PaginatedTasksResult {
  tasks: TaskWithRelations[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

/**
 * Get paginated tasks for the workspace with filtering
 * Story P.1: Added pagination to fix performance issues with large task lists
 * @param filters - Optional filters for tasks
 * @param pagination - Pagination options (page, limit)
 * @returns Paginated task results with metadata
 */
export async function getWorkspaceTasksPaginated(
  filters?: TaskFilters,
  pagination?: TaskPaginationOptions
): Promise<ActionResult<PaginatedTasksResult>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const validatedFilters = filters
        ? TaskFiltersSchema.parse(filters)
        : undefined

      // Pagination defaults
      const page = Math.max(1, pagination?.page || 1)
      const limit = Math.min(100, Math.max(1, pagination?.limit || 50)) // Max 100, default 50
      const offset = (page - 1) * limit

      // Get column IDs for status filtering
      const columns = await prisma.taskColumn.findMany({
        where: { workspace_id: workspaceId },
        select: { id: true, is_done: true, position: true },
      })

      const doneColumnIds = columns.filter((c) => c.is_done).map((c) => c.id)
      const openColumnIds = columns
        .filter((c) => !c.is_done && c.position === 0)
        .map((c) => c.id)
      const inProgressColumnIds = columns
        .filter((c) => !c.is_done && c.position > 0)
        .map((c) => c.id)

      // Build where clause
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {
        workspace_id: workspaceId,
      }

      if (validatedFilters?.status && validatedFilters.status.length > 0) {
        const columnIds: string[] = []
        if (validatedFilters.status.includes('open')) {
          columnIds.push(...openColumnIds)
        }
        if (validatedFilters.status.includes('inProgress')) {
          columnIds.push(...inProgressColumnIds)
        }
        if (validatedFilters.status.includes('done')) {
          columnIds.push(...doneColumnIds)
        }
        where.column_id = { in: columnIds }
      }

      if (validatedFilters?.assigneeId !== undefined) {
        where.assignee_id = validatedFilters.assigneeId
      }

      if (validatedFilters?.priority && validatedFilters.priority.length > 0) {
        where.priority = { in: validatedFilters.priority }
      }

      if (validatedFilters?.dueDateStart || validatedFilters?.dueDateEnd) {
        where.due_date = {}
        if (validatedFilters.dueDateStart) {
          where.due_date.gte = validatedFilters.dueDateStart
        }
        if (validatedFilters.dueDateEnd) {
          where.due_date.lte = validatedFilters.dueDateEnd
        }
      }

      if (validatedFilters?.search) {
        where.OR = [
          { title: { contains: validatedFilters.search, mode: 'insensitive' } },
          {
            description: {
              contains: validatedFilters.search,
              mode: 'insensitive',
            },
          },
        ]
      }

      // Exclude completed if not including archived
      if (!validatedFilters?.includeArchived) {
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

        if (where.OR) {
          where.AND = [
            { OR: where.OR },
            {
              OR: [
                { completed_at: null },
                { completed_at: { gte: sevenDaysAgo } },
              ],
            },
          ]
          delete where.OR
        } else {
          where.OR = [
            { completed_at: null },
            { completed_at: { gte: sevenDaysAgo } },
          ]
        }
      }

      // Get total count for pagination
      const totalCount = await prisma.task.count({ where })

      // Fetch paginated tasks with reduced nesting (max 2 levels)
      const tasks = await prisma.task.findMany({
        where,
        take: limit,
        skip: offset,
        include: {
          column: {
            select: {
              id: true,
              name: true,
              color: true,
              is_done: true,
            },
          },
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar_url: true,
            },
          },
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          // Reduced nesting - removed deep includes
          _count: {
            select: {
              comments: true,
            },
          },
        },
        orderBy: { position: 'asc' },
      })

      // Fetch linked law items separately if needed (lazy loading pattern)
      const taskIds = tasks.map((t) => t.id)
      const listItemLinks =
        taskIds.length > 0
          ? await prisma.taskListItemLink.findMany({
              where: { task_id: { in: taskIds } },
              take: taskIds.length, // Limit to one per task
              include: {
                law_list_item: {
                  select: {
                    id: true,
                    document: {
                      select: {
                        title: true,
                        document_number: true,
                      },
                    },
                    law_list: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                },
              },
            })
          : []

      // Map list item links to tasks
      const tasksWithLinks = tasks.map((task) => ({
        ...task,
        list_item_links: listItemLinks
          .filter((link) => link.task_id === task.id)
          .map((link) => ({
            law_list_item: link.law_list_item,
          }))
          .slice(0, 5), // Cap links shown in list view
      }))

      const totalPages = Math.ceil(totalCount / limit)

      return {
        success: true,
        data: {
          tasks: tasksWithLinks as TaskWithRelations[],
          pagination: {
            page,
            limit,
            total: totalCount,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        },
      }
    })
  } catch (error) {
    console.error('getWorkspaceTasksPaginated error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Get all tasks for the workspace with filtering
 * @deprecated Use getWorkspaceTasksPaginated for better performance
 */
export async function getWorkspaceTasks(
  filters?: TaskFilters
): Promise<ActionResult<TaskWithRelations[]>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const validatedFilters = filters
        ? TaskFiltersSchema.parse(filters)
        : undefined

      // Get column IDs for status filtering
      const columns = await prisma.taskColumn.findMany({
        where: { workspace_id: workspaceId },
        select: { id: true, is_done: true, position: true },
      })

      const doneColumnIds = columns.filter((c) => c.is_done).map((c) => c.id)
      const openColumnIds = columns
        .filter((c) => !c.is_done && c.position === 0)
        .map((c) => c.id)
      const inProgressColumnIds = columns
        .filter((c) => !c.is_done && c.position > 0)
        .map((c) => c.id)

      // Build where clause
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = {
        workspace_id: workspaceId,
      }

      if (validatedFilters?.status && validatedFilters.status.length > 0) {
        const columnIds: string[] = []
        if (validatedFilters.status.includes('open')) {
          columnIds.push(...openColumnIds)
        }
        if (validatedFilters.status.includes('inProgress')) {
          columnIds.push(...inProgressColumnIds)
        }
        if (validatedFilters.status.includes('done')) {
          columnIds.push(...doneColumnIds)
        }
        where.column_id = { in: columnIds }
      }

      if (validatedFilters?.assigneeId !== undefined) {
        where.assignee_id = validatedFilters.assigneeId
      }

      if (validatedFilters?.priority && validatedFilters.priority.length > 0) {
        where.priority = { in: validatedFilters.priority }
      }

      if (validatedFilters?.dueDateStart || validatedFilters?.dueDateEnd) {
        where.due_date = {}
        if (validatedFilters.dueDateStart) {
          where.due_date.gte = validatedFilters.dueDateStart
        }
        if (validatedFilters.dueDateEnd) {
          where.due_date.lte = validatedFilters.dueDateEnd
        }
      }

      if (validatedFilters?.search) {
        where.OR = [
          { title: { contains: validatedFilters.search, mode: 'insensitive' } },
          {
            description: {
              contains: validatedFilters.search,
              mode: 'insensitive',
            },
          },
        ]
      }

      // Exclude completed if not including archived
      if (!validatedFilters?.includeArchived) {
        // Only show non-completed or recently completed (within 7 days)
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        // Override OR if search was set
        if (where.OR) {
          where.AND = [
            { OR: where.OR },
            {
              OR: [
                { completed_at: null },
                { completed_at: { gte: sevenDaysAgo } },
              ],
            },
          ]
          delete where.OR
        } else {
          where.OR = [
            { completed_at: null },
            { completed_at: { gte: sevenDaysAgo } },
          ]
        }
      }

      const tasks = await prisma.task.findMany({
        where,
        include: {
          column: {
            select: {
              id: true,
              name: true,
              color: true,
              is_done: true,
            },
          },
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar_url: true,
            },
          },
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          list_item_links: {
            take: 5,
            include: {
              law_list_item: {
                include: {
                  document: {
                    select: {
                      title: true,
                      document_number: true,
                    },
                  },
                  law_list: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
          _count: {
            select: {
              comments: true,
            },
          },
        },
        orderBy: { position: 'asc' },
      })

      return { success: true, data: tasks as TaskWithRelations[] }
    })
  } catch (error) {
    console.error('getWorkspaceTasks error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Get Kanban columns for the workspace
 */
export async function getTaskColumns(): Promise<
  ActionResult<TaskColumnWithCount[]>
> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      // Check if columns exist, if not create defaults
      const existingColumns = await prisma.taskColumn.findMany({
        where: { workspace_id: workspaceId },
        orderBy: { position: 'asc' },
        include: {
          _count: {
            select: { tasks: true },
          },
        },
      })

      if (existingColumns.length === 0) {
        // Create default columns
        const defaultColumns = [
          {
            name: 'Att göra',
            color: '#6b7280',
            position: 0,
            is_default: true,
            is_done: false,
          },
          {
            name: 'Pågående',
            color: '#3b82f6',
            position: 1,
            is_default: true,
            is_done: false,
          },
          {
            name: 'Klar',
            color: '#22c55e',
            position: 2,
            is_default: true,
            is_done: true,
          },
        ]

        await prisma.taskColumn.createMany({
          data: defaultColumns.map((col) => ({
            ...col,
            workspace_id: workspaceId,
          })),
        })

        // Fetch the created columns
        const created = await prisma.taskColumn.findMany({
          where: { workspace_id: workspaceId },
          orderBy: { position: 'asc' },
          include: {
            _count: {
              select: { tasks: true },
            },
          },
        })

        return { success: true, data: created as TaskColumnWithCount[] }
      }

      return { success: true, data: existingColumns as TaskColumnWithCount[] }
    })
  } catch (error) {
    console.error('getTaskColumns error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Update task status (move between columns)
 */
export async function updateTaskStatus(
  taskId: string,
  columnId: string,
  position: number
): Promise<ActionResult> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      // Verify task belongs to workspace
      const task = await prisma.task.findFirst({
        where: { id: taskId, workspace_id: workspaceId },
      })

      if (!task) {
        return { success: false, error: 'Uppgiften hittades inte' }
      }

      // Verify column belongs to workspace
      const column = await prisma.taskColumn.findFirst({
        where: { id: columnId, workspace_id: workspaceId },
      })

      if (!column) {
        return { success: false, error: 'Kolumnen hittades inte' }
      }

      // Update task
      await prisma.task.update({
        where: { id: taskId },
        data: {
          column_id: columnId,
          position,
          completed_at: column.is_done ? new Date() : null,
        },
      })

      // Invalidate cache for linked list items so document modal shows updated status
      await invalidateTaskLinkedListItemsCache(taskId)

      revalidatePath('/tasks')
      return { success: true }
    })
  } catch (error) {
    console.error('updateTaskStatus error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Bulk update tasks
 */
const BULK_OPERATION_LIMIT = 50

export async function updateTasksBulk(
  taskIds: string[],
  updates: {
    columnId?: string
    assigneeId?: string | null
    priority?: TaskPriority
  }
): Promise<ActionResult> {
  try {
    // Rate limit: max 50 tasks per bulk operation
    if (taskIds.length > BULK_OPERATION_LIMIT) {
      return {
        success: false,
        error: `Max ${BULK_OPERATION_LIMIT} uppgifter kan uppdateras åt gången`,
      }
    }

    if (taskIds.length === 0) {
      return { success: false, error: 'Inga uppgifter valda' }
    }

    return await withWorkspace(async ({ workspaceId }) => {
      // Verify all tasks belong to workspace
      const tasks = await prisma.task.findMany({
        where: {
          id: { in: taskIds },
          workspace_id: workspaceId,
        },
      })

      if (tasks.length !== taskIds.length) {
        return {
          success: false,
          error: 'Vissa uppgifter hittades inte',
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = {}

      if (updates.columnId) {
        // Verify column belongs to workspace
        const column = await prisma.taskColumn.findFirst({
          where: { id: updates.columnId, workspace_id: workspaceId },
        })
        if (!column) {
          return { success: false, error: 'Kolumnen hittades inte' }
        }
        data.column_id = updates.columnId
        data.completed_at = column.is_done ? new Date() : null
      }

      if (updates.assigneeId !== undefined) {
        data.assignee_id = updates.assigneeId
      }

      if (updates.priority) {
        data.priority = updates.priority
      }

      await prisma.task.updateMany({
        where: { id: { in: taskIds } },
        data,
      })

      // Invalidate cache for all linked list items
      await Promise.all(
        taskIds.map((id) => invalidateTaskLinkedListItemsCache(id))
      )

      revalidatePath('/tasks')
      return { success: true }
    })
  } catch (error) {
    console.error('updateTasksBulk error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Get summary stats for the workspace
 */
export async function getTaskSummaryStats(): Promise<
  ActionResult<TaskSummaryStats>
> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const columns = await prisma.taskColumn.findMany({
        where: { workspace_id: workspaceId },
        select: { id: true, is_done: true, position: true },
      })

      const doneColumnIds = columns.filter((c) => c.is_done).map((c) => c.id)
      const openColumnIds = columns
        .filter((c) => !c.is_done && c.position === 0)
        .map((c) => c.id)

      const now = new Date()
      const weekFromNow = new Date()
      weekFromNow.setDate(weekFromNow.getDate() + 7)

      const [total, open, done, overdue, dueThisWeek, byPriority] =
        await Promise.all([
          prisma.task.count({
            where: { workspace_id: workspaceId },
          }),
          prisma.task.count({
            where: {
              workspace_id: workspaceId,
              column_id: { in: openColumnIds },
            },
          }),
          prisma.task.count({
            where: {
              workspace_id: workspaceId,
              column_id: { in: doneColumnIds },
            },
          }),
          prisma.task.count({
            where: {
              workspace_id: workspaceId,
              due_date: { lt: now },
              column_id: { notIn: doneColumnIds },
            },
          }),
          prisma.task.count({
            where: {
              workspace_id: workspaceId,
              due_date: { gte: now, lte: weekFromNow },
              column_id: { notIn: doneColumnIds },
            },
          }),
          prisma.task.groupBy({
            by: ['priority'],
            where: { workspace_id: workspaceId },
            _count: true,
          }),
        ])

      const inProgress = total - open - done

      const priorityCounts = {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0,
        CRITICAL: 0,
      }
      byPriority.forEach((item) => {
        priorityCounts[item.priority] = item._count
      })

      return {
        success: true,
        data: {
          total,
          byStatus: {
            open,
            inProgress,
            done,
          },
          byPriority: priorityCounts,
          overdue,
          dueThisWeek,
        },
      }
    })
  } catch (error) {
    console.error('getTaskSummaryStats error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Get recent task activity
 */
export async function getTaskActivity(
  limit: number = 10
): Promise<ActionResult<TaskActivity[]>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const activity = await prisma.activityLog.findMany({
        where: {
          workspace_id: workspaceId,
          entity_type: 'task',
        },
        orderBy: { created_at: 'desc' },
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar_url: true,
            },
          },
        },
      })

      return { success: true, data: activity as TaskActivity[] }
    })
  } catch (error) {
    console.error('getTaskActivity error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Get team workload distribution
 */
export async function getTeamWorkload(): Promise<ActionResult<WorkloadItem[]>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const columns = await prisma.taskColumn.findMany({
        where: { workspace_id: workspaceId },
        select: { id: true, is_done: true },
      })

      const doneColumnIds = columns.filter((c) => c.is_done).map((c) => c.id)

      const workload = await prisma.task.groupBy({
        by: ['assignee_id'],
        where: {
          workspace_id: workspaceId,
          column_id: { notIn: doneColumnIds },
        },
        _count: true,
      })

      // Get assignee details
      const assigneeIds = workload
        .map((w) => w.assignee_id)
        .filter((id): id is string => id !== null)

      const assignees = await prisma.user.findMany({
        where: { id: { in: assigneeIds } },
        select: {
          id: true,
          name: true,
          avatar_url: true,
        },
      })

      const assigneeMap = new Map(assignees.map((a) => [a.id, a]))

      return {
        success: true,
        data: workload.map((w) => ({
          assigneeId: w.assignee_id,
          assigneeName: w.assignee_id
            ? (assigneeMap.get(w.assignee_id)?.name ?? null)
            : null,
          assigneeAvatar: w.assignee_id
            ? (assigneeMap.get(w.assignee_id)?.avatar_url ?? null)
            : null,
          taskCount: w._count,
        })),
      }
    })
  } catch (error) {
    console.error('getTeamWorkload error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Export tasks to CSV
 */
export async function exportTasksToCSV(
  filters?: TaskFilters
): Promise<ActionResult<{ csv: string; filename: string }>> {
  try {
    return await withWorkspace(async ({ workspaceSlug }) => {
      const tasks = await getWorkspaceTasks(filters)

      if (!tasks.success || !tasks.data) {
        return { success: false, error: 'Kunde inte hämta uppgifter' }
      }

      const headers = [
        'ID',
        'Titel',
        'Beskrivning',
        'Status',
        'Prioritet',
        'Ansvarig',
        'Förfallodatum',
        'Skapad',
        'Länkad lag',
      ]

      const escapeCSV = (value: string) => {
        if (
          value.includes(',') ||
          value.includes('"') ||
          value.includes('\n')
        ) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value
      }

      const rows = tasks.data.map((task) =>
        [
          task.id,
          escapeCSV(task.title),
          escapeCSV(task.description ?? ''),
          task.column.name,
          task.priority,
          task.assignee?.name ?? task.assignee?.email ?? 'Otilldelad',
          task.due_date
            ? new Date(task.due_date).toLocaleDateString('sv-SE')
            : '',
          new Date(task.created_at).toLocaleDateString('sv-SE'),
          escapeCSV(
            task.list_item_links[0]?.law_list_item.document.title ?? ''
          ),
        ].join(',')
      )

      const csv = [headers.join(','), ...rows].join('\n')

      const filename = `uppgifter-${workspaceSlug}-${new Date().toISOString().split('T')[0]}.csv`

      return { success: true, data: { csv, filename } }
    })
  } catch (error) {
    console.error('exportTasksToCSV error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Get overdue tasks
 */
export async function getOverdueTasks(limit: number = 5): Promise<
  ActionResult<
    Array<{
      id: string
      title: string
      due_date: Date | null
      assignee: {
        id: string
        name: string | null
        avatar_url: string | null
      } | null
      column: {
        id: string
        name: string
        color: string
        is_done: boolean
      }
    }>
  >
> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const columns = await prisma.taskColumn.findMany({
        where: { workspace_id: workspaceId },
        select: { id: true, is_done: true },
      })

      const doneColumnIds = columns.filter((c) => c.is_done).map((c) => c.id)

      const tasks = await prisma.task.findMany({
        where: {
          workspace_id: workspaceId,
          due_date: { lt: new Date() },
          column_id: { notIn: doneColumnIds },
        },
        orderBy: { due_date: 'asc' },
        take: limit,
        select: {
          id: true,
          title: true,
          due_date: true,
          assignee: {
            select: {
              id: true,
              name: true,
              avatar_url: true,
            },
          },
          column: {
            select: {
              id: true,
              name: true,
              color: true,
              is_done: true,
            },
          },
        },
      })

      return { success: true, data: tasks }
    })
  } catch (error) {
    console.error('getOverdueTasks error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Create a new task
 * Story 6.7: Extended to support optional columnId and linked law items
 */
export async function createTask(data: {
  title: string
  description?: string
  columnId?: string // Optional - uses first column if not provided
  assigneeId?: string
  dueDate?: Date
  priority?: TaskPriority
  linkedListItemIds?: string[] // Story 6.7: Link task to law list items
}): Promise<ActionResult<TaskWithRelations>> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      // Story 6.7: Get column - use provided ID or find first (default) column
      const column = data.columnId
        ? await prisma.taskColumn.findFirst({
            where: { id: data.columnId, workspace_id: workspaceId },
          })
        : await prisma.taskColumn.findFirst({
            where: { workspace_id: workspaceId },
            orderBy: { position: 'asc' },
          })

      if (!column) {
        return { success: false, error: 'Ingen kolumn hittades' }
      }

      // Get max position in column
      const maxPosition = await prisma.task.aggregate({
        where: { column_id: column.id },
        _max: { position: true },
      })

      // Create task with optional linked list items in transaction
      const task = await prisma.$transaction(async (tx) => {
        const newTask = await tx.task.create({
          data: {
            workspace_id: workspaceId,
            column_id: column.id,
            title: data.title,
            description: data.description ?? null,
            assignee_id: data.assigneeId ?? null,
            due_date: data.dueDate ?? null,
            priority: data.priority ?? 'MEDIUM',
            position: (maxPosition._max.position ?? -1) + 1,
            created_by: userId,
          },
        })

        // Story 6.7: Create law list item links if provided
        if (data.linkedListItemIds && data.linkedListItemIds.length > 0) {
          // Verify all list items belong to workspace
          const validListItems = await tx.lawListItem.findMany({
            where: {
              id: { in: data.linkedListItemIds },
              law_list: { workspace_id: workspaceId },
            },
            select: { id: true },
          })

          if (validListItems.length > 0) {
            await tx.taskListItemLink.createMany({
              data: validListItems.map((item) => ({
                task_id: newTask.id,
                law_list_item_id: item.id,
              })),
            })
          }
        }

        // Story 6.7: Log activity
        await tx.activityLog.create({
          data: {
            workspace_id: workspaceId,
            user_id: userId,
            entity_type: 'task',
            entity_id: newTask.id,
            action: 'created',
            new_value: { title: newTask.title },
          },
        })

        return newTask
      })

      // Invalidate cache for linked list items
      if (data.linkedListItemIds && data.linkedListItemIds.length > 0) {
        await Promise.all(
          data.linkedListItemIds.map((id) => invalidateListItemTasksCache(id))
        )
      }

      // Fetch full task with relations
      const fullTask = await prisma.task.findUnique({
        where: { id: task.id },
        include: {
          column: {
            select: {
              id: true,
              name: true,
              color: true,
              is_done: true,
            },
          },
          assignee: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar_url: true,
            },
          },
          creator: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          list_item_links: {
            take: 5,
            include: {
              law_list_item: {
                include: {
                  document: {
                    select: {
                      title: true,
                      document_number: true,
                    },
                  },
                  law_list: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
          _count: {
            select: {
              comments: true,
            },
          },
        },
      })

      revalidatePath('/tasks')
      return { success: true, data: fullTask as TaskWithRelations }
    })
  } catch (error) {
    console.error('createTask error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: string): Promise<ActionResult> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const task = await prisma.task.findFirst({
        where: { id: taskId, workspace_id: workspaceId },
      })

      if (!task) {
        return { success: false, error: 'Uppgiften hittades inte' }
      }

      // Invalidate cache before deletion (while links still exist)
      await invalidateTaskLinkedListItemsCache(taskId)

      await prisma.task.delete({
        where: { id: taskId },
      })

      revalidatePath('/tasks')
      return { success: true }
    })
  } catch (error) {
    console.error('deleteTask error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Delete multiple tasks
 */
export async function deleteTasksBulk(
  taskIds: string[]
): Promise<ActionResult> {
  try {
    // Rate limit: max 50 tasks per bulk operation
    if (taskIds.length > BULK_OPERATION_LIMIT) {
      return {
        success: false,
        error: `Max ${BULK_OPERATION_LIMIT} uppgifter kan raderas åt gången`,
      }
    }

    if (taskIds.length === 0) {
      return { success: false, error: 'Inga uppgifter valda' }
    }

    return await withWorkspace(async ({ workspaceId }) => {
      const tasks = await prisma.task.findMany({
        where: {
          id: { in: taskIds },
          workspace_id: workspaceId,
        },
      })

      if (tasks.length !== taskIds.length) {
        return { success: false, error: 'Vissa uppgifter hittades inte' }
      }

      // Invalidate cache before deletion (while links still exist)
      await Promise.all(
        taskIds.map((id) => invalidateTaskLinkedListItemsCache(id))
      )

      await prisma.task.deleteMany({
        where: { id: { in: taskIds } },
      })

      revalidatePath('/tasks')
      return { success: true }
    })
  } catch (error) {
    console.error('deleteTasksBulk error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

// ============================================================================
// Task Column Management Actions (Story 6.5)
// ============================================================================

const MAX_COLUMNS = 8

const CreateTaskColumnSchema = z.object({
  name: z.string().min(1, 'Kolumnnamn krävs').max(50, 'Max 50 tecken'),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Ogiltig färgkod')
    .optional(),
})

const UpdateTaskColumnSchema = z.object({
  name: z
    .string()
    .min(1, 'Kolumnnamn krävs')
    .max(50, 'Max 50 tecken')
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Ogiltig färgkod')
    .optional(),
  is_done: z.boolean().optional(),
})

/**
 * Create a new task column
 */
export async function createTaskColumn(
  name: string,
  color?: string
): Promise<ActionResult<TaskColumnWithCount>> {
  try {
    const validated = CreateTaskColumnSchema.parse({ name, color })

    return await withWorkspace(async ({ workspaceId }) => {
      // Check max columns limit
      const existingCount = await prisma.taskColumn.count({
        where: { workspace_id: workspaceId },
      })

      if (existingCount >= MAX_COLUMNS) {
        return {
          success: false,
          error: `Max ${MAX_COLUMNS} kolumner tillåtna`,
        }
      }

      // Check for duplicate names
      const duplicateName = await prisma.taskColumn.findFirst({
        where: {
          workspace_id: workspaceId,
          name: validated.name,
        },
      })

      if (duplicateName) {
        return {
          success: false,
          error: 'En kolumn med detta namn finns redan',
        }
      }

      // Get max position
      const maxPosition = await prisma.taskColumn.aggregate({
        where: { workspace_id: workspaceId },
        _max: { position: true },
      })

      const newColumn = await prisma.taskColumn.create({
        data: {
          workspace_id: workspaceId,
          name: validated.name,
          color: validated.color ?? '#6b7280',
          position: (maxPosition._max.position ?? -1) + 1,
          is_default: false,
          is_done: false,
        },
        include: {
          _count: {
            select: { tasks: true },
          },
        },
      })

      revalidatePath('/tasks')
      revalidatePath('/settings')
      return { success: true, data: newColumn as TaskColumnWithCount }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? 'Ogiltiga data',
      }
    }
    console.error('createTaskColumn error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Update task column (name, color, is_done)
 */
export async function updateTaskColumn(
  columnId: string,
  updates: { name?: string; color?: string; is_done?: boolean }
): Promise<ActionResult<TaskColumnWithCount>> {
  try {
    const validated = UpdateTaskColumnSchema.parse(updates)

    return await withWorkspace(async ({ workspaceId }) => {
      // Verify column belongs to workspace
      const column = await prisma.taskColumn.findFirst({
        where: { id: columnId, workspace_id: workspaceId },
      })

      if (!column) {
        return { success: false, error: 'Kolumnen hittades inte' }
      }

      // Check for duplicate names if name is being updated
      if (validated.name && validated.name !== column.name) {
        const duplicateName = await prisma.taskColumn.findFirst({
          where: {
            workspace_id: workspaceId,
            name: validated.name,
            id: { not: columnId },
          },
        })

        if (duplicateName) {
          return {
            success: false,
            error: 'En kolumn med detta namn finns redan',
          }
        }
      }

      // Validate at least one is_done column remains
      if (validated.is_done === false && column.is_done) {
        const otherDoneColumns = await prisma.taskColumn.count({
          where: {
            workspace_id: workspaceId,
            is_done: true,
            id: { not: columnId },
          },
        })

        if (otherDoneColumns === 0) {
          return {
            success: false,
            error: 'Minst en kolumn måste vara en slutförd-kolumn',
          }
        }
      }

      const updatedColumn = await prisma.taskColumn.update({
        where: { id: columnId },
        data: {
          ...(validated.name && { name: validated.name }),
          ...(validated.color && { color: validated.color }),
          ...(validated.is_done !== undefined && {
            is_done: validated.is_done,
          }),
        },
        include: {
          _count: {
            select: { tasks: true },
          },
        },
      })

      revalidatePath('/tasks')
      revalidatePath('/settings')
      return { success: true, data: updatedColumn as TaskColumnWithCount }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? 'Ogiltiga data',
      }
    }
    console.error('updateTaskColumn error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Delete task column (non-default only)
 * Migrates tasks to first column before deletion
 */
export async function deleteTaskColumn(
  columnId: string
): Promise<ActionResult<{ deletedId: string; migratedCount: number }>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      // Verify column belongs to workspace
      const column = await prisma.taskColumn.findFirst({
        where: { id: columnId, workspace_id: workspaceId },
        include: {
          _count: {
            select: { tasks: true },
          },
        },
      })

      if (!column) {
        return { success: false, error: 'Kolumnen hittades inte' }
      }

      // Cannot delete default columns
      if (column.is_default) {
        return { success: false, error: 'Standardkolumner kan inte raderas' }
      }

      // Get first column (migration target)
      const firstColumn = await prisma.taskColumn.findFirst({
        where: { workspace_id: workspaceId },
        orderBy: { position: 'asc' },
      })

      if (!firstColumn || firstColumn.id === columnId) {
        return {
          success: false,
          error: 'Kan inte hitta målkolumn för uppgifter',
        }
      }

      const migratedCount = column._count.tasks

      // Use transaction to migrate tasks and delete column
      await prisma.$transaction(async (tx) => {
        // Migrate tasks to first column
        if (migratedCount > 0) {
          await tx.task.updateMany({
            where: { column_id: columnId },
            data: { column_id: firstColumn.id },
          })
        }

        // Delete the column
        await tx.taskColumn.delete({
          where: { id: columnId },
        })

        // Reorder remaining columns to fill gap
        const remainingColumns = await tx.taskColumn.findMany({
          where: { workspace_id: workspaceId },
          orderBy: { position: 'asc' },
        })

        for (let i = 0; i < remainingColumns.length; i++) {
          const col = remainingColumns[i]
          if (col && col.position !== i) {
            await tx.taskColumn.update({
              where: { id: col.id },
              data: { position: i },
            })
          }
        }
      })

      revalidatePath('/tasks')
      revalidatePath('/settings')
      return { success: true, data: { deletedId: columnId, migratedCount } }
    })
  } catch (error) {
    console.error('deleteTaskColumn error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Reorder columns
 */
export async function reorderTaskColumns(
  columnIds: string[]
): Promise<ActionResult<TaskColumnWithCount[]>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      // Verify all IDs belong to workspace
      const columns = await prisma.taskColumn.findMany({
        where: { workspace_id: workspaceId },
      })

      const workspaceColumnIds = new Set(columns.map((c) => c.id))

      for (const id of columnIds) {
        if (!workspaceColumnIds.has(id)) {
          return { success: false, error: 'Ogiltig kolumn-ID' }
        }
      }

      // Verify all workspace columns are included
      if (columnIds.length !== columns.length) {
        return { success: false, error: 'Alla kolumner måste inkluderas' }
      }

      // Update positions based on array index
      // Use two-phase update to avoid unique constraint conflicts on (workspace_id, position)
      // Phase 1: Set all positions to negative values (temporary)
      // Phase 2: Set to final positive positions
      await prisma.$transaction([
        ...columnIds.map((id, index) =>
          prisma.taskColumn.update({
            where: { id },
            data: { position: -(index + 1000) },
          })
        ),
        ...columnIds.map((id, index) =>
          prisma.taskColumn.update({
            where: { id },
            data: { position: index },
          })
        ),
      ])

      // Fetch updated columns
      const updatedColumns = await prisma.taskColumn.findMany({
        where: { workspace_id: workspaceId },
        orderBy: { position: 'asc' },
        include: {
          _count: {
            select: { tasks: true },
          },
        },
      })

      revalidatePath('/tasks')
      revalidatePath('/settings')
      return { success: true, data: updatedColumns as TaskColumnWithCount[] }
    })
  } catch (error) {
    console.error('reorderTaskColumns error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Get task count for a specific column (used in delete dialog)
 */
export async function getColumnTaskCount(
  columnId: string
): Promise<ActionResult<number>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const column = await prisma.taskColumn.findFirst({
        where: { id: columnId, workspace_id: workspaceId },
        include: {
          _count: {
            select: { tasks: true },
          },
        },
      })

      if (!column) {
        return { success: false, error: 'Kolumnen hittades inte' }
      }

      return { success: true, data: column._count.tasks }
    })
  } catch (error) {
    console.error('getColumnTaskCount error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Get workspace members (for assignee picker)
 */
export async function getWorkspaceMembers(): Promise<
  ActionResult<
    Array<{
      id: string
      name: string | null
      email: string
      avatarUrl: string | null
    }>
  >
> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const members = await prisma.workspaceMember.findMany({
        where: { workspace_id: workspaceId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar_url: true,
            },
          },
        },
      })

      return {
        success: true,
        data: members.map((m) => ({
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          avatarUrl: m.user.avatar_url,
        })),
      }
    })
  } catch (error) {
    console.error('getWorkspaceMembers error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

// ============================================================================
// Story 6.7: Law List Item Search (for task linking)
// ============================================================================

export interface LawListItemForLinking {
  id: string
  documentId: string
  documentTitle: string
  documentNumber: string
  listId: string
  listName: string
}

export interface LawListForLinking {
  id: string
  name: string
  itemCount: number
}

/**
 * Get all law lists in the workspace (for document linking selector)
 * Story 6.7: First step in cascading selection
 */
export async function getWorkspaceLawLists(): Promise<
  ActionResult<LawListForLinking[]>
> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const lists = await prisma.lawList.findMany({
        where: { workspace_id: workspaceId },
        include: {
          _count: {
            select: { items: true },
          },
        },
        orderBy: { name: 'asc' },
      })

      return {
        success: true,
        data: lists.map((list) => ({
          id: list.id,
          name: list.name,
          itemCount: list._count.items,
        })),
      }
    })
  } catch (error) {
    console.error('getWorkspaceLawLists error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Get items within a specific law list (for document linking selector)
 * Story 6.7: Second step in cascading selection
 */
export async function getLawListItemsForLinking(
  listId: string,
  query?: string
): Promise<ActionResult<LawListItemForLinking[]>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      // Verify list belongs to workspace
      const list = await prisma.lawList.findFirst({
        where: { id: listId, workspace_id: workspaceId },
      })

      if (!list) {
        return { success: false, error: 'Listan hittades inte' }
      }

      // Build where clause
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const whereClause: any = { law_list_id: listId }

      if (query && query.length > 0) {
        whereClause.OR = [
          {
            document: {
              title: { contains: query, mode: 'insensitive' },
            },
          },
          {
            document: {
              document_number: { contains: query, mode: 'insensitive' },
            },
          },
        ]
      }

      const items = await prisma.lawListItem.findMany({
        where: whereClause,
        include: {
          document: {
            select: {
              id: true,
              title: true,
              document_number: true,
            },
          },
          law_list: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { position: 'asc' },
      })

      return {
        success: true,
        data: items.map((item) => ({
          id: item.id,
          documentId: item.document.id,
          documentTitle: item.document.title,
          documentNumber: item.document.document_number,
          listId: item.law_list.id,
          listName: item.law_list.name,
        })),
      }
    })
  } catch (error) {
    console.error('getLawListItemsForLinking error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

// ============================================================================
// Story 6.15: Get Tasks for Linking (from Law List Item side)
// ============================================================================

export interface TaskForLinking {
  id: string
  title: string
  priority: TaskPriority
  column: {
    name: string
    color: string
    is_done: boolean
  }
  assignee: {
    id: string
    name: string | null
    avatar_url: string | null
  } | null
}

/**
 * Get workspace tasks for linking to law list items
 * Story 6.15: Used by TasksSummaryBox link existing dialog
 * @param excludeLinkedTo - Optional list item ID to exclude already-linked tasks
 * @param query - Optional search query to filter tasks
 */
export async function getTasksForLinking(
  excludeLinkedTo?: string,
  query?: string
): Promise<ActionResult<TaskForLinking[]>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      // Build where clause
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const whereClause: any = {
        workspace_id: workspaceId,
      }

      // Exclude tasks already linked to this list item
      if (excludeLinkedTo) {
        whereClause.NOT = {
          list_item_links: {
            some: { law_list_item_id: excludeLinkedTo },
          },
        }
      }

      // Add search filter
      if (query && query.length > 0) {
        whereClause.title = { contains: query, mode: 'insensitive' }
      }

      const tasks = await prisma.task.findMany({
        where: whereClause,
        select: {
          id: true,
          title: true,
          priority: true,
          column: {
            select: {
              name: true,
              color: true,
              is_done: true,
            },
          },
          assignee: {
            select: {
              id: true,
              name: true,
              avatar_url: true,
            },
          },
        },
        orderBy: { updated_at: 'desc' },
        take: 50,
      })

      return { success: true, data: tasks }
    })
  } catch (error) {
    console.error('getTasksForLinking error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

/**
 * Search law list items for linking to tasks
 * Story 6.7: Used by the law-link-selector component (legacy flat search)
 */
export async function searchLawListItemsForLinking(
  query: string,
  limit: number = 20
): Promise<ActionResult<LawListItemForLinking[]>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      // Build where clause - handle empty query case
      const whereClause =
        query.length > 0
          ? {
              law_list: { workspace_id: workspaceId },
              OR: [
                {
                  document: {
                    title: { contains: query, mode: 'insensitive' as const },
                  },
                },
                {
                  document: {
                    document_number: {
                      contains: query,
                      mode: 'insensitive' as const,
                    },
                  },
                },
              ],
            }
          : {
              law_list: { workspace_id: workspaceId },
            }

      const items = await prisma.lawListItem.findMany({
        where: whereClause,
        take: limit,
        include: {
          document: {
            select: {
              id: true,
              title: true,
              document_number: true,
            },
          },
          law_list: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          document: { title: 'asc' },
        },
      })

      return {
        success: true,
        data: items.map((item) => ({
          id: item.id,
          documentId: item.document.id,
          documentTitle: item.document.title,
          documentNumber: item.document.document_number,
          listId: item.law_list.id,
          listName: item.law_list.name,
        })),
      }
    })
  } catch (error) {
    console.error('searchLawListItemsForLinking error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}
