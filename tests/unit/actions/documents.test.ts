/**
 * Story 17.1: Tests for workspace document server actions
 * Tests CRUD operations, status transitions, and Zod validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies before imports
vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceDocument: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    workspaceDocumentVersion: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    workspaceDocumentTemplate: {
      findUnique: vi.fn(),
    },
    user: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/auth/workspace-context', () => ({
  withWorkspace: vi.fn((callback) =>
    callback({ workspaceId: 'ws_123', userId: 'user_123' })
  ),
}))

// Story 17.9b: updateDocumentStatus / createDraftFromApproved schedule WORKSPACE_DOCUMENT
// re-index via next/server's `after()`. Mock as a no-op by default so unit tests don't
// flush the callback (which would hit the RAG sync); the wiring tests below override it
// per-test to invoke the callback. Mirrors the 21.12 compliance-audit test.
vi.mock('next/server', () => ({
  after: vi.fn(),
}))

// Story 17.9b: keep the REAL decideReindexOnStatusChange (the gate under test) but stub
// the two DB-touching side effects so the wiring tests can assert which one fires.
vi.mock('@/lib/chunks/workspace-document-reindex', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@/lib/chunks/workspace-document-reindex')
    >()
  return {
    ...actual,
    indexWorkspaceDocument: vi.fn().mockResolvedValue(undefined),
    deindexWorkspaceDocument: vi.fn().mockResolvedValue(undefined),
  }
})

import { prisma } from '@/lib/prisma'
import { after } from 'next/server'
import {
  indexWorkspaceDocument,
  deindexWorkspaceDocument,
} from '@/lib/chunks/workspace-document-reindex'
import {
  createDocument,
  getDocument,
  getDocumentVersions,
  getWorkspaceDocuments,
  updateDocumentStatus,
} from '@/app/actions/documents'
import {
  createDocumentSchema,
  updateDocumentStatusSchema,
  getWorkspaceDocumentsSchema,
  VALID_STATUS_TRANSITIONS,
} from '@/lib/validation/documents'
import { WorkspaceDocumentStatus, WorkspaceDocumentType } from '@prisma/client'

beforeEach(() => {
  vi.clearAllMocks()
})

// ============================================================================
// Zod Schema Validation
// ============================================================================

describe('createDocumentSchema', () => {
  it('validates a minimal valid input', () => {
    const result = createDocumentSchema.safeParse({ title: 'Test Document' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.title).toBe('Test Document')
      expect(result.data.documentType).toBe('OTHER')
    }
  })

  it('validates a full valid input', () => {
    const result = createDocumentSchema.safeParse({
      title: 'Policy ABC',
      documentType: 'POLICY',
      templateId: '550e8400-e29b-41d4-a716-446655440000',
      documentNumber: 'POL-2026-001',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty title', () => {
    const result = createDocumentSchema.safeParse({ title: '' })
    expect(result.success).toBe(false)
  })

  it('rejects title over 255 characters', () => {
    const result = createDocumentSchema.safeParse({ title: 'a'.repeat(256) })
    expect(result.success).toBe(false)
  })

  it('rejects invalid document type', () => {
    const result = createDocumentSchema.safeParse({
      title: 'Test',
      documentType: 'INVALID_TYPE',
    })
    expect(result.success).toBe(false)
  })
})

describe('updateDocumentStatusSchema', () => {
  it('validates a valid input', () => {
    const result = updateDocumentStatusSchema.safeParse({
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      newStatus: 'IN_REVIEW',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid status', () => {
    const result = updateDocumentStatusSchema.safeParse({
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      newStatus: 'INVALID',
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-uuid documentId', () => {
    const result = updateDocumentStatusSchema.safeParse({
      documentId: 'not-a-uuid',
      newStatus: 'DRAFT',
    })
    expect(result.success).toBe(false)
  })
})

describe('getWorkspaceDocumentsSchema', () => {
  it('accepts empty input with defaults', () => {
    const result = getWorkspaceDocumentsSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.take).toBe(25)
    }
  })

  it('accepts full filter input', () => {
    const result = getWorkspaceDocumentsSchema.safeParse({
      type: 'POLICY',
      status: 'DRAFT',
      search: 'test',
      take: 10,
    })
    expect(result.success).toBe(true)
  })

  it('rejects take over 100', () => {
    const result = getWorkspaceDocumentsSchema.safeParse({ take: 101 })
    expect(result.success).toBe(false)
  })
})

// ============================================================================
// Status Transition Validation
// ============================================================================

describe('VALID_STATUS_TRANSITIONS', () => {
  it('allows DRAFT → IN_REVIEW', () => {
    expect(VALID_STATUS_TRANSITIONS.DRAFT).toContain(
      WorkspaceDocumentStatus.IN_REVIEW
    )
  })

  it('allows DRAFT → ARCHIVED', () => {
    expect(VALID_STATUS_TRANSITIONS.DRAFT).toContain(
      WorkspaceDocumentStatus.ARCHIVED
    )
  })

  it('allows IN_REVIEW → APPROVED', () => {
    expect(VALID_STATUS_TRANSITIONS.IN_REVIEW).toContain(
      WorkspaceDocumentStatus.APPROVED
    )
  })

  it('allows IN_REVIEW → DRAFT (send back)', () => {
    expect(VALID_STATUS_TRANSITIONS.IN_REVIEW).toContain(
      WorkspaceDocumentStatus.DRAFT
    )
  })

  it('allows APPROVED → SUPERSEDED', () => {
    expect(VALID_STATUS_TRANSITIONS.APPROVED).toContain(
      WorkspaceDocumentStatus.SUPERSEDED
    )
  })

  it('allows APPROVED → ARCHIVED', () => {
    expect(VALID_STATUS_TRANSITIONS.APPROVED).toContain(
      WorkspaceDocumentStatus.ARCHIVED
    )
  })

  it('allows SUPERSEDED → ARCHIVED', () => {
    expect(VALID_STATUS_TRANSITIONS.SUPERSEDED).toContain(
      WorkspaceDocumentStatus.ARCHIVED
    )
  })

  it('ARCHIVED is terminal — no transitions', () => {
    expect(VALID_STATUS_TRANSITIONS.ARCHIVED).toEqual([])
  })

  it('does not allow DRAFT → APPROVED directly', () => {
    expect(VALID_STATUS_TRANSITIONS.DRAFT).not.toContain(
      WorkspaceDocumentStatus.APPROVED
    )
  })
})

// ============================================================================
// createDocument
// ============================================================================

describe('createDocument', () => {
  it('creates a document with version v1', async () => {
    const mockDoc = {
      id: 'doc_1',
      title: 'Test Policy',
      current_version_number: 1,
    }

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      const tx = {
        workspaceDocument: {
          create: vi.fn().mockResolvedValue({ id: 'doc_1' }),
          update: vi.fn().mockResolvedValue(mockDoc),
        },
        workspaceDocumentVersion: {
          create: vi.fn().mockResolvedValue({ id: 'ver_1' }),
        },
        activityLog: {
          create: vi.fn().mockResolvedValue({}),
        },
      }
      return callback(tx)
    })

    const result = await createDocument({
      title: 'Test Policy',
      documentType: WorkspaceDocumentType.POLICY,
    })

    expect(result.success).toBe(true)
    expect(result.data?.title).toBe('Test Policy')
    expect(result.data?.versionNumber).toBe(1)
  })

  it('uses template content when templateId is provided', async () => {
    const mockTemplate = {
      id: 'tmpl_1',
      content_json: { type: 'doc', content: [{ type: 'heading' }] },
      document_type: WorkspaceDocumentType.RISK_ASSESSMENT,
    }

    vi.mocked(prisma.workspaceDocumentTemplate.findUnique).mockResolvedValue(
      mockTemplate as never
    )

    let capturedContentJson: unknown
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      const tx = {
        workspaceDocument: {
          create: vi.fn().mockResolvedValue({ id: 'doc_1' }),
          update: vi.fn().mockResolvedValue({
            id: 'doc_1',
            title: 'From Template',
            current_version_number: 1,
          }),
        },
        workspaceDocumentVersion: {
          create: vi.fn().mockImplementation((args) => {
            capturedContentJson = args.data.content_json
            return { id: 'ver_1' }
          }),
        },
        activityLog: {
          create: vi.fn().mockResolvedValue({}),
        },
      }
      return callback(tx)
    })

    const result = await createDocument({
      title: 'From Template',
      templateId: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result.success).toBe(true)
    expect(capturedContentJson).toEqual(mockTemplate.content_json)
  })

  it('returns error for non-existent template', async () => {
    vi.mocked(prisma.workspaceDocumentTemplate.findUnique).mockResolvedValue(
      null
    )

    const result = await createDocument({
      title: 'Test',
      templateId: '550e8400-e29b-41d4-a716-446655440000',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Mall hittades inte')
  })
})

// ============================================================================
// getDocument
// ============================================================================

describe('getDocument', () => {
  it('returns document with relations', async () => {
    const mockDoc = {
      id: 'doc_1',
      title: 'Test',
      workspace_id: 'ws_123',
      current_version: { id: 'ver_1', version_number: 1 },
      creator: { id: 'user_123', name: 'Test User' },
      task_links: [],
      list_item_links: [],
    }

    vi.mocked(prisma.workspaceDocument.findFirst).mockResolvedValue(
      mockDoc as never
    )

    const result = await getDocument('doc_1')

    expect(result.success).toBe(true)
    expect(result.data).toEqual(mockDoc)
  })

  it('returns error for non-existent document', async () => {
    vi.mocked(prisma.workspaceDocument.findFirst).mockResolvedValue(null)

    const result = await getDocument('nonexistent')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Dokument hittades inte')
  })
})

// ============================================================================
// getDocumentVersions
// ============================================================================

describe('getDocumentVersions', () => {
  it('returns versions ordered by version_number desc with resolved authors', async () => {
    vi.mocked(prisma.workspaceDocument.findFirst).mockResolvedValue({
      id: 'doc_1',
    } as never)

    const createdAt = new Date()
    const mockVersions = [
      {
        id: 'v2',
        version_number: 2,
        source: 'TIPTAP',
        change_summary: null,
        created_by: 'user_123',
        created_at: createdAt,
      },
      {
        id: 'v1',
        version_number: 1,
        source: 'TIPTAP',
        change_summary: null,
        created_by: 'user_123',
        created_at: createdAt,
      },
    ]

    vi.mocked(prisma.workspaceDocumentVersion.findMany).mockResolvedValue(
      mockVersions as never
    )
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 'user_123', name: 'Test User', avatar_url: null },
    ] as never)

    const result = await getDocumentVersions('doc_1')

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(2)
    expect(result.data![0].author.name).toBe('Test User')
    expect(result.data![0].version_number).toBe(2)
    expect(result.data![1].version_number).toBe(1)
  })

  it('returns error if document not in workspace', async () => {
    vi.mocked(prisma.workspaceDocument.findFirst).mockResolvedValue(null)

    const result = await getDocumentVersions('doc_other')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Dokument hittades inte')
  })
})

// ============================================================================
// getWorkspaceDocuments
// ============================================================================

describe('getWorkspaceDocuments', () => {
  it('returns paginated document list', async () => {
    const mockDocs = Array.from({ length: 3 }, (_, i) => ({
      id: `doc_${i}`,
      title: `Doc ${i}`,
      document_type: 'POLICY',
      status: 'DRAFT',
      updated_at: new Date(),
    }))

    vi.mocked(prisma.workspaceDocument.findMany).mockResolvedValue(
      mockDocs as never
    )

    const result = await getWorkspaceDocuments({ take: 25 })

    expect(result.success).toBe(true)
    const data = result.data as { items: unknown[]; hasMore: boolean }
    expect(data.items).toHaveLength(3)
    expect(data.hasMore).toBe(false)
  })

  it('indicates hasMore when more results exist', async () => {
    // Return take+1 items to indicate more exist
    const mockDocs = Array.from({ length: 3 }, (_, i) => ({
      id: `doc_${i}`,
      title: `Doc ${i}`,
    }))

    vi.mocked(prisma.workspaceDocument.findMany).mockResolvedValue(
      mockDocs as never
    )

    const result = await getWorkspaceDocuments({ take: 2 })

    expect(result.success).toBe(true)
    const data = result.data as {
      items: unknown[]
      hasMore: boolean
      nextCursor: string
    }
    expect(data.items).toHaveLength(2)
    expect(data.hasMore).toBe(true)
    expect(data.nextCursor).toBe('doc_1')
  })

  it('accepts empty input', async () => {
    vi.mocked(prisma.workspaceDocument.findMany).mockResolvedValue([])

    const result = await getWorkspaceDocuments()

    expect(result.success).toBe(true)
  })
})

// ============================================================================
// updateDocumentStatus
// ============================================================================

describe('updateDocumentStatus', () => {
  it('transitions DRAFT → IN_REVIEW', async () => {
    vi.mocked(prisma.workspaceDocument.findFirst).mockResolvedValue({
      id: 'doc_1',
      status: WorkspaceDocumentStatus.DRAFT,
      workspace_id: 'ws_123',
    } as never)

    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      const tx = {
        workspaceDocument: {
          update: vi.fn().mockResolvedValue({
            id: 'doc_1',
            status: WorkspaceDocumentStatus.IN_REVIEW,
          }),
        },
        activityLog: { create: vi.fn().mockResolvedValue({}) },
      }
      return callback(tx)
    })

    const result = await updateDocumentStatus({
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      newStatus: WorkspaceDocumentStatus.IN_REVIEW,
    })

    expect(result.success).toBe(true)
    expect(result.data?.status).toBe('IN_REVIEW')
  })

  it('sets approved_by/at when transitioning to APPROVED', async () => {
    vi.mocked(prisma.workspaceDocument.findFirst).mockResolvedValue({
      id: 'doc_1',
      status: WorkspaceDocumentStatus.IN_REVIEW,
      workspace_id: 'ws_123',
    } as never)

    let capturedUpdateData: Record<string, unknown> | null = null
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      const tx = {
        workspaceDocument: {
          update: vi
            .fn()
            .mockImplementation((args: { data: Record<string, unknown> }) => {
              capturedUpdateData = args.data
              return { id: 'doc_1', status: WorkspaceDocumentStatus.APPROVED }
            }),
        },
        activityLog: { create: vi.fn().mockResolvedValue({}) },
      }
      return callback(tx)
    })

    await updateDocumentStatus({
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      newStatus: WorkspaceDocumentStatus.APPROVED,
    })

    expect(capturedUpdateData!.approved_by).toBe('user_123')
    expect(capturedUpdateData!.approved_at).toBeInstanceOf(Date)
  })

  it('clears approved_by/at when transitioning from APPROVED', async () => {
    vi.mocked(prisma.workspaceDocument.findFirst).mockResolvedValue({
      id: 'doc_1',
      status: WorkspaceDocumentStatus.APPROVED,
      workspace_id: 'ws_123',
    } as never)

    let capturedUpdateData: Record<string, unknown> | null = null
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      const tx = {
        workspaceDocument: {
          update: vi
            .fn()
            .mockImplementation((args: { data: Record<string, unknown> }) => {
              capturedUpdateData = args.data
              return { id: 'doc_1', status: WorkspaceDocumentStatus.ARCHIVED }
            }),
        },
        activityLog: { create: vi.fn().mockResolvedValue({}) },
      }
      return callback(tx)
    })

    await updateDocumentStatus({
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      newStatus: WorkspaceDocumentStatus.ARCHIVED,
    })

    expect(capturedUpdateData!.approved_by).toBeNull()
    expect(capturedUpdateData!.approved_at).toBeNull()
  })

  it('rejects invalid status transition DRAFT → APPROVED', async () => {
    vi.mocked(prisma.workspaceDocument.findFirst).mockResolvedValue({
      id: 'doc_1',
      status: WorkspaceDocumentStatus.DRAFT,
    } as never)

    const result = await updateDocumentStatus({
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      newStatus: WorkspaceDocumentStatus.APPROVED,
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Ogiltig statusövergång')
  })

  // Story 17.9b — wiring: the status transition must schedule the correct RAG action.
  // (QA-added.) Captures the after() callback and runs it so the index/de-index call
  // is actually exercised — without this, deleting the after() block stays green.
  function setupTransition(
    fromStatus: WorkspaceDocumentStatus,
    toStatus: WorkspaceDocumentStatus
  ) {
    vi.mocked(prisma.workspaceDocument.findFirst).mockResolvedValue({
      id: 'doc_1',
      status: fromStatus,
      workspace_id: 'ws_123',
    } as never)
    vi.mocked(prisma.$transaction).mockImplementation(async (callback) => {
      const tx = {
        workspaceDocument: {
          update: vi.fn().mockResolvedValue({ id: 'doc_1', status: toStatus }),
        },
        activityLog: { create: vi.fn().mockResolvedValue({}) },
      }
      return (callback as (_tx: unknown) => unknown)(tx)
    })
    // Flush the after() callback synchronously for this test.
    vi.mocked(after).mockImplementationOnce(((cb: () => unknown) => {
      void cb()
    }) as never)
  }

  it('Story 17.9b: INDEXes when transitioning IN_REVIEW → APPROVED', async () => {
    setupTransition(
      WorkspaceDocumentStatus.IN_REVIEW,
      WorkspaceDocumentStatus.APPROVED
    )

    await updateDocumentStatus({
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      newStatus: WorkspaceDocumentStatus.APPROVED,
    })

    expect(indexWorkspaceDocument).toHaveBeenCalledWith('doc_1', 'ws_123')
    expect(deindexWorkspaceDocument).not.toHaveBeenCalled()
  })

  it('Story 17.9b: DE-INDEXes when transitioning APPROVED → ARCHIVED', async () => {
    setupTransition(
      WorkspaceDocumentStatus.APPROVED,
      WorkspaceDocumentStatus.ARCHIVED
    )

    await updateDocumentStatus({
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      newStatus: WorkspaceDocumentStatus.ARCHIVED,
    })

    expect(deindexWorkspaceDocument).toHaveBeenCalledWith('doc_1', 'ws_123')
    expect(indexWorkspaceDocument).not.toHaveBeenCalled()
  })

  it('Story 17.9b: schedules NO RAG action for DRAFT → IN_REVIEW (non-boundary)', async () => {
    setupTransition(
      WorkspaceDocumentStatus.DRAFT,
      WorkspaceDocumentStatus.IN_REVIEW
    )

    await updateDocumentStatus({
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      newStatus: WorkspaceDocumentStatus.IN_REVIEW,
    })

    expect(indexWorkspaceDocument).not.toHaveBeenCalled()
    expect(deindexWorkspaceDocument).not.toHaveBeenCalled()
  })

  it('rejects transition from ARCHIVED (terminal)', async () => {
    vi.mocked(prisma.workspaceDocument.findFirst).mockResolvedValue({
      id: 'doc_1',
      status: WorkspaceDocumentStatus.ARCHIVED,
    } as never)

    const result = await updateDocumentStatus({
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      newStatus: WorkspaceDocumentStatus.DRAFT,
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Ogiltig statusövergång')
  })

  it('returns error for non-existent document', async () => {
    vi.mocked(prisma.workspaceDocument.findFirst).mockResolvedValue(null)

    const result = await updateDocumentStatus({
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      newStatus: WorkspaceDocumentStatus.IN_REVIEW,
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Dokument hittades inte')
  })
})
