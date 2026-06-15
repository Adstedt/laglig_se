import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { UIMessage } from 'ai'
import type { ChatDetailItem } from '@/lib/ai/chat-detail-context'
import {
  ChatMessage,
  __resetAutoOpenedForTests,
} from '@/components/features/ai-chat/chat-message'

// ---------------------------------------------------------------------------
// Mocks — mirror the setup used in sidebar-hint.test.tsx
// ---------------------------------------------------------------------------

vi.mock('streamdown', () => ({
  Streamdown: ({ children }: { children: string }) => <span>{children}</span>,
}))

vi.mock('@streamdown/code', () => ({
  code: {},
}))

vi.mock('@/lib/ai/rehype-citation-pills', () => ({
  rehypeCitationPills: () => {},
}))

// Mock the chat-detail-context so we can spy on openDetail directly. The real
// provider's toggle-on-reopen logic would hide a double-fire (second call
// would close rather than reopen), so a direct spy is necessary for the
// auto-open dedup tests.
const mockOpenDetail = vi.fn()
const mockChatDetail = {
  activeDetail: null as ChatDetailItem | null,
  openDetail: mockOpenDetail,
  closeDetail: vi.fn(),
  systemMessages: [],
  addSystemMessage: vi.fn(),
  removeSystemMessage: vi.fn(),
}

vi.mock('@/lib/ai/chat-detail-context', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/ai/chat-detail-context')>()
  return {
    ...actual,
    useChatDetail: () => mockChatDetail,
    useChatDetailSafe: () => mockChatDetail,
    // Pass-through provider — our mock chatDetail is returned regardless.
    ChatDetailProvider: ({ children }: { children: ReactNode }) => (
      <>{children}</>
    ),
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toolPart(opts: {
  toolName: string
  toolCallId: string
  state: 'input-available' | 'output-available' | 'output-error'
  input?: Record<string, unknown>
  output?: unknown
}): UIMessage['parts'][number] {
  return {
    type: 'tool-invocation' as const,
    toolInvocationId: opts.toolCallId,
    toolName: opts.toolName,
    state: opts.state,
    step: 0,
    args: opts.input ?? {},
    input: opts.input ?? {},
    output: opts.output,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

function assistantMessage(id: string, parts: UIMessage['parts']): UIMessage {
  return {
    id,
    role: 'assistant',
    content: '',
    parts,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CollapsedToolGroup (story 14.18)', () => {
  beforeEach(() => {
    __resetAutoOpenedForTests()
    mockOpenDetail.mockReset()
    mockChatDetail.activeDetail = null
  })

  // 5.2
  it('renders two completed tool calls as a single summary row with dot separator', () => {
    const msg = assistantMessage('msg-5-2', [
      toolPart({
        toolName: 'get_company_context',
        toolCallId: 'tc-1',
        state: 'output-available',
        output: {
          data: { name: 'Acme' },
          _meta: {
            tool: 'get_company_context',
            executionTimeMs: 10,
            resultCount: 1,
          },
        },
      }),
      toolPart({
        toolName: 'get_change_details',
        toolCallId: 'tc-2',
        state: 'output-available',
        output: {
          data: { amendment: 'SFS 2025:1' },
          _meta: {
            tool: 'get_change_details',
            executionTimeMs: 10,
            resultCount: 1,
          },
        },
      }),
    ])

    render(<ChatMessage message={msg} isStreaming={false} />)

    expect(screen.getByText('Hämtade företagskontext')).toBeDefined()
    expect(screen.getByText('Hämtade ändringsdetaljer')).toBeDefined()
    expect(screen.getByText('·')).toBeDefined()
    // Chevron toggle is an icon-only button with an aria-label
    expect(screen.getByRole('button', { name: /Visa detaljer/ })).toBeDefined()
  })

  // regression: step-start markers interleaved between multi-step tool calls
  // must not break the grouping run (real AI SDK messages emit a step-start
  // before each tool-use step; the original tests omitted these).
  it('groups tool calls even when step-start markers are interleaved', () => {
    const mkSearch = (id: string, query: string) =>
      toolPart({
        toolName: 'search_laws',
        toolCallId: id,
        state: 'output-available',
        input: { query },
        output: {
          data: [],
          _meta: { tool: 'search_laws', executionTimeMs: 10, resultCount: 0 },
        },
      })

    const msg = assistantMessage('msg-step-start', [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { type: 'step-start' } as any,
      mkSearch('tc-1', 'bokföringslag svenska regler'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { type: 'step-start' } as any,
      mkSearch('tc-2', 'verifikationer arkivering'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { type: 'step-start' } as any,
      mkSearch('tc-3', 'löpande bokföring'),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { type: 'step-start' } as any,
      mkSearch('tc-4', 'arkivering sju år'),
    ])

    render(<ChatMessage message={msg} isStreaming={false} />)

    expect(screen.getByText(/Sökte i lagdatabasen \(4\)/)).toBeDefined()
    expect(screen.getByRole('button', { name: /Visa detaljer/ })).toBeDefined()
  })

  // 5.3
  it('coalesces repeated same-tool runs with a count suffix', () => {
    const msg = assistantMessage('msg-5-3', [
      toolPart({
        toolName: 'search_laws',
        toolCallId: 'tc-1',
        state: 'output-available',
        input: { query: 'arbetsmiljö' },
        output: {
          data: [],
          _meta: { tool: 'search_laws', executionTimeMs: 10, resultCount: 0 },
        },
      }),
      toolPart({
        toolName: 'search_laws',
        toolCallId: 'tc-2',
        state: 'output-available',
        input: { query: 'riskbedömning' },
        output: {
          data: [],
          _meta: { tool: 'search_laws', executionTimeMs: 10, resultCount: 0 },
        },
      }),
      toolPart({
        toolName: 'search_laws',
        toolCallId: 'tc-3',
        state: 'output-available',
        input: { query: 'kemikalier' },
        output: {
          data: [],
          _meta: { tool: 'search_laws', executionTimeMs: 10, resultCount: 0 },
        },
      }),
    ])

    render(<ChatMessage message={msg} isStreaming={false} />)

    expect(screen.getByText(/Sökte i lagdatabasen \(3\)/)).toBeDefined()
    // No dot separator (single coalesced run)
    expect(screen.queryByText('·')).toBeNull()
  })

  // 5.4
  it('excludes hidden tools from the summary row', () => {
    const msg = assistantMessage('msg-5-4', [
      toolPart({
        toolName: 'get_company_context',
        toolCallId: 'tc-1',
        state: 'output-available',
        output: {
          data: {},
          _meta: {
            tool: 'get_company_context',
            executionTimeMs: 10,
            resultCount: 1,
          },
        },
      }),
      toolPart({
        toolName: 'suggest_followups',
        toolCallId: 'tc-2',
        state: 'output-available',
        output: {
          data: {},
          _meta: {
            tool: 'suggest_followups',
            executionTimeMs: 10,
            resultCount: 1,
          },
        },
      }),
    ])

    render(<ChatMessage message={msg} isStreaming={false} />)

    expect(screen.getByText('Hämtade företagskontext')).toBeDefined()
    expect(screen.queryByText(/Förberedde uppföljningsfrågor/)).toBeNull()
    // Only one visible completed tool → falls back to standalone ToolCallRow.
    expect(screen.queryByRole('button', { name: /Visa detaljer/ })).toBeNull()
  })

  // 5.5
  it('keeps a single completed tool as a standalone ToolCallRow (no group)', () => {
    const msg = assistantMessage('msg-5-5', [
      toolPart({
        toolName: 'get_company_context',
        toolCallId: 'tc-1',
        state: 'output-available',
        output: {
          data: {},
          _meta: {
            tool: 'get_company_context',
            executionTimeMs: 10,
            resultCount: 1,
          },
        },
      }),
    ])

    render(<ChatMessage message={msg} isStreaming={false} />)

    expect(screen.getByText('Hämtade företagskontext')).toBeDefined()
    expect(screen.queryByRole('button', { name: /Visa detaljer/ })).toBeNull()
    expect(screen.queryByText('·')).toBeNull()
  })

  // 5.6
  it('does not collapse when a running call is mixed with a completed call', () => {
    const msg = assistantMessage('msg-5-6', [
      toolPart({
        toolName: 'get_company_context',
        toolCallId: 'tc-1',
        state: 'output-available',
        output: {
          data: {},
          _meta: {
            tool: 'get_company_context',
            executionTimeMs: 10,
            resultCount: 1,
          },
        },
      }),
      toolPart({
        toolName: 'search_laws',
        toolCallId: 'tc-2',
        state: 'input-available',
        input: { query: 'arbetsmiljö' },
      }),
    ])

    render(<ChatMessage message={msg} isStreaming={false} />)

    expect(screen.getByText('Hämtade företagskontext')).toBeDefined()
    expect(screen.getByText('Söker i lagdatabasen')).toBeDefined()
    expect(screen.queryByRole('button', { name: /Visa detaljer/ })).toBeNull()
  })

  // 5.7
  it('keeps an errored call expanded alongside a completed peer', () => {
    const msg = assistantMessage('msg-5-7', [
      toolPart({
        toolName: 'get_company_context',
        toolCallId: 'tc-1',
        state: 'output-available',
        output: {
          data: {},
          _meta: {
            tool: 'get_company_context',
            executionTimeMs: 10,
            resultCount: 1,
          },
        },
      }),
      toolPart({
        toolName: 'search_laws',
        toolCallId: 'tc-2',
        state: 'output-error',
        input: { query: 'broken' },
      }),
    ])

    render(<ChatMessage message={msg} isStreaming={false} />)

    expect(screen.getByText('Hämtade företagskontext')).toBeDefined()
    expect(screen.getByText(/Söker i lagdatabasen misslyckades/)).toBeDefined()
    expect(screen.queryByRole('button', { name: /Visa detaljer/ })).toBeNull()
  })

  // 5.8
  it('opens the sidebar when a clickable label is clicked (allowlisted tool)', () => {
    // Clickability is allowlist-driven (EXPANDABLE_TOOLS: search_laws,
    // web_search) — tools with a purpose-built detail view. get_company_context
    // is non-clickable and just forms the group; search_laws is the clickable
    // label that opens the detail sidebar.
    const msg = assistantMessage('msg-5-8', [
      toolPart({
        toolName: 'get_company_context',
        toolCallId: 'tc-1',
        state: 'output-available',
        output: {
          data: {},
          _meta: {
            tool: 'get_company_context',
            executionTimeMs: 10,
            resultCount: 1,
          },
        },
      }),
      toolPart({
        toolName: 'search_laws',
        toolCallId: 'tc-2',
        state: 'output-available',
        input: { query: 'arbetsmiljö' },
        output: {
          data: [{ id: 'SFS 2025:1' }],
          _meta: {
            tool: 'search_laws',
            executionTimeMs: 10,
            resultCount: 1,
          },
        },
      }),
    ])

    render(<ChatMessage message={msg} isStreaming={false} />)

    const btn = screen.getByRole('button', {
      name: 'Visa resultat: Sökte i lagdatabasen',
    })
    fireEvent.click(btn)

    expect(mockOpenDetail).toHaveBeenCalledTimes(1)
    const callArg = mockOpenDetail.mock.calls[0]?.[0] as ChatDetailItem
    expect(callArg.type).toBe('tool-result')
    if (callArg.type === 'tool-result') {
      expect(callArg.toolName).toBe('search_laws')
    }
  })

  // 5.9
  it('toggles expansion and flips aria-expanded on the toggle button', () => {
    const msg = assistantMessage('msg-5-9', [
      toolPart({
        toolName: 'search_laws',
        toolCallId: 'tc-1',
        state: 'output-available',
        input: { query: 'arbetsmiljö' },
        output: {
          data: [],
          _meta: { tool: 'search_laws', executionTimeMs: 10, resultCount: 0 },
        },
      }),
      toolPart({
        toolName: 'search_laws',
        toolCallId: 'tc-2',
        state: 'output-available',
        input: { query: 'riskbedömning' },
        output: {
          data: [],
          _meta: { tool: 'search_laws', executionTimeMs: 10, resultCount: 0 },
        },
      }),
    ])

    render(<ChatMessage message={msg} isStreaming={false} />)

    const toggle = screen.getByRole('button', { name: /Visa detaljer/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(toggle)

    const toggleAfter = screen.getByRole('button', { name: /Dölj detaljer/ })
    expect(toggleAfter.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText(/"arbetsmiljö"/)).toBeDefined()
    expect(screen.getByText(/"riskbedömning"/)).toBeDefined()
  })

  // 5.10
  it('renders a non-clickable label as a plain span when sidebarHint is absent', () => {
    const msg = assistantMessage('msg-5-10', [
      toolPart({
        toolName: 'get_company_context',
        toolCallId: 'tc-1',
        state: 'output-available',
        output: {
          data: {},
          _meta: {
            tool: 'get_company_context',
            executionTimeMs: 10,
            resultCount: 1,
            // no sidebarHint
          },
        },
      }),
      toolPart({
        toolName: 'get_change_details',
        toolCallId: 'tc-2',
        state: 'output-available',
        output: {
          data: {},
          _meta: {
            tool: 'get_change_details',
            executionTimeMs: 10,
            resultCount: 1,
            // no sidebarHint
          },
        },
      }),
    ])

    render(<ChatMessage message={msg} isStreaming={false} />)

    expect(screen.getByText('Hämtade företagskontext')).toBeDefined()
    expect(screen.queryByRole('button', { name: /Visa resultat:/ })).toBeNull()
  })

  // 5.11
  it('auto-opens the sidebar exactly once when a tool transitions standalone → grouped', () => {
    vi.useFakeTimers()
    try {
      const writePreviewOutput = {
        confirmation_required: true,
        action: 'create_task',
        params: { title: 'Test task' },
        preview: 'Task preview',
        _meta: {
          tool: 'create_task',
          executionTimeMs: 10,
          resultCount: 0,
          sidebarHint: 'open',
        },
      }

      const singleMsg = assistantMessage('msg-5-11', [
        toolPart({
          toolName: 'create_task',
          toolCallId: 'tc-1',
          state: 'output-available',
          output: writePreviewOutput,
        }),
      ])

      const { rerender } = render(
        <ChatMessage message={singleMsg} isStreaming={true} />
      )

      // Standalone ToolCallRow's debounced effect fires → 1 openDetail call.
      act(() => {
        vi.advanceTimersByTime(150)
      })
      expect(mockOpenDetail).toHaveBeenCalledTimes(1)

      // Add a peer completed tool → pair coalesces into CollapsedToolGroup.
      const groupedMsg = assistantMessage('msg-5-11', [
        toolPart({
          toolName: 'create_task',
          toolCallId: 'tc-1',
          state: 'output-available',
          output: writePreviewOutput,
        }),
        toolPart({
          toolName: 'get_company_context',
          toolCallId: 'tc-2',
          state: 'output-available',
          output: {
            data: {},
            _meta: {
              tool: 'get_company_context',
              executionTimeMs: 10,
              resultCount: 1,
            },
          },
        }),
      ])

      rerender(<ChatMessage message={groupedMsg} isStreaming={false} />)

      act(() => {
        vi.advanceTimersByTime(150)
      })

      // Dedup via autoOpenedToolCallIds prevents a second fire for tc-1.
      expect(mockOpenDetail).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  // 5.12
  it('auto-opens the sidebar once when the tool starts grouped', () => {
    vi.useFakeTimers()
    try {
      const msg = assistantMessage('msg-5-12', [
        toolPart({
          toolName: 'get_company_context',
          toolCallId: 'tc-1',
          state: 'output-available',
          output: {
            data: {},
            _meta: {
              tool: 'get_company_context',
              executionTimeMs: 10,
              resultCount: 1,
            },
          },
        }),
        toolPart({
          toolName: 'create_task',
          toolCallId: 'tc-2',
          state: 'output-available',
          output: {
            confirmation_required: true,
            action: 'create_task',
            params: { title: 'New task' },
            preview: 'New task preview',
            _meta: {
              tool: 'create_task',
              executionTimeMs: 10,
              resultCount: 0,
              sidebarHint: 'open',
            },
          },
        }),
      ])

      render(<ChatMessage message={msg} isStreaming={false} />)

      act(() => {
        vi.advanceTimersByTime(150)
      })

      expect(mockOpenDetail).toHaveBeenCalledTimes(1)
      const callArg = mockOpenDetail.mock.calls[0]?.[0] as ChatDetailItem
      // Story 14.23: the 'write-preview' sidebar route was removed — a write-tool
      // output without a pendingActionId now routes to 'tool-result'.
      expect(callArg.type).toBe('tool-result')
      if (callArg.type === 'tool-result') {
        expect(callArg.toolName).toBe('create_task')
      }
    } finally {
      vi.useRealTimers()
    }
  })
})
