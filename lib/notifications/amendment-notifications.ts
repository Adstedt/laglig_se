import { ChangeType, NotificationType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { NOTIFICATION_TYPE_TO_PREFERENCE } from '@/lib/email/notification-preferences'
import { resolveAffectedRecipients } from './recipient-resolution'

export interface NotificationStats {
  notificationsCreated: number
  usersNotified: number
  workspacesAffected: number
  skippedByPreference: number
}

/**
 * Map a ChangeType to the corresponding NotificationType.
 * Returns null for change types that should not generate user notifications.
 */
export function changeTypeToNotificationType(
  changeType: ChangeType
): NotificationType | null {
  switch (changeType) {
    case ChangeType.AMENDMENT:
      return NotificationType.AMENDMENT_DETECTED
    case ChangeType.REPEAL:
      return NotificationType.LAW_REPEALED
    case ChangeType.NEW_RULING:
      return NotificationType.RULING_CITED
    case ChangeType.NEW_LAW:
      return null
    case ChangeType.METADATA_UPDATE:
      return null
  }
}

/**
 * Build notification body text based on change type.
 */
export function notificationBodyForChangeType(
  changeType: ChangeType,
  ref: string | null,
  aiSummary: string | null
): string {
  const snippet = aiSummary ? aiSummary.slice(0, 150) : ''
  const refStr = ref ?? 'okänd'

  switch (changeType) {
    case ChangeType.AMENDMENT:
      return snippet
        ? `Ändrad genom ${refStr}. ${snippet}`
        : `Ändrad genom ${refStr}`
    case ChangeType.REPEAL:
      return snippet
        ? `Upphävd genom ${refStr}. ${snippet}`
        : `Upphävd genom ${refStr}`
    case ChangeType.NEW_RULING:
      return snippet || 'Nytt avgörande'
    default:
      return snippet || 'Uppdaterad'
  }
}

/**
 * Creates Notification records for all users affected by a ChangeEvent.
 *
 * Handles all change types: AMENDMENT, REPEAL, NEW_RULING.
 * Returns early with zero stats for NEW_LAW and METADATA_UPDATE (no user notification).
 *
 * Does NOT set ChangeEvent.notification_sent — that is Story 8.4's
 * responsibility after email delivery.
 *
 * Idempotent: checks for existing notification before creating.
 * Note: No unique DB constraint on [user_id, workspace_id, entity_type, entity_id].
 * Application-level guard is acceptable for single-cron usage. Consider adding a
 * composite index for scale.
 */
export async function createChangeNotifications(
  changeEventId: string
): Promise<NotificationStats> {
  const stats: NotificationStats = {
    notificationsCreated: 0,
    usersNotified: 0,
    workspacesAffected: 0,
    skippedByPreference: 0,
  }

  const changeEvent = await prisma.changeEvent.findUnique({
    where: { id: changeEventId },
    include: {
      document: { select: { id: true, title: true } },
    },
  })

  if (!changeEvent) {
    console.log(
      JSON.stringify({
        level: 'warn',
        message: 'ChangeEvent not found',
        action: 'createChangeNotifications',
        changeEventId,
        timestamp: new Date().toISOString(),
      })
    )
    return stats
  }

  // Map change type to notification type; return early if no notification needed
  const notificationType = changeTypeToNotificationType(changeEvent.change_type)
  if (!notificationType) return stats

  const title = changeEvent.document.title
  const body = notificationBodyForChangeType(
    changeEvent.change_type,
    changeEvent.amendment_sfs,
    changeEvent.ai_summary
  )

  const recipients = await resolveAffectedRecipients(changeEvent.document_id)

  if (recipients.length === 0) return stats

  const notifiedUserIds = new Set<string>()
  const affectedWorkspaceIds = new Set<string>()

  // Look up which preference field to check for this notification type
  const prefField = NOTIFICATION_TYPE_TO_PREFERENCE[notificationType]

  for (const recipient of recipients) {
    // Check user preference
    const pref = await prisma.notificationPreference.findUnique({
      where: {
        user_id_workspace_id: {
          user_id: recipient.userId,
          workspace_id: recipient.workspaceId,
        },
      },
    })

    // If preference exists and the relevant field is disabled, skip
    if (prefField && pref && pref[prefField] === false) {
      stats.skippedByPreference++
      continue
    }

    // Idempotency check
    const existing = await prisma.notification.findFirst({
      where: {
        user_id: recipient.userId,
        workspace_id: recipient.workspaceId,
        entity_type: 'change_event',
        entity_id: changeEventId,
      },
    })

    if (existing) continue

    await prisma.notification.create({
      data: {
        user_id: recipient.userId,
        workspace_id: recipient.workspaceId,
        type: notificationType,
        title,
        body,
        entity_type: 'change_event',
        entity_id: changeEventId,
      },
    })

    stats.notificationsCreated++
    notifiedUserIds.add(recipient.userId)
    affectedWorkspaceIds.add(recipient.workspaceId)
  }

  stats.usersNotified = notifiedUserIds.size
  stats.workspacesAffected = affectedWorkspaceIds.size

  return stats
}

/**
 * Batch-processes multiple ChangeEvents, creating notifications for each.
 * Errors on individual ChangeEvents are logged but do not block processing of others.
 */
export async function processChangeEventNotifications(
  changeEventIds: string[]
): Promise<NotificationStats> {
  const aggregated: NotificationStats = {
    notificationsCreated: 0,
    usersNotified: 0,
    workspacesAffected: 0,
    skippedByPreference: 0,
  }

  for (const id of changeEventIds) {
    try {
      const result = await createChangeNotifications(id)
      aggregated.notificationsCreated += result.notificationsCreated
      aggregated.usersNotified += result.usersNotified
      aggregated.workspacesAffected += result.workspacesAffected
      aggregated.skippedByPreference += result.skippedByPreference
    } catch (error) {
      console.log(
        JSON.stringify({
          level: 'error',
          message: 'Failed to process ChangeEvent notifications',
          action: 'processChangeEventNotifications',
          changeEventId: id,
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        })
      )
    }
  }

  return aggregated
}
