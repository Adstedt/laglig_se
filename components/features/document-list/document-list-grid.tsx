'use client'

/**
 * Story 4.11: Document List Grid
 * Responsive grid with drag-and-drop reordering
 */

import { useState, useCallback, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DocumentListCard } from './document-list-card'
import { DocumentListGridSkeleton } from './document-list-skeleton'
import { RemoveConfirmation } from './remove-confirmation'
import { Button } from '@/components/ui/button'
import { FileText, Loader2 } from 'lucide-react'
import type { DocumentListItem } from '@/app/actions/document-list'
import { useDebouncedCallback } from 'use-debounce'

interface DocumentListGridProps {
  items: DocumentListItem[]
  total: number
  hasMore: boolean
  isLoading: boolean
  onLoadMore: () => void
  onRemoveItem: (_itemId: string) => Promise<boolean>
  onReorderItems: (
    _items: Array<{ id: string; position: number }>
  ) => Promise<boolean>
  emptyMessage?: string
}

export function DocumentListGrid({
  items,
  total,
  hasMore,
  isLoading,
  onLoadMore,
  onRemoveItem,
  onReorderItems,
  emptyMessage = 'Inga dokument i listan.',
}: DocumentListGridProps) {
  const [removeConfirmItem, setRemoveConfirmItem] =
    useState<DocumentListItem | null>(null)
  const [removingItemId, setRemovingItemId] = useState<string | null>(null)
  const [localItems, setLocalItems] = useState<DocumentListItem[]>(items)

  // Sync local items with props
  useEffect(() => {
    setLocalItems(items)
  }, [items])

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

  // Debounced reorder to batch rapid changes
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

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event

      if (over && active.id !== over.id) {
        const oldIndex = localItems.findIndex((item) => item.id === active.id)
        const newIndex = localItems.findIndex((item) => item.id === over.id)

        const newItems = arrayMove(localItems, oldIndex, newIndex)
        setLocalItems(newItems)
        debouncedReorder(newItems)
      }
    },
    [localItems, debouncedReorder]
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
      {/* Sort indicator */}
      <p className="text-sm text-muted-foreground">
        Visar {items.length} av {total} dokument.
        <span className="ml-2">Dra för att ändra ordning.</span>
      </p>

      {/* Drag-and-drop grid */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={localItems.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 320px))',
            }}
          >
            {localItems.map((item) => (
              <SortableCard
                key={item.id}
                item={item}
                onRemove={() => handleRemoveClick(item)}
                isRemoving={removingItemId === item.id}
              />
            ))}
          </div>
        </SortableContext>
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

// Sortable card wrapper
function SortableCard({
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  }

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
}
