import { describe, it, expect } from 'vitest'
import {
  formatConversationAsText,
  getExportFilename,
} from '../format-conversation-export'
import type { ChatMessageData } from '@/app/actions/ai-chat'
import type { ChatMessageRole, ChatContextType } from '@prisma/client'

function makeDbMessage(
  overrides: Partial<ChatMessageData> & {
    content: string
    role: ChatMessageRole
  }
): ChatMessageData {
  return {
    id: 'msg-1',
    metadata: null,
    contextType: 'GLOBAL' as ChatContextType,
    contextId: null,
    createdAt: new Date('2026-03-16T10:30:00'),
    ...overrides,
  }
}

describe('formatConversationAsText', () => {
  it('formats a conversation with correct role labels', () => {
    const messages: ChatMessageData[] = [
      makeDbMessage({
        id: '1',
        role: 'USER',
        content: 'Hej, vad säger lagen?',
      }),
      makeDbMessage({
        id: '2',
        role: 'ASSISTANT',
        content: 'Enligt arbetsmiljölagen...',
        createdAt: new Date('2026-03-16T10:31:00'),
      }),
    ]

    const text = formatConversationAsText(messages)

    expect(text).toContain('Laglig.se')
    expect(text).toContain('Du:')
    expect(text).toContain('Laglig AI:')
    expect(text).toContain('Hej, vad säger lagen?')
    expect(text).toContain('Enligt arbetsmiljölagen...')
    expect(text).toContain('Antal meddelanden: 2')
  })

  it('includes timestamps in YYYY-MM-DD HH:mm format', () => {
    const messages: ChatMessageData[] = [
      makeDbMessage({
        id: '1',
        role: 'USER',
        content: 'Test',
        createdAt: new Date('2026-03-16T10:30:00'),
      }),
    ]

    const text = formatConversationAsText(messages)
    expect(text).toContain('[2026-03-16 10:30]')
  })

  it('strips markdown formatting', () => {
    const messages: ChatMessageData[] = [
      makeDbMessage({
        id: '1',
        role: 'ASSISTANT',
        content:
          '**Bold text** and *italic* and `code` and [link](http://test.com)',
      }),
    ]

    const text = formatConversationAsText(messages)
    expect(text).toContain('Bold text')
    expect(text).toContain('italic')
    expect(text).toContain('code')
    expect(text).toContain('link')
    expect(text).not.toContain('**')
    expect(text).not.toContain('`')
    expect(text).not.toContain('http://test.com')
  })

  it('strips citation markers', () => {
    const messages: ChatMessageData[] = [
      makeDbMessage({
        id: '1',
        role: 'ASSISTANT',
        content: 'Lagen säger X. [Källa: SFS 2020:100]',
      }),
    ]

    const text = formatConversationAsText(messages)
    expect(text).toContain('Lagen säger X.')
    expect(text).not.toContain('[Källa:')
  })
})

describe('getExportFilename', () => {
  it('returns filename with correct format', () => {
    const filename = getExportFilename()
    expect(filename).toMatch(/^laglig-konversation-\d{4}-\d{2}-\d{2}\.txt$/)
  })
})
