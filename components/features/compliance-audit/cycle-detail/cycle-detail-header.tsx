'use client'

/** Story 21.5 — Header for /laglistor/kontroller/[cycleId]. */

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Copy, ShieldCheck, X } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { BreadcrumbOverride } from '@/components/layout/breadcrumb-override'
import { CycleStatusBadge } from './cycle-status-badge'
import { CycleActionsDropdown } from './cycle-actions-dropdown'
import { useCycleItems } from './cycle-items-context'
import type { CycleDetail } from '@/app/actions/compliance-audit-cycle'
import { ComplianceCycleStatus, AuditType } from '@prisma/client'
import { cn } from '@/lib/utils'

interface CycleDetailHeaderProps {
  cycle: CycleDetail
  readOnly: boolean
  findingCounts: { open: number; closed: number }
  // Story 21.6 — cycle-lifecycle affordances. Counts are plumbed as props
  // (not consumed via useCycleItems()) for symmetry with findingCounts.
  totalCount: number
  signeradeCount: number
  canRevert: boolean
  // Story 21.9 — seal affordances.
  canSeal: boolean
  onCompleteClick: () => void
  onRevertClick: () => void
  onSealClick: () => void
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
  readOnly,
  findingCounts,
  totalCount,
  signeradeCount,
  canRevert,
  canSeal,
  onCompleteClick,
  onRevertClick,
  onSealClick,
}: CycleDetailHeaderProps) {
  const isSealed = cycle.status === ComplianceCycleStatus.SEALED

  return (
    <div className="space-y-4">
      {/* The global workspace breadcrumb (components/layout/breadcrumbs.tsx)
          already renders a trail from the URL. Override the final segment so
          the raw cycle UUID is replaced with the cycle name. */}
      <BreadcrumbOverride label={cycle.name} />

      {/* Story 21.9 — rich sealed-cycle banner with seal hash + copy button.
          Supersedes the generic read-only banner for SEALED cycles; the
          read-only banner still shows for ARKIVERAD. */}
      {isSealed ? <SealedCycleBanner cycle={cycle} /> : null}
      {readOnly && !isSealed ? <ReadOnlyBanner cycle={cycle} /> : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold">{cycle.name}</h1>
            <CycleStatusBadge status={cycle.status} />
          </div>
          <MetadataChips cycle={cycle} findingCounts={findingCounts} />
          {cycle.description?.trim() ? (
            <p className="max-w-3xl whitespace-pre-wrap text-sm text-muted-foreground">
              {cycle.description}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-4">
          <ProgressCluster />
          {/* Story 21.6 — Åtgärder dropdown (Complete / Revert).
              Story 21.9 — extended with Fastställ kontroll (seal). */}
          <CycleActionsDropdown
            cycle={cycle}
            totalCount={totalCount}
            signeradeCount={signeradeCount}
            canRevert={canRevert}
            canSeal={canSeal}
            onCompleteClick={onCompleteClick}
            onRevertClick={onRevertClick}
            onSealClick={onSealClick}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Story 21.9 — rich SEALED-cycle banner. Renders the seal hash (truncated
 * with a copy-to-clipboard button), the "Fastställd av X den Y" subline,
 * and a shield-check icon. Always-on (not dismissible) for SEALED cycles
 * so the seal metadata is persistently visible.
 */
export function SealedCycleBanner({ cycle }: { cycle: CycleDetail }) {
  const handleCopy = async () => {
    if (!cycle.sealHash) return
    try {
      await navigator.clipboard.writeText(cycle.sealHash)
      toast.success('Kontrollsumma kopierad')
    } catch {
      toast.error('Kunde inte kopiera — försök välja texten manuellt.')
    }
  }

  const truncated = cycle.sealHash
    ? `${cycle.sealHash.slice(0, 8)}…${cycle.sealHash.slice(-4)}`
    : 'okänd hash'
  const sealerName = cycle.sealedBy?.name ?? 'okänd användare'
  const sealedAtLabel = cycle.sealedAt
    ? format(cycle.sealedAt, 'd MMM yyyy', { locale: sv })
    : 'okänt datum'

  return (
    <div
      role="status"
      aria-label="Fastställd kontroll — kontrollsumma tillgänglig"
      className="space-y-1 rounded-md border border-amber-500/50 bg-amber-50/50 px-3 py-2 text-sm dark:border-amber-500/40 dark:bg-amber-950/30"
    >
      <div className="flex items-center gap-2">
        <ShieldCheck
          className="h-4 w-4 text-amber-700 dark:text-amber-300"
          aria-hidden="true"
        />
        <span className="font-medium text-amber-900 dark:text-amber-100">
          Fastställd
        </span>
        <code
          data-testid="seal-hash-truncated"
          className="rounded bg-amber-100/60 px-1.5 py-0.5 font-mono text-xs text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
        >
          {truncated}
        </code>
        {cycle.sealHash ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void handleCopy()}
            aria-label="Kopiera kontrollsumma"
            className="h-6 px-2"
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
      <p className="pl-6 text-xs text-amber-900/80 dark:text-amber-100/80">
        Fastställd av {sealerName} den {sealedAtLabel}
      </p>
    </div>
  )
}

function MetadataChips({
  cycle,
  findingCounts,
}: {
  cycle: CycleDetail
  findingCounts: { open: number; closed: number }
}) {
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
      <span aria-hidden="true">·</span>
      <FindingsCountChip counts={findingCounts} />
    </div>
  )
}

function FindingsCountChip({
  counts,
}: {
  counts: { open: number; closed: number }
}) {
  const { open, closed } = counts
  const label =
    open === 0 && closed === 0
      ? 'Anmärkningar: inga'
      : `Anmärkningar: ${open} öppna · ${closed} stängda`
  return (
    <span data-testid="cycle-header-findings-chip" className="truncate">
      {label}
    </span>
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
      aria-label="Hoppa till första obedömda dokumentet"
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
      aria-label="Hoppa till första osignerade dokumentet"
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
            <TooltipContent>Alla dokument bedömda</TooltipContent>
          </Tooltip>
        ) : (
          bedomdaBtn
        )}
        {allSignerade ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{signeradeBtn}</span>
            </TooltipTrigger>
            <TooltipContent>Alla dokument signerade</TooltipContent>
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
    ? `Denna kontroll är fastställd (${cycle.sealHash ? cycle.sealHash.slice(0, 12) + '…' : 'okänd hash'}). Läsbehörighet endast.`
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
