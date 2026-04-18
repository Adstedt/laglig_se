import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockTaskFindMany = vi.fn()
const mockListItemFindMany = vi.fn()
const mockWorkspaceDocumentFindMany = vi.fn()
const mockRequirementFindMany = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    task: {
      findMany: (...args: unknown[]) => mockTaskFindMany(...args),
    },
    lawListItem: {
      findMany: (...args: unknown[]) => mockListItemFindMany(...args),
    },
    workspaceDocument: {
      findMany: (...args: unknown[]) => mockWorkspaceDocumentFindMany(...args),
    },
    lawListItemRequirement: {
      findMany: (...args: unknown[]) => mockRequirementFindMany(...args),
    },
  },
}))

describe('resolveEntityNames', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTaskFindMany.mockResolvedValue([])
    mockListItemFindMany.mockResolvedValue([])
    mockWorkspaceDocumentFindMany.mockResolvedValue([])
    mockRequirementFindMany.mockResolvedValue([])
  })

  it('resolves primary task entity with deep link', async () => {
    mockTaskFindMany.mockResolvedValue([
      { id: 'task-1', title: 'Do the thing' },
    ])
    const { resolveEntityNames } = await import(
      '@/lib/activity/entity-resolver'
    )
    const result = await resolveEntityNames(
      [
        {
          id: 'row-1',
          action: 'created',
          entity_type: 'task',
          entity_id: 'task-1',
          old_value: null,
          new_value: { title: 'Do the thing' },
        },
      ],
      'ws-1'
    )
    const ref = result.get('row-1')?.primary
    expect(ref?.label).toBe('Do the thing')
    expect(ref?.href).toBe('/tasks?task=task-1')
    expect(ref?.deleted).toBe(false)
  })

  it('returns a tombstone when primary entity is missing', async () => {
    mockTaskFindMany.mockResolvedValue([]) // nothing found
    const { resolveEntityNames } = await import(
      '@/lib/activity/entity-resolver'
    )
    const result = await resolveEntityNames(
      [
        {
          id: 'row-1',
          action: 'deleted',
          entity_type: 'task',
          entity_id: 'task-gone',
          old_value: { title: 'Removed Task' },
          new_value: null,
        },
      ],
      'ws-1'
    )
    const ref = result.get('row-1')?.primary
    expect(ref?.deleted).toBe(true)
    expect(ref?.label).toContain('Removed Task')
    expect(ref?.href).toBeNull()
  })

  it('resolves secondary list_item from payload for document_linked_to_list_item', async () => {
    mockWorkspaceDocumentFindMany.mockResolvedValue([
      { id: 'doc-1', title: 'Policy' },
    ])
    mockListItemFindMany.mockResolvedValue([
      {
        id: 'li-1',
        document: { title: 'Semesterlag', document_number: '1977:480' },
      },
    ])

    const { resolveEntityNames } = await import(
      '@/lib/activity/entity-resolver'
    )
    const result = await resolveEntityNames(
      [
        {
          id: 'row-1',
          action: 'document_linked_to_list_item',
          entity_type: 'workspace_document',
          entity_id: 'doc-1',
          old_value: null,
          new_value: { list_item_id: 'li-1', list_item_title: 'Semesterlag' },
        },
      ],
      'ws-1'
    )
    const refs = result.get('row-1')
    expect(refs?.primary.label).toBe('Policy')
    expect(refs?.secondary?.label).toBe('Semesterlag (1977:480)')
    expect(refs?.secondary?.href).toBe('/laglistor?document=li-1')
  })

  it('filters every findMany by workspace_id (workspace isolation)', async () => {
    const { resolveEntityNames } = await import(
      '@/lib/activity/entity-resolver'
    )
    await resolveEntityNames(
      [
        {
          id: 'row-1',
          action: 'created',
          entity_type: 'task',
          entity_id: 'task-1',
          old_value: null,
          new_value: null,
        },
        {
          id: 'row-2',
          action: 'document_created',
          entity_type: 'workspace_document',
          entity_id: 'doc-1',
          old_value: null,
          new_value: null,
        },
      ],
      'ws-1'
    )

    expect(mockTaskFindMany).toHaveBeenCalledTimes(1)
    expect(mockTaskFindMany.mock.calls[0]?.[0]?.where?.workspace_id).toBe(
      'ws-1'
    )
    expect(mockWorkspaceDocumentFindMany).toHaveBeenCalledTimes(1)
    expect(
      mockWorkspaceDocumentFindMany.mock.calls[0]?.[0]?.where?.workspace_id
    ).toBe('ws-1')
    // list_item / requirement scope through a relation
    // (no rows requested them in this test, so findMany shouldn't run)
    expect(mockListItemFindMany).not.toHaveBeenCalled()
    expect(mockRequirementFindMany).not.toHaveBeenCalled()
  })
})
