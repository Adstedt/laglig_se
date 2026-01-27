/**
 * Story 4.11: Unit Tests for Document List Validation Schemas
 */

import { describe, it, expect } from 'vitest'
import {
  CreateDocumentListSchema,
  UpdateDocumentListSchema,
  DeleteDocumentListSchema,
  AddDocumentToListSchema,
  RemoveDocumentFromListSchema,
  UpdateListItemSchema,
  ReorderListItemsSchema,
  SearchDocumentsSchema,
  GetDocumentListsSchema,
  GetDocumentListItemsSchema,
  ExportDocumentListSchema,
  ContentTypeEnum,
  LawListItemStatusEnum,
  LawListItemPriorityEnum,
  LawListItemSourceEnum,
} from '@/lib/validation/document-list'

describe('Document List Validation Schemas', () => {
  const validUUID = '550e8400-e29b-41d4-a716-446655440000'

  describe('CreateDocumentListSchema', () => {
    it('validates valid input', () => {
      const result = CreateDocumentListSchema.safeParse({
        name: 'Test Lista',
        description: 'Test beskrivning',
        isDefault: true,
      })
      expect(result.success).toBe(true)
    })

    it('accepts optional workspaceId', () => {
      const result = CreateDocumentListSchema.safeParse({
        workspaceId: validUUID,
        name: 'Test',
      })
      expect(result.success).toBe(true)
    })

    it('accepts empty workspaceId (ignored by server)', () => {
      const result = CreateDocumentListSchema.safeParse({
        workspaceId: '',
        name: 'Test',
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty name', () => {
      const result = CreateDocumentListSchema.safeParse({
        name: '',
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe('Namn krävs')
      }
    })

    it('rejects name over 100 characters', () => {
      const result = CreateDocumentListSchema.safeParse({
        name: 'a'.repeat(101),
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('max 100')
      }
    })

    it('rejects description over 500 characters', () => {
      const result = CreateDocumentListSchema.safeParse({
        name: 'Test',
        description: 'a'.repeat(501),
      })
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('max 500')
      }
    })
  })

  describe('UpdateDocumentListSchema', () => {
    it('validates valid input', () => {
      const result = UpdateDocumentListSchema.safeParse({
        listId: validUUID,
        name: 'Updated Name',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid listId', () => {
      const result = UpdateDocumentListSchema.safeParse({
        listId: 'invalid-uuid',
        name: 'Test',
      })
      expect(result.success).toBe(false)
    })

    it('allows partial updates', () => {
      const result = UpdateDocumentListSchema.safeParse({
        listId: validUUID,
        isDefault: true,
      })
      expect(result.success).toBe(true)
    })

    it('allows null description', () => {
      const result = UpdateDocumentListSchema.safeParse({
        listId: validUUID,
        description: null,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('DeleteDocumentListSchema', () => {
    it('validates valid UUID', () => {
      const result = DeleteDocumentListSchema.safeParse({
        listId: validUUID,
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid UUID', () => {
      const result = DeleteDocumentListSchema.safeParse({
        listId: 'not-a-uuid',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('AddDocumentToListSchema', () => {
    it('validates valid input', () => {
      const result = AddDocumentToListSchema.safeParse({
        listId: validUUID,
        documentId: validUUID,
      })
      expect(result.success).toBe(true)
    })

    it('validates with optional fields', () => {
      const result = AddDocumentToListSchema.safeParse({
        listId: validUUID,
        documentId: validUUID,
        commentary: 'Test kommentar',
        source: 'MANUAL',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid source', () => {
      const result = AddDocumentToListSchema.safeParse({
        listId: validUUID,
        documentId: validUUID,
        source: 'INVALID',
      })
      expect(result.success).toBe(false)
    })

    it('rejects commentary over 1000 characters', () => {
      const result = AddDocumentToListSchema.safeParse({
        listId: validUUID,
        documentId: validUUID,
        commentary: 'a'.repeat(1001),
      })
      expect(result.success).toBe(false)
    })
  })

  describe('RemoveDocumentFromListSchema', () => {
    it('validates valid UUID', () => {
      const result = RemoveDocumentFromListSchema.safeParse({
        listItemId: validUUID,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('UpdateListItemSchema', () => {
    it('validates valid input', () => {
      const result = UpdateListItemSchema.safeParse({
        listItemId: validUUID,
        status: 'IN_PROGRESS',
        priority: 'HIGH',
      })
      expect(result.success).toBe(true)
    })

    it('validates all status values', () => {
      const statuses = [
        'NOT_STARTED',
        'IN_PROGRESS',
        'BLOCKED',
        'REVIEW',
        'COMPLIANT',
      ]
      statuses.forEach((status) => {
        const result = UpdateListItemSchema.safeParse({
          listItemId: validUUID,
          status,
        })
        expect(result.success).toBe(true)
      })
    })

    it('validates all priority values', () => {
      const priorities = ['LOW', 'MEDIUM', 'HIGH']
      priorities.forEach((priority) => {
        const result = UpdateListItemSchema.safeParse({
          listItemId: validUUID,
          priority,
        })
        expect(result.success).toBe(true)
      })
    })

    it('allows null notes', () => {
      const result = UpdateListItemSchema.safeParse({
        listItemId: validUUID,
        notes: null,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('ReorderListItemsSchema', () => {
    it('validates valid input', () => {
      const result = ReorderListItemsSchema.safeParse({
        listId: validUUID,
        items: [
          { id: validUUID, position: 0 },
          { id: validUUID, position: 1 },
        ],
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty items array', () => {
      const result = ReorderListItemsSchema.safeParse({
        listId: validUUID,
        items: [],
      })
      expect(result.success).toBe(false)
    })

    it('rejects negative position', () => {
      const result = ReorderListItemsSchema.safeParse({
        listId: validUUID,
        items: [{ id: validUUID, position: -1 }],
      })
      expect(result.success).toBe(false)
    })
  })

  describe('SearchDocumentsSchema', () => {
    it('validates valid input', () => {
      const result = SearchDocumentsSchema.safeParse({
        query: 'arbetsmiljö',
      })
      expect(result.success).toBe(true)
    })

    it('validates with content types', () => {
      const result = SearchDocumentsSchema.safeParse({
        query: 'test',
        contentTypes: ['SFS_LAW', 'COURT_CASE_HD'],
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty query', () => {
      const result = SearchDocumentsSchema.safeParse({
        query: '',
      })
      expect(result.success).toBe(false)
    })

    it('rejects query over 200 characters', () => {
      const result = SearchDocumentsSchema.safeParse({
        query: 'a'.repeat(201),
      })
      expect(result.success).toBe(false)
    })

    it('rejects invalid content type', () => {
      const result = SearchDocumentsSchema.safeParse({
        query: 'test',
        contentTypes: ['INVALID_TYPE'],
      })
      expect(result.success).toBe(false)
    })

    it('applies default limit', () => {
      const result = SearchDocumentsSchema.safeParse({
        query: 'test',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(20)
      }
    })

    it('applies default offset', () => {
      const result = SearchDocumentsSchema.safeParse({
        query: 'test',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.offset).toBe(0)
      }
    })
  })

  describe('GetDocumentListsSchema', () => {
    it('validates valid UUID', () => {
      const result = GetDocumentListsSchema.safeParse({
        workspaceId: validUUID,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('GetDocumentListItemsSchema', () => {
    it('validates valid input', () => {
      const result = GetDocumentListItemsSchema.safeParse({
        listId: validUUID,
      })
      expect(result.success).toBe(true)
    })

    it('validates with content type filter', () => {
      const result = GetDocumentListItemsSchema.safeParse({
        listId: validUUID,
        contentTypeFilter: ['SFS_LAW', 'EU_DIRECTIVE'],
      })
      expect(result.success).toBe(true)
    })

    it('applies default page and limit', () => {
      const result = GetDocumentListItemsSchema.safeParse({
        listId: validUUID,
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.page).toBe(1)
        expect(result.data.limit).toBe(50)
      }
    })
  })

  describe('ExportDocumentListSchema', () => {
    it('validates CSV format', () => {
      const result = ExportDocumentListSchema.safeParse({
        listId: validUUID,
        format: 'csv',
      })
      expect(result.success).toBe(true)
    })

    it('validates PDF format', () => {
      const result = ExportDocumentListSchema.safeParse({
        listId: validUUID,
        format: 'pdf',
      })
      expect(result.success).toBe(true)
    })

    it('rejects invalid format', () => {
      const result = ExportDocumentListSchema.safeParse({
        listId: validUUID,
        format: 'xlsx',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('Enum Schemas', () => {
    describe('ContentTypeEnum', () => {
      it('validates all content types', () => {
        const types = [
          'SFS_LAW',
          'SFS_AMENDMENT',
          'COURT_CASE_AD',
          'COURT_CASE_HD',
          'COURT_CASE_HOVR',
          'COURT_CASE_HFD',
          'COURT_CASE_MOD',
          'COURT_CASE_MIG',
          'EU_REGULATION',
          'EU_DIRECTIVE',
        ]
        types.forEach((type) => {
          expect(ContentTypeEnum.safeParse(type).success).toBe(true)
        })
      })
    })

    describe('LawListItemStatusEnum', () => {
      it('validates all statuses', () => {
        const statuses = [
          'NOT_STARTED',
          'IN_PROGRESS',
          'BLOCKED',
          'REVIEW',
          'COMPLIANT',
        ]
        statuses.forEach((status) => {
          expect(LawListItemStatusEnum.safeParse(status).success).toBe(true)
        })
      })
    })

    describe('LawListItemPriorityEnum', () => {
      it('validates all priorities', () => {
        const priorities = ['LOW', 'MEDIUM', 'HIGH']
        priorities.forEach((priority) => {
          expect(LawListItemPriorityEnum.safeParse(priority).success).toBe(true)
        })
      })
    })

    describe('LawListItemSourceEnum', () => {
      it('validates all sources', () => {
        const sources = ['ONBOARDING', 'MANUAL', 'IMPORT']
        sources.forEach((source) => {
          expect(LawListItemSourceEnum.safeParse(source).success).toBe(true)
        })
      })
    })
  })
})
