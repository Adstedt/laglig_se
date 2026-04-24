/**
 * Story 21.9 — tests for evidence-hash.ts.
 * Mocks Prisma + Supabase Storage; asserts the SHA-256 output matches
 * what a stand-alone crypto call over the same bytes would produce.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'
import {
  hashFileEvidence,
  hashDocumentEvidence,
} from '@/lib/compliance-audit/evidence-hash'

// ---- Module mocks ----

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceFile: { findUnique: vi.fn() },
    workspaceDocument: { findUnique: vi.fn() },
  },
}))

const mockDownload = vi.fn()
vi.mock('@/lib/supabase/storage', () => ({
  getStorageClient: () => ({
    storage: {
      from: () => ({ download: mockDownload }),
    },
  }),
}))

import { prisma } from '@/lib/prisma'

const FILE_ID = '11111111-1111-4111-8111-111111111111'
const DOCUMENT_ID = '22222222-2222-4222-8222-222222222222'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('hashFileEvidence', () => {
  it('returns sha256 hex of the downloaded bytes', async () => {
    const bytes = Buffer.from('file-contents-for-hashing', 'utf8')
    vi.mocked(prisma.workspaceFile.findUnique).mockResolvedValueOnce({
      id: FILE_ID,
      storage_path: 'some/path.pdf',
    } as unknown as Awaited<ReturnType<typeof prisma.workspaceFile.findUnique>>)
    mockDownload.mockResolvedValueOnce({
      data: {
        arrayBuffer: async () =>
          bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength
          ),
      },
      error: null,
    })

    const expected = createHash('sha256').update(bytes).digest('hex')
    const actual = await hashFileEvidence(FILE_ID)
    expect(actual).toBe(expected)
    expect(actual).toMatch(/^[a-f0-9]{64}$/)
  })

  it('throws when the file row is not found', async () => {
    vi.mocked(prisma.workspaceFile.findUnique).mockResolvedValueOnce(null)
    await expect(hashFileEvidence(FILE_ID)).rejects.toThrow(
      /Bevisfil .* hittades inte/
    )
  })

  it('throws when storage_path is null (folder row)', async () => {
    vi.mocked(prisma.workspaceFile.findUnique).mockResolvedValueOnce({
      id: FILE_ID,
      storage_path: null,
    } as unknown as Awaited<ReturnType<typeof prisma.workspaceFile.findUnique>>)
    await expect(hashFileEvidence(FILE_ID)).rejects.toThrow(
      /har ingen lagringsväg/
    )
  })

  it('throws when the Storage download fails', async () => {
    vi.mocked(prisma.workspaceFile.findUnique).mockResolvedValueOnce({
      id: FILE_ID,
      storage_path: 'some/path.pdf',
    } as unknown as Awaited<ReturnType<typeof prisma.workspaceFile.findUnique>>)
    mockDownload.mockResolvedValueOnce({
      data: null,
      error: { message: '404 Not Found' },
    })
    await expect(hashFileEvidence(FILE_ID)).rejects.toThrow(
      /kunde inte hämtas från lagring/
    )
  })
})

describe('hashDocumentEvidence', () => {
  it('returns sha256 hex of the canonical document JSON', async () => {
    const mockDoc = {
      id: DOCUMENT_ID,
      title: 'Rutin A',
      document_type: 'ROUTINE',
      status: 'APPROVED',
      current_version_number: 2,
      current_version: {
        content_json: { type: 'doc', content: [] },
        content_html: '<p>Hello</p>',
        extracted_text: 'Hello',
      },
    }
    vi.mocked(prisma.workspaceDocument.findUnique).mockResolvedValueOnce(
      mockDoc as unknown as Awaited<
        ReturnType<typeof prisma.workspaceDocument.findUnique>
      >
    )

    const hash = await hashDocumentEvidence(DOCUMENT_ID)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)

    // Determinism: hashing the same doc twice yields the same result.
    vi.mocked(prisma.workspaceDocument.findUnique).mockResolvedValueOnce(
      mockDoc as unknown as Awaited<
        ReturnType<typeof prisma.workspaceDocument.findUnique>
      >
    )
    const hash2 = await hashDocumentEvidence(DOCUMENT_ID)
    expect(hash2).toBe(hash)
  })

  it('throws when the document row is not found', async () => {
    vi.mocked(prisma.workspaceDocument.findUnique).mockResolvedValueOnce(null)
    await expect(hashDocumentEvidence(DOCUMENT_ID)).rejects.toThrow(
      /Styrdokument .* hittades inte/
    )
  })
})
