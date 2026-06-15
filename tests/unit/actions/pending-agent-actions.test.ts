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
  mockUpdateRequirement,
  mockCreateDocument,
  mockLinkDocumentToListItem,
  mockCreateComment,
  mockUpdateDocumentStatus,
  mockSaveDocumentVersion,
  mockCreateDraftFromApprovedWithEdit,
  mockUpdateDraftVersionInPlace,
} = vi.hoisted(() => ({
  mockWithWorkspace: vi.fn(),
  mockCreateTask: vi.fn(),
  mockUpdateTasksBulk: vi.fn(),
  mockLinkDocumentToTask: vi.fn(),
  mockCreateRequirement: vi.fn(),
  mockUpdateRequirement: vi.fn(),
  mockCreateDocument: vi.fn(),
  mockLinkDocumentToListItem: vi.fn(),
  // Story 14.29: ADD_TASK_COMMENT dispatch target.
  mockCreateComment: vi.fn(),
  // Story 14.30: TRANSITION_DOCUMENT_STATUS dispatch target.
  mockUpdateDocumentStatus: vi.fn(),
  // Story 17.11: UPDATE_DOCUMENT dispatch target.
  mockSaveDocumentVersion: vi.fn(),
  // Story 17.11c: auto-branch dispatch target (APPROVED-no-draft path).
  mockCreateDraftFromApprovedWithEdit: vi.fn(),
  // Story 17.22: in-place draft-update dispatch target (draft-exists path).
  mockUpdateDraftVersionInPlace: vi.fn(),
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
      // Story 17.11: dispatch re-reads the live document for the status guard.
      findFirst: vi.fn(),
    },
    // Story 17.11: dispatch stamps agent authorship onto the activity log row
    // saveDocumentVersion writes (find by version_number, patch new_value).
    activityLog: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    // Batch approve marks AgentDecisionLog rows accepted (best-effort).
    agentDecisionLog: {
      updateMany: vi.fn(),
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
  // Story 14.30: TRANSITION_DOCUMENT_STATUS dispatch target.
  updateDocumentStatus: mockUpdateDocumentStatus,
  // Story 17.11: UPDATE_DOCUMENT dispatch target.
  saveDocumentVersion: mockSaveDocumentVersion,
  // Story 17.11c: auto-branch dispatch target.
  createDraftFromApprovedWithEdit: mockCreateDraftFromApprovedWithEdit,
  // Story 17.22: in-place draft-update dispatch target.
  updateDraftVersionInPlace: mockUpdateDraftVersionInPlace,
}))

vi.mock('@/app/actions/law-list-item-requirements', () => ({
  createRequirement: mockCreateRequirement,
  updateRequirement: mockUpdateRequirement,
}))

// Story 14.29: ADD_TASK_COMMENT dispatch target.
vi.mock('@/app/actions/task-modal', () => ({
  createComment: mockCreateComment,
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import {
  getPendingAgentAction,
  getPendingAgentActionsByMessage,
  approvePendingAction,
  approvePendingActions,
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

  it('dispatches UPDATE_REQUIREMENT via updateRequirement with the patch', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({
        action_type: 'UPDATE_REQUIREMENT',
        params: {
          requirementId: 'req_1',
          patch: { isFulfilled: true, comment: 'Klart' },
        },
      })
    )
    mockUpdateRequirement.mockResolvedValue({ success: true })

    const result = await approvePendingAction('pa_1')

    expect(mockUpdateRequirement).toHaveBeenCalledWith('req_1', {
      isFulfilled: true,
      comment: 'Klart',
    })
    expect(result.data?.resultRef).toEqual({ requirementId: 'req_1' })
  })

  it('UPDATE_REQUIREMENT keeps the row PENDING on dispatch failure', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({
        action_type: 'UPDATE_REQUIREMENT',
        params: { requirementId: 'req_1', patch: { isFulfilled: true } },
      })
    )
    mockUpdateRequirement.mockResolvedValue({
      success: false,
      error: 'Kunde inte',
    })

    const result = await approvePendingAction('pa_1')

    expect(result.success).toBe(false)
    // Not marked APPROVED — the row update only runs after a successful dispatch.
    expect(prisma.pendingAgentAction.update).not.toHaveBeenCalled()
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

// Issue 3: approving several same-document edits at once consolidates them into
// ONE new version (v+1) instead of one version per edit (the v13→v19 bug).
describe('approvePendingActions — batch consolidation', () => {
  const DOC_CONTENT = {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Syfte' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Old purpose.' }],
      },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Ansvar' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Old responsibility.' }],
      },
    ],
  }
  const editRow = (
    id: string,
    heading: string,
    text: string,
    extra: Record<string, unknown> = {}
  ) =>
    row({
      id,
      chat_message_id: 'cm_batch',
      action_type: 'UPDATE_DOCUMENT',
      created_at: new Date(`2026-06-01T10:0${id.slice(-1)}:00.000Z`),
      params: {
        documentId: 'd_1',
        sectionHeading: heading,
        newSectionContentJson: [
          { type: 'paragraph', content: [{ type: 'text', text }] },
        ],
        changeSummary: `Ändra ${heading}`,
        entity_version: '2026-06-01T10:00:00.000Z',
        ...extra,
      },
    })

  beforeEach(() => {
    ;(
      prisma.pendingAgentAction.updateMany as ReturnType<typeof vi.fn>
    ).mockResolvedValue({})
    ;(
      prisma.agentDecisionLog.updateMany as ReturnType<typeof vi.fn>
    ).mockResolvedValue({})
    ;(
      prisma.activityLog.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null)
  })

  it('consolidates same-document edits into ONE in-place draft update (draft exists)', async () => {
    ;(
      prisma.pendingAgentAction.findMany as ReturnType<typeof vi.fn>
    ).mockResolvedValue([
      editRow('pa_1', 'Syfte', 'New purpose.'),
      editRow('pa_2', 'Ansvar', 'New responsibility.'),
    ])
    ;(
      prisma.workspaceDocument.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: 'd_1',
      status: 'DRAFT',
      workspace_id: 'ws_123',
      current_draft_version_id: 'v_d',
      current_approved_version_id: null,
      current_draft_version: { content_json: DOC_CONTENT },
      current_approved_version: null,
    })
    // Story 17.22: a draft exists → the single batch write goes in place
    // (no new version), returning the UNCHANGED version number + audit-row id.
    mockUpdateDraftVersionInPlace.mockResolvedValue({
      success: true,
      data: { id: 'v_2', versionNumber: 2, activityLogId: 'al_batch' },
    })

    const result = await approvePendingActions(['pa_1', 'pa_2'])

    expect(result.success).toBe(true)
    expect(result.data?.approved).toBe(2)
    // ONE in-place write, not one per edit; no version minted, no branch.
    expect(mockUpdateDraftVersionInPlace).toHaveBeenCalledTimes(1)
    expect(mockSaveDocumentVersion).not.toHaveBeenCalled()
    expect(mockCreateDraftFromApprovedWithEdit).not.toHaveBeenCalled()
    // Both edits landed in the single written tree (HTML is arg index 4).
    const html = mockUpdateDraftVersionInPlace.mock.calls[0]![4]
    expect(html).toContain('New purpose.')
    expect(html).toContain('New responsibility.')
    // Both rows marked APPROVED sharing the one version.
    const upd = (
      prisma.pendingAgentAction.updateMany as ReturnType<typeof vi.fn>
    ).mock.calls[0]![0]
    expect([...upd.where.id.in].sort()).toEqual(['pa_1', 'pa_2'])
    expect(upd.data.status).toBe('APPROVED')
    expect(upd.data.result_ref).toEqual({
      documentId: 'd_1',
      versionId: 'v_2',
      versionNumber: 2,
    })
  })

  it('applies a rename (newTitle) within the consolidated write', async () => {
    ;(
      prisma.pendingAgentAction.findMany as ReturnType<typeof vi.fn>
    ).mockResolvedValue([
      editRow('pa_1', 'Syfte', 'New purpose.', {
        newTitle: 'Nordviken policy',
      }),
      editRow('pa_2', 'Ansvar', 'New responsibility.'),
    ])
    ;(
      prisma.workspaceDocument.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: 'd_1',
      status: 'DRAFT',
      workspace_id: 'ws_123',
      current_draft_version_id: 'v_d',
      current_approved_version_id: null,
      current_draft_version: { content_json: DOC_CONTENT },
      current_approved_version: null,
    })
    mockUpdateDraftVersionInPlace.mockResolvedValue({
      success: true,
      data: { id: 'v_2', versionNumber: 2, activityLogId: 'al_batch' },
    })

    await approvePendingActions(['pa_1', 'pa_2'])

    // Rename rides along in the in-place write (title is arg index 3).
    const title = mockUpdateDraftVersionInPlace.mock.calls[0]![3]
    expect(title).toBe('Nordviken policy')
  })

  it('APPROVED-no-draft consolidates via ONE createDraftFromApprovedWithEdit', async () => {
    ;(
      prisma.pendingAgentAction.findMany as ReturnType<typeof vi.fn>
    ).mockResolvedValue([
      editRow('pa_1', 'Syfte', 'A'),
      editRow('pa_2', 'Ansvar', 'B'),
    ])
    ;(
      prisma.workspaceDocument.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: 'd_1',
      status: 'APPROVED',
      workspace_id: 'ws_123',
      current_draft_version_id: null,
      current_approved_version_id: 'v_a',
      current_draft_version: null,
      current_approved_version: { content_json: DOC_CONTENT },
    })
    mockCreateDraftFromApprovedWithEdit.mockResolvedValue({
      success: true,
      data: { id: 'v_2', versionNumber: 2 },
    })

    const result = await approvePendingActions(['pa_1', 'pa_2'])

    expect(result.data?.approved).toBe(2)
    expect(mockCreateDraftFromApprovedWithEdit).toHaveBeenCalledTimes(1)
    expect(mockSaveDocumentVersion).not.toHaveBeenCalled()
  })

  it('blocks the whole batch (no approvals) when the user lacks tasks:edit', async () => {
    mockWithWorkspace.mockImplementationOnce(
      (cb: (_c: typeof ctx) => unknown) =>
        cb({ ...ctx, hasPermission: () => false })
    )

    const result = await approvePendingActions(['pa_1', 'pa_2'])

    expect(result.success).toBe(false)
    expect(mockSaveDocumentVersion).not.toHaveBeenCalled()
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

// Story 14.29: ADD_TASK_COMMENT dispatch — calls createComment, captures
// commentId in result_ref, keeps row PENDING on dispatch failure.
describe('approvePendingAction → ADD_TASK_COMMENT', () => {
  it('dispatches ADD_TASK_COMMENT via createComment(taskId, content, parentCommentId)', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({
        action_type: 'ADD_TASK_COMMENT',
        params: {
          taskId: 't_1',
          taskTitle: 'Brandskydd',
          content: 'Bedömning klar.',
          parentCommentId: 'pc_1',
          entity_version: '2026-01-01T00:00:00.000Z',
        },
      })
    )
    mockCreateComment.mockResolvedValue({
      success: true,
      data: { id: 'c_1' },
    })

    const result = await approvePendingAction('pa_1')

    expect(mockCreateComment).toHaveBeenCalledWith(
      't_1',
      'Bedömning klar.',
      'pc_1'
    )
    expect(result.data?.resultRef).toEqual({ commentId: 'c_1' })
  })

  it('ADD_TASK_COMMENT keeps the row PENDING on dispatch failure (AC 13)', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({
        action_type: 'ADD_TASK_COMMENT',
        params: { taskId: 't_1', content: 'En kommentar' },
      })
    )
    mockCreateComment.mockResolvedValue({
      success: false,
      error: 'Kunde inte',
    })

    const result = await approvePendingAction('pa_1')

    expect(result.success).toBe(false)
    // Row NOT marked APPROVED — update only fires after a successful dispatch.
    expect(prisma.pendingAgentAction.update).not.toHaveBeenCalled()
  })
})

// Story 14.30: TRANSITION_DOCUMENT_STATUS dispatch — two-layer separation-of-
// duties. The DISPATCH guard is the authoritative trusted gate (the tool's
// guard is a first line; AC 13 mandates the dispatch refuses APPROVED even
// if it somehow reaches params).
describe('approvePendingAction → TRANSITION_DOCUMENT_STATUS', () => {
  it('blocks newStatus=APPROVED at the dispatch (defence-in-depth), keeps row PENDING, never calls updateDocumentStatus', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({
        action_type: 'TRANSITION_DOCUMENT_STATUS',
        // Inject APPROVED as if the tool guard was bypassed — the dispatch
        // is the authoritative gate and MUST refuse it regardless.
        params: {
          documentId: 'd_1',
          newStatus: 'APPROVED',
          oldStatus: 'IN_REVIEW',
        },
      })
    )

    const result = await approvePendingAction('pa_1')

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/kan inte godkänna/i)
    // Critical: updateDocumentStatus must NOT be called.
    expect(mockUpdateDocumentStatus).not.toHaveBeenCalled()
    // Critical: the row must NOT be marked APPROVED.
    expect(prisma.pendingAgentAction.update).not.toHaveBeenCalled()
  })

  it('dispatches a valid transition via updateDocumentStatus and sets result_ref', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({
        action_type: 'TRANSITION_DOCUMENT_STATUS',
        params: {
          documentId: 'd_1',
          documentTitle: 'Brandskyddspolicy',
          oldStatus: 'DRAFT',
          newStatus: 'IN_REVIEW',
          comment: 'Redo för granskning.',
        },
      })
    )
    mockUpdateDocumentStatus.mockResolvedValue({
      success: true,
      data: { id: 'd_1', status: 'IN_REVIEW' },
    })

    const result = await approvePendingAction('pa_1')

    expect(mockUpdateDocumentStatus).toHaveBeenCalledWith({
      documentId: 'd_1',
      newStatus: 'IN_REVIEW',
      comment: 'Redo för granskning.',
    })
    expect(result.data?.resultRef).toEqual({
      documentId: 'd_1',
      status: 'IN_REVIEW',
    })
  })

  it('keeps row PENDING when updateDocumentStatus fails (e.g., drifted "Ogiltig statusövergång")', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({
        action_type: 'TRANSITION_DOCUMENT_STATUS',
        params: {
          documentId: 'd_1',
          oldStatus: 'DRAFT',
          newStatus: 'IN_REVIEW',
        },
      })
    )
    mockUpdateDocumentStatus.mockResolvedValue({
      success: false,
      error: 'Ogiltig statusövergång',
    })

    const result = await approvePendingAction('pa_1')

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/ogiltig statusövergång/i)
    // Row NOT marked APPROVED.
    expect(prisma.pendingAgentAction.update).not.toHaveBeenCalled()
  })
})

// Story 17.11: UPDATE_DOCUMENT dispatch — re-asserts the DRAFT/IN_REVIEW guard
// from the LIVE document (not the propose-time snapshot), applies
// updateSection() to produce the full updated contentJson, generates HTML, and
// calls saveDocumentVersion. The dispatch is the authoritative status gate.
describe('approvePendingAction → UPDATE_DOCUMENT', () => {
  const DRAFT_DOC_CONTENT = {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Syfte' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Old purpose body.' }],
      },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Ansvar' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Responsibility.' }],
      },
    ],
  }
  const NEW_BODY = [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'New purpose body.' }],
    },
  ]
  const baseParams = {
    documentId: 'd_1',
    sectionHeading: 'Syfte',
    oldSectionContentJson: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Old purpose body.' }],
      },
    ],
    newSectionContentJson: NEW_BODY,
    changeSummary: 'Skärpt syftesformulering',
    entity_version: '2026-06-01T10:00:00.000Z',
  }

  beforeEach(() =>
    (
      prisma.pendingAgentAction.update as ReturnType<typeof vi.fn>
    ).mockResolvedValue({})
  )

  it('happy path: re-reads doc, applies updateSection, updates the open draft IN PLACE with full doc + HTML', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({ action_type: 'UPDATE_DOCUMENT', params: baseParams })
    )
    ;(
      prisma.workspaceDocument.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: 'd_1',
      status: 'DRAFT',
      workspace_id: 'ws_123',
      current_draft_version_id: 'v_d',
      current_approved_version_id: null,
      current_draft_version: { content_json: DRAFT_DOC_CONTENT },
      current_approved_version: null,
    })
    // Story 17.22: draft exists → in-place update (no new version row).
    mockUpdateDraftVersionInPlace.mockResolvedValue({
      success: true,
      data: { id: 'v_2', versionNumber: 2, activityLogId: 'al_ip' },
    })
    ;(
      prisma.activityLog.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ id: 'al_ip', new_value: {} })
    ;(prisma.activityLog.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      {}
    )

    const result = await approvePendingAction('pa_1')

    expect(result.success).toBe(true)
    expect(result.data?.resultRef).toEqual({
      documentId: 'd_1',
      versionId: 'v_2',
      versionNumber: 2,
    })

    // updateDraftVersionInPlace was called with the FULL updated doc (Syfte body
    // replaced, Ansvar section preserved), and an HTML string. No version minted.
    expect(mockUpdateDraftVersionInPlace).toHaveBeenCalledTimes(1)
    expect(mockSaveDocumentVersion).not.toHaveBeenCalled()
    const [docId, fullContent, changeSummary, title, html] =
      mockUpdateDraftVersionInPlace.mock.calls[0]!
    expect(docId).toBe('d_1')
    expect(changeSummary).toBe('Skärpt syftesformulering')
    expect(title).toBeUndefined()
    expect(typeof html).toBe('string')
    expect(html).toContain('<h2>Syfte</h2>')
    expect(html).toContain('<p>New purpose body.</p>')
    expect(html).toContain('<h2>Ansvar</h2>')
    expect(fullContent).toEqual({
      type: 'doc',
      content: [
        DRAFT_DOC_CONTENT.content[0], // Syfte heading preserved
        NEW_BODY[0], // body replaced
        DRAFT_DOC_CONTENT.content[2], // Ansvar heading
        DRAFT_DOC_CONTENT.content[3], // Ansvar body
      ],
    })
  })

  it('Story 17.22: stamps agent authorship onto the in-place document_draft_edited audit row (by id, not version_number)', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({ action_type: 'UPDATE_DOCUMENT', params: baseParams })
    )
    ;(
      prisma.workspaceDocument.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: 'd_1',
      status: 'DRAFT',
      workspace_id: 'ws_123',
      current_draft_version_id: 'v_d',
      current_approved_version_id: null,
      current_draft_version: { content_json: DRAFT_DOC_CONTENT },
      current_approved_version: null,
    })
    // In-place update returns the audit-row id (no version bump → can't match
    // on version_number, so the dispatch stamps by id).
    mockUpdateDraftVersionInPlace.mockResolvedValue({
      success: true,
      data: { id: 'v_2', versionNumber: 2, activityLogId: 'al_ip' },
    })
    ;(
      prisma.activityLog.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      new_value: { change_summary: 'Skärpt syftesformulering' },
    })

    await approvePendingAction('pa_1')

    // Stamp finds the audit row by id (not a version_number query).
    expect(prisma.activityLog.findUnique).toHaveBeenCalledWith({
      where: { id: 'al_ip' },
      select: { new_value: true },
    })
    expect(prisma.activityLog.update).toHaveBeenCalledWith({
      where: { id: 'al_ip' },
      data: {
        new_value: expect.objectContaining({
          change_summary: 'Skärpt syftesformulering',
          by: 'agent',
          pendingActionId: 'pa_1',
          operation: 'in_place_update_section',
        }),
      },
    })
    // The old version_number-keyed query must NOT fire for in-place edits.
    expect(prisma.activityLog.findFirst).not.toHaveBeenCalled()
  })

  // Story 17.11c: APPROVED moved out of the refuse-at-dispatch set into the
  // auto-branch path (only when params.creates_draft=true). Pre-17.11c rows
  // without creates_draft against APPROVED-no-draft fall through to
  // saveDocumentVersion Path C, which refuses there. SUPERSEDED/ARCHIVED
  // stay refused at the dispatch writeable predicate.
  it.each(['SUPERSEDED', 'ARCHIVED'] as const)(
    'AC 11: re-asserts status guard at dispatch — refuses %s, row stays PENDING',
    async (status) => {
      ;(
        prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(
        row({ action_type: 'UPDATE_DOCUMENT', params: baseParams })
      )
      ;(
        prisma.workspaceDocument.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'd_1',
        status,
        workspace_id: 'ws_123',
        // Story 17.16: approved-pointer-only mock for the refused-status case.
        // Writeable predicate: current_draft_version_id=null AND status≠'DRAFT'
        // → not writeable → refusal fires per AC 10 (status-based refusal copy
        // preserved unchanged).
        current_draft_version_id: null,
        current_approved_version_id: 'v_a',
        current_draft_version: null,
        current_approved_version: { content_json: DRAFT_DOC_CONTENT },
      })

      const result = await approvePendingAction('pa_1')

      expect(result.success).toBe(false)
      expect(result.error).toContain(status)
      expect(mockSaveDocumentVersion).not.toHaveBeenCalled()
      expect(prisma.pendingAgentAction.update).not.toHaveBeenCalled()
    }
  )

  it('keeps the row PENDING when the document is missing', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({ action_type: 'UPDATE_DOCUMENT', params: baseParams })
    )
    ;(
      prisma.workspaceDocument.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null)

    const result = await approvePendingAction('pa_1')

    expect(result.success).toBe(false)
    expect(mockSaveDocumentVersion).not.toHaveBeenCalled()
    expect(prisma.pendingAgentAction.update).not.toHaveBeenCalled()
  })

  it('keeps the row PENDING when the heading drifted away since propose', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({
        action_type: 'UPDATE_DOCUMENT',
        params: { ...baseParams, sectionHeading: 'BorttagenRubrik' },
      })
    )
    ;(
      prisma.workspaceDocument.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: 'd_1',
      status: 'DRAFT',
      workspace_id: 'ws_123',
      current_draft_version_id: 'v_d',
      current_approved_version_id: null,
      current_draft_version: { content_json: DRAFT_DOC_CONTENT },
      current_approved_version: null,
    })

    const result = await approvePendingAction('pa_1')

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/BorttagenRubrik/)
    expect(mockSaveDocumentVersion).not.toHaveBeenCalled()
    expect(prisma.pendingAgentAction.update).not.toHaveBeenCalled()
  })

  it('keeps the row PENDING when the in-place draft update fails', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({ action_type: 'UPDATE_DOCUMENT', params: baseParams })
    )
    ;(
      prisma.workspaceDocument.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: 'd_1',
      status: 'DRAFT',
      workspace_id: 'ws_123',
      current_draft_version_id: 'v_d',
      current_approved_version_id: null,
      current_draft_version: { content_json: DRAFT_DOC_CONTENT },
      current_approved_version: null,
    })
    mockUpdateDraftVersionInPlace.mockResolvedValue({
      success: false,
      error: 'Database down',
    })

    const result = await approvePendingAction('pa_1')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Database down')
    expect(prisma.pendingAgentAction.update).not.toHaveBeenCalled()
  })

  it('inherits the tasks:edit gate (SEC-001) — AUDITOR cannot approve', async () => {
    mockWithWorkspace.mockImplementationOnce(
      (cb: (_c: typeof ctx) => unknown) =>
        cb({ ...ctx, hasPermission: () => false })
    )
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({ action_type: 'UPDATE_DOCUMENT', params: baseParams })
    )

    const result = await approvePendingAction('pa_1')

    expect(result.success).toBe(false)
    expect(mockSaveDocumentVersion).not.toHaveBeenCalled()
    expect(prisma.pendingAgentAction.update).not.toHaveBeenCalled()
  })
})

// Story 17.11b: ADD_DOCUMENT_SECTION dispatch — re-asserts the DRAFT/IN_REVIEW
// guard + no-duplicate-heading + position-target from the LIVE document (not
// the propose-time snapshot), applies addSection() to produce the full updated
// contentJson, generates HTML, calls saveDocumentVersion, and stamps the
// activity log with by/agent + operation:add_section.
describe('approvePendingAction → ADD_DOCUMENT_SECTION', () => {
  const DRAFT_DOC_CONTENT = {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Syfte' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Purpose body.' }],
      },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Ansvar' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Responsibility.' }],
      },
    ],
  }
  const NEW_BODY = [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Ny avsnittstext.' }],
    },
  ]
  const baseParams = {
    documentId: 'd_1',
    documentTitle: 'Arbetsmiljöpolicy',
    newSectionHeading: 'Inledning',
    newSectionLevel: 2 as const,
    newSectionContentJson: NEW_BODY,
    position: { at: 'end' as const },
    changeSummary: 'Lägg till inledning',
    entity_version: '2026-06-01T10:00:00.000Z',
  }

  beforeEach(() =>
    (
      prisma.pendingAgentAction.update as ReturnType<typeof vi.fn>
    ).mockResolvedValue({})
  )

  it('happy path: re-reads doc, applies addSection (end), updates the open draft IN PLACE with full doc + HTML', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({ action_type: 'ADD_DOCUMENT_SECTION', params: baseParams })
    )
    ;(
      prisma.workspaceDocument.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: 'd_1',
      status: 'DRAFT',
      workspace_id: 'ws_123',
      current_draft_version_id: 'v_d',
      current_approved_version_id: null,
      current_draft_version: { content_json: DRAFT_DOC_CONTENT },
      current_approved_version: null,
    })
    // Story 17.23: draft exists → in-place add (no new version row).
    mockUpdateDraftVersionInPlace.mockResolvedValue({
      success: true,
      data: { id: 'v_2', versionNumber: 2, activityLogId: 'al_ip' },
    })
    ;(
      prisma.activityLog.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ id: 'al_ip', new_value: {} })
    ;(prisma.activityLog.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      {}
    )

    const result = await approvePendingAction('pa_1')

    expect(result.success).toBe(true)
    expect(result.data?.resultRef).toEqual({
      documentId: 'd_1',
      versionId: 'v_2',
      versionNumber: 2,
    })

    expect(mockUpdateDraftVersionInPlace).toHaveBeenCalledTimes(1)
    expect(mockSaveDocumentVersion).not.toHaveBeenCalled()
    const [docId, fullContent, changeSummary, title, html] =
      mockUpdateDraftVersionInPlace.mock.calls[0]!
    expect(docId).toBe('d_1')
    expect(changeSummary).toBe('Lägg till inledning')
    expect(title).toBeUndefined()
    expect(typeof html).toBe('string')
    expect(html).toContain('<h2>Inledning</h2>')
    expect(html).toContain('<p>Ny avsnittstext.</p>')
    // Pre-existing sections preserved.
    expect(html).toContain('<h2>Syfte</h2>')
    expect(html).toContain('<h2>Ansvar</h2>')
    // The new section was APPENDED at the end (position.at = 'end').
    expect(fullContent).toEqual({
      type: 'doc',
      content: [
        ...DRAFT_DOC_CONTENT.content,
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Inledning' }],
        },
        NEW_BODY[0],
      ],
    })
  })

  it('Story 17.23: stamps agent authorship onto the in-place document_draft_edited audit row (operation: in_place_add_section)', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({ action_type: 'ADD_DOCUMENT_SECTION', params: baseParams })
    )
    ;(
      prisma.workspaceDocument.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: 'd_1',
      status: 'DRAFT',
      workspace_id: 'ws_123',
      current_draft_version_id: 'v_d',
      current_approved_version_id: null,
      current_draft_version: { content_json: DRAFT_DOC_CONTENT },
      current_approved_version: null,
    })
    mockUpdateDraftVersionInPlace.mockResolvedValue({
      success: true,
      data: { id: 'v_2', versionNumber: 2, activityLogId: 'al_ip' },
    })
    ;(
      prisma.activityLog.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      new_value: { change_summary: 'Lägg till inledning' },
    })

    await approvePendingAction('pa_1')

    expect(prisma.activityLog.findUnique).toHaveBeenCalledWith({
      where: { id: 'al_ip' },
      select: { new_value: true },
    })
    expect(prisma.activityLog.update).toHaveBeenCalledWith({
      where: { id: 'al_ip' },
      data: {
        new_value: expect.objectContaining({
          change_summary: 'Lägg till inledning',
          by: 'agent',
          pendingActionId: 'pa_1',
          operation: 'in_place_add_section',
        }),
      },
    })
    // The old version_number-keyed query must NOT fire for in-place adds.
    expect(prisma.activityLog.findFirst).not.toHaveBeenCalled()
  })

  it('inserts at position { at: "after", heading } when target exists', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({
        action_type: 'ADD_DOCUMENT_SECTION',
        params: {
          ...baseParams,
          position: { at: 'after', heading: 'Syfte' },
        },
      })
    )
    ;(
      prisma.workspaceDocument.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: 'd_1',
      status: 'DRAFT',
      workspace_id: 'ws_123',
      current_draft_version_id: 'v_d',
      current_approved_version_id: null,
      current_draft_version: { content_json: DRAFT_DOC_CONTENT },
      current_approved_version: null,
    })
    mockUpdateDraftVersionInPlace.mockResolvedValue({
      success: true,
      data: { id: 'v_2', versionNumber: 2, activityLogId: 'al_ip' },
    })
    ;(
      prisma.activityLog.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null)

    const result = await approvePendingAction('pa_1')

    expect(result.success).toBe(true)
    const [, fullContent] = mockUpdateDraftVersionInPlace.mock.calls[0]!
    // Inserted between the Syfte section and the Ansvar section.
    expect(fullContent).toEqual({
      type: 'doc',
      content: [
        DRAFT_DOC_CONTENT.content[0], // Syfte heading
        DRAFT_DOC_CONTENT.content[1], // Syfte body
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Inledning' }],
        },
        NEW_BODY[0],
        DRAFT_DOC_CONTENT.content[2], // Ansvar heading
        DRAFT_DOC_CONTENT.content[3], // Ansvar body
      ],
    })
  })

  // Story 17.11c: APPROVED is now writeable at dispatch only via the auto-
  // branch path (creates_draft=true). Pre-17.11c rows with no creates_draft
  // flag still refuse via saveDocumentVersion Path C (covered separately).
  // This parameterized guard keeps SUPERSEDED + ARCHIVED — the still-non-
  // writeable states post-17.11c.
  it.each(['SUPERSEDED', 'ARCHIVED'] as const)(
    'AC 11: re-asserts status guard — refuses %s, row stays PENDING',
    async (status) => {
      ;(
        prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue(
        row({ action_type: 'ADD_DOCUMENT_SECTION', params: baseParams })
      )
      ;(
        prisma.workspaceDocument.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: 'd_1',
        status,
        workspace_id: 'ws_123',
        // Story 17.16: approved-pointer-only mock for the refused-status case
        // (mirrors the UPDATE_DOCUMENT parameterized test above).
        current_draft_version_id: null,
        current_approved_version_id: 'v_a',
        current_draft_version: null,
        current_approved_version: { content_json: DRAFT_DOC_CONTENT },
      })

      const result = await approvePendingAction('pa_1')

      expect(result.success).toBe(false)
      expect(result.error).toContain(status)
      expect(mockSaveDocumentVersion).not.toHaveBeenCalled()
      expect(prisma.pendingAgentAction.update).not.toHaveBeenCalled()
    }
  )

  it('keeps the row PENDING when the document is missing', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({ action_type: 'ADD_DOCUMENT_SECTION', params: baseParams })
    )
    ;(
      prisma.workspaceDocument.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null)

    const result = await approvePendingAction('pa_1')

    expect(result.success).toBe(false)
    expect(mockSaveDocumentVersion).not.toHaveBeenCalled()
    expect(prisma.pendingAgentAction.update).not.toHaveBeenCalled()
  })

  it('keeps the row PENDING when the heading was added manually since propose', async () => {
    // Doc now CONTAINS an "Inledning" heading — addSection() throws
    // SectionAlreadyExistsError and dispatch translates to a Swedish error.
    const docWithDup = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Inledning' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Manuell.' }],
        },
        ...DRAFT_DOC_CONTENT.content,
      ],
    }
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({ action_type: 'ADD_DOCUMENT_SECTION', params: baseParams })
    )
    ;(
      prisma.workspaceDocument.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: 'd_1',
      status: 'DRAFT',
      workspace_id: 'ws_123',
      current_draft_version_id: 'v_d',
      current_approved_version_id: null,
      current_draft_version: { content_json: docWithDup },
      current_approved_version: null,
    })

    const result = await approvePendingAction('pa_1')

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Inledning/)
    expect(result.error).toMatch(/finns redan/)
    expect(mockSaveDocumentVersion).not.toHaveBeenCalled()
    expect(prisma.pendingAgentAction.update).not.toHaveBeenCalled()
  })

  it('keeps the row PENDING when position.heading was removed since propose', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({
        action_type: 'ADD_DOCUMENT_SECTION',
        params: {
          ...baseParams,
          position: { at: 'after', heading: 'BorttagenRubrik' },
        },
      })
    )
    ;(
      prisma.workspaceDocument.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: 'd_1',
      status: 'DRAFT',
      workspace_id: 'ws_123',
      current_draft_version_id: 'v_d',
      current_approved_version_id: null,
      current_draft_version: { content_json: DRAFT_DOC_CONTENT },
      current_approved_version: null,
    })

    const result = await approvePendingAction('pa_1')

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/BorttagenRubrik/)
    expect(mockSaveDocumentVersion).not.toHaveBeenCalled()
    expect(prisma.pendingAgentAction.update).not.toHaveBeenCalled()
  })

  it('keeps the row PENDING when the in-place draft update fails', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({ action_type: 'ADD_DOCUMENT_SECTION', params: baseParams })
    )
    ;(
      prisma.workspaceDocument.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: 'd_1',
      status: 'DRAFT',
      workspace_id: 'ws_123',
      current_draft_version_id: 'v_d',
      current_approved_version_id: null,
      current_draft_version: { content_json: DRAFT_DOC_CONTENT },
      current_approved_version: null,
    })
    mockUpdateDraftVersionInPlace.mockResolvedValue({
      success: false,
      error: 'Database down',
    })

    const result = await approvePendingAction('pa_1')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Database down')
    expect(prisma.pendingAgentAction.update).not.toHaveBeenCalled()
  })

  it('inherits the tasks:edit gate (SEC-001) — AUDITOR cannot approve', async () => {
    mockWithWorkspace.mockImplementationOnce(
      (cb: (_c: typeof ctx) => unknown) =>
        cb({ ...ctx, hasPermission: () => false })
    )
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({ action_type: 'ADD_DOCUMENT_SECTION', params: baseParams })
    )

    const result = await approvePendingAction('pa_1')

    expect(result.success).toBe(false)
    expect(mockSaveDocumentVersion).not.toHaveBeenCalled()
    expect(prisma.pendingAgentAction.update).not.toHaveBeenCalled()
  })
})

// ============================================================================
// Story 17.11c: dispatch routing fork — UPDATE_DOCUMENT auto-branch path
// ============================================================================

describe('approvePendingAction → UPDATE_DOCUMENT (Story 17.11c auto-branch)', () => {
  const APPROVED_DOC_CONTENT = {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Syfte' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Old purpose body.' }],
      },
    ],
  }
  const NEW_BODY = [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'New purpose body.' }],
    },
  ]
  const branchParams = {
    documentId: 'd_1',
    sectionHeading: 'Syfte',
    oldSectionContentJson: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Old purpose body.' }],
      },
    ],
    newSectionContentJson: NEW_BODY,
    changeSummary: 'Skärpt syfte på godkänd policy',
    entity_version: '2026-06-04T10:00:00.000Z',
    creates_draft: true,
    newVersionNumber: 4,
  }

  beforeEach(() =>
    (
      prisma.pendingAgentAction.update as ReturnType<typeof vi.fn>
    ).mockResolvedValue({})
  )

  it('creates_draft=true + APPROVED-no-draft → routes to createDraftFromApprovedWithEdit (NOT saveDocumentVersion)', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({ action_type: 'UPDATE_DOCUMENT', params: branchParams })
    )
    ;(
      prisma.workspaceDocument.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: 'd_1',
      status: 'APPROVED',
      workspace_id: 'ws_123',
      current_draft_version_id: null,
      current_approved_version_id: 'v_approved',
      current_draft_version: null,
      current_approved_version: { content_json: APPROVED_DOC_CONTENT },
    })
    mockCreateDraftFromApprovedWithEdit.mockResolvedValue({
      success: true,
      data: { id: 'v_4', versionNumber: 4 },
    })
    ;(
      prisma.activityLog.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: 'al_save',
      new_value: { version_number: 4 },
    })
    ;(prisma.activityLog.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      {}
    )

    const result = await approvePendingAction('pa_1')

    expect(result.success).toBe(true)
    expect(mockCreateDraftFromApprovedWithEdit).toHaveBeenCalledTimes(1)
    expect(mockSaveDocumentVersion).not.toHaveBeenCalled()

    // resultRef carries the new draft version's id + number.
    expect(result.data?.resultRef).toEqual({
      documentId: 'd_1',
      versionId: 'v_4',
      versionNumber: 4,
    })
  })

  it('creates_draft=true + race (user manually branched): falls through to the in-place draft update', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({ action_type: 'UPDATE_DOCUMENT', params: branchParams })
    )
    // Re-read state: doc now has a draft pointer (user raced + manually branched).
    // autoBranchEligible is false → shouldAutoBranch is false → Story 17.22 the
    // non-branch arm is the IN-PLACE update (no new version), not a plain mint.
    ;(
      prisma.workspaceDocument.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: 'd_1',
      status: 'APPROVED',
      workspace_id: 'ws_123',
      current_draft_version_id: 'v_existing_draft',
      current_approved_version_id: 'v_approved',
      current_draft_version: { content_json: APPROVED_DOC_CONTENT },
      current_approved_version: { content_json: APPROVED_DOC_CONTENT },
    })
    mockUpdateDraftVersionInPlace.mockResolvedValue({
      success: true,
      data: {
        id: 'v_existing_draft',
        versionNumber: 5,
        activityLogId: 'al_ip',
      },
    })
    ;(
      prisma.activityLog.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ new_value: {} })
    ;(prisma.activityLog.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      {}
    )

    const result = await approvePendingAction('pa_1')

    expect(result.success).toBe(true)
    expect(mockCreateDraftFromApprovedWithEdit).not.toHaveBeenCalled()
    expect(mockSaveDocumentVersion).not.toHaveBeenCalled()
    expect(mockUpdateDraftVersionInPlace).toHaveBeenCalledTimes(1)
  })

  it('creates_draft=true + stale to SUPERSEDED: refuses with stale-status error, row stays PENDING', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({ action_type: 'UPDATE_DOCUMENT', params: branchParams })
    )
    ;(
      prisma.workspaceDocument.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: 'd_1',
      status: 'SUPERSEDED',
      workspace_id: 'ws_123',
      current_draft_version_id: null,
      current_approved_version_id: 'v_approved',
      current_draft_version: null,
      current_approved_version: { content_json: APPROVED_DOC_CONTENT },
    })

    const result = await approvePendingAction('pa_1')

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/SUPERSEDED/)
    expect(mockCreateDraftFromApprovedWithEdit).not.toHaveBeenCalled()
    expect(mockSaveDocumentVersion).not.toHaveBeenCalled()
    // Row stays PENDING (not flipped to APPROVED).
    expect(prisma.pendingAgentAction.update).not.toHaveBeenCalled()
  })

  it('auto-branch path: stamps BOTH document_draft_created AND document_version_saved log rows with operation discriminator (AC 8 + AC 14)', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({ action_type: 'UPDATE_DOCUMENT', params: branchParams })
    )
    ;(
      prisma.workspaceDocument.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: 'd_1',
      status: 'APPROVED',
      workspace_id: 'ws_123',
      current_draft_version_id: null,
      current_approved_version_id: 'v_approved',
      current_draft_version: null,
      current_approved_version: { content_json: APPROVED_DOC_CONTENT },
    })
    mockCreateDraftFromApprovedWithEdit.mockResolvedValue({
      success: true,
      data: { id: 'v_4', versionNumber: 4 },
    })

    // Two findFirst calls expected: document_version_saved (AC 8) +
    // document_draft_created (AC 14).
    const findFirstMock = prisma.activityLog.findFirst as ReturnType<
      typeof vi.fn
    >
    findFirstMock
      .mockResolvedValueOnce({
        id: 'al_save',
        new_value: { version_number: 4 },
      })
      .mockResolvedValueOnce({
        id: 'al_branch',
        new_value: { draft_version_id: 'v_4' },
      })
    ;(prisma.activityLog.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      {}
    )

    await approvePendingAction('pa_1')

    // Both stamp calls landed.
    expect(prisma.activityLog.update).toHaveBeenCalledTimes(2)

    const calls = (prisma.activityLog.update as ReturnType<typeof vi.fn>).mock
      .calls
    const versionStamp = calls.find((c) => c[0]!.where.id === 'al_save')!
    const branchStamp = calls.find((c) => c[0]!.where.id === 'al_branch')!

    expect(versionStamp[0]!.data.new_value).toMatchObject({
      by: 'agent',
      pendingActionId: 'pa_1',
      operation: 'auto_branch_then_update_section',
    })
    expect(branchStamp[0]!.data.new_value).toMatchObject({
      by: 'agent',
      pendingActionId: 'pa_1',
      operation: 'auto_branch_then_update_section',
    })
  })
})

// ============================================================================
// Story 17.11c: dispatch routing fork — ADD_DOCUMENT_SECTION auto-branch path
// ============================================================================

describe('approvePendingAction → ADD_DOCUMENT_SECTION (Story 17.11c auto-branch)', () => {
  const APPROVED_DOC_CONTENT = {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: 'Syfte' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Purpose body.' }],
      },
    ],
  }
  const NEW_BODY = [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Ny avsnittstext.' }],
    },
  ]
  const branchParams = {
    documentId: 'd_1',
    documentTitle: 'Arbetsmiljöpolicy',
    newSectionHeading: 'Inledning',
    newSectionLevel: 2,
    newSectionContentJson: NEW_BODY,
    position: { at: 'start' },
    changeSummary: 'Lägg till inledning på godkänd policy',
    entity_version: '2026-06-04T10:00:00.000Z',
    creates_draft: true,
    newVersionNumber: 4,
  }

  beforeEach(() =>
    (
      prisma.pendingAgentAction.update as ReturnType<typeof vi.fn>
    ).mockResolvedValue({})
  )

  it('creates_draft=true + APPROVED-no-draft → routes to createDraftFromApprovedWithEdit', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({ action_type: 'ADD_DOCUMENT_SECTION', params: branchParams })
    )
    ;(
      prisma.workspaceDocument.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: 'd_1',
      status: 'APPROVED',
      workspace_id: 'ws_123',
      current_draft_version_id: null,
      current_approved_version_id: 'v_approved',
      current_draft_version: null,
      current_approved_version: { content_json: APPROVED_DOC_CONTENT },
    })
    mockCreateDraftFromApprovedWithEdit.mockResolvedValue({
      success: true,
      data: { id: 'v_4', versionNumber: 4 },
    })
    ;(
      prisma.activityLog.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ id: 'al_save', new_value: { version_number: 4 } })
    ;(prisma.activityLog.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      {}
    )

    const result = await approvePendingAction('pa_1')

    expect(result.success).toBe(true)
    expect(mockCreateDraftFromApprovedWithEdit).toHaveBeenCalledTimes(1)
    expect(mockSaveDocumentVersion).not.toHaveBeenCalled()
  })

  it('auto-branch path: stamps both log rows with operation=auto_branch_then_add_section', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({ action_type: 'ADD_DOCUMENT_SECTION', params: branchParams })
    )
    ;(
      prisma.workspaceDocument.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: 'd_1',
      status: 'APPROVED',
      workspace_id: 'ws_123',
      current_draft_version_id: null,
      current_approved_version_id: 'v_approved',
      current_draft_version: null,
      current_approved_version: { content_json: APPROVED_DOC_CONTENT },
    })
    mockCreateDraftFromApprovedWithEdit.mockResolvedValue({
      success: true,
      data: { id: 'v_4', versionNumber: 4 },
    })

    const findFirstMock = prisma.activityLog.findFirst as ReturnType<
      typeof vi.fn
    >
    findFirstMock
      .mockResolvedValueOnce({
        id: 'al_save',
        new_value: { version_number: 4 },
      })
      .mockResolvedValueOnce({
        id: 'al_branch',
        new_value: { draft_version_id: 'v_4' },
      })
    ;(prisma.activityLog.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      {}
    )

    await approvePendingAction('pa_1')

    expect(prisma.activityLog.update).toHaveBeenCalledTimes(2)
    const calls = (prisma.activityLog.update as ReturnType<typeof vi.fn>).mock
      .calls
    const versionStamp = calls.find((c) => c[0]!.where.id === 'al_save')!
    const branchStamp = calls.find((c) => c[0]!.where.id === 'al_branch')!

    expect(versionStamp[0]!.data.new_value).toMatchObject({
      by: 'agent',
      pendingActionId: 'pa_1',
      operation: 'auto_branch_then_add_section',
    })
    expect(branchStamp[0]!.data.new_value).toMatchObject({
      by: 'agent',
      pendingActionId: 'pa_1',
      operation: 'auto_branch_then_add_section',
    })
  })

  it('creates_draft=true + race (user manually branched): falls through to the in-place draft update', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({ action_type: 'ADD_DOCUMENT_SECTION', params: branchParams })
    )
    ;(
      prisma.workspaceDocument.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: 'd_1',
      status: 'APPROVED',
      workspace_id: 'ws_123',
      current_draft_version_id: 'v_existing_draft',
      current_approved_version_id: 'v_approved',
      current_draft_version: { content_json: APPROVED_DOC_CONTENT },
      current_approved_version: { content_json: APPROVED_DOC_CONTENT },
    })
    mockUpdateDraftVersionInPlace.mockResolvedValue({
      success: true,
      data: {
        id: 'v_existing_draft',
        versionNumber: 5,
        activityLogId: 'al_ip',
      },
    })
    ;(
      prisma.activityLog.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ new_value: {} })
    ;(prisma.activityLog.update as ReturnType<typeof vi.fn>).mockResolvedValue(
      {}
    )

    const result = await approvePendingAction('pa_1')

    expect(result.success).toBe(true)
    expect(mockCreateDraftFromApprovedWithEdit).not.toHaveBeenCalled()
    expect(mockSaveDocumentVersion).not.toHaveBeenCalled()
    expect(mockUpdateDraftVersionInPlace).toHaveBeenCalledTimes(1)
  })

  it('creates_draft=true + stale to ARCHIVED: refuses, row stays PENDING', async () => {
    ;(
      prisma.pendingAgentAction.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(
      row({ action_type: 'ADD_DOCUMENT_SECTION', params: branchParams })
    )
    ;(
      prisma.workspaceDocument.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: 'd_1',
      status: 'ARCHIVED',
      workspace_id: 'ws_123',
      current_draft_version_id: null,
      current_approved_version_id: 'v_approved',
      current_draft_version: null,
      current_approved_version: { content_json: APPROVED_DOC_CONTENT },
    })

    const result = await approvePendingAction('pa_1')

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/ARCHIVED/)
    expect(mockCreateDraftFromApprovedWithEdit).not.toHaveBeenCalled()
    expect(prisma.pendingAgentAction.update).not.toHaveBeenCalled()
  })
})
