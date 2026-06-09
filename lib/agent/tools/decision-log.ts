/**
 * Story 19.5: AgentDecisionLog wrapper.
 *
 * `wrapWithDecisionLog` wraps any tool's `execute` so every invocation writes one
 * `AgentDecisionLog` row — reads, write proposals, and failures alike. Complements
 * `PendingAgentAction` (proposal lifecycle) by recording the full call envelope.
 *
 * Fail-safe (AC 10): the log write is isolated in its own try/catch and logged as
 * `[AGENT_DECISION_LOG_WRITE_FAIL]` — it NEVER re-throws and NEVER alters the tool's
 * return value (mirrors the ChatUsageEvent fail-safe in app/api/chat/route.ts).
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export interface DecisionLogContext {
  workspaceId: string
  userId: string
  /** null outside a chat turn (future cron/CLI tools). */
  chatMessageId?: string | null
  /** Resolved model name, e.g. "claude-sonnet-4-6" (NOT the AI_CHAT_MODEL provider string). */
  modelVersion: string
}

function isRecord(r: unknown): r is Record<string, unknown> {
  return typeof r === 'object' && r !== null
}

/** A tool returned a `wrapToolError` envelope. */
function isToolError(r: unknown): boolean {
  return isRecord(r) && r.error === true
}

/** A write tool returned a Tier-2 proposal envelope (wrapWriteToolResponse). */
function isProposal(r: unknown): boolean {
  return isRecord(r) && r.confirmation_required === true
}

/** Read `output.data.pendingActionId` — the precise approve/reject match key (SF-1). */
function extractPendingActionId(r: unknown): string | null {
  if (!isRecord(r) || !isRecord(r.data)) return null
  const id = (r.data as { pendingActionId?: unknown }).pendingActionId
  return typeof id === 'string' ? id : null
}

type ToolExecute<TInput, TOutput> = (
  _input: TInput,
  _opts?: unknown
) => Promise<TOutput>

export function wrapWithDecisionLog<TInput, TOutput>(
  toolName: string,
  execute: ToolExecute<TInput, TOutput>,
  ctx: DecisionLogContext
): ToolExecute<TInput, TOutput> {
  return async (input: TInput, opts?: unknown): Promise<TOutput> => {
    const proposedAt = new Date()
    let result: TOutput | undefined
    let threw = false
    try {
      result = await execute(input, opts)
      return result
    } catch (err) {
      threw = true
      throw err
    } finally {
      // Fail-safe: a logging error must never break the tool call or its return.
      try {
        let outcome: 'SUCCESS' | 'WRITE_PROPOSED' | 'ERROR' = 'SUCCESS'
        let output: unknown = null
        let pendingActionId: string | null = null

        if (threw) {
          outcome = 'ERROR'
        } else if (isToolError(result)) {
          outcome = 'ERROR'
          output = result
        } else if (isProposal(result)) {
          outcome = 'WRITE_PROPOSED'
          output = result
          pendingActionId = extractPendingActionId(result)
        } else {
          outcome = 'SUCCESS'
          output = result
        }

        await prisma.agentDecisionLog.create({
          data: {
            workspace_id: ctx.workspaceId,
            user_id: ctx.userId,
            chat_message_id: ctx.chatMessageId ?? null,
            pending_action_id: pendingActionId,
            tool_name: toolName,
            input_json: (input ?? {}) as Prisma.InputJsonValue,
            output_json:
              output === null
                ? Prisma.JsonNull
                : (output as Prisma.InputJsonValue),
            proposed_at: proposedAt,
            outcome,
            model_version: ctx.modelVersion,
          },
        })
      } catch (logErr) {
        console.error('[AGENT_DECISION_LOG_WRITE_FAIL]', logErr)
      }
    }
  }
}
