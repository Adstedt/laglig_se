/**
 * Story 19.1: map UIMessages → ModelMessages for streamText, merging chat
 * attachment content blocks into the LAST user message only.
 *
 * History messages keep the text-only projection (protects the token budget);
 * the last user message gets its attachment blocks (from `attachmentsToContent`)
 * prepended before its text. Pure + synchronous so it's unit-testable — the
 * route awaits the converter once and passes the resulting blocks here.
 */

import type { ModelMessage, UIMessage } from 'ai'
import type { AttachmentContentBlock } from './attachments-to-content'

function textOf(message: UIMessage): string {
  return (
    message.parts
      ?.filter((p) => p.type === 'text')
      .map((p) => ('text' in p ? p.text : ''))
      .join('\n') ?? ''
  )
}

export function buildModelMessages(
  messages: UIMessage[],
  attachmentBlocks: AttachmentContentBlock[]
): ModelMessage[] {
  const lastIndex = messages.length - 1

  const out: ModelMessage[] = []
  messages.forEach((m, i) => {
    const text = textOf(m)

    // Last user message + attachments → array content (blocks before text).
    // Omit the text block when there's no text so we never send an empty one.
    if (i === lastIndex && m.role === 'user' && attachmentBlocks.length > 0) {
      out.push({
        role: 'user',
        content: text
          ? [...attachmentBlocks, { type: 'text', text }]
          : [...attachmentBlocks],
      })
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
  })
  return out
}
