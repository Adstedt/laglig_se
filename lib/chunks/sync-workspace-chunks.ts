/**
 * Workspace chunk lifecycle sync (Story 17.9)
 *
 * Mirrors `sync-document-chunks.ts` (delete-then-insert + batched embedding) but for
 * workspace-scoped sources. Two deliberate differences from the legal sync:
 *   1. Content is a **param** (the caller provides the file's markdown) — unlike
 *      `syncDocumentChunks`, which fetches its own from `LegalDocument`.
 *   2. No context-prefix LLM step — the `contextual_header` (filename + category)
 *      carries the retrieval context, so embeddings use an empty `contextPrefix`.
 *
 * Story 17.9 wires only the `USER_FILE` path; 17.9b adds `WORKSPACE_DOCUMENT`.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  chunkUserFile,
  type WorkspaceSourceType,
} from './chunk-workspace-document'
import { generateEmbeddingsBatch, vectorToString } from './embed-chunks'

/** Caller-supplied metadata threaded onto every chunk. */
export interface SyncWorkspaceMeta {
  filename: string
  /** `FileCategory` value. */
  category: string
  /** sha256 of the source bytes (Story 17.8) — gates re-embedding (AC 9). */
  content_hash?: string | null
}

export interface SyncWorkspaceResult {
  sourceId: string
  chunksDeleted: number
  chunksCreated: number
  chunksEmbedded: number
  /** true when the content_hash matched existing chunks → re-embed skipped. */
  skipped: boolean
  duration: number
}

const EMBED_BATCH_SIZE = 100

/**
 * Re-index a workspace source: dedupe-check → delete-by-(source_id, source_type) →
 * chunk → embed (≤100/batch) → createMany. Returns counts for logging.
 */
export async function syncWorkspaceChunks(
  sourceId: string,
  sourceType: WorkspaceSourceType,
  workspaceId: string,
  markdown: string | null,
  meta: SyncWorkspaceMeta
): Promise<SyncWorkspaceResult> {
  const start = Date.now()
  const result = (
    over: Partial<SyncWorkspaceResult> = {}
  ): SyncWorkspaceResult => ({
    sourceId,
    chunksDeleted: 0,
    chunksCreated: 0,
    chunksEmbedded: 0,
    skipped: false,
    duration: Date.now() - start,
    ...over,
  })

  // Write-side isolation invariant (AC 2): never index without a workspace.
  if (!workspaceId) {
    throw new Error(
      `[sync-workspace-chunks] workspace_id is required for ${sourceType} ${sourceId} — refusing to index (cross-tenant leak risk)`
    )
  }

  const text = markdown?.trim() ?? ''

  // Nothing to index → clear any stale chunks so a now-empty source isn't retrievable.
  if (!text) {
    const deleted = await prisma.contentChunk.deleteMany({
      where: { source_type: sourceType, source_id: sourceId },
    })
    return result({ chunksDeleted: deleted.count })
  }

  // Dedupe (AC 9): if existing chunks carry the same content_hash, skip the whole
  // re-embed — no wasted OpenAI cost when a file is re-processed unchanged.
  if (meta.content_hash) {
    const existing = await prisma.contentChunk.findFirst({
      where: { source_type: sourceType, source_id: sourceId },
      select: { metadata: true },
    })
    const existingHash = (
      existing?.metadata as { content_hash?: string } | null
    )?.content_hash
    if (existing && existingHash === meta.content_hash) {
      return result({ skipped: true })
    }
  }

  const chunks =
    sourceType === 'USER_FILE'
      ? chunkUserFile({
          fileId: sourceId,
          workspaceId,
          filename: meta.filename,
          category: meta.category,
          markdown: text,
          contentHash: meta.content_hash ?? null,
        })
      : unsupportedSource(sourceType)

  // No chunks produced (e.g. content below the minimum) → clear stale chunks.
  if (chunks.length === 0) {
    const deleted = await prisma.contentChunk.deleteMany({
      where: { source_type: sourceType, source_id: sourceId },
    })
    return result({ chunksDeleted: deleted.count })
  }

  const prismaChunks = chunks.map((c) => ({
    ...c,
    metadata:
      c.metadata === null
        ? Prisma.DbNull
        : (c.metadata as Prisma.InputJsonValue),
  }))

  // Atomic: delete old + create new.
  const [deleted, created] = await prisma.$transaction([
    prisma.contentChunk.deleteMany({
      where: { source_type: sourceType, source_id: sourceId },
    }),
    prisma.contentChunk.createMany({ data: prismaChunks }),
  ])

  // Embed (AC 6, 12, 14). Non-blocking: an embedding failure logs but does not roll
  // back the chunks (they're retryable via a re-sync). The vector column is
  // Unsupported() in Prisma, so it's written via raw UPDATE after createMany.
  let chunksEmbedded = 0
  if (created.count > 0) {
    try {
      chunksEmbedded = await embedWorkspaceChunks(sourceId, sourceType)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(
        `[sync-workspace-chunks] embedding failed for ${sourceType} ${sourceId} — retryable via re-sync: ${msg}`
      )
    }
  }

  return result({
    chunksDeleted: deleted.count,
    chunksCreated: created.count,
    chunksEmbedded,
  })
}

/** Embed all chunks of a source in batches of ≤100, writing each vector via raw UPDATE. */
async function embedWorkspaceChunks(
  sourceId: string,
  sourceType: WorkspaceSourceType
): Promise<number> {
  const chunks = await prisma.contentChunk.findMany({
    where: { source_type: sourceType, source_id: sourceId },
    select: { id: true, content: true, contextual_header: true },
    orderBy: { id: 'asc' },
  })
  if (chunks.length === 0) return 0

  let embedded = 0
  for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBED_BATCH_SIZE)
    const inputs = batch.map((c) => ({
      text: c.content,
      contextPrefix: '',
      contextualHeader: c.contextual_header,
    }))

    const { embeddings } = await generateEmbeddingsBatch(inputs)

    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j]!
      const embedding = embeddings[j]!
      await prisma.$executeRaw`
        UPDATE content_chunks
        SET embedding = ${vectorToString(embedding)}::vector
        WHERE id = ${chunk.id}
      `
    }
    embedded += batch.length
  }

  return embedded
}

/** 17.9 ships only USER_FILE; WORKSPACE_DOCUMENT lands in 17.9b. */
function unsupportedSource(sourceType: WorkspaceSourceType): never {
  throw new Error(
    `[sync-workspace-chunks] source_type ${sourceType} is not supported in Story 17.9 (authored styrdokument → Story 17.9b)`
  )
}
