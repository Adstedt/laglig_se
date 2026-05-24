/**
 * Unit tests for buildModelMessages (Story 19.1, Task 5 + 8).
 * Pure mapper — no mocks needed.
 */

import { describe, it, expect } from 'vitest'
import type { UIMessage } from 'ai'
import { buildModelMessages } from '@/lib/agent/build-model-messages'
import type { AttachmentContentBlock } from '@/lib/agent/attachments-to-content'

function userMsg(text: string): UIMessage {
  return {
    id: text,
    role: 'user',
    parts: [{ type: 'text', text }],
  } as UIMessage
}
function assistantMsg(text: string): UIMessage {
  return {
    id: text,
    role: 'assistant',
    parts: [{ type: 'text', text }],
  } as UIMessage
}

const pdfBlock: AttachmentContentBlock = {
  type: 'file',
  mediaType: 'application/pdf',
  filename: 'policy.pdf',
  data: 'YmFzZTY0',
}

describe('buildModelMessages', () => {
  it('merges attachment blocks into the LAST user message (blocks before text)', () => {
    const out = buildModelMessages(
      [userMsg('första'), assistantMsg('svar'), userMsg('läs bilagan')],
      [pdfBlock]
    )
    expect(out).toHaveLength(3)
    // history user message stays text-only
    expect(out[0]).toEqual({ role: 'user', content: 'första' })
    expect(out[1]).toEqual({ role: 'assistant', content: 'svar' })
    // last user message → array content with the block first
    expect(out[2]).toEqual({
      role: 'user',
      content: [pdfBlock, { type: 'text', text: 'läs bilagan' }],
    })
  })

  it('no attachments → all messages text-only', () => {
    const out = buildModelMessages([userMsg('hej'), assistantMsg('hej då')], [])
    expect(out).toEqual([
      { role: 'user', content: 'hej' },
      { role: 'assistant', content: 'hej då' },
    ])
  })

  it('does not merge when the last message is not a user message', () => {
    const out = buildModelMessages(
      [userMsg('fråga'), assistantMsg('sista är assistent')],
      [pdfBlock]
    )
    expect(out[1]).toEqual({ role: 'assistant', content: 'sista är assistent' })
  })

  it('joins multiple text parts with newlines', () => {
    const m = {
      id: 'm',
      role: 'user',
      parts: [
        { type: 'text', text: 'rad1' },
        { type: 'text', text: 'rad2' },
      ],
    } as UIMessage
    const out = buildModelMessages([m], [])
    expect(out[0]).toEqual({ role: 'user', content: 'rad1\nrad2' })
  })
})
