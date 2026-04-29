'use client'

/**
 * Story 21.5 — Header for /laglistor/kontroller/[cycleId].
 * Story 22.3 — Refactored internally to use the `<PageHeader>` primitive.
 *   API surface unchanged (cycle-detail-page.tsx still calls
 *   `<CycleDetailHeader ... />` with the same props); the new structure
 *   threads metadata into `PageHeader.Meta`, runs Bedömda / Signerade as
 *   `stats`, and parks the Åtgärder dropdown in `primaryAction`.
 *
 *   Findings count chip removed from the meta line per Story 22.3 AC 6 —
 *   the Findings tab surfaces the same numbers redundantly otherwise.
 */

import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { BreadcrumbOverride } from '@/components/layout/breadcrumb-override'
import { PageHeader } from '@/components/ui/page-header'
import { CycleStatusBadge } from './cycle-status-badge'
import { CycleActionsDropdown } from './cycle-actions-dropdown'
import { useCycleItems } from './cycle-items-context'
import type { CycleDetail } from '@/app/actions/compliance-audit-cycle'
import { AuditType } from '@prisma/client'
import { cn } from '@/lib/utils'

interface CycleDetailHeaderProps {
  cycle: CycleDetail
  // Story 22.3 — findingCounts no longer surfaced in the header meta line.
  // Kept on the prop API for caller back-compat (cycle-detail-page.tsx
  // computes the value); the Findings tab is the single source of truth
  // for those numbers post-22.3.
  findingCounts: { open: number; closed: number }
  totalCount: number
  signeradeCount: number
  canRevert: boolean
  onCompleteClick: () => void
  onRevertClick: () => void
}

function initialsFromName(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase() || '?'
}

export function CycleDetailHeader({
  cycle,
  totalCount,
  signeradeCount,
  canRevert,
  onCompleteClick,
  onRevertClick,
}: CycleDetailHeaderProps) {
  const auditLabel =
    cycle.auditType === AuditType.INTERN ? 'Intern revision' : 'Extern revision'
  const scheduled =
    format(cycle.scheduledStart, 'd MMM yyyy', { locale: sv }) +
    '–' +
    format(cycle.scheduledEnd, 'd MMM yyyy', { locale: sv })
  const leadName = cycle.leadAuditor.name ?? 'Okänd'

  const meta = (
    <PageHeader.Meta
      items={[
        cycle.lawList.name,
        auditLabel,
        scheduled,
        {
          icon: (
            <Avatar className="h-5 w-5">
              <AvatarImage src={undefined} alt={leadName} />
              <AvatarFallback className="text-[10px]">
                {initialsFromName(cycle.leadAuditor.name)}
              </AvatarFallback>
            </Avatar>
          ),
          label: leadName,
        },
      ]}
    />
  )

  const description = cycle.description?.trim() ? cycle.description : undefined

  return (
    <>
      {/* Global workspace breadcrumb override — replaces the raw cycle UUID
          with the cycle name. Kept outside <PageHeader> because it's a
          side-effect component (renders nothing), not a slot child. */}
      <BreadcrumbOverride label={cycle.name} />

      {/* Story 21.26 — SealedCycleBanner removed alongside the SEAL collapse.
          Story 21.27 — ReadOnlyBanner removed. Page-level AVSLUTAD reassurance
          banner is rendered by cycle-detail-page.tsx. */}

      <PageHeader
        title={cycle.name}
        badge={<CycleStatusBadge status={cycle.status} />}
        {...(description ? { subtitle: description } : {})}
        meta={meta}
        stats={[
          { label: 'Bedömda', value: <BedomdaCell /> },
          { label: 'Signerade', value: <SignearadeCell /> },
        ]}
        primaryAction={
          <CycleActionsDropdown
            cycle={cycle}
            totalCount={totalCount}
            signeradeCount={signeradeCount}
            canRevert={canRevert}
            onCompleteClick={onCompleteClick}
            onRevertClick={onRevertClick}
          />
        }
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Stat cells — interactive (click to jump to first unbedömt / unsigned doc).
// Live inside <PageHeader stats={...}>'s value slot; consume cycle-items
// context for the count + jump handlers.
// ---------------------------------------------------------------------------

function BedomdaCell() {
  const ctx = useCycleItems()
  const { bedomdaCount, totalCount, jumpToFirstUnbedomd, ready } = ctx
  const allBedomda = ready && bedomdaCount === totalCount && totalCount > 0
  const empty = totalCount === 0
  const disabled = !ready || allBedomda || empty
  const btn = (
    <button
      type="button"
      onClick={jumpToFirstUnbedomd}
      disabled={disabled}
      aria-label="Hoppa till första obedömda dokumentet"
      className={cn(
        'rounded-md text-sm font-semibold text-foreground',
        !disabled &&
          'hover:underline focus-visible:ring-2 focus-visible:ring-ring',
        disabled && 'cursor-not-allowed opacity-60'
      )}
    >
      {bedomdaCount} av {totalCount}
    </button>
  )
  if (!allBedomda) return btn
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>{btn}</span>
        </TooltipTrigger>
        <TooltipContent>Alla dokument bedömda</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function SignearadeCell() {
  const ctx = useCycleItems()
  const { signeradeCount, totalCount, jumpToFirstUnsigned, ready } = ctx
  const allSignerade = ready && signeradeCount === totalCount && totalCount > 0
  const empty = totalCount === 0
  const disabled = !ready || allSignerade || empty
  const btn = (
    <button
      type="button"
      onClick={jumpToFirstUnsigned}
      disabled={disabled}
      aria-label="Hoppa till första osignerade dokumentet"
      className={cn(
        'rounded-md text-sm font-semibold text-foreground',
        !disabled &&
          'hover:underline focus-visible:ring-2 focus-visible:ring-ring',
        disabled && 'cursor-not-allowed opacity-60'
      )}
    >
      {signeradeCount} av {totalCount}
    </button>
  )
  if (!allSignerade) return btn
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>{btn}</span>
        </TooltipTrigger>
        <TooltipContent>Alla dokument signerade</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
