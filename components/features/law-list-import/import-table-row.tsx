'use client'

/**
 * Story 24.4 follow-up: per-row TableRow on the review surface.
 *
 * Replaces the original Card-based `ImportRowCard` with a compact shadcn
 * Table row. Click the row body → opens the side `<ImportRowDetailSheet>`
 * with full LLM reasoning + alt candidates. Action buttons in the actions
 * cell don't propagate the click so users can accept/avvisa inline.
 */

import { useTransition } from 'react'
import { Check, Clock, MoreHorizontal, RotateCcw, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TableCell, TableRow } from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  acceptRow,
  rejectRow,
  replaceRowMatch,
  undoRowDecision,
  type ImportRowSummary,
} from '@/app/actions/law-list-import'
import { cn } from '@/lib/utils'

interface ImportTableRowProps {
  row: ImportRowSummary
  importId: string
  /** True when the import isn't AWAITING_REVIEW — disables actions. */
  readOnly: boolean
  /** Open the detail Sheet for this row. */
  onOpenDetail: () => void
  /** Called after any mutation so the parent SWR cache refetches. */
  onMutated: () => void
}

// Map RowMatchStatus → confidence-tier badge appearance.
function tierBadgeProps(status: ImportRowSummary['match_status']): {
  label: string
  tone: 'success' | 'warning' | 'danger' | 'neutral' | 'info'
} {
  switch (status) {
    case 'MATCHED_HIGH':
      return { label: 'Hög', tone: 'success' }
    case 'MATCHED_MEDIUM':
      return { label: 'Behöver bekräftelse', tone: 'warning' }
    case 'UNMATCHED':
      return { label: 'Saknas', tone: 'danger' }
    case 'PENDING':
      return { label: 'Väntar', tone: 'neutral' }
    case 'ACCEPTED_BY_USER':
      return { label: 'Accepterad', tone: 'success' }
    case 'REPLACED_BY_USER':
      return { label: 'Bytt', tone: 'info' }
    case 'REJECTED_BY_USER':
      return { label: 'Avvisad', tone: 'neutral' }
    case 'CATALOG_REQUEST_PENDING':
      return { label: 'Begärd', tone: 'info' }
    case 'CATALOG_REQUEST_FULFILLED':
      return { label: 'Tillagd', tone: 'success' }
    default:
      return { label: '—', tone: 'neutral' }
  }
}

const DECIDED_STATES: ImportRowSummary['match_status'][] = [
  'ACCEPTED_BY_USER',
  'REPLACED_BY_USER',
  'REJECTED_BY_USER',
  'CATALOG_REQUEST_PENDING',
  'CATALOG_REQUEST_FULFILLED',
]

export function ImportTableRow({
  row,
  importId: _importId,
  readOnly,
  onOpenDetail,
  onMutated,
}: ImportTableRowProps) {
  const [isPending, startTransition] = useTransition()
  const decided = DECIDED_STATES.includes(row.match_status)
  const tier = tierBadgeProps(row.match_status)

  function runMutation(
    fn: () => Promise<{ success: boolean; error?: string }>,
    errorTitle: string
  ) {
    startTransition(async () => {
      const result = await fn()
      if (!result.success) {
        toast.error(errorTitle, { description: result.error })
        return
      }
      onMutated()
    })
  }

  function handleAccept() {
    runMutation(() => acceptRow(row.id), 'Kunde inte acceptera raden')
  }
  function handleReject() {
    runMutation(() => rejectRow(row.id), 'Kunde inte avvisa raden')
  }
  function handleUndo() {
    runMutation(() => undoRowDecision(row.id), 'Kunde inte ångra beslutet')
  }
  function handleQuickReplace(candidateDocId: string) {
    runMutation(
      () => replaceRowMatch(row.id, candidateDocId),
      'Kunde inte byta matchning'
    )
  }

  // Stop click-propagation on action wrappers so the row-click that opens
  // the Sheet doesn't fire when the user is interacting with buttons.
  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <TableRow
      onClick={onOpenDetail}
      className={cn('cursor-pointer', decided && 'opacity-70')}
    >
      <TableCell className="py-3">
        <div className="flex min-w-0 max-w-full flex-col gap-0.5">
          <span
            className="truncate font-medium leading-tight"
            title={row.source_titel ?? undefined}
          >
            {row.source_titel ?? (
              <em className="text-muted-foreground">Inget titelfält</em>
            )}
          </span>
          {row.source_sfs_nummer && (
            <span className="truncate text-xs text-muted-foreground">
              {row.source_sfs_nummer}
            </span>
          )}
        </div>
      </TableCell>

      <TableCell className="py-3">
        {row.matched_document ? (
          <div className="flex min-w-0 max-w-full flex-col gap-0.5">
            <span
              className="truncate font-medium leading-tight"
              title={row.matched_document.title}
            >
              {row.matched_document.title}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {row.matched_document.document_number}
            </span>
          </div>
        ) : row.match_status === 'UNMATCHED' && row.match_candidates[0] ? (
          // Surface the top candidate as a hint so users notice the matcher
          // found something plausible (often the correct law under a
          // different SFS-number) before they jump to "Begär tillägg".
          <div className="flex min-w-0 max-w-full flex-col gap-0.5">
            <span
              className="truncate text-sm leading-tight text-muted-foreground"
              title={row.match_candidates[0].title}
            >
              Närmaste: {row.match_candidates[0].title}
            </span>
            <span className="truncate text-xs text-muted-foreground/70">
              {row.match_candidates[0].document_number ??
                row.match_candidates[0].content_type}
              {' · '}
              {Math.round(row.match_candidates[0].fuzzy_score * 100)}% likhet
            </span>
          </div>
        ) : (
          <span className="text-sm italic text-muted-foreground">
            {row.match_status === 'CATALOG_REQUEST_PENDING'
              ? 'Skickad till vår katalogsredaktion'
              : 'Inget matchande dokument'}
          </span>
        )}
      </TableCell>

      <TableCell className="py-3">
        <Badge tone={tier.tone} variant="soft" className="whitespace-nowrap">
          {tier.label}
        </Badge>
      </TableCell>

      <TableCell className="py-3 text-right" onClick={stop}>
        <RowActions
          row={row}
          decided={decided}
          readOnly={readOnly}
          isPending={isPending}
          onAccept={handleAccept}
          onReject={handleReject}
          onUndo={handleUndo}
          onQuickReplace={handleQuickReplace}
          onOpenDetail={onOpenDetail}
        />
      </TableCell>
    </TableRow>
  )
}

// ============================================================================
// RowActions — primary button per status + overflow menu
// ============================================================================

interface RowActionsProps {
  row: ImportRowSummary
  decided: boolean
  readOnly: boolean
  isPending: boolean
  onAccept: () => void
  onReject: () => void
  onUndo: () => void
  onQuickReplace: (_candidateDocId: string) => void
  onOpenDetail: () => void
}

function RowActions({
  row,
  decided,
  readOnly,
  isPending,
  onAccept,
  onReject,
  onUndo,
  onQuickReplace,
  onOpenDetail,
}: RowActionsProps) {
  // Read-only / decided rows: just a small status chip + Ångra link
  if (readOnly || decided) {
    return (
      <div className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        {row.match_status === 'ACCEPTED_BY_USER' && (
          <Check className="h-3.5 w-3.5 text-emerald-600" />
        )}
        {row.match_status === 'REPLACED_BY_USER' && (
          <Check className="h-3.5 w-3.5 text-blue-600" />
        )}
        {row.match_status === 'REJECTED_BY_USER' && (
          <X className="h-3.5 w-3.5 text-rose-600" />
        )}
        {row.match_status === 'CATALOG_REQUEST_PENDING' && (
          <Clock className="h-3.5 w-3.5 text-amber-600" />
        )}
        {row.match_status === 'CATALOG_REQUEST_FULFILLED' && (
          <Check className="h-3.5 w-3.5 text-emerald-600" />
        )}
        {!readOnly && (
          <button
            type="button"
            onClick={onUndo}
            disabled={
              isPending || row.match_status === 'CATALOG_REQUEST_FULFILLED'
            }
            className="inline-flex items-center gap-1 underline-offset-4 hover:underline disabled:no-underline disabled:opacity-50"
          >
            <RotateCcw className="h-3 w-3" />
            Ångra
          </button>
        )}
      </div>
    )
  }

  // UNMATCHED: opening the Sheet is the path to both candidate selection
  // and "Begär tillägg". When the matcher returned plausible candidates
  // (i.e. the user supplied a wrong SFS but the title fuzzy-matched
  // something), the primary CTA points at the candidates instead of at
  // catalog-request — that's the higher-leverage action since the doc
  // probably already exists in our catalogue.
  if (row.match_status === 'UNMATCHED') {
    const hasCandidates = row.match_candidates.length > 0
    return (
      <div className="inline-flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          onClick={onOpenDetail}
          disabled={isPending}
        >
          {hasCandidates ? 'Granska kandidater' : 'Begär tillägg'}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onReject}
          disabled={isPending}
          aria-label="Avvisa raden"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  // MATCHED_HIGH / MATCHED_MEDIUM: primary Acceptera + overflow menu
  const otherCandidates = row.match_candidates.filter(
    (c) => c.document_id !== row.matched_document_id
  )

  return (
    <div className="inline-flex items-center gap-1">
      <Button size="sm" onClick={onAccept} disabled={isPending}>
        Acceptera
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            disabled={isPending}
            aria-label="Fler åtgärder"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuItem onSelect={onOpenDetail}>
            Visa detaljer
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {otherCandidates.length > 0 && (
            <>
              <DropdownMenuLabel>Byt till annan kandidat</DropdownMenuLabel>
              {otherCandidates.slice(0, 4).map((c) => (
                <DropdownMenuItem
                  key={c.document_id}
                  onSelect={() => onQuickReplace(c.document_id)}
                  className="flex flex-col items-start gap-0.5"
                >
                  <span className="text-sm font-medium">{c.title}</span>
                  <span className="flex w-full items-center justify-between text-xs text-muted-foreground">
                    <span>{c.document_number ?? c.content_type}</span>
                    <span>{Math.round(c.fuzzy_score * 100)}%</span>
                  </span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onSelect={onReject} className="text-destructive">
            Avvisa raden
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
