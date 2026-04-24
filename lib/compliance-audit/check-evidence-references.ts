/**
 * Story 21.9 — evidence-reference guard for file / document deletion.
 *
 * Before a `WorkspaceFile` or `WorkspaceDocument` is deleted, the mutating
 * server action calls `findActiveSnapshotReferences` to check whether any
 * `ComplianceEvidenceSnapshot` belonging to a SEALED cycle references it.
 * If yes, the delete is blocked and the user sees a Swedish error message
 * listing the blocking cycles (capped at 3 names + overflow via
 * `formatBlockedByCyclesError`).
 *
 * MVP scope: only `SEALED` cycles block deletion. `ARKIVERAD` is post-MVP;
 * extend the status filter when archive ships.
 *
 * [Source: Story 21.9 AC 8, NH-5; architecture §6.3]
 */

import type {
  ComplianceCycleStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'

type PrismaLike = PrismaClient | Prisma.TransactionClient

export interface CycleRef {
  cycleId: string
  cycleName: string
  status: ComplianceCycleStatus
}

export interface FindActiveSnapshotReferencesArgs {
  fileId?: string
  documentId?: string
}

/**
 * Returns all snapshot references whose cycle is `SEALED`. Empty array if
 * none. Throws if both or neither id is provided (caller error).
 */
export async function findActiveSnapshotReferences(
  args: FindActiveSnapshotReferencesArgs,
  prismaClient: PrismaLike = prisma
): Promise<CycleRef[]> {
  const fileIdPresent =
    typeof args.fileId === 'string' && args.fileId.length > 0
  const docIdPresent =
    typeof args.documentId === 'string' && args.documentId.length > 0

  if (fileIdPresent === docIdPresent) {
    throw new Error(
      'findActiveSnapshotReferences: exactly one of fileId or documentId must be provided'
    )
  }

  const snapshots = await prismaClient.complianceEvidenceSnapshot.findMany({
    where: {
      ...(fileIdPresent ? { evidence_file_id: args.fileId } : {}),
      ...(docIdPresent ? { evidence_document_id: args.documentId } : {}),
      cycle: {
        status: 'SEALED',
      },
    },
    select: {
      cycle: {
        select: { id: true, name: true, status: true },
      },
    },
  })

  // Dedup by cycle id — a file can be snapshot-referenced many times per cycle.
  const byCycleId = new Map<string, CycleRef>()
  for (const row of snapshots) {
    if (!byCycleId.has(row.cycle.id)) {
      byCycleId.set(row.cycle.id, {
        cycleId: row.cycle.id,
        cycleName: row.cycle.name,
        status: row.cycle.status,
      })
    }
  }

  // Sort by cycleName for stable error-message output.
  return Array.from(byCycleId.values()).sort((a, b) =>
    a.cycleName.localeCompare(b.cycleName, 'sv')
  )
}

/**
 * Formats the blocked-deletion error string for user display. Caps the
 * cycle-name list at 3 entries with an "…och N fler" overflow suffix; uses
 * singular "kontroll" for 1 cycle, plural "kontroller" otherwise.
 *
 * [Source: Story 21.9 AC 8 / NH-5]
 */
export function formatBlockedByCyclesError(refs: CycleRef[]): string {
  if (refs.length === 0) {
    throw new Error('formatBlockedByCyclesError: refs must be non-empty')
  }

  const label = refs.length === 1 ? 'kontroll' : 'kontroller'
  const CAP = 3

  if (refs.length <= CAP) {
    const names = refs.map((r) => r.cycleName).join(', ')
    return `Filen används som bevis i fastställd${refs.length === 1 ? '' : 'a'} ${label}: ${names}. Radering blockerad.`
  }

  const shown = refs
    .slice(0, CAP)
    .map((r) => r.cycleName)
    .join(', ')
  const overflow = refs.length - CAP
  return `Filen används som bevis i fastställda ${label}: ${shown} …och ${overflow} fler. Radering blockerad.`
}
