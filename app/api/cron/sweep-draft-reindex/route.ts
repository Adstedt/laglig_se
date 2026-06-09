/**
 * Sweep Draft Reindex Cron (Story 17.10b)
 *
 * Picks up `workspace_documents` that were marked dirty by `autosaveDocument`
 * (or any other content-mutation hook) and whose dirty-mark has aged past the
 * 60-second debounce window. For each, calls `indexWorkspaceDocument` (which
 * is hash-gated, so a same-hash re-sync is free) and clears the dirty flag.
 *
 * **Why a cron, not an in-request throttle (DEC-5):** chosen by PO 2026-06-02
 * for multi-author DRAFT-editing scenarios — when several authors edit the
 * same arbetsmiljöpolicy simultaneously, the cron smooths embedding load
 * across the workspace rather than dogpiling per-request.
 *
 * **Retry / observability (NTH-4):** failures log to console.error with the
 * doc IDs not processed. The `needs_reindex = true` flag persists across runs
 * — next sweep picks them up automatically. No alerting required for v1;
 * observability via Vercel cron dashboards.
 *
 * **Cross-tenant defence-in-depth (AC 28):** every per-doc operation passes
 * the doc's own `workspace_id` through to `indexWorkspaceDocument` (which
 * already enforces it) AND the clearing UPDATE is scoped on both `id` and
 * `workspace_id`. Defence-in-depth alongside the 17.9b write-side invariant.
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  DRAFT_REINDEX_DEBOUNCE_MS,
  indexWorkspaceDocument,
} from '@/lib/chunks/workspace-document-reindex'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes max for cron

const BATCH_LIMIT = 50 // tune via observation; matches process-chunks pattern

interface SweepStats {
  candidates: number
  processed: number
  failed: number
  failures: Array<{ documentId: string; workspaceId: string; error: string }>
}

export async function GET(request: Request) {
  const startTime = Date.now()

  // Auth — production-only enforcement (matches cleanup-invitations + the
  // rest of the unit-tested cron routes). Dev + test environments skip the
  // Bearer check so the cron is easy to trigger manually. Read CRON_SECRET
  // at request time (NOT module-load time) so unit tests that toggle the
  // env var actually take effect — and so a missing CRON_SECRET in any
  // environment is detected per-request rather than frozen at boot.
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (process.env.NODE_ENV === 'production' && cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const stats: SweepStats = {
    candidates: 0,
    processed: 0,
    failed: 0,
    failures: [],
  }

  try {
    // Cutoff = "marked dirty more than DRAFT_REINDEX_DEBOUNCE_MS ago".
    const cutoff = new Date(Date.now() - DRAFT_REINDEX_DEBOUNCE_MS)

    // Defensive status filter (QA 2026-06-02): a doc can be marked dirty while
    // DRAFT and THEN transition to SUPERSEDED/ARCHIVED before this sweep fires.
    // `markWorkspaceDocumentDirty` already skips terminal-state docs going in,
    // but it doesn't clear the flag on later-arriving status transitions — the
    // updateDocumentStatus DELETE branch deletes the chunks, then this sweep
    // would re-CREATE them from the still-present content_html, leaving
    // archived content silently searchable. The filter here is the second
    // layer that closes the race regardless of transition ordering.
    const candidates = await prisma.workspaceDocument.findMany({
      where: {
        needs_reindex: true,
        last_marked_dirty_at: { lte: cutoff },
        status: { notIn: ['SUPERSEDED', 'ARCHIVED'] },
      },
      select: { id: true, workspace_id: true },
      take: BATCH_LIMIT,
      orderBy: { last_marked_dirty_at: 'asc' },
    })

    stats.candidates = candidates.length

    for (const doc of candidates) {
      try {
        await indexWorkspaceDocument(doc.id, doc.workspace_id)

        // Clear the dirty flag — workspace-scoped per AC 28.
        await prisma.workspaceDocument.updateMany({
          where: { id: doc.id, workspace_id: doc.workspace_id },
          data: { needs_reindex: false, last_marked_dirty_at: null },
        })

        stats.processed += 1
      } catch (err) {
        stats.failed += 1
        const msg = err instanceof Error ? err.message : String(err)
        stats.failures.push({
          documentId: doc.id,
          workspaceId: doc.workspace_id,
          error: msg,
        })
        console.error(
          `[sweep-draft-reindex] reindex failed for ${doc.id} (ws ${doc.workspace_id}) — flag stays set, next sweep retries: ${msg}`
        )
      }
    }

    const duration = Date.now() - startTime
    console.log(
      `[sweep-draft-reindex] done — candidates=${stats.candidates}, processed=${stats.processed}, failed=${stats.failed}, durationMs=${duration}`
    )

    return NextResponse.json({ success: true, stats, durationMs: duration })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[sweep-draft-reindex] fatal: ${msg}`)
    return NextResponse.json(
      { success: false, error: msg, stats },
      { status: 500 }
    )
  }
}
