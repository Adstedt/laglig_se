/**
 * Story 14.37: Anthropic prompt caching v2 — tool-loop conversation caching.
 * Story 14.38: Anthropic prompt caching v3 — cross-turn history caching.
 *
 * `withLastMessageCached` marks the LAST message in a conversation with an
 * Anthropic `cacheControl: { type: 'ephemeral' }` breakpoint. Wired into
 * `streamText`'s `prepareStep` on the Anthropic path, it places a *moving*
 * breakpoint on whatever message is last at the start of each internal agent
 * step (including appended tool-result messages). The growing tool-loop history
 * is then read from cache on subsequent steps instead of re-billed at full input
 * price — see AI SDK cookbook "dynamic prompt caching".
 *
 * `withEphemeralCacheControl` is the shared primitive that attaches the
 * breakpoint to a single message (merging with any existing providerOptions).
 * Story 14.38 reuses it in `buildModelMessages` to mark the stable-history
 * boundary (bp2).
 *
 * Pure + synchronous so they're unit-testable; only the Anthropic provider reads
 * `providerOptions.anthropic.cacheControl`, so this is a no-op for other
 * providers even if accidentally applied.
 */

import type { ModelMessage } from 'ai'

/**
 * Return `message` with an Anthropic ephemeral cache breakpoint attached,
 * preserving any existing providerOptions (other providers + other anthropic
 * keys). Does not mutate the input.
 */
export function withEphemeralCacheControl(message: ModelMessage): ModelMessage {
  return {
    ...message,
    providerOptions: {
      ...message.providerOptions,
      anthropic: {
        ...(message.providerOptions?.anthropic ?? {}),
        cacheControl: { type: 'ephemeral' },
      },
    },
  }
}

export function withLastMessageCached(
  messages: ModelMessage[]
): ModelMessage[] {
  if (messages.length === 0) return messages
  const lastIndex = messages.length - 1
  return messages.map((message, index) =>
    index === lastIndex ? withEphemeralCacheControl(message) : message
  )
}
