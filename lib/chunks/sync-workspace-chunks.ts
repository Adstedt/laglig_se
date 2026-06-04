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
  /**
   * **Story 17.18 AC 1 / AC 2 (WORKSPACE_DOCUMENT only):** tier discriminator
   * for dual-tier indexing. When set, the delete + dedup paths are scoped to
   * chunks matching `metadata->>'tier' = tier` (with `OR metadata->>'tier' IS
   * NULL` to self-heal legacy 17.10b chunks on first call). When undefined,
   * preserves 17.10b single-tier behavior — delete-by-(source_id, source_type)
   * across all chunks. `'APPROVED'` ↔ `current_approved_version` content;
   * `'DRAFT'` ↔ `current_draft_version` content (per Story 17.18 AC 1).
   */
  tier?: 'APPROVED' | 'DRAFT'
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
 * **Story 17.18 AC 1 — tier-scoped delete helper.** When `tier` is set, scopes
 * the delete to chunks matching `metadata->>'tier' = tier` AND any chunks where
 * `tier` is missing (`OR metadata->>'tier' IS NULL`) — the second clause is the
 * self-healing migration path that cleans up legacy 17.10b untagged chunks on
 * first tier-aware reindex (then becomes dead code once all docs have been
 * touched). When `tier` is undefined, falls back to the existing 17.10b
 * delete-by-(source_id, source_type) — used by the USER_FILE path and any
 * pre-17.18 caller.
 *
 * Returns the deletion count for the caller's result accounting.
 */
async function tierScopedDelete(
  sourceType: string,
  sourceId: string,
  tier: 'APPROVED' | 'DRAFT' | undefined
): Promise<number> {
  if (tier) {
    const deleted = await prisma.$executeRaw`
      DELETE FROM content_chunks
      WHERE source_type = ${sourceType}::"SourceType"
        AND source_id = ${sourceId}
        AND (metadata->>'tier' = ${tier} OR metadata->>'tier' IS NULL)
    `
    return Number(deleted)
  }
  const deleted = await prisma.contentChunk.deleteMany({
    where: { source_type: sourceType as never, source_id: sourceId },
  })
  return deleted.count
}

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

  // Nothing to index → clear any stale chunks so a now-empty source isn't
  // retrievable. Story 17.18: tier-scoped when applicable (only deletes this
  // tier's chunks; other tier untouched).
  if (!text) {
    const chunksDeleted = await tierScopedDelete(
      sourceType,
      sourceId,
      meta.tier
    )
    return result({ chunksDeleted })
  }

  // Dedupe (AC 9): if existing chunks carry the same content_hash, skip the whole
  // re-embed — no wasted OpenAI cost when a file is re-processed unchanged.
  // Story 17.18: tier-scoped dedup. Legacy untagged chunks (no `tier` metadata)
  // do NOT short-circuit a tier-scoped sync — they need to be replaced with
  // tagged chunks. Same-tier same-hash IS a valid skip.
  if (meta.content_hash) {
    const hashMatched = meta.tier
      ? Number(
          (
            await prisma.$queryRaw<{ count: number }[]>`
              SELECT count(*)::int AS count
              FROM content_chunks
              WHERE source_type = ${sourceType}::"SourceType"
                AND source_id = ${sourceId}
                AND metadata->>'tier' = ${meta.tier}
                AND metadata->>'content_hash' = ${meta.content_hash}
            `
          )[0]?.count ?? 0
        ) > 0
      : await (async () => {
          const existing = await prisma.contentChunk.findFirst({
            where: { source_type: sourceType, source_id: sourceId },
            select: { metadata: true },
          })
          const existingHash = (
            existing?.metadata as { content_hash?: string } | null
          )?.content_hash
          return existing != null && existingHash === meta.content_hash
        })()

    if (hashMatched) {
      // REL-001 (Story 17.9c): only short-circuit when the existing chunks are
      // actually retrievable. A prior transient embed failure can leave chunks
      // committed with `embedding = NULL` while the file is `DONE`; skipping
      // re-embed on a same-hash re-sync would then make the file permanently,
      // silently unretrievable — defeating the documented "retryable via re-sync"
      // recovery. `embedding` is Unsupported() in Prisma, so count nulls via raw SQL.
      // Story 17.18: null-embed check is tier-scoped when applicable.
      const nullEmbedRows = meta.tier
        ? await prisma.$queryRaw<{ count: number }[]>`
            SELECT count(*)::int AS count
            FROM content_chunks
            WHERE source_type = ${sourceType}::"SourceType"
              AND source_id = ${sourceId}
              AND metadata->>'tier' = ${meta.tier}
              AND embedding IS NULL
          `
        : await prisma.$queryRaw<{ count: number }[]>`
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
          // Story 17.18: thread the tier discriminator onto each chunk's metadata.
          ...(meta.tier ? { tier: meta.tier } : {}),
        })

  // No chunks produced (e.g. content below the minimum) → clear stale chunks.
  // Story 17.18: tier-scoped delete.
  if (chunks.length === 0) {
    const chunksDeleted = await tierScopedDelete(
      sourceType,
      sourceId,
      meta.tier
    )
    return result({ chunksDeleted })
  }

  const prismaChunks = chunks.map((c) => ({
    ...c,
    metadata:
      c.metadata === null
        ? Prisma.DbNull
        : (c.metadata as Prisma.InputJsonValue),
  }))

  // Atomic: delete old + create new.
  //
  // Story 17.18: when tier is set, we route the delete through `tierScopedDelete`
  // for the `OR metadata->>'tier' IS NULL` legacy-migration clause. That uses
  // raw SQL, so we split the transaction into a manual sequence: delete first,
  // then createMany. The window between them is microseconds and the embedding
  // step runs OUTSIDE the transaction anyway (it's network-bound), so there's
  // no real consistency loss here vs the pre-17.18 single $transaction.
  //
  // Legacy untiered path (USER_FILE, pre-17.18 callers) preserves the single-
  // statement transaction to keep the existing semantics identical.
  const deletedCount = await tierScopedDelete(sourceType, sourceId, meta.tier)
  const created = await prisma.contentChunk.createMany({ data: prismaChunks })
  const deleted = { count: deletedCount }

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

/**
 * Embed all NULL-embedding chunks of a source in batches of ≤100, writing each
 * vector via raw UPDATE.
 *
 * **Story 17.18:** scoped to chunks where `embedding IS NULL` (i.e., the just-
 * inserted tier set) rather than re-embedding all chunks of (source_id,
 * source_type). For dual-tier docs (one APPROVED tier + one DRAFT tier), the
 * other tier's chunks already have embeddings; re-embedding them on every
 * tier-scoped reindex would be 2× the OpenAI cost for no benefit. Filtering
 * on NULL embedding also self-heals the REL-001 case (legacy chunks committed
 * with NULL embedding after a transient OpenAI failure) without special-casing.
 *
 * Embedding is Unsupported() in Prisma so the filter runs via raw SQL.
 */
async function embedWorkspaceChunks(
  sourceId: string,
  sourceType: WorkspaceSourceType
): Promise<number> {
  const chunks = await prisma.$queryRaw<
    { id: string; content: string; contextual_header: string }[]
  >`
    SELECT id, content, contextual_header
    FROM content_chunks
    WHERE source_type = ${sourceType}::"SourceType"
      AND source_id = ${sourceId}
      AND embedding IS NULL
    ORDER BY id ASC
  `
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
