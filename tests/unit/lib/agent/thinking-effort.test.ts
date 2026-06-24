/**
 * Story 19.14: Adaptive thinking + per-context effort.
 *
 * Pure unit tests for the effort resolver and the Anthropic provider-options
 * builder (no live model calls). Covers the locked per-context effort map
 * (incl. `global` now adaptive-on, not disabled), the absent-context default,
 * the `max`-avoidance guardrail, and the OpenAI path emitting no thinking config.
 */

import { describe, it, expect } from 'vitest'
import {
  THINKING_EFFORT,
  resolveChatEffort,
  buildChatThinkingProviderOptions,
  type ChatContextType,
} from '@/lib/agent/thinking-effort'

describe('Story 19.14: per-context adaptive-thinking effort', () => {
  it('locks effort per context (SM sign-off 2026-06-23)', () => {
    expect(THINKING_EFFORT).toEqual({
      change: 'high',
      task: 'medium',
      law: 'medium',
      global: 'medium',
    })
  })

  it('resolves every context to its locked effort', () => {
    const cases: Array<[ChatContextType, string]> = [
      ['change', 'high'],
      ['task', 'medium'],
      ['law', 'medium'],
      ['global', 'medium'],
    ]
    for (const [ctx, expected] of cases) {
      expect(resolveChatEffort(ctx)).toBe(expected)
    }
  })

  it('enables reasoning for global (regression: was budget 0 / disabled)', () => {
    // The old THINKING_BUDGET map had no `global` key → fell through to 0 → no
    // thinking. Global must now resolve to a real, non-disabled effort.
    expect(resolveChatEffort('global')).toBe('medium')
  })

  it('defaults an absent context to the global effort (matches route default)', () => {
    expect(resolveChatEffort(undefined)).toBe('medium')
    expect(resolveChatEffort(undefined)).toBe(resolveChatEffort('global'))
  })

  it('never uses max/xhigh (90s maxDuration guardrail; available on @ai-sdk/anthropic@3.0.85 but intentionally unused)', () => {
    for (const effort of Object.values(THINKING_EFFORT)) {
      expect(['low', 'medium', 'high']).toContain(effort)
      expect(effort).not.toBe('max')
    }
  })
})

describe('Story 19.14: buildChatThinkingProviderOptions', () => {
  it('Anthropic path emits adaptive thinking + effort (no deprecated budgetTokens)', () => {
    const opts = buildChatThinkingProviderOptions('anthropic', 'change')
    expect(opts).toEqual({
      anthropic: {
        thinking: { type: 'adaptive', display: 'summarized' },
        effort: 'high',
      },
    })
    // Must be the adaptive form, NOT the deprecated fixed-budget shape: a bare
    // effort (no thinking block) disables thinking on Sonnet 4.6.
    expect(opts?.anthropic.thinking).toEqual({
      type: 'adaptive',
      display: 'summarized',
    })
    expect(opts?.anthropic.thinking).not.toHaveProperty('budgetTokens')
  })

  it('Anthropic path is adaptive-on for global too (medium effort)', () => {
    expect(buildChatThinkingProviderOptions('anthropic', 'global')).toEqual({
      anthropic: {
        thinking: { type: 'adaptive', display: 'summarized' },
        effort: 'medium',
      },
    })
  })

  it('Anthropic path with absent context defaults to global effort', () => {
    expect(buildChatThinkingProviderOptions('anthropic', undefined)).toEqual({
      anthropic: {
        thinking: { type: 'adaptive', display: 'summarized' },
        effort: 'medium',
      },
    })
  })

  it('OpenAI path emits no thinking config (AC 4 — fallback stays thinking-less)', () => {
    expect(buildChatThinkingProviderOptions('openai', 'change')).toBeUndefined()
    expect(buildChatThinkingProviderOptions('openai', 'global')).toBeUndefined()
    expect(
      buildChatThinkingProviderOptions('openai', undefined)
    ).toBeUndefined()
  })
})
