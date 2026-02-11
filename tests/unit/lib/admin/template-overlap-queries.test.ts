import { vi, describe, beforeEach, it, expect } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    templateItem: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { getTemplateOverlap } from '@/lib/admin/template-queries'

const mockPrisma = vi.mocked(prisma, true)

describe('getTemplateOverlap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array when no overlapping documents exist', async () => {
    mockPrisma.templateItem.groupBy.mockResolvedValue([] as never)

    const result = await getTemplateOverlap()

    expect(result).toEqual([])
    expect(mockPrisma.templateItem.findMany).not.toHaveBeenCalled()
  })

  it('returns documents that appear in 2+ templates', async () => {
    mockPrisma.templateItem.groupBy.mockResolvedValue([
      { document_id: 'doc-1', _count: { template_id: 2 } },
    ] as never)

    mockPrisma.templateItem.findMany.mockResolvedValue([
      {
        id: 'item-1',
        document_id: 'doc-1',
        compliance_summary: 'Summary A',
        expert_commentary: null,
        content_status: 'AI_GENERATED',
        template: { id: 'tmpl-1', name: 'Arbetsmiljö', slug: 'arbetsmiljo' },
        document: {
          id: 'doc-1',
          title: 'AFS 2001:1',
          document_number: 'AFS 2001:1',
        },
      },
      {
        id: 'item-2',
        document_id: 'doc-1',
        compliance_summary: 'Summary A',
        expert_commentary: null,
        content_status: 'AI_GENERATED',
        template: { id: 'tmpl-2', name: 'Miljö', slug: 'miljo' },
        document: {
          id: 'doc-1',
          title: 'AFS 2001:1',
          document_number: 'AFS 2001:1',
        },
      },
    ] as never)

    const result = await getTemplateOverlap()

    expect(result).toHaveLength(1)
    expect(result[0].documentId).toBe('doc-1')
    expect(result[0].templateCount).toBe(2)
    expect(result[0].entries).toHaveLength(2)
  })

  it('excludes documents that appear in only 1 template', async () => {
    // groupBy only returns docs with 2+ templates (due to having clause)
    mockPrisma.templateItem.groupBy.mockResolvedValue([
      { document_id: 'doc-1', _count: { template_id: 2 } },
    ] as never)

    mockPrisma.templateItem.findMany.mockResolvedValue([
      {
        id: 'item-1',
        document_id: 'doc-1',
        compliance_summary: 'Summary',
        expert_commentary: null,
        content_status: 'STUB',
        template: { id: 'tmpl-1', name: 'Template A', slug: 'a' },
        document: { id: 'doc-1', title: 'Doc 1', document_number: null },
      },
      {
        id: 'item-2',
        document_id: 'doc-1',
        compliance_summary: 'Summary',
        expert_commentary: null,
        content_status: 'STUB',
        template: { id: 'tmpl-2', name: 'Template B', slug: 'b' },
        document: { id: 'doc-1', title: 'Doc 1', document_number: null },
      },
    ] as never)

    const result = await getTemplateOverlap()

    // Only doc-1 appears (in 2 templates), single-template docs excluded by groupBy
    expect(result).toHaveLength(1)
    expect(result[0].documentId).toBe('doc-1')
  })

  it('sets isInconsistent to true when summaries differ', async () => {
    mockPrisma.templateItem.groupBy.mockResolvedValue([
      { document_id: 'doc-1', _count: { template_id: 2 } },
    ] as never)

    mockPrisma.templateItem.findMany.mockResolvedValue([
      {
        id: 'item-1',
        document_id: 'doc-1',
        compliance_summary: 'Summary version A',
        expert_commentary: null,
        content_status: 'AI_GENERATED',
        template: { id: 'tmpl-1', name: 'Template A', slug: 'a' },
        document: { id: 'doc-1', title: 'Doc 1', document_number: null },
      },
      {
        id: 'item-2',
        document_id: 'doc-1',
        compliance_summary: 'Summary version B',
        expert_commentary: null,
        content_status: 'AI_GENERATED',
        template: { id: 'tmpl-2', name: 'Template B', slug: 'b' },
        document: { id: 'doc-1', title: 'Doc 1', document_number: null },
      },
    ] as never)

    const result = await getTemplateOverlap()

    expect(result[0].isInconsistent).toBe(true)
  })

  it('sets isInconsistent to false when summaries are identical', async () => {
    mockPrisma.templateItem.groupBy.mockResolvedValue([
      { document_id: 'doc-1', _count: { template_id: 2 } },
    ] as never)

    mockPrisma.templateItem.findMany.mockResolvedValue([
      {
        id: 'item-1',
        document_id: 'doc-1',
        compliance_summary: 'Same summary',
        expert_commentary: null,
        content_status: 'AI_GENERATED',
        template: { id: 'tmpl-1', name: 'Template A', slug: 'a' },
        document: { id: 'doc-1', title: 'Doc 1', document_number: null },
      },
      {
        id: 'item-2',
        document_id: 'doc-1',
        compliance_summary: 'Same summary',
        expert_commentary: null,
        content_status: 'AI_GENERATED',
        template: { id: 'tmpl-2', name: 'Template B', slug: 'b' },
        document: { id: 'doc-1', title: 'Doc 1', document_number: null },
      },
    ] as never)

    const result = await getTemplateOverlap()

    expect(result[0].isInconsistent).toBe(false)
  })

  it('treats null vs non-null summary as inconsistent', async () => {
    mockPrisma.templateItem.groupBy.mockResolvedValue([
      { document_id: 'doc-1', _count: { template_id: 2 } },
    ] as never)

    mockPrisma.templateItem.findMany.mockResolvedValue([
      {
        id: 'item-1',
        document_id: 'doc-1',
        compliance_summary: null,
        expert_commentary: null,
        content_status: 'STUB',
        template: { id: 'tmpl-1', name: 'Template A', slug: 'a' },
        document: { id: 'doc-1', title: 'Doc 1', document_number: null },
      },
      {
        id: 'item-2',
        document_id: 'doc-1',
        compliance_summary: 'Has a summary',
        expert_commentary: null,
        content_status: 'AI_GENERATED',
        template: { id: 'tmpl-2', name: 'Template B', slug: 'b' },
        document: { id: 'doc-1', title: 'Doc 1', document_number: null },
      },
    ] as never)

    const result = await getTemplateOverlap()

    expect(result[0].isInconsistent).toBe(true)
  })

  it('sorts by templateCount desc then documentTitle asc', async () => {
    mockPrisma.templateItem.groupBy.mockResolvedValue([
      { document_id: 'doc-a', _count: { template_id: 2 } },
      { document_id: 'doc-b', _count: { template_id: 3 } },
    ] as never)

    mockPrisma.templateItem.findMany.mockResolvedValue([
      {
        id: 'item-1',
        document_id: 'doc-a',
        compliance_summary: 'S',
        expert_commentary: null,
        content_status: 'STUB',
        template: { id: 'tmpl-1', name: 'T1', slug: 't1' },
        document: { id: 'doc-a', title: 'Zebra Law', document_number: null },
      },
      {
        id: 'item-2',
        document_id: 'doc-a',
        compliance_summary: 'S',
        expert_commentary: null,
        content_status: 'STUB',
        template: { id: 'tmpl-2', name: 'T2', slug: 't2' },
        document: { id: 'doc-a', title: 'Zebra Law', document_number: null },
      },
      {
        id: 'item-3',
        document_id: 'doc-b',
        compliance_summary: 'S',
        expert_commentary: null,
        content_status: 'STUB',
        template: { id: 'tmpl-1', name: 'T1', slug: 't1' },
        document: { id: 'doc-b', title: 'Alpha Law', document_number: null },
      },
      {
        id: 'item-4',
        document_id: 'doc-b',
        compliance_summary: 'S',
        expert_commentary: null,
        content_status: 'STUB',
        template: { id: 'tmpl-2', name: 'T2', slug: 't2' },
        document: { id: 'doc-b', title: 'Alpha Law', document_number: null },
      },
      {
        id: 'item-5',
        document_id: 'doc-b',
        compliance_summary: 'S',
        expert_commentary: null,
        content_status: 'STUB',
        template: { id: 'tmpl-3', name: 'T3', slug: 't3' },
        document: { id: 'doc-b', title: 'Alpha Law', document_number: null },
      },
    ] as never)

    const result = await getTemplateOverlap()

    expect(result[0].documentTitle).toBe('Alpha Law') // 3 templates, comes first
    expect(result[0].templateCount).toBe(3)
    expect(result[1].documentTitle).toBe('Zebra Law') // 2 templates
    expect(result[1].templateCount).toBe(2)
  })
})
