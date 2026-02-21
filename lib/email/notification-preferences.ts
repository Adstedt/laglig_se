import { prisma } from '@/lib/prisma'
import { NotificationType, type NotificationPreference } from '@prisma/client'

/**
 * Maps NotificationType enum values to their corresponding
 * boolean field on the NotificationPreference model.
 *
 * Types NOT in this map (e.g., email verification, workspace
 * invitations) are treated as transactional and always send.
 */
export const NOTIFICATION_TYPE_TO_PREFERENCE: Partial<
  Record<NotificationType, keyof NotificationPreference>
> = {
  [NotificationType.TASK_ASSIGNED]: 'task_assigned_enabled',
  [NotificationType.TASK_DUE_SOON]: 'task_due_soon_enabled',
  [NotificationType.TASK_OVERDUE]: 'task_overdue_enabled',
  [NotificationType.COMMENT_ADDED]: 'comment_added_enabled',
  [NotificationType.MENTION]: 'mention_enabled',
  [NotificationType.STATUS_CHANGED]: 'status_changed_enabled',
  [NotificationType.WEEKLY_DIGEST]: 'weekly_digest_enabled',

  // Epic 8: Change monitoring notification types
  [NotificationType.AMENDMENT_DETECTED]: 'amendment_detected_enabled',
  [NotificationType.LAW_REPEALED]: 'law_repealed_enabled',
  [NotificationType.RULING_CITED]: 'ruling_cited_enabled',
  [NotificationType.AMENDMENT_REMINDER]: 'amendment_reminder_enabled',
}

/**
 * Get a user's email preferences for a workspace.
 * Creates default preferences (all enabled) if none exist.
 */
export async function getEmailPreference(
  userId: string,
  workspaceId: string
): Promise<NotificationPreference> {
  const existing = await prisma.notificationPreference.findUnique({
    where: {
      user_id_workspace_id: { user_id: userId, workspace_id: workspaceId },
    },
  })

  if (existing) return existing

  return prisma.notificationPreference.create({
    data: {
      user_id: userId,
      workspace_id: workspaceId,
    },
  })
}

/**
 * Check whether an email should be sent for a given notification type.
 *
 * Returns false if:
 * - Global email_enabled is false (kill switch)
 * - The per-type preference flag is false
 *
 * Returns true if:
 * - The notification type is not in the preference map (transactional — always sends)
 * - Both global and per-type flags are true
 */
export async function shouldSendEmail(
  userId: string,
  workspaceId: string,
  notificationType: NotificationType
): Promise<boolean> {
  const pref = await getEmailPreference(userId, workspaceId)

  // Global kill switch
  if (!pref.email_enabled) return false

  // Check per-type preference
  const prefField = NOTIFICATION_TYPE_TO_PREFERENCE[notificationType]

  // Unmapped types are transactional — always send
  if (!prefField) return true

  return pref[prefField] === true
}
