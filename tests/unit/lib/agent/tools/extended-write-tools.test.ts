/**
 * Story 14.23, Task 9.1: unit tests for the extended write tools.
 * Covers entity validation + pending-row creation (execute=false is implicit —
 * these tools always propose) for the four new types and the two migrated tools.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    task: { findFirst: vi.fn() },
    workspaceDocument: { findFirst: vi.fn() },
    lawListItem: { findFirst: vi.fn() },
    lawListItemRequirement: { findFirst: vi.fn() },
    workspaceMember: { findFirst: vi.fn() },
    pendingAgentAction: { create: vi.fn() },
  },
}))

import { createLinkTaskToDocumentTool } from '@/lib/agent/tools/link-task-to-document'
import { createLinkDocumentToTaskTool } from '@/lib/agent/tools/link-document-to-task'
import { createAddObligationTool } from '@/lib/agent/tools/add-obligation'
import { createUpdateRequirementTool } from '@/lib/agent/tools/update-requirement'
import { createAssignTaskTool } from '@/lib/agent/tools/assign-task'
import { createAddContextNoteTool } from '@/lib/agent/tools/add-context-note'
import { createUpdateComplianceStatusTool } from '@/lib/agent/tools/update-compliance-status'
// Story 14.29: add_task_comment tool.
import { createAddTaskCommentTool } from '@/lib/agent/tools/add-task-comment'
// Story 14.30: transition_document_status tool.
import { createTransitionDocumentStatusTool } from '@/lib/agent/tools/transition-document-status'
import { prisma } from '@/lib/prisma'

type ExecFn = (
  _input: Record<string, unknown>
) => Promise<Record<string, unknown>>
function execOf(tool: unknown): ExecFn {
  return (tool as { execute: ExecFn }).execute
}

const fn = (m: unknown) => m as ReturnType<typeof vi.fn>
const CTX = {
  userId: 'u_1',
  assistantMessageId: 'cm_1',
  contextType: 'GLOBAL' as const,
}

beforeEach(() => {
  vi.clearAllMocks()
  fn(prisma.pendingAgentAction.create).mockResolvedValue({ id: 'pa_x' })
})

describe('link_task_to_document', () => {
  it('validates both entities, creates a LINK_TASK_TO_DOCUMENT row', async () => {
    fn(prisma.task.findFirst).mockResolvedValue({
      id: 't_1',
      title: 'Brandskydd',
    })
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue({
      id: 'd_1',
      title: 'Policy',
    })

    const result = await execOf(createLinkTaskToDocumentTool('ws_1', CTX))({
      taskId: 't_1',
      documentId: 'd_1',
    })

    expect(fn(prisma.pendingAgentAction.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action_type: 'LINK_TASK_TO_DOCUMENT',
          status: 'PENDING',
        }),
      })
    )
    expect(result.confirmation_required).toBe(true)
    expect(result.data).toEqual({ pendingActionId: 'pa_x' })
  })

  it('errors when the task is not found', async () => {
    fn(prisma.task.findFirst).mockResolvedValue(null)
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue({
      id: 'd_1',
      title: 'P',
    })

    const result = await execOf(createLinkTaskToDocumentTool('ws_1', CTX))({
      taskId: 'missing',
      documentId: 'd_1',
    })

    expect(result.error).toBe(true)
    expect(fn(prisma.pendingAgentAction.create)).not.toHaveBeenCalled()
  })
})

describe('link_document_to_task', () => {
  it('creates a LINK_DOCUMENT_TO_TASK row (distinct type, swapped framing)', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue({
      id: 'd_1',
      title: 'P',
    })
    fn(prisma.task.findFirst).mockResolvedValue({ id: 't_1', title: 'T' })

    const result = await execOf(createLinkDocumentToTaskTool('ws_1', CTX))({
      documentId: 'd_1',
      taskId: 't_1',
    })

    expect(fn(prisma.pendingAgentAction.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action_type: 'LINK_DOCUMENT_TO_TASK' }),
      })
    )
    expect(result.data).toEqual({ pendingActionId: 'pa_x' })
  })
})

describe('add_obligation', () => {
  it('creates an ADD_OBLIGATION row carrying bevisRequired', async () => {
    fn(prisma.lawListItem.findFirst).mockResolvedValue({
      id: 'li_1',
      document: { title: 'AFS 2011:19' },
    })

    const result = await execOf(createAddObligationTool('ws_1', CTX))({
      lawListItemId: 'li_1',
      text: 'Dokumentera riskbedömning',
      bevisRequired: true,
    })

    const call = fn(prisma.pendingAgentAction.create).mock.calls[0][0]
    expect(call.data.action_type).toBe('ADD_OBLIGATION')
    expect(call.data.params).toMatchObject({
      lawListItemId: 'li_1',
      text: 'Dokumentera riskbedömning',
      bevisRequired: true,
    })
    expect(result.data).toEqual({ pendingActionId: 'pa_x' })
  })

  it('errors when the law list item is not found', async () => {
    fn(prisma.lawListItem.findFirst).mockResolvedValue(null)
    const result = await execOf(createAddObligationTool('ws_1', CTX))({
      lawListItemId: 'missing',
      text: 'x',
      bevisRequired: false,
    })
    expect(result.error).toBe(true)
  })
})

describe('update_requirement', () => {
  const existing = {
    text: 'Gammal text',
    is_fulfilled: false,
    bevis_required: false,
    comment: null,
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
    list_item_id: 'li_1',
  }

  it('creates an UPDATE_REQUIREMENT row with the changed-field patch + oldSnapshot + entity_version', async () => {
    fn(prisma.lawListItemRequirement.findFirst).mockResolvedValue(existing)

    const result = await execOf(createUpdateRequirementTool('ws_1', CTX))({
      requirementId: 'req_1',
      isFulfilled: true,
      comment: 'Klart 12 mars',
    })

    const call = fn(prisma.pendingAgentAction.create).mock.calls[0][0]
    expect(call.data.action_type).toBe('UPDATE_REQUIREMENT')
    expect(call.data.params).toMatchObject({
      requirementId: 'req_1',
      lawListItemId: 'li_1',
      patch: { isFulfilled: true, comment: 'Klart 12 mars' },
      oldSnapshot: {
        text: 'Gammal text',
        isFulfilled: false,
        comment: null,
        bevisRequired: false,
      },
      entity_version: '2026-01-01T00:00:00.000Z',
    })
    // Unchanged fields are NOT in the patch (AC 3).
    expect(call.data.params.patch).not.toHaveProperty('text')
    expect(call.data.params.patch).not.toHaveProperty('bevisRequired')
    expect(result.data).toEqual({ pendingActionId: 'pa_x' })
  })

  it('rejects a no-op (same boolean + whitespace-only text diff)', async () => {
    fn(prisma.lawListItemRequirement.findFirst).mockResolvedValue(existing)
    const result = await execOf(createUpdateRequirementTool('ws_1', CTX))({
      requirementId: 'req_1',
      isFulfilled: false, // same as current
      text: '  Gammal text  ', // differs only by whitespace → suppressed
    })
    expect(result.error).toBe(true)
    expect(fn(prisma.pendingAgentAction.create)).not.toHaveBeenCalled()
  })

  it('rejects execute: true (inline approval only)', async () => {
    const result = await execOf(createUpdateRequirementTool('ws_1', CTX))({
      requirementId: 'req_1',
      isFulfilled: true,
      execute: true,
    })
    expect(result.error).toBe(true)
    expect(fn(prisma.lawListItemRequirement.findFirst)).not.toHaveBeenCalled()
  })

  it('errors when no mutable field is supplied', async () => {
    const result = await execOf(createUpdateRequirementTool('ws_1', CTX))({
      requirementId: 'req_1',
    })
    expect(result.error).toBe(true)
    expect(fn(prisma.lawListItemRequirement.findFirst)).not.toHaveBeenCalled()
  })

  it('errors when the requirement is not found (workspace-scoped)', async () => {
    fn(prisma.lawListItemRequirement.findFirst).mockResolvedValue(null)
    const result = await execOf(createUpdateRequirementTool('ws_1', CTX))({
      requirementId: 'missing',
      isFulfilled: true,
    })
    expect(result.error).toBe(true)
    expect(fn(prisma.pendingAgentAction.create)).not.toHaveBeenCalled()
  })
})

describe('assign_task', () => {
  it('validates membership and snapshots the member name', async () => {
    fn(prisma.task.findFirst).mockResolvedValue({ id: 't_1', title: 'T' })
    fn(prisma.workspaceMember.findFirst).mockResolvedValue({
      user: { name: 'Anna', email: 'anna@x.se' },
    })

    const result = await execOf(createAssignTaskTool('ws_1', CTX))({
      taskId: 't_1',
      userId: 'u_2',
    })

    const call = fn(prisma.pendingAgentAction.create).mock.calls[0][0]
    expect(call.data.action_type).toBe('ASSIGN_TASK')
    expect(call.data.params).toMatchObject({ userId: 'u_2', userName: 'Anna' })
    expect(result.data).toEqual({ pendingActionId: 'pa_x' })
  })

  it('errors when the assignee is not a workspace member', async () => {
    fn(prisma.task.findFirst).mockResolvedValue({ id: 't_1', title: 'T' })
    fn(prisma.workspaceMember.findFirst).mockResolvedValue(null)
    const result = await execOf(createAssignTaskTool('ws_1', CTX))({
      taskId: 't_1',
      userId: 'stranger',
    })
    expect(result.error).toBe(true)
    expect(fn(prisma.pendingAgentAction.create)).not.toHaveBeenCalled()
  })
})

describe('migrated tools propose instead of writing directly', () => {
  it('add_context_note creates an ADD_CONTEXT_NOTE row', async () => {
    fn(prisma.lawListItem.findFirst).mockResolvedValue({
      id: 'li_1',
      business_context: null,
      document: { title: 'AFS' },
    })
    const result = await execOf(createAddContextNoteTool('ws_1', CTX))({
      lawListItemId: 'li_1',
      note: 'Relevant pga kemikalier',
    })
    expect(fn(prisma.pendingAgentAction.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action_type: 'ADD_CONTEXT_NOTE' }),
      })
    )
    expect(result.data).toEqual({ pendingActionId: 'pa_x' })
  })

  it('update_compliance_status creates an UPDATE_COMPLIANCE_STATUS row with old+new snapshot', async () => {
    fn(prisma.lawListItem.findFirst).mockResolvedValue({
      id: 'li_1',
      compliance_status: 'EJ_PABORJAD',
      document: { title: 'AFS' },
    })
    const result = await execOf(createUpdateComplianceStatusTool('ws_1', CTX))({
      lawListItemId: 'li_1',
      newStatus: 'UPPFYLLD',
      reason: 'Allt klart',
    })
    const call = fn(prisma.pendingAgentAction.create).mock.calls[0][0]
    expect(call.data.action_type).toBe('UPDATE_COMPLIANCE_STATUS')
    expect(call.data.params).toMatchObject({
      newStatus: 'UPPFYLLD',
      oldStatus: 'EJ_PABORJAD',
    })
    expect(result.data).toEqual({ pendingActionId: 'pa_x' })
  })
})

// Story 14.29: add_task_comment — proposal-only (mirrors the 14.23 / 14.28 pattern).
describe('add_task_comment', () => {
  const TASK_ROW = {
    id: 't_1',
    title: 'Brandskydd',
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
  }

  it('creates an ADD_TASK_COMMENT row with denormalised task title + entity_version', async () => {
    fn(prisma.task.findFirst).mockResolvedValue(TASK_ROW)
    const result = await execOf(createAddTaskCommentTool('ws_1', CTX))({
      taskId: 't_1',
      content: 'Bedömning: ingen påverkan, vi följer redan kraven.',
    })
    expect(fn(prisma.pendingAgentAction.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action_type: 'ADD_TASK_COMMENT',
          status: 'PENDING',
          params: expect.objectContaining({
            taskId: 't_1',
            taskTitle: 'Brandskydd',
            content: 'Bedömning: ingen påverkan, vi följer redan kraven.',
            entity_version: '2026-01-01T00:00:00.000Z',
          }),
        }),
      })
    )
    expect(result.confirmation_required).toBe(true)
    expect(result.data).toEqual({ pendingActionId: 'pa_x' })
  })

  it('rejects execute=true with a Swedish ToolError, no row created (AC 6)', async () => {
    const result = await execOf(createAddTaskCommentTool('ws_1', CTX))({
      taskId: 't_1',
      content: 'Något',
      execute: true,
    })
    expect(result.error).toBe(true)
    expect(result.message).toMatch(/inte köras direkt/i)
    expect(fn(prisma.pendingAgentAction.create)).not.toHaveBeenCalled()
  })

  it('rejects empty / whitespace-only content with a Swedish ToolError (AC 3)', async () => {
    const result = await execOf(createAddTaskCommentTool('ws_1', CTX))({
      taskId: 't_1',
      content: '   ',
    })
    expect(result.error).toBe(true)
    expect(result.message).toMatch(/får inte vara tom/i)
    expect(fn(prisma.pendingAgentAction.create)).not.toHaveBeenCalled()
  })

  it('errors with a Swedish message when the task is not in the workspace (AC 4)', async () => {
    fn(prisma.task.findFirst).mockResolvedValue(null)
    const result = await execOf(createAddTaskCommentTool('ws_1', CTX))({
      taskId: 'missing',
      content: 'En riktig kommentar',
    })
    expect(result.error).toBe(true)
    expect(result.message).toMatch(/hittades inte/i)
    expect(fn(prisma.pendingAgentAction.create)).not.toHaveBeenCalled()
  })
})

// Story 14.30: transition_document_status — proposal-only with two-layer
// separation-of-duties (the dispatch enforces it too — see pending-agent-actions
// dispatch tests). Schema enum excludes APPROVED; runtime check is the
// belt-and-suspenders for direct-execute bypass paths.
describe('transition_document_status', () => {
  const DOC_ROW = {
    id: 'd_1',
    title: 'Brandskyddspolicy',
    status: 'DRAFT' as const,
    updated_at: new Date('2026-01-01T00:00:00.000Z'),
  }

  it('creates a TRANSITION_DOCUMENT_STATUS row with denormalised title + old/new status + entity_version', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(DOC_ROW)
    const result = await execOf(
      createTransitionDocumentStatusTool('ws_1', CTX)
    )({
      documentId: 'd_1',
      newStatus: 'IN_REVIEW',
      comment: 'Klart för granskning.',
    })
    expect(fn(prisma.pendingAgentAction.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action_type: 'TRANSITION_DOCUMENT_STATUS',
          status: 'PENDING',
          params: expect.objectContaining({
            documentId: 'd_1',
            documentTitle: 'Brandskyddspolicy',
            oldStatus: 'DRAFT',
            newStatus: 'IN_REVIEW',
            oldStatusLabel: 'Utkast',
            newStatusLabel: 'Under granskning',
            comment: 'Klart för granskning.',
            entity_version: '2026-01-01T00:00:00.000Z',
          }),
        }),
      })
    )
    expect(result.confirmation_required).toBe(true)
    expect(result.data).toEqual({ pendingActionId: 'pa_x' })
  })

  it('rejects newStatus = APPROVED with a Swedish ToolError, no row (AC 4 — load-bearing separation-of-duties)', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue({
      ...DOC_ROW,
      status: 'IN_REVIEW' as const,
    })
    const result = await execOf(
      createTransitionDocumentStatusTool('ws_1', CTX)
    )({
      documentId: 'd_1',
      // Cast bypasses the Zod enum (which already excludes APPROVED) and
      // exercises the runtime guard — the load-bearing defence for any
      // direct-execute path.
      newStatus: 'APPROVED' as never,
    })
    expect(result.error).toBe(true)
    expect(result.message).toMatch(/kan inte godkänna/i)
    expect(fn(prisma.pendingAgentAction.create)).not.toHaveBeenCalled()
  })

  it('rejects an invalid ladder move (DRAFT → SUPERSEDED) with a Swedish ToolError (AC 5)', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(DOC_ROW)
    const result = await execOf(
      createTransitionDocumentStatusTool('ws_1', CTX)
    )({
      documentId: 'd_1',
      newStatus: 'SUPERSEDED', // not in VALID_STATUS_TRANSITIONS.DRAFT
    })
    expect(result.error).toBe(true)
    expect(result.message).toMatch(/ogiltig statusövergång/i)
    expect(fn(prisma.pendingAgentAction.create)).not.toHaveBeenCalled()
  })

  it('rejects execute=true with a Swedish ToolError, no row (AC 8)', async () => {
    const result = await execOf(
      createTransitionDocumentStatusTool('ws_1', CTX)
    )({
      documentId: 'd_1',
      newStatus: 'IN_REVIEW',
      execute: true,
    })
    expect(result.error).toBe(true)
    expect(result.message).toMatch(/inte köras direkt/i)
    expect(fn(prisma.pendingAgentAction.create)).not.toHaveBeenCalled()
  })

  it('errors when the document is not in the workspace', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(null)
    const result = await execOf(
      createTransitionDocumentStatusTool('ws_1', CTX)
    )({
      documentId: 'missing',
      newStatus: 'IN_REVIEW',
    })
    expect(result.error).toBe(true)
    expect(result.message).toMatch(/hittades inte/i)
    expect(fn(prisma.pendingAgentAction.create)).not.toHaveBeenCalled()
  })
})
