/**
 * Cost estimator — pure function mapping (model, token breakdown) → USD cost.
 *
 * Story 14.27: used by `app/api/chat/route.ts` onFinish callback to compute
 * `cost_usd_estimate` for each ChatUsageEvent row at write time.
 *
 * Pricing sources (verify before major rate updates):
 * - Anthropic: https://www.anthropic.com/pricing
 * - OpenAI: https://openai.com/api/pricing
 *
 * Rates are per 1M tokens in USD. Cache reads are typically 10% of input rate;
 * cache writes are 1.25× input rate (5-min TTL ephemeral).
 *
 * Unknown models return 0 and log a warning — fail-safe, no throw. This keeps
 * telemetry collection robust against model-name drift (e.g., a new Anthropic
 * model shipping before this table is updated).
 */

export interface ModelPricing {
  /** Input token rate per 1M tokens, USD */
  input: number
  /** Output token rate per 1M tokens, USD */
  output: number
  /** Cache read rate per 1M tokens, USD (typically 10% of input) */
  cacheRead: number
  /** Cache write rate per 1M tokens, USD (typically 1.25× input for 5-min TTL) */
  cacheWrite: number
}

export const PRICING: Record<string, ModelPricing> = {
  // Anthropic Claude 4.x family
  'claude-sonnet-4-6': {
    input: 3.0,
    output: 15.0,
    cacheRead: 0.3,
    cacheWrite: 3.75,
  },
  'claude-opus-4-5': {
    input: 15.0,
    output: 75.0,
    cacheRead: 1.5,
    cacheWrite: 18.75,
  },
  'claude-haiku-4-5': {
    input: 1.0,
    output: 5.0,
    cacheRead: 0.1,
    cacheWrite: 1.25,
  },
  // OpenAI — no prompt-caching feature parity on this model
  'gpt-4-turbo': {
    input: 10.0,
    output: 30.0,
    cacheRead: 0,
    cacheWrite: 0,
  },
}

export interface EstimateCostInput {
  model: string
  /** Total input tokens billed (fresh + cached combined) */
  inputTokens: number
  outputTokens: number
  /** Subset of inputTokens — tokens read from cache */
  cacheReadInputTokens: number
  /** Subset of inputTokens — tokens written to cache this turn */
  cacheWriteInputTokens: number
  /**
   * Reasoning tokens (Story 14.20 extended thinking).
   * NOTE: On Anthropic these are already billed within `outputTokens` — this
   * field is captured for analysis but NOT priced separately here.
   */
  reasoningTokens: number
}

/**
 * Returns USD cost estimate for a single chat turn, rounded to 6 decimals
 * (micro-cent precision). Returns 0 for unknown models (logs a warning).
 *
 * Formula (per 1M tokens):
 *   cost = (fresh_input × input_rate)
 *        + (cache_read × cacheRead_rate)
 *        + (cache_write × cacheWrite_rate)
 *        + (output × output_rate)
 *
 * Where fresh_input = inputTokens − cacheReadInputTokens − cacheWriteInputTokens
 * (Anthropic's `inputTokens` is the total billed; we carve out the cached
 * portions that are billed at different rates.)
 */
export function estimateCostUsd(input: EstimateCostInput): number {
  const rates = PRICING[input.model]
  if (!rates) {
    // eslint-disable-next-line no-console -- fail-safe warning, should not be hot path
    console.warn(
      `[cost-estimator] Unknown model "${input.model}" — returning 0. Update PRICING table in lib/usage/cost-estimator.ts.`
    )
    return 0
  }

  const freshInputTokens = Math.max(
    0,
    input.inputTokens - input.cacheReadInputTokens - input.cacheWriteInputTokens
  )

  const cost =
    (freshInputTokens / 1_000_000) * rates.input +
    (input.cacheReadInputTokens / 1_000_000) * rates.cacheRead +
    (input.cacheWriteInputTokens / 1_000_000) * rates.cacheWrite +
    (input.outputTokens / 1_000_000) * rates.output

  // Round to 6 decimals (micro-cent precision)
  return Math.round(cost * 1_000_000) / 1_000_000
}
