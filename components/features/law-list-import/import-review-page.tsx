'use client'

/**
 * Story 24.4: full-page review surface for an import.
 *
 * Owns:
 *   - Filter-chip state (Alla / Hög / Behöver bekräftelse / Saknas / Hanterade)
 *   - Confidence-breakdown card click-through to the matching filter
 *   - SWR polling while status === MATCHING (AC 12 — refreshInterval becomes
 *     0 once status leaves MATCHING; mirrors the LawListGenerationProgress
 *     pattern)
 *   - Empty / FAILED / COMMITTED edge states (AC 11/13)
 *   - Batch "Acceptera alla höga" CTA + inline confirmation (AC 6)
 *   - "Bekräfta och skapa lista" dialog with name pre-fill + summary (AC 7)
 *
 * Per-row UI lives in `<ImportTableRow>` (compact shadcn TableRow) and
 * `<ImportRowDetailSheet>` (right-side drawer with full reasoning + alt
 * candidates). This component owns the page-level shell + filter + commit
 * surfaces only.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { toast } from 'sonner'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  acceptAllHigh,
  commitImport,
  getImport,
  proposeGroupings,
  type ImportRowSummary,
  type ImportSummary,
} from '@/app/actions/law-list-import'
import { ImportTableRow } from './import-table-row'
import { ImportRowDetailSheet } from './import-row-detail-sheet'
import { GroupingPanel, type EditableGroup } from './grouping-panel'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { formatTimeAgo } from '@/lib/utils/time-ago'

type FilterKey = 'all' | 'high' | 'medium' | 'unmatched' | 'handled'

interface ImportReviewPageProps {
  initialImport: ImportSummary
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, '')
}

export function ImportReviewPage({ initialImport }: ImportReviewPageProps) {
  const router = useRouter()
  const [filter, setFilter] = useState<FilterKey>('all')
  const [isPending, startTransition] = useTransition()
  const [confirmAcceptAllOpen, setConfirmAcceptAllOpen] = useState(false)
  const [commitDialogOpen, setCommitDialogOpen] = useState(false)
  const [listName, setListName] = useState(
    stripExtension(initialImport.filename)
  )
  const [isCommitting, setIsCommitting] = useState(false)
  // Sheet state for the per-row detail drawer. Single instance shared
  // across all rows — flipped open by the row click handler.
  const [detailRowId, setDetailRowId] = useState<string | null>(null)
  const [detailSheetOpen, setDetailSheetOpen] = useState(false)

  // Story 24.7: grouping suggestion panel state. Toggled by "Föreslå grupper"
  // CTA inside the commit dialog. `editedGroups` holds the user-edited
  // proposal; `unassignedRowIds` is the Övriga bucket. Both reset on dialog
  // close (state lives in the dialog, not URL).
  const [groupingOpen, setGroupingOpen] = useState(false)
  const [groupingLoading, setGroupingLoading] = useState(false)
  const [groupingError, setGroupingError] = useState<string | null>(null)
  const [groupingDegraded, setGroupingDegraded] = useState<string | null>(null)
  const [editedGroups, setEditedGroups] = useState<EditableGroup[]>([])
  const [unassignedRowIds, setUnassignedRowIds] = useState<string[]>([])
  const [groupingHasEdits, setGroupingHasEdits] = useState(false)
  const groupingAbortRef = useRef<AbortController | null>(null)

  // SWR for polling-while-MATCHING (AC 12). refreshInterval is a function
  // returning 0 once status is no longer MATCHING — mirrors the
  // LawListGenerationProgress pattern.
  const { data: importData = initialImport, mutate } = useSWR<ImportSummary>(
    ['import-review', initialImport.id],
    async () => {
      const r = await getImport(initialImport.id)
      if (!r.success || !r.data) throw new Error(r.error ?? 'Okänt fel')
      return r.data
    },
    {
      fallbackData: initialImport,
      refreshInterval: (data) => (data?.status === 'MATCHING' ? 3000 : 0),
      revalidateOnFocus: false,
    }
  )

  const counts = importData.counts
  const status = importData.status
  const isReviewable = status === 'AWAITING_REVIEW'
  const acceptedCount = counts.accepted + counts.replaced
  const handledCount =
    acceptedCount +
    counts.rejected +
    counts.catalog_requested +
    counts.catalog_fulfilled

  // Story 24.7: hooks must precede the conditional early-return branches
  // below (rules-of-hooks). Both depend only on state that exists from
  // first render.

  // Reset grouping state when dialog closes; abort any in-flight LLM call.
  useEffect(() => {
    if (!commitDialogOpen) {
      groupingAbortRef.current?.abort()
      groupingAbortRef.current = null
      setGroupingOpen(false)
      setGroupingLoading(false)
      setGroupingError(null)
      setGroupingDegraded(null)
      setEditedGroups([])
      setUnassignedRowIds([])
      setGroupingHasEdits(false)
    }
  }, [commitDialogOpen])

  // Lookup map for the panel — title + document_number per rowId.
  const rowMetaById = useMemo(() => {
    const map = new Map<
      string,
      { title: string | null; documentNumber: string | null }
    >()
    for (const r of importData.rows) {
      map.set(r.id, {
        title: r.matched_document?.title ?? r.source_titel ?? null,
        documentNumber: r.matched_document?.document_number ?? null,
      })
    }
    return map
  }, [importData.rows])

  // ----------------------------------------------------------------------
  // Edge states (AC 11, 12, 13)
  // ----------------------------------------------------------------------

  if (status === 'MATCHING') {
    return (
      <div className="py-8">
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            <p className="text-lg font-medium">Vi matchar fortfarande…</p>
            <p className="text-sm text-muted-foreground">
              Sidan uppdateras automatiskt när matchningen är klar.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === 'FAILED') {
    return (
      <div className="py-8">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="text-lg font-medium">Importen misslyckades</p>
            {importData.error_message && (
              <p className="max-w-prose text-center text-sm text-muted-foreground">
                {importData.error_message}
              </p>
            )}
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href="/laglistor">Tillbaka till laglistorna</Link>
              </Button>
              <Button asChild>
                <a href="mailto:support@laglig.se?subject=Import%20misslyckades">
                  Skapa supportärende
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === 'COMMITTED' && importData.committed_law_list_id) {
    return (
      <div className="py-8">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            <p className="text-lg font-medium">Listan är skapad</p>
            <p className="text-sm text-muted-foreground">
              {acceptedCount} {acceptedCount === 1 ? 'lag' : 'lagar'}{' '}
              importerades.
            </p>
            <Button asChild>
              <Link
                href={`/laglistor?list=${importData.committed_law_list_id}`}
              >
                Öppna listan
                <ExternalLink className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (counts.total === 0) {
    return (
      <div className="py-8">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <p className="text-lg font-medium">Inga rader att granska</p>
            <Button asChild>
              <Link href="/laglistor">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Tillbaka till skapa-flödet
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ----------------------------------------------------------------------
  // Filter
  // ----------------------------------------------------------------------

  const filteredRows = importData.rows.filter((r) => {
    switch (filter) {
      case 'all':
        return true
      case 'high':
        return r.match_status === 'MATCHED_HIGH'
      case 'medium':
        return r.match_status === 'MATCHED_MEDIUM'
      case 'unmatched':
        return r.match_status === 'UNMATCHED'
      case 'handled':
        return [
          'ACCEPTED_BY_USER',
          'REPLACED_BY_USER',
          'REJECTED_BY_USER',
          'CATALOG_REQUEST_PENDING',
          'CATALOG_REQUEST_FULFILLED',
        ].includes(r.match_status)
    }
  })

  // ----------------------------------------------------------------------
  // Batch + commit handlers
  // ----------------------------------------------------------------------

  async function handleAcceptAllHigh() {
    setConfirmAcceptAllOpen(false)
    startTransition(async () => {
      const result = await acceptAllHigh(importData.id)
      if (!result.success) {
        toast.error('Kunde inte acceptera höga matchningar', {
          description: result.error,
        })
        return
      }
      toast.success(`Accepterade ${result.data?.count ?? 0} höga matchningar`)
      void mutate()
    })
  }

  async function handleCommit() {
    if (listName.trim().length === 0) {
      toast.error('Ange ett namn för listan')
      return
    }
    setIsCommitting(true)
    try {
      // Story 24.7: only send groupAssignments when the panel has been opened
      // AND the resulting `editedGroups` has at least one populated group.
      // Otherwise fall through to flat-list commit (24.4 behaviour).
      const groupAssignments =
        groupingOpen && editedGroups.length > 0
          ? {
              groups: editedGroups
                .filter((g) => g.rowIds.length > 0)
                .map((g) => ({ name: g.name, rowIds: g.rowIds })),
              asSuggested: !groupingHasEdits,
            }
          : undefined

      const result = await commitImport({
        importId: importData.id,
        listName: listName.trim(),
        ...(groupAssignments ? { groupAssignments } : {}),
      })
      if (!result.success || !result.data) {
        toast.error('Kunde inte bekräfta importen', {
          description: result.error,
        })
        return
      }
      setCommitDialogOpen(false)
      // `/laglistor` uses `?list={id}` query-param routing (see
      // handleListChange in document-list-page-content.tsx) — there is no
      // `[lawListId]` dynamic segment.
      router.push(`/laglistor?list=${result.data.lawListId}`)
    } finally {
      setIsCommitting(false)
    }
  }

  // Story 24.7: fetch grouping proposal. Wires AbortController so dialog-close
  // cancellation discards the result client-side. Server-side request keeps
  // running but its outcome is irrelevant.
  async function handleProposeGroupings(opts?: { confirmOverwrite?: boolean }) {
    if (groupingHasEdits && !opts?.confirmOverwrite) {
      const ok = window.confirm('Detta ersätter dina ändringar. Fortsätt?')
      if (!ok) return
    }
    // Cancel any in-flight call.
    groupingAbortRef.current?.abort()
    const controller = new AbortController()
    groupingAbortRef.current = controller

    setGroupingLoading(true)
    setGroupingError(null)
    setGroupingDegraded(null)
    try {
      const result = await proposeGroupings(importData.id)
      // Discard if the dialog closed mid-call.
      if (controller.signal.aborted) return
      if (!result.success || !result.data) {
        setGroupingError(result.error ?? 'Kunde inte föreslå grupper')
        return
      }
      setEditedGroups(
        result.data.groups.map((g) => ({
          name: g.name,
          rowIds: g.rowIds,
          source: g.source,
        }))
      )
      setUnassignedRowIds(result.data.unassigned)
      setGroupingHasEdits(false)
      if (result.data.llmUsed === false) {
        setGroupingDegraded(
          'AI-förslag kunde inte hämtas; visar grupper baserade på Område-kolumnen.'
        )
      }
    } finally {
      setGroupingLoading(false)
    }
  }

  const pendingHighCount = counts.matched_high
  const canCommit = isReviewable && acceptedCount > 0
  // Rows still in an undecided state at commit time — auto-matched rows the
  // user never explicitly accepted, plus unmatched rows. These are silently
  // dropped by commitImport's status filter, so surface the count in the
  // confirm dialog instead of letting them disappear without warning.
  const droppedCount =
    counts.matched_high + counts.matched_medium + counts.unmatched
  // Story 24.7 AC 1 — size gate at ≥15 committable rows. Re-evaluated when
  // commit dialog opens so the user gets the latest count after any acceptance
  // mutations during this session.
  const groupingGateMet = acceptedCount >= 15

  // ----------------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------------

  return (
    <div className="space-y-4">
      <PageHeader
        title="Granska import"
        subtitle="Bekräfta de korrekta matchningarna, byt ut felaktiga och skapa sedan din lista."
        meta={
          <PageHeader.Meta
            items={[
              importData.filename,
              `${counts.total} ${counts.total === 1 ? 'rad' : 'rader'}`,
              `uppladdad ${formatTimeAgo(importData.created_at)}`,
            ]}
          />
        }
        primaryAction={
          <Button
            onClick={() => setCommitDialogOpen(true)}
            disabled={!canCommit}
          >
            Bekräfta och skapa lista
          </Button>
        }
      />

      {/* Confidence breakdown — also the primary filter UI. Click an active
          tile to clear (toggle behaviour). Hanterade tile only appears once
          there are decided rows so the grid stays clean on first paint. */}
      <Card>
        <CardContent className="flex flex-wrap items-stretch gap-4 p-6">
          <BreakdownTile
            label="Hög"
            count={counts.matched_high}
            tone="success"
            active={filter === 'high'}
            onClick={() => setFilter(filter === 'high' ? 'all' : 'high')}
          />
          <BreakdownTile
            label="Behöver bekräftelse"
            count={counts.matched_medium}
            tone="warning"
            active={filter === 'medium'}
            onClick={() => setFilter(filter === 'medium' ? 'all' : 'medium')}
          />
          <BreakdownTile
            label="Saknas i katalogen"
            count={counts.unmatched}
            tone="danger"
            active={filter === 'unmatched'}
            onClick={() =>
              setFilter(filter === 'unmatched' ? 'all' : 'unmatched')
            }
          />
          {handledCount > 0 && (
            <BreakdownTile
              label="Hanterade"
              count={handledCount}
              tone="neutral"
              active={filter === 'handled'}
              onClick={() =>
                setFilter(filter === 'handled' ? 'all' : 'handled')
              }
            />
          )}
        </CardContent>
      </Card>

      {/* Toolbar strip — bulk-action button + "Visa alla" toggle live in
          their own row so they don't break the tile grid alignment. */}
      {(filter !== 'all' || (pendingHighCount > 0 && isReviewable)) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {filter !== 'all' ? (
            <button
              type="button"
              onClick={() => setFilter('all')}
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Visa alla rader
            </button>
          ) : (
            <span aria-hidden />
          )}
          {pendingHighCount > 0 && isReviewable && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmAcceptAllOpen(true)}
              disabled={isPending}
            >
              Acceptera alla höga ({pendingHighCount})
            </Button>
          )}
        </div>
      )}

      {/* Row table — click a row to open the detail Sheet on the right. */}
      <ImportRowTable
        rows={filteredRows}
        importId={importData.id}
        readOnly={!isReviewable}
        onOpenDetail={(rowId) => {
          setDetailRowId(rowId)
          setDetailSheetOpen(true)
        }}
        onMutated={() => void mutate()}
      />

      <ImportRowDetailSheet
        row={
          detailRowId
            ? (importData.rows.find((r) => r.id === detailRowId) ?? null)
            : null
        }
        readOnly={!isReviewable}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        onMutated={() => void mutate()}
      />

      {/* Batch-accept confirmation */}
      <AlertDialog
        open={confirmAcceptAllOpen}
        onOpenChange={setConfirmAcceptAllOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Acceptera {pendingHighCount} höga matchningar utan granskning?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Du kan ångra varje rad efteråt om något ser fel ut.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction onClick={handleAcceptAllHigh}>
              Acceptera
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Commit dialog */}
      <Dialog open={commitDialogOpen} onOpenChange={setCommitDialogOpen}>
        <DialogContent
          className={cn(
            'sm:max-w-[560px]',
            // Story 24.7: when the grouping panel is open, widen the dialog
            // so groups + per-row "Flytta till" pickers don't squeeze.
            groupingOpen && 'sm:max-w-3xl'
          )}
        >
          <DialogHeader>
            <DialogTitle>Bekräfta och skapa lista</DialogTitle>
            <DialogDescription>
              {acceptedCount}{' '}
              {acceptedCount === 1 ? 'rad läggs till' : 'rader läggs till'},{' '}
              {counts.catalog_requested + counts.catalog_fulfilled} skickas för
              manuell registrering, {counts.rejected} avvisas.
            </DialogDescription>
            {droppedCount > 0 && (
              <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
                {droppedCount === 1
                  ? '1 rad är ogranskad och kommer inte att läggas till.'
                  : `${droppedCount} rader är ogranskade och kommer inte att läggas till.`}{' '}
                Avbryt och acceptera, avvisa eller begär tillägg för dem först
                om du vill ha med dem.
              </div>
            )}
          </DialogHeader>
          <div
            className={cn(
              'space-y-3',
              // Constrain the panel area when expanded so the dialog stays
              // within the viewport. Tailwind max-h gives a scroll fallback.
              groupingOpen && 'max-h-[60vh] overflow-y-auto pr-1'
            )}
          >
            <div className="space-y-2">
              <label htmlFor="listName" className="text-sm font-medium">
                Namn på listan
              </label>
              <Input
                id="listName"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
                placeholder="t.ex. Importerad lista 2026"
                autoFocus={!groupingOpen}
              />
            </div>

            {/* Story 24.7 — Föreslå grupper entry point + inline panel */}
            {groupingGateMet && !groupingOpen && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setGroupingOpen(true)
                  void handleProposeGroupings({ confirmOverwrite: true })
                }}
                data-testid="grouping-cta"
              >
                Föreslå grupper
              </Button>
            )}
            {groupingOpen && (
              <div className="rounded-md border bg-background p-3">
                <GroupingPanel
                  loading={groupingLoading}
                  error={groupingError}
                  degraded={groupingDegraded}
                  groups={editedGroups}
                  unassignedRowIds={unassignedRowIds}
                  rowMetaById={rowMetaById}
                  onChangeGroups={setEditedGroups}
                  onChangeUnassigned={setUnassignedRowIds}
                  onMarkEdited={() => setGroupingHasEdits(true)}
                  onReProposeClick={() =>
                    void handleProposeGroupings({ confirmOverwrite: false })
                  }
                />
              </div>
            )}
          </div>
          <DialogFooter className="flex flex-wrap gap-2 sm:flex-nowrap">
            <Button
              variant="outline"
              onClick={() => setCommitDialogOpen(false)}
              disabled={isCommitting}
              className="sm:mr-auto"
            >
              Avbryt
            </Button>
            {groupingOpen && (
              <Button
                variant="ghost"
                onClick={() => {
                  setGroupingOpen(false)
                  setEditedGroups([])
                  setUnassignedRowIds([])
                  setGroupingHasEdits(false)
                  setGroupingDegraded(null)
                }}
                disabled={isCommitting}
                data-testid="grouping-skip"
              >
                Hoppa över grupper
              </Button>
            )}
            <Button
              onClick={handleCommit}
              disabled={isCommitting || listName.trim().length === 0}
            >
              {isCommitting ? 'Bekräftar…' : 'Bekräfta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface BreakdownTileProps {
  label: string
  count: number
  tone: 'success' | 'warning' | 'danger' | 'neutral'
  active: boolean
  onClick: () => void
}

function BreakdownTile({
  label,
  count,
  tone,
  active,
  onClick,
}: BreakdownTileProps) {
  const dotClass =
    tone === 'success'
      ? 'bg-emerald-500'
      : tone === 'warning'
        ? 'bg-amber-500'
        : tone === 'danger'
          ? 'bg-rose-500'
          : 'bg-muted-foreground'
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-1 flex-col items-start gap-1 rounded-lg border p-4 text-left transition-colors',
        'min-w-[160px] hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active && 'border-primary bg-muted/40'
      )}
      aria-pressed={active}
    >
      <div className="flex items-center gap-2">
        <span className={cn('h-2 w-2 rounded-full', dotClass)} />
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <span className="text-2xl font-semibold tracking-tight">{count}</span>
    </button>
  )
}

// ============================================================================
// ImportRowTable — shadcn Table layout with optional row virtualisation.
//
// Story 24.4 QA gate PERF-001: real customer files can run up to 1000 rows
// (parser cap from 24.2). The compact shadcn TableRow (~56 px, 4 cells) is
// much cheaper than the original 180-px ImportRowCard, but at 1000 rows the
// reconcile cost on filter-chip clicks still degrades interaction latency.
// `useWindowVirtualizer` mirrors the cycle-items-tab.tsx pattern but tracks
// page-level scroll instead of an internal scroll container — preserves the
// existing UX where users scroll the whole page rather than a nested table.
//
// Threshold of 100 rows matches the cycle-items-tab convention. Below 100,
// the array .map is fine and avoids the virtualizer's measurement overhead.
// Above the threshold, render a top + bottom spacer `<tr>` with the offset
// height; only the visible window of rows materialises in the DOM.
// ============================================================================

const VIRTUALIZATION_THRESHOLD = 100
const ESTIMATED_ROW_HEIGHT = 56
const OVERSCAN_COUNT = 5

interface ImportRowTableProps {
  rows: ImportRowSummary[]
  importId: string
  readOnly: boolean
  onOpenDetail: (_rowId: string) => void
  onMutated: () => void
}

function ImportRowTable({
  rows,
  importId,
  readOnly,
  onOpenDetail,
  onMutated,
}: ImportRowTableProps) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Inga rader matchar det här filtret.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden p-0">
      {/* `table-fixed` enforces the column widths we set on TableHead so
          long EU-style titles (e.g. AI-förordningen with all its
          amending references) don't blow the layout out — they truncate
          inside the cell instead. Hover surfaces the full title via the
          `title` attribute on each cell's content span. */}
      {rows.length > VIRTUALIZATION_THRESHOLD ? (
        <VirtualisedRowTable
          rows={rows}
          importId={importId}
          readOnly={readOnly}
          onOpenDetail={onOpenDetail}
          onMutated={onMutated}
        />
      ) : (
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[32%]">Din rad</TableHead>
              <TableHead className="w-[36%]">I vår katalog</TableHead>
              <TableHead className="w-[200px]">Status</TableHead>
              <TableHead className="w-[200px] text-right">Åtgärd</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <ImportTableRow
                key={row.id}
                row={row}
                importId={importId}
                readOnly={readOnly}
                onOpenDetail={() => onOpenDetail(row.id)}
                onMutated={onMutated}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  )
}

// ----------------------------------------------------------------------------
// Window-virtualised variant for >100 rows. Spacer-row pattern keeps the
// shadcn Table layout intact (real <tr> elements; column widths still align
// with the header). Window scroll preserves the page-level UX.
// ----------------------------------------------------------------------------
function VirtualisedRowTable({
  rows,
  importId,
  readOnly,
  onOpenDetail,
  onMutated,
}: ImportRowTableProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: OVERSCAN_COUNT,
    scrollMargin: parentRef.current?.offsetTop ?? 0,
  })

  const virtualItems = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()
  const paddingTop = virtualItems.length > 0 ? virtualItems[0]!.start : 0
  const paddingBottom =
    virtualItems.length > 0
      ? totalSize - virtualItems[virtualItems.length - 1]!.end
      : 0

  return (
    <div ref={parentRef} data-testid="import-rows-virtualized">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[32%]">Din rad</TableHead>
            <TableHead className="w-[36%]">I vår katalog</TableHead>
            <TableHead className="w-[200px]">Status</TableHead>
            <TableHead className="w-[200px] text-right">Åtgärd</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paddingTop > 0 && (
            <tr aria-hidden>
              <td colSpan={4} style={{ height: `${paddingTop}px` }} />
            </tr>
          )}
          {virtualItems.map((virtualRow) => {
            const row = rows[virtualRow.index]
            if (!row) return null
            return (
              <ImportTableRow
                key={row.id}
                row={row}
                importId={importId}
                readOnly={readOnly}
                onOpenDetail={() => onOpenDetail(row.id)}
                onMutated={onMutated}
              />
            )
          })}
          {paddingBottom > 0 && (
            <tr aria-hidden>
              <td colSpan={4} style={{ height: `${paddingBottom}px` }} />
            </tr>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
