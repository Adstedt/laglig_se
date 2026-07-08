'use client'

/**
 * Laglistor "Tabell" view → migrated in Story 28.8 (Epic 28) onto the
 * unified DataTable core. This file owns the law-domain columns (6 inline
 * editors, change indicator, high-risk warning), the bulk-action content
 * and the remove dialog; ALL table mechanics (client sorting, Set-based
 * selection, column reorder/resize with clamp, row drag-reorder with an
 * optimistic order overlay, 52px virtualization, sticky header + sticky-
 * left title, load-more, the narrow-container card renderer) live in
 * components/ui/data-table.
 *
 * Nested use (GroupedDocumentListTable) passes `disableDndContext` →
 * dnd mode 'external' (the parent owns the DndContext), exactly like the
 * legacy contract.
 */

import { useCallback, useMemo, useState } from 'react'
import type { ColumnDef, VisibilityState } from '@tanstack/react-table'
import type {
  ColumnOrderState,
  ColumnSizingState,
  Updater,
} from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import {
  Eye,
  Trash2,
  FileText,
  Info,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
} from 'lucide-react'
import { DataTable, useLocalSorting } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { SortableHeader } from '@/components/ui/sortable-header'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { RemoveConfirmation } from './remove-confirmation'
import { BulkActionBar } from './bulk-action-bar'
import { PriorityEditor } from './table-cell-editors/priority-editor'
import { DueDateEditor } from './table-cell-editors/due-date-editor'
import { AssigneeEditor } from './table-cell-editors/assignee-editor'
import {
  getContentTypeIcon,
  getContentTypeBadgeColor,
  getContentTypeLabel,
} from '@/lib/utils/content-type'
import type {
  DocumentListItem,
  WorkspaceMemberOption,
  ListGroupSummary,
} from '@/app/actions/document-list'
import type { LawListItemStatus, LawListItemPriority } from '@prisma/client'
import { useDebouncedCallback } from 'use-debounce'
import { ChangeIndicator } from '@/components/features/changes/change-indicator'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { GroupEditor } from './table-cell-editors/group-editor'
import { ComplianceStatusEditor } from './table-cell-editors/compliance-status-editor'
import { ResponsibleEditor } from './table-cell-editors/responsible-editor'
import { TaskProgressCell } from './table-cells/task-progress-cell'
import { LastActivityCell } from './table-cells/last-activity-cell'
import { CellErrorBoundary } from './table-cells/cell-error-boundary'
import type { ComplianceStatus } from '@prisma/client'
import type { TaskProgress, LastActivity } from '@/lib/db/queries/list-items'

// ============================================================================
// Story 6.16: Column Header Tooltip Texts (Swedish)
// ============================================================================

/** Tooltip content for Efterlevnad (Compliance Status) column header */
const EFTERLEVNAD_TOOLTIP_CONTENT = {
  title: 'Efterlevnad',
  lines: [
    'Visar hur väl lagens krav är uppfyllda i nuläget.',
    'Bedöms utifrån rutiner, dokumentation och faktisk tillämpning.',
    'Uppdateras när åtgärder eller underlag läggs till.',
  ],
}

/** Tooltip content for Prioritet (Priority) column header */
const PRIORITET_TOOLTIP_CONTENT = {
  title: 'Prioritet',
  lines: [
    'Visar hur allvarliga konsekvenserna är vid bristande efterlevnad.',
    'Baserat på risk, sanktionsnivå och påverkan på verksamheten.',
    'Påverkas inte av nuvarande efterlevnadsstatus.',
  ],
}

// ============================================================================
// Props (unchanged public interface — page-content untouched)
// ============================================================================

interface DocumentListTableProps {
  items: DocumentListItem[]
  total: number
  hasMore: boolean
  isLoading: boolean
  workspaceMembers: WorkspaceMemberOption[]
  columnVisibility: VisibilityState
  onColumnVisibilityChange: (_visibility: VisibilityState) => void
  columnSizing?: ColumnSizingState | undefined
  onColumnSizingChange?: ((_sizing: ColumnSizingState) => void) | undefined
  columnOrder?: ColumnOrderState | undefined
  onColumnOrderChange?: ((_order: ColumnOrderState) => void) | undefined
  onLoadMore: () => void
  onRemoveItem: (_itemId: string) => Promise<boolean>
  onReorderItems: (
    _items: Array<{ id: string; position: number }>
  ) => Promise<boolean>
  onUpdateItem: (
    _itemId: string,
    _updates: {
      status?: LawListItemStatus
      priority?: LawListItemPriority
      dueDate?: Date | null
      assignedTo?: string | null
      _resolvedAssignee?: {
        id: string
        name: string | null
        email: string
        avatarUrl: string | null
      } | null
      groupId?: string | null
      complianceStatus?: ComplianceStatus
      responsibleUserId?: string | null
      _resolvedResponsibleUser?: {
        id: string
        name: string | null
        email: string
        avatarUrl: string | null
      } | null
    }
  ) => Promise<boolean>
  onBulkUpdate: (
    _itemIds: string[],
    _updates: {
      status?: LawListItemStatus
      priority?: LawListItemPriority
      complianceStatus?: ComplianceStatus
      responsibleUserId?: string | null
    }
  ) => Promise<boolean>
  groups?: ListGroupSummary[] | undefined
  onMoveToGroup?:
    | ((_itemId: string, _groupId: string | null) => Promise<boolean>)
    | undefined
  emptyMessage?: string | undefined
  taskProgress?: Map<string, TaskProgress> | undefined
  lastActivity?: Map<string, LastActivity> | undefined
  onRowClick?: ((_listItemId: string) => void) | undefined
  hideGroupColumn?: boolean | undefined
  disableDndContext?: boolean | undefined
  /**
   * Story 28.9: controlled selection for grouped mode — the wrapper owns
   * ONE Set across all sections and renders the single bulk bar. When
   * provided, this table suppresses its own bulk bar.
   */
  selectedItemIds?: ReadonlySet<string> | undefined
  onSelectionChange?: ((_next: Set<string>) => void) | undefined
}

// ============================================================================
// Helper: Get document URL
// ============================================================================

function getDocumentUrl(item: DocumentListItem): string {
  const contentType = item.document.contentType
  const slug = item.document.slug

  if (contentType === 'EU_REGULATION' || contentType === 'EU_DIRECTIVE') {
    return `/browse/eu/${slug}`
  }
  return `/browse/lagar/${slug}`
}

// ============================================================================
// Main Component
// ============================================================================

export function DocumentListTable({
  items,
  total: _total,
  hasMore,
  isLoading,
  workspaceMembers,
  columnVisibility,
  onColumnVisibilityChange,
  columnSizing: externalColumnSizing,
  onColumnSizingChange,
  columnOrder: externalColumnOrder,
  onColumnOrderChange,
  onLoadMore,
  onRemoveItem,
  onReorderItems,
  onUpdateItem,
  onBulkUpdate,
  groups = [],
  onMoveToGroup,
  emptyMessage = 'Inga dokument i listan.',
  taskProgress,
  lastActivity,
  onRowClick,
  hideGroupColumn = false,
  disableDndContext = false,
  selectedItemIds: controlledSelected,
  onSelectionChange,
}: DocumentListTableProps) {
  const sorting = useLocalSorting([])
  const [localSelected, setLocalSelected] = useState<ReadonlySet<string>>(
    new Set()
  )
  const selectionControlled =
    controlledSelected !== undefined && onSelectionChange !== undefined
  const selected = selectionControlled ? controlledSelected! : localSelected
  const setSelected = selectionControlled
    ? (onSelectionChange as (_next: Set<string>) => void)
    : setLocalSelected
  const [removeConfirmItem, setRemoveConfirmItem] =
    useState<DocumentListItem | null>(null)

  // Internal fallbacks when column state is not externally controlled
  // (nested/grouped usage passes the store-backed state).
  const [internalColumnSizing, setInternalColumnSizing] =
    useState<ColumnSizingState>({})
  const [internalColumnOrder, setInternalColumnOrder] =
    useState<ColumnOrderState>([])
  const columnSizing = externalColumnSizing ?? internalColumnSizing
  const columnOrder = externalColumnOrder ?? internalColumnOrder

  // Story 6.14: hide the group column when nested in grouped mode.
  const effectiveVisibility = useMemo(
    () =>
      hideGroupColumn
        ? { ...columnVisibility, group: false }
        : columnVisibility,
    [columnVisibility, hideGroupColumn]
  )

  // Debounced reorder persistence (legacy parity: 500ms) — the core's
  // optimistic order overlay keeps the visual order while this settles.
  const debouncedReorder = useDebouncedCallback(
    async (updates: Array<{ id: string; position: number }>) => {
      await onReorderItems(updates)
    },
    500
  )

  // ---- Column definitions (select + drag chrome injected by the core) ----

  const columns: ColumnDef<DocumentListItem, unknown>[] = useMemo(
    () => [
      // Content type icon
      {
        id: 'type',
        accessorFn: (row) => row.document.contentType,
        header: 'Typ',
        cell: ({ row }) => {
          const contentType = row.original.document.contentType
          const Icon = getContentTypeIcon(contentType)
          return (
            <div className="flex items-center justify-center">
              <div
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded',
                  getContentTypeBadgeColor(contentType)
                )}
                title={getContentTypeLabel(contentType)}
              >
                <Icon className="h-4 w-4" />
              </div>
            </div>
          )
        },
        enableResizing: false,
        enableSorting: false,
        size: 72,
        minSize: 72,
        maxSize: 72,
        meta: {
          dt: {
            label: 'Typ',
            pinned: 'left',
            padding: 'tight',
            mandatory: true,
            card: { role: 'hidden' },
          },
        },
      },
      // Document (combined title + document number)
      {
        id: 'title',
        accessorFn: (row) => row.document.title,
        header: ({ column }) => (
          <SortableHeader column={column} label="Dokument" />
        ),
        cell: ({ row }) => (
          <div className="w-full overflow-hidden">
            <div className="flex items-center gap-1.5">
              <Link
                href={getDocumentUrl(row.original)}
                className="text-sm font-medium text-foreground hover:underline truncate"
                title={row.original.document.title}
              >
                {row.original.document.title}
              </Link>
              {/* Story 8.1: Pending change indicator */}
              <ChangeIndicator
                count={row.original.pendingChangeCount}
                documentId={row.original.document.id}
              />
            </div>
            <span className="text-xs text-muted-foreground block truncate">
              {row.original.document.documentNumber}
            </span>
          </div>
        ),
        size: 300,
        minSize: 150,
        maxSize: 600,
        meta: {
          dt: {
            label: 'Dokument',
            stickyLeft: true,
            fill: true,
            mandatory: true,
            card: { role: 'title' },
          },
        },
      },
      // Story 6.2/6.16: Compliance Status (inline editable, header tooltip)
      {
        id: 'complianceStatus',
        accessorKey: 'complianceStatus',
        header: ({ column }) => (
          <ColumnHeaderWithTooltip
            column={column}
            label="Efterlevnad"
            tooltipContent={EFTERLEVNAD_TOOLTIP_CONTENT}
          />
        ),
        cell: ({ row }) => (
          <CellErrorBoundary>
            <ComplianceStatusEditor
              value={row.original.complianceStatus}
              onChange={async (newStatus) => {
                await onUpdateItem(row.original.id, {
                  complianceStatus: newStatus,
                })
              }}
            />
          </CellErrorBoundary>
        ),
        size: 200,
        minSize: 150,
        maxSize: 250,
        enableResizing: true,
        meta: {
          dt: {
            label: 'Efterlevnad',
            card: { role: 'badge', priority: 0, interactive: true },
          },
        },
      },
      // Priority (inline editable, header tooltip)
      {
        id: 'priority',
        accessorKey: 'priority',
        header: ({ column }) => (
          <ColumnHeaderWithTooltip
            column={column}
            label="Prioritet"
            tooltipContent={PRIORITET_TOOLTIP_CONTENT}
          />
        ),
        cell: ({ row }) => (
          <PriorityEditor
            value={row.original.priority}
            onChange={async (newPriority) => {
              await onUpdateItem(row.original.id, {
                priority: newPriority as LawListItemPriority,
              })
            }}
          />
        ),
        size: 170,
        minSize: 120,
        maxSize: 220,
        enableResizing: true,
        meta: {
          dt: {
            label: 'Prioritet',
            card: { role: 'badge', priority: 1, interactive: true },
          },
        },
      },
      // Due date (inline editable)
      {
        id: 'dueDate',
        accessorKey: 'dueDate',
        header: ({ column }) => (
          <SortableHeader column={column} label="Deadline" />
        ),
        cell: ({ row }) => (
          <DueDateEditor
            value={row.original.dueDate}
            onChange={async (newDate) => {
              await onUpdateItem(row.original.id, { dueDate: newDate })
            }}
          />
        ),
        size: 140,
        minSize: 120,
        maxSize: 200,
        enableResizing: true,
        meta: {
          dt: {
            label: 'Deadline',
            card: { role: 'meta', priority: 2, interactive: true },
          },
        },
      },
      // Assignee (inline editable) - avatar only
      {
        id: 'assignee',
        accessorFn: (row) => row.assignee?.name ?? row.assignee?.email ?? '',
        header: 'Tilldelad',
        cell: ({ row }) => (
          <AssigneeEditor
            value={row.original.assignee?.id ?? null}
            members={workspaceMembers}
            onChange={async (newAssigneeId) => {
              const member = newAssigneeId
                ? workspaceMembers.find((m) => m.id === newAssigneeId)
                : null
              await onUpdateItem(row.original.id, {
                assignedTo: newAssigneeId,
                _resolvedAssignee: member
                  ? {
                      id: member.id,
                      name: member.name,
                      email: member.email,
                      avatarUrl: member.avatarUrl,
                    }
                  : null,
              })
            }}
          />
        ),
        enableSorting: false,
        enableResizing: false,
        size: 110,
        minSize: 110,
        maxSize: 110,
        meta: {
          dt: {
            label: 'Tilldelad',
            card: { role: 'meta', priority: 3, interactive: true },
          },
        },
      },
      // Story 6.2: Responsible Person (inline editable) - avatar only
      {
        id: 'responsiblePerson',
        accessorFn: (row) =>
          row.responsibleUser?.name ?? row.responsibleUser?.email ?? '',
        header: 'Ansvarig',
        cell: ({ row }) => (
          <CellErrorBoundary>
            <ResponsibleEditor
              value={row.original.responsibleUser?.id ?? null}
              members={workspaceMembers}
              onChange={async (newUserId) => {
                const member = newUserId
                  ? workspaceMembers.find((m) => m.id === newUserId)
                  : null
                await onUpdateItem(row.original.id, {
                  responsibleUserId: newUserId,
                  _resolvedResponsibleUser: member
                    ? {
                        id: member.id,
                        name: member.name,
                        email: member.email,
                        avatarUrl: member.avatarUrl,
                      }
                    : null,
                })
              }}
            />
          </CellErrorBoundary>
        ),
        enableSorting: false,
        enableResizing: false,
        size: 110,
        minSize: 110,
        maxSize: 110,
        meta: {
          dt: {
            label: 'Ansvarig',
            card: { role: 'meta', priority: 4, interactive: true },
          },
        },
      },
      // Story 6.2: Task Progress
      {
        id: 'taskProgress',
        header: 'Uppgifter',
        cell: ({ row }) => {
          const progress = taskProgress?.get(row.original.id)
          return (
            <CellErrorBoundary>
              <TaskProgressCell
                completed={progress?.completed ?? null}
                total={progress?.total ?? null}
              />
            </CellErrorBoundary>
          )
        },
        enableSorting: false,
        enableResizing: false,
        size: 160,
        minSize: 160,
        maxSize: 160,
        meta: {
          dt: {
            label: 'Uppgifter',
            card: {
              role: 'meta',
              priority: 5,
              renderCard: (row) => {
                const progress = taskProgress?.get(row.original.id)
                if (
                  !progress ||
                  progress.total === null ||
                  progress.total === 0
                )
                  return null
                return (
                  <span className="text-sm tabular-nums">
                    {progress.completed ?? 0}/{progress.total} klara
                  </span>
                )
              },
            },
          },
        },
      },
      // Story 6.2: Last Activity
      {
        id: 'lastActivity',
        header: ({ column }) => (
          <SortableHeader column={column} label="Aktivitet" />
        ),
        cell: ({ row }) => {
          const activity = lastActivity?.get(row.original.id)
          return (
            <CellErrorBoundary>
              <LastActivityCell activity={activity ?? null} />
            </CellErrorBoundary>
          )
        },
        size: 145,
        minSize: 120,
        maxSize: 200,
        enableResizing: true,
        enableSorting: false,
        meta: {
          dt: { label: 'Aktivitet', card: { role: 'footer' } },
        },
      },
      // Notes indicator
      {
        id: 'notes',
        accessorFn: (row) => row.notes,
        header: 'Ant.',
        cell: ({ row }) =>
          row.original.notes ? (
            <span className="text-muted-foreground" title={row.original.notes}>
              📝
            </span>
          ) : null,
        enableSorting: false,
        enableResizing: false,
        size: 50,
        minSize: 50,
        maxSize: 50,
        meta: {
          dt: { label: 'Anteckningar', card: { role: 'hidden' } },
        },
      },
      // Story 4.13: Group column (inline editable)
      {
        id: 'group',
        accessorFn: (row) => row.groupName ?? '',
        header: ({ column }) => (
          <SortableHeader column={column} label="Grupp" />
        ),
        cell: ({ row }) => (
          <GroupEditor
            value={row.original.groupId}
            groupName={row.original.groupName}
            groups={groups}
            onChange={async (newGroupId) => {
              if (onMoveToGroup) {
                return await onMoveToGroup(row.original.id, newGroupId)
              }
              return false
            }}
          />
        ),
        size: 160,
        minSize: 100,
        maxSize: 250,
        enableResizing: true,
        meta: {
          dt: {
            label: 'Grupp',
            card: { role: 'meta', priority: 6, interactive: true },
          },
        },
      },
      // Added date
      {
        id: 'addedAt',
        accessorKey: 'addedAt',
        header: ({ column }) => (
          <SortableHeader column={column} label="Tillagd" />
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {new Date(row.original.addedAt).toLocaleDateString('sv-SE')}
          </span>
        ),
        size: 100,
        minSize: 80,
        maxSize: 150,
        enableResizing: true,
        meta: {
          dt: { label: 'Tillagd', card: { role: 'footer' } },
        },
      },
      // Actions
      {
        id: 'actions',
        header: () => null,
        cell: ({ row }) => (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" asChild className="h-8 w-8">
              <Link href={getDocumentUrl(row.original)} title="Visa dokument">
                <Eye className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => setRemoveConfirmItem(row.original)}
              title="Ta bort"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
        enableSorting: false,
        enableResizing: false,
        size: 80,
        minSize: 80,
        maxSize: 80,
        meta: {
          dt: {
            label: 'Åtgärder',
            pinned: 'right',
            padding: 'tight',
            mandatory: true,
            card: { role: 'hidden' },
          },
        },
      },
      // Story 6.16: High-Risk Warning Indicator (far right of row)
      {
        id: 'highRiskWarning',
        header: () => null,
        cell: ({ row }) => {
          const isHighRisk =
            row.original.priority === 'HIGH' &&
            row.original.complianceStatus === 'EJ_UPPFYLLD'

          if (!isHighRisk) return null

          return (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center justify-center">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Hög prioritet och ej uppfylld – kräver åtgärd</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        },
        enableSorting: false,
        enableResizing: false,
        size: 40,
        minSize: 40,
        maxSize: 40,
        meta: {
          dt: {
            label: 'Riskvarning',
            pinned: 'right',
            padding: 'tight',
            mandatory: true,
            card: {
              role: 'badge',
              priority: 2,
              renderCard: (row) =>
                row.original.priority === 'HIGH' &&
                row.original.complianceStatus === 'EJ_UPPFYLLD' ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Kräver åtgärd
                  </span>
                ) : null,
            },
          },
        },
      },
    ],
    [
      onUpdateItem,
      workspaceMembers,
      groups,
      onMoveToGroup,
      taskProgress,
      lastActivity,
    ]
  )

  // ---- Bulk actions ----

  const selectedItemIds = useMemo(() => [...selected], [selected])

  const handleBulkUpdate = async (updates: {
    status?: LawListItemStatus
    priority?: LawListItemPriority
    complianceStatus?: ComplianceStatus
    responsibleUserId?: string | null
  }) => {
    await onBulkUpdate(selectedItemIds, updates)
    setSelected(new Set())
  }

  const handleRemoveConfirm = async () => {
    if (!removeConfirmItem) return
    await onRemoveItem(removeConfirmItem.id)
    setRemoveConfirmItem(null)
  }

  const handleReorder = useCallback(
    (updates: Array<{ id: string; position: number }>) => {
      debouncedReorder(updates)
    },
    [debouncedReorder]
  )

  // Empty state
  if (items.length === 0 && !isLoading) {
    return (
      <EmptyState
        icon={
          <EmptyState.Icon>
            <FileText className="h-8 w-8 text-muted-foreground" />
          </EmptyState.Icon>
        }
        description={emptyMessage}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {!selectionControlled && selectedItemIds.length > 0 && (
        <BulkActionBar
          selectedCount={selectedItemIds.length}
          onClearSelection={() => setSelected(new Set())}
          onBulkUpdate={handleBulkUpdate}
          workspaceMembers={workspaceMembers}
        />
      )}

      <DataTable<DocumentListItem>
        data={items}
        columns={columns}
        getRowId={(row) => row.id}
        sorting={sorting}
        selection={{ selected, onSelectedChange: setSelected }}
        columnState={{
          visibility: effectiveVisibility,
          onVisibilityChange: (updater: Updater<VisibilityState>) =>
            onColumnVisibilityChange(
              typeof updater === 'function'
                ? updater(effectiveVisibility)
                : updater
            ),
          sizing: columnSizing,
          onSizingChange: (updater: Updater<ColumnSizingState>) => {
            const next =
              typeof updater === 'function' ? updater(columnSizing) : updater
            if (onColumnSizingChange) onColumnSizingChange(next)
            else setInternalColumnSizing(next)
          },
          order: columnOrder,
          onOrderChange: (updater: Updater<ColumnOrderState>) => {
            const next =
              typeof updater === 'function' ? updater(columnOrder) : updater
            if (onColumnOrderChange) onColumnOrderChange(next)
            else setInternalColumnOrder(next)
          },
        }}
        dnd={
          disableDndContext
            ? { mode: 'external' }
            : { mode: 'self', onReorder: handleReorder }
        }
        loadMore={{
          kind: 'button',
          hasMore,
          isLoading,
          onLoadMore,
          label: 'Visa fler',
        }}
        rowInteraction={
          onRowClick ? { onRowClick: (row) => onRowClick(row.id) } : {}
        }
        status={{ isLoading }}
        view={{ cardBelow: 800 }}
      />

      {/* Remove confirmation */}
      <RemoveConfirmation
        open={!!removeConfirmItem}
        onOpenChange={(open) => !open && setRemoveConfirmItem(null)}
        documentTitle={removeConfirmItem?.document.title ?? ''}
        onConfirm={handleRemoveConfirm}
      />
    </div>
  )
}

// ============================================================================
// Story 6.16: Column Header with Info Tooltip
// ============================================================================

/**
 * Reusable column header component with sortable functionality and info
 * tooltip. Used for Efterlevnad and Prioritet columns.
 */
function ColumnHeaderWithTooltip({
  column,
  label,
  tooltipContent,
}: {
  column: {
    getIsSorted: () => false | 'asc' | 'desc'
    toggleSorting: (_desc?: boolean) => void
  }
  label: string
  tooltipContent: { title: string; lines: string[] }
}) {
  const sorted = column.getIsSorted()

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(sorted === 'asc')}
        className="-ml-4 h-8"
      >
        {label}
        {sorted === 'asc' ? (
          <ArrowUp className="ml-2 h-4 w-4" />
        ) : sorted === 'desc' ? (
          <ArrowDown className="ml-2 h-4 w-4" />
        ) : (
          <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
        )}
      </Button>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="rounded p-0.5 hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-ring"
              aria-label={`Information om ${label}`}
            >
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="start" className="max-w-sm">
            <p className="font-semibold">{tooltipContent.title}</p>
            {tooltipContent.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
