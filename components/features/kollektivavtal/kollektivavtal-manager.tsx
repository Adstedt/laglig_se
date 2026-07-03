'use client'

/**
 * Story 7.5: Shared kollektivavtal manager — list + upload. Mounted from the
 * Settings "Kollektivavtal" tab (data prefetched server-side) and reused as
 * the single source of the upload form for the HR-area dialog.
 *
 * Upload + list only — delete/edit/replace is Story 7.6.
 */

import { useCallback, useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  listCollectiveAgreements,
  type CollectiveAgreementListItem,
} from '@/app/actions/collective-agreements'
import { AgreementStatusBadge } from './agreement-status-badge'
import { KollektivavtalUploadForm } from './kollektivavtal-upload-form'

const TYP_LABELS: Record<string, string> = {
  ARB: 'Arbetare',
  TJM: 'Tjänstemän',
}

function typLabel(personelType: string | null): string {
  return (personelType && TYP_LABELS[personelType]) || 'Övrigt'
}

function periodLabel(item: CollectiveAgreementListItem): string {
  if (!item.effective_from && !item.effective_to) return 'Ej ifylld'
  return `${item.effective_from ?? '…'} – ${item.effective_to ?? '…'}`
}

export interface KollektivavtalManagerProps {
  /** Prefetched list; null when the fetch failed (render a muted error). */
  initialAgreements: CollectiveAgreementListItem[] | null
  /** `employees:manage` — controls the upload form (actions re-check server-side). */
  canManage: boolean
}

export function KollektivavtalManager({
  initialAgreements,
  canManage,
}: KollektivavtalManagerProps) {
  const [agreements, setAgreements] = useState<
    CollectiveAgreementListItem[] | null
  >(initialAgreements)

  const refresh = useCallback(async () => {
    const result = await listCollectiveAgreements()
    if (result.success && result.data) {
      setAgreements(result.data)
    }
  }, [])

  const handleUploaded = useCallback(
    (agreement: CollectiveAgreementListItem) => {
      // Optimistic append (sorted by name, like the list action), then refresh
      // for the server truth (status may already have advanced).
      setAgreements((prev) =>
        prev
          ? [...prev, agreement].sort((a, b) =>
              a.name.localeCompare(b.name, 'sv')
            )
          : [agreement]
      )
      void refresh()
    },
    [refresh]
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-safiro font-medium">
            Kollektivavtal
          </CardTitle>
          <CardDescription>
            Uppladdade avtal blir valbara i personalregistret och sökbara för
            AI-assistenten när bearbetningen är klar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {agreements === null ? (
            <p className="text-sm text-muted-foreground">
              Kollektivavtal kunde inte laddas.
            </p>
          ) : agreements.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Inga kollektivavtal har laddats upp än.
            </p>
          ) : (
            <ul className="divide-y">
              {agreements.map((agreement) => (
                <li
                  key={agreement.id}
                  className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-sm font-medium">
                      {agreement.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {typLabel(agreement.personel_type)}
                      {' · Giltighetsperiod: '}
                      {periodLabel(agreement)}
                      {' · '}
                      {agreement.assignedEmployeeCount === 1
                        ? '1 anställd kopplad'
                        : `${agreement.assignedEmployeeCount} anställda kopplade`}
                    </p>
                  </div>
                  <AgreementStatusBadge status={agreement.status} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="font-safiro font-medium">
              Ladda upp kollektivavtal
            </CardTitle>
            <CardDescription>
              PDF, max 25 MB. Innehållet bearbetas automatiskt efter
              uppladdning.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <KollektivavtalUploadForm onUploaded={handleUploaded} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
