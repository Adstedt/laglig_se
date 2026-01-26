/**
 * Story 6.7a: Tests for file server actions
 * Tests file validation, upload, delete permissions, and linking
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies before imports
vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceFile: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    workspaceMember: {
      findFirst: vi.fn(),
    },
    task: {
      findFirst: vi.fn(),
    },
    lawListItem: {
      findFirst: vi.fn(),
    },
    fileTaskLink: {
      create: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    fileListItemLink: {
      create: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth/workspace-context', () => ({
  withWorkspace: vi.fn((callback) =>
    callback({ workspaceId: 'ws_123', userId: 'user_123' })
  ),
}))

vi.mock('@/lib/supabase/storage', () => ({
  getStorageClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
        remove: vi.fn().mockResolvedValue({ data: {}, error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: 'https://signed-url.example.com' },
          error: null,
        }),
      })),
    },
  })),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  randomUUID: () => 'test-uuid-123',
})

import { prisma } from '@/lib/prisma'
import {
  uploadFile,
  deleteFile,
  updateFile,
  linkFileToTask,
  linkFileToListItem,
  unlinkFile,
  getWorkspaceFiles,
  getFileDownloadUrl,
  deleteFilesBulk,
} from '@/app/actions/files'

const mockFile = {
  id: 'file_123',
  workspace_id: 'ws_123',
  uploaded_by: 'user_123',
  filename: 'test.pdf',
  original_filename: 'test.pdf',
  file_size: 1024,
  mime_type: 'application/pdf',
  storage_path: 'ws_123/files/file_123/test.pdf',
  category: 'OVRIGT',
  description: null,
  created_at: new Date(),
  updated_at: new Date(),
  uploader: {
    id: 'user_123',
    name: 'Test User',
    email: 'test@example.com',
    avatar_url: null,
  },
  task_links: [],
  list_item_links: [],
}

const mockTask = {
  id: 'task_123',
  workspace_id: 'ws_123',
  title: 'Test Task',
}

const mockListItem = {
  id: 'listitem_123',
  law_list: { workspace_id: 'ws_123' },
}

describe('uploadFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.workspaceFile.create).mockResolvedValue(mockFile as never)
  })

  describe('file validation', () => {
    it('rejects when no file is provided', async () => {
      const formData = new FormData()

      const result = await uploadFile(formData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Ingen fil vald')
    })

    it('rejects invalid file types', async () => {
      const formData = new FormData()
      const invalidFile = new File(['content'], 'test.exe', {
        type: 'application/x-msdownload',
      })
      formData.append('file', invalidFile)

      const result = await uploadFile(formData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Otillåten filtyp')
    })

    it('rejects files over 25MB', async () => {
      const formData = new FormData()
      // Create a file larger than 25MB
      const largeContent = new ArrayBuffer(26 * 1024 * 1024)
      const largeFile = new File([largeContent], 'large.pdf', {
        type: 'application/pdf',
      })
      formData.append('file', largeFile)

      const result = await uploadFile(formData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Filen är för stor (max 25MB)')
    })

    it('accepts valid PDF files', async () => {
      const formData = new FormData()
      const validFile = new File(['PDF content'], 'test.pdf', {
        type: 'application/pdf',
      })
      formData.append('file', validFile)

      const result = await uploadFile(formData)

      expect(result.success).toBe(true)
      expect(prisma.workspaceFile.create).toHaveBeenCalled()
    })

    it('accepts valid image files', async () => {
      const formData = new FormData()
      const validFile = new File(['image content'], 'test.png', {
        type: 'image/png',
      })
      formData.append('file', validFile)

      const result = await uploadFile(formData)

      expect(result.success).toBe(true)
    })

    it('accepts valid Office documents', async () => {
      const formData = new FormData()
      const validFile = new File(['doc content'], 'test.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
      formData.append('file', validFile)

      const result = await uploadFile(formData)

      expect(result.success).toBe(true)
    })
  })

  describe('category handling', () => {
    it('defaults to OVRIGT when no category provided', async () => {
      const formData = new FormData()
      const validFile = new File(['content'], 'test.pdf', {
        type: 'application/pdf',
      })
      formData.append('file', validFile)

      await uploadFile(formData)

      expect(prisma.workspaceFile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            category: 'OVRIGT',
          }),
        })
      )
    })

    it('uses provided category', async () => {
      const formData = new FormData()
      const validFile = new File(['content'], 'test.pdf', {
        type: 'application/pdf',
      })
      formData.append('file', validFile)
      formData.append('category', 'BEVIS')

      await uploadFile(formData)

      expect(prisma.workspaceFile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            category: 'BEVIS',
          }),
        })
      )
    })
  })
})

describe('deleteFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error when file not found', async () => {
    vi.mocked(prisma.workspaceFile.findFirst).mockResolvedValue(null)

    const result = await deleteFile('nonexistent')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Filen hittades inte')
  })

  it('allows uploader to delete their own file', async () => {
    vi.mocked(prisma.workspaceFile.findFirst).mockResolvedValue(
      mockFile as never
    )
    vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue({
      role: 'MEMBER',
    } as never)
    vi.mocked(prisma.workspaceFile.delete).mockResolvedValue(mockFile as never)

    const result = await deleteFile('file_123')

    expect(result.success).toBe(true)
    expect(prisma.workspaceFile.delete).toHaveBeenCalled()
  })

  it('allows admin to delete any file', async () => {
    const otherUserFile = { ...mockFile, uploaded_by: 'other_user' }
    vi.mocked(prisma.workspaceFile.findFirst).mockResolvedValue(
      otherUserFile as never
    )
    vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue({
      role: 'ADMIN',
    } as never)
    vi.mocked(prisma.workspaceFile.delete).mockResolvedValue(
      otherUserFile as never
    )

    const result = await deleteFile('file_123')

    expect(result.success).toBe(true)
  })

  it('allows owner to delete any file', async () => {
    const otherUserFile = { ...mockFile, uploaded_by: 'other_user' }
    vi.mocked(prisma.workspaceFile.findFirst).mockResolvedValue(
      otherUserFile as never
    )
    vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue({
      role: 'OWNER',
    } as never)
    vi.mocked(prisma.workspaceFile.delete).mockResolvedValue(
      otherUserFile as never
    )

    const result = await deleteFile('file_123')

    expect(result.success).toBe(true)
  })

  it('denies non-uploader member from deleting others files', async () => {
    const otherUserFile = { ...mockFile, uploaded_by: 'other_user' }
    vi.mocked(prisma.workspaceFile.findFirst).mockResolvedValue(
      otherUserFile as never
    )
    vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue({
      role: 'MEMBER',
    } as never)

    const result = await deleteFile('file_123')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Du har inte behörighet att radera denna fil')
  })
})

describe('updateFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.workspaceFile.findFirst).mockResolvedValue(
      mockFile as never
    )
    vi.mocked(prisma.workspaceFile.update).mockResolvedValue(mockFile as never)
  })

  it('returns error when file not found', async () => {
    vi.mocked(prisma.workspaceFile.findFirst).mockResolvedValue(null)

    const result = await updateFile('nonexistent', { filename: 'new.pdf' })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Filen hittades inte')
  })

  it('updates filename', async () => {
    const result = await updateFile('file_123', { filename: 'renamed.pdf' })

    expect(result.success).toBe(true)
    expect(prisma.workspaceFile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          filename: 'renamed.pdf',
        }),
      })
    )
  })

  it('updates category', async () => {
    const result = await updateFile('file_123', { category: 'BEVIS' })

    expect(result.success).toBe(true)
    expect(prisma.workspaceFile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          category: 'BEVIS',
        }),
      })
    )
  })

  it('validates category enum', async () => {
    // @ts-expect-error - Testing invalid category
    const result = await updateFile('file_123', { category: 'INVALID' })

    expect(result.success).toBe(false)
  })
})

describe('linkFileToTask', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.workspaceFile.findFirst).mockResolvedValue(
      mockFile as never
    )
    vi.mocked(prisma.task.findFirst).mockResolvedValue(mockTask as never)
    vi.mocked(prisma.fileTaskLink.upsert).mockResolvedValue({} as never)
  })

  it('returns error when file not found', async () => {
    vi.mocked(prisma.workspaceFile.findFirst).mockResolvedValue(null)

    const result = await linkFileToTask('file_123', 'task_123')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Filen hittades inte')
  })

  it('returns error when task not found', async () => {
    vi.mocked(prisma.task.findFirst).mockResolvedValue(null)

    const result = await linkFileToTask('file_123', 'task_123')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Uppgiften hittades inte')
  })

  it('creates link successfully', async () => {
    const result = await linkFileToTask('file_123', 'task_123')

    expect(result.success).toBe(true)
    expect(prisma.fileTaskLink.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          file_id_task_id: { file_id: 'file_123', task_id: 'task_123' },
        },
        create: expect.objectContaining({
          file_id: 'file_123',
          task_id: 'task_123',
        }),
      })
    )
  })
})

describe('linkFileToListItem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.workspaceFile.findFirst).mockResolvedValue(
      mockFile as never
    )
    vi.mocked(prisma.lawListItem.findFirst).mockResolvedValue(
      mockListItem as never
    )
    vi.mocked(prisma.fileListItemLink.upsert).mockResolvedValue({} as never)
  })

  it('returns error when file not found', async () => {
    vi.mocked(prisma.workspaceFile.findFirst).mockResolvedValue(null)

    const result = await linkFileToListItem('file_123', 'listitem_123')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Filen hittades inte')
  })

  it('returns error when list item not found', async () => {
    vi.mocked(prisma.lawListItem.findFirst).mockResolvedValue(null)

    const result = await linkFileToListItem('file_123', 'listitem_123')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Lagpunkten hittades inte')
  })

  it('creates link successfully', async () => {
    const result = await linkFileToListItem('file_123', 'listitem_123')

    expect(result.success).toBe(true)
    expect(prisma.fileListItemLink.upsert).toHaveBeenCalled()
  })
})

describe('unlinkFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.workspaceFile.findFirst).mockResolvedValue(
      mockFile as never
    )
    vi.mocked(prisma.fileTaskLink.deleteMany).mockResolvedValue({
      count: 1,
    } as never)
    vi.mocked(prisma.fileListItemLink.deleteMany).mockResolvedValue({
      count: 1,
    } as never)
  })

  it('unlinks from task', async () => {
    const result = await unlinkFile('file_123', 'task', 'task_123')

    expect(result.success).toBe(true)
    expect(prisma.fileTaskLink.deleteMany).toHaveBeenCalledWith({
      where: { file_id: 'file_123', task_id: 'task_123' },
    })
  })

  it('unlinks from list item', async () => {
    const result = await unlinkFile('file_123', 'list_item', 'listitem_123')

    expect(result.success).toBe(true)
    expect(prisma.fileListItemLink.deleteMany).toHaveBeenCalledWith({
      where: { file_id: 'file_123', list_item_id: 'listitem_123' },
    })
  })

  it('returns error when file not found', async () => {
    vi.mocked(prisma.workspaceFile.findFirst).mockResolvedValue(null)

    const result = await unlinkFile('nonexistent', 'task', 'task_123')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Filen hittades inte')
  })
})

describe('getWorkspaceFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.workspaceFile.count).mockResolvedValue(1)
    vi.mocked(prisma.workspaceFile.findMany).mockResolvedValue([
      mockFile,
    ] as never)
  })

  it('returns paginated files', async () => {
    const result = await getWorkspaceFiles(undefined, { page: 1, limit: 10 })

    expect(result.success).toBe(true)
    expect(result.data?.files).toHaveLength(1)
    expect(result.data?.pagination.page).toBe(1)
    expect(result.data?.pagination.limit).toBe(10)
  })

  it('filters by category', async () => {
    await getWorkspaceFiles({ category: 'BEVIS' })

    expect(prisma.workspaceFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          category: 'BEVIS',
        }),
      })
    )
  })

  it('filters by search term', async () => {
    await getWorkspaceFiles({ search: 'test' })

    expect(prisma.workspaceFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ filename: expect.any(Object) }),
          ]),
        }),
      })
    )
  })

  it('limits to max 100 results per page', async () => {
    const result = await getWorkspaceFiles(undefined, { limit: 500 })

    expect(result.data?.pagination.limit).toBe(100)
  })
})

describe('getFileDownloadUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.workspaceFile.findFirst).mockResolvedValue(
      mockFile as never
    )
  })

  it('returns signed URL for valid file', async () => {
    const result = await getFileDownloadUrl('file_123')

    expect(result.success).toBe(true)
    expect(result.data?.url).toBe('https://signed-url.example.com')
  })

  it('returns error when file not found', async () => {
    vi.mocked(prisma.workspaceFile.findFirst).mockResolvedValue(null)

    const result = await getFileDownloadUrl('nonexistent')

    expect(result.success).toBe(false)
    expect(result.error).toBe('Filen hittades inte')
  })
})

describe('deleteFilesBulk', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue({
      role: 'ADMIN',
    } as never)
    vi.mocked(prisma.workspaceFile.findMany).mockResolvedValue([
      mockFile,
    ] as never)
    vi.mocked(prisma.workspaceFile.deleteMany).mockResolvedValue({
      count: 1,
    } as never)
  })

  it('enforces max 50 files limit', async () => {
    const fileIds = Array.from({ length: 51 }, (_, i) => `file_${i}`)

    const result = await deleteFilesBulk(fileIds)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Max 50 filer kan raderas åt gången')
  })

  it('deletes files for admin', async () => {
    const result = await deleteFilesBulk(['file_123'])

    expect(result.success).toBe(true)
    expect(result.data?.deleted).toBe(1)
  })

  it('only deletes own files for non-admin', async () => {
    vi.mocked(prisma.workspaceMember.findFirst).mockResolvedValue({
      role: 'MEMBER',
    } as never)

    await deleteFilesBulk(['file_123', 'file_456'])

    // Should filter by uploaded_by for non-admins
    expect(prisma.workspaceFile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          uploaded_by: 'user_123',
        }),
      })
    )
  })
})
