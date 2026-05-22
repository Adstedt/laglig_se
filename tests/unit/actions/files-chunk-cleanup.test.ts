/**
 * Story 17.9 (Task 4): deleteFile + deleteFilesBulk must de-index a file's USER_FILE
 * RAG chunks (ContentChunk has no FK to its polymorphic source, so cleanup is manual).
 * deleteFilesBulk must clean up exactly the permission-filtered deleted set.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  fileFindFirst: vi.fn(),
  fileFindMany: vi.fn(),
  fileDelete: vi.fn(),
  fileDeleteMany: vi.fn(),
  memberFindFirst: vi.fn(),
  chunkDeleteMany: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('@/lib/auth/workspace-context', () => ({
  withWorkspace: (
    cb: (_c: { workspaceId: string; userId: string }) => unknown
  ) => cb({ workspaceId: 'ws_1', userId: 'u_1' }),
}))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceFile: {
      findFirst: h.fileFindFirst,
      findMany: h.fileFindMany,
      delete: h.fileDelete,
      deleteMany: h.fileDeleteMany,
    },
    workspaceMember: { findFirst: h.memberFindFirst },
    contentChunk: { deleteMany: h.chunkDeleteMany },
  },
}))
vi.mock('@/lib/supabase/storage', () => ({
  getStorageClient: () => ({ storage: { from: () => ({ remove: h.remove }) } }),
}))
vi.mock('@/lib/usage/storage', () => ({
  assertWithinStorageQuota: vi.fn(),
  formatBytesSwedish: (n: number) => String(n),
  StorageQuotaExceededError: class extends Error {},
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { deleteFile, deleteFilesBulk } from '@/app/actions/files'

beforeEach(() => {
  vi.clearAllMocks()
  h.memberFindFirst.mockResolvedValue({ role: 'OWNER' })
  h.fileDelete.mockResolvedValue({})
  h.fileDeleteMany.mockResolvedValue({ count: 2 })
  h.chunkDeleteMany.mockResolvedValue({ count: 3 })
  h.remove.mockResolvedValue({ error: null })
})

describe('deleteFile — RAG cleanup (Story 17.9)', () => {
  it('de-indexes the file USER_FILE chunks after deleting the file', async () => {
    h.fileFindFirst.mockResolvedValue({
      id: 'f_1',
      uploaded_by: 'u_1',
      storage_path: 'ws_1/f_1',
      workspace_id: 'ws_1',
    })

    const res = await deleteFile('f_1')

    expect(res.success).toBe(true)
    expect(h.fileDelete).toHaveBeenCalledWith({ where: { id: 'f_1' } })
    expect(h.chunkDeleteMany).toHaveBeenCalledWith({
      where: { source_type: 'USER_FILE', source_id: 'f_1' },
    })
  })

  it('does not de-index when the caller lacks permission', async () => {
    h.memberFindFirst.mockResolvedValue({ role: 'MEMBER' })
    h.fileFindFirst.mockResolvedValue({
      id: 'f_1',
      uploaded_by: 'someone_else',
      storage_path: 'p',
      workspace_id: 'ws_1',
    })

    const res = await deleteFile('f_1')

    expect(res.success).toBe(false)
    expect(h.fileDelete).not.toHaveBeenCalled()
    expect(h.chunkDeleteMany).not.toHaveBeenCalled()
  })
})

describe('deleteFilesBulk — RAG cleanup (Story 17.9)', () => {
  it('de-indexes chunks for the permission-filtered deleted set, not the raw input', async () => {
    // Caller passes 3 ids, but only 2 are owned/permitted and actually deleted.
    h.fileFindMany.mockResolvedValue([
      { id: 'f_1', storage_path: 'p1' },
      { id: 'f_2', storage_path: 'p2' },
    ])

    const res = await deleteFilesBulk(['f_1', 'f_2', 'f_other'])

    expect(res.success).toBe(true)
    expect(h.chunkDeleteMany).toHaveBeenCalledWith({
      where: { source_type: 'USER_FILE', source_id: { in: ['f_1', 'f_2'] } },
    })
  })

  it('does not de-index when no files are deletable', async () => {
    h.fileFindMany.mockResolvedValue([])

    const res = await deleteFilesBulk(['f_x'])

    expect(res.success).toBe(false)
    expect(h.chunkDeleteMany).not.toHaveBeenCalled()
  })
})
