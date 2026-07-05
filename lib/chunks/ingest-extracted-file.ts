/**
 * Extraction → RAG hand-off routing (Story 7.5).
 *
 * Extracted from `app/api/cron/extract-files/route.ts`'s inline Story 17.9 seam
 * so the branch decision is unit-testable without driving the whole cron route:
 *
 *   - A file that backs a `CollectiveAgreement` (lookup by `workspace_file_id`)
 *     is indexed as `COLLECTIVE_AGREEMENT` chunks with `source_id = agreement.id`
 *     (NOT the file id — retrieval/citations resolve the agreement, and 7.6's
 *     file replacement stays clean), and the agreement's status transitions
 *     PENDING → PROCESSING → READY / FAILED.
 *   - Every other file keeps the Story 17.9 `USER_FILE` path unchanged.
 *
 * Fail-safe contract (mirrors the 17.9 seam): chunk/embed errors are logged and
 * swallowed — the file row is already DONE and the batch must continue. For
 * agreement-backed files a chunking error additionally lands the agreement on
 * FAILED so the user-facing status ("Misslyckades") is honest.
 */

import { prisma } from '@/lib/prisma'
import {
  syncWorkspaceChunks,
  type SyncWorkspaceResult,
} from './sync-workspace-chunks'

/** The `pending` selection shape the extract-files cron already loads. */
export interface ExtractedFileForIndexing {
  id: string
  workspace_id: string
  filename: string
  category: string
  content_hash: string | null
}

export interface IndexExtractedFileResult {
  /** Which pipeline the file was routed through. */
  routedAs: 'USER_FILE' | 'COLLECTIVE_AGREEMENT'
  /** Set on the COLLECTIVE_AGREEMENT route. */
  agreementId?: string
  /** Chunk/embed counts when the sync ran and succeeded. */
  sync?: SyncWorkspaceResult
  /** True when a chunk/embed error was swallowed (fail-safe). */
  chunkError: boolean
}

/**
 * Route a successfully extracted file's markdown into the RAG index.
 * Never throws — all failure modes are logged and reported via the result
 * (the caller's batch must not fail on a chunking error).
 */
export async function indexExtractedFile(
  file: ExtractedFileForIndexing,
  markdown: string
): Promise<IndexExtractedFileResult> {
  const agreement = await findAgreementForFile(file)

  if (!agreement) {
    // Non-CA files: Story 17.9 USER_FILE path, byte-for-byte semantics.
    try {
      const sync = await syncWorkspaceChunks(
        file.id,
        'USER_FILE',
        file.workspace_id,
        markdown,
        {
          filename: file.filename,
          category: file.category,
          content_hash: file.content_hash,
        }
      )
      return { routedAs: 'USER_FILE', sync, chunkError: false }
    } catch (e) {
      console.error(
        `[EXTRACT-FILES] chunk+embed failed for ${file.id}:`,
        e instanceof Error ? e.message : e
      )
      return { routedAs: 'USER_FILE', chunkError: true }
    }
  }

  // Agreement-backed file: PENDING → PROCESSING → READY / FAILED. Status
  // writes are themselves fail-safe (.catch) — a status-write hiccup must not
  // take down the batch either.
  await setAgreementStatus(agreement.id, file.workspace_id, 'PROCESSING')

  try {
    const sync = await syncWorkspaceChunks(
      agreement.id, // source_id = CollectiveAgreement.id, NOT the file id
      'COLLECTIVE_AGREEMENT',
      file.workspace_id,
      markdown,
      {
        agreement_name: agreement.name,
        personel_type: agreement.personel_type,
        filename: file.filename,
        workspace_file_id: file.id,
        content_hash: file.content_hash,
      }
    )
    await setAgreementStatus(agreement.id, file.workspace_id, 'READY')
    return {
      routedAs: 'COLLECTIVE_AGREEMENT',
      agreementId: agreement.id,
      sync,
      chunkError: false,
    }
  } catch (e) {
    console.error(
      `[EXTRACT-FILES] agreement chunk+embed failed for ${agreement.id} (file ${file.id}):`,
      e instanceof Error ? e.message : e
    )
    await setAgreementStatus(agreement.id, file.workspace_id, 'FAILED')
    return {
      routedAs: 'COLLECTIVE_AGREEMENT',
      agreementId: agreement.id,
      chunkError: true,
    }
  }
}

/**
 * Mark the agreement backing `file` (if any) as FAILED — called when the
 * extraction itself did not produce usable markdown (FAILED / EMPTY /
 * ENCRYPTED / UNSUPPORTED terminal states). Without this, an agreement whose
 * PDF can't be extracted would sit on "Väntar" forever. Fail-safe: never throws.
 *
 * @returns the agreement id when one was marked, null otherwise.
 */
export async function markAgreementFailedForFile(
  file: Pick<ExtractedFileForIndexing, 'id' | 'workspace_id'>
): Promise<string | null> {
  try {
    const agreement = await prisma.collectiveAgreement.findFirst({
      where: { workspace_file_id: file.id, workspace_id: file.workspace_id },
      select: { id: true },
    })
    if (!agreement) return null
    await setAgreementStatus(agreement.id, file.workspace_id, 'FAILED')
    return agreement.id
  } catch (e) {
    console.error(
      `[EXTRACT-FILES] agreement FAILED-mark lookup errored for file ${file.id}:`,
      e instanceof Error ? e.message : e
    )
    return null
  }
}

async function findAgreementForFile(
  file: Pick<ExtractedFileForIndexing, 'id' | 'workspace_id'>
): Promise<{
  id: string
  name: string
  personel_type: string | null
} | null> {
  try {
    return await prisma.collectiveAgreement.findFirst({
      // workspace_id repeated alongside the FK: defense-in-depth against a
      // cross-tenant workspace_file_id ever landing on an agreement row.
      where: { workspace_file_id: file.id, workspace_id: file.workspace_id },
      select: { id: true, name: true, personel_type: true },
    })
  } catch (e) {
    // Lookup failure degrades to the USER_FILE path (file stays indexed and
    // retryable via re-sync) rather than failing the batch.
    console.error(
      `[EXTRACT-FILES] agreement lookup failed for file ${file.id}:`,
      e instanceof Error ? e.message : e
    )
    return null
  }
}

/** Fail-safe status write — updateMany keeps the workspace filter in the write itself. */
async function setAgreementStatus(
  agreementId: string,
  workspaceId: string,
  status: 'PROCESSING' | 'READY' | 'FAILED'
): Promise<void> {
  await prisma.collectiveAgreement
    .updateMany({
      where: { id: agreementId, workspace_id: workspaceId },
      data: { status },
    })
    .catch((e: unknown) => {
      console.error(
        `[EXTRACT-FILES] agreement status write (${status}) failed for ${agreementId}:`,
        e instanceof Error ? e.message : e
      )
    })
}
