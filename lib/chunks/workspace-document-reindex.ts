/**
 * Styrdokument RAG re-index hooks (Story 17.9b → extended by Story 17.10b)
 *
 * **17.9b model (deprecated by 17.10b):** Authored styrdokument were indexed
 * only while `APPROVED`. Status transitions were the only index/de-index events
 * (content was assumed frozen above DRAFT — DEC-2).
 *
 * **17.10b model (current):** Indexable set widens to {DRAFT, IN_REVIEW,
 * APPROVED}. Content-hash, not status, is the reindex trigger. Status
 * transitions become metadata-only UPDATEs when content is unchanged; only
 * transitions INTO {SUPERSEDED, ARCHIVED} hard-delete chunks. Citation safety
 * is preserved by the chunk-metadata `status` field + the `[Källa:]`/`[Utkast:]`
 * label split in `lib/ai/citations.ts`.
 *
 * Callers (the `documents.ts` server actions + the cron sweep for autosave-
 * debounced reindex) run the chosen action inside `after()` so the user response
 * isn't blocked, and treat failures as retryable (logged, not fatal).
 */

import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { htmlToMarkdown } from '@/lib/transforms/html-to-markdown'
import {
  syncWorkspaceChunks,
  updateChunkMetadata,
} from './sync-workspace-chunks'

/**
 * Story 17.10b debounce window for DRAFT autosave reindex. The autosave hook
 * marks the doc dirty; the cron sweep picks it up after this many ms of idle
 * (no further dirty-marks). Single source of truth — the cron sweep reads the
 * derived seconds value when computing its `NOW() - INTERVAL` predicate.
 */
export const DRAFT_REINDEX_DEBOUNCE_MS = 60_000

/**
 * Story 17.10b: status-transition action.
 *  - `'DELETE'`  → leaving the indexable set (→ ARCHIVED or SUPERSEDED). Hard-
 *    delete all chunks.
 *  - `'METADATA_UPDATE'` → status changed but doc stays indexable. Cheap UPDATE
 *    on chunk.metadata.status; NO embedding work.
 *  - `'NONE'` → status didn't actually change (defensive — caller should not
 *    have invoked the helper in the first place).
 */
export type ReindexStatusAction = 'DELETE' | 'METADATA_UPDATE' | 'NONE'

/**
 * Story 17.10b: content-change action. Mostly informational — the authoritative
 * dedupe is inside `syncWorkspaceChunks` (sha256 of content_html). Callers can
 * use this to skip even queueing the work.
 */
export type ReindexContentAction = 'REINDEX' | 'NONE'

/**
 * Decide what to do with chunks on a status transition. **17.10b semantics:**
 *  - Transitions INTO `{ARCHIVED, SUPERSEDED}` → `DELETE` (the agent must never
 *    surface archived/superseded content).
 *  - Any other transition where status actually changed → `METADATA_UPDATE`
 *    (cheap UPDATE; content unchanged → no re-embed).
 *  - Same-status → `NONE`.
 *
 * Compare to 17.9b which only returned `INDEX`/`DEINDEX`/`NONE` and treated
 * status transitions as the trigger for content sync. 17.10b decouples
 * lifecycle from content cost.
 */
export function decideReindexOnStatusChange(
  oldStatus: string,
  newStatus: string
): ReindexStatusAction {
  if (oldStatus === newStatus) return 'NONE'
  if (newStatus === 'ARCHIVED' || newStatus === 'SUPERSEDED') return 'DELETE'
  return 'METADATA_UPDATE'
}

/**
 * Story 17.10b: defensive check for callers that want to skip queueing reindex
 * work when content is unchanged. Inside `syncWorkspaceChunks` the same gate
 * runs authoritatively — this is just a cheap pre-check.
 */
export function decideReindexOnContentChange(
  oldHash: string | null | undefined,
  newHash: string | null | undefined
): ReindexContentAction {
  if (oldHash && newHash && oldHash === newHash) return 'NONE'
  return 'REINDEX'
}

/** sha256 of the raw `content_html` — gates re-embedding (AC 7). */
export function hashDocumentContent(contentHtml: string): string {
  return createHash('sha256').update(contentHtml, 'utf-8').digest('hex')
}

/**
 * INDEX (or re-INDEX) a styrdokument: load its current version's `content_html`,
 * convert to markdown, chunk + embed as `WORKSPACE_DOCUMENT` chunks. Workspace-
 * scoped (cross-tenant isolation invariant). Chunk metadata carries `status` +
 * `version_number` (Story 17.10b).
 *
 * Hash-gated inside `syncWorkspaceChunks` — same content → skipped, no embed.
 * Null `current_version` → no-op short-circuit (a doc with no versions yet).
 */
export async function indexWorkspaceDocument(
  documentId: string,
  workspaceId: string
): Promise<void> {
  const doc = await prisma.workspaceDocument.findFirst({
    where: { id: documentId, workspace_id: workspaceId },
    select: {
      title: true,
      document_type: true,
      status: true,
      current_version_number: true,
      current_version: { select: { content_html: true } },
    },
  })
  if (!doc) return

  const contentHtml = doc.current_version?.content_html ?? ''
  const markdown = htmlToMarkdown(contentHtml)

  await syncWorkspaceChunks(
    documentId,
    'WORKSPACE_DOCUMENT',
    workspaceId,
    markdown,
    {
      title: doc.title,
      document_type: doc.document_type,
      status: doc.status,
      version_number: doc.current_version_number,
      content_hash: hashDocumentContent(contentHtml),
    }
  )
}

/**
 * DE-INDEX a styrdokument that left the indexable set: passing `null` content
 * makes `syncWorkspaceChunks` delete all `WORKSPACE_DOCUMENT` chunks for the doc.
 */
export async function deindexWorkspaceDocument(
  documentId: string,
  workspaceId: string
): Promise<void> {
  await syncWorkspaceChunks(
    documentId,
    'WORKSPACE_DOCUMENT',
    workspaceId,
    null,
    { content_hash: null }
  )
}

/**
 * Story 17.10b: Cheap metadata-only update for in-place status transitions
 * (e.g. DRAFT → IN_REVIEW where content is unchanged). Updates every chunk's
 * `metadata.status` so the citation layer picks up the new label
 * (`[Källa:]` vs `[Utkast:]`) on the next search. NO embedding cost.
 *
 * Workspace-scoped (AC 28). No-op if the doc has no chunks (e.g. a DRAFT that
 * was never substantive enough to chunk).
 */
export async function updateWorkspaceDocumentStatusMetadata(
  documentId: string,
  workspaceId: string,
  newStatus: string
): Promise<void> {
  await updateChunkMetadata(
    documentId,
    'WORKSPACE_DOCUMENT',
    { status: newStatus },
    workspaceId
  )
}

/**
 * Story 17.10b: Mark a workspace document dirty for the cron sweep to re-index
 * after the DRAFT_REINDEX_DEBOUNCE_MS idle window. Workspace-scoped (AC 28).
 *
 * Skips when the doc's status is non-indexable (`SUPERSEDED`, `ARCHIVED`) —
 * chunking those would be wasted work since they're hard-deleted from the index.
 * Also no-ops on cross-tenant calls (the `where` includes workspace_id).
 *
 * The dirty-mark is idempotent: multiple autosaves within the debounce window
 * just bump `last_marked_dirty_at` — only the cron sweep clears the flag.
 */
export async function markWorkspaceDocumentDirty(
  documentId: string,
  workspaceId: string
): Promise<void> {
  await prisma.workspaceDocument.updateMany({
    where: {
      id: documentId,
      workspace_id: workspaceId,
      status: { notIn: ['SUPERSEDED', 'ARCHIVED'] },
    },
    data: {
      needs_reindex: true,
      last_marked_dirty_at: new Date(),
    },
  })
}
