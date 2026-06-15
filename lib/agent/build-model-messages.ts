/**
 * Story 19.1: map UIMessages → ModelMessages for streamText, merging chat
 * attachment content blocks into the LAST user message only.
 *
 * History messages keep the text-only projection (protects the token budget);
 * the last user message gets its attachment blocks (from `attachmentsToContent`)
 * prepended before its text. Pure + synchronous so it's unit-testable — the
 * route awaits the converter once and passes the resulting blocks here.
 *
 * Story 14.38 (cross-turn prompt caching): the projected text history is the
 * stable, byte-deterministic prefix we cache across turns. Two changes make that
 * work:
 *   1. `pendingActionsBlock` is emitted as a SEPARATE user message immediately
 *      before the current user turn (after the stable-history boundary) instead
 *      of being fused into the last user message. That keeps every history
 *      message pure text, so when a user turn later becomes history its bytes
 *      match what was sent the turn it was live (the prefix-match precondition).
 *   2. `options.cacheHistory` (Anthropic path) marks the LAST stable-history
 *      message with an ephemeral cache breakpoint (bp2), so a warm follow-up
 *      turn reads the accumulated conversation from cache instead of re-billing
 *      it at full input price.
 */

import type { ModelMessage, UIMessage } from 'ai'
import type { AttachmentContentBlock } from './attachments-to-content'
import { withEphemeralCacheControl } from './prompt-cache'

function textOf(message: UIMessage): string {
  return (
    message.parts
      ?.filter((p) => p.type === 'text')
      .map((p) => ('text' in p ? p.text : ''))
      .join('\n') ?? ''
  )
}

export interface BuildModelMessagesOptions {
  /**
   * Story 14.38 (bp2): Anthropic path only. When true, the LAST stable-history
   * message is marked with an Anthropic ephemeral cache breakpoint so a warm
   * follow-up turn reads the prior turns' conversation from cache. No-op when
   * there is no history (single-turn). The OpenAI path passes `false` (or omits
   * it) → no `cacheControl` is applied anywhere.
   */
  cacheHistory?: boolean
}

export function buildModelMessages(
  messages: UIMessage[],
  attachmentBlocks: AttachmentContentBlock[],
  // Story 14.37/14.38: the <pending_agent_actions> workflow-state block. On the
  // Anthropic path the route passes it here; it is emitted as a separate user
  // message right before the current turn (see file header). The OpenAI path
  // passes null (the block stays in the system prompt, unchanged).
  pendingActionsBlock?: string | null,
  options?: BuildModelMessagesOptions
): ModelMessage[] {
  const lastIndex = messages.length - 1

  const out: ModelMessage[] = []
  // Index in `out` of the final stable-history message — i.e. everything before
  // the current user turn and its volatile pending-actions block. -1 = no
  // history (single-turn conversation), so bp2 has nothing to mark.
  let lastHistoryIndex = -1

  messages.forEach((m, i) => {
    const text = textOf(m)

    // Current (last) user turn. The per-turn-volatile pendingActionsBlock is
    // emitted here as a SEPARATE user message placed immediately before the
    // current turn (Story 14.38), so history messages stay pure text. Attachment
    // blocks still merge into the user message (blocks → array content). Omit
    // the text block when there's no text so we never send an empty one.
    if (i === lastIndex && m.role === 'user') {
      if (pendingActionsBlock) {
        out.push({ role: 'user', content: pendingActionsBlock })
      }
      if (attachmentBlocks.length > 0) {
        out.push({
          role: 'user',
          content: text
            ? [...attachmentBlocks, { type: 'text', text }]
            : [...attachmentBlocks],
        })
      } else {
        out.push({ role: 'user', content: text })
      }
      return
    }

    // Anthropic rejects empty text content blocks ("text content blocks must be
    // non-empty"). An assistant turn that was ONLY a tool proposal (no prose)
    // persists with empty content; once loaded into history it would otherwise
    // be forwarded here as an empty block and fail the whole next turn. Its
    // proposals are re-injected to the model via the <pending_agent_actions>
    // block, so the empty turn carries nothing for the model — drop it. (Also
    // covers legacy pre-fix turns whose prose wasn't captured.)
    if (text.trim() === '') return

    if (m.role === 'assistant') out.push({ role: 'assistant', content: text })
    else if (m.role === 'system') out.push({ role: 'system', content: text })
    else out.push({ role: 'user', content: text })
    lastHistoryIndex = out.length - 1
  })

  // Story 14.38 (bp2): mark the stable-history boundary with an Anthropic
  // ephemeral cache breakpoint. The breakpoint MOVES forward each turn (always
  // the last history message), but the cached prefix *content* is byte-stable —
  // Anthropic keys off the content bytes, not the marker, so the prior-turn
  // prefix still cache-hits. Anthropic path only; no-op without history.
  if (options?.cacheHistory && lastHistoryIndex >= 0) {
    const boundary = out[lastHistoryIndex]
    if (boundary) out[lastHistoryIndex] = withEphemeralCacheControl(boundary)
  }

  return out
}
