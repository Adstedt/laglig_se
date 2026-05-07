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

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import useSWR from 'swr'
import { toast } from 'sonner'
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
  type ImportRowSummary,
  type ImportSummary,
} from '@/app/actions/law-list-import'
import { ImportTableRow } from './import-table-row'
import { ImportRowDetailSheet } from './import-row-detail-sheet'
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
      const result = await commitImport({
        importId: importData.id,
        listName: listName.trim(),
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

  const pendingHighCount = counts.matched_high
  const canCommit = isReviewable && acceptedCount > 0

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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bekräfta och skapa lista</DialogTitle>
            <DialogDescription>
              {acceptedCount}{' '}
              {acceptedCount === 1 ? 'rad läggs till' : 'rader läggs till'},{' '}
              {counts.catalog_requested + counts.catalog_fulfilled} skickas för
              manuell registrering, {counts.rejected} avvisas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="listName" className="text-sm font-medium">
              Namn på listan
            </label>
            <Input
              id="listName"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              placeholder="t.ex. Importerad lista 2026"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCommitDialogOpen(false)}
              disabled={isCommitting}
            >
              Avbryt
            </Button>
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
// ImportRowTable — shadcn Table layout, no virtualisation.
//
// At 1000 rows max (parser cap) and ~5 cells per row, plain DOM rendering
// stays well under 16 ms reconcile time on modern browsers. The previous
// TanStack-Virtual implementation was needed when each row was a 180-px
// Card with rich content; with the compact Table row (~52 px, 5 cells)
// it's no longer load-bearing. If perf becomes an issue beyond ~2000
// rows, swap in a virtual-table wrapper here.
// ============================================================================

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
    </Card>
  )
}
