/**
 * Context Assembly
 * Story 14.8, Task 3 (AC: 14-18)
 *
 * Formats retrieved chunks into a token-budgeted, prompt-ready context block
 * with Swedish source labels, deduplication, and document-order preservation.
 */

import type { RetrievalResult } from '@/lib/agent/retrieval'

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
