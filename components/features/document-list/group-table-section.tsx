'use client'

/**
 * Story 6.14: GroupTableSection component
 * Story 6.17: Added compliance and priority indicators to group headers
 * Collapsible accordion section containing a DocumentListTable for a single group.
 * Header is a drop target for cross-group drag-and-drop.
 */

import { memo, useCallback, useMemo, useState, useEffect } from 'react'
import { useDroppable } from '@dnd-kit/core'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ChevronDown, ChevronRight, Folder, FolderX } from 'lucide-react'
import { DocumentListTable } from './document-list-table'
import { GroupComplianceIndicator } from './group-compliance-indicator'
import { GroupPriorityIndicator } from './group-priority-indicator'
import type {
  DocumentListItem,
  ListGroupSummary,
  WorkspaceMemberOption,
} from '@/app/actions/document-list'
import type {
  LawListItemStatus,
  LawListItemPriority,
  ComplianceStatus,
} from '@prisma/client'
import type {
  VisibilityState,
  ColumnSizingState,
  ColumnOrderState,
} from '@tanstack/react-table'
import type { TaskProgress, LastActivity } from '@/lib/db/queries/list-items'
import { cn } from '@/lib/utils'

interface GroupTableSectionProps {
  groupId: string
  name: string
  itemCount: number
  isExpanded: boolean
  onToggle: () => void
  onFilter?: (() => void) | undefined
  items: DocumentListItem[]
  columnVisibility: VisibilityState
  onColumnVisibilityChange: (_visibility: VisibilityState) => void
  columnSizing?: ColumnSizingState | undefined
  onColumnSizingChange?: ((_sizing: ColumnSizingState) => void) | undefined
  columnOrder?: ColumnOrderState | undefined
  onColumnOrderChange?: ((_order: ColumnOrderState) => void) | undefined
  onUpdateItem: (
    _itemId: string,
    _updates: {
      status?: LawListItemStatus
      priority?: LawListItemPriority
      dueDate?: Date | null
      assignedTo?: string | null
      groupId?: string | null
      complianceStatus?: ComplianceStatus
      responsibleUserId?: string | null
    }
  ) => Promise<boolean>
  onRemoveItem: (_itemId: string) => Promise<boolean>
  onReorderItems: (
    _items: Array<{ id: string; position: number }>
  ) => Promise<boolean>
  onRowClick?: ((_itemId: string) => void) | undefined
  onSelectionChange: (_itemIds: string[], _isSelected: boolean) => void
  selectedItemIds: Set<string>
  workspaceMembers: WorkspaceMemberOption[]
  groups: ListGroupSummary[]
  onMoveToGroup?:
    | ((_itemId: string, _groupId: string | null) => Promise<boolean>)
    | undefined
  taskProgress?: Map<string, TaskProgress> | undefined
  lastActivity?: Map<string, LastActivity> | undefined
  isUngrouped?: boolean | undefined
  isDropTarget?: boolean | undefined
}

export const GroupTableSection = memo(function GroupTableSection({
  groupId,
  name,
  itemCount,
  isExpanded,
  onToggle,
  onFilter,
  items,
  columnVisibility,
  onColumnVisibilityChange,
  columnSizing = {},
  onColumnSizingChange,
  columnOrder,
  onColumnOrderChange,
  onUpdateItem,
  onRemoveItem,
  onReorderItems,
  onRowClick,
  onSelectionChange: _onSelectionChange, // Tracked at parent level
  selectedItemIds: _selectedItemIds, // Tracked at parent level
  workspaceMembers,
  groups,
  onMoveToGroup,
  taskProgress,
  lastActivity,
  isUngrouped = false,
  isDropTarget = false,
}: GroupTableSectionProps) {
  // Local state for instant toggle response, synced with prop
  const [localExpanded, setLocalExpanded] = useState(isExpanded)

  // Sync local state when prop changes (e.g., expand all / collapse all)
  useEffect(() => {
    setLocalExpanded(isExpanded)
  }, [isExpanded])

  // Handle toggle with instant local update
  const handleToggle = useCallback(() => {
    setLocalExpanded((prev) => !prev)
    onToggle()
  }, [onToggle])

  // Make the group header a drop target
  const { setNodeRef } = useDroppable({
    id: `group-header-${groupId}`,
  })

  // Hide the group column in grouped view (redundant info)
  const effectiveColumnVisibility = useMemo(
    () => ({
      ...columnVisibility,
      group: false, // Always hide group column in grouped table mode
    }),
    [columnVisibility]
  )

  // Handle bulk update passthrough (handled at GroupedDocumentListTable level)
  const handleBulkUpdate = useCallback(
    async (
      _itemIds: string[],
      _updates: {
        status?: LawListItemStatus
        priority?: LawListItemPriority
        complianceStatus?: ComplianceStatus
        responsibleUserId?: string | null
      }
    ) => {
      // Bulk updates are handled at the parent level
      return false
    },
    []
  )

  return (
    <Collapsible open={localExpanded} onOpenChange={handleToggle}>
      <div
        ref={setNodeRef}
        className={cn(
          'rounded-lg border transition-colors',
          isDropTarget
            ? 'border-primary border-2 bg-primary/5'
            : 'border-border/50 bg-muted/20'
        )}
      >
        {/* Group header - 44px minimum touch target for mobile accessibility */}
        <div
          className={cn(
            'flex w-full items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3',
            'transition-colors min-h-[44px]'
          )}
        >
          {/* Chevron toggle for expand/collapse */}
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className={cn(
                'p-2 -m-1 rounded hover:bg-muted transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                'min-w-[44px] min-h-[44px] flex items-center justify-center'
              )}
              title={isExpanded ? 'Fäll ihop' : 'Expandera'}
            >
              {isExpanded ? (
                <ChevronDown className="h-5 w-5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="h-5 w-5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
              )}
            </button>
          </CollapsibleTrigger>

          {/* Folder icon */}
          <span className="hidden sm:block">
            {isUngrouped ? (
              <FolderX className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <Folder className="h-4 w-4 text-primary shrink-0" />
            )}
          </span>

          {/* Group name - clickable to filter */}
          {onFilter ? (
            <button
              type="button"
              onClick={onFilter}
              className={cn(
                'font-medium flex-1 text-left py-2 -my-2',
                'text-sm sm:text-base',
                'hover:text-primary hover:underline underline-offset-2 transition-colors',
                'focus:outline-none focus-visible:text-primary focus-visible:underline',
                'active:text-primary'
              )}
              title={`Filtrera till "${name}"`}
            >
              {name}
            </button>
          ) : (
            <span className="font-medium flex-1 text-left text-sm sm:text-base">
              {name}
            </span>
          )}

          {/* Story 6.17: Compliance progress indicator */}
          {items.length > 0 && (
            <TooltipProvider delayDuration={300}>
              <GroupComplianceIndicator items={items} />
            </TooltipProvider>
          )}

          {/* Story 6.17: Priority risk badges - hidden on mobile (AC: 15) */}
          {items.length > 0 && (
            <div className="hidden sm:flex">
              <TooltipProvider delayDuration={300}>
                <GroupPriorityIndicator items={items} />
              </TooltipProvider>
            </div>
          )}

          {/* Item count badge */}
          <span className="text-xs sm:text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full whitespace-nowrap">
            <span className="sm:hidden">{itemCount}</span>
            <span className="hidden sm:inline">{itemCount} dokument</span>
          </span>
        </div>

        {/* Group content */}
        <CollapsibleContent>
          <div className="px-3 sm:px-4 pb-3 sm:pb-4">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Inga dokument i denna grupp.
              </p>
            ) : (
              <DocumentListTable
                items={items}
                total={itemCount}
                hasMore={false}
                isLoading={false}
                columnVisibility={effectiveColumnVisibility}
                onColumnVisibilityChange={onColumnVisibilityChange}
                columnSizing={columnSizing}
                onColumnSizingChange={onColumnSizingChange}
                columnOrder={columnOrder}
                onColumnOrderChange={onColumnOrderChange}
                onLoadMore={() => {}}
                onUpdateItem={onUpdateItem}
                onBulkUpdate={handleBulkUpdate}
                onRemoveItem={onRemoveItem}
                onReorderItems={onReorderItems}
                onRowClick={onRowClick}
                workspaceMembers={workspaceMembers}
                groups={groups}
                onMoveToGroup={onMoveToGroup}
                taskProgress={taskProgress}
                lastActivity={lastActivity}
                hideGroupColumn
                disableDndContext
              />
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
})
