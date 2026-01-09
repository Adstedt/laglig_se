'use server'

/**
 * Story 6.4: Task Server Actions
 * Server actions for task workspace data fetching and mutations
 */

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { withWorkspace } from '@/lib/auth/workspace-context'
import { z } from 'zod'
import type { TaskPriority, TaskColumn } from '@prisma/client'

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
 * Get all tasks for the workspace with filtering
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
            take: 1,
            include: {
              law_list_item: {
                include: {
                  document: {
                    select: {
                      title: true,
                      document_number: true,
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
 */
export async function createTask(data: {
  title: string
  description?: string
  columnId: string
  assigneeId?: string
  dueDate?: Date
  priority?: TaskPriority
}): Promise<ActionResult<TaskWithRelations>> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      // Verify column belongs to workspace
      const column = await prisma.taskColumn.findFirst({
        where: { id: data.columnId, workspace_id: workspaceId },
      })

      if (!column) {
        return { success: false, error: 'Kolumnen hittades inte' }
      }

      // Get max position in column
      const maxPosition = await prisma.task.aggregate({
        where: { column_id: data.columnId },
        _max: { position: true },
      })

      const task = await prisma.task.create({
        data: {
          workspace_id: workspaceId,
          column_id: data.columnId,
          title: data.title,
          description: data.description ?? null,
          assignee_id: data.assigneeId ?? null,
          due_date: data.dueDate ?? null,
          priority: data.priority ?? 'MEDIUM',
          position: (maxPosition._max.position ?? -1) + 1,
          created_by: userId,
        },
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
            take: 1,
            include: {
              law_list_item: {
                include: {
                  document: {
                    select: {
                      title: true,
                      document_number: true,
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
      return { success: true, data: task as TaskWithRelations }
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
  name: z.string().min(1, 'Kolumnnamn krävs').max(50, 'Max 50 tecken').optional(),
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
      return { success: false, error: error.issues[0]?.message ?? 'Ogiltiga data' }
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
          ...(validated.is_done !== undefined && { is_done: validated.is_done }),
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
      return { success: false, error: error.issues[0]?.message ?? 'Ogiltiga data' }
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
        return { success: false, error: 'Kan inte hitta målkolumn för uppgifter' }
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
      await prisma.$transaction(
        columnIds.map((id, index) =>
          prisma.taskColumn.update({
            where: { id },
            data: { position: index },
          })
        )
      )

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
