/**
 * Story 14.22: Tests for TaskApprovalRenderer (CREATE_TASK approval body).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TaskApprovalRenderer } from '@/components/features/ai-chat/agent-action-renderers/task-approval-renderer'
import type { PendingAgentAction } from '@prisma/client'

function action(
  overrides: Partial<PendingAgentAction> = {}
): PendingAgentAction {
  return {
    id: 'pa_1',
    workspace_id: 'ws_1',
    user_id: 'user_1',
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

const handlers = () => ({
  onApprove: vi.fn(),
  onReject: vi.fn(),
  onParamsChange: vi.fn(),
})

beforeEach(() => vi.clearAllMocks())

describe('TaskApprovalRenderer — PENDING', () => {
  it('renders the editable title (behind Justera) and approve/reject buttons', () => {
    const h = handlers()
    render(
      <TaskApprovalRenderer action={action()} isSubmitting={false} {...h} />
    )
    // Story 14.23 (UI v2): fields sit behind the "Justera" disclosure.
    expect(screen.getByText(/Uppdatera rutiner/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Justera'))
    expect(screen.getByDisplayValue('Uppdatera rutiner')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Godkänn/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Avvisa/ })).toBeInTheDocument()
  })

  it('calls onApprove and onReject on click', () => {
    const h = handlers()
    render(
      <TaskApprovalRenderer action={action()} isSubmitting={false} {...h} />
    )
    fireEvent.click(screen.getByRole('button', { name: /Godkänn/ }))
    expect(h.onApprove).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: /Avvisa/ }))
    expect(h.onReject).toHaveBeenCalledOnce()
  })

  it('disables Godkänn when the title is empty', () => {
    const h = handlers()
    render(
      <TaskApprovalRenderer
        action={action({ params: { title: '', priority: 'MEDIUM' } as never })}
        isSubmitting={false}
        {...h}
      />
    )
    expect(screen.getByRole('button', { name: /Godkänn/ })).toBeDisabled()
  })
})

describe('TaskApprovalRenderer — read-only states', () => {
  it('APPROVED shows the done copy + a task link', () => {
    const h = handlers()
    render(
      <TaskApprovalRenderer
        action={action({
          status: 'APPROVED',
          result_ref: { taskId: 'task_99' } as never,
        })}
        isSubmitting={false}
        {...h}
      />
    )
    expect(screen.getByText(/Godkänt — uppgift skapad/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Visa uppgift/ })).toHaveAttribute(
      'href',
      '/tasks?task=task_99'
    )
  })

  it('REJECTED shows the muted "Avvisat" badge', () => {
    const h = handlers()
    render(
      <TaskApprovalRenderer
        action={action({ status: 'REJECTED' })}
        isSubmitting={false}
        {...h}
      />
    )
    expect(screen.getByText(/Avvisat/)).toBeInTheDocument()
  })

  it('EXPIRED shows the expiry message', () => {
    const h = handlers()
    render(
      <TaskApprovalRenderer
        action={action({ status: 'EXPIRED' })}
        isSubmitting={false}
        {...h}
      />
    )
    expect(screen.getByText('Förslaget har gått ut')).toBeInTheDocument()
  })
})
