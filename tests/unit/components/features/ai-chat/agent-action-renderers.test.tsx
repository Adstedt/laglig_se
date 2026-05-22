/**
 * Story 14.23, Task 9.2: tests for the per-type approval renderers.
 * Story 14.23 (UI v2): editable fields now sit behind the "Justera" disclosure
 * (single card) / the row trigger (compact). Tests expand before asserting
 * fields. Covers editable state, compact collapse, approve/reject, APPROVED.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { PendingAgentAction } from '@prisma/client'

vi.mock('@/app/actions/tasks', () => ({
  getWorkspaceMembers: vi.fn(async () => ({
    success: true,
    data: [{ id: 'u_2', name: 'Anna', email: 'anna@x.se', avatarUrl: null }],
  })),
}))

import { AddObligationRenderer } from '@/components/features/ai-chat/agent-action-renderers/add-obligation-renderer'
import { AddContextNoteRenderer } from '@/components/features/ai-chat/agent-action-renderers/add-context-note-renderer'
import { UpdateComplianceStatusRenderer } from '@/components/features/ai-chat/agent-action-renderers/update-compliance-status-renderer'
import { AssignTaskRenderer } from '@/components/features/ai-chat/agent-action-renderers/assign-task-renderer'
import { LinkTaskToDocumentRenderer } from '@/components/features/ai-chat/agent-action-renderers/link-task-to-document-renderer'

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
    action_type: 'ADD_OBLIGATION',
    status: 'PENDING',
    params: {},
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

/** Single-card fields live behind the "Justera" disclosure — open it. */
const expandJustera = () => fireEvent.click(screen.getByText('Justera'))

beforeEach(() => vi.clearAllMocks())

describe('AddObligationRenderer', () => {
  const params = {
    lawListItemId: 'li_1',
    lawTitle: 'AFS 2011:19',
    text: 'Dokumentera',
    bevisRequired: false,
  }

  it('PENDING: editable text + bevis switch behind Justera + approve/reject', () => {
    const h = handlers()
    render(
      <AddObligationRenderer
        action={action({ params } as never)}
        isSubmitting={false}
        {...h}
      />
    )
    // lead line visible, fields collapsed
    expect(screen.getByText(/Dokumentera/)).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Dokumentera')).not.toBeInTheDocument()
    expandJustera()
    expect(screen.getByDisplayValue('Dokumentera')).toBeInTheDocument()
    expect(
      screen.getByRole('switch', { name: /Bevis krävs/ })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Godkänn/ }))
    expect(h.onApprove).toHaveBeenCalledOnce()
  })

  it('disables Godkänn when the text is empty', () => {
    const h = handlers()
    render(
      <AddObligationRenderer
        action={action({ params: { ...params, text: '' } } as never)}
        isSubmitting={false}
        {...h}
      />
    )
    expect(screen.getByRole('button', { name: /Godkänn/ })).toBeDisabled()
  })

  it('APPROVED shows the done copy + laglista link', () => {
    const h = handlers()
    render(
      <AddObligationRenderer
        action={action({ status: 'APPROVED', params } as never)}
        isSubmitting={false}
        {...h}
      />
    )
    expect(screen.getByText(/kravpunkt tillagd/)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Visa i laglistan/ })
    ).toBeInTheDocument()
  })

  it('compact: collapsed by default, expands to reveal the editable body', () => {
    const h = handlers()
    render(
      <AddObligationRenderer
        action={action({ params } as never)}
        isSubmitting={false}
        compact
        {...h}
      />
    )
    // Collapsed: the one-line summary shows, the textarea does not.
    expect(screen.getByText('AFS 2011:19: Dokumentera')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Dokumentera')).not.toBeInTheDocument()
    // Expand via the row trigger (the summary line).
    fireEvent.click(screen.getByText('AFS 2011:19: Dokumentera'))
    expect(screen.getByDisplayValue('Dokumentera')).toBeInTheDocument()
  })
})

describe('AddContextNoteRenderer', () => {
  it('PENDING: editable note behind Justera + reject', () => {
    const h = handlers()
    render(
      <AddContextNoteRenderer
        action={action({
          action_type: 'ADD_CONTEXT_NOTE',
          params: {
            lawListItemId: 'li_1',
            lawTitle: 'GDPR',
            note: 'Behandlar persondata',
          },
        } as never)}
        isSubmitting={false}
        {...h}
      />
    )
    expandJustera()
    expect(screen.getByDisplayValue('Behandlar persondata')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Avvisa/ }))
    expect(h.onReject).toHaveBeenCalledOnce()
  })
})

describe('UpdateComplianceStatusRenderer', () => {
  const params = {
    lawListItemId: 'li_1',
    lawTitle: 'AML',
    oldStatus: 'EJ_PABORJAD',
    newStatus: 'UPPFYLLD',
    reason: 'Klart',
  }

  it('PENDING: lead shows the transition; reason field behind Justera', () => {
    const h = handlers()
    render(
      <UpdateComplianceStatusRenderer
        action={action({
          action_type: 'UPDATE_COMPLIANCE_STATUS',
          params,
        } as never)}
        isSubmitting={false}
        {...h}
      />
    )
    expect(screen.getByText(/Ej påbörjad → Uppfylld/)).toBeInTheDocument()
    expandJustera()
    expect(screen.getByDisplayValue('Klart')).toBeInTheDocument()
  })

  it('APPROVED shows old → new badges', () => {
    const h = handlers()
    render(
      <UpdateComplianceStatusRenderer
        action={action({
          status: 'APPROVED',
          action_type: 'UPDATE_COMPLIANCE_STATUS',
          params,
        } as never)}
        isSubmitting={false}
        {...h}
      />
    )
    expect(screen.getByText(/status uppdaterad/)).toBeInTheDocument()
  })
})

describe('AssignTaskRenderer', () => {
  it('PENDING: lead shows the assignee; approve enabled when userId set', () => {
    const h = handlers()
    render(
      <AssignTaskRenderer
        action={action({
          action_type: 'ASSIGN_TASK',
          params: {
            taskId: 't_1',
            taskTitle: 'Brandskydd',
            userId: 'u_2',
            userName: 'Anna',
          },
        } as never)}
        isSubmitting={false}
        {...h}
      />
    )
    expect(screen.getByText(/Brandskydd → Anna/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Godkänn/ })).toBeEnabled()
  })
})

describe('LinkTaskToDocumentRenderer', () => {
  it('PENDING: lead shows the proposed link + approve/reject', () => {
    const h = handlers()
    render(
      <LinkTaskToDocumentRenderer
        action={action({
          action_type: 'LINK_TASK_TO_DOCUMENT',
          params: {
            taskId: 't_1',
            taskTitle: 'Brandskydd',
            documentId: 'd_1',
            documentTitle: 'Brandpolicy',
          },
        } as never)}
        isSubmitting={false}
        {...h}
      />
    )
    expect(screen.getByText(/Brandskydd.*Brandpolicy/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Godkänn/ }))
    expect(h.onApprove).toHaveBeenCalledOnce()
  })
})
