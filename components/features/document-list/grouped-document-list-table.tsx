'use client'

/**
 * Story 6.14: Grouped Accordion Tables for List View
 * Displays documents in table format with collapsible accordion sections per group.
 * Items can be dragged between group headers.
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  type DragOverEvent,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { Button } from '@/components/ui/button'
import { ExpandIcon, MinusIcon, FileText, Loader2 } from 'lucide-react'
import { GroupTableSection } from './group-table-section'
import { DocumentListGridSkeleton } from './document-list-skeleton'
import { BulkActionBar } from './bulk-action-bar'
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
import type { VisibilityState } from '@tanstack/react-table'
import type { TaskProgress, LastActivity } from '@/lib/db/queries/list-items'

// Special ID for ungrouped items
const UNGROUPED_ID = '__ungrouped__'

interface GroupedDocumentListTableProps {
  items: DocumentListItem[]
  groups: ListGroupSummary[]
  expandedGroups: Record<string, boolean>
  total: number
  hasMore: boolean
  isLoading: boolean
  columnVisibility: VisibilityState
  onColumnVisibilityChange: (_visibility: VisibilityState) => void
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
      groupId?: string | null
      complianceStatus?: ComplianceStatus
      responsibleUserId?: string | null
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
  onMoveToGroup: (_itemId: string, _groupId: string | null) => Promise<boolean>
  onToggleGroup: (_groupId: string) => void
  onExpandAll: () => void
  onCollapseAll: () => void
  onFilterByGroup?: ((_groupId: string) => void) | undefined
  onRowClick?: ((_itemId: string) => void) | undefined
  workspaceMembers: WorkspaceMemberOption[]
  taskProgress?: Map<string, TaskProgress>
  lastActivity?: Map<string, LastActivity>
  emptyMessage?: string | undefined
}

export function GroupedDocumentListTable({
  items,
  groups,
  expandedGroups,
  total,
  hasMore,
  isLoading,
  columnVisibility,
  onColumnVisibilityChange,
  onLoadMore,
  onRemoveItem,
  onReorderItems,
  onUpdateItem,
  onBulkUpdate,
  onMoveToGroup,
  onToggleGroup,
  onExpandAll,
  onCollapseAll,
  onFilterByGroup,
  onRowClick,
  workspaceMembers,
  taskProgress,
  lastActivity,
  emptyMessage = 'Inga dokument i listan.',
}: GroupedDocumentListTableProps) {
  const [localItems, setLocalItems] = useState<DocumentListItem[]>(items)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overGroupId, setOverGroupId] = useState<string | null>(null)
  // Track selected items across all sections for combined BulkActionBar
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set())

  // Sync local items with props
  useEffect(() => {
    setLocalItems(items)
  }, [items])

  // Group items by groupId (reuse pattern from grouped-document-list.tsx)
  const { groupedItems, ungroupedItems, hasGroups } = useMemo(() => {
    const grouped: Record<string, DocumentListItem[]> = {}
    const ungrouped: DocumentListItem[] = []

    // Initialize groups
    groups.forEach((group) => {
      grouped[group.id] = []
    })

    // Distribute items
    localItems.forEach((item) => {
      const groupItems = item.groupId ? grouped[item.groupId] : undefined
      if (groupItems) {
        groupItems.push(item)
      } else {
        ungrouped.push(item)
      }
    })

    return {
      groupedItems: grouped,
      ungroupedItems: ungrouped,
      hasGroups: groups.length > 0,
    }
  }, [localItems, groups])

  // Sensors for drag-and-drop - increase distance to reduce accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Custom collision detection that prioritizes group headers
  const collisionDetection: CollisionDetection = useCallback((args) => {
    // First check for group header collisions (they take priority)
    const pointerCollisions = pointerWithin(args)
    const headerCollision = pointerCollisions.find((collision) =>
      (collision.id as string).startsWith('group-header-')
    )
    if (headerCollision) {
      return [headerCollision]
    }

    // Fall back to rect intersection for row targets
    return rectIntersection(args)
  }, [])

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
    setOverGroupId(null)
  }, [])

  // Handle drag over - track which group we're hovering over
  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { over, active } = event
      if (!over) {
        setOverGroupId(null)
        return
      }

      const activeItem = localItems.find((item) => item.id === active.id)
      if (!activeItem) return

      const overId = over.id as string

      // Check if over a group header
      if (overId.startsWith('group-header-')) {
        const groupId = overId.replace('group-header-', '')
        const targetGroupId = groupId === UNGROUPED_ID ? null : groupId
        // Only highlight if different from current group
        if (activeItem.groupId !== targetGroupId) {
          setOverGroupId(groupId)
        } else {
          setOverGroupId(null)
        }
        return
      }

      // Check if over a row in a different group
      const overItem = localItems.find((item) => item.id === overId)
      if (overItem && activeItem.groupId !== overItem.groupId) {
        // Highlight the target group
        setOverGroupId(overItem.groupId ?? UNGROUPED_ID)
      } else {
        setOverGroupId(null)
      }
    },
    [localItems]
  )

  // Handle drag end
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)
      setOverGroupId(null)

      if (!over) return

      const activeItem = localItems.find((item) => item.id === active.id)
      if (!activeItem) return

      const overId = over.id as string

      // Check if dropped on a group header (for moving to group)
      if (overId.startsWith('group-header-')) {
        const groupId = overId.replace('group-header-', '')
        const targetGroupId = groupId === UNGROUPED_ID ? null : groupId
        if (activeItem.groupId !== targetGroupId) {
          await onMoveToGroup(activeItem.id, targetGroupId)
        }
        return
      }

      // Check if dropped on a row in a different group
      const overItem = localItems.find((item) => item.id === overId)
      if (overItem && activeItem.groupId !== overItem.groupId) {
        // Move to the target item's group
        await onMoveToGroup(activeItem.id, overItem.groupId)
        return
      }

      // Same group reordering - handle here since inner tables don't have DndContext
      if (
        overItem &&
        activeItem.groupId === overItem.groupId &&
        active.id !== over.id
      ) {
        const oldIndex = localItems.findIndex((item) => item.id === active.id)
        const newIndex = localItems.findIndex((item) => item.id === over.id)
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          // Optimistic update using arrayMove pattern
          const newItems = [...localItems]
          const item = newItems[oldIndex]
          if (!item) return
          newItems.splice(oldIndex, 1)
          newItems.splice(newIndex, 0, item)
          setLocalItems(newItems)

          // Persist reorder
          const updates = newItems.map((it, index) => ({
            id: it.id,
            position: index,
          }))
          await onReorderItems(updates)
        }
      }
    },
    [localItems, onMoveToGroup, onReorderItems]
  )

  // Handle selection changes from individual sections
  const handleSelectionChange = useCallback(
    (_groupId: string, itemIds: string[], isSelected: boolean) => {
      setSelectedItemIds((prev) => {
        const next = new Set(prev)
        itemIds.forEach((id) => {
          if (isSelected) {
            next.add(id)
          } else {
            next.delete(id)
          }
        })
        return next
      })
    },
    []
  )

  // Handle bulk update for selected items (returns void for BulkActionBar compatibility)
  const handleBulkUpdate = useCallback(
    async (updates: {
      priority?: LawListItemPriority
      complianceStatus?: ComplianceStatus
      responsibleUserId?: string | null
    }): Promise<void> => {
      const success = await onBulkUpdate(Array.from(selectedItemIds), updates)
      if (success) {
        setSelectedItemIds(new Set())
      }
    },
    [selectedItemIds, onBulkUpdate]
  )

  // Clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedItemIds(new Set())
  }, [])

  // Get the active item for drag overlay
  const activeItem = activeId
    ? localItems.find((item) => item.id === activeId)
    : null

  // Loading state
  if (isLoading && items.length === 0) {
    return <DocumentListGridSkeleton />
  }

  // Empty state
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <div className="rounded-full bg-muted p-4">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground max-w-md">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Bulk action bar for cross-section selection */}
      {selectedItemIds.size > 0 && (
        <BulkActionBar
          selectedCount={selectedItemIds.size}
          onClearSelection={handleClearSelection}
          onBulkUpdate={handleBulkUpdate}
          workspaceMembers={workspaceMembers}
        />
      )}

      {/* Header with stats and expand/collapse controls */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Visar {items.length} av {total} dokument.
          {hasGroups && (
            <span className="hidden sm:inline ml-1">
              Dra till grupprubriker för att flytta.
            </span>
          )}
        </p>
        <div className="flex items-center gap-1 sm:gap-2">
          {hasGroups && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={onExpandAll}
                className="h-8 text-xs px-2 sm:px-3"
                title="Visa alla grupper"
              >
                <ExpandIcon className="h-3.5 w-3.5 sm:mr-1" />
                <span className="hidden sm:inline">Visa alla</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onCollapseAll}
                className="h-8 text-xs px-2 sm:px-3"
                title="Dölj alla grupper"
              >
                <MinusIcon className="h-3.5 w-3.5 sm:mr-1" />
                <span className="hidden sm:inline">Dölj alla</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Single outer DndContext for cross-group drag-and-drop */}
      <div className="overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-col gap-3">
            {/* Render group sections */}
            {groups.map((group) => {
              const groupItems = groupedItems[group.id] || []
              const isExpanded = expandedGroups[group.id] ?? true

              return (
                <GroupTableSection
                  key={group.id}
                  groupId={group.id}
                  name={group.name}
                  itemCount={groupItems.length}
                  isExpanded={isExpanded}
                  onToggle={() => onToggleGroup(group.id)}
                  onFilter={
                    onFilterByGroup
                      ? () => onFilterByGroup(group.id)
                      : undefined
                  }
                  items={groupItems}
                  columnVisibility={columnVisibility}
                  onColumnVisibilityChange={onColumnVisibilityChange}
                  onUpdateItem={onUpdateItem}
                  onRemoveItem={onRemoveItem}
                  onReorderItems={onReorderItems}
                  onRowClick={onRowClick}
                  onSelectionChange={(itemIds, isSelected) =>
                    handleSelectionChange(group.id, itemIds, isSelected)
                  }
                  selectedItemIds={selectedItemIds}
                  workspaceMembers={workspaceMembers}
                  groups={groups}
                  onMoveToGroup={onMoveToGroup}
                  taskProgress={taskProgress}
                  lastActivity={lastActivity}
                  isDropTarget={overGroupId === group.id}
                />
              )
            })}

            {/* Ungrouped items section */}
            {(ungroupedItems.length > 0 || groups.length > 0) && (
              <GroupTableSection
                groupId={UNGROUPED_ID}
                name="Ogrupperade"
                itemCount={ungroupedItems.length}
                isExpanded={expandedGroups[UNGROUPED_ID] ?? true}
                onToggle={() => onToggleGroup(UNGROUPED_ID)}
                onFilter={
                  onFilterByGroup
                    ? () => onFilterByGroup(UNGROUPED_ID)
                    : undefined
                }
                items={ungroupedItems}
                columnVisibility={columnVisibility}
                onColumnVisibilityChange={onColumnVisibilityChange}
                onUpdateItem={onUpdateItem}
                onRemoveItem={onRemoveItem}
                onReorderItems={onReorderItems}
                onRowClick={onRowClick}
                onSelectionChange={(itemIds, isSelected) =>
                  handleSelectionChange(UNGROUPED_ID, itemIds, isSelected)
                }
                selectedItemIds={selectedItemIds}
                workspaceMembers={workspaceMembers}
                groups={groups}
                onMoveToGroup={onMoveToGroup}
                taskProgress={taskProgress}
                lastActivity={lastActivity}
                isUngrouped
                isDropTarget={overGroupId === UNGROUPED_ID}
              />
            )}
          </div>

          {/* Drag overlay - show dragged item info */}
          {/* dropAnimation={null} prevents the "return to origin" ghost effect on drop */}
          <DragOverlay dropAnimation={null}>
            {activeItem && (
              <div className="bg-background border rounded-md p-3 shadow-lg opacity-90">
                <span className="font-medium text-sm">
                  {activeItem.document.title}
                </span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Load more button */}
      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={onLoadMore} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Laddar...
              </>
            ) : (
              'Visa fler'
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
