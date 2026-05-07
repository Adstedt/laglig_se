// @vitest-environment node
/**
 * Story 24.3 AC 18: matcher accuracy benchmark.
 *
 * Runs the real two-stage matcher (Anthropic API + live DB) against the
 * 50-row fixture at `tests/fixtures/import/matcher-benchmark.json` and
 * asserts the per-series accuracy gates from AC 18.
 *
 * Gated on `ANTHROPIC_API_KEY` — skipped (with a warning) when the env var
 * is absent. CI runs with the key set; local dev may not.
 *
 * Cost (worked estimate): 50 rows × ~$0.004 = ~$0.20 per benchmark run.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { matchRow, type MatchResult } from '@/lib/import/matcher'

const FIXTURE_PATH = join(
  process.cwd(),
  'tests',
  'fixtures',
  'import',
  'matcher-benchmark.json'
)

interface BenchmarkRow {
  source_titel: string | null
  source_sfs_nummer: string | null
  expected_document_id: string | null
  expected_tier: 'high' | 'medium' | 'unmatched'
  series: 'SFS' | 'AFS' | 'EU' | 'OTHER_AGENCY' | 'NEGATIVE' | 'PREFIX_MISMATCH'
  note?: string
}

const HAS_API_KEY = !!process.env.ANTHROPIC_API_KEY
const describeIfApiKey = HAS_API_KEY ? describe : describe.skip

if (!HAS_API_KEY) {
  console.warn(
    '\n[matcher.benchmark.test] ANTHROPIC_API_KEY not set — benchmark skipped.\n' +
      'Set the env var to run the full accuracy gate.\n'
  )
}

interface SeriesStats {
  total: number
  high: number
  medium: number
  unmatched: number
  /** Number of rows where matched_document_id matches expected_document_id (exact). */
  correct_doc_id: number
  /** Number of false-positives at high tier (doc_id mismatch). */
  high_tier_false_positives: number
}

function emptyStats(): SeriesStats {
  return {
    total: 0,
    high: 0,
    medium: 0,
    unmatched: 0,
    correct_doc_id: 0,
    high_tier_false_positives: 0,
  }
}

describeIfApiKey('matcher.benchmark — 50-row accuracy gate', () => {
  // Allow up to 90s for the benchmark — 50 rows × ~3s avg latency ≈ ~150s but
  // matchRowsBatch parallelises at 10. Realistically completes in 30-60s.
  it('meets per-series accuracy gates from AC 18', async () => {
    const fixture = JSON.parse(
      readFileSync(FIXTURE_PATH, 'utf8')
    ) as BenchmarkRow[]
    expect(fixture.length).toBeGreaterThanOrEqual(50)

    const statsBySeries: Record<BenchmarkRow['series'], SeriesStats> = {
      SFS: emptyStats(),
      AFS: emptyStats(),
      EU: emptyStats(),
      OTHER_AGENCY: emptyStats(),
      NEGATIVE: emptyStats(),
      PREFIX_MISMATCH: emptyStats(),
    }

    // Sequential dispatch — keeps per-row diagnostics clean and avoids
    // hammering the Anthropic rate limiter on local dev keys.
    const results: Array<{
      row: BenchmarkRow
      result: MatchResult
    }> = []
    for (const row of fixture) {
      const result = await matchRow({
        titel: row.source_titel,
        sfs_nummer: row.source_sfs_nummer,
        omrade: null,
        kommentar: null,
      })
      results.push({ row, result })
    }

    // Tally
    for (const { row, result } of results) {
      const stats = statsBySeries[row.series]
      stats.total++
      if (result.confidence_tier === 'high') stats.high++
      else if (result.confidence_tier === 'medium') stats.medium++
      else stats.unmatched++

      if (
        row.expected_document_id !== null &&
        result.matched_document_id === row.expected_document_id
      ) {
        stats.correct_doc_id++
      }
      if (
        result.confidence_tier === 'high' &&
        result.matched_document_id !== row.expected_document_id
      ) {
        stats.high_tier_false_positives++
      }
    }

    // Pretty-print stats for failure-mode debugging.
    console.log('\n=== Matcher benchmark per-series stats ===')
    for (const [series, s] of Object.entries(statsBySeries)) {
      if (s.total === 0) continue
      console.log(
        `${series.padEnd(16)} total=${s.total} high=${s.high} med=${s.medium} unmatched=${s.unmatched} correct=${s.correct_doc_id} fp=${s.high_tier_false_positives}`
      )
    }
    console.log()

    // ----------------------------------------------------------------------
    // Fixture-wide: 0 false-positives at MATCHED_HIGH (AC 18)
    // Story 24.3 QA gate TEST-001: the per-series fp=0 assertions below
    // miss the PREFIX_MISMATCH subset. AC 18 requires fixture-wide fp=0,
    // so add the aggregate gate here. Paired with the Branch-B-only cap
    // in match-candidates.ts that prevents ambiguous-prefix inputs from
    // reaching HIGH tier.
    // ----------------------------------------------------------------------
    const fixtureWideFp = Object.values(statsBySeries).reduce(
      (sum, s) => sum + s.high_tier_false_positives,
      0
    )
    expect(fixtureWideFp).toBe(0)

    // ----------------------------------------------------------------------
    // Aggregate gate: ≥70% MATCHED_HIGH across the full fixture
    // ----------------------------------------------------------------------
    const positiveRows = fixture.filter((r) => r.series !== 'NEGATIVE').length
    const totalHigh =
      statsBySeries.SFS.high +
      statsBySeries.AFS.high +
      statsBySeries.EU.high +
      statsBySeries.OTHER_AGENCY.high +
      statsBySeries.PREFIX_MISMATCH.high
    const aggregateAccuracy = totalHigh / positiveRows
    console.log(
      `Aggregate MATCHED_HIGH: ${totalHigh}/${positiveRows} = ${(aggregateAccuracy * 100).toFixed(1)}%`
    )
    expect(aggregateAccuracy).toBeGreaterThanOrEqual(0.7)

    // ----------------------------------------------------------------------
    // Per-series sub-assertions (AC 18)
    // ----------------------------------------------------------------------
    // AFS: ≥60% high
    if (statsBySeries.AFS.total > 0) {
      const afsAccuracy = statsBySeries.AFS.high / statsBySeries.AFS.total
      expect(afsAccuracy).toBeGreaterThanOrEqual(0.6)
      expect(statsBySeries.AFS.high_tier_false_positives).toBe(0)
    }

    // EU: ≥60% high
    if (statsBySeries.EU.total > 0) {
      const euAccuracy = statsBySeries.EU.high / statsBySeries.EU.total
      expect(euAccuracy).toBeGreaterThanOrEqual(0.6)
      expect(statsBySeries.EU.high_tier_false_positives).toBe(0)
    }

    // Other-agency: at minimum 1 high (proves end-to-end open-set)
    if (statsBySeries.OTHER_AGENCY.total > 0) {
      expect(statsBySeries.OTHER_AGENCY.high).toBeGreaterThanOrEqual(1)
    }

    // Prefix-mismatch tier-2: ≥50% land MEDIUM-or-higher
    if (statsBySeries.PREFIX_MISMATCH.total > 0) {
      const okPM =
        statsBySeries.PREFIX_MISMATCH.high +
        statsBySeries.PREFIX_MISMATCH.medium
      const pmAccuracy = okPM / statsBySeries.PREFIX_MISMATCH.total
      expect(pmAccuracy).toBeGreaterThanOrEqual(0.5)
    }

    // Negatives: 100% UNMATCHED (zero false-positives)
    if (statsBySeries.NEGATIVE.total > 0) {
      expect(statsBySeries.NEGATIVE.high).toBe(0)
      expect(statsBySeries.NEGATIVE.unmatched).toBe(
        statsBySeries.NEGATIVE.total
      )
    }
  }, 180_000) // 3 min timeout — generous for slow networks / cold cache
})
