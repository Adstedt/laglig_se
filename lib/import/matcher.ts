/**
 * Story 24.3: LLM-disambiguating matcher for the import pipeline.
 *
 * Two-stage logic per AC 7:
 *   Stage 1 — `findMatchCandidates` returns top-5 candidates.
 *   Stage 1 short-circuit (no LLM) when:
 *     - top candidate has fuzzy_score >= 0.95 AND document_number_exact, OR
 *     - zero candidates returned (no point asking the LLM to disambiguate).
 *   Stage 2 — single Anthropic call with the prompt at matcher-prompt.ts;
 *     1 retry on parse failure.
 *
 * Confidence-tier mapping (AC 9):
 *   >= 0.85 → high
 *   0.5 ≤ score < 0.85 → medium
 *   < 0.5 → unmatched
 *
 * Per-row LLM cost target (AC 10): ~$0.004/row at Sonnet rates with prompt
 * caching active.
 */

import Anthropic from '@anthropic-ai/sdk'
import pLimit from 'p-limit'
import { ChatContextType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { estimateCostUsd } from '@/lib/usage/cost-estimator'
import {
  findMatchCandidates,
  type MatchCandidate,
} from '@/lib/search/match-candidates'
import {
  MATCHER_SYSTEM_PROMPT,
  buildMatcherUserPrompt,
  LlmMatchResponseSchema,
  extractJson,
  type LlmMatchResponse,
} from './matcher-prompt'

// ============================================================================
// Public types
// ============================================================================

export interface MatcherInput {
  titel: string | null
  sfs_nummer: string | null
  omrade: string | null
  kommentar: string | null
}

export type ConfidenceTier = 'high' | 'medium' | 'unmatched'

export interface MatchResult {
  matched_document_id: string | null
  confidence_score: number
  confidence_tier: ConfidenceTier
  candidates: MatchCandidate[]
  reasoning: string | null
  llm_used: boolean
}

export interface MatchOptions {
  /** Pass an existing client to share the connection across calls. */
  anthropicClient?: Anthropic
  /** Workspace + user IDs for the per-call ChatUsageEvent telemetry write. */
  telemetry?: {
    workspaceId: string
    userId: string
  }
  /** Concurrency cap for `matchRowsBatch`. Default 10 (AC 11). */
  concurrency?: number
  /** Override model id; default `claude-sonnet-4-20250514`. */
  modelId?: string
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MODEL_ID = 'claude-sonnet-4-20250514'
const TELEMETRY_MODEL_NAME = 'claude-sonnet-4-6' // matches PRICING table key
const MAX_TOKENS = 512
const SHORT_CIRCUIT_FUZZY_THRESHOLD = 0.95
const HIGH_TIER_THRESHOLD = 0.85
const MEDIUM_TIER_THRESHOLD = 0.5
const RATE_LIMIT_MAX_RETRIES = 3
const PARSE_FAILURE_RETRIES = 1

// ============================================================================
// Helpers
// ============================================================================

function tierFromScore(score: number): ConfidenceTier {
  if (score >= HIGH_TIER_THRESHOLD) return 'high'
  if (score >= MEDIUM_TIER_THRESHOLD) return 'medium'
  return 'unmatched'
}

function getAnthropicClient(opts: MatchOptions | undefined): Anthropic {
  if (opts?.anthropicClient) return opts.anthropicClient
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY not set. Provide via options.anthropicClient or env.'
    )
  }
  return new Anthropic({ apiKey })
}

/**
 * Fail-safe ChatUsageEvent write — wrapped in try/catch + console.error per
 * Story 14.27 convention. Never re-throws; matcher errors must not surface
 * via telemetry path failure.
 */
async function writeUsageEvent(
  telemetry: NonNullable<MatchOptions['telemetry']>,
  usage: {
    inputTokens: number
    outputTokens: number
    cacheReadInputTokens: number
    cacheWriteInputTokens: number
  }
): Promise<void> {
  try {
    const cost = estimateCostUsd({
      model: TELEMETRY_MODEL_NAME,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheReadInputTokens: usage.cacheReadInputTokens,
      cacheWriteInputTokens: usage.cacheWriteInputTokens,
      reasoningTokens: 0,
    })
    await prisma.chatUsageEvent.create({
      data: {
        workspace_id: telemetry.workspaceId,
        user_id: telemetry.userId,
        model: TELEMETRY_MODEL_NAME,
        context_type: ChatContextType.IMPORT_MATCHING,
        input_tokens: usage.inputTokens,
        output_tokens: usage.outputTokens,
        cache_read_input_tokens: usage.cacheReadInputTokens,
        cache_write_input_tokens: usage.cacheWriteInputTokens,
        reasoning_tokens: 0,
        step_count: 1,
        cost_usd_estimate: cost,
      },
    })
  } catch (err) {
    console.error('[CHAT_USAGE_EVENT_WRITE_FAIL]', err)
  }
}

// ============================================================================
// matchRow
// ============================================================================

export async function matchRow(
  input: MatcherInput,
  options?: MatchOptions
): Promise<MatchResult> {
  // Stage 1: fuzzy retrieval
  const candidates = await findMatchCandidates(
    { titel: input.titel, sfs_nummer: input.sfs_nummer },
    5
  )

  // Stage 1 short-circuit: no candidates
  if (candidates.length === 0) {
    return {
      matched_document_id: null,
      confidence_score: 0,
      confidence_tier: 'unmatched',
      candidates: [],
      reasoning: 'Inga kandidater i katalogen',
      llm_used: false,
    }
  }

  // Stage 1 short-circuit: top is exact-match + above threshold
  const top = candidates[0]!
  if (
    top.fuzzy_score >= SHORT_CIRCUIT_FUZZY_THRESHOLD &&
    top.match_signals.document_number_exact
  ) {
    return {
      matched_document_id: top.document_id,
      confidence_score: 1.0,
      confidence_tier: 'high',
      candidates,
      reasoning: null,
      llm_used: false,
    }
  }

  // Stage 2: LLM disambiguation
  const llmResponse = await callMatcherLlm(input, candidates, options)

  if (!llmResponse) {
    // Hard parse failure after 1 retry — surface as unmatched (caller's
    // runMatching will mark the row UNMATCHED with a Swedish reasoning).
    return {
      matched_document_id: null,
      confidence_score: 0,
      confidence_tier: 'unmatched',
      candidates,
      reasoning: 'Kunde inte avgöra matchning automatiskt',
      llm_used: true,
    }
  }

  // Story 24.3 QA gate TEST-003: defensive contradiction guard. The system
  // prompt instructs the LLM to use confidence < 0.5 when chosen_document_id
  // is null, but instruction violations are possible. Force tier=unmatched
  // (and clamp the surfaced score) so the review UI never shows a "high-
  // confidence non-match" — that would be confusing for users and could
  // cause downstream callers to treat the absent doc_id as accidental.
  if (
    llmResponse.chosen_document_id === null &&
    llmResponse.confidence >= MEDIUM_TIER_THRESHOLD
  ) {
    return {
      matched_document_id: null,
      confidence_score: 0,
      confidence_tier: 'unmatched',
      candidates,
      reasoning:
        llmResponse.reasoning ||
        'LLM angav ingen matchning trots hög konfidens',
      llm_used: true,
    }
  }

  // Story 24.3 QA gate DESIGN-001 (matcher-layer enforcement): if the LLM
  // picked a candidate whose underlying match was Branch-B-only (suffix-tail
  // match with prefix mismatch — the user wrote an ambiguous id like
  // "2020:5"), cap the surfaced score at HIGH_TIER_THRESHOLD - 0.01 so the
  // tier lands at MEDIUM. The fuzzy_score cap in match-candidates.ts shapes
  // what the LLM sees but doesn't constrain its own confidence output, so
  // the final say on tier has to live here.
  //
  // Story 24.6 follow-up — title-rescue override: when the chosen candidate's
  // title trigram is also a strong match (≥ 0.5), the user's bare doc number
  // is no longer genuinely ambiguous (the title pins down which series they
  // mean). Skip the cap so e.g. `"Arbetsmiljölag" + "1977:1160"` lands HIGH
  // instead of being forced into MEDIUM-tier review.
  const TITLE_RESCUE_THRESHOLD = 0.5
  let finalScore = llmResponse.confidence
  if (llmResponse.chosen_document_id !== null) {
    const chosenCandidate = candidates.find(
      (c) => c.document_id === llmResponse.chosen_document_id
    )
    const branchBOnly =
      chosenCandidate != null &&
      chosenCandidate.match_signals.document_number_exact === false &&
      chosenCandidate.match_signals.document_number_suffix_match === true
    const titleStronglyConfirms =
      (chosenCandidate?.match_signals.title_trigram_score ?? 0) >=
      TITLE_RESCUE_THRESHOLD
    if (
      branchBOnly &&
      !titleStronglyConfirms &&
      finalScore >= HIGH_TIER_THRESHOLD
    ) {
      finalScore = HIGH_TIER_THRESHOLD - 0.01
    }
  }

  const tier = tierFromScore(finalScore)
  return {
    matched_document_id: llmResponse.chosen_document_id,
    confidence_score: finalScore,
    confidence_tier: tier,
    candidates,
    reasoning: llmResponse.reasoning,
    llm_used: true,
  }
}

// ============================================================================
// matchRowsBatch — concurrency-capped fan-out
// ============================================================================

export async function matchRowsBatch(
  inputs: MatcherInput[],
  options?: MatchOptions
): Promise<MatchResult[]> {
  const concurrency = options?.concurrency ?? 10
  const limit = pLimit(concurrency)

  // Reuse client across all calls so prompt caching can amortise.
  const sharedClient = getAnthropicClient(options)
  const optsWithClient: MatchOptions = {
    ...(options ?? {}),
    anthropicClient: sharedClient,
  }

  return Promise.all(
    inputs.map((input) => limit(() => matchRow(input, optsWithClient)))
  )
}

// ============================================================================
// LLM call with retry + rate-limit backoff
// ============================================================================

async function callMatcherLlm(
  input: MatcherInput,
  candidates: MatchCandidate[],
  options?: MatchOptions
): Promise<LlmMatchResponse | null> {
  const client = getAnthropicClient(options)
  const modelId = options?.modelId ?? DEFAULT_MODEL_ID
  const userPrompt = buildMatcherUserPrompt({
    titel: input.titel,
    sfs_nummer: input.sfs_nummer,
    omrade: input.omrade,
    kommentar: input.kommentar,
    candidates,
  })

  for (let attempt = 0; attempt <= PARSE_FAILURE_RETRIES; attempt++) {
    try {
      const response = await callWithRateLimitBackoff(
        client,
        modelId,
        userPrompt
      )

      const textBlock = response.content.find((b) => b.type === 'text')
      if (!textBlock || textBlock.type !== 'text') {
        throw new Error('No text block in response')
      }

      // Telemetry — write per LLM call (fail-safe).
      const usage = response.usage
      if (options?.telemetry) {
        await writeUsageEvent(options.telemetry, {
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          cacheReadInputTokens: usage.cache_read_input_tokens ?? 0,
          cacheWriteInputTokens: usage.cache_creation_input_tokens ?? 0,
        })
      }

      const json = extractJson(textBlock.text)
      const parsed = LlmMatchResponseSchema.safeParse(json)
      if (!parsed.success) {
        if (attempt < PARSE_FAILURE_RETRIES) continue
        return null
      }

      // Validate that chosen_document_id (if non-null) is actually one of
      // the candidates we sent — guards against the LLM hallucinating IDs.
      if (
        parsed.data.chosen_document_id !== null &&
        !candidates.some(
          (c) => c.document_id === parsed.data.chosen_document_id
        )
      ) {
        if (attempt < PARSE_FAILURE_RETRIES) continue
        return null
      }

      return parsed.data
    } catch (err) {
      console.error('matcher LLM error', err)
      if (attempt < PARSE_FAILURE_RETRIES) continue
      return null
    }
  }
  return null
}

/**
 * Single Anthropic call with exponential backoff for 429 rate-limit
 * responses. Retries up to RATE_LIMIT_MAX_RETRIES times; throws on the
 * final attempt.
 */
async function callWithRateLimitBackoff(
  client: Anthropic,
  modelId: string,
  userPrompt: string
): Promise<Anthropic.Message> {
  let lastErr: unknown = null
  for (let attempt = 0; attempt <= RATE_LIMIT_MAX_RETRIES; attempt++) {
    try {
      return await client.messages.create({
        model: modelId,
        max_tokens: MAX_TOKENS,
        // Wrap system prompt with cache_control so subsequent calls within
        // the 5-min ephemeral TTL hit the cache (Story 14.26 pattern).
        system: [
          {
            type: 'text',
            text: MATCHER_SYSTEM_PROMPT,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [{ role: 'user', content: userPrompt }],
      })
    } catch (err) {
      lastErr = err
      const isRateLimit =
        err instanceof Anthropic.APIError && err.status === 429
      if (!isRateLimit || attempt === RATE_LIMIT_MAX_RETRIES) {
        throw err
      }
      const backoffMs = Math.min(8000, 500 * 2 ** attempt) // 500, 1000, 2000, 4000
      await new Promise((r) => setTimeout(r, backoffMs))
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Unreachable')
}

// Exposed for tests
export const __test__ = {
  tierFromScore,
  writeUsageEvent,
}
