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
      compliance_actions: null,
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

  it('appends to existing compliance_actions text', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'lli-1',
      compliance_status: 'PAGAENDE',
      compliance_actions:
        '[2026-03-01T10:00:00.000Z] Ej påbörjad → Pågående: Första ändringen',
      business_context: null,
      document: { title: 'Arbetsmiljölagen', document_number: 'SFS 1977:1160' },
    } as never)

    mockUpdate.mockResolvedValue({} as never)

    await tool.execute(
      {
        lawListItemId: 'lli-1',
        newStatus: 'UPPFYLLD',
        reason: 'Klar nu',
        execute: true,
      },
      toolOpts
    )

    const updateCall = mockUpdate.mock.calls[0]![0] as {
      data: { compliance_actions: string }
    }
    const actions = updateCall.data.compliance_actions
    // Should contain both the old entry and the new one separated by newline
    expect(actions).toContain('Första ändringen')
    expect(actions).toContain('Klar nu')
    expect(actions).toContain('Delvis uppfylld → Uppfylld')
    expect(actions.indexOf('Första ändringen')).toBeLessThan(
      actions.indexOf('Klar nu')
    )
  })

  it('updates via Prisma on execute: true', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'lli-1',
      compliance_status: 'EJ_PABORJAD',
      compliance_actions: null,
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

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'lli-1' },
      data: {
        compliance_status: 'UPPFYLLD',
        compliance_actions: expect.stringContaining('Alla krav uppfyllda'),
        compliance_actions_updated_at: expect.any(Date),
      },
    })

    const data = (result as { data: { newStatus: string } }).data
    expect(data.newStatus).toBe('UPPFYLLD')
  })
})

describe('save_assessment tool (stub)', () => {
  const tool = createSaveAssessmentTool('workspace-1')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns stub _note regardless of execute flag (false)', async () => {
    const result = await tool.execute(
      {
        changeEventId: 'ce-1',
        lawListItemId: 'lli-1',
        impactLevel: 'HIGH',
        analysis: 'Analysis text',
        recommendations: 'Recommendations text',
        execute: false,
      },
      toolOpts
    )

    expect(result).toHaveProperty('confirmation_required', false)
    expect((result as { _note: string })._note).toContain('Story 14.10')
    expect((result as { _meta: { tool: string } })._meta.tool).toBe(
      'save_assessment'
    )
  })

  it('returns stub _note regardless of execute flag (true)', async () => {
    const result = await tool.execute(
      {
        changeEventId: 'ce-1',
        lawListItemId: 'lli-1',
        impactLevel: 'LOW',
        analysis: 'Low impact',
        recommendations: 'Monitor',
        execute: true,
      },
      toolOpts
    )

    expect(result).toHaveProperty('confirmation_required', false)
    expect((result as { _note: string })._note).toContain(
      'Bedömningen har inte sparats'
    )
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

  it('appends to existing business_context with separator', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'lli-1',
      business_context: 'Befintlig anteckning',
      document: { title: 'AML', document_number: 'SFS 1977:1160' },
    } as never)

    mockUpdate.mockResolvedValue({} as never)

    await tool.execute(
      { lawListItemId: 'lli-1', note: 'Ny anteckning', execute: true },
      toolOpts
    )

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'lli-1' },
      data: {
        business_context: 'Befintlig anteckning\n\n---\n\nNy anteckning',
      },
    })
  })

  it('sets business_context directly when previously empty', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'lli-1',
      business_context: null,
      document: { title: 'Test', document_number: 'SFS 2000:1' },
    } as never)

    mockUpdate.mockResolvedValue({} as never)

    await tool.execute(
      { lawListItemId: 'lli-1', note: 'Första anteckningen', execute: true },
      toolOpts
    )

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'lli-1' },
      data: { business_context: 'Första anteckningen' },
    })
  })
})
