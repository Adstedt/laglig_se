'use client'

/**
 * Story 7.3: Personalkort compliance summary sidebar (the modal's rightPanel).
 *
 * Mirrors the law-list modal's right-panel conventions (border-l bg-muted/30
 * container + ScrollArea + Card with DetailRow-style rows) WITHOUT importing
 * law-list components — parallel, employee-typed only.
 *
 * Story 7.4: the "Uppgifter" card renders the completeness verdict computed
 * by `assessEmployeeCompleteness` (passed in by the modal — this component
 * stays dumb): green check + "Komplett", or an amber "Ej komplett" badge
 * with the per-record reason list. Copy rule: the noun "kompletthet" is
 * banned — phrasing is "uppgifter saknas".
 */

import type { ReactNode } from 'react'
import { CircleCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { EmployeeCompleteness } from '@/lib/employees/employee-completeness'
import { EMPTY_FIELD_LABEL } from '../labels'
import { EmployeeStatusBadge } from './status-badge'

function DetailRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center justify-between py-2.5 -mx-2 px-2 rounded-md">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center">{children}</div>
    </div>
  )
}

interface ComplianceSidebarProps {
  inactive: boolean
  agreementName: string | null
  /**
   * Story 7.4: verdict from `assessEmployeeCompleteness` over the saved
   * row; null in create mode (no record to assess yet).
   */
  completeness: EmployeeCompleteness | null
}

export function ComplianceSidebar({
  inactive,
  agreementName,
  completeness,
}: ComplianceSidebarProps) {
  return (
    <div className="h-full border-l bg-muted/30 max-md:border-t max-md:border-l-0">
      <ScrollArea className="h-full max-h-[calc(90vh-60px)] max-md:max-h-none">
        <div className="p-6 space-y-6">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground">
                Sammanfattning
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                <DetailRow label="Status">
                  <EmployeeStatusBadge inactive={inactive} />
                </DetailRow>
                <DetailRow label="Kollektivavtal">
                  <span
                    className={
                      agreementName
                        ? 'text-sm text-foreground'
                        : 'text-sm text-muted-foreground'
                    }
                  >
                    {agreementName ?? EMPTY_FIELD_LABEL}
                  </span>
                </DetailRow>
              </div>
            </CardContent>
          </Card>

          {/* Story 7.4: "uppgifter saknas" verdict (replaces the 7.3
              placeholder slot). */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-foreground">
                Uppgifter
              </CardTitle>
            </CardHeader>
            <CardContent>
              {completeness === null ? (
                <p className="text-sm text-muted-foreground">
                  Här visas om uppgifter saknas när den anställda har sparats.
                </p>
              ) : completeness.complete ? (
                <p className="flex items-center gap-2 text-sm text-foreground">
                  <CircleCheck
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
                  />
                  Komplett
                </p>
              ) : (
                <div className="space-y-2.5">
                  <Badge tone="warning" variant="soft">
                    Ej komplett
                  </Badge>
                  <ul className="space-y-1">
                    {completeness.reasons.map((reason) => (
                      <li
                        key={reason}
                        className="flex gap-2 text-sm text-muted-foreground"
                      >
                        <span aria-hidden="true" className="shrink-0">
                          •
                        </span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  )
}
