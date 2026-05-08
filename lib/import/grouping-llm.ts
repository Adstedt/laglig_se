/**
 * Story 24.7: LLM adapter for the import-grouping proposer (Tier 2).
 *
 * Wraps `generateObject` from the `ai` SDK + `claude-haiku-4-5` for
 * clustering residual rows into Swedish subject-area groups. Applies:
 *   - 15-second AbortController timeout (AC 8)
 *   - temperature 0.1 (AC 7)
 *   - Anthropic ephemeral cache on the system prompt (AC 9; Story 14.26 pattern)
 *   - Cluster size cap (max 8) + singleton filter (≥2 rows per cluster)
 *   - Failure classification (timeout | rate_limit | schema_violation | network | unknown)
 *
 * The adapter NEVER throws. On any failure it returns a result object with
 * `kind: 'failure'` and a classified `reason` so the caller can downgrade
 * gracefully.
 */

import { generateObject, APICallError, TypeValidationError } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'

// ============================================================================
// Constants
// ============================================================================

export const GROUPING_LLM_MODEL_ID = 'claude-haiku-4-5'
export const GROUPING_LLM_TELEMETRY_NAME = 'claude-haiku-4-5'
export const GROUPING_LLM_TIMEOUT_MS = 15_000
export const GROUPING_LLM_TEMPERATURE = 0.1
export const GROUPING_LLM_MAX_CLUSTERS = 8
export const GROUPING_LLM_MIN_CLUSTER_SIZE = 2

// Per AC 7 — Swedish system prompt with embedded examples-as-priors.
// Examples live here (not a code lookup table) so future agency series can
// be added by editing this string, with no further code change.
export const GROUPING_LLM_SYSTEM_PROMPT = `Du grupperar svenska lagar och författningar efter ämnesområde. Returnera 2–8 grupper med beskrivande svenska namn. Varje rad ska tillhöra exakt en grupp. Slå inte ihop tydligt åtskilda områden bara för att jämna ut storlekar.

Exempel på rimliga gruppnamn för vanliga författningsserier:
- AFS-serien (Arbetsmiljöverket) → "Arbetsmiljö"
- MSBFS (Myndigheten för samhällsskydd och beredskap) → "Brandskydd & krisberedskap"
- NFS (Naturvårdsverket) → "Miljö"
- BFS (Boverket) → "Bygg & boende"
- SOSFS / HSLF-FS (hälso- och sjukvårdsmyndigheter) → "Hälso- och sjukvård"

Använd dessa som vägledning men bestäm gruppnamn baserat på det faktiska innehållet — exempel kan ha undantag.`

// ============================================================================
// Public types
// ============================================================================

export interface GroupingLlmRow {
  rowId: string
  title: string | null
  documentNumber: string | null
  contentType: string | null
}

export type GroupingLlmFailureReason =
  | 'timeout'
  | 'rate_limit'
  | 'schema_violation'
  | 'network'
  | 'unknown'

export type GroupingLlmResult =
  | {
      kind: 'success'
      clusters: Array<{ name: string; rowIds: string[] }>
      unassignedRowIds: string[]
      durationMs: number
      usage: {
        inputTokens: number
        outputTokens: number
        cacheReadInputTokens: number
        cacheWriteInputTokens: number
      }
    }
  | {
      kind: 'failure'
      reason: GroupingLlmFailureReason
      durationMs: number
    }

export interface GroupingLlmAdapter {
  cluster(_rows: GroupingLlmRow[]): Promise<GroupingLlmResult>
}

// ============================================================================
// Output schema (validated post-call)
// ============================================================================

const ClusterSchema = z.object({
  name: z.string().min(1).max(60),
  rowIds: z.array(z.string()).min(1),
})

// QA-fix LLM-001 (24.7 review): no `.min(1)` on `clusters`. A genuine
// empty-clusters response from the model — e.g., for a residual set it
// can't sensibly group — was previously rejected by Zod and surfaced as
// `schema_violation` (displayed to users as "AI inte tillgänglig"). Now
// it falls through `normaliseClusters` naturally: zero kept clusters →
// every input row goes to `unassignedRowIds`, the all-singletons fallback
// path renders cleanly, and `llmUsed` stays true since the call itself
// succeeded.
const ClustersResponseSchema = z.object({
  clusters: z.array(ClusterSchema),
})

// ============================================================================
// Failure classification
// ============================================================================

function classifyFailure(err: unknown): GroupingLlmFailureReason {
  // AbortError from the AbortController — our 15s timeout
  if (err instanceof Error && err.name === 'AbortError') return 'timeout'
  // ai SDK can wrap aborts as APICallError with isRetryable=false; check name
  if (
    err instanceof APICallError &&
    (err.statusCode === 408 || err.message?.toLowerCase().includes('abort'))
  ) {
    return 'timeout'
  }

  // Rate-limit: 429 from Anthropic surfaces as APICallError with statusCode.
  if (err instanceof APICallError && err.statusCode === 429) return 'rate_limit'

  // Zod schema mismatch (the SDK's TypeValidationError) or our post-validation.
  if (err instanceof TypeValidationError) return 'schema_violation'
  if (err instanceof z.ZodError) return 'schema_violation'

  // Network / 5xx
  if (err instanceof APICallError) {
    if (
      typeof err.statusCode === 'number' &&
      err.statusCode >= 500 &&
      err.statusCode < 600
    ) {
      return 'network'
    }
    // No statusCode usually means transport-level failure (DNS, TLS, fetch).
    if (err.statusCode === undefined) return 'network'
  }

  // Generic fetch/network error
  if (err instanceof TypeError && /fetch|network/i.test(err.message)) {
    return 'network'
  }

  return 'unknown'
}

// ============================================================================
// Post-validation: apply cap + singleton filter
// ============================================================================

interface NormaliseInput {
  parsedClusters: Array<{ name: string; rowIds: string[] }>
  inputRowIds: string[]
}

function normaliseClusters({ parsedClusters, inputRowIds }: NormaliseInput): {
  clusters: Array<{ name: string; rowIds: string[] }>
  unassignedRowIds: string[]
} {
  const inputSet = new Set(inputRowIds)

  // Strip rowIds the model may have hallucinated (not in input set);
  // de-duplicate within each cluster; trim names.
  const sanitized = parsedClusters
    .map((c) => {
      const seen = new Set<string>()
      const rowIds: string[] = []
      for (const id of c.rowIds) {
        if (inputSet.has(id) && !seen.has(id)) {
          seen.add(id)
          rowIds.push(id)
        }
      }
      return { name: c.name.trim(), rowIds }
    })
    .filter((c) => c.name.length > 0)

  // First-assignment-wins: if the model placed the same row in multiple
  // clusters, keep it in the first one.
  const claimed = new Set<string>()
  const dedupedAcrossClusters = sanitized.map((c) => {
    const rowIds = c.rowIds.filter((id) => {
      if (claimed.has(id)) return false
      claimed.add(id)
      return true
    })
    return { name: c.name, rowIds }
  })

  // Filter clusters that fall below the singleton threshold AC 7
  const meetingMinSize = dedupedAcrossClusters.filter(
    (c) => c.rowIds.length >= GROUPING_LLM_MIN_CLUSTER_SIZE
  )

  // Apply max-clusters cap by total size; drop the smallest into unassigned.
  const sortedBySize = [...meetingMinSize].sort(
    (a, b) => b.rowIds.length - a.rowIds.length
  )
  const kept = sortedBySize.slice(0, GROUPING_LLM_MAX_CLUSTERS)
  const dropped = sortedBySize.slice(GROUPING_LLM_MAX_CLUSTERS)

  const keptIds = new Set(kept.flatMap((c) => c.rowIds))
  // dropped (over-cap) + singletons (under-min) + never-claimed input rows
  // all collapse to a single "anything-not-in-kept" pass below — no need to
  // enumerate the categories separately.
  void dropped

  // Anything in the input set that isn't in a kept cluster is unassigned.
  const unassignedRowIds = inputRowIds.filter((id) => !keptIds.has(id))

  return { clusters: kept, unassignedRowIds }
}

// ============================================================================
// User prompt builder
// ============================================================================

function buildUserPrompt(rows: GroupingLlmRow[]): string {
  const lines = rows.map((r) => {
    const parts: string[] = [r.rowId]
    if (r.documentNumber) parts.push(r.documentNumber)
    if (r.title) parts.push(r.title)
    if (r.contentType) parts.push(`[${r.contentType}]`)
    return parts.join(' | ')
  })
  return `Gruppera följande rader. Returnera JSON-objekt med "clusters" — varje cluster har "name" (svenskt ämnesområde) och "rowIds" (en delmängd av rad-ID:n nedan).

Rader (id | dokumentnummer | titel | [content_type]):
${lines.join('\n')}`
}

// ============================================================================
// Default adapter — wraps generateObject + Anthropic + timeout + classify
// ============================================================================

export function createGroupingLlmAdapter(): GroupingLlmAdapter {
  return {
    async cluster(rows: GroupingLlmRow[]): Promise<GroupingLlmResult> {
      const startedAt = Date.now()
      const inputRowIds = rows.map((r) => r.rowId)

      // Defensive — empty input shouldn't happen but cope gracefully.
      if (rows.length === 0) {
        return {
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
        }
      }

      const controller = new AbortController()
      const timeoutHandle = setTimeout(
        () => controller.abort(),
        GROUPING_LLM_TIMEOUT_MS
      )

      try {
        const result = await generateObject({
          model: anthropic(GROUPING_LLM_MODEL_ID),
          schema: ClustersResponseSchema,
          temperature: GROUPING_LLM_TEMPERATURE,
          messages: [
            {
              role: 'system',
              content: GROUPING_LLM_SYSTEM_PROMPT,
              providerOptions: {
                anthropic: { cacheControl: { type: 'ephemeral' } },
              },
            },
            { role: 'user', content: buildUserPrompt(rows) },
          ],
          abortSignal: controller.signal,
        })

        clearTimeout(timeoutHandle)

        const { clusters, unassignedRowIds } = normaliseClusters({
          parsedClusters: result.object.clusters,
          inputRowIds,
        })

        const usage = result.usage
        // Anthropic provider exposes cache tokens via provider-specific fields.
        // Fall back to 0 if not present (e.g., test mocks).
        const providerMetadata = result.providerMetadata?.anthropic ?? {}
        const cacheReadInputTokens =
          (typeof providerMetadata['cacheReadInputTokens'] === 'number'
            ? providerMetadata['cacheReadInputTokens']
            : 0) || 0
        const cacheWriteInputTokens =
          (typeof providerMetadata['cacheCreationInputTokens'] === 'number'
            ? providerMetadata['cacheCreationInputTokens']
            : 0) || 0

        return {
          kind: 'success',
          clusters,
          unassignedRowIds,
          durationMs: Date.now() - startedAt,
          usage: {
            inputTokens: usage.inputTokens ?? 0,
            outputTokens: usage.outputTokens ?? 0,
            cacheReadInputTokens,
            cacheWriteInputTokens,
          },
        }
      } catch (err) {
        clearTimeout(timeoutHandle)
        const reason = classifyFailure(err)
        // eslint-disable-next-line no-console -- documented in AC 8
        console.warn('[GROUPINGS_LLM_FAIL]', { reason, error: err })
        return {
          kind: 'failure',
          reason,
          durationMs: Date.now() - startedAt,
        }
      }
    },
  }
}

// Exported for unit tests
export const __test__ = {
  classifyFailure,
  normaliseClusters,
  buildUserPrompt,
}
