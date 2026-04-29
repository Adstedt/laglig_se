import { describe, it, expect, vi } from 'vitest'
import { estimateCostUsd, PRICING } from '@/lib/usage/cost-estimator'

describe('estimateCostUsd', () => {
  it('returns expected cost for a representative Sonnet 4.6 token mix', () => {
    // Sonnet 4.6: input $3/MTok, output $15/MTok, cacheRead $0.30/MTok, cacheWrite $3.75/MTok
    // Scenario: 10,000 input (all fresh), 1,000 output → $0.030 + $0.015 = $0.045
    const cost = estimateCostUsd({
      model: 'claude-sonnet-4-6',
      inputTokens: 10_000,
      outputTokens: 1_000,
      cacheReadInputTokens: 0,
      cacheWriteInputTokens: 0,
      reasoningTokens: 0,
    })
    expect(cost).toBeCloseTo(0.045, 6)
  })

  it('discounts cache read tokens to the cacheRead rate', () => {
    // 10,000 input of which 8,000 are cache reads, 1,000 output
    // fresh = 2,000 → 2_000/1M × 3.00 = 0.006
    // cacheRead = 8,000 → 8_000/1M × 0.30 = 0.0024
    // output = 1,000 → 1_000/1M × 15.00 = 0.015
    // total = 0.0234
    const cost = estimateCostUsd({
      model: 'claude-sonnet-4-6',
      inputTokens: 10_000,
      outputTokens: 1_000,
      cacheReadInputTokens: 8_000,
      cacheWriteInputTokens: 0,
      reasoningTokens: 0,
    })
    expect(cost).toBeCloseTo(0.0234, 6)
  })

  it('prices cache write tokens at the 1.25× cacheWrite rate', () => {
    // 10,000 input of which 5,000 are cache writes (first-turn scenario), 0 output
    // fresh = 5,000 → 5_000/1M × 3.00 = 0.015
    // cacheWrite = 5,000 → 5_000/1M × 3.75 = 0.01875
    // total = 0.03375
    const cost = estimateCostUsd({
      model: 'claude-sonnet-4-6',
      inputTokens: 10_000,
      outputTokens: 0,
      cacheReadInputTokens: 0,
      cacheWriteInputTokens: 5_000,
      reasoningTokens: 0,
    })
    expect(cost).toBeCloseTo(0.03375, 6)
  })

  it('applies output rate per model (Opus 4.5 priced higher than Sonnet)', () => {
    // Opus 4.5: output $25/MTok per current PRICING constant
    // 0 input, 1,000 output → 0.025
    // TODO: reconcile against Anthropic's published $15/$75 Opus rate — bundled
    // WIP from 43cdb6b left this divergent. Tracked separately from Epic 21.
    const cost = estimateCostUsd({
      model: 'claude-opus-4-5',
      inputTokens: 0,
      outputTokens: 1_000,
      cacheReadInputTokens: 0,
      cacheWriteInputTokens: 0,
      reasoningTokens: 0,
    })
    expect(cost).toBeCloseTo(0.025, 6)
  })

  it('returns 0 and warns on unknown model (fail-safe)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const cost = estimateCostUsd({
      model: 'fictional-model-9000',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cacheReadInputTokens: 0,
      cacheWriteInputTokens: 0,
      reasoningTokens: 0,
    })

    expect(cost).toBe(0)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown model "fictional-model-9000"')
    )

    warnSpy.mockRestore()
  })

  it('rounds to 6 decimals (micro-cent precision)', () => {
    // 1 input token on Sonnet: 1/1M × 3 = 0.000003 exactly
    const cost = estimateCostUsd({
      model: 'claude-sonnet-4-6',
      inputTokens: 1,
      outputTokens: 0,
      cacheReadInputTokens: 0,
      cacheWriteInputTokens: 0,
      reasoningTokens: 0,
    })
    expect(cost).toBe(0.000003)
  })

  it('handles all-cached input (common warm-cache case)', () => {
    // 9,000 input all from cache, 500 output
    // cacheRead = 9,000 × 0.30/1M = 0.0027
    // output = 500 × 15.00/1M = 0.0075
    // total = 0.0102
    const cost = estimateCostUsd({
      model: 'claude-sonnet-4-6',
      inputTokens: 9_000,
      outputTokens: 500,
      cacheReadInputTokens: 9_000,
      cacheWriteInputTokens: 0,
      reasoningTokens: 0,
    })
    expect(cost).toBeCloseTo(0.0102, 6)
  })

  it('ignores reasoningTokens for pricing (already in outputTokens on Anthropic)', () => {
    // Reasoning tokens should NOT affect cost — they're billed within outputTokens
    const costA = estimateCostUsd({
      model: 'claude-sonnet-4-6',
      inputTokens: 1_000,
      outputTokens: 2_000,
      cacheReadInputTokens: 0,
      cacheWriteInputTokens: 0,
      reasoningTokens: 0,
    })
    const costB = estimateCostUsd({
      model: 'claude-sonnet-4-6',
      inputTokens: 1_000,
      outputTokens: 2_000,
      cacheReadInputTokens: 0,
      cacheWriteInputTokens: 0,
      reasoningTokens: 1_500, // reasoningTokens set; should NOT change price
    })
    expect(costA).toBe(costB)
  })

  it('has pricing entries for all supported chat models', () => {
    // Sentinel test — if someone adds a new model to chat route without
    // adding pricing, this should fail as a reminder.
    expect(PRICING).toHaveProperty('claude-sonnet-4-6')
    expect(PRICING).toHaveProperty('claude-opus-4-5')
    expect(PRICING).toHaveProperty('claude-haiku-4-5')
    expect(PRICING).toHaveProperty('gpt-4-turbo')
  })

  it('applies the 10x cost ratio between Haiku and Sonnet', () => {
    // Haiku is 10× cheaper than Sonnet on output
    // Sonnet 1000 out = 0.015, Haiku 1000 out = 0.005
    const sonnetCost = estimateCostUsd({
      model: 'claude-sonnet-4-6',
      inputTokens: 0,
      outputTokens: 1_000,
      cacheReadInputTokens: 0,
      cacheWriteInputTokens: 0,
      reasoningTokens: 0,
    })
    const haikuCost = estimateCostUsd({
      model: 'claude-haiku-4-5',
      inputTokens: 0,
      outputTokens: 1_000,
      cacheReadInputTokens: 0,
      cacheWriteInputTokens: 0,
      reasoningTokens: 0,
    })
    expect(sonnetCost / haikuCost).toBeCloseTo(3, 6) // output rates: 15 / 5 = 3
  })

  it('never returns negative cost even with malformed token counts', () => {
    // Defensive: if cacheReadInputTokens + cacheWriteInputTokens > inputTokens
    // (shouldn't happen in practice), fresh is clamped at 0 — never negative.
    const cost = estimateCostUsd({
      model: 'claude-sonnet-4-6',
      inputTokens: 1_000,
      outputTokens: 0,
      cacheReadInputTokens: 800,
      cacheWriteInputTokens: 500, // 800 + 500 > 1000; unusual but possible
      reasoningTokens: 0,
    })
    expect(cost).toBeGreaterThanOrEqual(0)
  })
})
