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
 * Story 17.9 wired the `USER_FILE` path; Story 17.9b adds `WORKSPACE_DOCUMENT`
 * (authored styrdokument). Both flow through the same delete-then-insert + embed.
 */

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  chunkUserFile,
  chunkWorkspaceDocument,
  type WorkspaceSourceType,
} from './chunk-workspace-document'
import { generateEmbeddingsBatch, vectorToString } from './embed-chunks'

/**
 * Caller-supplied metadata threaded onto every chunk. Fields are optional because
 * the two source types carry different shapes (the branch reads what it needs):
 *   - `USER_FILE` (Story 17.9): `filename` + `category`
 *   - `WORKSPACE_DOCUMENT` (Story 17.9b): `title` + `document_type` + `status`
 */
export interface SyncWorkspaceMeta {
  /** USER_FILE: original filename. */
  filename?: string
  /** USER_FILE: `FileCategory` value. */
  category?: string
  /** WORKSPACE_DOCUMENT: document title. */
  title?: string
  /** WORKSPACE_DOCUMENT: `WorkspaceDocumentType` value. */
  document_type?: string
  /** WORKSPACE_DOCUMENT: `WorkspaceDocumentStatus` value. */
  status?: string
  /** WORKSPACE_DOCUMENT: current version_number at index time (Story 17.10b). */
  version_number?: number
  /** sha256 of the source content — gates re-embedding (17.9 AC 9 / 17.9b AC 7). */
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
      // REL-001 (Story 17.9c): only short-circuit when the existing chunks are
      // actually retrievable. A prior transient embed failure can leave chunks
      // committed with `embedding = NULL` while the file is `DONE`; skipping
      // re-embed on a same-hash re-sync would then make the file permanently,
      // silently unretrievable — defeating the documented "retryable via re-sync"
      // recovery. `embedding` is Unsupported() in Prisma, so count nulls via raw SQL.
      const nullEmbedRows = await prisma.$queryRaw<{ count: number }[]>`
        SELECT count(*)::int AS count
        FROM content_chunks
        WHERE source_type = ${sourceType}::"SourceType"
          AND source_id = ${sourceId}
          AND embedding IS NULL
      `
      const nullEmbedCount = Number(nullEmbedRows[0]?.count ?? 0)
      if (nullEmbedCount === 0) {
        return result({ skipped: true })
      }
      // else: chunks exist but some lack embeddings → fall through to re-chunk +
      // re-embed, which self-heals the failed embed.
    }
  }

  const chunks =
    sourceType === 'USER_FILE'
      ? chunkUserFile({
          fileId: sourceId,
          workspaceId,
          filename: meta.filename ?? '',
          category: meta.category ?? '',
          markdown: text,
          contentHash: meta.content_hash ?? null,
        })
      : chunkWorkspaceDocument({
          documentId: sourceId,
          workspaceId,
          title: meta.title ?? '',
          documentType: meta.document_type ?? '',
          status: meta.status ?? '',
          // exactOptionalPropertyTypes: omit when undefined rather than pass undefined.
          ...(typeof meta.version_number === 'number'
            ? { versionNumber: meta.version_number }
            : {}),
          markdown: text,
          contentHash: meta.content_hash ?? null,
        })

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

/**
 * Story 17.10b: Metadata-only UPDATE helper. Merges `partialMetadata` into the
 * existing `metadata` jsonb on every chunk matching (source_id, source_type,
 * workspace_id). NO embedding work — used when a status transition needs to
 * update the chunk's status label without touching content.
 *
 * AC 28 (cross-tenant defence-in-depth): `workspace_id` is REQUIRED in the
 * WHERE clause — alongside the closure-captured workspaceId at the caller and
 * the 17.9b write-side invariant. The "cheap UPDATE" path is exactly where a
 * future refactor could drop the predicate by accident, so the parameter is
 * non-optional and the SQL hard-codes the filter.
 *
 * Embeddings are untouched. Same-hash + null-embedding chunks (REL-001 self-heal
 * scenario) won't be repaired by this path — the next content-change call to
 * `syncWorkspaceChunks` will self-heal as designed. Intentional: this path is
 * for label updates only, not content recovery.
 */
export async function updateChunkMetadata(
  sourceId: string,
  sourceType: WorkspaceSourceType,
  partialMetadata: Record<string, unknown>,
  workspaceId: string
): Promise<{ chunksUpdated: number; duration: number }> {
  const start = Date.now()

  if (!workspaceId) {
    throw new Error(
      `[updateChunkMetadata] workspace_id is required for ${sourceType} ${sourceId} — refusing to update (cross-tenant leak risk)`
    )
  }

  // jsonb `||` merges right-hand keys into the left-hand value. NULL metadata
  // is coalesced to an empty object so legacy rows still get the new keys.
  const updated = await prisma.$executeRaw`
    UPDATE content_chunks
    SET metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify(partialMetadata)}::jsonb,
        updated_at = NOW()
    WHERE source_type = ${sourceType}::"SourceType"
      AND source_id = ${sourceId}
      AND workspace_id = ${workspaceId}
  `

  return {
    chunksUpdated: Number(updated),
    duration: Date.now() - start,
  }
}
