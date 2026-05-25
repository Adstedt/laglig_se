/**
 * Shared pending-action helper for agent write tools.
 * Story 14.23: every write tool persists its proposal as a PendingAgentAction
 * row (the inline approval card) on the propose path. The `execute: true`
 * direct-write branch is removed (AC 4) — inline approval is the only
 * finalization path. This helper centralises the row-creation + non-fatal
 * error handling that 14.22's create_task established inline.
 */

import { prisma } from '@/lib/prisma'
import type { PendingAgentActionType, Prisma } from '@prisma/client'

/**
 * Per-turn context threaded from the chat route into write tools.
 * `assistantMessageId` is the preallocated id of the stub assistant ChatMessage
 * written before the tool loop (ADR-14.22-A) — it is the `chat_message_id` FK
 * target. Without it we cannot persist a row, so the tool falls back to a plain
 * proposal envelope.
 */
export interface PendingActionToolContext {
  userId: string
  assistantMessageId?: string
  contextType?: 'GLOBAL' | 'TASK' | 'LAW' | 'CHANGE'
  contextId?: string | null
  conversationId?: string | null
  /** Story 19.4a: active LawListItem id — law-item write tools default to this
   *  when their `lawListItemId` arg is omitted. */
  lawListItemId?: string | undefined
}

/**
 * Create a PENDING row for an agent proposal. Returns the row id, or `undefined`
 * if no `assistantMessageId` is available or the insert fails (non-fatal — the
 * caller still returns a proposal envelope). expires_at is application-set to
 * now()+7d (no DB default for now()+interval).
 */
export async function createPendingActionRow(
  workspaceId: string,
  context: PendingActionToolContext | undefined,
  actionType: PendingAgentActionType,
  params: Record<string, unknown>
): Promise<string | undefined> {
  if (!context?.assistantMessageId) return undefined
  try {
    const row = await prisma.pendingAgentAction.create({
      data: {
        workspace_id: workspaceId,
        user_id: context.userId,
        chat_message_id: context.assistantMessageId,
        conversation_id: context.conversationId ?? null,
        context_type: context.contextType ?? 'GLOBAL',
        context_id: context.contextId ?? null,
        action_type: actionType,
        status: 'PENDING',
        params: params as Prisma.InputJsonObject,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      select: { id: true },
    })
    return row.id
  } catch (err) {
    console.error(`[${actionType}] pending row creation failed`, err)
    return undefined
  }
}
