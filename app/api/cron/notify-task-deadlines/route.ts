/**
 * Daily Task Deadline Notifications Cron Job (Story 6.11)
 *
 * Runs daily at 07:00 UTC (08:00 CET).
 * - TASK_DUE_SOON: Tasks due within 3 days
 * - TASK_OVERDUE: Tasks past due date
 * - Retention cleanup: Deletes notifications older than 30 days
 */

/* eslint-disable no-console */
import { NextResponse } from 'next/server'
import { NotificationType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { shouldSendEmail } from '@/lib/email/notification-preferences'
import { sendEmail, sendHtmlEmail } from '@/lib/email/email-service'
import { generateUnsubscribeUrl } from '@/lib/email/unsubscribe-token'
import { TaskDueReminderEmail } from '@/emails/task-due-reminder'
import { TaskOverdueEmail } from '@/emails/task-overdue'
import React from 'react'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Read env vars at runtime (not module load) for testability
function getCronSecret() {
  return process.env.CRON_SECRET
}
const ADMIN_EMAIL = process.env.CRON_NOTIFICATION_EMAIL || 'admin@laglig.se'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://laglig.se'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function logInfo(message: string, data?: Record<string, unknown>): void {
  console.log(
    JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      action: 'notify-task-deadlines',
      ...data,
    })
  )
}

function logError(
  message: string,
  error: unknown,
  data?: Record<string, unknown>
): void {
  const err =
    error instanceof Error
      ? { name: error.name, message: error.message }
      : { message: String(error) }
  console.error(
    JSON.stringify({
      level: 'error',
      message,
      error: err,
      timestamp: new Date().toISOString(),
      action: 'notify-task-deadlines',
      ...data,
    })
  )
}

async function isDuplicateNotification(
  userId: string,
  taskId: string,
  type: NotificationType
): Promise<boolean> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const existing = await prisma.notification.findFirst({
    where: {
      user_id: userId,
      entity_id: taskId,
      type,
      created_at: { gte: twentyFourHoursAgo },
    },
    select: { id: true },
  })
  return existing !== null
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const startTime = Date.now()

  // Auth check
  const cronSecret = getCronSecret()
  const authHeader = request.headers.get('authorization')
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const stats = {
    dueSoonCreated: 0,
    overdueCreated: 0,
    skippedByDedup: 0,
    skippedByPreference: 0,
    emailsSent: 0,
    emailsFailed: 0,
    cleanedUp: 0,
    duration: '0s',
  }

  try {
    const now = new Date()
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

    // -----------------------------------------------------------------
    // 1. TASK_DUE_SOON: Tasks due within 3 days, not completed
    // -----------------------------------------------------------------
    const dueSoonTasks = await prisma.task.findMany({
      where: {
        due_date: {
          gte: now,
          lte: threeDaysFromNow,
        },
        completed_at: null,
        assignee_id: { not: null },
      },
      select: {
        id: true,
        title: true,
        due_date: true,
        workspace_id: true,
        assignee_id: true,
        assignee: { select: { id: true, email: true, name: true } },
      },
    })

    logInfo(`Found ${dueSoonTasks.length} tasks due soon`)

    for (const task of dueSoonTasks) {
      if (Date.now() - startTime > (maxDuration - 30) * 1000) {
        logInfo('Approaching timeout, stopping due-soon processing')
        break
      }

      if (!task.assignee) continue

      // Dedup check
      if (
        await isDuplicateNotification(
          task.assignee.id,
          task.id,
          NotificationType.TASK_DUE_SOON
        )
      ) {
        stats.skippedByDedup++
        continue
      }

      // Preference check
      const pref = await prisma.notificationPreference.findUnique({
        where: {
          user_id_workspace_id: {
            user_id: task.assignee.id,
            workspace_id: task.workspace_id,
          },
        },
      })
      if (pref && pref.task_due_soon_enabled === false) {
        stats.skippedByPreference++
        continue
      }

      const daysLeft = Math.max(
        1,
        Math.ceil(
          (task.due_date!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
        )
      )

      await prisma.notification.create({
        data: {
          user_id: task.assignee.id,
          workspace_id: task.workspace_id,
          type: NotificationType.TASK_DUE_SOON,
          title: 'Uppgift förfaller snart',
          body: `Uppgiften "${task.title}" förfaller om ${daysLeft} dagar`,
          entity_type: 'task',
          entity_id: task.id,
        },
      })
      stats.dueSoonCreated++

      // Send email
      const canSend = await shouldSendEmail(
        task.assignee.id,
        task.workspace_id,
        NotificationType.TASK_DUE_SOON
      )
      if (canSend) {
        const unsubscribeUrl = generateUnsubscribeUrl(
          task.assignee.id,
          task.workspace_id
        )
        const result = await sendEmail({
          to: task.assignee.email,
          subject: 'Uppgift förfaller snart',
          react: React.createElement(TaskDueReminderEmail, {
            userName: task.assignee.name,
            taskTitle: task.title,
            daysLeft,
            dueDate: task.due_date!.toLocaleDateString('sv-SE'),
            taskUrl: `${APP_URL}/tasks?task=${task.id}`,
            unsubscribeUrl,
          }),
          from: 'notifications',
          notificationType: NotificationType.TASK_DUE_SOON,
          userId: task.assignee.id,
          workspaceId: task.workspace_id,
        })
        if (result.success) {
          stats.emailsSent++
        } else if (!('skipped' in result && result.skipped)) {
          stats.emailsFailed++
        }
      }
    }

    // -----------------------------------------------------------------
    // 2. TASK_OVERDUE: Tasks past due date, not completed
    // -----------------------------------------------------------------
    const overdueTasks = await prisma.task.findMany({
      where: {
        due_date: { lt: now },
        completed_at: null,
        assignee_id: { not: null },
      },
      select: {
        id: true,
        title: true,
        due_date: true,
        workspace_id: true,
        assignee_id: true,
        assignee: { select: { id: true, email: true, name: true } },
      },
    })

    logInfo(`Found ${overdueTasks.length} overdue tasks`)

    for (const task of overdueTasks) {
      if (Date.now() - startTime > (maxDuration - 30) * 1000) {
        logInfo('Approaching timeout, stopping overdue processing')
        break
      }

      if (!task.assignee) continue

      // Dedup check
      if (
        await isDuplicateNotification(
          task.assignee.id,
          task.id,
          NotificationType.TASK_OVERDUE
        )
      ) {
        stats.skippedByDedup++
        continue
      }

      // Preference check
      const pref = await prisma.notificationPreference.findUnique({
        where: {
          user_id_workspace_id: {
            user_id: task.assignee.id,
            workspace_id: task.workspace_id,
          },
        },
      })
      if (pref && pref.task_overdue_enabled === false) {
        stats.skippedByPreference++
        continue
      }

      const overdueDays = Math.max(
        1,
        Math.ceil(
          (now.getTime() - task.due_date!.getTime()) / (24 * 60 * 60 * 1000)
        )
      )

      await prisma.notification.create({
        data: {
          user_id: task.assignee.id,
          workspace_id: task.workspace_id,
          type: NotificationType.TASK_OVERDUE,
          title: 'Förfallen uppgift',
          body: `Uppgiften "${task.title}" är förfallen sedan ${overdueDays} dagar`,
          entity_type: 'task',
          entity_id: task.id,
        },
      })
      stats.overdueCreated++

      // Send email
      const canSend = await shouldSendEmail(
        task.assignee.id,
        task.workspace_id,
        NotificationType.TASK_OVERDUE
      )
      if (canSend) {
        const unsubscribeUrl = generateUnsubscribeUrl(
          task.assignee.id,
          task.workspace_id
        )
        const result = await sendEmail({
          to: task.assignee.email,
          subject: 'Uppgift är förfallen',
          react: React.createElement(TaskOverdueEmail, {
            userName: task.assignee.name,
            taskTitle: task.title,
            overdueDays,
            dueDate: task.due_date!.toLocaleDateString('sv-SE'),
            taskUrl: `${APP_URL}/tasks?task=${task.id}`,
            unsubscribeUrl,
          }),
          from: 'notifications',
          notificationType: NotificationType.TASK_OVERDUE,
          userId: task.assignee.id,
          workspaceId: task.workspace_id,
        })
        if (result.success) {
          stats.emailsSent++
        } else if (!('skipped' in result && result.skipped)) {
          stats.emailsFailed++
        }
      }
    }

    // -----------------------------------------------------------------
    // 3. Retention cleanup: Delete notifications older than 30 days
    // -----------------------------------------------------------------
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const deleted = await prisma.notification.deleteMany({
      where: { created_at: { lt: thirtyDaysAgo } },
    })
    stats.cleanedUp = deleted.count
    if (deleted.count > 0) {
      logInfo(`Cleaned up ${deleted.count} old notifications`)
    }

    // -----------------------------------------------------------------
    // 4. Complete
    // -----------------------------------------------------------------
    stats.duration = `${Math.round((Date.now() - startTime) / 1000)}s`

    // Admin summary
    const subject = `\u2705 Task Deadlines Cron Complete - ${now.toLocaleDateString('sv-SE')}`
    const html = `
      <h2>Task Deadline Notifications Report</h2>
      <p><strong>Duration:</strong> ${stats.duration}</p>
      <ul>
        <li>Due-soon notifications: ${stats.dueSoonCreated}</li>
        <li>Overdue notifications: ${stats.overdueCreated}</li>
        <li>Skipped (dedup): ${stats.skippedByDedup}</li>
        <li>Skipped (preference): ${stats.skippedByPreference}</li>
        <li>Emails sent: ${stats.emailsSent}</li>
        <li>Emails failed: ${stats.emailsFailed}</li>
        <li>Old notifications cleaned: ${stats.cleanedUp}</li>
      </ul>
    `
    await sendHtmlEmail({ to: ADMIN_EMAIL, subject, html, from: 'cron' })

    logInfo('Cron completed', { stats })
    return NextResponse.json({ success: true, stats })
  } catch (error) {
    stats.duration = `${Math.round((Date.now() - startTime) / 1000)}s`
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    logError('Cron failed', error)

    const subject = `\u274C Task Deadlines Cron Failed - ${new Date().toLocaleDateString('sv-SE')}`
    const html = `<h2>Task Deadline Notifications Failed</h2><p>${errorMessage}</p>`
    await sendHtmlEmail({ to: ADMIN_EMAIL, subject, html, from: 'cron' })

    return NextResponse.json(
      { success: false, error: errorMessage, stats },
      { status: 500 }
    )
  }
}
