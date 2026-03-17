import { NotificationType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { NOTIFICATION_TYPE_TO_PREFERENCE } from '@/lib/email/notification-preferences'
import { sendEmail } from '@/lib/email/email-service'
import { generateUnsubscribeUrl } from '@/lib/email/unsubscribe-token'
import React from 'react'
import { TaskAssignedEmail } from '@/emails/task-assigned'
import { CommentNotificationEmail } from '@/emails/comment-notification'
import { StatusChangedNotificationEmail } from '@/emails/status-changed-notification'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://laglig.se'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TaskNotificationStats {
  created: number
  skippedByPreference: number
  skippedByDedup: number
}

export interface TaskNotificationContext {
  taskId: string
  workspaceId: string
  actorUserId: string
  /** Task title — used in notification body */
  taskTitle: string
  /** Actor display name — used in notification body */
  actorName: string
}

interface RecipientInfo {
  userId: string
  email: string
  name: string | null
}

// ---------------------------------------------------------------------------
// Notification text templates (Swedish)
// ---------------------------------------------------------------------------

function buildNotificationText(
  type: NotificationType,
  ctx: TaskNotificationContext & {
    newColumnName?: string
    daysLeft?: number
    overdueDays?: number
    count?: number
  }
): { title: string; body: string } {
  switch (type) {
    case NotificationType.TASK_ASSIGNED:
      return {
        title: 'Ny tilldelning',
        body: `${ctx.actorName} tilldelade dig uppgiften "${ctx.taskTitle}"`,
      }
    case NotificationType.TASK_DUE_SOON:
      return {
        title: 'Uppgift förfaller snart',
        body: `Uppgiften "${ctx.taskTitle}" förfaller om ${ctx.daysLeft ?? 0} dagar`,
      }
    case NotificationType.TASK_OVERDUE:
      return {
        title: 'Förfallen uppgift',
        body: `Uppgiften "${ctx.taskTitle}" är förfallen sedan ${ctx.overdueDays ?? 0} dagar`,
      }
    case NotificationType.COMMENT_ADDED:
      return {
        title: 'Ny kommentar',
        body: `${ctx.actorName} kommenterade på uppgiften "${ctx.taskTitle}"`,
      }
    case NotificationType.MENTION:
      return {
        title: 'Omnämnande',
        body: `${ctx.actorName} nämnde dig i en kommentar på "${ctx.taskTitle}"`,
      }
    case NotificationType.STATUS_CHANGED:
      return {
        title: 'Statusändring',
        body: `${ctx.actorName} ändrade status på "${ctx.taskTitle}" till ${ctx.newColumnName ?? 'okänd'}`,
      }
    case NotificationType.WEEKLY_DIGEST:
      return {
        title: 'Veckans uppgifter',
        body: `Du har ${ctx.count ?? 0} uppgifter att slutföra denna vecka`,
      }
    default:
      return { title: 'Notifikation', body: '' }
  }
}

// ---------------------------------------------------------------------------
// Recipient resolution
// ---------------------------------------------------------------------------

async function resolveTaskRecipients(
  type: NotificationType,
  taskId: string,
  workspaceId: string,
  mentionedUserIds?: string[]
): Promise<RecipientInfo[]> {
  const task = await prisma.task.findFirst({
    where: { id: taskId, workspace_id: workspaceId },
    select: {
      assignee_id: true,
      created_by: true,
      assignee: { select: { id: true, email: true, name: true } },
      creator: { select: { id: true, email: true, name: true } },
    },
  })

  if (!task) return []

  const recipients: RecipientInfo[] = []
  const seen = new Set<string>()

  const addRecipient = (user: RecipientInfo | null) => {
    if (user && !seen.has(user.userId)) {
      seen.add(user.userId)
      recipients.push(user)
    }
  }

  switch (type) {
    case NotificationType.TASK_ASSIGNED:
      if (task.assignee) {
        addRecipient({
          userId: task.assignee.id,
          email: task.assignee.email,
          name: task.assignee.name,
        })
      }
      break

    case NotificationType.COMMENT_ADDED:
      // Notify task creator + assignee
      addRecipient({
        userId: task.creator.id,
        email: task.creator.email,
        name: task.creator.name,
      })
      if (task.assignee) {
        addRecipient({
          userId: task.assignee.id,
          email: task.assignee.email,
          name: task.assignee.name,
        })
      }
      break

    case NotificationType.MENTION:
      // Notify mentioned users
      if (mentionedUserIds && mentionedUserIds.length > 0) {
        const mentionedUsers = await prisma.user.findMany({
          where: { id: { in: mentionedUserIds } },
          select: { id: true, email: true, name: true },
        })
        for (const user of mentionedUsers) {
          addRecipient({
            userId: user.id,
            email: user.email,
            name: user.name,
          })
        }
      }
      break

    case NotificationType.STATUS_CHANGED:
      // Notify task creator
      addRecipient({
        userId: task.creator.id,
        email: task.creator.email,
        name: task.creator.name,
      })
      break

    default:
      break
  }

  return recipients
}

// ---------------------------------------------------------------------------
// Deduplication check
// ---------------------------------------------------------------------------

async function isDuplicate(
  userId: string,
  entityId: string,
  type: NotificationType
): Promise<boolean> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const existing = await prisma.notification.findFirst({
    where: {
      user_id: userId,
      entity_id: entityId,
      type,
      created_at: { gte: twentyFourHoursAgo },
    },
    select: { id: true },
  })
  return existing !== null
}

// ---------------------------------------------------------------------------
// Email template builder
// ---------------------------------------------------------------------------

function buildEmailElement(
  type: NotificationType,
  ctx: TaskNotificationContext,
  recipient: RecipientInfo,
  extra?: { newColumnName?: string }
): React.ReactElement | null {
  const taskUrl = `${APP_URL}/tasks?task=${ctx.taskId}`
  const unsubscribeUrl = generateUnsubscribeUrl(
    recipient.userId,
    ctx.workspaceId
  )

  switch (type) {
    case NotificationType.TASK_ASSIGNED:
      return React.createElement(TaskAssignedEmail, {
        assigneeName: recipient.name,
        actorName: ctx.actorName,
        taskTitle: ctx.taskTitle,
        taskUrl,
        unsubscribeUrl,
      })
    case NotificationType.COMMENT_ADDED:
      return React.createElement(CommentNotificationEmail, {
        userName: recipient.name,
        actorName: ctx.actorName,
        taskTitle: ctx.taskTitle,
        taskUrl,
        isMention: false,
        unsubscribeUrl,
      })
    case NotificationType.MENTION:
      return React.createElement(CommentNotificationEmail, {
        userName: recipient.name,
        actorName: ctx.actorName,
        taskTitle: ctx.taskTitle,
        taskUrl,
        isMention: true,
        unsubscribeUrl,
      })
    case NotificationType.STATUS_CHANGED:
      return React.createElement(StatusChangedNotificationEmail, {
        userName: recipient.name,
        actorName: ctx.actorName,
        taskTitle: ctx.taskTitle,
        newStatus: extra?.newColumnName ?? '',
        taskUrl,
        unsubscribeUrl,
      })
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Core notification creation
// ---------------------------------------------------------------------------

/**
 * Creates task notifications for the appropriate recipients.
 *
 * Handles:
 * - Recipient resolution per notification type
 * - Self-exclusion (actor does not receive their own notifications)
 * - 24-hour deduplication
 * - Preference checking for in-app notifications
 * - Email sending with preference checks
 *
 * @param type - The notification type to create
 * @param ctx - Task context (taskId, workspaceId, actorUserId, taskTitle, actorName)
 * @param extra - Additional context (newColumnName, mentionedUserIds, emailTemplate)
 */
export async function createTaskNotification(
  type: NotificationType,
  ctx: TaskNotificationContext,
  extra?: {
    newColumnName?: string
    mentionedUserIds?: string[]
    emailTemplate?: React.ReactElement
  }
): Promise<TaskNotificationStats> {
  const stats: TaskNotificationStats = {
    created: 0,
    skippedByPreference: 0,
    skippedByDedup: 0,
  }

  const recipients = await resolveTaskRecipients(
    type,
    ctx.taskId,
    ctx.workspaceId,
    extra?.mentionedUserIds
  )

  if (recipients.length === 0) return stats

  const textExtra: Record<string, string | number> = {}
  if (extra?.newColumnName) textExtra.newColumnName = extra.newColumnName

  const { title, body } = buildNotificationText(type, {
    ...ctx,
    ...textExtra,
  })

  const prefField = NOTIFICATION_TYPE_TO_PREFERENCE[type]

  for (const recipient of recipients) {
    // Self-exclusion: actor does not receive their own notifications
    if (recipient.userId === ctx.actorUserId) continue

    // Preference check for in-app notification
    if (prefField) {
      const pref = await prisma.notificationPreference.findUnique({
        where: {
          user_id_workspace_id: {
            user_id: recipient.userId,
            workspace_id: ctx.workspaceId,
          },
        },
      })
      if (pref && pref[prefField] === false) {
        stats.skippedByPreference++
        continue
      }
    }

    // Deduplication: skip if same notification sent within 24 hours
    if (await isDuplicate(recipient.userId, ctx.taskId, type)) {
      stats.skippedByDedup++
      continue
    }

    // Create in-app notification
    await prisma.notification.create({
      data: {
        user_id: recipient.userId,
        workspace_id: ctx.workspaceId,
        type,
        title,
        body,
        entity_type: 'task',
        entity_id: ctx.taskId,
      },
    })

    stats.created++

    // Send email (non-blocking, preference check handled by sendEmail)
    const emailExtra: { newColumnName?: string } = {}
    if (extra?.newColumnName) emailExtra.newColumnName = extra.newColumnName
    const emailElement =
      extra?.emailTemplate ??
      buildEmailElement(type, ctx, recipient, emailExtra)
    if (emailElement) {
      sendEmail({
        to: recipient.email,
        subject: title,
        react: emailElement,
        from: 'notifications',
        notificationType: type,
        userId: recipient.userId,
        workspaceId: ctx.workspaceId,
      }).catch((error) => {
        console.log(
          JSON.stringify({
            level: 'error',
            message: 'Failed to send task notification email',
            action: 'createTaskNotification',
            type,
            taskId: ctx.taskId,
            recipientId: recipient.userId,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          })
        )
      })
    }
  }

  return stats
}
