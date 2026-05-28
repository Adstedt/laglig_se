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
import { UpdateRequirementRenderer } from '@/components/features/ai-chat/agent-action-renderers/update-requirement-renderer'
import { AddContextNoteRenderer } from '@/components/features/ai-chat/agent-action-renderers/add-context-note-renderer'
import { UpdateComplianceStatusRenderer } from '@/components/features/ai-chat/agent-action-renderers/update-compliance-status-renderer'
import { AssignTaskRenderer } from '@/components/features/ai-chat/agent-action-renderers/assign-task-renderer'
import { LinkTaskToDocumentRenderer } from '@/components/features/ai-chat/agent-action-renderers/link-task-to-document-renderer'
// Story 14.29: add_task_comment renderer.
import { AddTaskCommentRenderer } from '@/components/features/ai-chat/agent-action-renderers/add-task-comment-renderer'
// Story 14.30: transition_document_status renderer.
import { TransitionDocumentStatusRenderer } from '@/components/features/ai-chat/agent-action-renderers/transition-document-status-renderer'

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
    expect(screen.getByText('Dokumentera')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Dokumentera')).not.toBeInTheDocument()
    // Expand via the row trigger (the summary line).
    fireEvent.click(screen.getByText('Dokumentera'))
    expect(screen.getByDisplayValue('Dokumentera')).toBeInTheDocument()
  })
})

describe('UpdateRequirementRenderer', () => {
  const params = {
    requirementId: 'req_1',
    lawListItemId: 'li_1',
    patch: { isFulfilled: true, comment: 'Klart' },
    oldSnapshot: {
      text: 'Dokumentera',
      isFulfilled: false,
      comment: null,
      bevisRequired: false,
    },
    entity_version: '2026-01-01T00:00:00.000Z',
  }

  it('PENDING: lead shows the fulfilled transition; renders only the changed fields', () => {
    const h = handlers()
    render(
      <UpdateRequirementRenderer
        action={action({ action_type: 'UPDATE_REQUIREMENT', params } as never)}
        isSubmitting={false}
        {...h}
      />
    )
    // The one-line summary shows the boolean transition.
    expect(screen.getByText(/uppfylld: Nej → Ja/)).toBeInTheDocument()
    expandJustera()
    // Changed fields present…
    expect(screen.getByRole('switch', { name: /Uppfylld/ })).toBeInTheDocument()
    expect(screen.getByDisplayValue('Klart')).toBeInTheDocument()
    // …unchanged fields (text, bevis) are NOT rendered (not in patch).
    expect(
      screen.queryByPlaceholderText('Beskriv kravet…')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('switch', { name: /Bevis krävs/ })
    ).not.toBeInTheDocument()
  })

  it('disables Godkänn when a proposed text edit is cleared', () => {
    const h = handlers()
    render(
      <UpdateRequirementRenderer
        action={action({
          action_type: 'UPDATE_REQUIREMENT',
          params: {
            ...params,
            patch: { text: 'Skärpt formulering' },
          },
        } as never)}
        isSubmitting={false}
        {...h}
      />
    )
    expandJustera()
    fireEvent.change(screen.getByDisplayValue('Skärpt formulering'), {
      target: { value: '   ' },
    })
    expect(screen.getByRole('button', { name: /Godkänn/ })).toBeDisabled()
  })

  it('APPROVED shows the done copy + laglista link', () => {
    const h = handlers()
    render(
      <UpdateRequirementRenderer
        action={action({
          status: 'APPROVED',
          action_type: 'UPDATE_REQUIREMENT',
          params,
        } as never)}
        isSubmitting={false}
        {...h}
      />
    )
    expect(screen.getByText(/kravpunkt uppdaterad/)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Visa i laglistan/ })
    ).toBeInTheDocument()
  })

  it('compact: collapsed summary, expands to reveal the editable diff', () => {
    const h = handlers()
    render(
      <UpdateRequirementRenderer
        action={action({ action_type: 'UPDATE_REQUIREMENT', params } as never)}
        isSubmitting={false}
        compact
        {...h}
      />
    )
    expect(screen.getByText(/Ändra kravpunkt/)).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Klart')).not.toBeInTheDocument()
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

// Story 14.29: ADD_TASK_COMMENT renderer.
describe('AddTaskCommentRenderer', () => {
  const params = {
    taskId: 't_1',
    taskTitle: 'Brandskydd',
    content: 'Bedömning: ingen påverkan på vår rutin.',
  }

  it('PENDING: lead shows the task title in the summary; editable comment behind Justera + approve enabled', () => {
    const h = handlers()
    render(
      <AddTaskCommentRenderer
        action={action({ action_type: 'ADD_TASK_COMMENT', params } as never)}
        isSubmitting={false}
        {...h}
      />
    )
    // Summary (visible in the lead): `Brandskydd: "..."` — match as substring.
    expect(screen.getByText(/Brandskydd/)).toBeInTheDocument()
    expandJustera()
    expect(
      screen.getByDisplayValue(/Bedömning: ingen påverkan/)
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Godkänn/ })).toBeEnabled()
  })

  it('approve click calls onApprove', () => {
    const h = handlers()
    render(
      <AddTaskCommentRenderer
        action={action({ action_type: 'ADD_TASK_COMMENT', params } as never)}
        isSubmitting={false}
        {...h}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Godkänn/ }))
    expect(h.onApprove).toHaveBeenCalledOnce()
  })

  it('APPROVED shows read-only comment + a link to the task by id (AC 9)', () => {
    const h = handlers()
    render(
      <AddTaskCommentRenderer
        action={action({
          action_type: 'ADD_TASK_COMMENT',
          status: 'APPROVED',
          params,
        } as never)}
        isSubmitting={false}
        {...h}
      />
    )
    expect(screen.getByText(/Bedömning: ingen påverkan/)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /Visa uppgift/ })
    expect(link).toHaveAttribute('href', '/tasks?task=t_1')
  })
})

// Story 14.30: TRANSITION_DOCUMENT_STATUS renderer.
describe('TransitionDocumentStatusRenderer', () => {
  const params = {
    documentId: 'd_1',
    documentTitle: 'Brandskyddspolicy',
    oldStatus: 'DRAFT' as const,
    newStatus: 'IN_REVIEW' as const,
    oldStatusLabel: 'Utkast',
    newStatusLabel: 'Under granskning',
  }

  it('PENDING: lead shows DocumentStatusBadge pills (Utkast + Under granskning) AND the document title — visible without expanding Justera', () => {
    const h = handlers()
    render(
      <TransitionDocumentStatusRenderer
        action={action({
          action_type: 'TRANSITION_DOCUMENT_STATUS',
          params,
        } as never)}
        isSubmitting={false}
        {...h}
      />
    )
    // AC 10: the badge transition is the signature UX — must be in the lead,
    // not buried behind Justera. Each badge renders its own label via
    // DocumentStatusBadge's STATUS_CONFIG lookup, so they're in separate text
    // nodes — query them individually.
    expect(screen.getByText('Utkast')).toBeInTheDocument()
    expect(screen.getByText('Under granskning')).toBeInTheDocument()
    expect(screen.getByText(/Brandskyddspolicy/)).toBeInTheDocument()
    // Raw enum must NOT appear in the visible UI.
    expect(screen.queryByText(/DRAFT/)).not.toBeInTheDocument()
    expect(screen.queryByText(/IN_REVIEW/)).not.toBeInTheDocument()
  })

  it('PENDING: editable comment behind Justera (target is fixed — no APPROVED option offered)', () => {
    const h = handlers()
    render(
      <TransitionDocumentStatusRenderer
        action={action({
          action_type: 'TRANSITION_DOCUMENT_STATUS',
          params: { ...params, comment: 'Klart för granskning.' },
        } as never)}
        isSubmitting={false}
        {...h}
      />
    )
    expandJustera()
    expect(
      screen.getByDisplayValue('Klart för granskning.')
    ).toBeInTheDocument()
    // AC 10: target is fixed — no APPROVED select/option in the renderer.
    expect(screen.queryByText('Godkänd')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('approve click calls onApprove', () => {
    const h = handlers()
    render(
      <TransitionDocumentStatusRenderer
        action={action({
          action_type: 'TRANSITION_DOCUMENT_STATUS',
          params,
        } as never)}
        isSubmitting={false}
        {...h}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /Godkänn/ }))
    expect(h.onApprove).toHaveBeenCalledOnce()
  })

  it('APPROVED shows the status badges + a link to /workspace/styrdokument/<id>/edit (AC 11)', () => {
    const h = handlers()
    render(
      <TransitionDocumentStatusRenderer
        action={action({
          action_type: 'TRANSITION_DOCUMENT_STATUS',
          status: 'APPROVED',
          params,
        } as never)}
        isSubmitting={false}
        {...h}
      />
    )
    expect(screen.getByText(/Godkänt — status ändrad/)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /Öppna dokument/ })
    expect(link).toHaveAttribute('href', '/workspace/styrdokument/d_1/edit')
  })
})
