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

function buildMeta(
  tool: string,
  startTime: number,
  resultCount: number
): ToolMeta {
  return {
    tool,
    executionTimeMs: Date.now() - startTime,
    resultCount,
  }
}

export function wrapToolResponse<T>(
  tool: string,
  data: T,
  startTime: number,
  resultCount?: number
): ToolResponse<T> {
  const count = resultCount ?? (Array.isArray(data) ? data.length : 1)
  return {
    data,
    _meta: buildMeta(tool, startTime, count),
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
    _meta: buildMeta(tool, startTime, 0),
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
