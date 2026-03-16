'use server'

/**
 * Story 6.11: Notification Preferences Server Actions
 */

import { prisma } from '@/lib/prisma'
import { withWorkspace } from '@/lib/auth/workspace-context'
import { z } from 'zod'
import type { NotificationPreference } from '@prisma/client'

// ============================================================================
// Types
// ============================================================================

interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

// ============================================================================
// Schemas
// ============================================================================

const UpdatePreferencesSchema = z.object({
  email_enabled: z.boolean().optional(),
  task_assigned_enabled: z.boolean().optional(),
  task_due_soon_enabled: z.boolean().optional(),
  task_overdue_enabled: z.boolean().optional(),
  comment_added_enabled: z.boolean().optional(),
  mention_enabled: z.boolean().optional(),
  status_changed_enabled: z.boolean().optional(),
  weekly_digest_enabled: z.boolean().optional(),
  amendment_detected_enabled: z.boolean().optional(),
  law_repealed_enabled: z.boolean().optional(),
  ruling_cited_enabled: z.boolean().optional(),
  amendment_reminder_enabled: z.boolean().optional(),
})

export type UpdatePreferencesInput = z.infer<typeof UpdatePreferencesSchema>

// ============================================================================
// Actions
// ============================================================================

/**
 * Get current notification preferences for the user in the current workspace.
 * Creates default preferences (all enabled) if none exist.
 */
export async function getNotificationPreferences(): Promise<
  ActionResult<NotificationPreference>
> {
  try {
    return await withWorkspace(async ({ workspaceId, userId }) => {
      const existing = await prisma.notificationPreference.findUnique({
        where: {
          user_id_workspace_id: { user_id: userId, workspace_id: workspaceId },
        },
      })

      if (existing) {
        return { success: true, data: existing }
      }

      // Create default preferences
      const created = await prisma.notificationPreference.create({
        data: {
          user_id: userId,
          workspace_id: workspaceId,
        },
      })

      return { success: true, data: created }
    })
  } catch (error) {
    console.error('getNotificationPreferences error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Kunde inte hämta inställningar',
    }
  }
}

/**
 * Update notification preferences for the user in the current workspace.
 * Only updates the fields that are provided.
 */
export async function updateNotificationPreferences(
  input: UpdatePreferencesInput
): Promise<ActionResult<NotificationPreference>> {
  try {
    const validated = UpdatePreferencesSchema.parse(input)

    return await withWorkspace(async ({ workspaceId, userId }) => {
      // Strip undefined values to satisfy exactOptionalPropertyTypes
      const data: Record<string, boolean> = {}
      for (const [key, value] of Object.entries(validated)) {
        if (value !== undefined) {
          data[key] = value
        }
      }

      const updated = await prisma.notificationPreference.upsert({
        where: {
          user_id_workspace_id: { user_id: userId, workspace_id: workspaceId },
        },
        create: {
          user_id: userId,
          workspace_id: workspaceId,
          ...data,
        },
        update: data,
      })

      return { success: true, data: updated }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.issues[0]?.message ?? 'Ogiltiga inställningar',
      }
    }
    console.error('updateNotificationPreferences error:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Kunde inte uppdatera inställningar',
    }
  }
}
