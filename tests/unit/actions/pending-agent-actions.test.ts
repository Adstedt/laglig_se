/**
 * Story 14.22: Tests for pending-agent-action server actions.
 * Covers ownership checks, approve-dispatch (success + failure), reject,
 * update-params, and expire.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockWithWorkspace,
  mockCreateTask,
  mockUpdateTasksBulk,
  mockLinkDocumentToTask,
  mockCreateRequirement,
  mockCreateDocument,
  mockLinkDocumentToListItem,
} = vi.hoisted(() => ({
  mockWithWorkspace: vi.fn(),
  mockCreateTask: vi.fn(),
  mockUpdateTasksBulk: vi.fn(),
  mockLinkDocumentToTask: vi.fn(),
  mockCreateRequirement: vi.fn(),
  mockCreateDocument: vi.fn(),
  mockLinkDocumentToListItem: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    pendingAgentAction: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    lawListItem: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    workspaceDocument: {
      deleteMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/workspace-context', () => ({
  withWorkspace: mockWithWorkspace,
}))

vi.mock('@/app/actions/tasks', () => ({
  createTask: mockCreateTask,
  updateTasksBulk: mockUpdateTasksBulk,
}))

vi.mock('@/app/actions/documents', () => ({
  linkDocumentToTask: mockLinkDocumentToTask,
  createDocument: mockCreateDocument,
  linkDocumentToListItem: mockLinkDocumentToListItem,
}))

vi.mock('@/app/actions/law-list-item-requirements', () => ({
  createRequirement: mockCreateRequirement,
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import {
  getPendingAgentAction,
  getPendingAgentActionsByMessage,
  approvePendingAction,
  rejectPendingAction,
  updatePendingActionParams,
  expirePendingActions,
  openDraftInEditor,
  finalizeDraftFromEditor,
  rejectDraftFromEditor,
} from '@/app/actions/pending-agent-actions'
import { prisma } from '@/lib/prisma'

// Story 14.23: ctx now carries hasPermission — approve gates on `tasks:edit`.
const ctx = {
  userId: 'user_123',
  workspaceId: 'ws_123',
  hasPermission: (_p: string) => true,
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pa_1',
    workspace_id: 'ws_123',
    user_id: 'user_123',
    conversation_id: null,
    chat_message_id: 'cm_1',
    context_type: 'GLOBAL',
    context_id: null,
    action_type: 'CREATE_TASK',
    status: 'PENDING',
    params: { title: 'Test', description: null, priority: 'HIGH' },
    result_ref: null,
    created_at: new Date(),
    decided_at: null,
    expires_at: new Date(Date.now() + 1_000_000),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockWithWorkspace.mockImplementation((cb: (_c: typeof ctx) => unknown) =>
    cb(ctx)
  )
})

describe('getPendingAgentAction', () => {
  it('returns the row when owned', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(row())
    const result = await getPendingAgentAction('pa_1')
    expect(result.success).toBe(true)
    expect(result.data?.id).toBe('pa_1')
  })

  it('returns Forbidden for a cross-workspace row', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(row({ workspace_id: 'other_ws' }))
    const result = await getPendingAgentAction('pa_1')
    expect(result).toEqual({ success: false, error: 'Forbidden' })
  })

  it('returns Forbidden when the row does not exist', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null)
    const result = await getPendingAgentAction('missing')
    expect(result).toEqual({ success: false, error: 'Forbidden' })
  })
})

describe('approvePendingAction', () => {
  it('dispatches CREATE_TASK and marks APPROVED on success', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(row())
    mockCreateTask.mockResolvedValue({
      success: true,
      data: { id: 'task_1', title: 'Test' },
    })
    ;(
      prisma.pendingAgentAction.update as ReturnType<typeof vi.fn>
    ).mockResolvedValue({})

    const result = await approvePendingAction('pa_1')

    // params mapped to createTask args (HIGH priority, no description)
    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Test', priority: 'HIGH' })
    )
    expect(prisma.pendingAgentAction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pa_1' },
        data: expect.objectContaining({
          status: 'APPROVED',
          result_ref: { taskId: 'task_1' },
        }),
      })
    )
    expect(result.success).toBe(true)
    expect(result.data?.resultRef).toEqual({ taskId: 'task_1' })
  })

  it('leaves the row PENDING when dispatch fails', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(row())
    mockCreateTask.mockResolvedValue({ success: false, error: 'no column' })

    const result = await approvePendingAction('pa_1')

    expect(prisma.pendingAgentAction.update).not.toHaveBeenCalled()
    expect(result).toEqual({ success: false, error: 'no column' })
  })

  it('rejects a non-PENDING row', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(row({ status: 'APPROVED' }))
    const result = await approvePendingAction('pa_1')
    expect(result.success).toBe(false)
    expect(mockCreateTask).not.toHaveBeenCalled()
  })

  it('returns Forbidden for a cross-user row', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(row({ user_id: 'other_user' }))
    const result = await approvePendingAction('pa_1')
    expect(result).toEqual({ success: false, error: 'Forbidden' })
  })
})

describe('DRAFT_DOCUMENT (Story 14.24)', () => {
  const draftParams = {
    title: 'Arbetsmiljöpolicy',
    docType: 'POLICY',
    contentJson: { type: 'doc', content: [] },
    contextLinks: [{ kind: 'LIST_ITEM', id: 'li_1' }],
  }
  const fu = () =>
    prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
  const up = () => prisma.pendingAgentAction.update as ReturnType<typeof vi.fn>
  const del = () =>
    prisma.workspaceDocument.deleteMany as ReturnType<typeof vi.fn>

  describe('approvePendingAction — no-edit path', () => {
    it('creates the document, wires the link, marks APPROVED', async () => {
      fu().mockResolvedValue(
        row({ action_type: 'DRAFT_DOCUMENT', params: draftParams })
      )
      mockCreateDocument.mockResolvedValue({
        success: true,
        data: { id: 'doc_1', title: 'Arbetsmiljöpolicy', versionNumber: 1 },
      })
      mockLinkDocumentToListItem.mockResolvedValue({ success: true })
      up().mockResolvedValue({})

      const result = await approvePendingAction('pa_1')

      expect(mockCreateDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Arbetsmiljöpolicy',
          documentType: 'POLICY',
        })
      )
      expect(mockLinkDocumentToListItem).toHaveBeenCalledWith('doc_1', 'li_1')
      expect(up()).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'APPROVED',
            result_ref: expect.objectContaining({ documentId: 'doc_1' }),
          }),
        })
      )
      expect(result.success).toBe(true)
    })

    it('leaves the row PENDING when document creation fails', async () => {
      fu().mockResolvedValue(
        row({ action_type: 'DRAFT_DOCUMENT', params: draftParams })
      )
      mockCreateDocument.mockResolvedValue({ success: false, error: 'fail' })

      const result = await approvePendingAction('pa_1')

      expect(up()).not.toHaveBeenCalled()
      expect(result).toEqual({ success: false, error: 'fail' })
    })

    it('keeps the document + marks APPROVED with partialLinkErrors on link failure', async () => {
      fu().mockResolvedValue(
        row({ action_type: 'DRAFT_DOCUMENT', params: draftParams })
      )
      mockCreateDocument.mockResolvedValue({
        success: true,
        data: { id: 'doc_1', title: 'x', versionNumber: 1 },
      })
      mockLinkDocumentToListItem.mockResolvedValue({
        success: false,
        error: 'redan länkad',
      })
      up().mockResolvedValue({})

      const result = await approvePendingAction('pa_1')

      const call = up().mock.calls[0][0]
      expect(call.data.status).toBe('APPROVED')
      expect(call.data.result_ref.partialLinkErrors).toHaveLength(1)
      expect(result.success).toBe(true)
    })
  })

  describe('openDraftInEditor', () => {
    it('creates the doc, sets IN_EDITOR + result_ref, returns documentId', async () => {
      fu().mockResolvedValue(
        row({ action_type: 'DRAFT_DOCUMENT', params: draftParams })
      )
      mockCreateDocument.mockResolvedValue({
        success: true,
        data: { id: 'doc_1', title: 'x', versionNumber: 1 },
      })
      up().mockResolvedValue({})

      const result = await openDraftInEditor('pa_1')

      expect(up()).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'IN_EDITOR', result_ref: { documentId: 'doc_1' } },
        })
      )
      expect(result.data).toEqual({ documentId: 'doc_1' })
    })

    it('leaves the row PENDING (no IN_EDITOR) when doc creation fails', async () => {
      fu().mockResolvedValue(
        row({ action_type: 'DRAFT_DOCUMENT', params: draftParams })
      )
      mockCreateDocument.mockResolvedValue({ success: false, error: 'fail' })

      const result = await openDraftInEditor('pa_1')

      expect(up()).not.toHaveBeenCalled()
      expect(result.success).toBe(false)
    })

    it('refuses without tasks:edit (AC 23)', async () => {
      mockWithWorkspace.mockImplementationOnce(
        (cb: (_c: typeof ctx) => unknown) =>
          cb({ ...ctx, hasPermission: () => false })
      )
      fu().mockResolvedValue(
        row({ action_type: 'DRAFT_DOCUMENT', params: draftParams })
      )
      const result = await openDraftInEditor('pa_1')
      expect(result.success).toBe(false)
      expect(mockCreateDocument).not.toHaveBeenCalled()
    })
  })

  describe('finalizeDraftFromEditor', () => {
    it('wires links and marks APPROVED (content already autosaved)', async () => {
      fu().mockResolvedValue(
        row({
          action_type: 'DRAFT_DOCUMENT',
          status: 'IN_EDITOR',
          params: draftParams,
          result_ref: { documentId: 'doc_1' },
        })
      )
      mockLinkDocumentToListItem.mockResolvedValue({ success: true })
      up().mockResolvedValue({})

      const result = await finalizeDraftFromEditor('pa_1')

      expect(mockLinkDocumentToListItem).toHaveBeenCalledWith('doc_1', 'li_1')
      expect(up().mock.calls[0][0].data.status).toBe('APPROVED')
      expect(result.data).toEqual({ documentId: 'doc_1' })
    })
  })

  describe('rejectDraftFromEditor', () => {
    it('deletes the document and marks REJECTED', async () => {
      fu().mockResolvedValue(
        row({
          action_type: 'DRAFT_DOCUMENT',
          status: 'IN_EDITOR',
          params: draftParams,
          result_ref: { documentId: 'doc_1' },
        })
      )
      del().mockResolvedValue({ count: 1 })
      up().mockResolvedValue({})

      const result = await rejectDraftFromEditor('pa_1')

      expect(del()).toHaveBeenCalledWith({
        where: { id: 'doc_1', workspace_id: 'ws_123' },
      })
      expect(up().mock.calls[0][0].data.status).toBe('REJECTED')
      expect(result.success).toBe(true)
    })
  })

  describe('rejectPendingAction — IN_EDITOR draft from the card (Task 8)', () => {
    it('deletes the orphaned document before rejecting', async () => {
      fu().mockResolvedValue(
        row({
          action_type: 'DRAFT_DOCUMENT',
          status: 'IN_EDITOR',
          params: draftParams,
          result_ref: { documentId: 'doc_1' },
        })
      )
      del().mockResolvedValue({ count: 1 })
      up().mockResolvedValue({})

      const result = await rejectPendingAction('pa_1')

      expect(del()).toHaveBeenCalledWith({
        where: { id: 'doc_1', workspace_id: 'ws_123' },
      })
      expect(up().mock.calls[0][0].data.status).toBe('REJECTED')
      expect(result.success).toBe(true)
    })
  })
})

describe('approvePendingAction — tasks:edit gate (SEC-001, 14.23)', () => {
  it('refuses to approve when the role lacks tasks:edit', async () => {
    mockWithWorkspace.mockImplementationOnce(
      (cb: (_c: typeof ctx) => unknown) =>
        cb({ ...ctx, hasPermission: () => false })
    )
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(row())

    const result = await approvePendingAction('pa_1')

    expect(result.success).toBe(false)
    expect(mockCreateTask).not.toHaveBeenCalled()
    expect(prisma.pendingAgentAction.update).not.toHaveBeenCalled()
  })
})

describe('approvePendingAction — extended types (14.23)', () => {
  beforeEach(() =>
    (
      prisma.pendingAgentAction.update as ReturnType<typeof vi.fn>
    ).mockResolvedValue({})
  )

  it('dispatches LINK_TASK_TO_DOCUMENT via linkDocumentToTask(documentId, taskId)', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({
        action_type: 'LINK_TASK_TO_DOCUMENT',
        params: { taskId: 't_1', documentId: 'd_1' },
      })
    )
    mockLinkDocumentToTask.mockResolvedValue({ success: true })

    const result = await approvePendingAction('pa_1')

    expect(mockLinkDocumentToTask).toHaveBeenCalledWith('d_1', 't_1')
    expect(result.data?.resultRef).toEqual({ taskId: 't_1', documentId: 'd_1' })
  })

  it('surfaces the Swedish "already linked" error and stays PENDING', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({
        action_type: 'LINK_DOCUMENT_TO_TASK',
        params: { taskId: 't_1', documentId: 'd_1' },
      })
    )
    mockLinkDocumentToTask.mockResolvedValue({
      success: false,
      error: 'Dokumentet är redan länkat till denna uppgift',
    })

    const result = await approvePendingAction('pa_1')

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/redan länkat/)
    expect(prisma.pendingAgentAction.update).not.toHaveBeenCalled()
  })

  it('dispatches ADD_OBLIGATION via createRequirement with bevisRequired', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({
        action_type: 'ADD_OBLIGATION',
        params: {
          lawListItemId: 'li_1',
          text: 'Dokumentera',
          bevisRequired: true,
        },
      })
    )
    mockCreateRequirement.mockResolvedValue({
      success: true,
      data: { id: 'req_1' },
    })

    const result = await approvePendingAction('pa_1')

    expect(mockCreateRequirement).toHaveBeenCalledWith('li_1', 'Dokumentera', {
      bevisRequired: true,
    })
    expect(result.data?.resultRef).toEqual({ requirementId: 'req_1' })
  })

  it('dispatches ASSIGN_TASK via updateTasksBulk([taskId], { assigneeId })', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({
        action_type: 'ASSIGN_TASK',
        params: { taskId: 't_1', userId: 'u_2' },
      })
    )
    mockUpdateTasksBulk.mockResolvedValue({ success: true })

    const result = await approvePendingAction('pa_1')

    expect(mockUpdateTasksBulk).toHaveBeenCalledWith(['t_1'], {
      assigneeId: 'u_2',
    })
    expect(result.data?.resultRef).toEqual({ taskId: 't_1', assigneeId: 'u_2' })
  })

  it('dispatches ADD_CONTEXT_NOTE by appending to business_context', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({
        action_type: 'ADD_CONTEXT_NOTE',
        params: { lawListItemId: 'li_1', note: 'Ny anteckning' },
      })
    )
    ;(
      prisma.lawListItem.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: 'li_1',
      business_context: 'Befintlig',
    })
    ;(prisma.lawListItem.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      {}
    )

    const result = await approvePendingAction('pa_1')

    expect(prisma.lawListItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { business_context: 'Befintlig\n\n---\n\nNy anteckning' },
      })
    )
    expect(result.success).toBe(true)
  })

  it('dispatches UPDATE_COMPLIANCE_STATUS by updating compliance_status', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({
        action_type: 'UPDATE_COMPLIANCE_STATUS',
        params: { lawListItemId: 'li_1', newStatus: 'UPPFYLLD' },
      })
    )
    ;(
      prisma.lawListItem.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: 'li_1',
    })
    ;(prisma.lawListItem.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      {}
    )

    const result = await approvePendingAction('pa_1')

    expect(prisma.lawListItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { compliance_status: 'UPPFYLLD' },
      })
    )
    expect(result.data?.resultRef).toEqual({
      lawListItemId: 'li_1',
      newStatus: 'UPPFYLLD',
    })
  })
})

describe('getPendingAgentActionsByMessage', () => {
  it('returns rows for a message ordered by created_at asc', async () => {
    const rows = [row({ id: 'pa_1' }), row({ id: 'pa_2' })]
    ;(
      prisma.pendingAgentAction.findMany as ReturnType<typeof vi.fn>
    ).mockResolvedValue(rows)

    const result = await getPendingAgentActionsByMessage('cm_1')

    expect(prisma.pendingAgentAction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          chat_message_id: 'cm_1',
          workspace_id: 'ws_123',
          user_id: 'user_123',
        }),
        orderBy: { created_at: 'asc' },
      })
    )
    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(2)
  })
})

describe('rejectPendingAction', () => {
  it('sets REJECTED for a PENDING row', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(row())
    ;(
      prisma.pendingAgentAction.update as ReturnType<typeof vi.fn>
    ).mockResolvedValue({})
    const result = await rejectPendingAction('pa_1')
    expect(prisma.pendingAgentAction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'REJECTED' }),
      })
    )
    expect(result.success).toBe(true)
  })

  it('refuses a non-PENDING row', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(row({ status: 'EXPIRED' }))
    const result = await rejectPendingAction('pa_1')
    expect(result.success).toBe(false)
    expect(prisma.pendingAgentAction.update).not.toHaveBeenCalled()
  })
})

describe('updatePendingActionParams', () => {
  it('refuses to edit when the role lacks tasks:edit (QA UPDATEPARAMS-GATE)', async () => {
    mockWithWorkspace.mockImplementationOnce(
      (cb: (_c: typeof ctx) => unknown) =>
        cb({ ...ctx, hasPermission: () => false })
    )
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(row())
    const result = await updatePendingActionParams('pa_1', { title: 'x' })
    expect(result.success).toBe(false)
    expect(prisma.pendingAgentAction.update).not.toHaveBeenCalled()
  })

  it('updates params for a PENDING row', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(row())
    ;(
      prisma.pendingAgentAction.update as ReturnType<typeof vi.fn>
    ).mockResolvedValue({})
    const result = await updatePendingActionParams('pa_1', {
      title: 'Edited',
      priority: 'LOW',
    })
    expect(prisma.pendingAgentAction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { params: { title: 'Edited', priority: 'LOW' } },
      })
    )
    expect(result.success).toBe(true)
  })

  it('refuses to edit a non-PENDING row', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(row({ status: 'APPROVED' }))
    const result = await updatePendingActionParams('pa_1', { title: 'x' })
    expect(result.success).toBe(false)
    expect(prisma.pendingAgentAction.update).not.toHaveBeenCalled()
  })
})

describe('expirePendingActions', () => {
  it('expires only PENDING rows past their expiry and returns the count', async () => {
    ;(
      prisma.pendingAgentAction.updateMany as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ count: 3 })
    const result = await expirePendingActions()
    const call = (
      prisma.pendingAgentAction.updateMany as ReturnType<typeof vi.fn>
    ).mock.calls[0][0]
    expect(call.where.status).toBe('PENDING')
    expect(call.where.expires_at).toHaveProperty('lt')
    expect(call.data).toEqual({ status: 'EXPIRED' })
    expect(result).toEqual({ expiredCount: 3 })
  })
})
