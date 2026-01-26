'use server'

/**
 * Story 6.6: Task Modal Server Actions
 * Server actions for task modal CRUD operations and activity logging
 */

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { withWorkspace } from '@/lib/auth/workspace-context'
import { z } from 'zod'
import type { TaskPriority } from '@prisma/client'

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

export interface TaskDetails {
  id: string
  workspace_id: string
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
  labels: string[]
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
    avatar_url: string | null
  }
  list_item_links: Array<{
    id: string
    law_list_item: {
      id: string
      document: {
        id: string
        title: string
        document_number: string
        slug: string
      }
      law_list: {
        id: string
        name: string
      }
    }
  }>
  comments: TaskComment[]
  evidence: TaskEvidence[] // Story 6.7a: Now sourced from file_links
  _count: {
    comments: number
    evidence: number // Story 6.7a: Now counts file_links
  }
}

export interface TaskComment {
  id: string
  content: string
  author_id: string
  parent_id: string | null
  depth: number
  mentions: string[]
  created_at: Date
  updated_at: Date
  edited_at: Date | null
  author: {
    id: string
    name: string | null
    email: string
    avatar_url: string | null
  }
  replies?: TaskComment[]
}

// Story 6.7a: Updated to use WorkspaceFile with many-to-many links
export interface TaskEvidence {
  id: string // This is now the file_link id
  file_id: string
  filename: string
  original_filename: string | null // Nullable for folders (Story 6.7b)
  file_size: number | null // Nullable for folders (Story 6.7b)
  mime_type: string | null // Nullable for folders (Story 6.7b)
  storage_path: string | null // Nullable for folders (Story 6.7b)
  category: string
  description: string | null
  created_at: Date
  uploader: {
    id: string
    name: string | null
    email: string
    avatar_url: string | null
  }
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

export interface TaskColumn {
  id: string
  name: string
  color: string
  is_done: boolean
}

// ============================================================================
// Validation Schemas
// ============================================================================

const UpdateTitleSchema = z.object({
  taskId: z.string().uuid(),
  title: z.string().min(3, 'Titeln måste vara minst 3 tecken').max(200),
})

const UpdateDescriptionSchema = z.object({
  taskId: z.string().uuid(),
  description: z.string().max(10000).nullable(),
})

const UpdateStatusSchema = z.object({
  taskId: z.string().uuid(),
  columnId: z.string().uuid(),
})

const UpdateAssigneeSchema = z.object({
  taskId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
})

const UpdateDueDateSchema = z.object({
  taskId: z.string().uuid(),
  dueDate: z.coerce.date().nullable(),
})

const UpdatePrioritySchema = z.object({
  taskId: z.string().uuid(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
})

const UpdateLabelsSchema = z.object({
  taskId: z.string().uuid(),
  labels: z.array(z.string().max(50)).max(10),
})

const CreateCommentSchema = z.object({
  taskId: z.string().uuid(),
  content: z.string().min(1).max(5000),
  parentCommentId: z.string().uuid().optional(),
})

const UpdateCommentSchema = z.object({
  commentId: z.string().uuid(),
  content: z.string().min(1).max(5000),
})

const LinkListItemSchema = z.object({
  taskId: z.string().uuid(),
  listItemId: z.string().uuid(),
})

// ============================================================================
// Helper: Log Activity
// ============================================================================

async function logActivity(
  workspaceId: string,
  userId: string,
  entityType: string,
  entityId: string,
  action: string,
  oldValue?: unknown,
  newValue?: unknown
) {
  await prisma.activityLog.create({
    data: {
      workspace_id: workspaceId,
      user_id: userId,
      entity_type: entityType,
      entity_id: entityId,
      action,
      old_value: oldValue ? JSON.parse(JSON.stringify(oldValue)) : null,
      new_value: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
    },
  })
}

// ============================================================================
// Get Task Details
// ============================================================================

export async function getTaskDetails(
  taskId: string
): Promise<ActionResult<TaskDetails>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const task = await prisma.task.findFirst({
        where: {
          id: taskId,
          workspace_id: workspaceId,
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
              avatar_url: true,
            },
          },
          list_item_links: {
            include: {
              law_list_item: {
                include: {
                  document: {
                    select: {
                      id: true,
                      title: true,
                      document_number: true,
                      slug: true,
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
          comments: {
            where: { depth: 0 },
            orderBy: { created_at: 'desc' },
            include: {
              author: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  avatar_url: true,
                },
              },
              replies: {
                orderBy: { created_at: 'asc' },
                include: {
                  author: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      avatar_url: true,
                    },
                  },
                  replies: {
                    orderBy: { created_at: 'asc' },
                    include: {
                      author: {
                        select: {
                          id: true,
                          name: true,
                          email: true,
                          avatar_url: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          // Story 6.7a: Use file_links instead of evidence
          file_links: {
            orderBy: { linked_at: 'desc' },
            include: {
              file: {
                include: {
                  uploader: {
                    select: {
                      id: true,
                      name: true,
                      email: true,
                      avatar_url: true,
                    },
                  },
                },
              },
            },
          },
          _count: {
            select: {
              comments: true,
              file_links: true,
            },
          },
        },
      })

      if (!task) {
        return { success: false, error: 'Uppgiften hittades inte' }
      }

      // Transform to TaskDetails type with labels (stored in metadata or separate field)
      // Story 6.7a: Transform file_links to evidence format for backward compatibility
      const evidence: TaskEvidence[] = task.file_links.map((link) => ({
        id: link.id,
        file_id: link.file.id,
        filename: link.file.filename,
        original_filename: link.file.original_filename,
        file_size: link.file.file_size,
        mime_type: link.file.mime_type,
        storage_path: link.file.storage_path,
        category: link.file.category,
        description: link.file.description,
        created_at: link.file.created_at,
        uploader: link.file.uploader,
      }))

      const taskDetails: TaskDetails = {
        ...task,
        labels: [], // TODO: Add labels field to Task model if needed
        comments: task.comments as unknown as TaskComment[],
        evidence,
        _count: {
          comments: task._count.comments,
          evidence: task._count.file_links,
        },
      }

      return { success: true, data: taskDetails }
    })
  } catch (error) {
    console.error('getTaskDetails error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

// ============================================================================
// Update Task Title
// ============================================================================

export async function updateTaskTitle(
  taskId: string,
  title: string
): Promise<ActionResult> {
  try {
    const validated = UpdateTitleSchema.parse({ taskId, title })

    return await withWorkspace(async ({ workspaceId, userId }) => {
      const task = await prisma.task.findFirst({
        where: { id: validated.taskId, workspace_id: workspaceId },
        select: { title: true },
      })

      if (!task) {
        return { success: false, error: 'Uppgiften hittades inte' }
      }

      await prisma.task.update({
        where: { id: validated.taskId },
        data: { title: validated.title },
      })

      await logActivity(
        workspaceId,
        userId,
        'task',
        validated.taskId,
        'title_updated',
        { title: task.title },
        { title: validated.title }
      )

      revalidatePath('/tasks')
      return { success: true }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? 'Ogiltig titel',
      }
    }
    console.error('updateTaskTitle error:', error)
    return { success: false, error: 'Kunde inte uppdatera titeln' }
  }
}

// ============================================================================
// Update Task Description
// ============================================================================

export async function updateTaskDescription(
  taskId: string,
  description: string | null
): Promise<ActionResult> {
  try {
    const validated = UpdateDescriptionSchema.parse({ taskId, description })

    return await withWorkspace(async ({ workspaceId, userId }) => {
      const task = await prisma.task.findFirst({
        where: { id: validated.taskId, workspace_id: workspaceId },
        select: { description: true },
      })

      if (!task) {
        return { success: false, error: 'Uppgiften hittades inte' }
      }

      await prisma.task.update({
        where: { id: validated.taskId },
        data: { description: validated.description },
      })

      await logActivity(
        workspaceId,
        userId,
        'task',
        validated.taskId,
        'description_updated',
        { description: task.description ? 'Previous content' : null },
        { description: validated.description ? 'Updated content' : null }
      )

      revalidatePath('/tasks')
      return { success: true }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? 'Ogiltig beskrivning',
      }
    }
    console.error('updateTaskDescription error:', error)
    return { success: false, error: 'Kunde inte uppdatera beskrivningen' }
  }
}

// ============================================================================
// Update Task Status (Column)
// ============================================================================

export async function updateTaskStatusColumn(
  taskId: string,
  columnId: string
): Promise<ActionResult> {
  try {
    const validated = UpdateStatusSchema.parse({ taskId, columnId })

    return await withWorkspace(async ({ workspaceId, userId }) => {
      const [task, column] = await Promise.all([
        prisma.task.findFirst({
          where: { id: validated.taskId, workspace_id: workspaceId },
          include: { column: { select: { name: true } } },
        }),
        prisma.taskColumn.findFirst({
          where: { id: validated.columnId, workspace_id: workspaceId },
        }),
      ])

      if (!task) {
        return { success: false, error: 'Uppgiften hittades inte' }
      }

      if (!column) {
        return { success: false, error: 'Kolumnen hittades inte' }
      }

      // Get max position in target column
      const maxPosition = await prisma.task.aggregate({
        where: { column_id: validated.columnId },
        _max: { position: true },
      })

      await prisma.task.update({
        where: { id: validated.taskId },
        data: {
          column_id: validated.columnId,
          position: (maxPosition._max.position ?? -1) + 1,
          completed_at: column.is_done ? new Date() : null,
        },
      })

      await logActivity(
        workspaceId,
        userId,
        'task',
        validated.taskId,
        'status_updated',
        { status: task.column.name },
        { status: column.name }
      )

      revalidatePath('/tasks')
      return { success: true }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? 'Ogiltig status',
      }
    }
    console.error('updateTaskStatusColumn error:', error)
    return { success: false, error: 'Kunde inte uppdatera status' }
  }
}

// ============================================================================
// Update Task Assignee
// ============================================================================

export async function updateTaskAssignee(
  taskId: string,
  userId: string | null
): Promise<ActionResult> {
  try {
    const validated = UpdateAssigneeSchema.parse({ taskId, userId })

    return await withWorkspace(
      async ({ workspaceId, userId: currentUserId }) => {
        const task = await prisma.task.findFirst({
          where: { id: validated.taskId, workspace_id: workspaceId },
          include: { assignee: { select: { name: true, email: true } } },
        })

        if (!task) {
          return { success: false, error: 'Uppgiften hittades inte' }
        }

        // Verify new assignee is workspace member (if not null)
        if (validated.userId) {
          const member = await prisma.workspaceMember.findFirst({
            where: { user_id: validated.userId, workspace_id: workspaceId },
          })
          if (!member) {
            return {
              success: false,
              error: 'Användaren är inte medlem i arbetsytan',
            }
          }
        }

        const newAssignee = validated.userId
          ? await prisma.user.findUnique({
              where: { id: validated.userId },
              select: { name: true, email: true },
            })
          : null

        await prisma.task.update({
          where: { id: validated.taskId },
          data: { assignee_id: validated.userId },
        })

        await logActivity(
          workspaceId,
          currentUserId,
          'task',
          validated.taskId,
          'assignee_updated',
          { assignee: task.assignee?.name ?? task.assignee?.email ?? null },
          { assignee: newAssignee?.name ?? newAssignee?.email ?? null }
        )

        revalidatePath('/tasks')
        return { success: true }
      }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? 'Ogiltig ansvarig',
      }
    }
    console.error('updateTaskAssignee error:', error)
    return { success: false, error: 'Kunde inte uppdatera ansvarig' }
  }
}

// ============================================================================
// Update Task Due Date
// ============================================================================

export async function updateTaskDueDate(
  taskId: string,
  dueDate: Date | null
): Promise<ActionResult> {
  try {
    const validated = UpdateDueDateSchema.parse({ taskId, dueDate })

    return await withWorkspace(async ({ workspaceId, userId }) => {
      const task = await prisma.task.findFirst({
        where: { id: validated.taskId, workspace_id: workspaceId },
        select: { due_date: true },
      })

      if (!task) {
        return { success: false, error: 'Uppgiften hittades inte' }
      }

      await prisma.task.update({
        where: { id: validated.taskId },
        data: { due_date: validated.dueDate },
      })

      await logActivity(
        workspaceId,
        userId,
        'task',
        validated.taskId,
        'due_date_updated',
        { due_date: task.due_date?.toISOString() ?? null },
        { due_date: validated.dueDate?.toISOString() ?? null }
      )

      revalidatePath('/tasks')
      return { success: true }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? 'Ogiltigt datum',
      }
    }
    console.error('updateTaskDueDate error:', error)
    return { success: false, error: 'Kunde inte uppdatera förfallodatum' }
  }
}

// ============================================================================
// Update Task Priority
// ============================================================================

export async function updateTaskPriority(
  taskId: string,
  priority: TaskPriority
): Promise<ActionResult> {
  try {
    const validated = UpdatePrioritySchema.parse({ taskId, priority })

    return await withWorkspace(async ({ workspaceId, userId }) => {
      const task = await prisma.task.findFirst({
        where: { id: validated.taskId, workspace_id: workspaceId },
        select: { priority: true },
      })

      if (!task) {
        return { success: false, error: 'Uppgiften hittades inte' }
      }

      await prisma.task.update({
        where: { id: validated.taskId },
        data: { priority: validated.priority },
      })

      await logActivity(
        workspaceId,
        userId,
        'task',
        validated.taskId,
        'priority_updated',
        { priority: task.priority },
        { priority: validated.priority }
      )

      revalidatePath('/tasks')
      return { success: true }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? 'Ogiltig prioritet',
      }
    }
    console.error('updateTaskPriority error:', error)
    return { success: false, error: 'Kunde inte uppdatera prioritet' }
  }
}

// ============================================================================
// Update Task Labels
// ============================================================================

export async function updateTaskLabels(
  taskId: string,
  labels: string[]
): Promise<ActionResult> {
  try {
    const validated = UpdateLabelsSchema.parse({ taskId, labels })

    return await withWorkspace(async ({ workspaceId, userId }) => {
      const task = await prisma.task.findFirst({
        where: { id: validated.taskId, workspace_id: workspaceId },
      })

      if (!task) {
        return { success: false, error: 'Uppgiften hittades inte' }
      }

      // TODO: Implement labels storage when field is added to schema
      // For now, we'll skip the actual update

      await logActivity(
        workspaceId,
        userId,
        'task',
        validated.taskId,
        'labels_updated',
        { labels: [] },
        { labels: validated.labels }
      )

      revalidatePath('/tasks')
      return { success: true }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? 'Ogiltiga etiketter',
      }
    }
    console.error('updateTaskLabels error:', error)
    return { success: false, error: 'Kunde inte uppdatera etiketter' }
  }
}

// ============================================================================
// Get Task Columns
// ============================================================================

export async function getTaskColumnsForModal(): Promise<
  ActionResult<TaskColumn[]>
> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const columns = await prisma.taskColumn.findMany({
        where: { workspace_id: workspaceId },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          name: true,
          color: true,
          is_done: true,
        },
      })

      return { success: true, data: columns }
    })
  } catch (error) {
    console.error('getTaskColumnsForModal error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Ett fel uppstod',
    }
  }
}

// ============================================================================
// Create Comment
// ============================================================================

export async function createComment(
  taskId: string,
  content: string,
  parentCommentId?: string
): Promise<ActionResult<TaskComment>> {
  try {
    const validated = CreateCommentSchema.parse({
      taskId,
      content,
      parentCommentId,
    })

    return await withWorkspace(async ({ workspaceId, userId }) => {
      const task = await prisma.task.findFirst({
        where: { id: validated.taskId, workspace_id: workspaceId },
      })

      if (!task) {
        return { success: false, error: 'Uppgiften hittades inte' }
      }

      // Calculate depth for threading
      let depth = 0
      if (validated.parentCommentId) {
        const parent = await prisma.comment.findUnique({
          where: { id: validated.parentCommentId },
          select: { depth: true },
        })
        if (!parent) {
          return { success: false, error: 'Överordnad kommentar hittades inte' }
        }
        if (parent.depth >= 2) {
          return { success: false, error: 'Max 3 nivåer av svar tillåtna' }
        }
        depth = parent.depth + 1
      }

      // Extract @mentions from content
      const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g
      const mentions: string[] = []
      let match
      while ((match = mentionRegex.exec(content)) !== null) {
        if (match[2]) {
          mentions.push(match[2])
        }
      }

      const comment = await prisma.comment.create({
        data: {
          workspace_id: workspaceId,
          task_id: validated.taskId,
          author_id: userId,
          content: validated.content,
          parent_id: validated.parentCommentId ?? null,
          depth,
          mentions,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar_url: true,
            },
          },
        },
      })

      await logActivity(
        workspaceId,
        userId,
        'task',
        validated.taskId,
        'comment_added',
        null,
        { comment_id: comment.id }
      )

      revalidatePath('/tasks')
      return { success: true, data: comment as unknown as TaskComment }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? 'Ogiltig kommentar',
      }
    }
    console.error('createComment error:', error)
    return { success: false, error: 'Kunde inte skapa kommentar' }
  }
}

// ============================================================================
// Update Comment
// ============================================================================

export async function updateComment(
  commentId: string,
  content: string
): Promise<ActionResult> {
  try {
    const validated = UpdateCommentSchema.parse({ commentId, content })

    return await withWorkspace(async ({ workspaceId, userId }) => {
      const comment = await prisma.comment.findFirst({
        where: {
          id: validated.commentId,
          workspace_id: workspaceId,
          author_id: userId, // Only author can edit
        },
      })

      if (!comment) {
        return {
          success: false,
          error: 'Kommentaren hittades inte eller du har inte behörighet',
        }
      }

      await prisma.comment.update({
        where: { id: validated.commentId },
        data: {
          content: validated.content,
          edited_at: new Date(),
        },
      })

      revalidatePath('/tasks')
      return { success: true }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? 'Ogiltig kommentar',
      }
    }
    console.error('updateComment error:', error)
    return { success: false, error: 'Kunde inte uppdatera kommentar' }
  }
}

// ============================================================================
// Delete Comment
// ============================================================================

export async function deleteComment(commentId: string): Promise<ActionResult> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      const comment = await prisma.comment.findFirst({
        where: {
          id: commentId,
          workspace_id: workspaceId,
          author_id: userId, // Only author can delete
        },
      })

      if (!comment) {
        return {
          success: false,
          error: 'Kommentaren hittades inte eller du har inte behörighet',
        }
      }

      // Delete cascades to replies
      await prisma.comment.delete({
        where: { id: commentId },
      })

      revalidatePath('/tasks')
      return { success: true }
    })
  } catch (error) {
    console.error('deleteComment error:', error)
    return { success: false, error: 'Kunde inte radera kommentar' }
  }
}

// ============================================================================
// Get Task Activity (History)
// ============================================================================

export async function getTaskActivity(
  taskId: string,
  limit: number = 50
): Promise<ActionResult<TaskActivity[]>> {
  try {
    return await withWorkspace(async ({ workspaceId }) => {
      const activity = await prisma.activityLog.findMany({
        where: {
          workspace_id: workspaceId,
          entity_type: 'task',
          entity_id: taskId,
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

// ============================================================================
// Link List Item to Task
// ============================================================================

export async function linkListItemToTask(
  taskId: string,
  listItemId: string
): Promise<ActionResult> {
  try {
    const validated = LinkListItemSchema.parse({ taskId, listItemId })

    return await withWorkspace(async ({ workspaceId, userId }) => {
      // Verify task belongs to workspace
      const task = await prisma.task.findFirst({
        where: { id: validated.taskId, workspace_id: workspaceId },
      })

      if (!task) {
        return { success: false, error: 'Uppgiften hittades inte' }
      }

      // Verify list item exists in a workspace law list
      const listItem = await prisma.lawListItem.findFirst({
        where: {
          id: validated.listItemId,
          law_list: { workspace_id: workspaceId },
        },
        include: {
          document: { select: { title: true } },
        },
      })

      if (!listItem) {
        return { success: false, error: 'Lagen hittades inte' }
      }

      // Check if already linked
      const existing = await prisma.taskListItemLink.findFirst({
        where: {
          task_id: validated.taskId,
          law_list_item_id: validated.listItemId,
        },
      })

      if (existing) {
        return { success: false, error: 'Lagen är redan länkad' }
      }

      await prisma.taskListItemLink.create({
        data: {
          task_id: validated.taskId,
          law_list_item_id: validated.listItemId,
        },
      })

      await logActivity(
        workspaceId,
        userId,
        'task',
        validated.taskId,
        'law_linked',
        null,
        { law_title: listItem.document.title }
      )

      revalidatePath('/tasks')
      return { success: true }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? 'Ogiltiga data',
      }
    }
    console.error('linkListItemToTask error:', error)
    return { success: false, error: 'Kunde inte länka lag' }
  }
}

// ============================================================================
// Unlink List Item from Task
// ============================================================================

export async function unlinkListItemFromTask(
  taskId: string,
  listItemId: string
): Promise<ActionResult> {
  try {
    const validated = LinkListItemSchema.parse({ taskId, listItemId })

    return await withWorkspace(async ({ workspaceId, userId }) => {
      const link = await prisma.taskListItemLink.findFirst({
        where: {
          task_id: validated.taskId,
          law_list_item_id: validated.listItemId,
        },
        include: {
          task: { select: { workspace_id: true } },
          law_list_item: {
            include: { document: { select: { title: true } } },
          },
        },
      })

      if (!link || link.task.workspace_id !== workspaceId) {
        return { success: false, error: 'Länken hittades inte' }
      }

      await prisma.taskListItemLink.delete({
        where: { id: link.id },
      })

      await logActivity(
        workspaceId,
        userId,
        'task',
        validated.taskId,
        'law_unlinked',
        { law_title: link.law_list_item.document.title },
        null
      )

      revalidatePath('/tasks')
      return { success: true }
    })
  } catch (error) {
    console.error('unlinkListItemFromTask error:', error)
    return { success: false, error: 'Kunde inte ta bort länk' }
  }
}

// ============================================================================
// Delete Task
// ============================================================================

export async function deleteTaskModal(taskId: string): Promise<ActionResult> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      const task = await prisma.task.findFirst({
        where: { id: taskId, workspace_id: workspaceId },
        select: { title: true },
      })

      if (!task) {
        return { success: false, error: 'Uppgiften hittades inte' }
      }

      // Delete task (cascades to comments, evidence, links)
      await prisma.task.delete({
        where: { id: taskId },
      })

      await logActivity(
        workspaceId,
        userId,
        'task',
        taskId,
        'deleted',
        { title: task.title },
        null
      )

      revalidatePath('/tasks')
      return { success: true }
    })
  } catch (error) {
    console.error('deleteTaskModal error:', error)
    return { success: false, error: 'Kunde inte radera uppgift' }
  }
}
