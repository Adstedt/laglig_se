/**
 * Story 24.7: Pure 2-tier import-grouping proposer.
 *
 * Tier 1: group rows by `source_omrade` verbatim (deterministic, free).
 *         Singleton groups (size < MIN_TIER1_GROUP_SIZE) are demoted and
 *         fall through to Tier 2.
 *
 * Tier 2: LLM clustering on the residual rows. The adapter (injected) handles
 *         the SDK call, timeout, and failure classification — this proposer
 *         is concerned only with orchestration and shape normalisation.
 *
 * The proposer NEVER throws. On LLM failure it returns Tier 1 results plus
 * a `llmFailureReason` so the caller can render a degraded-banner UX.
 */

import type {
  GroupingLlmAdapter,
  GroupingLlmFailureReason,
  GroupingLlmRow,
} from './grouping-llm'

// ============================================================================
// Constants
// ============================================================================

export const MIN_TIER1_GROUP_SIZE = 2

// ============================================================================
// Public types
// ============================================================================

export interface GroupingProposerRow {
  rowId: string
  sourceOmrade: string | null
  matchedDocumentId: string | null
  title: string | null
  documentNumber: string | null
  contentType: string | null
}

export interface ProposedGroup {
  name: string
  rowIds: string[]
  source: 'omrade' | 'llm'
}

export interface GroupingProposal {
  groups: ProposedGroup[]
  unassigned: string[]
  generatedAt: string
  llmUsed: boolean
  llmDurationMs?: number
  llmFailureReason?: GroupingLlmFailureReason
  /** Counts populated for activity-log payloads. */
  tier1Count: number
  tier2Count: number
  unassignedCount: number
  /** LLM token + cost telemetry, populated when `llmUsed === true`. */
  llmUsage?: {
    inputTokens: number
    outputTokens: number
    cacheReadInputTokens: number
    cacheWriteInputTokens: number
  }
}

// ============================================================================
// Tier 1 — group by source_omrade verbatim
// ============================================================================

interface Tier1Result {
  groups: ProposedGroup[]
  /** Rows that did NOT make it into a Tier 1 group — fall through to Tier 2. */
  residual: GroupingProposerRow[]
}

function runTier1(rows: GroupingProposerRow[]): Tier1Result {
  // Group by trimmed source_omrade preserving original case + spacing.
  const buckets = new Map<string, GroupingProposerRow[]>()
  const noOmrade: GroupingProposerRow[] = []

  for (const row of rows) {
    const trimmed = row.sourceOmrade?.trim() ?? ''
    if (trimmed.length === 0) {
      noOmrade.push(row)
      continue
    }
    const bucket = buckets.get(trimmed)
    if (bucket) {
      bucket.push(row)
    } else {
      buckets.set(trimmed, [row])
    }
  }

  const groups: ProposedGroup[] = []
  const singletonResiduals: GroupingProposerRow[] = []

  for (const [name, members] of buckets) {
    if (members.length >= MIN_TIER1_GROUP_SIZE) {
      groups.push({
        name,
        rowIds: members.map((r) => r.rowId),
        source: 'omrade',
      })
    } else {
      // Singleton — demote
      singletonResiduals.push(...members)
    }
  }

  return {
    groups,
    residual: [...noOmrade, ...singletonResiduals],
  }
}

// ============================================================================
// proposeGroupingsForRows — main orchestration
// ============================================================================

export interface ProposeGroupingsOptions {
  /** Override the wall-clock for `generatedAt` — unit tests want determinism. */
  now?: () => Date
}

export async function proposeGroupingsForRows(
  rows: GroupingProposerRow[],
  llmAdapter: GroupingLlmAdapter,
  options?: ProposeGroupingsOptions
): Promise<GroupingProposal> {
  const now = options?.now ?? (() => new Date())

  // Defensive: drop rows without a matched document (shouldn't appear in
  // committable rows, but the proposer doesn't assume the caller filtered).
  const usable = rows.filter((r) => r.matchedDocumentId !== null)

  // ---------------------------------------------------------------- Tier 1
  const tier1 = runTier1(usable)

  // ---------------------------------------------------------------- Tier 2
  // Skip the LLM call if there are no residuals — Tier 1 already covers
  // every row with a known omrade.
  if (tier1.residual.length === 0) {
    return {
      groups: tier1.groups,
      unassigned: [],
      generatedAt: now().toISOString(),
      llmUsed: false,
      tier1Count: tier1.groups.length,
      tier2Count: 0,
      unassignedCount: 0,
    }
  }

  const llmInput: GroupingLlmRow[] = tier1.residual.map((r) => ({
    rowId: r.rowId,
    title: r.title,
    documentNumber: r.documentNumber,
    contentType: r.contentType,
  }))

  const llmResult = await llmAdapter.cluster(llmInput)

  if (llmResult.kind === 'failure') {
    // Degraded path: Tier 1 only, all residuals → unassigned.
    return {
      groups: tier1.groups,
      unassigned: tier1.residual.map((r) => r.rowId),
      generatedAt: now().toISOString(),
      llmUsed: false,
      llmDurationMs: llmResult.durationMs,
      llmFailureReason: llmResult.reason,
      tier1Count: tier1.groups.length,
      tier2Count: 0,
      unassignedCount: tier1.residual.length,
    }
  }

  // Success — fold Tier 2 clusters into the proposal.
  const tier2Groups: ProposedGroup[] = llmResult.clusters.map((c) => ({
    name: c.name,
    rowIds: c.rowIds,
    source: 'llm',
  }))

  return {
    groups: [...tier1.groups, ...tier2Groups],
    unassigned: llmResult.unassignedRowIds,
    generatedAt: now().toISOString(),
    llmUsed: true,
    llmDurationMs: llmResult.durationMs,
    tier1Count: tier1.groups.length,
    tier2Count: tier2Groups.length,
    unassignedCount: llmResult.unassignedRowIds.length,
    llmUsage: llmResult.usage,
  }
}

// Exported for unit tests
export const __test__ = {
  runTier1,
}
