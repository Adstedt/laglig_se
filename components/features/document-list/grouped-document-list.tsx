'use client'

/**
 * Story 4.13: Grouped Document List (Card View with Accordion)
 * Displays documents grouped into collapsible accordion sections.
 * Items can be dragged between groups.
 */

import { useState, useCallback, useEffect, useMemo, memo } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderX,
  FileText,
  Loader2,
  FolderPlus,
  ExpandIcon,
  MinusIcon,
} from 'lucide-react'
import { DocumentListCard } from './document-list-card'
import { DocumentListGridSkeleton } from './document-list-skeleton'
import { RemoveConfirmation } from './remove-confirmation'
import type {
  DocumentListItem,
  ListGroupSummary,
} from '@/app/actions/document-list'
import { useDebouncedCallback } from 'use-debounce'
import { cn } from '@/lib/utils'

interface GroupedDocumentListProps {
  items: DocumentListItem[]
  groups: ListGroupSummary[]
  expandedGroups: Record<string, boolean>
  total: number
  hasMore: boolean
  isLoading: boolean
  onLoadMore: () => void
  onRemoveItem: (_itemId: string) => Promise<boolean>
  onReorderItems: (
    _items: Array<{ id: string; position: number }>
  ) => Promise<boolean>
  onMoveToGroup: (_itemId: string, _groupId: string | null) => Promise<boolean>
  onToggleGroup: (_groupId: string) => void
  onExpandAll: () => void
  onCollapseAll: () => void
  onManageGroups: () => void
  // Story 4.13 Task 11: Filter by group
  onFilterByGroup?: ((_groupId: string) => void) | undefined
  emptyMessage?: string | undefined
}

// Special ID for ungrouped items
const UNGROUPED_ID = '__ungrouped__'

export function GroupedDocumentList({
  items,
  groups,
  expandedGroups,
  total,
  hasMore,
  isLoading,
  onLoadMore,
  onRemoveItem,
  onReorderItems,
  onMoveToGroup,
  onToggleGroup,
  onExpandAll,
  onCollapseAll,
  onManageGroups,
  onFilterByGroup,
  emptyMessage = 'Inga dokument i listan.',
}: GroupedDocumentListProps) {
  const [removeConfirmItem, setRemoveConfirmItem] =
    useState<DocumentListItem | null>(null)
  const [removingItemId, setRemovingItemId] = useState<string | null>(null)
  const [localItems, setLocalItems] = useState<DocumentListItem[]>(items)
  const [activeId, setActiveId] = useState<string | null>(null)

  // Sync local items with props
  useEffect(() => {
    setLocalItems(items)
  }, [items])

  // Group items by groupId
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

  // Sensors for drag-and-drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Debounced reorder
  const debouncedReorder = useDebouncedCallback(
    async (newItems: DocumentListItem[]) => {
      const updates = newItems.map((item, index) => ({
        id: item.id,
        position: index,
      }))
      await onReorderItems(updates)
    },
    500
  )

  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  // Handle drag end
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)

      if (!over) return

      const activeItem = localItems.find((item) => item.id === active.id)
      if (!activeItem) return

      // Check if dropped on a group header (for moving to group)
      const overId = over.id as string
      if (overId.startsWith('group-header-')) {
        const groupId = overId.replace('group-header-', '')
        const targetGroupId = groupId === UNGROUPED_ID ? null : groupId
        if (activeItem.groupId !== targetGroupId) {
          await onMoveToGroup(activeItem.id, targetGroupId)
        }
        return
      }

      // Otherwise, handle reordering within the same list
      if (active.id !== over.id) {
        const oldIndex = localItems.findIndex((item) => item.id === active.id)
        const newIndex = localItems.findIndex((item) => item.id === over.id)

        if (oldIndex !== -1 && newIndex !== -1) {
          const newItems = arrayMove(localItems, oldIndex, newIndex)
          setLocalItems(newItems)
          debouncedReorder(newItems)
        }
      }
    },
    [localItems, debouncedReorder, onMoveToGroup]
  )

  // Handle remove confirmation
  const handleRemoveClick = (item: DocumentListItem) => {
    setRemoveConfirmItem(item)
  }

  const handleRemoveConfirm = async () => {
    if (!removeConfirmItem) return

    setRemovingItemId(removeConfirmItem.id)
    setRemoveConfirmItem(null)

    await onRemoveItem(removeConfirmItem.id)

    setRemovingItemId(null)
  }

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
      {/* Header with stats and actions - Story 4.13 Task 12: Mobile responsive */}
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
          <Button
            variant="outline"
            size="sm"
            onClick={onManageGroups}
            className="h-8 px-2 sm:px-3"
            title="Hantera grupper"
          >
            <FolderPlus className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Hantera grupper</span>
          </Button>
        </div>
      </div>

      {/* Drag-and-drop context */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col gap-3">
          {/* Render groups */}
          {groups.map((group) => {
            const groupItems = groupedItems[group.id] || []
            const isExpanded = expandedGroups[group.id] ?? true

            return (
              <GroupAccordion
                key={group.id}
                groupId={group.id}
                name={group.name}
                itemCount={groupItems.length}
                isExpanded={isExpanded}
                onToggle={() => onToggleGroup(group.id)}
                onFilter={
                  onFilterByGroup ? () => onFilterByGroup(group.id) : undefined
                }
                items={groupItems}
                onRemoveItem={handleRemoveClick}
                removingItemId={removingItemId}
              />
            )
          })}

          {/* Ungrouped items section */}
          {(ungroupedItems.length > 0 || !hasGroups) && (
            <GroupAccordion
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
              onRemoveItem={handleRemoveClick}
              removingItemId={removingItemId}
              isUngrouped
            />
          )}
        </div>

        {/* Drag overlay */}
        <DragOverlay>
          {activeItem && (
            <div className="opacity-80 shadow-lg">
              <DocumentListCard
                item={activeItem}
                onRemove={() => {}}
                isDragging
                isRemoving={false}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

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

      {/* Remove confirmation dialog */}
      <RemoveConfirmation
        open={!!removeConfirmItem}
        onOpenChange={(open) => !open && setRemoveConfirmItem(null)}
        documentTitle={removeConfirmItem?.document.title ?? ''}
        onConfirm={handleRemoveConfirm}
      />
    </div>
  )
}

// Group accordion component
interface GroupAccordionProps {
  groupId: string
  name: string
  itemCount: number
  isExpanded: boolean
  onToggle: () => void
  onFilter?: (() => void) | undefined // Story 4.13 Task 11: Filter by group click
  items: DocumentListItem[]
  onRemoveItem: (_item: DocumentListItem) => void
  removingItemId: string | null
  isUngrouped?: boolean | undefined
}

// Story 4.13 Task 13: Memoized GroupAccordion for performance
const GroupAccordion = memo(function GroupAccordion({
  groupId,
  name,
  itemCount,
  isExpanded,
  onToggle,
  onFilter,
  items,
  onRemoveItem,
  removingItemId,
  isUngrouped = false,
}: GroupAccordionProps) {
  // Make the header a drop target
  const { setNodeRef, isOver } = useSortable({
    id: `group-header-${groupId}`,
    disabled: false,
  })

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div
        ref={setNodeRef}
        className={cn(
          'rounded-lg border transition-colors',
          isOver && 'ring-2 ring-primary border-primary bg-primary/5'
        )}
      >
        {/* Group header - chevron toggles expand, name filters */}
        {/* Story 4.13 Task 12: Mobile responsive with 44px touch targets */}
        <div
          className={cn(
            'flex w-full items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3',
            'transition-colors min-h-[44px]' // Minimum 44px touch target height
          )}
        >
          {/* Chevron toggle for expand/collapse - larger touch target on mobile */}
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className={cn(
                'p-2 -m-1 rounded hover:bg-muted transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                'min-w-[44px] min-h-[44px] flex items-center justify-center' // 44px touch target
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

          {/* Folder icon - hidden on mobile for cleaner look */}
          <span className="hidden sm:block">
            {isUngrouped ? (
              <FolderX className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <Folder className="h-4 w-4 text-primary shrink-0" />
            )}
          </span>

          {/* Group name - clickable to filter, larger touch target on mobile */}
          {onFilter ? (
            <button
              type="button"
              onClick={onFilter}
              className={cn(
                'font-medium flex-1 text-left py-2 -my-2', // Extended touch area
                'text-sm sm:text-base',
                'hover:text-primary hover:underline underline-offset-2 transition-colors',
                'focus:outline-none focus-visible:text-primary focus-visible:underline',
                'active:text-primary' // Visual feedback on tap
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

          {/* Item count badge - simplified on mobile */}
          <span className="text-xs sm:text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded-full whitespace-nowrap">
            <span className="sm:hidden">{itemCount}</span>
            <span className="hidden sm:inline">{itemCount} dokument</span>
          </span>
        </div>

        {/* Group content - Story 4.13 Task 12: Mobile responsive padding */}
        <CollapsibleContent>
          <div className="px-3 sm:px-4 pb-3 sm:pb-4">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Inga dokument i denna grupp.
              </p>
            ) : (
              <SortableContext
                items={items.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                {/* Fluid grid: cards auto-fit between 220px-320px */}
                <div
                  className="grid gap-3 sm:gap-4 pt-2"
                  style={{
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(220px, 320px))',
                  }}
                >
                  {items.map((item) => (
                    <SortableCard
                      key={item.id}
                      item={item}
                      onRemove={() => onRemoveItem(item)}
                      isRemoving={removingItemId === item.id}
                    />
                  ))}
                </div>
              </SortableContext>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
})

// Sortable card wrapper - Story 4.13 Task 13: Memoized for performance
const SortableCard = memo(function SortableCard({
  item,
  onRemove,
  isRemoving,
}: {
  item: DocumentListItem
  onRemove: () => void
  isRemoving: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = useMemo(
    () => ({
      transform: CSS.Transform.toString(transform),
      transition,
      zIndex: isDragging ? 10 : undefined,
      opacity: isDragging ? 0.5 : 1,
    }),
    [transform, transition, isDragging]
  )

  return (
    <div ref={setNodeRef} style={style}>
      <DocumentListCard
        item={item}
        onRemove={onRemove}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
        isRemoving={isRemoving}
      />
    </div>
  )
})
