import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockTaskFindMany = vi.fn()
const mockListItemFindMany = vi.fn()
const mockWorkspaceDocumentFindMany = vi.fn()
const mockRequirementFindMany = vi.fn()
// Story 21.13 — compliance-audit entities.
const mockComplianceAuditCycleFindMany = vi.fn()
const mockComplianceAuditItemFindMany = vi.fn()
const mockComplianceFindingFindMany = vi.fn()

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
    complianceAuditCycle: {
      findMany: (...args: unknown[]) =>
        mockComplianceAuditCycleFindMany(...args),
    },
    complianceAuditItem: {
      findMany: (...args: unknown[]) =>
        mockComplianceAuditItemFindMany(...args),
    },
    complianceFinding: {
      findMany: (...args: unknown[]) => mockComplianceFindingFindMany(...args),
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
    mockComplianceAuditCycleFindMany.mockResolvedValue([])
    mockComplianceAuditItemFindMany.mockResolvedValue([])
    mockComplianceFindingFindMany.mockResolvedValue([])
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

  // ==========================================================================
  // Story 21.13: Compliance-audit entities (Epic 21)
  // ==========================================================================

  it('resolves primary compliance_audit_cycle with deep link to cycle detail page', async () => {
    mockComplianceAuditCycleFindMany.mockResolvedValue([
      { id: 'cycle-1', name: 'Q2 compliance review' },
    ])
    const { resolveEntityNames } = await import(
      '@/lib/activity/entity-resolver'
    )
    const result = await resolveEntityNames(
      [
        {
          id: 'row-1',
          action: 'cycle_created',
          entity_type: 'compliance_audit_cycle',
          entity_id: 'cycle-1',
          old_value: null,
          new_value: { name: 'Q2 compliance review' },
        },
      ],
      'ws-1'
    )
    const ref = result.get('row-1')?.primary
    expect(ref?.label).toBe('Q2 compliance review')
    expect(ref?.href).toBe('/laglistor/kontroller/cycle-1')
    expect(ref?.deleted).toBe(false)
  })

  it('returns tombstone when compliance_audit_cycle is soft-deleted or cross-workspace', async () => {
    // Simulates: the cycle either has deleted_at != null OR is in a different
    // workspace. findMany filters workspace_id + (implicitly) the resolver
    // trusts the DB to surface only rows it should display, so an empty
    // findMany result == "not available" == tombstone.
    mockComplianceAuditCycleFindMany.mockResolvedValue([])
    const { resolveEntityNames } = await import(
      '@/lib/activity/entity-resolver'
    )
    const result = await resolveEntityNames(
      [
        {
          id: 'row-1',
          action: 'cycle_soft_deleted',
          entity_type: 'compliance_audit_cycle',
          entity_id: 'cycle-gone',
          old_value: { status: 'PLANERAD', name: 'Forgotten cycle' },
          new_value: null,
        },
      ],
      'ws-1'
    )
    const ref = result.get('row-1')?.primary
    expect(ref?.deleted).toBe(true)
    expect(ref?.href).toBeNull()
    // Fallback label pulled from old_value.name via fallbackLabelFromPayload
    expect(ref?.label).toContain('Forgotten cycle')
  })

  it('resolves primary compliance_audit_item with cycle-scoped #items hash deep link', async () => {
    mockComplianceAuditItemFindMany.mockResolvedValue([
      {
        id: 'item-1',
        cycle_id: 'cycle-1',
        law_list_item: {
          document: {
            title: 'Miljöbalken',
            document_number: 'SFS 1998:808',
          },
        },
      },
    ])
    const { resolveEntityNames } = await import(
      '@/lib/activity/entity-resolver'
    )
    const result = await resolveEntityNames(
      [
        {
          id: 'row-1',
          action: 'cycle_item_signed_off',
          entity_type: 'compliance_audit_item',
          entity_id: 'item-1',
          old_value: null,
          new_value: { signedAt: '2026-04-22T12:00:00Z' },
        },
      ],
      'ws-1'
    )
    const ref = result.get('row-1')?.primary
    expect(ref?.label).toBe('Miljöbalken (SFS 1998:808)')
    expect(ref?.href).toBe('/laglistor/kontroller/cycle-1#items')
    expect(ref?.deleted).toBe(false)
  })

  it('compliance_audit_item falls back gracefully when law_list_item.document is missing', async () => {
    // Defensive: schema makes this unlikely in production, but resolver
    // must not crash if seed drift leaves law_list_item.document null.
    mockComplianceAuditItemFindMany.mockResolvedValue([
      {
        id: 'item-1',
        cycle_id: 'cycle-1',
        law_list_item: { document: null },
      },
    ])
    const { resolveEntityNames } = await import(
      '@/lib/activity/entity-resolver'
    )
    const result = await resolveEntityNames(
      [
        {
          id: 'row-1',
          action: 'cycle_item_signed_off',
          entity_type: 'compliance_audit_item',
          entity_id: 'item-1',
          old_value: null,
          new_value: null,
        },
      ],
      'ws-1'
    )
    const ref = result.get('row-1')?.primary
    expect(ref?.label).toBe('Kontrollpost')
    // Hash is omitted when document is missing — falls back to cycle root.
    expect(ref?.href).toBe('/laglistor/kontroller/cycle-1')
    expect(ref?.deleted).toBe(false)
  })

  it('resolves primary compliance_finding with cycle-scoped #findings hash deep link', async () => {
    mockComplianceFindingFindMany.mockResolvedValue([
      {
        id: 'finding-1',
        cycle_id: 'cycle-1',
        title: 'Saknad utbildningsplan',
      },
    ])
    const { resolveEntityNames } = await import(
      '@/lib/activity/entity-resolver'
    )
    const result = await resolveEntityNames(
      [
        {
          id: 'row-1',
          action: 'finding_created', // future Story 21.7 action; resolver works today regardless
          entity_type: 'compliance_finding',
          entity_id: 'finding-1',
          old_value: null,
          new_value: { title: 'Saknad utbildningsplan' },
        },
      ],
      'ws-1'
    )
    const ref = result.get('row-1')?.primary
    expect(ref?.label).toBe('Saknad utbildningsplan')
    expect(ref?.href).toBe('/laglistor/kontroller/cycle-1#findings')
    expect(ref?.deleted).toBe(false)
  })

  it('batches findMany per model — one query per model type, regardless of row count', async () => {
    mockComplianceAuditCycleFindMany.mockResolvedValue([
      { id: 'cycle-1', name: 'C1' },
      { id: 'cycle-2', name: 'C2' },
    ])
    mockComplianceAuditItemFindMany.mockResolvedValue([
      {
        id: 'item-1',
        cycle_id: 'cycle-1',
        law_list_item: {
          document: { title: 'T1', document_number: 'D1' },
        },
      },
      {
        id: 'item-2',
        cycle_id: 'cycle-1',
        law_list_item: {
          document: { title: 'T2', document_number: 'D2' },
        },
      },
    ])
    const { resolveEntityNames } = await import(
      '@/lib/activity/entity-resolver'
    )

    // 2 cycle rows + 2 item rows + 1 finding row (but finding mock is empty
    // → still counts as 1 findMany call because the ID-set has 1 id).
    mockComplianceFindingFindMany.mockResolvedValue([])
    await resolveEntityNames(
      [
        {
          id: 'r1',
          action: 'cycle_created',
          entity_type: 'compliance_audit_cycle',
          entity_id: 'cycle-1',
          old_value: null,
          new_value: null,
        },
        {
          id: 'r2',
          action: 'cycle_metadata_updated',
          entity_type: 'compliance_audit_cycle',
          entity_id: 'cycle-2',
          old_value: null,
          new_value: null,
        },
        {
          id: 'r3',
          action: 'cycle_item_signed_off',
          entity_type: 'compliance_audit_item',
          entity_id: 'item-1',
          old_value: null,
          new_value: null,
        },
        {
          id: 'r4',
          action: 'cycle_item_signed_off',
          entity_type: 'compliance_audit_item',
          entity_id: 'item-2',
          old_value: null,
          new_value: null,
        },
        {
          id: 'r5',
          action: 'finding_created',
          entity_type: 'compliance_finding',
          entity_id: 'finding-1',
          old_value: null,
          new_value: null,
        },
      ],
      'ws-1'
    )

    // N+1 prevention contract: exactly one findMany per touched model.
    expect(mockComplianceAuditCycleFindMany).toHaveBeenCalledTimes(1)
    expect(mockComplianceAuditItemFindMany).toHaveBeenCalledTimes(1)
    expect(mockComplianceFindingFindMany).toHaveBeenCalledTimes(1)

    // And workspace-scoped — cycles directly, items + findings via cycle relation.
    expect(
      mockComplianceAuditCycleFindMany.mock.calls[0]?.[0]?.where?.workspace_id
    ).toBe('ws-1')
    expect(
      mockComplianceAuditItemFindMany.mock.calls[0]?.[0]?.where?.cycle
        ?.workspace_id
    ).toBe('ws-1')
    expect(
      mockComplianceFindingFindMany.mock.calls[0]?.[0]?.where?.cycle
        ?.workspace_id
    ).toBe('ws-1')
  })

  // Story 21.7 — finding → item secondary ref.
  it('resolves secondary list_item when finding_created payload carries lawListItemId', async () => {
    mockComplianceFindingFindMany.mockResolvedValue([
      { id: 'f-1', cycle_id: 'c-1', title: 'Saknad utbildning' },
    ])
    mockListItemFindMany.mockResolvedValue([
      {
        id: 'li-1',
        document: { title: 'Miljöbalken', document_number: 'SFS 1998:808' },
      },
    ])
    const { resolveEntityNames } = await import(
      '@/lib/activity/entity-resolver'
    )
    const result = await resolveEntityNames(
      [
        {
          id: 'row-1',
          action: 'finding_created',
          entity_type: 'compliance_finding',
          entity_id: 'f-1',
          old_value: null,
          new_value: {
            type: 'AVVIKELSE',
            title: 'Saknad utbildning',
            lawListItemId: 'li-1',
          },
        },
      ],
      'ws-1'
    )
    const secondary = result.get('row-1')?.secondary
    expect(secondary).toBeDefined()
    expect(secondary?.label).toContain('Miljöbalken')
  })

  it('has no secondary ref when finding_created payload is cycle-level (no lawListItemId)', async () => {
    mockComplianceFindingFindMany.mockResolvedValue([
      { id: 'f-1', cycle_id: 'c-1', title: 'Cycle-level' },
    ])
    const { resolveEntityNames } = await import(
      '@/lib/activity/entity-resolver'
    )
    const result = await resolveEntityNames(
      [
        {
          id: 'row-1',
          action: 'finding_created',
          entity_type: 'compliance_finding',
          entity_id: 'f-1',
          old_value: null,
          new_value: {
            type: 'OBSERVATION',
            title: 'Cycle-level',
          },
        },
      ],
      'ws-1'
    )
    expect(result.get('row-1')?.secondary).toBeUndefined()
  })

  it('finding_closed payloads render primary-only (no lawListItemId carried)', async () => {
    mockComplianceFindingFindMany.mockResolvedValue([
      { id: 'f-1', cycle_id: 'c-1', title: 'Closed one' },
    ])
    const { resolveEntityNames } = await import(
      '@/lib/activity/entity-resolver'
    )
    const result = await resolveEntityNames(
      [
        {
          id: 'row-1',
          action: 'finding_closed',
          entity_type: 'compliance_finding',
          entity_id: 'f-1',
          old_value: null,
          new_value: {
            closed_at: '2026-04-22T12:00:00Z',
            closed_by_user_id: 'u1',
          },
        },
      ],
      'ws-1'
    )
    expect(result.get('row-1')?.secondary).toBeUndefined()
  })
})
