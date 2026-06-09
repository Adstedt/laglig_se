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
import { tiptapDocToHtml } from '@/lib/documents/tiptap-to-html'
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
 * Pick the effective HTML for chunking. Per the WorkspaceDocumentVersion schema
 * comment ("Tiptap JSON is source of truth"), `content_html` is a derived
 * rendering — and any writer that ever leaves it empty (agent-authored drafts,
 * autosave race, generateHTML hiccup) would otherwise produce zero chunks and
 * leave the doc unsearchable. Render from `content_json` server-side as the
 * fallback so the indexer always has real content when content_json does.
 */
function effectiveHtml(
  contentHtml: string | null | undefined,
  contentJson: unknown
): string {
  const html = contentHtml ?? ''
  if (html.trim()) return html
  return tiptapDocToHtml(contentJson)
}

/**
 * INDEX (or re-INDEX) a styrdokument across BOTH tiers (Story 17.18 AC 1).
 *
 * **17.18 model (current):** under Story 17.16's dual-pointer schema, a doc
 * may carry an approved version (`current_approved_version_id`) AND/OR a draft
 * version (`current_draft_version_id`). Each tier is indexed independently so
 * the agent's `search_workspace_documents` can return one hit per tier per doc
 * (AC 3) and the citation layer can route `[Källa:]` to APPROVED-tier chunks
 * and `[Utkast:]` to DRAFT-tier chunks (AC 4).
 *
 *  - `current_approved_version_id` set → APPROVED-tier chunks indexed from
 *    `current_approved_version.content_html`. Carry `metadata.tier='APPROVED'`
 *    + `metadata.status='APPROVED'`.
 *  - `current_draft_version_id` set → DRAFT-tier chunks indexed from
 *    `current_draft_version.content_html`. Carry `metadata.tier='DRAFT'` +
 *    `metadata.status=draft_status` (`'DRAFT'` or `'IN_REVIEW'`).
 *  - Either pointer null → the orphaned tier's chunks are **physically deleted**
 *    (SF-1 — pinned by PO v1.1: removed, not marked-stale; keeps search query
 *    simple + bounds index growth on multi-cycle docs). This is what makes
 *    Story 17.16's `discardDraft` and `promoteDraftToApproved` cleanups work
 *    via the existing `after(indexWorkspaceDocument(...))` callback contract.
 *  - Both pointers null → legacy fallback to `current_version` (the deprecated
 *    alias, untiered). Should not be reachable post-17.16 backfill but
 *    defensively retained.
 *
 * Hash-gated inside `syncWorkspaceChunks` (per-tier) — same content per tier
 * → skipped, no embed. Workspace-scoped (cross-tenant isolation invariant).
 */
/**
 * AGENT-001 defensive check: content_json is the editor's source of truth for
 * "does this doc have content". If it's empty, missing, or shaped as the empty
 * object {} (rather than a proper Tiptap doc with a content array), the tier
 * is treated as empty for chunking — even if content_html somehow has stale
 * legacy content from before (which would generate phantom chunks the agent
 * could read as truth).
 *
 * Detects all empty-ish shapes:
 *   - null / undefined
 *   - {} (empty object — what some legacy paths wrote when clearing)
 *   - { type: 'doc', content: [] } (Tiptap "no nodes" shape)
 *   - { type: 'doc', content: [{ type: 'paragraph' }] } (single empty paragraph
 *     — the default the editor produces for a "blank" doc; treat as empty so
 *     a freshly-branched-from-empty draft doesn't get phantom chunks)
 */
function isEmptyTiptapDoc(json: unknown): boolean {
  if (json == null) return true
  if (typeof json !== 'object') return true
  const obj = json as Record<string, unknown>
  if (!Array.isArray(obj.content)) return true
  const content = obj.content as Array<Record<string, unknown>>
  if (content.length === 0) return true
  // "Single empty paragraph" — the Tiptap editor's default starting state.
  if (
    content.length === 1 &&
    content[0]?.type === 'paragraph' &&
    !content[0]?.content
  ) {
    return true
  }
  return false
}

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
      current_approved_version_id: true,
      current_draft_version_id: true,
      draft_status: true,
      current_approved_version: {
        select: {
          content_html: true,
          content_json: true,
          version_number: true,
        },
      },
      current_draft_version: {
        select: {
          content_html: true,
          content_json: true,
          version_number: true,
        },
      },
      // Legacy alias for the both-pointers-null fallback path.
      current_version: { select: { content_html: true, content_json: true } },
    },
  })
  if (!doc) return

  // ── APPROVED tier ─────────────────────────────────────────────────────────
  if (doc.current_approved_version_id && doc.current_approved_version) {
    const json = doc.current_approved_version.content_json
    const html = effectiveHtml(doc.current_approved_version.content_html, json)
    if (isEmptyTiptapDoc(json)) {
      // AGENT-001 defensive cleanup: content_json (editor's source of truth)
      // says this tier is empty. Don't generate chunks from content_html even
      // if it disagrees — that's a legacy divergence the indexer must heal,
      // not propagate.
      await syncWorkspaceChunks(
        documentId,
        'WORKSPACE_DOCUMENT',
        workspaceId,
        null,
        { content_hash: null, tier: 'APPROVED' }
      )
    } else {
      await syncWorkspaceChunks(
        documentId,
        'WORKSPACE_DOCUMENT',
        workspaceId,
        htmlToMarkdown(html),
        {
          title: doc.title,
          document_type: doc.document_type,
          status: 'APPROVED',
          version_number: doc.current_approved_version.version_number,
          content_hash: hashDocumentContent(html),
          tier: 'APPROVED',
        }
      )
    }
  } else {
    // SF-1 cleanup: no approved version → any orphaned APPROVED-tier chunks
    // get deleted by passing null markdown with tier scope.
    await syncWorkspaceChunks(
      documentId,
      'WORKSPACE_DOCUMENT',
      workspaceId,
      null,
      { content_hash: null, tier: 'APPROVED' }
    )
  }

  // ── DRAFT tier ────────────────────────────────────────────────────────────
  if (doc.current_draft_version_id && doc.current_draft_version) {
    const json = doc.current_draft_version.content_json
    const html = effectiveHtml(doc.current_draft_version.content_html, json)
    if (isEmptyTiptapDoc(json)) {
      // AGENT-001 defensive cleanup mirrors the APPROVED tier path. Critical
      // safety property: this fires ONLY when the draft tier's content_json
      // is empty — the approved tier (which 17.16's alias-freeze invariant
      // keeps immutable during a draft window) is sourced from its own row
      // and unaffected. So clearing a draft can't cascade to the approved
      // chunks; the user's accidentally-emptied draft just stops showing
      // phantom hits, the approved policy stays fully searchable.
      await syncWorkspaceChunks(
        documentId,
        'WORKSPACE_DOCUMENT',
        workspaceId,
        null,
        { content_hash: null, tier: 'DRAFT' }
      )
    } else {
      await syncWorkspaceChunks(
        documentId,
        'WORKSPACE_DOCUMENT',
        workspaceId,
        htmlToMarkdown(html),
        {
          title: doc.title,
          document_type: doc.document_type,
          // draft_status carries 'DRAFT' or 'IN_REVIEW'; defaults to 'DRAFT' if
          // a brand-new doc hasn't been seeded yet (edge case — Story 17.16's
          // createDocument extension does seed it).
          status: doc.draft_status ?? 'DRAFT',
          version_number: doc.current_draft_version.version_number,
          content_hash: hashDocumentContent(html),
          tier: 'DRAFT',
        }
      )
    }
  } else {
    // SF-1 cleanup: no draft → any orphaned DRAFT-tier chunks get deleted.
    await syncWorkspaceChunks(
      documentId,
      'WORKSPACE_DOCUMENT',
      workspaceId,
      null,
      { content_hash: null, tier: 'DRAFT' }
    )
  }

  // ── Legacy fallback ───────────────────────────────────────────────────────
  // Both pointers null but the alias has content → pre-Story 17.16 doc that
  // somehow escaped the backfill. Index via the untiered path so it remains
  // searchable until the next save normalizes the pointer state. AGENT-001
  // defense still applies here — content_json is the source of truth.
  if (
    !doc.current_approved_version_id &&
    !doc.current_draft_version_id &&
    doc.current_version &&
    !isEmptyTiptapDoc(doc.current_version.content_json)
  ) {
    const html = effectiveHtml(
      doc.current_version.content_html,
      doc.current_version.content_json
    )
    await syncWorkspaceChunks(
      documentId,
      'WORKSPACE_DOCUMENT',
      workspaceId,
      htmlToMarkdown(html),
      {
        title: doc.title,
        document_type: doc.document_type,
        status: doc.status,
        version_number: doc.current_version_number,
        content_hash: hashDocumentContent(html),
        // No tier → untagged chunks; will be migrated to APPROVED-tier on
        // the next reindex when pointers get populated.
      }
    )
  }
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
