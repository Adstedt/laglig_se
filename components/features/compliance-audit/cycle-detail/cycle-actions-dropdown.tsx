'use client'

/**
 * Story 21.6 — Actions dropdown (Complete / Revert) for /laglistor/kontroller/[cycleId].
 *
 * Pure presentation: owns neither dialog state nor server-action invocation.
 * The two handler props push work up to `CycleDetailPage` (the orchestrator),
 * where dialog open/close state and mutation callbacks already live.
 *
 * Dropdown visibility rule (AC 1, 6, 6.6):
 *  - Rendered in PAGAENDE + AVSLUTAD only. Hidden in PLANERAD (empty cycle) +
 *    SEALED/ARKIVERAD (read-only banner covers it).
 *  - PAGAENDE shows "Slutför kontroll".
 *  - AVSLUTAD shows "Återställ till Pågående" (destructive styling).
 *
 * SF-1 Radix gotcha: a native `<DropdownMenuItem disabled>` suppresses pointer
 * events, so hover tooltips never fire. Instead we render the item enabled
 * but non-actionable via `onSelect={(e) => e.preventDefault()}` + visual
 * muting (aria-disabled, opacity-60, cursor-not-allowed). The wrapping
 * `<Tooltip>` then fires correctly on hover.
 */

import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { CycleDetail } from '@/app/actions/compliance-audit-cycle'
import { ComplianceCycleStatus } from '@prisma/client'

// Exported for unit tests + downstream reuse. Radix Tooltip content is
// rendered via a portal + only mounted on hover — unreliable to assert in
// happy-dom. Tests pin the exact Swedish copy here so any regression to the
// copy trips a test even without the tooltip being visually triggered.
export const DROPDOWN_TOOLTIP_COPY = {
  zeroItems: 'Kontrollen innehåller inga dokument att slutföra.',
  unsignedItems: (unsigned: number, total: number) =>
    `Slutför kontroll: ${unsigned} av ${total} dokument behöver signeras.`,
  cannotRevert:
    'Endast revisionsledaren eller administratörer kan återställa kontrollen.',
  // Story 21.9 — seal permission denial (matches the server-action error verbatim).
  cannotSeal:
    "Endast revisionsledaren eller administratörer med behörighet 'audit:seal' kan fastställa kontrollen.",
} as const

interface CycleActionsDropdownProps {
  cycle: CycleDetail
  totalCount: number
  signeradeCount: number
  canRevert: boolean
  // Story 21.9 — runtime flag for the Seal affordance.
  canSeal: boolean
  onCompleteClick: () => void
  onRevertClick: () => void
  onSealClick: () => void
  /**
   * Test-only escape hatch. Radix DropdownMenu's pointer-event-based open
   * semantics are unreliable in happy-dom; tests pass `defaultOpen` to force
   * the menu into its open state at mount and then assert on menu items +
   * tooltip copy directly. Not used in production.
   */
  defaultOpen?: boolean
}

export function CycleActionsDropdown({
  cycle,
  totalCount,
  signeradeCount,
  canRevert,
  canSeal,
  onCompleteClick,
  onRevertClick,
  onSealClick,
  defaultOpen,
}: CycleActionsDropdownProps) {
  const showComplete = cycle.status === ComplianceCycleStatus.PAGAENDE
  const showRevert = cycle.status === ComplianceCycleStatus.AVSLUTAD
  const showSeal = cycle.status === ComplianceCycleStatus.AVSLUTAD

  // Dropdown renders in PAGAENDE + AVSLUTAD only. Other states
  // (PLANERAD / SEALED / ARKIVERAD) return null — the read-only banner or
  // empty-cycle UX covers the messaging.
  if (!showComplete && !showRevert && !showSeal) {
    return null
  }

  return (
    <TooltipProvider>
      <DropdownMenu {...(defaultOpen !== undefined ? { defaultOpen } : {})}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-1.5">
            Åtgärder
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {showComplete ? (
            <CompleteMenuItem
              totalCount={totalCount}
              signeradeCount={signeradeCount}
              onClick={onCompleteClick}
            />
          ) : null}
          {showRevert ? (
            <RevertMenuItem canRevert={canRevert} onClick={onRevertClick} />
          ) : null}
          {showSeal ? (
            <SealMenuItem canSeal={canSeal} onClick={onSealClick} />
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  )
}

// ---------------------------------------------------------------------------
// Slutför kontroll — PAGAENDE only
// ---------------------------------------------------------------------------

interface CompleteMenuItemProps {
  totalCount: number
  signeradeCount: number
  onClick: () => void
}

function CompleteMenuItem({
  totalCount,
  signeradeCount,
  onClick,
}: CompleteMenuItemProps) {
  const isZero = totalCount === 0
  const hasUnsigned = !isZero && signeradeCount !== totalCount
  const blocked = isZero || hasUnsigned

  const tooltip = isZero
    ? DROPDOWN_TOOLTIP_COPY.zeroItems
    : hasUnsigned
      ? DROPDOWN_TOOLTIP_COPY.unsignedItems(
          totalCount - signeradeCount,
          totalCount
        )
      : null

  if (!blocked) {
    return (
      <DropdownMenuItem onSelect={onClick}>Slutför kontroll</DropdownMenuItem>
    )
  }

  // SF-1: non-actionable but pointer-active so the wrapping Tooltip fires.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          aria-disabled={true}
          className={cn('cursor-not-allowed opacity-60')}
        >
          Slutför kontroll
        </DropdownMenuItem>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  )
}

// ---------------------------------------------------------------------------
// Återställ till Pågående — AVSLUTAD only
// ---------------------------------------------------------------------------

interface RevertMenuItemProps {
  canRevert: boolean
  onClick: () => void
}

function RevertMenuItem({ canRevert, onClick }: RevertMenuItemProps) {
  // Revert is REVERSIBLE (soft revert — status flip only, signatures preserved)
  // → neutral styling. Keeps dark-mode contrast readable and gives Seal
  // (irreversible) its own uncontested destructive-red slot in the menu.
  if (canRevert) {
    return (
      <DropdownMenuItem onSelect={onClick}>
        Återställ till Pågående
      </DropdownMenuItem>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          aria-disabled={true}
          className={cn('cursor-not-allowed opacity-60')}
        >
          Återställ till Pågående
        </DropdownMenuItem>
      </TooltipTrigger>
      <TooltipContent>{DROPDOWN_TOOLTIP_COPY.cannotRevert}</TooltipContent>
    </Tooltip>
  )
}

// ---------------------------------------------------------------------------
// Fastställ kontroll — AVSLUTAD only (Story 21.9)
// ---------------------------------------------------------------------------

interface SealMenuItemProps {
  canSeal: boolean
  onClick: () => void
}

function SealMenuItem({ canSeal, onClick }: SealMenuItemProps) {
  if (canSeal) {
    return (
      <DropdownMenuItem
        onSelect={onClick}
        className="text-destructive focus:text-destructive"
      >
        Fastställ kontroll
      </DropdownMenuItem>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <DropdownMenuItem
          onSelect={(e) => e.preventDefault()}
          aria-disabled={true}
          className={cn(
            'cursor-not-allowed text-destructive opacity-60 focus:text-destructive'
          )}
        >
          Fastställ kontroll
        </DropdownMenuItem>
      </TooltipTrigger>
      <TooltipContent>{DROPDOWN_TOOLTIP_COPY.cannotSeal}</TooltipContent>
    </Tooltip>
  )
}
