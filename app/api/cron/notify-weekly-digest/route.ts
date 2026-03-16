/**
 * Weekly Task Digest Cron Job (Story 6.11)
 *
 * Runs Sunday at 16:00 UTC (18:00 CET).
 * Sends a weekly summary of upcoming tasks per user.
 */

/* eslint-disable no-console */
import { NextResponse } from 'next/server'
import { NotificationType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { shouldSendEmail } from '@/lib/email/notification-preferences'
import { sendEmail, sendHtmlEmail } from '@/lib/email/email-service'
import { generateUnsubscribeUrl } from '@/lib/email/unsubscribe-token'
import {
  WeeklyTaskDigestEmail,
  type DigestTask,
} from '@/emails/weekly-task-digest'
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
      action: 'notify-weekly-digest',
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
      action: 'notify-weekly-digest',
      ...data,
    })
  )
}

const PRIORITY_LABEL: Record<string, string> = {
  LOW: 'Låg',
  MEDIUM: 'Medium',
  HIGH: 'Hög',
  CRITICAL: 'Kritisk',
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
    usersProcessed: 0,
    notificationsCreated: 0,
    emailsSent: 0,
    emailsFailed: 0,
    skippedByPreference: 0,
    duration: '0s',
  }

  try {
    // Calculate this week: Monday through Sunday
    const now = new Date()
    const dayOfWeek = now.getUTCDay() // 0=Sun, 1=Mon...
    const monday = new Date(now)
    monday.setUTCDate(
      now.getUTCDate() + (dayOfWeek === 0 ? 1 : 1 + ((7 - dayOfWeek) % 7))
    )
    monday.setUTCHours(0, 0, 0, 0)
    const sunday = new Date(monday)
    sunday.setUTCDate(monday.getUTCDate() + 6)
    sunday.setUTCHours(23, 59, 59, 999)

    // Find all tasks with due dates in the coming week, grouped by assignee
    const tasks = await prisma.task.findMany({
      where: {
        due_date: {
          gte: monday,
          lte: sunday,
        },
        completed_at: null,
        assignee_id: { not: null },
      },
      select: {
        id: true,
        title: true,
        due_date: true,
        priority: true,
        workspace_id: true,
        assignee_id: true,
        assignee: { select: { id: true, email: true, name: true } },
      },
      orderBy: { due_date: 'asc' },
    })

    logInfo(`Found ${tasks.length} tasks due this week`)

    // Group by user+workspace
    const userTaskMap = new Map<
      string,
      {
        userId: string
        email: string
        name: string | null
        workspaceId: string
        tasks: typeof tasks
      }
    >()

    for (const task of tasks) {
      if (!task.assignee) continue
      const key = `${task.assignee.id}:${task.workspace_id}`
      const existing = userTaskMap.get(key)
      if (existing) {
        existing.tasks.push(task)
      } else {
        userTaskMap.set(key, {
          userId: task.assignee.id,
          email: task.assignee.email,
          name: task.assignee.name,
          workspaceId: task.workspace_id,
          tasks: [task],
        })
      }
    }

    logInfo(`Processing ${userTaskMap.size} user-workspace combinations`)

    for (const [, userBatch] of userTaskMap) {
      if (Date.now() - startTime > (maxDuration - 30) * 1000) {
        logInfo('Approaching timeout, stopping digest processing')
        break
      }

      stats.usersProcessed++

      // Check weekly_digest_enabled preference
      const pref = await prisma.notificationPreference.findUnique({
        where: {
          user_id_workspace_id: {
            user_id: userBatch.userId,
            workspace_id: userBatch.workspaceId,
          },
        },
      })
      if (pref && pref.weekly_digest_enabled === false) {
        stats.skippedByPreference++
        continue
      }

      // Create in-app notification
      await prisma.notification.create({
        data: {
          user_id: userBatch.userId,
          workspace_id: userBatch.workspaceId,
          type: NotificationType.WEEKLY_DIGEST,
          title: 'Veckans uppgifter',
          body: `Du har ${userBatch.tasks.length} uppgifter att slutföra denna vecka`,
          entity_type: 'task',
          entity_id: null,
        },
      })
      stats.notificationsCreated++

      // Send email
      const canSend = await shouldSendEmail(
        userBatch.userId,
        userBatch.workspaceId,
        NotificationType.WEEKLY_DIGEST
      )
      if (!canSend) continue

      const unsubscribeUrl = generateUnsubscribeUrl(
        userBatch.userId,
        userBatch.workspaceId
      )

      const digestTasks: DigestTask[] = userBatch.tasks.map((t) => ({
        title: t.title,
        dueDate: t.due_date?.toLocaleDateString('sv-SE') ?? null,
        priority: PRIORITY_LABEL[t.priority] ?? t.priority,
        taskUrl: `${APP_URL}/tasks?task=${t.id}`,
      }))

      const weekLabel = `vecka ${getISOWeek(monday)}`

      const result = await sendEmail({
        to: userBatch.email,
        subject: 'Dina uppgifter denna vecka',
        react: React.createElement(WeeklyTaskDigestEmail, {
          userName: userBatch.name,
          tasks: digestTasks,
          weekLabel,
          unsubscribeUrl,
        }),
        from: 'notifications',
        notificationType: NotificationType.WEEKLY_DIGEST,
        userId: userBatch.userId,
        workspaceId: userBatch.workspaceId,
      })

      if (result.success) {
        stats.emailsSent++
      } else if (!('skipped' in result && result.skipped)) {
        stats.emailsFailed++
      }
    }

    // Complete
    stats.duration = `${Math.round((Date.now() - startTime) / 1000)}s`

    const subject = `\u2705 Weekly Digest Cron Complete - ${now.toLocaleDateString('sv-SE')}`
    const html = `
      <h2>Weekly Task Digest Report</h2>
      <p><strong>Duration:</strong> ${stats.duration}</p>
      <ul>
        <li>Users processed: ${stats.usersProcessed}</li>
        <li>Notifications created: ${stats.notificationsCreated}</li>
        <li>Emails sent: ${stats.emailsSent}</li>
        <li>Emails failed: ${stats.emailsFailed}</li>
        <li>Skipped (preference): ${stats.skippedByPreference}</li>
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

    const subject = `\u274C Weekly Digest Cron Failed - ${new Date().toLocaleDateString('sv-SE')}`
    const html = `<h2>Weekly Task Digest Failed</h2><p>${errorMessage}</p>`
    await sendHtmlEmail({ to: ADMIN_EMAIL, subject, html, from: 'cron' })

    return NextResponse.json(
      { success: false, error: errorMessage, stats },
      { status: 500 }
    )
  }
}

/**
 * Returns ISO week number for a date.
 */
function getISOWeek(date: Date): number {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  )
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}
