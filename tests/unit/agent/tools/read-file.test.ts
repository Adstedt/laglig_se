/**
 * Unit tests for the read_file tool (Story 19.2).
 * Mocks Prisma, the Supabase storage client, and extractFile (mirrors
 * tests/unit/agent/attachments-to-content.test.ts — same routing core).
 *
 * Covers both halves of the tool:
 *   - execute      → lean envelope (NO base64) / wrapToolError on miss/folder
 *   - toModelOutput → native content blocks (file-data / image-data / text) for the model
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
import { createReadFileTool } from '@/lib/agent/tools/read-file'

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
  return { arrayBuffer: async () => new TextEncoder().encode(bytes).buffer }
}

const tool = createReadFileTool(WS)
const execute = tool.execute as (
  _input: { fileId: string },
  _opts: unknown
) => Promise<Record<string, unknown>>
const toModelOutput = tool.toModelOutput as (_args: {
  toolCallId: string
  input: { fileId: string }
  output: unknown
}) => Promise<{ type: string; value: unknown }>

const opts = {
  toolCallId: 'tc-1',
  messages: [],
  abortSignal: undefined as unknown as AbortSignal,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPrisma.workspaceFile.update.mockResolvedValue({})
  mockDownload.mockResolvedValue({ data: blob(), error: null })
})

describe('read_file — execute (lean envelope, AC 3/6)', () => {
  it('PDF ≤ 10 MB → contentKind "pdf", citationKey = filename, NO base64, no download', async () => {
    mockPrisma.workspaceFile.findFirst.mockResolvedValue(
      file({ mime_type: 'application/pdf', file_size: 5_000_000 })
    )
    const result = await execute({ fileId: 'file-1' }, opts)

    expect(result._meta).toMatchObject({ tool: 'read_file' })
    const data = result.data as Record<string, unknown>
    expect(data.contentKind).toBe('pdf')
    expect(data.citationKey).toBe('doc.pdf')
    expect(data.fileId).toBe('file-1')
    // lean: execute never downloads and the envelope carries no bytes/base64
    expect(mockDownload).not.toHaveBeenCalled()
    expect(data).not.toHaveProperty('data')
    expect(data).not.toHaveProperty('bytes')
    expect(JSON.stringify(result)).not.toContain(
      Buffer.from('BYTES').toString('base64')
    )
  })

  it('cross-workspace / missing id → wrapToolError, scoped read, no download', async () => {
    mockPrisma.workspaceFile.findFirst.mockResolvedValue(null)
    const result = await execute({ fileId: 'file-1' }, opts)

    expect(result.error).toBe(true)
    expect(result.message).toBe('Filen hittades inte.')
    expect(mockDownload).not.toHaveBeenCalled()
    expect(mockPrisma.workspaceFile.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'file-1', workspace_id: WS } })
    )
  })

  it('folder → wrapToolError ("mapp")', async () => {
    mockPrisma.workspaceFile.findFirst.mockResolvedValue(
      file({ is_folder: true })
    )
    const result = await execute({ fileId: 'file-1' }, opts)
    expect(result.error).toBe(true)
    expect(result.message as string).toMatch(/mapp/i)
  })

  it('DOCX → contentKind "text"', async () => {
    mockPrisma.workspaceFile.findFirst.mockResolvedValue(
      file({
        filename: 'p.docx',
        mime_type:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
    )
    const result = await execute({ fileId: 'file-1' }, opts)
    expect((result.data as Record<string, unknown>).contentKind).toBe('text')
  })

  it('oversized image → contentKind "unavailable"', async () => {
    mockPrisma.workspaceFile.findFirst.mockResolvedValue(
      file({
        filename: 'big.png',
        mime_type: 'image/png',
        file_size: 6_000_000,
      })
    )
    const result = await execute({ fileId: 'file-1' }, opts)
    expect((result.data as Record<string, unknown>).contentKind).toBe(
      'unavailable'
    )
  })
})

describe('read_file — toModelOutput (native content, AC 5)', () => {
  it('PDF → file-data document part with base64', async () => {
    mockPrisma.workspaceFile.findFirst.mockResolvedValue(
      file({ mime_type: 'application/pdf', file_size: 5_000_000 })
    )
    const out = await toModelOutput({
      toolCallId: 'tc-1',
      input: { fileId: 'file-1' },
      output: { data: { fileId: 'file-1' }, _meta: {} },
    })
    expect(out.type).toBe('content')
    const part = (out.value as Array<Record<string, unknown>>)[0]
    expect(part).toMatchObject({
      type: 'file-data',
      mediaType: 'application/pdf',
      filename: 'doc.pdf',
    })
    expect(part.data).toBe(Buffer.from('BYTES').toString('base64'))
  })

  it('image → image-data part', async () => {
    mockPrisma.workspaceFile.findFirst.mockResolvedValue(
      file({ filename: 'a.png', mime_type: 'image/png', file_size: 1_000 })
    )
    const out = await toModelOutput({
      toolCallId: 'tc-1',
      input: { fileId: 'file-1' },
      output: { data: {}, _meta: {} },
    })
    const part = (out.value as Array<Record<string, unknown>>)[0]
    expect(part).toMatchObject({ type: 'image-data', mediaType: 'image/png' })
  })

  it('DOCX with no text + non-DONE → on-demand extraction → text part', async () => {
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
    const out = await toModelOutput({
      toolCallId: 'tc-1',
      input: { fileId: 'file-1' },
      output: { data: {}, _meta: {} },
    })
    expect(mockExtract).toHaveBeenCalledTimes(1)
    expect(mockPrisma.workspaceFile.update).toHaveBeenCalledTimes(1)
    const part = (out.value as Array<Record<string, unknown>>)[0]
    expect(part).toMatchObject({
      type: 'text',
      text: '[Fil: p.docx]\nutvunnen text',
    })
  })

  it('error envelope → relays message as text, no resolve/download', async () => {
    const out = await toModelOutput({
      toolCallId: 'tc-1',
      input: { fileId: 'file-1' },
      output: { error: true, message: 'Filen hittades inte.' },
    })
    expect(out).toEqual({ type: 'text', value: 'Filen hittades inte.' })
    expect(mockPrisma.workspaceFile.findFirst).not.toHaveBeenCalled()
    expect(mockDownload).not.toHaveBeenCalled()
  })

  it('error envelope WITH guidance → relays message + guidance (READ-003)', async () => {
    const out = await toModelOutput({
      toolCallId: 'tc-1',
      input: { fileId: 'file-1' },
      output: {
        error: true,
        message: 'Filen hittades inte.',
        guidance: 'Använd search_workspace_files för att hitta filer.',
      },
    })
    expect(out).toEqual({
      type: 'text',
      value:
        'Filen hittades inte.\nAnvänd search_workspace_files för att hitta filer.',
    })
  })

  it('oversized image → text note ("för stor")', async () => {
    mockPrisma.workspaceFile.findFirst.mockResolvedValue(
      file({
        filename: 'big.png',
        mime_type: 'image/png',
        file_size: 6_000_000,
      })
    )
    const out = await toModelOutput({
      toolCallId: 'tc-1',
      input: { fileId: 'file-1' },
      output: { data: {}, _meta: {} },
    })
    expect(out.type).toBe('text')
    expect(out.value as string).toMatch(/big\.png.*för stor/)
    expect(mockDownload).not.toHaveBeenCalled()
  })
})
