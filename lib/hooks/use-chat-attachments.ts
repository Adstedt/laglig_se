'use client'

/**
 * Story 19.1: chat attachment state + upload orchestration.
 *
 * Owns the pending-attachment list for a single outgoing message: validates
 * count + a base64-aware aggregate size (so the actual Claude request can't
 * exceed 32 MB), uploads each file via `uploadFile` (category CHAT_ATTACHMENT),
 * and exposes the list for chips + the send path. `validateAttachmentBatch` is
 * a pure export so the size/count logic is unit-testable.
 */

import { useState, useCallback } from 'react'
import { uploadFile, deleteFile } from '@/app/actions/files'
import type { ChatAttachmentMeta } from './use-chat-interface'

export type PendingAttachment = ChatAttachmentMeta & { sizeBytes: number }

const MAX_FILES = 5
const MAX_REQUEST_BYTES = 32 * 1024 * 1024 // 32 MB — Claude request ceiling
const PDF_INLINE_MAX = 10 * 1024 * 1024
const IMAGE_INLINE_MAX = 5 * 1024 * 1024
const BASE64_FACTOR = 1.37 // base64 inflation for inlined bytes
const IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/gif'])

/** Estimated contribution to the Claude request (base64-bound files inflate). */
function requestWeight(mimeType: string | null, size: number): number {
  const mime = mimeType ?? ''
  const inlined =
    (mime === 'application/pdf' && size <= PDF_INLINE_MAX) ||
    (IMAGE_MIMES.has(mime) && size <= IMAGE_INLINE_MAX)
  // Non-inlined files travel as extracted text (smaller); raw size is a safe upper bound.
  return inlined ? Math.ceil(size * BASE64_FACTOR) : size
}

/**
 * Validate adding `incoming` files to the `existing` pending set.
 * Returns a Swedish error string, or null if the batch is allowed. Pure.
 */
export function validateAttachmentBatch(
  existing: Pick<PendingAttachment, 'mimeType' | 'sizeBytes'>[],
  incoming: { type: string; size: number }[]
): string | null {
  if (existing.length + incoming.length > MAX_FILES) {
    return 'Max 5 filer per meddelande.'
  }
  const existingWeight = existing.reduce(
    (sum, a) => sum + requestWeight(a.mimeType, a.sizeBytes),
    0
  )
  const incomingWeight = incoming.reduce(
    (sum, f) => sum + requestWeight(f.type, f.size),
    0
  )
  if (existingWeight + incomingWeight > MAX_REQUEST_BYTES) {
    return 'Bifogade filer överstiger gränsen på 32 MB. Ta bort en eller flera filer och försök igen.'
  }
  return null
}

export interface UseChatAttachmentsReturn {
  pending: PendingAttachment[]
  uploading: boolean
  error: string | null
  addFiles: (_files: File[]) => Promise<void>
  remove: (_fileId: string) => void
  clear: () => void
}

export function useChatAttachments(): UseChatAttachmentsReturn {
  const [pending, setPending] = useState<PendingAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addFiles = useCallback(
    async (files: File[]) => {
      setError(null)
      if (files.length === 0) return

      // Validate against the current pending set (functional read via setState
      // callback would be racy with the async upload, so read from state here —
      // pending is stable within the click/drop handler invocation).
      const validationError = validateAttachmentBatch(
        pending.map((a) => ({ mimeType: a.mimeType, sizeBytes: a.sizeBytes })),
        files.map((f) => ({ type: f.type, size: f.size }))
      )
      if (validationError) {
        setError(validationError)
        return
      }

      setUploading(true)
      try {
        for (const file of files) {
          const fd = new FormData()
          fd.append('file', file)
          fd.append('category', 'CHAT_ATTACHMENT')
          const res = await uploadFile(fd)
          if (res.success && res.data) {
            setPending((prev) => [
              ...prev,
              {
                fileId: res.data!.id,
                filename: res.data!.filename,
                mimeType: file.type || null,
                sizeBytes: file.size,
              },
            ])
          } else {
            setError(res.error ?? 'Uppladdningen misslyckades. Försök igen.')
          }
        }
      } finally {
        setUploading(false)
      }
    },
    [pending]
  )

  const remove = useCallback((fileId: string) => {
    setPending((prev) => prev.filter((a) => a.fileId !== fileId))
    // Best-effort orphan cleanup — never block the UI on it.
    void deleteFile(fileId).catch(() => {})
  }, [])

  const clear = useCallback(() => setPending([]), [])

  return { pending, uploading, error, addFiles, remove, clear }
}
