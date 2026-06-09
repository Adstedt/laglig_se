/**
 * Story 14.23, Task 9.3: tests for AgentActionBatchCard orchestration.
 * Happy-path approve-all, partial-failure approve-all, reject-all. The per-type
 * renderers are stubbed so the test isolates the batch card's own logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import type { PendingAgentAction } from '@prisma/client'

const { mockGetByMessage, mockApprove, mockReject } = vi.hoisted(() => ({
  mockGetByMessage: vi.fn(),
  mockApprove: vi.fn(),
  mockReject: vi.fn(),
}))

vi.mock('@/app/actions/pending-agent-actions', () => ({
  getPendingAgentActionsByMessage: mockGetByMessage,
  approvePendingAction: mockApprove,
  rejectPendingAction: mockReject,
  updatePendingActionParams: vi.fn(async () => ({ success: true })),
}))

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

// Stub the renderer registry so the batch card renders simple rows.
vi.mock('@/components/features/ai-chat/agent-action-card', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RENDERERS: new Proxy(
    {},
    {
      get: () =>
        function Stub({ action }: { action: PendingAgentAction }) {
          return <div data-testid={`row-${action.id}`}>{action.status}</div>
        },
    }
  ),
}))

import { AgentActionBatchCard } from '@/components/features/ai-chat/agent-action-batch-card'

function row(
  id: string,
  overrides: Partial<PendingAgentAction> = {}
): PendingAgentAction {
  return {
    id,
    workspace_id: 'ws_1',
    user_id: 'user_1',
    conversation_id: null,
    chat_message_id: 'cm_1',
    context_type: 'GLOBAL',
    context_id: null,
    action_type: 'CREATE_TASK',
    status: 'PENDING',
    params: {},
    result_ref: null,
    created_at: new Date(),
    decided_at: null,
    expires_at: new Date(Date.now() + 1_000_000),
    ...overrides,
  } as PendingAgentAction
}

function renderCard() {
  return render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <AgentActionBatchCard chatMessageId="cm_1" />
    </SWRConfig>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetByMessage.mockResolvedValue({
    success: true,
    data: [row('pa_1'), row('pa_2'), row('pa_3')],
  })
})

describe('AgentActionBatchCard', () => {
  it('renders a header with the row count and one row per action', async () => {
    renderCard()
    expect(await screen.findByText('Föreslagna åtgärder')).toBeInTheDocument()
    expect(screen.getByTestId('row-pa_1')).toBeInTheDocument()
    expect(screen.getByTestId('row-pa_3')).toBeInTheDocument()
  })

  it('"Godkänn alla" approves every PENDING row sequentially and shows the summary', async () => {
    mockApprove.mockResolvedValue({ success: true })
    renderCard()
    await screen.findByText('Föreslagna åtgärder')

    fireEvent.click(screen.getByRole('button', { name: /Godkänn alla/ }))

    await waitFor(() => expect(mockApprove).toHaveBeenCalledTimes(3))
    expect(mockApprove).toHaveBeenNthCalledWith(1, 'pa_1')
    expect(mockApprove).toHaveBeenNthCalledWith(3, 'pa_3')
    expect(await screen.findByText('3 av 3 godkända')).toBeInTheDocument()
  })

  it('partial failure: summary reflects only the successes, failures stay', async () => {
    mockApprove
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce({
        success: false,
        error: 'Uppgiften behöver skapas först',
      })
      .mockResolvedValueOnce({ success: true })
    renderCard()
    await screen.findByText('Föreslagna åtgärder')

    fireEvent.click(screen.getByRole('button', { name: /Godkänn alla/ }))

    await waitFor(() => expect(mockApprove).toHaveBeenCalledTimes(3))
    expect(await screen.findByText('2 av 3 godkända')).toBeInTheDocument()
  })

  it('"Avvisa alla" rejects every PENDING row', async () => {
    mockReject.mockResolvedValue({ success: true })
    renderCard()
    await screen.findByText('Föreslagna åtgärder')

    fireEvent.click(screen.getByRole('button', { name: /Avvisa alla/ }))

    await waitFor(() => expect(mockReject).toHaveBeenCalledTimes(3))
  })
})
