/* eslint-disable no-console */
/**
 * AGENT-001 reconciliation sweep.
 *
 * Finds workspace documents whose content_json is empty/{}/etc. but whose
 * chunks still carry content (the divergence shape that surfaced during
 * 17.11c smoke 2026-06-06). Triggers indexWorkspaceDocument on each affected
 * doc — the post-fix indexer respects content_json as the source of truth
 * and cleans up the stale chunks via tier-scoped delete.
 *
 * Usage:
 *   pnpm tsx scripts/reconcile-agent-001-drift.ts           # report-only (default)
 *   pnpm tsx scripts/reconcile-agent-001-drift.ts --apply   # actually reindex
 */
import { config as loadEnv } from 'dotenv'
import { resolve } from 'path'
loadEnv({ path: resolve(process.cwd(), '.env.local') })

// eslint-disable-next-line import/first
import { prisma } from '../lib/prisma'
// eslint-disable-next-line import/first
import { indexWorkspaceDocument } from '../lib/chunks/workspace-document-reindex'

interface TiptapDoc {
  type?: string
  content?: Array<{ type?: string; content?: unknown }>
}

function isEmptyTiptapDoc(json: unknown): boolean {
  if (json == null) return true
  if (typeof json !== 'object') return true
  const obj = json as TiptapDoc
  if (!Array.isArray(obj.content)) return true
  if (obj.content.length === 0) return true
  if (
    obj.content.length === 1 &&
    obj.content[0]?.type === 'paragraph' &&
    !obj.content[0]?.content
  )
    return true
  return false
}

async function main() {
  const apply = process.argv.includes('--apply')
  console.log(
    `Mode: ${apply ? 'APPLY (will reindex)' : 'REPORT-ONLY (use --apply to fix)'}\n`
  )

  // Find all docs that have at least one chunk (so reconciliation could matter).
  const docsWithChunks = await prisma.contentChunk.findMany({
    where: { source_type: 'WORKSPACE_DOCUMENT' },
    select: { source_id: true },
    distinct: ['source_id'],
  })

  console.log(
    `Found ${docsWithChunks.length} workspace documents that have ContentChunks.\n`
  )

  const drifted: Array<{
    docId: string
    workspaceId: string
    title: string
    chunkCount: number
    approvedEmpty: boolean
    draftEmpty: boolean | null
  }> = []

  for (const c of docsWithChunks) {
    const doc = await prisma.workspaceDocument.findUnique({
      where: { id: c.source_id },
      select: {
        id: true,
        workspace_id: true,
        title: true,
        current_approved_version_id: true,
        current_draft_version_id: true,
        current_approved_version: { select: { content_json: true } },
        current_draft_version: { select: { content_json: true } },
      },
    })

    if (!doc) continue

    const approvedEmpty = doc.current_approved_version_id
      ? isEmptyTiptapDoc(doc.current_approved_version?.content_json)
      : false // no approved tier — N/A
    const draftEmpty = doc.current_draft_version_id
      ? isEmptyTiptapDoc(doc.current_draft_version?.content_json)
      : null // no draft tier — N/A

    // A doc is "drifted" iff at least one tier with chunks has empty content_json.
    // We can't easily filter chunks by tier here without an extra query — use
    // total chunk count as the signal.
    const chunkCount = await prisma.contentChunk.count({
      where: { source_type: 'WORKSPACE_DOCUMENT', source_id: doc.id },
    })

    const hasDrift =
      (doc.current_approved_version_id && approvedEmpty) ||
      (doc.current_draft_version_id && draftEmpty === true) ||
      (!doc.current_approved_version_id && !doc.current_draft_version_id)

    if (hasDrift && chunkCount > 0) {
      drifted.push({
        docId: doc.id,
        workspaceId: doc.workspace_id,
        title: doc.title,
        chunkCount,
        approvedEmpty,
        draftEmpty,
      })
    }
  }

  console.log(`Drifted documents (${drifted.length}):\n`)
  for (const d of drifted) {
    console.log(`  ${d.docId} | ws=${d.workspaceId}`)
    console.log(`    title: "${d.title}"`)
    console.log(
      `    chunks: ${d.chunkCount} | approvedEmpty=${d.approvedEmpty} draftEmpty=${d.draftEmpty}`
    )
  }

  if (drifted.length === 0) {
    console.log('  (none)')
  }

  if (!apply) {
    console.log(
      `\nReport-only mode. Re-run with --apply to reindex ${drifted.length} doc(s).`
    )
    return
  }

  console.log(`\n----- Applying reconciliation -----\n`)
  let ok = 0
  let failed = 0
  for (const d of drifted) {
    try {
      await indexWorkspaceDocument(d.docId, d.workspaceId)
      const after = await prisma.contentChunk.count({
        where: { source_type: 'WORKSPACE_DOCUMENT', source_id: d.docId },
      })
      console.log(`  ✓ ${d.docId} | chunks: ${d.chunkCount} → ${after}`)
      ok++
    } catch (err) {
      console.error(`  ✗ ${d.docId} | ${err}`)
      failed++
    }
  }

  console.log(
    `\nReconciled: ${ok}/${drifted.length} successful, ${failed} failed.`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
