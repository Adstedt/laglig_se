'use client'

/** Story 21.5 — Row drawer for a ComplianceAuditItem: kravpunkter snapshot + live artifacts + findings placeholder. */

import { Check, Circle } from 'lucide-react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Accordion } from '@/components/ui/accordion'
import { LinkedArtifactsPanel } from '@/components/features/document-list/legal-document-modal/linked-artifacts-panel'
import type { CycleItemRow } from '@/app/actions/compliance-audit-item'

interface CycleItemRowDrawerProps {
  row: CycleItemRow
}

export function CycleItemRowDrawer({ row }: CycleItemRowDrawerProps) {
  const snapshot = row.kravpunkterSnapshot
  const frozenAt = snapshot?.frozen_at
    ? (() => {
        try {
          return format(new Date(snapshot.frozen_at), 'd MMM yyyy HH:mm', {
            locale: sv,
          })
        } catch {
          return snapshot.frozen_at
        }
      })()
    : null

  return (
    <div className="space-y-6 border-t bg-muted/30 p-6">
      <section>
        <header className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">Kravpunkter (snapshot)</h3>
          {frozenAt ? (
            <span className="text-xs text-muted-foreground">
              Fryst {frozenAt}
            </span>
          ) : null}
        </header>
        {!snapshot || snapshot.requirements.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">
            Inga kravpunkter registrerade vid materialiseringen.
          </p>
        ) : (
          <ul className="space-y-2">
            {snapshot.requirements.map((req) => (
              <li key={req.id} className="flex items-start gap-2 text-sm">
                {req.is_fulfilled ? (
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-green-600"
                    aria-label="Uppfylld"
                  />
                ) : (
                  <Circle
                    className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                    aria-label="Ej uppfylld"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap">{req.text}</p>
                  {req.comment ? (
                    <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                      {req.comment}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <header className="mb-3">
          <h3 className="text-sm font-semibold">Länkade artefakter (live)</h3>
          <p className="text-xs text-muted-foreground">
            Visar nuvarande kopplingar till källagen — den försseglade
            bevismängden hanteras separat vid försegling (Story 21.9).
          </p>
        </header>
        {/* Panel owns its own SWR fetch + error UI; do NOT wrap in a parent
            error boundary — a panel failure must not collapse the drawer.
            LinkedArtifactsPanel's root is a Radix <AccordionItem> and needs
            an <Accordion> ancestor to mount — defaultValue keeps it expanded
            so the auditor sees the contents immediately. */}
        <Accordion
          type="multiple"
          defaultValue={['linked-artifacts']}
          className="w-full"
        >
          <LinkedArtifactsPanel listItemId={row.lawListItemId} readOnly />
        </Accordion>
      </section>

      <section>
        <header className="mb-3">
          <h3 className="text-sm font-semibold">Findings</h3>
        </header>
        <p className="text-sm italic text-muted-foreground">
          Hanteras i Story 21.7
        </p>
      </section>
    </div>
  )
}
