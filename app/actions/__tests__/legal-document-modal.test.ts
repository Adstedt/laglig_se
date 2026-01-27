/**
 * Unit tests for legal-document-modal server actions
 * Story P.1: Emergency Performance Fixes
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getListItemDetails, getDocumentContent } from '../legal-document-modal'
import { prisma } from '@/lib/prisma'
import * as workspaceContext from '@/lib/auth/workspace-context'
import * as cacheStrategies from '@/lib/cache/strategies'

// Mock dependencies
vi.mock('@/lib/prisma', () => ({
  prisma: {
    lawListItem: {
      findFirst: vi.fn(),
    },
    legalDocument: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/workspace-context', () => ({
  withWorkspace: vi.fn(),
}))

vi.mock('@/lib/cache/strategies', () => ({
  getCachedDocumentContent: vi.fn(),
}))

describe('legal-document-modal actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getListItemDetails', () => {
    it('should successfully fetch list item details with proper workspace validation', async () => {
      const mockListItem = {
        id: 'item-123',
        position: 1,
        compliance_status: 'EJ_PABORJAD',
        business_context: 'Test context',
        ai_commentary: 'AI analysis',
        category: 'Labor',
        added_at: new Date('2024-01-01'),
        updated_at: new Date('2024-01-02'),
        due_date: new Date('2024-12-31'),
        document: {
          id: 'doc-456',
          title: 'Test Law',
          document_number: 'SFS 2024:123',
          full_text: 'Full law text...',
          html_content: '<p>HTML content</p>',
          summary: 'Law summary',
          slug: 'test-law',
          status: 'ACTIVE',
          source_url: 'https://example.com',
          content_type: 'LAW',
          effective_date: new Date('2024-01-01'),
        },
        law_list: {
          id: 'list-789',
          name: 'Test List',
          workspace_id: 'workspace-001',
        },
        responsible_user: {
          id: 'user-111',
          name: 'John Doe',
          email: 'john@example.com',
          avatar_url: 'https://avatar.com/john',
        },
      }

      // Mock withWorkspace to execute the callback
      vi.mocked(workspaceContext.withWorkspace).mockImplementation(
        async (callback) => {
          return callback({
            workspaceId: 'workspace-001',
            userId: 'user-123',
            workspaceName: 'Test Workspace',
            workspaceSlug: 'test-workspace',
            workspaceStatus: 'ACTIVE' as any,
            role: 'OWNER' as any,
            hasPermission: () => true,
          })
        }
      )

      // Mock Prisma query
      vi.mocked(prisma.lawListItem.findFirst).mockResolvedValue(
        mockListItem as any
      )

      // Call the function
      const result = await getListItemDetails('item-123')

      // Assertions
      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.id).toBe('item-123')
      expect(result.data?.legalDocument.title).toBe('Test Law')
      expect(result.data?.responsibleUser?.name).toBe('John Doe')

      // Verify withWorkspace was called with correct permission
      expect(workspaceContext.withWorkspace).toHaveBeenCalledWith(
        expect.any(Function),
        'read'
      )

      // Verify Prisma query was called
      expect(prisma.lawListItem.findFirst).toHaveBeenCalledWith({
        where: { id: 'item-123' },
        include: expect.any(Object),
      })
    })

    it('should return error when list item is not found', async () => {
      // Mock withWorkspace to execute the callback
      vi.mocked(workspaceContext.withWorkspace).mockImplementation(
        async (callback) => {
          return callback({
            workspaceId: 'workspace-001',
            userId: 'user-123',
            workspaceName: 'Test Workspace',
            workspaceSlug: 'test-workspace',
            workspaceStatus: 'ACTIVE' as any,
            role: 'OWNER' as any,
            hasPermission: () => true,
          })
        }
      )

      // Mock Prisma to return null (item not found)
      vi.mocked(prisma.lawListItem.findFirst).mockResolvedValue(null)

      // Call the function
      const result = await getListItemDetails('non-existent-id')

      // Assertions
      expect(result.success).toBe(false)
      expect(result.error).toBe('List item not found or access denied')
      expect(result.data).toBeUndefined()
    })

    it('should return error when workspace access is denied', async () => {
      const mockListItem = {
        id: 'item-123',
        law_list: {
          id: 'list-789',
          name: 'Test List',
          workspace_id: 'different-workspace', // Different workspace
        },
      }

      // Mock withWorkspace to execute the callback
      vi.mocked(workspaceContext.withWorkspace).mockImplementation(
        async (callback) => {
          return callback({
            workspaceId: 'workspace-001',
            userId: 'user-123',
            workspaceName: 'Test Workspace',
            workspaceSlug: 'test-workspace',
            workspaceStatus: 'ACTIVE' as any,
            role: 'OWNER' as any,
            hasPermission: () => true,
          })
        }
      )

      // Mock Prisma query
      vi.mocked(prisma.lawListItem.findFirst).mockResolvedValue(
        mockListItem as any
      )

      // Call the function
      const result = await getListItemDetails('item-123')

      // Assertions
      expect(result.success).toBe(false)
      expect(result.error).toBe('List item not found or access denied')
    })

    it('should handle database errors gracefully', async () => {
      // Mock withWorkspace to throw an error
      vi.mocked(workspaceContext.withWorkspace).mockRejectedValue(
        new Error('Database connection failed')
      )

      // Call the function
      const result = await getListItemDetails('item-123')

      // Assertions
      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to fetch list item details')
    })
  })

  describe('getDocumentContent', () => {
    it('should successfully fetch cached document content', async () => {
      const mockContent = {
        fullText: 'Full document text',
        htmlContent: '<p>HTML content</p>',
      }

      // Mock cache function to return content
      vi.mocked(cacheStrategies.getCachedDocumentContent).mockResolvedValue(
        mockContent
      )

      // Call the function
      const result = await getDocumentContent('doc-123')

      // Assertions
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockContent)

      // Verify cache function was called
      expect(cacheStrategies.getCachedDocumentContent).toHaveBeenCalledWith(
        'doc-123',
        expect.any(Function)
      )
    })

    it('should handle cache misses and fetch from database', async () => {
      const mockDocument = {
        full_text: 'Database text',
        html_content: '<p>Database HTML</p>',
      }

      // Mock cache to execute the fetcher function
      vi.mocked(cacheStrategies.getCachedDocumentContent).mockImplementation(
        async (_, fetcher) => {
          // Mock Prisma for the fetcher
          vi.mocked(prisma.legalDocument.findUnique).mockResolvedValue(
            mockDocument as any
          )
          return fetcher()
        }
      )

      // Call the function
      const result = await getDocumentContent('doc-123')

      // Assertions
      expect(result.success).toBe(true)
      expect(result.data?.htmlContent).toBe('<p>Database HTML</p>')
    })

    it('should return error when document is not found', async () => {
      // Mock cache to execute the fetcher which throws
      vi.mocked(cacheStrategies.getCachedDocumentContent).mockImplementation(
        async (_, fetcher) => {
          vi.mocked(prisma.legalDocument.findUnique).mockResolvedValue(null)
          return fetcher()
        }
      )

      // Call the function
      const result = await getDocumentContent('non-existent')

      // Assertions
      expect(result.success).toBe(false)
      expect(result.error).toBe('Kunde inte ladda dokumentinnehåll')
    })

    it('should handle cache errors gracefully', async () => {
      // Mock cache to throw an error
      vi.mocked(cacheStrategies.getCachedDocumentContent).mockRejectedValue(
        new Error('Cache connection failed')
      )

      // Call the function
      const result = await getDocumentContent('doc-123')

      // Assertions
      expect(result.success).toBe(false)
      expect(result.error).toBe('Kunde inte ladda dokumentinnehåll')
    })
  })
})
