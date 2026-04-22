/**
 * Story 14.25: Tests for RightSidebar — New chat + History wiring via ChatPanelChrome.
 * Covers the handlers and the laglig:load-conversation event subscription.
 */

import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, beforeEach, it, expect } from 'vitest'
import type { UIMessage } from 'ai'

// ============================================================================
// Mocks
// ============================================================================

const mockSendMessage = vi.fn()
const mockClearHistory = vi.fn().mockResolvedValue(undefined)
const mockReplaceMessages = vi.fn()
const mockHandleRetry = vi.fn()

let mockMessages: UIMessage[] = []
let mockStatus: 'ready' | 'streaming' | 'submitted' | 'error' = 'ready'

vi.mock('@/lib/hooks/use-chat-interface', () => ({
  useChatInterface: () => ({
    messages: mockMessages,
    sendMessage: mockSendMessage,
    status: mockStatus,
    error: null,
    retryAfter: undefined,
    handleRetry: mockHandleRetry,
    clearHistory: mockClearHistory,
    replaceMessages: mockReplaceMessages,
    stop: vi.fn(),
    loadMore: vi.fn(),
    isLoadingMore: false,
    hasMore: false,
    isLoading: false,
    isLoadingHistory: false,
  }),
}))

const mockArchiveConversation = vi
  .fn()
  .mockResolvedValue({ success: true, data: { conversationId: 'conv-1' } })
const mockLoadConversation = vi.fn()

vi.mock('@/app/actions/ai-chat', () => ({
  archiveConversation: (...args: unknown[]) => mockArchiveConversation(...args),
  loadConversation: (...args: unknown[]) => mockLoadConversation(...args),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('@vercel/analytics', () => ({
  track: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/laglistor',
}))

// ChatPanel body is a complex stack (message list, input, followups). The sidebar
// only wires props to it — stub so we assert wiring without exercising AI-SDK internals.
vi.mock('@/components/features/ai-chat/chat-panel', () => ({
  ChatPanel: () => <div data-testid="chat-panel" />,
}))

vi.mock('@/components/ui/lexa-icon', () => ({
  LexaIcon: () => <span data-testid="lexa-icon" />,
}))

vi.mock('@/lib/utils/format-conversation-export', () => ({
  exportConversation: vi.fn().mockResolvedValue(undefined),
}))

// Stub ConversationHistory so the history flow can be driven by a single click
// without exercising its own data-fetching / search internals.
vi.mock('@/components/features/dashboard/conversation-history', () => ({
  ConversationHistory: ({
    onSelectConversation,
    onBack,
  }: {
    onSelectConversation: (_id: string) => void
    onBack: () => void
  }) => (
    <div data-testid="conversation-history">
      <button onClick={onBack}>Tillbaka</button>
      <button onClick={() => onSelectConversation('abc')}>
        Välj konversation
      </button>
    </div>
  ),
}))

// ============================================================================
// Import after mocks
// ============================================================================

import { RightSidebar } from '@/components/layout/right-sidebar'

// ============================================================================
// Tests
// ============================================================================

describe('RightSidebar — Story 14.25 header wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMessages = []
    mockStatus = 'ready'
    mockLoadConversation.mockResolvedValue({ success: true, data: [] })
  })

  // --- AC 1, 2: Renders the two new buttons with correct Swedish aria-labels ---
  it('renders Historik + Ny konversation buttons with correct aria-labels when open', () => {
    render(<RightSidebar isOpen onToggle={vi.fn()} />)

    expect(
      screen.getByRole('button', { name: 'Konversationshistorik' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Ny konversation' })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Stäng chat' })
    ).toBeInTheDocument()
  })

  // --- AC 3: New chat with messages → archives then clears in order ---
  it('clicking Ny konversation with messages archives then clears history', async () => {
    const user = userEvent.setup()

    mockMessages = [
      {
        id: '1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hej!' }],
        createdAt: new Date(),
      },
    ]

    render(<RightSidebar isOpen onToggle={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Ny konversation' }))

    expect(mockArchiveConversation).toHaveBeenCalledTimes(1)
    expect(mockClearHistory).toHaveBeenCalledTimes(1)

    const archiveOrder = mockArchiveConversation.mock.invocationCallOrder[0]!
    const clearOrder = mockClearHistory.mock.invocationCallOrder[0]!
    expect(archiveOrder).toBeLessThan(clearOrder)
  })

  // --- AC 3, 6: New chat with no messages → button is disabled (Chrome behavior) ---
  it('Ny konversation button is disabled when there are no messages', () => {
    mockMessages = []

    render(<RightSidebar isOpen onToggle={vi.fn()} />)

    const newChatBtn = screen.getByRole('button', { name: 'Ny konversation' })
    expect(newChatBtn).toBeDisabled()
  })

  // --- AC 3 (error path): Archive failure surfaces Swedish toast ---
  it('shows error toast when archive fails', async () => {
    const user = userEvent.setup()
    const { toast } = await import('sonner')

    mockMessages = [
      {
        id: '1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hej!' }],
        createdAt: new Date(),
      },
    ]
    mockArchiveConversation.mockRejectedValueOnce(new Error('boom'))

    render(<RightSidebar isOpen onToggle={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Ny konversation' }))

    expect(toast.error).toHaveBeenCalledWith(
      'Kunde inte spara konversationen. Försök igen.'
    )
    expect(mockClearHistory).not.toHaveBeenCalled()
  })

  // --- AC 4: History click opens the LOCAL slide-over (not the global left panel) ---
  it('clicking Historik opens the local slide-over overlay', async () => {
    const user = userEvent.setup()
    render(<RightSidebar isOpen onToggle={vi.fn()} />)

    expect(
      screen.queryByTestId('sidebar-history-overlay')
    ).not.toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'Konversationshistorik' })
    )

    expect(screen.getByTestId('sidebar-history-overlay')).toBeInTheDocument()
    expect(screen.getByTestId('conversation-history')).toBeInTheDocument()
  })

  // --- AC 4 (close): Back from slide-over closes the overlay ---
  it('clicking Tillbaka closes the local slide-over', async () => {
    const user = userEvent.setup()
    render(<RightSidebar isOpen onToggle={vi.fn()} />)

    await user.click(
      screen.getByRole('button', { name: 'Konversationshistorik' })
    )
    expect(screen.getByTestId('sidebar-history-overlay')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tillbaka' }))
    expect(
      screen.queryByTestId('sidebar-history-overlay')
    ).not.toBeInTheDocument()
  })

  // --- AC 5 (local): Selecting a conversation in the local panel loads it ---
  it('selecting a conversation from the local slide-over loads it and closes the overlay', async () => {
    const user = userEvent.setup()
    const createdAt = new Date('2026-04-17T10:00:00Z')
    mockLoadConversation.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 'msg-1',
          role: 'USER',
          content: 'Hej',
          metadata: null,
          contextType: 'GLOBAL',
          contextId: null,
          createdAt,
        },
      ],
    })

    render(<RightSidebar isOpen onToggle={vi.fn()} />)

    await user.click(
      screen.getByRole('button', { name: 'Konversationshistorik' })
    )
    await user.click(screen.getByRole('button', { name: 'Välj konversation' }))

    await waitFor(() => {
      expect(mockLoadConversation).toHaveBeenCalledWith('abc')
    })
    await waitFor(() => {
      expect(mockReplaceMessages).toHaveBeenCalledTimes(1)
    })
    expect(
      screen.queryByTestId('sidebar-history-overlay')
    ).not.toBeInTheDocument()
  })

  // --- AC 5: Dispatched 'laglig:load-conversation' triggers load + replace ---
  it('responds to laglig:load-conversation event by loading and replacing messages', async () => {
    const createdAt = new Date('2026-04-17T10:00:00Z')
    mockLoadConversation.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 'msg-1',
          role: 'USER',
          content: 'Hej',
          metadata: null,
          contextType: 'GLOBAL',
          contextId: null,
          createdAt,
        },
        {
          id: 'msg-2',
          role: 'ASSISTANT',
          content: 'Hej, hur kan jag hjälpa?',
          metadata: { citations: ['src'] },
          contextType: 'GLOBAL',
          contextId: null,
          createdAt,
        },
      ],
    })

    render(<RightSidebar isOpen onToggle={vi.fn()} />)

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent('laglig:load-conversation', {
          detail: { conversationId: 'abc' },
        })
      )
    })

    await waitFor(() => {
      expect(mockLoadConversation).toHaveBeenCalledWith('abc')
    })

    await waitFor(() => {
      expect(mockReplaceMessages).toHaveBeenCalledTimes(1)
    })

    const [uiMessages] = mockReplaceMessages.mock.calls[0]!
    expect(uiMessages).toEqual([
      {
        id: 'msg-1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hej' }],
        createdAt,
      },
      {
        id: 'msg-2',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Hej, hur kan jag hjälpa?' }],
        createdAt,
        metadata: { citations: ['src'] },
      },
    ])
  })
})
