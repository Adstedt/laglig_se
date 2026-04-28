/**
 * Story 21.14 — runtime authorization for compliance-audit lifecycle actions.
 *
 * Story 21.26 update: SEAL was collapsed into AVSLUTAD. The standalone
 * `canSealCycle` helper and the `audit:seal` permission scope are removed.
 * `canCompleteOrRevertCycle` is the only remaining lifecycle authz helper —
 * it gates the revert action (and any future privileged-role lifecycle
 * affordances) by checking role + the cycle's lead auditor.
 *
 * The `prismaClient` parameter accepts either the top-level Prisma client
 * or a transaction client so callers can re-use existing transactions
 * (architecture §5.1 cycle-guards signature pattern).
 */

import type { Prisma, PrismaClient, WorkspaceRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type PrismaLike = PrismaClient | Prisma.TransactionClient

/**
 * Resolves true iff `userId` is the lead auditor of the active (non-deleted)
 * cycle `cycleId` within workspace `workspaceId`. Filters `deleted_at: null`
 * so a lead-auditor of a soft-deleted cycle cannot act on it.
 *
 * Uses `findFirst({ select: { id: true } })` — minimal projection, boolean coerce.
 */
export async function isLeadAuditor(
  prismaClient: PrismaLike,
  args: { userId: string; cycleId: string; workspaceId: string }
): Promise<boolean> {
  const row = await prismaClient.complianceAuditCycle.findFirst({
    where: {
      id: args.cycleId,
      workspace_id: args.workspaceId,
      lead_auditor_user_id: args.userId,
      deleted_at: null,
    },
    select: { id: true },
  })
  return row !== null
}

/**
 * Privileged role check — OWNER + ADMIN can perform any cycle-lifecycle action
 * (complete, revert) as an escape hatch. Equivalent to what the now-removed
 * `audit:seal` scope used to gate.
 */
function isPrivilegedLifecycleRole(role: WorkspaceRole): boolean {
  return role === 'OWNER' || role === 'ADMIN'
}

/**
 * Story 21.6 — runtime authorization for cycle-lifecycle `revertCycleToPagaende`.
 *
 * Resolves true if EITHER the user has a privileged lifecycle role (OWNER /
 * ADMIN) OR the user is the cycle's `lead_auditor_user_id` (runtime override).
 *
 * Short-circuits on the role check — no DB hit when the role already grants
 * the action. Reads live DB state on the lead-auditor path so demotion via
 * `updateCycleMetadata` takes effect immediately (no cache staleness).
 *
 * `completeCycle` itself stays on the basic `tasks:edit` gate (anyone who can
 * sign off items can complete); only the protective direction (revert) uses
 * this helper. See story 21.6 AC 3 vs AC 6.
 */
export async function canCompleteOrRevertCycle(
  args: {
    role: WorkspaceRole
    userId: string
    cycleId: string
    workspaceId: string
  },
  prismaClient: PrismaLike = prisma
): Promise<boolean> {
  if (isPrivilegedLifecycleRole(args.role)) return true
  return isLeadAuditor(prismaClient, {
    userId: args.userId,
    cycleId: args.cycleId,
    workspaceId: args.workspaceId,
  })
}

// Pure (client-safe) helper lives in `authorization-shared.ts` so client
// components can import it without dragging `@/lib/prisma` into the browser
// bundle. Re-exported here so server-side callers keep using a single
// `@/lib/compliance-audit/authorization` import surface.
export { canSignOffItem } from './authorization-shared'
