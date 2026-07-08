'use client'

/**
 * FROZEN presentational copy of the pre-Epic-28 DocumentTable, snapshotted
 * in Story 28.4 for the landing-v3 hero screenshots. Marketing needs stable
 * pixels, not features — this file deliberately does NOT track the live
 * table (components/features/documents/document-table.tsx, now on the
 * unified DataTable core). Do not "fix" drift here.
 */

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  type ColumnDef,
  type OnChangeFn,
  type SortingState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import {
  MoreHorizontal,
  ExternalLink,
  FileText,
  FileDown,
  Archive,
  History,
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { DualStatusBadge } from '@/components/features/documents/dual-status-badge'
import { VersionHistoryPanel } from '@/components/features/documents/editor/version-history-panel'
import { getReviewDateStatus } from '@/lib/utils/review-date-status'
import { SortableHeader } from '@/components/ui/sortable-header'
import { cn } from '@/lib/utils'

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  POLICY: 'Policy',
  RISK_ASSESSMENT: 'Riskbedömning',
  ACTION_PLAN: 'Handlingsplan',
  PROCEDURE: 'Rutin',
  INSTRUCTION: 'Instruktion',
  CHECKLIST: 'Checklista',
  REPORT: 'Rapport',
  OTHER: 'Övrigt',
}

export interface DocumentItem {
  id: string
  title: string
  document_type: string
  status: string
  document_number: string | null
  current_version_number: number
  review_date: string | null
  created_at: string
  updated_at: string
  creator: { id: string; name: string | null; email: string } | null
  // Story 17.17 AC 1 / AC 5 — dual-pointer fields populated by Story 17.16's
  // schema. Feed the composite badge and the derived `last_meaningful_change`
  // value for the "Senast uppdaterad" column.
  current_approved_version_id: string | null
  current_draft_version_id: string | null
  draft_status: 'DRAFT' | 'IN_REVIEW' | null
  current_approved_version: {
    version_number: number
    approved_at: string | null
  } | null
  current_draft_version: {
    version_number: number
    created_at: string
  } | null
}

/**
 * Story 17.17 AC 5 — derive the "Senast ändrad" timestamp from the doc's
 * most-recent meaningful change: a draft save, the latest approval, or the
 * doc's own `updated_at` (covers metadata-only changes like a review-date
 * bump). Render-time derivation; no DB-level change or new query.
 */
function lastMeaningfulChange(doc: DocumentItem): Date {
  const candidates: number[] = [new Date(doc.updated_at).getTime()]
  if (doc.current_draft_version?.created_at) {
    candidates.push(new Date(doc.current_draft_version.created_at).getTime())
  }
  if (doc.current_approved_version?.approved_at) {
    candidates.push(
      new Date(doc.current_approved_version.approved_at).getTime()
    )
  }
  return new Date(Math.max(...candidates))
}

type SortField = 'title' | 'updated_at' | 'created_at' | 'review_date'

interface MarketingDocumentTableProps {
  documents: DocumentItem[]
  sortBy: SortField
  sortOrder: 'asc' | 'desc'
  onSort: (_field: SortField) => void
  onArchive: (_documentId: string) => void
}

function ReviewDateCell({ date }: { date: string | null }) {
  if (!date) return <span className="text-muted-foreground">—</span>

  const status = getReviewDateStatus(date)
  const formatted = format(new Date(date), 'yyyy-MM-dd')

  return (
    <span
      className={cn(
        status === 'overdue' && 'text-red-600 font-medium',
        status === 'upcoming' && 'text-amber-600 font-medium'
      )}
    >
      {formatted}
    </span>
  )
}

export function MarketingDocumentTable({
  documents,
  sortBy,
  sortOrder,
  onSort,
  onArchive,
}: MarketingDocumentTableProps) {
  const router = useRouter()

  const columns = useMemo<ColumnDef<DocumentItem>[]>(
    () => [
      {
        id: 'title',
        accessorKey: 'title',
        header: ({ column }) => (
          <SortableHeader column={column} label="Titel" />
        ),
        cell: ({ row }) => (
          <span className="font-medium">{row.original.title}</span>
        ),
        size: 280,
        minSize: 180,
        maxSize: 600,
        enableSorting: true,
      },
      {
        id: 'document_number',
        accessorKey: 'document_number',
        header: 'Dokumentnr',
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {row.original.document_number ?? '—'}
          </span>
        ),
        size: 120,
        minSize: 100,
        maxSize: 180,
        enableSorting: false,
      },
      {
        id: 'document_type',
        accessorKey: 'document_type',
        header: 'Typ',
        cell: ({ row }) => (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {DOCUMENT_TYPE_LABELS[row.original.document_type] ??
              row.original.document_type}
          </Badge>
        ),
        size: 100,
        minSize: 80,
        maxSize: 140,
        enableSorting: false,
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const doc = row.original
          return (
            <div className="whitespace-nowrap">
              <DualStatusBadge
                documentId={doc.id}
                documentTitle={doc.title}
                status={doc.status}
                draftStatus={doc.draft_status}
                currentApprovedVersionId={doc.current_approved_version_id}
                currentDraftVersionId={doc.current_draft_version_id}
                currentApprovedVersionNumber={
                  doc.current_approved_version?.version_number ?? null
                }
                currentDraftVersionNumber={
                  doc.current_draft_version?.version_number ?? null
                }
              />
            </div>
          )
        },
        // Story 17.17 — composite "Godkänd v{N} · Utkast v{N+1} pågår" needs
        // more room than the single badge. Bumped from 160/140/200.
        size: 280,
        minSize: 220,
        maxSize: 360,
        enableSorting: false,
      },
      {
        id: 'version',
        accessorKey: 'current_version_number',
        header: 'Version',
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            v{row.original.current_version_number}
          </span>
        ),
        size: 80,
        minSize: 70,
        maxSize: 100,
        enableSorting: false,
      },
      {
        id: 'creator',
        accessorKey: 'creator',
        header: 'Författare',
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.creator?.name ?? row.original.creator?.email ?? '—'}
          </span>
        ),
        size: 140,
        minSize: 110,
        maxSize: 200,
        enableSorting: false,
      },
      {
        id: 'updated_at',
        accessorKey: 'updated_at',
        header: ({ column }) => (
          <SortableHeader column={column} label="Senast uppdaterad" />
        ),
        cell: ({ row }) => (
          // Story 17.17 AC 5 — derived "last meaningful change": MAX of the
          // doc's `updated_at`, the draft's `created_at`, and the approved
          // version's `approved_at`. Server-side ORDER BY still uses
          // `updated_at` per AC 15 (no new queries); column header copy is
          // unchanged per AC 5.
          <span className="text-muted-foreground text-sm">
            {formatDistanceToNow(lastMeaningfulChange(row.original), {
              addSuffix: true,
              locale: sv,
            })}
          </span>
        ),
        size: 160,
        minSize: 140,
        maxSize: 220,
        enableSorting: true,
      },
      {
        id: 'review_date',
        accessorKey: 'review_date',
        header: ({ column }) => (
          <SortableHeader column={column} label="Granskningsdatum" />
        ),
        cell: ({ row }) => (
          <span className="text-sm">
            <ReviewDateCell date={row.original.review_date} />
          </span>
        ),
        size: 140,
        minSize: 120,
        maxSize: 200,
        enableSorting: true,
      },
      {
        id: 'history',
        header: '',
        cell: ({ row }) => {
          const doc = row.original
          // Story 17.17 smoke-found polish: the panel's "Aktuell" label
          // should mark the canonical approved baseline currently in force
          // ("i kraft"), NOT whichever version the editor happens to be
          // displaying. For a dual-state doc, "Aktuell" should be the
          // approved version (the one that's compliance-active), not the
          // draft that's still being worked on. Priority: approved → draft
          // (never-approved fallback) → counter (legacy/edge case).
          const aktuellVersionNumber =
            doc.current_approved_version?.version_number ??
            doc.current_draft_version?.version_number ??
            doc.current_version_number
          return (
            <VersionHistoryPanel
              documentId={doc.id}
              currentVersionNumber={aktuellVersionNumber}
              onRestore={() => {
                /* No editor mounted here — page refreshes after restore
                   succeeds via Next.js cache invalidation in the action. */
              }}
              onCompare={() => {
                /* Diff view is editor-scoped; from the list view we just
                   surface restore + the version timeline. */
              }}
              documentStatus={doc.status}
              currentDraftVersionId={doc.current_draft_version_id}
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  aria-label={`Visa versionshistorik för ${doc.title}`}
                  // Story 17.17 AC 14 — stop click bubbling so the row's
                  // default editor-navigation handler does not double-fire.
                  // Radix SheetTrigger's asChild composes its own onClick
                  // through `composeEventHandlers`, so the Sheet still opens.
                  onClick={(e) => e.stopPropagation()}
                >
                  <History className="h-4 w-4" />
                </Button>
              }
            />
          )
        },
        size: 40,
        minSize: 40,
        maxSize: 40,
        enableSorting: false,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const doc = row.original
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    router.push(`/workspace/styrdokument/${doc.id}/edit`)
                  }}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Öppna
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    window.open(
                      `/api/workspace/documents/${doc.id}/export?format=docx`,
                      '_blank'
                    )
                  }}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Exportera som Word
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    window.open(
                      `/api/workspace/documents/${doc.id}/export?format=pdf`,
                      '_blank'
                    )
                  }}
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Exportera som PDF
                </DropdownMenuItem>
                {doc.status !== 'ARCHIVED' && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      onArchive(doc.id)
                    }}
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    Arkivera
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
        size: 56,
        minSize: 56,
        maxSize: 56,
        enableSorting: false,
      },
    ],
    [router, onArchive]
  )

  // Server-driven sort: the parent (`document-browser-page.tsx`) owns sort
  // state via URL params and re-fetches on change. We surface the current
  // sort to TanStack so SortableHeader renders the right arrow, then forward
  // header clicks to `onSort(field)` — the parent's `handleSort` owns the
  // asc/desc toggle.
  const sorting: SortingState = [{ id: sortBy, desc: sortOrder === 'desc' }]

  const handleSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater
    const first = next[0]
    if (first) onSort(first.id as SortField)
  }

  const table = useReactTable({
    data: documents,
    columns,
    state: { sorting },
    onSortingChange: handleSortingChange,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  style={{ minWidth: header.getSize() }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className="cursor-pointer"
              onClick={() =>
                router.push(`/workspace/styrdokument/${row.original.id}/edit`)
              }
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell
                  key={cell.id}
                  style={{ minWidth: cell.column.getSize() }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
