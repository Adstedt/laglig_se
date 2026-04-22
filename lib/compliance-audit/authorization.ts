/**
 * Story 21.14 — runtime authorization for compliance-audit seal action.
 * Consumed by Story 21.9's sealCycle server action.
 *
 * Split of concerns:
 *  - `canSealAuditCycle(role)` in `lib/auth/permissions.ts` — pure, role-only,
 *    no DB access. Safe for both client (via `usePermissions`) and server.
 *  - `isLeadAuditor` + `canSealCycle` here — runtime DB lookup. Server-only.
 *
 * The `prismaClient` parameter accepts either the top-level Prisma client
 * or a transaction client so `sealCycle` can call `canSealCycle` inside its
 * seal transaction (architecture §5.1 cycle-guards signature pattern).
 */

import type { Prisma, PrismaClient, WorkspaceRole } from '@prisma/client'
import { canSealAuditCycle } from '@/lib/auth/permissions'

type PrismaLike = PrismaClient | Prisma.TransactionClient

/**
 * Resolves true iff `userId` is the lead auditor of the active (non-deleted)
 * cycle `cycleId` within workspace `workspaceId`. Filters `deleted_at: null`
 * so a lead-auditor of a soft-deleted cycle cannot seal it.
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
 * Resolves true if EITHER the user's role has `audit:seal` OR the user is the
 * cycle's `lead_auditor_user_id` (runtime override).
 *
 * Short-circuits on the role check — no DB hit when the role already grants
 * the scope. Reads live DB state on the lead-auditor path so demotion via
 * `updateCycleMetadata` takes effect immediately (no cache staleness).
 */
export async function canSealCycle(
  prismaClient: PrismaLike,
  args: {
    role: WorkspaceRole
    userId: string
    cycleId: string
    workspaceId: string
  }
): Promise<boolean> {
  if (canSealAuditCycle(args.role)) return true
  return isLeadAuditor(prismaClient, {
    userId: args.userId,
    cycleId: args.cycleId,
    workspaceId: args.workspaceId,
  })
}
