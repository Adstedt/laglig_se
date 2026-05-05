/**
 * Story 5.5b STORAGE-001 — path-level integration tests for uploadFile.
 *
 * Verifies the storage gate is actually wired into the user-facing upload
 * action. Without these, the assertWithinStorageQuota + getStorageUsage
 * unit tests pass even if a dev removes the gate call from uploadFile.
 *
 * Mocking pattern follows tests/unit/usage/seat-enforcement-paths.test.ts.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ============================================================================
// Module mocks (must be declared before route imports)
// ============================================================================

const mockWorkspace = {
  findUniqueOrThrow: vi.fn(),
}
const mockWorkspaceFile = {
  findFirst: vi.fn(),
  aggregate: vi.fn(),
  create: vi.fn(),
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspace: mockWorkspace,
    workspaceFile: mockWorkspaceFile,
  },
}))

const storageUploadMock = vi.fn()
const storageFromMock = vi.fn(() => ({ upload: storageUploadMock }))
const storageClientMock = { storage: { from: storageFromMock } }

vi.mock('@/lib/supabase/storage', () => ({
  getStorageClient: () => storageClientMock,
}))

// withWorkspace just runs the callback with a stub context. The real auth
// boundary is tested elsewhere; here we focus on the gate logic.
vi.mock('@/lib/auth/workspace-context', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/auth/workspace-context')
  >('@/lib/auth/workspace-context')
  return {
    ...actual,
    withWorkspace: vi.fn(async (cb: (_ctx: unknown) => Promise<unknown>) =>
      cb({
        workspaceId: 'ws_test',
        userId: 'user_owner',
        role: 'OWNER',
      })
    ),
  }
})

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// ============================================================================
// Helpers
// ============================================================================

const BYTES_PER_GB = 1_073_741_824

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

const setWorkspace = (
  tier: 'TRIAL' | 'SOLO' | 'TEAM' | 'ENTERPRISE',
  trial_picked_tier: 'TRIAL' | 'SOLO' | 'TEAM' | 'ENTERPRISE' | null = null
) => {
  mockWorkspace.findUniqueOrThrow.mockResolvedValue({
    subscription_tier: tier,
    trial_picked_tier,
  })
}

const setUsedBytes = (bytes: number) => {
  mockWorkspaceFile.aggregate.mockResolvedValue({
    _sum: { file_size: bytes },
  })
}

/**
 * Build a FormData fixture with a fake PDF file. The dev agent's uploadFile
 * action checks file.type against ALLOWED_MIME_TYPES; using application/pdf
 * is the simplest accepted shape.
 */
const buildFormData = (sizeBytes: number, name = 'test.pdf'): FormData => {
  const fd = new FormData()
  // Build a Buffer of `sizeBytes` zeroed bytes. File constructor auto-derives
  // .size from the Blob parts, so we don't need to spoof anything.
  const buffer = Buffer.alloc(sizeBytes)
  fd.set('file', new File([buffer], name, { type: 'application/pdf' }))
  return fd
}

// ============================================================================
// Path tests
// ============================================================================

describe('uploadFile — storage gate wiring', () => {
  it('returns STORAGE_QUOTA_EXCEEDED on overflow + does NOT call Supabase Storage (no orphan)', async () => {
    // Solo workspace, ~1015 MB used. A 20 MB upload (within MAX_FILE_SIZE
    // of 25 MB) would push to ~1035 MB, exceeding the 1 GB Solo cap.
    setWorkspace('SOLO')
    setUsedBytes(1015 * 1024 * 1024)
    mockWorkspaceFile.findFirst.mockResolvedValue(null) // no duplicate filename, no parent folder check

    const { uploadFile } = await import('@/app/actions/files')
    const result = await uploadFile(buildFormData(20 * 1024 * 1024))

    expect(result.success).toBe(false)
    expect(result.code).toBe('STORAGE_QUOTA_EXCEEDED')
    expect(result.error).toMatch(/Lagringsgräns uppnådd/)
    // formatted bytes appear in message — both currentBytes and limitBytes
    // are surfaced, in MB (under 1 GiB) or GB (>=1 GiB) units per locale.
    expect(result.error).toMatch(/\d+\s+(MB|GB).+(MB|GB)/)

    // Critical: NO Supabase Storage write happened. No orphan object.
    expect(storageFromMock).not.toHaveBeenCalled()
    expect(storageUploadMock).not.toHaveBeenCalled()
    // And no DB row was created
    expect(mockWorkspaceFile.create).not.toHaveBeenCalled()
  })

  it('proceeds to upload + DB create when under cap', async () => {
    setWorkspace('TEAM') // 5 GB cap
    setUsedBytes(BYTES_PER_GB) // 1 GB used → way under cap
    mockWorkspaceFile.findFirst.mockResolvedValue(null)
    storageUploadMock.mockResolvedValue({ error: null })
    mockWorkspaceFile.create.mockResolvedValue({
      id: 'file_xyz',
      workspace_id: 'ws_test',
      uploaded_by: 'user_owner',
      filename: 'test.pdf',
      original_filename: 'test.pdf',
      file_size: 1024,
      mime_type: 'application/pdf',
      storage_path: 'ws_test/files/file_xyz/test.pdf',
      category: 'OVRIGT',
      uploader: {
        id: 'user_owner',
        name: 'Owner',
        email: 'owner@example.com',
        avatar_url: null,
      },
      task_links: [],
      list_item_links: [],
      requirement_evidence_links: [],
    })

    const { uploadFile } = await import('@/app/actions/files')
    const result = await uploadFile(buildFormData(1024))

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    expect(result.warning).toBeUndefined()
    expect(storageUploadMock).toHaveBeenCalledTimes(1)
    expect(mockWorkspaceFile.create).toHaveBeenCalledTimes(1)
  })

  it('includes warning payload on success when projected usage crosses 80%', async () => {
    setWorkspace('SOLO') // 1 GB cap; 80% threshold = ~819 MB
    // 820 MB used is already just over 80%; a 5 MB upload pushes to 825 MB
    // (still under 1 GB cap) → success with warning. 5 MB stays under the
    // 25 MB MAX_FILE_SIZE pre-quota check.
    setUsedBytes(820 * 1024 * 1024)
    mockWorkspaceFile.findFirst.mockResolvedValue(null)
    storageUploadMock.mockResolvedValue({ error: null })
    mockWorkspaceFile.create.mockResolvedValue({
      id: 'file_warn',
      workspace_id: 'ws_test',
      uploaded_by: 'user_owner',
      filename: 'doc.pdf',
      original_filename: 'doc.pdf',
      file_size: 5 * 1024 * 1024,
      mime_type: 'application/pdf',
      storage_path: 'ws_test/files/file_warn/doc.pdf',
      category: 'OVRIGT',
      uploader: {
        id: 'user_owner',
        name: 'Owner',
        email: 'owner@example.com',
        avatar_url: null,
      },
      task_links: [],
      list_item_links: [],
      requirement_evidence_links: [],
    })

    const { uploadFile } = await import('@/app/actions/files')
    const result = await uploadFile(buildFormData(5 * 1024 * 1024))

    expect(result.success).toBe(true)
    expect(result.warning).toBeDefined()
    expect(result.warning?.percentUsed).toBeGreaterThanOrEqual(0.8)
    expect(result.warning?.limitBytes).toBe(BYTES_PER_GB)
    expect(storageUploadMock).toHaveBeenCalledTimes(1) // upload still happens
  })

  it('Enterprise honors 100 GB cap (NOT bypassed) — gate fires when over cap', async () => {
    setWorkspace('ENTERPRISE')
    // 99.99 GB used; a 20 MB upload would push to 100 GB + ~10 MB → over cap.
    // 20 MB stays under the 25 MB MAX_FILE_SIZE pre-quota check, so the
    // storage gate is what blocks (verifies Enterprise is NOT bypassed).
    setUsedBytes(100 * BYTES_PER_GB - 10 * 1024 * 1024)
    mockWorkspaceFile.findFirst.mockResolvedValue(null)

    const { uploadFile } = await import('@/app/actions/files')
    const result = await uploadFile(buildFormData(20 * 1024 * 1024, 'big.pdf'))

    expect(result.success).toBe(false)
    expect(result.code).toBe('STORAGE_QUOTA_EXCEEDED')
    expect(storageFromMock).not.toHaveBeenCalled()
    expect(mockWorkspaceFile.create).not.toHaveBeenCalled()
  })
})
