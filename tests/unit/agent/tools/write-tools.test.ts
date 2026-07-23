import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies before imports
vi.mock('@/app/actions/tasks', () => ({
  createTask: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    lawListItem: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    workspaceMember: {
      findFirst: vi.fn(),
    },
    changeAssessment: {
      upsert: vi.fn(),
    },
    // Story 29.1: create_task findingId guards + pending-row persistence.
    complianceFinding: {
      findFirst: vi.fn(),
    },
    pendingAgentAction: {
      create: vi.fn(),
    },
  },
}))

import { createTask } from '@/app/actions/tasks'
import { prisma } from '@/lib/prisma'
import { createCreateTaskTool } from '@/lib/agent/tools/create-task'
import { createUpdateComplianceStatusTool } from '@/lib/agent/tools/update-compliance-status'
import { createSaveAssessmentTool } from '@/lib/agent/tools/save-assessment'
import { createAddContextNoteTool } from '@/lib/agent/tools/add-context-note'

const mockCreateTask = vi.mocked(createTask)
const mockFindFirst = vi.mocked(prisma.lawListItem.findFirst)
const mockUpdate = vi.mocked(prisma.lawListItem.update)

const toolOpts = {
  toolCallId: 'tc-1',
  messages: [],
  abortSignal: undefined as unknown as AbortSignal,
}

describe('create_task tool', () => {
  const tool = createCreateTaskTool('workspace-1')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns confirmation_required: true when execute is false', async () => {
    const result = await tool.execute(
      {
        title: 'Uppdatera kemikalieförteckning',
        priority: 'HIGH',
        execute: false,
      },
      toolOpts
    )

    expect(result).toHaveProperty('confirmation_required', true)
    expect(result).toHaveProperty('action', 'create_task')
    expect(result).toHaveProperty('_meta')
    expect((result as { _meta: { tool: string } })._meta.tool).toBe(
      'create_task'
    )
    expect(mockCreateTask).not.toHaveBeenCalled()
  })

  it('includes Swedish preview text with title and priority', async () => {
    const result = await tool.execute(
      { title: 'Granska rutiner', priority: 'HIGH', execute: false },
      toolOpts
    )

    const preview = (result as { preview: string }).preview
    expect(preview).toContain('Granska rutiner')
    expect(preview).toContain('Hög')
  })

  it('calls createTask on execute: true and returns task data', async () => {
    mockCreateTask.mockResolvedValue({
      success: true,
      data: { id: 'task-123', title: 'Granska rutiner' } as never,
    })

    const result = await tool.execute(
      { title: 'Granska rutiner', priority: 'MEDIUM', execute: true },
      toolOpts
    )

    expect(mockCreateTask).toHaveBeenCalledWith({
      title: 'Granska rutiner',
      priority: 'MEDIUM',
    })

    const data = (result as { data: { taskId: string; title: string } }).data
    expect(data.taskId).toBe('task-123')
    expect(data.title).toBe('Granska rutiner')
  })

  it('passes linkedListItemIds when relatedDocumentId is provided', async () => {
    mockCreateTask.mockResolvedValue({
      success: true,
      data: { id: 'task-456', title: 'Test' } as never,
    })

    await tool.execute(
      { title: 'Test', relatedDocumentId: 'lli-1', execute: true },
      toolOpts
    )

    expect(mockCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({ linkedListItemIds: ['lli-1'] })
    )
  })

  it('returns error when createTask throws an exception', async () => {
    mockCreateTask.mockRejectedValue(new Error('Connection timeout'))

    const result = await tool.execute(
      { title: 'Test', execute: true },
      toolOpts
    )

    expect(result).toHaveProperty('error', true)
    expect((result as { message: string }).message).toContain(
      'Connection timeout'
    )
    expect((result as { guidance: string }).guidance).toContain('tekniskt fel')
  })

  it('returns error when createTask fails', async () => {
    mockCreateTask.mockResolvedValue({
      success: false,
      error: 'Ingen kolumn hittades',
    })

    const result = await tool.execute(
      { title: 'Test', execute: true },
      toolOpts
    )

    expect(result).toHaveProperty('error', true)
    expect((result as { message: string }).message).toContain(
      'Ingen kolumn hittades'
    )
  })
})

// Story 29.1 (AC 15): create_task findingId delta — tool-time guards + params
// persistence + preview coupling text.
describe('create_task tool — findingId (Story 29.1)', () => {
  const mockFindingFindFirst = vi.mocked(prisma.complianceFinding.findFirst)
  const mockPendingCreate = vi.mocked(prisma.pendingAgentAction.create)
  const tool = createCreateTaskTool('workspace-1')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('schema accepts an optional findingId (proposal without one is unchanged)', async () => {
    const result = await tool.execute(
      { title: 'Vanlig uppgift', priority: 'MEDIUM', execute: false },
      toolOpts
    )
    expect(result).toHaveProperty('confirmation_required', true)
    expect(mockFindingFindFirst).not.toHaveBeenCalled()
    const preview = (result as { preview: string }).preview
    expect(preview).not.toContain('avvikelsen')
  })

  it('workspace-scoped guard query; miss → wrapToolError, NO pending row', async () => {
    mockFindingFindFirst.mockResolvedValue(null)

    const result = await tool.execute(
      { title: 'Åtgärd', findingId: 'f-missing', execute: false },
      toolOpts
    )

    expect(mockFindingFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'f-missing',
          cycle: { workspace_id: 'workspace-1' },
        },
      })
    )
    expect(result).toHaveProperty('error', true)
    expect(mockPendingCreate).not.toHaveBeenCalled()
  })

  it('closed finding → wrapToolError with the spawnTaskForFinding wording', async () => {
    mockFindingFindFirst.mockResolvedValue({
      id: 'f-1',
      closed_at: new Date(),
      corrective_action_task_id: null,
      cycle_id: 'c-1',
    } as never)

    const result = await tool.execute(
      { title: 'Åtgärd', findingId: 'f-1', execute: false },
      toolOpts
    )

    expect(result).toHaveProperty('error', true)
    expect((result as { message: string }).message).toBe(
      'Kan inte skapa åtgärdsuppgift för stängd finding'
    )
    expect(mockPendingCreate).not.toHaveBeenCalled()
  })

  it('existing corrective task → wrapToolError steering to get_task/assign_task', async () => {
    mockFindingFindFirst.mockResolvedValue({
      id: 'f-1',
      closed_at: null,
      corrective_action_task_id: 'task-existing',
      cycle_id: 'c-1',
    } as never)

    const result = await tool.execute(
      { title: 'Åtgärd', findingId: 'f-1', execute: false },
      toolOpts
    )

    expect(result).toHaveProperty('error', true)
    expect((result as { message: string }).message).toBe(
      'Åtgärdsuppgift finns redan'
    )
    const guidance = (result as { guidance: string }).guidance
    expect(guidance).toContain('get_task')
    expect(guidance).toContain('assign_task')
    expect(mockPendingCreate).not.toHaveBeenCalled()
  })

  it('findingId + execute:true → rejected (link only exists on the approval path)', async () => {
    // QA (29.1): the legacy direct-execute branch has no finding-link step —
    // letting it through would create the orphan task the story removes.
    const result = await tool.execute(
      { title: 'Åtgärd', findingId: 'f-1', execute: true },
      toolOpts
    )

    expect(result).toHaveProperty('error', true)
    expect((result as { message: string }).message).toBe(
      'findingId kräver godkännandeflödet'
    )
    expect(mockFindingFindFirst).not.toHaveBeenCalled()
    expect(mockPendingCreate).not.toHaveBeenCalled()
  })

  it('happy path: persists findingId in the pending-row params + coupling preview', async () => {
    mockFindingFindFirst.mockResolvedValue({
      id: 'f-1',
      closed_at: null,
      corrective_action_task_id: null,
      cycle_id: 'c-1',
    } as never)
    mockPendingCreate.mockResolvedValue({ id: 'pa-1' } as never)

    // Context with assistantMessageId → the pending row IS created.
    const toolWithCtx = createCreateTaskTool('workspace-1', {
      userId: 'user-1',
      assistantMessageId: 'cm-1',
    })
    const result = await toolWithCtx.execute(
      { title: 'Åtgärda avvikelsen', findingId: 'f-1', execute: false },
      toolOpts
    )

    expect(result).toHaveProperty('confirmation_required', true)
    const createArg = mockPendingCreate.mock.calls[0]![0] as {
      data: { params: Record<string, unknown> }
    }
    expect(createArg.data.params.findingId).toBe('f-1')
    const preview = (result as { preview: string }).preview
    expect(preview).toContain('kopplas som åtgärd till avvikelsen')
  })
})

describe('update_compliance_status tool', () => {
  const tool = createUpdateComplianceStatusTool('workspace-1')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error when lawListItemId not found', async () => {
    mockFindFirst.mockResolvedValue(null)

    const result = await tool.execute(
      {
        lawListItemId: 'nonexistent',
        newStatus: 'UPPFYLLD',
        reason: 'Test',
        execute: false,
      },
      toolOpts
    )

    expect(result).toHaveProperty('error', true)
    expect((result as { message: string }).message).toBe(
      'Laglistposten hittades inte.'
    )
  })

  it('returns confirmation with old → new status preview', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'lli-1',
      compliance_status: 'EJ_PABORJAD',
      compliance_narrative: null,
      business_context: null,
      document: { title: 'Arbetsmiljölagen', document_number: 'SFS 1977:1160' },
    } as never)

    const result = await tool.execute(
      {
        lawListItemId: 'lli-1',
        newStatus: 'PAGAENDE',
        reason: 'Arbete påbörjat',
        execute: false,
      },
      toolOpts
    )

    expect(result).toHaveProperty('confirmation_required', true)
    const preview = (result as { preview: string }).preview
    expect(preview).toContain('Arbetsmiljölagen')
    expect(preview).toContain('Ej påbörjad')
    expect(preview).toContain('Delvis uppfylld')
    expect(preview).toContain('Arbete påbörjat')
  })

  it('proposes instead of writing directly (Story 14.23 — execute:true branch removed)', async () => {
    // Story 14.23 migrated this tool to the inline pending-action pattern: the
    // tool always proposes, and the compliance_status write happens in the
    // approvePendingAction dispatch (covered in pending-agent-actions.test.ts).
    // Even with execute:true, the tool must NOT write directly.
    mockFindFirst.mockResolvedValue({
      id: 'lli-1',
      compliance_status: 'EJ_PABORJAD',
      compliance_narrative: null,
      business_context: null,
      document: { title: 'Arbetsmiljölagen', document_number: 'SFS 1977:1160' },
    } as never)

    mockUpdate.mockResolvedValue({} as never)

    const result = await tool.execute(
      {
        lawListItemId: 'lli-1',
        newStatus: 'UPPFYLLD',
        reason: 'Alla krav uppfyllda',
        execute: true,
      },
      toolOpts
    )

    expect(mockUpdate).not.toHaveBeenCalled()
    expect(result).toHaveProperty('confirmation_required', true)
  })
})

describe('save_assessment tool', () => {
  const tool = createSaveAssessmentTool('workspace-1', 'user-1')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns confirmation_required=true with preview when execute=false', async () => {
    const result = await tool.execute(
      {
        changeEventId: 'ce-1',
        lawListItemId: 'lli-1',
        impactLevel: 'HIGH',
        recommendedStatus: 'ACTION_REQUIRED',
        analysis: 'Analysis text',
        recommendations: 'Recommendations text',
        execute: false,
      },
      toolOpts
    )

    expect(result).toHaveProperty('confirmation_required', true)
    expect(result).toHaveProperty('preview')
    const preview = (
      result as {
        preview: { impactLevel: string; recommendedStatus: string }
      }
    ).preview
    expect(preview.impactLevel).toBe('HIGH')
    // The recommended status is carried through so the form can pre-fill it.
    expect(preview.recommendedStatus).toBe('ACTION_REQUIRED')
    expect((result as { _meta: { tool: string } })._meta.tool).toBe(
      'save_assessment'
    )
  })

  it('persists to DB with authenticated userId when execute=true', async () => {
    const mockUpsert = vi.mocked(prisma.changeAssessment.upsert)

    mockUpsert.mockResolvedValue({
      id: 'ca-1',
      status: 'REVIEWED',
      impact_level: 'LOW',
    } as never)
    mockUpdate.mockResolvedValue({} as never)

    const result = await tool.execute(
      {
        changeEventId: 'ce-1',
        lawListItemId: 'lli-1',
        impactLevel: 'LOW',
        recommendedStatus: 'NOT_APPLICABLE',
        analysis: 'Low impact',
        recommendations: 'Monitor',
        execute: true,
      },
      toolOpts
    )

    expect(result).toHaveProperty('confirmation_required', false)
    expect(result).toHaveProperty('saved', true)
    expect(result).toHaveProperty('assessmentId', 'ca-1')
    expect(mockUpsert).toHaveBeenCalled()

    // Verify the authenticated userId is used, not an arbitrary member
    const upsertCall = mockUpsert.mock.calls[0]![0] as {
      create: { assessed_by: string; status: string }
      update: { status: string }
    }
    expect(upsertCall.create.assessed_by).toBe('user-1')
    // Persists the recommended status, not a hardcoded 'REVIEWED'.
    expect(upsertCall.create.status).toBe('NOT_APPLICABLE')
    expect(upsertCall.update.status).toBe('NOT_APPLICABLE')
  })

  it('uses authenticated userId for acknowledgement timestamp', async () => {
    const mockUpsert = vi.mocked(prisma.changeAssessment.upsert)

    mockUpsert.mockResolvedValue({
      id: 'ca-1',
      status: 'REVIEWED',
      impact_level: 'LOW',
    } as never)
    mockUpdate.mockResolvedValue({} as never)

    await tool.execute(
      {
        changeEventId: 'ce-1',
        lawListItemId: 'lli-1',
        impactLevel: 'LOW',
        recommendedStatus: 'REVIEWED',
        analysis: 'Low impact',
        recommendations: 'Monitor',
        execute: true,
      },
      toolOpts
    )

    // Verify lawListItem acknowledgement is NOT updated
    // (last_change_acknowledged_at is an immutable onboarding floor —
    // individual assessments are tracked via ChangeAssessment records)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

describe('add_context_note tool', () => {
  const tool = createAddContextNoteTool('workspace-1')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error when lawListItemId not found', async () => {
    mockFindFirst.mockResolvedValue(null)

    const result = await tool.execute(
      { lawListItemId: 'nonexistent', note: 'Test note', execute: false },
      toolOpts
    )

    expect(result).toHaveProperty('error', true)
    expect((result as { message: string }).message).toBe(
      'Laglistposten hittades inte.'
    )
  })

  it('returns confirmation with preview text', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'lli-1',
      business_context: null,
      document: { title: 'GDPR', document_number: 'EU 2016/679' },
    } as never)

    const result = await tool.execute(
      {
        lawListItemId: 'lli-1',
        note: 'Ni behandlar personuppgifter i ert CRM-system',
        execute: false,
      },
      toolOpts
    )

    expect(result).toHaveProperty('confirmation_required', true)
    const preview = (result as { preview: string }).preview
    expect(preview).toContain('GDPR')
    expect(preview).toContain('Ni behandlar personuppgifter i ert CRM-system')
  })

  it('proposes instead of writing directly (Story 14.23 — execute:true branch removed)', async () => {
    // The business_context append now happens in the approvePendingAction
    // dispatch (covered in pending-agent-actions.test.ts). The tool always
    // proposes and must not touch lawListItem.update.
    mockFindFirst.mockResolvedValue({
      id: 'lli-1',
      business_context: 'Befintlig anteckning',
      document: { title: 'AML', document_number: 'SFS 1977:1160' },
    } as never)

    mockUpdate.mockResolvedValue({} as never)

    const result = await tool.execute(
      { lawListItemId: 'lli-1', note: 'Ny anteckning', execute: true },
      toolOpts
    )

    expect(mockUpdate).not.toHaveBeenCalled()
    expect(result).toHaveProperty('confirmation_required', true)
  })
})
