'use client'

/**
 * Story 24.5: admin queue UI for `CatalogIngestRequest` rows.
 *
 * Renders:
 *   - PageHeader with pending + breach counts
 *   - TableToolbar with status filter chips
 *   - shadcn `<Table>` of requests sorted by age ascending
 *   - SLA-tier dot per row (red >24h / amber 12-24h / green <12h)
 *   - Inline detail panel on row click (source row + workspace + requester +
 *     admin note + Markera hanterad / Avvisa actions)
 *   - Fulfilment modal: LegalDocument-id input with validate-then-confirm flow
 *   - Rejection dialog: optional reason
 *
 * Workspace and requester names come from the server-rendered initialRequests
 * (no client-side fetch) — list refreshes after each mutation via router.refresh().
 */

import { useMemo, useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { AlertCircle, CheckCircle2, ChevronDown } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { TableToolbar } from '@/components/ui/table-toolbar'
import { FilterChip, FilterChipGroup } from '@/components/ui/filter-chip'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import {
  fulfillCatalogRequest,
  rejectCatalogRequest,
  type CatalogRequestRow,
} from '@/app/actions/catalog-ingest-request'
import { lookupLegalDocument } from '@/app/actions/admin-document-lookup'
import { cn } from '@/lib/utils'

type StatusFilter = 'pending' | 'fulfilled' | 'rejected' | 'all'

const SLA_BREACH_HOURS = 24
const SLA_WARNING_HOURS = 12

interface CatalogRequestsListProps {
  initialRequests: CatalogRequestRow[]
  counts: {
    pending: number
    fulfilled: number
    rejected: number
    breached: number
    total: number
  }
  currentStatus: StatusFilter
  currentRangeDays: number
}

function ageHours(createdAt: Date | string): number {
  const d = typeof createdAt === 'string' ? new Date(createdAt) : createdAt
  return (Date.now() - d.getTime()) / (60 * 60 * 1000)
}

function formatAge(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`
  if (hours < 24) return `${Math.round(hours)} tim`
  const days = Math.floor(hours / 24)
  const remHours = Math.round(hours - days * 24)
  return remHours > 0 ? `${days} d ${remHours} t` : `${days} d`
}

function slaTone(hours: number): {
  tone: 'success' | 'warning' | 'danger'
  label: string
} {
  if (hours > SLA_BREACH_HOURS) return { tone: 'danger', label: 'SLA-brytt' }
  if (hours >= SLA_WARNING_HOURS)
    return { tone: 'warning', label: 'Närmar sig deadline' }
  return { tone: 'success', label: 'Inom budget' }
}

export function CatalogRequestsList({
  initialRequests,
  counts,
  currentStatus,
  currentRangeDays,
}: CatalogRequestsListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [fulfillTarget, setFulfillTarget] = useState<CatalogRequestRow | null>(
    null
  )
  const [rejectTarget, setRejectTarget] = useState<CatalogRequestRow | null>(
    null
  )

  function setStatusFilter(next: StatusFilter) {
    const params = new URLSearchParams(searchParams.toString())
    if (next === 'pending') {
      params.delete('status')
    } else {
      params.set('status', next)
    }
    router.push(`/admin/catalog-requests?${params.toString()}`)
  }

  // Sort by age ascending — already sorted by the server action, but the
  // sort can drift if requests array gets re-shuffled by React Strict-mode
  // re-renders. Resort defensively here.
  const sortedRequests = useMemo(
    () =>
      [...initialRequests].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
    [initialRequests]
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Katalogtillägg"
        meta={
          <p className="text-sm">
            <span className="text-muted-foreground">
              {counts.pending} väntande ·{' '}
            </span>
            <span
              className={cn(
                counts.breached > 0
                  ? 'font-semibold text-rose-600'
                  : 'text-muted-foreground'
              )}
            >
              SLA bryts om {counts.breached}
            </span>
            <span className="text-muted-foreground">
              {' '}
              · senaste {currentRangeDays} dagar
            </span>
          </p>
        }
      />

      <TableToolbar
        views={
          <FilterChipGroup aria-label="Filtrera katalogtillägg efter status">
            <FilterChip
              pressed={currentStatus === 'pending'}
              onPressedChange={() => setStatusFilter('pending')}
              count={counts.pending}
            >
              Väntande
            </FilterChip>
            <FilterChip
              pressed={currentStatus === 'fulfilled'}
              onPressedChange={() => setStatusFilter('fulfilled')}
              count={counts.fulfilled}
            >
              Hanterade
            </FilterChip>
            <FilterChip
              pressed={currentStatus === 'rejected'}
              onPressedChange={() => setStatusFilter('rejected')}
              count={counts.rejected}
            >
              Avvisade
            </FilterChip>
            <FilterChip
              pressed={currentStatus === 'all'}
              onPressedChange={() => setStatusFilter('all')}
              count={counts.total}
            >
              Alla
            </FilterChip>
          </FilterChipGroup>
        }
      />

      {sortedRequests.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Inga katalogtillägg matchar filtret.
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" aria-label="SLA-status" />
                <TableHead>Källrad</TableHead>
                <TableHead>Workspace</TableHead>
                <TableHead>Begärd av</TableHead>
                <TableHead>Ålder</TableHead>
                <TableHead>Hanterare</TableHead>
                <TableHead className="text-right">Åtgärd</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRequests.map((r) => {
                const hours = ageHours(r.created_at)
                const sla = slaTone(hours)
                const expanded = expandedId === r.id
                return (
                  <RequestRow
                    key={r.id}
                    request={r}
                    sla={sla}
                    age={formatAge(hours)}
                    expanded={expanded}
                    onToggle={() => setExpandedId(expanded ? null : r.id)}
                    onFulfill={() => setFulfillTarget(r)}
                    onReject={() => setRejectTarget(r)}
                  />
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <FulfillmentModal
        request={fulfillTarget}
        onClose={() => setFulfillTarget(null)}
        onSuccess={() => {
          setFulfillTarget(null)
          router.refresh()
        }}
      />
      <RejectionDialog
        request={rejectTarget}
        onClose={() => setRejectTarget(null)}
        onSuccess={() => {
          setRejectTarget(null)
          router.refresh()
        }}
      />
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

interface RequestRowProps {
  request: CatalogRequestRow
  sla: { tone: 'success' | 'warning' | 'danger'; label: string }
  age: string
  expanded: boolean
  onToggle: () => void
  onFulfill: () => void
  onReject: () => void
}

function RequestRow({
  request,
  sla,
  age,
  expanded,
  onToggle,
  onFulfill,
  onReject,
}: RequestRowProps) {
  const slaDotClass =
    sla.tone === 'danger'
      ? 'bg-rose-500'
      : sla.tone === 'warning'
        ? 'bg-amber-500'
        : 'bg-emerald-500'

  const handlerLabel = request.handler
    ? (request.handler.name ?? request.handler.email)
    : '—'

  return (
    <>
      <TableRow
        onClick={onToggle}
        className="cursor-pointer hover:bg-muted/40"
        data-testid={`catalog-request-row-${request.id}`}
      >
        <TableCell>
          <span
            className={cn('inline-block h-2.5 w-2.5 rounded-full', slaDotClass)}
            title={sla.label}
            aria-label={sla.label}
          />
        </TableCell>
        <TableCell className="font-medium">
          {request.import_row.source_titel ?? (
            <em className="text-muted-foreground">(ingen titel)</em>
          )}
          {request.import_row.source_sfs_nummer && (
            <div className="text-xs text-muted-foreground">
              {request.import_row.source_sfs_nummer}
            </div>
          )}
        </TableCell>
        <TableCell>
          <Link
            href={`/admin/workspaces?search=${request.workspace.id}`}
            className="text-sm hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {request.workspace.name}
          </Link>
        </TableCell>
        <TableCell className="text-sm">
          {request.requested_by.name ?? request.requested_by.email}
        </TableCell>
        <TableCell className="text-sm tabular-nums">{age}</TableCell>
        <TableCell className="text-sm">{handlerLabel}</TableCell>
        <TableCell className="text-right">
          <ChevronDown
            className={cn(
              'inline h-4 w-4 transition-transform text-muted-foreground',
              expanded && 'rotate-180'
            )}
          />
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/30 p-0">
            <DetailPanel
              request={request}
              sla={sla}
              onFulfill={onFulfill}
              onReject={onReject}
            />
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

interface DetailPanelProps {
  request: CatalogRequestRow
  sla: { tone: 'success' | 'warning' | 'danger'; label: string }
  onFulfill: () => void
  onReject: () => void
}

function DetailPanel({ request, sla, onFulfill, onReject }: DetailPanelProps) {
  const isPending = request.status === 'PENDING'
  return (
    <div className="space-y-4 p-6">
      <Badge tone={sla.tone} variant="soft">
        {sla.label}
      </Badge>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <DetailGroup label="Källrad">
          <FieldLine label="Titel" value={request.import_row.source_titel} />
          <FieldLine
            label="SFS-nummer"
            value={request.import_row.source_sfs_nummer}
          />
          <FieldLine label="Område" value={request.import_row.source_omrade} />
          <FieldLine
            label="Lagansvarig"
            value={request.import_row.source_lagansvarig}
          />
          <FieldLine
            label="Kommentar"
            value={request.import_row.source_kommentar}
          />
        </DetailGroup>

        <DetailGroup label="Ursprung">
          <FieldLine
            label="Workspace"
            value={
              <Link
                href={`/admin/workspaces?search=${request.workspace.id}`}
                className="hover:underline"
              >
                {request.workspace.name}
              </Link>
            }
          />
          <FieldLine label="Filnamn" value={request.import.filename} />
          <FieldLine
            label="Importerad"
            value={new Date(request.import.created_at).toLocaleString('sv-SE')}
          />
          <FieldLine
            label="Begärd av"
            value={
              <span>
                {request.requested_by.name ?? '—'}{' '}
                <span className="text-muted-foreground">
                  ({request.requested_by.email})
                </span>
              </span>
            }
          />
          {request.fulfilled_with_document && (
            <FieldLine
              label="Matchad mot"
              value={
                <span>
                  {request.fulfilled_with_document.title}{' '}
                  <span className="text-muted-foreground">
                    ({request.fulfilled_with_document.document_number})
                  </span>
                </span>
              }
            />
          )}
        </DetailGroup>
      </div>

      {request.admin_note && (
        <DetailGroup label="Admin-anteckning">
          <p className="rounded-md border bg-background p-3 text-sm">
            {request.admin_note}
          </p>
        </DetailGroup>
      )}

      {isPending && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={onFulfill}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Markera hanterad
          </Button>
          <Button variant="ghost" onClick={onReject}>
            <AlertCircle className="mr-2 h-4 w-4" />
            Avvisa som dubblett
          </Button>
        </div>
      )}
    </div>
  )
}

function DetailGroup({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </h3>
      <dl className="space-y-1 text-sm">{children}</dl>
    </div>
  )
}

function FieldLine({
  label,
  value,
}: {
  label: string
  value: ReactNode | string | null
}) {
  if (value == null || value === '') return null
  return (
    <div className="flex gap-2">
      <dt className="min-w-[100px] text-muted-foreground">{label}:</dt>
      <dd className="min-w-0 flex-1">{value}</dd>
    </div>
  )
}

// ============================================================================
// Fulfillment modal
// ============================================================================

interface FulfillmentModalProps {
  request: CatalogRequestRow | null
  onClose: () => void
  onSuccess: () => void
}

function FulfillmentModal({
  request,
  onClose,
  onSuccess,
}: FulfillmentModalProps) {
  const [docId, setDocId] = useState('')
  const [validatedDoc, setValidatedDoc] = useState<{
    id: string
    title: string
    documentNumber: string
  } | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [adminNote, setAdminNote] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [isValidating, startValidation] = useTransition()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Reset state when the dialog target changes.
  if (request && adminNote === '' && request.admin_note) {
    setAdminNote(request.admin_note)
  }

  function handleClose() {
    setDocId('')
    setValidatedDoc(null)
    setValidationError(null)
    setAdminNote('')
    setConfirmed(false)
    onClose()
  }

  function handleValidate() {
    const trimmed = docId.trim()
    if (trimmed.length === 0) {
      toast.error('Ange ett dokument-id')
      return
    }
    setValidationError(null)
    startValidation(async () => {
      const result = await lookupLegalDocument(trimmed)
      if (!result.success || !result.data) {
        setValidatedDoc(null)
        setValidationError(
          result.error ?? 'Inget dokument med det id:t hittades'
        )
        return
      }
      setValidatedDoc({
        id: result.data.id,
        title: result.data.title,
        documentNumber: result.data.document_number,
      })
    })
  }

  async function handleSubmit() {
    if (!request || !validatedDoc || !confirmed) return
    setIsSubmitting(true)
    try {
      const result = await fulfillCatalogRequest({
        requestId: request.id,
        fulfilledWithDocumentId: validatedDoc.id,
        ...(adminNote.trim().length > 0 ? { adminNote: adminNote.trim() } : {}),
      })
      if (!result.success) {
        toast.error('Kunde inte hantera förfrågan', {
          description: result.error,
        })
        return
      }
      toast.success('Förfrågan hanterad')
      handleClose()
      onSuccess()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => !open && handleClose()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Markera hanterad</DialogTitle>
          <DialogDescription>
            Ange id:t för det LegalDocument du har ingest. Vi rematchar
            originatingsraden automatiskt och mejlar användaren.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="doc-id" className="text-sm font-medium">
              LegalDocument ID
            </label>
            <div className="flex gap-2">
              <Input
                id="doc-id"
                value={docId}
                onChange={(e) => {
                  setDocId(e.target.value)
                  setValidatedDoc(null)
                  setValidationError(null)
                }}
                placeholder="uuid"
                disabled={isSubmitting}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleValidate}
                disabled={isValidating || docId.trim().length === 0}
              >
                Validera
              </Button>
            </div>
            {validationError && (
              <p className="text-sm text-destructive">{validationError}</p>
            )}
            {validatedDoc && (
              <p className="rounded-md border bg-emerald-50 p-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                <CheckCircle2 className="mr-1 inline h-4 w-4" />
                <strong>{validatedDoc.title}</strong>{' '}
                <span className="text-muted-foreground">
                  ({validatedDoc.documentNumber})
                </span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="admin-note" className="text-sm font-medium">
              Anteckning (valfri)
            </label>
            <Textarea
              id="admin-note"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              maxLength={1000}
              className="min-h-[80px]"
              disabled={isSubmitting}
            />
          </div>

          <label
            htmlFor="fulfill-confirm-checkbox"
            className="flex items-start gap-2 text-sm"
          >
            <Checkbox
              id="fulfill-confirm-checkbox"
              checked={confirmed}
              onCheckedChange={(c) => setConfirmed(c === true)}
              disabled={!validatedDoc || isSubmitting}
            />
            <span>
              Jag bekräftar att dokumentet är fullständigt ingested och kan
              matchas mot källraden.
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Avbryt
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!validatedDoc || !confirmed || isSubmitting}
          >
            {isSubmitting ? 'Hanterar…' : 'Bekräfta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Rejection dialog
// ============================================================================

interface RejectionDialogProps {
  request: CatalogRequestRow | null
  onClose: () => void
  onSuccess: () => void
}

function RejectionDialog({
  request,
  onClose,
  onSuccess,
}: RejectionDialogProps) {
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleClose() {
    setReason('')
    onClose()
  }

  async function handleSubmit() {
    if (!request) return
    setIsSubmitting(true)
    try {
      const result = await rejectCatalogRequest({
        requestId: request.id,
        ...(reason.trim().length > 0 ? { adminNote: reason.trim() } : {}),
      })
      if (!result.success) {
        toast.error('Kunde inte avvisa förfrågan', {
          description: result.error,
        })
        return
      }
      toast.success('Förfrågan avvisad')
      handleClose()
      onSuccess()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={request !== null}
      onOpenChange={(open) => !open && handleClose()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Avvisa som dubblett</DialogTitle>
          <DialogDescription>
            Förfrågan markeras som avvisad. Inget mejl skickas till användaren —
            de kan se avvisningen om de återbesöker granskningsvyn.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <label htmlFor="reject-reason" className="text-sm font-medium">
            Anledning (valfri)
          </label>
          <Textarea
            id="reject-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={1000}
            className="min-h-[80px]"
            placeholder="t.ex. Dubblett av tidigare förfrågan #ABC"
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Avbryt
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Avvisar…' : 'Avvisa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
