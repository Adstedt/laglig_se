import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatDetailProvider } from '@/lib/ai/chat-detail-context'
import { ChatMessage } from '@/components/features/ai-chat/chat-message'
import type { UIMessage } from 'ai'

// Mock streaming text hook to pass through
vi.mock('@/lib/hooks/use-streaming-text', () => ({
  useStreamingText: ({ text }: { text: string }) => text,
}))

// Mock streamdown to render plain text
vi.mock('streamdown', () => ({
  Streamdown: ({ children }: { children: string }) => <span>{children}</span>,
}))

vi.mock('@streamdown/code', () => ({
  code: {},
}))

vi.mock('@/lib/ai/rehype-citation-pills', () => ({
  rehypeCitationPills: () => {},
}))

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <ChatDetailProvider>{children}</ChatDetailProvider>
}

describe('sidebarHint behavior in ToolCallRow', () => {
  it('renders "Visa detaljer" chip for sidebarHint=suggest tool results', () => {
    const message: UIMessage = {
      id: 'msg-1',
      role: 'assistant',
      content: '',
      parts: [
        {
          type: 'tool-invocation' as const,
          toolInvocationId: 'tool-1',
          toolName: 'get_document_details',
          state: 'output-available' as const,
          step: 0,
          args: {},
          output: {
            data: { title: 'Test doc' },
            _meta: {
              tool: 'get_document_details',
              executionTimeMs: 100,
              resultCount: 1,
              sidebarHint: 'suggest',
            },
          },
        },
      ],
    }

    render(
      <TestWrapper>
        <ChatMessage message={message} isStreaming={false} />
      </TestWrapper>
    )

    expect(screen.getByText('Visa detaljer')).toBeDefined()
  })

  it('does not render "Visa detaljer" chip for sidebarHint=open', () => {
    const message: UIMessage = {
      id: 'msg-2',
      role: 'assistant',
      content: '',
      parts: [
        {
          type: 'tool-invocation' as const,
          toolInvocationId: 'tool-2',
          toolName: 'create_task',
          state: 'output-available' as const,
          step: 0,
          args: {},
          output: {
            confirmation_required: true,
            action: 'create_task',
            params: { title: 'Test' },
            preview: 'Test preview',
            _meta: {
              tool: 'create_task',
              executionTimeMs: 50,
              resultCount: 0,
              sidebarHint: 'open',
            },
          },
        },
      ],
    }

    render(
      <TestWrapper>
        <ChatMessage message={message} isStreaming={false} />
      </TestWrapper>
    )

    expect(screen.queryByText('Visa detaljer')).toBeNull()
  })

  it('does not render "Visa detaljer" chip when no sidebarHint', () => {
    const message: UIMessage = {
      id: 'msg-3',
      role: 'assistant',
      content: '',
      parts: [
        {
          type: 'tool-invocation' as const,
          toolInvocationId: 'tool-3',
          toolName: 'search_laws',
          state: 'output-available' as const,
          step: 0,
          args: {},
          output: {
            data: [],
            _meta: {
              tool: 'search_laws',
              executionTimeMs: 200,
              resultCount: 0,
            },
          },
        },
      ],
    }

    render(
      <TestWrapper>
        <ChatMessage message={message} isStreaming={false} />
      </TestWrapper>
    )

    expect(screen.queryByText('Visa detaljer')).toBeNull()
  })
})
