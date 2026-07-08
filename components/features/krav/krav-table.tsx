'use client'

/**
 * Story 20.3 → migrated in Story 28.2 (Epic 28) onto the unified DataTable
 * core. This file is now column definitions + adapter mapping; all table
 * mechanics (manualSorting, virtualization with measureElement, sticky
 * header, cursor load-more button, row-click guard, and the narrow-container
 * card renderer) live in components/ui/data-table.
 *
 * Sort state lives in the URL (via KravPageContent) — the SortingAdapter
 * runs in `manual` mode and forwards header clicks back up via onSortChange.
 *
 * Interactive cells (FulfilledToggle, AssigneeEditor, Regelverk button) are
 * ordinary buttons/popovers — the core's interactive-element guard keeps
 * their clicks from bubbling into row navigation.
 */

import { useMemo } from 'react'
import type { ColumnDef, SortingState, Updater } from '@tanstack/react-table'
import { formatDistanceToNow, format } from 'date-fns'
import { sv } from 'date-fns/locale'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import {
  DataTable,
  DataTableSortMenu,
  useLocalStorageColumnState,
} from '@/components/ui/data-table'
import { FulfilledToggle } from '@/components/ui/fulfilled-toggle'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { SortableHeader } from '@/components/ui/sortable-header'
import { AssigneeEditor } from '@/components/features/document-list/table-cell-editors/assignee-editor'
import { cn } from '@/lib/utils'
import type {
  WorkspaceRequirementRow,
  WorkspaceRequirementsSortField,
  WorkspaceRequirementsSortDirection,
} from '@/app/actions/workspace-requirements'
import type { WorkspaceMemberOption } from '@/app/actions/document-list'

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
  // Story 28.2 uplift: per-user persisted column widths (resize grips).
  // Legacy krav had no resizing; the core gives it for free.
  const columnState = useLocalStorageColumnState({
    key: 'laglig:krav:columns:v1',
  })

  const columns = useMemo<ColumnDef<WorkspaceRequirementRow, unknown>[]>(
    () => [
      {
        id: 'is_fulfilled',
        header: ({ column }) => (
          <SortableHeader column={column} label="Uppfylld" />
        ),
        cell: ({ row }) => (
          <FulfilledToggle
            checked={row.original.isFulfilled}
            onCheckedChange={() => onToggleFulfilled(row.original)}
            aria-label={
              row.original.isFulfilled
                ? 'Markerad som uppfylld — klicka för att återställa'
                : 'Markera som uppfylld'
            }
          />
        ),
        // Wide enough for the header label + sort arrow under table-fixed
        // (the toggle itself only needs ~48px).
        size: 112,
        minSize: 112,
        maxSize: 112,
        enableSorting: true,
        enableResizing: false,
        meta: {
          dt: {
            label: 'Uppfylld',
            pinned: 'left',
            padding: 'tight',
            // The toggle is krav's primary action — keep it live on cards,
            // WITH a status label (a bare circle reads as nothing).
            card: {
              role: 'badge',
              priority: 0,
              interactive: true,
              renderCard: (row) => (
                <span className="inline-flex items-center gap-2">
                  <FulfilledToggle
                    checked={row.original.isFulfilled}
                    onCheckedChange={() => onToggleFulfilled(row.original)}
                    aria-label={
                      row.original.isFulfilled
                        ? 'Markerad som uppfylld — klicka för att återställa'
                        : 'Markera som uppfylld'
                    }
                  />
                  <span
                    className={cn(
                      'text-xs font-medium',
                      row.original.isFulfilled
                        ? 'text-green-700 dark:text-green-400'
                        : 'text-muted-foreground'
                    )}
                  >
                    {row.original.isFulfilled ? 'Uppfylld' : 'Ej uppfylld'}
                  </span>
                </span>
              ),
            },
          },
        },
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
        // Fill column: 280 is the floor; leftover container width lands
        // here, so the kravpunkt text breathes at every width tier.
        size: 280,
        minSize: 240,
        maxSize: 800,
        enableSorting: false,
        meta: {
          dt: { label: 'Kravpunkt', fill: true, card: { role: 'title' } },
        },
      },
      {
        id: 'law_name',
        header: ({ column }) => (
          <SortableHeader column={column} label="Regelverk" />
        ),
        cell: ({ row }) => (
          // Row is fully clickable (opens the law item); keep a focusable
          // button here so keyboard users retain a navigation affordance.
          // stopPropagation avoids firing onOpenLawItem twice via the row.
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onOpenLawItem(row.original)
            }}
            className="text-sm text-left underline-offset-2 hover:underline hover:text-primary focus:outline-none focus-visible:underline"
          >
            {row.original.lawName}
          </button>
        ),
        size: 200,
        minSize: 120,
        maxSize: 420,
        enableSorting: true,
        meta: {
          dt: {
            label: 'Regelverk',
            card: { role: 'meta', priority: 1, interactive: true },
          },
        },
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
        size: 170,
        minSize: 110,
        maxSize: 320,
        enableSorting: true,
        meta: {
          dt: {
            label: 'Laglista',
            card: { role: 'meta', priority: 2 },
          },
        },
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
        size: 72,
        minSize: 72,
        maxSize: 72,
        enableSorting: false,
        enableResizing: false,
        meta: {
          dt: {
            label: 'Ansvarig',
            padding: 'tight',
            card: {
              role: 'meta',
              priority: 3,
              interactive: true,
              renderCard: (row) => {
                const assignee = row.original.effectiveAssignee
                const member = members.find((m) => m.id === assignee.userId)
                return (
                  <span className="inline-flex items-center gap-2">
                    <AssigneeEditor
                      value={assignee.userId}
                      members={members}
                      onChange={async (newId) =>
                        onAssigneeChange(row.original, newId)
                      }
                      variant={assignee.isInherited ? 'inherited' : 'direct'}
                      showResetOption={!assignee.isInherited}
                      onResetToInherited={() => onResetAssignee(row.original)}
                    />
                    <span
                      className={cn(
                        'truncate text-sm',
                        !member && 'text-muted-foreground'
                      )}
                    >
                      {member?.name ?? member?.email ?? 'Ej tilldelad'}
                    </span>
                  </span>
                )
              },
            },
          },
        },
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
        size: 90,
        minSize: 70,
        maxSize: 140,
        enableSorting: false,
        meta: {
          dt: {
            label: 'Bevis',
            card: {
              role: 'meta',
              priority: 4,
              renderCard: (row) => {
                const { bevisRequired, evidenceCount } = row.original
                if (evidenceCount > 0) {
                  return (
                    <span className="inline-flex items-center gap-1 text-sm text-green-700 dark:text-green-400">
                      <ShieldCheck className="h-4 w-4" />
                      <span className="tabular-nums">
                        {evidenceCount} bifogade
                      </span>
                    </span>
                  )
                }
                if (bevisRequired) {
                  return (
                    <span className="inline-flex items-center gap-1 text-sm text-amber-700 dark:text-amber-400">
                      <ShieldAlert className="h-4 w-4" />
                      Saknar bevis
                    </span>
                  )
                }
                // Not applicable → no row on the card at all.
                return null
              },
            },
          },
        },
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
        size: 150,
        minSize: 110,
        maxSize: 240,
        enableSorting: true,
        meta: {
          dt: {
            label: 'Uppdaterad',
            card: { role: 'footer' },
          },
        },
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

  // Sort state: URL (via parent) ↔ TanStack SortingState, manual mode.
  const sortingState: SortingState = useMemo(
    () => [{ id: sort.field, desc: sort.direction === 'desc' }],
    [sort.field, sort.direction]
  )

  const handleSortingChange = (updater: Updater<SortingState>) => {
    const next = typeof updater === 'function' ? updater(sortingState) : updater
    const first = next[0]
    if (!first) {
      // TanStack cleared the sort. Default back to updated_at desc.
      onSortChange({ field: 'updated_at', direction: 'desc' })
      return
    }
    onSortChange({
      field: first.id as WorkspaceRequirementsSortField,
      direction: first.desc ? 'desc' : 'asc',
    })
  }

  return (
    // Accessible landmark kept from the legacy table (AC 40): screen-reader
    // users jump straight to the requirements list.
    <section aria-label="Kravpunkter i arbetsytan">
      <DataTable<WorkspaceRequirementRow>
        data={rows}
        columns={columns}
        getRowId={(row) => row.id}
        sorting={{
          sorting: sortingState,
          onSortingChange: handleSortingChange,
          manual: true,
        }}
        columnState={columnState}
        loadMore={{
          kind: 'button',
          hasMore: nextCursor !== null,
          isLoading: isLoadingMore,
          onLoadMore,
          label: 'Ladda fler',
        }}
        rowInteraction={{
          onRowClick: (row) => onOpenLawItem(row),
        }}
        // Two tiers (user decision 2026-07-08): full table with horizontal
        // scroll down to 800px container, cards below (chat maximized /
        // mobile). No column shedding here — hidden columns read as lost
        // data on this surface; scroll keeps everything reachable.
        view={{ cardBelow: 800, showCardSortMenu: false }}
        virtualization={{ maxHeight: '70vh' }}
      />
    </section>
  )
}

// ============================================================================
// Toolbar sort menu (card regime)
// ============================================================================

const KRAV_SORT_OPTIONS: Array<{
  id: WorkspaceRequirementsSortField
  label: string
}> = [
  { id: 'is_fulfilled', label: 'Uppfylld' },
  { id: 'law_name', label: 'Regelverk' },
  { id: 'laglista_name', label: 'Laglista' },
  { id: 'updated_at', label: 'Uppdaterad' },
]

/**
 * Sort dropdown for the page toolbar — replaces the DataTable's built-in
 * card sort row (suppressed via showCardSortMenu: false) so filtering,
 * search and sort share one control block instead of stacking three rows.
 * The page shows it only in the card regime via a container-query class.
 */
export function KravSortMenu({
  sort,
  onSortChange,
  className,
}: {
  sort: KravTableSort
  onSortChange: (_next: KravTableSort) => void
  className?: string
}) {
  return (
    <DataTableSortMenu
      options={KRAV_SORT_OPTIONS}
      sorting={[{ id: sort.field, desc: sort.direction === 'desc' }]}
      onSortingChange={(updater) => {
        const current = [{ id: sort.field, desc: sort.direction === 'desc' }]
        const next = typeof updater === 'function' ? updater(current) : updater
        const first = next[0]
        if (!first) {
          onSortChange({ field: 'updated_at', direction: 'desc' })
          return
        }
        onSortChange({
          field: first.id as WorkspaceRequirementsSortField,
          direction: first.desc ? 'desc' : 'asc',
        })
      }}
      {...(className ? { className } : {})}
    />
  )
}
