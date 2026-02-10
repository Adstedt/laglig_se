/**
 * Story 12.10: Integration test for template adoption flow
 * Tests the full adoption pipeline: fetch template → create list + groups + items
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock all external dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    lawList: {
      findMany: vi.fn(),
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
import { withWorkspace } from '@/lib/auth/workspace-context'
import { getPublishedTemplateBySlugUncached } from '@/lib/db/queries/template-catalog'

const mockCtx = {
  userId: 'user_int_1',
  workspaceId: 'ws_int_1',
  workspaceName: 'Integration Workspace',
  workspaceSlug: 'int-workspace',
  workspaceStatus: 'ACTIVE' as const,
  role: 'OWNER' as const,
  hasPermission: () => true,
}

describe('Template Adoption Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(withWorkspace).mockImplementation(async (cb) =>
      cb(mockCtx as never)
    )
    vi.mocked(prisma.lawList.findMany).mockResolvedValue([])
  })

  it('full adoption flow: fetch template → create list + groups + items → verify counts and fields', async () => {
    // Setup: template with 2 sections, 3 items total
    const template = {
      id: 'tmpl_int_1',
      name: 'Integration Test Mall',
      slug: 'integration-mall',
      description: 'Test template',
      domain: 'Test',
      target_audience: null,
      document_count: 3,
      section_count: 2,
      primary_regulatory_bodies: [],
      is_variant: false,
      updated_at: '2025-06-01T00:00:00.000Z',
      parent_slug: null,
      variants: [],
      sections: [
        {
          id: 'sec_a',
          section_number: '1',
          name: 'Section Alpha',
          description: null,
          item_count: 2,
          position: 1,
          items: [
            {
              id: 'i1',
              index: '1.1',
              position: 1,
              compliance_summary: 'Comp 1',
              expert_commentary: 'Expert 1',
              source_type: 'SFS',
              regulatory_body: 'Test',
              document: {
                id: 'd1',
                document_number: 'SFS 2020:1',
                title: 'Law 1',
                slug: 'law-1',
              },
            },
            {
              id: 'i2',
              index: '1.2',
              position: 2,
              compliance_summary: 'Comp 2',
              expert_commentary: null,
              source_type: 'SFS',
              regulatory_body: 'Test',
              document: {
                id: 'd2',
                document_number: 'SFS 2020:2',
                title: 'Law 2',
                slug: 'law-2',
              },
            },
          ],
        },
        {
          id: 'sec_b',
          section_number: '2',
          name: 'Section Beta',
          description: null,
          item_count: 1,
          position: 2,
          items: [
            {
              id: 'i3',
              index: '2.1',
              position: 1,
              compliance_summary: 'Comp 3',
              expert_commentary: 'Expert 3',
              source_type: 'AFS',
              regulatory_body: 'Test',
              document: {
                id: 'd3',
                document_number: 'AFS 2021:1',
                title: 'Regulation 1',
                slug: 'reg-1',
              },
            },
          ],
        },
      ],
    }

    vi.mocked(getPublishedTemplateBySlugUncached).mockResolvedValue(
      template as never
    )

    // Capture all TX operations
    let capturedListCreate: Record<string, unknown> | undefined
    const capturedGroupCreates: Array<Record<string, unknown>> = []
    let capturedItemCreateMany: unknown[] = []

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      const tx = {
        lawList: {
          create: vi.fn().mockImplementation(async ({ data }) => {
            capturedListCreate = data
            return { id: 'created_list_1', name: data.name }
          }),
        },
        lawListGroup: {
          create: vi.fn().mockImplementation(async ({ data }) => {
            capturedGroupCreates.push(data)
            const groupId = `created_group_${capturedGroupCreates.length}`
            return { id: groupId, name: data.name, position: data.position }
          }),
        },
        lawListItem: {
          createMany: vi.fn().mockImplementation(async ({ data }) => {
            capturedItemCreateMany = data
            return { count: data.length }
          }),
        },
      }
      return callback(tx as never)
    })

    // Execute
    const result = await adoptTemplate({ templateSlug: 'integration-mall' })

    // Verify success
    expect(result.success).toBe(true)
    expect(result.data?.listId).toBe('created_list_1')
    expect(result.data?.listName).toBe('Integration Test Mall')
    expect(result.data?.itemCount).toBe(3)

    // Verify LawList created with metadata
    expect(capturedListCreate?.name).toBe('Integration Test Mall')
    expect(capturedListCreate?.workspace_id).toBe('ws_int_1')
    expect(capturedListCreate?.created_by).toBe('user_int_1')
    expect(capturedListCreate?.metadata).toEqual({
      source_template_id: 'tmpl_int_1',
      source_template_version: '2025-06-01T00:00:00.000Z',
    })

    // Verify 2 groups created
    expect(capturedGroupCreates).toHaveLength(2)
    expect(capturedGroupCreates[0]?.name).toBe('Section Alpha')
    expect(capturedGroupCreates[1]?.name).toBe('Section Beta')

    // Verify 3 items created with correct field mapping
    expect(capturedItemCreateMany).toHaveLength(3)

    const items = capturedItemCreateMany as Array<Record<string, unknown>>
    // Item 1: Section Alpha
    expect(items[0]?.document_id).toBe('d1')
    expect(items[0]?.commentary).toBe('Comp 1')
    expect(items[0]?.ai_commentary).toBe('Expert 1')
    expect(items[0]?.category).toBe('Section Alpha')
    expect(items[0]?.group_id).toBe('created_group_1')
    expect(items[0]?.source).toBe('TEMPLATE')
    expect(items[0]?.status).toBe('NOT_STARTED')
    expect(items[0]?.compliance_status).toBe('EJ_PABORJAD')

    // Item 2: Section Alpha (null expert_commentary)
    expect(items[1]?.document_id).toBe('d2')
    expect(items[1]?.ai_commentary).toBeNull()
    expect(items[1]?.group_id).toBe('created_group_1')

    // Item 3: Section Beta
    expect(items[2]?.document_id).toBe('d3')
    expect(items[2]?.category).toBe('Section Beta')
    expect(items[2]?.group_id).toBe('created_group_2')
  })
})
