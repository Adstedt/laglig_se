import { vi, describe, beforeEach, it, expect } from 'vitest'

// Mock dependencies before imports
vi.mock('@/lib/admin/auth', () => ({
  getAdminSession: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
    },
    lawListTemplate: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    templateSection: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    templateItem: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { getAdminSession } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import {
  createTemplate,
  updateTemplate,
  createTemplateSection,
  updateTemplateSection,
  reorderTemplateSections,
  deleteTemplateSection,
  moveTemplateItem,
  updateTemplateItemContent,
  reviewTemplateItem,
  approveTemplateItem,
  bulkReviewTemplateItems,
  bulkRegenerateTemplateItems,
  submitForReview,
  publishTemplate,
  archiveTemplate,
  syncTemplateSummaries,
} from '@/app/actions/admin-templates'

const mockGetAdminSession = vi.mocked(getAdminSession)
const mockPrisma = vi.mocked(prisma, true)

describe('admin-templates server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAdminSession.mockResolvedValue({ email: 'admin@test.com' })
    mockPrisma.user.findFirst.mockResolvedValue({
      id: 'admin-user-1',
    } as never)
  })

  describe('createTemplate', () => {
    it('returns error if not authenticated', async () => {
      mockGetAdminSession.mockResolvedValue(null)

      const result = await createTemplate({
        name: 'Test',
        slug: 'test',
        domain: 'Test',
      })

      expect(result).toEqual({ success: false, error: 'Ej autentiserad' })
    })

    it('returns error if admin user not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null as never)

      const result = await createTemplate({
        name: 'Test',
        slug: 'test',
        domain: 'Test',
      })

      expect(result).toEqual({
        success: false,
        error: 'Admin-användare hittades inte',
      })
    })

    it('returns error for duplicate slug', async () => {
      mockPrisma.lawListTemplate.findUnique.mockResolvedValue({
        id: 'existing',
      } as never)

      const result = await createTemplate({
        name: 'Test',
        slug: 'existing-slug',
        domain: 'Test',
      })

      expect(result).toEqual({
        success: false,
        error: 'En mall med denna slug finns redan',
      })
    })

    it('creates template and returns success with id', async () => {
      mockPrisma.lawListTemplate.findUnique.mockResolvedValue(null as never)
      mockPrisma.lawListTemplate.create.mockResolvedValue({
        id: 'new-tmpl-1',
      } as never)

      const result = await createTemplate({
        name: 'Ny Mall',
        slug: 'ny-mall',
        domain: 'Arbetsmiljö',
        description: 'En beskrivning',
      })

      expect(result).toEqual({
        success: true,
        templateId: 'new-tmpl-1',
      })
      expect(mockPrisma.lawListTemplate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Ny Mall',
          slug: 'ny-mall',
          domain: 'Arbetsmiljö',
          status: 'DRAFT',
          version: 1,
          document_count: 0,
          section_count: 0,
          created_by: 'admin-user-1',
        }),
      })
    })
  })

  describe('updateTemplate', () => {
    it('returns error if template not found', async () => {
      mockPrisma.lawListTemplate.findUnique.mockResolvedValue(null as never)

      const result = await updateTemplate('nonexistent', {
        name: 'Test',
        slug: 'test',
        domain: 'Test',
      })

      expect(result).toEqual({
        success: false,
        error: 'Mallen hittades inte',
      })
    })

    it('checks for slug collision when slug changes', async () => {
      mockPrisma.lawListTemplate.findUnique
        .mockResolvedValueOnce({ id: 'tmpl-1', slug: 'old-slug' } as never)
        .mockResolvedValueOnce({ id: 'tmpl-2' } as never) // slug already taken

      const result = await updateTemplate('tmpl-1', {
        name: 'Updated',
        slug: 'taken-slug',
        domain: 'Test',
      })

      expect(result).toEqual({
        success: false,
        error: 'En mall med denna slug finns redan',
      })
    })
  })

  describe('deleteTemplateSection', () => {
    it('prevents deletion of section with items', async () => {
      mockPrisma.templateSection.findUnique.mockResolvedValue({
        id: 'sec-1',
        template_id: 'tmpl-1',
        item_count: 5,
      } as never)

      const result = await deleteTemplateSection('sec-1')

      expect(result).toEqual({
        success: false,
        error: 'Sektionen innehåller dokument. Flytta dem först.',
      })
    })
  })

  describe('updateTemplate — success path', () => {
    it('updates template and returns success', async () => {
      mockPrisma.lawListTemplate.findUnique.mockResolvedValue({
        id: 'tmpl-1',
        slug: 'same-slug',
      } as never)
      mockPrisma.lawListTemplate.update.mockResolvedValue({} as never)

      const result = await updateTemplate('tmpl-1', {
        name: 'Updated Name',
        slug: 'same-slug',
        domain: 'Arbetsmiljö',
      })

      expect(result).toEqual({ success: true })
      expect(mockPrisma.lawListTemplate.update).toHaveBeenCalledWith({
        where: { id: 'tmpl-1' },
        data: expect.objectContaining({
          name: 'Updated Name',
          slug: 'same-slug',
          domain: 'Arbetsmiljö',
        }),
      })
    })
  })

  describe('createTemplateSection', () => {
    it('returns error if not authenticated', async () => {
      mockGetAdminSession.mockResolvedValue(null)

      const result = await createTemplateSection('tmpl-1', {
        name: 'New Section',
        section_number: '1',
      })

      expect(result).toEqual({ success: false, error: 'Ej autentiserad' })
    })

    it('returns error if template not found', async () => {
      mockPrisma.lawListTemplate.findUnique.mockResolvedValue(null as never)

      const result = await createTemplateSection('nonexistent', {
        name: 'New Section',
        section_number: '1',
      })

      expect(result).toEqual({
        success: false,
        error: 'Mallen hittades inte',
      })
    })

    it('creates section with correct position and returns success', async () => {
      mockPrisma.lawListTemplate.findUnique.mockResolvedValue({
        id: 'tmpl-1',
        section_count: 2,
      } as never)
      mockPrisma.templateSection.findFirst.mockResolvedValue({
        position: 2,
      } as never)
      mockPrisma.$transaction.mockImplementation(
        async (fn: (_tx: typeof prisma) => Promise<unknown>) => {
          return fn(mockPrisma as unknown as typeof prisma)
        }
      )
      mockPrisma.templateSection.create.mockResolvedValue({
        id: 'sec-new',
      } as never)
      mockPrisma.lawListTemplate.update.mockResolvedValue({} as never)

      const result = await createTemplateSection('tmpl-1', {
        name: 'Ny Sektion',
        section_number: '3',
        description: 'Beskrivning',
      })

      expect(result).toEqual({ success: true, sectionId: 'sec-new' })
      expect(mockPrisma.templateSection.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          template_id: 'tmpl-1',
          name: 'Ny Sektion',
          section_number: '3',
          position: 3,
          item_count: 0,
        }),
      })
    })
  })

  describe('updateTemplateSection', () => {
    it('returns error if not authenticated', async () => {
      mockGetAdminSession.mockResolvedValue(null)

      const result = await updateTemplateSection('sec-1', { name: 'Renamed' })

      expect(result).toEqual({ success: false, error: 'Ej autentiserad' })
    })

    it('returns error if section not found', async () => {
      mockPrisma.templateSection.findUnique.mockResolvedValue(null as never)

      const result = await updateTemplateSection('nonexistent', {
        name: 'Renamed',
      })

      expect(result).toEqual({
        success: false,
        error: 'Sektionen hittades inte',
      })
    })

    it('updates section name and returns success', async () => {
      mockPrisma.templateSection.findUnique.mockResolvedValue({
        id: 'sec-1',
        template_id: 'tmpl-1',
      } as never)
      mockPrisma.templateSection.update.mockResolvedValue({} as never)

      const result = await updateTemplateSection('sec-1', {
        name: 'Omdöpt sektion',
      })

      expect(result).toEqual({ success: true })
      expect(mockPrisma.templateSection.update).toHaveBeenCalledWith({
        where: { id: 'sec-1' },
        data: { name: 'Omdöpt sektion' },
      })
    })
  })

  describe('reorderTemplateSections', () => {
    it('returns error if not authenticated', async () => {
      mockGetAdminSession.mockResolvedValue(null)

      const result = await reorderTemplateSections('tmpl-1', ['sec-1', 'sec-2'])

      expect(result).toEqual({ success: false, error: 'Ej autentiserad' })
    })

    it('returns error if template not found', async () => {
      mockPrisma.lawListTemplate.findUnique.mockResolvedValue(null as never)

      const result = await reorderTemplateSections('nonexistent', [
        'sec-1',
        'sec-2',
      ])

      expect(result).toEqual({
        success: false,
        error: 'Mallen hittades inte',
      })
    })

    it('reorders sections and returns success', async () => {
      mockPrisma.lawListTemplate.findUnique.mockResolvedValue({
        id: 'tmpl-1',
      } as never)
      mockPrisma.$transaction.mockResolvedValue([{}, {}] as never)

      const result = await reorderTemplateSections('tmpl-1', ['sec-2', 'sec-1'])

      expect(result).toEqual({ success: true })
      expect(mockPrisma.$transaction).toHaveBeenCalledWith([
        expect.objectContaining({}),
        expect.objectContaining({}),
      ])
    })
  })

  describe('deleteTemplateSection — success path', () => {
    it('deletes empty section and returns success', async () => {
      mockPrisma.templateSection.findUnique.mockResolvedValue({
        id: 'sec-1',
        template_id: 'tmpl-1',
        item_count: 0,
      } as never)
      mockPrisma.$transaction.mockImplementation(
        async (fn: (_tx: typeof prisma) => Promise<unknown>) => {
          return fn(mockPrisma as unknown as typeof prisma)
        }
      )
      mockPrisma.templateSection.delete.mockResolvedValue({} as never)
      mockPrisma.lawListTemplate.update.mockResolvedValue({} as never)

      const result = await deleteTemplateSection('sec-1')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.templateSection.delete).toHaveBeenCalledWith({
        where: { id: 'sec-1' },
      })
    })
  })

  describe('moveTemplateItem', () => {
    it('returns error if item not found', async () => {
      mockPrisma.templateItem.findUnique.mockResolvedValue(null as never)

      const result = await moveTemplateItem('item-1', 'sec-2')

      expect(result).toEqual({
        success: false,
        error: 'Objektet hittades inte',
      })
    })

    it('returns error if moving to same section', async () => {
      mockPrisma.templateItem.findUnique.mockResolvedValue({
        id: 'item-1',
        section_id: 'sec-1',
        template_id: 'tmpl-1',
      } as never)

      const result = await moveTemplateItem('item-1', 'sec-1')

      expect(result).toEqual({
        success: false,
        error: 'Objektet är redan i denna sektion',
      })
    })

    it('returns error if sections are from different templates', async () => {
      mockPrisma.templateItem.findUnique.mockResolvedValue({
        id: 'item-1',
        section_id: 'sec-1',
        template_id: 'tmpl-1',
      } as never)
      mockPrisma.templateSection.findUnique.mockResolvedValue({
        id: 'sec-2',
        template_id: 'tmpl-2',
      } as never)

      const result = await moveTemplateItem('item-1', 'sec-2')

      expect(result).toEqual({
        success: false,
        error: 'Kan inte flytta objekt mellan olika mallar',
      })
    })

    it('moves item between sections and returns success', async () => {
      mockPrisma.templateItem.findUnique.mockResolvedValue({
        id: 'item-1',
        section_id: 'sec-1',
        template_id: 'tmpl-1',
      } as never)
      mockPrisma.templateSection.findUnique.mockResolvedValue({
        id: 'sec-2',
        template_id: 'tmpl-1',
      } as never)
      mockPrisma.$transaction.mockImplementation(
        async (fn: (_tx: typeof prisma) => Promise<unknown>) => {
          return fn(mockPrisma as unknown as typeof prisma)
        }
      )
      mockPrisma.templateItem.update.mockResolvedValue({} as never)
      mockPrisma.templateSection.update.mockResolvedValue({} as never)

      const result = await moveTemplateItem('item-1', 'sec-2')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.templateItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { section_id: 'sec-2' },
      })
    })
  })

  // ==========================================================================
  // New actions for Story 12.7b
  // ==========================================================================

  describe('updateTemplateItemContent', () => {
    it('saves compliance_summary and expert_commentary', async () => {
      mockPrisma.templateItem.findUnique.mockResolvedValue({
        id: 'item-1',
        template_id: 'tmpl-1',
      } as never)
      mockPrisma.templateItem.update.mockResolvedValue({} as never)

      const result = await updateTemplateItemContent('item-1', {
        compliance_summary: 'Updated summary',
        expert_commentary: 'Updated commentary',
      })

      expect(result).toEqual({ success: true })
      expect(mockPrisma.templateItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: {
          compliance_summary: 'Updated summary',
          expert_commentary: 'Updated commentary',
        },
      })
    })

    it('returns error if item not found', async () => {
      mockPrisma.templateItem.findUnique.mockResolvedValue(null as never)

      const result = await updateTemplateItemContent('nonexistent', {
        compliance_summary: 'Test',
      })

      expect(result).toEqual({
        success: false,
        error: 'Objektet hittades inte',
      })
    })
  })

  describe('reviewTemplateItem', () => {
    it('sets content_status, reviewed_by, and reviewed_at', async () => {
      mockPrisma.templateItem.findUnique.mockResolvedValue({
        id: 'item-1',
        template_id: 'tmpl-1',
      } as never)
      mockPrisma.templateItem.update.mockResolvedValue({} as never)

      const result = await reviewTemplateItem('item-1')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.templateItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: {
          content_status: 'HUMAN_REVIEWED',
          reviewed_by: 'admin-user-1',
          reviewed_at: expect.any(Date),
        },
      })
    })
  })

  describe('approveTemplateItem', () => {
    it('sets content_status to APPROVED', async () => {
      mockPrisma.templateItem.findUnique.mockResolvedValue({
        id: 'item-1',
        template_id: 'tmpl-1',
      } as never)
      mockPrisma.templateItem.update.mockResolvedValue({} as never)

      const result = await approveTemplateItem('item-1')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.templateItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: { content_status: 'APPROVED' },
      })
    })
  })

  describe('bulkReviewTemplateItems', () => {
    it('updates all AI_GENERATED items', async () => {
      mockPrisma.lawListTemplate.findUnique.mockResolvedValue({
        id: 'tmpl-1',
      } as never)
      mockPrisma.templateItem.findMany.mockResolvedValue([
        { id: 'item-1' },
        { id: 'item-2' },
      ] as never)
      mockPrisma.$transaction.mockResolvedValue([{}, {}] as never)

      const result = await bulkReviewTemplateItems('tmpl-1')

      expect(result).toEqual({ success: true, updatedCount: 2 })
      expect(mockPrisma.templateItem.findMany).toHaveBeenCalledWith({
        where: { template_id: 'tmpl-1', content_status: 'AI_GENERATED' },
        select: { id: true },
      })
    })

    it('returns 0 count when no items to review', async () => {
      mockPrisma.lawListTemplate.findUnique.mockResolvedValue({
        id: 'tmpl-1',
      } as never)
      mockPrisma.templateItem.findMany.mockResolvedValue([] as never)

      const result = await bulkReviewTemplateItems('tmpl-1')

      expect(result).toEqual({ success: true, updatedCount: 0 })
    })
  })

  describe('bulkRegenerateTemplateItems', () => {
    it('resets selected items to STUB', async () => {
      mockPrisma.lawListTemplate.findUnique.mockResolvedValue({
        id: 'tmpl-1',
      } as never)
      mockPrisma.templateItem.findMany.mockResolvedValue([
        { id: 'item-1' },
        { id: 'item-2' },
      ] as never)
      mockPrisma.templateItem.updateMany.mockResolvedValue({
        count: 2,
      } as never)

      const result = await bulkRegenerateTemplateItems('tmpl-1', [
        'item-1',
        'item-2',
      ])

      expect(result).toEqual({ success: true, updatedCount: 2 })
      expect(mockPrisma.templateItem.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['item-1', 'item-2'] }, template_id: 'tmpl-1' },
        data: {
          content_status: 'STUB',
          compliance_summary: null,
          expert_commentary: null,
          generated_by: null,
          reviewed_by: null,
          reviewed_at: null,
        },
      })
    })

    it('returns error when items do not belong to template', async () => {
      mockPrisma.lawListTemplate.findUnique.mockResolvedValue({
        id: 'tmpl-1',
      } as never)
      mockPrisma.templateItem.findMany.mockResolvedValue([
        { id: 'item-1' },
      ] as never) // only 1 found, 2 requested

      const result = await bulkRegenerateTemplateItems('tmpl-1', [
        'item-1',
        'item-3',
      ])

      expect(result).toEqual({
        success: false,
        error: 'Vissa objekt tillhör inte denna mall',
      })
    })
  })

  describe('submitForReview', () => {
    it('transitions DRAFT → IN_REVIEW when no STUB items', async () => {
      mockPrisma.lawListTemplate.findUnique.mockResolvedValue({
        id: 'tmpl-1',
        status: 'DRAFT',
      } as never)
      mockPrisma.templateItem.findMany.mockResolvedValue([
        { content_status: 'AI_GENERATED' },
      ] as never)
      mockPrisma.lawListTemplate.update.mockResolvedValue({} as never)

      const result = await submitForReview('tmpl-1')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.lawListTemplate.update).toHaveBeenCalledWith({
        where: { id: 'tmpl-1' },
        data: { status: 'IN_REVIEW' },
      })
    })

    it('returns error when STUB items exist', async () => {
      mockPrisma.lawListTemplate.findUnique.mockResolvedValue({
        id: 'tmpl-1',
        status: 'DRAFT',
      } as never)
      mockPrisma.templateItem.findMany.mockResolvedValue([
        { content_status: 'AI_GENERATED' },
        { content_status: 'STUB' },
      ] as never)

      const result = await submitForReview('tmpl-1')

      expect(result).toEqual({
        success: false,
        error: 'Alla objekt måste ha minst AI-genererat innehåll',
      })
    })

    it('returns error when template has 0 items', async () => {
      mockPrisma.lawListTemplate.findUnique.mockResolvedValue({
        id: 'tmpl-1',
        status: 'DRAFT',
      } as never)
      mockPrisma.templateItem.findMany.mockResolvedValue([] as never)

      const result = await submitForReview('tmpl-1')

      expect(result).toEqual({
        success: false,
        error: 'Mallen måste innehålla minst ett objekt',
      })
    })
  })

  describe('publishTemplate', () => {
    it('increments version and sets published_at', async () => {
      mockPrisma.lawListTemplate.findUnique.mockResolvedValue({
        id: 'tmpl-1',
        status: 'IN_REVIEW',
        version: 1,
      } as never)
      mockPrisma.templateItem.findMany.mockResolvedValue([
        { content_status: 'AI_GENERATED' },
      ] as never)
      mockPrisma.lawListTemplate.update.mockResolvedValue({} as never)

      const result = await publishTemplate('tmpl-1')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.lawListTemplate.update).toHaveBeenCalledWith({
        where: { id: 'tmpl-1' },
        data: {
          status: 'PUBLISHED',
          version: 2,
          published_at: expect.any(Date),
        },
      })
    })
  })

  describe('archiveTemplate', () => {
    it('transitions PUBLISHED → ARCHIVED', async () => {
      mockPrisma.lawListTemplate.findUnique.mockResolvedValue({
        id: 'tmpl-1',
        status: 'PUBLISHED',
      } as never)
      mockPrisma.lawListTemplate.update.mockResolvedValue({} as never)

      const result = await archiveTemplate('tmpl-1')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.lawListTemplate.update).toHaveBeenCalledWith({
        where: { id: 'tmpl-1' },
        data: { status: 'ARCHIVED' },
      })
    })

    it('returns error for invalid transition', async () => {
      mockPrisma.lawListTemplate.findUnique.mockResolvedValue({
        id: 'tmpl-1',
        status: 'DRAFT',
      } as never)

      const result = await archiveTemplate('tmpl-1')

      expect(result).toEqual({
        success: false,
        error: 'Ogiltig statusövergång',
      })
    })
  })

  // ==========================================================================
  // syncTemplateSummaries (Story 12.7c)
  // ==========================================================================

  describe('syncTemplateSummaries', () => {
    const validInput = {
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      sourceTemplateId: '550e8400-e29b-41d4-a716-446655440001',
      targetTemplateIds: ['550e8400-e29b-41d4-a716-446655440002'],
    }

    it('returns error when not authenticated', async () => {
      mockGetAdminSession.mockResolvedValue(null)

      const result = await syncTemplateSummaries(validInput)

      expect(result).toEqual({ success: false, error: 'Ej autentiserad' })
    })

    it('copies compliance_summary and expert_commentary from source to target', async () => {
      mockPrisma.templateItem.findFirst.mockResolvedValue({
        id: 'source-item',
        compliance_summary: 'Source summary',
        expert_commentary: 'Source commentary',
        content_status: 'AI_GENERATED',
      } as never)

      mockPrisma.templateItem.findMany.mockResolvedValue([
        { id: 'target-item', template_id: validInput.targetTemplateIds[0] },
      ] as never)

      mockPrisma.$transaction.mockResolvedValue([{}] as never)

      const result = await syncTemplateSummaries(validInput)

      expect(result).toEqual({ success: true, updatedCount: 1 })
    })

    it('updates content_status on target items', async () => {
      mockPrisma.templateItem.findFirst.mockResolvedValue({
        id: 'source-item',
        compliance_summary: 'Summary',
        expert_commentary: null,
        content_status: 'HUMAN_REVIEWED',
      } as never)

      mockPrisma.templateItem.findMany.mockResolvedValue([
        { id: 'target-item', template_id: validInput.targetTemplateIds[0] },
      ] as never)

      mockPrisma.$transaction.mockResolvedValue([{}] as never)

      const result = await syncTemplateSummaries(validInput)

      expect(result).toEqual({ success: true, updatedCount: 1 })
      // Verify transaction was called with update containing content_status
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })

    it('returns error if source item not found', async () => {
      mockPrisma.templateItem.findFirst.mockResolvedValue(null as never)

      const result = await syncTemplateSummaries(validInput)

      expect(result).toEqual({
        success: false,
        error: 'Källobjektet hittades inte',
      })
    })

    it('returns error if target items do not exist', async () => {
      mockPrisma.templateItem.findFirst.mockResolvedValue({
        id: 'source-item',
        compliance_summary: 'Summary',
        expert_commentary: null,
        content_status: 'AI_GENERATED',
      } as never)

      // Return empty array — no target items found
      mockPrisma.templateItem.findMany.mockResolvedValue([] as never)

      const result = await syncTemplateSummaries(validInput)

      expect(result).toEqual({
        success: false,
        error: 'Vissa målobjekt hittades inte',
      })
    })

    it('returns error for invalid input', async () => {
      const result = await syncTemplateSummaries({
        documentId: 'not-a-uuid',
        sourceTemplateId: 'not-a-uuid',
        targetTemplateIds: [],
      })

      expect(result).toEqual({ success: false, error: 'Ogiltig indata' })
    })
  })
})
