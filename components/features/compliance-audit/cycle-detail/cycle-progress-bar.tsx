'use client'

/**
 * Audit-cycle progress band. Renders a full-width dual-segment bar showing
 * Bedömda + Signerade counts together — sequential semantics: the lighter
 * inner segment grows when a row is assessed, the solid outer segment
 * grows when it's signed.
 *
 * Replaces the per-stat numbers that used to live in the page header's
 * `stats` slot. The Bedömda / Signerade counts are still surfaced (audit
 * reports often need the exact numbers) and remain clickable buttons that
 * jump to the first unbedömt / unsigned row via the cycle-items context.
 */

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useCycleItems } from './cycle-items-context'

export function CycleProgressBar() {
  const {
    bedomdaCount,
    signeradeCount,
    totalCount,
    jumpToFirstUnbedomd,
    jumpToFirstUnsigned,
    ready,
  } = useCycleItems()

  if (totalCount === 0) return null

  const assessedPct = Math.min(100, (bedomdaCount / totalCount) * 100)
  const signedPct = Math.min(100, (signeradeCount / totalCount) * 100)
  const signedPctLabel = Math.round(signedPct)

  const allSigned = signeradeCount === totalCount
  const allAssessed = bedomdaCount === totalCount

  return (
    <div
      className="sticky top-0 z-10 rounded-lg border bg-card/80 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/60"
      role="region"
      aria-label="Kontrollens framsteg"
    >
      <div className="flex items-center gap-4 md:gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-medium text-muted-foreground">
              Kontrollens framsteg
            </span>
            <span className="tabular-nums text-muted-foreground">
              <JumpCount
                count={signeradeCount}
                label="signerade"
                ariaLabel="Hoppa till första osignerade dokumentet"
                onClick={jumpToFirstUnsigned}
                disabled={!ready || allSigned}
                {...(allSigned ? { tooltip: 'Alla dokument signerade' } : {})}
              />
              <span className="px-1.5 text-muted-foreground/60">·</span>
              <JumpCount
                count={bedomdaCount}
                label="bedömda"
                ariaLabel="Hoppa till första obedömda dokumentet"
                onClick={jumpToFirstUnbedomd}
                disabled={!ready || allAssessed}
                {...(allAssessed ? { tooltip: 'Alla dokument bedömda' } : {})}
              />
              <span className="px-1.5 text-muted-foreground/60">·</span>
              <span>
                <span className="text-foreground">{totalCount}</span> totalt
              </span>
            </span>
          </div>
          <div
            className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={totalCount}
            aria-valuenow={signeradeCount}
            aria-label={`${signeradeCount} av ${totalCount} signerade, ${bedomdaCount} av ${totalCount} bedömda`}
          >
            <div
              className="absolute inset-y-0 left-0 bg-emerald-500/30 transition-[width] duration-300"
              style={{ width: `${assessedPct}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-emerald-500 transition-[width] duration-300"
              style={{ width: `${signedPct}%` }}
            />
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-semibold leading-none tabular-nums">
            {signedPctLabel} %
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            klart
          </div>
        </div>
      </div>
    </div>
  )
}

interface JumpCountProps {
  count: number
  label: string
  ariaLabel: string
  onClick: () => void
  disabled: boolean
  tooltip?: string
}

function JumpCount({
  count,
  label,
  ariaLabel,
  onClick,
  disabled,
  tooltip,
}: JumpCountProps) {
  const btn = (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'rounded text-foreground transition-colors',
        !disabled &&
          'hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        disabled && 'cursor-default'
      )}
    >
      <span className="font-medium">{count}</span>{' '}
      <span className="text-muted-foreground">{label}</span>
    </button>
  )
  if (!tooltip) return btn
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>{btn}</span>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
