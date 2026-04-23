'use client'

/**
 * Story 21.5 — Row drawer for a ComplianceAuditItem: kravpunkter snapshot +
 * live artifacts + per-item findings affordance (Story 21.7 AC 13).
 */

import { useMemo, useState } from 'react'
import { Check, Circle, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Accordion } from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LinkedArtifactsPanel } from '@/components/features/document-list/legal-document-modal/linked-artifacts-panel'
import { FindingEditor } from '@/components/features/compliance-audit/finding-editor'
import { FINDING_TYPE_LABELS } from '@/components/features/compliance-audit/finding-copy'
import type { CycleItemRow } from '@/app/actions/compliance-audit-item'
import type { FindingRow } from '@/app/actions/compliance-finding'
import { FindingType } from '@prisma/client'
import { cn } from '@/lib/utils'

interface CycleItemRowDrawerProps {
  row: CycleItemRow
  cycleId: string
  readOnly: boolean
  findings: FindingRow[]
  items: CycleItemRow[]
  onFindingMutation: (_finding: FindingRow) => void
}

export function CycleItemRowDrawer({
  row,
  cycleId,
  readOnly,
  findings,
  items,
  onFindingMutation,
}: CycleItemRowDrawerProps) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingFinding, setEditingFinding] = useState<FindingRow | null>(null)

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

  const itemFindings = useMemo(
    () => findings.filter((f) => f.lawListItemId === row.lawListItemId),
    [findings, row.lawListItemId]
  )

  const openCreate = () => {
    setEditingFinding(null)
    setEditorOpen(true)
  }

  const openEdit = (f: FindingRow) => {
    setEditingFinding(f)
    setEditorOpen(true)
  }

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
        <Accordion
          type="multiple"
          defaultValue={['linked-artifacts']}
          className="w-full"
        >
          <LinkedArtifactsPanel listItemId={row.lawListItemId} readOnly />
        </Accordion>
      </section>

      <section>
        <header className="mb-3 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">Findings</h3>
          {!readOnly ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={openCreate}
              data-testid={`drawer-add-finding-${row.lawListItemId}`}
            >
              <Plus className="mr-1 h-3 w-3" />
              Lägg till finding
            </Button>
          ) : null}
        </header>
        {itemFindings.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">
            Inga findings för denna post ännu.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {itemFindings.map((f) => (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => openEdit(f)}
                  disabled={readOnly}
                  data-testid={`drawer-finding-chip-${f.id}`}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors',
                    readOnly
                      ? 'cursor-not-allowed opacity-60'
                      : 'hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                  )}
                >
                  <ChipTypeBadge type={f.type} />
                  <span className="max-w-[18rem] truncate font-medium">
                    {f.title}
                  </span>
                  {f.closedAt ? (
                    <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                      Stängd
                    </Badge>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <FindingEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        cycleId={cycleId}
        mode={editingFinding ? 'edit' : 'create'}
        {...(editingFinding ? { finding: editingFinding } : {})}
        items={items}
        {...(editingFinding ? {} : { prefillLawListItemId: row.lawListItemId })}
        onSuccess={onFindingMutation}
      />
    </div>
  )
}

function ChipTypeBadge({ type }: { type: FindingType }) {
  const label = FINDING_TYPE_LABELS[type]
  const colorClass =
    type === FindingType.AVVIKELSE
      ? 'border-red-200 bg-red-50 text-red-700'
      : type === FindingType.OBSERVATION
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-blue-200 bg-blue-50 text-blue-700'
  return (
    <Badge variant="outline" className={cn('h-4 px-1 text-[10px]', colorClass)}>
      {label}
    </Badge>
  )
}
