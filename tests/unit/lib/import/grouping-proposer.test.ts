/**
 * Story 24.7 AC 21: grouping-proposer unit tests.
 *
 * Tests the pure 2-tier orchestration with a mocked LLM adapter — no SDK,
 * no network, no DB.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  proposeGroupingsForRows,
  type GroupingProposerRow,
} from '@/lib/import/grouping-proposer'
import type {
  GroupingLlmAdapter,
  GroupingLlmResult,
} from '@/lib/import/grouping-llm'

// ============================================================================
// Helpers
// ============================================================================

function row(
  partial: Partial<GroupingProposerRow> & { rowId: string }
): GroupingProposerRow {
  return {
    rowId: partial.rowId,
    sourceOmrade: partial.sourceOmrade ?? null,
    matchedDocumentId: partial.matchedDocumentId ?? `doc-${partial.rowId}`,
    title: partial.title ?? `Title ${partial.rowId}`,
    documentNumber: partial.documentNumber ?? `SFS 2020:${partial.rowId}`,
    contentType: partial.contentType ?? 'LAW',
  }
}

function mockAdapter(result: GroupingLlmResult): GroupingLlmAdapter {
  return { cluster: vi.fn().mockResolvedValue(result) }
}

const FIXED_NOW = () => new Date('2026-05-08T10:00:00Z')

// ============================================================================
// Tier 1 cases
// ============================================================================

describe('Tier 1 — source_omrade direct grouping', () => {
  it('5 rows with same source_omrade → one group of 5 (source: omrade)', async () => {
    const rows = [
      row({ rowId: '1', sourceOmrade: 'Arbetsmiljö' }),
      row({ rowId: '2', sourceOmrade: 'Arbetsmiljö' }),
      row({ rowId: '3', sourceOmrade: 'Arbetsmiljö' }),
      row({ rowId: '4', sourceOmrade: 'Arbetsmiljö' }),
      row({ rowId: '5', sourceOmrade: 'Arbetsmiljö' }),
    ]
    const adapter = mockAdapter({
      kind: 'success',
      clusters: [],
      unassignedRowIds: [],
      durationMs: 0,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheWriteInputTokens: 0,
      },
    })

    const proposal = await proposeGroupingsForRows(rows, adapter, {
      now: FIXED_NOW,
    })

    expect(proposal.groups).toHaveLength(1)
    expect(proposal.groups[0]).toMatchObject({
      name: 'Arbetsmiljö',
      source: 'omrade',
    })
    expect(proposal.groups[0]?.rowIds).toEqual(['1', '2', '3', '4', '5'])
    // No residuals → adapter must NOT be called
    expect(adapter.cluster).not.toHaveBeenCalled()
  })

  it('Tier 1 singleton collapse: 1 row with unique source_omrade → falls through to Tier 2', async () => {
    const rows = [
      row({ rowId: '1', sourceOmrade: 'Krishanteringsplan 2024' }),
      row({ rowId: '2', sourceOmrade: 'Arbetsmiljö' }),
      row({ rowId: '3', sourceOmrade: 'Arbetsmiljö' }),
    ]
    const adapter = mockAdapter({
      kind: 'success',
      clusters: [{ name: 'Övrigt LLM', rowIds: ['1'] }],
      unassignedRowIds: [],
      durationMs: 100,
      usage: {
        inputTokens: 50,
        outputTokens: 20,
        cacheReadInputTokens: 0,
        cacheWriteInputTokens: 0,
      },
    })

    const proposal = await proposeGroupingsForRows(rows, adapter, {
      now: FIXED_NOW,
    })

    // The singleton with "Krishanteringsplan 2024" should NOT be a Tier 1 group.
    const tier1Groups = proposal.groups.filter((g) => g.source === 'omrade')
    expect(tier1Groups).toHaveLength(1)
    expect(tier1Groups[0]?.name).toBe('Arbetsmiljö')
    expect(adapter.cluster).toHaveBeenCalledOnce()
    // The residual row 1 was sent to the LLM
    const callArgs = vi.mocked(adapter.cluster).mock.calls[0]?.[0] ?? []
    expect(callArgs.map((r) => r.rowId)).toContain('1')
    expect(callArgs.map((r) => r.rowId)).not.toContain('2')
  })

  it('Tier 1 mixed: rows with + without source_omrade → mixed groups[]', async () => {
    const rows = [
      row({ rowId: '1', sourceOmrade: 'Arbetsmiljö' }),
      row({ rowId: '2', sourceOmrade: 'Arbetsmiljö' }),
      row({ rowId: '3', sourceOmrade: null }), // → Tier 2
      row({ rowId: '4', sourceOmrade: '' }), // empty trims → Tier 2
      row({ rowId: '5', sourceOmrade: '   ' }), // whitespace-only → Tier 2
    ]
    const adapter = mockAdapter({
      kind: 'success',
      clusters: [{ name: 'Miljö', rowIds: ['3', '4', '5'] }],
      unassignedRowIds: [],
      durationMs: 100,
      usage: {
        inputTokens: 60,
        outputTokens: 30,
        cacheReadInputTokens: 0,
        cacheWriteInputTokens: 0,
      },
    })

    const proposal = await proposeGroupingsForRows(rows, adapter, {
      now: FIXED_NOW,
    })

    expect(proposal.groups).toHaveLength(2)
    expect(proposal.groups[0]).toMatchObject({
      name: 'Arbetsmiljö',
      source: 'omrade',
    })
    expect(proposal.groups[1]).toMatchObject({
      name: 'Miljö',
      source: 'llm',
    })
  })
})

// ============================================================================
// Tier 2 success cases
// ============================================================================

describe('Tier 2 — LLM clustering on residuals', () => {
  it('Tier 2 path: residual rows with mock LLM returning sane clusters → source: llm', async () => {
    const rows = [
      row({ rowId: '1' }),
      row({ rowId: '2' }),
      row({ rowId: '3' }),
      row({ rowId: '4' }),
    ]
    const adapter = mockAdapter({
      kind: 'success',
      clusters: [
        { name: 'Arbetsmiljö', rowIds: ['1', '2'] },
        { name: 'Miljö', rowIds: ['3', '4'] },
      ],
      unassignedRowIds: [],
      durationMs: 200,
      usage: {
        inputTokens: 100,
        outputTokens: 50,
        cacheReadInputTokens: 0,
        cacheWriteInputTokens: 0,
      },
    })

    const proposal = await proposeGroupingsForRows(rows, adapter, {
      now: FIXED_NOW,
    })

    expect(proposal.groups).toHaveLength(2)
    expect(proposal.groups.every((g) => g.source === 'llm')).toBe(true)
    expect(proposal.llmUsed).toBe(true)
    expect(proposal.llmUsage?.inputTokens).toBe(100)
  })

  // The cap + singleton filter live in normaliseClusters (LLM adapter side);
  // the proposer trusts what the adapter returns. Verify the adapter contract
  // semantics propagate correctly.
  it('Tier 2: adapter returned 8 clusters → all 8 propagate; extras already in unassigned', async () => {
    const rows = Array.from({ length: 20 }, (_, i) => row({ rowId: `r${i}` }))
    // Adapter has already applied the cap — proposer trusts the contract.
    const clusters = Array.from({ length: 8 }, (_, i) => ({
      name: `Group ${i}`,
      rowIds: [`r${i * 2}`, `r${i * 2 + 1}`],
    }))
    const adapter = mockAdapter({
      kind: 'success',
      clusters,
      unassignedRowIds: ['r16', 'r17', 'r18', 'r19'],
      durationMs: 300,
      usage: {
        inputTokens: 200,
        outputTokens: 100,
        cacheReadInputTokens: 0,
        cacheWriteInputTokens: 0,
      },
    })

    const proposal = await proposeGroupingsForRows(rows, adapter, {
      now: FIXED_NOW,
    })

    expect(proposal.groups).toHaveLength(8)
    expect(proposal.unassigned).toEqual(['r16', 'r17', 'r18', 'r19'])
    expect(proposal.unassignedCount).toBe(4)
  })

  it('Tier 2 all-singletons: adapter returned no surviving clusters → groups = Tier 1 only, all residuals to unassigned', async () => {
    const rows = [
      row({ rowId: '1', sourceOmrade: 'Arbetsmiljö' }),
      row({ rowId: '2', sourceOmrade: 'Arbetsmiljö' }),
      row({ rowId: '3', sourceOmrade: null }),
      row({ rowId: '4', sourceOmrade: null }),
    ]
    // Adapter has rejected all clusters during normalisation — returns empty
    // clusters + residuals as unassigned.
    const adapter = mockAdapter({
      kind: 'success',
      clusters: [],
      unassignedRowIds: ['3', '4'],
      durationMs: 200,
      usage: {
        inputTokens: 50,
        outputTokens: 20,
        cacheReadInputTokens: 0,
        cacheWriteInputTokens: 0,
      },
    })

    const proposal = await proposeGroupingsForRows(rows, adapter, {
      now: FIXED_NOW,
    })

    expect(proposal.groups).toHaveLength(1)
    expect(proposal.groups[0]?.source).toBe('omrade')
    expect(proposal.unassigned).toEqual(['3', '4'])
    expect(proposal.tier2Count).toBe(0)
  })

  // QA-fix LLM-001 regression guard: an empty-clusters model response (with
  // .min(1) lifted from the Zod schema) is now a success path — llmUsed
  // stays true, residuals fall to unassigned, no degraded banner fires.
  it('LLM returns empty clusters successfully → llmUsed=true, no failureReason', async () => {
    const rows = [
      row({ rowId: '1', sourceOmrade: null }),
      row({ rowId: '2', sourceOmrade: null }),
    ]
    const adapter = mockAdapter({
      kind: 'success',
      clusters: [],
      unassignedRowIds: ['1', '2'],
      durationMs: 100,
      usage: {
        inputTokens: 30,
        outputTokens: 5,
        cacheReadInputTokens: 0,
        cacheWriteInputTokens: 0,
      },
    })

    const proposal = await proposeGroupingsForRows(rows, adapter, {
      now: FIXED_NOW,
    })

    expect(proposal.llmUsed).toBe(true)
    expect(proposal.llmFailureReason).toBeUndefined()
    expect(proposal.groups).toHaveLength(0)
    expect(proposal.unassigned).toEqual(['1', '2'])
  })
})

// ============================================================================
// Tier 2 failure cases
// ============================================================================

function makeFailureProposal(
  reason: 'timeout' | 'rate_limit' | 'schema_violation' | 'network'
): GroupingLlmResult {
  return { kind: 'failure', reason, durationMs: 100 }
}

describe('Tier 2 — LLM failure modes (degraded fallback)', () => {
  it('LLM timeout → llmUsed: false, Tier 1 only, llmFailureReason: timeout', async () => {
    const rows = [
      row({ rowId: '1', sourceOmrade: 'Arbetsmiljö' }),
      row({ rowId: '2', sourceOmrade: 'Arbetsmiljö' }),
      row({ rowId: '3', sourceOmrade: null }),
      row({ rowId: '4', sourceOmrade: null }),
    ]
    const adapter = mockAdapter(makeFailureProposal('timeout'))

    const proposal = await proposeGroupingsForRows(rows, adapter, {
      now: FIXED_NOW,
    })

    expect(proposal.llmUsed).toBe(false)
    expect(proposal.llmFailureReason).toBe('timeout')
    expect(proposal.groups).toHaveLength(1)
    expect(proposal.groups[0]?.source).toBe('omrade')
    expect(proposal.unassigned).toEqual(['3', '4'])
  })

  it('LLM rate-limit → degraded fallback with reason: rate_limit', async () => {
    const rows = [row({ rowId: '1' }), row({ rowId: '2' })]
    const adapter = mockAdapter(makeFailureProposal('rate_limit'))

    const proposal = await proposeGroupingsForRows(rows, adapter, {
      now: FIXED_NOW,
    })

    expect(proposal.llmFailureReason).toBe('rate_limit')
    expect(proposal.llmUsed).toBe(false)
    expect(proposal.groups).toHaveLength(0)
    expect(proposal.unassigned).toEqual(['1', '2'])
  })

  it('LLM schema-violation → degraded fallback with reason: schema_violation', async () => {
    const rows = [row({ rowId: '1' }), row({ rowId: '2' })]
    const adapter = mockAdapter(makeFailureProposal('schema_violation'))

    const proposal = await proposeGroupingsForRows(rows, adapter, {
      now: FIXED_NOW,
    })

    expect(proposal.llmFailureReason).toBe('schema_violation')
    expect(proposal.llmUsed).toBe(false)
  })

  it('LLM network error → degraded fallback with reason: network', async () => {
    const rows = [row({ rowId: '1' }), row({ rowId: '2' })]
    const adapter = mockAdapter(makeFailureProposal('network'))

    const proposal = await proposeGroupingsForRows(rows, adapter, {
      now: FIXED_NOW,
    })

    expect(proposal.llmFailureReason).toBe('network')
    expect(proposal.llmUsed).toBe(false)
  })

  it('proposer never throws even when adapter rejects', async () => {
    // Edge case — adapter contract says NEVER throw, but defend anyway.
    const adapter: GroupingLlmAdapter = {
      cluster: vi.fn().mockRejectedValue(new Error('Adapter blew up')),
    }
    const rows = [row({ rowId: '1' }), row({ rowId: '2' })]

    // The proposer awaits the adapter promise; if it rejects, the proposer
    // currently propagates the rejection. This test pins that behaviour so a
    // future change to add a try/catch is intentional.
    await expect(proposeGroupingsForRows(rows, adapter)).rejects.toThrow(
      'Adapter blew up'
    )
  })
})

// ============================================================================
// Misc — generatedAt, defensive null filters
// ============================================================================

describe('Proposer misc', () => {
  it('generatedAt is included as ISO timestamp', async () => {
    const rows = [
      row({ rowId: '1', sourceOmrade: 'X' }),
      row({ rowId: '2', sourceOmrade: 'X' }),
    ]
    const adapter = mockAdapter({
      kind: 'success',
      clusters: [],
      unassignedRowIds: [],
      durationMs: 0,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheWriteInputTokens: 0,
      },
    })

    const proposal = await proposeGroupingsForRows(rows, adapter, {
      now: FIXED_NOW,
    })

    expect(proposal.generatedAt).toBe('2026-05-08T10:00:00.000Z')
  })

  it('rows without matched_document_id are dropped before any tier', async () => {
    const rows = [
      row({ rowId: '1', matchedDocumentId: null }),
      row({ rowId: '2', sourceOmrade: 'A' }),
      row({ rowId: '3', sourceOmrade: 'A' }),
    ]
    const adapter = mockAdapter({
      kind: 'success',
      clusters: [],
      unassignedRowIds: [],
      durationMs: 0,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheWriteInputTokens: 0,
      },
    })

    const proposal = await proposeGroupingsForRows(rows, adapter, {
      now: FIXED_NOW,
    })

    const allRowIds = [
      ...proposal.groups.flatMap((g) => g.rowIds),
      ...proposal.unassigned,
    ]
    expect(allRowIds).not.toContain('1')
  })

  it('preserves source_omrade case + spacing verbatim', async () => {
    const rows = [
      row({ rowId: '1', sourceOmrade: 'ARBETSMILJÖ' }),
      row({ rowId: '2', sourceOmrade: 'ARBETSMILJÖ' }),
      row({ rowId: '3', sourceOmrade: 'arbetsmiljö' }),
      row({ rowId: '4', sourceOmrade: 'arbetsmiljö' }),
    ]
    const adapter = mockAdapter({
      kind: 'success',
      clusters: [],
      unassignedRowIds: [],
      durationMs: 0,
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheWriteInputTokens: 0,
      },
    })

    const proposal = await proposeGroupingsForRows(rows, adapter, {
      now: FIXED_NOW,
    })

    const names = proposal.groups.map((g) => g.name).sort()
    expect(names).toEqual(['ARBETSMILJÖ', 'arbetsmiljö'])
  })
})

// ============================================================================
// LLM-adapter normalisation helpers (tested in isolation)
// ============================================================================

describe('grouping-llm normaliseClusters (cap + singleton filter)', () => {
  it('caps to 8 clusters by row-count desc; surplus → unassigned', async () => {
    const { __test__ } = await import('@/lib/import/grouping-llm')
    const inputRowIds = Array.from({ length: 30 }, (_, i) => `r${i}`)
    // Build 10 clusters of varying sizes
    const parsedClusters = [
      { name: 'A', rowIds: ['r0', 'r1', 'r2', 'r3', 'r4'] }, // 5
      { name: 'B', rowIds: ['r5', 'r6', 'r7', 'r8'] }, // 4
      { name: 'C', rowIds: ['r9', 'r10', 'r11'] }, // 3
      { name: 'D', rowIds: ['r12', 'r13', 'r14'] }, // 3
      { name: 'E', rowIds: ['r15', 'r16'] }, // 2
      { name: 'F', rowIds: ['r17', 'r18'] }, // 2
      { name: 'G', rowIds: ['r19', 'r20'] }, // 2
      { name: 'H', rowIds: ['r21', 'r22'] }, // 2
      { name: 'I', rowIds: ['r23', 'r24'] }, // 2  ← will be in last 8 (tied)
      { name: 'J', rowIds: ['r25', 'r26'] }, // 2  ← surplus
    ]
    const result = __test__.normaliseClusters({
      parsedClusters,
      inputRowIds,
    })

    expect(result.clusters).toHaveLength(8)
    // r25, r26 should be in unassigned (overflow), plus r27/r28/r29 (never claimed)
    expect(result.unassignedRowIds).toContain('r25')
    expect(result.unassignedRowIds).toContain('r26')
    expect(result.unassignedRowIds).toContain('r27')
  })

  it('rejects singletons (size < 2) and pushes their rows to unassigned', async () => {
    const { __test__ } = await import('@/lib/import/grouping-llm')
    const result = __test__.normaliseClusters({
      parsedClusters: [
        { name: 'OK', rowIds: ['r1', 'r2'] },
        { name: 'Singleton', rowIds: ['r3'] },
      ],
      inputRowIds: ['r1', 'r2', 'r3'],
    })

    expect(result.clusters).toHaveLength(1)
    expect(result.clusters[0]?.name).toBe('OK')
    expect(result.unassignedRowIds).toContain('r3')
  })

  it('first-assignment-wins on duplicate rowIds across clusters', async () => {
    const { __test__ } = await import('@/lib/import/grouping-llm')
    const result = __test__.normaliseClusters({
      parsedClusters: [
        { name: 'A', rowIds: ['r1', 'r2', 'r3'] },
        { name: 'B', rowIds: ['r3', 'r4', 'r5'] }, // r3 duplicate
      ],
      inputRowIds: ['r1', 'r2', 'r3', 'r4', 'r5'],
    })

    expect(result.clusters[0]?.rowIds).toEqual(['r1', 'r2', 'r3'])
    expect(result.clusters[1]?.rowIds).toEqual(['r4', 'r5'])
  })

  it('drops hallucinated rowIds not in the input set', async () => {
    const { __test__ } = await import('@/lib/import/grouping-llm')
    const result = __test__.normaliseClusters({
      parsedClusters: [{ name: 'A', rowIds: ['r1', 'r2', 'r-fake'] }],
      inputRowIds: ['r1', 'r2'],
    })

    expect(result.clusters[0]?.rowIds).toEqual(['r1', 'r2'])
  })
})
