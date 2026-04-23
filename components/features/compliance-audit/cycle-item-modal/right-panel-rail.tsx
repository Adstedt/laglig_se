'use client'

/**
 * Epic 21 Story 21.16 — Cycle Item modal right-panel rail (State 2).
 *
 * Compact vertical icon rail shown when the AI chat is open. Surfaces the
 * item's most scannable metadata (bedömning / ansvarig / finding count)
 * plus a "restore full panel" affordance.
 */

import { cn } from '@/lib/utils'
import { ChevronsRight, User } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getBedomningOption } from '@/components/features/compliance-audit/bedomning-copy'
import { FindingSeverity, FindingType } from '@prisma/client'
import type { CycleItemRow } from '@/app/actions/compliance-audit-item'
import type { FindingRow } from '@/app/actions/compliance-finding'

interface CycleItemRightPanelRailProps {
  item: CycleItemRow
  findings: FindingRow[]
  /** Restore the full right panel (collapses the chat). */
  onExpandRail: () => void
}

const BEDOMNING_DOT: Record<string, string> = {
  UPPFYLLD: 'bg-green-500',
  DELVIS: 'bg-blue-500',
  EJ_UPPFYLLD: 'bg-red-500',
  EJ_TILLAMPLIG: 'bg-gray-400',
}

export function CycleItemRightPanelRail({
  item,
  findings,
  onExpandRail,
}: CycleItemRightPanelRailProps) {
  const bedomning = item.efterlevnadsbedomning
  const bedomningOption = getBedomningOption(bedomning)
  const dotClass = bedomning
    ? BEDOMNING_DOT[bedomning]
    : 'bg-muted-foreground/40'
  const assigneeName = item.sourceResponsibleUser?.name ?? null
  const openCount = findings.filter((f) => f.closedAt === null).length
  const majorCount = findings.filter(
    (f) =>
      f.closedAt === null &&
      f.type === FindingType.AVVIKELSE &&
      f.severity === FindingSeverity.MAJOR
  ).length

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full flex-col items-center gap-1 py-3">
        {/* Bedömning dot */}
        <RailIcon
          label={
            bedomningOption
              ? `Bedömning: ${bedomningOption.label}`
              : 'Bedömning: ej satt'
          }
        >
          <span
            className={cn(
              'block h-3 w-3 rounded-full ring-2 ring-background',
              dotClass
            )}
          />
        </RailIcon>

        {/* Ansvarig */}
        <RailIcon
          label={assigneeName ? `Ansvarig: ${assigneeName}` : 'Ingen ansvarig'}
        >
          {assigneeName ? (
            <Avatar className="h-5 w-5 border border-border/40">
              <AvatarFallback className="bg-muted text-[9px]">
                {assigneeName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : (
            <User className="h-[15px] w-[15px] text-muted-foreground" />
          )}
        </RailIcon>

        {/* Finding count chip with MAJOR accent */}
        <RailIcon
          label={
            openCount === 0
              ? 'Inga öppna findings'
              : majorCount > 0
                ? `${openCount} öppna findings (${majorCount} MAJOR)`
                : `${openCount} öppna findings`
          }
        >
          <span
            className={cn(
              'relative inline-flex h-5 w-5 items-center justify-center rounded-md border text-[10px] font-semibold',
              openCount === 0
                ? 'border-border bg-muted text-muted-foreground'
                : majorCount > 0
                  ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-200'
                  : 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200'
            )}
          >
            {openCount}
            {majorCount > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-background" />
            ) : null}
          </span>
        </RailIcon>

        {/* Restore full panel */}
        <div className="mt-auto flex flex-col items-center gap-1 pb-1">
          <div className="h-px w-5 bg-border" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onExpandRail}
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Visa alla detaljer"
              >
                <ChevronsRight className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">Visa alla detaljer</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  )
}

function RailIcon({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted"
          aria-label={label}
        >
          {children}
        </div>
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  )
}
