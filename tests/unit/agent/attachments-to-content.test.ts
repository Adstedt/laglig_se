/**
 * Unit tests for attachmentsToContent (Story 19.1, Task 3 + 8).
 * Mocks Prisma, the Supabase storage client, and extractFile.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceFile: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}))

const mockDownload = vi.fn()
vi.mock('@/lib/supabase/storage', () => ({
  getStorageClient: () => ({
    storage: { from: () => ({ download: mockDownload }) },
  }),
}))

vi.mock('@/lib/documents/extract-file', () => ({
  extractFile: vi.fn(),
}))

import { prisma } from '@/lib/prisma'
import { extractFile } from '@/lib/documents/extract-file'
import { attachmentsToContent } from '@/lib/agent/attachments-to-content'

const mockPrisma = prisma as unknown as {
  workspaceFile: {
    findFirst: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
}
const mockExtract = extractFile as ReturnType<typeof vi.fn>

const WS = 'ws-1'

function file(over: Record<string, unknown> = {}) {
  return {
    id: 'file-1',
    filename: 'doc.pdf',
    workspace_id: WS,
    is_folder: false,
    mime_type: 'application/pdf',
    file_size: 1_000_000,
    storage_path: 'ws-1/doc.pdf',
    extracted_text: null,
    extraction_status: 'PENDING',
    ...over,
  }
}

/** A Blob-like whose arrayBuffer() yields the given bytes. */
function blob(bytes = 'BYTES') {
  return {
    arrayBuffer: async () => new TextEncoder().encode(bytes).buffer,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.workspaceFile.update.mockResolvedValue({})
  mockDownload.mockResolvedValue({ data: blob(), error: null })
})

describe('attachmentsToContent — base64 paths', () => {
  it('PDF ≤ 10 MB → file block with base64 data', async () => {
    mockPrisma.workspaceFile.findFirst.mockResolvedValue(
      file({ mime_type: 'application/pdf', file_size: 5_000_000 })
    )
    const [b] = await attachmentsToContent(['file-1'], WS)
    expect(b).toMatchObject({
      type: 'file',
      mediaType: 'application/pdf',
      filename: 'doc.pdf',
    })
    expect((b as { data: string }).data).toBe(
      Buffer.from('BYTES').toString('base64')
    )
  })

  it('PNG ≤ 5 MB → image block', async () => {
    mockPrisma.workspaceFile.findFirst.mockResolvedValue(
      file({ filename: 'a.png', mime_type: 'image/png', file_size: 1_000 })
    )
    const [b] = await attachmentsToContent(['file-1'], WS)
    expect(b).toMatchObject({ type: 'image', mediaType: 'image/png' })
  })

  it('PNG > 5 MB → text placeholder (no download)', async () => {
    mockPrisma.workspaceFile.findFirst.mockResolvedValue(
      file({
        filename: 'big.png',
        mime_type: 'image/png',
        file_size: 6_000_000,
      })
    )
    const [b] = await attachmentsToContent(['file-1'], WS)
    expect(b).toMatchObject({ type: 'text' })
    expect((b as { text: string }).text).toMatch(/big\.png.*för stor/)
  })
})

describe('attachmentsToContent — text path + on-demand extraction (AC 9)', () => {
  it('PDF > 10 MB with extracted_text → prefixed text block (no extraction)', async () => {
    mockPrisma.workspaceFile.findFirst.mockResolvedValue(
      file({
        mime_type: 'application/pdf',
        file_size: 20_000_000,
        extracted_text: 'innehåll',
        extraction_status: 'DONE',
      })
    )
    const [b] = await attachmentsToContent(['file-1'], WS)
    expect((b as { text: string }).text).toBe('[Fil: doc.pdf]\ninnehåll')
    expect(mockExtract).not.toHaveBeenCalled()
  })

  it('DOCX with no text + non-DONE status → on-demand extraction → text block', async () => {
    mockPrisma.workspaceFile.findFirst.mockResolvedValue(
      file({
        filename: 'p.docx',
        mime_type:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extracted_text: null,
        extraction_status: 'PENDING',
      })
    )
    mockExtract.mockResolvedValue({ status: 'DONE', markdown: 'utvunnen text' })
    const [b] = await attachmentsToContent(['file-1'], WS)
    expect(mockExtract).toHaveBeenCalledTimes(1)
    expect((b as { text: string }).text).toBe('[Fil: p.docx]\nutvunnen text')
    // best-effort cache write
    expect(mockPrisma.workspaceFile.update).toHaveBeenCalledTimes(1)
  })

  it('on-demand extraction still empty → placeholder', async () => {
    mockPrisma.workspaceFile.findFirst.mockResolvedValue(
      file({
        filename: 'x.docx',
        mime_type:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extraction_status: 'PROCESSING',
      })
    )
    mockExtract.mockResolvedValue({ status: 'FAILED', markdown: null })
    const [b] = await attachmentsToContent(['file-1'], WS)
    expect((b as { text: string }).text).toBe(
      '[Fil: x.docx — innehåll ej tillgängligt]'
    )
  })

  it('text-path file already DONE but empty text → placeholder, no extraction', async () => {
    mockPrisma.workspaceFile.findFirst.mockResolvedValue(
      file({
        filename: 'empty.docx',
        mime_type:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        extracted_text: '',
        extraction_status: 'DONE',
      })
    )
    const [b] = await attachmentsToContent(['file-1'], WS)
    expect((b as { text: string }).text).toMatch(/innehåll ej tillgängligt/)
    expect(mockExtract).not.toHaveBeenCalled()
  })
})

describe('attachmentsToContent — isolation + edge cases (AC 10)', () => {
  it('wrong workspace (findFirst null due to scoped where) → placeholder, no download', async () => {
    mockPrisma.workspaceFile.findFirst.mockResolvedValue(null)
    const [b] = await attachmentsToContent(['file-1'], WS)
    expect((b as { text: string }).text).toMatch(/hittades inte/)
    expect(mockDownload).not.toHaveBeenCalled()
    // the read is scoped to the caller's workspace
    expect(mockPrisma.workspaceFile.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'file-1', workspace_id: WS },
      })
    )
  })

  it('empty fileIds → empty array (no DB call)', async () => {
    const out = await attachmentsToContent([], WS)
    expect(out).toEqual([])
    expect(mockPrisma.workspaceFile.findFirst).not.toHaveBeenCalled()
  })

  it('maps multiple files in order', async () => {
    mockPrisma.workspaceFile.findFirst
      .mockResolvedValueOnce(file({ id: 'a', file_size: 1000 }))
      .mockResolvedValueOnce(null)
    const out = await attachmentsToContent(['a', 'b'], WS)
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ type: 'file' })
    expect((out[1] as { text: string }).text).toMatch(/hittades inte/)
  })
})
