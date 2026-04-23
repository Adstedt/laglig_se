'use client'

/**
 * Epic 21 Story 21.16 — Kravpunkter snapshot renderer.
 *
 * Displays the frozen kravpunkter snapshot (as captured at cycle materialisation)
 * for a ComplianceAuditItem. This is the readOnly/snapshot counterpart to
 * the live `KravpunkterChecklist` — it reads directly from `item.kravpunkterSnapshot`
 * (frozen JSON) rather than fetching live requirements via SWR, which makes
 * it both simpler and immune to post-freeze drift.
 *
 * Mirrors the snapshot section previously inlined in `cycle-item-row-drawer.tsx`.
 * Extracted to a dedicated component so the modal's left-panel composition stays
 * declarative and the snapshot logic isn't duplicated.
 */

import { format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { Check, Circle } from 'lucide-react'
import type { KravpunkterSnapshot } from '@/app/actions/compliance-audit-cycle'

interface KravpunkterSnapshotListProps {
  snapshot: KravpunkterSnapshot | null | undefined
}

export function KravpunkterSnapshotList({
  snapshot,
}: KravpunkterSnapshotListProps) {
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

  if (!snapshot || snapshot.requirements.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-4 text-center text-sm italic text-muted-foreground">
        Inga kravpunkter registrerade vid materialiseringen.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {frozenAt ? (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium">Fryst</span> {frozenAt}
        </p>
      ) : null}
      <ul className="space-y-2" data-testid="kravpunkter-snapshot-list">
        {snapshot.requirements.map((req) => (
          <li
            key={req.id}
            className="flex items-start gap-2 rounded-md border border-border/60 bg-card px-3 py-2 text-sm"
          >
            {req.is_fulfilled ? (
              <Check
                className="mt-0.5 h-4 w-4 shrink-0 text-green-600 dark:text-green-400"
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
    </div>
  )
}
