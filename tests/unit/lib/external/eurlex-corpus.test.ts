/**
 * Unit tests: EU in-force corpus query builders + fetchCorpus (Story 2.6, Task A1).
 * Pure/builder tests + fetchCorpus with an injected SPARQL executor (no network).
 */
import { describe, it, expect } from 'vitest'
import {
  buildInForceCorpusQuery,
  buildLatestConsolidatedQuery,
  fetchCorpus,
} from '../../../../lib/external/eurlex'

// Minimal SPARQL JSON result helpers
function binding(fields: Record<string, string>) {
  const out: Record<string, { type: string; value: string }> = {}
  for (const [k, v] of Object.entries(fields)) {
    out[k] = { type: 'literal', value: v }
  }
  return out
}
function response(bindings: Record<string, { type: string; value: string }>[]) {
  return { head: { vars: [] }, results: { bindings } } as never
}

describe('buildInForceCorpusQuery', () => {
  const q = buildInForceCorpusQuery('2026-07-01')

  it('filters to REG + DIR resource types', () => {
    expect(q).toContain('resource-type/REG')
    expect(q).toContain('resource-type/DIR')
  })
  it('requires a Swedish expression', () => {
    expect(q).toContain('authority/language/SWE')
    expect(q).toContain('expression_uses_language')
  })
  it('includes in-force=true OR future entry-into-force, with injected today', () => {
    expect(q).toContain('STR(?inForce) = "true"')
    expect(q).toContain('?eif) > "2026-07-01"')
  })
  it('binds a content-type name for REG vs DIR', () => {
    expect(q).toContain('"EU_REGULATION"')
    expect(q).toContain('"EU_DIRECTIVE"')
  })
  it('excludes do_not_index works', () => {
    expect(q).toContain('do_not_index')
  })
})

describe('buildLatestConsolidatedQuery', () => {
  it('uses the spike-confirmed consolidation predicate and STR() celex filter', () => {
    const q = buildLatestConsolidatedQuery(['32014R0139', '32016R0679'])
    expect(q).toContain('act_consolidated_based_on_resource_legal')
    expect(q).toContain('act_consolidated_date')
    expect(q).toContain('STR(?baseCelex) = "32014R0139"')
    expect(q).toContain('STR(?baseCelex) = "32016R0679"')
    expect(q).toContain('||')
  })
})

describe('fetchCorpus', () => {
  it('maps base acts and resolves the latest consolidated version by max date', async () => {
    const corpus = response([
      binding({ celex: '32014R0139', typeName: 'EU_REGULATION' }),
      binding({ celex: '32019L1937', typeName: 'EU_DIRECTIVE' }),
    ])
    const consolidated = response([
      // Two versions of 32014R0139 — the later date must win.
      binding({
        baseCelex: '32014R0139',
        consCelex: '02014R0139-20180404',
        consDate: '2018-04-04',
      }),
      binding({
        baseCelex: '32014R0139',
        consCelex: '02014R0139-20260222',
        consDate: '2026-02-22',
      }),
      // 32019L1937 has no consolidated version -> never-amended.
    ])

    const calls: string[] = []
    const executor = async (query: string) => {
      calls.push(query)
      return query.includes('act_consolidated_based_on_resource_legal')
        ? consolidated
        : corpus
    }

    const result = await fetchCorpus({ today: '2026-07-01', executor })

    expect(result).toHaveLength(2)
    const reg = result.find((r) => r.celex === '32014R0139')!
    expect(reg.contentType).toBe('EU_REGULATION')
    expect(reg.latestConsolidatedCelex).toBe('02014R0139-20260222')
    expect(reg.latestConsolidatedDate?.toISOString().slice(0, 10)).toBe(
      '2026-02-22'
    )

    const dir = result.find((r) => r.celex === '32019L1937')!
    expect(dir.contentType).toBe('EU_DIRECTIVE')
    expect(dir.latestConsolidatedCelex).toBeNull()
    expect(dir.latestConsolidatedDate).toBeNull()
  })

  it('batches consolidated lookups by consolidatedBatchSize', async () => {
    const corpus = response(
      Array.from({ length: 5 }, (_, i) =>
        binding({ celex: `3202${i}R0001`, typeName: 'EU_REGULATION' })
      )
    )
    let consolidatedCalls = 0
    const executor = async (query: string) => {
      if (query.includes('act_consolidated_based_on_resource_legal')) {
        consolidatedCalls++
        return response([])
      }
      return corpus
    }
    await fetchCorpus({
      today: '2026-07-01',
      consolidatedBatchSize: 2,
      executor,
    })
    // 5 bases / batch 2 => 3 consolidated queries
    expect(consolidatedCalls).toBe(3)
  })

  it('skips malformed rows (missing celex/type)', async () => {
    const corpus = response([
      binding({ celex: '32014R0139', typeName: 'EU_REGULATION' }),
      binding({ typeName: 'EU_REGULATION' }), // no celex -> dropped
    ])
    const executor = async (query: string) =>
      query.includes('act_consolidated_based_on_resource_legal')
        ? response([])
        : corpus
    const result = await fetchCorpus({ today: '2026-07-01', executor })
    expect(result).toHaveLength(1)
    expect(result[0]!.celex).toBe('32014R0139')
  })
})
