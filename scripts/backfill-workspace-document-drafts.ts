/**
 * One-time backfill script (Story 17.10b, Task 7 / DEC-6).
 *
 * Walks every workspace's `WorkspaceDocument` rows where the doc is indexable
 * (DRAFT / IN_REVIEW / APPROVED) AND the current version has substantive
 * content (>= 100 chars of content_html). Calls `indexWorkspaceDocument` on
 * each — hash-gated, so a re-run is essentially free for already-current
 * chunks.
 *
 * Also rewrites missing `status` + `version_number` metadata on existing
 * chunks (legacy 17.9b chunks indexed before 17.10b added these keys) — the
 * AC-19 backwards-compat sweep. This is the read-side companion to the AC-11
 * default in the search tool: with both, the agent never sees a null tier.
 *
 * Why one-time (not lazy-on-read): cleaner UX. Lazy backfill would leave the
 * agent's view empty until first query per doc, which is jarring after a deploy
 * that promises "your drafts are now searchable." One-time = the contract
 * holds from rollout-second-one.
 *
 * Idempotent — safe to re-run. Processed by workspace_id (AC 28) so the walk
 * is naturally tenant-isolated; no global query crosses tenants in flight.
 *
 *   # Live run:
 *   DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/backfill-workspace-document-drafts.ts
 *
 *   # Dry-run (prints planned ops, writes nothing):
 *   DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/backfill-workspace-document-drafts.ts --dry-run
 *
 *   # Scope to one workspace:
 *   DOTENV_CONFIG_PATH=.env.local npx tsx -r dotenv/config scripts/backfill-workspace-document-drafts.ts --workspace=<uuid>
 */

import { PrismaClient } from '@prisma/client'
import { indexWorkspaceDocument } from '@/lib/chunks/workspace-document-reindex'
import { updateChunkMetadata } from '@/lib/chunks/sync-workspace-chunks'

const prisma = new PrismaClient()

interface PerDocResult {
  documentId: string
  title: string
  status: string
  action:
    | 'INDEXED'
    | 'METADATA_PATCHED'
    | 'SKIPPED_EMPTY'
    | 'DRY_RUN'
    | 'FAILED'
  error?: string
  reason?: string
}

interface PerWorkspaceResult {
  workspaceId: string
  workspaceName: string | null
  docsConsidered: number
  perDoc: PerDocResult[]
}

const CONTENT_MIN_CHARS = 100 // same threshold as the 17.10 seed script

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const workspaceFilter = args
    .find((a) => a.startsWith('--workspace='))
    ?.slice('--workspace='.length)

  console.log('=== backfill-workspace-document-drafts ===')
  console.log(`mode: ${dryRun ? 'DRY-RUN (no writes)' : 'LIVE'}`)
  if (workspaceFilter) {
    console.log(`scope: workspace_id = ${workspaceFilter}`)
  }

  // Per AC 28, process by workspace — never a flat global query of all docs.
  const workspaces = await prisma.workspace.findMany({
    where: workspaceFilter ? { id: workspaceFilter } : {},
    select: { id: true, name: true },
    orderBy: { id: 'asc' },
  })

  console.log(`\n${workspaces.length} workspace(s) to scan`)

  const allResults: PerWorkspaceResult[] = []
  let totalIndexed = 0
  let totalMetaPatched = 0
  let totalSkipped = 0
  let totalFailed = 0

  for (const ws of workspaces) {
    const wsResult: PerWorkspaceResult = {
      workspaceId: ws.id,
      workspaceName: ws.name,
      docsConsidered: 0,
      perDoc: [],
    }

    // 1) Walk all indexable docs (DRAFT/IN_REVIEW/APPROVED) — non-terminal states.
    //    SUPERSEDED/ARCHIVED are excluded since their chunks should be hard-deleted,
    //    not backfilled.
    const docs = await prisma.workspaceDocument.findMany({
      where: {
        workspace_id: ws.id,
        status: { in: ['DRAFT', 'IN_REVIEW', 'APPROVED'] },
      },
      select: {
        id: true,
        title: true,
        status: true,
        current_version_number: true,
        current_version: { select: { content_html: true } },
      },
      orderBy: { updated_at: 'desc' },
    })

    wsResult.docsConsidered = docs.length

    for (const doc of docs) {
      const html = doc.current_version?.content_html ?? ''
      if (html.trim().length < CONTENT_MIN_CHARS) {
        wsResult.perDoc.push({
          documentId: doc.id,
          title: doc.title,
          status: doc.status,
          action: 'SKIPPED_EMPTY',
          reason: `content too short (${html.length} chars < ${CONTENT_MIN_CHARS})`,
        })
        totalSkipped++
        continue
      }

      if (dryRun) {
        wsResult.perDoc.push({
          documentId: doc.id,
          title: doc.title,
          status: doc.status,
          action: 'DRY_RUN',
          reason: `would call indexWorkspaceDocument (${html.length} chars)`,
        })
        continue
      }

      try {
        // The hash gate inside syncWorkspaceChunks makes a re-run essentially
        // free for already-current chunks. For docs with legacy chunks missing
        // status/version_number metadata, the re-index writes the new keys.
        await indexWorkspaceDocument(doc.id, ws.id)

        wsResult.perDoc.push({
          documentId: doc.id,
          title: doc.title,
          status: doc.status,
          action: 'INDEXED',
        })
        totalIndexed++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        wsResult.perDoc.push({
          documentId: doc.id,
          title: doc.title,
          status: doc.status,
          action: 'FAILED',
          error: msg,
        })
        totalFailed++
        console.error(
          `[backfill] index failed for ${doc.id} (ws ${ws.id}): ${msg}`
        )
      }
    }

    // 2) AC-19 backwards-compat sweep: for any APPROVED docs whose chunks
    //    might predate 17.10b's metadata keys, also explicit metadata patch.
    //    The indexWorkspaceDocument path above writes the new metadata on
    //    same-hash re-index, BUT the hash gate may short-circuit for legacy
    //    chunks that are already current. So patch defensively.
    //
    //    Cheap: workspace-scoped raw UPDATE per doc, only touches metadata.
    if (!dryRun) {
      const approvedDocs = docs.filter((d) => d.status === 'APPROVED')
      for (const doc of approvedDocs) {
        try {
          await updateChunkMetadata(
            doc.id,
            'WORKSPACE_DOCUMENT',
            {
              status: 'APPROVED',
              version_number: doc.current_version_number,
            },
            ws.id
          )
          totalMetaPatched++
        } catch (err) {
          // Metadata patch failures are non-fatal — the index call above is
          // the primary mechanism.
          console.warn(
            `[backfill] metadata patch failed for ${doc.id} (ws ${ws.id}):`,
            err instanceof Error ? err.message : err
          )
        }
      }
    }

    allResults.push(wsResult)
    if (wsResult.docsConsidered > 0) {
      const indexed = wsResult.perDoc.filter(
        (d) => d.action === 'INDEXED'
      ).length
      const skipped = wsResult.perDoc.filter(
        (d) => d.action === 'SKIPPED_EMPTY'
      ).length
      const failed = wsResult.perDoc.filter((d) => d.action === 'FAILED').length
      const drycount = wsResult.perDoc.filter(
        (d) => d.action === 'DRY_RUN'
      ).length
      console.log(
        `  ws ${ws.id.slice(0, 8)} (${ws.name ?? 'unnamed'}): considered=${wsResult.docsConsidered}, indexed=${indexed}, skipped=${skipped}, failed=${failed}, dry_run=${drycount}`
      )
    }
  }

  console.log('\n=== summary ===')
  console.log(`workspaces scanned:      ${workspaces.length}`)
  console.log(`docs indexed:            ${totalIndexed}`)
  console.log(`docs metadata-patched:   ${totalMetaPatched}`)
  console.log(`docs skipped (empty):    ${totalSkipped}`)
  console.log(`docs failed:             ${totalFailed}`)

  if (dryRun) {
    console.log('\n(dry-run — no chunks were written or modified)')
  }

  // Final per-workspace chunk count for verification (live runs only).
  if (!dryRun && workspaces.length > 0) {
    console.log('\n=== final WORKSPACE_DOCUMENT chunk counts ===')
    for (const ws of workspaces) {
      const count = await prisma.contentChunk.count({
        where: {
          workspace_id: ws.id,
          source_type: 'WORKSPACE_DOCUMENT',
        },
      })
      if (count > 0) {
        console.log(
          `  ws ${ws.id.slice(0, 8)} (${ws.name ?? 'unnamed'}): ${count} chunks`
        )
      }
    }
  }
}

main()
  .catch((err) => {
    console.error('FATAL:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
