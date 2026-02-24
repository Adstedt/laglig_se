/**
 * Chunk lifecycle sync — delete old chunks + create new ones atomically
 * Story 14.2, Task 7 (AC: 16)
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { CanonicalDocumentJson } from '@/lib/transforms/document-json-schema'
import { chunkDocument } from './chunk-document'

export interface SyncResult {
  documentId: string
  chunksDeleted: number
  chunksCreated: number
  duration: number
}

const ALLOWED_CONTENT_TYPES = new Set(['SFS_LAW', 'AGENCY_REGULATION'])

/**
 * Sync chunks for a single document.
 * Deletes all existing chunks and creates new ones in a single transaction.
 */
export async function syncDocumentChunks(
  documentId: string
): Promise<SyncResult> {
  const start = Date.now()

  const doc = await prisma.legalDocument.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      title: true,
      document_number: true,
      content_type: true,
      json_content: true,
      markdown_content: true,
      html_content: true,
    },
  })

  if (!doc) {
    console.warn(`[sync-chunks] Document not found: ${documentId}`)
    return {
      documentId,
      chunksDeleted: 0,
      chunksCreated: 0,
      duration: Date.now() - start,
    }
  }

  // Guard: only chunk SFS_LAW and AGENCY_REGULATION
  if (!ALLOWED_CONTENT_TYPES.has(doc.content_type)) {
    console.warn(
      `[sync-chunks] Skipping ${doc.document_number} — content_type ${doc.content_type} not in scope`
    )
    return {
      documentId,
      chunksDeleted: 0,
      chunksCreated: 0,
      duration: Date.now() - start,
    }
  }

  const jsonContent = doc.json_content as CanonicalDocumentJson | null

  if (!jsonContent && !doc.markdown_content && !doc.html_content) {
    console.warn(`[sync-chunks] No content to chunk for ${doc.document_number}`)
    return {
      documentId,
      chunksDeleted: 0,
      chunksCreated: 0,
      duration: Date.now() - start,
    }
  }

  const chunks = chunkDocument({
    documentId: doc.id,
    title: doc.title,
    documentNumber: doc.document_number,
    jsonContent,
    markdownContent: doc.markdown_content,
    htmlContent: doc.html_content,
  })

  // Map null metadata to Prisma's DbNull sentinel
  const prismaChunks = chunks.map((c) => ({
    ...c,
    metadata:
      c.metadata === null
        ? Prisma.DbNull
        : (c.metadata as Prisma.InputJsonValue),
  }))

  // Atomic: delete old + create new
  const [deleted, created] = await prisma.$transaction([
    prisma.contentChunk.deleteMany({
      where: { source_type: 'LEGAL_DOCUMENT', source_id: documentId },
    }),
    prisma.contentChunk.createMany({
      data: prismaChunks,
    }),
  ])

  return {
    documentId,
    chunksDeleted: deleted.count,
    chunksCreated: created.count,
    duration: Date.now() - start,
  }
}
