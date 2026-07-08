'use client'

/**
 * Story 17.x → migrated in Story 28.4 (Epic 28) onto the unified DataTable
 * core. Column definitions + adapter mapping only; table mechanics (URL
 * manualSorting, sticky header, row-click guard, the narrow-container card
 * renderer) live in components/ui/data-table.
 *
 * Public interface unchanged — document-browser-page.tsx owns sort state
 * via URL params and archive orchestration exactly as before.
 *
 * Marketing note (28.4): landing-v3 renders a FROZEN presentational copy
 * (components/features/landing-v3/marketing-document-table.tsx) — hero
 * screenshots never track this live implementation.
 */

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { ColumnDef, SortingState, Updater } from '@tanstack/react-table'
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
import { DataTable } from '@/components/ui/data-table'
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

interface DocumentTableProps {
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

function DocumentActionsMenu({
  doc,
  onArchive,
}: {
  doc: DocumentItem
  onArchive: (_documentId: string) => void
}) {
  const router = useRouter()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          aria-label={`Åtgärder för ${doc.title}`}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => router.push(`/workspace/styrdokument/${doc.id}/edit`)}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Öppna
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            window.open(
              `/api/workspace/documents/${doc.id}/export?format=docx`,
              '_blank'
            )
          }
        >
          <FileText className="mr-2 h-4 w-4" />
          Exportera som Word
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            window.open(
              `/api/workspace/documents/${doc.id}/export?format=pdf`,
              '_blank'
            )
          }
        >
          <FileDown className="mr-2 h-4 w-4" />
          Exportera som PDF
        </DropdownMenuItem>
        {doc.status !== 'ARCHIVED' && (
          <DropdownMenuItem onClick={() => onArchive(doc.id)}>
            <Archive className="mr-2 h-4 w-4" />
            Arkivera
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function DocumentTable({
  documents,
  sortBy,
  sortOrder,
  onSort,
  onArchive,
}: DocumentTableProps) {
  const router = useRouter()

  const columns = useMemo<ColumnDef<DocumentItem, unknown>[]>(
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
        // Fill column: 280 is the floor, surplus container width lands here.
        size: 280,
        minSize: 180,
        maxSize: 600,
        enableSorting: true,
        meta: {
          dt: { label: 'Titel', fill: true, card: { role: 'title' } },
        },
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
        meta: {
          dt: {
            label: 'Dokumentnr',
            card: {
              role: 'meta',
              priority: 1,
              // Skip the card row entirely when there's no number.
              renderCard: (row) =>
                row.original.document_number ? (
                  <span className="text-sm text-muted-foreground">
                    {row.original.document_number}
                  </span>
                ) : null,
            },
          },
        },
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
        meta: {
          dt: { label: 'Typ', card: { role: 'badge', priority: 1 } },
        },
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
        meta: {
          dt: {
            label: 'Status',
            card: { role: 'badge', priority: 0, interactive: true },
          },
        },
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
        meta: {
          dt: { label: 'Version', card: { role: 'meta', priority: 4 } },
        },
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
        meta: {
          dt: { label: 'Författare', card: { role: 'meta', priority: 2 } },
        },
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
        meta: {
          dt: { label: 'Senast uppdaterad', card: { role: 'footer' } },
        },
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
        meta: {
          dt: {
            label: 'Granskningsdatum',
            card: {
              role: 'meta',
              priority: 3,
              // Only meaningful when set — skip the row otherwise.
              renderCard: (row) =>
                row.original.review_date ? (
                  <span className="text-sm">
                    <ReviewDateCell date={row.original.review_date} />
                  </span>
                ) : null,
            },
          },
        },
      },
      {
        id: 'history',
        header: () => null,
        cell: ({ row }) => {
          const doc = row.original
          // Story 17.17 smoke-found polish: the panel's "Aktuell" label
          // should mark the canonical approved baseline currently in force
          // ("i kraft"), NOT whichever version the editor happens to be
          // displaying. Priority: approved → draft (never-approved
          // fallback) → counter (legacy/edge case).
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
        meta: {
          dt: {
            label: 'Historik',
            pinned: 'right',
            padding: 'tight',
            card: { role: 'hidden' },
          },
        },
      },
      {
        id: 'actions',
        header: () => null,
        cell: ({ row }) => (
          <DocumentActionsMenu doc={row.original} onArchive={onArchive} />
        ),
        size: 56,
        minSize: 56,
        maxSize: 56,
        enableSorting: false,
        meta: {
          dt: {
            label: 'Åtgärder',
            pinned: 'right',
            padding: 'tight',
            // Surfaces as the card's kebab via slots.cardActions below.
            card: { role: 'hidden' },
          },
        },
      },
    ],
    [router, onArchive]
  )

  // Server-driven sort: the parent (`document-browser-page.tsx`) owns sort
  // state via URL params and re-fetches on change; the adapter surfaces the
  // current sort so headers render arrows, and forwards clicks to onSort —
  // the parent's handleSort owns the asc/desc toggle.
  const sortingState: SortingState = useMemo(
    () => [{ id: sortBy, desc: sortOrder === 'desc' }],
    [sortBy, sortOrder]
  )

  const handleSortingChange = (updater: Updater<SortingState>) => {
    const next = typeof updater === 'function' ? updater(sortingState) : updater
    const first = next[0]
    if (first) onSort(first.id as SortField)
  }

  return (
    <DataTable<DocumentItem>
      data={documents}
      columns={columns}
      getRowId={(row) => row.id}
      sorting={{
        sorting: sortingState,
        onSortingChange: handleSortingChange,
        manual: true,
      }}
      rowInteraction={{
        onRowClick: (row) =>
          router.push(`/workspace/styrdokument/${row.id}/edit`),
      }}
      slots={{
        cardActions: (row) => (
          <DocumentActionsMenu doc={row.original} onArchive={onArchive} />
        ),
      }}
      // Two tiers (matches krav): full table with horizontal scroll down to
      // 800px container, cards below (chat maximized / mobile).
      view={{ cardBelow: 800 }}
    />
  )
}
