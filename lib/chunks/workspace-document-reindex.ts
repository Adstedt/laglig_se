/**
 * Styrdokument RAG re-index hooks (Story 17.9b)
 *
 * Authored styrdokument (`WorkspaceDocument`) are indexed into the RAG pipeline
 * only while `APPROVED` (AC 5). The events that cross that boundary are STATUS
 * TRANSITIONS, not content writes (content is frozen above DRAFT — DEC-2), so the
 * index/de-index decision is a pure function of (oldStatus, newStatus).
 *
 * Callers (the `documents.ts` server actions) run the chosen action inside `after()`
 * so the user response isn't blocked, and treat failures as retryable (logged, not
 * fatal) — a re-approval re-runs the INDEX path.
 */

import { createHash } from 'crypto'
import { prisma } from '@/lib/prisma'
import { htmlToMarkdown } from '@/lib/transforms/html-to-markdown'
import { syncWorkspaceChunks } from './sync-workspace-chunks'

export type ReindexAction = 'INDEX' | 'DEINDEX' | 'NONE'

const APPROVED = 'APPROVED'

/**
 * Decide whether a styrdokument status change crosses the indexable boundary.
 * Indexable set = `APPROVED` only (AC 5). Becoming APPROVED → INDEX; leaving
 * APPROVED (→ SUPERSEDED / ARCHIVED / DRAFT) → DEINDEX; anything else → NONE.
 * Phrased as "entering/leaving APPROVED" rather than enumerating transitions so
 * it stays correct if the lifecycle gains states.
 */
export function decideReindexOnStatusChange(
  oldStatus: string,
  newStatus: string
): ReindexAction {
  if (newStatus === APPROVED && oldStatus !== APPROVED) return 'INDEX'
  if (oldStatus === APPROVED && newStatus !== APPROVED) return 'DEINDEX'
  return 'NONE'
}

/** sha256 of the raw `content_html` — gates re-embedding (AC 7). */
export function hashDocumentContent(contentHtml: string): string {
  return createHash('sha256').update(contentHtml, 'utf-8').digest('hex')
}

/**
 * INDEX a now-APPROVED styrdokument: load its current version's `content_html`,
 * convert to markdown (AC 2 — the trigger owns this step), and chunk + embed as
 * `WORKSPACE_DOCUMENT` chunks. Workspace-scoped (cross-tenant isolation invariant).
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
      content_hash: hashDocumentContent(contentHtml),
    }
  )
}

/**
 * DE-INDEX a styrdokument that left the indexable set: passing `null` content makes
 * `syncWorkspaceChunks` delete all `WORKSPACE_DOCUMENT` chunks for the doc.
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
