'use client'

/**
 * Story 20.3: Workspace Krav Table.
 * TanStack Table mirroring `document-list-table.tsx` conventions.
 * Sort state lives in the URL (via KravPageContent) — TanStack is run in
 * `manualSorting` mode and forwards column-header clicks back up via
 * `onSortingChange`.
 *
 * Interactive cells:
 *   - Status (col 1)   — checkbox toggle → onToggleFulfilled(row)
 *   - Lag    (col 3)   — link → onOpenLawItem(row) opens the modal
 *   - Ansvarig (col 5) — <AssigneeEditor /> with inherited variant
 *
 * Non-interactive cells: Kravpunkt text (col 2), Laglista (col 4),
 * Bevis icon (col 6), Uppdaterad (col 7).
 *
 * Virtualization (AC 28, PERF-001 resolution): auto-enables above 100 rows,
 * mirroring the threshold + `useVirtualizer` config in
 * `document-list-table.tsx:838`. Below threshold: normal render. Above:
 * only the visible window is in the DOM (with OVERSCAN buffer). Fixes the
 * DOM-reflow cost that would otherwise hit users with large workspaces
 * after repeated "Ladda fler" clicks.
 */

import { useMemo, useRef } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type Updater,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { formatDistanceToNow, format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { SortableHeader } from '@/components/ui/sortable-header'
import { AssigneeEditor } from '@/components/features/document-list/table-cell-editors/assignee-editor'
import { cn } from '@/lib/utils'
import type {
  WorkspaceRequirementRow,
  WorkspaceRequirementsSortField,
  WorkspaceRequirementsSortDirection,
} from '@/app/actions/workspace-requirements'
import type { WorkspaceMemberOption } from '@/app/actions/document-list'

// Virtualization constants — mirror document-list-table.tsx:132-138.
const VIRTUALIZATION_THRESHOLD = 100
const ESTIMATED_ROW_HEIGHT = 52
const OVERSCAN_COUNT = 5
const VIRTUAL_TABLE_MAX_HEIGHT = '70vh'

export interface KravTableSort {
  field: WorkspaceRequirementsSortField
  direction: WorkspaceRequirementsSortDirection
}

export interface KravTableProps {
  rows: WorkspaceRequirementRow[]
  members: WorkspaceMemberOption[]
  sort: KravTableSort
  onSortChange: (_next: KravTableSort) => void
  onToggleFulfilled: (_row: WorkspaceRequirementRow) => void
  onAssigneeChange: (
    _row: WorkspaceRequirementRow,
    _newUserId: string | null
  ) => void
  onResetAssignee: (_row: WorkspaceRequirementRow) => void
  onOpenLawItem: (_row: WorkspaceRequirementRow) => void
  nextCursor: string | null
  onLoadMore: () => void
  isLoadingMore: boolean
}

export function KravTable({
  rows,
  members,
  sort,
  onSortChange,
  onToggleFulfilled,
  onAssigneeChange,
  onResetAssignee,
  onOpenLawItem,
  nextCursor,
  onLoadMore,
  isLoadingMore,
}: KravTableProps) {
  const columns = useMemo<ColumnDef<WorkspaceRequirementRow>[]>(
    () => [
      {
        id: 'is_fulfilled',
        header: ({ column }) => <SortableHeader column={column} label="" />,
        cell: ({ row }) => (
          <Checkbox
            checked={row.original.isFulfilled}
            onCheckedChange={() => onToggleFulfilled(row.original)}
            aria-label={
              row.original.isFulfilled
                ? 'Markerad som uppfylld — klicka för att återställa'
                : 'Markera som uppfylld'
            }
          />
        ),
        size: 48,
        enableSorting: true,
      },
      {
        id: 'text',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            Kravpunkt
          </span>
        ),
        cell: ({ row }) => (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    'block text-sm leading-snug line-clamp-2',
                    row.original.isFulfilled && 'text-muted-foreground'
                  )}
                >
                  {row.original.text}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" className="max-w-md">
                {row.original.text}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ),
        enableSorting: false,
      },
      {
        id: 'law_name',
        header: ({ column }) => <SortableHeader column={column} label="Lag" />,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => onOpenLawItem(row.original)}
            className="text-sm text-left underline-offset-2 hover:underline hover:text-primary focus:outline-none focus-visible:underline"
          >
            {row.original.lawName}
          </button>
        ),
        enableSorting: true,
      },
      {
        id: 'laglista_name',
        header: ({ column }) => (
          <SortableHeader column={column} label="Laglista" />
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.laglistaName}
          </span>
        ),
        enableSorting: true,
      },
      {
        id: 'responsible',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            Ansvarig
          </span>
        ),
        cell: ({ row }) => (
          <AssigneeEditor
            value={row.original.effectiveAssignee.userId}
            members={members}
            onChange={async (newId) => onAssigneeChange(row.original, newId)}
            variant={
              row.original.effectiveAssignee.isInherited
                ? 'inherited'
                : 'direct'
            }
            showResetOption={!row.original.effectiveAssignee.isInherited}
            onResetToInherited={() => onResetAssignee(row.original)}
          />
        ),
        size: 56,
        enableSorting: false,
      },
      {
        id: 'bevis',
        header: () => (
          <span className="text-xs font-medium text-muted-foreground">
            Bevis
          </span>
        ),
        cell: ({ row }) => {
          const { bevisRequired, evidenceCount } = row.original
          if (evidenceCount > 0) {
            return (
              <span className="inline-flex items-center gap-1 text-sm text-green-700 dark:text-green-400">
                <ShieldCheck className="h-4 w-4" />
                <span className="tabular-nums">{evidenceCount}</span>
              </span>
            )
          }
          if (bevisRequired) {
            return (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex items-center gap-1 text-sm text-amber-700 dark:text-amber-400"
                      aria-label="Saknar bevis"
                    >
                      <ShieldAlert className="h-4 w-4" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Saknar bevis — kravpunkten kräver bifogat bevis.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )
          }
          return (
            <span
              className="text-sm text-muted-foreground"
              aria-label="Inget bevis krävs"
            >
              —
            </span>
          )
        },
        enableSorting: false,
      },
      {
        id: 'updated_at',
        header: ({ column }) => (
          <SortableHeader column={column} label="Uppdaterad" />
        ),
        cell: ({ row }) => {
          const date = row.original.updatedAt
          return (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-sm text-muted-foreground">
                    {formatDistanceToNow(date, {
                      locale: sv,
                      addSuffix: true,
                    })}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">
                  {format(date, 'yyyy-MM-dd HH:mm', { locale: sv })}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        },
        enableSorting: true,
      },
    ],
    [
      members,
      onAssigneeChange,
      onResetAssignee,
      onToggleFulfilled,
      onOpenLawItem,
    ]
  )

  // Sort state: TanStack internal → mapped from/to URL state.
  const sortingState: SortingState = [
    { id: sort.field, desc: sort.direction === 'desc' },
  ]

  const handleSortingChange = (updater: Updater<SortingState>) => {
    const next = typeof updater === 'function' ? updater(sortingState) : updater
    const first = next[0]
    if (!first) {
      // TanStack cleared the sort. Default back to updated_at desc.
      onSortChange({ field: 'updated_at', direction: 'desc' })
      return
    }
    // Only propagate if the clicked column is one we allow to sort on
    // (non-sortable columns set enableSorting: false so TanStack won't
    // include them in the update — defensive cast anyway).
    onSortChange({
      field: first.id as WorkspaceRequirementsSortField,
      direction: first.desc ? 'desc' : 'asc',
    })
  }

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting: sortingState },
    manualSorting: true,
    onSortingChange: handleSortingChange,
    getCoreRowModel: getCoreRowModel(),
  })

  // Virtualization (AC 28) — only enabled above threshold.
  const modelRows = table.getRowModel().rows
  const shouldVirtualize = modelRows.length > VIRTUALIZATION_THRESHOLD
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count: modelRows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: OVERSCAN_COUNT,
    enabled: shouldVirtualize,
  })
  const virtualItems = rowVirtualizer.getVirtualItems()

  return (
    <div className="space-y-4">
      <div
        ref={tableContainerRef}
        className={cn(
          'w-full rounded-md border overflow-x-auto',
          shouldVirtualize && 'overflow-y-auto'
        )}
        style={
          shouldVirtualize ? { maxHeight: VIRTUAL_TABLE_MAX_HEIGHT } : undefined
        }
        role="region"
        aria-label="Kravpunkter i arbetsytan"
      >
        <table className="w-full text-sm">
          <thead
            className={cn(
              'bg-muted/40',
              // Sticky header when virtualized so column labels stay visible
              // while the body scrolls internally.
              shouldVirtualize && 'sticky top-0 z-10'
            )}
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody
            style={
              shouldVirtualize
                ? {
                    display: 'block',
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    position: 'relative',
                  }
                : undefined
            }
          >
            {shouldVirtualize
              ? virtualItems.map((virtualItem) => {
                  const row = modelRows[virtualItem.index]
                  if (!row) return null
                  return (
                    <tr
                      key={row.id}
                      data-index={virtualItem.index}
                      ref={(node) => rowVirtualizer.measureElement(node)}
                      className="border-t hover:bg-muted/30 transition-colors"
                      style={{
                        display: 'table',
                        tableLayout: 'fixed',
                        width: '100%',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className="px-3 py-2 align-middle"
                          style={{ width: cell.column.getSize() }}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      ))}
                    </tr>
                  )
                })
              : modelRows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-t hover:bg-muted/30 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-3 py-2 align-middle"
                        style={{ width: cell.column.getSize() }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {nextCursor !== null && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onLoadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? 'Laddar…' : 'Ladda fler'}
          </Button>
        </div>
      )}
    </div>
  )
}
