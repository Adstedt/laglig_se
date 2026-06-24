/**
 * Story 19.14: Per-context adaptive-thinking effort for the AI chat route.
 *
 * Replaces the deprecated fixed `THINKING_BUDGET` (budgetTokens) map. On the
 * Anthropic path the chat route passes
 * `providerOptions.anthropic = { thinking: { type: 'adaptive', display: 'summarized' }, effort }`.
 * This is *adaptive* thinking: the model self-regulates whether/how much to think
 * per turn within the effort ceiling, skipping thinking entirely on trivial turns
 * — which is exactly what makes enabling reasoning for the previously-disabled
 * `global` chat safe.
 *
 * IMPORTANT: `effort` alone (no `thinking` block) does NOT enable adaptive
 * thinking — on Sonnet 4.6 an omitted `thinking` block means thinking is
 * DISABLED (verified live). Adaptive REQUIRES `thinking: { type: 'adaptive' }`;
 * `effort` only guides how much.
 *
 * Docs-verified (AC 12, 2026-06-23) — both against official Anthropic docs and
 * a LIVE Sonnet 4.6 call:
 *   - True adaptive thinking REQUIRES `thinking: { type: 'adaptive' }`. The
 *     `effort` param is *combined with* it, not a substitute. On Sonnet 4.6,
 *     omitting the `thinking` block = thinking DISABLED (confirmed live: an
 *     effort-only payload produced 0 reasoning chars; `budgetTokens` produced
 *     1008). So the effort-only form is NOT adaptive — it's off.
 *   - `@ai-sdk/anthropic@3.0.23` (the original install) did NOT accept
 *     `thinking.type: 'adaptive'` (Zod `enabled|disabled` only) → "invalid
 *     anthropic provider options". Story 19.14 bumped the dep to `^3.0.85`,
 *     which adds the discriminated `thinking: { type:'adaptive', display }` form
 *     plus `effort` (`low|medium|high|xhigh|max`).
 *   - `ai@6.0.50` has NO portable top-level `reasoning` param, so the
 *     provider-options form is the form used (Task 4 decision).
 *   - `display: 'summarized'` is set explicitly: it's the Sonnet 4.6 default
 *     today (so summaries render as before), AND it future-proofs the Opus
 *     4.7/4.8 `display:'omitted'` trap flagged in the story's Dev Notes.
 *
 * Effort values are LOCKED by SM sign-off (2026-06-23):
 *   change → high, task → medium, law → medium, global → medium.
 * `max` (and `xhigh`) are deliberately avoided (90s `maxDuration` guardrail).
 */

/**
 * The four chat context types. Exhaustive — adding a context is a compile error
 * until it gets an effort value in {@link THINKING_EFFORT}.
 */
export type ChatContextType = 'global' | 'task' | 'law' | 'change'

/**
 * Effort levels we use. `@ai-sdk/anthropic@3.0.85` also accepts `xhigh|max`, but
 * those are intentionally excluded here (90s `maxDuration` guardrail — AC 3/AC 9).
 */
export type ChatThinkingEffort = 'low' | 'medium' | 'high'

/**
 * Per-context adaptive-thinking effort. A `Record` over the FULL
 * {@link ChatContextType} union, so a missing context is a TYPE ERROR (AC 11),
 * never a silent disable (the old map fell through to `0` for `global`).
 */
export const THINKING_EFFORT: Record<ChatContextType, ChatThinkingEffort> = {
  change: 'high',
  task: 'medium',
  law: 'medium',
  global: 'medium',
}

/**
 * Resolve the effort for a (possibly absent) context type. An absent context
 * resolves to `global` — matching the route's `contextTypeUpper` default — so the
 * open-ended dashboard chat still reasons. Always returns a valid effort.
 */
export function resolveChatEffort(
  contextType: ChatContextType | undefined
): ChatThinkingEffort {
  return THINKING_EFFORT[contextType ?? 'global']
}

/**
 * The adaptive-thinking provider-options shape (Anthropic path). A `type` alias
 * (not an `interface`) so it stays assignable to the AI SDK's
 * `ProviderOptions` (`Record<string, JSONObject>`) — interfaces lack the implicit
 * index signature that assignment requires.
 */
export type ChatThinkingProviderOptions = {
  anthropic: {
    thinking: { type: 'adaptive'; display: 'summarized' }
    effort: ChatThinkingEffort
  }
}

/**
 * Build the Anthropic adaptive-thinking `providerOptions` for a chat turn, or
 * `undefined` on any non-Anthropic provider (the OpenAI fallback stays
 * thinking-less — AC 4). Adaptive thinking = `thinking: { type: 'adaptive' }`
 * (the model self-regulates whether/how much to think per turn) guided by the
 * per-context `effort` ceiling. `display: 'summarized'` makes the reasoning
 * summaries render in the UI and future-proofs the Opus `omitted`-default trap.
 */
export function buildChatThinkingProviderOptions(
  modelProvider: string,
  contextType: ChatContextType | undefined
): ChatThinkingProviderOptions | undefined {
  if (modelProvider !== 'anthropic') return undefined
  return {
    anthropic: {
      thinking: { type: 'adaptive', display: 'summarized' },
      effort: resolveChatEffort(contextType),
    },
  }
}
