'use client'

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
} from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { DocumentStatusBadge } from '@/components/features/documents/document-status-badge'
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

export function DocumentTable({
  documents,
  sortBy,
  sortOrder,
  onSort,
  onArchive,
}: DocumentTableProps) {
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
        cell: ({ row }) => (
          <div className="whitespace-nowrap">
            <DocumentStatusBadge status={row.original.status} />
          </div>
        ),
        size: 160,
        minSize: 140,
        maxSize: 200,
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
          <span className="text-muted-foreground text-sm">
            {formatDistanceToNow(new Date(row.original.updated_at), {
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
