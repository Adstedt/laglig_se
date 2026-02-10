/**
 * Story 12.10: Tests for template adoption server action
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies before imports
vi.mock('@/lib/prisma', () => ({
  prisma: {
    lawList: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    lawListGroup: {
      create: vi.fn(),
    },
    lawListItem: {
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/auth/workspace-context', () => ({
  withWorkspace: vi.fn(),
  requireWorkspaceAccess: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/db/queries/template-catalog', () => ({
  getPublishedTemplateBySlugUncached: vi.fn(),
}))

import { adoptTemplate } from '@/app/actions/template-adoption'
import { prisma } from '@/lib/prisma'
import {
  withWorkspace,
  requireWorkspaceAccess,
} from '@/lib/auth/workspace-context'
import { revalidatePath } from 'next/cache'
import { getPublishedTemplateBySlugUncached } from '@/lib/db/queries/template-catalog'

const mockCtx = {
  userId: 'user_123',
  workspaceId: 'ws_123',
  workspaceName: 'Test Workspace',
  workspaceSlug: 'test-workspace',
  workspaceStatus: 'ACTIVE' as const,
  role: 'OWNER' as const,
  hasPermission: () => true,
}

const mockTemplate = {
  id: 'tmpl_123',
  name: 'Arbetsmiljö',
  slug: 'arbetsmiljo',
  description: 'Arbetsmiljölagstiftning',
  domain: 'Arbetsmiljö',
  target_audience: null,
  document_count: 3,
  section_count: 2,
  primary_regulatory_bodies: ['Arbetsmiljöverket'],
  is_variant: false,
  updated_at: '2025-01-01T00:00:00.000Z',
  parent_slug: null,
  variants: [],
  sections: [
    {
      id: 'sec_1',
      section_number: '1',
      name: 'Allmänna bestämmelser',
      description: null,
      item_count: 2,
      position: 1,
      items: [
        {
          id: 'item_1',
          index: '1.1',
          position: 1,
          compliance_summary: 'Compliance summary for AML 1',
          expert_commentary: 'Expert commentary for AML 1',
          source_type: 'SFS',
          regulatory_body: 'Arbetsmiljöverket',
          document: {
            id: 'doc_1',
            document_number: 'SFS 1977:1160',
            title: 'Arbetsmiljölag',
            slug: 'sfs-1977-1160',
          },
        },
        {
          id: 'item_2',
          index: '1.2',
          position: 2,
          compliance_summary: 'Compliance summary for AFS',
          expert_commentary: null,
          source_type: 'AFS',
          regulatory_body: 'Arbetsmiljöverket',
          document: {
            id: 'doc_2',
            document_number: 'AFS 2001:1',
            title: 'Systematiskt arbetsmiljöarbete',
            slug: 'afs-2001-1',
          },
        },
      ],
    },
    {
      id: 'sec_2',
      section_number: '2',
      name: 'Fysisk arbetsmiljö',
      description: null,
      item_count: 1,
      position: 2,
      items: [
        {
          id: 'item_3',
          index: '2.1',
          position: 1,
          compliance_summary: 'Compliance summary for AFS buller',
          expert_commentary: 'Expert commentary for AFS buller',
          source_type: 'AFS',
          regulatory_body: 'Arbetsmiljöverket',
          document: {
            id: 'doc_3',
            document_number: 'AFS 2005:16',
            title: 'Buller',
            slug: 'afs-2005-16',
          },
        },
      ],
    },
  ],
}

describe('adoptTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: withWorkspace returns context
    vi.mocked(withWorkspace).mockImplementation(async (callback) => {
      return callback(mockCtx as never)
    })

    vi.mocked(requireWorkspaceAccess).mockResolvedValue(mockCtx as never)

    // Default: template found
    vi.mocked(getPublishedTemplateBySlugUncached).mockResolvedValue(
      mockTemplate as never
    )

    // Default: no existing lists (no name conflicts)
    vi.mocked(prisma.lawList.findMany).mockResolvedValue([])

    // Transaction implementation
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      const mockLawList = { id: 'list_123', name: 'Arbetsmiljö' }
      const mockGroups = [
        { id: 'group_1', name: 'Allmänna bestämmelser', position: 1 },
        { id: 'group_2', name: 'Fysisk arbetsmiljö', position: 2 },
      ]
      let groupIndex = 0

      const tx = {
        lawList: {
          create: vi.fn().mockResolvedValue(mockLawList),
        },
        lawListGroup: {
          create: vi.fn().mockImplementation(async () => {
            const group = mockGroups[groupIndex]
            groupIndex++
            return group
          }),
        },
        lawListItem: {
          createMany: vi.fn().mockResolvedValue({ count: 3 }),
        },
      }
      return callback(tx as never)
    })
  })

  // ---- Success cases ----

  it('creates 1 LawList + N LawListGroups + M LawListItems', async () => {
    const result = await adoptTemplate({ templateSlug: 'arbetsmiljo' })

    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      listId: 'list_123',
      listName: 'Arbetsmiljö',
      itemCount: 3,
    })
    expect(prisma.$transaction).toHaveBeenCalledOnce()
  })

  it('maps fields correctly: commentary, ai_commentary, category, source, status', async () => {
    let capturedItemData: unknown[] = []
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      const tx = {
        lawList: {
          create: vi
            .fn()
            .mockResolvedValue({ id: 'list_123', name: 'Arbetsmiljö' }),
        },
        lawListGroup: {
          create: vi
            .fn()
            .mockResolvedValueOnce({
              id: 'group_1',
              name: 'Allmänna bestämmelser',
              position: 1,
            })
            .mockResolvedValueOnce({
              id: 'group_2',
              name: 'Fysisk arbetsmiljö',
              position: 2,
            }),
        },
        lawListItem: {
          createMany: vi.fn().mockImplementation(async ({ data }) => {
            capturedItemData = data
            return { count: data.length }
          }),
        },
      }
      return callback(tx as never)
    })

    await adoptTemplate({ templateSlug: 'arbetsmiljo' })

    expect(capturedItemData).toHaveLength(3)

    // Verify first item field mapping
    const firstItem = capturedItemData[0] as Record<string, unknown>
    expect(firstItem.document_id).toBe('doc_1')
    expect(firstItem.commentary).toBe('Compliance summary for AML 1')
    expect(firstItem.ai_commentary).toBe('Expert commentary for AML 1')
    expect(firstItem.category).toBe('Allmänna bestämmelser')
    expect(firstItem.group_id).toBe('group_1')
    expect(firstItem.source).toBe('TEMPLATE')
    expect(firstItem.status).toBe('NOT_STARTED')
    expect(firstItem.compliance_status).toBe('EJ_PABORJAD')
    expect(firstItem.added_by).toBe('user_123')
    expect(firstItem.position).toBe(1)
  })

  it('stores template provenance in LawList.metadata', async () => {
    let capturedListData: Record<string, unknown> | undefined
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      const tx = {
        lawList: {
          create: vi.fn().mockImplementation(async ({ data }) => {
            capturedListData = data
            return { id: 'list_123', name: 'Arbetsmiljö' }
          }),
        },
        lawListGroup: {
          create: vi
            .fn()
            .mockResolvedValue({ id: 'group_1', name: 'Test', position: 1 }),
        },
        lawListItem: {
          createMany: vi.fn().mockResolvedValue({ count: 3 }),
        },
      }
      return callback(tx as never)
    })

    await adoptTemplate({ templateSlug: 'arbetsmiljo' })

    expect(capturedListData?.metadata).toEqual({
      source_template_id: 'tmpl_123',
      source_template_version: '2025-01-01T00:00:00.000Z',
    })
  })

  it('calls revalidatePath after successful adoption', async () => {
    await adoptTemplate({ templateSlug: 'arbetsmiljo' })
    expect(revalidatePath).toHaveBeenCalledWith('/laglistor')
  })

  // ---- Duplicate name handling ----

  it('appends " (2)" when list name already exists', async () => {
    vi.mocked(prisma.lawList.findMany).mockResolvedValue([
      { name: 'Arbetsmiljö' },
    ] as never)

    const result = await adoptTemplate({ templateSlug: 'arbetsmiljo' })

    expect(result.success).toBe(true)
    expect(result.data?.listName).toBe('Arbetsmiljö (2)')
  })

  it('appends " (3)" when both base and " (2)" exist', async () => {
    vi.mocked(prisma.lawList.findMany).mockResolvedValue([
      { name: 'Arbetsmiljö' },
      { name: 'Arbetsmiljö (2)' },
    ] as never)

    const result = await adoptTemplate({ templateSlug: 'arbetsmiljo' })

    expect(result.success).toBe(true)
    expect(result.data?.listName).toBe('Arbetsmiljö (3)')
  })

  // ---- Error cases ----

  it('returns error for non-existent template slug', async () => {
    vi.mocked(getPublishedTemplateBySlugUncached).mockResolvedValue(null)

    const result = await adoptTemplate({ templateSlug: 'nonexistent' })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Mallen hittades inte')
  })

  it('returns error for template with 0 resolved items (empty variant)', async () => {
    vi.mocked(getPublishedTemplateBySlugUncached).mockResolvedValue({
      ...mockTemplate,
      sections: [
        {
          ...mockTemplate.sections[0]!,
          items: [],
        },
      ],
    } as never)

    const result = await adoptTemplate({ templateSlug: 'empty-variant' })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Mallen innehåller inga lagar att adoptera')
  })

  it('returns error for invalid input', async () => {
    const result = await adoptTemplate({ templateSlug: '' })

    expect(result.success).toBe(false)
  })

  // ---- Workspace resolution ----

  it('uses withWorkspace() when no workspaceId provided', async () => {
    await adoptTemplate({ templateSlug: 'arbetsmiljo' })

    expect(withWorkspace).toHaveBeenCalledWith(
      expect.any(Function),
      'lists:create'
    )
    expect(requireWorkspaceAccess).not.toHaveBeenCalled()
  })

  it('uses requireWorkspaceAccess() when workspaceId provided', async () => {
    const wsId = '550e8400-e29b-41d4-a716-446655440000'
    await adoptTemplate({
      templateSlug: 'arbetsmiljo',
      workspaceId: wsId,
    })

    expect(requireWorkspaceAccess).toHaveBeenCalledWith(wsId)
    expect(withWorkspace).not.toHaveBeenCalled()
  })

  // ---- Transaction atomicity ----

  it('rolls back all records on transaction failure', async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(
      new Error('Transaction failed')
    )

    const result = await adoptTemplate({ templateSlug: 'arbetsmiljo' })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Kunde inte adoptera mall')
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})
