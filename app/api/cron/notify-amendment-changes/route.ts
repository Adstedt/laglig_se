/**
 * Daily Amendment Email Digest Cron Job (Story 8.4)
 *
 * Runs daily at 07:00 UTC (08:00 CET / 09:00 CEST).
 * Finds un-notified ChangeEvents, sends lightweight digest emails per workspace
 * with deep-links to the Hem assessment flow, and creates in-app notifications.
 */

/* eslint-disable no-console */
import { NextResponse } from 'next/server'
import { startJobRun, completeJobRun, failJobRun } from '@/lib/admin/job-logger'
import {
  ChangeType,
  NotificationType,
  type SectionChangeType,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  changeTypeToNotificationType,
  processChangeEventNotifications,
} from '@/lib/notifications'
import { resolveAffectedRecipients } from '@/lib/notifications/recipient-resolution'
import { shouldSendEmail } from '@/lib/email/notification-preferences'
import { sendEmail, sendHtmlEmail } from '@/lib/email/email-service'
import { generateUnsubscribeUrl } from '@/lib/email/unsubscribe-token'
import {
  AmendmentDigestEmail,
  type DigestChange,
} from '@/emails/amendment-digest'
import React from 'react'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const CRON_SECRET = process.env.CRON_SECRET
const ADMIN_EMAIL = process.env.CRON_NOTIFICATION_EMAIL || 'admin@laglig.se'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://laglig.se'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CronStats {
  emailsSent: number
  emailsFailed: number
  amendmentsProcessed: number
  notificationsCreated: number
  duration: string
}

interface WorkspaceBatch {
  workspaceId: string
  workspaceName: string
  users: Array<{ userId: string; email: string; name: string | null }>
  changeEvents: Array<ChangeEventWithData>
}

interface ChangeEventWithData {
  id: string
  documentId: string
  changeType: ChangeType
  amendmentSfs: string | null
  lawTitle: string
  lawSlug: string
  aiSummary: string | null
  effectiveDate: string | null
  pdfUrl: string | null
  sectionChanges: Array<{ label: string; type: string }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function logInfo(message: string, data?: Record<string, unknown>): void {
  console.log(
    JSON.stringify({
      level: 'info',
      message,
      timestamp: new Date().toISOString(),
      action: 'notify-amendment-changes',
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
      action: 'notify-amendment-changes',
      ...data,
    })
  )
}

const CHANGE_TYPE_LABEL: Record<string, string> = {
  AMENDMENT: 'Ändrad',
  REPEAL: 'Upphävd',
  NEW_RULING: 'Nytt avgörande',
}

function formatSectionChange(sc: {
  chapter: string | null
  section: string
  change_type: SectionChangeType
}): { label: string; type: string } {
  const chapterPrefix = sc.chapter ? `${sc.chapter} kap. ` : ''
  const sectionLabel = `${chapterPrefix}${sc.section} §`
  const typeLabel: Record<string, string> = {
    AMENDED: 'ändrad',
    REPEALED: 'upphävd',
    NEW: 'ny',
    RENUMBERED: 'omnumrerad',
  }
  return {
    label: `${sectionLabel} — ${typeLabel[sc.change_type] ?? sc.change_type}`,
    type: sc.change_type,
  }
}

// ---------------------------------------------------------------------------
// Admin summary email
// ---------------------------------------------------------------------------

async function sendAdminSummary(
  stats: CronStats,
  success: boolean,
  error?: string
): Promise<void> {
  const statusEmoji = success ? '\u2705' : '\u274C'
  const subject = `${statusEmoji} Amendment Digest ${success ? 'Complete' : 'Failed'} - ${new Date().toLocaleDateString('sv-SE')}`

  const html = `
    <h2>Daily Amendment Digest Report</h2>
    <p><strong>Status:</strong> ${success ? 'Completed' : 'Failed'}</p>
    <p><strong>Duration:</strong> ${stats.duration}</p>
    <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>

    ${error ? `<p style="color: red;"><strong>Error:</strong> ${error}</p>` : ''}

    <h3>Statistics</h3>
    <table style="border-collapse: collapse; width: 100%; max-width: 400px;">
      <tr style="background: ${stats.emailsSent > 0 ? '#d4edda' : '#f8f9fa'};">
        <td style="padding: 8px; border: 1px solid #ddd;"><strong>Emails Sent</strong></td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${stats.emailsSent}</td>
      </tr>
      <tr style="background: ${stats.emailsFailed > 0 ? '#f8d7da' : '#f8f9fa'};">
        <td style="padding: 8px; border: 1px solid #ddd;">Emails Failed</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${stats.emailsFailed}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">Amendments Processed</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${stats.amendmentsProcessed}</td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">In-App Notifications</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${stats.notificationsCreated}</td>
      </tr>
    </table>

    <hr style="margin-top: 24px;">
    <p style="font-size: 12px; color: #999;">
      This is an automated notification from Laglig.se cron jobs.
    </p>
  `

  await sendHtmlEmail({ to: ADMIN_EMAIL, subject, html, from: 'cron' })
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const startTime = Date.now()

  // Auth check
  const authHeader = request.headers.get('authorization')
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const triggeredBy = request.headers.get('x-triggered-by') || 'cron'
  let runId: string | undefined

  try {
    runId = await startJobRun('notify-amendment-changes', triggeredBy)
  } catch {
    console.error('Failed to start job run logging')
  }

  const stats: CronStats = {
    emailsSent: 0,
    emailsFailed: 0,
    amendmentsProcessed: 0,
    notificationsCreated: 0,
    duration: '0s',
  }

  try {
    // -----------------------------------------------------------------------
    // Task 2: Query un-notified ChangeEvents
    // -----------------------------------------------------------------------
    const NOTIFIABLE_CHANGE_TYPES = [
      ChangeType.AMENDMENT,
      ChangeType.REPEAL,
      ChangeType.NEW_RULING,
    ]

    const changeEvents = await prisma.changeEvent.findMany({
      where: {
        notification_sent: false,
        change_type: { in: NOTIFIABLE_CHANGE_TYPES },
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            slug: true,
            document_number: true,
          },
        },
      },
      orderBy: { detected_at: 'asc' },
    })

    if (changeEvents.length === 0) {
      logInfo('No un-notified change events found')
      stats.duration = `${Math.round((Date.now() - startTime) / 1000)}s`
      await sendAdminSummary(stats, true)
      return NextResponse.json({ success: true, stats })
    }

    logInfo(`Found ${changeEvents.length} un-notified change events`)
    stats.amendmentsProcessed = changeEvents.length

    // -----------------------------------------------------------------------
    // Task 6: Create in-app Notification records BEFORE email delivery
    // -----------------------------------------------------------------------
    const changeEventIds = changeEvents.map((ce) => ce.id)
    try {
      const notifResult = await processChangeEventNotifications(changeEventIds)
      stats.notificationsCreated = notifResult.notificationsCreated
      logInfo('In-app notifications created', {
        created: notifResult.notificationsCreated,
        skippedByPreference: notifResult.skippedByPreference,
      })
    } catch (error) {
      logError('Failed to create in-app notifications', error)
    }

    // -----------------------------------------------------------------------
    // Task 3: Data enrichment per ChangeEvent (no LLM calls)
    // -----------------------------------------------------------------------
    const enrichedEvents: ChangeEventWithData[] = []

    for (const ce of changeEvents) {
      // Timeout check
      if (Date.now() - startTime > (maxDuration - 30) * 1000) {
        logInfo('Approaching timeout, stopping enrichment')
        break
      }

      let effectiveDate: string | null = null
      let pdfUrl: string | null = null
      const sectionChanges: Array<{ label: string; type: string }> = []

      if (ce.amendment_sfs) {
        // Look up AmendmentDocument for effective_date, PDF URL, section changes
        const sfsNumber = ce.amendment_sfs.replace('SFS ', '')
        const amendmentDoc = await prisma.amendmentDocument.findUnique({
          where: { sfs_number: sfsNumber },
          select: {
            effective_date: true,
            original_url: true,
            section_changes: {
              orderBy: { sort_order: 'asc' as const },
              select: {
                chapter: true,
                section: true,
                change_type: true,
              },
            },
          },
        })

        if (amendmentDoc) {
          effectiveDate = amendmentDoc.effective_date
            ? amendmentDoc.effective_date.toLocaleDateString('sv-SE')
            : null
          pdfUrl = amendmentDoc.original_url
          for (const sc of amendmentDoc.section_changes) {
            sectionChanges.push(formatSectionChange(sc))
          }
        }
      }

      enrichedEvents.push({
        id: ce.id,
        documentId: ce.document_id,
        changeType: ce.change_type,
        amendmentSfs: ce.amendment_sfs,
        lawTitle: ce.document.title,
        lawSlug: ce.document.slug,
        aiSummary: ce.ai_summary,
        effectiveDate,
        pdfUrl,
        sectionChanges,
      })
    }

    // -----------------------------------------------------------------------
    // Task 2 (cont): Group by document, then by workspace
    // -----------------------------------------------------------------------
    // Collect all unique document IDs
    const documentIds = [...new Set(enrichedEvents.map((e) => e.documentId))]

    // Resolve recipients per document → build workspace batches
    const workspaceBatches = new Map<string, WorkspaceBatch>()

    for (const docId of documentIds) {
      const recipients = await resolveAffectedRecipients(docId)
      const docEvents = enrichedEvents.filter((e) => e.documentId === docId)

      for (const recipient of recipients) {
        const existing = workspaceBatches.get(recipient.workspaceId)
        if (existing) {
          // Add user if not already present
          if (!existing.users.some((u) => u.userId === recipient.userId)) {
            existing.users.push({
              userId: recipient.userId,
              email: recipient.email,
              name: recipient.name,
            })
          }
          // Add change events not already present
          for (const ev of docEvents) {
            if (!existing.changeEvents.some((e) => e.id === ev.id)) {
              existing.changeEvents.push(ev)
            }
          }
        } else {
          workspaceBatches.set(recipient.workspaceId, {
            workspaceId: recipient.workspaceId,
            workspaceName: recipient.workspaceName,
            users: [
              {
                userId: recipient.userId,
                email: recipient.email,
                name: recipient.name,
              },
            ],
            changeEvents: [...docEvents],
          })
        }
      }
    }

    logInfo(`Grouped into ${workspaceBatches.size} workspace batches`)

    // -----------------------------------------------------------------------
    // Task 5: Send digest emails per workspace
    // -----------------------------------------------------------------------
    for (const [, batch] of workspaceBatches) {
      // Timeout check
      if (Date.now() - startTime > (maxDuration - 30) * 1000) {
        logInfo('Approaching timeout, stopping email delivery')
        break
      }

      try {
        // Build change cards
        const changes: DigestChange[] = batch.changeEvents.map((ev) => ({
          lawTitle: ev.lawTitle,
          changeType: CHANGE_TYPE_LABEL[ev.changeType] ?? ev.changeType,
          changeRef: ev.amendmentSfs,
          effectiveDate: ev.effectiveDate,
          aiSummary: ev.aiSummary,
          sectionChanges: ev.sectionChanges,
          lawUrl: `${APP_URL}/lagar/${ev.lawSlug}`,
          pdfUrl: ev.pdfUrl,
          assessUrl: `${APP_URL}/dashboard?changeId=${ev.id}`,
        }))

        // Determine notification type from the primary change
        const primaryType =
          changeTypeToNotificationType(batch.changeEvents[0]!.changeType) ??
          NotificationType.AMENDMENT_DETECTED

        let workspaceEmailsSent = 0

        for (const user of batch.users) {
          // Per-user preference check
          const canSend = await shouldSendEmail(
            user.userId,
            batch.workspaceId,
            primaryType
          )
          if (!canSend) continue

          const unsubscribeUrl = generateUnsubscribeUrl(
            user.userId,
            batch.workspaceId
          )

          const result = await sendEmail({
            to: user.email,
            subject: `Lagändringar: ${changes.length} ändring${changes.length !== 1 ? 'ar' : ''} i lagar du bevakar`,
            react: React.createElement(AmendmentDigestEmail, {
              userName: user.name,
              workspaceName: batch.workspaceName,
              changes,
              unsubscribeUrl,
            }),
            from: 'updates',
            notificationType: primaryType,
            userId: user.userId,
            workspaceId: batch.workspaceId,
          })

          if (result.success) {
            stats.emailsSent++
            workspaceEmailsSent++
          } else {
            if (!('skipped' in result && result.skipped)) {
              stats.emailsFailed++
            }
          }
        }

        // Mark ChangeEvents as notified if at least one email was sent
        if (workspaceEmailsSent > 0) {
          const eventIds = batch.changeEvents.map((e) => e.id)
          await prisma.changeEvent.updateMany({
            where: { id: { in: eventIds } },
            data: { notification_sent: true },
          })
        }
      } catch (error) {
        logError('Failed to process workspace batch', error, {
          workspaceId: batch.workspaceId,
          workspaceName: batch.workspaceName,
        })
        stats.emailsFailed++
      }
    }

    // -----------------------------------------------------------------------
    // Task 7: Admin summary
    // -----------------------------------------------------------------------
    stats.duration = `${Math.round((Date.now() - startTime) / 1000)}s`
    await sendAdminSummary(stats, true)

    if (runId) {
      await completeJobRun(runId, {
        itemsProcessed: stats.emailsSent,
        itemsFailed: stats.emailsFailed,
      })
    }

    logInfo('Cron completed', { stats })

    return NextResponse.json({
      success: true,
      stats,
      duration: stats.duration,
    })
  } catch (error) {
    stats.duration = `${Math.round((Date.now() - startTime) / 1000)}s`
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    logError('Cron failed', error)

    if (runId) {
      await failJobRun(
        runId,
        error instanceof Error ? error : new Error(String(error))
      )
    }

    await sendAdminSummary(stats, false, errorMessage)

    return NextResponse.json(
      { success: false, error: errorMessage, stats },
      { status: 500 }
    )
  }
}
