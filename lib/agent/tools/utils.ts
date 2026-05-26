/**
 * Shared utility helpers for agent tools
 * Story 14.7a, Task 1 (AC: 3-6)
 */

import type {
  ToolResponse,
  WriteToolResponse,
  ToolError,
  ToolMeta,
} from './types'

/** Tools whose read results should show a "Visa detaljer" chip */
const SUGGEST_SIDEBAR_TOOLS = new Set([
  'get_document_details',
  'get_change_details',
])

function buildMeta(
  tool: string,
  startTime: number,
  resultCount: number,
  sidebarHint?: 'open' | 'suggest' | 'none'
): ToolMeta {
  return {
    tool,
    executionTimeMs: Date.now() - startTime,
    resultCount,
    ...(sidebarHint != null && { sidebarHint }),
  }
}

export function wrapToolResponse<T>(
  tool: string,
  data: T,
  startTime: number,
  resultCount?: number
): ToolResponse<T> {
  const count = resultCount ?? (Array.isArray(data) ? data.length : 1)
  const hint = SUGGEST_SIDEBAR_TOOLS.has(tool)
    ? ('suggest' as const)
    : undefined
  return {
    data,
    _meta: buildMeta(tool, startTime, count, hint),
  }
}

export function wrapWriteToolResponse<T>(
  tool: string,
  action: string,
  params: Record<string, unknown>,
  preview: string,
  startTime: number
): WriteToolResponse<T> {
  return {
    confirmation_required: true,
    action,
    params,
    preview,
    // A write tool's surface is the inline approval card (Stories 14.22–24), not
    // the detail sidebar. 'none' (was 'open') stops ToolAutoOpener from popping a
    // sidebar that just dumps the raw {pendingActionId} envelope. draft_styrdokument's
    // "öppna i editorn" canvas is a separate user-initiated openDetail in its renderer.
    _meta: buildMeta(tool, startTime, 0, 'none'),
  }
}

export function wrapToolError(
  tool: string,
  message: string,
  guidance: string,
  startTime: number
): ToolError {
  return {
    error: true,
    message,
    guidance,
    _meta: buildMeta(tool, startTime, 0),
  }
}

/**
 * Truncate markdown content to an approximate token budget.
 * Uses chars/4 as a rough token estimate.
 * Default budget: ~4000 tokens (~16K chars).
 */
export function truncateMarkdown(
  content: string,
  maxTokens: number = 4000
): string {
  const maxChars = maxTokens * 4
  if (content.length <= maxChars) return content

  // Cut at a paragraph or line boundary to avoid mid-sentence truncation
  const truncated = content.slice(0, maxChars)
  const lastNewline = truncated.lastIndexOf('\n')
  const cutPoint = lastNewline > maxChars * 0.8 ? lastNewline : maxChars

  return truncated.slice(0, cutPoint) + '\n\n[... innehållet trunkerat]'
}
