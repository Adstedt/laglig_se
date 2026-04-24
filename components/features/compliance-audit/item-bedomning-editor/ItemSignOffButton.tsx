'use client'

/** Story 21.5 — sign-off + unsign affordance for ComplianceAuditItem rows. */

import { useState } from 'react'
import { Check, Loader2, RotateCcw, X } from 'lucide-react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface ItemSignOffButtonProps {
  signedOffAt: Date | null
  signedOffBy: { id: string; name: string | null } | null
  canSign: boolean
  canUnsign: boolean
  onSign: () => Promise<void>
  onUnsign: () => Promise<void>
  /** Reason the button is disabled, surfaced in the tooltip. */
  disabledReason?: string | undefined
  className?: string
  /**
   * Visual variant for the signed state:
   *   - `'compact'` (default) — inline, table-row-sized: small stacked text
   *     on the left + tiny ghost X icon button on the right. Used in the
   *     cycle-items tab.
   *   - `'banner'` — full-width emerald banner + labeled "Ångra signering"
   *     button below. Used in the cycle-item modal's right panel where the
   *     signed state is the card's primary content.
   *
   * The unsigned state is identical across both variants (the Signera button
   * stretches via the `className` prop when needed).
   */
  signedVariant?: 'compact' | 'banner'
}

export function ItemSignOffButton({
  signedOffAt,
  signedOffBy,
  canSign,
  canUnsign,
  onSign,
  onUnsign,
  disabledReason,
  className,
  signedVariant = 'compact',
}: ItemSignOffButtonProps) {
  const [isBusy, setIsBusy] = useState(false)

  const handleSign = async () => {
    if (!canSign) return
    setIsBusy(true)
    try {
      await onSign()
    } finally {
      setIsBusy(false)
    }
  }

  const handleUnsign = async () => {
    if (!canUnsign) return
    setIsBusy(true)
    try {
      await onUnsign()
    } finally {
      setIsBusy(false)
    }
  }

  // Already signed — two visual modes:
  //   banner: emerald panel + labeled unsign button (cycle-item modal)
  //   compact: tight inline row with icon button (cycle-items table row)
  if (signedOffAt) {
    if (signedVariant === 'banner') {
      return (
        <div className={cn('space-y-3', className)}>
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-900 dark:bg-emerald-950/40">
            <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-800 dark:text-emerald-200">
              <Check className="h-3.5 w-3.5" />
              Signerad
            </div>
            <div className="mt-0.5 text-xs text-emerald-700/80 dark:text-emerald-300/80">
              {format(signedOffAt, 'd MMM yyyy HH:mm', { locale: sv })}
              {signedOffBy?.name ? ` · ${signedOffBy.name}` : ''}
            </div>
          </div>
          {canUnsign ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleUnsign}
              disabled={isBusy}
            >
              {isBusy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              )}
              Ångra signering
            </Button>
          ) : null}
        </div>
      )
    }

    // compact variant — table-row layout, preserves original design
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="flex flex-col text-xs">
          <span className="inline-flex items-center gap-1 font-medium text-green-700">
            <Check className="h-3 w-3" /> Signerad
          </span>
          <span className="text-muted-foreground">
            {format(signedOffAt, 'd MMM yyyy HH:mm', { locale: sv })}
            {signedOffBy?.name ? ` · ${signedOffBy.name}` : ''}
          </span>
        </div>
        {canUnsign ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleUnsign}
                  disabled={isBusy}
                  aria-label="Ångra signering"
                >
                  {isBusy ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ångra signering</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </div>
    )
  }

  // Not signed: render primary button; disabled + tooltip when blocked.
  const button = (
    <Button
      onClick={handleSign}
      disabled={!canSign || isBusy}
      className={className}
    >
      {isBusy ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
      Signera
    </Button>
  )

  if (!canSign && disabledReason) {
    return (
      <TooltipProvider>
        <Tooltip>
          {/* The `<span>` preserves the tooltip trigger across a disabled
           *  button (disabled buttons don't fire pointer events), and `block`
           *  lets `w-full` from the button propagate to the wrapper so a
           *  full-width CTA renders correctly. */}
          <TooltipTrigger asChild>
            <span className={cn(className?.includes('w-full') && 'block')}>
              {button}
            </span>
          </TooltipTrigger>
          <TooltipContent>{disabledReason}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return button
}
