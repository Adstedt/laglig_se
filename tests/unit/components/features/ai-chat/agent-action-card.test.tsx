/**
 * Story 14.22, Task 3 (AC 10–14): tests for the AgentActionCard primitive —
 * SWR states, per-type renderer routing, unsupported-type fallback, and the
 * optimistic approve/reject handlers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Mocks (hoisted before the component import)
vi.mock('swr', () => ({ default: vi.fn() }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))
vi.mock('@/app/actions/pending-agent-actions', () => ({
  getPendingAgentAction: vi.fn(),
  approvePendingAction: vi.fn(),
  rejectPendingAction: vi.fn(),
  updatePendingActionParams: vi.fn(),
}))

import useSWR from 'swr'
import { AgentActionCard } from '@/components/features/ai-chat/agent-action-card'
import {
  approvePendingAction,
  rejectPendingAction,
} from '@/app/actions/pending-agent-actions'
import type { PendingAgentAction } from '@prisma/client'

const useSWRMock = useSWR as unknown as ReturnType<typeof vi.fn>
const approveMock = approvePendingAction as ReturnType<typeof vi.fn>
const rejectMock = rejectPendingAction as ReturnType<typeof vi.fn>

// mutate that actually invokes its optimistic-updater fn so the server action runs
const mutate = vi.fn(async (fn?: unknown) =>
  typeof fn === 'function' ? await (fn as () => Promise<unknown>)() : undefined
)

function action(
  overrides: Partial<PendingAgentAction> = {}
): PendingAgentAction {
  return {
    id: 'pa_1',
    workspace_id: 'ws_1',
    user_id: 'u_1',
    conversation_id: null,
    chat_message_id: 'cm_1',
    context_type: 'GLOBAL',
    context_id: null,
    action_type: 'CREATE_TASK',
    status: 'PENDING',
    params: { title: 'Uppdatera rutiner', description: null, priority: 'HIGH' },
    result_ref: null,
    created_at: new Date(),
    decided_at: null,
    expires_at: new Date(Date.now() + 1_000_000),
    ...overrides,
  } as PendingAgentAction
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AgentActionCard', () => {
  it('renders nothing while loading (no renderer content)', () => {
    useSWRMock.mockReturnValue({ data: undefined, mutate, isLoading: true })
    render(<AgentActionCard pendingActionId="pa_1" />)
    expect(
      screen.queryByRole('button', { name: /Godkänn/ })
    ).not.toBeInTheDocument()
  })

  it('renders nothing when the action is missing', () => {
    useSWRMock.mockReturnValue({ data: null, mutate, isLoading: false })
    const { container } = render(<AgentActionCard pendingActionId="pa_1" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('routes a CREATE_TASK action to the task renderer', () => {
    useSWRMock.mockReturnValue({ data: action(), mutate, isLoading: false })
    render(<AgentActionCard pendingActionId="pa_1" />)
    // Story 14.23 (UI v2): the renderer's frame draws the eyebrow + lead line;
    // editable fields sit behind the "Justera" disclosure.
    expect(screen.getByText('Förslag')).toBeInTheDocument()
    expect(screen.getByText(/Uppdatera rutiner/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Justera'))
    expect(screen.getByDisplayValue('Uppdatera rutiner')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Godkänn/ })).toBeInTheDocument()
  })

  it('shows a fallback for an unsupported action type', () => {
    useSWRMock.mockReturnValue({
      data: action({ action_type: 'SOMETHING_NEW' as never }),
      mutate,
      isLoading: false,
    })
    render(<AgentActionCard pendingActionId="pa_1" />)
    expect(
      screen.getByText('Den här typen av förslag stöds inte ännu')
    ).toBeInTheDocument()
  })

  it('approves optimistically via the server action', async () => {
    useSWRMock.mockReturnValue({ data: action(), mutate, isLoading: false })
    approveMock.mockResolvedValue({
      success: true,
      data: { resultRef: { taskId: 't1' } },
    })
    render(<AgentActionCard pendingActionId="pa_1" />)
    fireEvent.click(screen.getByRole('button', { name: /Godkänn/ }))
    await waitFor(() => expect(approveMock).toHaveBeenCalledWith('pa_1'))
    expect(mutate).toHaveBeenCalled()
  })

  it('rejects via the server action', async () => {
    useSWRMock.mockReturnValue({ data: action(), mutate, isLoading: false })
    rejectMock.mockResolvedValue({ success: true })
    render(<AgentActionCard pendingActionId="pa_1" />)
    fireEvent.click(screen.getByRole('button', { name: /Avvisa/ }))
    await waitFor(() => expect(rejectMock).toHaveBeenCalledWith('pa_1'))
  })
})
