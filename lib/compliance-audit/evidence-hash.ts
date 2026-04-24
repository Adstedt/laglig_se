/**
 * Story 21.9 — SHA-256 of individual evidence artifacts at seal time.
 *
 * Two kinds of evidence:
 *   - FILE: bytes downloaded from Supabase Storage, hashed as-is.
 *   - DOCUMENT: Tiptap-editable styrdokument stored in Postgres — hashed
 *     over a stable canonical JSON of `{ id, title, documentType, status,
 *     versionNumber, html, markdown, jsonContent }`. What a reviewer reads.
 *
 * **Memory ceiling:** files are loaded into memory in full before hashing.
 * For >50MB files this could OOM Node in a serverless context. The caller
 * (`sealCycle`) hashes files SERIALLY (never via `Promise.all`) so peak
 * memory is bounded to one file at a time. A 200-file × 10MB cycle peaks
 * around ~10MB — fine. A 200-file × 500MB cycle would not be fine; streaming
 * hash is deferred to an NFR follow-up.
 *
 * **These calls happen OUTSIDE the seal transaction.** Storage download +
 * hashing are seconds-long I/O operations; holding a Postgres connection
 * through them would be a connection-pool risk. The caller pre-computes
 * hashes, then opens the seal transaction with the ready values.
 *
 * [Source: Story 21.9 AC 4; architecture §5.1 evidence-hash.ts; §3.1 Supabase Storage row]
 */

import { createHash } from 'node:crypto'
import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getStorageClient } from '@/lib/supabase/storage'
import { canonicalizeSealInput } from '@/lib/compliance-audit/canonicalize'

type PrismaLike = PrismaClient | Prisma.TransactionClient

const BUCKET_NAME = 'workspace-files'

/**
 * Hashes a `WorkspaceFile` by downloading its bytes from Supabase Storage
 * and running SHA-256 over them. Throws with Swedish error messages on the
 * failure paths (file not found / no storage path / Storage download
 * failure) — sealCycle catches and aborts the seal transaction.
 */
export async function hashFileEvidence(
  fileId: string,
  prismaClient: PrismaLike = prisma
): Promise<string> {
  const file = await prismaClient.workspaceFile.findUnique({
    where: { id: fileId },
    select: { id: true, storage_path: true },
  })

  if (!file) {
    throw new Error(`Bevisfil ${fileId} hittades inte`)
  }

  if (file.storage_path === null) {
    // Folder rows or orphan rows — evidence snapshots should never reference these.
    throw new Error(`Bevisfil ${fileId} har ingen lagringsväg`)
  }

  const client = getStorageClient()
  const { data, error } = await client.storage
    .from(BUCKET_NAME)
    .download(file.storage_path)

  if (error || !data) {
    throw new Error(`Bevisfil ${fileId} kunde inte hämtas från lagring`)
  }

  // Blob → Buffer for the crypto update() call. In Node 20+, `Blob` from
  // `@supabase/supabase-js` exposes `arrayBuffer()`.
  const arrayBuffer = await data.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  return createHash('sha256').update(buffer).digest('hex')
}

/**
 * Hashes a `WorkspaceDocument` by building a canonical JSON of its stable
 * metadata + its current version's content, then running SHA-256 over the
 * string bytes. Does NOT read Storage — documents are Tiptap-editable
 * styrdokument stored entirely in Postgres.
 *
 * Content lives on `WorkspaceDocumentVersion` (fields `content_json`,
 * `content_html`, `extracted_text`) and is referenced via the document's
 * `current_version` relation. A document with no current version (newly
 * created, still empty) still hashes safely — the version fields are null.
 *
 * Field set (must stay stable — any addition breaks re-verification of
 * existing sealed cycles):
 *   { id, title, documentType, status, versionNumber, currentVersion:
 *     { contentJson, contentHtml, extractedText } | null }
 *
 * Null fields are preserved, not omitted.
 */
export async function hashDocumentEvidence(
  documentId: string,
  prismaClient: PrismaLike = prisma
): Promise<string> {
  const doc = await prismaClient.workspaceDocument.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      title: true,
      document_type: true,
      status: true,
      current_version_number: true,
      current_version: {
        select: {
          content_json: true,
          content_html: true,
          extracted_text: true,
        },
      },
    },
  })

  if (!doc) {
    throw new Error(`Styrdokument ${documentId} hittades inte`)
  }

  const canonicalPayload = {
    id: doc.id,
    title: doc.title,
    documentType: doc.document_type,
    status: doc.status,
    versionNumber: doc.current_version_number,
    currentVersion: doc.current_version
      ? {
          contentJson: doc.current_version.content_json,
          contentHtml: doc.current_version.content_html,
          extractedText: doc.current_version.extracted_text,
        }
      : null,
  }

  const canonicalJson = canonicalizeSealInput(canonicalPayload)
  return createHash('sha256').update(canonicalJson, 'utf8').digest('hex')
}
