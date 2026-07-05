'use client'

/**
 * Story 7.5 + 7.6: Shared kollektivavtal manager — list, upload, edit,
 * delete and bulk assignment. Mounted from the Settings "Kollektivavtal" tab
 * (data prefetched server-side); the HR-area dialog reuses the same upload
 * form component.
 *
 * Story 7.6: each row (for `employees:manage`) gets a first-class "Tilldela"
 * action (bulk assignment is the primary multi-avtal flow) plus Redigera /
 * Ta bort in an overflow menu. Server actions re-verify permissions and
 * workspace ownership regardless.
 *
 * Checkpoint round: `variant="dialog"` (Personalregister-toolbar mount)
 * renders the same sections flat — no Card chrome, no own top-level heading.
 *
 * Checkpoint round 2 (user): the agreements list is a structured mini-table
 * (Namn · Typ · Giltighetsperiod · Uppladdad · Kopplade · Status · actions)
 * instead of a name + meta run-on line — same table in both variants; the
 * dialog variant labels the section "Uppladdade avtal" (Safiro).
 */

import { useCallback, useState } from 'react'
import { MoreHorizontal, Pencil, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  listCollectiveAgreements,
  type CollectiveAgreementListItem,
} from '@/app/actions/collective-agreements'
import { AgreementStatusBadge } from './agreement-status-badge'
import { KollektivavtalUploadForm } from './kollektivavtal-upload-form'
import { KollektivavtalEditDialog } from './kollektivavtal-edit-dialog'
import { KollektivavtalDeleteDialog } from './kollektivavtal-delete-dialog'
import { KollektivavtalAssignDialog } from './kollektivavtal-assign-dialog'

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

/** created_at ISO timestamp → YYYY-MM-DD for the Uppladdad column (AC 1). */
function uploadedLabel(item: CollectiveAgreementListItem): string {
  return item.created_at.slice(0, 10)
}

/** Kopplade column: bare "0", then natural Swedish singular/plural. */
function assignedLabel(count: number): string {
  if (count === 0) return '0'
  return count === 1 ? '1 anställd' : `${count} anställda`
}

export interface KollektivavtalManagerProps {
  /** Prefetched list; null when the fetch failed (render a muted error). */
  initialAgreements: CollectiveAgreementListItem[] | null
  /** `employees:manage` — controls upload/edit/delete/assign affordances (actions re-check server-side). */
  canManage: boolean
  /**
   * Checkpoint round (7.6): `'dialog'` renders the sections FLAT — no Card
   * chrome (frame-in-frame is redundant framing inside a dialog) and no own
   * "Kollektivavtal" heading (the dialog header carries title +
   * description). Default `'page'` keeps the Settings mount byte-equivalent.
   */
  variant?: 'page' | 'dialog'
}

export function KollektivavtalManager({
  initialAgreements,
  canManage,
  variant = 'page',
}: KollektivavtalManagerProps) {
  const [agreements, setAgreements] = useState<
    CollectiveAgreementListItem[] | null
  >(initialAgreements)
  const [editTarget, setEditTarget] =
    useState<CollectiveAgreementListItem | null>(null)
  const [deleteTarget, setDeleteTarget] =
    useState<CollectiveAgreementListItem | null>(null)
  const [assignTarget, setAssignTarget] =
    useState<CollectiveAgreementListItem | null>(null)

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

  const handleSaved = useCallback(
    (updated: CollectiveAgreementListItem) => {
      setAgreements((prev) =>
        prev
          ? prev
              .map((item) => (item.id === updated.id ? updated : item))
              .sort((a, b) => a.name.localeCompare(b.name, 'sv'))
          : prev
      )
      void refresh()
    },
    [refresh]
  )

  const handleDeleted = useCallback(
    (agreementId: string) => {
      setAgreements((prev) =>
        prev ? prev.filter((item) => item.id !== agreementId) : prev
      )
      void refresh()
    },
    [refresh]
  )

  const handleAssigned = useCallback(() => {
    // Assigned-employee counts changed server-side — refetch the truth.
    void refresh()
  }, [refresh])

  // Shared section bodies — identical in both chromes; only the framing
  // (Cards on the Settings page, flat + divider in the dialog) differs.
  const listBody =
    agreements === null ? (
      <p className="text-sm text-muted-foreground">
        Kollektivavtal kunde inte laddas.
      </p>
    ) : agreements.length === 0 ? (
      <p className="text-sm text-muted-foreground">
        Inga kollektivavtal har laddats upp än.
      </p>
    ) : (
      // Structured mini-table (user checkpoint round 2). The shared Table
      // primitive wraps itself in an overflow-auto container, so at dialog
      // width (sm:max-w-2xl) the table scrolls horizontally inside the
      // rounded frame instead of overflowing the dialog.
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="h-10 px-3 font-safiro">Namn</TableHead>
              <TableHead className="h-10 px-3 font-safiro">Typ</TableHead>
              <TableHead className="h-10 whitespace-nowrap px-3 font-safiro">
                Giltighetsperiod
              </TableHead>
              <TableHead className="h-10 px-3 font-safiro">Uppladdad</TableHead>
              <TableHead className="h-10 px-3 font-safiro">Kopplade</TableHead>
              <TableHead className="h-10 px-3 font-safiro">Status</TableHead>
              {canManage && (
                <TableHead className="h-10 px-3 text-right">
                  <span className="sr-only">Åtgärder</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {agreements.map((agreement) => (
              <TableRow key={agreement.id}>
                <TableCell className="px-3 py-2.5 font-medium">
                  {agreement.name}
                </TableCell>
                <TableCell className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                  {typLabel(agreement.personel_type)}
                </TableCell>
                <TableCell className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                  {periodLabel(agreement)}
                </TableCell>
                <TableCell className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                  {uploadedLabel(agreement)}
                </TableCell>
                <TableCell className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                  {assignedLabel(agreement.assignedEmployeeCount)}
                </TableCell>
                <TableCell className="px-3 py-2.5">
                  <AgreementStatusBadge status={agreement.status} />
                </TableCell>
                {canManage && (
                  <TableCell className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAssignTarget(agreement)}
                      >
                        <Users className="mr-1.5 h-3.5 w-3.5" />
                        Tilldela
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Fler åtgärder för ${agreement.name}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => setEditTarget(agreement)}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Redigera
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() => setDeleteTarget(agreement)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Ta bort
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )

  const actionDialogs = canManage && (
    <>
      <KollektivavtalEditDialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null)
        }}
        agreement={editTarget}
        onSaved={handleSaved}
      />
      <KollektivavtalDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        agreement={deleteTarget}
        onDeleted={handleDeleted}
      />
      <KollektivavtalAssignDialog
        open={assignTarget !== null}
        onOpenChange={(open) => {
          if (!open) setAssignTarget(null)
        }}
        agreement={assignTarget}
        onAssigned={handleAssigned}
      />
    </>
  )

  // Dialog chrome: flat sections + subtle divider (no Cards, no own
  // top-level heading — the dialog header carries title/description).
  if (variant === 'dialog') {
    return (
      <div className="space-y-5">
        <div className="space-y-3">
          <h3 className="font-safiro text-sm font-medium">Uppladdade avtal</h3>
          {listBody}
        </div>

        {canManage && (
          <div className="space-y-3 border-t pt-5">
            <div className="space-y-1">
              <h3 className="font-safiro text-sm font-medium">
                Ladda upp kollektivavtal
              </h3>
              <p className="text-sm text-muted-foreground">
                PDF, max 25 MB. Innehållet bearbetas automatiskt efter
                uppladdning.
              </p>
            </div>
            <KollektivavtalUploadForm onUploaded={handleUploaded} />
          </div>
        )}

        {actionDialogs}
      </div>
    )
  }

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
        <CardContent>{listBody}</CardContent>
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

      {actionDialogs}
    </div>
  )
}
