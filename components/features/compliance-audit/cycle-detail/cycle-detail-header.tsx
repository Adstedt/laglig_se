'use client'

/** Story 21.5 — Header for /laglistor/kontroller/[cycleId]. */

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { BreadcrumbOverride } from '@/components/layout/breadcrumb-override'
import { CycleStatusBadge } from './cycle-status-badge'
import { useCycleItems } from './cycle-items-context'
import type { CycleDetail } from '@/app/actions/compliance-audit-cycle'
import { ComplianceCycleStatus, AuditType } from '@prisma/client'
import { cn } from '@/lib/utils'

interface CycleDetailHeaderProps {
  cycle: CycleDetail
  readOnly: boolean
}

function initialsFromName(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase() || '?'
}

export function CycleDetailHeader({ cycle, readOnly }: CycleDetailHeaderProps) {
  return (
    <div className="space-y-4">
      {/* The global workspace breadcrumb (components/layout/breadcrumbs.tsx)
          already renders a trail from the URL. Override the final segment so
          the raw cycle UUID is replaced with the cycle name. */}
      <BreadcrumbOverride label={cycle.name} />

      {readOnly ? <ReadOnlyBanner cycle={cycle} /> : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{cycle.name}</h1>
            <CycleStatusBadge status={cycle.status} />
          </div>
          <MetadataChips cycle={cycle} />
        </div>

        <div className="flex items-center gap-4">
          <ProgressCluster />
          <Button variant="outline" disabled>
            Åtgärder
          </Button>
        </div>
      </div>
    </div>
  )
}

function MetadataChips({ cycle }: { cycle: CycleDetail }) {
  const auditLabel =
    cycle.auditType === AuditType.INTERN ? 'Intern revision' : 'Extern revision'
  const scheduled =
    format(cycle.scheduledStart, 'd MMM yyyy', { locale: sv }) +
    '–' +
    format(cycle.scheduledEnd, 'd MMM yyyy', { locale: sv })
  const leadName = cycle.leadAuditor.name ?? 'Okänd'

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
      <span className="truncate">{cycle.lawList.name}</span>
      <span aria-hidden="true">·</span>
      <span>{auditLabel}</span>
      <span aria-hidden="true">·</span>
      <span>{scheduled}</span>
      <span aria-hidden="true">·</span>
      <span className="inline-flex items-center gap-1.5">
        <Avatar className="h-5 w-5">
          <AvatarImage src={undefined} alt={leadName} />
          <AvatarFallback className="text-[10px]">
            {initialsFromName(cycle.leadAuditor.name)}
          </AvatarFallback>
        </Avatar>
        <span className="truncate">{leadName}</span>
      </span>
    </div>
  )
}

function ProgressCluster() {
  const ctx = useCycleItems()
  const {
    bedomdaCount,
    signeradeCount,
    totalCount,
    jumpToFirstUnbedomd,
    jumpToFirstUnsigned,
    ready,
  } = ctx

  const allBedomda = ready && bedomdaCount === totalCount && totalCount > 0
  const allSignerade = ready && signeradeCount === totalCount && totalCount > 0
  const empty = totalCount === 0

  const bedomdaDisabled = !ready || allBedomda || empty
  const signeradeDisabled = !ready || allSignerade || empty

  const bedomdaBtn = (
    <button
      type="button"
      onClick={jumpToFirstUnbedomd}
      disabled={bedomdaDisabled}
      aria-label="Hoppa till första obedömda posten"
      className={cn(
        'flex flex-col items-start rounded-md px-2 py-1 text-left text-sm transition-colors',
        !bedomdaDisabled &&
          'hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring',
        bedomdaDisabled && 'cursor-not-allowed opacity-60'
      )}
    >
      <span className="text-xs text-muted-foreground">Bedömda</span>
      <span className="font-semibold text-foreground">
        {bedomdaCount} av {totalCount}
      </span>
    </button>
  )

  const signeradeBtn = (
    <button
      type="button"
      onClick={jumpToFirstUnsigned}
      disabled={signeradeDisabled}
      aria-label="Hoppa till första osignerade posten"
      className={cn(
        'flex flex-col items-start rounded-md px-2 py-1 text-left text-sm transition-colors',
        !signeradeDisabled &&
          'hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring',
        signeradeDisabled && 'cursor-not-allowed opacity-60'
      )}
    >
      <span className="text-xs text-muted-foreground">Signerade</span>
      <span className="font-semibold text-foreground">
        {signeradeCount} av {totalCount}
      </span>
    </button>
  )

  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        {allBedomda ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{bedomdaBtn}</span>
            </TooltipTrigger>
            <TooltipContent>Alla poster bedömda</TooltipContent>
          </Tooltip>
        ) : (
          bedomdaBtn
        )}
        {allSignerade ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{signeradeBtn}</span>
            </TooltipTrigger>
            <TooltipContent>Alla poster signerade</TooltipContent>
          </Tooltip>
        ) : (
          signeradeBtn
        )}
      </TooltipProvider>
    </div>
  )
}

function storageKey(cycleId: string) {
  return `laglig:cycle-readonly-banner-dismissed:${cycleId}`
}

function ReadOnlyBanner({ cycle }: { cycle: CycleDetail }) {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    try {
      if (sessionStorage.getItem(storageKey(cycle.id)) === '1') {
        setDismissed(true)
      }
    } catch {
      // sessionStorage unavailable (SSR, private mode) — show banner by default.
    }
  }, [cycle.id])

  if (dismissed) return null

  const isSealed = cycle.status === ComplianceCycleStatus.SEALED
  const message = isSealed
    ? `Denna kontroll är förseglad (${cycle.sealHash ? cycle.sealHash.slice(0, 12) + '…' : 'okänd hash'}). Läsbehörighet endast.`
    : 'Denna kontroll är arkiverad. Läsbehörighet endast.'

  return (
    <div
      role="status"
      className="flex items-start justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      <p className="flex-1">{message}</p>
      <button
        type="button"
        onClick={() => {
          try {
            sessionStorage.setItem(storageKey(cycle.id), '1')
          } catch {
            // Ignore storage errors; just dismiss for the current view.
          }
          setDismissed(true)
        }}
        aria-label="Stäng meddelande"
        className="rounded p-1 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
