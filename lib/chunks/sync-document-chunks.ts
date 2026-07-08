/**
 * Chunk lifecycle sync — delete old chunks + create new ones atomically
 * Story 14.2, Task 7 (AC: 16)
 * Story 14.3, Task 5 (AC: 14) — incremental context prefix + embedding generation
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import type { CanonicalDocumentJson } from '@/lib/transforms/document-json-schema'
import { chunkDocument } from './chunk-document'
import { generateContextPrefixes } from './generate-context-prefixes'
import { generateEmbeddingsBatch, vectorToString } from './embed-chunks'

export interface SyncResult {
  documentId: string
  chunksDeleted: number
  chunksCreated: number
  chunksEmbedded: number
  duration: number
}

const ALLOWED_CONTENT_TYPES = new Set([
  'SFS_LAW',
  'AGENCY_REGULATION',
  // Story 2.6: EU legislation is chunked/embedded once normalized (markdown_content present).
  'EU_REGULATION',
  'EU_DIRECTIVE',
])

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
      slug: true,
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
      chunksEmbedded: 0,
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
      chunksEmbedded: 0,
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
      chunksEmbedded: 0,
      duration: Date.now() - start,
    }
  }

  const chunks = chunkDocument({
    documentId: doc.id,
    title: doc.title,
    documentNumber: doc.document_number,
    contentType: doc.content_type,
    slug: doc.slug,
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

  // Incremental context prefix + embedding generation (Story 14.3)
  // Non-blocking: if LLM/embedding fails, log error but don't roll back chunks.
  // Runs even without markdown_content — markdown only feeds prefix generation;
  // embeddings must never be gated on it (html-only docs were left unembedded).
  let chunksEmbedded = 0
  if (created.count > 0) {
    try {
      chunksEmbedded = await generateEmbeddingsForDocument(
        documentId,
        doc.title,
        doc.document_number,
        doc.markdown_content
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(
        `[sync-chunks] Embedding failed for ${doc.document_number} — retryable via batch script: ${msg}`
      )
    }
  }

  return {
    documentId,
    chunksDeleted: deleted.count,
    chunksCreated: created.count,
    chunksEmbedded,
    duration: Date.now() - start,
  }
}

/**
 * Generate context prefixes and embeddings for all chunks of a document.
 * Called after chunk creation during incremental sync.
 */
async function generateEmbeddingsForDocument(
  documentId: string,
  title: string,
  documentNumber: string,
  markdownContent: string | null
): Promise<number> {
  // Load newly created chunks
  const chunks = await prisma.contentChunk.findMany({
    where: { source_id: documentId },
    select: { id: true, path: true, content: true, contextual_header: true },
    orderBy: { id: 'asc' },
  })

  if (chunks.length === 0) return 0

  // Phase 1: Generate context prefixes — best-effort. A Haiku failure (or
  // missing markdown) must NOT abort embedding: that exact failure mode left
  // 24K chunks of 76 large laws invisible to retrieval (2026-06/07 backlog).
  // Degrade to embedding without prefixes instead.
  let prefixes = new Map<string, string>()
  if (markdownContent) {
    try {
      prefixes = await generateContextPrefixes(
        { markdown: markdownContent, title, documentNumber },
        chunks.map((c) => ({ path: c.path, content: c.content }))
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(
        `[sync-chunks] ${documentNumber}: prefix generation failed — embedding without prefixes: ${msg}`
      )
    }
  }

  // Write prefixes to DB
  for (const chunk of chunks) {
    const prefix = prefixes.get(chunk.path)
    if (prefix) {
      await prisma.contentChunk.update({
        where: { id: chunk.id },
        data: { context_prefix: prefix },
      })
    }
  }

  // Phase 2: Generate embeddings in batches of 100.
  // Embed EVERY chunk — a context prefix improves the vector, but a missing
  // prefix must NOT leave the chunk unembedded and invisible to retrieval.
  // Prefix generation can yield nothing on very large docs (e.g. the SKOLFS
  // curricula: ~88K-token markdown context → empty Haiku prefix response);
  // gating embeddings on prefixes there silently dropped the whole document
  // from search. Prefixes remain best-effort; embeddings are guaranteed.
  // [Story 9.7] Re-sync once prefix-gen is improved to upgrade the vectors.
  const BATCH_SIZE = 100
  let embedded = 0
  const prefixed = chunks.filter((c) => prefixes.has(c.path)).length

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    const inputs = batch.map((c) => ({
      text: c.content,
      contextPrefix: prefixes.get(c.path) ?? '',
      contextualHeader: c.contextual_header,
    }))

    const result = await generateEmbeddingsBatch(inputs)

    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j]!
      const embedding = result.embeddings[j]!
      await prisma.$executeRaw`
        UPDATE content_chunks
        SET embedding = ${vectorToString(embedding)}::vector
        WHERE id = ${chunk.id}
      `
    }

    embedded += batch.length
  }

  if (prefixed < chunks.length) {
    console.warn(
      `[sync-chunks] ${documentNumber}: ${prefixed}/${chunks.length} chunks got a context prefix; ${chunks.length - prefixed} embedded without one (prefix-gen shortfall — re-sync after prefix fix to upgrade)`
    )
  }

  return embedded
}

/**
 * Embed chunks left with embedding IS NULL by a previous failed or interrupted
 * sync (Haiku outage, cron timeout mid-document). Does NOT re-chunk or
 * regenerate prefixes — uses whatever context_prefix already exists, so it is
 * cheap enough for the cron to run as a self-healing pass.
 */
export async function embedMissingChunks(documentId: string): Promise<number> {
  const chunks = await prisma.$queryRaw<
    Array<{
      id: string
      content: string
      context_prefix: string | null
      contextual_header: string
    }>
  >`
    SELECT id, content, context_prefix, contextual_header
    FROM content_chunks
    WHERE source_id = ${documentId} AND embedding IS NULL
    ORDER BY id ASC
  `

  if (chunks.length === 0) return 0

  const BATCH_SIZE = 100
  let embedded = 0

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    const inputs = batch.map((c) => ({
      text: c.content,
      contextPrefix: c.context_prefix ?? '',
      contextualHeader: c.contextual_header,
    }))

    const result = await generateEmbeddingsBatch(inputs)

    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j]!
      const embedding = result.embeddings[j]!
      await prisma.$executeRaw`
        UPDATE content_chunks
        SET embedding = ${vectorToString(embedding)}::vector, updated_at = NOW()
        WHERE id = ${chunk.id}
      `
    }

    embedded += batch.length
  }

  return embedded
}
