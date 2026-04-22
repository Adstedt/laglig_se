/** Story 21.5.2 — /laglistor/kontroller list hub. */

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getWorkspaceContext } from '@/lib/auth/workspace-context'
import { hasPermission } from '@/lib/auth/permissions'
import { listCyclesForWorkspace } from '@/app/actions/compliance-audit-cycle'
import { CycleListTable } from '@/components/features/compliance-audit/cycle-list'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Kontroller | Laglig',
  description: 'Pågående och tidigare efterlevnadskontroller.',
}

export default async function CycleListRoute() {
  const ctx = await getWorkspaceContext()

  // OR-permission gate mirrors the cycle detail page (AUDITOR role gets
  // read-only access via activity:view; all editing roles via tasks:edit).
  if (
    !(
      hasPermission(ctx.role, 'activity:view') ||
      hasPermission(ctx.role, 'tasks:edit')
    )
  ) {
    redirect('/laglistor')
  }

  // MVP: load the first page (default 50). `nextCursor` is returned by the
  // action but not consumed here — infinite scroll / pagination UI is a v2
  // concern once workspaces routinely exceed 50 cycles.
  const result = await listCyclesForWorkspace()
  const cycles = result.success ? (result.data?.cycles ?? []) : []
  const canCreate = hasPermission(ctx.role, 'tasks:edit')

  return <CycleListTable cycles={cycles} canCreate={canCreate} />
}
