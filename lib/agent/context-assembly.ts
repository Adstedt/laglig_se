/**
 * Context Assembly
 * Story 14.8, Task 3 (AC: 14-18)
 *
 * Formats retrieved chunks into a token-budgeted, prompt-ready context block
 * with Swedish source labels, deduplication, and document-order preservation.
 */

import type { RetrievalResult } from '@/lib/agent/retrieval'
import { prisma } from '@/lib/prisma'
import type { PendingAgentAction } from '@prisma/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AssemblyOptions {
  maxTokens?: number
}

export interface AssemblyMetadata {
  sourcesUsed: Array<{
    sourceId: string
    sourceType: string
    documentNumber: string | null
    contextualHeader: string
  }>
  totalTokens: number
  chunksIncluded: number
  chunksExcluded: number
}

export interface AssembledContext {
  context: string
  metadata: AssemblyMetadata
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MAX_TOKENS = 8000

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

export function assembleAgentContext(
  chunks: RetrievalResult[],
  options: AssemblyOptions = {}
): AssembledContext {
  const { maxTokens = DEFAULT_MAX_TOKENS } = options

  if (chunks.length === 0) {
    return {
      context: '',
      metadata: {
        sourcesUsed: [],
        totalTokens: 0,
        chunksIncluded: 0,
        chunksExcluded: 0,
      },
    }
  }

  // Group chunks by source document (sourceId), preserving relevance order
  // across groups but sorting by path within each group
  const groups = new Map<string, RetrievalResult[]>()
  const groupOrder: string[] = []

  for (const chunk of chunks) {
    const key = chunk.sourceId
    if (!groups.has(key)) {
      groups.set(key, [])
      groupOrder.push(key)
    }
    groups.get(key)!.push(chunk)
  }

  // Sort chunks within each group by path (preserve document order)
  for (const group of groups.values()) {
    group.sort((a, b) => a.path.localeCompare(b.path))
  }

  // Flatten back, respecting group order (first-seen relevance) and path order within
  const ordered: RetrievalResult[] = []
  for (const key of groupOrder) {
    ordered.push(...groups.get(key)!)
  }

  // Token budget: include chunks until budget exhausted
  const included: RetrievalResult[] = []
  let totalTokens = 0

  for (const chunk of ordered) {
    if (totalTokens + chunk.tokenCount > maxTokens) {
      continue
    }
    included.push(chunk)
    totalTokens += chunk.tokenCount
  }

  // Format each chunk with Swedish source label
  const blocks = included.map((chunk) => {
    const label = formatSourceLabel(chunk)
    return `--- ${label} ---\n${chunk.content}`
  })

  const context = blocks.join('\n\n')

  // Build unique sources metadata
  const seenSources = new Set<string>()
  const sourcesUsed: AssemblyMetadata['sourcesUsed'] = []
  for (const chunk of included) {
    if (!seenSources.has(chunk.sourceId)) {
      seenSources.add(chunk.sourceId)
      sourcesUsed.push({
        sourceId: chunk.sourceId,
        sourceType: chunk.sourceType,
        documentNumber: chunk.documentNumber,
        contextualHeader: chunk.contextualHeader,
      })
    }
  }

  return {
    context,
    metadata: {
      sourcesUsed,
      totalTokens,
      chunksIncluded: included.length,
      chunksExcluded: chunks.length - included.length,
    },
  }
}

// ---------------------------------------------------------------------------
// Story 14.22: Agent feedback loop — pending-action context block
// ---------------------------------------------------------------------------

const PENDING_PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Låg',
  MEDIUM: 'Medel',
  HIGH: 'Hög',
  CRITICAL: 'Kritisk',
}

/** Short Swedish summary of a pending action, derived from action_type + params. */
function summarizePendingAction(action: PendingAgentAction): string {
  if (action.action_type === 'CREATE_TASK') {
    const p = (action.params ?? {}) as { title?: string; priority?: string }
    const label = PENDING_PRIORITY_LABELS[p.priority ?? 'MEDIUM'] ?? 'Medel'
    return `Skapa uppgift: "${p.title ?? ''}" (prioritet ${label})`
  }
  return action.action_type
}

/**
 * Build the `<pending_agent_actions>` system-prompt block (AC 24-27). Lists
 * still-pending proposals plus those approved/rejected since the previous
 * assistant message (the "since last turn" cutoff). Returns null when there is
 * nothing to report. Caps each bucket to the 5 most recent. Scoped by
 * workspace + user + conversation + chat context.
 */
export async function buildPendingActionsContext(params: {
  workspaceId: string
  userId: string
  conversationId?: string | null
  contextType: 'GLOBAL' | 'TASK' | 'LAW' | 'CHANGE'
  contextId?: string | null
}): Promise<string | null> {
  const {
    workspaceId,
    userId,
    conversationId = null,
    contextType,
    contextId = null,
  } = params

  // Cutoff = the previous turn's assistant message (content != '' excludes the
  // not-yet-filled stub for the current turn). Null on the first turn → the
  // completed/rejected "since last turn" buckets stay empty (AC 26).
  const lastAssistant = await prisma.chatMessage.findFirst({
    where: {
      workspace_id: workspaceId,
      user_id: userId,
      role: 'ASSISTANT',
      context_type: contextType,
      context_id: contextId,
      conversation_id: conversationId,
      content: { not: '' },
    },
    orderBy: { created_at: 'desc' },
    select: { created_at: true },
  })
  const cutoff = lastAssistant?.created_at ?? null

  const rows = await prisma.pendingAgentAction.findMany({
    where: {
      workspace_id: workspaceId,
      user_id: userId,
      conversation_id: conversationId,
      context_type: contextType,
      context_id: contextId,
    },
    orderBy: { created_at: 'desc' },
    take: 50,
  })

  const pending = rows.filter((r) => r.status === 'PENDING').slice(0, 5)
  const completed = cutoff
    ? rows
        .filter(
          (r) =>
            r.status === 'APPROVED' && r.decided_at && r.decided_at > cutoff
        )
        .slice(0, 5)
    : []
  const rejected = cutoff
    ? rows
        .filter(
          (r) =>
            r.status === 'REJECTED' && r.decided_at && r.decided_at > cutoff
        )
        .slice(0, 5)
    : []

  if (pending.length === 0 && completed.length === 0 && rejected.length === 0) {
    return null
  }

  const pendingJson = pending.map((r) => ({
    id: r.id,
    action_type: r.action_type,
    created_at: r.created_at.toISOString(),
    summary: summarizePendingAction(r),
  }))
  const completedJson = completed.map((r) => ({
    id: r.id,
    action_type: r.action_type,
    result_ref: r.result_ref,
    decided_at: r.decided_at?.toISOString() ?? null,
    summary: summarizePendingAction(r),
  }))
  const rejectedJson = rejected.map((r) => ({
    id: r.id,
    action_type: r.action_type,
    decided_at: r.decided_at?.toISOString() ?? null,
  }))

  return [
    '<pending_agent_actions>',
    `Väntar på beslut: ${JSON.stringify(pendingJson)}`,
    `Godkända sedan senaste svar: ${JSON.stringify(completedJson)}`,
    `Avvisade sedan senaste svar: ${JSON.stringify(rejectedJson)}`,
    '</pending_agent_actions>',
  ].join('\n')
}

function formatSourceLabel(chunk: RetrievalResult): string {
  // Use contextualHeader directly — already formatted as breadcrumb from Story 14.2
  if (chunk.contextualHeader) {
    return `Källa: ${chunk.contextualHeader}`
  }

  // Fallback for USER_FILE or chunks without contextualHeader
  if (chunk.sourceType === 'USER_FILE' && chunk.metadata) {
    const filename =
      (chunk.metadata as Record<string, unknown>).filename ?? 'Okänd fil'
    return `Källa: ${filename}`
  }

  return `Källa: ${chunk.sourceType} > ${chunk.path}`
}
