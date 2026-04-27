/** Story 21.5 — /laglistor/kontroller/[cycleId] detail page (items + findings + rapport + aktivitet tabs). */

// Story 21.12: extended function ceiling so the eager-sealed-PDF `after()`
// continuation fired from `sealCycle` (Server Action invoked from this
// page's subtree) has room to complete a Puppeteer render (~30-60s for a
// 200-item cycle). Default 10s would kill the continuation mid-render.
export const maxDuration = 300

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
import { listFindingsForCycle } from '@/app/actions/compliance-finding'
import {
  canCompleteOrRevertCycle,
  canSealCycle,
} from '@/lib/compliance-audit/authorization'
import { prisma } from '@/lib/prisma'
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

  const [cycleResult, itemsResult, findingsResult] = await Promise.all([
    getCachedCycleById(cycleId),
    getCycleItemsForCycle(cycleId),
    listFindingsForCycle({ cycleId }),
  ])

  if (!cycleResult.success || !cycleResult.data) {
    // Story 21.5.2: redirect to the list hub (was /skapa pre-21.5.2 because
    // the list route didn't exist yet). Resolves 21.5 QA gate item DEV-002.
    redirect('/laglistor/kontroller')
  }

  // Story 21.7: fail-open for findings read. If it fails, the cycle detail
  // still loads; the Findings tab shows an empty state + the page-level SWR
  // will retry on revalidation. Mirrors the items fail-open pattern below.
  const initialFindings =
    findingsResult.success && findingsResult.data
      ? findingsResult.data.findings
      : []

  // Story 21.6 + 21.9 — resolve Revert AND Seal permissions server-side. Both
  // are only meaningful when the cycle is AVSLUTAD (UI hides each menu item
  // otherwise) so we skip the DB lookup for every other state. Run the two
  // cheap findFirst lookups in parallel when applicable.
  const cycleStatus = cycleResult.data.cycle.status
  const [canRevert, canSeal] =
    cycleStatus === ComplianceCycleStatus.AVSLUTAD
      ? await Promise.all([
          canCompleteOrRevertCycle({
            role: ctx.role,
            userId: ctx.userId,
            cycleId,
            workspaceId: ctx.workspaceId,
          }),
          canSealCycle(prisma, {
            role: ctx.role,
            userId: ctx.userId,
            cycleId,
            workspaceId: ctx.workspaceId,
          }),
        ])
      : [false, false]

  if (!itemsResult.success || !itemsResult.data) {
    // Fail-open with an empty items array — the UI renders the empty state and
    // the user can retry via page reload. Keeps the page navigable if the
    // items read fails transiently while the cycle itself loaded.
    return (
      <CycleDetailPage
        cycle={cycleResult.data.cycle}
        items={[]}
        initialFindings={initialFindings}
        cyclePartial={{
          id: cycleResult.data.cycle.id,
          status: cycleResult.data.cycle.status,
          name: cycleResult.data.cycle.name,
          sealHash: cycleResult.data.cycle.sealHash,
        }}
        readOnly={isReadOnly(cycleResult.data.cycle.status)}
        canRevert={canRevert}
        canSeal={canSeal}
        currentUserId={ctx.userId}
        currentUserRole={ctx.role}
      />
    )
  }

  return (
    <CycleDetailPage
      cycle={cycleResult.data.cycle}
      items={itemsResult.data.items}
      initialFindings={initialFindings}
      cyclePartial={itemsResult.data.cycle}
      readOnly={isReadOnly(itemsResult.data.cycle.status)}
      canRevert={canRevert}
      canSeal={canSeal}
      currentUserId={ctx.userId}
      currentUserRole={ctx.role}
    />
  )
}

function isReadOnly(status: CycleStatusType): boolean {
  return (
    status === ComplianceCycleStatus.AVSLUTAD ||
    status === ComplianceCycleStatus.SEALED ||
    status === ComplianceCycleStatus.ARKIVERAD
  )
}
