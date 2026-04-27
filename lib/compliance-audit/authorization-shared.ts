/**
 * Client-safe authorization helpers for the compliance-audit module.
 *
 * Split from `lib/compliance-audit/authorization.ts` because the server-only
 * helpers there import `@/lib/prisma`, which can't be bundled into a client
 * component. Anything in this file MUST stay pure (no DB, no `prisma` import,
 * no `next/server` imports) so it's safe to import from `'use client'` files.
 *
 * The convention mirrors `lib/auth/permissions.ts`'s role-only helpers.
 */

import type { WorkspaceRole } from '@prisma/client'
import { canSealAuditCycle } from '@/lib/auth/permissions'

/**
 * Authorizes sign-off (and unsign) on a single ComplianceAuditItem row.
 *
 * Pure + sync: callers pass pre-loaded IDs (cycle's lead auditor + the
 * underlying LawListItem's responsible user). No DB hit here — both fields
 * are already loaded by `loadItemScopedToWorkspace` server-side and surfaced
 * on `CycleItemRow` / `CycleDetail` client-side, so this helper is reusable
 * across the seam (server action + button-disabled tooltip).
 *
 * Allowed: workspace OWNER/ADMIN (escape hatch), the cycle's lead auditor,
 * or the item's responsible user (when set). Everyone else with `tasks:edit`
 * is intentionally blocked — the outer `withWorkspace(..., 'tasks:edit')`
 * gate still keeps AUDITOR out, this helper narrows the inner ring.
 */
export function canSignOffItem(args: {
  role: WorkspaceRole
  userId: string
  leadAuditorUserId: string
  responsibleUserId: string | null
}): boolean {
  if (canSealAuditCycle(args.role)) return true
  if (args.userId === args.leadAuditorUserId) return true
  if (
    args.responsibleUserId !== null &&
    args.userId === args.responsibleUserId
  ) {
    return true
  }
  return false
}
