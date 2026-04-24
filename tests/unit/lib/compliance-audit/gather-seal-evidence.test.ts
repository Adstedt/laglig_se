/**
 * Story 21.9 — tests for gather-seal-evidence.ts.
 *
 * Exercises the five artifact pathways + the SF-4 dedup rule (identity
 * tuple `(kind, evidenceId, lawListItemId)` with `requirementId` as
 * metadata; multi-kravpunkt produces multiple rows; direct + kravpunkt
 * on same item collapses to the kravpunkt row).
 */

import { describe, it, expect, vi } from 'vitest'
import { gatherSealEvidenceForCycle } from '@/lib/compliance-audit/gather-seal-evidence'
import type { Prisma } from '@prisma/client'

/**
 * Builds a minimal tx mock whose `complianceAuditItem.findMany` returns
 * the provided items. Other tables are not accessed by this helper.
 */
function makeTx(items: unknown[]): Prisma.TransactionClient {
  return {
    complianceAuditItem: {
      findMany: vi.fn().mockResolvedValue(items),
    },
  } as unknown as Prisma.TransactionClient
}

describe('gatherSealEvidenceForCycle', () => {
  it('returns empty array for a cycle with no items', async () => {
    const tx = makeTx([])
    const refs = await gatherSealEvidenceForCycle('cycle-1', tx)
    expect(refs).toEqual([])
  })

  it('exercises all five pathways and returns deduped rows', async () => {
    const items = [
      {
        id: 'item-1',
        law_list_item_id: 'll-1',
        law_list_item: {
          file_links: [{ file_id: 'f-direct' }], // pathway 1
          workspace_document_links: [{ document_id: 'd-direct' }], // pathway 2
          requirements: [
            {
              id: 'req-A',
              evidence_links: [
                { file_id: 'f-kravp', workspace_document_id: null }, // pathway 3 — file
                { file_id: null, workspace_document_id: 'd-kravp' }, // pathway 3 — document
              ],
            },
          ],
          task_links: [
            {
              task: {
                id: 't-1',
                file_links: [{ file_id: 'f-task' }], // pathway 4
                workspace_document_links: [{ document_id: 'd-task' }], // pathway 5
              },
            },
          ],
        },
      },
    ]
    const tx = makeTx(items)
    const refs = await gatherSealEvidenceForCycle('cycle-1', tx)
    expect(refs).toHaveLength(6)
    const keyed = refs.map(
      (r) =>
        `${r.kind}:${r.fileId ?? r.documentId}:${r.requirementId ?? 'null'}`
    )
    expect(keyed).toContain('FILE:f-direct:null')
    expect(keyed).toContain('DOCUMENT:d-direct:null')
    expect(keyed).toContain('FILE:f-kravp:req-A')
    expect(keyed).toContain('DOCUMENT:d-kravp:req-A')
    expect(keyed).toContain('FILE:f-task:null')
    expect(keyed).toContain('DOCUMENT:d-task:null')
  })

  it('SF-4 direct + kravpunkt on same item → 1 row, requirementId set (kravpunkt claim wins)', async () => {
    const items = [
      {
        id: 'item-1',
        law_list_item_id: 'll-1',
        law_list_item: {
          file_links: [{ file_id: 'f-shared' }], // direct
          workspace_document_links: [],
          requirements: [
            {
              id: 'req-A',
              evidence_links: [
                { file_id: 'f-shared', workspace_document_id: null },
              ], // same file via kravp
            },
          ],
          task_links: [],
        },
      },
    ]
    const tx = makeTx(items)
    const refs = await gatherSealEvidenceForCycle('cycle-1', tx)
    expect(refs).toHaveLength(1)
    expect(refs[0]).toMatchObject({
      kind: 'FILE',
      fileId: 'f-shared',
      lawListItemId: 'll-1',
      requirementId: 'req-A', // kravpunkt claim wins over direct attachment
    })
  })

  it('SF-4 multi-kravpunkt on same item → N rows (one per requirementId)', async () => {
    const items = [
      {
        id: 'item-1',
        law_list_item_id: 'll-1',
        law_list_item: {
          file_links: [],
          workspace_document_links: [],
          requirements: [
            {
              id: 'req-A',
              evidence_links: [
                { file_id: 'f-shared', workspace_document_id: null },
              ],
            },
            {
              id: 'req-B',
              evidence_links: [
                { file_id: 'f-shared', workspace_document_id: null },
              ],
            },
          ],
          task_links: [],
        },
      },
    ]
    const tx = makeTx(items)
    const refs = await gatherSealEvidenceForCycle('cycle-1', tx)
    expect(refs).toHaveLength(2)
    const reqIds = refs.map((r) => r.requirementId).sort()
    expect(reqIds).toEqual(['req-A', 'req-B'])
    expect(refs.every((r) => r.fileId === 'f-shared')).toBe(true)
  })

  it('SF-4 direct + task-linked on same item → 1 row with requirementId null', async () => {
    const items = [
      {
        id: 'item-1',
        law_list_item_id: 'll-1',
        law_list_item: {
          file_links: [],
          workspace_document_links: [{ document_id: 'd-shared' }], // direct
          requirements: [],
          task_links: [
            {
              task: {
                id: 't-1',
                file_links: [],
                workspace_document_links: [{ document_id: 'd-shared' }], // via task
              },
            },
          ],
        },
      },
    ]
    const tx = makeTx(items)
    const refs = await gatherSealEvidenceForCycle('cycle-1', tx)
    expect(refs).toHaveLength(1)
    expect(refs[0]).toMatchObject({
      kind: 'DOCUMENT',
      documentId: 'd-shared',
      lawListItemId: 'll-1',
      requirementId: null, // task path carries no kravpunkt
    })
  })

  it('the same evidence attached to TWO different items produces TWO rows', async () => {
    const items = [
      {
        id: 'item-1',
        law_list_item_id: 'll-1',
        law_list_item: {
          file_links: [{ file_id: 'f-shared' }],
          workspace_document_links: [],
          requirements: [],
          task_links: [],
        },
      },
      {
        id: 'item-2',
        law_list_item_id: 'll-2',
        law_list_item: {
          file_links: [{ file_id: 'f-shared' }],
          workspace_document_links: [],
          requirements: [],
          task_links: [],
        },
      },
    ]
    const tx = makeTx(items)
    const refs = await gatherSealEvidenceForCycle('cycle-1', tx)
    expect(refs).toHaveLength(2)
    expect(refs.map((r) => r.lawListItemId).sort()).toEqual(['ll-1', 'll-2'])
  })
})
