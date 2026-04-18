'use client'

/**
 * Story 17.19: Task Modal Right-Panel Rail
 *
 * Compact vertical icon rail rendered in State 2 of SplitPanelModal (chat open).
 * Surfaces the task's most scannable metadata (status / priority / assignee /
 * due date) and a "restore full panel" affordance. Hovering any icon reveals
 * a HoverCard with the full Detaljer snapshot.
 */

import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Calendar, Flag, User, ChevronsRight } from 'lucide-react'
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
import type { TaskDetails } from '@/app/actions/task-modal'
import type { WorkspaceMember } from '../task-workspace'
import type { TaskColumnWithCount } from '@/app/actions/tasks'
import type { TaskPriority } from '@prisma/client'

interface RightPanelRailProps {
  task: TaskDetails
  workspaceMembers: WorkspaceMember[]
  columns: TaskColumnWithCount[]
  /** Restore the full right-panel (collapses the chat). */
  onExpandRail: () => void
}

const PRIORITY_CONFIG: Record<
  TaskPriority,
  { label: string; iconColor: string }
> = {
  LOW: { label: 'Låg', iconColor: 'text-gray-500' },
  MEDIUM: { label: 'Medium', iconColor: 'text-blue-500' },
  HIGH: { label: 'Hög', iconColor: 'text-orange-500' },
  CRITICAL: { label: 'Kritisk', iconColor: 'text-red-500' },
}

export function RightPanelRail({
  task,
  workspaceMembers,
  columns,
  onExpandRail,
}: RightPanelRailProps) {
  const currentColumn = columns.find((c) => c.id === task.column_id)
  const assignee = workspaceMembers.find((m) => m.id === task.assignee_id)
  const priorityConfig = PRIORITY_CONFIG[task.priority]
  const dueDate = task.due_date ? new Date(task.due_date) : null

  return (
    <TooltipProvider delayDuration={300}>
      <HoverCard openDelay={120} closeDelay={120}>
        <HoverCardTrigger asChild>
          <div className="flex flex-col items-center gap-1 py-3 h-full">
            {/* Status dot */}
            <RailIcon label={`Status: ${currentColumn?.name ?? '—'}`}>
              <span
                className="block h-3 w-3 rounded-full ring-2 ring-background"
                style={{ backgroundColor: currentColumn?.color ?? '#888' }}
              />
            </RailIcon>

            {/* Priority */}
            <RailIcon label={`Prioritet: ${priorityConfig.label}`}>
              <Flag
                className={cn('h-[15px] w-[15px]', priorityConfig.iconColor)}
              />
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

            {/* Due date */}
            <RailIcon
              label={
                dueDate
                  ? `Förfaller: ${format(dueDate, 'd MMM yyyy', { locale: sv })}`
                  : 'Inget förfallodatum'
              }
            >
              <Calendar
                className={cn(
                  'h-[15px] w-[15px]',
                  dueDate ? 'text-foreground' : 'text-muted-foreground'
                )}
              />
            </RailIcon>

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
              <DetailRow label="Status">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: currentColumn?.color ?? '#888' }}
                  />
                  {currentColumn?.name ?? '—'}
                </span>
              </DetailRow>
              <DetailRow label="Prioritet">
                <span className="inline-flex items-center gap-1.5">
                  <Flag
                    className={cn('h-3.5 w-3.5', priorityConfig.iconColor)}
                  />
                  {priorityConfig.label}
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
              <DetailRow label="Förfaller">
                {dueDate ? (
                  format(dueDate, 'd MMM yyyy', { locale: sv })
                ) : (
                  <span className="text-muted-foreground">—</span>
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
