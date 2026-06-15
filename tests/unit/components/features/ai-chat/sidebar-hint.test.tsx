import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChatDetailProvider } from '@/lib/ai/chat-detail-context'
import { ChatMessage } from '@/components/features/ai-chat/chat-message'
import type { UIMessage } from 'ai'

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
  // Post-redesign (b502d583): the "Visa detaljer" suggest-chip is gated behind
  // the EXPANDABLE_TOOLS allowlist (only tools with a curated detail view —
  // search_laws, web_search). A sidebarHint=suggest result on such a tool still
  // renders the clickable "Visa detaljer" affordance that opens the sidebar.
  it('renders clickable "Visa detaljer" affordance for sidebarHint=suggest on an expandable tool', () => {
    const message: UIMessage = {
      id: 'msg-1',
      role: 'assistant',
      content: '',
      parts: [
        {
          type: 'tool-invocation' as const,
          toolInvocationId: 'tool-1',
          toolName: 'search_laws',
          state: 'output-available' as const,
          step: 0,
          args: {},
          output: {
            data: [{ title: 'Test doc' }],
            _meta: {
              tool: 'search_laws',
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

    // The affordance renders as a dedicated clickable button (Eye icon +
    // "Visa detaljer"), distinct from the clickable row label itself.
    const chip = screen.getByRole('button', { name: 'Visa detaljer' })
    expect(chip).toBeDefined()
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
