/**
 * Story 17.16 (dual-version foundation): server-action tests for the
 * `createDraftFromApproved` refactor + `saveDocumentVersion` three-path
 * routing + new `promoteDraftToApproved` + `discardDraft` actions.
 *
 * Mocked Prisma + mocked workspace-context. Each test asserts the load-bearing
 * alias-freeze / alias-advance behavior (CRIT-1 from the PO v1.1 revision):
 *   - createDraftFromApproved: alias NOT touched, approved metadata preserved,
 *     no deindex, document_draft_created ActivityLog written.
 *   - saveDocumentVersion Path A: draft pointer advances, alias frozen.
 *   - saveDocumentVersion Path B: never-approved DRAFT — alias and draft
 *     pointer advance together.
 *   - saveDocumentVersion Path C: APPROVED-no-draft refusal.
 *   - promoteDraftToApproved: atomic swap, alias advances, version timestamps
 *     stamped, ActivityLog document_draft_promoted written.
 *   - discardDraft: pointers cleared, alias NOT touched (no-op), refuses when
 *     no approved version to fall back to.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockWithWorkspace,
  mockIndexWorkspaceDocument,
  mockDeindexWorkspaceDocument,
} = vi.hoisted(() => ({
  mockWithWorkspace: vi.fn(),
  mockIndexWorkspaceDocument: vi.fn(),
  mockDeindexWorkspaceDocument: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceDocument: { findFirst: vi.fn(), update: vi.fn() },
    workspaceDocumentVersion: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    activityLog: { create: vi.fn() },
    $transaction: vi.fn((cb) =>
      cb({
        workspaceDocument: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          update: (prisma as any).workspaceDocument.update,
        },
        workspaceDocumentVersion: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          create: (prisma as any).workspaceDocumentVersion.create,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          update: (prisma as any).workspaceDocumentVersion.update,
        },
        activityLog: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          create: (prisma as any).activityLog.create,
        },
      })
    ),
  },
}))

vi.mock('@/lib/auth/workspace-context', () => ({
  withWorkspace: mockWithWorkspace,
}))

vi.mock('@/lib/chunks/workspace-document-reindex', () => ({
  decideReindexOnStatusChange: vi.fn(() => 'NONE'),
  indexWorkspaceDocument: mockIndexWorkspaceDocument,
  deindexWorkspaceDocument: mockDeindexWorkspaceDocument,
  markWorkspaceDocumentDirty: vi.fn(),
  updateWorkspaceDocumentStatusMetadata: vi.fn(),
}))

vi.mock('next/server', () => ({
  // Story 17.16 tests: run the after() callback synchronously so we can assert
  // the indexWorkspaceDocument / deindexWorkspaceDocument side-effects.
  after: (cb: () => Promise<unknown>) => cb(),
}))

import {
  createDraftFromApproved,
  createDraftFromApprovedWithEdit,
  saveDocumentVersion,
  promoteDraftToApproved,
  discardDraft,
  autosaveDocument,
  submitDraftForReview,
  rejectDraftReview,
} from '@/app/actions/documents'
import { prisma } from '@/lib/prisma'

const fn = (m: unknown) => m as ReturnType<typeof vi.fn>

const ctx = {
  userId: 'user_42',
  workspaceId: 'ws_1',
  hasPermission: (_p: string) => true,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockWithWorkspace.mockImplementation((cb: (_c: typeof ctx) => unknown) =>
    cb(ctx)
  )
  fn(prisma.workspaceDocumentVersion.create).mockResolvedValue({
    id: 'v_new',
    version_number: 5,
  })
  fn(prisma.workspaceDocument.update).mockResolvedValue({})
  fn(prisma.activityLog.create).mockResolvedValue({})
})

// ============================================================================
// createDraftFromApproved (AC 4)
// ============================================================================

describe('createDraftFromApproved — Story 17.16 AC 4', () => {
  const APPROVED_DOC = {
    id: 'd_1',
    status: 'APPROVED' as const,
    current_version_number: 3,
    current_draft_version_id: null,
    current_approved_version_id: 'v_approved',
    workspace_id: 'ws_1',
    current_version: {
      content_json: { type: 'doc', content: [] },
      content_html: '',
    },
  }

  it('happy path: creates new version, populates draft pointer, leaves alias + approved metadata untouched', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(APPROVED_DOC)

    const result = await createDraftFromApproved('d_1')

    expect(result.success).toBe(true)

    // Doc update: draft pointer set, draft_status set, version_number advanced.
    // Alias (current_version_id), status, approved_by, approved_at NOT touched.
    const docUpdate = fn(prisma.workspaceDocument.update).mock.calls[0]![0]
    expect(docUpdate.data).toMatchObject({
      current_draft_version_id: 'v_new',
      draft_status: 'DRAFT',
      current_version_number: 4,
    })
    expect(docUpdate.data.current_version_id).toBeUndefined()
    expect(docUpdate.data.status).toBeUndefined()
    expect(docUpdate.data.approved_by).toBeUndefined()
    expect(docUpdate.data.approved_at).toBeUndefined()

    // ActivityLog: NEW action name document_draft_created (NOT the legacy
    // document_status_changed which would imply a status flip).
    const logCall = fn(prisma.activityLog.create).mock.calls[0]![0]
    expect(logCall.data.action).toBe('document_draft_created')
    expect(logCall.data.new_value).toMatchObject({
      draft_version_id: 'v_new',
      draft_status: 'DRAFT',
      source_approved_version_id: 'v_approved',
    })

    // Deindex MUST NOT be called — the doc remains operationally APPROVED
    // throughout the draft window; the index source (alias) is frozen on the
    // approved version.
    expect(mockDeindexWorkspaceDocument).not.toHaveBeenCalled()
  })

  it('refuses when a draft is already in progress (AC 4)', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue({
      ...APPROVED_DOC,
      current_draft_version_id: 'v_existing_draft',
    })

    const result = await createDraftFromApproved('d_1')

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/utkast pågår redan/i)
    expect(prisma.workspaceDocumentVersion.create).not.toHaveBeenCalled()
    expect(prisma.workspaceDocument.update).not.toHaveBeenCalled()
  })

  it.each(['DRAFT', 'IN_REVIEW', 'SUPERSEDED', 'ARCHIVED'] as const)(
    'refuses when status is %s (only APPROVED is brancheable)',
    async (status) => {
      fn(prisma.workspaceDocument.findFirst).mockResolvedValue({
        ...APPROVED_DOC,
        status,
      })

      const result = await createDraftFromApproved('d_1')

      expect(result.success).toBe(false)
      expect(result.error).toMatch(/godkända dokument/i)
      expect(prisma.workspaceDocumentVersion.create).not.toHaveBeenCalled()
    }
  )

  it('refuses when document is missing', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(null)
    const result = await createDraftFromApproved('d_missing')
    expect(result.success).toBe(false)
  })
})

// ============================================================================
// saveDocumentVersion (AC 5) — three-path routing
// ============================================================================

describe('saveDocumentVersion — Story 17.16 AC 5 three-path routing', () => {
  it('Path A — draft in progress: advances draft pointer, FREEZES alias on approved', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue({
      id: 'd_1',
      status: 'APPROVED', // dual-state: APPROVED with draft in progress
      current_version_number: 4,
      current_draft_version_id: 'v_draft_prev',
      current_approved_version_id: 'v_approved',
      workspace_id: 'ws_1',
    })

    const result = await saveDocumentVersion(
      'd_1',
      { type: 'doc', content: [] },
      'Some change'
    )

    expect(result.success).toBe(true)

    const docUpdate = fn(prisma.workspaceDocument.update).mock.calls[0]![0]
    expect(docUpdate.data.current_draft_version_id).toBe('v_new')
    expect(docUpdate.data.current_version_number).toBe(5)
    // Alias frozen on approved — saveDocumentVersion MUST NOT advance it
    // during a draft window (the load-bearing CRIT-1 invariant).
    expect(docUpdate.data.current_version_id).toBeUndefined()
    expect(docUpdate.data.status).toBeUndefined()
    expect(docUpdate.data.current_approved_version_id).toBeUndefined()
  })

  it('Path B — never-approved DRAFT: advances alias AND draft pointer together', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue({
      id: 'd_1',
      status: 'DRAFT',
      current_version_number: 1,
      current_draft_version_id: null,
      current_approved_version_id: null,
      workspace_id: 'ws_1',
    })

    const result = await saveDocumentVersion(
      'd_1',
      { type: 'doc', content: [] },
      'First save'
    )

    expect(result.success).toBe(true)
    const docUpdate = fn(prisma.workspaceDocument.update).mock.calls[0]![0]
    // Both pointers advance — there's no approved version to protect.
    expect(docUpdate.data.current_draft_version_id).toBe('v_new')
    expect(docUpdate.data.current_version_id).toBe('v_new')
  })

  it('Path C — APPROVED with no draft in progress: defensive refusal', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue({
      id: 'd_1',
      status: 'APPROVED',
      current_version_number: 3,
      current_draft_version_id: null, // no draft
      current_approved_version_id: 'v_approved',
      workspace_id: 'ws_1',
    })

    const result = await saveDocumentVersion(
      'd_1',
      { type: 'doc', content: [] },
      'attempt'
    )

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/godkända dokumentet kan inte ändras/i)
    expect(prisma.workspaceDocumentVersion.create).not.toHaveBeenCalled()
  })
})

// ============================================================================
// promoteDraftToApproved (AC 6)
// ============================================================================

describe('promoteDraftToApproved — Story 17.16 AC 6', () => {
  const DUAL_STATE_DOC = {
    id: 'd_1',
    current_approved_version_id: 'v_approved_prev',
    current_draft_version_id: 'v_draft',
    draft_status: 'IN_REVIEW' as const,
    workspace_id: 'ws_1',
  }

  beforeEach(() => {
    fn(prisma.workspaceDocumentVersion.findUnique).mockResolvedValue({
      id: 'v_draft',
      version_number: 5,
    })
    fn(prisma.workspaceDocumentVersion.update).mockResolvedValue({})
  })

  it('happy path: pointers swap, alias advances to the just-promoted version, version timestamps stamped', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(DUAL_STATE_DOC)

    const result = await promoteDraftToApproved('d_1')

    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      newApprovedVersionId: 'v_draft',
      versionNumber: 5,
    })

    // Prior approved version's superseded_at stamped.
    expect(prisma.workspaceDocumentVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'v_approved_prev' },
        data: expect.objectContaining({ superseded_at: expect.any(Date) }),
      })
    )

    // Promoted draft's approved_at + approved_by stamped.
    expect(prisma.workspaceDocumentVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'v_draft' },
        data: expect.objectContaining({
          approved_at: expect.any(Date),
          approved_by: 'user_42',
        }),
      })
    )

    // Doc-level: pointers swap, alias advances, status idempotent APPROVED.
    const docUpdate = fn(prisma.workspaceDocument.update).mock.calls[0]![0]
    expect(docUpdate.data).toMatchObject({
      current_approved_version_id: 'v_draft',
      current_draft_version_id: null,
      draft_status: null,
      current_version_id: 'v_draft', // <-- alias advances HERE
      status: 'APPROVED',
      approved_by: 'user_42',
    })

    // ActivityLog row written.
    expect(prisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'document_draft_promoted',
          new_value: expect.objectContaining({
            promoted_version_id: 'v_draft',
            prior_approved_version_id: 'v_approved_prev',
            version_number: 5,
          }),
        }),
      })
    )

    // Reindex side-effect triggered (after() runs synchronously per the mock).
    expect(mockIndexWorkspaceDocument).toHaveBeenCalledWith('d_1', 'ws_1')
  })

  it('refuses when no draft is in progress', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue({
      ...DUAL_STATE_DOC,
      current_draft_version_id: null,
    })
    const result = await promoteDraftToApproved('d_1')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/pågående utkast/i)
    expect(prisma.workspaceDocument.update).not.toHaveBeenCalled()
  })

  it('refuses when draft_status is not IN_REVIEW (must be submitted first)', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue({
      ...DUAL_STATE_DOC,
      draft_status: 'DRAFT',
    })
    const result = await promoteDraftToApproved('d_1')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/granskning/i)
    expect(prisma.workspaceDocument.update).not.toHaveBeenCalled()
  })

  it('refuses when permission denied (tasks:edit)', async () => {
    mockWithWorkspace.mockImplementationOnce(
      (cb: (_c: typeof ctx) => unknown) =>
        cb({ ...ctx, hasPermission: () => false })
    )
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(DUAL_STATE_DOC)
    const result = await promoteDraftToApproved('d_1')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/behörighet/i)
    expect(prisma.workspaceDocument.update).not.toHaveBeenCalled()
  })

  it('never-approved-then-promoted: no prior approved version to supersede (no superseded_at stamp on a NULL prior)', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue({
      ...DUAL_STATE_DOC,
      current_approved_version_id: null, // never approved
    })
    const result = await promoteDraftToApproved('d_1')
    expect(result.success).toBe(true)
    // Only the draft version update (no prior-approved supersede call).
    const versionUpdates = fn(prisma.workspaceDocumentVersion.update).mock.calls
    expect(versionUpdates).toHaveLength(1)
    expect(versionUpdates[0]![0].where).toEqual({ id: 'v_draft' })
  })
})

// ============================================================================
// discardDraft (AC 7)
// ============================================================================

describe('discardDraft — Story 17.16 AC 7', () => {
  const DUAL_STATE_DOC = {
    id: 'd_1',
    current_approved_version_id: 'v_approved',
    current_draft_version_id: 'v_draft',
    draft_status: 'DRAFT' as const,
    workspace_id: 'ws_1',
  }

  it('happy path: pointers cleared, alias NOT touched (no-op invariant)', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(DUAL_STATE_DOC)

    const result = await discardDraft('d_1')

    expect(result.success).toBe(true)

    const docUpdate = fn(prisma.workspaceDocument.update).mock.calls[0]![0]
    expect(docUpdate.data).toEqual({
      current_draft_version_id: null,
      draft_status: null,
    })
    // CRITICAL: alias is NOT in the update payload — it was already pinned to
    // the approved version throughout the draft window (per AC 4 + AC 5).
    expect(docUpdate.data.current_version_id).toBeUndefined()

    // ActivityLog: document_draft_discarded.
    expect(prisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'document_draft_discarded',
          old_value: expect.objectContaining({
            discarded_version_id: 'v_draft',
            draft_status: 'DRAFT',
          }),
        }),
      })
    )

    // Defensive reindex still runs (non-load-bearing under Model B — the
    // index already tracks approved content via the frozen alias — but cheap
    // insurance).
    expect(mockIndexWorkspaceDocument).toHaveBeenCalledWith('d_1', 'ws_1')
  })

  it('refuses when no draft is in progress', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue({
      ...DUAL_STATE_DOC,
      current_draft_version_id: null,
    })
    const result = await discardDraft('d_1')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/pågående utkast/i)
    expect(prisma.workspaceDocument.update).not.toHaveBeenCalled()
  })

  it('refuses when no approved version to fall back to (use Arkivera instead)', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue({
      ...DUAL_STATE_DOC,
      current_approved_version_id: null, // never-approved DRAFT — can't discard
    })
    const result = await discardDraft('d_1')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Arkivera dokument/i)
    expect(prisma.workspaceDocument.update).not.toHaveBeenCalled()
  })

  it('refuses when permission denied (tasks:edit)', async () => {
    mockWithWorkspace.mockImplementationOnce(
      (cb: (_c: typeof ctx) => unknown) =>
        cb({ ...ctx, hasPermission: () => false })
    )
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(DUAL_STATE_DOC)
    const result = await discardDraft('d_1')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/behörighet/i)
  })
})

// ============================================================================
// autosaveDocument (AC 13 / Task 8 — alias-leak regression test)
// ============================================================================
//
// Story 17.16 live smoke (2026-06-04) surfaced a missed Task 8 case: the
// editor's autosaveDocument server action wrote to current_version_id (the
// frozen alias = approved version), silently overwriting approved content
// with draft edits. This test block locks in the corrected behavior so the
// regression cannot return.

describe('autosaveDocument — Story 17.16 AC 13 (alias-leak fix)', () => {
  beforeEach(() => {
    fn(prisma.workspaceDocumentVersion.update).mockResolvedValue({})
  })

  it('CRIT: writes to draft pointer when set, NOT the alias (dual-state doc)', async () => {
    // Dual-state doc: alias frozen on approved (v_approved), draft pointer
    // on v_draft. Autosave MUST target v_draft, not the alias.
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue({
      id: 'd_1',
      status: 'APPROVED',
      current_version_id: 'v_approved', // alias frozen here
      current_version_number: 3,
      current_draft_version_id: 'v_draft', // draft pointer
      current_approved_version_id: 'v_approved',
    })

    const result = await autosaveDocument('d_1', { type: 'doc', content: [] })

    expect(result.success).toBe(true)
    // Targets the DRAFT version, NOT the alias.
    expect(prisma.workspaceDocumentVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'v_draft' } })
    )
    // CRITICAL: alias version (v_approved) must NOT be written.
    expect(prisma.workspaceDocumentVersion.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'v_approved' } })
    )
  })

  it('falls back to approved pointer for never-approved DRAFT (Path B analog)', async () => {
    // Never-approved doc: draft pointer null, approved pointer set, alias on
    // approved (same row). Autosave can target either — approved pointer is
    // preferred for consistency with the dual-pointer model.
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue({
      id: 'd_1',
      status: 'DRAFT',
      current_version_id: 'v1',
      current_version_number: 1,
      current_draft_version_id: null,
      current_approved_version_id: 'v1',
    })

    const result = await autosaveDocument('d_1', { type: 'doc', content: [] })

    expect(result.success).toBe(true)
    expect(prisma.workspaceDocumentVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'v1' } })
    )
  })

  it('refuses against APPROVED-no-draft doc (defensive Path C analog)', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue({
      id: 'd_1',
      status: 'APPROVED',
      current_version_id: 'v_approved',
      current_version_number: 3,
      current_draft_version_id: null, // no draft
      current_approved_version_id: 'v_approved',
    })

    const result = await autosaveDocument('d_1', { type: 'doc', content: [] })

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/godkända dokumentet kan inte ändras/i)
    expect(prisma.workspaceDocumentVersion.update).not.toHaveBeenCalled()
  })

  it('refuses when document is missing', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(null)
    const result = await autosaveDocument('d_missing', {
      type: 'doc',
      content: [],
    })
    expect(result.success).toBe(false)
    expect(prisma.workspaceDocumentVersion.update).not.toHaveBeenCalled()
  })
})

// ============================================================================
// submitDraftForReview — Story 17.17 AC 7
// ============================================================================

describe('submitDraftForReview — Story 17.17 AC 7', () => {
  const DRAFT_DOC = {
    id: 'd_1',
    current_draft_version_id: 'v_draft',
    draft_status: 'DRAFT' as const,
    workspace_id: 'ws_1',
  }

  it('happy path: flips draft_status DRAFT → IN_REVIEW', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(DRAFT_DOC)

    const result = await submitDraftForReview('d_1')

    expect(result.success).toBe(true)
    const docUpdate = fn(prisma.workspaceDocument.update).mock.calls[0]![0]
    expect(docUpdate.data).toEqual({ draft_status: 'IN_REVIEW' })
    // Top-level status is NOT touched — Model B separates lifecycle from
    // draft sub-status.
    expect(docUpdate.data.status).toBeUndefined()

    expect(prisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'document_draft_submitted_for_review',
          new_value: expect.objectContaining({
            draft_version_id: 'v_draft',
            draft_status: 'IN_REVIEW',
          }),
        }),
      })
    )
  })

  it('refuses when no draft is in progress', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue({
      ...DRAFT_DOC,
      current_draft_version_id: null,
    })
    const result = await submitDraftForReview('d_1')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/pågående utkast/i)
    expect(prisma.workspaceDocument.update).not.toHaveBeenCalled()
  })

  it('refuses when draft is already IN_REVIEW', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue({
      ...DRAFT_DOC,
      draft_status: 'IN_REVIEW',
    })
    const result = await submitDraftForReview('d_1')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/redan skickat/i)
    expect(prisma.workspaceDocument.update).not.toHaveBeenCalled()
  })

  it('refuses when permission denied (tasks:edit)', async () => {
    mockWithWorkspace.mockImplementationOnce(
      (cb: (_c: typeof ctx) => unknown) =>
        cb({ ...ctx, hasPermission: () => false })
    )
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(DRAFT_DOC)
    const result = await submitDraftForReview('d_1')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/behörighet/i)
  })

  it('refuses when document is missing', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(null)
    const result = await submitDraftForReview('d_missing')
    expect(result.success).toBe(false)
    expect(prisma.workspaceDocument.update).not.toHaveBeenCalled()
  })
})

// ============================================================================
// rejectDraftReview — Story 17.17 smoke addendum (Neka utkast)
// ============================================================================

describe('rejectDraftReview — Story 17.17 (Neka utkast)', () => {
  const IN_REVIEW_DOC = {
    id: 'd_1',
    current_draft_version_id: 'v_draft',
    draft_status: 'IN_REVIEW' as const,
    workspace_id: 'ws_1',
  }

  it('happy path: flips draft_status IN_REVIEW → DRAFT (soft reject)', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(IN_REVIEW_DOC)

    const result = await rejectDraftReview('d_1')

    expect(result.success).toBe(true)
    const docUpdate = fn(prisma.workspaceDocument.update).mock.calls[0]![0]
    expect(docUpdate.data).toEqual({ draft_status: 'DRAFT' })
    // Top-level status NOT touched. Draft pointer NOT cleared (the draft
    // content stays for the author to resume editing).
    expect(docUpdate.data.status).toBeUndefined()
    expect(docUpdate.data.current_draft_version_id).toBeUndefined()

    expect(prisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'document_draft_review_rejected',
          new_value: expect.objectContaining({
            draft_version_id: 'v_draft',
            draft_status: 'DRAFT',
          }),
        }),
      })
    )
  })

  it('refuses when no draft is in progress', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue({
      ...IN_REVIEW_DOC,
      current_draft_version_id: null,
    })
    const result = await rejectDraftReview('d_1')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/pågående utkast/i)
    expect(prisma.workspaceDocument.update).not.toHaveBeenCalled()
  })

  it('refuses when draft is in DRAFT (not yet in review)', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue({
      ...IN_REVIEW_DOC,
      draft_status: 'DRAFT',
    })
    const result = await rejectDraftReview('d_1')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/inte skickat för granskning/i)
    expect(prisma.workspaceDocument.update).not.toHaveBeenCalled()
  })

  it('refuses when permission denied (tasks:edit)', async () => {
    mockWithWorkspace.mockImplementationOnce(
      (cb: (_c: typeof ctx) => unknown) =>
        cb({ ...ctx, hasPermission: () => false })
    )
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(IN_REVIEW_DOC)
    const result = await rejectDraftReview('d_1')
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/behörighet/i)
  })

  it('refuses when document is missing', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(null)
    const result = await rejectDraftReview('d_missing')
    expect(result.success).toBe(false)
    expect(prisma.workspaceDocument.update).not.toHaveBeenCalled()
  })
})

// ============================================================================
// createDraftFromApprovedWithEdit — Story 17.11c AC 1, 2, 12
// ============================================================================

describe('createDraftFromApprovedWithEdit — Story 17.11c AC 1', () => {
  const APPROVED_DOC = {
    id: 'd_1',
    status: 'APPROVED' as const,
    current_version_number: 3,
    current_draft_version_id: null,
    current_approved_version_id: 'v_approved',
    workspace_id: 'ws_1',
  }

  const editedContentJson = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'edited' }] },
    ],
  }

  it('happy path: writes ONE version row with edited content, ONE draft pointer update, TWO log rows', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(APPROVED_DOC)

    const result = await createDraftFromApprovedWithEdit(
      'd_1',
      editedContentJson,
      'Agentens auto-branch + tillägg',
      '<p>edited</p>'
    )

    expect(result.success).toBe(true)
    expect(result.data).toMatchObject({ id: 'v_new', versionNumber: 4 })

    // ONE version row, with edited content directly (not a clone).
    expect(prisma.workspaceDocumentVersion.create).toHaveBeenCalledTimes(1)
    const versionCreate = fn(prisma.workspaceDocumentVersion.create).mock
      .calls[0]![0]
    expect(versionCreate.data).toMatchObject({
      document_id: 'd_1',
      version_number: 4,
      source: 'TIPTAP',
      content_json: editedContentJson,
      content_html: '<p>edited</p>',
      change_summary: 'Agentens auto-branch + tillägg',
      created_by: 'user_42',
    })

    // Doc update advances draft pointer + draft_status + version_number; alias
    // (current_version_id), status, approved_by, approved_at all left untouched.
    expect(prisma.workspaceDocument.update).toHaveBeenCalledTimes(1)
    const docUpdate = fn(prisma.workspaceDocument.update).mock.calls[0]![0]
    expect(docUpdate.data).toMatchObject({
      current_draft_version_id: 'v_new',
      draft_status: 'DRAFT',
      current_version_number: 4,
    })
    expect(docUpdate.data.current_version_id).toBeUndefined()
    expect(docUpdate.data.status).toBeUndefined()
    expect(docUpdate.data.approved_by).toBeUndefined()
    expect(docUpdate.data.approved_at).toBeUndefined()

    // TWO ActivityLog rows: document_draft_created + document_version_saved.
    expect(prisma.activityLog.create).toHaveBeenCalledTimes(2)
    const logs = fn(prisma.activityLog.create).mock.calls.map(
      (call) => call[0]!.data
    )
    expect(logs[0]).toMatchObject({
      entity_type: 'workspace_document',
      entity_id: 'd_1',
      action: 'document_draft_created',
      new_value: {
        draft_version_id: 'v_new',
        draft_status: 'DRAFT',
        source_approved_version_id: 'v_approved',
      },
    })
    expect(logs[1]).toMatchObject({
      entity_type: 'workspace_document',
      entity_id: 'd_1',
      action: 'document_version_saved',
      new_value: {
        version_number: 4,
        change_summary: 'Agentens auto-branch + tillägg',
      },
    })
  })

  it('triggers indexWorkspaceDocument via after() post-commit (AC 1)', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(APPROVED_DOC)
    mockIndexWorkspaceDocument.mockResolvedValue(undefined)

    await createDraftFromApprovedWithEdit('d_1', editedContentJson, 'x')

    expect(mockIndexWorkspaceDocument).toHaveBeenCalledWith('d_1', 'ws_1')
  })

  it('refuses when document is missing (workspace scoping)', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(null)

    const result = await createDraftFromApprovedWithEdit(
      'd_missing',
      editedContentJson,
      'x'
    )

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/hittades inte/i)
    expect(prisma.workspaceDocumentVersion.create).not.toHaveBeenCalled()
    expect(prisma.activityLog.create).not.toHaveBeenCalled()
  })

  it('refuses when status is not APPROVED (defense-in-depth guard)', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue({
      ...APPROVED_DOC,
      status: 'DRAFT' as const,
    })

    const result = await createDraftFromApprovedWithEdit(
      'd_1',
      editedContentJson,
      'x'
    )

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/godkända/i)
    expect(prisma.workspaceDocumentVersion.create).not.toHaveBeenCalled()
  })

  it('refuses when a draft is already in progress (race-with-dispatch defense)', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue({
      ...APPROVED_DOC,
      current_draft_version_id: 'v_existing',
    })

    const result = await createDraftFromApprovedWithEdit(
      'd_1',
      editedContentJson,
      'x'
    )

    expect(result.success).toBe(false)
    // Copy verbatim mirrors createDraftFromApproved's AC 4 refusal.
    expect(result.error).toMatch(/utkast pågår redan/i)
    expect(prisma.workspaceDocumentVersion.create).not.toHaveBeenCalled()
    expect(prisma.activityLog.create).not.toHaveBeenCalled()
  })

  it('uses contentHtml = "" + extracted plaintext when contentHtml omitted', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(APPROVED_DOC)

    await createDraftFromApprovedWithEdit('d_1', editedContentJson, 'x')

    const versionCreate = fn(prisma.workspaceDocumentVersion.create).mock
      .calls[0]![0]
    expect(versionCreate.data.content_html).toBe('')
    expect(versionCreate.data.extracted_text).toBe('')
  })
})
