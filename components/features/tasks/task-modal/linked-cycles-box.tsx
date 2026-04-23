'use client'

/**
 * Story 21.8 — "Länkade kontroller" right-rail card for the task modal.
 *
 * Read-only surface in 21.8 — renders the M:N link between a task and one or
 * more ComplianceAuditCycles (populated by `spawnCorrectiveActionTask` on
 * AVVIKELSE-driven task spawns). Returns null when the task has no linked
 * cycles, so the card silently disappears for regular manually-created tasks.
 *
 * Story 21.15 will add the "+ Lägg till länk" affordance + manual-link UX;
 * this component already renders a length-N array so that story won't need
 * a refactor.
 */

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ClipboardCheck, AlertTriangle } from 'lucide-react'
import type { TaskDetails } from '@/app/actions/task-modal'

interface LinkedCyclesBoxProps {
  cycles: TaskDetails['linkedCycles']
  correctiveActionFinding: TaskDetails['complianceFinding']
}

const CYCLE_STATUS_LABELS: Record<string, string> = {
  PLANERAD: 'Planerad',
  PAGAENDE: 'Pågående',
  AVSLUTAD: 'Avslutad',
  SEALED: 'Fastställd',
  ARKIVERAD: 'Arkiverad',
}

/**
 * Epic 21 follow-up: the opt-in spawn flow allows OBSERVATION + FÖRBÄTTRING
 * findings to originate corrective-action tasks. The sub-badge copy must
 * reflect the actual type rather than assume AVVIKELSE.
 */
const FINDING_TYPE_PREFIX: Record<string, string> = {
  AVVIKELSE: 'Från avvikelse',
  OBSERVATION: 'Från observation',
  FORBATTRING: 'Från förbättringsförslag',
}

const FINDING_TITLE_MAX = 60

function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  return value.slice(0, max - 1) + '…'
}

export function LinkedCyclesBox({
  cycles,
  correctiveActionFinding,
}: LinkedCyclesBoxProps) {
  if (cycles.length === 0) return null

  const ariaLabel =
    'Länkade kontroller: ' + cycles.map((c) => c.name).join(', ')

  return (
    <Card
      className="border-border/60 w-full overflow-hidden"
      aria-label={ariaLabel}
    >
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
          <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          Länkade kontroller
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {cycles.map((cycle) => {
            const findingForCycle =
              correctiveActionFinding !== null &&
              correctiveActionFinding.cycle.id === cycle.id
                ? correctiveActionFinding
                : null
            return (
              <div
                key={cycle.id}
                className="rounded-md border border-border/60 p-2.5 hover:bg-muted/50 transition-colors"
              >
                <Link
                  href={`/laglistor/kontroller/${cycle.id}`}
                  className="block"
                >
                  <p className="text-sm font-medium truncate">{cycle.name}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">
                      {CYCLE_STATUS_LABELS[cycle.status] ?? cycle.status}
                    </Badge>
                    {typeof cycle.itemCount === 'number' && (
                      <span>{cycle.itemCount} poster</span>
                    )}
                  </div>
                </Link>
                {findingForCycle !== null && (
                  <div className="mt-2 flex items-start gap-1.5 rounded-sm border border-amber-200 bg-amber-50 p-1.5 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                    <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                    <span className="truncate">
                      {FINDING_TYPE_PREFIX[findingForCycle.type] ??
                        'Från finding'}
                      :{' '}
                      <span className="font-medium">
                        {truncate(findingForCycle.title, FINDING_TITLE_MAX)}
                      </span>
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
