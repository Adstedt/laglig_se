/**
 * Story 21.9 — integration test for the file-deletion guard in
 * `deleteFile` / `deleteFilesBulk`. Mocks Prisma + Storage + the guard
 * helper; verifies the file-not-referenced path proceeds and the
 * file-referenced-by-SEALED-cycle path blocks with the formatted error.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Mocks ----

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceFile: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    workspaceMember: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/workspace-context', () => ({
  withWorkspace: vi.fn(async (cb: (_ctx: unknown) => unknown) =>
    cb({
      workspaceId: 'ws-1',
      userId: 'user-1',
      role: 'OWNER',
      hasPermission: () => true,
    })
  ),
}))

const mockRemove = vi.fn()
vi.mock('@/lib/supabase/storage', () => ({
  getStorageClient: () => ({
    storage: { from: () => ({ remove: mockRemove }) },
  }),
}))

const mockFindRefs = vi.fn()
vi.mock('@/lib/compliance-audit/check-evidence-references', () => ({
  findActiveSnapshotReferences: (...args: unknown[]) => mockFindRefs(...args),
  formatBlockedByCyclesError: (refs: Array<{ cycleName: string }>) =>
    `Filen används som bevis i fastställd kontroll: ${refs
      .map((r) => r.cycleName)
      .join(', ')}. Radering blockerad.`,
}))

import { deleteFile } from '@/app/actions/files'
import { prisma } from '@/lib/prisma'

const FILE_ID = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  vi.clearAllMocks()
  mockRemove.mockResolvedValue({ error: null })
})

describe('deleteFile — evidence-reference guard (Story 21.9 AC 8)', () => {
  it('proceeds with delete when file has no sealed-cycle references', async () => {
    vi.mocked(prisma.workspaceFile.findFirst).mockResolvedValueOnce({
      id: FILE_ID,
      uploaded_by: 'user-1',
      storage_path: 'path.pdf',
    } as unknown as Awaited<ReturnType<typeof prisma.workspaceFile.findFirst>>)
    vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValueOnce({
      role: 'OWNER',
    } as unknown as Awaited<
      ReturnType<typeof prisma.workspaceMember.findFirst>
    >)
    mockFindRefs.mockResolvedValueOnce([])
    vi.mocked(prisma.workspaceFile.delete).mockResolvedValueOnce(
      {} as unknown as Awaited<ReturnType<typeof prisma.workspaceFile.delete>>
    )

    const result = await deleteFile(FILE_ID)
    expect(result.success).toBe(true)
    expect(prisma.workspaceFile.delete).toHaveBeenCalledOnce()
    expect(mockRemove).toHaveBeenCalledOnce()
  })

  it('blocks delete when file is referenced by a SEALED cycle', async () => {
    vi.mocked(prisma.workspaceFile.findFirst).mockResolvedValueOnce({
      id: FILE_ID,
      uploaded_by: 'user-1',
      storage_path: 'path.pdf',
    } as unknown as Awaited<ReturnType<typeof prisma.workspaceFile.findFirst>>)
    vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValueOnce({
      role: 'OWNER',
    } as unknown as Awaited<
      ReturnType<typeof prisma.workspaceMember.findFirst>
    >)
    mockFindRefs.mockResolvedValueOnce([
      { cycleId: 'c1', cycleName: 'Q1 revision', status: 'SEALED' },
    ])

    const result = await deleteFile(FILE_ID)
    expect(result.success).toBe(false)
    expect(result.error).toBe(
      'Filen används som bevis i fastställd kontroll: Q1 revision. Radering blockerad.'
    )
    // CRITICAL: no storage delete + no DB delete occurred
    expect(mockRemove).not.toHaveBeenCalled()
    expect(prisma.workspaceFile.delete).not.toHaveBeenCalled()
  })

  it('does NOT call findActiveSnapshotReferences when permission check fails', async () => {
    vi.mocked(prisma.workspaceFile.findFirst).mockResolvedValueOnce({
      id: FILE_ID,
      uploaded_by: 'other-user',
      storage_path: 'path.pdf',
    } as unknown as Awaited<ReturnType<typeof prisma.workspaceFile.findFirst>>)
    vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValueOnce({
      role: 'MEMBER',
    } as unknown as Awaited<
      ReturnType<typeof prisma.workspaceMember.findFirst>
    >)

    const result = await deleteFile(FILE_ID)
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/behörighet att radera/)
    // The guard must NOT run when the permission check already rejected
    // (avoid a wasted DB hit on the unhappy path).
    expect(mockFindRefs).not.toHaveBeenCalled()
  })
})
