/**
 * Story 21.9 — tx-participating batched query for all linked evidence
 * across every item in a cycle. Consumed by `sealCycle` step 1 (AC 3).
 *
 * Why not `getLinkedArtifactsForListItem`? That helper is per-item +
 * wrapped in `withWorkspace`. The seal path needs (a) a tx-participating
 * read (the outer seal transaction owns the connection), (b) a single
 * batched query across all cycle items in one go (200-item cycles would
 * otherwise N+1), and (c) no filename/mimeType/version metadata — seal
 * only cares about identity + bytes.
 *
 * ## SF-4 dedup rule
 *
 * Identity key for a snapshot row: `(kind, evidenceId, lawListItemId)`.
 * `requirementId` is METADATA on the row, NOT part of identity. Collision
 * resolution rules:
 *
 *  - File F1 attached directly to item I1 AND via kravpunkt K1 on same item
 *    → 1 row, `requirementId = K1` (kravpunkt claim is more specific than
 *    the direct attachment — prefer the more informative back-reference).
 *  - File F1 attached via kravpunkt K1 AND kravpunkt K2 on same item
 *    → 2 rows (K1 row + K2 row — different kravpunkter = different claims).
 *  - File F1 attached directly to item I1 only
 *    → 1 row, `requirementId = null`.
 *  - Document D1 attached directly to item I1 AND via a task linked to I1
 *    → 1 row, `requirementId = null` (task path carries no kravpunkt).
 *
 * [Source: Story 21.9 Task 6.2 — SF-4]
 */

import type { Prisma } from '@prisma/client'

export interface SealEvidenceRef {
  lawListItemId: string | null
  requirementId: string | null
  kind: 'FILE' | 'DOCUMENT'
  fileId: string | null
  documentId: string | null
}

interface CollectedRef {
  lawListItemId: string
  kind: 'FILE' | 'DOCUMENT'
  evidenceId: string
  requirementIds: Set<string> // empty = direct attachment only; non-empty = kravpunkt claim(s)
}

/**
 * Gathers all linked-artifact references for every `ComplianceAuditItem`
 * in the cycle, applying the SF-4 dedup rule. Returns one entry per
 * identity tuple `(kind, evidenceId, lawListItemId, requirementId?)`.
 */
export async function gatherSealEvidenceForCycle(
  cycleId: string,
  tx: Prisma.TransactionClient
): Promise<SealEvidenceRef[]> {
  // Load every cycle item + the five artifact pathways in ONE batched query.
  const items = await tx.complianceAuditItem.findMany({
    where: { cycle_id: cycleId },
    select: {
      id: true,
      law_list_item_id: true,
      law_list_item: {
        select: {
          file_links: { select: { file_id: true } },
          workspace_document_links: { select: { document_id: true } },
          requirements: {
            select: {
              id: true,
              evidence_links: {
                select: {
                  file_id: true,
                  workspace_document_id: true,
                },
              },
            },
          },
          task_links: {
            select: {
              task: {
                select: {
                  id: true,
                  file_links: { select: { file_id: true } },
                  workspace_document_links: {
                    select: { document_id: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  // Key: `${kind}:${evidenceId}:${lawListItemId}` — the SF-4 identity tuple.
  const collected = new Map<string, CollectedRef>()

  const ensureEntry = (
    kind: 'FILE' | 'DOCUMENT',
    evidenceId: string,
    lawListItemId: string
  ): CollectedRef => {
    const key = `${kind}:${evidenceId}:${lawListItemId}`
    let entry = collected.get(key)
    if (!entry) {
      entry = {
        lawListItemId,
        kind,
        evidenceId,
        requirementIds: new Set<string>(),
      }
      collected.set(key, entry)
    }
    return entry
  }

  for (const item of items) {
    const llItemId = item.law_list_item_id
    const ll = item.law_list_item

    // Pathway 1: direct file attachments
    for (const link of ll.file_links) {
      ensureEntry('FILE', link.file_id, llItemId)
    }

    // Pathway 2: direct document attachments
    for (const link of ll.workspace_document_links) {
      ensureEntry('DOCUMENT', link.document_id, llItemId)
    }

    // Pathway 3: kravpunkt-bevis (file XOR workspace_document)
    for (const req of ll.requirements) {
      for (const ev of req.evidence_links) {
        if (ev.file_id) {
          const entry = ensureEntry('FILE', ev.file_id, llItemId)
          entry.requirementIds.add(req.id)
        } else if (ev.workspace_document_id) {
          const entry = ensureEntry(
            'DOCUMENT',
            ev.workspace_document_id,
            llItemId
          )
          entry.requirementIds.add(req.id)
        }
      }
    }

    // Pathways 4 + 5: file/document via tasks linked to the item
    for (const taskLink of ll.task_links) {
      for (const fLink of taskLink.task.file_links) {
        ensureEntry('FILE', fLink.file_id, llItemId)
      }
      for (const dLink of taskLink.task.workspace_document_links) {
        ensureEntry('DOCUMENT', dLink.document_id, llItemId)
      }
    }
  }

  // Expand into SealEvidenceRef rows per the SF-4 rule:
  //  - No kravpunkt claim → 1 row with requirementId = null.
  //  - N kravpunkt claims → N rows (one per requirementId).
  const rows: SealEvidenceRef[] = []
  for (const entry of collected.values()) {
    if (entry.requirementIds.size === 0) {
      rows.push({
        lawListItemId: entry.lawListItemId,
        requirementId: null,
        kind: entry.kind,
        fileId: entry.kind === 'FILE' ? entry.evidenceId : null,
        documentId: entry.kind === 'DOCUMENT' ? entry.evidenceId : null,
      })
    } else {
      for (const reqId of entry.requirementIds) {
        rows.push({
          lawListItemId: entry.lawListItemId,
          requirementId: reqId,
          kind: entry.kind,
          fileId: entry.kind === 'FILE' ? entry.evidenceId : null,
          documentId: entry.kind === 'DOCUMENT' ? entry.evidenceId : null,
        })
      }
    }
  }

  return rows
}
