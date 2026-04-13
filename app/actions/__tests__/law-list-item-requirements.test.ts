/**
 * Story 17.16: Kravpunkter server-action unit tests
 * Mocks Prisma, workspace-context, cache, and activity logger.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createRequirement,
  updateRequirement,
  deleteRequirement,
  reorderRequirements,
  getRequirementsForListItem,
  linkEvidenceToRequirement,
  unlinkEvidenceFromRequirement,
} from '../law-list-item-requirements'
import { prisma } from '@/lib/prisma'
import * as workspaceContext from '@/lib/auth/workspace-context'
import * as activityLogger from '@/lib/services/activity-logger'

// ============================================================================
// Module mocks
// ============================================================================

vi.mock('@/lib/prisma', () => ({
  prisma: {
    lawListItem: { findFirst: vi.fn() },
    lawListItemRequirement: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    requirementEvidenceLink: {
      create: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    workspaceFile: { findFirst: vi.fn() },
    workspaceDocument: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/auth/workspace-context', () => ({
  withWorkspace: vi.fn(),
}))

vi.mock('@/lib/cache/redis', () => ({
  redis: { del: vi.fn().mockResolvedValue(1) },
}))

vi.mock('@/lib/services/activity-logger', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// ============================================================================
// Helpers
// ============================================================================

// RFC 4122 UUIDs (version nibble = 4, variant nibble ∈ {8,9,a,b}).
const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_WORKSPACE_ID = '99999999-9999-4999-8999-999999999999'
const USER_ID = '22222222-2222-4222-8222-222222222222'
const LIST_ITEM_ID = '33333333-3333-4333-8333-333333333333'
const REQUIREMENT_ID = '44444444-4444-4444-8444-444444444444'
const FILE_ID = '55555555-5555-4555-8555-555555555555'
const DOC_ID = '66666666-6666-4666-8666-666666666666'

function mockWorkspaceCtx(workspaceId = WORKSPACE_ID) {
  vi.mocked(workspaceContext.withWorkspace).mockImplementation(
    async (callback) =>
      callback({
        workspaceId,
        userId: USER_ID,
        workspaceName: 'Test WS',
        workspaceSlug: 'test',
        workspaceStatus: 'ACTIVE' as never,
        role: 'OWNER' as never,
        hasPermission: () => true,
      })
  )
}

// ============================================================================
// createRequirement
// ============================================================================

describe('createRequirement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWorkspaceCtx()
  })

  it('creates a requirement with position = (max + 1000) and logs activity', async () => {
    vi.mocked(prisma.lawListItem.findFirst).mockResolvedValue({
      id: LIST_ITEM_ID,
      law_list: { workspace_id: WORKSPACE_ID },
    } as never)
    vi.mocked(prisma.lawListItemRequirement.findFirst).mockResolvedValue({
      position: 2000,
    } as never)
    vi.mocked(prisma.lawListItemRequirement.create).mockResolvedValue({
      id: REQUIREMENT_ID,
      text: 'Rutinen finns dokumenterad',
      is_fulfilled: false,
      position: 3000,
      created_at: new Date(),
      updated_at: new Date(),
      created_by: USER_ID,
    } as never)

    const result = await createRequirement(
      LIST_ITEM_ID,
      'Rutinen finns dokumenterad'
    )

    expect(result.success).toBe(true)
    expect(result.data?.position).toBe(3000)
    expect(prisma.lawListItemRequirement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          list_item_id: LIST_ITEM_ID,
          position: 3000,
          created_by: USER_ID,
        }),
      })
    )
    expect(activityLogger.logActivity).toHaveBeenCalledWith(
      WORKSPACE_ID,
      USER_ID,
      'requirement',
      REQUIREMENT_ID,
      'requirement_created',
      null,
      expect.any(Object)
    )
    expect(workspaceContext.withWorkspace).toHaveBeenCalledWith(
      expect.any(Function),
      'tasks:edit'
    )
  })

  it('rejects empty text via Zod', async () => {
    const result = await createRequirement(LIST_ITEM_ID, '')
    expect(result.success).toBe(false)
    expect(prisma.lawListItemRequirement.create).not.toHaveBeenCalled()
  })

  it('rejects text exceeding 500 chars via Zod', async () => {
    const result = await createRequirement(LIST_ITEM_ID, 'x'.repeat(501))
    expect(result.success).toBe(false)
    expect(prisma.lawListItemRequirement.create).not.toHaveBeenCalled()
  })

  it('enforces workspace isolation', async () => {
    vi.mocked(prisma.lawListItem.findFirst).mockResolvedValue({
      id: LIST_ITEM_ID,
      law_list: { workspace_id: OTHER_WORKSPACE_ID },
    } as never)

    const result = await createRequirement(LIST_ITEM_ID, 'ok')
    expect(result.success).toBe(false)
    expect(result.error).toContain('hittades inte')
    expect(prisma.lawListItemRequirement.create).not.toHaveBeenCalled()
  })

  it('starts position at 1000 when no siblings exist', async () => {
    vi.mocked(prisma.lawListItem.findFirst).mockResolvedValue({
      id: LIST_ITEM_ID,
      law_list: { workspace_id: WORKSPACE_ID },
    } as never)
    vi.mocked(prisma.lawListItemRequirement.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.lawListItemRequirement.create).mockResolvedValue({
      id: REQUIREMENT_ID,
      text: 'first',
      is_fulfilled: false,
      position: 1000,
      created_at: new Date(),
      updated_at: new Date(),
      created_by: USER_ID,
    } as never)

    await createRequirement(LIST_ITEM_ID, 'first')
    expect(prisma.lawListItemRequirement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ position: 1000 }),
      })
    )
  })
})

// ============================================================================
// updateRequirement
// ============================================================================

describe('updateRequirement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWorkspaceCtx()
  })

  function mockScopeOk() {
    // Two call sites: workspace-scope lookup (selects list_item_id) + prior-state lookup.
    vi.mocked(prisma.lawListItemRequirement.findUnique).mockImplementation(
      ((args: { select?: Record<string, unknown> | null }) => {
        if (args?.select && 'list_item_id' in args.select) {
          return Promise.resolve({
            list_item_id: LIST_ITEM_ID,
            list_item: { law_list: { workspace_id: WORKSPACE_ID } },
          }) as never
        }
        return Promise.resolve({
          text: 'old text',
          is_fulfilled: false,
        }) as never
      }) as never
    )
  }

  it('updates text and logs with old/new values', async () => {
    mockScopeOk()
    vi.mocked(prisma.lawListItemRequirement.update).mockResolvedValue(
      {} as never
    )

    const result = await updateRequirement(REQUIREMENT_ID, { text: 'new text' })
    expect(result.success).toBe(true)
    expect(prisma.lawListItemRequirement.update).toHaveBeenCalledWith({
      where: { id: REQUIREMENT_ID },
      data: { text: 'new text' },
    })
    expect(activityLogger.logActivity).toHaveBeenCalledWith(
      WORKSPACE_ID,
      USER_ID,
      'requirement',
      REQUIREMENT_ID,
      'requirement_text_updated',
      expect.objectContaining({ text: 'old text', is_fulfilled: false }),
      expect.objectContaining({ text: 'new text' })
    )
  })

  it('toggles isFulfilled=true and logs "marked_fulfilled" action', async () => {
    mockScopeOk()
    vi.mocked(prisma.lawListItemRequirement.update).mockResolvedValue(
      {} as never
    )

    await updateRequirement(REQUIREMENT_ID, { isFulfilled: true })
    expect(activityLogger.logActivity).toHaveBeenCalledWith(
      WORKSPACE_ID,
      USER_ID,
      'requirement',
      REQUIREMENT_ID,
      'requirement_marked_fulfilled',
      expect.any(Object),
      expect.any(Object)
    )
  })

  it('rejects empty updates (no text, no isFulfilled)', async () => {
    const result = await updateRequirement(REQUIREMENT_ID, {})
    expect(result.success).toBe(false)
    expect(prisma.lawListItemRequirement.update).not.toHaveBeenCalled()
  })

  it('enforces workspace isolation', async () => {
    vi.mocked(prisma.lawListItemRequirement.findUnique).mockResolvedValue({
      list_item_id: LIST_ITEM_ID,
      list_item: { law_list: { workspace_id: OTHER_WORKSPACE_ID } },
    } as never)

    const result = await updateRequirement(REQUIREMENT_ID, { text: 'x' })
    expect(result.success).toBe(false)
    expect(prisma.lawListItemRequirement.update).not.toHaveBeenCalled()
  })
})

// ============================================================================
// deleteRequirement
// ============================================================================

describe('deleteRequirement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWorkspaceCtx()
  })

  it('deletes and logs when workspace matches', async () => {
    vi.mocked(prisma.lawListItemRequirement.findUnique).mockImplementation(
      ((args: { select?: Record<string, unknown> | null }) => {
        if (args?.select && 'list_item_id' in args.select) {
          return Promise.resolve({
            list_item_id: LIST_ITEM_ID,
            list_item: { law_list: { workspace_id: WORKSPACE_ID } },
          }) as never
        }
        return Promise.resolve({ text: 'to delete' }) as never
      }) as never
    )
    vi.mocked(prisma.lawListItemRequirement.delete).mockResolvedValue(
      {} as never
    )

    const result = await deleteRequirement(REQUIREMENT_ID)
    expect(result.success).toBe(true)
    expect(prisma.lawListItemRequirement.delete).toHaveBeenCalledWith({
      where: { id: REQUIREMENT_ID },
    })
    expect(activityLogger.logActivity).toHaveBeenCalledWith(
      WORKSPACE_ID,
      USER_ID,
      'requirement',
      REQUIREMENT_ID,
      'requirement_deleted',
      expect.any(Object),
      null
    )
  })

  it('rejects invalid UUID', async () => {
    const result = await deleteRequirement('not-a-uuid')
    expect(result.success).toBe(false)
    expect(prisma.lawListItemRequirement.delete).not.toHaveBeenCalled()
  })

  it('enforces workspace isolation', async () => {
    vi.mocked(prisma.lawListItemRequirement.findUnique).mockResolvedValue({
      list_item_id: LIST_ITEM_ID,
      list_item: { law_list: { workspace_id: OTHER_WORKSPACE_ID } },
    } as never)

    const result = await deleteRequirement(REQUIREMENT_ID)
    expect(result.success).toBe(false)
    expect(prisma.lawListItemRequirement.delete).not.toHaveBeenCalled()
  })
})

// ============================================================================
// reorderRequirements
// ============================================================================

describe('reorderRequirements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWorkspaceCtx()
  })

  it('assigns evenly spaced Float positions in a transaction', async () => {
    const orderedIds = [
      '11111111-1111-4111-8111-111111111112',
      '11111111-1111-4111-8111-111111111113',
      '11111111-1111-4111-8111-111111111114',
    ]
    vi.mocked(prisma.lawListItem.findFirst).mockResolvedValue({
      id: LIST_ITEM_ID,
      law_list: { workspace_id: WORKSPACE_ID },
    } as never)
    vi.mocked(prisma.lawListItemRequirement.count).mockResolvedValue(
      orderedIds.length
    )
    vi.mocked(prisma.lawListItemRequirement.update).mockResolvedValue(
      {} as never
    )
    vi.mocked(prisma.$transaction).mockImplementation(
      async (ops: unknown) => ops as never
    )

    const result = await reorderRequirements(LIST_ITEM_ID, orderedIds)
    expect(result.success).toBe(true)
    expect(prisma.$transaction).toHaveBeenCalled()
    // Each update call should use position = (index + 1) * 1000.
    expect(prisma.lawListItemRequirement.update).toHaveBeenCalledTimes(3)
  })

  it('rejects when ordered IDs do not all belong to the list item', async () => {
    const orderedIds = [
      '11111111-1111-4111-8111-111111111112',
      '11111111-1111-4111-8111-111111111113',
    ]
    vi.mocked(prisma.lawListItem.findFirst).mockResolvedValue({
      id: LIST_ITEM_ID,
      law_list: { workspace_id: WORKSPACE_ID },
    } as never)
    vi.mocked(prisma.lawListItemRequirement.count).mockResolvedValue(1)

    const result = await reorderRequirements(LIST_ITEM_ID, orderedIds)
    expect(result.success).toBe(false)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})

// ============================================================================
// linkEvidenceToRequirement
// ============================================================================

describe('linkEvidenceToRequirement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWorkspaceCtx()
    vi.mocked(prisma.lawListItemRequirement.findUnique).mockResolvedValue({
      list_item_id: LIST_ITEM_ID,
      list_item: { law_list: { workspace_id: WORKSPACE_ID } },
    } as never)
  })

  it('links a file successfully', async () => {
    vi.mocked(prisma.workspaceFile.findFirst).mockResolvedValue({
      id: FILE_ID,
      filename: 'evidence.pdf',
    } as never)
    vi.mocked(prisma.requirementEvidenceLink.create).mockResolvedValue({
      id: 'link-1',
    } as never)

    const result = await linkEvidenceToRequirement(REQUIREMENT_ID, {
      fileId: FILE_ID,
    })
    expect(result.success).toBe(true)
    expect(result.data?.id).toBe('link-1')
    expect(prisma.requirementEvidenceLink.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requirement_id: REQUIREMENT_ID,
        file_id: FILE_ID,
        workspace_document_id: null,
      }),
    })
  })

  it('links a workspace document successfully', async () => {
    vi.mocked(prisma.workspaceDocument.findFirst).mockResolvedValue({
      id: DOC_ID,
      title: 'Policy',
    } as never)
    vi.mocked(prisma.requirementEvidenceLink.create).mockResolvedValue({
      id: 'link-2',
    } as never)

    const result = await linkEvidenceToRequirement(REQUIREMENT_ID, {
      workspaceDocumentId: DOC_ID,
    })
    expect(result.success).toBe(true)
    expect(prisma.requirementEvidenceLink.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requirement_id: REQUIREMENT_ID,
        file_id: null,
        workspace_document_id: DOC_ID,
      }),
    })
  })

  it('rejects when both fileId and workspaceDocumentId are provided (XOR)', async () => {
    const result = await linkEvidenceToRequirement(REQUIREMENT_ID, {
      fileId: FILE_ID,
      workspaceDocumentId: DOC_ID,
    })
    expect(result.success).toBe(false)
    expect(prisma.requirementEvidenceLink.create).not.toHaveBeenCalled()
  })

  it('rejects when neither fileId nor workspaceDocumentId is provided (XOR)', async () => {
    const result = await linkEvidenceToRequirement(REQUIREMENT_ID, {})
    expect(result.success).toBe(false)
    expect(prisma.requirementEvidenceLink.create).not.toHaveBeenCalled()
  })

  it('returns friendly error when Prisma P2002 (duplicate) fires', async () => {
    vi.mocked(prisma.workspaceFile.findFirst).mockResolvedValue({
      id: FILE_ID,
      filename: 'x.pdf',
    } as never)
    vi.mocked(prisma.requirementEvidenceLink.create).mockRejectedValue(
      Object.assign(new Error('unique'), { code: 'P2002' })
    )

    const result = await linkEvidenceToRequirement(REQUIREMENT_ID, {
      fileId: FILE_ID,
    })
    expect(result.success).toBe(false)
    expect(result.error).toBe('Beviset är redan länkat')
  })

  it('rejects when the file does not belong to this workspace', async () => {
    vi.mocked(prisma.workspaceFile.findFirst).mockResolvedValue(null)

    const result = await linkEvidenceToRequirement(REQUIREMENT_ID, {
      fileId: FILE_ID,
    })
    expect(result.success).toBe(false)
    expect(prisma.requirementEvidenceLink.create).not.toHaveBeenCalled()
  })
})

// ============================================================================
// unlinkEvidenceFromRequirement
// ============================================================================

describe('unlinkEvidenceFromRequirement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWorkspaceCtx()
    vi.mocked(prisma.lawListItemRequirement.findUnique).mockResolvedValue({
      list_item_id: LIST_ITEM_ID,
      list_item: { law_list: { workspace_id: WORKSPACE_ID } },
    } as never)
  })

  it('unlinks a file successfully', async () => {
    vi.mocked(prisma.requirementEvidenceLink.findFirst).mockResolvedValue({
      id: 'link-1',
    } as never)
    vi.mocked(prisma.requirementEvidenceLink.delete).mockResolvedValue(
      {} as never
    )

    const result = await unlinkEvidenceFromRequirement(REQUIREMENT_ID, {
      fileId: FILE_ID,
    })
    expect(result.success).toBe(true)
    expect(prisma.requirementEvidenceLink.delete).toHaveBeenCalledWith({
      where: { id: 'link-1' },
    })
  })

  it('returns error when link not found', async () => {
    vi.mocked(prisma.requirementEvidenceLink.findFirst).mockResolvedValue(null)

    const result = await unlinkEvidenceFromRequirement(REQUIREMENT_ID, {
      fileId: FILE_ID,
    })
    expect(result.success).toBe(false)
    expect(prisma.requirementEvidenceLink.delete).not.toHaveBeenCalled()
  })

  it('rejects XOR violation (both IDs provided)', async () => {
    const result = await unlinkEvidenceFromRequirement(REQUIREMENT_ID, {
      fileId: FILE_ID,
      workspaceDocumentId: DOC_ID,
    })
    expect(result.success).toBe(false)
    expect(prisma.requirementEvidenceLink.delete).not.toHaveBeenCalled()
  })
})

// ============================================================================
// getRequirementsForListItem
// ============================================================================

describe('getRequirementsForListItem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWorkspaceCtx()
  })

  it('returns requirements with mapped evidence summaries', async () => {
    vi.mocked(prisma.lawListItem.findFirst).mockResolvedValue({
      id: LIST_ITEM_ID,
      law_list: { workspace_id: WORKSPACE_ID },
    } as never)
    vi.mocked(prisma.lawListItemRequirement.findMany).mockResolvedValue([
      {
        id: REQUIREMENT_ID,
        text: 'R1',
        is_fulfilled: true,
        position: 1000,
        created_at: new Date(),
        updated_at: new Date(),
        created_by: USER_ID,
        evidence_links: [
          {
            id: 'link-1',
            linked_at: new Date(),
            file: {
              id: FILE_ID,
              filename: 'evidence.pdf',
              mime_type: 'application/pdf',
            },
            workspace_document: null,
          },
        ],
      },
    ] as never)

    const result = await getRequirementsForListItem(LIST_ITEM_ID)
    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(1)
    expect(result.data?.[0]?.evidence).toHaveLength(1)
    expect(result.data?.[0]?.evidence[0]?.file?.filename).toBe('evidence.pdf')
    expect(result.data?.[0]?.evidence[0]?.workspaceDocument).toBeNull()
    expect(workspaceContext.withWorkspace).toHaveBeenCalledWith(
      expect.any(Function),
      'read'
    )
  })

  it('enforces workspace isolation', async () => {
    vi.mocked(prisma.lawListItem.findFirst).mockResolvedValue({
      id: LIST_ITEM_ID,
      law_list: { workspace_id: OTHER_WORKSPACE_ID },
    } as never)

    const result = await getRequirementsForListItem(LIST_ITEM_ID)
    expect(result.success).toBe(false)
    expect(prisma.lawListItemRequirement.findMany).not.toHaveBeenCalled()
  })
})
