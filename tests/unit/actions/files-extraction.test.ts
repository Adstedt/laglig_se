/**
 * Story 17.8 (QA fix TEST-001): unit coverage for the files.ts extraction wiring
 * that the original suite missed — uploadFile's content_hash + extraction_status
 * stamping, and the extractWorkspaceFile manual re-trigger (incl. telemetry).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  fileFindFirst: vi.fn(),
  fileCreate: vi.fn(),
  fileUpdate: vi.fn(),
  usageCreate: vi.fn(),
  upload: vi.fn(),
  download: vi.fn(),
  extractFile: vi.fn(),
  estimateCostUsd: vi.fn(),
  assertQuota: vi.fn(),
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
      create: h.fileCreate,
      update: h.fileUpdate,
    },
    chatUsageEvent: { create: h.usageCreate },
  },
}))
vi.mock('@/lib/supabase/storage', () => ({
  getStorageClient: () => ({
    storage: { from: () => ({ upload: h.upload, download: h.download }) },
  }),
}))
vi.mock('@/lib/usage/storage', () => ({
  assertWithinStorageQuota: h.assertQuota,
  formatBytesSwedish: (n: number) => String(n),
  StorageQuotaExceededError: class extends Error {},
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
// Dynamic imports inside extractWorkspaceFile resolve to these mocks.
vi.mock('@/lib/documents/extract-file', () => ({ extractFile: h.extractFile }))
vi.mock('@/lib/usage/cost-estimator', () => ({
  estimateCostUsd: h.estimateCostUsd,
}))

import { uploadFile, extractWorkspaceFile } from '@/app/actions/files'

function formWith(name: string, type: string, content = 'hello world') {
  const form = new FormData()
  form.append('file', new File([content], name, { type }))
  return form
}
function createData(): Record<string, unknown> {
  return (h.fileCreate.mock.calls[0]![0] as { data: Record<string, unknown> })
    .data
}

beforeEach(() => {
  vi.clearAllMocks()
  h.fileFindFirst.mockResolvedValue(null) // no parent-folder check, no dup
  h.fileCreate.mockResolvedValue({ id: 'f_1' })
  h.fileUpdate.mockResolvedValue({})
  h.usageCreate.mockResolvedValue({})
  h.upload.mockResolvedValue({ error: null })
  h.assertQuota.mockResolvedValue({ warning: undefined })
  h.estimateCostUsd.mockReturnValue(0.007)
})

describe('uploadFile — extraction stamping (Story 17.8)', () => {
  it('stamps PENDING + a sha256 content_hash for an extractable type (PDF)', async () => {
    const res = await uploadFile(formWith('a.pdf', 'application/pdf'))
    expect(res.success).toBe(true)
    const data = createData()
    expect(data.extraction_status).toBe('PENDING')
    expect(data.content_hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('stamps PENDING for a newly-allowed text type (CSV)', async () => {
    await uploadFile(formWith('data.csv', 'text/csv'))
    expect(createData().extraction_status).toBe('PENDING')
  })

  it('stamps UNSUPPORTED for a non-extractable type (PNG)', async () => {
    await uploadFile(formWith('logo.png', 'image/png'))
    const data = createData()
    expect(data.extraction_status).toBe('UNSUPPORTED')
    expect(data.content_hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('content_hash is deterministic for identical bytes', async () => {
    await uploadFile(formWith('a.pdf', 'application/pdf', 'same'))
    const first = createData().content_hash
    h.fileCreate.mockClear()
    await uploadFile(formWith('b.pdf', 'application/pdf', 'same'))
    expect(createData().content_hash).toBe(first)
  })
})

describe('extractWorkspaceFile — manual re-trigger (Story 17.8)', () => {
  beforeEach(() => {
    h.fileFindFirst.mockResolvedValue({
      id: 'f_1',
      workspace_id: 'ws_1',
      uploaded_by: 'u_1',
      mime_type: 'application/pdf',
      storage_path: 'ws_1/files/f_1/a.pdf',
    })
    h.download.mockResolvedValue({
      data: {
        arrayBuffer: async () => new TextEncoder().encode('bytes').buffer,
      },
      error: null,
    })
  })

  it('re-extracts and writes status + extracted_text', async () => {
    h.extractFile.mockResolvedValue({ status: 'DONE', markdown: '# md' })
    const res = await extractWorkspaceFile('f_1')
    expect(res.success).toBe(true)
    expect(res.data?.status).toBe('DONE')
    expect(h.fileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'f_1' },
        data: expect.objectContaining({
          extraction_status: 'DONE',
          extracted_text: '# md',
        }),
      })
    )
  })

  it('writes FILE_EXTRACTION telemetry scoped to the file owner', async () => {
    h.extractFile.mockResolvedValue({
      status: 'DONE',
      markdown: '# md',
      usage: { model: 'claude-haiku-4-5', inputTokens: 100, outputTokens: 50 },
    })
    await extractWorkspaceFile('f_1')
    expect(h.usageCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          context_type: 'FILE_EXTRACTION',
          workspace_id: 'ws_1',
          user_id: 'u_1',
        }),
      })
    )
  })

  it('writes no telemetry for a non-LLM path (no usage)', async () => {
    h.extractFile.mockResolvedValue({ status: 'DONE', markdown: '# md' })
    await extractWorkspaceFile('f_1')
    expect(h.usageCreate).not.toHaveBeenCalled()
  })

  it('errors and never extracts when the file is not found / out of workspace', async () => {
    h.fileFindFirst.mockResolvedValue(null)
    const res = await extractWorkspaceFile('missing')
    expect(res.success).toBe(false)
    expect(h.extractFile).not.toHaveBeenCalled()
  })
})
