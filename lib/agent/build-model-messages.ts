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

  return messages.map((m, i): ModelMessage => {
    const text = textOf(m)

    // Last user message + attachments → array content (blocks before text).
    if (i === lastIndex && m.role === 'user' && attachmentBlocks.length > 0) {
      return {
        role: 'user',
        content: [...attachmentBlocks, { type: 'text', text }],
      }
    }

    if (m.role === 'assistant') return { role: 'assistant', content: text }
    if (m.role === 'system') return { role: 'system', content: text }
    return { role: 'user', content: text }
  })
}
