/**
 * Story 14.11: Tests for HemChat component
 * Covers layout states, context cards, chat input, conversation persistence,
 * sidebar integration, and navigation changes.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, describe, beforeEach, it, expect } from 'vitest'
import type { UIMessage } from 'ai'

// ============================================================================
// Mocks
// ============================================================================

const mockSendMessage = vi.fn()
const mockClearHistory = vi.fn().mockResolvedValue(undefined)
const mockHandleRetry = vi.fn()

let mockMessages: UIMessage[] = []
let mockStatus: 'ready' | 'streaming' | 'submitted' | 'error' = 'ready'
let mockIsLoadingHistory = false

vi.mock('@/lib/hooks/use-chat-interface', () => ({
  useChatInterface: () => ({
    messages: mockMessages,
    sendMessage: mockSendMessage,
    status: mockStatus,
    error: null,
    citations: [],
    retryAfter: undefined,
    handleRetry: mockHandleRetry,
    isLoading: mockStatus === 'streaming' || mockStatus === 'submitted',
    isLoadingHistory: mockIsLoadingHistory,
    clearHistory: mockClearHistory,
    stop: vi.fn(),
  }),
}))

const mockArchiveConversation = vi
  .fn()
  .mockResolvedValue({ success: true, data: { conversationId: 'conv-1' } })

vi.mock('@/app/actions/ai-chat', () => ({
  archiveConversation: (...args: unknown[]) => mockArchiveConversation(...args),
  loadConversation: vi.fn().mockResolvedValue({ success: true, data: [] }),
  getConversationHistory: vi
    .fn()
    .mockResolvedValue({ success: true, data: [] }),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

// Mock chat sub-components to isolate HemChat tests
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />
  },
}))

vi.mock('@/components/features/ai-chat/chat-message-list', () => ({
  ChatMessageList: ({ messages }: { messages: UIMessage[] }) => (
    <div data-testid="chat-message-list">
      {messages.map((m) => (
        <div key={m.id} data-testid={`message-${m.role}`}>
          {m.parts?.map((p, i) => (
            <span key={i}>{'text' in p ? p.text : ''}</span>
          ))}
        </div>
      ))}
    </div>
  ),
}))

vi.mock('@/components/features/ai-chat/chat-input-modern', () => ({
  ChatInputModern: vi
    .fn()
    .mockImplementation(
      ({
        onSend,
        placeholder,
      }: {
        onSend: (_msg: string) => void
        placeholder?: string
      }) => (
        <div data-testid="chat-input">
          <input
            data-testid="chat-textarea"
            placeholder={placeholder}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSend((e.target as HTMLInputElement).value)
              }
            }}
          />
        </div>
      )
    ),
}))

vi.mock('@/components/features/ai-chat/chat-error', () => ({
  ChatError: () => <div data-testid="chat-error">Error</div>,
}))

vi.mock('@/components/features/dashboard/conversation-history', () => ({
  ConversationHistory: ({
    onBack,
    onSelectConversation,
  }: {
    onBack: () => void
    onSelectConversation: (_id: string) => void
  }) => (
    <div data-testid="conversation-history">
      <button onClick={onBack}>Back</button>
      <button onClick={() => onSelectConversation('conv-1')}>Load conv</button>
    </div>
  ),
}))

// ============================================================================
// Import after mocks
// ============================================================================

import { HemChat } from '@/components/features/dashboard/hem-chat'

// ============================================================================
// Tests
// ============================================================================

describe('HemChat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMessages = []
    mockStatus = 'ready'
    mockIsLoadingHistory = false
  })

  // --- Test 1: Greeting with Safiro font ---
  it('renders greeting heading with font-safiro class in home state', () => {
    render(<HemChat mode="full" userName="Alex" />)

    const heading = screen.getByText('Hur kan jag hjälpa dig idag, Alex?')
    expect(heading).toBeInTheDocument()
    expect(heading).toHaveClass('font-safiro')
    expect(heading.tagName).toBe('H1')
  })

  // --- Test 1b: Brand logo in home state ---
  it('renders brand logo in home state', () => {
    render(<HemChat mode="full" />)

    expect(screen.getByTestId('brand-logo')).toBeInTheDocument()
  })

  // --- Test 2: Greeting without user name ---
  it('renders generic greeting when no userName provided', () => {
    render(<HemChat mode="full" />)

    expect(screen.getByText('Hur kan jag hjälpa dig idag?')).toBeInTheDocument()
  })

  // --- Test 3: Context cards with mock data ---
  it('renders context cards with dashboard data including pending amendments', () => {
    const dashboardData = {
      complianceStats: { total: 100, compliant: 75 },
      taskCounts: { overdue: 2, thisWeek: 5, myTasks: 3 },
      pendingAmendments: 3,
    }

    render(<HemChat mode="full" dashboardData={dashboardData} />)

    // Should show compliance percentage
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('Efterlevnad')).toBeInTheDocument()
    // Should show pending amendments as "X nya"
    expect(screen.getByText('3 nya')).toBeInTheDocument()
    expect(screen.getByText('Ändringar')).toBeInTheDocument()
    // Should show overdue count
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Förfallna')).toBeInTheDocument()
    // Should show this week count
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('Denna vecka')).toBeInTheDocument()
  })

  // --- Test 3b: Progress bar renders with correct color ---
  it('renders green progress bar at 75% compliance', () => {
    const dashboardData = {
      complianceStats: { total: 100, compliant: 75 },
      taskCounts: { overdue: 0, thisWeek: 0, myTasks: 0 },
    }

    render(<HemChat mode="full" dashboardData={dashboardData} />)

    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toBeInTheDocument()
    expect(progressBar).toHaveAttribute('aria-valuenow', '75')
    // Green bar for > 66%
    const fill = progressBar.firstChild as HTMLElement
    expect(fill.className).toContain('bg-emerald-500')
  })

  // --- Test 3c: Urgent indicator appears when overdue > 0 ---
  it('shows urgent indicator when there are overdue tasks', () => {
    const dashboardData = {
      complianceStats: { total: 100, compliant: 75 },
      taskCounts: { overdue: 3, thisWeek: 5, myTasks: 3 },
    }

    render(<HemChat mode="full" dashboardData={dashboardData} />)

    expect(screen.getByTestId('overdue-indicator')).toBeInTheDocument()
  })

  // --- Test 3d: No urgent indicator when overdue === 0 ---
  it('does not show urgent indicator when no overdue tasks', () => {
    const dashboardData = {
      complianceStats: { total: 100, compliant: 75 },
      taskCounts: { overdue: 0, thisWeek: 5, myTasks: 3 },
    }

    render(<HemChat mode="full" dashboardData={dashboardData} />)

    expect(screen.queryByTestId('overdue-indicator')).not.toBeInTheDocument()
  })

  // --- Test 4: Context card click sends prompt ---
  it('sends prompt when context card is clicked', async () => {
    const user = userEvent.setup()
    const dashboardData = {
      complianceStats: { total: 100, compliant: 75 },
      taskCounts: { overdue: 2, thisWeek: 5, myTasks: 3 },
    }

    render(<HemChat mode="full" dashboardData={dashboardData} />)

    // Click the Efterlevnad card
    const complianceCard = screen.getByText('Efterlevnad').closest('button')
    expect(complianceCard).toBeInTheDocument()
    await user.click(complianceCard!)

    expect(mockSendMessage).toHaveBeenCalledWith(
      'Visa en översikt av min efterlevnad'
    )
  })

  // --- Test 5: Context cards show "–" on null data ---
  it('shows dash values when dashboardData is null', () => {
    render(<HemChat mode="full" dashboardData={null} />)

    const dashes = screen.getAllByText('–')
    expect(dashes.length).toBeGreaterThanOrEqual(4)
  })

  // --- Test 6: Context cards show skeleton on loading ---
  it('shows skeleton placeholders when dashboard is loading', () => {
    render(<HemChat mode="full" dashboardLoading={true} />)

    // Skeleton elements don't have text, but there should be no card values
    expect(screen.queryByText('Efterlevnad')).not.toBeInTheDocument()
  })

  // --- Test 7: Chat input with Swedish placeholder ---
  it('renders chat input with Swedish placeholder in home state', () => {
    render(<HemChat mode="full" />)

    const input = screen.getByTestId('chat-textarea')
    expect(input).toHaveAttribute('placeholder', 'Vad kan jag hjälpa dig med?')
  })

  // --- Test 8: Suggested prompts render in home state ---
  it('renders suggested prompts in home state', () => {
    render(<HemChat mode="full" />)

    expect(
      screen.getByText('Visa en översikt av min efterlevnad')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Vilka ändringar har jag missat?')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Hjälp mig granska en lagändring')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Vad behöver jag göra denna vecka?')
    ).toBeInTheDocument()
  })

  // --- Test 9: Suggested prompt click sends message ---
  it('sends message when suggested prompt is clicked', async () => {
    const user = userEvent.setup()
    render(<HemChat mode="full" />)

    await user.click(screen.getByText('Vilka ändringar har jag missat?'))

    expect(mockSendMessage).toHaveBeenCalledWith(
      'Vilka ändringar har jag missat?'
    )
  })

  // --- Test 10: Conversation state shows messages ---
  it('shows conversation state when messages exist', () => {
    mockMessages = [
      {
        id: '1',
        role: 'user',
        parts: [{ type: 'text', text: 'Hej!' }],
        createdAt: new Date(),
      },
      {
        id: '2',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Hej! Hur kan jag hjälpa?' }],
        createdAt: new Date(),
      },
    ]

    render(<HemChat mode="full" />)

    // Should show message list, not greeting or logo
    expect(screen.getByTestId('chat-message-list')).toBeInTheDocument()
    expect(
      screen.queryByText('Hur kan jag hjälpa dig idag?')
    ).not.toBeInTheDocument()
    expect(screen.queryByTestId('brand-logo')).not.toBeInTheDocument()
  })

  // --- Test 11: "Ny konversation" button in conversation state ---
  it('shows "Ny konversation" button during active conversation', () => {
    mockMessages = [
      {
        id: '1',
        role: 'user',
        parts: [{ type: 'text', text: 'Test' }],
        createdAt: new Date(),
      },
    ]

    render(<HemChat mode="full" />)

    expect(screen.getByText('Ny konversation')).toBeInTheDocument()
  })

  // --- Test 12: "Ny konversation" archives and resets ---
  it('archives conversation and resets when "Ny konversation" is clicked', async () => {
    const user = userEvent.setup()

    mockMessages = [
      {
        id: '1',
        role: 'user',
        parts: [{ type: 'text', text: 'Test' }],
        createdAt: new Date(),
      },
    ]

    render(<HemChat mode="full" />)

    await user.click(screen.getByText('Ny konversation'))

    expect(mockArchiveConversation).toHaveBeenCalled()
    expect(mockClearHistory).toHaveBeenCalled()
  })

  // --- Test 12b: "Ny konversation" shows error toast on archive failure ---
  it('shows error toast when archiving fails', async () => {
    const user = userEvent.setup()
    const { toast } = await import('sonner')
    mockArchiveConversation.mockRejectedValueOnce(new Error('Network error'))

    mockMessages = [
      {
        id: '1',
        role: 'user',
        parts: [{ type: 'text', text: 'Test' }],
        createdAt: new Date(),
      },
    ]

    render(<HemChat mode="full" />)

    await user.click(screen.getByText('Ny konversation'))

    expect(toast.error).toHaveBeenCalledWith(
      'Kunde inte spara konversationen. Försök igen.'
    )
    // clearHistory should NOT have been called
    expect(mockClearHistory).not.toHaveBeenCalled()
  })

  // --- Test 13: "Tidigare konversationer" link ---
  it('shows "Tidigare konversationer" link in home state', () => {
    render(<HemChat mode="full" />)

    expect(screen.getByText('Tidigare konversationer')).toBeInTheDocument()
  })

  // --- Test 14: Conversation history view ---
  it('navigates to conversation history when link is clicked', async () => {
    const user = userEvent.setup()
    render(<HemChat mode="full" />)

    await user.click(screen.getByText('Tidigare konversationer'))

    expect(screen.getByTestId('conversation-history')).toBeInTheDocument()
  })

  // --- Test 15: Panel mode renders compact layout ---
  it('renders panel mode with compact layout', () => {
    render(<HemChat mode="panel" />)

    // Panel mode should show chat input
    expect(screen.getByTestId('chat-input')).toBeInTheDocument()
    // Should NOT show greeting or context cards
    expect(
      screen.queryByText('Hur kan jag hjälpa dig idag?')
    ).not.toBeInTheDocument()
  })

  // --- Test 16: Panel mode shows suggested prompts in empty state ---
  it('shows suggested prompts in panel mode empty state', () => {
    render(<HemChat mode="panel" />)

    // Panel shows first 2 suggested prompts
    expect(
      screen.getByText('Visa en översikt av min efterlevnad')
    ).toBeInTheDocument()
  })
})
