'use client'

/** Story 21.5 — sign-off + unsign affordance for ComplianceAuditItem rows. */

import { useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'
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

  // Already signed: show metadata + unsign X.
  if (signedOffAt) {
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
      size="sm"
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
          <TooltipTrigger asChild>
            <span>{button}</span>
          </TooltipTrigger>
          <TooltipContent>{disabledReason}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return button
}
