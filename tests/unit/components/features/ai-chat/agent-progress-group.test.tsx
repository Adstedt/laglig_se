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
// Mocks — mirror collapsed-tool-group.test.tsx
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

function reasoningPart(
  state: 'streaming' | 'done'
): UIMessage['parts'][number] {
  return {
    type: 'reasoning',
    state,
    text: '',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

function textPart(text: string): UIMessage['parts'][number] {
  return {
    type: 'text',
    text,
    state: 'done',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
}

function completedSearch(
  id: string,
  query: string
): UIMessage['parts'][number] {
  return toolPart({
    toolName: 'search_laws',
    toolCallId: id,
    state: 'output-available',
    input: { query },
    output: {
      data: [],
      _meta: { tool: 'search_laws', executionTimeMs: 10, resultCount: 0 },
    },
  })
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

describe('AgentProgressGroup + LiveWorkingStatus (story 19.15)', () => {
  beforeEach(() => {
    __resetAutoOpenedForTests()
    mockOpenDetail.mockReset()
    mockChatDetail.activeDetail = null
  })

  // AC 3 — coalesce interleaved reasoning + tools into ONE summary, no ladder.
  it('coalesces an interleaved reasoning+tool turn into one "N steg" summary (no breadcrumb ladder)', () => {
    const msg = assistantMessage('msg-coalesce', [
      reasoningPart('done'),
      completedSearch('tc-1', 'arbetsmiljö'),
      completedSearch('tc-2', 'riskbedömning'),
      reasoningPart('done'),
      toolPart({
        toolName: 'get_document_details',
        toolCallId: 'tc-3',
        state: 'output-available',
        output: {
          data: { documentNumber: 'SFS 2025:1' },
          _meta: {
            tool: 'get_document_details',
            executionTimeMs: 10,
            resultCount: 1,
          },
        },
      }),
    ])

    render(<ChatMessage message={msg} isStreaming={false} />)

    // One summary, 5 steps (2 reasoning + 3 tools), both verbs present.
    expect(screen.getByText(/Tänkte och sökte i 5 steg/)).toBeDefined()
    // No top-level reasoning ladder.
    expect(screen.queryByText('Tänkte klart')).toBeNull()
    // Tool chips are folded inside (not rendered as top-level rows yet).
    expect(screen.queryByText('Sökte i lagdatabasen')).toBeNull()
  })

  // AC 3/4 — expand reveals the per-step timeline (reasoning + tool rows).
  it('expands to reveal the per-step timeline', () => {
    const msg = assistantMessage('msg-expand', [
      reasoningPart('done'),
      completedSearch('tc-1', 'arbetsmiljö'),
    ])

    render(<ChatMessage message={msg} isStreaming={false} />)

    const toggle = screen.getByRole('button', { name: /Visa detaljer/ })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(toggle)

    const toggleAfter = screen.getByRole('button', { name: /Dölj detaljer/ })
    expect(toggleAfter.getAttribute('aria-expanded')).toBe('true')
    // Reasoning step row + tool step row are now visible.
    expect(screen.getByText('Tänkte')).toBeDefined()
    expect(screen.getByText(/Sökte i lagdatabasen/)).toBeDefined()
  })

  // AC 1/2 — while live, ONE working row beside the avatar; no ladder, no chips.
  it('shows a single live working row (running-tool activity) and suppresses the step ladder', () => {
    const msg = assistantMessage('msg-live', [
      reasoningPart('done'),
      completedSearch('tc-1', 'arbetsmiljö'),
      reasoningPart('done'),
      completedSearch('tc-2', 'riskbedömning'),
      toolPart({
        toolName: 'search_laws',
        toolCallId: 'tc-3',
        state: 'input-available',
        input: { query: 'kemikalier' },
      }),
    ])

    const { container } = render(
      <ChatMessage message={msg} isStreaming={true} />
    )

    // Live activity reflects the running tool's label.
    expect(screen.getByText(/Söker i lagdatabasen…/)).toBeDefined()
    // No collapsed summary while still working.
    expect(screen.queryByText(/steg/)).toBeNull()
    // No ladder: completed reasoning + completed tool chips are suppressed.
    expect(screen.queryByText('Tänkte klart')).toBeNull()
    expect(screen.queryByText('Sökte i lagdatabasen')).toBeNull()
    // Exactly one aria-live region (the activity label).
    expect(container.querySelectorAll('[aria-live="polite"]').length).toBe(1)
  })

  // AC 8 — no-think text-only turn degrades cleanly (no working row, no summary).
  it('renders a text-only turn with no working row and no empty summary', () => {
    const msg = assistantMessage('msg-nothink', [
      textPart('Hej, här är svaret.'),
    ])

    const { container } = render(
      <ChatMessage message={msg} isStreaming={false} />
    )

    expect(screen.getByText('Hej, här är svaret.')).toBeDefined()
    expect(screen.queryByText(/steg/)).toBeNull()
    expect(screen.queryByText('Tänkte klart')).toBeNull()
    expect(container.querySelectorAll('[aria-live]').length).toBe(0)
  })

  // AC 9 — a lone reasoning step stays "Tänkte klart" (never "Tänkte i 1 steg").
  it('keeps a single reasoning step as a plain "Tänkte klart" breadcrumb', () => {
    const msg = assistantMessage('msg-lone', [reasoningPart('done')])

    render(<ChatMessage message={msg} isStreaming={false} />)

    expect(screen.getByText('Tänkte klart')).toBeDefined()
    expect(screen.queryByText(/steg/)).toBeNull()
  })

  // AC 5/6 — timer is threshold-in while live and freezes into the summary.
  it('shows the elapsed timer after the threshold and freezes it into the summary', () => {
    vi.useFakeTimers()
    try {
      const liveMsg = assistantMessage('msg-timer', [
        toolPart({
          toolName: 'search_laws',
          toolCallId: 'tc-1',
          state: 'input-available',
          input: { query: 'arbetsmiljö' },
        }),
      ])

      const { rerender } = render(
        <ChatMessage message={liveMsg} isStreaming={true} />
      )

      // Before the ~2s threshold: no timer flashes.
      expect(screen.queryByText(/\d+s/)).toBeNull()

      act(() => {
        vi.advanceTimersByTime(2000)
      })

      // Timer now visible.
      expect(screen.getByText(/2s/)).toBeDefined()

      // Settle the turn (2 steps) — duration freezes into the summary.
      const settledMsg = assistantMessage('msg-timer', [
        reasoningPart('done'),
        completedSearch('tc-1', 'arbetsmiljö'),
      ])
      rerender(<ChatMessage message={settledMsg} isStreaming={false} />)

      expect(screen.getByText(/Tänkte och sökte i 2 steg · 2s/)).toBeDefined()
    } finally {
      vi.useRealTimers()
    }
  })

  // AC 10 — the ticking seconds must NOT live inside an aria-live region.
  it('keeps the seconds counter out of any aria-live region', () => {
    vi.useFakeTimers()
    try {
      const msg = assistantMessage('msg-a11y', [
        toolPart({
          toolName: 'search_laws',
          toolCallId: 'tc-1',
          state: 'input-available',
          input: { query: 'arbetsmiljö' },
        }),
      ])

      render(<ChatMessage message={msg} isStreaming={true} />)

      act(() => {
        vi.advanceTimersByTime(3000)
      })

      const seconds = screen.getByText(/\ds/)
      expect(seconds.closest('[aria-live]')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  // AC 6 — history reload (never streamed) omits the duration gracefully.
  it('omits the duration on a reloaded turn (timer never ran)', () => {
    const msg = assistantMessage('msg-reload', [
      reasoningPart('done'),
      completedSearch('tc-1', 'arbetsmiljö'),
    ])

    render(<ChatMessage message={msg} isStreaming={false} />)

    expect(screen.getByText('Tänkte och sökte i 2 steg')).toBeDefined()
    // No "· Ns" duration suffix.
    expect(screen.queryByText(/· \d+s/)).toBeNull()
  })

  // QA-001 — when intermediate text splits a turn into multiple progress groups,
  // the turn-level duration is shown ONCE (on the last group), not on every one.
  it('shows the frozen duration only on the last of several progress groups', () => {
    vi.useFakeTimers()
    try {
      const liveMsg = assistantMessage('msg-multi', [
        toolPart({
          toolName: 'search_laws',
          toolCallId: 'tc-0',
          state: 'input-available',
          input: { query: 'arbetsmiljö' },
        }),
      ])

      const { rerender } = render(
        <ChatMessage message={liveMsg} isStreaming={true} />
      )

      act(() => {
        vi.advanceTimersByTime(5000)
      })

      // Settle with TWO reasoning+tool runs split by intermediate answer text.
      const settledMsg = assistantMessage('msg-multi', [
        reasoningPart('done'),
        completedSearch('tc-1', 'arbetsmiljö'),
        textPart('Fortsätter sökningen.'),
        reasoningPart('done'),
        completedSearch('tc-2', 'kemikalier'),
      ])
      rerender(<ChatMessage message={settledMsg} isStreaming={false} />)

      // Two progress-group summaries...
      expect(screen.getAllByText(/Tänkte och sökte i 2 steg/).length).toBe(2)
      // ...but the duration suffix appears exactly once.
      expect(screen.getAllByText(/· \d+s/).length).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })

  // AC 1 — the "answering" frame: once answer text streams, the live working
  // row is gone and the collapsed summary renders above the streaming text.
  it('drops the live working row once answer text starts streaming', () => {
    const msg = assistantMessage('msg-answering', [
      reasoningPart('done'),
      completedSearch('tc-1', 'arbetsmiljö'),
      textPart('Här är bedömningen.'),
    ])

    const { container } = render(
      <ChatMessage message={msg} isStreaming={true} />
    )

    // The collapsed summary renders (isWorking is false once answer text exists);
    // the answer TextBlock is mounted (its content is dripped by useSmoothStream,
    // so we don't assert the streaming text synchronously).
    expect(screen.getByText('Tänkte och sökte i 2 steg')).toBeDefined()
    expect(container.querySelector('.chat-markdown')).not.toBeNull()
    // No live working row (no aria-live label) while answering.
    expect(container.querySelectorAll('[aria-live="polite"]').length).toBe(0)
    // Duration not shown mid-turn (only freezes once settled).
    expect(screen.queryByText(/· \d+s/)).toBeNull()
  })
})
