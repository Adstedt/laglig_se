/**
 * Unit tests for validateAttachmentBatch (Story 19.1, Task 4 + 8).
 * Pure count + base64-aware size validation.
 */

import { describe, it, expect, vi } from 'vitest'

// The hook module imports server actions; mock them so the pure export is testable.
vi.mock('@/app/actions/files', () => ({
  uploadFile: vi.fn(),
  deleteFile: vi.fn(),
}))

import { validateAttachmentBatch } from '@/lib/hooks/use-chat-attachments'

const MB = 1024 * 1024

describe('validateAttachmentBatch', () => {
  it('allows a small batch under the limits', () => {
    expect(
      validateAttachmentBatch([], [{ type: 'application/pdf', size: 2 * MB }])
    ).toBeNull()
  })

  it('rejects a 6th file', () => {
    const existing = Array.from({ length: 5 }, () => ({
      mimeType: 'application/pdf',
      sizeBytes: 1 * MB,
    }))
    expect(
      validateAttachmentBatch(existing, [
        { type: 'application/pdf', size: 1 * MB },
      ])
    ).toMatch(/Max 5 filer/)
  })

  it('rejects when base64-inflated PDFs exceed 32 MB', () => {
    // 3 × 10 MB PDFs → each ×1.37 = 13.7 MB → ~41 MB request weight
    const incoming = Array.from({ length: 3 }, () => ({
      type: 'application/pdf',
      size: 10 * MB,
    }))
    expect(validateAttachmentBatch([], incoming)).toMatch(/32 MB/)
  })

  it('counts large (non-inlined) files at raw size, allowing a mixed batch under cap', () => {
    // 20 MB PDF (>10 MB → text path, raw 20 MB) + 5 MB image (×1.37 = 6.85 MB) ≈ 26.85 MB
    const out = validateAttachmentBatch(
      [],
      [
        { type: 'application/pdf', size: 20 * MB },
        { type: 'image/png', size: 5 * MB },
      ]
    )
    expect(out).toBeNull()
  })

  it('accounts for the existing pending set in the aggregate', () => {
    const existing = [{ mimeType: 'application/pdf', sizeBytes: 9 * MB }] // ×1.37 ≈ 12.3 MB
    // adding two more 9 MB PDFs → ~24.6 MB more → ~36.9 MB total → over 32
    expect(
      validateAttachmentBatch(existing, [
        { type: 'application/pdf', size: 9 * MB },
        { type: 'application/pdf', size: 9 * MB },
      ])
    ).toMatch(/32 MB/)
  })
})
