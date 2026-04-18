'use client'

/**
 * Story 17.19: Legal Document Modal Right-Panel Rail
 *
 * Compact vertical icon rail shown in State 2 of SplitPanelModal (chat open).
 * Surfaces the law's most scannable metadata (status / priority / assignee /
 * external link to the full law) plus a "restore full panel" affordance.
 * Hovering any icon reveals a HoverCard with the full Detaljer snapshot.
 */

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Flag, User, ExternalLink, ChevronsRight } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { ListItemDetails } from '@/app/actions/legal-document-modal'
import type { ComplianceStatus } from '@prisma/client'

interface RightPanelRailProps {
  listItem: ListItemDetails
  /** Restore the full right-panel (collapses the chat). */
  onExpandRail: () => void
}

const STATUS_CONFIG: Record<ComplianceStatus, { label: string; dot: string }> =
  {
    EJ_PABORJAD: { label: 'Ej påbörjad', dot: 'bg-gray-400' },
    PAGAENDE: { label: 'Delvis uppfylld', dot: 'bg-blue-500' },
    UPPFYLLD: { label: 'Uppfylld', dot: 'bg-green-500' },
    EJ_UPPFYLLD: { label: 'Ej uppfylld', dot: 'bg-red-500' },
    EJ_TILLAMPLIG: { label: 'Ej tillämplig', dot: 'bg-gray-300' },
  }

const PRIORITY_CONFIG = {
  LOW: { label: 'Låg', iconColor: 'text-slate-500' },
  MEDIUM: { label: 'Medel', iconColor: 'text-amber-500' },
  HIGH: { label: 'Hög', iconColor: 'text-rose-500' },
} as const

function getDocumentUrl(contentType: string, slug: string): string {
  if (contentType === 'EU_REGULATION' || contentType === 'EU_DIRECTIVE') {
    return `/browse/eu/${slug}`
  }
  if (contentType === 'AGENCY_REGULATION') {
    return `/browse/foreskrifter/${slug}`
  }
  return `/browse/lagar/${slug}`
}

export function RightPanelRail({
  listItem,
  onExpandRail,
}: RightPanelRailProps) {
  const status =
    STATUS_CONFIG[listItem.complianceStatus] ?? STATUS_CONFIG.EJ_PABORJAD
  const priority =
    PRIORITY_CONFIG[listItem.priority as keyof typeof PRIORITY_CONFIG] ??
    PRIORITY_CONFIG.MEDIUM
  const assignee = listItem.responsibleUser
  const docUrl = getDocumentUrl(
    listItem.legalDocument.contentType,
    listItem.legalDocument.slug
  )

  return (
    <TooltipProvider delayDuration={300}>
      <HoverCard openDelay={120} closeDelay={120}>
        <HoverCardTrigger asChild>
          <div className="flex flex-col items-center gap-1 py-3 h-full">
            {/* Status dot */}
            <RailIcon label={`Efterlevnad: ${status.label}`}>
              <span
                className={cn(
                  'block h-3 w-3 rounded-full ring-2 ring-background',
                  status.dot
                )}
              />
            </RailIcon>

            {/* Priority */}
            <RailIcon label={`Prioritet: ${priority.label}`}>
              <Flag className={cn('h-[15px] w-[15px]', priority.iconColor)} />
            </RailIcon>

            {/* Assignee */}
            <RailIcon
              label={
                assignee
                  ? `Ansvarig: ${assignee.name ?? assignee.email}`
                  : 'Ingen tilldelad'
              }
            >
              {assignee ? (
                <Avatar className="h-5 w-5 border border-border/40">
                  {assignee.avatarUrl && (
                    <AvatarImage src={assignee.avatarUrl} />
                  )}
                  <AvatarFallback className="text-[9px] bg-muted">
                    {(assignee.name ?? assignee.email)
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <User className="h-[15px] w-[15px] text-muted-foreground" />
              )}
            </RailIcon>

            {/* External link to full law */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Öppna fullständig lag"
                >
                  <ExternalLink className="h-[15px] w-[15px]" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="left">Öppna fullständig lag</TooltipContent>
            </Tooltip>

            {/* Separator + expand rail */}
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
        </HoverCardTrigger>

        <HoverCardContent side="left" align="start" className="w-72 p-0">
          <div className="p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Detaljer
            </div>
            <div className="space-y-2 text-sm">
              <DetailRow label="Dokumentnr">
                <span className="font-mono text-xs">
                  {listItem.legalDocument.documentNumber}
                </span>
              </DetailRow>
              <DetailRow label="Efterlevnad">
                <span className="inline-flex items-center gap-1.5">
                  <span className={cn('h-2 w-2 rounded-full', status.dot)} />
                  {status.label}
                </span>
              </DetailRow>
              <DetailRow label="Prioritet">
                <span className="inline-flex items-center gap-1.5">
                  <Flag className={cn('h-3.5 w-3.5', priority.iconColor)} />
                  {priority.label}
                </span>
              </DetailRow>
              <DetailRow label="Ansvarig">
                {assignee ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Avatar className="h-4 w-4">
                      {assignee.avatarUrl && (
                        <AvatarImage src={assignee.avatarUrl} />
                      )}
                      <AvatarFallback className="text-[8px]">
                        {(assignee.name ?? assignee.email)
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {assignee.name ?? assignee.email}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Ingen</span>
                )}
              </DetailRow>
            </div>
            <button
              type="button"
              onClick={onExpandRail}
              className="mt-3 w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              Visa alla detaljer
            </button>
          </div>
        </HoverCardContent>
      </HoverCard>
    </TooltipProvider>
  )
}

interface RailIconProps {
  label: string
  children: React.ReactNode
}

function RailIcon({ label, children }: RailIconProps) {
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

function DetailRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  )
}
