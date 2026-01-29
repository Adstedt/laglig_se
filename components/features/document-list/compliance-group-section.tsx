'use client'

/**
 * Story 6.18: ComplianceGroupSection component
 * Collapsible accordion section containing a ComplianceDetailTable for a single group.
 * Mirrors GroupTableSection but uses compliance-specific columns.
 */

import { memo, useCallback, useState, useEffect } from 'react'
import { useDroppable } from '@dnd-kit/core'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ChevronDown, ChevronRight, Folder, FolderX } from 'lucide-react'
import { ComplianceDetailTable } from './compliance-detail-table'
import { GroupComplianceIndicator } from './group-compliance-indicator'
import type {
  DocumentListItem,
  ListGroupSummary,
  WorkspaceMemberOption,
} from '@/app/actions/document-list'
import type { ComplianceStatus, LawListItemPriority } from '@prisma/client'
import type { ColumnSizingState } from '@tanstack/react-table'
import { cn } from '@/lib/utils'

interface ComplianceGroupSectionProps {
  groupId: string
  name: string
  itemCount: number
  isExpanded: boolean
  onToggle: () => void
  onFilter?: (() => void) | undefined
  items: DocumentListItem[]
  columnVisibility?: Record<string, boolean>
  columnSizing?: ColumnSizingState
  onColumnSizingChange?: ((_sizing: ColumnSizingState) => void) | undefined
  onUpdateItem: (
    _itemId: string,
    _updates: {
      complianceStatus?: ComplianceStatus
      priority?: LawListItemPriority
      responsibleUserId?: string | null
    }
  ) => Promise<boolean>
  onRemoveItem: (_itemId: string) => Promise<boolean>
  onReorderItems: (
    _items: Array<{ id: string; position: number }>
  ) => Promise<boolean>
  onRowClick?: ((_itemId: string) => void) | undefined
  onAddContent?:
    | ((
        _listItemId: string,
        _field: 'businessContext' | 'complianceActions'
      ) => void)
    | undefined
  workspaceMembers: WorkspaceMemberOption[]
  groups: ListGroupSummary[]
  onMoveToGroup?:
    | ((_itemId: string, _groupId: string | null) => Promise<boolean>)
    | undefined
  isUngrouped?: boolean | undefined
  isDropTarget?: boolean | undefined
}

export const ComplianceGroupSection = memo(function ComplianceGroupSection({
  groupId,
  name,
  itemCount,
  isExpanded,
  onToggle,
  onFilter,
  items,
  onUpdateItem,
  onRemoveItem,
  onReorderItems,
  onRowClick,
  onAddContent,
  workspaceMembers,
  groups,
  onMoveToGroup: _onMoveToGroup,
  isUngrouped = false,
  isDropTarget = false,
  columnVisibility = {},
  columnSizing = {},
  onColumnSizingChange,
}: ComplianceGroupSectionProps) {
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

  // Handle bulk update passthrough (handled at parent level)
  const handleBulkUpdate = useCallback(
    async (
      _itemIds: string[],
      _updates: {
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
              <ComplianceDetailTable
                items={items}
                total={itemCount}
                hasMore={false}
                isLoading={false}
                workspaceMembers={workspaceMembers}
                columnVisibility={columnVisibility}
                columnSizing={columnSizing}
                onColumnSizingChange={onColumnSizingChange}
                onLoadMore={() => {}}
                onUpdateItem={onUpdateItem}
                onBulkUpdate={handleBulkUpdate}
                onRemoveItem={onRemoveItem}
                onReorderItems={onReorderItems}
                onRowClick={onRowClick}
                onAddContent={onAddContent}
                groups={groups}
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
