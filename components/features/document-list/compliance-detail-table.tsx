'use client'

/**
 * Story 6.18: Compliance Detail Table (Efterlevnad view)
 * Shows compliance substance (business impact and compliance actions) directly in the list
 * for quick scanning during audit preparation without opening modals.
 */

import { useState, useMemo, useCallback } from 'react'
import type {
  ColumnDef,
  ColumnOrderState,
  ColumnSizingState,
  ExpandedState,
  Row,
  Updater,
  VisibilityState,
} from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ChevronDown, ChevronUp, FileText, Info, Plus } from 'lucide-react'
import { DataTable, useLocalSorting } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { SortableHeader } from '@/components/ui/sortable-header'
import { BulkActionBar } from './bulk-action-bar'
import { PriorityEditor } from './table-cell-editors/priority-editor'
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
import type { LawListItemPriority, ComplianceStatus } from '@prisma/client'
import { useDebouncedCallback } from 'use-debounce'
import { ChangeIndicator } from '@/components/features/changes/change-indicator'
import { cn } from '@/lib/utils'
import { ComplianceStatusEditor } from './table-cell-editors/compliance-status-editor'
import { ResponsibleEditor } from './table-cell-editors/responsible-editor'
import { CellErrorBoundary } from './table-cells/cell-error-boundary'
import { KravpunkterChecklist } from './legal-document-modal/kravpunkter-checklist'
import useSWR from 'swr'
import { RichTextDisplay } from '@/components/ui/rich-text-editor'
import { type RequirementWithEvidence } from '@/app/actions/law-list-item-requirements'

const TOOLTIP_DELAY = 250

const HUR_PAVERKAR_TOOLTIP_CONTENT = {
  title: 'Hur påverkar detta oss?',
  lines: [
    'Beskriver varför författningen är relevant för er verksamhet.',
    'Förklarar vilka processer, avdelningar eller produkter som berörs.',
    'Ger kontext vid revisioner och underlättar intern kommunikation.',
  ],
}

const KRAVPUNKTER_TOOLTIP_CONTENT = {
  title: 'Kravpunkter',
  lines: [
    'Strukturerad checklista över konkreta krav denna lag ställer på er.',
    'Markera som uppfyllda när ni har bevis eller rutiner på plats.',
    'Länka dokument och filer som bevis per kravpunkt.',
  ],
}

// ============================================================================
// Constants
// ============================================================================

// ============================================================================
// Props
// ============================================================================

interface ComplianceDetailTableProps {
  items: DocumentListItem[]
  total: number
  hasMore: boolean
  isLoading: boolean
  workspaceMembers: WorkspaceMemberOption[]
  onLoadMore: () => void
  onRemoveItem: (_itemId: string) => Promise<boolean>
  onReorderItems: (
    _items: Array<{ id: string; position: number }>
  ) => Promise<boolean>
  onUpdateItem: (
    _itemId: string,
    _updates: {
      complianceStatus?: ComplianceStatus
      priority?: LawListItemPriority
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
      complianceStatus?: ComplianceStatus
      responsibleUserId?: string | null
    }
  ) => Promise<boolean>
  groups?: ListGroupSummary[] | undefined
  onMoveToGroup?:
    | ((_itemId: string, _groupId: string | null) => Promise<boolean>)
    | undefined
  /** Story 6.18: Column visibility for showing/hiding optional columns */
  columnVisibility?: VisibilityState | undefined
  onColumnVisibilityChange?:
    | ((_visibility: VisibilityState) => void)
    | undefined
  /** Column sizing for resizable columns */
  columnSizing?: ColumnSizingState | undefined
  onColumnSizingChange?: ((_sizing: ColumnSizingState) => void) | undefined
  /** Column order for drag-to-reorder */
  columnOrder?: ColumnOrderState | undefined
  onColumnOrderChange?: ((_order: ColumnOrderState) => void) | undefined
  emptyMessage?: string | undefined
  /** Called when row is clicked (opens modal) */
  onRowClick?: ((_listItemId: string) => void) | undefined
  /** Called when "Lägg till" link is clicked (opens modal with editor focused) */
  onAddContent?:
    | ((
        _listItemId: string,
        _field: 'businessContext' | 'complianceNarrative' | 'kravpunkter'
      ) => void)
    | undefined
  /** For nested usage in grouped accordion tables */
  hideGroupColumn?: boolean | undefined
  disableDndContext?: boolean | undefined
  /**
   * Story 28.9: controlled selection for grouped mode — the wrapper owns
   * ONE Set across all sections and renders the single bulk bar. When
   * provided, this table suppresses its own bulk bar.
   */
  selectedItemIds?: ReadonlySet<string> | undefined
  onSelectionChange?: ((_next: Set<string>) => void) | undefined
  /** Story 17.17: When true, inline kravpunkter editor renders read-only */
  complianceReadOnly?: boolean | undefined
}

// ============================================================================
// Helpers
// ============================================================================

function stripHtml(html: string | null): string {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, '').trim()
}

function formatSwedishDate(date: Date | null): string | null {
  if (!date) return null
  return new Date(date).toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ============================================================================
// Truncated Text Cell with Tooltip
// ============================================================================

interface TruncatedTextCellProps {
  content: string | null
  title: string
  updatedAt?: Date | null
  updatedByName?: string | null
  onAddClick?: () => void
  isNotApplicable?: boolean
}

function TruncatedTextCell({
  content,
  title,
  updatedAt,
  updatedByName,
  onAddClick,
  isNotApplicable,
}: TruncatedTextCellProps) {
  const text = stripHtml(content)

  // Not applicable - show dash
  if (isNotApplicable) {
    return <span className="text-muted-foreground text-sm">—</span>
  }

  // Empty content - show "Lägg till" link
  if (!text) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation()
          onAddClick?.()
        }}
        className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 px-2 py-1 rounded border border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5 transition-colors"
      >
        <Plus className="h-3 w-3" />
        Lägg till
      </button>
    )
  }

  // Has content - show truncated with tooltip
  return (
    <TooltipProvider delayDuration={TOOLTIP_DELAY}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="line-clamp-2 text-sm text-foreground cursor-help">
            {text}
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="start"
          className="max-w-[400px] p-4"
        >
          <div className="space-y-2">
            <p className="font-semibold text-sm">{title}</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {text}
            </p>
            {updatedAt && (
              <p className="text-xs text-muted-foreground">
                Senast uppdaterad {formatSwedishDate(updatedAt)}
                {updatedByName && ` av ${updatedByName}`}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ============================================================================
// Expanded Row Content
// ============================================================================

interface ExpandedRowContentProps {
  row: Row<DocumentListItem>
  /** Story 17.17: disables inline kravpunkter editing for users without tasks:edit */
  complianceReadOnly?: boolean | undefined
  /** Story 17.18: used to resolve "Senast uppdaterad … av {name}" in the Kommentar subsection */
  workspaceMembers: WorkspaceMemberOption[]
}

/**
 * Story 17.17 + 17.18 + 21.22: Expanded row content.
 *
 * Three sections, top-down audit-flow order:
 *  1. Hur påverkar detta oss? (business context)
 *  2. Hur efterlever vi kraven? (compliance narrative — Story 21.22)
 *  3. Kravpunkter (checklist with inline progress)
 */
function ExpandedRowContent({
  row,
  complianceReadOnly,
  workspaceMembers,
}: ExpandedRowContentProps) {
  const item = row.original
  const businessContextText = stripHtml(item.businessContext)
  const hasComplianceNarrative =
    !!item.complianceNarrative && stripHtml(item.complianceNarrative).length > 0
  const isNotApplicable = item.complianceStatus === 'EJ_TILLAMPLIG'

  const businessContextUpdatedByName = item.businessContextUpdatedBy
    ? (workspaceMembers.find((m) => m.id === item.businessContextUpdatedBy)
        ?.name ?? null)
    : null

  const complianceNarrativeUpdatedByName = item.complianceNarrativeUpdatedBy
    ? (workspaceMembers.find((m) => m.id === item.complianceNarrativeUpdatedBy)
        ?.name ?? null)
    : null

  const [kravpunkterProgress, setKravpunkterProgress] = useState<{
    fulfilled: number
    total: number
  }>({ fulfilled: 0, total: 0 })

  const outerCellClass = 'bg-muted/30 border-t border-border/60 p-0'
  const cardShellClass =
    'mx-auto max-w-6xl rounded-lg border border-border bg-card shadow-sm'
  // Section headers use sentence-case + a hairline underline — matches the
  // modal's accordion label treatment ("Kravpunkter" in both places).
  const sectionLabelClass =
    'flex items-center gap-2 text-sm font-semibold text-foreground border-b border-border/50 pb-2 mb-3'

  if (isNotApplicable) {
    return (
      <div className={outerCellClass}>
        <div className="px-6 py-6 lg:px-8">
          <div className={cn(cardShellClass, 'px-6 py-5')}>
            <p className="text-sm text-muted-foreground italic">
              Denna lag är markerad som ej tillämplig för verksamheten.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const progressPercent =
    kravpunkterProgress.total > 0
      ? Math.round(
          (kravpunkterProgress.fulfilled / kravpunkterProgress.total) * 100
        )
      : 0

  return (
    <div className={outerCellClass}>
      <div className="px-6 py-6 lg:px-8">
        <div className={cn(cardShellClass, 'p-6 lg:p-8')}>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.3fr] gap-y-8 md:gap-y-0">
            {/* Hur påverkar detta oss? — business context + Kommentar (read-only detail view) */}
            <section className="md:pr-8 space-y-6">
              <div>
                <h4 className={sectionLabelClass}>
                  <span>Hur påverkar detta oss?</span>
                </h4>
                {businessContextText ? (
                  <div className="space-y-2">
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {businessContextText}
                    </p>
                    {item.businessContextUpdatedAt && (
                      <p className="text-[11px] text-muted-foreground/80">
                        Senast uppdaterad{' '}
                        {formatSwedishDate(item.businessContextUpdatedAt)}
                        {businessContextUpdatedByName &&
                          ` av ${businessContextUpdatedByName}`}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Ingen beskrivning tillagd.
                  </p>
                )}
              </div>

              <div>
                <h4 className={sectionLabelClass}>
                  <span>Hur efterlever vi kraven?</span>
                </h4>
                {hasComplianceNarrative ? (
                  <div className="space-y-2">
                    <RichTextDisplay
                      content={item.complianceNarrative ?? ''}
                      className="text-sm text-foreground"
                    />
                    {item.complianceNarrativeUpdatedAt && (
                      <p className="text-[11px] text-muted-foreground/80">
                        Senast uppdaterad{' '}
                        {formatSwedishDate(item.complianceNarrativeUpdatedAt)}
                        {complianceNarrativeUpdatedByName &&
                          ` av ${complianceNarrativeUpdatedByName}`}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Ingen beskrivning tillagd.
                  </p>
                )}
              </div>
            </section>

            {/* Kravpunkter — primary action surface with inline progress tracker */}
            <section className="md:pl-8 md:border-l md:border-border/50">
              <h4 className={sectionLabelClass}>
                <span>Kravpunkter</span>
                {kravpunkterProgress.total > 0 && (
                  <div className="flex items-center gap-2 ml-auto font-normal">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {kravpunkterProgress.fulfilled}/
                      {kravpunkterProgress.total} uppfyllda
                    </span>
                    <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </h4>
              <KravpunkterChecklist
                listItemId={item.id}
                readOnly={complianceReadOnly ?? false}
                onProgressChange={setKravpunkterProgress}
              />
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Kravpunkter Count Cell (Story 17.18)
// ============================================================================

/**
 * Story 17.18: Table cell for the "Kravpunkter" column. Renders either a live
 * `N/M uppfyllda` progress pill (when requirements exist) or a "+ Lägg till"
 * ghost button (when none exist).
 *
 * Counts come pre-batched from the server (`getDocumentListItems` →
 * `requirementTotal`/`requirementFulfilled`) so the cell renders instantly with
 * NO per-row fetch — previously every visible row fired its own
 * `getRequirementsForListItem` server action, producing a 40–50-POST burst on
 * each page load/refresh. The cell still SUBSCRIBES (no fetcher) to the SAME
 * SWR key as KravpunkterChecklist, so when the user opens the expansion/modal
 * the checklist's fetch + optimistic mutations update the pill live. Cache data
 * (when present) wins over the server-provided initial counts.
 */
interface KravpunkterCountCellProps {
  listItemId: string
  initialTotal: number
  initialFulfilled: number
  isNotApplicable: boolean
  readOnly: boolean
  onAddClick: () => void
}

function KravpunkterCountCell({
  listItemId,
  initialTotal,
  initialFulfilled,
  isNotApplicable,
  readOnly,
  onAddClick,
}: KravpunkterCountCellProps) {
  // Pure cache subscriber: a null fetcher means this never triggers a request,
  // it only re-renders when KravpunkterChecklist (which shares this key) loads
  // or mutates the data. Until then we render the server-batched initial counts.
  const { data: requirements } = useSWR<RequirementWithEvidence[]>(
    `list-item-requirements:${listItemId}`,
    null,
    {
      revalidateOnMount: false,
      revalidateIfStale: false,
      revalidateOnFocus: false,
    }
  )

  if (isNotApplicable) {
    return <span className="text-muted-foreground text-sm">—</span>
  }

  const total = requirements ? requirements.length : initialTotal
  const fulfilled = requirements
    ? requirements.filter((r) => r.isFulfilled).length
    : initialFulfilled

  if (total === 0) {
    if (readOnly) {
      return <span className="text-muted-foreground text-sm">—</span>
    }
    return (
      <button
        onClick={(e) => {
          e.stopPropagation()
          onAddClick()
        }}
        className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 px-2 py-1 rounded border border-dashed border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5 transition-colors"
      >
        <Plus className="h-3 w-3" />
        Lägg till
      </button>
    )
  }

  const progressPercent = Math.round((fulfilled / total) * 100)

  const pillContent = (
    <>
      <span className="text-xs text-muted-foreground tabular-nums">
        {fulfilled}/{total} uppfyllda
      </span>
      <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </>
  )

  if (readOnly) {
    return (
      <div className="inline-flex items-center gap-2 px-2 py-1">
        {pillContent}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onAddClick()
      }}
      className="inline-flex items-center gap-2 px-2 py-1 rounded-md hover:bg-accent transition-colors"
      aria-label={`${fulfilled} av ${total} uppfyllda — öppna kravpunkter`}
    >
      {pillContent}
    </button>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function ComplianceDetailTable({
  items,
  total: _total,
  hasMore,
  isLoading,
  workspaceMembers,
  onLoadMore,
  onRemoveItem: _onRemoveItem,
  onReorderItems,
  onUpdateItem,
  onBulkUpdate,
  groups: _groups = [],
  onMoveToGroup: _onMoveToGroup,
  columnVisibility = {},
  onColumnVisibilityChange,
  columnSizing: externalColumnSizing,
  onColumnSizingChange,
  columnOrder: externalColumnOrder,
  onColumnOrderChange,
  emptyMessage = 'Inga dokument i listan.',
  onRowClick,
  onAddContent,
  hideGroupColumn: _hideGroupColumn = false,
  disableDndContext = false,
  selectedItemIds: controlledSelected,
  onSelectionChange,
  complianceReadOnly = false,
}: ComplianceDetailTableProps) {
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
  const [expanded, setExpanded] = useState<ExpandedState>({})

  const [internalColumnSizing, setInternalColumnSizing] =
    useState<ColumnSizingState>({})
  const [internalColumnOrder, setInternalColumnOrder] =
    useState<ColumnOrderState>([])
  const columnSizing = externalColumnSizing ?? internalColumnSizing
  const columnOrder = externalColumnOrder ?? internalColumnOrder

  // Debounced reorder persistence (legacy parity: 500ms) — the core's
  // optimistic order overlay keeps the visual order while this settles.
  const debouncedReorder = useDebouncedCallback(
    async (updates: Array<{ id: string; position: number }>) => {
      await onReorderItems(updates)
    },
    500
  )

  // Column definitions (select + drag chrome injected by the core;
  // expansion chevron injected as an ordinary consumer column).
  const columns: ColumnDef<DocumentListItem, unknown>[] = useMemo(
    () => [
      {
        id: 'contentType',
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
        enableSorting: false,
        enableResizing: false,
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
      {
        id: 'title',
        accessorFn: (row) => row.document.title,
        header: ({ column }) => (
          <SortableHeader column={column} label="Dokument" />
        ),
        cell: ({ row }) => (
          <div className="w-full overflow-hidden">
            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onRowClick?.(row.original.id)
                }}
                className="text-sm font-medium text-foreground hover:underline text-left truncate"
                title={row.original.document.title}
              >
                {row.original.document.title}
              </button>
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
      {
        id: 'businessContext',
        header: () => (
          <HeaderWithTooltip
            label="Hur påverkar detta oss?"
            tooltipContent={HUR_PAVERKAR_TOOLTIP_CONTENT}
          />
        ),
        cell: ({ row }) => (
          <CellErrorBoundary>
            <TruncatedTextCell
              content={row.original.businessContext}
              title="Hur påverkar detta oss?"
              updatedAt={row.original.updatedAt}
              isNotApplicable={
                row.original.complianceStatus === 'EJ_TILLAMPLIG'
              }
              onAddClick={() =>
                onAddContent?.(row.original.id, 'businessContext')
              }
            />
          </CellErrorBoundary>
        ),
        enableSorting: false,
        size: 240,
        minSize: 240,
        maxSize: 500,
        enableResizing: true,
        meta: {
          dt: {
            label: 'Hur påverkar detta oss?',
            card: {
              role: 'meta',
              priority: 3,
              cardLabel: 'Påverkan',
              renderCard: (row) => {
                const text = stripHtml(row.original.businessContext)
                if (!text) return null
                return (
                  <span className="line-clamp-2 text-sm text-muted-foreground">
                    {text}
                  </span>
                )
              },
            },
          },
        },
      },
      {
        id: 'kravpunkter',
        header: () => (
          <HeaderWithTooltip
            label="Kravpunkter"
            tooltipContent={KRAVPUNKTER_TOOLTIP_CONTENT}
          />
        ),
        cell: ({ row }) => (
          <CellErrorBoundary>
            <KravpunkterCountCell
              listItemId={row.original.id}
              initialTotal={row.original.requirementTotal}
              initialFulfilled={row.original.requirementFulfilled}
              isNotApplicable={
                row.original.complianceStatus === 'EJ_TILLAMPLIG'
              }
              readOnly={complianceReadOnly}
              onAddClick={() => onAddContent?.(row.original.id, 'kravpunkter')}
            />
          </CellErrorBoundary>
        ),
        enableSorting: false,
        size: 215,
        minSize: 215,
        maxSize: 500,
        enableResizing: true,
        meta: {
          dt: {
            label: 'Kravpunkter',
            card: {
              role: 'meta',
              priority: 2,
              renderCard: (row) => {
                const total = row.original.requirementTotal
                if (!total) return null
                return (
                  <span className="text-sm tabular-nums">
                    {row.original.requirementFulfilled ?? 0}/{total} uppfyllda
                  </span>
                )
              },
            },
          },
        },
      },
      {
        id: 'complianceStatus',
        accessorKey: 'complianceStatus',
        header: 'Status',
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
        enableSorting: false,
        size: 200,
        minSize: 200,
        maxSize: 250,
        enableResizing: true,
        meta: {
          dt: {
            label: 'Status',
            card: { role: 'badge', priority: 0, interactive: true },
          },
        },
      },
      {
        id: 'priority',
        accessorKey: 'priority',
        header: 'Prioritet',
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
        enableSorting: false,
        size: 170,
        minSize: 170,
        maxSize: 220,
        enableResizing: true,
        meta: {
          dt: {
            label: 'Prioritet',
            card: { role: 'badge', priority: 1, interactive: true },
          },
        },
      },
      {
        id: 'responsiblePerson',
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
      // Expand chevron — toggles the core's controlled expansion state.
      {
        id: 'expand',
        header: () => null,
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation()
              row.toggleExpanded()
            }}
            aria-label={row.getIsExpanded() ? 'Fäll ihop' : 'Expandera'}
          >
            {row.getIsExpanded() ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        ),
        enableSorting: false,
        enableResizing: false,
        size: 50,
        minSize: 50,
        maxSize: 50,
        meta: {
          dt: {
            label: 'Expandera',
            pinned: 'right',
            padding: 'tight',
            mandatory: true,
            card: { role: 'hidden' },
          },
        },
      },
    ],
    [
      onUpdateItem,
      workspaceMembers,
      onRowClick,
      onAddContent,
      complianceReadOnly,
    ]
  )

  // ---- Bulk actions ----
  const selectedItemIds = useMemo(() => [...selected], [selected])

  const handleBulkUpdate = async (updates: {
    complianceStatus?: ComplianceStatus
    responsibleUserId?: string | null
  }) => {
    await onBulkUpdate(selectedItemIds, updates)
    setSelected(new Set())
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
          visibility: columnVisibility,
          ...(onColumnVisibilityChange
            ? {
                onVisibilityChange: (updater: Updater<VisibilityState>) =>
                  onColumnVisibilityChange(
                    typeof updater === 'function'
                      ? updater(columnVisibility)
                      : updater
                  ),
              }
            : {}),
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
        expansion={{
          renderExpanded: (row) => (
            <ExpandedRowContent
              row={row}
              complianceReadOnly={complianceReadOnly}
              workspaceMembers={workspaceMembers}
            />
          ),
          expanded,
          onExpandedChange: (updater) =>
            setExpanded(
              typeof updater === 'function' ? updater(expanded) : updater
            ),
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
        rowHeight="tall"
        view={{ cardBelow: 800 }}
      />
    </div>
  )
}

// ============================================================================
// Header with Info Tooltip (non-sortable)
// ============================================================================

function HeaderWithTooltip({
  label,
  tooltipContent,
}: {
  label: string
  tooltipContent: { title: string; lines: string[] }
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="font-medium">{label}</span>
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
          <TooltipContent side="bottom" className="max-w-[280px] p-3">
            <div className="space-y-2">
              <p className="font-semibold text-sm text-foreground">
                {tooltipContent.title}
              </p>
              <ul className="space-y-1.5">
                {tooltipContent.lines.map((line, i) => (
                  <li
                    key={i}
                    className="text-xs text-muted-foreground leading-relaxed flex gap-2"
                  >
                    <span className="text-muted-foreground/60">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
