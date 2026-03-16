/**
 * Story 6.10: Shared activity logging utility
 * Used by task-modal.ts and legal-document-modal.ts server actions
 */

import { prisma } from '@/lib/prisma'

export async function logActivity(
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
