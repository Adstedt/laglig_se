'use client'

/**
 * GroupedDataTable (Story 28.7) — collapsible sections, each rendering its
 * own DataTable over one shared column definition. Selection is the same
 * controlled Set across every section (correct by construction). Optional
 * across-sections drag: the core owns the DndContext, header-prioritizing
 * collision detection, droppable section headers and the DragOverlay; the
 * drag SOURCE stays consumer-side (a useDraggable grip in a cell), so no
 * domain dnd logic lives here.
 *
 * Per-section sorting: when `perSectionSorting` is set, every section keeps
 * its own independent local sort (the personalregister behavior); otherwise
 * pass a shared `sorting` adapter.
 */

import { useCallback, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DataTable } from './data-table'
import { useLocalSorting } from './adapters'
import type { DataTableProps, SortingAdapter } from './types'

/** Droppable id prefix for section headers. */
export const DT_SECTION_DROP_PREFIX = 'dt-section-drop:'

export interface DataTableSection<TData> {
  id: string
  items: TData[]
  /**
   * Section header content (rendered inside the collapsible trigger row).
   * Receives collapse state + the section's visible item count.
   */
  header: (_ctx: {
    isCollapsed: boolean
    count: number
    isDropTarget: boolean
  }) => React.ReactNode
  /** Optional per-section empty content (rendered instead of the table). */
  empty?: React.ReactNode
}

export interface GroupedDataTableProps<TData>
  extends Omit<
    DataTableProps<TData>,
    'data' | 'sorting' | 'dnd' | 'loadMore' | 'status' | 'slots'
  > {
  sections: DataTableSection<TData>[]
  /** Controlled collapse state; omit for internal. */
  collapsed?: ReadonlySet<string>
  onCollapsedChange?: (_next: Set<string>) => void
  /** Shared sorting adapter — ignored when perSectionSorting is true. */
  sorting?: SortingAdapter
  /** Each section sorts independently with local state. */
  perSectionSorting?: boolean
  /** Across-sections drag (drop targets = section headers). */
  sectionDnd?: {
    enabled: boolean
    onMoveToSection: (
      _itemId: string,
      _sectionId: string
    ) => Promise<boolean | void> | void
    /** DragOverlay content for the active item. */
    renderDragOverlay?: (_itemId: string) => React.ReactNode
  }
  slots?: DataTableProps<TData>['slots']
}

function SectionShell<TData>({
  section,
  isCollapsed,
  onToggle,
  dndEnabled,
  tableProps,
  sharedSorting,
  perSectionSorting,
}: {
  section: DataTableSection<TData>
  isCollapsed: boolean
  onToggle: () => void
  dndEnabled: boolean
  tableProps: Omit<DataTableProps<TData>, 'data' | 'sorting'>
  sharedSorting: SortingAdapter | undefined
  perSectionSorting: boolean
}) {
  const localSorting = useLocalSorting([])
  const sorting = perSectionSorting ? localSorting : sharedSorting

  const { setNodeRef, isOver } = useDroppable({
    id: `${DT_SECTION_DROP_PREFIX}${section.id}`,
    disabled: !dndEnabled,
  })

  return (
    <Collapsible open={!isCollapsed} onOpenChange={onToggle}>
      <div
        ref={setNodeRef}
        className={cn(
          'rounded-md transition-colors',
          isOver && 'bg-accent/60 ring-2 ring-primary/40'
        )}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            data-dt-section-trigger=""
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-muted/50"
            aria-expanded={!isCollapsed}
          >
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
                isCollapsed && '-rotate-90'
              )}
            />
            <div className="min-w-0 flex-1">
              {section.header({
                isCollapsed,
                count: section.items.length,
                isDropTarget: isOver,
              })}
            </div>
          </button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="mt-2">
          {section.items.length === 0 && section.empty ? (
            section.empty
          ) : (
            <DataTable<TData>
              {...tableProps}
              data={section.items}
              {...(sorting ? { sorting } : {})}
            />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function GroupedDataTable<TData>({
  sections,
  collapsed,
  onCollapsedChange,
  sorting,
  perSectionSorting = false,
  sectionDnd,
  ...tableProps
}: GroupedDataTableProps<TData>) {
  const [internalCollapsed, setInternalCollapsed] = useState<Set<string>>(
    new Set()
  )
  const effectiveCollapsed = collapsed ?? internalCollapsed
  const setCollapsed = onCollapsedChange ?? setInternalCollapsed

  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  const toggleSection = useCallback(
    (id: string) => {
      const next = new Set(effectiveCollapsed)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      setCollapsed(next)
    },
    [effectiveCollapsed, setCollapsed]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Prioritize section-header drop targets over row-level intersections
  // (the proven GroupedDocumentListTable / personalregister approach).
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args)
    const headerCollision = pointerCollisions.find((collision) =>
      String(collision.id).startsWith(DT_SECTION_DROP_PREFIX)
    )
    if (headerCollision) return [headerCollision]
    return rectIntersection(args)
  }, [])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id))
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDragId(null)
      if (!sectionDnd?.enabled) return
      const overId = event.over ? String(event.over.id) : null
      if (!overId || !overId.startsWith(DT_SECTION_DROP_PREFIX)) return
      const sectionId = overId.slice(DT_SECTION_DROP_PREFIX.length)
      void sectionDnd.onMoveToSection(String(event.active.id), sectionId)
    },
    [sectionDnd]
  )

  // exactOptionalPropertyTypes: strip undefined-valued optionals before the
  // spread into DataTable (rest props carry `| undefined` on every key).
  const cleanTableProps = Object.fromEntries(
    Object.entries(tableProps).filter(([, v]) => v !== undefined)
  ) as Omit<DataTableProps<TData>, 'data' | 'sorting'>

  const content = (
    <div className="flex flex-col gap-4">
      {sections.map((section) => (
        <SectionShell<TData>
          key={section.id}
          section={section}
          isCollapsed={effectiveCollapsed.has(section.id)}
          onToggle={() => toggleSection(section.id)}
          dndEnabled={Boolean(sectionDnd?.enabled)}
          tableProps={cleanTableProps}
          sharedSorting={sorting}
          perSectionSorting={perSectionSorting}
        />
      ))}
    </div>
  )

  if (!sectionDnd?.enabled) return content

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDragId(null)}
    >
      {content}
      <DragOverlay>
        {activeDragId && sectionDnd.renderDragOverlay
          ? sectionDnd.renderDragOverlay(activeDragId)
          : null}
      </DragOverlay>
    </DndContext>
  )
}
