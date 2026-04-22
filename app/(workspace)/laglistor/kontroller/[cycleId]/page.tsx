/** Story 21.5 — /laglistor/kontroller/[cycleId] detail page (items + findings + rapport + aktivitet tabs). */

import { cache } from 'react'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getWorkspaceContext } from '@/lib/auth/workspace-context'
import { hasPermission } from '@/lib/auth/permissions'
import {
  ComplianceCycleStatus,
  type ComplianceCycleStatus as CycleStatusType,
} from '@prisma/client'
import { getCycleById } from '@/app/actions/compliance-audit-cycle'
import { getCycleItemsForCycle } from '@/app/actions/compliance-audit-item'
import { CycleDetailPage } from '@/components/features/compliance-audit/cycle-detail'

export const dynamic = 'force-dynamic'

/**
 * DEBT-002 fix: `generateMetadata` and the default route both load the cycle.
 * `React.cache` memoises per-request so both entry points share a single
 * `getCycleById` execution (and thus a single `withWorkspace` call + DB round-trip).
 */
const getCachedCycleById = cache(getCycleById)

interface RouteParams {
  params: Promise<{ cycleId: string }>
}

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { cycleId } = await params
  const result = await getCachedCycleById(cycleId)
  const name = result.success ? result.data?.cycle.name : undefined
  return {
    title: name ? `${name} | Kontroller | Laglig` : 'Kontroll | Laglig',
    description: 'Detalj för efterlevnadskontroll',
  }
}

export default async function CycleDetailRoute({ params }: RouteParams) {
  const { cycleId } = await params

  const ctx = await getWorkspaceContext()
  if (
    !(
      hasPermission(ctx.role, 'activity:view') ||
      hasPermission(ctx.role, 'tasks:edit')
    )
  ) {
    redirect('/laglistor')
  }

  const [cycleResult, itemsResult] = await Promise.all([
    getCachedCycleById(cycleId),
    getCycleItemsForCycle(cycleId),
  ])

  if (!cycleResult.success || !cycleResult.data) {
    redirect('/laglistor/kontroller/skapa')
  }

  if (!itemsResult.success || !itemsResult.data) {
    // Fail-open with an empty items array — the UI renders the empty state and
    // the user can retry via page reload. Keeps the page navigable if the
    // items read fails transiently while the cycle itself loaded.
    //
    // No outer padding wrapper — WorkspaceShell's <main> already has p-4/md:p-6.
    // Matches /laglistor's convention (also unwrapped).
    return (
      <CycleDetailPage
        cycle={cycleResult.data.cycle}
        items={[]}
        cyclePartial={{
          id: cycleResult.data.cycle.id,
          status: cycleResult.data.cycle.status,
          name: cycleResult.data.cycle.name,
          sealHash: cycleResult.data.cycle.sealHash,
        }}
        readOnly={isReadOnly(cycleResult.data.cycle.status)}
      />
    )
  }

  return (
    <CycleDetailPage
      cycle={cycleResult.data.cycle}
      items={itemsResult.data.items}
      cyclePartial={itemsResult.data.cycle}
      readOnly={isReadOnly(itemsResult.data.cycle.status)}
    />
  )
}

function isReadOnly(status: CycleStatusType): boolean {
  return (
    status === ComplianceCycleStatus.SEALED ||
    status === ComplianceCycleStatus.ARKIVERAD
  )
}
